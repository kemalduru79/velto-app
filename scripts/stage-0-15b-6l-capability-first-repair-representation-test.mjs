import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCanonicalEditorialCapabilitySnapshot,
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";

const sources = [
  ["source-base", "Researchers documented a measured recall effect after a controlled procedure."],
  ["source-support", "A separate account supports the reconstructive model of memory."],
  ["source-limit", "Reconstructive memory may nevertheless produce tolerably accurate representations of the past."],
].map(([sourceId, summary]) => ({
  sourceId, adapterId: "academic", mediaKind: "paper", externalId: null,
  title: sourceId, url: `https://example.test/${sourceId}`, publisher: "Fixture",
  author: null, publishedAt: null, language: "en", summary,
  thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {},
}));
const candidateSpans = sources.map((source, index) => ({
  spanId: `span-${index + 1}`,
  sourceId: source.sourceId,
  text: source.summary,
  evidenceSpecificity: index === 0 ? "concrete_observation" : "abstract_or_conceptual",
}));
const sourceResearchPurposes = {
  "source-base": ["baseline"],
  "source-support": ["baseline", "counter_evidence"],
  "source-limit": ["counter_evidence"],
};

function baseGraph() {
  return {
    version: "0.10H-1B",
    sources,
    claims: [{ claimId: "claim-base", claimType: "FACT", text: "Memory is reconstructive." }],
    evidence: [{
      evidenceId: "evidence-base", sourceId: "source-base", excerpt: sources[0].summary,
      contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    }],
    links: [{ claimId: "claim-base", evidenceId: "evidence-base", stance: "supports" }],
  };
}

function contextualizedGraph() {
  const graph = baseGraph();
  graph.evidence.push({
    evidenceId: "evidence-limit", sourceId: "source-limit", excerpt: sources[2].summary,
    contextNote: "The exact span qualifies the scope of the base claim.",
    locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
  });
  graph.links.push({ claimId: "claim-base", evidenceId: "evidence-limit", stance: "contextualizes" });
  return graph;
}

function supportOnlyGraph() {
  const graph = baseGraph();
  graph.claims.push(
    { claimId: "claim-support-1", claimType: "FACT", text: "A separate source supports reconstruction." },
    { claimId: "claim-support-2", claimType: "FACT", text: "Another factual account supports reconstruction." },
  );
  graph.evidence.push(
    { evidenceId: "evidence-support-1", sourceId: "source-support", excerpt: sources[1].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } },
    { evidenceId: "evidence-support-2", sourceId: "source-limit", excerpt: sources[2].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } },
  );
  graph.links.push(
    { claimId: "claim-support-1", evidenceId: "evidence-support-1", stance: "supports" },
    { claimId: "claim-support-2", evidenceId: "evidence-support-2", stance: "supports" },
  );
  return graph;
}

async function run({
  candidate = contextualizedGraph(),
  outcome = "additions_found",
  resolutions = [{ capability: "uncertainty", outcome: "resolved", claimId: "claim-base", evidenceId: "evidence-limit" }],
  validateRepair = async (proposal) => proposal,
  first = baseGraph(),
} = {}) {
  let providerCalls = 0;
  let researchCalls = 0;
  const result = await repairCollapsedCanonicalEditorialSelection({
    candidateSpans,
    sourceResearchPurposes,
    graph: first,
    requestRepair: async () => {
      providerCalls += 1;
      return { repairOutcome: outcome, capabilityResolutions: resolutions, canonicalGraph: candidate };
    },
    validateRepair,
  });
  return { result, providerCalls, researchCalls };
}

const liveShape = await run();
assert.equal(liveShape.result.diagnostic.repairAccepted, true);
assert.equal(liveShape.result.graph.claims.length, 1, "contextualizing an existing claim needs no new claim");
assert.equal(createCanonicalEditorialCapabilitySnapshot(liveShape.result.graph).hasUncertaintyCapability, true);
assert.deepEqual(liveShape.result.diagnostic.validatedCapabilityResolutions, [{
  capability: "uncertainty", outcome: "resolved", claimId: "claim-base", evidenceId: "evidence-limit",
}]);

const observedLiveFailure = await run({
  candidate: supportOnlyGraph(),
  resolutions: [{ capability: "uncertainty", outcome: "not_found", claimId: null, evidenceId: null }],
});
assert.equal(observedLiveFailure.result.diagnostic.reasonCode, "requested_capability_not_resolved");
assert.equal(observedLiveFailure.result.graph.claims.length, 1);

const invalidDeclaration = await run({
  candidate: supportOnlyGraph(),
  resolutions: [{ capability: "uncertainty", outcome: "resolved", claimId: "claim-support-1", evidenceId: "evidence-support-1" }],
});
assert.equal(invalidDeclaration.result.diagnostic.reasonCode, "declared_resolution_invalid");

const falseContextualization = await run({
  validateRepair: async () => { throw new Error("unsupported contextualization"); },
});
assert.equal(falseContextualization.result.diagnostic.reasonCode, "repair_invalid");

const noMaterial = await run({
  candidate: baseGraph(),
  outcome: "no_qualifying_addition",
  resolutions: [{ capability: "uncertainty", outcome: "not_found", claimId: null, evidenceId: null }],
});
assert.equal(noMaterial.result.diagnostic.reasonCode, "no_qualifying_addition");

const theoretical = baseGraph();
theoretical.claims.push({ claimId: "claim-theory", claimType: "THEORY", text: "Accuracy may coexist with reconstruction." });
theoretical.evidence.push({ evidenceId: "evidence-theory", sourceId: "source-limit", excerpt: sources[2].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } });
theoretical.links.push({ claimId: "claim-theory", evidenceId: "evidence-theory", stance: "supports" });
const theoreticalResult = await run({
  candidate: theoretical,
  resolutions: [{ capability: "uncertainty", outcome: "resolved", claimId: "claim-theory", evidenceId: "evidence-theory" }],
});
assert.equal(theoreticalResult.result.diagnostic.repairAccepted, true);

const healthy = await run({ first: contextualizedGraph(), candidate: contextualizedGraph() });
assert.equal(healthy.providerCalls, 0);
assert.equal(healthy.result.diagnostic.reasonCode, "not_pathologically_collapsed");

for (const fixture of [liveShape, observedLiveFailure, invalidDeclaration, falseContextualization, noMaterial, theoreticalResult, healthy]) {
  assert.ok(fixture.providerCalls <= 1);
  assert.equal(fixture.researchCalls, 0);
}

const route = await readFile(new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url), "utf8");
assert.match(route, /resolving that capability is the primary repair objective/);
assert.match(route, /link it directly to that existing claim with contextualizes/);
assert.match(route, /capabilityResolutions/);
assert.match(route, /Do not mark ordinary support as contextualizes/);

console.log("Stage 0.15B.6L capability-first repair representation: PASS");
