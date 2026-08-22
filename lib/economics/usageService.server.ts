import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPersistenceServices } from "@/lib/persistence";
import { getOwnerStorageQuotaStatus } from "@/lib/persistence/media/storageQuota.server";
import { aggregateCreatorEconomicUsage, deriveProjectDuration, type CreatorEconomicUsageRow } from "./usageAggregation";
import { evaluateCreatorMarginHealth, type CreatorBenchmarkTier } from "./marginBenchmark";

export type CreatorUsageWindow = "current_month" | "rolling_30_days" | "project_lifetime";
function windowStart(window: CreatorUsageWindow, now = new Date()) { if (window === "project_lifetime") return null; if (window === "rolling_30_days") return new Date(now.getTime() - 30 * 86400_000).toISOString(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(); }
export async function getCreatorEconomicUsageSnapshot(input: { userId: string; projectId?: string | null; window: CreatorUsageWindow; tier?: CreatorBenchmarkTier }) {
  let project: Record<string, unknown> | null = null;
  if (input.projectId) { project = await getPersistenceServices().projectRepository.getForOwner(input.projectId, input.userId); if (!project) throw new Error("PROJECT_NOT_FOUND"); }
  let query = createServerSupabaseClient().from("velto_creator_economic_operations").select("operation_type,provider,model,state,generation_attempt,fallback_attempt,generated,quantities,actual_provider_cost_usd,estimated_provider_cost_usd,cost_status").eq("user_id", input.userId).order("created_at", { ascending: false }).limit(5000);
  if (input.projectId) query = query.eq("project_id", input.projectId); const start = windowStart(input.window); if (start) query = query.gte("created_at", start);
  const [{ data, error }, storage, account] = await Promise.all([query, getOwnerStorageQuotaStatus(input.userId), getPersistenceServices().creditRepository.getAccount(input.userId)]);
  if (error) throw new Error("USAGE_AGGREGATION_FAILED");
  const usage = aggregateCreatorEconomicUsage((data || []) as CreatorEconomicUsageRow[], storage); const duration = deriveProjectDuration(project, usage); const finishedMinutes = duration.seconds === null ? null : duration.seconds / 60;
  const tier = input.tier || "standard"; const margin = evaluateCreatorMarginHealth({ tier, knownCogsUsd: usage.knownProviderCogsUsd, finishedMinutes, costCoverageStatus: usage.costCoverageStatus });
  return { scope: input.projectId ? "project" as const : "user" as const, window: input.window, projectId: input.projectId || null, usage, duration: { finishedSeconds: duration.seconds, finishedMinutes, denominatorSource: duration.source }, entitlement: { creditBalance: account.balanceCredits, reservedCredits: account.reservedCredits, availableCredits: account.availableCredits, lifetimeUsedCredits: account.lifetimeUsedCredits }, internal: { tier, margin } };
}

export function toCustomerCreatorUsage(snapshot: Awaited<ReturnType<typeof getCreatorEconomicUsageSnapshot>>) {
  return { scope: snapshot.scope, window: snapshot.window, projectId: snapshot.projectId, credits: snapshot.entitlement, exports: snapshot.usage.exports, finishedOutputMinutes: snapshot.usage.exports.finishedMinutes, uniqueProjectTimelineMinutes: snapshot.scope === "project" ? snapshot.duration.finishedMinutes : null, premiumGeneration: { attempts: snapshot.usage.video.attempts, successfulGenerations: snapshot.usage.video.successfulGenerations, requestedSeconds: snapshot.usage.video.requestedSeconds, generatedSeconds: snapshot.usage.video.providerBilledSeconds }, stock: snapshot.usage.stock, storage: { activeBytes: snapshot.usage.storage.activeBytes, totalPhysicalBytes: snapshot.usage.storage.totalPhysicalBytes, assetCount: snapshot.usage.storage.assetCount } };
}
