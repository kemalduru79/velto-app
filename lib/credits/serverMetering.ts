import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { CreditEngine, CreditEngineError } from "./engine";
import { getPersistenceServices } from "@/lib/persistence";
import {
  getOperationCreditCost,
  type MeteredOperationType,
} from "./operationPolicy";
import type { CreditAccount } from "./types";

const creditEngine = new CreditEngine(
  getPersistenceServices().creditRepository,
);

export type MeteredOperationReservation = {
  userId: string;
  reservationId: string;
  operationType: MeteredOperationType;
  reservedCredits: number;
  accountAfterReserve: CreditAccount;
};

type ReserveMeteredOperationInput = {
  operationType: MeteredOperationType;
  qualityMode: unknown;
  provider?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  billable?: boolean;
};

export async function reserveMeteredOperation(
  request: Request,
  input: ReserveMeteredOperationInput,
): Promise<MeteredOperationReservation | null> {
  const principal = await authenticateRequest(request);

  if (input.billable === false) return null;

  const credits = getOperationCreditCost(input.operationType, input.qualityMode);

  if (credits <= 0) return null;

  const idempotencyKey =
    request.headers.get("x-idempotency-key")?.trim() ||
    `${input.operationType}:${randomUUID()}`;

  const result = await creditEngine.reserve({
    userId: principal.id,
    credits,
    operationType: input.operationType,
    idempotencyKey,
    provider: input.provider,
    referenceId: input.referenceId,
    metadata: input.metadata,
  });

  return {
    userId: principal.id,
    reservationId: result.reservation.id,
    operationType: input.operationType,
    reservedCredits: credits,
    accountAfterReserve: result.account,
  };
}

export async function settleMeteredOperation(
  reservation: MeteredOperationReservation,
  input?: {
    providerCostUsd?: number;
    providerRequestId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return creditEngine.settle({
    userId: reservation.userId,
    reservationId: reservation.reservationId,
    finalCredits: reservation.reservedCredits,
    providerCostUsd: input?.providerCostUsd,
    providerRequestId: input?.providerRequestId,
    metadata: input?.metadata,
  });
}

export async function releaseMeteredOperation(
  reservation: MeteredOperationReservation,
  reason: string,
  metadata?: Record<string, unknown>,
) {
  try {
    return await creditEngine.release({
      userId: reservation.userId,
      reservationId: reservation.reservationId,
      reason,
      metadata,
    });
  } catch (releaseError) {
    console.error("credit reservation release error:", releaseError);
    return null;
  }
}

export function getCreditErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: "AUTHENTICATION_REQUIRED" },
      { status: 401 },
    );
  }

  if (error instanceof CreditEngineError) {
    const status =
      error.code === "INSUFFICIENT_CREDITS"
        ? 402
        : error.code === "RESERVATION_NOT_FOUND"
          ? 404
          : error.code === "INVALID_RESERVATION_STATE"
            ? 409
            : error.code === "INVALID_INPUT"
              ? 400
              : 500;

    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status },
    );
  }

  return null;
}
