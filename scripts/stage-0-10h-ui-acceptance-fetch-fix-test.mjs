import assert from "node:assert/strict";
import {
  CreatorEditorialPipelineError,
  runCreatorEditorialScriptPipeline,
} from "../lib/research/creatorEditorialPipeline.client.ts";

const originalFetch = globalThis.fetch;
const calls = [];
const fixtureDigest = "a".repeat(64);

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
      sourceAuthoritySnapshotDigest: fixtureDigest,
    }));
  }
  if (url === "/api/creator-evidence-evaluation") {
    const body = JSON.parse(init.body);
    assert.equal(body.projectId, "fixture-project"); assert.equal(body.snapshotDigest, fixtureDigest);
    if (body.operation === 'review_status') return Promise.resolve(response({success:true,projectId:'fixture-project',snapshotDigest:fixtureDigest,researchRevision:1,status:'REVIEW_COMPLETE',requirements:[]}));
    return Promise.resolve(response({ success: true, projectId: "fixture-project", snapshotDigest: fixtureDigest, researchRevision: 1,
      readiness: { version: "0.10H-2B", status: "ready", editorialReadinessScore: 100, claimCount: 0, evidenceRequiredClaimCount: 0,
        supportedClaimCount: 0, unsupportedClaimIds: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [],
        counterEvidenceRecommendedClaimIds: [], counterEvidenceCoveredClaimIds: [], dimensions: { evidenceCoveragePct: 100,
          sourceUsabilityPct: 100, primarySourceCoveragePct: 100, counterEvidenceCoveragePct: 100, sourceDiversityCount: 0 }, reviewReasons: [] },
      verifiedLimitationClaimIds: [], review: { snapshotFingerprint: "fixture", claims: [], unresolvedClaimIds: [], nextActions: [] }, blockingReasons: [], generationEligible: true }));
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
      projectId: "fixture-project",
      qualityMode: "pro",
      sceneCount: 1,
      productionPackage: { title: "Initial package", scenes: [] },
    },
    operationIsCurrent: () => true,
  });

  assert.equal(calls.length, 6);
  assert.deepEqual(calls.map((call) => call.url), [
    "/api/creator-script-plan",
    "/api/creator-research",
    "/api/creator-editorial-analysis",
    "/api/creator-evidence-evaluation",
    "/api/creator-evidence-evaluation",
    "/api/creator-script-plan",
  ]);
  const scriptPlanBody = JSON.parse(calls[5].init.body);
  assert.equal(scriptPlanBody.qualityMode, "pro");
  assert.equal(scriptPlanBody.topic, "Approved strategy");
  assert.deepEqual(result.productionPackage, {
    title: "Planned package",
    scenes: [{ id: 1, narration: "Professional scene narration." }],
  });

  globalThis.fetch = function failingBrowserFetch(url) {
    if (this !== globalThis) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    return Promise.resolve(url === "/api/creator-script-plan" ? response({ success: true }) : response({
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
