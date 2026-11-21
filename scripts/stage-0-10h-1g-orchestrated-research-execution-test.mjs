import assert from "node:assert/strict";
import {
  canonicalResearchUrl,
  executeResearchOrchestration,
  ResearchOrchestrationError,
} from "../lib/research/orchestratedResearch.ts";
import { createResearchOrchestrationPlan } from "../lib/research/researchOrchestration.ts";

const source = (id, url, title = id, overrides = {}) => ({
  sourceId: id,
  adapterId: "web",
  mediaKind: "webpage",
  externalId: id,
  title,
  url,
  publisher: "example.org",
  author: null,
  publishedAt: null,
  language: "en",
  summary: null,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
  ...overrides,
});

assert.equal(
  canonicalResearchUrl("https://example.org/a/?utm_source=x&b=2&a=1#section"),
  "https://example.org/a?a=1&b=2",
);

const plan = createResearchOrchestrationPlan({
  subject: "automation and work",
  claimType: "FORECAST",
});

let callIndex = 0;
let activeCalls = 0;
let maxActiveCalls = 0;
const provider = {
  async search(input) {
    activeCalls += 1;
    maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const index = callIndex++;
    activeCalls -= 1;

    if (index === 0) {
      return {
        sources: [source("web:a", "https://example.org/a?utm_source=baseline")],
        providerRequestId: "req-1",
        providerCostUsd: 0.01,
      };
    }
    if (index === 1) {
      return {
        sources: [source("academic:a", "https://example.org/a"), source("academic:b", "https://example.org/b")],
        providerRequestId: "req-2",
        providerCostUsd: 0.02,
      };
    }
    if (index === 2) {
      return {
        sources: [source("academic:c", "https://example.org/c")],
        providerRequestId: "req-3",
        providerCostUsd: null,
      };
    }
    return {
      sources: [source("news:d", "https://example.org/d")],
      providerRequestId: "req-4",
      providerCostUsd: 0.03,
    };
  },
};

const result = await executeResearchOrchestration({ plan, provider });
assert.equal(result.version, "0.10H-1G");
assert.equal(maxActiveCalls, 1, "research lanes must execute sequentially");
assert.equal(result.lanes.length, plan.lanes.length);
assert.equal(result.sources.length, 4, "overlapping canonical URLs must deduplicate");
assert.equal(result.economics.providerRequestCount, plan.lanes.length);
assert.equal(result.economics.knownProviderCostUsd, 0.06);
assert.equal(result.economics.costComplete, false);
assert.equal(result.lanes[0].sourceIds[0], result.lanes[1].sourceIds[0]);

const duplicatePlan = {
  version: "0.10H-1F",
  subject: "topic",
  claimType: "PRIMARY_SOURCE_CLAIM",
  lanes: [
    { laneId: "baseline", purpose: "baseline", required: true, input: { query: "topic", category: "web", maxResults: 5 } },
    { laneId: "primary-transcript-interview", purpose: "primary_source", required: true, input: { query: "topic transcript interview", category: "primary", maxResults: 5 } },
  ],
};

let upgradeCall = 0;
const upgraded = await executeResearchOrchestration({
  plan: duplicatePlan,
  provider: {
    async search() {
      upgradeCall += 1;
      return {
        sources: upgradeCall === 1
          ? [source("web:duplicate", "https://example.org/transcript?utm_source=baseline", "Commentary")]
          : [source("primary:duplicate", "https://example.org/transcript", "Direct transcript", {
              adapterId: "primary",
              sourceMetadata: { provenanceVerified: true, provenanceKind: "direct_transcript" },
            })],
        providerRequestId: `upgrade-${upgradeCall}`,
        providerCostUsd: 0.01,
      };
    },
  },
});
assert.equal(upgraded.sources.length, 1);
assert.equal(upgraded.sources[0].sourceId, "web:duplicate");
assert.equal(upgraded.sources[0].title, "Direct transcript");
assert.equal(upgraded.sources[0].sourceMetadata.provenanceVerified, true);
assert.equal(upgraded.lanes[0].sourceIds[0], upgraded.lanes[1].sourceIds[0]);

let downgradeCall = 0;
const notDowngraded = await executeResearchOrchestration({
  plan: duplicatePlan,
  provider: {
    async search() {
      downgradeCall += 1;
      return {
        sources: downgradeCall === 1
          ? [source("web:verified", "https://example.org/transcript", "Direct transcript", {
              sourceMetadata: { provenanceVerified: true, provenanceKind: "direct_transcript" },
            })]
          : [source("primary:unverified", "https://example.org/transcript", "Primary-lane commentary", {
              adapterId: "primary",
            })],
        providerRequestId: `downgrade-${downgradeCall}`,
        providerCostUsd: 0.01,
      };
    },
  },
});
assert.equal(notDowngraded.sources.length, 1);
assert.equal(notDowngraded.sources[0].title, "Direct transcript");
assert.equal(notDowngraded.sources[0].sourceMetadata.provenanceVerified, true);

let intentOnlyCall = 0;
const primaryIntentDoesNotUpgrade = await executeResearchOrchestration({
  plan: duplicatePlan,
  provider: {
    async search() {
      intentOnlyCall += 1;
      return {
        sources: intentOnlyCall === 1
          ? [source("web:unverified", "https://example.org/commentary", "Baseline commentary")]
          : [source("primary:unverified", "https://example.org/commentary", "Primary-lane commentary", {
              adapterId: "primary",
            })],
        providerRequestId: `intent-only-${intentOnlyCall}`,
        providerCostUsd: 0.01,
      };
    },
  },
});
assert.equal(primaryIntentDoesNotUpgrade.sources.length, 1);
assert.equal(primaryIntentDoesNotUpgrade.sources[0].title, "Baseline commentary");
assert.equal(
  primaryIntentDoesNotUpgrade.sources[0].sourceMetadata.provenanceVerified,
  undefined,
);

const optionalFailurePlan = {
  version: "0.10H-1F",
  subject: "topic",
  claimType: null,
  lanes: [
    {
      laneId: "optional-context",
      purpose: "recent_context",
      required: false,
      input: { query: "topic latest", category: "news", maxResults: 2 },
    },
  ],
};
const optionalFailure = await executeResearchOrchestration({
  plan: optionalFailurePlan,
  provider: { async search() { throw new Error("temporary provider issue"); } },
});
assert.equal(optionalFailure.lanes[0].status, "failed");
assert.equal(optionalFailure.economics.costComplete, false);

const requiredFailurePlan = {
  ...optionalFailurePlan,
  lanes: [{ ...optionalFailurePlan.lanes[0], required: true, laneId: "required-lane" }],
};
await assert.rejects(
  () => executeResearchOrchestration({
    plan: requiredFailurePlan,
    provider: { async search() { throw new Error("required search failed"); } },
  }),
  (error) => error instanceof ResearchOrchestrationError && error.laneId === "required-lane",
);

console.log("Stage 0.10H-1G orchestrated research execution tests passed.");
