#!/usr/bin/env node
// Compare a local score preview (.local/data/evaluation.json) with the published scores (data/evaluation.json).
// For contributors: see how a catalog or rubric change moves scores, without touching tracked files.
//   npm run score:diff              entries whose score or grade changed
//   ONLY=id1,id2 npm run score:diff these entries, changed or not, with per-criterion detail
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { root, trackedData, localData } from "./paths.mjs";

const read = (dir) => {
  const f = path.join(dir, "evaluation.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
};
const published = read(trackedData) || { entries: {} };
const preview = read(localData);
if (!preview) {
  console.error("No preview found in .local/data/. Run `npm run rescore:preview` or `npm run evaluate:preview` first.");
  process.exit(1);
}

const only = process.env.ONLY ? process.env.ONLY.split(",").filter(Boolean) : null;
const ids = only || Object.keys(preview.entries);
const fmt = (e) => (e ? `${e.score} ${e.grade}` : "—");
const delta = (a, b) => (a == null || b == null ? "" : `${b - a > 0 ? "+" : ""}${Math.round((b - a) * 10) / 10}`);

console.log(`Published: rubric ${published.rubricVersion ?? "?"}, ${published.generatedAt ?? "?"}`);
console.log(`Preview:   rubric ${preview.rubricVersion ?? "?"}, ${preview.rescoredAt ?? preview.generatedAt ?? "?"}  (${path.relative(root, localData)})\n`);

let changed = 0;
for (const id of ids) {
  const before = published.entries[id];
  const after = preview.entries[id];
  if (!after) { if (only) console.log(`${id}: not in the preview`); continue; }
  const moved = !before || before.score !== after.score || before.grade !== after.grade;
  if (!moved && !only) continue;
  changed += moved ? 1 : 0;
  console.log(`${id.padEnd(24)} ${fmt(before).padEnd(8)} → ${fmt(after).padEnd(8)} ${delta(before?.score, after.score)}${before ? "" : "  (new)"}`);
  if (only) {
    for (const [crit, b] of Object.entries(after.breakdown || {})) {
      const a = before?.breakdown?.[crit];
      const mark = a && a.score !== b.score ? `  (was ${a.score})` : "";
      console.log(`    ${crit.padEnd(14)} ${String(b.score).padStart(5)} / ${b.max}${mark}`);
    }
  }
}
if (!only) console.log(changed ? `\n${changed} entr${changed === 1 ? "y" : "ies"} changed.` : "No scores or grades changed.");
