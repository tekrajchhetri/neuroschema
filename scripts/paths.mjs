// Where generated evaluation data is written.
// data/evaluation.json, data/runs/ and data/quality/ are owned by the "Evaluate catalog" GitHub Action
// (the only writer of tracked results), so git never sees two versions of them.
// Local runs write to .local/data/ (git-ignored); the build previews them when they are newer.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const IS_CI = process.env.GITHUB_ACTIONS === "true" || process.env.NEUROSCHEMA_CI === "1";
export const trackedData = path.join(root, "data");
export const localData = path.join(root, ".local", "data");
export const outData = IS_CI ? trackedData : localData;
export const GENERATED = ["data/evaluation.json", "data/runs/", "data/quality/"];
