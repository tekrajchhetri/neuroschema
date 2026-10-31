// Where evaluation data is written.
// NeuroSchema is evaluated locally by the maintainer (cost-free, no server) and published as a static site.
// The maintainer's local run is the single writer of data/evaluation.json, data/runs/ and data/quality/;
// GitHub Actions only handle submissions and their checks and never write these files, so they cannot conflict.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const IS_CI = process.env.GITHUB_ACTIONS === "true";
export const trackedData = path.join(root, "data");
// Previews write to a git-ignored scratch folder so they never touch tracked results:
// pull requests in CI, and contributors who set PREVIEW=1 to see how their change scores.
export const localData = path.join(root, ".local", "data");
export const IS_PREVIEW = IS_CI || process.env.PREVIEW === "1";
export const outData = IS_PREVIEW ? localData : trackedData;
export const GENERATED = ["data/evaluation.json", "data/runs/", "data/quality/"];
