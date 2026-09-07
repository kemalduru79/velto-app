import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
} from "../lib/research/editorialGroundingRepair.ts";
import { normalizeScriptPlannerEditorialContext } from "../lib/research/scriptPlannerEditorialContext.ts";

const source = {
  sourceId: "web:production-repro",
  adapterId: "web",
  mediaKind: "article",
  externalId: "production-repro",
  title: "Production evidence fixture",
  url: "https://example.test/production-repro",
  publisher: "Fixture",
  author: null,
  publishedAt: null,
  language: "en",
  summary: "Canonical opening context. Evidence two supports both grounded statements. Canonical closing context.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};
const proposal = {
  claims: [
    { claimId: "claim-1", claimType: "FACT", text: "The first grounded statement." },
    { claimId: "claim-2", claimType: "FACT", text: "The second grounded statement." },
  ],
  evidence: [{
    evidenceId: "evidence-2",
    sourceId: source.sourceId,
    excerpt: "Paraphrased evidence not present in the source.",
    contextNote: "Shared canonical support",
  }],
  links: [
    { claimId: "claim-1", evidenceId: "evidence-2", stance: "supports" },
    { claimId: "claim-2", evidenceId: "evidence-2", stance: "supports" },
  ],
};
const spans = createEditorialGroundingCandidateSpans([source]);
const selected = spans.find((span) => span.text.includes("Evidence two"));
const conflicting = spans.find((span) => span.spanId !== selected?.spanId);
assert.ok(selected);
assert.ok(conflicting);

let repairCalls = 0;
const graph = await createValidatedEditorialAnalysisWithOneRepair({
  sources: [source],
  proposal,
  repair: async (input) => {
    repairCalls += 1;
    assert.equal(input.invalidEvidence.length, 1);
    assert.deepEqual(input.invalidEvidence[0].linkedClaims.map((claim) => claim.claimId), ["claim-1", "claim-2"]);
    return {
      repairs: [
        { evidenceId: "evidence-2", spanId: selected.spanId },
        { evidenceId: "evidence-2", spanId: selected.spanId },
      ],
    };
  },
});
assert.equal(repairCalls, 1);
assert.equal(graph.evidence[0].excerpt, selected.text);
assert.equal(graph.evidence[0].sourceId, source.sourceId);
assert.deepEqual(graph.links.map((link) => link.claimId), ["claim-1", "claim-2"]);

const editorialContext = normalizeScriptPlannerEditorialContext({
  version: "0.10H-2E",
  editorialConstitution: "Use only canonical evidence and preserve source identity.",
  readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [] },
  claims: graph.claims.map((claim) => ({
    ...claim,
    supportingEvidenceIds: graph.links
      .filter((link) => link.claimId === claim.claimId && link.stance === "supports")
      .map((link) => link.evidenceId),
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  })),
  evidence: graph.evidence,
  sources: [{
    sourceId: source.sourceId,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    author: source.author,
    publishedAt: source.publishedAt,
    directness: "primary",
    reviewStatus: "usable",
  }],
});
assert.ok(editorialContext);
const creatorScript = createCreatorScript({
  title: "Valid shared-evidence script",
  sections: [
    { id: "opening", kind: "opening", text: "Opening.", claimIds: ["claim-1"], evidenceReviewRequired: false },
    { id: "body", kind: "body", text: "Body.", claimIds: ["claim-2"], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", text: "Conclusion.", claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 60,
  strategyFingerprint: "hotfix-fixture",
  grounding: { context: editorialContext },
  generatedAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
});
assert.deepEqual(
  creatorScript.grounding.context.claims.map((claim) => claim.supportingEvidenceIds),
  [["evidence-2"], ["evidence-2"]],
);
assert.equal(creatorScript.grounding.context.evidence[0].excerpt, selected.text);

await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources: [source],
    proposal,
    repair: async () => ({ repairs: [
      { evidenceId: "evidence-2", spanId: selected.spanId },
      { evidenceId: "evidence-2", spanId: conflicting.spanId },
    ] }),
  }),
  /EDITORIAL_GROUNDING_REPAIR_CONFLICTING_SPANS:evidence-2/,
);
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({ sources: [source], proposal, repair: async () => ({ repairs: [{ evidenceId: "unknown", spanId: selected.spanId }] }) }),
  /EDITORIAL_GROUNDING_REPAIR_EVIDENCE_MISSING/,
);
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({ sources: [source], proposal, repair: async () => ({ repairs: [{ evidenceId: "evidence-2", spanId: "unknown" }] }) }),
  /EDITORIAL_GROUNDING_REPAIR_SPAN_MISSING/,
);

const route = fs.readFileSync("app/api/creator-editorial-analysis/route.ts", "utf8");
assert.match(route, /code: "EDITORIAL_ANALYSIS_GROUNDING_FAILED"/);
assert.match(route, /Evidence validation could not be completed\. Please retry\./);
assert.match(route, /detailCode: diagnostic/);
assert.match(route, /console\.error\("CREATOR_EDITORIAL_GROUNDING_FAILED"/);

console.log("POST_0_13B_DUPLICATE_EVIDENCE_HOTFIX=PASS");
