/** Offline-only deterministic orchestrator; NO API transport, NO live-dispatch code. */
import path from "node:path";
import {
  REVIEW_ROLES, SCIENTIFIC_REVIEW_VERSION, scientificReviewFail, validateJudgment,
} from "./contracts.ts";
import type {
  ScientificReviewInput, ScientificSourceMaterial, MockReviewer, ReviewerRole,
  ReviewerTask, ReviewerJudgment, CostPolicy, ClaimAssessment, ReviewDecision, ReviewReport,
  VerifiedPassage,
} from "./contracts.ts";
import { sha256, validateScientificEvidence } from "./evidence.ts";
import { OfflineScientificReviewLedger, validateCostPolicy } from "./ledger.ts";
import { createOwnerBrief } from "./reports.ts";

function recursiveFreeze<T>(v: T): Readonly<T> {
  if (v && typeof v === "object") {
    Object.values(v as object).forEach((part) => recursiveFreeze(part));
    Object.freeze(v);
  }
  return v;
}

function otherRole(primary: ReviewerRole): ReviewerRole {
  return REVIEW_ROLES[(REVIEW_ROLES.indexOf(primary) + 1) % REVIEW_ROLES.length];
}

function assess(
  primary: ReviewerJudgment, adversarial: ReviewerJudgment, evidence: readonly VerifiedPassage[],
): { decision: ReviewDecision; disagreement: boolean; limitations: string[] } {
  const limitations = evidence
    .filter((item) => item.provenance !== "utf8_document_exact_byte_match")
    .map((item) => `UNVERIFIED_PDF_LOCATOR:${item.evidenceId}`);
  const disagreement = primary.decision !== adversarial.decision ||
    primary.citedEvidenceIds.join("|") !== adversarial.citedEvidenceIds.join("|");
  let decision: ReviewDecision;
  if (primary.decision === "BLOCK" || adversarial.decision === "BLOCK") decision = "BLOCK";
  else if (primary.decision === "INSUFFICIENT_EVIDENCE" || adversarial.decision === "INSUFFICIENT_EVIDENCE" || limitations.length) {
    decision = "INSUFFICIENT_EVIDENCE";
  } else if (primary.decision === "REVISE" || adversarial.decision === "REVISE" || disagreement) {
    decision = "REVISE";
  } else decision = "PRELIMINARY_PASS";
  return { decision, disagreement, limitations };
}

export async function runOfflineScientificReview(args: Readonly<{
  input: ScientificReviewInput;
  materials: readonly ScientificSourceMaterial[];
  reviewer: MockReviewer;
  costPolicy: CostPolicy;
  runDirectory: string;
}>): Promise<ReviewReport> {
  if (args.reviewer?.kind !== "offline_mock" || typeof args.reviewer.review !== "function") {
    scientificReviewFail("LIVE_OR_UNKNOWN_REVIEWER_FORBIDDEN");
  }
  if (!path.isAbsolute(args.runDirectory)) scientificReviewFail("OUTPUT_PATH_MUST_BE_ABSOLUTE");
  const verified = validateScientificEvidence(args.input, args.materials);
  const costPerCall = validateCostPolicy(args.costPolicy);
  const requiredCalls = args.input.claims.length * 2;
  if (requiredCalls > args.costPolicy.maximumCalls ||
      requiredCalls * costPerCall > args.costPolicy.maximumModeledUsd + 1e-10) {
    scientificReviewFail("PRECHECK_MODELED_BUDGET_INSUFFICIENT");
  }
  // Only hash the normalized public input, not private document bytes.
  const inputHash = sha256(JSON.stringify(args.input));
  const ledger = await OfflineScientificReviewLedger.create(args.runDirectory, args.input.runId, args.costPolicy, inputHash);
  const assessments: ClaimAssessment[] = [];

  for (const claim of args.input.claims) {
    const claimEvidence = claim.evidenceIds.map((id) => {
      const item = verified.get(id);
      if (!item) scientificReviewFail("CLAIM_EVIDENCE_LOOKUP_MISSING");
      return item;
    });
    const executeReviewer = async (role: ReviewerRole, side: "primary" | "adversarial") => {
      // Distinct request object with NO preceding reviewer output.
      const task: ReviewerTask = recursiveFreeze(structuredClone({
        version: SCIENTIFIC_REVIEW_VERSION,
        runId: args.input.runId,
        claimId: claim.claimId,
        claimText: claim.claimText,
        role,
        assessmentSide: side,
        evidence: claimEvidence,
        scientificLimitations: claim.scientificLimitations,
      }));
      const ordinal = await ledger.authorizeBeforeDispatch(task);
      const raw = await args.reviewer.review(task);
      const judgment = validateJudgment(raw, task);
      await ledger.recordOutcome(ordinal, judgment);
      return judgment;
    };
    const primary = await executeReviewer(claim.primaryRole, "primary");
    const adversarial = await executeReviewer(otherRole(claim.primaryRole), "adversarial");
    const outcome = assess(primary, adversarial, claimEvidence);
    assessments.push(recursiveFreeze({
      claimId: claim.claimId, primary, adversarial,
      preliminaryDecision: outcome.decision, disagreement: outcome.disagreement,
      independence: "NOT_ESTABLISHED_OFFLINE_MOCK",
      evidenceLimitations: outcome.limitations,
    }));
  }
  const counts: Record<ReviewDecision, number> = {
    PRELIMINARY_PASS: 0, REVISE: 0, BLOCK: 0, INSUFFICIENT_EVIDENCE: 0,
  };
  assessments.forEach((a) => counts[a.preliminaryDecision]++);
  const report: ReviewReport = recursiveFreeze({
    version: SCIENTIFIC_REVIEW_VERSION,
    runId: args.input.runId,
    mode: "OFFLINE_MOCK_ONLY",
    status: "PRELIMINARY_SIMULATION_NO_SCIENTIFIC_AUTHORITY",
    counts,
    claimCount: args.input.claims.length,
    reviewCount: ledger.consumedCalls,
    modeledReservedUsd: ledger.modeledReservedUsd,
    actualProviderSpendUsd: 0,
    assessments,
    liveAuthorization: false,
    independentHumanApproval: false,
  });
  await ledger.finish(report, createOwnerBrief(report));
  return report;
}
