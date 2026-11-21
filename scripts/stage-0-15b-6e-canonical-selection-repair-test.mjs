import assert from "node:assert/strict";
import {
  createCanonicalEditorialCapabilitySnapshot,
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";

function capabilityResolutions(missingCapabilities, value) {
  const snapshot = createCanonicalEditorialCapabilitySnapshot(value);
  return missingCapabilities.map((capability) => {
    const claimId = capability === "demonstration" ? snapshot.demonstrationClaimId : snapshot.uncertaintyClaimId;
    const evidenceId = capability === "demonstration" ? snapshot.demonstrationEvidenceId : snapshot.uncertaintyEvidenceId;
    return { capability, outcome: claimId && evidenceId ? "resolved" : "not_found", claimId, evidenceId };
  });
}

const sources = ["source-a", "source-b", "source-c"].map((sourceId, index) => ({
  sourceId,
  adapterId: "fixture",
  mediaKind: "article",
  title: sourceId,
  publisher: "Fixture",
  publishedAt: null,
  summary: index === 0
    ? `${sourceId} grounded conceptual material.`
    : `Researchers asked 120 participants to compare records and found a measured difference for ${sourceId}.`,
  url: `https://example.test/${sourceId}`,
}));
const spans = sources.map((source, index) => ({
  spanId: `span-${index + 1}`,
  sourceId: source.sourceId,
  text: source.summary,
  evidenceSpecificity: index === 0 ? "abstract_or_conceptual" : "concrete_observation",
}));

function graph(authorities) {
  return {
    version: "0.10H-1B",
    sources,
    claims: authorities.map((item, index) => ({
      claimId: `claim-${index + 1}`,
      claimType: "FACT",
      text: item.claim,
    })),
    evidence: authorities.map((item, index) => ({
      evidenceId: `evidence-${index + 1}`,
      sourceId: item.sourceId,
      excerpt: item.excerpt,
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    })),
    links: authorities.map((_, index) => ({
      claimId: `claim-${index + 1}`,
      evidenceId: `evidence-${index + 1}`,
      stance: "supports",
    })),
  };
}

const collapsed = graph([{ claim: "One supported proposition", sourceId: "source-a", excerpt: sources[0].summary }]);
const healthy = graph([
  { claim: "One supported proposition", sourceId: "source-a", excerpt: sources[0].summary },
  { claim: "A distinct grounded finding", sourceId: "source-b", excerpt: sources[1].summary },
]);

async function run({ first = collapsed, repair = healthy, repairOutcome = "additions_found", failProvider = false, failValidation = false }) {
  let providerCalls = 0;
  let validationCalls = 0;
  let researchCalls = 0;
  const result = await repairCollapsedCanonicalEditorialSelection({
    candidateSpans: spans,
    sourceResearchPurposes: {},
    graph: first,
    requestRepair: async (input) => {
      providerCalls += 1;
      if (failProvider) throw new Error("provider failed");
      return { repairOutcome, capabilityResolutions: capabilityResolutions(input.missingCapabilities, repair), canonicalGraph: repair };
    },
    validateRepair: async (proposal) => {
      validationCalls += 1;
      if (failValidation) throw new Error("invalid or invented authority");
      return proposal;
    },
  });
  return { result, providerCalls, validationCalls, researchCalls };
}

const successful = await run({});
assert.equal(successful.providerCalls, 1, "observed collapse gets one repair call");
assert.equal(successful.result.diagnostic.repairAccepted, true);
assert.equal(successful.result.graph, healthy);
assert.equal(successful.result.diagnostic.distinctCandidateSourceCount, 3);
assert.equal(successful.result.diagnostic.concreteCandidateSpanCount, 2);

const stillCollapsed = await run({ repair: collapsed });
assert.equal(stillCollapsed.providerCalls, 1);
assert.equal(stillCollapsed.result.graph, collapsed);
assert.equal(stillCollapsed.result.diagnostic.reasonCode, "declared_additions_but_no_material_change");

const invalid = await run({ failValidation: true });
assert.equal(invalid.providerCalls, 1);
assert.equal(invalid.validationCalls, 1);
assert.equal(invalid.result.graph, collapsed);
assert.equal(invalid.result.diagnostic.reasonCode, "repair_invalid");

const healthyFirstPass = await run({ first: healthy });
assert.equal(healthyFirstPass.providerCalls, 0);
assert.equal(healthyFirstPass.result.graph, healthy);
assert.equal(healthyFirstPass.result.diagnostic.reasonCode, "not_pathologically_collapsed");

const genuineSingleClaim = await run({ repair: collapsed, repairOutcome: "no_qualifying_addition" });
assert.equal(genuineSingleClaim.result.graph, collapsed, "no diversity is forced");
assert.equal(genuineSingleClaim.providerCalls, 1);
assert.equal(genuineSingleClaim.result.diagnostic.reasonCode, "no_qualifying_addition");

const providerFailure = await run({ failProvider: true });
assert.equal(providerFailure.result.graph, collapsed);
assert.equal(providerFailure.result.diagnostic.reasonCode, "repair_provider_failed");
assert.equal(providerFailure.providerCalls, 1);

const duplicateAuthority = graph([
  { claim: "One supported proposition", sourceId: "source-a", excerpt: sources[0].summary },
  { claim: "One supported proposition", sourceId: "source-b", excerpt: sources[1].summary },
]);
const duplicate = await run({ repair: duplicateAuthority });
assert.equal(duplicate.result.graph, collapsed);
assert.equal(duplicate.result.diagnostic.reasonCode, "repair_not_materially_distinct");

for (const fixture of [successful, stillCollapsed, invalid, healthyFirstPass, genuineSingleClaim, providerFailure, duplicate]) {
  assert.equal(fixture.researchCalls, 0, "canonical-selection repair never expands research");
  assert.ok(fixture.providerCalls <= 1, "selection repair is bounded to one call");
}

console.log("Stage 0.15B.6E canonical selection repair: PASS");
