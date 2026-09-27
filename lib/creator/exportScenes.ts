type CreatorExportSceneLike = Record<string, unknown> & {
  creatorSceneId?: unknown;
  exportSource?: unknown;
  image?: unknown;
  videoUrl?: unknown;
  visualCoveragePlan?: unknown;
};

export class CreatorExportSceneError extends Error {
  constructor(public readonly code: "invalid_scene_identity" | "duplicate_scene_identity" | "missing_selected_media") {
    super("Creator export scenes are invalid.");
    this.name = "CreatorExportSceneError";
  }
}

export function resolveCanonicalCreatorExportScenes<T extends CreatorExportSceneLike>(scenes: T[]) {
  const seen = new Set<string>();
  return scenes.map((scene) => {
    const creatorSceneId = typeof scene.creatorSceneId === "string"
      ? scene.creatorSceneId.trim()
      : "";
    if (!creatorSceneId) throw new CreatorExportSceneError("invalid_scene_identity");
    if (seen.has(creatorSceneId)) throw new CreatorExportSceneError("duplicate_scene_identity");
    seen.add(creatorSceneId);

    const {
      assetHistory: _assetHistory,
      compareAssetId: _compareAssetId,
      compareSelection: _compareSelection,
      selectedHistoryAssetId: _selectedHistoryAssetId,
      ...canonical
    } = scene;
    const exportSource = scene.exportSource === "video" ? "video" : "image";
    const coverage = Array.isArray(scene.visualCoveragePlan)
      ? scene.visualCoveragePlan.filter((beat): beat is Record<string, unknown> =>
          Boolean(beat && typeof beat === "object" && !Array.isArray(beat)))
      : [];
    const historyUrls = Array.isArray(scene.assetHistory)
      ? scene.assetHistory.flatMap((asset) => {
          if (!asset || typeof asset !== "object" || Array.isArray(asset)) return [];
          const url = (asset as Record<string, unknown>).url;
          return typeof url === "string" && url.trim() ? [url] : [];
        })
      : [];
    const availableUrls = new Set(
      [scene.image, scene.videoUrl, ...historyUrls].filter((value): value is string =>
        typeof value === "string" && Boolean(value.trim())),
    );
    const validCoverage = coverage.length > 0 && coverage.every((beat) =>
      typeof beat.sourceUrl === "string" && availableUrls.has(beat.sourceUrl));
    const selectedMedia = exportSource === "video" ? scene.videoUrl : scene.image;
    if (typeof selectedMedia !== "string" || !selectedMedia.trim()) {
      throw new CreatorExportSceneError("missing_selected_media");
    }
    return {
      ...canonical,
      creatorSceneId,
      exportSource,
      image: (exportSource === "image" || validCoverage) && typeof scene.image === "string" ? scene.image : "",
      videoUrl: (exportSource === "video" || validCoverage) && typeof scene.videoUrl === "string" ? scene.videoUrl : "",
      visualCoveragePlan: validCoverage ? coverage : [],
    };
  });
}
