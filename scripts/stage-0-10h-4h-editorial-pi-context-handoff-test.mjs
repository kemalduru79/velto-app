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

const source = {
  sourceId: "primary:1",
  adapterId: "primary",
  mediaKind: "video",
  externalId: "1",
  title: "Primary source",
  url: "https://example.com/primary-video",
  publisher: "Primary Publisher",
  author: "Expert",
  publishedAt: "2026-08-01T00:00:00.000Z",
  language: "en",
  summary: "Measured adoption increased by 25 percent.",
  thumbnailUrl: null,
  durationSec: 90,
  metrics: {},
  sourceMetadata: {},
};
const graph = {
  version: "0.10H-1B",
  sources: [source],
  claims: [
    { claimId: "claim-1", claimType: "FACT", text: "Adoption increased." },
  ],
  evidence: [
    {
      evidenceId: "evidence-1",
      sourceId: "primary:1",
      excerpt: "Measured adoption increased by 25 percent.",
      contextNote: null,
      locator: {
        section: null,
        page: null,
        timecodeStartSec: 10,
        timecodeEndSec: 18,
      },
    },
  ],
  links: [
    { claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" },
  ],
};
const sourceAssessments = [
  {
    sourceId: "primary:1",
    directness: "primary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
];
const scriptContext = {
  version: "0.10H-2E",
  editorialConstitution: "Ground factual claims.",
  readiness: { status: "ready", editorialReadinessScore: 90, reviewReasons: [] },
  claims: [],
  evidence: [],
  sources: [],
};
const binding = {
  version: "0.10H-2C",
  statements: [
    {
      statementId: "scene-1-speech",
      sceneId: 1,
      text: "Adoption increased by 25 percent.",
      evidenceMode: "required",
      claimReferences: [{ claimId: "claim-1", claimType: "FACT" }],
      supportingEvidenceIds: ["evidence-1"],
      supportingSourceIds: ["primary:1"],
      counterEvidenceIds: [],
      counterSourceIds: [],
      contextualEvidenceIds: [],
      contextualSourceIds: [],
      traceabilityStatus: "traceable",
    },
  ],
};

const fixtureDigest = "a".repeat(64);
const fixtureEvaluation = { success: true, projectId: "fixture-project", snapshotDigest: fixtureDigest, researchRevision: 1,
  readiness: { version: "0.10H-2B", status: "ready", editorialReadinessScore: 90, claimCount: 1, evidenceRequiredClaimCount: 1,
    supportedClaimCount: 1, unsupportedClaimIds: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [],
    counterEvidenceRecommendedClaimIds: [], counterEvidenceCoveredClaimIds: [], dimensions: { evidenceCoveragePct: 100,
      sourceUsabilityPct: 100, primarySourceCoveragePct: 100, counterEvidenceCoveragePct: 100, sourceDiversityCount: 1 }, reviewReasons: [] },
  verifiedLimitationClaimIds: [], review: { snapshotFingerprint: "fixture", claims: [], unresolvedClaimIds: [], nextActions: [] },
  blockingReasons: [], generationEligible: true };
const mockFetch = async (url, init) => {
  if (url === "/api/creator-research") {
    return jsonResponse({ success: true, sources: [source] });
  }
  if (url === "/api/creator-editorial-analysis") {
    return jsonResponse({
      success: true,
      graph,
      sourceAssessments,
      readiness: { status: "ready", editorialReadinessScore: 90 },
      sourceAuthoritySnapshotDigest: fixtureDigest,
      scriptContext,
    });
  }
  if (url === "/api/creator-evidence-evaluation") {
    const body = JSON.parse(String(init.body));
    assert.equal(body.projectId, "fixture-project"); assert.equal(body.snapshotDigest, fixtureDigest);
    return jsonResponse(fixtureEvaluation);
  }
  if (url === "/api/creator-script-plan") {
    return jsonResponse({
      success: true,
      productionPackage: {
        title: "Grounded package",
        scenes: [{ id: 1, narration: "Adoption increased by 25 percent." }],
        editorialEvidence: { binding, qa: { status: "ready" } },
      },
      scriptPlan: { editorialContext: { used: true } },
    });
  }
  return jsonResponse({ success: false, error: "unexpected" }, 500);
};

const result = await runCreatorEditorialScriptPipeline({
  accessToken: "token",
  topic: "Adoption",
  scriptPlanRequest: {
    projectId: "fixture-project",
    productionPackage: { scenes: [{ id: 1, narration: "Draft" }] },
  },
  fetchImpl: mockFetch,
  operationIsCurrent: () => true,
});

assert.equal(result.productionIntelligenceContexts.length, 1);
const sceneContext = result.productionIntelligenceContexts[0];
assert.equal(sceneContext.sceneId, "1");
assert.equal(sceneContext.documentarySourceContext.sourceReferenceCount, 1);
assert.equal(sceneContext.documentarySourceContext.sourceClipCandidateCount, 1);
assert.equal(sceneContext.documentarySourceContext.primarySourceClipCandidateCount, 1);
assert.deepEqual(sceneContext.documentarySourceContext.candidates, []);
assert.equal(sceneContext.evidenceVisualContext.dataVisualCandidate, true);
assert.equal(sceneContext.evidenceVisualContext.sourceCardCandidate, true);
assert.equal(sceneContext.evidenceVisualContext.quoteCardCandidate, false);

const safePayload = JSON.stringify(result.productionIntelligenceContexts);
assert.doesNotMatch(safePayload, /example\.com|claim-1|evidence-1|Primary Publisher|provider/i);

await assert.rejects(
  () => runCreatorEditorialScriptPipeline({
    accessToken: "token",
    topic: "Adoption",
    scriptPlanRequest: { projectId: "fixture-project" },
    operationIsCurrent: () => true,
    fetchImpl: async (url) => {
      if (url === "/api/creator-research") {
        return jsonResponse({ success: true, sources: [source] });
      }
      if (url === "/api/creator-editorial-analysis") {
        return jsonResponse({ success: true, scriptContext, sourceAuthoritySnapshotDigest: fixtureDigest });
      }
      if (url === "/api/creator-evidence-evaluation") return jsonResponse(fixtureEvaluation);
      if (url === "/api/creator-script-plan") {
        return jsonResponse({
          success: true,
          productionPackage: {
            scenes: [{ id: 1 }],
            editorialEvidence: { binding },
          },
          scriptPlan: {},
        });
      }
      return jsonResponse({ success: false }, 500);
    },
  }),
  (error) =>
    error instanceof CreatorEditorialPipelineError &&
    error.stage === "script_plan" &&
    error.code === "EDITORIAL_PIPELINE_PI_GRAPH_MISSING",
);

const helper = fs.readFileSync("lib/research/creatorEditorialPipeline.client.ts", "utf8");
assert.match(helper, /createCreatorSceneDocumentaryContext/);
assert.match(helper, /normalizeCreatorDocumentarySourcePlanningContext/);
assert.match(helper, /normalizeCreatorEvidenceVisualPlanningContext/);
assert.match(helper, /productionIntelligenceContexts/);
assert.match(helper, /EDITORIAL_PIPELINE_PI_GRAPH_MISSING/);
assert.doesNotMatch(helper, /providerRequestId|providerCostUsd|rawProviderPayload/);

console.log("Stage 0.10H-4H editorial PI context handoff tests passed.");
