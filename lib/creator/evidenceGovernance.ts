import type { CreatorSourceMediaMetadata } from "./sourceMedia.ts";
import type { ScriptQaReport } from "../research/scriptEvidenceQa.ts";

export const CREATOR_EVIDENCE_GOVERNANCE_VERSION = "0.10H-5A" as const;

export type CreatorEvidenceGovernanceStatus = "blocked" | "review" | "ready";
export type CreatorEvidenceGovernanceSeverity = "blocked" | "review";

export type CreatorEvidenceGovernanceIssueCode =
  | "UNSUPPORTED_CLAIM"
  | "MISSING_SOURCE"
  | "SOURCE_MISMATCH"
  | "RIGHTS_REVIEW_REQUIRED"
  | "SOURCE_RESTRICTED"
  | "ATTRIBUTION_REQUIRED"
  | "SYNTHETIC_DISCLOSURE_REQUIRED";

export type CreatorGovernedSourceMedia = {
  sourceId: string;
  sourceMedia: CreatorSourceMediaMetadata;
};

export type CreatorEvidenceGovernanceIssue = {
  code: CreatorEvidenceGovernanceIssueCode;
  severity: CreatorEvidenceGovernanceSeverity;
  subjectId: string;
  message: string;
};

export type CreatorEvidenceGovernanceInput = {
  scriptQa?: ScriptQaReport | null;
  sourceMedia?: readonly CreatorGovernedSourceMedia[] | null;
  missingSourceIds?: readonly string[] | null;
  mismatchedSourceIds?: readonly string[] | null;
  rightsReviewRequiredIds?: readonly string[] | null;
  syntheticMediaUsed?: boolean;
  syntheticDisclosurePresent?: boolean;
};

export type CreatorEvidenceGovernanceReport = {
  version: typeof CREATOR_EVIDENCE_GOVERNANCE_VERSION;
  status: CreatorEvidenceGovernanceStatus;
  requiresManualReview: boolean;
  blockedIssueCount: number;
  reviewIssueCount: number;
  issues: CreatorEvidenceGovernanceIssue[];
};

function cleanId(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 240)
    : "";
}

function uniqueIds(values: readonly string[] | null | undefined) {
  return [...new Set((values || []).map(cleanId).filter(Boolean))];
}

function addIssue(
  issues: CreatorEvidenceGovernanceIssue[],
  issue: CreatorEvidenceGovernanceIssue,
) {
  const key = `${issue.code}:${issue.subjectId}`;
  if (issues.some((item) => `${item.code}:${item.subjectId}` === key)) return;
  issues.push(issue);
}

/**
 * Aggregates existing evidence QA, source provenance/rights metadata, source
 * integrity findings and synthetic-disclosure state into one provider-neutral
 * governance report for the existing publish/final-production gate.
 *
 * This is not a legal-safety determination. License or attribution metadata does
 * not upgrade rightsState; only an explicitly reviewed `cleared` state is treated
 * as cleared. Review findings intentionally use "requires review" language.
 */
export function createCreatorEvidenceGovernanceReport(
  input: CreatorEvidenceGovernanceInput,
): CreatorEvidenceGovernanceReport {
  const issues: CreatorEvidenceGovernanceIssue[] = [];

  for (const qaIssue of input.scriptQa?.issues || []) {
    if (
      qaIssue.code === "STATEMENT_TRACEABILITY_REQUIRED" ||
      qaIssue.code === "STATEMENT_TRACEABILITY_PARTIAL"
    ) {
      addIssue(issues, {
        code: "UNSUPPORTED_CLAIM",
        severity: "blocked",
        subjectId: cleanId(qaIssue.statementId) || String(qaIssue.sceneId),
        message: "A claim lacks sufficient traceable support and must be resolved before publication.",
      });
    }
  }

  for (const sourceId of uniqueIds(input.missingSourceIds)) {
    addIssue(issues, {
      code: "MISSING_SOURCE",
      severity: "blocked",
      subjectId: sourceId,
      message: "A required supporting source is missing and must be restored or replaced before publication.",
    });
  }

  for (const sourceId of uniqueIds(input.mismatchedSourceIds)) {
    addIssue(issues, {
      code: "SOURCE_MISMATCH",
      severity: "blocked",
      subjectId: sourceId,
      message: "A source does not match the referenced evidence and must be corrected before publication.",
    });
  }

  for (const sourceId of uniqueIds(input.rightsReviewRequiredIds)) {
    addIssue(issues, {
      code: "RIGHTS_REVIEW_REQUIRED",
      severity: "review",
      subjectId: sourceId,
      message: "Media provenance or source-rights metadata is unresolved and requires review before publication.",
    });
  }

  const seenSourceIds = new Set<string>();
  for (const item of (input.sourceMedia || []).slice(0, 120)) {
    const sourceId = cleanId(item.sourceId);
    if (!sourceId || seenSourceIds.has(sourceId)) continue;
    seenSourceIds.add(sourceId);

    const metadata = item.sourceMedia;
    if (metadata.rightsState === "restricted") {
      addIssue(issues, {
        code: "SOURCE_RESTRICTED",
        severity: "blocked",
        subjectId: sourceId,
        message: "This source is marked restricted and must not proceed to publication in its current state.",
      });
    } else if (metadata.rightsState !== "cleared") {
      addIssue(issues, {
        code: "RIGHTS_REVIEW_REQUIRED",
        severity: "review",
        subjectId: sourceId,
        message: "This source-media rights state is unresolved and requires review before publication.",
      });
    }

    if (
      metadata.attributionRequired === true &&
      !metadata.attributionText.trim()
    ) {
      addIssue(issues, {
        code: "ATTRIBUTION_REQUIRED",
        severity: "review",
        subjectId: sourceId,
        message: "Required attribution is incomplete and requires review before publication.",
      });
    }
  }

  if (
    input.syntheticMediaUsed === true &&
    input.syntheticDisclosurePresent !== true
  ) {
    addIssue(issues, {
      code: "SYNTHETIC_DISCLOSURE_REQUIRED",
      severity: "review",
      subjectId: "project",
      message: "Synthetic media is present without a disclosure marker and requires review before publication.",
    });
  }

  const blockedIssueCount = issues.filter(
    (issue) => issue.severity === "blocked",
  ).length;
  const reviewIssueCount = issues.length - blockedIssueCount;
  const status: CreatorEvidenceGovernanceStatus = blockedIssueCount > 0
    ? "blocked"
    : reviewIssueCount > 0
      ? "review"
      : "ready";

  return {
    version: CREATOR_EVIDENCE_GOVERNANCE_VERSION,
    status,
    requiresManualReview: status !== "ready",
    blockedIssueCount,
    reviewIssueCount,
    issues,
  };
}
