export type CreatorVisualCoverageBeat = {
  id: string;
  creatorSceneId: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  kind: "video" | "image";
  sourceUrl: string;
  sourceAssetId?: string;
  sourceStartSec?: number;
  sourceType: "generated_video" | "scene_image" | "asset_history";
  motionPreset?: "slow_push_in" | "soft_pan" | "cutaway";
  renderer: "native_video" | "native_zoompan_v1" | "static_image";
  purpose?: string;
};

type VisualAsset = {
  id?: string;
  kind?: string;
  url?: string;
  durationSec?: number;
};

type VisualPlanBlock = {
  durationSec?: number;
  purpose?: string;
};

export type CreatorVisualCoverageScene = {
  creatorSceneId?: string;
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
  videoDurationSeconds?: number;
  clipInSec?: number;
  clipOutSec?: number;
  targetDurationSec?: number;
  timing?: { targetSceneDuration?: number };
  selectedSource?: "video" | "image";
  assetHistory?: VisualAsset[];
  visualBlockPlan?: VisualPlanBlock[];
};

export type CreatorEditorialVisualBeatSlot = {
  id: string;
  creatorSceneId: string;
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  cadenceRole: "establish" | "develop" | "resolve";
  purposeHint?: string;
};

export const CREATOR_EDITORIAL_VISUAL_BEAT_POLICY = {
  minimumBeatDurationSec: 4,
  maximumBeatDurationSec: 8,
} as const;

const round = (value: number) => Math.round(value * 100) / 100;
const positive = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export function resolveCreatorVisualCoverageTargetDuration({
  timingTargetDurationSec,
  fallbackTargetDurationSec,
}: {
  timingTargetDurationSec: unknown;
  fallbackTargetDurationSec: unknown;
}) {
  return positive(timingTargetDurationSec) || positive(fallbackTargetDurationSec);
}

export function createCreatorEditorialVisualBeatPlan({
  creatorSceneId,
  targetDurationSec,
  purposeHints,
}: {
  creatorSceneId: unknown;
  targetDurationSec: unknown;
  purposeHints?: Array<{ purpose?: unknown }>;
}): CreatorEditorialVisualBeatSlot[] {
  const normalizedSceneId =
    typeof creatorSceneId === "string" ? creatorSceneId.trim() : "";
  const target = positive(targetDurationSec);

  if (!normalizedSceneId || target <= 0) return [];

  const {
    minimumBeatDurationSec,
    maximumBeatDurationSec,
  } = CREATOR_EDITORIAL_VISUAL_BEAT_POLICY;

  let beatCount = Math.max(1, Math.ceil(target / maximumBeatDurationSec));

  while (
    beatCount > 1 &&
    target / beatCount < minimumBeatDurationSec
  ) {
    beatCount -= 1;
  }

  const slots: CreatorEditorialVisualBeatSlot[] = [];
  let cursor = 0;

  for (let index = 0; index < beatCount; index += 1) {
    const remainingDuration = target - cursor;
    const remainingBeats = beatCount - index;
    const duration =
      index === beatCount - 1
        ? remainingDuration
        : remainingDuration / remainingBeats;

    const startSec = round(cursor);
    const endSec =
      index === beatCount - 1
        ? round(target)
        : round(startSec + duration);

    const purposeValue = purposeHints?.[index]?.purpose;
    const purpose =
      typeof purposeValue === "string"
        ? purposeValue.trim()
        : "";

    slots.push({
      id: `${normalizedSceneId}.editorial-beat.${index + 1}`,
      creatorSceneId: normalizedSceneId,
      index,
      startSec,
      endSec,
      durationSec: round(endSec - startSec),
      cadenceRole:
        beatCount === 1 || index === 0
          ? "establish"
          : index === beatCount - 1
            ? "resolve"
            : "develop",
      ...(purpose ? { purposeHint: purpose } : {}),
    });

    cursor = endSec;
  }

  return slots;
}

function createCreatorEditorialCadenceCoveragePlan(
  scene: CreatorVisualCoverageScene,
  {
    creatorSceneId,
    targetDurationSec,
    imageMotionRendererAvailable,
    motionPresetOffset,
  }: {
    creatorSceneId: string;
    targetDurationSec: number;
    imageMotionRendererAvailable: boolean;
    motionPresetOffset: number;
  },
): CreatorVisualCoverageBeat[] {
  const imageUrl =
    typeof scene.image === "string" ? scene.image.trim() : "";
  const videoUrl =
    typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : "";
  const videoReady = Boolean(videoUrl) && scene.videoStatus === "done";
  const sourceVideoDuration = positive(scene.videoDurationSeconds);

  const selectedSource =
    scene.selectedSource === "video" || scene.selectedSource === "image"
      ? scene.selectedSource
      : videoReady
        ? "video"
        : "image";

  const clipInSec = Math.max(0, Number(scene.clipInSec) || 0);
  const clipOutSec = Math.min(
    sourceVideoDuration,
    positive(scene.clipOutSec) || sourceVideoDuration,
  );
  const effectiveVideoDuration =
    videoReady && sourceVideoDuration > 0
      ? clipOutSec > clipInSec
        ? clipOutSec - clipInSec
        : sourceVideoDuration
      : 0;

  const beats: CreatorVisualCoverageBeat[] = [];
  let cursor = 0;
  let imageBeatIndex = 0;

  const append = (
    beat: Omit<
      CreatorVisualCoverageBeat,
      "id" | "creatorSceneId" | "startSec" | "endSec" | "durationSec"
    >,
    duration: number,
  ) => {
    const boundedDuration = round(
      Math.min(positive(duration), targetDurationSec - cursor),
    );
    if (boundedDuration <= 0) return;

    const startSec = round(cursor);
    const endSec = round(
      Math.min(targetDurationSec, startSec + boundedDuration),
    );

    beats.push({
      ...beat,
      id: `${creatorSceneId}.coverage.${beats.length + 1}`,
      creatorSceneId,
      startSec,
      endSec,
      durationSec: round(endSec - startSec),
    });

    cursor = endSec;
  };

  const appendImageCadence = (durationSec: number) => {
    if (!imageUrl || durationSec <= 0) return false;

    const hints = Array.isArray(scene.visualBlockPlan)
      ? scene.visualBlockPlan.slice(beats.length)
      : undefined;

    const slots = createCreatorEditorialVisualBeatPlan({
      creatorSceneId,
      targetDurationSec: durationSec,
      purposeHints: hints,
    });

    const motionPresets = [
      "slow_push_in",
      "soft_pan",
      "cutaway",
    ] as const;

    for (const slot of slots) {
      append({
        kind: "image",
        sourceUrl: imageUrl,
        sourceType: "scene_image",
        motionPreset: motionPresets[
          (
            Math.max(0, Math.trunc(motionPresetOffset)) +
            imageBeatIndex
          ) % motionPresets.length
        ],
        renderer: imageMotionRendererAvailable
          ? "native_zoompan_v1"
          : "static_image",
        ...(slot.purposeHint ? { purpose: slot.purposeHint } : {}),
      }, slot.durationSec);

      imageBeatIndex += 1;
    }

    return slots.length > 0;
  };

  const appendSequentialVideoCadence = (durationSec: number) => {
    if (!videoReady || effectiveVideoDuration < durationSec) return false;

    const slots = createCreatorEditorialVisualBeatPlan({
      creatorSceneId,
      targetDurationSec: durationSec,
      purposeHints: scene.visualBlockPlan,
    });

    for (const slot of slots) {
      const sourceStartSec = round(clipInSec + slot.startSec);

      append({
        kind: "video",
        sourceUrl: videoUrl,
        sourceType: "generated_video",
        ...(sourceStartSec > 0 ? { sourceStartSec } : {}),
        renderer: "native_video",
        ...(slot.purposeHint ? { purpose: slot.purposeHint } : {}),
      }, slot.durationSec);
    }

    return slots.length > 0;
  };

  const {
    minimumBeatDurationSec,
    maximumBeatDurationSec,
  } = CREATOR_EDITORIAL_VISUAL_BEAT_POLICY;

  // Explicit image selection remains image-only. Previous versions are not
  // automatic B-roll; the user must restore them before they become current.
  if (selectedSource === "image") {
    if (!appendImageCadence(targetDurationSec)) return [];
    return round(cursor) === round(targetDurationSec) ? beats : [];
  }

  // Explicit/inferred video authority must have a renderable current video.
  if (!videoReady || effectiveVideoDuration <= 0) return [];

  // A short scene does not need an editorial cut unless the video itself
  // cannot cover it. In that case fail closed instead of hiding the selected
  // video behind another source.
  if (targetDurationSec <= maximumBeatDurationSec) {
    if (effectiveVideoDuration < targetDurationSec) return [];

    append({
      kind: "video",
      sourceUrl: videoUrl,
      sourceType: "generated_video",
      ...(clipInSec > 0 ? { sourceStartSec: round(clipInSec) } : {}),
      renderer: "native_video",
      purpose: scene.visualBlockPlan?.[0]?.purpose,
    }, targetDurationSec);

    return round(cursor) === round(targetDurationSec) ? beats : [];
  }

  // With no current image, the current video may still provide deterministic
  // multi-beat coverage when its trimmed source fully covers the scene.
  if (!imageUrl) {
    if (!appendSequentialVideoCadence(targetDurationSec)) return [];
    return round(cursor) === round(targetDurationSec) ? beats : [];
  }

  // With both current sources, keep the selected video as the establishing
  // beat and let the current image provide the remaining editorial cadence.
  // Do not pull previous versions from assetHistory automatically.
  if (effectiveVideoDuration < minimumBeatDurationSec) return [];

  const maximumPrimaryDuration = Math.min(
    maximumBeatDurationSec,
    targetDurationSec - minimumBeatDurationSec,
  );
  const primaryVideoDuration = Math.min(
    effectiveVideoDuration,
    maximumPrimaryDuration,
  );

  if (primaryVideoDuration < minimumBeatDurationSec) return [];

  append({
    kind: "video",
    sourceUrl: videoUrl,
    sourceType: "generated_video",
    ...(clipInSec > 0 ? { sourceStartSec: round(clipInSec) } : {}),
    renderer: "native_video",
    purpose: scene.visualBlockPlan?.[0]?.purpose,
  }, primaryVideoDuration);

  const remainingDuration = round(targetDurationSec - cursor);
  if (remainingDuration > 0 && !appendImageCadence(remainingDuration)) {
    return [];
  }

  return round(cursor) === round(targetDurationSec) ? beats : [];
}

function distinctImageAssets(scene: CreatorVisualCoverageScene) {
  const seen = new Set<string>();
  const assets: Array<{ url: string; id?: string; sourceType: "scene_image" | "asset_history" }> = [];
  const append = (url: unknown, id: unknown, sourceType: "scene_image" | "asset_history") => {
    const normalizedUrl = typeof url === "string" ? url.trim() : "";
    if (!normalizedUrl || seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    assets.push({
      url: normalizedUrl,
      ...(typeof id === "string" && id.trim() ? { id: id.trim() } : {}),
      sourceType,
    });
  };

  append(scene.image, undefined, "scene_image");
  for (const asset of scene.assetHistory || []) {
    if (asset?.kind === "image") append(asset.url, asset.id, "asset_history");
  }
  return assets;
}

export function createCreatorVisualCoveragePlan(
  scene: CreatorVisualCoverageScene,
  options: {
    imageMotionRendererAvailable?: boolean;
    editorialCadence?: boolean;
    motionPresetOffset?: number;
  } = {},
): CreatorVisualCoverageBeat[] {
  const creatorSceneId = typeof scene.creatorSceneId === "string" ? scene.creatorSceneId.trim() : "";
  const targetDurationSec = positive(scene.targetDurationSec || scene.timing?.targetSceneDuration);
  const videoUrl = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : "";
  const sourceVideoDuration = positive(scene.videoDurationSeconds);
  if (!creatorSceneId || targetDurationSec <= 0) return [];

  const imageMotionRendererAvailable = options.imageMotionRendererAvailable !== false;

  if (options.editorialCadence === true) {
    return createCreatorEditorialCadenceCoveragePlan(scene, {
      creatorSceneId,
      targetDurationSec,
      imageMotionRendererAvailable,
      motionPresetOffset: Number.isFinite(options.motionPresetOffset)
        ? Number(options.motionPresetOffset)
        : 0,
    });
  }

  const beats: CreatorVisualCoverageBeat[] = [];
  let cursor = 0;
  const append = (beat: Omit<CreatorVisualCoverageBeat, "id" | "creatorSceneId" | "startSec" | "endSec" | "durationSec">, duration: number) => {
    const boundedDuration = round(Math.min(positive(duration), targetDurationSec - cursor));
    if (boundedDuration <= 0) return;
    const startSec = round(cursor);
    const endSec = round(Math.min(targetDurationSec, startSec + boundedDuration));
    beats.push({
      ...beat,
      id: `${creatorSceneId}.coverage.${beats.length + 1}`,
      creatorSceneId,
      startSec,
      endSec,
      durationSec: round(endSec - startSec),
    });
    cursor = endSec;
  };

  if (videoUrl && scene.videoStatus === "done") {
    const clipInSec = Math.max(0, Number(scene.clipInSec) || 0);
    const clipOutSec = Math.min(sourceVideoDuration, positive(scene.clipOutSec) || sourceVideoDuration);
    const effectiveVideoDuration = clipOutSec > clipInSec
      ? clipOutSec - clipInSec
      : sourceVideoDuration;
    append({
      kind: "video",
      sourceUrl: videoUrl,
      sourceType: "generated_video",
      ...(clipInSec > 0 ? { sourceStartSec: round(clipInSec) } : {}),
      renderer: "native_video",
      purpose: scene.visualBlockPlan?.[0]?.purpose,
    }, effectiveVideoDuration);
  }

  const remaining = round(targetDurationSec - cursor);
  const images = distinctImageAssets(scene);
  if (remaining > 0 && images.length > 0) {
    const usableCount = Math.max(1, Math.min(images.length, Math.max(1, (scene.visualBlockPlan?.length || 1) - beats.length)));
    const selected = images.slice(0, usableCount);
    selected.forEach((asset, index) => {
      const duration = index === selected.length - 1
        ? targetDurationSec - cursor
        : remaining / selected.length;
      append({
        kind: "image",
        sourceUrl: asset.url,
        ...(asset.id ? { sourceAssetId: asset.id } : {}),
        sourceType: asset.sourceType,
        motionPreset: index % 2 === 0 ? "slow_push_in" : "soft_pan",
        renderer: imageMotionRendererAvailable ? "native_zoompan_v1" : "static_image",
        purpose: scene.visualBlockPlan?.[beats.length]?.purpose,
      }, duration);
    });
  }

  return beats;
}

export function validateCreatorVisualCoveragePlan({
  creatorSceneId,
  targetDurationSec,
  beats,
}: {
  creatorSceneId: string;
  targetDurationSec: number;
  beats: CreatorVisualCoverageBeat[];
}) {
  let cursor = 0;
  let valid = Boolean(creatorSceneId) && positive(targetDurationSec) > 0;
  for (const beat of beats) {
    valid = valid && beat.creatorSceneId === creatorSceneId && Boolean(beat.sourceUrl) &&
      beat.startSec >= 0 && beat.endSec > beat.startSec &&
      Math.abs(beat.startSec - cursor) < 0.02 &&
      beat.endSec <= targetDurationSec + 0.02 &&
      Math.abs(beat.durationSec - (beat.endSec - beat.startSec)) < 0.02;
    cursor = beat.endSec;
  }
  return {
    valid,
    coveredDurationSec: round(cursor),
    uncoveredDurationSec: round(Math.max(0, targetDurationSec - cursor)),
    fullyCovered: valid && Math.max(0, targetDurationSec - cursor) <= 0.02,
    motionCovered: valid && beats.length > 0 && beats.every((beat) =>
      beat.kind === "video" || beat.renderer === "native_zoompan_v1"),
  };
}
