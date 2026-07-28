export type CreditReservationStatus =
  | "reserved"
  | "settled"
  | "released"
  | "expired";

export type CreditAccount = {
  userId: string;
  balanceCredits: number;
  reservedCredits: number;
  availableCredits: number;
  lifetimeGrantedCredits: number;
  lifetimeUsedCredits: number;
  updatedAt: string;
};

export type CreditReservation = {
  id: string;
  userId: string;
  operationType: string;
  provider?: string;
  referenceId?: string;
  reservedCredits: number;
  settledCredits: number;
  status: CreditReservationStatus;
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ReserveCreditsInput = {
  userId: string;
  credits: number;
  operationType: string;
  idempotencyKey: string;
  provider?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
};

export type SettleCreditsInput = {
  userId: string;
  reservationId: string;
  finalCredits: number;
  providerCostUsd?: number;
  providerRequestId?: string;
  metadata?: Record<string, unknown>;
};

export type ReleaseCreditsInput = {
  userId: string;
  reservationId: string;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type CreditMutationResult = {
  account: CreditAccount;
  reservation: CreditReservation;
};

export interface CreditRepository {
  getAccount(userId: string): Promise<CreditAccount>;
  reserve(input: ReserveCreditsInput): Promise<CreditMutationResult>;
  settle(input: SettleCreditsInput): Promise<CreditMutationResult>;
  release(input: ReleaseCreditsInput): Promise<CreditMutationResult>;
}
