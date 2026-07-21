export type ProjectReadinessStatus = "draft" | "ready" | "exported";
export type AssetReadiness = "pending" | "ready";

export type CreatorProjectReadinessInput = {
  hasProductionStage: boolean;
  totalScenes: number;
  visualReadyCount: number;
  voiceReadyCount: number;
  finalVideoReady: boolean;
  hasExportedVideo: boolean;
  qualityMode: "draft" | "standard" | "pro" | "cinematic";
};

export type CreatorProjectReadiness = {
  status: ProjectReadinessStatus;
  visuals: AssetReadiness;
  voiceOver: AssetReadiness;
  finalVideo: AssetReadiness;
  visualReadyCount: number;
  voiceReadyCount: number;
  totalScenes: number;
  creditSummary: "not_started" | "in_progress" | "production_ready" | "exported";
};

export function createCreatorProjectReadiness(
  input: CreatorProjectReadinessInput,
): CreatorProjectReadiness {
  const totalScenes = Math.max(0, input.totalScenes);
  const visualsReady = totalScenes > 0 && input.visualReadyCount >= totalScenes;
  const voiceReady = totalScenes > 0 && input.voiceReadyCount >= totalScenes;
  const finalVideo = Boolean(input.finalVideoReady || input.hasExportedVideo);
  const status: ProjectReadinessStatus = input.hasExportedVideo
    ? "exported"
    : input.hasProductionStage && visualsReady && voiceReady && finalVideo
      ? "ready"
      : "draft";

  return {
    status,
    visuals: visualsReady ? "ready" : "pending",
    voiceOver: voiceReady ? "ready" : "pending",
    finalVideo: finalVideo ? "ready" : "pending",
    visualReadyCount: Math.min(Math.max(0, input.visualReadyCount), totalScenes),
    voiceReadyCount: Math.min(Math.max(0, input.voiceReadyCount), totalScenes),
    totalScenes,
    creditSummary: input.hasExportedVideo
      ? "exported"
      : input.hasProductionStage && visualsReady && voiceReady
        ? "production_ready"
        : input.hasProductionStage
          ? "in_progress"
          : "not_started",
  };
}
