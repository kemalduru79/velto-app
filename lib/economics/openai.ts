import { randomUUID } from "node:crypto";
import { calculateOpenAITextCost, normalizeOpenAITextUsage, unknownCost } from "./calculators";
import { persistEconomicOperationBestEffort } from "./repository";

export async function recordOpenAITextEconomics(input: { route: string; operationType: string; model: string; response: unknown; logicalOperationId?: string; userId?: string | null; projectId?: string | null }) {
  const response = input.response && typeof input.response === "object" ? input.response as Record<string, unknown> : {};
  const usage = normalizeOpenAITextUsage(response.usage);
  const cost = response.usage ? calculateOpenAITextCost(input.model, usage) : unknownCost("OpenAI response did not expose token usage.");
  const requestId = typeof response._request_id === "string" ? response._request_id : typeof response.id === "string" ? response.id : null;
  const logicalOperationId = input.logicalOperationId || `${input.operationType}:${requestId || randomUUID()}`;
  await persistEconomicOperationBestEffort({
    attemptKey: `${logicalOperationId}:openai-text:1`, logicalOperationId, userId: input.userId, projectId: input.projectId,
    route: input.route, operationType: input.operationType, provider: "openai", providerTier: "primary", model: input.model,
    providerRequestId: requestId, state: "provider_billed", billingMoment: "provider_completed",
    quantities: { ...usage, requestCount: 1 }, cost, dispatchedAt: new Date().toISOString(), providerAcceptedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  });
  return cost;
}
