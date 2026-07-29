import type { TimelineSyncPlan } from "../video/timelineSync";

export type CreatorQualityMode =
  | "draft"
  | "standard"
  | "pro"
  | "cinematic";

export type CreatorMediaAction =
  | "paid_media"
  | "visuals"
  | "voice_over"
  | "ai_video_blocks"
  | "final_video"
  | "batch_render";

export type CreatorMediaRoute = {
  qualityMode: CreatorQualityMode;
  visualStrategy: "none" | "image_first" | "reference_first";
  voiceStrategy: "none" | "balanced" | "professional" | "premium";
  videoStrategy:
    | "none"
    | "image_motion"
    | "selective_ai_blocks"
    | "premium_ai_blocks";
  providerTarget: "none" | "current_primary" | "premium_primary";
  fallbackStrategy: "none" | "image_motion" | "primary_then_image_motion";
  videoBlockRatio: number;
  actions: Record<CreatorMediaAction, boolean>;
};

const CREATOR_MEDIA_ROUTES: Record<CreatorQualityMode, CreatorMediaRoute> = {
  draft: {
    qualityMode: "draft",
    visualStrategy: "none",
    voiceStrategy: "none",
    videoStrategy: "none",
    providerTarget: "none",
    fallbackStrategy: "none",
    videoBlockRatio: 0,
    actions: {
      paid_media: false,
      visuals: false,
      voice_over: false,
      ai_video_blocks: false,
      final_video: false,
      batch_render: false,
    },
  },
  standard: {
    qualityMode: "standard",
    visualStrategy: "image_first",
    voiceStrategy: "balanced",
    videoStrategy: "image_motion",
    providerTarget: "none",
    fallbackStrategy: "image_motion",
    videoBlockRatio: 0,
    actions: {
      paid_media: true,
      visuals: true,
      voice_over: true,
      ai_video_blocks: false,
      final_video: true,
      batch_render: true,
    },
  },
  pro: {
    qualityMode: "pro",
    visualStrategy: "reference_first",
    voiceStrategy: "professional",
    videoStrategy: "selective_ai_blocks",
    providerTarget: "current_primary",
    fallbackStrategy: "primary_then_image_motion",
    videoBlockRatio: 0.45,
    actions: {
      paid_media: true,
      visuals: true,
      voice_over: true,
      ai_video_blocks: true,
      final_video: true,
      batch_render: true,
    },
  },
  cinematic: {
    qualityMode: "cinematic",
    visualStrategy: "reference_first",
    voiceStrategy: "premium",
    videoStrategy: "premium_ai_blocks",
    providerTarget: "premium_primary",
    fallbackStrategy: "primary_then_image_motion",
    videoBlockRatio: 0.75,
    actions: {
      paid_media: true,
      visuals: true,
      voice_over: true,
      ai_video_blocks: true,
      final_video: true,
      batch_render: true,
    },
  },
};

export function normalizeCreatorQualityMode(
  value: unknown,
  fallback: CreatorQualityMode = "standard",
): CreatorQualityMode {
  if (
    value === "draft" ||
    value === "standard" ||
    value === "pro" ||
    value === "cinematic"
  ) {
    return value;
  }

  return fallback;
}

export function getCreatorMediaRoute(
  value: unknown,
  fallback: CreatorQualityMode = "standard",
) {
  return CREATOR_MEDIA_ROUTES[normalizeCreatorQualityMode(value, fallback)];
}

export function isCreatorMediaActionAllowed(
  route: CreatorMediaRoute,
  action: CreatorMediaAction,
) {
  return route.actions[action];
}

function normalizeSceneIds(sceneIds: number[]) {
  return Array.from(
    new Set(
      sceneIds
        .map((sceneId) => Number(sceneId))
        .filter((sceneId) => Number.isFinite(sceneId) && sceneId > 0),
    ),
  );
}

function getDistributedSceneIds(sceneIds: number[], targetCount: number) {
  if (targetCount <= 0 || sceneIds.length === 0) {
    return [];
  }

  if (targetCount >= sceneIds.length) {
    return sceneIds;
  }

  const distributedIds: number[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const position = Math.round(
      (index * (sceneIds.length - 1)) / Math.max(1, targetCount - 1),
    );
    distributedIds.push(sceneIds[position]);
  }

  return Array.from(new Set(distributedIds));
}

/**
 * Selects the scenes that should receive paid AI motion while preserving the
 * simple Production Quality UX. Explicit Image/Video choices are treated as
 * advanced overrides; every remaining scene is routed automatically.
 */
export function getCreatorVideoBlockSceneIds({
  route,
  sceneIds,
  timelinePlan,
  forceVideoSceneIds = [],
  forceImageSceneIds = [],
}: {
  route: CreatorMediaRoute;
  sceneIds: number[];
  timelinePlan?: TimelineSyncPlan | null;
  forceVideoSceneIds?: number[];
  forceImageSceneIds?: number[];
}) {
  const normalizedSceneIds = normalizeSceneIds(sceneIds);

  if (!route.actions.ai_video_blocks || normalizedSceneIds.length === 0) {
    return [];
  }

  const sceneIdSet = new Set(normalizedSceneIds);
  const forcedImageSet = new Set(
    normalizeSceneIds(forceImageSceneIds).filter((sceneId) => sceneIdSet.has(sceneId)),
  );
  const forcedVideoIds = normalizeSceneIds(forceVideoSceneIds).filter(
    (sceneId) => sceneIdSet.has(sceneId) && !forcedImageSet.has(sceneId),
  );
  const candidateSceneIds = normalizedSceneIds.filter(
    (sceneId) => !forcedImageSet.has(sceneId),
  );

  if (candidateSceneIds.length === 0) {
    return [];
  }

  const ratioTargetCount = Math.max(
    1,
    Math.round(normalizedSceneIds.length * route.videoBlockRatio),
  );
  const targetCount = Math.min(
    candidateSceneIds.length,
    Math.max(forcedVideoIds.length, ratioTargetCount),
  );

  const timelinePriorityIds = (timelinePlan?.scenes || [])
    .filter(
      (scene) =>
        scene.productionRecommendation === "premium_clip" ||
        scene.visualAction === "split_scene",
    )
    .map((scene) => Number(scene.id))
    .filter(
      (sceneId) =>
        candidateSceneIds.includes(sceneId) && !forcedImageSet.has(sceneId),
    );

  const firstCandidateSceneId = candidateSceneIds[0];
  const distributedIds = getDistributedSceneIds(
    candidateSceneIds,
    targetCount,
  );
  const prioritizedIds = Array.from(
    new Set([
      ...forcedVideoIds,
      firstCandidateSceneId,
      ...timelinePriorityIds,
      ...distributedIds,
      ...candidateSceneIds,
    ]),
  );

  return prioritizedIds.slice(0, targetCount);
}
