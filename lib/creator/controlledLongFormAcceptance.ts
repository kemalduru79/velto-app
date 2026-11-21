import { normalizeCreatorAudioTimeline, validateCreatorAudioTimelineTopology } from "./audioTimeline.ts";
import { resolveCanonicalCreatorExportScenes } from "./exportScenes.ts";
import { buildCreatorFinalProductionSignature, canonicalCreatorMediaIdentity, parseCreatorFinalProductionSignature } from "./finalProductionSignature.ts";
import type { CreatorBackgroundMusicConfig } from "./backgroundMusic.ts";
import { isValidCreatorProjectState } from "./projectState.ts";
import { auditCreatorProgramEditorialBalance } from "./programEditorialPolish.ts";
import { validateCreatorVisualCoveragePlan, type CreatorVisualCoverageBeat } from "./visualCoverage.ts";

export const CREATOR_CONTROLLED_LONG_FORM_ACCEPTANCE_VERSION = "0.20G" as const;
export const CREATOR_FINAL_RENDER_FPS = 25;
// Mirrors the production export-service continuity allowance for container/frame rounding.
export const CREATOR_FINAL_DURATION_TOLERANCE_SECONDS = 0.25;

export function alignCreatorSceneDurationToRenderFrames(durationSec: unknown) {
  return typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0
    ? Math.round(durationSec * CREATOR_FINAL_RENDER_FPS) / CREATOR_FINAL_RENDER_FPS
    : Number.NaN;
}

export function resolveCreatorRendererAlignedProgramDuration(durations: readonly unknown[]) {
  const aligned = durations.map(alignCreatorSceneDurationToRenderFrames);
  return aligned.every((duration) => Number.isFinite(duration) && duration > 0)
    ? aligned.reduce((sum, duration) => sum + duration, 0)
    : Number.NaN;
}

type CheckGroup = "project" | "visuals" | "audio" | "timeline" | "finalVideo" | "mediaSafety";
type AcceptanceCheck = { code: string; status: "ready" | "review" | "blocked"; sceneIds: string[] };
type AcceptanceScene = Record<string, unknown> & {
  creatorSceneId?: string; exportSource?: "image" | "video"; image?: string; videoUrl?: string;
  narration?: string; dialogue?: string; audioUrl?: string; dialogueAudioUrl?: string;
  timing?: { targetSceneDuration?: number; narrationDuration?: number; dialogueDuration?: number; speechTailBuffer?: number };
  visualCoveragePlan?: CreatorVisualCoverageBeat[];
};

export type CreatorControlledLongFormAcceptanceInput = {
  baseline: { expectedSceneIds: string[] };
  project: { exists: boolean; flowType: string; persistedState: unknown; scenes: AcceptanceScene[] };
  audioTimeline: unknown;
  backgroundMusic?: CreatorBackgroundMusicConfig;
  continuity?: { blockedSceneIds?: string[]; reviewSceneIds?: string[] };
  finalVideo: {
    url: string; storedSignature: string;
    result: { sceneCount?: unknown; durationSeconds?: unknown } | null;
    asset: { assetId?: unknown; publicUrl?: unknown; lifecycleState?: unknown; mediaKind?: unknown; projectId?: unknown; references?: unknown } | null;
    projectId: string;
  };
};

export type CreatorControlledLongFormAcceptanceReport = {
  version: typeof CREATOR_CONTROLLED_LONG_FORM_ACCEPTANCE_VERSION;
  status: "ready" | "review" | "blocked";
  canProceedToHumanAcceptance: boolean;
  checks: Record<CheckGroup, AcceptanceCheck[]>;
  blockerCodes: string[];
  reviewCodes: string[];
  sceneIds: Record<CheckGroup, string[]>;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const finiteNonNegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const sameOrder = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((id, index) => id === right[index]);

export function createCreatorControlledLongFormAcceptance(input: CreatorControlledLongFormAcceptanceInput): CreatorControlledLongFormAcceptanceReport {
  const checks: CreatorControlledLongFormAcceptanceReport["checks"] = { project: [], visuals: [], audio: [], timeline: [], finalVideo: [], mediaSafety: [] };
  const add = (group: CheckGroup, code: string, status: AcceptanceCheck["status"], sceneIds: string[] = []) => checks[group].push({ code, status, sceneIds: Array.from(new Set(sceneIds.filter(Boolean))) });
  const expected = Array.isArray(input.baseline?.expectedSceneIds) ? input.baseline.expectedSceneIds.map(text) : [];
  const projectScenes = Array.isArray(input.project?.scenes) ? input.project.scenes : [];
  const projectIds = projectScenes.map((scene) => text(scene.creatorSceneId));
  const expectedValid = expected.length > 0 && expected.every(Boolean) && new Set(expected).size === expected.length;
  add("project", "PROJECT_AUTHORITY_VALID", input.project?.exists && input.project.flowType === "creator_lab" && isValidCreatorProjectState(input.project.persistedState) ? "ready" : "blocked");
  add("project", "EXPECTED_SCENE_BASELINE_VALID", expectedValid ? "ready" : "blocked");
  const projectIdentityValid = expectedValid && projectIds.every(Boolean) && new Set(projectIds).size === projectIds.length && sameOrder(projectIds, expected);
  add("project", "PROJECT_SCENE_IDENTITY_ORDER_MATCH", projectIdentityValid ? "ready" : "blocked", projectIdentityValid ? [] : Array.from(new Set([...expected, ...projectIds])));

  let canonicalScenes: AcceptanceScene[] = [];
  let canonicalExportIds: string[] = [];
  try {
    canonicalScenes = resolveCanonicalCreatorExportScenes(projectScenes) as AcceptanceScene[];
    canonicalExportIds = canonicalScenes.map((scene) => text(scene.creatorSceneId));
    add("timeline", "CANONICAL_EXPORT_SCENES_MATCH", sameOrder(canonicalExportIds, expected) ? "ready" : "blocked", sameOrder(canonicalExportIds, expected) ? [] : canonicalExportIds);
  } catch {
    add("visuals", "SCENE_AUTHORITATIVE_VISUAL", "blocked", projectIds);
    add("visuals", "SCENE_VISUAL_COVERAGE_VALID", "blocked", projectIds);
    add("timeline", "CANONICAL_EXPORT_SCENES_MATCH", "blocked", projectIds);
  }

  for (const scene of canonicalScenes) {
    const sceneId = text(scene.creatorSceneId);
    const selected = scene.exportSource === "video" ? text(scene.videoUrl) : scene.exportSource === "image" ? text(scene.image) : "";
    add("visuals", "SCENE_AUTHORITATIVE_VISUAL", selected ? "ready" : "blocked", selected ? [] : [sceneId]);
    const target = scene.timing?.targetSceneDuration;
    if (!finiteNonNegative(target) || Number(target) <= 0 || !Array.isArray(scene.visualCoveragePlan) || scene.visualCoveragePlan.length === 0) {
      add("visuals", "SCENE_VISUAL_COVERAGE_VALID", "blocked", [sceneId]);
    } else {
      const validation = validateCreatorVisualCoveragePlan({ creatorSceneId: sceneId, targetDurationSec: Number(target), beats: scene.visualCoveragePlan });
      const coverageReady = validation.valid && validation.fullyCovered && validation.renderable;
      add("visuals", "SCENE_VISUAL_COVERAGE_VALID", coverageReady ? "ready" : "blocked", coverageReady ? [] : [sceneId]);
    }
    const narrationRequired = Boolean(text(scene.narration));
    const dialogueRequired = Boolean(text(scene.dialogue));
    add("audio", "SCENE_REQUIRED_AUDIO_PRESENT", (!narrationRequired || Boolean(text(scene.audioUrl))) && (!dialogueRequired || Boolean(text(scene.dialogueAudioUrl))) ? "ready" : "blocked", (!narrationRequired || Boolean(text(scene.audioUrl))) && (!dialogueRequired || Boolean(text(scene.dialogueAudioUrl))) ? [] : [sceneId]);
    const narrationDuration = scene.timing?.narrationDuration;
    const dialogueDuration = scene.timing?.dialogueDuration;
    const tail = scene.timing?.speechTailBuffer;
    const timingValid = finiteNonNegative(target) && Number(target) > 0 && finiteNonNegative(narrationDuration) && finiteNonNegative(dialogueDuration) && finiteNonNegative(tail);
    const measuredRequired = (!narrationRequired || Number(narrationDuration) > 0) && (!dialogueRequired || Number(dialogueDuration) > 0);
    const speechFits = timingValid && Number(narrationDuration) + Number(dialogueDuration) + Number(tail) <= Number(target) + 0.02;
    add("audio", "SCENE_MEASURED_AUDIO_TIMING_VALID", timingValid && measuredRequired && speechFits ? "ready" : "blocked", timingValid && measuredRequired && speechFits ? [] : [sceneId]);
  }

  const editorial = auditCreatorProgramEditorialBalance(canonicalScenes.map((scene) => ({ creatorSceneId: scene.creatorSceneId, selectedMediaUrl: scene.exportSource === "video" ? scene.videoUrl : scene.image, selectedSource: scene.exportSource })));
  for (const issue of editorial.issues) add("visuals", `PROGRAM_${issue.code.toUpperCase()}`, "review", issue.sceneIds);
  if (editorial.issues.length === 0) add("visuals", "PROGRAM_EDITORIAL_BALANCE", "ready");

  try {
    const timeline = normalizeCreatorAudioTimeline(input.audioTimeline);
    const topology = validateCreatorAudioTimelineTopology({ timeline, sceneIds: expected });
    add("audio", "AUDIO_TIMELINE_STRUCTURE_VALID", "ready");
    add("audio", "AUDIO_TOPOLOGY_VALID", topology.status === "ready" ? "ready" : "blocked", topology.issues.flatMap((issue) => issue.sceneId ? [issue.sceneId] : []));
  } catch {
    add("audio", "AUDIO_TIMELINE_STRUCTURE_VALID", "blocked");
  }

  const blockedContinuity = input.continuity?.blockedSceneIds || [];
  const reviewContinuity = input.continuity?.reviewSceneIds || [];
  add("timeline", "CONTINUITY_BLOCKERS_CLEAR", blockedContinuity.length === 0 ? "ready" : "blocked", blockedContinuity);
  if (reviewContinuity.length) add("timeline", "CONTINUITY_MANUAL_REVIEW", "review", reviewContinuity);

  let signatureIds: string[] = [];
  let signatureDuration = 0;
  try {
    const parsed = parseCreatorFinalProductionSignature(input.finalVideo.storedSignature);
    signatureIds = parsed.scenes.map((scene) => scene.creatorSceneId);
    signatureDuration = resolveCreatorRendererAlignedProgramDuration(parsed.scenes.map((scene) => scene.timing.targetSceneDuration));
    add("finalVideo", "FINAL_SIGNATURE_VALID", "ready");
    const sceneAuthorityMatches = parsed.scenes.every((signatureScene, index) => {
      const projectScene = canonicalScenes[index];
      if (!projectScene || signatureScene.exportSource !== projectScene.exportSource) return false;
      const selectedMedia = projectScene.exportSource === "video" ? projectScene.videoUrl : projectScene.image;
      return canonicalCreatorMediaIdentity(signatureScene.selectedMedia) === canonicalCreatorMediaIdentity(selectedMedia);
    });
    const allSceneAuthoritiesMatch = sameOrder(signatureIds, expected) && sameOrder(signatureIds, projectIds) && sameOrder(signatureIds, canonicalExportIds) && sceneAuthorityMatches;
    add("finalVideo", "FINAL_SIGNATURE_SCENES_MATCH", allSceneAuthoritiesMatch ? "ready" : "blocked", allSceneAuthoritiesMatch ? [] : signatureIds);
  } catch {
    add("finalVideo", "FINAL_SIGNATURE_VALID", "blocked");
  }
  let currentSignature = "";
  try {
    if (input.audioTimeline === undefined && !input.backgroundMusic) throw new Error("Current audio authority is missing.");
    currentSignature = buildCreatorFinalProductionSignature({
      scenes: canonicalScenes.map((scene, index) => ({ ...scene, id: scene.id ?? scene.creatorSceneId ?? index + 1 })) as Parameters<typeof buildCreatorFinalProductionSignature>[0]["scenes"],
      backgroundMusic: input.backgroundMusic || { version: 1, mode: "none", volume: 0.16, autoDucking: true, fadeInSec: 1.5, fadeOutSec: 2 },
      ...(input.audioTimeline !== undefined ? { audioTimeline: input.audioTimeline as Parameters<typeof buildCreatorFinalProductionSignature>[0]["audioTimeline"] } : {}),
    });
  } catch {
    currentSignature = "";
  }
  add("finalVideo", "FINAL_SIGNATURE_CURRENT", Boolean(text(input.finalVideo.storedSignature)) && input.finalVideo.storedSignature === currentSignature ? "ready" : "blocked");
  const resultCount = input.finalVideo.result?.sceneCount;
  add("finalVideo", "FINAL_RESULT_SCENE_COUNT_MATCH", Number.isInteger(resultCount) && Number(resultCount) === expected.length && Number(resultCount) === projectIds.length && Number(resultCount) === canonicalExportIds.length && Number(resultCount) === signatureIds.length ? "ready" : "blocked");
  const finalDuration = input.finalVideo.result?.durationSeconds;
  const durationValid = typeof finalDuration === "number" && Number.isFinite(finalDuration) && finalDuration > 0 && signatureDuration > 0 && Math.abs(finalDuration - signatureDuration) <= CREATOR_FINAL_DURATION_TOLERANCE_SECONDS;
  add("finalVideo", "FINAL_DURATION_MATCH", durationValid ? "ready" : "blocked");
  add("finalVideo", "FINAL_VIDEO_PRESENT", text(input.finalVideo.url) ? "ready" : "blocked");

  const asset = input.finalVideo.asset;
  const references = Array.isArray(asset?.references) ? asset.references : [];
  const assetIdentityValid = Boolean(asset && text(asset.assetId) && asset.mediaKind === "final_video" && asset.lifecycleState === "active" && text(asset.projectId) === text(input.finalVideo.projectId) && canonicalCreatorMediaIdentity(asset.publicUrl) === canonicalCreatorMediaIdentity(input.finalVideo.url));
  add("mediaSafety", "FINAL_ASSET_IDENTITY_CURRENT", assetIdentityValid ? "ready" : "blocked");
  const projectReferenceValid = references.some((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const reference = value as Record<string, unknown>;
    return reference.referenceType === "final_video" && text(reference.projectId) === text(input.finalVideo.projectId);
  });
  add("mediaSafety", "FINAL_ASSET_PROJECT_REFERENCE", projectReferenceValid ? "ready" : "blocked");

  const blockerCodes = Array.from(new Set(Object.values(checks).flat().filter((check) => check.status === "blocked").map((check) => check.code)));
  const reviewCodes = Array.from(new Set(Object.values(checks).flat().filter((check) => check.status === "review").map((check) => check.code)));
  const status = blockerCodes.length ? "blocked" : reviewCodes.length ? "review" : "ready";
  const sceneIds = Object.fromEntries(Object.entries(checks).map(([group, groupChecks]) => [group, Array.from(new Set(groupChecks.flatMap((check) => check.sceneIds))) ])) as Record<CheckGroup, string[]>;
  return { version: CREATOR_CONTROLLED_LONG_FORM_ACCEPTANCE_VERSION, status, canProceedToHumanAcceptance: status === "ready", checks, blockerCodes, reviewCodes, sceneIds };
}
