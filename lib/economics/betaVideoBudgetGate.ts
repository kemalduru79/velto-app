import { createHash } from "node:crypto";
import {
  requestBetaBudgetReservation,
  type BetaBudgetRpc,
} from "./betaBudgetReservationAdapter.ts";

export type BetaVideoBudgetContext = Readonly<{
  ownerUserId: string;
  projectId: string | null;
  sceneId: string | null;
  provider: string;
  model: string;
  billedSeconds: number;
  idempotencyKey: string | null;
  verifiedCostUpperBoundUsd: number | null;
}>;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkBetaVideoBudgetDispatch(
  input: BetaVideoBudgetContext,
  rpc: BetaBudgetRpc,
) {
  const deny = (reason: string) => ({
    dispatchAuthorized: false as const,
    reason,
  });

  // Estimates are not an authoritative billing ceiling.
  if (input.verifiedCostUpperBoundUsd === null) {
    return deny("COST_CEILING_UNVERIFIED");
  }

  if (
    !input.idempotencyKey ||
    input.idempotencyKey.length > 160 ||
    !input.provider ||
    !input.model ||
    !Number.isSafeInteger(input.billedSeconds) ||
    input.billedSeconds <= 0
  ) {
    return deny("INVALID_DISPATCH_IDENTITY");
  }

  const requestIdentity = JSON.stringify({
    ownerUserId: input.ownerUserId,
    projectId: input.projectId,
    sceneId: input.sceneId,
    provider: input.provider,
    model: input.model,
    billedSeconds: input.billedSeconds,
    idempotencyKey: input.idempotencyKey,
  });

  const result = await requestBetaBudgetReservation(rpc, {
    ownerUserId: input.ownerUserId,
    attemptKey: "video:" + hash(
      input.ownerUserId + ":" + input.idempotencyKey
    ),
    requestSha256: hash(requestIdentity),
    upperBoundCostUsd: input.verifiedCostUpperBoundUsd,
  });

  // Even a confirmed hold is not provider-dispatch authorization.
  if (result.state !== "HELD_REVIEW_ONLY") {
    return deny("RESERVATION_DENIED");
  }

  return deny("RESERVED_BUT_DISPATCH_NOT_ACTIVATED");
}
