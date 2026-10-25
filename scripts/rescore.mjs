#!/usr/bin/env node
// Recompute scores from stored facts in data/evaluation.json (no network).
import { readFile, writeFile } from "node:fs/promises";
import { RUBRIC_VERSION, scoreEntry } from "./rubric.mjs";

const catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
const ev = JSON.parse(await readFile("data/evaluation.json", "utf8"));
for (const e of catalog) {
  const f = ev.entries[e.id];
  if (f) Object.assign(f, scoreEntry(e, f));
}
ev.rubricVersion = RUBRIC_VERSION;
await writeFile("data/evaluation.json", JSON.stringify(ev, null, 2) + "\n");
console.log("Rescored", Object.keys(ev.entries).length, "entries");
