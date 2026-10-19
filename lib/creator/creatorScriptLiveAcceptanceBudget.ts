export type CreatorScriptLiveAcceptanceAuthorization = {
  executionKind: "mock" | "live";
  allowLiveProviders: boolean;
  approvedMaxCostUsd: number;
  approvedMaxExaRequests: number;
  approvedMaxOpenAiRequests: number;
  approvedMaxOutputTokensPerRequest: number;
};

export type CreatorScriptAcceptanceUsage = {
  provider: "exa" | "openai";
  requestId: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  reportedCostUsd: number | null;
};

export function createCreatorScriptLiveAcceptanceBudget(input: CreatorScriptLiveAcceptanceAuthorization) {
  if (input.executionKind === "live" && (!input.allowLiveProviders || input.approvedMaxCostUsd <= 0)) throw new Error("CREATOR_REFINEMENT_LIVE_AUTHORIZATION_REQUIRED");
  if (input.approvedMaxExaRequests < 0 || input.approvedMaxOpenAiRequests < 0 || input.approvedMaxOutputTokensPerRequest <= 0 || input.approvedMaxCostUsd < 0) throw new Error("CREATOR_REFINEMENT_LIVE_LIMIT_INVALID");
  const usage: CreatorScriptAcceptanceUsage[] = [];
  let reservedCostUsd = 0;
  let reportedCostUsd = 0;
  const requestCounts = { exa: 0, openai: 0 };
  const reserve = (provider: "exa" | "openai", estimatedCostUsd: number, requestedOutputTokens: number) => {
    const maximumRequests = provider === "exa" ? input.approvedMaxExaRequests : input.approvedMaxOpenAiRequests;
    if (requestCounts[provider] >= maximumRequests) throw new Error("CREATOR_REFINEMENT_PROVIDER_REQUEST_LIMIT_EXHAUSTED");
    if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0 || Math.max(reservedCostUsd, reportedCostUsd) + estimatedCostUsd > input.approvedMaxCostUsd) throw new Error("CREATOR_REFINEMENT_LIVE_BUDGET_EXHAUSTED");
    if (!Number.isInteger(requestedOutputTokens) || requestedOutputTokens <= 0 || requestedOutputTokens > input.approvedMaxOutputTokensPerRequest) throw new Error("CREATOR_REFINEMENT_OUTPUT_TOKEN_LIMIT_EXCEEDED");
    requestCounts[provider] += 1;
    reservedCostUsd += estimatedCostUsd;
  };
  const record = (entry: CreatorScriptAcceptanceUsage) => {
    if (!Number.isInteger(entry.inputTokens) || entry.inputTokens < 0 || !Number.isInteger(entry.outputTokens) || entry.outputTokens < 0 || entry.outputTokens > input.approvedMaxOutputTokensPerRequest) throw new Error("CREATOR_REFINEMENT_PROVIDER_USAGE_INVALID");
    if (!Number.isFinite(entry.estimatedCostUsd) || entry.estimatedCostUsd < 0 || (entry.reportedCostUsd !== null && (!Number.isFinite(entry.reportedCostUsd) || entry.reportedCostUsd < 0))) throw new Error("CREATOR_REFINEMENT_PROVIDER_USAGE_INVALID");
    reportedCostUsd += entry.reportedCostUsd ?? 0;
    usage.push({ ...entry });
  };
  return {
    reserve,
    record,
    report: () => ({ executionKind: input.executionKind, liveProvidersAuthorized: input.executionKind === "live" && input.allowLiveProviders, approvedMaxCostUsd: input.approvedMaxCostUsd, estimatedCostUsd: reservedCostUsd, reportedCostUsd, costLimitExceeded: reportedCostUsd > input.approvedMaxCostUsd, requestCounts: { ...requestCounts }, approvedRequestLimits: { exa: input.approvedMaxExaRequests, openai: input.approvedMaxOpenAiRequests }, approvedMaxOutputTokensPerRequest: input.approvedMaxOutputTokensPerRequest, usage: usage.map((item) => ({ ...item })) }),
  };
}

export const DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION: CreatorScriptLiveAcceptanceAuthorization = {
  executionKind: "live",
  allowLiveProviders: false,
  approvedMaxCostUsd: 0,
  approvedMaxExaRequests: 0,
  approvedMaxOpenAiRequests: 0,
  approvedMaxOutputTokensPerRequest: 1,
};
