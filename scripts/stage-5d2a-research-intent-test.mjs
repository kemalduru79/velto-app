import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CREATOR_RESEARCH_INTENT_VERSION,
  createCreatorResearchIntentCoverage,
  createCreatorResearchIntentFromBrief,
  normalizeCreatorResearchIntent,
} from "../lib/research/creatorResearchIntent.ts";
import { createResearchOrchestrationPlan } from "../lib/research/researchOrchestration.ts";
import {
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildSnapshot,
} from "../lib/creator/creatorScriptBuild.ts";
import { resolveCreatorMarketEvidenceSubject } from "../lib/creator/marketEvidenceSubject.ts";
import {
  createCreatorScriptBuildResearchExecutionInput,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { buildExaSearchRequest } from "../lib/providers/research/exaRequest.ts";

// Offline representation of the owner-described Thynel prompt structure. These
// public URL strings are query fixtures only; the test performs no retrieval
// and confers no source-verification authority.
const preferredUrls = [
  "https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks",
  "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study",
  "https://arxiv.org/abs/2404.05866",
  "https://arxiv.org/abs/2304.11771",
  "https://doi.org/10.1093/qje/qjae044",
];
const comparisonQuestions = [
  "How do the reported workplace productivity findings differ from the opposing evidence when task context, participant experience, and measurement design are compared?",
  "Which limits or alternative explanations distinguish benchmark capability growth from observed economic productivity, and where do the publications genuinely disagree?",
];
const longBrief = [
  "Prepare a bounded science documentary about rapid AI progress and work.",
  "Research Foundation",
  "Prioritize the following published research and independently verify all factual claims",
  "",
  `1. ${preferredUrls[0]}`,
  `2. ${preferredUrls[1]}`,
  `3. ${preferredUrls[2]}`,
  `4. ${preferredUrls[3]}`,
  `5. ${preferredUrls[4]}`,
  "ftp://invalid.example.test/not-allowed",
  "http://127.0.0.1/private",
  "Comparison questions:",
  ...comparisonQuestions,
  "Give the documentary a clear ending.",
  "Bounded owner research context. ".repeat(580),
].join("\n");
assert.ok(longBrief.length > 19_000 && longBrief.length < 20_000);

const intent = createCreatorResearchIntentFromBrief(longBrief);
const mentorReducedSubject = resolveCreatorMarketEvidenceSubject({
  briefTopic: longBrief,
  selectedDirectionId: "recommended",
  recommendedIdea: { title: "How rapid AI progress changes work and economic growth" },
  videoIdeas: [],
});
assert.equal(mentorReducedSubject, "How rapid AI progress changes work and economic growth");
assert.equal(intent.version, CREATOR_RESEARCH_INTENT_VERSION);
assert.equal(intent.preferredSourceUrls.length, 5);
assert.deepEqual(intent.preferredSourceUrls, preferredUrls);
assert.deepEqual(intent.requiredSourceUrls, []);
assert.deepEqual(intent.comparisonQuestions, comparisonQuestions);
assert.ok(intent.researchBrief.includes("rapid AI progress"));
assert.ok(Object.isFrozen(intent));
assert.ok(Object.isFrozen(intent.preferredSourceUrls));
assert.ok(Object.isFrozen(intent.comparisonQuestions));

const normalized = normalizeCreatorResearchIntent({
  ...intent,
  preferredSourceUrls: [
    ...intent.preferredSourceUrls,
    `${preferredUrls[0]}#duplicate`,
    "javascript:alert(1)",
    "http://localhost/private",
  ],
});
assert.deepEqual(normalized.preferredSourceUrls, preferredUrls);

const subject = mentorReducedSubject;
const legacyPlan = createResearchOrchestrationPlan({
  subject,
  maxResultsPerLane: 5,
  includeRecentContext: false,
});
const intentPlan = createResearchOrchestrationPlan({
  subject,
  maxResultsPerLane: 5,
  includeRecentContext: false,
  researchIntent: intent,
});
assert.deepEqual(createResearchOrchestrationPlan({
  subject,
  maxResultsPerLane: 5,
  includeRecentContext: false,
  researchIntent: intent,
}), intentPlan, "provider-facing query allocation must be deterministic");
assert.equal(intentPlan.lanes.length, legacyPlan.lanes.length, "intent must not add provider requests");
assert.deepEqual(intentPlan.lanes.map((lane) => lane.laneId), legacyPlan.lanes.map((lane) => lane.laneId));
assert.deepEqual(intentPlan.lanes[0].input.includeDomains, ["metr.org", "arxiv.org", "doi.org"]);
assert.deepEqual(intentPlan.researchIntent, intent);
const providerQueries = intentPlan.lanes.map((item) => buildExaSearchRequest(item.input).query);
assert.ok(providerQueries.every((query) => query.length <= 600));
assert.deepEqual(
  preferredUrls.filter((url) => providerQueries.some((query) => query.includes(url))),
  preferredUrls,
  "all five whole preferred URLs must survive into a provider-facing query",
);
assert.deepEqual(
  comparisonQuestions.filter((question) => providerQueries.some((query) => query.includes(question))),
  comparisonQuestions,
  "both comparison questions must survive into a provider-facing query",
);
assert.ok(providerQueries.some((query) => query.includes(preferredUrls.at(-1))));
assert.ok(providerQueries.some((query) => query.includes(comparisonQuestions.at(-1))));
assert.deepEqual(intentPlan.researchIntentQueryCoverage, {
  comparisonQuestionCount: 2,
  representedComparisonQuestionCount: 2,
  preferredSourceCount: 5,
  representedPreferredSourceCount: 5,
  requiredSourceCount: 0,
  representedRequiredSourceCount: 0,
});
assert.equal(
  intentPlan.lanes.reduce((sum, item) => sum + item.input.maxResults, 0),
  legacyPlan.lanes.reduce((sum, item) => sum + item.input.maxResults, 0),
  "query distribution must not increase provider result or call budgets",
);

const baseSnapshotInput = {
  projectId: "project-stage-5d2a",
  expectedProjectRevision: "2026-10-22T00:00:00.000Z",
  strategyFingerprint: "fingerprint-stage-5d2a",
  language: "en",
  requestedDurationSeconds: 480,
  strategy: {
    topic: longBrief,
    researchSubject: subject,
    title: "Synthetic AI documentary",
    contentType: "documentary",
    format: "youtube_video",
    selectedDirectionId: "recommended",
    selectedHook: "A synthetic hook",
    approvedStrategy: { version: "synthetic" },
  },
  creatorProfile: { version: "synthetic" },
  contractVersions: { creatorScriptBuild: "0.19E1" },
};
const legacySnapshot = createCreatorScriptBuildSnapshot(baseSnapshotInput);
assert.equal(Object.hasOwn(legacySnapshot.strategy, "researchIntent"), false);
const snapshot = createCreatorScriptBuildSnapshot({
  ...baseSnapshotInput,
  strategy: { ...baseSnapshotInput.strategy, researchIntent: intent },
});
const repeatedSnapshot = createCreatorScriptBuildSnapshot({
  ...baseSnapshotInput,
  strategy: { ...baseSnapshotInput.strategy, researchIntent: intent },
});
assert.deepEqual(repeatedSnapshot, snapshot);
assert.equal(
  createCreatorScriptBuildIdempotencyKey({ ownerId: "owner-stage-5d2a", snapshot }),
  createCreatorScriptBuildIdempotencyKey({ ownerId: "owner-stage-5d2a", snapshot: repeatedSnapshot }),
);
const executionInput = createCreatorScriptBuildResearchExecutionInput(snapshot);
assert.deepEqual(executionInput.researchIntent, intent);
assert.equal(executionInput.maxResultsPerLane, 5);
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(Object.isFrozen(snapshot.strategy.researchIntent), true);

const candidateSources = preferredUrls.slice(0, 2).map((url, index) => ({
  url,
  sourceId: `candidate-${index + 1}`,
  reviewStatus: "requires_review",
  directness: "secondary",
}));
const originalCandidates = JSON.stringify(candidateSources);
const preferredCoverage = createCreatorResearchIntentCoverage({ intent, sources: candidateSources });
assert.deepEqual(preferredCoverage, {
  version: "stage-5d2a-coverage-v1",
  preferredSourceCount: 5,
  locatedPreferredCandidateCount: 2,
  unlocatedPreferredCount: 3,
  requiredSourceCount: 0,
  locatedRequiredCandidateCount: 0,
  missingRequiredSourceCount: 0,
  status: "preferred_coverage_warning",
});
assert.equal(JSON.stringify(candidateSources), originalCandidates, "coverage inspection must not promote or mutate sources");

const requiredIntent = createCreatorResearchIntentFromBrief([
  "Required original sources:",
  "https://required-one.example.test/paper",
  "https://required-two.example.test/paper",
].join("\n"));
assert.equal(requiredIntent.requiredSourceUrls.length, 2);
assert.equal(requiredIntent.preferredSourceUrls.length, 0);
const requiredCoverage = createCreatorResearchIntentCoverage({
  intent: requiredIntent,
  sources: [{ url: requiredIntent.requiredSourceUrls[0] }],
});
assert.equal(requiredCoverage.status, "required_coverage_blocked");
assert.equal(requiredCoverage.missingRequiredSourceCount, 1);
const requiredProviderQueries = createResearchOrchestrationPlan({
  subject,
  maxResultsPerLane: 5,
  includeRecentContext: false,
  researchIntent: requiredIntent,
}).lanes.map((item) => buildExaSearchRequest(item.input).query);
assert.ok(requiredIntent.requiredSourceUrls.every(
  (url) => requiredProviderQueries.some((query) => query.includes(url)),
));

const ordinaryRequirement = createCreatorResearchIntentFromBrief([
  "Required factual rigor for the documentary.",
  "Example context: https://example.test/not-a-required-source",
].join("\n"));
assert.deepEqual(ordinaryRequirement.requiredSourceUrls, []);
assert.deepEqual(ordinaryRequirement.preferredSourceUrls, []);

const oversizedIntent = normalizeCreatorResearchIntent({
  version: CREATOR_RESEARCH_INTENT_VERSION,
  researchBrief: "Synthetic oversized intent used only to prove bounded omission reporting.",
  comparisonQuestions: [
    `${"A".repeat(470)}?`,
    `${"B".repeat(470)}?`,
  ],
  preferredSourceUrls: preferredUrls,
  requiredSourceUrls: [],
});
const oversizedPlan = createResearchOrchestrationPlan({
  subject,
  maxResultsPerLane: 5,
  includeRecentContext: false,
  researchIntent: oversizedIntent,
});
assert.ok(
  oversizedPlan.researchIntentQueryCoverage.representedComparisonQuestionCount < 2 ||
    oversizedPlan.researchIntentQueryCoverage.representedPreferredSourceCount < 5,
  "capacity overflow must be reported instead of claiming complete query representation",
);
assert.ok(oversizedPlan.lanes.every((item) => buildExaSearchRequest(item.input).query.length <= 600));
for (const query of oversizedPlan.lanes.map((item) => item.input.query)) {
  assert.equal(query.includes("A".repeat(200)) && !query.includes("A".repeat(470)), false);
  assert.equal(query.includes("B".repeat(200)) && !query.includes("B".repeat(470)), false);
}

const providerSource = readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8");
assert.match(providerSource, /missingRequiredSourceCount[\s\S]*CREATOR_SCRIPT_BUILD_REQUIRED_SOURCE_COVERAGE_GAP/u);
assert.match(providerSource, /category: "RESEARCH"[\s\S]*retryability: "NON_RETRYABLE"/u);
assert.doesNotMatch(providerSource, /unlocatedPreferredCount[\s\S]{0,300}throw new CreatorScriptBuildStageExecutionError/u);
const intentSource = readFileSync("lib/research/creatorResearchIntent.ts", "utf8");
assert.doesNotMatch(intentSource, /console\.(?:log|info|warn|error)/u);

console.log(JSON.stringify({
  providerQueryLengths: providerQueries.map((query) => query.length),
  comparisonQuestionsRepresented: intentPlan.researchIntentQueryCoverage.representedComparisonQuestionCount,
  preferredSourcesRepresented: intentPlan.researchIntentQueryCoverage.representedPreferredSourceCount,
  providerLaneCount: intentPlan.lanes.length,
  providerResultBudget: intentPlan.lanes.reduce((sum, item) => sum + item.input.maxResults, 0),
}));
console.log("stage-5d2a-research-intent-test: PASS");
