import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCreatorEvidencePromptPack,
  buildCreatorSectionEvidencePromptPack,
  CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS,
  selectCreatorEvidencePromptPackForClaims,
} from "../lib/research/creatorEvidencePack.ts";

const locator = { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null };
const routeSource = fs.readFileSync(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(routeSource, /const sectionEvidenceSelection = sectionNative[\s\S]*buildCreatorSectionEvidencePromptPack\(\{[\s\S]*section: requestedSections\[0\],[\s\S]*eligibleClaimIds: createSectionNativeEditorialContext/);
assert.match(routeSource, /CREATOR_SECTION_EVIDENCE_PROMPT_DIAGNOSTICS[\s\S]*sectionEvidenceSelection\.metrics/);
assert.match(routeSource, /evidenceMomentContext:[\s\S]*sectionEvidenceSelection!\.units/);
assert.match(routeSource, /const evidenceMomentPack = sectionNative[\s\S]*\? null[\s\S]*: buildCreatorEvidencePromptPack/);
assert.doesNotMatch(routeSource, /selectCreatorEvidencePromptPackForClaims\(\{[\s\S]*pack: evidenceMomentPack/);
assert.match(routeSource, /exactBlockingCode: "CREATOR_SCRIPT_GROUNDING_BLOCKED"[\s\S]*status: 422/);
const source = (index, overrides = {}) => ({
  sourceId: `source-${index}`,
  title: `Synthetic source ${index}`,
  url: `https://example.test/source-${index}`,
  publisher: "Synthetic Publisher",
  author: null,
  publishedAt: null,
  directness: "primary",
  reviewStatus: "usable",
  searchLane: "academic",
  sourceKind: "paper",
  ...overrides,
});
const evidence = (index, excerpt, overrides = {}) => ({
  evidenceId: `evidence-${index}`,
  sourceId: `source-${index}`,
  excerpt,
  contextNote: null,
  locator,
  ...overrides,
});
const claim = (index, overrides = {}) => ({
  claimId: `claim-${index}`,
  claimType: "RESEARCH_FINDING",
  text: `Synthetic claim ${index}`,
  supportingEvidenceIds: [`evidence-${index}`],
  counterEvidenceIds: [],
  contextualEvidenceIds: [],
  ...overrides,
});
const context = (claims, evidenceItems, sources) => ({
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Synthetic evidence must retain canonical identity and stance.",
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
const section = (id, kind, owns) => ({
  id,
  kind,
  ownershipBoundary: { owns, excludes: [] },
});

const syntheticClaims = Array.from({ length: 7 }, (_, index) => claim(index + 1));
syntheticClaims[5] = claim(6, { counterEvidenceIds: ["evidence-counter-6"] });
const concreteExcerpt = "Researchers assigned 120 synthetic participants to two documented conditions, measured the observed difference, and reported the bounded result.";
const syntheticEvidence = [
  ...Array.from({ length: 7 }, (_, index) => evidence(
    index + 1,
    index === 6 ? concreteExcerpt : `Synthetic documented observation ${index + 1}.`,
  )),
  {
    evidenceId: "evidence-counter-6",
    sourceId: "source-counter-6",
    excerpt: "A synthetic counter-analysis reported a narrower effect under its documented conditions.",
    contextNote: "Counter-evidence remains counter-evidence.",
    locator,
  },
];
const syntheticSources = [
  ...Array.from({ length: 7 }, (_, index) => source(index + 1)),
  source("counter-6"),
];
const syntheticContext = context(syntheticClaims, syntheticEvidence, syntheticSources);
const originalContextJson = JSON.stringify(syntheticContext);
const sections = [
  section("section-1", "opening", ["framing"]),
  section("section-2", "body", ["mechanism"]),
  section("section-3", "body", ["grounded_demonstration"]),
  section("section-4", "body", ["counterview"]),
  section("section-5", "conclusion", ["synthesis"]),
];
const eligibleBySection = new Map([
  ["section-1", ["claim-1", "claim-2"]],
  ["section-2", ["claim-3", "claim-4"]],
  ["section-3", ["claim-7"]],
  ["section-4", ["claim-6"]],
  ["section-5", ["claim-1", "claim-7"]],
]);

const globalFirstFive = buildCreatorEvidencePromptPack({ context: syntheticContext, maxUnits: 5 });
const baselineCoverage = Object.fromEntries(sections.map((item) => [
  item.id,
  selectCreatorEvidencePromptPackForClaims({
    pack: globalFirstFive,
    claimIds: eligibleBySection.get(item.id),
  }).length,
]));
const revisedSelections = Object.fromEntries(sections.map((item) => [
  item.id,
  buildCreatorSectionEvidencePromptPack({
    context: syntheticContext,
    section: item,
    eligibleClaimIds: eligibleBySection.get(item.id),
  }),
]));
const revisedCoverage = Object.fromEntries(sections.map((item) => [
  item.id,
  revisedSelections[item.id].units.length,
]));

assert.equal(baselineCoverage["section-3"], 0, "The old global-first-five projection drops eligible claim 7");
assert.equal(baselineCoverage["section-4"], 0, "The old global-first-five projection drops eligible claim 6");
assert.deepEqual(revisedSelections["section-3"].units.map((unit) => unit.claimId), ["claim-7"]);
assert.deepEqual(revisedSelections["section-4"].units.map((unit) => unit.claimId), ["claim-6"]);
assert.equal(revisedSelections["section-4"].units[0].counterEvidence[0].evidenceId, "evidence-counter-6");
assert.equal(revisedSelections["section-4"].units[0].counterEvidence[0].sourceId, "source-counter-6");
assert.deepEqual(revisedSelections["section-3"], buildCreatorSectionEvidencePromptPack({
  context: syntheticContext,
  section: sections[2],
  eligibleClaimIds: ["claim-7"],
}), "Section selection is deterministic");

const underFive = buildCreatorSectionEvidencePromptPack({
  context: syntheticContext,
  section: sections[1],
  eligibleClaimIds: ["claim-2", "claim-4", "claim-5"],
});
assert.deepEqual(underFive.units.map((unit) => unit.claimId), ["claim-2", "claim-4", "claim-5"]);

const prioritizedDemonstration = buildCreatorSectionEvidencePromptPack({
  context: syntheticContext,
  section: sections[2],
  eligibleClaimIds: syntheticClaims.map((item) => item.claimId),
});
assert.equal(prioritizedDemonstration.units[0].claimId, "claim-7", "Role-owned concrete evidence is prioritized before the unit budget");
assert.equal(prioritizedDemonstration.units.length, 5);
assert.equal(prioritizedDemonstration.metrics.omissionReasonCounts.unit_budget, 2);

const prioritizedCounterview = buildCreatorSectionEvidencePromptPack({
  context: syntheticContext,
  section: sections[3],
  eligibleClaimIds: syntheticClaims.map((item) => item.claimId),
});
assert.equal(prioritizedCounterview.units[0].claimId, "claim-6", "A supplied counterview is prioritized for its owning role");
assert.equal(prioritizedCounterview.units[0].counterEvidence.length, 1);
assert.equal(syntheticClaims[0].counterEvidenceIds.length, 0, "Absent counter-evidence is never invented");

const duplicateAndMissing = buildCreatorSectionEvidencePromptPack({
  context: syntheticContext,
  section: sections[0],
  eligibleClaimIds: ["claim-1", "claim-1", "unknown-claim"],
});
assert.deepEqual(duplicateAndMissing.units.map((unit) => unit.claimId), ["claim-1"]);
assert.equal(duplicateAndMissing.metrics.omissionReasonCounts.duplicate_eligible_claim_id, 1);
assert.equal(duplicateAndMissing.metrics.omissionReasonCounts.claim_not_in_canonical_context, 1);

const noEvidenceContext = context(
  [claim(1, { supportingEvidenceIds: [] })],
  [],
  [],
);
const noCompatibleEvidence = buildCreatorSectionEvidencePromptPack({
  context: noEvidenceContext,
  section: sections[1],
  eligibleClaimIds: ["claim-1"],
});
assert.deepEqual(noCompatibleEvidence.units, []);
assert.equal(noCompatibleEvidence.metrics.omissionReasonCounts.no_source_bound_evidence, 1);

const long = "x".repeat(2_000);
const characterClaims = Array.from({ length: 5 }, (_, index) => claim(index + 1, {
  text: `${index + 1} ${long}`,
  counterEvidenceIds: [`counter-${index + 1}`],
  contextualEvidenceIds: [`context-${index + 1}`],
}));
const characterEvidence = characterClaims.flatMap((_, index) => [
  evidence(index + 1, long, { contextNote: long }),
  { evidenceId: `counter-${index + 1}`, sourceId: `counter-source-${index + 1}`, excerpt: long, contextNote: long, locator },
  { evidenceId: `context-${index + 1}`, sourceId: `context-source-${index + 1}`, excerpt: long, contextNote: long, locator },
]);
const characterSources = characterClaims.flatMap((_, index) => [
  source(index + 1, { title: long, publisher: long, author: long }),
  source(`counter-${index + 1}`, { sourceId: `counter-source-${index + 1}`, title: long, publisher: long, author: long }),
  source(`context-${index + 1}`, { sourceId: `context-source-${index + 1}`, title: long, publisher: long, author: long }),
]);
const characterBounded = buildCreatorSectionEvidencePromptPack({
  context: context(characterClaims, characterEvidence, characterSources),
  section: sections[4],
  eligibleClaimIds: characterClaims.map((item) => item.claimId),
});
assert.ok(JSON.stringify(characterBounded.units).length <= CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS);
assert.ok(characterBounded.units.length < 5, "The existing 12K character budget remains fail-closed");
assert.ok(characterBounded.metrics.omissionReasonCounts.character_budget > 0);
assert.equal(JSON.stringify(syntheticContext), originalContextJson, "Selection does not mutate canonical context");

console.log("STAGE_5A_SECTION_EVIDENCE_COVERAGE", JSON.stringify({
  baselineCoverage,
  revisedCoverage,
  baselineTotalIncludedUnits: Object.values(baselineCoverage).reduce((sum, value) => sum + value, 0),
  revisedTotalIncludedUnits: Object.values(revisedCoverage).reduce((sum, value) => sum + value, 0),
  lateEligibleClaimsRecovered: ["claim-6", "claim-7"],
  unitBudgetOmissions: prioritizedDemonstration.metrics.omissionReasonCounts.unit_budget,
  characterBudgetOmissions: characterBounded.metrics.omissionReasonCounts.character_budget,
}, null, 2));
console.log("STAGE_5A_SECTION_AWARE_EVIDENCE_ROUTING=PASS");
