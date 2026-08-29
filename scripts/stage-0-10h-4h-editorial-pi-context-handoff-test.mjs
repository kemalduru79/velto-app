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

const mockFetch = async (url) => {
  if (url === "/api/creator-research") {
    return jsonResponse({ success: true, sources: [source] });
  }
  if (url === "/api/creator-editorial-analysis") {
    return jsonResponse({
      success: true,
      graph,
      sourceAssessments,
      readiness: { status: "ready", editorialReadinessScore: 90 },
      scriptContext,
    });
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
    productionPackage: { scenes: [{ id: 1, narration: "Draft" }] },
  },
  fetchImpl: mockFetch,
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
    scriptPlanRequest: {},
    fetchImpl: async (url) => {
      if (url === "/api/creator-research") {
        return jsonResponse({ success: true, sources: [source] });
      }
      if (url === "/api/creator-editorial-analysis") {
        return jsonResponse({ success: true, scriptContext });
      }
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
