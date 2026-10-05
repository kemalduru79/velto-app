export type CreatorSceneSpeechHealthStatus = "ready" | "too_short" | "too_long";

export const CREATOR_SCENE_MIN_DURATION_SECONDS = 3;
export const CREATOR_SCENE_HARD_MAX_DURATION_SECONDS = 30;
export const CREATOR_SCENE_SPEECH_TAIL_SECONDS = 0.8;

export function getCreatorProductionWordsPerSecond(language: "tr" | "en") {
  // Production planning is intentionally slightly more conservative than
  // script-authoring acceptance because the actual TTS voice may speak below
  // the script planning rate. Real audio duration remains authoritative later.
  return language === "tr" ? 2.05 : 2.25;
}

export function countCreatorSceneSpeechWords(value: string) {
  const normalized = String(value || "")
    .replace(/[“”"'’.,!?;:()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.split(" ").filter(Boolean).length : 0;
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function createCreatorSceneSpeechBudget(input: {
  narration?: string;
  dialogue?: string;
  language: "tr" | "en";
  minimumPlannedDurationSec?: number;
}) {
  const speech = [input.narration, input.dialogue]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  const wordsPerSecond = getCreatorProductionWordsPerSecond(input.language);
  const speechWordCount = countCreatorSceneSpeechWords(speech);
  const estimatedSpeechSec = speechWordCount
    ? round(speechWordCount / wordsPerSecond, 1)
    : 0;
  const requiredDurationSec = estimatedSpeechSec
    ? round(estimatedSpeechSec + CREATOR_SCENE_SPEECH_TAIL_SECONDS, 1)
    : CREATOR_SCENE_MIN_DURATION_SECONDS;
  const minimumPlannedDurationSec = Number.isFinite(
    Number(input.minimumPlannedDurationSec),
  )
    ? Number(input.minimumPlannedDurationSec)
    : CREATOR_SCENE_MIN_DURATION_SECONDS;
  const targetDurationSec = round(
    Math.min(
      CREATOR_SCENE_HARD_MAX_DURATION_SECONDS,
      Math.max(
        CREATOR_SCENE_MIN_DURATION_SECONDS,
        minimumPlannedDurationSec,
        requiredDurationSec,
      ),
    ),
    1,
  );
  const speechWindowSec = Math.max(
    1,
    targetDurationSec - CREATOR_SCENE_SPEECH_TAIL_SECONDS,
  );
  const targetWords = Math.max(1, Math.round(speechWindowSec * wordsPerSecond));
  const minWords = Math.max(4, Math.floor(targetWords * 0.52));
  const maxWords = Math.max(targetWords + 2, Math.floor(targetWords * 1.1));
  const status: CreatorSceneSpeechHealthStatus =
    requiredDurationSec > CREATOR_SCENE_HARD_MAX_DURATION_SECONDS
      ? "too_long"
      : speechWordCount > 0 && speechWordCount < minWords
        ? "too_short"
        : "ready";

  return {
    status,
    speechWordCount,
    estimatedSpeechSec,
    requiredDurationSec,
    targetDurationSec,
    minWords,
    targetWords,
    maxWords,
    tailBufferSec: CREATOR_SCENE_SPEECH_TAIL_SECONDS,
  };
}
