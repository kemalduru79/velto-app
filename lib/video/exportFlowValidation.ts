import {
  createFlowContinuityAudit,
  type FlowContinuityAuditInputScene,
  type FlowContinuityAuditReport,
  type FlowContinuityRiskCode,
} from "./flowContinuityAudit";
import {
  createVisualFillerPlan,
  type VisualFillerPlan,
} from "./visualFiller";

export type ExportFlowValidationInputScene =
  FlowContinuityAuditInputScene & {
    hasReferenceImage?: boolean;
  };

export type ExportFlowAutoFixCode =
  | "extend_scene_to_audio"
  | "add_animated_still"
  | "add_image_motion_tail"
  | "add_motion_loop";

export type ExportFlowAutoFix = {
  sceneId: string | number;
  code: ExportFlowAutoFixCode;
  targetDurationSec: number;
  visualAction: "keep_clip" | "image_motion_tail" | "slow_clip";
  resolvedRisks: FlowContinuityRiskCode[];
  fallbackVisualPlan?: VisualFillerPlan;
};

export type ExportFlowValidationReport = {
  version: "3N-5";
  mode: "enforced_preflight";
  status: "ready" | "auto_fixed" | "confirmation_required" | "blocked";
  canExport: boolean;
  requiresManualConfirmation: boolean;
  totalScenes: number;
  autoFixedScenes: number;
  blockingSceneIds: Array<string | number>;
  reviewSceneIds: Array<string | number>;
  unresolvedRisks: Array<{
    sceneId: string | number;
    risks: FlowContinuityRiskCode[];
  }>;
  autoFixes: ExportFlowAutoFix[];
  audit: FlowContinuityAuditReport;
};

type MutableExportScene = {
  id?: string | number;
  durationSec?: number;
  timing?: Record<string, unknown>;
};

const BLOCKING_RISKS = new Set<FlowContinuityRiskCode>([
  "speech_overflow",
  "visual_duration_missing",
  "freeze_frame_risk",
]);

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}

function getAutoFixCode(plan: VisualFillerPlan): ExportFlowAutoFixCode {
  if (plan.strategy === "animated_still") return "add_animated_still";
  if (plan.strategy === "motion_loop") return "add_motion_loop";

  return "add_image_motion_tail";
}

function getVisualAction(plan: VisualFillerPlan) {
  if (plan.strategy === "motion_loop") return "slow_clip" as const;
  if (
    plan.strategy === "animated_still" ||
    plan.strategy === "image_motion_tail" ||
    plan.strategy === "cutaway_sequence"
  ) {
    return "image_motion_tail" as const;
  }

  return "keep_clip" as const;
}

export function createExportFlowValidation({
  scenes,
  maxSceneDurationSec = 30,
  speechTailBufferSec = 0.75,
}: {
  scenes: ExportFlowValidationInputScene[];
  maxSceneDurationSec?: number;
  speechTailBufferSec?: number;
}): ExportFlowValidationReport {
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const audit = createFlowContinuityAudit(safeScenes);
  const autoFixes: ExportFlowAutoFix[] = [];
  const unresolvedRisks: ExportFlowValidationReport["unresolvedRisks"] = [];

  audit.scenes.forEach((sceneAudit) => {
    const sourceScene = safeScenes.find(
      (scene) => String(scene.id) === String(sceneAudit.id),
    );
    const remainingRisks = new Set(sceneAudit.risks);
    let targetDurationSec = sceneAudit.targetDurationSec;
    const resolvedRisks = new Set<FlowContinuityRiskCode>();
    let extendedForAudio = false;

    if (remainingRisks.has("speech_overflow")) {
      const audioSafeTarget = roundDuration(
        sceneAudit.audioDurationSec + speechTailBufferSec,
      );

      if (
        audioSafeTarget <= maxSceneDurationSec &&
        sceneAudit.source !== "none"
      ) {
        targetDurationSec = Math.max(targetDurationSec, audioSafeTarget);
        remainingRisks.delete("speech_overflow");
        resolvedRisks.add("speech_overflow");
        extendedForAudio = true;
      }
    }

    const needsMotionFix =
      remainingRisks.has("visual_gap") ||
      remainingRisks.has("freeze_frame_risk") ||
      remainingRisks.has("static_hold_unverified") ||
      extendedForAudio;

    if (needsMotionFix && sourceScene && sceneAudit.source !== "none") {
      const fillerPlan = createVisualFillerPlan({
        targetDurationSec,
        sourceDurationSec:
          sceneAudit.source === "video" ? sceneAudit.visualDurationSec : 0,
        hasVideo: sceneAudit.source === "video",
        hasReferenceImage:
          sceneAudit.source === "image" ||
          Boolean(sourceScene.hasReferenceImage),
        gapToleranceSec: 0.05,
      });

      if (fillerPlan.preventsFreeze) {
        const motionRisks: FlowContinuityRiskCode[] = [
          "visual_gap",
          "freeze_frame_risk",
          "static_hold_unverified",
        ];

        motionRisks.forEach((risk) => {
          if (remainingRisks.delete(risk)) {
            resolvedRisks.add(risk);
          }
        });

        autoFixes.push({
          sceneId: sceneAudit.id,
          code: extendedForAudio
            ? "extend_scene_to_audio"
            : getAutoFixCode(fillerPlan),
          targetDurationSec,
          visualAction: getVisualAction(fillerPlan),
          resolvedRisks: Array.from(resolvedRisks),
          fallbackVisualPlan: fillerPlan,
        });
      }
    }

    if (extendedForAudio && resolvedRisks.has("speech_overflow")) {
      const existingFix = autoFixes.find(
        (fix) => String(fix.sceneId) === String(sceneAudit.id),
      );

      if (!existingFix) {
        autoFixes.push({
          sceneId: sceneAudit.id,
          code: "extend_scene_to_audio",
          targetDurationSec,
          visualAction: "keep_clip",
          resolvedRisks: Array.from(resolvedRisks),
        });
      }
    }

    if (remainingRisks.size > 0) {
      unresolvedRisks.push({
        sceneId: sceneAudit.id,
        risks: Array.from(remainingRisks),
      });
    }
  });

  const blockingSceneIds = unresolvedRisks
    .filter((item) => item.risks.some((risk) => BLOCKING_RISKS.has(risk)))
    .map((item) => item.sceneId);
  const reviewSceneIds = unresolvedRisks
    .filter((item) => !item.risks.some((risk) => BLOCKING_RISKS.has(risk)))
    .map((item) => item.sceneId);
  const canExport = blockingSceneIds.length === 0;
  const requiresManualConfirmation = canExport && reviewSceneIds.length > 0;
  const autoFixedScenes = new Set(
    autoFixes.map((fix) => String(fix.sceneId)),
  ).size;

  return {
    version: "3N-5",
    mode: "enforced_preflight",
    status: !canExport
      ? "blocked"
      : requiresManualConfirmation
        ? "confirmation_required"
        : autoFixes.length > 0
          ? "auto_fixed"
          : "ready",
    canExport,
    requiresManualConfirmation,
    totalScenes: audit.totalScenes,
    autoFixedScenes,
    blockingSceneIds,
    reviewSceneIds,
    unresolvedRisks,
    autoFixes,
    audit,
  };
}

export function applyExportFlowAutoFixes<T extends MutableExportScene>(
  scenes: T[],
  report: ExportFlowValidationReport,
): T[] {
  const fixesBySceneId = new Map(
    report.autoFixes.map((fix) => [String(fix.sceneId), fix]),
  );

  return scenes.map((scene) => {
    const fix = fixesBySceneId.get(String(scene.id));

    if (!fix) {
      return scene;
    }

    return {
      ...scene,
      durationSec: fix.targetDurationSec,
      timing: {
        ...(scene.timing || {}),
        targetSceneDuration: fix.targetDurationSec,
        needsFreezeFrame: false,
        freezeDuration: 0,
        visualAction: fix.visualAction,
        fallbackVisualPlan: fix.fallbackVisualPlan,
        exportFlowValidated: true,
      },
    } as T;
  });
}
