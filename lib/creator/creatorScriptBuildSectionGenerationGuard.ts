import {
  countCreatorScriptWords,
  creatorScriptAdditiveExpansionIntroducesLocalRepetition,
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

function continuationRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function creatorScriptBuildSectionContinuationIntroducesLocalRepetition(
  input: { previous: unknown; continuation: unknown },
) {
  const previous = continuationRecord(input.previous);
  const continuation = continuationRecord(input.continuation);
  const previousText =
    typeof previous?.text === "string" ? previous.text : "";
  const continuationText =
    typeof continuation?.text === "string" ? continuation.text : "";
  if (!previousText.trim() || !continuationText.trim()) return false;
  return creatorScriptAdditiveExpansionIntroducesLocalRepetition({
    sectionText: previousText,
    additionalText: continuationText,
  });
}

export function mergeCreatorScriptBuildSectionContinuation(
  previousValue: unknown,
  continuationValue: unknown,
) {
  const previous = continuationRecord(previousValue) || {};
  const continuation = continuationRecord(continuationValue) || {};
  const previousText =
    typeof previous.text === "string" ? previous.text : "";
  const continuationText =
    typeof continuation.text === "string" ? continuation.text.trim() : "";
  const separator =
    previousText && continuationText && !/\s$/u.test(previousText) ? " " : "";
  const previousClaimIds = Array.isArray(previous.claimIds)
    ? previous.claimIds.filter((value): value is string =>
      typeof value === "string"
    )
    : [];
  const continuationClaimIds = Array.isArray(continuation.claimIds)
    ? continuation.claimIds.filter((value): value is string =>
      typeof value === "string"
    )
    : [];
  return {
    heading: previous.heading ?? null,
    text: `${previousText}${separator}${continuationText}`,
    claimIds: [...new Set([...previousClaimIds, ...continuationClaimIds])],
  };
}

export type CreatorScriptBuildSectionContinuationPrefixSelection = Readonly<{
  accepted: boolean;
  value: Readonly<Record<string, unknown>> | null;
  retainedSegmentCount: number;
  reason:
    | "accepted"
    | "segments_invalid"
    | "sentence_incomplete"
    | "local_repetition"
    | "below_minimum"
    | "above_maximum";
}>;

function continuationSegmentEndsAtSentenceBoundary(text: string) {
  return /[.!?…][\p{Pe}\p{Pf}"']*$/u.test(text.trim());
}

export function selectCreatorScriptBuildSectionContinuationPrefix(input: {
  previous: unknown;
  continuation: unknown;
  budget: CreatorScriptSectionBudget;
}): CreatorScriptBuildSectionContinuationPrefixSelection {
  const continuation = continuationRecord(input.continuation);
  const segments = continuation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    return Object.freeze({
      accepted: false,
      value: null,
      retainedSegmentCount: 0,
      reason: "segments_invalid",
    });
  }

  const retained: Array<{ text: string; claimIds: string[] }> = [];
  let lastReason: CreatorScriptBuildSectionContinuationPrefixSelection["reason"] =
    "below_minimum";
  let selected: CreatorScriptBuildSectionContinuationPrefixSelection | null =
    null;

  for (const value of segments) {
    const segment = continuationRecord(value);
    const text = typeof segment?.text === "string" ? segment.text.trim() : "";
    const claimIds = Array.isArray(segment?.claimIds) &&
        segment.claimIds.every((claimId) => typeof claimId === "string")
      ? [...segment.claimIds] as string[]
      : null;
    if (!text || !claimIds) {
      lastReason = "segments_invalid";
      break;
    }
    if (!continuationSegmentEndsAtSentenceBoundary(text)) {
      lastReason = "sentence_incomplete";
      break;
    }

    const retainedContinuation = {
      text: retained.map((item) => item.text).join(" "),
      claimIds: [...new Set(retained.flatMap((item) => item.claimIds))],
    };
    const repetitionAuthority = retained.length > 0
      ? mergeCreatorScriptBuildSectionContinuation(
          input.previous,
          retainedContinuation,
        )
      : input.previous;
    if (
      creatorScriptBuildSectionContinuationIntroducesLocalRepetition({
        previous: repetitionAuthority,
        continuation: { text, claimIds },
      })
    ) {
      lastReason = "local_repetition";
      break;
    }

    const candidateSegments = [...retained, { text, claimIds }];
    const candidateContinuation = {
      text: candidateSegments.map((item) => item.text).join(" "),
      claimIds: [...new Set(candidateSegments.flatMap((item) => item.claimIds))],
    };
    const merged = mergeCreatorScriptBuildSectionContinuation(
      input.previous,
      candidateContinuation,
    );
    const validation = validateCreatorScriptBuildGeneratedSectionLength({
      value: merged,
      budget: input.budget,
    });
    if (validation.reason === "above_maximum") {
      lastReason = "above_maximum";
      break;
    }

    retained.push({ text, claimIds });
    lastReason = validation.reason;
    if (validation.accepted) {
      selected = Object.freeze({
        accepted: true,
        value: Object.freeze(merged),
        retainedSegmentCount: retained.length,
        reason: "accepted",
      });
    }
  }

  return selected || Object.freeze({
    accepted: false,
    value: null,
    retainedSegmentCount: retained.length,
    reason: lastReason,
  });
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
