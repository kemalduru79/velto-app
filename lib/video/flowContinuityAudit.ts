export type FlowContinuitySource = "video" | "image" | "none";
export type FlowContinuitySeverity = "safe" | "warning" | "high";
export type FlowContinuityRiskCode =
  | "audio_duration_missing"
  | "speech_overflow"
  | "visual_duration_missing"
  | "visual_gap"
  | "freeze_frame_risk"
  | "static_hold_unverified";

export type FlowContinuityVisualBlock = {
  type?: string;
  durationSec?: number;
  source?: string;
};

export type FlowContinuityAuditInputScene = {
  id: string | number;
  source: FlowContinuitySource;
  hasNarration?: boolean;
  hasDialogue?: boolean;
  narrationDurationSec?: number;
  dialogueDurationSec?: number;
  targetDurationSec?: number;
  videoDurationSec?: number;
  fallbackVideoDurationSec?: number;
  visualBlocks?: FlowContinuityVisualBlock[];
};

export type FlowContinuitySceneAudit = {
  id: string | number;
  severity: FlowContinuitySeverity;
  risks: FlowContinuityRiskCode[];
  source: FlowContinuitySource;
  durationSource: "timeline_blocks" | "video_request" | "fallback" | "image_scene" | "missing";
  narrationDurationSec: number;
  dialogueDurationSec: number;
  audioDurationSec: number;
  targetDurationSec: number;
  visualDurationSec: number;
  uncoveredDurationSec: number;
  audioOverflowSec: number;
  staticHoldSec: number;
  motionCoverageExpected: boolean;
};

export type FlowContinuityAuditReport = {
  version: "3N-1";
  mode: "detection_only";
  status: "ready" | "review" | "high_risk";
  totalScenes: number;
  safeScenes: number;
  warningScenes: number;
  highRiskScenes: number;
  unmeasuredAudioScenes: number;
  freezeRiskScenes: number;
  totalAudioDurationSec: number;
  totalTargetDurationSec: number;
  totalVisualDurationSec: number;
  totalUncoveredDurationSec: number;
  scenes: FlowContinuitySceneAudit[];
};

const GAP_TOLERANCE_SECONDS = 0.35;
const HIGH_GAP_SECONDS = 1.5;
const AUDIO_OVERFLOW_TOLERANCE_SECONDS = 0.2;
const STATIC_HOLD_WARNING_SECONDS = 4;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function safeDuration(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? round(numericValue)
    : 0;
}

function sumVisualBlocks(blocks?: FlowContinuityVisualBlock[]) {
  if (!Array.isArray(blocks)) {
    return 0;
  }

  return round(
    blocks.reduce(
      (sum, block) => sum + safeDuration(block?.durationSec),
      0,
    ),
  );
}

function hasMotionCoverage(blocks?: FlowContinuityVisualBlock[]) {
  return Array.isArray(blocks)
    ? blocks.some((block) => {
        const type = String(block?.type || "").toLowerCase();
        const source = String(block?.source || "").toLowerCase();

        return (
          type.includes("motion") ||
          type.includes("video") ||
          source.includes("motion") ||
          source.includes("video")
        );
      })
    : false;
}

function getVisualDuration(scene: FlowContinuityAuditInputScene) {
  if (scene.source === "none") {
    return {
      durationSec: 0,
      durationSource: "missing" as const,
    };
  }

  if (scene.source === "video") {
    const videoDurationSec = safeDuration(scene.videoDurationSec);

    if (videoDurationSec > 0) {
      return {
        durationSec: videoDurationSec,
        durationSource: "video_request" as const,
      };
    }
  }

  const timelineBlockDuration = sumVisualBlocks(scene.visualBlocks);

  if (timelineBlockDuration > 0) {
    return {
      durationSec: timelineBlockDuration,
      durationSource: "timeline_blocks" as const,
    };
  }

  if (scene.source === "video") {
    const fallbackVideoDurationSec = safeDuration(
      scene.fallbackVideoDurationSec,
    );

    if (fallbackVideoDurationSec > 0) {
      return {
        durationSec: fallbackVideoDurationSec,
        durationSource: "fallback" as const,
      };
    }
  }

  if (scene.source === "image") {
    return {
      durationSec: safeDuration(scene.targetDurationSec),
      durationSource: "image_scene" as const,
    };
  }

  return {
    durationSec: 0,
    durationSource: "missing" as const,
  };
}

function getSceneSeverity(risks: FlowContinuityRiskCode[]) {
  if (
    risks.includes("speech_overflow") ||
    risks.includes("visual_duration_missing") ||
    risks.includes("freeze_frame_risk")
  ) {
    return "high" as const;
  }

  return risks.length > 0 ? ("warning" as const) : ("safe" as const);
}

export function auditFlowContinuityScene(
  scene: FlowContinuityAuditInputScene,
): FlowContinuitySceneAudit {
  const narrationDurationSec = safeDuration(scene.narrationDurationSec);
  const dialogueDurationSec = safeDuration(scene.dialogueDurationSec);
  const audioDurationSec = round(
    narrationDurationSec + dialogueDurationSec,
  );
  const targetDurationSec = Math.max(
    0,
    safeDuration(scene.targetDurationSec),
  );
  const visual = getVisualDuration(scene);
  const uncoveredDurationSec = round(
    Math.max(0, targetDurationSec - visual.durationSec),
  );
  const audioOverflowSec = round(
    Math.max(0, audioDurationSec - targetDurationSec),
  );
  const motionCoverageExpected = hasMotionCoverage(scene.visualBlocks);
  const staticHoldSec =
    scene.source === "image" && !motionCoverageExpected
      ? targetDurationSec
      : scene.source === "video"
        ? uncoveredDurationSec
        : 0;
  const risks: FlowContinuityRiskCode[] = [];

  if (
    (scene.hasNarration && narrationDurationSec === 0) ||
    (scene.hasDialogue && dialogueDurationSec === 0)
  ) {
    risks.push("audio_duration_missing");
  }

  if (audioOverflowSec > AUDIO_OVERFLOW_TOLERANCE_SECONDS) {
    risks.push("speech_overflow");
  }

  if (scene.source === "none" || visual.durationSec === 0) {
    risks.push("visual_duration_missing");
  } else if (uncoveredDurationSec > GAP_TOLERANCE_SECONDS) {
    risks.push("visual_gap");

    if (
      uncoveredDurationSec > HIGH_GAP_SECONDS ||
      scene.source === "video"
    ) {
      risks.push("freeze_frame_risk");
    }
  }

  if (
    scene.source === "image" &&
    !motionCoverageExpected &&
    staticHoldSec > STATIC_HOLD_WARNING_SECONDS
  ) {
    risks.push("static_hold_unverified");
  }

  return {
    id: scene.id,
    severity: getSceneSeverity(risks),
    risks,
    source: scene.source,
    durationSource: visual.durationSource,
    narrationDurationSec,
    dialogueDurationSec,
    audioDurationSec,
    targetDurationSec,
    visualDurationSec: visual.durationSec,
    uncoveredDurationSec,
    audioOverflowSec,
    staticHoldSec: round(staticHoldSec),
    motionCoverageExpected,
  };
}

export function createFlowContinuityAudit(
  inputScenes: FlowContinuityAuditInputScene[],
): FlowContinuityAuditReport {
  const scenes = Array.isArray(inputScenes)
    ? inputScenes.map(auditFlowContinuityScene)
    : [];
  const safeScenes = scenes.filter((scene) => scene.severity === "safe").length;
  const warningScenes = scenes.filter(
    (scene) => scene.severity === "warning",
  ).length;
  const highRiskScenes = scenes.filter(
    (scene) => scene.severity === "high",
  ).length;
  const sum = (selector: (scene: FlowContinuitySceneAudit) => number) =>
    round(scenes.reduce((total, scene) => total + selector(scene), 0));

  return {
    version: "3N-1",
    mode: "detection_only",
    status:
      highRiskScenes > 0
        ? "high_risk"
        : warningScenes > 0
          ? "review"
          : "ready",
    totalScenes: scenes.length,
    safeScenes,
    warningScenes,
    highRiskScenes,
    unmeasuredAudioScenes: scenes.filter((scene) =>
      scene.risks.includes("audio_duration_missing"),
    ).length,
    freezeRiskScenes: scenes.filter((scene) =>
      scene.risks.includes("freeze_frame_risk"),
    ).length,
    totalAudioDurationSec: sum((scene) => scene.audioDurationSec),
    totalTargetDurationSec: sum((scene) => scene.targetDurationSec),
    totalVisualDurationSec: sum((scene) => scene.visualDurationSec),
    totalUncoveredDurationSec: sum((scene) => scene.uncoveredDurationSec),
    scenes,
  };
}
