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

export type TimelineVisualAction =
  | "keep_clip"
  | "slow_clip"
  | "image_motion_tail"
  | "split_scene"
  | "rewrite_voice";

export type TimelineAudioMismatch = "none" | "short" | "long" | "critical";

export type TimelineScenePlan = {
  id: number;
  speechText: string;
  estimatedSpeechSeconds: number;
  speechWordCount: number;
  targetVisualSeconds: number;
  recommendedClipSeconds: 5 | 7 | 10;
  freezePaddingSeconds: number;
  speechFit: "safe" | "tight" | "too_long";
  audioMismatch: TimelineAudioMismatch;
  visualAction: TimelineVisualAction;
  productionRecommendation:
    "image_motion" | "standard_clip" | "premium_clip" | "split_or_rewrite";
  visualBlocks: Array<{
    type: "video_clip" | "image_motion" | "b_roll" | "split_marker";
    startSec: number;
    endSec: number;
    durationSec: number;
    source: "ai_video" | "reference_image" | "b_roll" | "planning";
    motionPreset:
      | "source_motion"
      | "slow_push_in"
      | "soft_pan"
      | "cutaway"
      | "manual_split";
    reason: string;
  }>;
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
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizePositiveNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
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
      reason:
        "Keeping the current 7-second Velto default for backward compatibility.",
    };
  }

  return {
    durationSec: 10 as const,
    reason:
      "Longer speech or premium mode should use a 10-second visual block when the selected video model supports it.",
  };
}

function getRoutePolicy(
  product: VideoProductProfile,
  qualityTier: VideoQualityTier,
): TimelineSyncPlan["routePolicy"] {
  if (product === "storyverse") {
    return {
      storyverseCostProfile: qualityTier === "lite" ? "economy" : "balanced",
      creatorLabCreditProfile: "draft",
      defaultVisualStrategy:
        qualityTier === "lite" ? "image_motion" : "standard_clip",
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
    defaultVisualStrategy:
      qualityTier === "lite" ? "image_motion" : "standard_clip",
    runwayUsage: qualityTier === "lite" ? "limited" : "selective",
    voiceStrategy:
      qualityTier === "lite" ? "economy_tts" : "professional_voice",
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

  if (
    qualityTier === "pro" ||
    qualityTier === "cinematic" ||
    targetVisualSeconds >= 8
  ) {
    return "premium_clip";
  }

  return "standard_clip";
}

function getTimelineAudioMismatch({
  estimatedSpeechSeconds,
  recommendedClipSeconds,
  safeSpeechWindow,
}: {
  estimatedSpeechSeconds: number;
  recommendedClipSeconds: number;
  safeSpeechWindow: number;
}): TimelineAudioMismatch {
  if (!estimatedSpeechSeconds) {
    return "short";
  }

  if (estimatedSpeechSeconds <= safeSpeechWindow) {
    return "none";
  }

  if (estimatedSpeechSeconds <= recommendedClipSeconds) {
    return "long";
  }

  return "critical";
}

function getTimelineVisualAction({
  product,
  qualityTier,
  audioMismatch,
  estimatedSpeechSeconds,
  recommendedClipSeconds,
}: {
  product: VideoProductProfile;
  qualityTier: VideoQualityTier;
  audioMismatch: TimelineAudioMismatch;
  estimatedSpeechSeconds: number;
  recommendedClipSeconds: number;
}): TimelineVisualAction {
  if (audioMismatch === "short" || audioMismatch === "none") {
    return "keep_clip";
  }

  if (audioMismatch === "long") {
    return product === "storyverse" || qualityTier === "lite"
      ? "image_motion_tail"
      : "slow_clip";
  }

  const overrunSeconds = estimatedSpeechSeconds - recommendedClipSeconds;

  if (
    product === "creatorlab" &&
    (qualityTier === "pro" || qualityTier === "cinematic")
  ) {
    return overrunSeconds > 4 ? "split_scene" : "image_motion_tail";
  }

  return overrunSeconds > 3 ? "rewrite_voice" : "image_motion_tail";
}

function withVisualBlockOffsets(
  blocks: Array<
    Omit<TimelineScenePlan["visualBlocks"][number], "startSec" | "endSec">
  >,
): TimelineScenePlan["visualBlocks"] {
  let cursor = 0;

  return blocks.map((block) => {
    const durationSec = Math.max(
      0.5,
      Math.round(Number(block.durationSec || 0) * 10) / 10,
    );
    const startSec = Math.round(cursor * 10) / 10;
    const endSec = Math.round((startSec + durationSec) * 10) / 10;
    cursor = endSec;

    return {
      ...block,
      startSec,
      endSec,
      durationSec,
    };
  });
}

function createVisualBlocks({
  visualAction,
  recommendedClipSeconds,
  estimatedSpeechSeconds,
  product,
  qualityTier,
}: {
  visualAction: TimelineVisualAction;
  recommendedClipSeconds: number;
  estimatedSpeechSeconds: number;
  product: VideoProductProfile;
  qualityTier: VideoQualityTier;
}): TimelineScenePlan["visualBlocks"] {
  const safeSpeechSeconds = Math.max(
    0,
    Math.round(estimatedSpeechSeconds * 10) / 10,
  );
  const targetSeconds = Math.max(
    recommendedClipSeconds,
    safeSpeechSeconds || recommendedClipSeconds,
  );
  const tailSeconds = Math.max(
    0,
    Math.round((targetSeconds - recommendedClipSeconds) * 10) / 10,
  );
  const shouldUsePremiumBlocks =
    product === "creatorlab" &&
    (qualityTier === "pro" || qualityTier === "cinematic");

  if (visualAction === "image_motion_tail" && tailSeconds > 0) {
    return withVisualBlockOffsets([
      {
        type: "video_clip",
        durationSec: recommendedClipSeconds,
        source: "ai_video",
        motionPreset: "source_motion",
        reason: "Use the generated video clip for the primary visual beat.",
      },
      {
        type: shouldUsePremiumBlocks ? "b_roll" : "image_motion",
        durationSec: tailSeconds,
        source: shouldUsePremiumBlocks ? "b_roll" : "reference_image",
        motionPreset: shouldUsePremiumBlocks ? "cutaway" : "slow_push_in",
        reason: shouldUsePremiumBlocks
          ? "Fill the audio tail with a separate B-roll/cutaway visual beat instead of freezing the source clip."
          : "Extend speech safely with motion over a still/reference image instead of freezing the final video frame.",
      },
    ]);
  }

  if (visualAction === "split_scene") {
    const secondBeatSeconds = Math.max(
      2,
      Math.round((targetSeconds - recommendedClipSeconds) * 10) / 10,
    );

    return withVisualBlockOffsets([
      {
        type: "video_clip",
        durationSec: recommendedClipSeconds,
        source: "ai_video",
        motionPreset: "source_motion",
        reason: "Render the first beat as the primary clip.",
      },
      {
        type: "b_roll",
        durationSec: secondBeatSeconds,
        source: "b_roll",
        motionPreset: "cutaway",
        reason:
          "Add a second visual beat for the remaining narration. Do not cut speech mid-sentence.",
      },
      {
        type: "split_marker",
        durationSec: 0.5,
        source: "planning",
        motionPreset: "manual_split",
        reason:
          "Planning marker: Pro/Cinematic rendering should request another generated visual or B-roll asset for this beat.",
      },
    ]);
  }

  if (visualAction === "rewrite_voice") {
    return withVisualBlockOffsets([
      {
        type: "split_marker",
        durationSec: safeSpeechSeconds || recommendedClipSeconds,
        source: "planning",
        motionPreset: "manual_split",
        reason:
          "Rewrite or shorten narration before rendering because the speech is too long for an economical Storyverse scene.",
      },
    ]);
  }

  return withVisualBlockOffsets([
    {
      type: "video_clip",
      durationSec:
        visualAction === "slow_clip"
          ? Math.max(recommendedClipSeconds, safeSpeechSeconds)
          : recommendedClipSeconds,
      source: "ai_video",
      motionPreset: visualAction === "slow_clip" ? "soft_pan" : "source_motion",
      reason:
        visualAction === "slow_clip"
          ? "Stretch clip timing slightly to follow audio without hard freeze."
          : "Use the clip as generated.",
    },
  ]);
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
  const safeSceneCount = Math.max(
    1,
    Math.round(sceneCount || scenes.length || 1),
  );
  const safeDurationSec = Math.max(
    5,
    Math.round(durationSec || safeSceneCount * 7),
  );
  const targetVisualSeconds = Math.max(
    5,
    Math.round(safeDurationSec / safeSceneCount),
  );
  const maxSpeechRatio = product === "creatorlab" ? 0.82 : 0.72;
  const routePolicy = getRoutePolicy(product, qualityTier);
  const recommendedClipSeconds = normalizeRunwayClipDuration(
    targetVisualSeconds,
    qualityTier,
  ).durationSec;

  const scenePlans = scenes.slice(0, safeSceneCount).map((scene, index) => {
    const speechText =
      [scene.narration, scene.dialogue].map(asText).filter(Boolean).join(" ") ||
      asText(scene.text);
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
    const audioMismatch = getTimelineAudioMismatch({
      estimatedSpeechSeconds,
      recommendedClipSeconds,
      safeSpeechWindow: availableSpeechWindow,
    });
    const visualAction = getTimelineVisualAction({
      product,
      qualityTier,
      audioMismatch,
      estimatedSpeechSeconds,
      recommendedClipSeconds,
    });
    const productionRecommendation = getProductionRecommendation({
      product,
      qualityTier,
      speechFit,
      targetVisualSeconds,
    });

    return {
      id: Number(scene.id) || index + 1,
      speechText,
      estimatedSpeechSeconds,
      speechWordCount,
      targetVisualSeconds,
      recommendedClipSeconds,
      freezePaddingSeconds,
      speechFit,
      audioMismatch,
      visualAction,
      productionRecommendation,
      visualBlocks: createVisualBlocks({
        visualAction,
        recommendedClipSeconds,
        estimatedSpeechSeconds,
        product,
        qualityTier,
      }),
      transitionHint:
        speechFit === "too_long"
          ? "Shorten or split speech before rendering video. Do not cut audio at scene boundary."
          : "Cut on sentence boundary and use the next visual beat after speech settles.",
    };
  });

  const estimatedSpeechSeconds =
    Math.round(
      scenePlans.reduce((sum, scene) => sum + scene.estimatedSpeechSeconds, 0) *
        10,
    ) / 10;
  const estimatedSpeechWords = scenePlans.reduce(
    (sum, scene) => sum + scene.speechWordCount,
    0,
  );
  const warnings: string[] = [];
  const tooLongCount = scenePlans.filter(
    (scene) => scene.speechFit === "too_long",
  ).length;
  const tightCount = scenePlans.filter(
    (scene) => scene.speechFit === "tight",
  ).length;

  if (tooLongCount) {
    warnings.push(
      `${tooLongCount} scene(s) exceed the recommended visual clip duration and should be split or rewritten before rendering.`,
    );
  }

  if (tightCount) {
    warnings.push(
      `${tightCount} scene(s) are tight; render with sentence-boundary cuts and avoid abrupt transitions.`,
    );
  }

  if (
    product === "creatorlab" &&
    (qualityTier === "pro" || qualityTier === "cinematic")
  ) {
    warnings.push(
      "CreatorLab Pro/Cinematic mode should treat AI video clips as premium visual blocks inside an audio-first edit timeline, not as the master timeline.",
    );
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

export type TimelineAwareScene = TimelineSceneInput & {
  durationSec?: number;
  timing?: {
    targetSceneDuration?: number;
    estimatedSpeechSeconds?: number;
    speechWordCount?: number;
    maxSpeechRatio?: number;
    speechFit?: TimelineScenePlan["speechFit"];
    recommendedClipSeconds?: TimelineScenePlan["recommendedClipSeconds"];
    freezePaddingSeconds?: number;
    productionRecommendation?: TimelineScenePlan["productionRecommendation"];
    audioMismatch?: TimelineScenePlan["audioMismatch"];
    visualAction?: TimelineScenePlan["visualAction"];
    visualBlocks?: TimelineScenePlan["visualBlocks"];
    transitionHint?: string;
    timelineAware?: boolean;
    timelineMode?: TimelineSyncPlan["timelineMode"];
  };
  timelineDecision?: {
    strategy: TimelineScenePlan["productionRecommendation"];
    speechFit: TimelineScenePlan["speechFit"];
    audioMismatch?: TimelineScenePlan["audioMismatch"];
    visualAction?: TimelineScenePlan["visualAction"];
    warning?: string;
  };
};

export function getTimelineScenePlan(
  timelineSyncPlan: TimelineSyncPlan | undefined,
  scene: TimelineSceneInput | undefined,
  index: number,
) {
  if (!timelineSyncPlan || !Array.isArray(timelineSyncPlan.scenes)) {
    return undefined;
  }

  const sceneId = Number(scene?.id || 0);

  if (sceneId > 0) {
    const byId = timelineSyncPlan.scenes.find(
      (item) => Number(item.id) === sceneId,
    );

    if (byId) {
      return byId;
    }
  }

  return timelineSyncPlan.scenes[index];
}

export function getAudioSafeSceneDuration({
  scenePlan,
  fallbackDuration = 7,
  minDuration = 3,
  maxDuration = 20,
  tailBufferSeconds = 0.75,
}: {
  scenePlan?: TimelineScenePlan;
  fallbackDuration?: number;
  minDuration?: number;
  maxDuration?: number;
  tailBufferSeconds?: number;
}) {
  const baseDuration = Number.isFinite(fallbackDuration)
    ? Number(fallbackDuration)
    : 7;

  if (!scenePlan) {
    return Math.min(
      maxDuration,
      Math.max(minDuration, Math.round(baseDuration * 10) / 10),
    );
  }

  const speechSafeDuration =
    scenePlan.estimatedSpeechSeconds > 0
      ? scenePlan.estimatedSpeechSeconds + tailBufferSeconds
      : 0;

  const timelineDuration = Math.max(
    baseDuration,
    scenePlan.targetVisualSeconds || 0,
    scenePlan.recommendedClipSeconds || 0,
    speechSafeDuration,
  );

  return Math.min(
    maxDuration,
    Math.max(minDuration, Math.round(timelineDuration * 10) / 10),
  );
}

export function applyTimelineSyncPlanToScenes<T extends TimelineAwareScene>(
  scenes: T[],
  timelineSyncPlan: TimelineSyncPlan | undefined,
  options: {
    fallbackDuration?: number;
    minDuration?: number;
    maxDuration?: number;
    tailBufferSeconds?: number;
  } = {},
): T[] {
  if (!timelineSyncPlan || !Array.isArray(scenes) || scenes.length === 0) {
    return scenes;
  }

  return scenes.map((scene, index) => {
    const scenePlan = getTimelineScenePlan(timelineSyncPlan, scene, index);

    if (!scenePlan) {
      return scene;
    }

    const targetSceneDuration = getAudioSafeSceneDuration({
      scenePlan,
      fallbackDuration:
        scene.durationSec ||
        options.fallbackDuration ||
        scenePlan.recommendedClipSeconds,
      minDuration: options.minDuration,
      maxDuration: options.maxDuration,
      tailBufferSeconds: options.tailBufferSeconds,
    });

    const warning =
      scenePlan.speechFit === "too_long"
        ? "Speech is longer than the recommended visual block. Prefer split, rewrite, B-roll, or image-motion fallback before paid cinematic rendering."
        : scenePlan.speechFit === "tight"
          ? "Speech is tight for this scene. Cut on sentence boundary and avoid abrupt scene jumps."
          : undefined;

    return {
      ...scene,
      durationSec: targetSceneDuration,
      timing: {
        ...(scene.timing || {}),
        targetSceneDuration,
        estimatedSpeechSeconds: scenePlan.estimatedSpeechSeconds,
        speechWordCount: scenePlan.speechWordCount,
        maxSpeechRatio: timelineSyncPlan.maxSpeechRatio,
        speechFit: scenePlan.speechFit,
        recommendedClipSeconds: scenePlan.recommendedClipSeconds,
        freezePaddingSeconds: scenePlan.freezePaddingSeconds,
        productionRecommendation: scenePlan.productionRecommendation,
        audioMismatch: scenePlan.audioMismatch,
        visualAction: scenePlan.visualAction,
        visualBlocks: scenePlan.visualBlocks,
        transitionHint: scenePlan.transitionHint,
        timelineAware: true,
        timelineMode: timelineSyncPlan.timelineMode,
      },
      timelineDecision: {
        strategy: scenePlan.productionRecommendation,
        speechFit: scenePlan.speechFit,
        audioMismatch: scenePlan.audioMismatch,
        visualAction: scenePlan.visualAction,
        warning,
      },
    };
  });
}
