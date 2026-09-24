import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCanonicalEditorialDiscoveryBundle,
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";

const sources = Array.from({ length: 9 }, (_, index) => ({
  sourceId: `source-${index + 1}`,
  adapterId: "fixture",
  mediaKind: "article",
  title: `Source ${index + 1}`,
  publisher: "Fixture",
  publishedAt: null,
  summary: index === 0
    ? "Grounded source 1 conceptual material."
    : `Researchers asked 120 participants to compare records and found a measured result for source ${index + 1}.`,
  url: `https://example.test/source-${index + 1}`,
}));

function graph(authorities) {
  return {
    version: "0.10H-1B",
    sources,
    claims: authorities.map((item, index) => ({
      claimId: item.claimId || `claim-${index + 1}`,
      claimType: item.claimType || "FACT",
      text: item.claim,
    })),
    evidence: authorities.map((item, index) => ({
      evidenceId: item.evidenceId || `evidence-${index + 1}`,
      sourceId: item.sourceId,
      excerpt: item.excerpt,
      contextNote: item.contextNote || null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    })),
    links: authorities.map((item, index) => ({
      claimId: item.claimId || `claim-${index + 1}`,
      evidenceId: item.evidenceId || `evidence-${index + 1}`,
      stance: item.stance || "supports",
    })),
  };
}

const baseAuthority = {
  claim: "Memory is reconstructive.",
  sourceId: "source-1",
  excerpt: sources[0].summary,
};
const base = graph([baseAuthority]);
const liveShapeSpans = sources.flatMap((source, sourceIndex) =>
  Array.from({ length: sourceIndex === 1 ? 40 : 3 }, (_, spanIndex) => ({
    spanId: `span-${sourceIndex + 1}-${spanIndex + 1}`,
    sourceId: source.sourceId,
    text: `${source.summary} Span ${spanIndex + 1}.`,
    evidenceSpecificity: spanIndex === 1
      ? "abstract_or_conceptual"
      : "concrete_observation",
  }))
);

const discovery = createCanonicalEditorialDiscoveryBundle({
  candidateSpans: liveShapeSpans,
  sourceResearchPurposes: {},
  graph: base,
});
assert.equal(discovery.spans.some((span) => span.sourceId === "source-1"), false);
assert.equal(new Set(discovery.spans.map((span) => span.sourceId)).size, 8);
assert.equal(discovery.spans.length, 24);
assert.equal(discovery.excludedAlreadyRepresentedSourceCount, 1);
const perSourceCount = new Map();
for (const span of discovery.spans) {
  perSourceCount.set(span.sourceId, (perSourceCount.get(span.sourceId) || 0) + 1);
}
assert.ok([...perSourceCount.values()].every((count) => count <= 3));
assert.ok(
  discovery.spans.some((span) =>
    span.evidenceSpecificity === "abstract_or_conceptual"
  ),
  "grounded uncertainty/context material remains discoverable",
);

const additionalAuthority = {
  claim: "A distinct grounded limitation applies.",
  sourceId: "source-2",
  excerpt: sources[1].summary,
  claimType: "RESEARCH_FINDING",
  contextNote: "A supplied boundary.",
};
const improved = graph([baseAuthority, additionalAuthority]);

async function run({ first = base, repaired = improved, repairOutcome = "additions_found" }) {
  let calls = 0;
  let repairInput = null;
  const result = await repairCollapsedCanonicalEditorialSelection({
    candidateSpans: liveShapeSpans,
    sourceResearchPurposes: {},
    graph: first,
    requestRepair: async (input) => {
      calls += 1;
      repairInput = input;
      return { repairOutcome, canonicalGraph: repaired };
    },
    validateRepair: async (proposal) => proposal,
  });
  return { result, calls, repairInput };
}

const successful = await run({});
assert.equal(successful.calls, 1);
assert.equal(successful.result.diagnostic.repairAccepted, true);
assert.equal(successful.result.graph, improved);
assert.equal(successful.repairInput.discoveryCandidateSpans.length, 24);
assert.deepEqual(successful.repairInput.representedSourceIds, ["source-1"]);
assert.equal(successful.result.diagnostic.discoveryDistinctSourceCount, 8);
assert.equal(successful.result.diagnostic.excludedAlreadyRepresentedSourceCount, 1);

const droppedBase = graph([{
  ...additionalAuthority,
  claimId: "claim-new-1",
  evidenceId: "evidence-new-1",
}]);
const baseDrop = await run({ repaired: droppedBase });
assert.equal(baseDrop.result.graph, base);
assert.equal(baseDrop.result.diagnostic.reasonCode, "repair_dropped_base");

const droppedBaseButDiverse = graph([
  { ...additionalAuthority, claimId: "claim-new-1", evidenceId: "evidence-new-1" },
  {
    claim: "Another unrelated authority.",
    sourceId: "source-3",
    excerpt: sources[2].summary,
    claimId: "claim-new-2",
    evidenceId: "evidence-new-2",
  },
]);
const diverseBaseDrop = await run({ repaired: droppedBaseButDiverse });
assert.equal(diverseBaseDrop.result.graph, base);
assert.equal(diverseBaseDrop.result.diagnostic.reasonCode, "repair_dropped_base");

const stillCollapsed = await run({ repaired: base });
assert.equal(stillCollapsed.calls, 1);
assert.equal(stillCollapsed.result.graph, base);
assert.equal(stillCollapsed.result.diagnostic.reasonCode, "declared_additions_but_no_material_change");

const noRealAddition = await run({ repaired: base, repairOutcome: "no_qualifying_addition" });
assert.equal(noRealAddition.result.diagnostic.repairAccepted, false);
assert.equal(noRealAddition.result.diagnostic.reasonCode, "no_qualifying_addition");
assert.equal(noRealAddition.calls, 1);

const healthy = graph([baseAuthority, additionalAuthority]);
const healthyFirstPass = await run({ first: healthy, repaired: healthy });
assert.equal(healthyFirstPass.calls, 0);
assert.equal(healthyFirstPass.result.graph, healthy);

const route = await readFile(
  new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /existingValidBaseGraph/);
assert.match(route, /discoveryCandidateSpans/);
assert.match(route, /Do not replace or drop the base graph/);
assert.doesNotMatch(
  route,
  /content: JSON\.stringify\(\{\s*\.\.\.userPrompt,\s*validFirstPass/,
  "repair no longer serializes the broad first-pass candidate environment",
);

console.log("Stage 0.15B.6F diversity-aware canonical repair: PASS");
