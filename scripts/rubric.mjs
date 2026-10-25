// Scoring rubric shared by the evaluator (scores) and the site (methodology page).
// Four criteria follow the FAIR principles (Wilkinson et al. 2016, doi:10.1038/sdata.2016.18);
// two more measure maintenance and community adoption.
// Change weights here and bump RUBRIC_VERSION; `npm run rescore` recomputes scores from stored facts.

export const RUBRIC_VERSION = "2.2";

export const MACHINE_FORMATS = ["OWL", "OBO", "Turtle", "RDF", "JSON-LD", "LinkML", "JSON Schema", "SHACL", "YAML schema", "XSD"];
export const SEMANTIC_FORMATS = ["OWL", "OBO", "Turtle", "RDF", "JSON-LD", "SHACL"];
export const PID_HOSTS = ["purl.obolibrary.org", "purl.org", "w3id.org", "purl.brain-bican.org", "doi.org", "identifiers.org", "purl.bioontology.org", "n2t.net"];

export const MAINTENANCE_STEPS = [
  { upTo: 6, pts: 20, label: "≤ 6 months" },
  { upTo: 12, pts: 16, label: "≤ 1 year" },
  { upTo: 24, pts: 10, label: "≤ 2 years" },
  { upTo: 48, pts: 4, label: "≤ 4 years" },
  { upTo: Infinity, pts: 0, label: "older / unknown" },
];
export const MAINTENANCE_CAP = 4;
export const ADOPTER_STEPS = [
  { min: 4, pts: 12 },
  { min: 3, pts: 10 },
  { min: 2, pts: 7 },
  { min: 1, pts: 5 },
  { min: 0, pts: 0 },
];
export const STAR_STEPS = [
  { min: 200, pts: 8 },
  { min: 50, pts: 6 },
  { min: 10, pts: 3 },
  { min: 0, pts: 0 },
];
export const CITATION_STEPS = [
  { min: 500, pts: 8 },
  { min: 100, pts: 6 },
  { min: 20, pts: 3 },
  { min: 0, pts: 0 },
];
const step = (table, v) => table.find((s) => v >= s.min).pts;

export const RUBRIC = [
  {
    key: "findable",
    symbol: "F",
    label: "Findable",
    fair: true,
    max: 15,
    formula: "5·[persistent identifier] + 5·[indexed in a registry] + 5·[citable reference]",
    how: "F1: the artefact has a persistent identifier (PURL, w3id, DOI…) (5). F4: it is indexed in a searchable registry — OLS, OBO Foundry or BioPortal (5). F2: it has rich, citable metadata, here a reference publication with a DOI (5).",
  },
  {
    key: "accessible",
    symbol: "A",
    label: "Accessible",
    fair: true,
    max: 15,
    formula: "5·[homepage reachable] + 10·[artefact retrievable over HTTP(S)]",
    how: "A1: the machine-readable artefact (download PURL or repository) can be retrieved over a standard open protocol (10), and its homepage resolves (5). Hosts that refuse automated checks (HTTP 401/403/406/429) count as reachable.",
  },
  {
    key: "interoperable",
    symbol: "I",
    label: "Interoperable",
    fair: true,
    max: 15,
    formula: "10·[formal, machine-readable format] + 5·[semantic-web format with resolvable IRIs]",
    how: `I1: published in a formal, broadly applicable language (${MACHINE_FORMATS.join(", ")}) (10). I2: uses a semantic-web representation (${SEMANTIC_FORMATS.join(", ")}) whose terms are IRIs other resources can link to (5).`,
  },
  {
    key: "reusable",
    symbol: "R",
    label: "Reusable",
    fair: true,
    max: 15,
    formula: "10·[clear license] + 5·[versioned releases]",
    how: "R1.1: a clear usage license is declared in the catalog, the OBO Foundry registry, or detected by GitHub (10). R1.2: releases are versioned — a version IRI or version info in the artefact, an OLS version, or a tagged release — so users can cite and pin exactly what they used (5).",
  },
  {
    key: "maintenance",
    symbol: "M",
    label: "Maintenance",
    fair: false,
    max: 20,
    formula: "f(months since last activity), capped at 4 if archived, legacy or OBO-inactive",
    how: "Most recent public activity: latest commit or release, OLS release date, or the Last-Modified date of the artefact. ≤ 6 months: 20 · ≤ 1 year: 16 · ≤ 2 years: 10 · ≤ 4 years: 4 · older or unknown: 0. Archived repositories, legacy resources and OBO-inactive ontologies are capped at 4.",
  },
  {
    key: "adoption",
    symbol: "U",
    label: "Community adoption",
    fair: false,
    max: 20,
    formula: "g(adopting projects) + max(h(GitHub stars), k(citations))",
    how: "Documented adopting projects, curated here or registered in the OBO Foundry: ≥ 4: 12 · 3: 10 · 2: 7 · 1: 5. Community signal, the better of GitHub stars (≥ 200: 8 · ≥ 50: 6 · ≥ 10: 3) and citations of the reference paper from Crossref (≥ 500: 8 · ≥ 100: 6 · ≥ 20: 3).",
  },
];
// Progressive inactivity penalty, subtracted from the total.
export const PENALTY = {
  key: "inactivity",
  symbol: "P",
  label: "Inactivity penalty",
  perYear: 4,
  graceYears: 1,
  timeCap: 20,
  status: 10,
  unknown: 5,
  cap: 30,
  formula: "min(30, min(20, 4·max(0, years since last activity − 1)) + 10·[archived, legacy or OBO-inactive]); 5 if no activity evidence",
  how: "Unmaintained resources are progressively marked down. After a one-year grace period, every further year without public activity deducts 4 points (2 years → −4, 3 → −8, 4 → −12, 5 → −16, 6+ → −20). Archived repositories, legacy entries and OBO-inactive/orphaned/obsolete ontologies lose a further 10. If no activity evidence exists at all, 5 points are deducted. The penalty is capped at 30 and the total never drops below 0.",
};
export const FAIR_MAX = RUBRIC.filter((r) => r.fair).reduce((s, r) => s + r.max, 0);

export const GRADES = [
  { grade: "A", min: 80 },
  { grade: "B", min: 65 },
  { grade: "C", min: 50 },
  { grade: "D", min: 0 },
];

const reachable = (l) => l && (l.state === "ok" || l.state === "blocked");
const monthsSince = (iso) => (Date.now() - new Date(iso).getTime()) / (30.44 * 864e5);

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Curated adopters plus OBO Foundry usages, de-duplicated by host.
export function adopters(entry, facts) {
  const list = (entry.usedBy || []).map((u) => ({ ...u, source: "curated" }));
  const seen = new Set(list.map((u) => hostOf(u.url)));
  for (const u of facts?.obo?.usages || []) {
    if (!u.user || seen.has(hostOf(u.user))) continue;
    seen.add(hostOf(u.user));
    list.push({ name: hostOf(u.user), url: u.user, note: u.description, source: "OBO Foundry registry" });
  }
  return list;
}

export function lastActivity(facts) {
  const dates = [
    facts.github?.pushedAt,
    facts.github?.latestRelease?.date,
    facts.ols?.releaseDate,
    facts.bioportal?.released,
    facts.links?.download?.lastModified,
  ].filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

// The version that was evaluated, from the most specific evidence available.
export function evaluatedVersion(facts) {
  const art = facts.artifact || {};
  const candidates = [
    art.versionIri && { label: art.versionIri.match(/(\d{4}-\d{2}-\d{2}|v?\d+(?:\.\d+)+)/)?.[1] || art.versionIri.match(/\/(v?\d+)\/[^/]+$/)?.[1] || art.versionIri, from: "version IRI in the artefact", value: art.versionIri },
    art.versionInfo && { label: art.versionInfo, from: "version info in the artefact", value: art.versionInfo },
    facts.ols?.version && { label: String(facts.ols.version), from: "OLS", value: facts.ols.versionIri || String(facts.ols.version) },
    facts.github?.latestRelease?.tag && { label: facts.github.latestRelease.tag, from: "latest GitHub release", value: facts.github.latestRelease.url || facts.github.latestRelease.tag },
    facts.bioportal?.version && { label: facts.bioportal.version, from: "BioPortal", value: facts.bioportal.version },
    facts.git?.headTag && { label: facts.git.headTag, from: "git tag on the evaluated commit", value: facts.git.commit },
    facts.git?.latestTag && { label: `${facts.git.latestTag.name} + commit ${facts.git.commit.slice(0, 7)}`, from: `latest release tag; ${facts.git.ref || "default branch"} evaluated at commit`, value: facts.git.commit, release: facts.git.latestTag.name },
    facts.git?.commit && { label: `commit ${facts.git.commit.slice(0, 7)}`, from: `${facts.git.ref || "default branch"} at evaluation time`, value: facts.git.commit },
    facts.links?.download?.lastModified && { label: `file of ${facts.links.download.lastModified.slice(0, 10)}`, from: "Last-Modified of the download", value: facts.links.download.lastModified },
  ].filter(Boolean);
  return candidates[0] ? { ...candidates[0], all: candidates } : null;
}

const isPid = (url) => !!url && PID_HOSTS.includes(hostOf(url));

// Returns score, grade, FAIR subtotal and a breakdown where every criterion lists the steps that produced its points.
export function scoreEntry(entry, facts) {
  const b = Object.fromEntries(RUBRIC.map((r) => [r.key, { score: 0, max: r.max, steps: [], notes: [] }]));
  const add = (k, label, pts, max, detail) => {
    b[k].steps.push({ label, pts, max, detail });
    b[k].score += pts;
  };
  const { homepage, repository, download } = facts.links;

  // F — Findable
  const pid = isPid(entry.download) ? entry.download : entry.obo ? `http://purl.obolibrary.org/obo/${entry.obo}.owl` : null;
  add("findable", "Persistent identifier (F1)", pid ? 5 : 0, 5, pid ? hostOf(pid) : "no PURL / w3id / DOI for the artefact");
  const where = [facts.ols?.terms && !facts.ols?.error ? "OLS" : null, facts.obo && !facts.obo.error ? "OBO Foundry" : null, entry.bioportal ? "BioPortal" : null].filter(Boolean);
  add("findable", "Indexed in a registry (F4)", where.length ? 5 : 0, 5, where.length ? where.join(", ") : "not in OLS, OBO Foundry or BioPortal");
  const pubs = entry.publications || [];
  add("findable", "Citable reference (F2)", pubs.length ? 5 : 0, 5, pubs.length ? `doi:${pubs[0].doi}` : "no reference publication listed");

  // A — Accessible
  add("accessible", "Homepage reachable", reachable(homepage) ? 5 : 0, 5, homepage ? `HTTP ${homepage.code || homepage.error}` : "no homepage listed");
  const machine = [download, repository].filter(Boolean);
  const okSrc = machine.find(reachable);
  add("accessible", "Artefact retrievable over HTTP(S) (A1)", okSrc ? 10 : 0, 10,
    okSrc ? `${okSrc === download ? "download" : "repository"} HTTP ${okSrc.code}` : machine.length ? "unreachable" : "no download or repository listed");

  // I — Interoperable
  const fmt = (entry.formats || []).filter((f) => MACHINE_FORMATS.includes(f));
  add("interoperable", "Formal machine-readable format (I1)", fmt.length ? 10 : 0, 10, fmt.length ? fmt.join(", ") : `none of: ${(entry.formats || []).join(", ") || "—"}`);
  const sem = (entry.formats || []).filter((f) => SEMANTIC_FORMATS.includes(f));
  add("interoperable", "Semantic-web format with IRIs (I2)", sem.length ? 5 : 0, 5, sem.length ? sem.join(", ") : "no RDF/OWL/JSON-LD representation listed");

  // R — Reusable
  const license = entry.license || facts.obo?.license || facts.github?.license;
  const licSrc = entry.license ? "catalog" : facts.obo?.license ? "OBO Foundry" : facts.github?.license ? "GitHub" : null;
  add("reusable", "Clear license (R1.1)", license ? 10 : 0, 10, license ? `${license} (${licSrc})` : "none found");
  const ver = evaluatedVersion(facts);
  const versioned = ver && !["Last-Modified of the download"].includes(ver.from) && !ver.from.endsWith("at evaluation time");
  add("reusable", "Versioned releases (R1.2)", versioned ? 5 : 0, 5, versioned ? `${ver.release || ver.label} (${ver.release ? "release tag" : ver.from})` : "no version IRI, version info or tagged release found");

  // M — Maintenance
  const last = lastActivity(facts);
  const m = last ? monthsSince(last) : Infinity;
  const tier = MAINTENANCE_STEPS.find((s) => m <= s.upTo);
  add("maintenance", "Months since last activity", tier.pts, 20, last ? `${last.slice(0, 10)} → ${m.toFixed(1)} months (${tier.label})` : "no public activity signal");
  const capReason = facts.github?.archived ? "repository archived" : entry.status === "legacy" ? "marked legacy" : facts.obo?.status === "inactive" ? "inactive in OBO Foundry" : null;
  if (capReason && b.maintenance.score > MAINTENANCE_CAP) add("maintenance", `Cap at ${MAINTENANCE_CAP}`, MAINTENANCE_CAP - b.maintenance.score, 0, capReason);
  else if (capReason) b.maintenance.notes.push(capReason);

  // U — Adoption
  const n = adopters(entry, facts).length;
  add("adoption", "Documented adopting projects", step(ADOPTER_STEPS, n), 12, `${n} project${n === 1 ? "" : "s"}`);
  const stars = facts.github?.stars ?? 0;
  const cites = Math.max(0, ...(facts.citations || []).map((c) => c.count ?? 0));
  const sp = step(STAR_STEPS, stars), cp = step(CITATION_STEPS, cites);
  add("adoption", "Community signal", Math.max(sp, cp), 8, `max(stars ${stars} → ${sp}, citations ${cites} → ${cp})`);

  for (const k of Object.keys(b)) b[k].notes.unshift(...b[k].steps.filter((s) => s.max > 0 && s.pts < s.max).map((s) => `${s.label}: ${s.detail}`));
  // P — progressive inactivity penalty
  const inactiveReason =
    facts.github?.archived ? "repository archived" :
    entry.status === "legacy" ? "marked legacy" :
    ["inactive", "orphaned", "obsolete"].includes(facts.obo?.status) ? `${facts.obo.status} in OBO Foundry` : null;
  const years = last ? m / 12 : null;
  const pSteps = [];
  let timeP;
  if (years == null) {
    timeP = PENALTY.unknown;
    pSteps.push({ label: "No activity evidence", pts: -timeP, detail: "no commits, releases or dated files found" });
  } else {
    timeP = Math.min(PENALTY.timeCap, Math.round(Math.max(0, years - PENALTY.graceYears) * PENALTY.perYear));
    pSteps.push({ label: "Time since last activity", pts: -timeP, detail: `${years.toFixed(1)} years → ${PENALTY.perYear} × max(0, ${years.toFixed(1)} − ${PENALTY.graceYears})${timeP === PENALTY.timeCap ? " (capped)" : ""}` });
  }
  const statusP = inactiveReason ? PENALTY.status : 0;
  pSteps.push({ label: "Inactive status", pts: -statusP, detail: inactiveReason || "not archived, legacy or inactive" });
  const pTotal = Math.min(PENALTY.cap, timeP + statusP);
  const penalty = { pts: pTotal, why: pTotal ? pSteps.filter((x) => x.pts).map((x) => x.detail).join("; ") : `active (last activity ${last?.slice(0, 10)})`, steps: pSteps };
  const gross = Object.values(b).reduce((s, x) => s + x.score, 0);
  const score = Math.max(0, gross - penalty.pts);
  const fair = RUBRIC.filter((r) => r.fair).reduce((s, r) => s + b[r.key].score, 0);
  const grade = GRADES.find((g) => score >= g.min).grade;
  return { score, gross, penalty: { score: -penalty.pts, reason: penalty.why, steps: penalty.steps }, grade, fair, breakdown: b, lastActivity: last, adopterCount: n, evaluatedVersion: ver };
}
