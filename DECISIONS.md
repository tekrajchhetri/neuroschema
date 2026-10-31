# Decisions

## D-001: Static site generated from a curated catalog   (2026-10-25, status: accepted)
**Context** – New project for the neuroschema.org domain: a single place to find neuroscience ontologies, schemas and data standards. The folder was empty. The site will be hosted on Vercel.
**Decision** – A zero-dependency Node build (`scripts/build.mjs`) turns `data/catalog.json` + `data/categories.json` into plain HTML in `dist/`. Every entry gets its own page (`/o/<id>/`), every category its own page (`/category/<id>/`), and the whole catalog is also published as `catalog.json` and DCAT JSON-LD (`catalog.jsonld`).
**Why** – Static output deploys anywhere (Vercel here), is fast, and has no server to maintain. No framework or npm dependencies means nothing to upgrade and the build runs on any Node ≥ 18. Rejected: Next.js/Astro (heavier, no need for client routing), a database-backed app (overkill for a ~50-entry catalog that changes by PR).
**Consequences** – Adding an entry is a JSON edit + PR. Client-side search/filter is plain JS over an embedded JSON index.

## D-002: Catalog links to canonical sources rather than mirroring files   (2026-10-25, status: accepted)
**Context** – "Hosting" third-party ontologies could mean copying their OWL/YAML files onto neuroschema.org.
**Decision** – Each entry links to its canonical homepage, repository, download/PURL and browsers (OLS, BioPortal). Files are not mirrored.
**Why** – Mirrors go stale, can break licenses/attribution, and compete with the PURLs communities already cite. Rejected: periodic mirroring.
**Consequences** – If neuroschema.org later publishes its *own* schemas, add them as entries with `hosted: true` and put files under `public/`; the build copies `public/` into `dist/` as-is.

## D-003: Automated evaluation stored as committed data   (2026-10-25, status: accepted)
**Context** – Users asked for automated evaluation, community adoption and sources per entry.
**Decision** – `scripts/evaluate.mjs` checks each entry (link health, GitHub activity/stars/license/releases, OLS term counts and versions, OBO Foundry status and registered usages) and writes `data/evaluation.json`. The build reads that file and shows a 0–100 score with a transparent breakdown. A scheduled GitHub Action re-runs it weekly and commits the result, which triggers a Vercel redeploy.
**Why** – Running network checks during every Vercel build would be slow, flaky and rate-limited (GitHub allows 60 unauthenticated requests/hour). Committed results are reproducible and diffable. Rejected: client-side live checks (CORS, rate limits, slow pages).
**Consequences** – Scores are as fresh as the last evaluation run (date shown on every page). Adoption = curated `usedBy` in the catalog + usages pulled from the OBO Foundry registry, each labelled with its source.

## D-004: Vercel hosting, GitHub Actions for CI and scheduled evaluation   (2026-10-25, status: accepted)
**Context** – The site is hosted on Vercel. Evaluation results must stay fresh without manual work (D-003).
**Decision** – `vercel.json` builds with `node scripts/build.mjs` into `dist/` (no install step, trailing-slash URLs, CORS on the JSON exports). `.github/workflows/ci.yml` builds and validates on every push/PR and evaluates the entries a PR changed. `.github/workflows/evaluate.yml` runs weekly, commits `data/evaluation.json`, and Vercel redeploys on that push.
**Why** – Vercel's Git integration already deploys every push, so GitHub Actions only has to keep data fresh and catch broken catalog edits. Rejected: Vercel cron functions (would need a server-side runtime for a static site).
**Consequences** – The evaluator keeps the previous value when a lookup fails (rate limit or outage), so a transient failure never lowers a score. The weekly job uses the built-in `GITHUB_TOKEN`, which avoids the 60 requests/hour unauthenticated limit.

## D-005: Visual design   (2026-10-25, status: accepted)
**Context** – The site should feel premium and credible to researchers.
**Decision** – Instrument Serif for display headings, Inter for body text and JetBrains Mono for code (Google Fonts). A dark hero with a deterministic, build-time SVG neural-network illustration (animated pulses that respect `prefers-reduced-motion`). Teal accent, A–D grade colours, light/dark themes with a toggle.
**Why** – A serif display face with a restrained palette reads as editorial and scientific rather than generic SaaS. The SVG is generated at build time, so there's no image asset or JS animation library.
**Consequences** – The only external request is to Google Fonts. Remove that `<link>` in `scripts/build.mjs` to fall back to system fonts.

## D-006: Brand — NeuroSchema navy & gold   (2026-10-25, status: accepted; supersedes the teal palette in D-005)
**Context** – The owner supplied the NeuroSchema emblem (navy network mark, gold nodes, serif wordmark) and asked to move away from green.
**Decision** – Logo assets are cut from the supplied PNG into transparent light/dark variants (`src/assets/brand/`), favicons, an apple-touch icon and a 1200×630 social image. The palette is navy `#13264f` / gold `#b8924f` on ivory, and the hero uses gold/ivory nodes on navy. Grades keep distinct semantic colours.
**Why** – It matches the logo and the existing serif display type. Rejected: keeping the teal accent, which clashed with the logo.
**Consequences** – The header shows two `<img>`s and CSS picks one per theme, so the manual dark toggle switches the logo too.

## D-007: FAIR-based rubric with progressive inactivity penalty   (2026-10-25, status: accepted; rubric v2.2)
**Context** – v1 scored accessibility, maintenance, license, interoperability and adoption. The owner asked to ground the scores in FAIR and to penalise inactive resources progressively.
**Decision** – `Score = max(0, F + A + I + R + M + U − P)`. FAIR is 4 × 15 points (F1/F4/F2, A1, I1/I2, R1.1/R1.2), M and U are 20 each, and P = min(30, min(20, 4·max(0, years − 1)) + 10·[archived/legacy/OBO-inactive]), or 5 if there's no activity evidence. Each criterion records its steps, so pages can show the working.
**Why** – FAIR is the vocabulary this community already uses. A flat cap on maintenance didn't distinguish "slightly stale" from "abandoned". Rejected: automated FAIR tools such as F-UJI or FOOPS!, which are heavier, need a running service, and mostly target datasets or single ontologies.
**Consequences** – `npm run rescore` re-derives scores from stored facts when weights change. Rubric changes show up as "rubric vX → vY" in entry change logs.

## D-008: Version tracking and run archive (provenance)   (2026-10-25, status: accepted; extends D-003)
**Context** – The owner asked that each evaluation record which version was evaluated, keep old results, and expose provenance.
**Decision** – The evaluator reads the start of each artefact for `owl:versionIRI`/`versionInfo`/`data-version`. It reads the default-branch commit and release tags from git's smart-HTTP endpoint, which uses no API quota. Every fact gets `source` and `fetchedAt`. Each run is written to `data/runs/<id>.json` and never rewritten. The build derives per-entry history, change logs and sparklines from these runs, and publishes them under `/runs/`. Entry JSON includes W3C PROV-O.
**Why** – Scores are only meaningful against a specific version. Append-only snapshots in git give a free, auditable history. Rejected: a database, which is unnecessary when git already versions the files.
**Consequences** – The repo grows by ~60 KB per run (~3 MB/year at weekly cadence). Failed lookups carry forward the last good value, with its original timestamp and a "carried forward" flag.

## D-009: Contributions only through Git with automated pre-merge checks   (2026-10-25, status: accepted)
**Context** – The owner wants users to submit resources, with everything tracked and checked before merge.
**Decision** – The `/submit/` form produces an entry and opens a pre-filled GitHub issue form. `submission.yml` converts the issue into a PR using `scripts/issue-to-entry.mjs`. `ci.yml` validates (offline and online), runs a FAIR evaluation preview, and comments on the PR. `evaluate.yml` re-evaluates on merge. Validation rules live in one place (`scripts/validate-lib.mjs`), mirrored by `data/catalog.schema.json`.
**Why** – Git gives review, history and attribution for free, and the static site needs no backend. Rejected: a form backend or database, which would need hosting, spam handling and a separate audit trail.
**Consequences** – Needs a `BOT_TOKEN` secret so bot PRs trigger checks, a `submission` label, and branch protection requiring the Checks status. PRs from forks get results in the job summary, because forks can't receive comments with the default token.

## D-010: Cross-portal data (OLS v2, TIB, BioPortal, Bioregistry, OBO Dashboard)   (2026-10-25, status: accepted)
**Context** – OLS shows much more than we captured (imports/exports, classes/properties/individuals, IRIs, languages). Other portals hold their own copies, sometimes different releases.
**Decision** – The evaluator uses the OLS v2 API, falling back to v1. It also queries the TIB Terminology Service (same software), Bioregistry and the OBO Dashboard. Bioregistry runs first, because its mappings give each resource's ID in the other portals; BioPortal is queried when `BIOPORTAL_API_KEY` is set. Entry pages show a Portals & registries panel. It has a per-portal version and count table, imports and reused-by links (internal where we catalog the ontology), dashboard quality results, and IDs in 10+ portals.
**Why** – No key or quota is needed except for BioPortal. Rejected: AberOWL (API redirects, so it's linked only via Bioregistry) and FAIRsharing (needs a login), which are linked only.
**Consequences** – Schemas without a Bioregistry prefix get fewer registry points. An optional `bioregistry` field in the catalog sets the prefix explicitly.

## D-011: Rubric v3 — strict, with ontology quality   (2026-10-25, status: accepted; supersedes D-007 weights)
**Context** – The owner wants a strict rubric where 100 is barely reachable, and that checks upper-ontology alignment, consistency and OOPS! results.
**Decision** – F/A/I/R are 12 points each. They add sub-criteria: number of registries (F4), metadata persistence (A2), imports (I3), version declared in the artefact (R1.2) and OBO principles pass rate (R1.3). Q (20) covers BFO/COB and RO imports, reasoner consistency, ROBOT report and OOPS! pitfalls. M (16) is recency plus release cadence, and U (16) is adopters, reuse and stars/citations. P is unchanged (progressive). Non-ontologies are scaled from 80 to 100, and grades now run A–E.
**Why** – Consistency evidence comes from the OBO Dashboard for OBO ontologies, and from our own ROBOT + ELK run in CI for the rest. OOPS! is unreachable from some networks and rate-limited, so when it's unavailable its 4 points are excluded and Q is rescaled rather than penalised. Unchecked consistency scores 0, so ontologies are rewarded for being checkable. Rejected: running HermiT (too slow on large ontologies) and FOOPS! (same availability problem as OOPS!).
**Consequences** – After this change the best score is 99 (CL). Non-OBO ontologies get Q = 0 for consistency/ROBOT until the first CI quality run writes `data/quality/<id>.json`.

## D-012: Landing shows highlights; dedicated catalog and search pages   (2026-10-25, status: accepted)
**Context** – The home page listed every resource, and search only filtered that list.
**Decision** – The home page shows the hero, domains, the top 6 by score and the 6 most recently updated. `/catalog/` holds the full filterable list, and `/search/?q=` is a ranked results page over `search-index.json`. Ranking weights matches by field: acronym > name > tags > modules > description. The schema.org SearchAction points to `/search/`.
**Consequences** – Links to `/#explore` were replaced by `/catalog/`.

## D-013: Consistency-centred quality, penalties for critical problems, local OOPS! + Python fallback   (2026-10-25, status: accepted; rubric v3.2)
**Context** – The public OOPS! service is often unreachable. The owner asked that logical consistency carry more weight, that critical problems count against a resource, and that processing not rely on one runtime or one external service.
**Decision** –
- Q is now "Ontology consistency & quality". Logical consistency is worth 10 of its 20 points; the rest is OWL 2 DL 2, BFO/COB 3, RO 1, ROBOT report 3 and a critical-pitfall check 1. Nothing is rescaled when a scanner is unavailable.
- Penalties (cap 50):
  - inconsistent −20, with the score capped at 54
  - unsatisfiable classes −5
  - critical pitfall types −3 each (max −12)
  - ROBOT errors −3/−6/−10
- Pitfall scanning runs in this order:
  1. the OOPS! CLI built from source at a pinned commit in `docker/oops`, run locally
  2. the public OOPS! service
  3. `scripts/pitfalls.py`, an rdflib scan of 11 structural OOPS! pitfalls with the same codes and severities: P06, P19, P39, P38, P41, P34, P35, P11, P10, P08, P13
- The same Python script converts OOPS! Turtle reports into JSON.
- `quality.mjs` records which engine produced each result and every failed attempt.

**Why** – Consistency is the property a reasoner can check objectively and that downstream users depend on most. A local OOPS! removes the external dependency. Python/rdflib keeps a pitfall check alive even without Docker or Java. Rejected: rescaling when a scan is unavailable, which hid problems.

**Consequences** – CI builds the OOPS! image (cached with buildx) and installs `requirements.txt`. OOPS! loads an ontology's imports, so very large ontologies may time out and fall back to the Python scan.

## D-014: The Evaluate Action is the only writer of evaluation results   (2026-10-25, status: accepted; supersedes the rebase-only mitigation)
**Context** – `data/evaluation.json` and `data/quality/*` conflicted twice. Both local runs and the scheduled Action wrote them, and each run rewrites the whole file, so git can never merge two versions.
**Decision** – Only the "Evaluate catalog" Action writes `data/evaluation.json`, `data/runs/` and `data/quality/` (signalled by `GITHUB_ACTIONS` / `NEUROSCHEMA_CI`; see `scripts/paths.mjs`). Local `evaluate`, `quality` and `rescore` write to `.local/data/` (git-ignored), and the build previews them when newer. Three guards enforce this: `.githooks/pre-commit` (enabled by `npm run setup` / `npm run dev`) blocks local commits of generated data; the Checks workflow fails PRs that change it; and the Action rebases before pushing, retrying on conflict. The Action also runs when evaluation code changes.
**Why** – With a single writer there is never a second version to conflict with. Rejected: a custom git merge driver, which needs per-clone config and would silently pick a side, and moving data to a separate branch, which would make the Vercel build fetch over the network.
**Consequences** – To change the published scores, push code or catalog changes and let the Action run, or start it manually. Merges that bring in the Action's commits are always allowed by the hook.

## D-015: Evaluation runs locally; GitHub Actions only for submissions   (2026-10-25, status: accepted; supersedes D-004's scheduled evaluation and D-014)
**Context** – The owner prefers to run evaluations on their own machine and publish the static result, because it is free and avoids server or CI compute. Submissions still go through GitHub.
**Decision** – `scripts/refresh.sh` (also `npm run refresh`) pulls, validates, builds the OOPS! and ROBOT Docker images, runs the quality checks and the evaluation, rebuilds the site, and commits `data/evaluation.json`, `data/runs/` and `data/quality/`. `--push` also publishes, and `--quick` skips the slow quality checks. The maintainer's local run is the single writer of these files. The scheduled "Evaluate catalog" Action and the pre-commit hook are removed. CI's PR previews write to `.local/data/` and never touch tracked results, and CI still rejects PRs that edit them. ROBOT runs from `docker/robot` when Java isn't installed, and the Python with rdflib is found automatically.
**Why** – With one writer there are no conflicts, and nothing runs on paid compute. Rejected: keeping the weekly Action, which duplicated the local run and was what caused the conflicts.
**Consequences** – Scores are as fresh as the maintainer's last `refresh`. Set `GITHUB_TOKEN` (or log in with `gh`) before running, to avoid GitHub's 60 requests/hour limit.

## D-016: Point non-neuroscience visitors to SchemaScope   (2026-10-25, status: accepted)
**Context** – NeuroSchema only lists neuroscience resources. Visitors looking for other domains reached a dead end (empty search or catalog filter).
**Decision** – Add `sister` to `site.config.json` (SchemaScope, https://schemascope.org) and link to it from the header ("Other domains ↗", hidden on phones), a home-page callout, the footer, the empty catalog state, and the search page (forwarding the query to SchemaScope's search). `vercel.json` adds `/schemascope` and `/other-domains` redirects.
**Why** – SchemaScope covers every domain with the same rubric, so it's the natural place to send people. Plain links keep the visitor in control; a forced redirect was rejected because neuroscience pages must stay on NeuroSchema.
**Consequences** – Removing `sister` from the config removes every link. Redirects are temporary (307) so they can change.

## D-017: Submission bot doesn't depend on the label existing   (2026-10-26, status: accepted)
**Context** – `.github/workflows/submission.yml` only ran for issues labelled `submission`. The issue form (`.github/ISSUE_TEMPLATE/add-resource.yml`) adds that label, but GitHub silently drops a template label that doesn't exist in the repo, so submissions were skipped.
**Decision** – The job also runs when the issue body contains the form's `### Catalog entry (JSON)` field. Its first step creates the `submission` label if missing and adds it to the issue, using `GITHUB_TOKEN` so the label doesn't start the workflow again. The PR title for a correction now uses the saved entry's name.
**Why** – A new repo or fork works without manual label setup. Rejected: documenting "create the label first", which is easy to miss.
**Consequences** – Nothing to migrate. Existing unlabelled submission issues are picked up on their next edit.

## D-018: Check DOIs against several registries, and keep the optional score preview optional   (2026-10-27, status: accepted)
**Context** – `scripts/validate.mjs --online` checked DOIs in Crossref only, with no timeout, and treated any failed request as "not found". On a PR, a valid DOI (10.1038/s41597-024-03559-8) failed because Crossref didn't answer the CI runner. In `.github/workflows/ci.yml` the "FAIR evaluation preview" step ran with `if: always()`, so it kept running after the checks had failed or the run was cancelled.
**Decision** – Look each DOI up in Crossref, DataCite, OpenAlex, Semantic Scholar and the doi.org handle API at once, with timeouts and one retry. Found in any of them: pass, and match the title against the closest one. Fail only when doi.org, or every source, says 404. If they're unreachable, warn and show ⚠️ in the report. OLS lookups and the download sniff also get timeouts. In CI, the preview runs only after the checks pass, can't fail the job, and has a 15-minute limit. The online checks get 10 minutes and the job 30. A new push cancels the older run.
**Why** – One registry having an outage or rate-limiting CI shouldn't block a correct submission. Rejected: retrying Crossref only, since it's still a single point of failure and misses DataCite DOIs (Zenodo, figshare).
**Consequences** – PR checks no longer fail on a DOI they couldn't reach. Those cases show as warnings for the reviewer to check. PRs whose checks fail no longer get a score preview.

## D-019: Run ROBOT on every ontology; the OBO Dashboard is a comparison, not a source   (2026-10-27, status: accepted)
**Context** – `scripts/quality.mjs` skipped ROBOT for ontologies on the OBO Dashboard, and `scripts/rubric.mjs` took consistency, unsatisfiable classes, OWL 2 DL and the ROBOT report from the Dashboard first. So scores for OBO ontologies depended on an outside service and its schedule.
**Decision** – ROBOT (report → ELK reason → DL profile) runs on every ontology. The rubric (now 3.5) uses our result first, and the Dashboard's only when ours is missing. Each result stores `dashboardComparison`, which lists each check side by side. The ontology page shows it as "Our checks vs the OBO Dashboard", and `evaluate.mjs` prints the ontologies where the two differ. The download and Python-scan limits default to 5 GB, and files are hashed as a stream. ROBOT's Java heap is configurable (`ROBOT_HEAP`), and by default is 2 GB less than Docker's memory (4–12 GB).
**Why** – NeuroSchema's scores should be reproducible from its own checks alone. Rejected: keeping the Dashboard first and only showing ours, which leaves scores tied to when the Dashboard last ran.
**Consequences** – OBO Foundry ontologies can score differently. We check the full download, which often includes imported terms, while the Dashboard usually checks the `-base` file, so ROBOT error counts can be much higher (e.g. MF: 140 vs 2). R1.3 (OBO principles) still comes from the Dashboard, since there's no local equivalent. Rebuild the ROBOT image (`docker build docker/robot`) for the configurable heap. Large ontologies need Docker Desktop's memory raised.

## D-020: Rubric v4.0, source-neutral evidence   (2026-10-27, status: accepted)
**Context** – Several v3 checks could only be scored from OBO infrastructure. F4 and A2 ignored LOV and most registries, and R1.3 used only the OBO Dashboard. Q scored 0 for checks that were never run. ROBOT errors and unsatisfiable classes cost points twice (in Q and in P). A draft proposal ("rubric v4.0 (draft): source-neutral evidence") measured the effect from stored facts.
**Decision** – F4 counts LOV, and A2 accepts any of those registries. R1.3 is the better of the OBO principle pass rate (×3) and a FAIRsharing listing (2). LOV isn't counted under R1.3, so one listing isn't counted three times. A Q check that couldn't be run (no file, too large, tool timed out) is "not assessed": it's left out of the possible points, and the grade is marked *. A file ROBOT can't load still scores 0. The ROBOT report checks (errors, warning density) apply only to OBO-style ontologies. P no longer penalises unsatisfiable classes or ROBOT errors.
**Why** – Missing evidence from a source that doesn't cover a resource isn't a failure. Rejected from the draft: counting LOV for R1.3 (triple counting), and treating unloadable files as "not assessed" (that would reward broken artefacts).
**Consequences** – From the same stored facts as v3.5, 309 grades rise and none fall. The OBO mean goes 51.9 → 56.9 and the non-OBO mean 18.7 → 24.5. One score drops by 1 point through rounding. Most ontologies are marked * until quality checks have run on them. Run `npm run rescore` (no network) or the next refresh to apply it.

## D-021: Contact page with contributors from GitHub   (2026-10-27, status: accepted)
**Context** – The site had no contact details and didn't credit contributors.
**Decision** – Add a /contact/ page with the maintainer's name, emails and website (`CONTACT_NAME`, `CONTACT_EMAILS`, `CONTACT_SITE` override them at build time). It also lists contributors from the GitHub API at build time, without bots, caching the last good list in `.local/contributors.json`.
**Why** – Contributors stay current without manual edits. Rejected: a hand-maintained list, which goes stale.
**Consequences** – The build makes one GitHub API request (it uses `GITHUB_TOKEN` if set). An offline build uses the cache, or else just links to GitHub.

## D-022: Rubric v4.1: read imports from the ontology file, and check every ontology   (2026-10-27, status: accepted)
**Context** – I3, upper-ontology alignment and RO use came only from OLS and Bioregistry import lists. Those cover few non-OBO ontologies, so most showed "no imported vocabularies found". Quality checks covered only a few dozen ontologies, because each run had a 2-hour limit and checked one ontology at a time.
**Decision** – `scripts/artefact-scan.mjs` streams each downloaded file (up to 500 MB, `ARTEFACT_SCAN_MB`) and records `owl:imports` and the vocabularies it uses (at least 3 distinct terms). OBO terms are recognised by their `PREFIX_` IRIs, and other namespaces by LOV and a short list of well-known ones. The rubric (v4.1) adds these to the OLS/Bioregistry lists for I3, upper-ontology alignment (now also GFO and gUFO) and RO. `quality.mjs` runs `QUALITY_JOBS` ontologies at a time, sharing Docker's memory between them, and prints how many ontologies have been checked. `npm run quality:all` runs it with no time limit, skipping ontologies checked in the last 30 days so it can be stopped and resumed.
**Why** – Evidence from the file itself covers every ontology. Rejected: parsing each file with rdflib, which is too slow and memory-hungry for multi-GB ontologies.
**Consequences** – The new evidence appears only after a quality run has read an ontology's file. Until then the old OLS/Bioregistry evidence is used.

## D-023: Per-criterion metrics across runs; issue templates for problems and ideas   (2026-10-27, status: accepted)
**Context** – Entry pages listed changes in score, version and term count between runs, but not which criterion or quality metric changed. The contact page linked to a blank GitHub issue.
**Decision** – Each run's history point stores per-criterion points, the penalty and the quality metrics (consistency, unsatisfiable classes, OWL 2 DL, ROBOT errors and warnings, critical pitfalls, imports, reuse). Entry pages show a "Metrics across runs" table that highlights what got better or worse, and list per-criterion changes. New issue forms, "Report a problem" and "Suggest an idea", are linked from the contact page.
**Why** – It shows whether a score moved because the resource changed or because the rubric did. Structured issues are easier to act on. Rejected: a free-text issue link.
**Consequences** – Runs archived before this change have fewer metrics, so their table cells show "—".

## D-024: Local score previews for contributors   (2026-10-28, status: accepted)
**Context** – Outside CI, `evaluate`, `rescore` and `quality` wrote straight to the tracked `data/evaluation.json`, `data/runs/` and `data/quality/` (`scripts/paths.mjs`). Contributors who wanted to see how their change scores ended up with generated files in their pull request, which CI rejects.
**Decision** – `PREVIEW=1` sends all three scripts to the git-ignored `.local/data/`, as CI previews already did. New npm scripts: `evaluate:preview`, `rescore:preview`, `quality:preview` and `score:diff` (`scripts/score-diff.mjs`, which compares the preview with the published scores, per entry and per criterion). The site build already shows the newer of the two. `CONTRIBUTING.md` documents the workflow.
**Why** – Contributors can test rubric and catalog changes end to end without a risk of committing scores; the maintainer's run stays the only writer of published results. Rejected: asking contributors to `git restore` generated files before committing (easy to forget), and a separate output flag per script.
**Consequences** – Plain `npm run evaluate`/`rescore`/`quality` still write tracked files, for the maintainer. `rm -rf .local/data` returns a local build to the published scores.
