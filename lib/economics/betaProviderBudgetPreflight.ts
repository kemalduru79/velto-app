export type BetaProviderBudgetInput = Readonly<{
  hardCapUsd: number | null;
  committedExposureUsd: number | null;
  estimatedDispatchCostUsd: number | null;
  aggregationComplete: boolean;
  unknownCostOperations: number;
}>;

export type BetaProviderBudgetDecision =
  | { state: "BLOCKED"; reason: string }
  | {
      state: "ELIGIBLE_FOR_ATOMIC_RESERVATION";
      requestedMicroUsd: number;
      remainingMicroUsd: number;
    };

function microUsd(
  value: number | null,
  rounding: "up" | "down",
): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const scaled = value * 1_000_000;
  const rounded = rounding === "up"
    ? Math.ceil(scaled)
    : Math.floor(scaled);
  return Number.isSafeInteger(rounded) ? rounded : null;
}

export function evaluateBetaProviderBudgetPreflight(
  input: BetaProviderBudgetInput,
): BetaProviderBudgetDecision {
  const blocked = (reason: string): BetaProviderBudgetDecision =>
    ({ state: "BLOCKED", reason });

  const cap = microUsd(input.hardCapUsd, "down");
  if (cap === null || cap <= 0) return blocked("HARD_CAP_NOT_CONFIGURED");

  if (input.aggregationComplete !== true) {
    return blocked("ECONOMIC_AGGREGATION_INCOMPLETE");
  }

  if (!Number.isSafeInteger(input.unknownCostOperations) ||
      input.unknownCostOperations !== 0) {
    return blocked("UNKNOWN_PROVIDER_COST_EXPOSURE");
  }

  const committed = microUsd(input.committedExposureUsd, "up");
  const requested = microUsd(input.estimatedDispatchCostUsd, "up");

  if (committed === null || requested === null || requested <= 0) {
    return blocked("INVALID_OR_UNKNOWN_COST");
  }

  if (committed > cap || requested > cap - committed) {
    return blocked("HARD_CAP_EXCEEDED");
  }

  return {
    state: "ELIGIBLE_FOR_ATOMIC_RESERVATION",
    requestedMicroUsd: requested,
    remainingMicroUsd: cap - committed - requested,
  };
}
