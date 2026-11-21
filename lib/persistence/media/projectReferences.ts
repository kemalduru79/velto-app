import type { MediaReferenceType, ProjectMediaReference } from "./types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function add(
  target: Map<string, ProjectMediaReference>,
  value: unknown,
  referenceType: MediaReferenceType,
  referenceKey: string,
  onUnknown?: () => void,
) {
  if (typeof value !== "string") return;
  const url = value.trim();
  if (!url) return;
  if (url.startsWith("data:")) {
    onUnknown?.();
    return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      onUnknown?.();
      return;
    }
    parsed.hash = "";
    const normalized = parsed.toString();
    target.set(`${referenceType}\u0000${referenceKey}\u0000${normalized}`, { url: normalized, referenceType, referenceKey });
  } catch {
    onUnknown?.();
  }
}

export function inspectProjectMediaReferences(project: UnknownRecord): {
  references: ProjectMediaReference[];
  unknownReferenceCount: number;
} {
  const references = new Map<string, ProjectMediaReference>();
  let unknownReferenceCount = 0;
  const unknown = () => { unknownReferenceCount += 1; };
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = record(scenes[index]);
    const sceneKey = String(scene.creatorSceneId || scene.id || index);
    add(references, scene.image, "scene_image", `${sceneKey}:image`, unknown);
    add(references, scene.imageUrl, "scene_image", `${sceneKey}:image`, unknown);
    add(references, scene.videoUrl, "scene_video", `${sceneKey}:video`, unknown);
    add(references, scene.audioUrl, "narration_audio", `${sceneKey}:narration`, unknown);
    add(references, scene.dialogueAudioUrl, "dialogue_audio", `${sceneKey}:dialogue`, unknown);
    const history = Array.isArray(scene.assetHistory) ? scene.assetHistory : [];
    for (let historyIndex = 0; historyIndex < history.length; historyIndex += 1) {
      const item = record(history[historyIndex]);
      add(references, item.url, "asset_history", `${sceneKey}:history:${String(item.id || historyIndex)}`, unknown);
    }
  }
  add(references, project.exported_movie_url ?? project.exportedMovieUrl, "final_video", "project:final-video", unknown);
  const thumbnail = record(project.youtube_thumbnail ?? project.youtubeThumbnailResult);
  add(references, thumbnail.imageUrl, "thumbnail", "project:thumbnail", unknown);
  add(references, thumbnail.sourceImageUrl, "thumbnail", "project:thumbnail-source", unknown);
  return {
    references: [...references.values()].sort((a, b) =>
      a.referenceType.localeCompare(b.referenceType) || a.referenceKey.localeCompare(b.referenceKey) || a.url.localeCompare(b.url)),
    unknownReferenceCount,
  };
}

export function extractProjectMediaReferences(project: UnknownRecord): ProjectMediaReference[] {
  return inspectProjectMediaReferences(project).references;
}
