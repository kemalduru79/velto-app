import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorLongFormEvidenceReadiness,
  createCreatorScriptSectionClaimRouting,
} from "../lib/research/creatorLongFormEvidenceReadiness.ts";
import {
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContract,
  shouldUseCreatorScriptSectionNativeGeneration,
} from "../lib/creator/creatorScript.ts";

const source = (id) => ({
  sourceId: id,
  title: `Source ${id}`,
  url: `https://example.com/${id}`,
  publisher: "Example",
  author: null,
  publishedAt: null,
  directness: "secondary",
  reviewStatus: "usable",
  searchLane: "web",
  sourceKind: "article",
});
const evidence = (id, sourceId, excerpt) => ({
  evidenceId: id,
  sourceId,
  excerpt,
  contextNote: null,
  locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
});
const claim = (id, claimType, supportingEvidenceIds, options = {}) => ({
  claimId: id,
  claimType,
  text: `Claim ${id}`,
  supportingEvidenceIds,
  counterEvidenceIds: options.counterEvidenceIds || [],
  contextualEvidenceIds: options.contextualEvidenceIds || [],
});
const context = ({ claims, evidence: evidenceItems, sources }) => ({
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Ground claims.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims,
  evidence: evidenceItems,
  sources,
});

const duration = getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 0 });
const sectionNative = shouldUseCreatorScriptSectionNativeGeneration(duration.targetWordCount);
const limitsPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 960, language: "en", hasMaterialCounterview: false });
const counterPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 960, language: "en", hasMaterialCounterview: true });
assert.equal(sectionNative, true);
assert.equal(limitsPlan.filter((section) => section.kind === "body").length, 6);

const abstract = "Human memory reconstructs past experience from distributed fragments and existing schemas.";
const observedContext = context({
  claims: [claim("claim-1", "FACT", ["evidence-1"])],
  evidence: [evidence("evidence-1", "source-1", abstract)],
  sources: [source("source-1")],
});
const observed = createCreatorLongFormEvidenceReadiness({ context: observedContext, plan: limitsPlan, sectionNative });
assert.equal(observed.eligible, false);
assert.deepEqual(observed.fallbackBodySectionIds, ["section-2", "section-3", "section-4", "section-5", "section-6"]);
assert.ok(observed.reasonCodes.includes("missing_grounded_demonstration_capability"));
assert.ok(observed.reasonCodes.includes("missing_uncertainty_capability"));
assert.ok(observed.reasonCodes.includes("collapsed_body_authority"));

const rawSourcesDoNotCount = createCreatorLongFormEvidenceReadiness({
  context: { ...observedContext, sources: Array.from({ length: 8 }, (_, index) => source(`source-${index + 1}`)) },
  plan: limitsPlan,
  sectionNative,
});
assert.deepEqual(rawSourcesDoNotCount.reasonCodes, observed.reasonCodes);

const concreteExcerpt = "Researchers asked 120 adults to recall an event after exposure to conflicting details; later reports differed from the original record.";
const contextualExcerpt = "The reported comparison applied only under the documented procedure and did not establish that every recollection changes.";
const empiricalClaims = [
  claim("c1", "FACT", ["e1"]),
  claim("c2", "FACT", ["e2"]),
  claim("c3", "RESEARCH_FINDING", ["e3"]),
  claim("c4", "THEORY", ["e4"], { contextualEvidenceIds: ["e5"] }),
  claim("c5", "FACT", ["e6"]),
  claim("c6", "FACT", ["e7"]),
];
const empiricalContext = context({
  claims: empiricalClaims,
  evidence: [
    evidence("e1", "s1", abstract), evidence("e2", "s2", abstract),
    evidence("e3", "s3", concreteExcerpt), evidence("e4", "s4", abstract),
    evidence("e5", "s5", contextualExcerpt), evidence("e6", "s6", abstract),
    evidence("e7", "s7", abstract),
  ],
  sources: Array.from({ length: 7 }, (_, index) => source(`s${index + 1}`)),
});
const empirical = createCreatorLongFormEvidenceReadiness({ context: empiricalContext, plan: limitsPlan, sectionNative });
assert.equal(empirical.eligible, true);

const noConcreteContext = context({
  ...empiricalContext,
  claims: empiricalClaims,
  evidence: empiricalContext.evidence.map((item) => item.evidenceId === "e3" ? evidence("e3", "s3", abstract) : item),
  sources: empiricalContext.sources,
});
assert.deepEqual(
  createCreatorLongFormEvidenceReadiness({ context: noConcreteContext, plan: limitsPlan, sectionNative }).reasonCodes,
  ["missing_grounded_demonstration_capability"],
);

const conceptualClaims = [
  claim("t1", "THEORY", ["te1"]), claim("t2", "THEORY", ["te2"]),
  claim("t3", "THEORY", ["te3"]), claim("t4", "HYPOTHESIS", ["te4"]),
  claim("t5", "EDITORIAL_INFERENCE", ["te5"]), claim("t6", "METAPHYSICAL_CLAIM", ["te6"]),
];
const conceptualContext = context({
  claims: conceptualClaims,
  evidence: conceptualClaims.map((item, index) => evidence(`te${index + 1}`, `ts${index + 1}`, "A traceable documented argument develops the concept and preserves its uncertainty.")),
  sources: conceptualClaims.map((_, index) => source(`ts${index + 1}`)),
});
assert.equal(createCreatorLongFormEvidenceReadiness({ context: conceptualContext, plan: limitsPlan, sectionNative }).eligible, true);

const reusedClaims = empiricalClaims.slice(0, 5);
const reusedContext = context({
  claims: reusedClaims,
  evidence: empiricalContext.evidence,
  sources: empiricalContext.sources,
});
const reused = createCreatorLongFormEvidenceReadiness({ context: reusedContext, plan: limitsPlan, sectionNative });
assert.equal(createCreatorScriptSectionClaimRouting({ context: reusedContext, plan: limitsPlan }).at(-2).usedFallback, true);
assert.equal(reused.eligible, true, "fallback claim reuse remains valid when differentiated authority exists");

const counterMissing = createCreatorLongFormEvidenceReadiness({ context: empiricalContext, plan: counterPlan, sectionNative });
assert.ok(counterMissing.reasonCodes.includes("missing_counterview_capability"));
const counterClaims = empiricalClaims.map((item, index) => index === 3 ? { ...item, counterEvidenceIds: ["e5"], contextualEvidenceIds: [] } : item);
const counterReady = createCreatorLongFormEvidenceReadiness({
  context: context({ claims: counterClaims, evidence: empiricalContext.evidence, sources: empiricalContext.sources }),
  plan: counterPlan,
  sectionNative,
});
assert.equal(counterReady.eligible, true);

const shortPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 300, language: "en", hasMaterialCounterview: false });
const shortDuration = getCreatorScriptDurationContract({ targetDurationSec: 300, language: "en", actualWordCount: 0 });
const short = createCreatorLongFormEvidenceReadiness({
  context: observedContext,
  plan: shortPlan,
  sectionNative: shouldUseCreatorScriptSectionNativeGeneration(shortDuration.targetWordCount),
});
assert.equal(short.applicable, false);
assert.equal(short.eligible, true);

const route = fs.readFileSync(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /createCreatorLongFormEvidenceReadiness/);
assert.match(route, /scriptProviderDispatched: false/);
assert.match(route, /code: "CREATOR_SCRIPT_GROUNDING_BLOCKED"/);
assert.ok(route.indexOf("createCreatorLongFormEvidenceReadiness({") < route.indexOf("const createInitialResponse"));

console.log("Stage 0.15B.6B long-form evidence readiness regression passed.");
