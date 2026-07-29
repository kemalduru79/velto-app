export type CreditQualityMode = "draft" | "standard" | "pro" | "cinematic";

export type MeteredOperationType =
  | "creator_image"
  | "creator_voice"
  | "creator_dialogue_voice"
  | "creator_video"
  | "creator_export";

const OPERATION_CREDIT_POLICY: Record<
  MeteredOperationType,
  Record<CreditQualityMode, number>
> = {
  creator_image: { draft: 0, standard: 1, pro: 2, cinematic: 4 },
  creator_voice: { draft: 0, standard: 1, pro: 2, cinematic: 3 },
  creator_dialogue_voice: { draft: 0, standard: 1, pro: 2, cinematic: 3 },
  creator_video: { draft: 0, standard: 0, pro: 6, cinematic: 10 },
  creator_export: { draft: 0, standard: 1, pro: 2, cinematic: 3 },
};

export function normalizeCreditQualityMode(value: unknown): CreditQualityMode {
  if (value === "draft" || value === "pro" || value === "cinematic") {
    return value;
  }

  return "standard";
}

export function getOperationCreditCost(
  operationType: MeteredOperationType,
  qualityMode: unknown,
) {
  const normalizedQualityMode = normalizeCreditQualityMode(qualityMode);
  return OPERATION_CREDIT_POLICY[operationType][normalizedQualityMode];
}
