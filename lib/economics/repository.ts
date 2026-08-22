import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EconomicOperationInput } from "./types";

const bounded = (value: string | null | undefined, max = 240) => value?.trim().slice(0, max) || null;

export async function persistEconomicOperation(input: EconomicOperationInput) {
  const now = new Date().toISOString();
  const row = {
    attempt_key: bounded(input.attemptKey), logical_operation_id: bounded(input.logicalOperationId), idempotency_key: bounded(input.idempotencyKey),
    credit_reservation_id: input.creditReservationId || null, user_id: input.userId || null, project_id: bounded(input.projectId), scene_id: input.sceneId == null ? null : String(input.sceneId).slice(0, 120), export_id: bounded(input.exportId),
    route: bounded(input.route, 160), operation_type: bounded(input.operationType, 160), product_tier: bounded(input.productTier, 80), provider: bounded(input.provider, 80), provider_tier: bounded(input.providerTier, 80), model: bounded(input.model, 160),
    fallback_provider: bounded(input.fallbackProvider, 80), fallback_model: bounded(input.fallbackModel, 160), provider_request_id: bounded(input.providerRequestId), state: input.state, billing_moment: bounded(input.billingMoment, 120), ambiguity_reason: bounded(input.ambiguityReason, 500),
    generation_attempt: input.generationAttempt || 1, fallback_attempt: input.fallbackAttempt === true, generated: input.generated !== false, asset_identity: bounded(input.assetIdentity), reuse_identity: bounded(input.reuseIdentity), quantities: input.quantities || {},
    estimated_provider_cost_usd: input.cost?.costStatus === "estimated" ? input.cost.providerCostUsd : null,
    actual_provider_cost_usd: input.cost?.costStatus === "exact" ? input.cost.providerCostUsd : null,
    provider_cost_usd: input.cost?.providerCostUsd ?? null, cost_status: input.cost?.costStatus || "unknown", currency: input.cost?.currency || "USD", pricing_version: input.cost?.pricingVersion || null, pricing_as_of: input.cost?.pricingAsOf || null, cost_components: input.cost?.components || {}, cost_reason: bounded(input.cost?.reason, 500),
    dispatched_at: input.dispatchedAt || null, provider_accepted_at: input.providerAcceptedAt || null, completed_at: input.completedAt || null, failed_at: input.failedAt || null, reconciled_at: input.reconciledAt || null, updated_at: now,
  };
  const { error } = await createServerSupabaseClient().from("velto_creator_economic_operations").upsert(row, { onConflict: "attempt_key" });
  if (error) throw new Error(`Economic operation persistence failed: ${error.message}`);
  return row;
}

export async function persistEconomicOperationBestEffort(input: EconomicOperationInput) {
  try { return await persistEconomicOperation(input); }
  catch (error) {
    console.error("CREATOR_ECONOMIC_PERSISTENCE_FAILED", { route: input.route, operationType: input.operationType, state: input.state, costStatus: input.cost?.costStatus || "unknown", error: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}
