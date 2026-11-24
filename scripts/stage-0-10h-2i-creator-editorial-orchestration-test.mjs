import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CreatorEditorialPipelineError,
  runCreatorEditorialScriptPipeline as runPipeline,
} from "../lib/research/creatorEditorialPipeline.client.ts";
import { getCreatorTopicAuthorityIdentity } from "../lib/creator/creatorWorkflowAuthority.ts";
import { createResearchOrchestrationPlan } from "../lib/research/researchOrchestration.ts";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The original scenarios predate server-owned snapshots. Preserve their
// research/provider stubs while adding the real evaluation API contract.
const fixtureDigest = "a".repeat(64);
const fixtureTrace = [];
const fixtureReadiness = { version: "0.10H-2B", status: "ready", editorialReadinessScore: 88, claimCount: 0,
  evidenceRequiredClaimCount: 0, supportedClaimCount: 0, unsupportedClaimIds: [], primarySourceRequiredClaimIds: [],
  primarySourceCoveredClaimIds: [], counterEvidenceRecommendedClaimIds: [], counterEvidenceCoveredClaimIds: [],
  dimensions: { evidenceCoveragePct: 100, sourceUsabilityPct: 100, primarySourceCoveragePct: 100, counterEvidenceCoveragePct: 100, sourceDiversityCount: 0 }, reviewReasons: [] };
const fixtureReview = { snapshotFingerprint: "synthetic-review", claims: [], unresolvedClaimIds: [], nextActions: ["inspect_claim_passages", "explicitly_omit_unresolved_assertions_or_stop", "obtain_qualifying_sources_before_retrying_retained_claims"] };
async function runCreatorEditorialScriptPipeline(input) {
  const projectId = input.scriptPlanRequest.projectId || "synthetic-project";
  const fetchImpl = input.fetchImpl;
  const trace = [];
  fixtureTrace.push(trace);
  const result = await runPipeline({
    ...input,
    scriptPlanRequest: { ...input.scriptPlanRequest, projectId },
    operationIsCurrent: input.operationIsCurrent || (() => true),
    fetchImpl: async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      trace.push({ url, body });
      if (url === "/api/creator-evidence-evaluation") {
        assert.equal(body.projectId, projectId);
        assert.equal(body.snapshotDigest, fixtureDigest);
        return jsonResponse({ success: true, projectId, snapshotDigest: fixtureDigest, researchRevision: 1,
          readiness: fixtureReadiness,
          verifiedLimitationClaimIds: [], review: fixtureReview,
          blockingReasons: [], generationEligible: true });
      }
      const response = await fetchImpl(url, init);
      if (response.ok && (url === "/api/creator-editorial-analysis" || url === "/api/creator-editorial-primary-coverage")) {
        const value = await response.clone().json();
        return jsonResponse({ ...value, sourceAuthoritySnapshotDigest: fixtureDigest }, response.status);
      }
      return response;
    },
  });
  const evaluation = trace.findIndex((call) => call.url === "/api/creator-evidence-evaluation");
  const generation = trace.findLastIndex((call) => call.url === "/api/creator-script-plan");
  assert(evaluation > 0 && generation > evaluation, "server evaluation precedes script dispatch");
  return result;
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
assert.deepEqual(fixtureTrace[0].map((call) => call.url), ["/api/creator-script-plan", "/api/creator-research", "/api/creator-editorial-analysis", "/api/creator-evidence-evaluation", "/api/creator-script-plan"]);
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

// Fail closed against missing or mismatched server decisions. These use the
// actual client pipeline directly, without the happy-path fixture wrapper.
for (const mode of ["missing_snapshot", "missing_evaluation", "project_mismatch", "snapshot_mismatch", "unauthorized", "expired_authority", "client_exemption", "stale_revision"]) {
  let evaluationCount = 0, generationCount = 0;
  const request = { projectId: "security-project", verifiedLimitationClaimIds: ["claim-unresolved"], readiness: { status: "ready" } };
  await assert.rejects(() => runPipeline({ accessToken: "synthetic", topic: "Synthetic research", scriptPlanRequest: request,
    operationIsCurrent: () => true,
    onCounterEvidenceReview: async () => ({ snapshotFingerprint: "synthetic-review", excludedClaimIds: ["claim-unresolved"], rationale: "Exclude unsupported assertion.", confirmed: true }),
    fetchImpl: async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      if (url === "/api/creator-script-plan") {
        if (body.operation === "validate_generation_authority") return jsonResponse({ success: true });
        generationCount++; return jsonResponse({ success: true });
      }
      if (url === "/api/creator-research") return jsonResponse({ success: true, sources: [{ sourceId: "synthetic-source" }] });
      if (url === "/api/creator-editorial-analysis") return jsonResponse({ success: true, scriptContext, readiness: fixtureReadiness, ...(mode === "missing_snapshot" ? {} : { sourceAuthoritySnapshotDigest: fixtureDigest }) });
      if (url === "/api/creator-evidence-evaluation") {
        evaluationCount++;
        assert.equal(body.projectId, "security-project"); assert.equal(body.snapshotDigest, fixtureDigest);
        assert.equal(body.verifiedLimitationClaimIds, undefined); assert.equal(body.readiness, undefined);
        if (mode === "missing_evaluation") return jsonResponse({ error: "not found" }, 404);
        if (mode === "unauthorized") return jsonResponse({ success: false, code: "UNAUTHORIZED" }, 401);
        if (mode === "expired_authority") return jsonResponse({ success: false, code: "EVIDENCE_AUTHORITY_UNAVAILABLE" }, 422);
        const unresolved = mode === "stale_revision" || mode === "client_exemption";
        return jsonResponse({ success: true, projectId: mode === "project_mismatch" ? "other-project" : "security-project",
          snapshotDigest: mode === "snapshot_mismatch" ? "b".repeat(64) : fixtureDigest,
          researchRevision: mode === "stale_revision" && evaluationCount > 1 ? 2 : 1,
          readiness: fixtureReadiness, verifiedLimitationClaimIds: [],
          review: unresolved ? { ...fixtureReview, claims: [{ claimId: "claim-unresolved", counter: [], contextual: [], support: [], outcome: "no_counterevidence_in_snapshot", canExclude: true }], unresolvedClaimIds: ["claim-unresolved"] } : fixtureReview,
          blockingReasons: unresolved ? ["MATERIAL_COUNTER_EVIDENCE_REVIEW"] : [], generationEligible: !unresolved });
      }
      throw Error("UNEXPECTED_ENDPOINT");
    } }), (error) => error instanceof CreatorEditorialPipelineError && ["EDITORIAL_EVALUATION_UNAVAILABLE", "EDITORIAL_REVIEW_STALE", "EDITORIAL_REVIEW_UNRESOLVED"].includes(error.code), mode);
  assert.equal(generationCount, 0, `${mode} never dispatches generation`);
}

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

const primaryRetryCalls = [];
let primaryRetryEditorialCount = 0;

await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: "Elon Musk and the future of work",
  scriptPlanRequest: {
    operation: "generate_full_script",
    projectId: "project-primary-retry",
    durationSec: 660,
  },
  fetchImpl: async (url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    primaryRetryCalls.push({ url, body });

    if (url === "/api/creator-script-plan") {
      return jsonResponse({
        success: true,
        productionPackage: {},
        scriptPlan: {},
      });
    }

    if (url === "/api/creator-research") {
      if (body.claimType === "PRIMARY_SOURCE_CLAIM") {
        return jsonResponse({
          success: true,
          mode: "orchestrated",
          sources: [
            {
              sourceId: "primary:elon-original",
              adapterId: "web",
              mediaKind: "webpage",
              title: "Original statement",
              url: "https://example.com/original",
              sourceMetadata: {
                provenanceVerified: true,
                provenanceKind: "direct_transcript",
              },
            },
          ],
          lanes: [
            {
              laneId: "primary-transcript-interview",
              purpose: "primary_source",
              sourceIds: ["primary:elon-original"],
            },
          ],
        });
      }

      return jsonResponse({
        success: true,
        mode: "orchestrated",
        sources: [
          {
            sourceId: "web:secondary",
            title: "Secondary commentary",
            url: "https://example.com/secondary",
          },
        ],
        lanes: [
          {
            purpose: "baseline",
            sourceIds: ["web:secondary"],
          },
        ],
      });
    }

    if (url === "/api/creator-editorial-analysis") {
      primaryRetryEditorialCount += 1;
      return jsonResponse({
        success: true,
        readiness: {
          status: "review",
          editorialReadinessScore: 60,
          reviewReasons: ["PRIMARY_SOURCE_COVERAGE_REQUIRED"],
          primarySourceRequiredClaimIds: ["claim-primary"],
          primarySourceCoveredClaimIds: [],
        },
        graph: {
          claims: [{
            claimId: "claim-primary",
            claimType: "PRIMARY_SOURCE_CLAIM",
            text: "Musk says work may become optional as AI and robotics advance.",
          }],
        },
      });
    }

    if (url === "/api/creator-editorial-primary-coverage") {
      return jsonResponse({
        success: true,
        readiness: {
          status: "ready",
          editorialReadinessScore: 90,
          reviewReasons: [],
          primarySourceRequiredClaimIds: ["claim-primary"],
          primarySourceCoveredClaimIds: ["claim-primary"],
        },
        graph: {
          ...body.frozenGraph,
          sources: body.candidateSources,
        },
        scriptContext,
      });
    }

    return jsonResponse({ success: false, error: "unexpected" }, 500);
  },
});

assert.deepEqual(
  primaryRetryCalls.map((call) => call.url),
  [
    "/api/creator-script-plan",
    "/api/creator-research",
    "/api/creator-editorial-analysis",
    "/api/creator-research",
    "/api/creator-editorial-primary-coverage",
    "/api/creator-script-plan",
  ],
);

assert.equal(primaryRetryCalls[3].body.claimType, "PRIMARY_SOURCE_CLAIM");
assert.equal(
  primaryRetryCalls[3].body.subject,
  "Musk says work may become optional as AI and robotics advance.",
);
assert.equal(primaryRetryCalls[4].body.candidateSources.length, 1);
assert.deepEqual(primaryRetryCalls[4].body.originalPrimaryRequiredClaimIds, [
  "claim-primary",
]);
assert.equal(
  primaryRetryCalls[4].body.frozenGraph.claims[0].claimId,
  "claim-primary",
);
assert.equal(primaryRetryEditorialCount, 1);

let primaryCollapseEditorialCount = 0;
let primaryCollapseCoverageCount = 0;

await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: "Elon Musk and the future of work",
  scriptPlanRequest: {
    operation: "generate_full_script",
    projectId: "project-primary-collapse",
    durationSec: 660,
  },
  fetchImpl: async (url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));

    if (url === "/api/creator-script-plan") {
      return jsonResponse({
        success: true,
        productionPackage: {},
        scriptPlan: {},
        creatorScript: {},
      });
    }

    if (url === "/api/creator-research") {
      const targeted =
        body.claimType === "PRIMARY_SOURCE_CLAIM";

      return jsonResponse({
        success: true,
        mode: "orchestrated",
        sources: [{
          sourceId: targeted
            ? "primary:unverified"
            : "web:secondary",
          adapterId: targeted
            ? "primary"
            : "web",
          mediaKind: "webpage",
          title: "Source",
          url: targeted
            ? "https://example.com/unverified"
            : "https://example.com/secondary",
          sourceMetadata: {},
        }],
        lanes: [{
          laneId: targeted
            ? "primary-source"
            : "baseline",
          purpose: targeted
            ? "primary_source"
            : "baseline",
          sourceIds: [
            targeted
              ? "primary:unverified"
              : "web:secondary",
          ],
        }],
      });
    }

    if (url === "/api/creator-editorial-analysis") {
      primaryCollapseEditorialCount += 1;

      return jsonResponse({
        success: true,
        readiness: {
          status: "review",
          editorialReadinessScore: 60,
          reviewReasons: [
            "PRIMARY_SOURCE_COVERAGE_REQUIRED",
          ],
          primarySourceRequiredClaimIds: [
            "claim-primary",
          ],
          primarySourceCoveredClaimIds: [],
        },
        graph: {
          claims: [{
            claimId: "claim-primary",
            claimType: "PRIMARY_SOURCE_CLAIM",
            text:
              "Musk says work may become optional as AI and robotics advance.",
          }],
        },
      });
    }

    if (
      url ===
      "/api/creator-editorial-primary-coverage"
    ) {
      primaryCollapseCoverageCount += 1;

      assert.deepEqual(
        body.candidateSources,
        [],
        "unverified acquisition must reach trusted coverage repair with zero accepted primary candidates",
      );

      return jsonResponse({
        success: true,
        readiness: {
          status: "ready",
          editorialReadinessScore: 90,
          reviewReasons: [],
          primarySourceRequiredClaimIds: [],
          primarySourceCoveredClaimIds: [],
        },
        graph: {
          ...body.frozenGraph,
          claims: [],
        },
        excludedPrimaryClaimIds: [
          "claim-primary",
        ],
        scriptContext,
      });
    }

    return jsonResponse(
      {
        success: false,
        error: "unexpected",
      },
      500,
    );
  },
});

assert.equal(
  primaryCollapseEditorialCount,
  1,
  "safe exclusion must not regenerate canonical editorial claims",
);

assert.equal(
  primaryCollapseCoverageCount,
  1,
  "unverified acquisition must reach exactly one trusted coverage repair",
);

let safelyExcludedPrimaryEditorialCount = 0;
let safelyExcludedPrimaryCoverageCount = 0;

await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: "Elon Musk and the future of work",
  scriptPlanRequest: {
    operation: "generate_full_script",
    projectId: "project-primary-safe-exclusion",
    durationSec: 660,
  },
  fetchImpl: async (url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));

    if (url === "/api/creator-script-plan") {
      return jsonResponse({
        success: true,
        productionPackage: {},
        scriptPlan: {},
        creatorScript: {},
      });
    }

    if (url === "/api/creator-research") {
      const targeted = body.claimType === "PRIMARY_SOURCE_CLAIM";

      return jsonResponse({
        success: true,
        mode: "orchestrated",
        sources: targeted
          ? [{
              sourceId: "web:verified-but-irrelevant",
              adapterId: "web",
              mediaKind: "webpage",
              title: "Direct transcript",
              url: "https://example.com/direct-transcript",
              sourceMetadata: {},
            }]
          : [{
              sourceId: "web:secondary",
              adapterId: "web",
              mediaKind: "webpage",
              title: "Secondary source",
              url: "https://example.com/secondary",
              sourceMetadata: {},
            }],
        lanes: [{
          laneId: targeted
            ? "primary-transcript-interview"
            : "baseline",
          purpose: targeted
            ? "primary_source"
            : "baseline",
          sourceIds: [
            targeted
              ? "web:verified-but-irrelevant"
              : "web:secondary",
          ],
        }],
      });
    }

    if (url === "/api/creator-editorial-analysis") {
      safelyExcludedPrimaryEditorialCount += 1;

      return jsonResponse({
        success: true,
        readiness: {
          status: "review",
          editorialReadinessScore: 60,
          reviewReasons: ["PRIMARY_SOURCE_COVERAGE_REQUIRED"],
          primarySourceRequiredClaimIds: ["claim-primary"],
          primarySourceCoveredClaimIds: [],
        },
        graph: {
          claims: [{
            claimId: "claim-primary",
            claimType: "PRIMARY_SOURCE_CLAIM",
            text: "Musk says work may become optional as AI and robotics advance.",
          }],
        },
      });
    }

    if (url === "/api/creator-editorial-primary-coverage") {
      safelyExcludedPrimaryCoverageCount += 1;

      assert.deepEqual(
        body.candidateSources,
        [],
        "empty claim-qualified primary acquisition must still reach the trusted coverage endpoint",
      );

      return jsonResponse({
        success: true,
        readiness: {
          status: "ready",
          editorialReadinessScore: 90,
          reviewReasons: [],
          primarySourceRequiredClaimIds: [],
          primarySourceCoveredClaimIds: [],
        },
        graph: {
          ...body.frozenGraph,
          claims: [],
        },
        excludedPrimaryClaimIds: ["claim-primary"],
        scriptContext,
      });
    }

    return jsonResponse({
      success: false,
      error: "unexpected",
    }, 500);
  },
});

assert.equal(
  safelyExcludedPrimaryEditorialCount,
  1,
  "safe exclusion must not regenerate the canonical editorial analysis",
);
assert.equal(
  safelyExcludedPrimaryCoverageCount,
  1,
  "one trusted primary-coverage repair attempt must produce the safe script authority",
);

const propositionAwareMultiClaimCalls = [];
let propositionAwareEditorialCount = 0;

await runCreatorEditorialScriptPipeline({
  accessToken: "test-token",
  topic: "Work, meaning, and technological change",
  scriptPlanRequest: {
    operation: "generate_full_script",
    projectId: "project-proposition-aware-multi-claim",
    durationSec: 660,
  },
  fetchImpl: async (url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    propositionAwareMultiClaimCalls.push({ url, body });

    if (url === "/api/creator-script-plan") {
      return jsonResponse({
        success: true,
        productionPackage: {},
        scriptPlan: {},
        creatorScript: {},
      });
    }

    if (url === "/api/creator-research") {
      if (body.claimType === "RESEARCH_FINDING") {
        return jsonResponse({
          success: true,
          mode: "orchestrated",
          sources: [{
            sourceId: "academic:original-study",
            adapterId: "academic",
            mediaKind: "paper",
            title: "Original empirical study",
            url: "https://example.org/original-study",
            sourceMetadata: {},
          }],
          lanes: [{
            laneId: "supporting-evidence",
            purpose: "supporting_evidence",
            sourceIds: ["academic:original-study"],
          }],
        });
      }

      if (body.claimType === "PRIMARY_SOURCE_CLAIM") {
        return jsonResponse({
          success: true,
          mode: "orchestrated",
          sources: [{
            sourceId: "primary:direct-statement",
            adapterId: "web",
            mediaKind: "webpage",
            title: "Direct statement transcript",
            url: "https://example.org/direct-statement",
            sourceMetadata: {
              provenanceVerified: true,
              provenanceKind: "direct_transcript",
            },
          }],
          lanes: [{
            laneId: "primary-transcript-interview",
            purpose: "primary_source",
            sourceIds: ["primary:direct-statement"],
          }],
        });
      }

      return jsonResponse({
        success: true,
        mode: "orchestrated",
        sources: [{
          sourceId: "web:baseline-multi",
          adapterId: "web",
          mediaKind: "webpage",
          title: "Baseline secondary source",
          url: "https://example.org/baseline-multi",
          sourceMetadata: {},
        }],
        lanes: [{
          laneId: "baseline",
          purpose: "baseline",
          sourceIds: ["web:baseline-multi"],
        }],
      });
    }

    if (url === "/api/creator-editorial-analysis") {
      propositionAwareEditorialCount += 1;
      return jsonResponse({
        success: true,
        readiness: {
          status: "review",
          editorialReadinessScore: 60,
          reviewReasons: ["PRIMARY_SOURCE_COVERAGE_REQUIRED"],
          primarySourceRequiredClaimIds: [
            "claim-research",
            "claim-statement",
          ],
          primarySourceCoveredClaimIds: [],
        },
        graph: {
          claims: [
            {
              claimId: "claim-research",
              claimType: "RESEARCH_FINDING",
              text: "An empirical study reports a measurable relationship between work and non-financial motivation.",
              propositionKind: "original_research_result",
              origin: {
                attributedEntity: null,
                referencedWork: "Original empirical study",
              },
            },
            {
              claimId: "claim-statement",
              claimType: "EXPERT_OPINION",
              text: "A named expert says technological change could make paid work less central.",
              propositionKind: "attributed_statement",
              origin: {
                attributedEntity: "Named expert",
                referencedWork: null,
              },
            },
          ],
        },
      });
    }

    if (url === "/api/creator-editorial-primary-coverage") {
      return jsonResponse({
        success: true,
        readiness: {
          status: "ready",
          editorialReadinessScore: 90,
          reviewReasons: [],
          primarySourceRequiredClaimIds: [
            "claim-research",
            "claim-statement",
          ],
          primarySourceCoveredClaimIds: [
            "claim-research",
            "claim-statement",
          ],
        },
        graph: {
          ...body.frozenGraph,
          sources: body.candidateSources,
        },
        scriptContext,
      });
    }

    return jsonResponse({ success: false, error: "unexpected" }, 500);
  },
});

const propositionAwareResearchCalls =
  propositionAwareMultiClaimCalls.filter(
    (call) => call.url === "/api/creator-research",
  );

assert.equal(propositionAwareResearchCalls.length, 3);

assert.equal(
  propositionAwareResearchCalls[1].body.claimType,
  "RESEARCH_FINDING",
);
assert.equal(
  propositionAwareResearchCalls[1].body.subject,
  "Original empirical study: An empirical study reports a measurable relationship between work and non-financial motivation.",
  "original-research acquisition must include the canonical referenced work",
);

assert.equal(
  propositionAwareResearchCalls[2].body.claimType,
  "PRIMARY_SOURCE_CLAIM",
);
assert.equal(
  propositionAwareResearchCalls[2].body.subject,
  "Named expert: A named expert says technological change could make paid work less central.",
  "attributed-statement acquisition must include the canonical attributed entity",
);

assert.equal(
  propositionAwareEditorialCount,
  1,
  "claim authority must come from exactly one full editorial analysis",
);

const propositionAwareCoverageRepairCall =
  propositionAwareMultiClaimCalls.filter(
    (call) => call.url === "/api/creator-editorial-primary-coverage",
  )[0];

assert.ok(
  propositionAwareCoverageRepairCall.body.candidateSources.some(
    (source) => source.sourceId === "academic:original-study",
  ),
);

assert.ok(
  propositionAwareCoverageRepairCall.body.candidateSources.some(
    (source) => source.sourceId === "primary:direct-statement",
  ),
);
assert.deepEqual(
  propositionAwareCoverageRepairCall.body.originalPrimaryRequiredClaimIds,
  ["claim-research", "claim-statement"],
);
assert.deepEqual(
  propositionAwareCoverageRepairCall.body.frozenGraph.claims.map(
    (claim) => claim.claimId,
  ),
  ["claim-research", "claim-statement"],
);

const helper = fs.readFileSync("lib/research/creatorEditorialPipeline.client.ts", "utf8");
assert.match(helper, /url: "\/api\/creator-research"/);
assert.match(helper, /url: "\/api\/creator-editorial-analysis"/);
assert.match(helper, /url: "\/api\/creator-editorial-primary-coverage"/);
assert.match(helper, /url: "\/api\/creator-script-plan"/);
assert.match(helper, /scriptContext,/);
assert.match(helper, /intentionally fails closed/);
assert.equal((helper.match(/url: "\/api\/creator-research"/g) || []).length, 2);
assert.equal((helper.match(/url: "\/api\/creator-editorial-analysis"/g) || []).length, 1);
assert.equal((helper.match(/url: "\/api\/creator-editorial-primary-coverage"/g) || []).length, 1);
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
  /runCreatorEditorialScriptPipeline\(\{\s*accessToken,\s*topic,\s*creatorProfile: creatorStrategyProfileSnapshot \|\| creatorProfile,\s*onCounterEvidenceReview: requestCounterEvidenceReview,\s*operationIsCurrent: reviewIsCurrent,\s*scriptPlanRequest,\s*\}\)/,
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
