import assert from "node:assert/strict";
import {
  CreatorEditorialPipelineError,
  runCreatorEditorialScriptPipeline,
} from "../lib/research/creatorEditorialPipeline.client.ts";

const originalFetch = globalThis.fetch;
const calls = [];

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

globalThis.fetch = function contextSensitiveBrowserFetch(url, init) {
  if (this !== globalThis) {
    throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  }
  calls.push({ url, init });
  if (url === "/api/creator-research") {
    return Promise.resolve(response({
      success: true,
      sources: [{ sourceId: "source:1" }],
    }));
  }
  if (url === "/api/creator-editorial-analysis") {
    return Promise.resolve(response({
      success: true,
      scriptContext: { editorialBrief: "Grounded brief" },
      readiness: { status: "ready", editorialReadinessScore: 100 },
    }));
  }
  if (url === "/api/creator-script-plan") {
    return Promise.resolve(response({
      success: true,
      productionPackage: {
        title: "Planned package",
        scenes: [{ id: 1, narration: "Professional scene narration." }],
      },
      scriptPlan: { version: "test" },
    }));
  }
  return Promise.resolve(response({ success: false, error: "Unexpected route" }, 404));
};

try {
  const result = await runCreatorEditorialScriptPipeline({
    accessToken: "acceptance-token",
    topic: "Approved strategy",
    creatorProfile: { channelName: "Creator" },
    scriptPlanRequest: {
      qualityMode: "pro",
      sceneCount: 1,
      productionPackage: { title: "Initial package", scenes: [] },
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.url), [
    "/api/creator-research",
    "/api/creator-editorial-analysis",
    "/api/creator-script-plan",
  ]);
  const scriptPlanBody = JSON.parse(calls[2].init.body);
  assert.equal(scriptPlanBody.qualityMode, "pro");
  assert.equal(scriptPlanBody.topic, "Approved strategy");
  assert.deepEqual(result.productionPackage, {
    title: "Planned package",
    scenes: [{ id: 1, narration: "Professional scene narration." }],
  });

  globalThis.fetch = function failingBrowserFetch() {
    if (this !== globalThis) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    return Promise.resolve(response({
      success: false,
      error: "Research service unavailable",
    }, 503));
  };

  await assert.rejects(
    runCreatorEditorialScriptPipeline({
      accessToken: "acceptance-token",
      topic: "Approved strategy",
      scriptPlanRequest: { qualityMode: "pro" },
    }),
    (error) =>
      error instanceof CreatorEditorialPipelineError &&
      error.stage === "research" &&
      error.status === 503 &&
      error.message === "Research service unavailable",
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Stage 0.10H UI acceptance fetch binding tests passed.");
