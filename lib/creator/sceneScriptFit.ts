import { matchAudioDurationToScene } from "../video/audioDurationMatching.ts";

export type CreatorSceneScriptFitState =
  | "accepted"
  | "extend_duration"
  | "split_recommended"
  | "rejected";

export type CreatorSceneScriptFitReason =
  | "FIT_ACCEPTED"
  | "EMPTY_OUTPUT"
  | "BELOW_MINIMUM_WORDS"
  | "ABOVE_MAXIMUM_WORDS"
  | "MATERIALLY_UNDERFILLED"
  | "CONTENT_RETENTION_TOO_LOW"
  | "FACTUAL_ANCHOR_MISSING"
  | "DURATION_EXTENSION_RECOMMENDED"
  | "SCENE_SPLIT_RECOMMENDED";

export type CreatorSceneScriptFitDraft = {
  narration: string;
  dialogue: string;
};

export type CreatorSceneScriptFitResult = {
  state: CreatorSceneScriptFitState;
  reason: CreatorSceneScriptFitReason;
  narration: string;
  dialogue: string;
  wordCount: number;
  originalWordCount: number;
  retainedWordRatio: number;
  estimatedSpeechSec: number;
  targetDurationSec: number;
  minWords: number;
  acceptanceMinWords: number;
  targetWords: number;
  maxWords: number;
  suggestedDurationSec: number | null;
  recommendedSplitCount: number | null;
};

const WORDS_PER_SECOND = { en: 2.25, tr: 2.05 } as const;
const MIN_CONTENT_RETENTION_RATIO = 0.6;
const SUBSTANTIAL_SCRIPT_WORDS = 12;
// General script health allows roughly 52% occupancy. Autofit is an explicit
// production-fitting action, so its candidate must reach at least 85% of the
// canonical target-word budget while still allowing modest under-target copy.
const AUTOFIT_MIN_TARGET_WORD_RATIO = 0.85;
const SPEECH_END_BUFFER_SECONDS = 0.8;
const TIMING_TAIL_BUFFER_SECONDS = 0.75;
const PREFERRED_MAX_SCENE_SECONDS = 20;
const HARD_MAX_SCENE_SECONDS = 30;

function normalize(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function speech(draft: CreatorSceneScriptFitDraft) {
  return [draft.narration, draft.dialogue].map(normalize).filter(Boolean).join(" ");
}

function wordCount(value: string) {
  return normalize(value).split(" ").filter(Boolean).length;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function factualAnchors(value: string) {
  return Array.from(new Set(
    normalize(value).match(/(?<![\p{L}\p{N}_])(?:\d+(?:[.,]\d+)*%?|[$€£]\d+(?:[.,]\d+)*)(?![\p{L}\p{N}_])/gu) || [],
  ));
}

function baseResult(input: {
  original: CreatorSceneScriptFitDraft;
  candidate: CreatorSceneScriptFitDraft;
  language: "en" | "tr";
  targetDurationSec: number;
  minWords: number;
  targetWords: number;
  maxWords: number;
}) {
  const originalSpeech = speech(input.original);
  const candidateSpeech = speech(input.candidate);
  const originalWordCount = wordCount(originalSpeech);
  const candidateWordCount = wordCount(candidateSpeech);
  const retainedWordRatio = originalWordCount > 0
    ? round(candidateWordCount / originalWordCount)
    : 1;
  const estimatedSpeechSec = round(candidateWordCount / WORDS_PER_SECOND[input.language]);

  return {
    originalSpeech,
    candidateSpeech,
    originalWordCount,
    candidateWordCount,
    retainedWordRatio,
    estimatedSpeechSec,
  };
}

/**
 * Validates one model-produced fit without another provider call. The lower
 * occupancy boundary reuses the canonical minimum-word budget; the upper
 * boundary reuses the existing target-minus-0.8s script-health rule.
 */
export function validateCreatorSceneScriptFit(input: {
  original: CreatorSceneScriptFitDraft;
  candidate: CreatorSceneScriptFitDraft;
  language: "en" | "tr";
  targetDurationSec: number;
  minWords: number;
  targetWords: number;
  maxWords: number;
}): CreatorSceneScriptFitResult {
  const targetDurationSec = Math.max(3, Number(input.targetDurationSec) || 3);
  const minWords = Math.max(3, Math.round(Number(input.minWords) || 3));
  const targetWords = Math.max(minWords, Math.round(Number(input.targetWords) || minWords));
  const maxWords = Math.max(targetWords + 1, Math.round(Number(input.maxWords) || targetWords + 1));
  const acceptanceMinWords = Math.max(
    minWords,
    Math.ceil(targetWords * AUTOFIT_MIN_TARGET_WORD_RATIO),
  );
  const details = baseResult({ ...input, targetDurationSec, minWords, targetWords, maxWords });
  const result = (
    state: CreatorSceneScriptFitState,
    reason: CreatorSceneScriptFitReason,
    timing?: { suggestedDurationSec?: number; recommendedSplitCount?: number },
  ): CreatorSceneScriptFitResult => ({
    state,
    reason,
    narration: normalize(input.candidate.narration),
    dialogue: normalize(input.candidate.dialogue),
    wordCount: details.candidateWordCount,
    originalWordCount: details.originalWordCount,
    retainedWordRatio: details.retainedWordRatio,
    estimatedSpeechSec: details.estimatedSpeechSec,
    targetDurationSec: round(targetDurationSec),
    minWords,
    acceptanceMinWords,
    targetWords,
    maxWords,
    suggestedDurationSec: timing?.suggestedDurationSec ?? null,
    recommendedSplitCount: timing?.recommendedSplitCount ?? null,
  });

  if (!details.candidateSpeech) return result("rejected", "EMPTY_OUTPUT");
  if (details.candidateWordCount < minWords) {
    return result("rejected", details.candidateWordCount <= 2 ? "EMPTY_OUTPUT" : "BELOW_MINIMUM_WORDS");
  }
  if (details.candidateWordCount < acceptanceMinWords) {
    return result("rejected", "MATERIALLY_UNDERFILLED");
  }
  if (
    details.originalWordCount >= SUBSTANTIAL_SCRIPT_WORDS &&
    details.retainedWordRatio < MIN_CONTENT_RETENTION_RATIO
  ) {
    return result("rejected", "CONTENT_RETENTION_TOO_LOW");
  }
  if (factualAnchors(details.originalSpeech).some((anchor) => !details.candidateSpeech.includes(anchor))) {
    return result("rejected", "FACTUAL_ANCHOR_MISSING");
  }

  const exceedsWordBudget = details.candidateWordCount > maxWords;
  const exceedsSpeechWindow = details.estimatedSpeechSec > targetDurationSec - SPEECH_END_BUFFER_SECONDS;
  if (exceedsWordBudget || exceedsSpeechWindow) {
    const originalCouldNotFit = details.originalWordCount > maxWords;
    if (!originalCouldNotFit) return result("rejected", "ABOVE_MAXIMUM_WORDS");

    const timing = matchAudioDurationToScene({
      audioDurationSec: details.estimatedSpeechSec,
      plannedDurationSec: targetDurationSec,
      minDurationSec: 3,
      maxDurationSec: HARD_MAX_SCENE_SECONDS,
      preferredMaxSceneDurationSec: PREFERRED_MAX_SCENE_SECONDS,
      tailBufferSec: TIMING_TAIL_BUFFER_SECONDS,
    });
    if (timing.splitRecommended || !timing.fitsWithinHardLimit) {
      return result("split_recommended", "SCENE_SPLIT_RECOMMENDED", {
        suggestedDurationSec: timing.targetDurationSec,
        recommendedSplitCount: timing.recommendedSplitCount,
      });
    }
    return result("extend_duration", "DURATION_EXTENSION_RECOMMENDED", {
      suggestedDurationSec: timing.targetDurationSec,
    });
  }

  return result("accepted", "FIT_ACCEPTED");
}

export function applyCreatorSceneScriptFitResult(
  current: CreatorSceneScriptFitDraft,
  result: CreatorSceneScriptFitResult,
): CreatorSceneScriptFitDraft {
  return result.state === "accepted"
    ? { narration: result.narration, dialogue: result.dialogue }
    : current;
}

export async function runCreatorSceneScriptFitOnce<TResponse, TResult>(input: {
  generate: () => Promise<TResponse>;
  recordEconomics: (response: TResponse) => Promise<unknown>;
  validate: (response: TResponse) => TResult;
}): Promise<TResult> {
  const response = await input.generate();
  await input.recordEconomics(response);
  return input.validate(response);
}
