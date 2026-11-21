export const CREATOR_SCRIPT_REFINEMENT_ACCEPTANCE_STAGES = [
  "research_acquisition",
  "source_passage_verification",
  "script_rewriting",
  "claim_evidence_assessment",
  "editorial_goal_assessment",
  "proposal_validation",
  "persistence",
] as const;

export type CreatorScriptRefinementAcceptanceStage = typeof CREATOR_SCRIPT_REFINEMENT_ACCEPTANCE_STAGES[number];
export type CreatorScriptRefinementAcceptanceStatus = "READY_FOR_CONTROLLED_LIVE_ACCEPTANCE" | "REVIEW_REQUIRED" | "BLOCKED";

export type CreatorScriptRefinementStageResult = {
  stage: CreatorScriptRefinementAcceptanceStage;
  status: "completed" | "failed" | "timed_out" | "interrupted";
  elapsedMs: number;
  diagnostic: string | null;
};

export function createCreatorScriptRefinementAcceptanceObserver(input: { now?: () => number; routeBudgetMs?: number } = {}) {
  const now = input.now || (() => performance.now());
  const routeBudgetMs = input.routeBudgetMs ?? 300_000;
  const results: CreatorScriptRefinementStageResult[] = [];
  const run = async <T>(stage: CreatorScriptRefinementAcceptanceStage, operation: () => Promise<T>): Promise<T> => {
    const startedAt = now();
    try {
      const value = await operation();
      results.push({ stage, status: "completed", elapsedMs: Math.max(0, now() - startedAt), diagnostic: null });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      const status = /TIMEOUT/u.test(message) ? "timed_out" : /INTERRUPT|ABORT/u.test(message) ? "interrupted" : "failed";
      results.push({ stage, status, elapsedMs: Math.max(0, now() - startedAt), diagnostic: message });
      throw error;
    }
  };
  const report = (checks: { evidenceFidelity: boolean; claimAuthority: boolean; lifecycle: boolean; casPersistence: boolean; scriptSceneIntegrity: boolean; liveProviderVerified: boolean }) => {
    const totalElapsedMs = results.reduce((sum, result) => sum + result.elapsedMs, 0);
    const failed = results.some((result) => result.status !== "completed");
    const requiredChecksPass = checks.evidenceFidelity && checks.claimAuthority && checks.lifecycle && checks.casPersistence && checks.scriptSceneIntegrity;
    const status: CreatorScriptRefinementAcceptanceStatus = !requiredChecksPass || failed || totalElapsedMs >= routeBudgetMs
      ? "BLOCKED"
      : !checks.liveProviderVerified
        ? "REVIEW_REQUIRED"
        : "READY_FOR_CONTROLLED_LIVE_ACCEPTANCE";
    return { status, evidenceFidelity: checks.evidenceFidelity, claimAuthority: checks.claimAuthority, refinementLifecycle: checks.lifecycle, casPersistence: checks.casPersistence, scriptSceneIntegrity: checks.scriptSceneIntegrity, operationalReliability: !failed && totalElapsedMs < routeBudgetMs, liveProviderVerified: checks.liveProviderVerified, routeBudgetMs, totalElapsedMs, operationalTiming: { kind: "synthetic_simulation" as const, runtimeCancellationEnforced: false, comparisonOnly: true }, stages: [...results], remainingBlockers: [...(!checks.liveProviderVerified ? ["LIVE_PROVIDER_RUNTIME_NOT_VERIFIED"] : []), ...(totalElapsedMs >= routeBudgetMs ? ["SYNTHETIC_ROUTE_BUDGET_EXCEEDED"] : []), ...(failed ? ["STAGE_FAILURE_REQUIRES_REVIEW"] : [])] };
  };
  return { run, report, results };
}
