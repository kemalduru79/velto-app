import type { ReviewReport } from "./contracts.ts";

/** Exception-first report. Results are SIMULATED; never an expert certification. */
export function createOwnerBrief(report: ReviewReport): string {
  const exceptions = report.assessments.filter((item) =>
    item.preliminaryDecision !== "PRELIMINARY_PASS" || item.disagreement || item.evidenceLimitations.length);
  const rows = exceptions.map((item) =>
    `| ${item.claimId} | ${item.preliminaryDecision} | ${item.disagreement ? "YES" : "NO"} | ${item.evidenceLimitations.join(", ") || "—"} |`);
  return [
    "# Stage 5E1F — Owner Decision Brief (OFFLINE SIMULATION)", "",
    "**NOT AN INDEPENDENT SCIENTIFIC REVIEW OR HUMAN APPROVAL. LIVE NO-GO.**", "",
    `Run: ${report.runId}`,
    `Claims: ${report.claimCount}; Mock judgments: ${report.reviewCount}`,
    `Preliminary counts: ${JSON.stringify(report.counts)}`,
    `Modeled reserved cost: $${report.modeledReservedUsd.toFixed(6)}; actual provider spend: $0`,
    "Independence: NOT_ESTABLISHED_OFFLINE_MOCK", "",
    "## Exception queue", "",
    "| Claim | Decision | Reviewer disagreement | Evidence limitations |",
    "| --- | --- | --- | --- |",
    ...rows,
    ...(rows.length ? [] : ["| — | No simulated exceptions | — | — |"]),
    "", "Human scientific sign-off and source-level scientific verification remain mandatory.", "",
  ].join("\n");
}
