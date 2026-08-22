export type EconomicCostStatus = "exact" | "estimated" | "unknown" | "not_billable";
export type EconomicOperationState =
  | "reserved"
  | "dispatch_attempted"
  | "provider_accepted"
  | "provider_failed_before_acceptance"
  | "provider_billed"
  | "application_failed_after_provider_cost"
  | "settled"
  | "released"
  | "reconciled";

export type EconomicQuantities = Record<string, number | string | boolean | null>;

export type EconomicCostResult = {
  costStatus: EconomicCostStatus;
  providerCostUsd: number | null;
  reason?: string;
  components: Record<string, number>;
  pricingVersion: string;
  pricingAsOf: string;
  currency: "USD";
};

export type EconomicOperationInput = {
  attemptKey: string;
  logicalOperationId: string;
  idempotencyKey?: string | null;
  creditReservationId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  sceneId?: string | number | null;
  exportId?: string | null;
  route: string;
  operationType: string;
  productTier?: string | null;
  provider?: string | null;
  providerTier?: string | null;
  model?: string | null;
  fallbackProvider?: string | null;
  fallbackModel?: string | null;
  providerRequestId?: string | null;
  state: EconomicOperationState;
  billingMoment?: string | null;
  ambiguityReason?: string | null;
  generationAttempt?: number;
  fallbackAttempt?: boolean;
  generated?: boolean;
  assetIdentity?: string | null;
  reuseIdentity?: string | null;
  quantities?: EconomicQuantities;
  cost?: EconomicCostResult;
  dispatchedAt?: string | null;
  providerAcceptedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  reconciledAt?: string | null;
};
