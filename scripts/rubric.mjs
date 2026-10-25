// NeuroSchema scoring rubric v3 — strict by design: 100 requires excellence on every axis.
// Shared by the evaluator (scores) and the site (methodology page).
// F/A/I/R follow the FAIR principles (Wilkinson et al. 2016, doi:10.1038/sdata.2016.18).
// Q measures ontology quality: upper-ontology alignment, logical consistency (reasoner),
// ROBOT quality report and OOPS! pitfalls. M = maintenance, U = adoption, P = inactivity penalty.
// Change weights here and bump RUBRIC_VERSION; `npm run rescore` recomputes from stored facts.

export const RUBRIC_VERSION = "3.0";

export const MACHINE_FORMATS = ["OWL", "OBO", "Turtle", "RDF", "JSON-LD", "LinkML", "JSON Schema", "SHACL", "YAML schema", "XSD"];
export const SEMANTIC_FORMATS = ["OWL", "OBO", "Turtle", "RDF", "JSON-LD", "SHACL"];
export const ONTOLOGY_FORMATS = ["OWL", "OBO", "Turtle", "RDF"];
export const PID_HOSTS = ["purl.obolibrary.org", "purl.org", "w3id.org", "purl.brain-bican.org", "doi.org", "identifiers.org", "purl.bioontology.org", "n2t.net"];
export const UPPER_ONTOLOGIES = ["bfo", "cob", "dolce", "gfo", "sumo", "bfo2020"];
export const RELATION_ONTOLOGIES = ["ro"];
export const OPEN_LICENSES = /^(cc[ -]?by|cc0|cc-by|mit|bsd|apache|isc|mpl|lgpl|gpl|odc|pddl|public domain)/i;

const tier = (table, v) => table.find((s) => v >= s.min).pts;
export const T = {
  registries: [{ min: 4, pts: 5 }, { min: 3, pts: 4 }, { min: 2, pts: 3 }, { min: 1, pts: 1 }, { min: 0, pts: 0 }],
  imports: [{ min: 3, pts: 4 }, { min: 1, pts: 2 }, { min: 0, pts: 0 }],
  recency: [{ upTo: 3, pts: 10, label: "≤ 3 months" }, { upTo: 6, pts: 8, label: "≤ 6 months" }, { upTo: 12, pts: 5, label: "≤ 1 year" }, { upTo: 24, pts: 2, label: "≤ 2 years" }, { upTo: Infinity, pts: 0, label: "older / unknown" }],
  cadence: [{ min: 6, pts: 6 }, { min: 4, pts: 5 }, { min: 2, pts: 3 }, { min: 1, pts: 2 }, { min: 0, pts: 0 }],
  adopters: [{ min: 8, pts: 7 }, { min: 5, pts: 5 }, { min: 3, pts: 4 }, { min: 1, pts: 2 }, { min: 0, pts: 0 }],
  reuse: [{ min: 30, pts: 4 }, { min: 10, pts: 3 }, { min: 3, pts: 2 }, { min: 1, pts: 1 }, { min: 0, pts: 0 }],
  stars: [{ min: 500, pts: 5 }, { min: 100, pts: 4 }, { min: 25, pts: 2 }, { min: 5, pts: 1 }, { min: 0, pts: 0 }],
  citations: [{ min: 1000, pts: 5 }, { min: 300, pts: 4 }, { min: 50, pts: 2 }, { min: 10, pts: 1 }, { min: 0, pts: 0 }],
  warnDensity: [{ max: 0.05, pts: 2 }, { max: 0.5, pts: 1 }, { max: Infinity, pts: 0 }],
};

export const RUBRIC = [
  {
    key: "findable", symbol: "F", label: "Findable", fair: true, max: 12,
    formula: "4·[persistent identifier] + r(registries) + 3·[citable reference]",
    how: "F1 — the artefact has a persistent identifier: PURL, w3id or DOI (4). F4 — it is indexed in searchable services; counted across OLS, TIB, BioPortal, OBO Foundry, Bioregistry and FAIRsharing: ≥ 4 → 5, 3 → 4, 2 → 3, 1 → 1. F2 — a citable reference publication with a DOI (3).",
  },
  {
    key: "accessible", symbol: "A", label: "Accessible", fair: true, max: 12,
    formula: "3·[homepage reachable] + 6·[artefact retrievable over HTTP(S)] + 3·[metadata persists in a registry]",
    how: "A1 — the machine-readable artefact (download PURL or repository) is retrievable over HTTP(S) (6) and the homepage resolves (3). A2 — metadata stays available even if the resource disappears, because it is registered in Bioregistry or the OBO Foundry (3). Hosts that refuse automated checks count as reachable.",
  },
  {
    key: "interoperable", symbol: "I", label: "Interoperable", fair: true, max: 12,
    formula: "5·[formal format] + 3·[semantic-web IRIs] + i(imported vocabularies)",
    how: `I1 — a formal, broadly applicable language (${MACHINE_FORMATS.join(", ")}) (5). I2 — a semantic-web representation (${SEMANTIC_FORMATS.join(", ")}) whose terms are resolvable IRIs (3). I3 — qualified references to other vocabularies, measured by imported ontologies (OLS, Bioregistry): ≥ 3 → 4, 1–2 → 2.`,
  },
  {
    key: "reusable", symbol: "R", label: "Reusable", fair: true, max: 12,
    formula: "license(5 open / 2 other) + version(4 in artefact / 2 elsewhere) + 3·(OBO principles pass rate)",
    how: "R1.1 — a clear license: a recognised open license scores 5, any other stated license 2. R1.2 — provenance of releases: a version IRI or version info inside the artefact scores 4; a release tag or registry version only, 2. R1.3 — meets community standards, measured by the share of OBO Foundry principle checks passed on the OBO Dashboard (× 3). Resources outside the OBO Foundry have no independent compliance report and score 0 here.",
  },
  {
    key: "quality", symbol: "Q", label: "Ontology quality", fair: false, max: 20, ontologyOnly: true,
    formula: "u(upper ontology) + c(consistency) + q(ROBOT report) + o(OOPS! pitfalls)",
    how: "Applies to ontologies (OWL/OBO/RDF artefacts). Upper-ontology alignment: imports BFO or COB (4) and the Relation Ontology (2). Logical consistency from a reasoner run (OBO Dashboard, or ROBOT + ELK in our CI): consistent with no unsatisfiable classes 6; consistent with unsatisfiable classes 2; inconsistent or never checked 0. ROBOT quality report: no errors 2, plus warnings per class ≤ 0.05 → 2, ≤ 0.5 → 1. OOPS! pitfall scan: no critical pitfalls 2, plus ≤ 2 important pitfall types 2. If the OOPS! service is unavailable its 4 points are excluded and Q is scaled to 20. Schemas, atlases and other non-ontology resources are not scored on Q; their total is scaled to 100 from the remaining 80 points.",
  },
  {
    key: "maintenance", symbol: "M", label: "Maintenance", fair: false, max: 16,
    formula: "recency(months) + cadence(releases in last 12 months)",
    how: "Recency of the latest commit, release or dated file: ≤ 3 months 10, ≤ 6 months 8, ≤ 1 year 5, ≤ 2 years 2, older 0. Release cadence — distinct releases in the last 12 months (GitHub releases, dated tags, version IRIs across runs): ≥ 6 → 6, ≥ 4 → 5, ≥ 2 → 3, 1 → 2.",
  },
  {
    key: "adoption", symbol: "U", label: "Community adoption", fair: false, max: 16,
    formula: "a(adopting projects) + reuse(ontologies importing it) + max(stars, citations)",
    how: "Documented adopting projects (curated, OBO Foundry usages): ≥ 8 → 7, ≥ 5 → 5, ≥ 3 → 4, ≥ 1 → 2. Reuse — other ontologies that import it (OBO Dashboard, OLS, Bioregistry): ≥ 30 → 4, ≥ 10 → 3, ≥ 3 → 2, ≥ 1 → 1. Community signal, the better of GitHub stars (≥ 500 → 5, ≥ 100 → 4, ≥ 25 → 2, ≥ 5 → 1) and reference-paper citations (≥ 1000 → 5, ≥ 300 → 4, ≥ 50 → 2, ≥ 10 → 1).",
  },
];

export const PENALTY = {
  key: "inactivity", symbol: "P", label: "Inactivity penalty",
  perYear: 4, graceYears: 1, timeCap: 20, status: 10, unknown: 5, cap: 30,
  formula: "min(30, min(20, 4·max(0, years since last activity − 1)) + 10·[archived, legacy or OBO-inactive]); 5 if no activity evidence",
  how: "Unmaintained resources are progressively marked down. After a one-year grace period, every further year without public activity deducts 4 points (2 years → −4, 3 → −8, … 6+ → −20). Archived repositories, legacy entries and OBO-inactive/orphaned/obsolete ontologies lose a further 10. With no activity evidence at all, 5 points are deducted. Capped at 30; the total never drops below 0.",
};

export const FAIR_MAX = RUBRIC.filter((r) => r.fair).reduce((s, r) => s + r.max, 0);
export const GRADES = [
  { grade: "A", min: 85 },
  { grade: "B", min: 70 },
  { grade: "C", min: 55 },
  { grade: "D", min: 40 },
  { grade: "E", min: 0 },
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
const lc = (xs) => [...new Set((xs || []).map((x) => String(x).toLowerCase()))];

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

// Vocabularies this resource imports / depends on, and ontologies that reuse it.
export function imports(facts) {
  return lc([...(facts.ols?.importsFrom || []), ...(facts.bioregistry?.dependsOn || [])]).filter((x) => !["dc", "dcterms", "owl", "rdf", "rdfs", "xsd", "skos", "oio", "foaf"].includes(x));
}
export function reusedBy(facts) {
  return lc([...(facts.dashboard?.usedBy || []), ...(facts.ols?.exportsTo || []), ...(facts.bioregistry?.appearsIn || [])]);
}
export function registries(entry, facts) {
  const m = facts.bioregistry?.mappings || {};
  return [
    facts.ols?.terms && !facts.ols.error ? "OLS" : null,
    facts.tib?.terms && !facts.tib.error ? "TIB" : null,
    entry.bioportal || m.bioportal ? "BioPortal" : null,
    facts.obo && !facts.obo.error ? "OBO Foundry" : null,
    facts.bioregistry && !facts.bioregistry.error ? "Bioregistry" : null,
    m.fairsharing ? "FAIRsharing" : null,
  ].filter(Boolean);
}

export function lastActivity(facts) {
  const dates = [facts.github?.pushedAt, facts.github?.latestRelease?.date, facts.ols?.releaseDate, facts.bioportal?.released, facts.links?.download?.lastModified, ...(facts.releases?.dates || []).slice(-1)].filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

export function evaluatedVersion(facts) {
  const art = facts.artifact || {};
  const c = [
    art.versionIri && { label: art.versionIri.match(/(\d{4}-\d{2}-\d{2}|v?\d+(?:\.\d+)+)/)?.[1] || art.versionIri.match(/\/(v?\d+)\/[^/]+$/)?.[1] || art.versionIri, from: "version IRI in the artefact", value: art.versionIri, inArtefact: true },
    art.versionInfo && { label: art.versionInfo, from: "version info in the artefact", value: art.versionInfo, inArtefact: true },
    facts.ols?.version && { label: String(facts.ols.version), from: "OLS", value: facts.ols.versionIri || String(facts.ols.version) },
    facts.github?.latestRelease?.tag && { label: facts.github.latestRelease.tag, from: "latest GitHub release", value: facts.github.latestRelease.url || facts.github.latestRelease.tag },
    facts.bioportal?.version && { label: facts.bioportal.version, from: "BioPortal", value: facts.bioportal.version },
    facts.git?.headTag && { label: facts.git.headTag, from: "git tag on the evaluated commit", value: facts.git.commit },
    facts.git?.latestTag && { label: `${facts.git.latestTag.name} + commit ${facts.git.commit.slice(0, 7)}`, from: `latest release tag; ${facts.git.ref || "default branch"} evaluated at commit`, value: facts.git.commit, release: facts.git.latestTag.name },
    facts.git?.commit && { label: `commit ${facts.git.commit.slice(0, 7)}`, from: `${facts.git.ref || "default branch"} at evaluation time`, value: facts.git.commit },
    facts.links?.download?.lastModified && { label: `file of ${facts.links.download.lastModified.slice(0, 10)}`, from: "Last-Modified of the download", value: facts.links.download.lastModified },
  ].filter(Boolean);
  return c[0] ? { ...c[0], all: c } : null;
}

const isPid = (url) => !!url && PID_HOSTS.includes(hostOf(url));
export const isOntology = (entry) => (entry.formats || []).some((f) => ONTOLOGY_FORMATS.includes(f)) && ["ontology", "vocabulary"].includes(entry.kind);

export function scoreEntry(entry, facts) {
  const b = Object.fromEntries(RUBRIC.map((r) => [r.key, { score: 0, max: r.max, steps: [], notes: [] }]));
  const add = (k, label, pts, max, detail) => {
    b[k].steps.push({ label, pts, max, detail });
    b[k].score += pts;
  };
  const { homepage, repository, download } = facts.links;
  const regs = registries(entry, facts);
  const imp = imports(facts);
  const reuse = reusedBy(facts);
  const dash = facts.dashboard && !facts.dashboard.error ? facts.dashboard : null;
  const quality = facts.quality && !facts.quality.error ? facts.quality : null;

  // F
  const pid = isPid(entry.download) ? entry.download : entry.obo ? `http://purl.obolibrary.org/obo/${entry.obo}.owl` : null;
  add("findable", "Persistent identifier (F1)", pid ? 4 : 0, 4, pid ? hostOf(pid) : "no PURL / w3id / DOI for the artefact");
  add("findable", "Indexed in services (F4)", tier(T.registries, regs.length), 5, regs.length ? `${regs.length}: ${regs.join(", ")}` : "not indexed anywhere");
  add("findable", "Citable reference (F2)", entry.publications?.length ? 3 : 0, 3, entry.publications?.length ? `doi:${entry.publications[0].doi}` : "no reference publication listed");

  // A
  add("accessible", "Homepage reachable", reachable(homepage) ? 3 : 0, 3, homepage ? `HTTP ${homepage.code || homepage.error}` : "no homepage listed");
  const okSrc = [download, repository].filter(Boolean).find(reachable);
  add("accessible", "Artefact retrievable over HTTP(S) (A1)", okSrc ? 6 : 0, 6, okSrc ? `${okSrc === download ? "download" : "repository"} HTTP ${okSrc.code}` : download || repository ? "unreachable" : "no download or repository listed");
  const persist = regs.filter((x) => ["Bioregistry", "OBO Foundry"].includes(x));
  add("accessible", "Metadata persists in a registry (A2)", persist.length ? 3 : 0, 3, persist.length ? persist.join(", ") : "not in Bioregistry or OBO Foundry");

  // I
  const fmt = (entry.formats || []).filter((f) => MACHINE_FORMATS.includes(f));
  add("interoperable", "Formal machine-readable format (I1)", fmt.length ? 5 : 0, 5, fmt.length ? fmt.join(", ") : `none of: ${(entry.formats || []).join(", ") || "—"}`);
  const sem = (entry.formats || []).filter((f) => SEMANTIC_FORMATS.includes(f));
  add("interoperable", "Semantic-web IRIs (I2)", sem.length ? 3 : 0, 3, sem.length ? sem.join(", ") : "no RDF/OWL/JSON-LD representation");
  add("interoperable", "References other vocabularies (I3)", tier(T.imports, imp.length), 4, imp.length ? `imports ${imp.length}: ${imp.slice(0, 8).join(", ")}${imp.length > 8 ? "…" : ""}` : "no imported vocabularies found");

  // R
  const license = entry.license || facts.obo?.license || facts.bioregistry?.license || facts.github?.license;
  const open = license && OPEN_LICENSES.test(license);
  add("reusable", "Clear license (R1.1)", license ? (open ? 5 : 2) : 0, 5, license ? `${license}${open ? "" : " (not a recognised open license)"}` : "none found");
  const ver = evaluatedVersion(facts);
  const verPts = ver?.inArtefact ? 4 : ver && (ver.release || ["OLS", "latest GitHub release", "BioPortal", "git tag on the evaluated commit"].includes(ver.from)) ? 2 : 0;
  add("reusable", "Release provenance (R1.2)", verPts, 4, verPts === 4 ? `${ver.label} (${ver.from})` : verPts ? `${ver.release || ver.label} (${ver.release ? "release tag" : ver.from}); not declared inside the artefact` : "no version in artefact, registry or release tags");
  if (dash?.checks) {
    const vals = Object.entries(dash.checks).filter(([k]) => /^FP\d/.test(k)).map(([, v]) => v);
    const pass = vals.filter((v) => v === "PASS").length;
    add("reusable", "Community standards (R1.3)", Math.round((3 * pass) / (vals.length || 1)), 3, `OBO principles: ${pass}/${vals.length} checks pass`);
  } else add("reusable", "Community standards (R1.3)", 0, 3, "no independent compliance report (not on the OBO Dashboard)");

  // Q — ontology quality
  const qApplies = isOntology(entry);
  let qAvail = 20;
  if (qApplies) {
    const upper = imp.filter((x) => UPPER_ONTOLOGIES.includes(x));
    add("quality", "Upper-ontology alignment", upper.length ? 4 : 0, 4, upper.length ? `imports ${upper.join(", ").toUpperCase()}` : "no BFO/COB/DOLCE import found");
    const rel = imp.filter((x) => RELATION_ONTOLOGIES.includes(x));
    add("quality", "Standard relations (RO)", rel.length ? 2 : 0, 2, rel.length ? "imports RO" : "does not import the Relation Ontology");
    const cons = dash?.consistent ?? quality?.consistent;
    const unsat = dash?.unsatisfiable ?? quality?.unsatisfiable;
    const consSrc = dash?.consistent != null ? "OBO Dashboard" : quality?.consistent != null ? `ROBOT ${quality.reasoner || "ELK"} (NeuroSchema CI)` : null;
    add("quality", "Logical consistency", cons === true ? (unsat ? 2 : 6) : 0, 6, cons == null ? "never checked by a reasoner" : `${cons ? "consistent" : "INCONSISTENT"}${unsat ? `, ${unsat} unsatisfiable classes` : ", 0 unsatisfiable classes"} (${consSrc})`);
    const rr = dash?.robot || quality?.robot;
    if (rr) {
      const classes = dash?.classes || quality?.classes || facts.ols?.terms || 1;
      const dens = (rr.WARN || 0) / classes;
      add("quality", "ROBOT report: no errors", rr.ERROR ? 0 : 2, 2, `${rr.ERROR || 0} errors`);
      add("quality", "ROBOT report: warning density", T.warnDensity.find((t) => dens <= t.max).pts, 2, `${rr.WARN || 0} warnings / ${classes} classes = ${dens.toFixed(2)}`);
    } else {
      add("quality", "ROBOT report: no errors", 0, 2, "no ROBOT report available");
      add("quality", "ROBOT report: warning density", 0, 2, "no ROBOT report available");
    }
    const oops = facts.oops && !facts.oops.error ? facts.oops : null;
    if (oops) {
      add("quality", "OOPS!: no critical pitfalls", oops.critical ? 0 : 2, 2, `${oops.critical} critical pitfall types`);
      add("quality", "OOPS!: few important pitfalls", oops.important <= 2 ? 2 : 0, 2, `${oops.important} important pitfall types`);
    } else {
      qAvail -= 4;
      b.quality.notes.push("OOPS! unavailable — excluded and Q scaled");
    }
    if (qAvail < 20) {
      const raw = b.quality.score;
      b.quality.score = Math.round((raw * 20) / qAvail);
      b.quality.steps.push({ label: `Scaled ${raw}/${qAvail} → 20`, pts: b.quality.score - raw, max: 0, detail: "OOPS! pitfall scan unavailable for this run" });
    }
  } else {
    b.quality.applicable = false;
    b.quality.steps.push({ label: "Not applicable", pts: 0, max: 0, detail: `${entry.kind} without an OWL/OBO/RDF artefact; total scaled from 80 to 100` });
  }

  // M
  const last = lastActivity(facts);
  const m = last ? monthsSince(last) : Infinity;
  const rt = T.recency.find((s) => m <= s.upTo);
  add("maintenance", "Recency", rt.pts, 10, last ? `${last.slice(0, 10)} → ${m.toFixed(1)} months (${rt.label})` : "no activity evidence");
  const nRel = facts.releases?.lastYear ?? 0;
  add("maintenance", "Release cadence (12 months)", tier(T.cadence, nRel), 6, `${nRel} release${nRel === 1 ? "" : "s"}${facts.releases?.from ? ` (${facts.releases.from})` : ""}`);

  // U
  const nAd = adopters(entry, facts).length;
  add("adoption", "Documented adopting projects", tier(T.adopters, nAd), 7, `${nAd} project${nAd === 1 ? "" : "s"}`);
  add("adoption", "Reused by other ontologies", tier(T.reuse, reuse.length), 4, `${reuse.length}${reuse.length ? `: ${reuse.slice(0, 6).join(", ")}${reuse.length > 6 ? "…" : ""}` : ""}`);
  const stars = facts.github?.stars ?? 0;
  const cites = Math.max(0, ...(facts.citations || []).map((c) => c.count ?? 0));
  const sp = tier(T.stars, stars), cp = tier(T.citations, cites);
  add("adoption", "Community signal", Math.max(sp, cp), 5, `max(stars ${stars} → ${sp}, citations ${cites} → ${cp})`);

  // P
  const inactiveReason = facts.github?.archived ? "repository archived" : entry.status === "legacy" ? "marked legacy" : ["inactive", "orphaned", "obsolete"].includes(facts.obo?.status) ? `${facts.obo.status} in OBO Foundry` : facts.ols?.obsolete ? "marked obsolete in OLS" : null;
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

  for (const k of Object.keys(b)) b[k].notes.unshift(...b[k].steps.filter((s) => s.max > 0 && s.pts < s.max).map((s) => `${s.label}: ${s.detail}`));
  const earned = Object.entries(b).filter(([k]) => k !== "quality" || qApplies).reduce((s, [, x]) => s + x.score, 0);
  const possible = qApplies ? 100 : 100 - b.quality.max;
  const scaled = Math.round((earned * 100) / possible);
  const score = Math.max(0, scaled - pTotal);
  const fair = RUBRIC.filter((r) => r.fair).reduce((s, r) => s + b[r.key].score, 0);
  const grade = GRADES.find((g) => score >= g.min).grade;
  return {
    score, gross: scaled, earned, possible, qualityApplies: qApplies,
    penalty: { score: -pTotal, reason: pTotal ? pSteps.filter((x) => x.pts).map((x) => x.detail).join("; ") : `active (last activity ${last?.slice(0, 10)})`, steps: pSteps },
    grade, fair, breakdown: b, lastActivity: last, adopterCount: nAd, reuseCount: reuse.length, importCount: imp.length, registries: regs, evaluatedVersion: ver,
  };
}
