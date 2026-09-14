import type { CreatorSceneProductionDecision } from "./productionIntelligence";

export type CreatorFinalSceneExportSelection = {
  creatorSceneId: string;
  effectiveRenderMode: "image" | "video";
  exportSource: "image" | "video" | "none";
  selectedMedia: string;
};

type SceneInput = {
  id: string | number;
  creatorSceneId?: string;
  renderMode?: string;
  creatorRenderMode?: string;
  outputMode?: string;
  mediaMode?: string;
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
};

export function creatorRequestedSceneOutputMode(scene: SceneInput): "auto" | "image" | "video" {
  const value = String(
    scene.renderMode || scene.creatorRenderMode || scene.outputMode || scene.mediaMode || "auto",
  ).toLowerCase();
  if (value === "video") return "video";
  if (value === "image" || value === "visual") return "image";
  return "auto";
}

export function resolveCreatorFinalSceneExportSelections(
  scenes: SceneInput[],
  decisions: CreatorSceneProductionDecision[],
): CreatorFinalSceneExportSelection[] {
  const decisionsBySceneId = new Map(decisions.map((decision) => [String(decision.sceneId), decision]));
  return scenes.map((scene) => {
    const requested = creatorRequestedSceneOutputMode(scene);
    const effectiveRenderMode = requested === "auto"
      ? decisionsBySceneId.get(String(scene.id))?.selectedTreatment === "ai_video" ? "video" : "image"
      : requested;
    const exportSource = effectiveRenderMode === "video"
      ? scene.videoUrl && scene.videoStatus === "done" ? "video" as const : "none" as const
      : scene.image ? "image" as const : "none" as const;
    return {
      creatorSceneId: scene.creatorSceneId || `legacy-${scene.id}`,
      effectiveRenderMode,
      exportSource,
      selectedMedia: exportSource === "video" ? scene.videoUrl || "" : exportSource === "image" ? scene.image || "" : "",
    };
  });
}
