#!/usr/bin/env node
// Ontology quality checks, run in CI (needs Java + ROBOT): writes data/quality/<id>.json.
//   - ROBOT reason (ELK): logical consistency and unsatisfiable classes
//   - ROBOT report: errors / warnings / info
//   - OOPS! (OntOlogy Pitfall Scanner) REST service: critical / important / minor pitfalls
// Ontologies already checked by the OBO Dashboard skip the ROBOT step (the dashboard result is used).
// Env: ROBOT_JAR (path to robot.jar), ONLY=id1,id2, MAX_MB (default 150), SKIP_OOPS=1
import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { isOntology } from "./rubric.mjs";

const run = promisify(execFile);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(await readFile(path.join(root, "data/catalog.json"), "utf8"));
const outDir = path.join(root, "data/quality");
const work = path.join(os.tmpdir(), "neuroschema-quality");
const ROBOT = process.env.ROBOT_JAR;
const MAX_MB = Number(process.env.MAX_MB || 150);
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
await mkdir(outDir, { recursive: true });
await mkdir(work, { recursive: true });

const dash = await fetch("https://dashboard.obofoundry.org/dashboard/dashboard-results.json").then((r) => r.json()).catch(() => ({ ontologies: [] }));
const onDashboard = new Set((dash.ontologies || []).map((o) => o.namespace));

const robotVersion = ROBOT ? (await run("java", ["-jar", ROBOT, "--version"]).catch(() => ({ stdout: "" }))).stdout.trim() : null;

async function download(url, file) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "neuroschema-quality/1.0 (+https://neuroschema.org)" } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_MB * 1e6) throw new Error(`file is ${(len / 1e6).toFixed(0)} MB (limit ${MAX_MB} MB)`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
  const size = (await stat(file)).size;
  if (size > MAX_MB * 1e6) throw new Error(`file is ${(size / 1e6).toFixed(0)} MB (limit ${MAX_MB} MB)`);
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function robotChecks(file) {
  const java = ["-Xmx6G", "-jar", ROBOT];
  const result = { reasoner: "ELK", robotVersion };
  // reason: exits non-zero if inconsistent or (by default) if there are unsatisfiable classes.
  const r = await run("java", [...java, "reason", "--input", file, "--reasoner", "ELK", "--equivalent-classes-allowed", "all", "--dump-unsatisfiable", path.join(work, "unsat.ofn")], { maxBuffer: 1 << 26, timeout: 20 * 60e3 }).then(
    () => ({ ok: true, out: "" }),
    (e) => ({ ok: false, out: `${e.stdout || ""}${e.stderr || ""}` })
  );
  if (r.ok) Object.assign(result, { consistent: true, unsatisfiable: 0 });
  else if (/inconsistent/i.test(r.out)) Object.assign(result, { consistent: false, unsatisfiable: null });
  else if (/unsatisfiable/i.test(r.out)) {
    const n = existsSync(path.join(work, "unsat.ofn")) ? ((await readFile(path.join(work, "unsat.ofn"), "utf8")).match(/^Declaration\(Class/gm) || []).length : null;
    Object.assign(result, { consistent: true, unsatisfiable: n ?? 1 });
  } else Object.assign(result, { consistent: null, reasonError: r.out.slice(-400) });

  const rep = path.join(work, "report.tsv");
  await run("java", [...java, "report", "--input", file, "--fail-on", "none", "--output", rep], { maxBuffer: 1 << 26, timeout: 20 * 60e3 }).catch(() => {});
  if (existsSync(rep)) {
    const rows = (await readFile(rep, "utf8")).split("\n").slice(1).filter(Boolean);
    const count = (lvl) => rows.filter((l) => l.startsWith(lvl)).length;
    result.robot = { ERROR: count("ERROR"), WARN: count("WARN"), INFO: count("INFO") };
    await rm(rep);
  }
  return result;
}

// OOPS! REST: POST XML, response lists pitfalls with an importance level.
async function oops(url) {
  const body = `<?xml version="1.0" encoding="UTF-8"?><OOPSRequest><OntologyURI></OntologyURI><OntologyContent></OntologyContent><OntologyUrl>${url}</OntologyUrl><Pitfalls></Pitfalls><OutputFormat>RDF/XML</OutputFormat></OOPSRequest>`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 180e3);
  try {
    const res = await fetch("https://oops.linkeddata.es/rest", { method: "POST", headers: { "Content-Type": "application/xml" }, body, signal: ctrl.signal });
    if (!res.ok) return { error: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
    const xml = await res.text();
    const levels = [...xml.matchAll(/hasImportanceLevel[^>]*>\s*(Critical|Important|Minor)\s*</gi)].map((m) => m[1].toLowerCase());
    const codes = [...xml.matchAll(/hasCode[^>]*>\s*(P\d+)\s*</gi)].map((m) => m[1]);
    return { critical: levels.filter((l) => l === "critical").length, important: levels.filter((l) => l === "important").length, minor: levels.filter((l) => l === "minor").length, pitfalls: codes, service: "https://oops.linkeddata.es/rest", checkedAt: new Date().toISOString() };
  } catch (e) {
    return { error: e.name === "AbortError" ? "timeout" : e.message, checkedAt: new Date().toISOString() };
  } finally {
    clearTimeout(t);
  }
}

const targets = catalog.filter((e) => isOntology(e) && e.download && (!only || only.has(e.id)));
console.log(`Quality checks for ${targets.length} ontologies (ROBOT: ${robotVersion || "not available"})`);
for (const e of targets) {
  const out = path.join(outDir, `${e.id}.json`);
  const prev = existsSync(out) ? JSON.parse(await readFile(out, "utf8")) : {};
  const rec = { id: e.id, artefact: e.download, checkedAt: new Date().toISOString() };
  if (ROBOT && !onDashboard.has(e.obo)) {
    const file = path.join(work, `${e.id}.owl`);
    try {
      rec.sha256 = await download(e.download, file);
      rec.robot = { ...(await robotChecks(file)), checkedAt: new Date().toISOString(), sha256: rec.sha256 };
    } catch (err) {
      rec.robot = prev.robot ? { ...prev.robot, stale: true, staleReason: err.message } : { error: err.message };
    } finally {
      await rm(file, { force: true });
    }
  } else if (prev.robot) rec.robot = prev.robot;
  if (!process.env.SKIP_OOPS) {
    const o = await oops(e.download);
    rec.oops = o.error && prev.oops && !prev.oops.error ? { ...prev.oops, stale: true, staleReason: o.error } : o;
  } else if (prev.oops) rec.oops = prev.oops;
  await writeFile(out, JSON.stringify(rec, null, 2) + "\n");
  console.log(`  ${e.id}: ${rec.robot ? (rec.robot.error ? `robot error (${rec.robot.error})` : `consistent=${rec.robot.consistent} unsat=${rec.robot.unsatisfiable} report=${JSON.stringify(rec.robot.robot || {})}`) : "robot skipped (OBO Dashboard)"}; oops ${rec.oops?.error ? `unavailable (${rec.oops.error})` : rec.oops ? `${rec.oops.critical} critical / ${rec.oops.important} important` : "skipped"}`);
}
