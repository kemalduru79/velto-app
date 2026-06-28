export type VideoProductProfile = "storyverse" | "creatorlab";
export type VideoQualityTier = "lite" | "standard" | "pro" | "cinematic";

export type TimelineSceneInput = {
  id?: number;
  text?: string;
  narration?: string;
  dialogue?: string;
  visualPrompt?: string;
  cameraDirection?: string;
  motionHint?: string;
  estimatedSpeechSeconds?: number;
  speechWordCount?: number;
};

export type TimelineScenePlan = {
  id: number;
  speechText: string;
  estimatedSpeechSeconds: number;
  speechWordCount: number;
  targetVisualSeconds: number;
  recommendedClipSeconds: 5 | 7 | 10;
  freezePaddingSeconds: number;
  speechFit: "safe" | "tight" | "too_long";
  productionRecommendation: "image_motion" | "standard_clip" | "premium_clip" | "split_or_rewrite";
  transitionHint: string;
};

export type TimelineSyncPlan = {
  product: VideoProductProfile;
  qualityTier: VideoQualityTier;
  timelineMode: "audio_first";
  durationSec: number;
  sceneCount: number;
  estimatedSpeechSeconds: number;
  estimatedSpeechWords: number;
  recommendedClipSeconds: 5 | 7 | 10;
  maxSpeechRatio: number;
  routePolicy: {
    storyverseCostProfile: "economy" | "balanced";
    creatorLabCreditProfile: "draft" | "standard" | "pro" | "cinematic";
    defaultVisualStrategy: "image_motion" | "standard_clip" | "premium_clip";
    runwayUsage: "limited" | "selective" | "premium";
    voiceStrategy: "economy_tts" | "professional_voice";
  };
  scenes: TimelineScenePlan[];
  warnings: string[];
  nextStep: string;
};

const WORDS_PER_SECOND = 2.35;

function asText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function countSpeechWords(value: string) {
  return asText(value).split(" ").filter(Boolean).length;
}

export function estimateSpeechSeconds(value: string) {
  const words = countSpeechWords(value);

  if (!words) {
    return 0;
  }

  return Math.round((words / WORDS_PER_SECOND) * 10) / 10;
}

export function normalizeVideoQualityTier(
  value: unknown,
  fallback: VideoQualityTier = "standard",
): VideoQualityTier {
  if (
    value === "lite" ||
    value === "standard" ||
    value === "pro" ||
    value === "cinematic"
  ) {
    return value;
  }

  return fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export function normalizeRunwayClipDuration(
  requestedDuration: unknown,
  qualityTier: VideoQualityTier = "standard",
) {
  const requested = normalizePositiveNumber(requestedDuration, 7, 3, 12);

  if (requested <= 5) {
    return {
      durationSec: 5 as const,
      reason: "Requested duration fits a compact 5-second visual block.",
    };
  }

  if (requested <= 7 && qualityTier !== "cinematic") {
    return {
      durationSec: 7 as const,
      reason: "Keeping the current 7-second Velto default for backward compatibility.",
    };
  }

  return {
    durationSec: 10 as const,
    reason: "Longer speech or premium mode should use a 10-second visual block when the selected video model supports it.",
  };
}

function getRoutePolicy(product: VideoProductProfile, qualityTier: VideoQualityTier): TimelineSyncPlan["routePolicy"] {
  if (product === "storyverse") {
    return {
      storyverseCostProfile: qualityTier === "lite" ? "economy" : "balanced",
      creatorLabCreditProfile: "draft",
      defaultVisualStrategy: qualityTier === "lite" ? "image_motion" : "standard_clip",
      runwayUsage: "limited",
      voiceStrategy: "economy_tts",
    };
  }

  if (qualityTier === "cinematic") {
    return {
      storyverseCostProfile: "balanced",
      creatorLabCreditProfile: "cinematic",
      defaultVisualStrategy: "premium_clip",
      runwayUsage: "premium",
      voiceStrategy: "professional_voice",
    };
  }

  if (qualityTier === "pro") {
    return {
      storyverseCostProfile: "balanced",
      creatorLabCreditProfile: "pro",
      defaultVisualStrategy: "premium_clip",
      runwayUsage: "selective",
      voiceStrategy: "professional_voice",
    };
  }

  return {
    storyverseCostProfile: "balanced",
    creatorLabCreditProfile: qualityTier === "lite" ? "draft" : "standard",
    defaultVisualStrategy: qualityTier === "lite" ? "image_motion" : "standard_clip",
    runwayUsage: qualityTier === "lite" ? "limited" : "selective",
    voiceStrategy: qualityTier === "lite" ? "economy_tts" : "professional_voice",
  };
}

function getProductionRecommendation({
  product,
  qualityTier,
  speechFit,
  targetVisualSeconds,
}: {
  product: VideoProductProfile;
  qualityTier: VideoQualityTier;
  speechFit: TimelineScenePlan["speechFit"];
  targetVisualSeconds: number;
}): TimelineScenePlan["productionRecommendation"] {
  if (speechFit === "too_long") {
    return "split_or_rewrite";
  }

  if (product === "storyverse" && qualityTier === "lite") {
    return "image_motion";
  }

  if (qualityTier === "pro" || qualityTier === "cinematic" || targetVisualSeconds >= 8) {
    return "premium_clip";
  }

  return "standard_clip";
}

export function createTimelineSyncPlan({
  product,
  qualityTier,
  durationSec,
  sceneCount,
  scenes,
}: {
  product: VideoProductProfile;
  qualityTier: VideoQualityTier;
  durationSec: number;
  sceneCount: number;
  scenes: TimelineSceneInput[];
}): TimelineSyncPlan {
  const safeSceneCount = Math.max(1, Math.round(sceneCount || scenes.length || 1));
  const safeDurationSec = Math.max(5, Math.round(durationSec || safeSceneCount * 7));
  const targetVisualSeconds = Math.max(5, Math.round(safeDurationSec / safeSceneCount));
  const maxSpeechRatio = product === "creatorlab" ? 0.82 : 0.72;
  const routePolicy = getRoutePolicy(product, qualityTier);
  const recommendedClipSeconds = normalizeRunwayClipDuration(targetVisualSeconds, qualityTier).durationSec;

  const scenePlans = scenes.slice(0, safeSceneCount).map((scene, index) => {
    const speechText = [scene.narration, scene.dialogue]
      .map(asText)
      .filter(Boolean)
      .join(" ") || asText(scene.text);
    const estimatedSpeechSeconds = Number.isFinite(scene.estimatedSpeechSeconds)
      ? Math.round(Number(scene.estimatedSpeechSeconds) * 10) / 10
      : estimateSpeechSeconds(speechText);
    const speechWordCount = Number.isFinite(scene.speechWordCount)
      ? Number(scene.speechWordCount)
      : countSpeechWords(speechText);
    const availableSpeechWindow = recommendedClipSeconds * maxSpeechRatio;
    const freezePaddingSeconds = Math.max(
      0,
      Math.round((estimatedSpeechSeconds - recommendedClipSeconds) * 10) / 10,
    );
    const speechFit: TimelineScenePlan["speechFit"] =
      estimatedSpeechSeconds <= availableSpeechWindow
        ? "safe"
        : estimatedSpeechSeconds <= recommendedClipSeconds
          ? "tight"
          : "too_long";

    return {
      id: Number(scene.id) || index + 1,
      speechText,
      estimatedSpeechSeconds,
      speechWordCount,
      targetVisualSeconds,
      recommendedClipSeconds,
      freezePaddingSeconds,
      speechFit,
      productionRecommendation: getProductionRecommendation({
        product,
        qualityTier,
        speechFit,
        targetVisualSeconds,
      }),
      transitionHint:
        speechFit === "too_long"
          ? "Shorten or split speech before rendering video. Do not cut audio at scene boundary."
          : "Cut on sentence boundary and use the next visual beat after speech settles.",
    };
  });

  const estimatedSpeechSeconds =
    Math.round(scenePlans.reduce((sum, scene) => sum + scene.estimatedSpeechSeconds, 0) * 10) / 10;
  const estimatedSpeechWords = scenePlans.reduce((sum, scene) => sum + scene.speechWordCount, 0);
  const warnings: string[] = [];
  const tooLongCount = scenePlans.filter((scene) => scene.speechFit === "too_long").length;
  const tightCount = scenePlans.filter((scene) => scene.speechFit === "tight").length;

  if (tooLongCount) {
    warnings.push(`${tooLongCount} scene(s) exceed the recommended visual clip duration and should be split or rewritten before rendering.`);
  }

  if (tightCount) {
    warnings.push(`${tightCount} scene(s) are tight; render with sentence-boundary cuts and avoid abrupt transitions.`);
  }

  if (product === "creatorlab" && (qualityTier === "pro" || qualityTier === "cinematic")) {
    warnings.push("CreatorLab Pro/Cinematic mode should treat AI video clips as premium visual blocks inside an audio-first edit timeline, not as the master timeline.");
  }

  return {
    product,
    qualityTier,
    timelineMode: "audio_first",
    durationSec: safeDurationSec,
    sceneCount: safeSceneCount,
    estimatedSpeechSeconds,
    estimatedSpeechWords,
    recommendedClipSeconds,
    maxSpeechRatio,
    routePolicy,
    scenes: scenePlans,
    warnings,
    nextStep:
      "Use this plan to align narration, scene cuts, visual blocks, and stitch/export decisions before starting paid video generation.",
  };
}
