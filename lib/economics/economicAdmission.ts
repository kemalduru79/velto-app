import { CREATOR_MARGIN_BENCHMARKS, evaluateCreatorMarginHealth, type CreatorBenchmarkTier } from "./marginBenchmark.ts";

export type CreatorMarginEnforcementMode = "monitor" | "guard";
export function getCreatorMarginEnforcementMode(env: NodeJS.ProcessEnv = process.env): CreatorMarginEnforcementMode { return env.VELTO_CREATOR_MARGIN_ENFORCEMENT_MODE?.trim().toLowerCase() === "guard" ? "guard" : "monitor"; }
export function evaluateCreatorEconomicAdmission(input: { tier: CreatorBenchmarkTier; operationType: string; estimatedProviderCostUsd: number | null; currentKnownCogsUsd: number; currentVideoCogsUsd: number; finishedMinutes: number | null; costCoverageStatus: "complete" | "partial" | "insufficient"; origin: "automatic" | "manual" | "retry"; enforcementMode?: CreatorMarginEnforcementMode; acceptableProductionFallbackAvailable?: boolean; qualityEquivalentFallbackAvailable?: boolean }) {
  const mode = input.enforcementMode || "monitor"; const cost = input.estimatedProviderCostUsd;
  if (cost === null || !Number.isFinite(cost) || cost < 0) return { allowed: false, mode: "hard_guard" as const, reasonCodes: ["INVALID_OR_UNKNOWN_DISPATCH_COST"], userInteractionRequired: true };
  const benchmark = CREATOR_MARGIN_BENCHMARKS[input.tier]; const projected = input.currentKnownCogsUsd + cost;
  const health = evaluateCreatorMarginHealth({ tier: input.tier, knownCogsUsd: projected, finishedMinutes: input.finishedMinutes, costCoverageStatus: input.costCoverageStatus });
  const projectedVideoPerMinute = input.finishedMinutes && input.finishedMinutes > 0 ? (input.currentVideoCogsUsd + (input.operationType === "creator_video" ? cost : 0)) / input.finishedMinutes : null;
  const videoPressure = benchmark.videoCogsPerFinishedMinuteGuardrailUsd > 0 && projectedVideoPerMinute !== null && projectedVideoPerMinute > benchmark.videoCogsPerFinishedMinuteGuardrailUsd;
  const pressure = health.status === "p90_pressure" || health.status === "stress" || videoPressure;
  if (mode === "monitor" || !pressure) return { allowed: true, mode: pressure ? "soft_pressure" as const : "allowed" as const, reasonCodes: pressure ? ["BENCHMARK_PRESSURE_MONITORED"] : ["ECONOMICALLY_HEALTHY"], currentKnownCogsUsd: input.currentKnownCogsUsd, projectedKnownCogsUsd: projected, projectedVideoCogsPerFinishedMinute: projectedVideoPerMinute, health, userInteractionRequired: false };
  if (input.qualityEquivalentFallbackAvailable || (input.origin === "automatic" && input.acceptableProductionFallbackAvailable)) return { allowed: true, mode: "soft_pressure" as const, reasonCodes: ["SAFE_FALLBACK_REQUIRED"], currentKnownCogsUsd: input.currentKnownCogsUsd, projectedKnownCogsUsd: projected, projectedVideoCogsPerFinishedMinute: projectedVideoPerMinute, health, userInteractionRequired: false };
  return { allowed: false, mode: "hard_guard" as const, reasonCodes: [input.origin === "manual" ? "MANUAL_PREMIUM_REQUIRES_USER_ACTION" : "ECONOMIC_ENVELOPE_EXCEEDED"], currentKnownCogsUsd: input.currentKnownCogsUsd, projectedKnownCogsUsd: projected, projectedVideoCogsPerFinishedMinute: projectedVideoPerMinute, health, userInteractionRequired: true };
}
