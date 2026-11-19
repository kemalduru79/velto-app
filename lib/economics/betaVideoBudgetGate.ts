import { createHash } from "node:crypto";
import type { BetaBudgetRpc } from "./betaBudgetReservationAdapter.ts";

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

export function deriveBetaVideoAttemptKey(
  ownerUserId: string,
  idempotencyKey: string | null,
): string | null {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerUserId) ||
    !idempotencyKey ||
    !/^[A-Za-z0-9._:-]{1,160}$/.test(idempotencyKey)
  ) {
    return null;
  }
  return "video:" + hash(ownerUserId + ":" + idempotencyKey);
}

export function prepareBetaVideoBudgetReservation(
  input: BetaVideoBudgetContext,
) {
  if (input.verifiedCostUpperBoundUsd === null) {
    return { ok: false as const, reason: "COST_CEILING_UNVERIFIED" };
  }

  if (
    !Number.isFinite(input.verifiedCostUpperBoundUsd) ||
    input.verifiedCostUpperBoundUsd <= 0 ||
    !input.idempotencyKey ||
    !/^[A-Za-z0-9._:-]{1,160}$/.test(input.idempotencyKey) ||
    !input.provider ||
    !input.model ||
    !Number.isSafeInteger(input.billedSeconds) ||
    input.billedSeconds <= 0
  ) {
    return { ok: false as const, reason: "INVALID_DISPATCH_IDENTITY" };
  }

  const attemptKey = deriveBetaVideoAttemptKey(
    input.ownerUserId,
    input.idempotencyKey,
  );
  if (!attemptKey) {
    return { ok: false as const, reason: "INVALID_DISPATCH_IDENTITY" };
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

  return {
    ok: true as const,
    request: {
      ownerUserId: input.ownerUserId,
      attemptKey,
      requestSha256: hash(requestIdentity),
      upperBoundCostUsd: input.verifiedCostUpperBoundUsd,
    },
  };
}

// Review-mode API gate: must never create a budget hold.
export async function checkBetaVideoBudgetDispatch(
  input: BetaVideoBudgetContext,
  _rpc: BetaBudgetRpc,
) {
  const prepared = prepareBetaVideoBudgetReservation(input);

  if (!prepared.ok) {
    return {
      dispatchAuthorized: false as const,
      reason: prepared.reason,
    };
  }

  return {
    dispatchAuthorized: false as const,
    reason: "DISPATCH_PROTOCOL_NOT_ACTIVE",
  };
}
