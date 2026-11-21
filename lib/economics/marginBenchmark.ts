export const CREATOR_MARGIN_BENCHMARK_VERSION = "creator-margin-benchmark-2026-08-22";
export type CreatorBenchmarkTier = "standard" | "pro" | "cinematic";
export type CreatorMarginHealthStatus = "healthy" | "watch" | "p90_pressure" | "stress" | "insufficient_data";

export const CREATOR_MARGIN_BENCHMARKS = {
  standard: { benchmarkPriceUsd: 59, normalizedFinishedMinutes: 60, p50CogsCeilingUsd: 20.65, p90CogsCeilingUsd: 23.6, stressCogsCeilingUsd: 29.5, videoCogsPerFinishedMinuteGuardrailUsd: 0 },
  pro: { benchmarkPriceUsd: 199, normalizedFinishedMinutes: 90, p50CogsCeilingUsd: 69.65, p90CogsCeilingUsd: 79.6, stressCogsCeilingUsd: 99.5, videoCogsPerFinishedMinuteGuardrailUsd: 0.45 },
  cinematic: { benchmarkPriceUsd: 399, normalizedFinishedMinutes: 60, p50CogsCeilingUsd: 139.65, p90CogsCeilingUsd: 159.6, stressCogsCeilingUsd: 199.5, videoCogsPerFinishedMinuteGuardrailUsd: 1.75 },
} as const;

const money = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export function evaluateCreatorMarginHealth(input: { tier: CreatorBenchmarkTier; knownCogsUsd: number; finishedMinutes: number | null; costCoverageStatus: "complete" | "partial" | "insufficient" }) {
  const benchmark = CREATOR_MARGIN_BENCHMARKS[input.tier];
  if (!input.finishedMinutes || input.finishedMinutes <= 0 || input.costCoverageStatus === "insufficient") return { status: "insufficient_data" as const, knownCogsPerFinishedMinute: null, normalizedKnownCogsAtBenchmarkWorkload: null, benchmarkGrossMarginEstimate: null, provisional: true };
  const perMinute = money(input.knownCogsUsd / input.finishedMinutes);
  const normalized = money(perMinute * benchmark.normalizedFinishedMinutes);
  const status: CreatorMarginHealthStatus = normalized <= benchmark.p50CogsCeilingUsd ? "healthy" : normalized <= benchmark.p90CogsCeilingUsd ? "watch" : normalized <= benchmark.stressCogsCeilingUsd ? "p90_pressure" : "stress";
  return { status, knownCogsPerFinishedMinute: perMinute, normalizedKnownCogsAtBenchmarkWorkload: normalized, benchmarkGrossMarginEstimate: money((benchmark.benchmarkPriceUsd - normalized) / benchmark.benchmarkPriceUsd), provisional: input.costCoverageStatus !== "complete" };
}
