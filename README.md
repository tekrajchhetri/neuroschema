# NeuroSchema — neuroschema.org

A curated catalog of neuroscience ontologies, schemas, vocabularies and data standards. Every entry is evaluated automatically against the FAIR principles, maintenance and community adoption, with a progressive inactivity penalty. Each run records the exact version evaluated and keeps full provenance. The site is fully static, with no runtime dependencies.

## Quick start

```bash
npm run dev               # build + preview at http://localhost:4321 (PORT=3200 npm run dev for another port)
npm run build             # build into dist/ (also validates the catalog)
npm run validate          # structural checks: fields, ids, URLs, DOIs format, duplicates
npm run validate:online   # + links resolve, DOIs exist in Crossref, OLS ids are real
npm run evaluate          # run the evaluation → data/evaluation.json + data/runs/<run>.json
npm run rescore           # recompute scores from stored facts after a rubric change (no network)
```

Requires Node ≥ 18. There's nothing to `npm install`. Set `GITHUB_TOKEN` locally to avoid GitHub's 60 requests/hour limit when running `npm run evaluate`.

## How scoring works

`Score = max(0, F + A + I + R + M + U − P)`

| | Criterion | Max | Measures |
|---|---|---|---|
| F | Findable | 15 | persistent identifier, registry listing, citable reference |
| A | Accessible | 15 | homepage + artefact retrievable over HTTP(S) |
| I | Interoperable | 15 | formal machine-readable format, semantic-web IRIs |
| R | Reusable | 15 | clear license, versioned releases |
| M | Maintenance | 20 | time since last commit/release/file update |
| U | Adoption | 20 | documented adopting projects, GitHub stars / citations |
| P | Inactivity penalty | −30 | −4 per year inactive after a 1-year grace (max −20), −10 more if archived/legacy/OBO-inactive |

The rules live in [`scripts/rubric.mjs`](scripts/rubric.mjs). The site's `/evaluation/` page shows the formula, a worked example, every score and the run history.

**Versions and provenance.** Each run reads the first 256 KB of the artefact for `owl:versionIRI` / `versionInfo`. It also records the default-branch commit and release tags (via git's HTTP endpoint), plus OLS/BioPortal versions. Every fact stores its source URL and retrieval time. Each run is archived, unchanged, in `data/runs/`, which is how per-entry history and change logs are built. If a source fails, the last good value is carried forward and flagged.

## Layout

| Path | What |
|---|---|
| `data/catalog.json` | The curated catalog (edit via PR or the submission flow) |
| `data/catalog.schema.json` | JSON Schema for entries |
| `data/categories.json` | Domains |
| `data/evaluation.json` | Latest evaluation (generated) |
| `data/runs/*.json` | Archived run snapshots (generated, append-only) |
| `scripts/` | build, validate, evaluate, rubric, issue → entry, PR report |
| `src/assets/` | CSS, JS, logos, favicons, social image |
| `.github/` | issue form, PR template, workflows |

## Contributions (all through Git)

1. A contributor fills in **neuroschema.org/submit**, which opens a pre-filled GitHub issue. They can also open the issue form directly, or send a pull request editing `data/catalog.json`.
2. **Submission to pull request** (`.github/workflows/submission.yml`) converts the issue into a pull request. It fills paper titles from Crossref and comments on the issue with the PR link, or with what needs fixing.
3. **Checks** (`.github/workflows/ci.yml`) runs on every PR. It validates the catalog and runs online checks for the changed entries: links, DOIs and OLS IDs. It runs a FAIR evaluation preview, then posts a summary as a PR comment and in the job summary.
4. A maintainer reviews and merges. **Evaluate catalog** runs on merge and every Monday. It commits `data/evaluation.json` plus a new `data/runs/` snapshot, and Vercel redeploys.

### Repository setup

- **Secrets:** add `BOT_TOKEN`, a fine-grained personal access token for this repo with *Contents*, *Pull requests* and *Issues* set to read & write. PRs opened by the bot then trigger the Checks workflow; with only the built-in token, GitHub doesn't run workflows on bot-created PRs. The token also raises the GitHub API limit for evaluations. `BIOPORTAL_API_KEY` is optional.
- **Labels:** create a `submission` label (the issue form applies it).
- **Branch protection on `main`:** require pull requests, and require the "Checks / validate-and-build" status to pass before merging.
- **Actions → General:** allow GitHub Actions to create pull requests.
- Set `"repository"` in `site.config.json` to the GitHub URL so the site links to the issue form.

## Deploy on Vercel

Import the repository. `vercel.json` already sets the build command and output directory. Then add `neuroschema.org` under **Settings → Domains**: an `A` record to `76.76.21.21` for the apex domain, and a `CNAME` record to `cname.vercel-dns.com` for `www`.

## SEO

Every page has a canonical URL, Open Graph/Twitter cards and a JSON-LD `@graph`. The graph includes Organization, WebSite with SearchAction, BreadcrumbList, and, depending on the page, Dataset/DefinedTermSet, DataCatalog, ItemList or CollectionPage. The site also publishes `sitemap.xml`, `robots.txt`, a web manifest, `catalog.jsonld` (W3C DCAT), and per-entry PROV-O provenance in `/o/<id>/entry.json`.
