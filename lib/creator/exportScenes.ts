type CreatorExportSceneLike = Record<string, unknown> & {
  creatorSceneId?: unknown;
  exportSource?: unknown;
  image?: unknown;
  videoUrl?: unknown;
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
    const selectedMedia = exportSource === "video" ? scene.videoUrl : scene.image;
    if (typeof selectedMedia !== "string" || !selectedMedia.trim()) {
      throw new CreatorExportSceneError("missing_selected_media");
    }
    return {
      ...canonical,
      creatorSceneId,
      exportSource,
      image: exportSource === "image" && typeof scene.image === "string" ? scene.image : "",
      videoUrl: exportSource === "video" && typeof scene.videoUrl === "string" ? scene.videoUrl : "",
    };
  });
}
