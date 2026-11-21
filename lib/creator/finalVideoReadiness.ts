export type CreatorFinalVideoReadinessScene = {
  id: string | number;
  renderMode?: "auto" | "video" | "image";
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
  narration?: string;
  dialogue?: string;
  audioUrl?: string;
  dialogueAudioUrl?: string;
  narrationAudioCurrent?: boolean;
  dialogueAudioCurrent?: boolean;
  videoCurrent?: boolean;
};

export type CreatorFinalVideoReadinessStatus =
  | "production_stage_required"
  | "timeline_required"
  | "visuals_required"
  | "voice_over_required"
  | "continuity_blocked"
  | "confirmation_required"
  | "ready";

export type CreatorFinalVideoNextAction =
  | "create_production_stage"
  | "timeline_check"
  | "generate_visuals"
  | "generate_voice_over"
  | "review_continuity"
  | "create_final_video";

export type CreatorFinalVideoReadinessReport = {
  status: CreatorFinalVideoReadinessStatus;
  canStartFinalVideo: boolean;
  nextAction: CreatorFinalVideoNextAction;
  totalScenes: number;
  readyVisualScenes: number;
  readyVoiceScenes: number;
  missingVisualSceneIds: Array<string | number>;
  missingVoiceSceneIds: Array<string | number>;
  blockingSceneIds: Array<string | number>;
};

type FlowValidationSummary = {
  canExport: boolean;
  requiresManualConfirmation: boolean;
  blockingSceneIds: Array<string | number>;
};

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function hasReadyVisual(scene: CreatorFinalVideoReadinessScene) {
  const hasImage = hasText(scene.image);
  const hasVideo =
    hasText(scene.videoUrl) && scene.videoStatus?.toLowerCase() === "done";

  if (scene.renderMode === "image") return hasImage;
  if (scene.renderMode === "video") return hasVideo && scene.videoCurrent !== false;

  return hasVideo || hasImage;
}

function hasReadyVoice(scene: CreatorFinalVideoReadinessScene) {
  const narrationReady =
    !hasText(scene.narration) ||
    (scene.narrationAudioCurrent ?? hasText(scene.audioUrl));
  const dialogueReady =
    !hasText(scene.dialogue) ||
    (scene.dialogueAudioCurrent ?? hasText(scene.dialogueAudioUrl));

  return narrationReady && dialogueReady;
}

export function createCreatorFinalVideoReadiness({
  scenes,
  timelineApproved,
  flowValidation,
}: {
  scenes: CreatorFinalVideoReadinessScene[];
  timelineApproved: boolean;
  flowValidation?: FlowValidationSummary | null;
}): CreatorFinalVideoReadinessReport {
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const missingVisualSceneIds = safeScenes
    .filter((scene) => !hasReadyVisual(scene))
    .map((scene) => scene.id);
  const missingVoiceSceneIds = safeScenes
    .filter((scene) => !hasReadyVoice(scene))
    .map((scene) => scene.id);
  const blockingSceneIds = flowValidation?.blockingSceneIds || [];
  const common = {
    totalScenes: safeScenes.length,
    readyVisualScenes: safeScenes.length - missingVisualSceneIds.length,
    readyVoiceScenes: safeScenes.length - missingVoiceSceneIds.length,
    missingVisualSceneIds,
    missingVoiceSceneIds,
    blockingSceneIds,
  };

  if (safeScenes.length === 0) {
    return {
      ...common,
      status: "production_stage_required",
      canStartFinalVideo: false,
      nextAction: "create_production_stage",
    };
  }

  if (!timelineApproved) {
    return {
      ...common,
      status: "timeline_required",
      canStartFinalVideo: false,
      nextAction: "timeline_check",
    };
  }

  if (missingVisualSceneIds.length > 0) {
    return {
      ...common,
      status: "visuals_required",
      canStartFinalVideo: false,
      nextAction: "generate_visuals",
    };
  }

  if (missingVoiceSceneIds.length > 0) {
    return {
      ...common,
      status: "voice_over_required",
      canStartFinalVideo: false,
      nextAction: "generate_voice_over",
    };
  }

  if (flowValidation && !flowValidation.canExport) {
    return {
      ...common,
      status: "continuity_blocked",
      canStartFinalVideo: false,
      nextAction: "review_continuity",
    };
  }

  if (flowValidation?.requiresManualConfirmation) {
    return {
      ...common,
      status: "confirmation_required",
      canStartFinalVideo: true,
      nextAction: "create_final_video",
    };
  }

  return {
    ...common,
    status: "ready",
    canStartFinalVideo: true,
    nextAction: "create_final_video",
  };
}
