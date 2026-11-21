export type CreditQualityMode = "draft" | "standard" | "pro" | "cinematic";

export type MeteredOperationType =
  | "creator_image"
  | "creator_voice"
  | "creator_dialogue_voice"
  | "creator_video"
  | "creator_export";

export type CreatorOperationManifest = {
  images?: number;
  voices?: number;
  dialogueVoices?: number;
  videos?: number;
  exports?: number;
};

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

export function estimateCreatorOperationManifest(
  manifest: CreatorOperationManifest,
  qualityMode: unknown,
) {
  const counts = {
    images: Math.max(0, Math.trunc(Number(manifest.images) || 0)),
    voices: Math.max(0, Math.trunc(Number(manifest.voices) || 0)),
    dialogueVoices: Math.max(0, Math.trunc(Number(manifest.dialogueVoices) || 0)),
    videos: Math.max(0, Math.trunc(Number(manifest.videos) || 0)),
    exports: Math.max(0, Math.trunc(Number(manifest.exports) || 0)),
  };

  return {
    counts,
    totalCredits:
      counts.images * getOperationCreditCost("creator_image", qualityMode) +
      counts.voices * getOperationCreditCost("creator_voice", qualityMode) +
      counts.dialogueVoices *
        getOperationCreditCost("creator_dialogue_voice", qualityMode) +
      counts.videos * getOperationCreditCost("creator_video", qualityMode) +
      counts.exports * getOperationCreditCost("creator_export", qualityMode),
  };
}
