#!/usr/bin/env node
// Automated evaluation of every catalog entry, with provenance.
//
// Every run:
//   - fetches fresh facts from each source and records where (`source`) and when (`fetchedAt`) each came from,
//   - archives the full run as data/runs/<run-id>.json (never overwritten, so history is kept),
//   - updates data/evaluation.json, the latest results the site reads.
// If a lookup fails (rate limit, outage), the last good value is carried forward with `stale: true`
// and keeps its original `fetchedAt`, so the site never shows a fact as fresher than it is.
//
// Optional env vars:
//   GITHUB_TOKEN        GitHub API token (unauthenticated limit is 60 requests/hour)
//   BIOPORTAL_API_KEY   adds BioPortal release dates for BioPortal-only entries
//   ONLY=id1,id2        evaluate just these entries (a partial run; other entries keep their last results)
//   NO_ARCHIVE=1        don't write a run snapshot (used for pull-request previews)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { RUBRIC_VERSION, scoreEntry } from "./rubric.mjs";

export const EVALUATOR_VERSION = "1.2.0";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(await readFile(path.join(root, "data/catalog.json"), "utf8"));
const outFile = path.join(root, "data/evaluation.json");
const runsDir = path.join(root, "data/runs");
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",").filter(Boolean)) : null;
const previous = existsSync(outFile) ? JSON.parse(await readFile(outFile, "utf8")) : { entries: {} };

const UA = "Mozilla/5.0 (compatible; neuroschema-evaluator/1.1; +https://neuroschema.org/evaluation/)";
const GH = process.env.GITHUB_TOKEN;
const BP = process.env.BIOPORTAL_API_KEY;
const now = () => new Date().toISOString();
const startedAt = now();
const runId = startedAt.replace(/\.\d+Z$/, "Z").replace(/:/g, "-");

async function get(url, { json = false, headers = {}, timeout = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, redirect: "follow", signal: ctrl.signal });
    const body = json && res.ok ? await res.json() : (await res.body?.cancel(), null);
    return { code: res.status, ok: res.ok, body, lastModified: res.headers.get("last-modified"), finalUrl: res.url };
  } catch (e) {
    return { code: 0, ok: false, body: null, error: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(t);
  }
}

// ok = reachable; blocked = server refused an automated check (still counts as reachable); dead = gone or erroring.
function linkState(code) {
  if (code >= 200 && code < 400) return "ok";
  if ([401, 403, 405, 406, 429, 999].includes(code)) return "blocked";
  return "dead";
}

async function checkLink(url) {
  if (!url) return null;
  let r = await get(url);
  if (r.code === 0 || r.code >= 500) r = await get(url, { timeout: 40000 }); // one retry for flaky hosts
  const lastModified = r.lastModified && !isNaN(Date.parse(r.lastModified)) ? new Date(r.lastModified).toISOString() : null;
  return {
    url,
    code: r.code,
    state: linkState(r.code),
    ...(r.finalUrl && r.finalUrl !== url ? { resolvedUrl: r.finalUrl } : {}),
    ...(lastModified ? { lastModified } : {}),
    ...(r.error ? { error: r.error } : {}),
    checkedAt: now(),
  };
}

const memo = new Map();
const once = (key, fn) => (memo.has(key) ? memo.get(key) : (memo.set(key, fn()), memo.get(key)));

function ghRepo(url) {
  const m = url?.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}

async function github(slug) {
  const source = `https://api.github.com/repos/${slug}`;
  const headers = { Accept: "application/vnd.github+json", ...(GH ? { Authorization: `Bearer ${GH}` } : {}) };
  const repo = await get(source, { json: true, headers });
  if (!repo.ok) return { slug, source, error: `HTTP ${repo.code}`, fetchedAt: now() };
  const d = repo.body;
  const out = {
    slug,
    stars: d.stargazers_count,
    forks: d.forks_count,
    openIssues: d.open_issues_count,
    pushedAt: d.pushed_at,
    archived: d.archived,
    license: d.license && d.license.spdx_id !== "NOASSERTION" ? d.license.spdx_id : null,
  };
  if (GH) {
    const rel = await get(`${source}/releases/latest`, { json: true, headers });
    if (rel.ok) out.latestRelease = { tag: rel.body.tag_name, date: rel.body.published_at, url: rel.body.html_url };
  }
  return { ...out, source, fetchedAt: now() };
}

async function ols(id) {
  const source = `https://www.ebi.ac.uk/ols4/api/ontologies/${id}`;
  const r = await get(source, { json: true });
  // OLS answers unknown ids with HTTP 200 and {"status": 404} in the body.
  if (!r.ok || typeof r.body?.status === "number") return { id, source, error: `not found in OLS (${r.body?.status ?? r.code})`, fetchedAt: now() };
  const d = r.body;
  const versionIri = d.config?.versionIri || null;
  const releaseDate = versionIri?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  return {
    id,
    status: d.status,
    terms: d.numberOfTerms,
    properties: d.numberOfProperties,
    version: d.config?.version || releaseDate,
    versionIri,
    releaseDate,
    loaded: d.loaded,
    source,
    fetchedAt: now(),
  };
}

const OBO_SOURCE = "https://obofoundry.org/registry/ontologies.jsonld";
let oboRegistry;
async function obo(id) {
  oboRegistry ??= get(OBO_SOURCE, { json: true, timeout: 60000 }).then((r) => ({
    ok: r.ok,
    fetchedAt: now(),
    byId: Object.fromEntries((r.body?.ontologies || []).map((o) => [o.id, o])),
  }));
  const reg = await oboRegistry;
  if (!reg.ok) return { id, source: OBO_SOURCE, error: "registry unavailable", fetchedAt: reg.fetchedAt };
  const o = reg.byId[id];
  if (!o) return null;
  return {
    id,
    status: o.activity_status,
    domain: o.domain || null,
    license: o.license?.label || null,
    usages: (o.usages || []).map((u) => ({ user: u.user, type: u.type || null, description: u.description?.trim() || null })),
    source: OBO_SOURCE,
    fetchedAt: reg.fetchedAt,
  };
}

async function bioportal(acronym) {
  if (!BP) return null;
  const source = `https://data.bioontology.org/ontologies/${acronym}/latest_submission`;
  const r = await get(`${source}?apikey=${BP}`, { json: true });
  if (!r.ok) return { acronym, source, error: `HTTP ${r.code}`, fetchedAt: now() };
  return { acronym, version: r.body.version || null, released: r.body.released || null, source, fetchedAt: now() };
}

async function citations(doi) {
  const source = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const r = await get(source, { json: true, headers: { "User-Agent": "neuroschema-evaluator/1.1 (https://neuroschema.org)" } });
  return { doi, count: r.ok ? r.body.message["is-referenced-by-count"] ?? null : null, source, fetchedAt: now(), ...(r.ok ? {} : { error: `HTTP ${r.code}` }) };
}

// Exact commit of the default branch at evaluation time, via git's smart-HTTP endpoint (no API quota).
async function gitHead(slug) {
  const source = `https://github.com/${slug}.git/info/refs?service=git-upload-pack`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(source, { headers: { "User-Agent": "git/2.45.0" }, signal: ctrl.signal });
    if (!res.ok) return { source, error: `HTTP ${res.status}`, fetchedAt: now() };
    const text = await res.text();
    const commit = text.match(/([0-9a-f]{40}) HEAD/)?.[1];
    const ref = text.match(/symref=HEAD:(\S+)/)?.[1]?.replace("refs/heads/", "");
    if (!commit) return { source, error: "no HEAD", fetchedAt: now() };
    // Tags: annotated tags appear twice; the peeled "^{}" line carries the commit.
    const tags = new Map();
    for (const m of text.matchAll(/([0-9a-f]{40}) refs\/tags\/([^\s^]+)(\^\{\})?/g)) if (m[3] || !tags.has(m[2])) tags.set(m[2], m[1]);
    const key = (t) => (t.match(/\d+/g) || []).map(Number);
    const cmp = (a, b) => {
      const x = key(a), y = key(b);
      for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1);
      return 0;
    };
    const releaseLike = [...tags.keys()].filter((t) => /\d/.test(t) && !/(alpha|beta|rc|dev|pre)/i.test(t)).sort(cmp);
    const latest = releaseLike.at(-1);
    const latestTag = latest ? { name: latest, commit: tags.get(latest), url: `https://github.com/${slug}/releases/tag/${latest}` } : null;
    const headTag = [...tags].find(([, sha]) => sha === commit)?.[0] || null;
    return { commit, ref, headTag, latestTag, tagCount: tags.size, url: `https://github.com/${slug}/tree/${commit}`, source, fetchedAt: now() };
  } catch (e) {
    return { source, error: e.message, fetchedAt: now() };
  } finally {
    clearTimeout(t);
  }
}

// Read the first part of the artefact to find the version it declares about itself.
const SNIFF_BYTES = 262144;
async function sniffArtifact(url) {
  if (!url || /github\.com\/[^/]+\/[^/]+\/(tree|blob)\//.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Range: `bytes=0-${SNIFF_BYTES - 1}` }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return { source: url, error: `HTTP ${res.status}`, fetchedAt: now() };
    const reader = res.body.getReader();
    let buf = "", got = 0;
    const dec = new TextDecoder();
    while (got < SNIFF_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      buf += dec.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => {});
    const pick = (...res) => res.map((r) => buf.match(r)?.[1]).find(Boolean)?.trim() || null;
    const versionIri = pick(/owl:versionIRI\s+rdf:resource="([^"]+)"/, /owl:versionIRI\s+<([^>]+)>/, /"versionIRI"\s*:\s*"([^"]+)"/, /versionIRI\s*\(?\s*<([^>]+)>/);
    const versionInfo = pick(/owl:versionInfo[^>]*>([^<]{1,80})</, /owl:versionInfo\s+"([^"]{1,80})"/, /^data-version:\s*(\S+)/m, /^format-version:\s*\S+[\s\S]*?^data-version:\s*(\S+)/m, /^version:\s*["']?([\w.\-]{1,40})/m, /"version"\s*:\s*"([^"]{1,40})"/);
    return {
      source: res.url || url,
      ...(versionIri ? { versionIri } : {}),
      ...(versionInfo ? { versionInfo } : {}),
      etag: res.headers.get("etag") || null,
      contentType: res.headers.get("content-type")?.split(";")[0] || null,
      fetchedAt: now(),
    };
  } catch (e) {
    return { source: url, error: e.name === "AbortError" ? "timeout" : e.message, fetchedAt: now() };
  } finally {
    clearTimeout(t);
  }
}

// A failed lookup keeps the last good value (with its original fetchedAt) and says why.
function carry(fresh, old) {
  if (!fresh?.error) return fresh;
  if (old && !old.error) return { ...old, stale: true, staleReason: fresh.error, lastAttemptAt: fresh.fetchedAt };
  return fresh;
}

async function evaluate(e) {
  const slug = ghRepo(e.repository);
  const [homepage, repoLink, download, gh, olsInfo, oboInfo, bp, cites, git, artifact] = await Promise.all([
    checkLink(e.homepage),
    e.repository && e.repository !== e.homepage ? checkLink(e.repository) : null,
    checkLink(e.download),
    slug ? once(`gh:${slug}`, () => github(slug)) : null,
    e.ols ? once(`ols:${e.ols}`, () => ols(e.ols)) : null,
    e.obo ? obo(e.obo) : null,
    e.bioportal ? bioportal(e.bioportal) : null,
    Promise.all((e.publications || []).map((p) => once(`doi:${p.doi}`, () => citations(p.doi)))),
    slug ? once(`git:${slug}`, () => gitHead(slug)) : null,
    e.download ? once(`art:${e.download}`, () => sniffArtifact(e.download)) : null,
  ]);
  const repository = e.repository && e.repository === e.homepage ? homepage : repoLink;
  const prev = previous.entries[e.id] || {};
  const facts = {
    links: { homepage, repository, download },
    github: carry(gh, prev.github),
    ols: carry(olsInfo, prev.ols),
    obo: carry(oboInfo, prev.obo),
    bioportal: carry(bp, prev.bioportal),
    citations: cites.map((c) => (c.count == null ? carry(c, prev.citations?.find((p) => p.doi === c.doi)) : c)),
    git: carry(git, prev.git),
    artifact: carry(artifact, prev.artifact),
  };
  return { ...facts, ...scoreEntry(e, facts), evaluatedAt: now(), runId };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

const targets = catalog.filter((e) => !only || only.has(e.id));
console.log(`Run ${runId}: evaluating ${targets.length} entries${GH ? "" : " (no GITHUB_TOKEN: skipping release lookups)"}…`);
const results = await pool(targets, 6, async (e) => {
  const r = await evaluate(e);
  console.log(`  ${String(r.score).padStart(3)} ${r.grade}  ${e.id}`);
  return [e.id, r];
});

const run = {
  id: runId,
  startedAt,
  finishedAt: now(),
  scope: only ? "partial" : "full",
  entryCount: results.length,
  trigger: process.env.GITHUB_EVENT_NAME || "local",
  evaluator: { name: "neuroschema-evaluator", version: EVALUATOR_VERSION, rubricVersion: RUBRIC_VERSION, node: process.version },
  ...(process.env.GITHUB_SHA ? { commit: process.env.GITHUB_SHA } : {}),
  ...(process.env.GITHUB_RUN_ID ? { ciRun: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` } : {}),
  authenticated: { github: Boolean(GH), bioportal: Boolean(BP) },
  sources: ["HTTP link checks", "https://api.github.com", "https://www.ebi.ac.uk/ols4/api", OBO_SOURCE, "https://api.crossref.org", ...(BP ? ["https://data.bioontology.org"] : [])],
};
const fresh = Object.fromEntries(results);

// Archive this run (immutable snapshot).
if (!process.env.NO_ARCHIVE) {
  await mkdir(runsDir, { recursive: true });
  await writeFile(path.join(runsDir, `${runId}.json`), JSON.stringify({ run, entries: fresh }) + "\n");
}

// Latest view: this run's results + (for partial runs) the previous results of everything else.
const ids = new Set(catalog.map((e) => e.id));
const kept = only ? Object.fromEntries(Object.entries(previous.entries).filter(([id]) => ids.has(id) && !fresh[id])) : {};
const out = { generatedAt: run.finishedAt, rubricVersion: RUBRIC_VERSION, run, entries: { ...kept, ...fresh } };
await writeFile(outFile, JSON.stringify(out, null, 2) + "\n");

const stale = results.filter(([, r]) => r.github?.stale || r.ols?.stale || r.obo?.stale).map(([id]) => id);
if (stale.length) console.log(`Carried forward last good values for failed lookups: ${stale.join(", ")}`);
console.log(`Wrote data/evaluation.json${process.env.NO_ARCHIVE ? "" : ` and data/runs/${runId}.json`}`);
