export const CREATOR_SCRIPT_BUILD_REPAIR_OUTPUT_TOKENS_PER_WORD = 1.5;
export const CREATOR_SCRIPT_BUILD_REPAIR_OUTPUT_JSON_RESERVE = 300;

export function getCreatorScriptBuildRepairCorrectiveMaxOutputTokens(input: {
  mode: "additive" | "replacement";
  candidateOrdinal: number | null;
  requiredFinalMaxWords: number | null;
}) {
  if (
    input.mode !== "replacement" ||
    input.candidateOrdinal === null ||
    input.candidateOrdinal <= 1 ||
    input.requiredFinalMaxWords === null ||
    !Number.isFinite(input.requiredFinalMaxWords) ||
    input.requiredFinalMaxWords <= 0
  ) {
    return null;
  }
  return Math.ceil(
    input.requiredFinalMaxWords *
      CREATOR_SCRIPT_BUILD_REPAIR_OUTPUT_TOKENS_PER_WORD,
  ) + CREATOR_SCRIPT_BUILD_REPAIR_OUTPUT_JSON_RESERVE;
}
