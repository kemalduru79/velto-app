// Non-dispatching adapter. Server must derive owner, request identity
// and an authoritative provider cost upper bound independently.
export const BETA_BUDGET_RPC = "velto_beta_budget_reserve_v1" as const;

type ReservationArgs = {
  p_owner_user_id: string;
  p_attempt_key: string;
  p_request_sha256: string;
  p_cost_upper_bound_micro_usd: number;
};

export type BetaBudgetRpc = (
  name: typeof BETA_BUDGET_RPC,
  args: ReservationArgs,
) => Promise<{
  data: unknown;
  error: { code?: string; message?: string } | null;
}>;

type ReservationRequest = Readonly<{
  ownerUserId: string;
  attemptKey: string;
  requestSha256: string;
  upperBoundCostUsd: number | null;
}>;

type ReservationResult =
  | {
      state: "HELD_REVIEW_ONLY";
      attemptKey: string;
      upperBoundMicroUsd: number;
      dispatchAuthorized: false;
    }
  | {
      state: "BLOCKED";
      reason: string;
      dispatchAuthorized: false;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;
const ATTEMPT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

const KNOWN_DENIALS = new Set([
  "DENIED_INVALID_REQUEST",
  "DENIED_NO_AUTHORIZED_BUDGET",
  "DENIED_HARD_CAP",
  "DENIED_DUPLICATE_ATTEMPT",
]);

export async function requestBetaBudgetReservation(
  rpc: BetaBudgetRpc,
  input: ReservationRequest,
): Promise<ReservationResult> {
  const blocked = (reason: string): ReservationResult =>
    ({ state: "BLOCKED", reason, dispatchAuthorized: false });

  if (
    !UUID.test(input.ownerUserId) ||
    !ATTEMPT.test(input.attemptKey) ||
    !SHA.test(input.requestSha256)
  ) {
    return blocked("INVALID_SERVER_RESERVATION_IDENTITY");
  }

  const cost = input.upperBoundCostUsd;
  if (cost === null || !Number.isFinite(cost) || cost <= 0) {
    return blocked("INVALID_COST_UPPER_BOUND");
  }

  const micro = Math.ceil(cost * 1_000_000);
  if (!Number.isSafeInteger(micro) || micro <= 0) {
    return blocked("INVALID_COST_UPPER_BOUND");
  }

  try {
    const result = await rpc(BETA_BUDGET_RPC, {
      p_owner_user_id: input.ownerUserId,
      p_attempt_key: input.attemptKey,
      p_request_sha256: input.requestSha256,
      p_cost_upper_bound_micro_usd: micro,
    });

    if (result?.error || !result || result.data !== "RESERVED") {
      return blocked(
        typeof result?.data === "string" &&
        KNOWN_DENIALS.has(result.data)
          ? result.data
          : "RESERVATION_NOT_CONFIRMED"
      );
    }

    // A held reservation is NOT permission to dispatch a provider.
    return {
      state: "HELD_REVIEW_ONLY",
      attemptKey: input.attemptKey,
      upperBoundMicroUsd: micro,
      dispatchAuthorized: false,
    };
  } catch {
    return blocked("RESERVATION_NOT_CONFIRMED");
  }
}
