import assert from "node:assert/strict";
import {
  createCreatorContentReadyAcceptance,
} from "../lib/creator/contentReadyAcceptance.ts";
import {
  createCreatorEvidenceGovernanceReport,
} from "../lib/creator/evidenceGovernance.ts";
import {
  createResearchEvidenceSnapshot,
} from "../lib/research/evidenceSnapshot.ts";
import {
  createCreatorNativeDerivative,
} from "../lib/research/nativeRepurposing.ts";
import {
  createScriptEvidenceBindingMap,
} from "../lib/research/scriptEvidenceBinding.ts";
import { createScriptQaReport } from "../lib/research/scriptEvidenceQa.ts";

const source = {
  sourceId: "primary:acceptance",
  adapterId: "primary",
  mediaKind: "document",
  externalId: "acceptance",
  title: "Acceptance evidence",
  url: "https://example.com/acceptance",
  publisher: "Example Publisher",
  author: "Example Author",
  publishedAt: "2026-08-20T00:00:00.000Z",
  language: "en",
  summary: "The finding improved, while a smaller sample showed uncertainty.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};
const snapshot = createResearchEvidenceSnapshot({
  snapshotId: "snapshot:content-ready",
  topic: "Content-ready acceptance",
  createdAt: "2026-08-30T00:00:00.000Z",
  graph: {
    version: "0.10H-1B",
    sources: [source],
    claims: [{
      claimId: "claim:acceptance",
      claimType: "RESEARCH_FINDING",
      text: "The finding improved with uncertainty.",
    }],
    evidence: [
      {
        evidenceId: "evidence:support",
        sourceId: source.sourceId,
        excerpt: "The finding improved",
        contextNote: null,
        locator: { section: "Results", page: 1, timecodeStartSec: null, timecodeEndSec: null },
      },
      {
        evidenceId: "evidence:context",
        sourceId: source.sourceId,
        excerpt: "showed uncertainty",
        contextNote: "Measurement context",
        locator: { section: "Method", page: 2, timecodeStartSec: null, timecodeEndSec: null },
      },
      {
        evidenceId: "evidence:counter",
        sourceId: source.sourceId,
        excerpt: "a smaller sample",
        contextNote: "Counterevidence",
        locator: { section: "Limits", page: 3, timecodeStartSec: null, timecodeEndSec: null },
      },
    ],
    links: [
      { claimId: "claim:acceptance", evidenceId: "evidence:support", stance: "supports" },
      { claimId: "claim:acceptance", evidenceId: "evidence:context", stance: "contextualizes" },
      { claimId: "claim:acceptance", evidenceId: "evidence:counter", stance: "contradicts" },
    ],
  },
  sourceAssessments: [{
    sourceId: source.sourceId,
    directness: "primary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  }],
});
const editorialBinding = createScriptEvidenceBindingMap({
  graph: snapshot.graph,
  statements: [{
    statementId: "statement:acceptance",
    sceneId: "scene:1",
    text: "The finding improved; however, a smaller sample showed uncertainty.",
    evidenceMode: "required",
    claimIds: ["claim:acceptance"],
  }],
});
const scriptQa = createScriptQaReport(editorialBinding);
assert.equal(scriptQa.status, "ready");
const sourceMedia = {
  metadataVersion: "0.10H-3A",
  sourceMediaKind: "document",
  sourceUrl: source.url,
  publisher: source.publisher,
  rightsholder: source.publisher,
  publishedAt: source.publishedAt,
  capturedAt: null,
  licenseId: "reviewed-license",
  licenseUrl: null,
  licenseSnapshotDate: null,
  attributionRequired: true,
  attributionText: "Source: Example Publisher",
  rightsState: "cleared",
  rightsReviewNote: "Reviewed for this use.",
  sourceDurationSec: null,
  timecodeStartSec: null,
  timecodeEndSec: null,
};
const evidenceGovernance = createCreatorEvidenceGovernanceReport({
  scriptQa,
  sourceMedia: [{ sourceId: source.sourceId, sourceMedia }],
});
assert.equal(evidenceGovernance.status, "ready");
const nativeShort = createCreatorNativeDerivative({
  derivativeId: "derivative:native-short",
  format: "short_reel",
  evidenceSnapshot: snapshot,
  claimIds: ["claim:acceptance"],
  structure: {
    format: "short_reel",
    hook: "The headline leaves out the most important detail.",
    microArgument: "The counterevidence changes how the result should be read.",
    pacingBeats: ["Finding", "Counterpoint", "Resolution"],
    payoff: "Keep the result and its uncertainty together.",
  },
  governedSourceMedia: [{ sourceId: source.sourceId, sourceMedia }],
});

const readyInput = {
  evidenceSnapshot: snapshot,
  editorialBinding,
  scriptQa,
  evidenceGovernance,
  requestedDerivativeFormats: ["short_reel"],
  derivatives: [nativeShort],
};
const beforeEvaluation = JSON.stringify(readyInput);
const ready = createCreatorContentReadyAcceptance(readyInput);
assert.equal(ready.status, "ready");
assert.equal(ready.ready, true);
assert.deepEqual(ready.reasons, []);
assert.deepEqual(ready.evidenceIdentity, {
  snapshotId: snapshot.snapshotId,
  fingerprint: snapshot.fingerprint,
  version: snapshot.version,
  graphVersion: snapshot.graphVersion,
});
assert.equal(JSON.stringify(readyInput), beforeEvaluation);

function reasonCodes(report) {
  return report.reasons.map((reason) => reason.code);
}

const missingEvidence = createCreatorContentReadyAcceptance({
  ...readyInput,
  evidenceSnapshot: null,
});
assert.equal(missingEvidence.status, "not_ready");
assert.ok(reasonCodes(missingEvidence).includes("EVIDENCE_SNAPSHOT_MISSING"));

const brokenSnapshot = structuredClone(snapshot);
brokenSnapshot.graph.links[0].evidenceId = "evidence:missing";
const brokenEvidence = createCreatorContentReadyAcceptance({
  ...readyInput,
  evidenceSnapshot: brokenSnapshot,
});
assert.ok(reasonCodes(brokenEvidence).includes("EVIDENCE_LINEAGE_BROKEN"));

const staleFingerprintSnapshot = structuredClone(snapshot);
staleFingerprintSnapshot.graph.claims[0].text = "Changed after the snapshot was frozen.";
const staleIdentity = createCreatorContentReadyAcceptance({
  ...readyInput,
  evidenceSnapshot: staleFingerprintSnapshot,
});
assert.ok(
  reasonCodes(staleIdentity).includes("EVIDENCE_SNAPSHOT_IDENTITY_INVALID"),
);

const incompleteEditorial = createCreatorContentReadyAcceptance({
  ...readyInput,
  editorialBinding: { version: "0.10H-2C", statements: [] },
});
assert.ok(reasonCodes(incompleteEditorial).includes("EDITORIAL_BINDING_INCOMPLETE"));

const inconsistentQa = createCreatorContentReadyAcceptance({
  ...readyInput,
  scriptQa: { ...scriptQa, statementCount: 99 },
});
assert.ok(reasonCodes(inconsistentQa).includes("EDITORIAL_QA_NOT_READY"));

const unresolvedGovernance = createCreatorContentReadyAcceptance({
  ...readyInput,
  evidenceGovernance: createCreatorEvidenceGovernanceReport({
    scriptQa,
    sourceMedia: [{
      sourceId: source.sourceId,
      sourceMedia: { ...sourceMedia, rightsState: "review_required" },
    }],
  }),
});
assert.ok(reasonCodes(unresolvedGovernance).includes("EVIDENCE_GOVERNANCE_NOT_READY"));

const incompleteShort = structuredClone(nativeShort);
incompleteShort.structure = {
  format: "short_reel",
  clipStartSec: 0,
  clipEndSec: 60,
};
const rejectedClip = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [incompleteShort],
});
assert.ok(reasonCodes(rejectedClip).includes("DERIVATIVE_INVALID"));

const unresolvedDerivativeMedia = structuredClone(nativeShort);
unresolvedDerivativeMedia.lineage.governedSourceMedia[0].sourceMedia.rightsState = "unknown";
const rejectedMedia = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [unresolvedDerivativeMedia],
});
assert.ok(
  reasonCodes(rejectedMedia).includes("SOURCE_MEDIA_GOVERNANCE_NOT_READY"),
);

const missingProvenanceDerivative = structuredClone(nativeShort);
missingProvenanceDerivative.lineage.governedSourceMedia[0].sourceMedia.sourceUrl = "";
const rejectedMissingProvenance = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [missingProvenanceDerivative],
});
assert.ok(
  reasonCodes(rejectedMissingProvenance).includes(
    "SOURCE_MEDIA_GOVERNANCE_NOT_READY",
  ),
);

const missingDerivative = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [],
});
assert.ok(reasonCodes(missingDerivative).includes("DERIVATIVE_MISSING"));

const wrongParentDerivative = structuredClone(nativeShort);
wrongParentDerivative.parentEvidence.fingerprint = "H1C-wrong-parent";
const wrongParent = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [wrongParentDerivative],
});
assert.deepEqual(reasonCodes(wrongParent), ["DERIVATIVE_PARENT_MISMATCH"]);

const incompleteLineageDerivative = structuredClone(nativeShort);
incompleteLineageDerivative.lineage.evidence = [];
incompleteLineageDerivative.lineage.links = [];
incompleteLineageDerivative.lineage.sources = [];
const rejectedIncompleteLineage = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [incompleteLineageDerivative],
});
assert.ok(
  reasonCodes(rejectedIncompleteLineage).includes("DERIVATIVE_INVALID"),
);

const alteredLineageDerivative = structuredClone(nativeShort);
alteredLineageDerivative.lineage.claims[0].text = "Altered derivative claim.";
const rejectedAlteredLineage = createCreatorContentReadyAcceptance({
  ...readyInput,
  derivatives: [alteredLineageDerivative],
});
assert.ok(reasonCodes(rejectedAlteredLineage).includes("DERIVATIVE_INVALID"));

const unsupported = createCreatorContentReadyAcceptance({
  ...readyInput,
  requestedDerivativeFormats: ["automatic_clip"],
});
assert.deepEqual(reasonCodes(unsupported), ["DERIVATIVE_REQUEST_UNSUPPORTED"]);
assert.equal(unsupported.reasons[0].subjectId, "automatic_clip");

const multiFailure = createCreatorContentReadyAcceptance({
  requestedDerivativeFormats: ["short_reel", "short_reel"],
  derivatives: [],
});
assert.deepEqual(reasonCodes(multiFailure), [
  "EVIDENCE_SNAPSHOT_MISSING",
  "EDITORIAL_BINDING_MISSING",
  "EDITORIAL_QA_MISSING",
  "EVIDENCE_GOVERNANCE_MISSING",
  "DERIVATIVE_MISSING",
]);
assert.equal(new Set(reasonCodes(multiFailure)).size, multiFailure.reasons.length);

assert.ok(nativeShort.lineage.links.some((link) => link.stance === "supports"));
assert.ok(nativeShort.lineage.links.some((link) => link.stance === "contextualizes"));
assert.ok(nativeShort.lineage.links.some((link) => link.stance === "contradicts"));
assert.equal(nativeShort.lineage.sourceAssessments[0].reviewStatus, "usable");

console.log("Stage 0.10H-7 content-ready acceptance tests passed.");
