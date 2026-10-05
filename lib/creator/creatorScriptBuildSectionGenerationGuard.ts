import {
  countCreatorScriptWords,
  type CreatorScriptSectionBudget,
} from "./creatorScript.ts";

export type CreatorScriptBuildSectionLengthValidation = Readonly<{
  accepted: boolean;
  wordCount: number;
  minimumWords: number;
  targetWords: number;
  maximumWords: number;
  reason: "accepted" | "below_minimum" | "above_maximum";
}>;

export function validateCreatorScriptBuildGeneratedSectionLength(input: {
  value: unknown;
  budget: CreatorScriptSectionBudget;
}): CreatorScriptBuildSectionLengthValidation {
  const record =
    input.value && typeof input.value === "object" && !Array.isArray(input.value)
      ? input.value as Record<string, unknown>
      : null;
  const text = typeof record?.text === "string" ? record.text : "";
  const wordCount = countCreatorScriptWords(text);
  const reason =
    wordCount < input.budget.minimumWords
      ? "below_minimum"
      : wordCount > input.budget.maximumWords
        ? "above_maximum"
        : "accepted";
  return Object.freeze({
    accepted: reason === "accepted",
    wordCount,
    minimumWords: input.budget.minimumWords,
    targetWords: input.budget.targetWords,
    maximumWords: input.budget.maximumWords,
    reason,
  });
}

export function createCreatorScriptBuildSectionLengthRecoveryBand(
  validation: CreatorScriptBuildSectionLengthValidation,
) {
  if (validation.reason === "below_minimum") {
    return Object.freeze({
      minimumWords: validation.targetWords,
      maximumWords: validation.maximumWords,
    });
  }
  if (validation.reason === "above_maximum") {
    return Object.freeze({
      minimumWords: validation.minimumWords,
      maximumWords: validation.targetWords,
    });
  }
  return Object.freeze({
    minimumWords: validation.minimumWords,
    maximumWords: validation.maximumWords,
  });
}

export function createCreatorScriptBuildSectionContinuationBand(
  validation: CreatorScriptBuildSectionLengthValidation,
) {
  if (validation.reason !== "below_minimum") return null;
  return Object.freeze({
    minimumWords: validation.targetWords - validation.wordCount,
    maximumWords: validation.maximumWords - validation.wordCount,
  });
}

export function getCreatorScriptBuildSectionContinuationMaxOutputTokens(
  maximumWords: number,
) {
  if (!Number.isInteger(maximumWords) || maximumWords < 1) return null;
  return Math.max(256, Math.ceil(maximumWords * 3) + 128);
}

export async function runCreatorScriptBuildSectionGenerationWithBoundedRetry<T>(input: {
  budget: CreatorScriptSectionBudget;
  execute: (recovery: Readonly<{
    ordinal: 1 | 2;
    previousValidation: CreatorScriptBuildSectionLengthValidation | null;
  }>) => Promise<T>;
}) {
  const first = await input.execute({
    ordinal: 1,
    previousValidation: null,
  });
  const firstValidation = validateCreatorScriptBuildGeneratedSectionLength({
    value: first,
    budget: input.budget,
  });
  if (firstValidation.accepted) {
    return Object.freeze({
      value: first,
      attempts: 1 as const,
      validation: firstValidation,
    });
  }

  const second = await input.execute({
    ordinal: 2,
    previousValidation: firstValidation,
  });
  const secondValidation = validateCreatorScriptBuildGeneratedSectionLength({
    value: second,
    budget: input.budget,
  });
  return Object.freeze({
    value: second,
    attempts: 2 as const,
    validation: secondValidation,
  });
}
