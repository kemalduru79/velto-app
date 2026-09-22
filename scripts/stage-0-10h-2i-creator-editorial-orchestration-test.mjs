import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CreatorEditorialPipelineError,
  runCreatorEditorialScriptPipeline,
} from "../lib/research/creatorEditorialPipeline.client.ts";
import { getCreatorTopicAuthorityIdentity } from "../lib/creator/creatorWorkflowAuthority.ts";
import { createResearchOrchestrationPlan } from "../lib/research/researchOrchestration.ts";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const calls = [];
const scriptContext = {
  version: "0.10H-2E",
  editorialConstitution: "Ground factual claims.",
  readiness: { status: "ready", editorialReadinessScore: 88, reviewReasons: [] },
  claims: [],
  evidence: [],
  sources: [],
};
const mockFetch = async (url, init) => {
  const body = JSON.parse(String(init?.body || "{}"));
  calls.push({ url, init, body });
  if (url === "/api/creator-research") {
    return jsonResponse({
      success: true,
      mode: "orchestrated",
      sourceCount: 2,
      sources: [
        { sourceId: "source-1", title: "A", url: "https://example.com/a" },
        { sourceId: "source-2", title: "B", url: "https://example.com/b" },
      ],
    });
  }
  if (url === "/api/creator-editorial-analysis") {
    return jsonResponse({
      success: true,
      readiness: { status: "ready", editorialReadinessScore: 88 },
      scriptContext,
    });
  }
  if (url === "/api/creator-script-plan") {
    return jsonResponse({
      success: true,
      productionPackage: { title: "Grounded package" },
      scriptPlan: { editorialContext: { used: true } },
    });
  }
  return jsonResponse({ success: false, error: "unexpected" }, 500);
};

const result = await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: "Automation and the future of work",
  creatorProfile: { brandName: "Velto" },
  scriptPlanRequest: {
    topic: "must-not-override-canonical-topic",
    contentType: "documentary essay",
    format: "youtube_video",
    productionPackage: { scenes: [{ id: 1, narration: "Draft" }] },
  },
  fetchImpl: mockFetch,
});

assert.equal(calls.length, 4);
assert.deepEqual(calls.map((call) => call.url), [
  "/api/creator-script-plan",
  "/api/creator-research",
  "/api/creator-editorial-analysis",
  "/api/creator-script-plan",
]);
for (const call of calls) {
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers.Authorization, "Bearer test-token");
  assert.equal(call.init.headers["Content-Type"], "application/json");
}
assert.equal(calls[0].body.operation, "validate_generation_authority");
assert.equal(calls[0].body.topicAuthority, "Automation and the future of work");
assert.equal(calls[1].body.mode, "orchestrated");
assert.equal(calls[1].body.subject, "Automation and the future of work");
assert.equal(calls[2].body.topic, "Automation and the future of work");
assert.equal(calls[2].body.sources.length, 2);
assert.deepEqual(calls[2].body.creatorProfile, { brandName: "Velto" });
assert.equal(calls[3].body.topic, "Automation and the future of work");
assert.equal(calls[3].body.topicAuthority, "Automation and the future of work");
assert.deepEqual(calls[3].body.scriptContext, scriptContext);
assert.equal(calls[3].body.productionPackage.scenes[0].narration, "Draft");
assert.deepEqual(result.productionPackage, { title: "Grounded package" });
assert.equal(result.editorialSummary.researchSourceCount, 2);
assert.equal(result.editorialSummary.readinessStatus, "ready");
assert.equal(result.editorialSummary.editorialReadinessScore, 88);

const longTopic = `${"PROJECT THYNEL premium faceless documentary for YouTube. ".repeat(420)}Memory & Identity`;
const longTopicCalls = [];
await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: longTopic,
  researchSubject: "Memory & Identity",
  scriptPlanRequest: {},
  fetchImpl: async (url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    longTopicCalls.push({ url, body });
    if (url === "/api/creator-research") {
      return jsonResponse({ success: true, sources: [{ sourceId: "long-source" }] });
    }
    if (url === "/api/creator-editorial-analysis") {
      return jsonResponse({ success: true, scriptContext, readiness: { status: "ready" } });
    }
    return jsonResponse({ success: true, productionPackage: {}, scriptPlan: {} });
  },
});
assert.equal(longTopicCalls[0].body.topic, "Memory & Identity");
assert.equal(longTopicCalls[0].body.topicAuthority, longTopic);
assert.deepEqual(
  getCreatorTopicAuthorityIdentity(longTopicCalls[0].body.topicAuthority),
  getCreatorTopicAuthorityIdentity(longTopic),
  "concise subject selection must not change canonical brief authority or its hash",
);
assert.equal(longTopicCalls[1].body.subject, "Memory & Identity");
assert.equal(longTopicCalls[2].body.topic, "Memory & Identity");
assert.equal(longTopicCalls[3].body.topic, "Memory & Identity");
assert.equal(longTopicCalls[3].body.topicAuthority, longTopic);
assert.doesNotMatch(longTopicCalls[1].body.subject, /THYNEL|YouTube|premium faceless documentary/i);
assert.doesNotMatch(longTopicCalls[2].body.topic, /THYNEL|YouTube|premium faceless documentary/i);
const memoryResearchPlan = createResearchOrchestrationPlan({ subject: longTopicCalls[1].body.subject });
assert.equal(memoryResearchPlan.lanes[0].input.query, "Memory & Identity");
assert.equal(
  memoryResearchPlan.lanes.find((lane) => lane.purpose === "counter_evidence")?.input.query,
  "Memory & Identity limitations alternative explanations counter evidence criticism",
);

const legacyConciseCalls = [];
await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: "How does sleep affect memory?",
  scriptPlanRequest: {},
  fetchImpl: async (url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    legacyConciseCalls.push({ url, body });
    if (url === "/api/creator-research") return jsonResponse({ success: true, sources: [{ sourceId: "sleep-source" }] });
    if (url === "/api/creator-editorial-analysis") return jsonResponse({ success: true, scriptContext, readiness: { status: "ready" } });
    return jsonResponse({ success: true, productionPackage: {}, scriptPlan: {} });
  },
});
assert.equal(legacyConciseCalls[1].body.subject, "How does sleep affect memory?");
assert.equal(legacyConciseCalls[2].body.topic, "How does sleep affect memory?");
assert.equal(legacyConciseCalls[3].body.topic, "How does sleep affect memory?");
assert.equal(legacyConciseCalls[0].body.topicAuthority, "How does sleep affect memory?");

await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "",
    topic: "Topic",
    scriptPlanRequest: {},
    fetchImpl: mockFetch,
  }),
  (error) => error instanceof CreatorEditorialPipelineError &&
    error.code === "EDITORIAL_PIPELINE_AUTH_REQUIRED",
);

await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "token",
    topic: "   ",
    scriptPlanRequest: {},
    fetchImpl: mockFetch,
  }),
  (error) => error instanceof CreatorEditorialPipelineError &&
    error.code === "EDITORIAL_PIPELINE_TOPIC_REQUIRED",
);

await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "token",
    topic: "Topic",
    scriptPlanRequest: {},
    fetchImpl: async () => jsonResponse({ success: true, sources: [] }),
  }),
  (error) => error instanceof CreatorEditorialPipelineError &&
    error.stage === "research" && error.code === "EDITORIAL_PIPELINE_NO_SOURCES",
);

const failedCalls = [];
await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "token",
    topic: "Topic",
    scriptPlanRequest: {},
    fetchImpl: async (url) => {
      failedCalls.push(url);
      if (url === "/api/creator-research") {
        return jsonResponse({ success: false, code: "RESEARCH_DOWN", error: "Research unavailable." }, 502);
      }
      return jsonResponse({ success: true });
    },
  }),
  (error) => error instanceof CreatorEditorialPipelineError &&
    error.stage === "research" && error.status === 502 && error.code === "RESEARCH_DOWN",
);
assert.deepEqual(failedCalls, ["/api/creator-script-plan", "/api/creator-research"]);

const staleAuthorityCalls = [];
await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "token",
    topic: "Topic",
    scriptPlanRequest: { projectId: "project-b", durationSec: 300 },
    fetchImpl: async (url) => {
      staleAuthorityCalls.push(url);
      return jsonResponse({ success: false, code: "CREATOR_SCRIPT_AUTHORITY_STALE", error: "Save or reload this project before building the script." }, 409);
    },
  }),
  (error) => error instanceof CreatorEditorialPipelineError &&
    error.stage === "script_plan" && error.status === 409 && error.code === "CREATOR_SCRIPT_AUTHORITY_STALE",
);
assert.deepEqual(staleAuthorityCalls, ["/api/creator-script-plan"]);

const providerFailureCalls = [];
await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "token",
    topic: "Memory and identity",
    scriptPlanRequest: { operation: "generate_full_script", projectId: "project-baseline", durationSec: 960 },
    fetchImpl: async (url, init) => {
      providerFailureCalls.push({ url, body: JSON.parse(String(init?.body || "{}")) });
      if (providerFailureCalls.length === 1) return jsonResponse({ success: true, authority: {} });
      if (url === "/api/creator-research") return jsonResponse({ success: true, sources: [{ sourceId: "memory-source" }] });
      if (url === "/api/creator-editorial-analysis") {
        return jsonResponse({ success: true, scriptContext, readiness: { status: "ready" } });
      }
      return jsonResponse({ success: false, code: "CREATOR_SCRIPT_MODEL_INVALID", error: "Script output was invalid." }, 422);
    },
  }),
  (error) => error instanceof CreatorEditorialPipelineError &&
    error.stage === "script_plan" && error.status === 422 && error.code === "CREATOR_SCRIPT_MODEL_INVALID",
);
assert.deepEqual(providerFailureCalls.map((call) => call.url), [
  "/api/creator-script-plan",
  "/api/creator-research",
  "/api/creator-editorial-analysis",
  "/api/creator-script-plan",
]);
assert.equal(providerFailureCalls[0].body.operation, "validate_generation_authority");
assert.equal(providerFailureCalls[3].body.operation, "generate_full_script");

const helper = fs.readFileSync("lib/research/creatorEditorialPipeline.client.ts", "utf8");
assert.match(helper, /url: "\/api\/creator-research"/);
assert.match(helper, /url: "\/api\/creator-editorial-analysis"/);
assert.match(helper, /url: "\/api\/creator-script-plan"/);
assert.match(helper, /scriptContext,/);
assert.match(helper, /intentionally fails closed/);
assert.equal((helper.match(/url: "\/api\/creator-research"/g) || []).length, 1);
assert.equal((helper.match(/url: "\/api\/creator-editorial-analysis"/g) || []).length, 1);
assert.doesNotMatch(helper, /providerRequestId|providerCostUsd|rawProviderPayload/);

const createPage = fs.readFileSync("app/create/page.tsx", "utf8");
assert.match(
  createPage,
  /import\s*\{[\s\S]*?runCreatorEditorialScriptPipeline[\s\S]*?\}\s*from\s*"@\/lib\/research\/creatorEditorialPipeline\.client"/,
);

const scriptPlanAdapter = createPage.match(
  /const applyCreatorProfessionalScriptPlan = async \([\s\S]*?\n  \};/,
)?.[0];
assert.ok(scriptPlanAdapter, "CreatorLab script-plan adapter must remain present");
assert.match(scriptPlanAdapter, /const scriptPlanRequest = \{/);
assert.match(
  scriptPlanAdapter,
  /runCreatorEditorialScriptPipeline\(\{\s*accessToken,\s*topic,\s*creatorProfile: creatorStrategyProfileSnapshot \|\| creatorProfile,\s*scriptPlanRequest,\s*\}\)/,
);
assert.match(
  scriptPlanAdapter,
  /productionPackage:\s*plannedPackage/,
);
assert.match(
  scriptPlanAdapter,
  /\bscriptPlan\b/,
);
assert.match(scriptPlanAdapter, /return plannedPackage as CreatorProductionPackage/);
assert.doesNotMatch(scriptPlanAdapter, /fetch\(["']\/api\/creator-script-plan/);
assert.doesNotMatch(scriptPlanAdapter, /catch[\s\S]*fetch\(["']\/api\/creator-script-plan/);
assert.match(scriptPlanAdapter, /error instanceof CreatorEditorialPipelineError/);

assert.equal(
  (createPage.match(/applyCreatorProfessionalScriptPlan\(\{/g) || []).length,
  1,
  "The legacy full-package implementation remains adapter-bound while the Strategy gate uses the shared grounded pipeline directly",
);
assert.match(
  createPage,
  /const handleCreatorProductionPackage[\s\S]*?runCreatorEditorialScriptPipeline\(\{[\s\S]*?researchSubject: creatorMarketEvidenceSubject,[\s\S]*?operation: "generate_full_script"/,
);
assert.match(
  createPage,
  /const handleGenerateFullYoutubePackage[\s\S]*?if \(!isCreatorLabFlow\) \{\s*return;\s*\}/,
);
assert.doesNotMatch(
  scriptPlanAdapter,
  /claimId|evidenceId|providerName|researchLane|providerCost|rightsMetadata/,
);
assert.doesNotMatch(createPage, /providerName|researchLane|providerCost|rightsMetadata/);

console.log("Stage 0.10H-2I CreatorLab editorial orchestration tests passed.");
