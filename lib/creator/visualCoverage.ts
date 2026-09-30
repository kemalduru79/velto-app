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
  assetHistory?: VisualAsset[];
  visualBlockPlan?: VisualPlanBlock[];
};

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
  options: { imageMotionRendererAvailable?: boolean } = {},
): CreatorVisualCoverageBeat[] {
  const creatorSceneId = typeof scene.creatorSceneId === "string" ? scene.creatorSceneId.trim() : "";
  const targetDurationSec = positive(scene.targetDurationSec || scene.timing?.targetSceneDuration);
  const videoUrl = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : "";
  const sourceVideoDuration = positive(scene.videoDurationSeconds);
  if (!creatorSceneId || targetDurationSec <= 0) return [];

  const imageMotionRendererAvailable = options.imageMotionRendererAvailable !== false;
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
