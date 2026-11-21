import type { MockReviewer, ReviewDecision, ReviewerTask } from "./contracts.ts";

/** Strictly for acceptance tests, never scientific review. */
export function createSyntheticReviewer(
  chooseDecision: (task: ReviewerTask) => ReviewDecision = () => "PRELIMINARY_PASS",
): MockReviewer {
  return {
    kind: "offline_mock",
    async review(task) {
      const decision = chooseDecision(task);
      return {
        claimId: task.claimId, role: task.role, decision,
        citedEvidenceIds: task.evidence.map((item) => item.evidenceId),
        rationale: "SYNTHETIC TEST OUTPUT ONLY — no scientific inference was performed.",
        uncertainties: ["Mock result; independent model reasoning was not performed."],
        recommendedCorrections: [],
      };
    },
  };
}
