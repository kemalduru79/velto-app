import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCanonicalEditorialCapabilitySnapshot,
  createCanonicalEditorialDiscoveryBundle,
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";

const sources = [
  ["source-base", "Researchers observed a measured recall difference after a documented procedure."],
  ["source-dual", "The main account is supported by ordinary background material."],
  ["source-limit", "The finding applied only under the documented conditions and did not establish that all memories change."],
  ["source-baseline", "A separate source supplies ordinary supporting background."],
].map(([sourceId, summary]) => ({
  sourceId,
  adapterId: "academic",
  mediaKind: "paper",
  title: sourceId,
  url: `https://example.test/${sourceId}`,
  publisher: "Fixture",
  author: null,
  publishedAt: null,
  language: "en",
  summary,
  thumbnailUrl: null,
  durationSec: null,
  externalId: null,
  metrics: {},
  sourceMetadata: {},
}));

const candidateSpans = [
  {
    spanId: "span-dual-support",
    sourceId: "source-dual",
    text: "The main account is supported by ordinary background material.",
    evidenceSpecificity: "abstract_or_conceptual",
  },
  {
    spanId: "span-dual-boundary",
    sourceId: "source-dual",
    text: "A later passage limits the account to a narrowly documented setting.",
    evidenceSpecificity: "abstract_or_conceptual",
  },
  {
    spanId: "span-limit",
    sourceId: "source-limit",
    text: sources[2].summary,
    evidenceSpecificity: "abstract_or_conceptual",
  },
  {
    spanId: "span-baseline",
    sourceId: "source-baseline",
    text: sources[3].summary,
    evidenceSpecificity: "abstract_or_conceptual",
  },
];
const sourceResearchPurposes = {
  "source-base": ["baseline"],
  "source-dual": ["baseline", "counter_evidence"],
  "source-limit": ["counter_evidence"],
  "source-baseline": ["baseline"],
};

assert.ok(candidateSpans.every((span) => !Object.hasOwn(span, "researchPurposes")));

function graph({ includeLimit = false, includeOrdinarySupport = false } = {}) {
  const claims = [{
    claimId: "claim-base",
    claimType: "RESEARCH_FINDING",
    text: "A measured recall difference was observed.",
  }];
  const evidence = [{
    evidenceId: "evidence-base",
    sourceId: "source-base",
    excerpt: sources[0].summary,
    contextNote: null,
    locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
  }];
  const links = [{ claimId: "claim-base", evidenceId: "evidence-base", stance: "supports" }];
  if (includeOrdinarySupport) {
    claims.push({
      claimId: "claim-support",
      claimType: "FACT",
      text: "Ordinary background supports the main account.",
    });
    evidence.push({
      evidenceId: "evidence-support",
      sourceId: "source-dual",
      excerpt: candidateSpans[0].text,
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    });
    links.push({ claimId: "claim-support", evidenceId: "evidence-support", stance: "supports" });
  }
  if (includeLimit) {
    claims.push({
      claimId: "claim-limit",
      claimType: "FACT",
      text: "The measured finding has a documented scope boundary.",
    });
    evidence.push({
      evidenceId: "evidence-limit",
      sourceId: "source-limit",
      excerpt: sources[2].summary,
      contextNote: "The exact source text limits the finding's scope.",
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    });
    links.push({ claimId: "claim-limit", evidenceId: "evidence-limit", stance: "contextualizes" });
  }
  return { version: "0.10H-1B", sources, claims, evidence, links };
}

const base = graph();
const completed = graph({ includeLimit: true });
const completedCapabilities = createCanonicalEditorialCapabilitySnapshot(completed);
const discovery = createCanonicalEditorialDiscoveryBundle({
  candidateSpans,
  sourceResearchPurposes,
  missingCapabilities: ["uncertainty"],
  graph: base,
});
assert.deepEqual(
  discovery.spans.slice(0, 3).map((span) => span.spanId),
  ["span-dual-support", "span-limit", "span-baseline"],
  "counter-purpose sources are ordered first, while their first span is not semantically replaced by an arbitrary counter seed",
);
assert.equal(discovery.spans.some((span) => span.spanId === "span-dual-boundary"), true);

let providerCalls = 0;
let researchCalls = 0;
let capturedRepairInput = null;
const repaired = await repairCollapsedCanonicalEditorialSelection({
  candidateSpans,
  sourceResearchPurposes,
  graph: base,
  requestRepair: async (input) => {
    providerCalls += 1;
    capturedRepairInput = input;
    return {
      repairOutcome: "additions_found",
      capabilityResolutions: [{
        capability: "uncertainty",
        outcome: "resolved",
        claimId: completedCapabilities.uncertaintyClaimId,
        evidenceId: completedCapabilities.uncertaintyEvidenceId,
      }],
      canonicalGraph: completed,
    };
  },
  validateRepair: async (proposal) => proposal,
});
assert.equal(providerCalls, 1);
assert.equal(researchCalls, 0);
assert.equal(repaired.diagnostic.repairAccepted, true);
assert.equal(createCanonicalEditorialCapabilitySnapshot(repaired.graph).hasUncertaintyCapability, true);
assert.equal(
  capturedRepairInput.discoveryCandidateSpans.some((span) => Object.hasOwn(span, "researchPurposes")),
  false,
);
assert.equal(repaired.diagnostic.counterPurposeSourceCount, 2);
assert.equal(repaired.diagnostic.discoveryFromCounterPurposeSourceCount, 3);

const ordinarySupportOnly = await repairCollapsedCanonicalEditorialSelection({
  candidateSpans,
  sourceResearchPurposes,
  graph: base,
  requestRepair: async () => {
    providerCalls += 1;
    return {
      repairOutcome: "no_qualifying_addition",
      capabilityResolutions: [{ capability: "uncertainty", outcome: "not_found", claimId: null, evidenceId: null }],
      canonicalGraph: base,
    };
  },
  validateRepair: async (proposal) => proposal,
});
assert.equal(ordinarySupportOnly.graph, base);
assert.equal(ordinarySupportOnly.diagnostic.reasonCode, "no_qualifying_addition");
assert.equal(createCanonicalEditorialCapabilitySnapshot(ordinarySupportOnly.graph).hasUncertaintyCapability, false);

const unsupportedUncertainty = await repairCollapsedCanonicalEditorialSelection({
  candidateSpans,
  sourceResearchPurposes,
  graph: base,
  requestRepair: async () => ({
    repairOutcome: "additions_found",
    capabilityResolutions: [{ capability: "uncertainty", outcome: "not_found", claimId: null, evidenceId: null }],
    canonicalGraph: graph({ includeOrdinarySupport: true }),
  }),
  validateRepair: async (proposal) => proposal,
});
assert.equal(unsupportedUncertainty.graph, base);
assert.equal(unsupportedUncertainty.diagnostic.reasonCode, "requested_capability_not_resolved");
assert.equal(unsupportedUncertainty.diagnostic.afterHasUncertaintyCapability, false);

const healthy = await repairCollapsedCanonicalEditorialSelection({
  candidateSpans,
  sourceResearchPurposes,
  graph: completed,
  requestRepair: async () => {
    providerCalls += 1;
    throw new Error("healthy graph must not dispatch repair");
  },
  validateRepair: async (proposal) => proposal,
});
assert.equal(healthy.diagnostic.repairProviderDispatched, false);
assert.equal(healthy.diagnostic.reasonCode, "not_pathologically_collapsed");

const route = await readFile(
  new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /discoverySources: sourceMaterial\.filter/);
assert.match(route, /discoveryCandidateSpans,/);
assert.match(route, /Research purpose describes why the SOURCE was retrieved/);
assert.match(route, /source provenance never establishes stance/);
assert.ok(!route.includes("researchPurposes: normalized.sourceResearchPurposes[span.sourceId]"));

console.log("Stage 0.15B.6K source-purpose/span-semantics separation: PASS");
