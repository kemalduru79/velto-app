import {
  getCreatorMediaRoute,
  normalizeCreatorQualityMode,
  type CreatorQualityMode,
} from "./mediaRouting";

export type CreatorVoiceFormat = "short_form" | "youtube_video";
export type CreatorVoiceRole = "narrator" | "dialogue";
export type CreatorVoiceProfile =
  | "faceless_narrator"
  | "brand_voice"
  | "host"
  | "persona"
  | "character";
export type CreatorVoiceTimingStatus = "safe" | "tight" | "blocked";

export type CreatorVoiceRouteInput = {
  qualityMode?: unknown;
  format?: unknown;
  role?: CreatorVoiceRole;
  language?: unknown;
  text?: unknown;
  companionText?: unknown;
  targetSceneDurationSec?: unknown;
  sceneIndex?: unknown;
  sceneCount?: unknown;
  voiceProfile?: unknown;
  hasExplicitVoiceId?: boolean;
};

export type CreatorVoiceRoute = {
  qualityMode: CreatorQualityMode;
  format: CreatorVoiceFormat;
  role: CreatorVoiceRole;
  voiceProfile: CreatorVoiceProfile;
  voiceStrategy: "none" | "balanced" | "professional" | "premium";
  deliveryStyle: "hook_led_concise" | "sectioned_narration";
  continuity: "session" | "project" | "premium_project";
  targetSceneDurationSec: number;
  estimatedSpeechSeconds: number;
  estimatedSpeechSecondsAtRouteSpeed: number;
  wordCount: number;
  safeWordLimit: number;
  hardWordLimit: number;
  recommendedSpeed: number;
  timingStatus: CreatorVoiceTimingStatus;
  canGenerate: boolean;
  warning: string;
  routeKey: string;
};

type VoiceSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function normalizeCreatorVoiceFormat(
  value: unknown,
  fallback: CreatorVoiceFormat = "short_form",
): CreatorVoiceFormat {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === "youtube_video" ||
    normalized.includes("youtube") ||
    normalized.includes("long-form") ||
    normalized.includes("long form")
  ) {
    return "youtube_video";
  }

  if (
    normalized === "short_form" ||
    normalized.includes("short") ||
    normalized.includes("reel") ||
    normalized.includes("tiktok")
  ) {
    return "short_form";
  }

  return fallback;
}

export function normalizeCreatorVoiceProfile(
  value: unknown,
  role: CreatorVoiceRole = "narrator",
): CreatorVoiceProfile {
  const normalized = String(value || "").trim().toLowerCase();

  if (role === "dialogue") {
    return "character";
  }

  if (normalized.includes("brand") || normalized.includes("marka")) {
    return "brand_voice";
  }

  if (
    normalized.includes("host") ||
    normalized.includes("presenter") ||
    normalized.includes("sunucu")
  ) {
    return "host";
  }

  if (normalized.includes("persona") || normalized.includes("character")) {
    return "persona";
  }

  return "faceless_narrator";
}

export function countCreatorVoiceWords(value: unknown) {
  const text = normalizeText(value)
    .replace(/[“”"'’.,!?;:()\[\]{}]/g, " ")
    .trim();

  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function getWordsPerSecond(language: unknown, role: CreatorVoiceRole) {
  const isTurkish = language === "tr";

  if (role === "dialogue") {
    return isTurkish ? 2.05 : 2.22;
  }

  return isTurkish ? 2.15 : 2.35;
}

function getBaseVoiceSettings({
  qualityMode,
  format,
  role,
  voiceProfile,
}: {
  qualityMode: CreatorQualityMode;
  format: CreatorVoiceFormat;
  role: CreatorVoiceRole;
  voiceProfile: CreatorVoiceProfile;
}): VoiceSettings {
  if (role === "dialogue") {
    const dialogueSettings: Record<Exclude<CreatorQualityMode, "draft">, VoiceSettings> = {
      standard: {
        stability: 0.42,
        similarityBoost: 0.82,
        style: 0.42,
        speed: format === "short_form" ? 1.04 : 0.98,
      },
      pro: {
        stability: 0.46,
        similarityBoost: 0.86,
        style: 0.5,
        speed: format === "short_form" ? 1.02 : 0.97,
      },
      cinematic: {
        stability: 0.5,
        similarityBoost: 0.9,
        style: 0.56,
        speed: format === "short_form" ? 1 : 0.95,
      },
    };

    return dialogueSettings[qualityMode === "draft" ? "standard" : qualityMode];
  }

  const narratorSettings: Record<Exclude<CreatorQualityMode, "draft">, VoiceSettings> = {
    standard: {
      stability: format === "short_form" ? 0.44 : 0.55,
      similarityBoost: 0.82,
      style: format === "short_form" ? 0.34 : 0.24,
      speed: format === "short_form" ? 1.04 : 0.96,
    },
    pro: {
      stability: format === "short_form" ? 0.42 : 0.58,
      similarityBoost: 0.87,
      style: format === "short_form" ? 0.4 : 0.28,
      speed: format === "short_form" ? 1.02 : 0.95,
    },
    cinematic: {
      stability: format === "short_form" ? 0.48 : 0.64,
      similarityBoost: 0.91,
      style: format === "short_form" ? 0.46 : 0.34,
      speed: format === "short_form" ? 1 : 0.93,
    },
  };
  const settings = {
    ...narratorSettings[qualityMode === "draft" ? "standard" : qualityMode],
  };

  if (voiceProfile === "brand_voice") {
    settings.stability = clamp(settings.stability + 0.05, 0, 1);
    settings.similarityBoost = clamp(settings.similarityBoost + 0.02, 0, 1);
    settings.style = clamp(settings.style - 0.04, 0, 1);
  } else if (voiceProfile === "host" || voiceProfile === "persona") {
    settings.style = clamp(settings.style + 0.06, 0, 1);
  }

  return settings;
}

export function getCreatorVoiceRoute(
  input: CreatorVoiceRouteInput,
): CreatorVoiceRoute {
  const qualityMode = normalizeCreatorQualityMode(input.qualityMode, "standard");
  const mediaRoute = getCreatorMediaRoute(qualityMode);
  const format = normalizeCreatorVoiceFormat(input.format);
  const role = input.role === "dialogue" ? "dialogue" : "narrator";
  const voiceProfile = normalizeCreatorVoiceProfile(input.voiceProfile, role);
  const targetSceneDurationSec = round(
    clamp(safeNumber(input.targetSceneDurationSec, 10), 3, 120),
    1,
  );
  const wordCount = countCreatorVoiceWords(
    [normalizeText(input.text), normalizeText(input.companionText)]
      .filter(Boolean)
      .join(" "),
  );
  const wordsPerSecond = getWordsPerSecond(input.language, role);
  const estimatedSpeechSeconds = wordCount
    ? round(wordCount / wordsPerSecond, 2)
    : 0;
  const baseSettings = getBaseVoiceSettings({
    qualityMode,
    format,
    role,
    voiceProfile,
  });
  const safeWindowSeconds = targetSceneDurationSec * 0.88;
  const hardWindowSeconds = targetSceneDurationSec * 1.05;
  const requiredSpeed = estimatedSpeechSeconds
    ? estimatedSpeechSeconds / Math.max(1, safeWindowSeconds)
    : baseSettings.speed;
  const recommendedSpeed = round(
    clamp(Math.max(baseSettings.speed, requiredSpeed), 0.82, 1.2),
    2,
  );
  const estimatedSpeechSecondsAtRouteSpeed = estimatedSpeechSeconds
    ? round(estimatedSpeechSeconds / recommendedSpeed, 2)
    : 0;
  const safeWordLimit = Math.max(
    1,
    Math.floor(safeWindowSeconds * wordsPerSecond * 1.2),
  );
  const hardWordLimit = Math.max(
    safeWordLimit + 1,
    Math.floor(hardWindowSeconds * wordsPerSecond * 1.2),
  );
  const timingStatus: CreatorVoiceTimingStatus =
    estimatedSpeechSecondsAtRouteSpeed <= safeWindowSeconds
      ? "safe"
      : estimatedSpeechSecondsAtRouteSpeed <= hardWindowSeconds
        ? "tight"
        : "blocked";
  // CreatorLab is audio-first: timing risk must inform the timeline, not block TTS.
  // Draft remains the only mode where voice generation is unavailable.
  const canGenerate = mediaRoute.actions.voice_over;
  const warning =
    qualityMode === "draft"
      ? "Draft mode does not generate voice-over."
      : timingStatus === "blocked"
        ? "Spoken text is longer than the planned scene. Voice-over can continue; the timeline should extend or split this scene after the real audio duration is measured."
        : timingStatus === "tight"
          ? "Spoken text is tight for this scene; smart pacing is applied and the measured audio duration will update the timeline."
          : "";
  const deliveryStyle =
    format === "short_form" ? "hook_led_concise" : "sectioned_narration";
  const continuity =
    qualityMode === "cinematic"
      ? "premium_project"
      : qualityMode === "pro"
        ? "project"
        : "session";
  const sceneIndex = Math.max(0, Math.round(safeNumber(input.sceneIndex, 0)));
  const sceneCount = Math.max(1, Math.round(safeNumber(input.sceneCount, 1)));
  const routeKey = [
    "creator-voice-v1",
    qualityMode,
    format,
    role,
    voiceProfile,
    mediaRoute.voiceStrategy,
    targetSceneDurationSec,
    recommendedSpeed,
    timingStatus,
    sceneIndex,
    sceneCount,
    input.hasExplicitVoiceId ? "explicit" : "fallback",
  ].join(":");

  return {
    qualityMode,
    format,
    role,
    voiceProfile,
    voiceStrategy: mediaRoute.voiceStrategy,
    deliveryStyle,
    continuity,
    targetSceneDurationSec,
    estimatedSpeechSeconds,
    estimatedSpeechSecondsAtRouteSpeed,
    wordCount,
    safeWordLimit,
    hardWordLimit,
    recommendedSpeed,
    timingStatus,
    canGenerate,
    warning,
    routeKey,
  };
}

function readSetting(
  value: unknown,
  fallback: number,
  min = 0,
  max = 1.2,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

export function getCreatorRoutedVoiceSettings({
  route,
  settings,
}: {
  route: CreatorVoiceRoute;
  settings?: Record<string, unknown> | null;
}): VoiceSettings {
  const defaults = getBaseVoiceSettings(route);
  const userStability = readSetting(settings?.stability, defaults.stability, 0, 1);
  const userSimilarity = readSetting(
    settings?.similarityBoost ?? settings?.similarity_boost,
    defaults.similarityBoost,
    0,
    1,
  );
  const userStyle = readSetting(settings?.style, defaults.style, 0, 1);

  return {
    stability: round((userStability + defaults.stability) / 2),
    similarityBoost: round(
      Math.max(defaults.similarityBoost, userSimilarity),
    ),
    style: round((userStyle + defaults.style) / 2),
    speed: round(
      Math.max(
        route.recommendedSpeed,
        readSetting(settings?.speed, defaults.speed, 0.7, 1.2),
      ),
    ),
  };
}

export function getCreatorVoiceScriptGuidance({
  format,
  durationSec,
  sceneCount,
  language,
}: {
  format?: unknown;
  durationSec: number;
  sceneCount: number;
  language: "tr" | "en";
}) {
  const normalizedFormat = normalizeCreatorVoiceFormat(format);
  const safeSceneCount = Math.max(1, Math.round(sceneCount || 1));
  const safeDurationSec = clamp(Math.round(durationSec || 60), 5, 3600);
  const targetSceneDurationSec = Math.max(
    3,
    round(safeDurationSec / safeSceneCount, 1),
  );
  const wordsPerSecond = getWordsPerSecond(language, "narrator");
  const speechCoverage = normalizedFormat === "short_form" ? 0.82 : 0.72;
  const targetWordsTotal = Math.max(
    8,
    Math.floor(safeDurationSec * speechCoverage * wordsPerSecond),
  );
  const maxWordsTotal = Math.max(
    targetWordsTotal + safeSceneCount,
    Math.floor(safeDurationSec * 0.88 * wordsPerSecond),
  );
  const targetWordsPerScene = Math.max(
    5,
    Math.floor(targetWordsTotal / safeSceneCount),
  );
  const maxWordsPerScene = Math.max(
    targetWordsPerScene + 2,
    Math.floor(maxWordsTotal / safeSceneCount),
  );

  return {
    format: normalizedFormat,
    deliveryStyle:
      normalizedFormat === "short_form"
        ? "Fast, concise, hook-led narration with no slow introduction."
        : "Section-based narration with clear transitions, breathing room, and periodic retention resets.",
    openingRule:
      normalizedFormat === "short_form"
        ? "The first spoken line must deliver the curiosity hook immediately and fit within roughly 3 seconds."
        : "Open with a concise promise, then move through hook, context, sections, payoff, recap, and a soft call to action.",
    structureRule:
      normalizedFormat === "short_form"
        ? "Use one compact idea per scene; every line must move the hook toward payoff."
        : "Group scenes into logical sections and use short bridge lines between sections instead of repeating the hook.",
    speechCoverage,
    targetSceneDurationSec,
    targetWordsTotal,
    maxWordsTotal,
    targetWordsPerScene,
    maxWordsPerScene,
  };
}
