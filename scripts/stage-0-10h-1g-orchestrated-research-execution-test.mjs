import assert from "node:assert/strict";
import {
  canonicalResearchUrl,
  executeResearchOrchestration,
  ResearchOrchestrationError,
} from "../lib/research/orchestratedResearch.ts";
import { createResearchOrchestrationPlan } from "../lib/research/researchOrchestration.ts";

const source = (id, url, title = id) => ({
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
