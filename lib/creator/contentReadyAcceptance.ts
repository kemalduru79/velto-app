import {
  createCreatorEvidenceGovernanceReport,
  type CreatorEvidenceGovernanceReport,
} from "./evidenceGovernance.ts";
import { normalizeCreatorSourceMediaMetadata } from "./sourceMedia.ts";
import type { ResearchEvidenceSnapshot } from "../research/evidenceSnapshot.ts";
import { hasResearchEvidenceSnapshotFingerprintIntegrity } from "../research/evidenceSnapshot.ts";
import type {
  CreatorNativeDerivative,
  CreatorNativeDerivativeFormat,
  CreatorNativeDerivativeStructure,
} from "../research/nativeRepurposing.ts";
import type { ScriptEvidenceBindingMap } from "../research/scriptEvidenceBinding.ts";
import type { ScriptQaReport } from "../research/scriptEvidenceQa.ts";

export const CREATOR_CONTENT_READY_ACCEPTANCE_VERSION = "0.10H-7" as const;

export type CreatorContentAcceptanceReasonCode =
  | "EVIDENCE_SNAPSHOT_MISSING"
  | "EVIDENCE_SNAPSHOT_IDENTITY_INVALID"
  | "EVIDENCE_LINEAGE_BROKEN"
  | "EDITORIAL_BINDING_MISSING"
  | "EDITORIAL_BINDING_INCOMPLETE"
  | "EDITORIAL_QA_MISSING"
  | "EDITORIAL_QA_NOT_READY"
  | "EVIDENCE_GOVERNANCE_MISSING"
  | "EVIDENCE_GOVERNANCE_NOT_READY"
  | "DERIVATIVE_REQUEST_UNSUPPORTED"
  | "DERIVATIVE_MISSING"
  | "DERIVATIVE_INVALID"
  | "DERIVATIVE_PARENT_MISMATCH"
  | "SOURCE_MEDIA_GOVERNANCE_NOT_READY";

export type CreatorContentAcceptanceReason = {
  code: CreatorContentAcceptanceReasonCode;
  subjectId: string;
};

export type CreatorContentReadyAcceptanceReport = {
  version: typeof CREATOR_CONTENT_READY_ACCEPTANCE_VERSION;
  status: "ready" | "not_ready";
  ready: boolean;
  evidenceIdentity: {
    snapshotId: string;
    fingerprint: string;
    version: string;
    graphVersion: string;
  } | null;
  reasons: CreatorContentAcceptanceReason[];
};

const DERIVATIVE_FORMATS = new Set<CreatorNativeDerivativeFormat>([
  "youtube_long_form",
  "podcast",
  "short_reel",
  "carousel_text",
]);

function text(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function addReason(
  reasons: CreatorContentAcceptanceReason[],
  code: CreatorContentAcceptanceReasonCode,
  subjectId: string,
) {
  if (!reasons.some((reason) =>
    reason.code === code && reason.subjectId === subjectId
  )) reasons.push({ code, subjectId });
}

function hasValidEvidenceLineage(snapshot: ResearchEvidenceSnapshot) {
  if (
    snapshot.version !== "0.10H-1C" ||
    snapshot.graphVersion !== "0.10H-1B" ||
    !text(snapshot.snapshotId) ||
    !text(snapshot.topic) ||
    !text(snapshot.createdAt) ||
    !Array.isArray(snapshot.graph?.sources) ||
    !Array.isArray(snapshot.graph?.claims) ||
    !Array.isArray(snapshot.graph?.evidence) ||
    !Array.isArray(snapshot.graph?.links) ||
    !Array.isArray(snapshot.sourceAssessments) ||
    snapshot.graph.claims.length === 0
  ) return false;

  const sourceIds = new Set(snapshot.graph.sources.map((source) => source.sourceId));
  const claimIds = new Set(snapshot.graph.claims.map((claim) => claim.claimId));
  const evidenceIds = new Set(snapshot.graph.evidence.map((item) => item.evidenceId));
  if (
    sourceIds.size !== snapshot.graph.sources.length ||
    claimIds.size !== snapshot.graph.claims.length ||
    evidenceIds.size !== snapshot.graph.evidence.length
  ) return false;
  if (snapshot.graph.evidence.some((item) => !sourceIds.has(item.sourceId))) {
    return false;
  }
  if (snapshot.graph.links.some((link) =>
    !claimIds.has(link.claimId) || !evidenceIds.has(link.evidenceId)
  )) return false;
  const assessmentIds = new Set(
    snapshot.sourceAssessments.map((assessment) => assessment.sourceId),
  );
  if (
    assessmentIds.size !== snapshot.sourceAssessments.length ||
    snapshot.sourceAssessments.some((assessment) =>
    !sourceIds.has(assessment.sourceId)
    )
  ) return false;
  return true;
}

function hasCompleteEditorialBinding(
  binding: ScriptEvidenceBindingMap,
  snapshot: ResearchEvidenceSnapshot,
) {
  if (binding.version !== "0.10H-2C" || binding.statements.length === 0) {
    return false;
  }
  const claimIds = new Set(snapshot.graph.claims.map((claim) => claim.claimId));
  const evidenceIds = new Set(snapshot.graph.evidence.map((item) => item.evidenceId));
  const sourceIds = new Set(snapshot.graph.sources.map((source) => source.sourceId));
  return binding.statements.every((statement) =>
    text(statement.statementId) &&
    text(String(statement.sceneId)) &&
    text(statement.text) &&
    (statement.evidenceMode === "not_required" || (
      statement.traceabilityStatus === "traceable" &&
      statement.claimReferences.length > 0 &&
      statement.supportingEvidenceIds.length > 0 &&
      statement.supportingSourceIds.length > 0
    )) &&
    statement.claimReferences.every((claim) => claimIds.has(claim.claimId)) &&
    [
      ...statement.supportingEvidenceIds,
      ...statement.counterEvidenceIds,
      ...statement.contextualEvidenceIds,
    ].every((evidenceId) => evidenceIds.has(evidenceId)) &&
    [
      ...statement.supportingSourceIds,
      ...statement.counterSourceIds,
      ...statement.contextualSourceIds,
    ].every((sourceId) => sourceIds.has(sourceId))
  );
}

function hasNativeStructure(structureValue: unknown) {
  if (!structureValue || typeof structureValue !== "object" || Array.isArray(structureValue)) {
    return false;
  }
  const structure = structureValue as Partial<CreatorNativeDerivativeStructure> &
    Record<string, unknown>;
  switch (structure.format) {
    case "youtube_long_form":
      return text(structure.hook) && Array.isArray(structure.sections) &&
        structure.sections.length > 0 &&
        structure.sections.every(text) && text(structure.closing);
    case "podcast":
      return text(structure.opening) && Array.isArray(structure.segments) &&
        structure.segments.length > 0 &&
        structure.segments.every(text) && text(structure.closing);
    case "short_reel":
      return text(structure.hook) && text(structure.microArgument) &&
        Array.isArray(structure.pacingBeats) &&
        structure.pacingBeats.length > 0 &&
        structure.pacingBeats.every(text) && text(structure.payoff);
    case "carousel_text":
      return text(structure.title) && Array.isArray(structure.slides) &&
        structure.slides.length > 0 &&
        structure.slides.every(text) && text(structure.closingCaption);
    default:
      return false;
  }
}

function derivativeLineageValid(
  derivative: CreatorNativeDerivative,
  snapshot: ResearchEvidenceSnapshot,
) {
  if (!derivative.lineage || !derivative.structure) return false;
  const parentClaimById = new Map(
    snapshot.graph.claims.map((claim) => [claim.claimId, claim]),
  );
  const selectedClaimIds = new Set(
    derivative.lineage.claims.map((claim) => claim.claimId),
  );
  const expectedLinks = snapshot.graph.links.filter((link) =>
    selectedClaimIds.has(link.claimId)
  );
  const expectedEvidenceIds = new Set(
    expectedLinks.map((link) => link.evidenceId),
  );
  const expectedEvidence = snapshot.graph.evidence.filter((item) =>
    expectedEvidenceIds.has(item.evidenceId)
  );
  const expectedSourceIds = new Set(
    expectedEvidence.map((item) => item.sourceId),
  );
  const expectedSources = snapshot.graph.sources.filter((source) =>
    expectedSourceIds.has(source.sourceId)
  );
  const expectedAssessments = snapshot.sourceAssessments.filter((assessment) =>
    expectedSourceIds.has(assessment.sourceId)
  );
  return derivative.version === "0.10H-6" &&
    derivative.researchPolicy === "reuse_parent_evidence" &&
    derivative.structure.format === derivative.format &&
    hasNativeStructure(derivative.structure) &&
    derivative.lineage.claims.length > 0 &&
    derivative.lineage.claims.every((claim) =>
      sameValue(claim, parentClaimById.get(claim.claimId))
    ) &&
    sameValue(derivative.lineage.evidence, expectedEvidence) &&
    sameValue(derivative.lineage.links, expectedLinks) &&
    sameValue(derivative.lineage.sources, expectedSources) &&
    sameValue(derivative.lineage.sourceAssessments, expectedAssessments) &&
    derivative.lineage.governedSourceMedia.every((item) =>
      expectedSourceIds.has(item.sourceId)
    );
}

function derivativeMediaGovernanceReady(derivative: CreatorNativeDerivative) {
  try {
    const sourceMedia = derivative.lineage.governedSourceMedia.map((item) => {
      const normalized = normalizeCreatorSourceMediaMetadata(item.sourceMedia);
      if (!sameValue(item.sourceMedia, normalized)) {
        throw new Error("SOURCE_MEDIA_METADATA_NOT_CANONICAL");
      }
      return { sourceId: item.sourceId, sourceMedia: normalized };
    });
    return createCreatorEvidenceGovernanceReport({
      sourceMedia,
    }).status === "ready";
  } catch {
    return false;
  }
}

export function createCreatorContentReadyAcceptance(input: {
  evidenceSnapshot?: ResearchEvidenceSnapshot | null;
  editorialBinding?: ScriptEvidenceBindingMap | null;
  scriptQa?: ScriptQaReport | null;
  evidenceGovernance?: CreatorEvidenceGovernanceReport | null;
  requestedDerivativeFormats?: readonly CreatorNativeDerivativeFormat[];
  derivatives?: readonly CreatorNativeDerivative[];
}): CreatorContentReadyAcceptanceReport {
  const reasons: CreatorContentAcceptanceReason[] = [];
  const snapshot = input.evidenceSnapshot || null;

  if (!snapshot) {
    addReason(reasons, "EVIDENCE_SNAPSHOT_MISSING", "content");
  } else if (!hasValidEvidenceLineage(snapshot)) {
    addReason(reasons, "EVIDENCE_LINEAGE_BROKEN", snapshot.snapshotId || "content");
  } else if (!hasResearchEvidenceSnapshotFingerprintIntegrity(snapshot)) {
    addReason(
      reasons,
      "EVIDENCE_SNAPSHOT_IDENTITY_INVALID",
      snapshot.snapshotId,
    );
  }

  if (!input.editorialBinding) {
    addReason(reasons, "EDITORIAL_BINDING_MISSING", "content");
  } else if (!snapshot || !hasCompleteEditorialBinding(input.editorialBinding, snapshot)) {
    addReason(reasons, "EDITORIAL_BINDING_INCOMPLETE", "content");
  }

  if (!input.scriptQa) {
    addReason(reasons, "EDITORIAL_QA_MISSING", "content");
  } else if (
    input.scriptQa.version !== "0.10H-2D" ||
    input.scriptQa.status !== "ready" ||
    input.scriptQa.issues.length !== 0 ||
    input.scriptQa.blockedIssueCount !== 0 ||
    input.scriptQa.reviewIssueCount !== 0 ||
    input.scriptQa.statementCount !== input.editorialBinding?.statements.length
  ) {
    addReason(reasons, "EDITORIAL_QA_NOT_READY", "content");
  }

  if (!input.evidenceGovernance) {
    addReason(reasons, "EVIDENCE_GOVERNANCE_MISSING", "content");
  } else if (
    input.evidenceGovernance.version !== "0.10H-5A" ||
    input.evidenceGovernance.status !== "ready" ||
    input.evidenceGovernance.requiresManualReview ||
    input.evidenceGovernance.blockedIssueCount !== 0 ||
    input.evidenceGovernance.reviewIssueCount !== 0 ||
    input.evidenceGovernance.issues.length !== 0
  ) {
    addReason(reasons, "EVIDENCE_GOVERNANCE_NOT_READY", "content");
  }

  const derivatives = input.derivatives || [];
  for (const requestedFormat of input.requestedDerivativeFormats || []) {
    if (!DERIVATIVE_FORMATS.has(requestedFormat)) {
      addReason(reasons, "DERIVATIVE_REQUEST_UNSUPPORTED", String(requestedFormat));
      continue;
    }
    const matchingDerivatives = derivatives.filter((derivative) =>
      derivative.format === requestedFormat
    );
    if (matchingDerivatives.length === 0) {
      addReason(reasons, "DERIVATIVE_MISSING", requestedFormat);
      continue;
    }
    if (matchingDerivatives.length > 1) {
      addReason(reasons, "DERIVATIVE_INVALID", requestedFormat);
      continue;
    }
    const derivative = matchingDerivatives[0];
    if (
      !snapshot ||
      derivative.parentEvidence?.snapshotId !== snapshot.snapshotId ||
      derivative.parentEvidence?.fingerprint !== snapshot.fingerprint ||
      derivative.parentEvidence?.version !== snapshot.version ||
      derivative.parentEvidence?.graphVersion !== snapshot.graphVersion
    ) {
      addReason(reasons, "DERIVATIVE_PARENT_MISMATCH", derivative.derivativeId);
      continue;
    }
    if (!derivativeLineageValid(derivative, snapshot)) {
      addReason(reasons, "DERIVATIVE_INVALID", derivative.derivativeId);
    }
    if (!derivativeMediaGovernanceReady(derivative)) {
      addReason(
        reasons,
        "SOURCE_MEDIA_GOVERNANCE_NOT_READY",
        derivative.derivativeId,
      );
    }
  }

  const ready = reasons.length === 0;
  return {
    version: CREATOR_CONTENT_READY_ACCEPTANCE_VERSION,
    status: ready ? "ready" : "not_ready",
    ready,
    evidenceIdentity: snapshot
      ? {
          snapshotId: snapshot.snapshotId,
          fingerprint: snapshot.fingerprint,
          version: snapshot.version,
          graphVersion: snapshot.graphVersion,
        }
      : null,
    reasons,
  };
}
