import { readCreatorProjectState } from "./projectState";
import { buildCreatorFinalProductionSignature } from "./finalProductionSignature";
import { DEFAULT_CREATOR_BACKGROUND_MUSIC } from "./backgroundMusic";
import { CreatorAudioRenderabilityError, resolveCreatorAudioRenderability } from "./audioRenderability.server";
import { getPersistenceServices } from "@/lib/persistence";
import type { ProjectRepository, VeltoProjectApiRecord } from "@/lib/persistence/projects";
import type { MediaAssetRepository } from "@/lib/persistence/media";
import { planCreatorProjectProduction, type CreatorProductionSceneInput } from "./productionIntelligence";
import { resolveCreatorFinalSceneExportSelections } from "./finalSceneExportSelection";
import { normalizeCreatorQualityMode, type CreatorQualityMode } from "./mediaRouting";
import { normalizeCreatorProjectContinuityMode, normalizeCreatorSceneContinuityMode, resolveCreatorVisualContinuityMode } from "./visualContinuity";
import { buildCreatorVideoGenerationSignature, buildLegacyCreatorVideoGenerationSignature, deriveCreatorVideoCurrentness } from "./videoGeneration";
import type { TimelineSyncPlan } from "@/lib/video/timelineSync";

export type CreatorPublishAuthorityBlocker =
  | "project_required"
  | "final_video_required"
  | "production_changed"
  | "music_attention";

export type CreatorPublishAuthorityDecision =
  | { ready: true; finalVideoUrl: string; finalVideoSignature: string }
  | { ready: false; blocker: CreatorPublishAuthorityBlocker; message: string };

type Dependencies = {
  projectRepository: ProjectRepository;
  mediaAssetRepository: MediaAssetRepository;
  resolveAudioRenderability?: typeof resolveCreatorAudioRenderability;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

function currentFinalProductionSignature(project: VeltoProjectApiRecord) {
  const state = readCreatorProjectState(project);
  const scenes: Array<Record<string, unknown> & { id: string | number }> = state.createReview.scenes.map((value, index) => {
    const scene = record(value);
    return {
      ...scene,
      id: typeof scene.id === "string" || typeof scene.id === "number" ? scene.id : index + 1,
    };
  });
  const qualityMode = normalizeCreatorQualityMode(state.brief.qualityMode) as CreatorQualityMode;
  const creatorFormat = state.brief.format;
  const projectMode = normalizeCreatorProjectContinuityMode(state.production.projectContinuityMode);
  const timeline = record(state.production.package).timelineSyncPlan as TimelineSyncPlan | undefined;
  const characterReferences = Array.isArray(project.characters)
    ? project.characters.flatMap((value) => {
        const reference = record(value).referenceImage;
        return typeof reference === "string" && reference.trim() ? [reference.trim()] : [];
      }).slice(0, 3)
    : [];
  const routingScenes = scenes.map((scene, index) => {
    const timing = record(scene.timing);
    const cinematic = qualityMode === "cinematic" ? {
      lastFrameUrl: typeof scenes[index + 1]?.image === "string" ? String(scenes[index + 1].image) : undefined,
      referenceImageUrls: characterReferences,
    } : {};
    const generationInput = {
      text: typeof scene.text === "string" ? scene.text : undefined,
      motionHint: typeof scene.motionHint === "string" ? scene.motionHint : undefined,
      cameraDirection: typeof scene.cameraDirection === "string" ? scene.cameraDirection : undefined,
      emotion: typeof scene.emotion === "string" ? scene.emotion : undefined,
      imageUrl: typeof scene.image === "string" ? scene.image : undefined,
      qualityMode,
      creatorFormat,
      duration: Number(timing.targetSceneDuration || 10),
      ...cinematic,
    };
    const sceneMode = normalizeCreatorSceneContinuityMode(
      state.production.sceneContinuityModes[String(scene.id)] || scene.continuityMode,
    );
    const resolvedContinuity = resolveCreatorVisualContinuityMode({ projectMode, sceneMode, isFirstScene: index === 0 });
    return {
      ...scene,
      id: Number(scene.id),
      renderMode: scene.renderMode === "image" || scene.renderMode === "video" ? scene.renderMode : undefined,
      videoCurrent: deriveCreatorVideoCurrentness({
        videoUrl: typeof scene.videoUrl === "string" ? scene.videoUrl : undefined,
        videoStatus: typeof scene.videoStatus === "string" ? scene.videoStatus : undefined,
        generationSignature: typeof scene.videoGenerationSignature === "string" ? scene.videoGenerationSignature : undefined,
        currentSignature: buildCreatorVideoGenerationSignature(generationInput),
        legacyCurrentSignature: buildLegacyCreatorVideoGenerationSignature(generationInput),
      }) === "current",
      imageCurrent: Boolean(scene.image),
      referenceAvailabilityCount: scene.image ? 1 : 0,
      continuityImportance: scene.continuityImportance ?? (resolvedContinuity === "previous" ? 0.9 : resolvedContinuity === "consistent" ? 0.7 : undefined),
      timeline: timeline?.scenes?.find((item) => Number(item.id) === Number(scene.id)) || null,
      orientation: creatorFormat === "youtube_video" ? "landscape" as const : "portrait" as const,
    } as CreatorProductionSceneInput;
  });
  const selections = resolveCreatorFinalSceneExportSelections(
    scenes,
    planCreatorProjectProduction(routingScenes, qualityMode),
  );
  const selectionById = new Map(selections.map((selection) => [selection.creatorSceneId, selection]));
  return {
    state,
    signature: buildCreatorFinalProductionSignature({
      scenes: scenes.map((scene) => {
        const selection = selectionById.get(
          typeof scene.creatorSceneId === "string" ? scene.creatorSceneId : `legacy-${scene.id}`,
        );
        return {
          ...scene,
          creatorSceneId: typeof scene.creatorSceneId === "string" ? scene.creatorSceneId : undefined,
          renderMode: selection?.effectiveRenderMode,
          exportSource: selection?.exportSource || "none",
        };
      }),
      backgroundMusic: DEFAULT_CREATOR_BACKGROUND_MUSIC,
      audioTimeline: state.production.audioTimeline,
    }),
  };
}

const blocked = (blocker: CreatorPublishAuthorityBlocker): CreatorPublishAuthorityDecision => ({
  ready: false,
  blocker,
  message: blocker === "final_video_required"
    ? "Build your final video before publishing."
    : blocker === "production_changed"
      ? "Your production changed. Rebuild the final video."
      : blocker === "music_attention"
        ? "Music needs attention before final production."
        : "Project readiness could not be verified.",
});

export async function resolveCreatorPublishAuthority(input: {
  ownerUserId: string;
  projectId: string;
  requestedFinalVideoUrl?: unknown;
}, dependencies?: Dependencies): Promise<CreatorPublishAuthorityDecision> {
  const persistence = dependencies ? null : getPersistenceServices();
  const resolved = dependencies || {
    projectRepository: persistence!.projectRepository,
    mediaAssetRepository: persistence!.mediaAssetRepository,
  };
  const project = await resolved.projectRepository.getForOwner(input.projectId, input.ownerUserId);
  if (!project || project.flow_type !== "creator_lab") return blocked("project_required");

  let canonical;
  try {
    canonical = currentFinalProductionSignature(project);
  } catch {
    return blocked("production_changed");
  }
  const finalVideoUrl = canonical.state.publish.finalVideoUrl.trim();
  const finalVideoSignature = canonical.state.publish.finalVideoSignature.trim();
  if (!finalVideoUrl || !finalVideoSignature) return blocked("final_video_required");
  if (
    project.exported_movie_url !== finalVideoUrl ||
    project.export_signature !== finalVideoSignature ||
    canonical.signature !== finalVideoSignature ||
    (typeof input.requestedFinalVideoUrl === "string" && input.requestedFinalVideoUrl.trim() !== finalVideoUrl)
  ) return blocked("production_changed");

  const finalAsset = await resolved.mediaAssetRepository.findByPublicUrl(input.ownerUserId, finalVideoUrl);
  if (
    !finalAsset || finalAsset.mediaKind !== "final_video" || finalAsset.lifecycleState !== "active" ||
    finalAsset.metadata?.projectId !== input.projectId
  ) return blocked("final_video_required");

  try {
    await (resolved.resolveAudioRenderability || resolveCreatorAudioRenderability)({
      ownerUserId: input.ownerUserId,
      projectId: input.projectId,
      timeline: canonical.state.production.audioTimeline,
    });
  } catch (error) {
    if (error instanceof CreatorAudioRenderabilityError) return blocked("music_attention");
    return blocked("music_attention");
  }

  return { ready: true, finalVideoUrl, finalVideoSignature };
}
