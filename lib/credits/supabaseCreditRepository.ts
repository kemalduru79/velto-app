import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreditEngineError } from "./engine";
import type {
  CreditAccount,
  CreditMutationResult,
  CreditRepository,
  CreditReservation,
  MarkProviderDispatchInput,
  ReleaseCreditsInput,
  ReserveCreditsInput,
  SettleCreditsInput,
} from "./types";

type CreditRpcPayload = {
  account: {
    user_id: string;
    balance_credits: number;
    reserved_credits: number;
    available_credits: number;
    lifetime_granted_credits: number;
    lifetime_used_credits: number;
    updated_at: string;
  };
  reservation: {
    id: string;
    user_id: string;
    operation_type: string;
    provider: string | null;
    reference_id: string | null;
    reserved_credits: number;
    settled_credits: number;
    status: CreditReservation["status"];
    idempotency_key: string;
    provider_request_id: string | null;
    expires_at: string;
    created_at: string;
    updated_at: string;
  };
  idempotency_replay?: boolean;
};

function mapAccount(account: CreditRpcPayload["account"]): CreditAccount {
  return {
    userId: account.user_id,
    balanceCredits: Number(account.balance_credits),
    reservedCredits: Number(account.reserved_credits),
    availableCredits: Number(account.available_credits),
    lifetimeGrantedCredits: Number(account.lifetime_granted_credits),
    lifetimeUsedCredits: Number(account.lifetime_used_credits),
    updatedAt: account.updated_at,
  };
}

function mapReservation(
  reservation: CreditRpcPayload["reservation"],
): CreditReservation {
  return {
    id: reservation.id,
    userId: reservation.user_id,
    operationType: reservation.operation_type,
    provider: reservation.provider || undefined,
    referenceId: reservation.reference_id || undefined,
    reservedCredits: Number(reservation.reserved_credits),
    settledCredits: Number(reservation.settled_credits),
    status: reservation.status,
    idempotencyKey: reservation.idempotency_key,
    providerRequestId: reservation.provider_request_id || undefined,
    expiresAt: reservation.expires_at,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at,
  };
}

function mapMutation(payload: CreditRpcPayload): CreditMutationResult {
  return {
    account: mapAccount(payload.account),
    reservation: mapReservation(payload.reservation),
    idempotencyReplay: payload.idempotency_replay === true,
  };
}

function mapDatabaseError(message: string): CreditEngineError {
  if (message.includes("INSUFFICIENT_CREDITS")) {
    return new CreditEngineError(
      "Bu işlem için yeterli kullanılabilir kredi bulunmuyor.",
      "INSUFFICIENT_CREDITS",
    );
  }

  if (message.includes("RESERVATION_NOT_FOUND")) {
    return new CreditEngineError(
      "Kredi rezervasyonu bulunamadı.",
      "RESERVATION_NOT_FOUND",
    );
  }

  if (message.includes("IDEMPOTENCY_KEY_CONFLICT")) {
    return new CreditEngineError(
      "Aynı işlem anahtarı farklı bir kredi isteği için kullanılamaz.",
      "IDEMPOTENCY_KEY_CONFLICT",
    );
  }

  if (message.includes("INVALID_RESERVATION_STATE")) {
    return new CreditEngineError(
      "Kredi rezervasyonu bu işlem için uygun durumda değil.",
      "INVALID_RESERVATION_STATE",
    );
  }

  return new CreditEngineError(
    "Kredi işlemi tamamlanamadı.",
    "CREDIT_OPERATION_FAILED",
  );
}

export class SupabaseCreditRepository implements CreditRepository {
  async getAccount(userId: string): Promise<CreditAccount> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc("velto_credit_get_account", {
      p_user_id: userId,
    });

    if (error || !data) {
      throw mapDatabaseError(error?.message || "CREDIT_OPERATION_FAILED");
    }

    return mapAccount(data as CreditRpcPayload["account"]);
  }

  async reserve(input: ReserveCreditsInput): Promise<CreditMutationResult> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc("velto_credit_reserve", {
      p_user_id: input.userId,
      p_credits: input.credits,
      p_operation_type: input.operationType,
      p_idempotency_key: input.idempotencyKey,
      p_provider: input.provider || null,
      p_reference_id: input.referenceId || null,
      p_metadata: input.metadata || {},
      p_expires_at: input.expiresAt || null,
    });

    if (error || !data) {
      throw mapDatabaseError(error?.message || "CREDIT_OPERATION_FAILED");
    }

    return mapMutation(data as CreditRpcPayload);
  }

  async settle(input: SettleCreditsInput): Promise<CreditMutationResult> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc("velto_credit_settle", {
      p_user_id: input.userId,
      p_reservation_id: input.reservationId,
      p_final_credits: input.finalCredits,
      p_provider_cost_usd: input.providerCostUsd ?? null,
      p_provider_request_id: input.providerRequestId || null,
      p_metadata: input.metadata || {},
    });

    if (error || !data) {
      throw mapDatabaseError(error?.message || "CREDIT_OPERATION_FAILED");
    }

    return mapMutation(data as CreditRpcPayload);
  }

  async markProviderDispatch(
    input: MarkProviderDispatchInput,
  ): Promise<CreditMutationResult> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc(
      "velto_credit_mark_provider_dispatch",
      {
        p_user_id: input.userId,
        p_reservation_id: input.reservationId,
        p_provider_request_id: input.providerRequestId,
        p_metadata: input.metadata || {},
      },
    );

    if (error || !data) {
      throw mapDatabaseError(error?.message || "CREDIT_OPERATION_FAILED");
    }

    return mapMutation(data as CreditRpcPayload);
  }

  async release(input: ReleaseCreditsInput): Promise<CreditMutationResult> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc("velto_credit_release", {
      p_user_id: input.userId,
      p_reservation_id: input.reservationId,
      p_reason: input.reason,
      p_metadata: input.metadata || {},
    });

    if (error || !data) {
      throw mapDatabaseError(error?.message || "CREDIT_OPERATION_FAILED");
    }

    return mapMutation(data as CreditRpcPayload);
  }
}
