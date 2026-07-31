import type { CreatorFinalVideoReadinessReport } from "./finalVideoReadiness";

export type CreatorExportServiceGateStatus =
  | "unchecked"
  | "checking"
  | "ready"
  | "unavailable";

export type CreatorFinalProductionGateStatus =
  | "checking"
  | "blocked"
  | "review"
  | "ready";

export type CreatorFinalProductionGateCheckStatus =
  | "checking"
  | "blocked"
  | "review"
  | "ready";

export type CreatorFinalProductionGateReport = {
  version: "3Q";
  status: CreatorFinalProductionGateStatus;
  canStartFinalVideo: boolean;
  requiresManualConfirmation: boolean;
  checks: {
    timeline: CreatorFinalProductionGateCheckStatus;
    visuals: CreatorFinalProductionGateCheckStatus;
    voiceOver: CreatorFinalProductionGateCheckStatus;
    continuity: CreatorFinalProductionGateCheckStatus;
    exportService: CreatorFinalProductionGateCheckStatus;
  };
  blockingSceneIds: Array<string | number>;
  missingVisualSceneIds: Array<string | number>;
  missingVoiceSceneIds: Array<string | number>;
};

export function createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus,
}: {
  readiness: CreatorFinalVideoReadinessReport;
  exportServiceStatus: CreatorExportServiceGateStatus;
}): CreatorFinalProductionGateReport {
  const timelineReady = ![
    "production_stage_required",
    "timeline_required",
  ].includes(readiness.status);
  const visualsReady = readiness.missingVisualSceneIds.length === 0;
  const voiceReady = readiness.missingVoiceSceneIds.length === 0;
  const continuityBlocked = readiness.status === "continuity_blocked";
  const continuityReview = readiness.status === "confirmation_required";
  const localBlocked = !readiness.canStartFinalVideo;
  const exportChecking =
    exportServiceStatus === "unchecked" || exportServiceStatus === "checking";
  const exportReady = exportServiceStatus === "ready";
  const status: CreatorFinalProductionGateStatus = localBlocked
    ? "blocked"
    : exportChecking
      ? "checking"
      : !exportReady
        ? "blocked"
        : continuityReview
          ? "review"
          : "ready";

  return {
    version: "3Q",
    status,
    canStartFinalVideo: readiness.canStartFinalVideo && exportReady,
    requiresManualConfirmation:
      readiness.canStartFinalVideo && exportReady && continuityReview,
    checks: {
      timeline: timelineReady ? "ready" : "blocked",
      visuals: visualsReady ? "ready" : "blocked",
      voiceOver: voiceReady ? "ready" : "blocked",
      continuity: continuityBlocked
        ? "blocked"
        : continuityReview
          ? "review"
          : "ready",
      exportService: exportChecking
        ? "checking"
        : exportReady
          ? "ready"
          : "blocked",
    },
    blockingSceneIds: readiness.blockingSceneIds,
    missingVisualSceneIds: readiness.missingVisualSceneIds,
    missingVoiceSceneIds: readiness.missingVoiceSceneIds,
  };
}
