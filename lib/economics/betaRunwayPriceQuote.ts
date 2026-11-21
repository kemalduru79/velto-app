export const BETA_RUNWAY_PRICE_SNAPSHOT = "2026-11-18";

const CREDITS_PER_SECOND = {
  gen4_turbo: 5,
  "gen4.5": 12,
} as const;

type Input = Readonly<{
  provider: string;
  model: string;
  billedSeconds: number;
}>;

export function quoteBetaRunwayVideo(input: Input) {
  const blocked = (reason: string) => ({
    state: "UNAVAILABLE" as const,
    reason,
    dispatchAuthorized: false as const,
  });

  if (input.provider !== "runway") {
    return blocked("UNSUPPORTED_PROVIDER");
  }

  if (
    input.model !== "gen4_turbo" &&
    input.model !== "gen4.5"
  ) {
    return blocked("UNSUPPORTED_MODEL");
  }

  if (
    !Number.isSafeInteger(input.billedSeconds) ||
    input.billedSeconds < 2 ||
    input.billedSeconds > 10
  ) {
    return blocked("INVALID_BILLED_DURATION");
  }

  const credits =
    CREDITS_PER_SECOND[input.model] * input.billedSeconds;

  return {
    state: "LIST_PRICE_QUOTE" as const,
    provider: "runway" as const,
    model: input.model,
    billedSeconds: input.billedSeconds,
    credits,
    quotedMicroUsd: credits * 10_000,
    priceSnapshot: BETA_RUNWAY_PRICE_SNAPSHOT,
    billingBasis: "PUBLIC_API_LIST_PRICE_NOT_INVOICE" as const,
    dispatchAuthorized: false as const,
  };
}
