import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeCreatorResearchMode,
  normalizeCreatorResearchOrchestrationRequest,
} from "../lib/research/orchestrationRequest.ts";

assert.equal(normalizeCreatorResearchMode(undefined), "single");
assert.equal(normalizeCreatorResearchMode("single"), "single");
assert.equal(normalizeCreatorResearchMode(" orchestrated "), "orchestrated");
assert.throws(() => normalizeCreatorResearchMode("batch"), /RESEARCH_MODE_INVALID/);

const orchestration = normalizeCreatorResearchOrchestrationRequest({
  subject: "  automation   and work  ",
  claimType: "FORECAST",
  maxResultsPerLane: 99,
  includeRecentContext: true,
});
assert.equal(orchestration.subject, "automation and work");
assert.equal(orchestration.claimType, "FORECAST");
assert.equal(orchestration.maxResultsPerLane, 6);
assert.equal(orchestration.includeRecentContext, true);
assert.throws(
  () => normalizeCreatorResearchOrchestrationRequest({ subject: "topic", claimType: "CERTAIN_TRUTH" }),
  /RESEARCH_CLAIM_TYPE_INVALID/,
);
assert.throws(
  () => normalizeCreatorResearchOrchestrationRequest({ subject: "   " }),
  /RESEARCH_SUBJECT_REQUIRED/,
);

const route = readFileSync(
  new URL("../app/api/creator-research/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /export const maxDuration = 120/);
assert.match(route, /normalizeCreatorResearchMode/);
assert.match(route, /createResearchOrchestrationPlan/);
assert.match(route, /executeResearchOrchestration/);
assert.match(route, /grounded_research_orchestration/);
assert.match(route, /mode: "orchestrated"/);
assert.match(route, /mode: "single"/);
assert.match(route, /lanes: providerNeutralLanes\(result\.lanes\)/);

const lanePrivacyStart = route.indexOf("function providerNeutralLanes");
const lanePrivacyEnd = route.indexOf("function researchCost", lanePrivacyStart);
assert.ok(lanePrivacyStart >= 0 && lanePrivacyEnd > lanePrivacyStart);
const lanePrivacy = route.slice(lanePrivacyStart, lanePrivacyEnd);
assert.doesNotMatch(lanePrivacy, /providerRequestId/);
assert.doesNotMatch(lanePrivacy, /providerCostUsd/);

console.log("Stage 0.10H-1H orchestrated research API tests passed.");
