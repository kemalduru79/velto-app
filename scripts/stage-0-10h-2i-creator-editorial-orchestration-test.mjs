import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CreatorEditorialPipelineError,
  runCreatorEditorialScriptPipeline,
} from "../lib/research/creatorEditorialPipeline.client.ts";

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

assert.equal(calls.length, 3);
assert.deepEqual(calls.map((call) => call.url), [
  "/api/creator-research",
  "/api/creator-editorial-analysis",
  "/api/creator-script-plan",
]);
for (const call of calls) {
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers.Authorization, "Bearer test-token");
  assert.equal(call.init.headers["Content-Type"], "application/json");
}
assert.equal(calls[0].body.mode, "orchestrated");
assert.equal(calls[0].body.subject, "Automation and the future of work");
assert.equal(calls[0].body.includeRecentContext, false);
assert.equal(calls[1].body.topic, "Automation and the future of work");
assert.equal(calls[1].body.sources.length, 2);
assert.deepEqual(calls[1].body.creatorProfile, { brandName: "Velto" });
assert.equal(calls[2].body.topic, "Automation and the future of work");
assert.deepEqual(calls[2].body.scriptContext, scriptContext);
assert.equal(calls[2].body.productionPackage.scenes[0].narration, "Draft");
assert.deepEqual(result.productionPackage, { title: "Grounded package" });
assert.equal(result.editorialSummary.researchSourceCount, 2);
assert.equal(result.editorialSummary.readinessStatus, "ready");
assert.equal(result.editorialSummary.editorialReadinessScore, 88);

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
assert.deepEqual(failedCalls, ["/api/creator-research"]);

const helper = fs.readFileSync("lib/research/creatorEditorialPipeline.client.ts", "utf8");
assert.match(helper, /url: "\/api\/creator-research"/);
assert.match(helper, /url: "\/api\/creator-editorial-analysis"/);
assert.match(helper, /url: "\/api\/creator-script-plan"/);
assert.match(helper, /scriptContext,/);
assert.match(helper, /intentionally fails closed/);
assert.match(
  helper,
  /includeRecentContext: input\.includeRecentContext === true/,
);
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
  /runCreatorEditorialScriptPipeline\(\{\s*accessToken,\s*topic,\s*creatorProfile,\s*scriptPlanRequest,\s*\}\)/,
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
  2,
  "Both existing CreatorLab production entry points must keep using the shared adapter",
);
assert.match(
  createPage,
  /const handleGenerateFullYoutubePackage[\s\S]*?if \(!isCreatorLabFlow\) \{\s*return;\s*\}/,
);
assert.doesNotMatch(
  scriptPlanAdapter,
  /claimId|evidenceId|providerName|researchLane|providerCost|rightsMetadata/,
);
assert.doesNotMatch(
  createPage,
  /editorialSummary|scriptContext|claimId|evidenceId|providerName|researchLane|providerCost|rightsMetadata/,
  "Research, evidence, provider, and rights internals must remain backstage",
);

console.log("Stage 0.10H-2I CreatorLab editorial orchestration tests passed.");
