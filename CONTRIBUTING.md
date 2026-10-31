# Contributing to NeuroSchema

Thanks for helping. You can change the catalog (entries, categories), the scoring rubric,
the evaluation scripts or the site, run everything on your own machine, and see how your
change affects scores before you open a pull request.

**One rule:** scores are published only by the maintainer's evaluation run. You can
compute scores locally to check your change, but never commit them. Pull requests that
change `data/evaluation.json`, `data/runs/` or `data/quality/` fail CI. The preview commands
below write to `.local/`, which git ignores, so this happens automatically if you use them.

## 1. Set up

You need:

- **git** and a GitHub account
- **Node ≥ 18** — there is nothing to `npm install`
- Optional, only for ontology quality checks: **Docker** (about 1.2 GB of images)
- Optional: a **GitHub token** (`export GITHUB_TOKEN=...`, no scopes needed). Without it,
  GitHub allows 60 requests/hour and evaluations skip release lookups.

```bash
# Fork https://github.com/tekrajchhetri/neuroschema on GitHub, then:
git clone https://github.com/<you>/neuroschema.git
cd neuroschema
git remote add upstream https://github.com/tekrajchhetri/neuroschema.git
git switch -c my-change            # one branch per change
```

## 2. Make your change

| You want to… | Edit |
|---|---|
| Add or fix a resource | `data/catalog.json` (fields: `data/catalog.schema.json`) |
| Change categories | `data/categories.json`, the `category` enum in `data/catalog.schema.json`, and each affected entry in `data/catalog.json` |
| Change how resources are scored | `scripts/rubric.mjs` — bump `RUBRIC_VERSION` |
| Change what is collected about a resource | `scripts/evaluate.mjs` (network lookups) or `scripts/quality.mjs` (ROBOT/OOPS! checks) |
| Change the site | `scripts/build.mjs`, `src/assets/` |

## 3. Check it

```bash
npm run validate                          # fields, ids, URL and DOI format, duplicates
ONLY=my-entry npm run validate:online     # links resolve, DOIs exist, OLS ids are real
npm run dev                               # build and preview at http://localhost:3200
```

## 4. See how it scores (local preview, not committed)

Pick the command that matches your change. All of them write to `.local/data/`.

| Your change | Command | Network | Time |
|---|---|---|---|
| Rubric weights or rules (`rubric.mjs`) | `npm run rescore:preview` | none | seconds |
| A new or edited catalog entry | `ONLY=my-entry npm run evaluate:preview` | yes | seconds per entry |
| An ontology's quality (consistency, ROBOT report, pitfalls) | `npm run images` once, then `ONLY=my-entry npm run quality:preview` and `ONLY=my-entry npm run evaluate:preview` | yes, Docker | ~30 s for a small ontology, much longer for large ones |

Then compare your preview with the published scores:

```bash
npm run score:diff                    # every entry whose score or grade changed
ONLY=my-entry npm run score:diff      # one entry, with points per criterion
npm run dev                           # the local site now shows your preview scores
```

Example output:

```text
uberon                   96 A     → 96 A     0
    findable          12 / 12
    reusable          11 / 12
    quality           18 / 19  (was 17)
```

Notes:

- Rescoring uses today's date, so the inactivity penalty can move a few entries even when
  you changed nothing. Run `npm run rescore:preview` on an untouched checkout first to see
  that baseline.
- `rescore:preview` reuses stored facts. If your change needs new facts (a new lookup in
  `evaluate.mjs`), use `evaluate:preview` for the entries it affects.
- To go back to the published scores: `rm -rf .local/data`.

## 5. Commit and open a pull request

```bash
git status                     # data/evaluation.json, data/runs/ and data/quality/ must NOT appear
git add data/catalog.json data/categories.json scripts/ ...   # only the files you changed
git commit -m "Short description of the change"
git push origin my-change
```

Open a pull request against `main` on `tekrajchhetri/neuroschema`. In the description, say
what changed and, for rubric or evaluation changes, paste the relevant `npm run score:diff`
output. CI then:

1. rejects the PR if it changes generated score files;
2. validates the catalog and builds the site;
3. for changed entries, checks links, DOIs and OLS ids and posts a score preview as a PR
   comment (fork PRs get it in the job summary instead).

If a generated file slipped in: `git restore --source=upstream/main data/evaluation.json data/runs data/quality`,
then commit again.

After merging, the maintainer reruns the evaluation and publishes the new scores.

To update your branch later: `git fetch upstream && git rebase upstream/main`.

## Worked example: issue #8, merge neuroscience and behaviour categories

[Issue #8](https://github.com/tekrajchhetri/neuroschema/issues/8) suggests one
"Neuroscience & Behavior"-style category instead of separate ones, because NWB and BIDS
cover behaviour and other modalities too.

1. **Agree on the target in the issue first** (which categories merge, the new name and
   id) — categories shape the whole site.
2. Edit:
   - `data/categories.json`: keep one category with the new `name` and `blurb`; remove the
     ones merged into it.
   - `data/catalog.schema.json`: update the `category` enum.
   - `data/catalog.json`: set `category` on every entry that used a removed id
     (`npm run validate` lists any you missed).
   - `vercel.json`: if a category id disappears, add a redirect from `/category/<old-id>/`
     to `/category/<new-id>/` so existing links keep working.
3. Check: `npm run validate`, then `npm run dev` and open `/categories/`.
4. Scores don't depend on categories, so `npm run score:diff` should show only the
   date-based baseline changes.
5. Commit the four files, push, and open the PR with "Closes #8" in the description.

## Reporting problems or ideas

Use the issue forms: **Report a problem**, **Suggest an idea**, or **Add a resource**
(also available at neuroschema.org/submit).
