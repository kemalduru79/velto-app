import type {
  CreditMutationResult,
  CreditRepository,
  MarkProviderDispatchInput,
  ReleaseCreditsInput,
  ReserveCreditsInput,
  SettleCreditsInput,
} from "./types";

export class CreditEngineError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_INPUT"
      | "INSUFFICIENT_CREDITS"
      | "RESERVATION_NOT_FOUND"
      | "INVALID_RESERVATION_STATE"
      | "IDEMPOTENCY_KEY_CONFLICT"
      | "IDEMPOTENCY_REQUEST_IN_PROGRESS"
      | "IDEMPOTENCY_REQUEST_REPLAYED"
      | "CREDIT_OPERATION_FAILED",
  ) {
    super(message);
    this.name = "CreditEngineError";
  }
}

function asPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new CreditEngineError(
      `${field} pozitif bir tam sayı olmalı.`,
      "INVALID_INPUT",
    );
  }

  return value;
}

function requireText(value: string, field: string, maxLength = 240) {
  const normalized = value.trim();

  if (!normalized) {
    throw new CreditEngineError(`${field} zorunludur.`, "INVALID_INPUT");
  }

  if (normalized.length > maxLength) {
    throw new CreditEngineError(
      `${field} en fazla ${maxLength} karakter olabilir.`,
      "INVALID_INPUT",
    );
  }

  return normalized;
}

export class CreditEngine {
  constructor(private readonly repository: CreditRepository) {}

  getAccount(userId: string) {
    return this.repository.getAccount(requireText(userId, "userId"));
  }

  reserve(input: ReserveCreditsInput): Promise<CreditMutationResult> {
    return this.repository.reserve({
      ...input,
      userId: requireText(input.userId, "userId"),
      credits: asPositiveInteger(input.credits, "credits"),
      operationType: requireText(input.operationType, "operationType", 120),
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
      provider: input.provider?.trim() || undefined,
      referenceId: input.referenceId?.trim() || undefined,
    });
  }

  settle(input: SettleCreditsInput): Promise<CreditMutationResult> {
    return this.repository.settle({
      ...input,
      userId: requireText(input.userId, "userId"),
      reservationId: requireText(input.reservationId, "reservationId"),
      finalCredits: asPositiveInteger(input.finalCredits, "finalCredits"),
      providerRequestId: input.providerRequestId?.trim() || undefined,
    });
  }

  markProviderDispatch(
    input: MarkProviderDispatchInput,
  ): Promise<CreditMutationResult> {
    return this.repository.markProviderDispatch({
      ...input,
      userId: requireText(input.userId, "userId"),
      reservationId: requireText(input.reservationId, "reservationId"),
      providerRequestId: requireText(
        input.providerRequestId,
        "providerRequestId",
      ),
    });
  }

  release(input: ReleaseCreditsInput): Promise<CreditMutationResult> {
    return this.repository.release({
      ...input,
      userId: requireText(input.userId, "userId"),
      reservationId: requireText(input.reservationId, "reservationId"),
      reason: requireText(input.reason, "reason"),
    });
  }
}
