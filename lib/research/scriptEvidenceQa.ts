import type { ResearchClaimType } from "./claimEvidenceGraph.ts";
import type { ScriptPlannerEditorialContext } from "./scriptPlannerEditorialContext.ts";
import type {
  ScriptEvidenceBindingMap,
  ScriptStatementEvidenceBinding,
} from "./scriptEvidenceBinding.ts";

export type ScriptQaIssueSeverity = "blocked" | "review";
export type ScriptQaIssueCode =
  | "STATEMENT_TRACEABILITY_REQUIRED"
  | "STATEMENT_TRACEABILITY_PARTIAL"
  | "EVIDENCE_MODE_MISMATCH"
  | "CLAIM_CERTAINTY_MISMATCH"
  | "COUNTER_EVIDENCE_NOT_REFLECTED";

export type ScriptQaIssue = {
  code: ScriptQaIssueCode;
  severity: ScriptQaIssueSeverity;
  statementId: string;
  sceneId: string | number;
  message: string;
};

export type ScriptQaReport = {
  version: "0.10H-2D";
  status: "blocked" | "review" | "ready";
  statementCount: number;
  blockedIssueCount: number;
  reviewIssueCount: number;
  issues: ScriptQaIssue[];
};

const UNCERTAINTY_SENSITIVE_CLAIM_TYPES = new Set<ResearchClaimType>([
  "EXPERT_OPINION",
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
]);

const EVIDENCE_REQUIRED_CLAIM_TYPES = new Set<ResearchClaimType>([
  "FACT",
  "PRIMARY_SOURCE_CLAIM",
  "RESEARCH_FINDING",
  "EXPERT_OPINION",
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
]);

const CERTAINTY_PATTERN = /\b(proves?|proven|definitely|certainly|undeniably|guaranteed|without doubt|will happen|must happen|kanıtlıyor|kanıtlanmıştır|kesinlikle|kesin olarak|şüphesiz|garantidir|kaçınılmazdır)\b/i;
const NUANCE_PATTERN = /\b(but|however|although|yet|while|may|might|could|suggests?|uncertain|uncertainty|alternative|on the other hand|ancak|fakat|oysa|bununla birlikte|olabilir|muhtemel|belirsiz|alternatif|öte yandan|iddia)\b/i;

function hasUncertaintySensitiveClaim(statement: ScriptStatementEvidenceBinding) {
  return statement.claimReferences.some((reference) =>
    UNCERTAINTY_SENSITIVE_CLAIM_TYPES.has(reference.claimType),
  );
}

function hasEvidenceRequiredClaim(statement: ScriptStatementEvidenceBinding) {
  return statement.claimReferences.some((reference) =>
    EVIDENCE_REQUIRED_CLAIM_TYPES.has(reference.claimType),
  );
}

/**
 * Lightweight rule-based script QA.
 *
 * This checks evidence traceability and editorial phrasing consistency. It does
 * not attempt to determine whether a claim is universally true or false, and it
 * is intentionally not a standalone contradiction/tension engine.
 */
export function createScriptQaReport(
  bindingMap: ScriptEvidenceBindingMap,
): ScriptQaReport {
  const issues: ScriptQaIssue[] = [];

  for (const statement of bindingMap.statements) {
    if (
      statement.evidenceMode === "required" &&
      statement.traceabilityStatus === "untraceable"
    ) {
      issues.push({
        code: "STATEMENT_TRACEABILITY_REQUIRED",
        severity: "blocked",
        statementId: statement.statementId,
        sceneId: statement.sceneId,
        message: "A statement that requires evidence has no supporting traceability.",
      });
    }

    if (
      statement.evidenceMode === "required" &&
      statement.traceabilityStatus === "partial"
    ) {
      issues.push({
        code: "STATEMENT_TRACEABILITY_PARTIAL",
        severity: "blocked",
        statementId: statement.statementId,
        sceneId: statement.sceneId,
        message: "Only part of this statement is traceable to supporting evidence.",
      });
    }

    if (
      statement.evidenceMode === "not_required" &&
      hasEvidenceRequiredClaim(statement)
    ) {
      issues.push({
        code: "EVIDENCE_MODE_MISMATCH",
        severity: "review",
        statementId: statement.statementId,
        sceneId: statement.sceneId,
        message: "A claim that normally requires evidence is marked as evidence-not-required.",
      });
    }

    if (
      hasUncertaintySensitiveClaim(statement) &&
      CERTAINTY_PATTERN.test(statement.text)
    ) {
      issues.push({
        code: "CLAIM_CERTAINTY_MISMATCH",
        severity: "review",
        statementId: statement.statementId,
        sceneId: statement.sceneId,
        message: "The wording is more certain than the referenced claim type supports.",
      });
    }

    if (
      statement.counterEvidenceIds.length > 0 &&
      !NUANCE_PATTERN.test(statement.text)
    ) {
      issues.push({
        code: "COUNTER_EVIDENCE_NOT_REFLECTED",
        severity: "review",
        statementId: statement.statementId,
        sceneId: statement.sceneId,
        message: "Material counter-evidence exists but the statement does not signal nuance or an alternative interpretation.",
      });
    }
  }

  const blockedIssueCount = issues.filter(
    (issue) => issue.severity === "blocked",
  ).length;
  const reviewIssueCount = issues.length - blockedIssueCount;

  return {
    version: "0.10H-2D",
    status: blockedIssueCount > 0 ? "blocked" : reviewIssueCount > 0 ? "review" : "ready",
    statementCount: bindingMap.statements.length,
    blockedIssueCount,
    reviewIssueCount,
    issues,
  };
}

/** Advisory only: section-level claim bindings cannot prove sentence-level attribution. */
export function reviewScriptResearchFidelity(input: {
  sections: Array<{ id: string; text: string; claimIds: string[] }>;
  context: ScriptPlannerEditorialContext;
}) {
  const issues: Array<{ sectionId: string; code: string; detail: string }> = [];
  for (const section of input.sections) {
    const claims = input.context.claims.filter((claim) => section.claimIds.includes(claim.claimId));
    const evidenceIds = new Set(claims.flatMap((claim) => [
      ...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds,
    ]));
    const evidence = input.context.evidence.filter((item) => evidenceIds.has(item.evidenceId));
    const sourceIds = new Set(evidence.map((item) => item.sourceId));
    const sources = input.context.sources.filter((source) => sourceIds.has(source.sourceId));
    const authority = [...claims.map((claim) => claim.text), ...evidence.flatMap((item) => [item.excerpt || "", item.contextNote || ""])].join(" ");
    const numbers = (text: string) => text.match(/\b\d+(?:[.,]\d+)*%?/g) || [];
    const supported = new Set(numbers(authority).map((value) => value.replace(/,$/, "")));
    for (const value of new Set(numbers(section.text))) {
      if (!supported.has(value)) issues.push({ sectionId: section.id, code: "NUMERIC_ATTRIBUTION_REVIEW", detail: `Verify ${value} against the linked evidence and its population and study period.` });
    }
    if (sources.length > 1) issues.push({ sectionId: section.id, code: "MULTIPLE_SOURCE_ATTRIBUTION_REVIEW", detail: "Verify each finding, date and limitation belongs to the correct study; publication dates do not establish study dates." });
    if (/\b(?:because|caused by|resulted from|due to)\b/i.test(section.text)) issues.push({ sectionId: section.id, code: "CAUSAL_ATTRIBUTION_REVIEW", detail: "Verify any causal explanation against the linked passages and study context." });
    if (claims.length && evidence.length === 0) issues.push({ sectionId: section.id, code: "RESEARCH_IDENTITY_REVIEW", detail: "No source-bound passage was found for this section's claims." });
  }
  return { status: issues.length ? "review" as const : "no_flags" as const, issues };
}
