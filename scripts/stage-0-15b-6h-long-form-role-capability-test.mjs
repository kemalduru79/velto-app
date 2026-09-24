import assert from "node:assert/strict";
import {
  createCanonicalEditorialCapabilitySnapshot,
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";
import {
  createCreatorLongFormEvidenceCapabilityEvaluation,
  createCreatorLongFormEvidenceReadiness,
  createCreatorScriptSectionClaimRouting,
} from "../lib/research/creatorLongFormEvidenceReadiness.ts";
import {
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContract,
  shouldUseCreatorScriptSectionNativeGeneration,
} from "../lib/creator/creatorScript.ts";

const sources = Array.from({ length: 9 }, (_, index) => ({
  sourceId: `source-${index + 1}`,
  adapterId: "academic",
  mediaKind: "paper",
  externalId: null,
  title: `Source ${index + 1}`,
  url: `https://example.test/source-${index + 1}`,
  publisher: "Fixture",
  author: null,
  publishedAt: null,
  language: "en",
  summary: index === 1
    ? "Researchers asked 120 participants to compare records and found a measured difference after the procedure."
    : `Grounded source ${index + 1} material with documented scope.`,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
}));
const abstractExcerpt = sources[0].summary;
const concreteExcerpt = sources[1].summary;
const limitExcerpt = "The reported comparison applied only under the documented procedure and did not establish that every recollection changes.";
sources[2] = { ...sources[2], summary: limitExcerpt };

function graph({ includeDemo = false, includeUncertainty = false, extraFacts = 0 }) {
  const claims = [{ claimId: "claim-base", claimType: "FACT", text: "Memory is reconstructive." }];
  const evidence = [{
    evidenceId: "evidence-base",
    sourceId: "source-1",
    excerpt: abstractExcerpt,
    contextNote: null,
    locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
  }];
  const links = [{ claimId: "claim-base", evidenceId: "evidence-base", stance: "supports" }];
  if (includeDemo) {
    claims.push({ claimId: "claim-demo", claimType: "RESEARCH_FINDING", text: "A procedure produced a measured recall difference." });
    evidence.push({
      evidenceId: "evidence-demo",
      sourceId: "source-2",
      excerpt: concreteExcerpt,
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    });
    links.push({ claimId: "claim-demo", evidenceId: "evidence-demo", stance: "supports" });
  }
  if (includeUncertainty) {
    claims.push({ claimId: "claim-limit", claimType: "FACT", text: "The finding has a documented scope boundary." });
    evidence.push({
      evidenceId: "evidence-limit",
      sourceId: "source-3",
      excerpt: limitExcerpt,
      contextNote: "The supplied procedure bounds the result.",
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    });
    links.push({ claimId: "claim-limit", evidenceId: "evidence-limit", stance: "contextualizes" });
  }
  for (let index = 0; index < extraFacts; index += 1) {
    const number = index + 4;
    claims.push({ claimId: `claim-${number}`, claimType: "FACT", text: `Distinct grounded fact ${number}.` });
    evidence.push({
      evidenceId: `evidence-${number}`,
      sourceId: `source-${number}`,
      excerpt: sources[number - 1].summary,
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    });
    links.push({ claimId: `claim-${number}`, evidenceId: `evidence-${number}`, stance: "supports" });
  }
  return { version: "0.10H-1B", sources, claims, evidence, links };
}

const candidates = Array.from({ length: 120 }, (_, index) => {
  const sourceIndex = index % sources.length;
  const source = sources[sourceIndex];
  return {
    spanId: `span-${index + 1}`,
    sourceId: source.sourceId,
    text: source.summary,
    evidenceSpecificity: sourceIndex === 1 ? "concrete_observation" : "abstract_or_conceptual",
    researchPurposes: sourceIndex === 2 ? ["counter_evidence"] : ["baseline"],
  };
});

async function runRepair({ before, after = before, repairOutcome = "additions_found", failProvider = false }) {
  let providerCalls = 0;
  let researchCalls = 0;
  let request = null;
  const result = await repairCollapsedCanonicalEditorialSelection({
    candidateSpans: candidates,
    graph: before,
    requestRepair: async (input) => {
      providerCalls += 1;
      request = input;
      if (failProvider) throw new Error("provider unavailable");
      return { repairOutcome, canonicalGraph: after };
    },
    validateRepair: async (proposal) => proposal,
  });
  return { result, providerCalls, researchCalls, request };
}

function contextFromGraph(value) {
  return {
    version: "0.10H-2H",
    sourceVersion: "0.10H-2E",
    editorialConstitution: "Ground every claim.",
    readiness: {
      status: "ready",
      editorialReadinessScore: 100,
      reviewReasons: [],
      primarySourceRequiredClaimIds: [],
      primarySourceCoveredClaimIds: [],
    },
    claims: value.claims.map((claim) => ({
      ...claim,
      supportingEvidenceIds: value.links.filter((link) =>
        link.claimId === claim.claimId && link.stance === "supports"
      ).map((link) => link.evidenceId),
      contextualEvidenceIds: value.links.filter((link) =>
        link.claimId === claim.claimId && link.stance === "contextualizes"
      ).map((link) => link.evidenceId),
      counterEvidenceIds: value.links.filter((link) =>
        link.claimId === claim.claimId && link.stance === "contradicts"
      ).map((link) => link.evidenceId),
    })),
    evidence: value.evidence,
    sources: value.sources.map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      author: source.author,
      publishedAt: source.publishedAt,
      directness: "secondary",
      reviewStatus: "usable",
      searchLane: source.adapterId,
      sourceKind: source.mediaKind,
    })),
  };
}

const duration = getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 0 });
const sectionNative = shouldUseCreatorScriptSectionNativeGeneration(duration.targetWordCount);
const plan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 960,
  language: "en",
  hasMaterialCounterview: false,
});

const latestShape = await runRepair({
  before: graph({}),
  after: graph({ includeDemo: true, includeUncertainty: true, extraFacts: 5 }),
});
assert.equal(latestShape.providerCalls, 1);
assert.deepEqual(latestShape.result.diagnostic.repairTriggerReasons, [
  "canonical_collapse",
  "missing_demonstration",
  "missing_uncertainty",
]);
assert.deepEqual(latestShape.request.missingCapabilities, ["demonstration", "uncertainty"]);
assert.equal(latestShape.result.diagnostic.repairAccepted, true);
assert.equal(latestShape.result.diagnostic.afterHasDemonstrationCapability, true);
assert.equal(latestShape.result.diagnostic.afterHasUncertaintyCapability, true);
const latestContext = contextFromGraph(latestShape.result.graph);
const latestRouting = createCreatorScriptSectionClaimRouting({ context: latestContext, plan });
assert.ok(latestRouting.find((route) => route.sectionId === "section-3").claimIds.includes("claim-demo"));
assert.ok(latestRouting.find((route) => route.sectionId === "section-4").claimIds.includes("claim-limit"));
assert.equal(createCreatorLongFormEvidenceReadiness({ context: latestContext, plan, sectionNative }).eligible, true);

const wrongRouteContext = contextFromGraph(graph({ includeDemo: true, includeUncertainty: true, extraFacts: 5 }));
const wrongRouteEvaluation = createCreatorLongFormEvidenceCapabilityEvaluation({ context: wrongRouteContext, plan });
assert.equal(wrongRouteEvaluation.hasGroundedDemonstrationCapability, true);
assert.equal(wrongRouteEvaluation.hasUncertaintyCapability, true);
assert.equal((await runRepair({ before: graph({ includeDemo: true, includeUncertainty: true, extraFacts: 5 }) })).providerCalls, 0);

const diverseMissingUncertainty = await runRepair({
  before: graph({ includeDemo: true, extraFacts: 3 }),
  after: graph({ includeDemo: true, includeUncertainty: true, extraFacts: 3 }),
});
assert.deepEqual(diverseMissingUncertainty.result.diagnostic.repairTriggerReasons, ["missing_uncertainty"]);
assert.equal(diverseMissingUncertainty.result.diagnostic.repairAccepted, true);

const noRealLimit = await runRepair({
  before: graph({ includeDemo: true, extraFacts: 3 }),
  after: graph({ includeDemo: true, extraFacts: 4 }),
});
assert.equal(noRealLimit.result.diagnostic.repairAccepted, false);
assert.equal(noRealLimit.result.diagnostic.reasonCode, "repair_target_capability_unsatisfied");

const supportingCounter = graph({ includeDemo: true, extraFacts: 3 });
assert.equal(createCanonicalEditorialCapabilitySnapshot(supportingCounter).hasUncertaintyCapability, false);
const supportingCounterResult = await runRepair({ before: supportingCounter, after: supportingCounter });
assert.equal(supportingCounterResult.result.graph, supportingCounter);

const providerFailure = await runRepair({ before: graph({}), failProvider: true });
assert.equal(providerFailure.result.graph.claims.length, 1);
assert.equal(providerFailure.result.diagnostic.reasonCode, "repair_provider_failed");

for (const fixture of [latestShape, diverseMissingUncertainty, noRealLimit, supportingCounterResult, providerFailure]) {
  assert.ok(fixture.providerCalls <= 1, "only one combined repair call is possible");
  assert.equal(fixture.researchCalls, 0, "capability completion performs no research expansion");
}

console.log("Stage 0.15B.6H long-form role capability completion: PASS");
