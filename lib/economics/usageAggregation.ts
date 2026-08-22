export type CreatorEconomicUsageRow = { id?: unknown; created_at?: unknown; project_id?: unknown; operation_type?: unknown; provider?: unknown; model?: unknown; state?: unknown; generation_attempt?: unknown; fallback_attempt?: unknown; generated?: unknown; quantities?: unknown; actual_provider_cost_usd?: unknown; estimated_provider_cost_usd?: unknown; cost_status?: unknown };
type Bucket = { operations: number; actualCogsUsd: number; estimatedCogsUsd: number; committedExposureUsd: number };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const add = (map: Record<string, Bucket>, key: string, actual: number, estimated: number) => { const item = map[key] ||= { operations: 0, actualCogsUsd: 0, estimatedCogsUsd: 0, committedExposureUsd: 0 }; item.operations += 1; item.actualCogsUsd += actual; item.estimatedCogsUsd += estimated; item.committedExposureUsd += actual + estimated; };
const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function aggregateCreatorEconomicUsage(rows: CreatorEconomicUsageRow[], storage?: { activeBytes?: number; totalPhysicalBytes?: number; assetCount?: number }, completeness: { aggregationComplete?: boolean; truncated?: boolean } = {}) {
  let actual = 0, estimated = 0, exact = 0, estimatedCount = 0, unknown = 0, notBillable = 0, requestedVideoSeconds = 0, billedVideoSeconds = 0, successfulVideoGenerations = 0, videoAttempts = 0, retries = 0, fallbacks = 0, retryCogs = 0, fallbackCogs = 0, exports = 0, exportSeconds = 0, exportBytes = 0, stockSearches = 0, stockImports = 0;
  const byOperation: Record<string, Bucket> = {}, byProviderModelProfile: Record<string, Bucket> = {};
  for (const row of rows) {
    const q = record(row.quantities); const actualCost = number(row.actual_provider_cost_usd); const estimatedCost = number(row.estimated_provider_cost_usd); const operation = String(row.operation_type || "unknown"); const status = String(row.cost_status || "unknown");
    actual += actualCost; estimated += estimatedCost; if (status === "exact") exact += 1; else if (status === "estimated") estimatedCount += 1; else if (status === "unknown") unknown += 1; else if (status === "not_billable") notBillable += 1;
    add(byOperation, operation, actualCost, estimatedCost); add(byProviderModelProfile, [row.provider || "unknown", row.model || "unknown", q.profileKey || "none"].join("/"), actualCost, estimatedCost);
    if (operation === "creator_video") { videoAttempts += 1; requestedVideoSeconds += number(q.requestedSeconds); billedVideoSeconds += number(q.providerBilledSeconds); if (["provider_billed", "settled", "reconciled"].includes(String(row.state))) successfulVideoGenerations += 1; }
    if (number(row.generation_attempt) > 1) { retries += 1; retryCogs += actualCost; } if (row.fallback_attempt === true) { fallbacks += 1; fallbackCogs += actualCost; }
    if (operation === "creator_export" && number(q.timelineDurationSec) > 0) { exports += 1; exportSeconds += number(q.timelineDurationSec); exportBytes += number(q.outputBytes); }
    if (operation === "stock_search") stockSearches += 1; if (operation === "stock_import") stockImports += 1;
  }
  const roundBuckets = (items: Record<string, Bucket>) => Object.fromEntries(Object.entries(items).map(([key, item]) => [key, { ...item, actualCogsUsd: rounded(item.actualCogsUsd), estimatedCogsUsd: rounded(item.estimatedCogsUsd), committedExposureUsd: rounded(item.committedExposureUsd) }]));
  const infrastructureUnknown = unknown > 0 || Boolean(storage);
  const aggregationComplete = completeness.aggregationComplete !== false;
  return { totalEconomicOperations: rows.length, exactCostOperations: exact, estimatedCostOperations: estimatedCount, unknownCostOperations: unknown, notBillableOperations: notBillable, actualProviderCostUsd: rounded(actual), actualProviderCogsUsd: rounded(actual), estimatedAdditionalCogsUsd: rounded(estimated), estimatedPendingProviderCogsUsd: rounded(estimated), committedEconomicExposureUsd: rounded(actual + estimated), knownProviderCogsUsd: rounded(actual), aggregationComplete, truncated: completeness.truncated === true, costCoverageStatus: !aggregationComplete || rows.length === 0 ? "insufficient" as const : infrastructureUnknown ? "partial" as const : "complete" as const, unknownInfrastructureCost: infrastructureUnknown, video: { attempts: videoAttempts, successfulGenerations: successfulVideoGenerations, requestedSeconds: rounded(requestedVideoSeconds), providerBilledSeconds: rounded(billedVideoSeconds), retryAttempts: retries, fallbackAttempts: fallbacks, retryCogsUsd: rounded(retryCogs), fallbackCogsUsd: rounded(fallbackCogs) }, exports: { count: exports, finishedSeconds: rounded(exportSeconds), finishedMinutes: rounded(exportSeconds / 60), outputBytes: exportBytes }, stock: { searches: stockSearches, imports: stockImports }, storage: { activeBytes: number(storage?.activeBytes), totalPhysicalBytes: number(storage?.totalPhysicalBytes), assetCount: number(storage?.assetCount), usdCostStatus: "unknown" as const }, byOperation: roundBuckets(byOperation), byProviderModelProfile: roundBuckets(byProviderModelProfile) };
}

export async function collectCreatorEconomicUsagePages(fetchPage: (from: number, to: number) => Promise<CreatorEconomicUsageRow[]>, options: { pageSize?: number; maximumRows?: number } = {}) {
  const pageSize = Math.max(100, Math.min(2000, Math.floor(options.pageSize || 1000))); const maximumRows = options.maximumRows === undefined ? Number.POSITIVE_INFINITY : Math.max(pageSize, Math.floor(options.maximumRows)); const rows: CreatorEconomicUsageRow[] = [];
  for (let from = 0; ; from += pageSize) { const page = await fetchPage(from, from + pageSize - 1); const remaining = maximumRows - rows.length; rows.push(...page.slice(0, remaining)); if (page.length < pageSize) return { rows, aggregationComplete: true, truncated: false }; if (rows.length >= maximumRows) return { rows, aggregationComplete: false, truncated: true }; }
}

export function deriveProjectDuration(project: Record<string, unknown> | null, usage: ReturnType<typeof aggregateCreatorEconomicUsage>) {
  if (usage.exports.finishedSeconds > 0) return { seconds: usage.exports.finishedSeconds / Math.max(1, usage.exports.count), source: "final_export" as const };
  const exportedResult = record(project?.exported_movie_result ?? project?.exportedMovieResult); const completedExportSeconds = number(exportedResult.durationSeconds ?? exportedResult.durationSec);
  if (completedExportSeconds > 0) return { seconds: completedExportSeconds, source: "final_export" as const };
  const timeline = record(project?.timeline ?? project?.creatorTimeline); const timelineSeconds = number(timeline.durationSeconds ?? timeline.durationSec ?? project?.timelineDurationSec);
  if (timelineSeconds > 0) return { seconds: timelineSeconds, source: "timeline" as const };
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const seconds = scenes.reduce((sum, value) => { const scene = record(value); const timing = record(scene.timing); return sum + number(timing.targetSceneDuration ?? timing.durationSec ?? scene.duration); }, 0);
  return seconds > 0 ? { seconds, source: "scene_sum" as const } : { seconds: null, source: "unavailable" as const };
}
