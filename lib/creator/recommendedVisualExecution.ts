import type { CreatorQualityMode } from "./mediaRouting.ts";
import type {
  CreatorProductionTreatment,
  CreatorSceneProductionDecision,
} from "./productionIntelligence.ts";

export type CreatorRecommendedAssetHistoryItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  createdAt: string;
  source: "generated" | "restored" | "loaded" | "stock";
  durationSec?: number;
};

export type CreatorRecommendedVisualScene = {
  id: number;
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
  videoJobId?: string;
  videoQueueJobId?: string;
  videoDurationSeconds?: number;
  renderMode?: "image" | "video";
  assetHistory?: CreatorRecommendedAssetHistoryItem[];
};

export type CreatorRecommendedStockAsset = {
  publicUrl: string;
  mediaType: "photo" | "video";
  durationSeconds: number | null;
};

export type CreatorRecommendedVideoResult = {
  videoUrl: string;
  videoJobId: string;
  videoQueueJobId?: string;
  videoDurationSeconds: number;
};

export type CreatorRecommendedVisualOutcome = {
  sceneId: number;
  status: "preserved" | "generated" | "failed";
  treatment: CreatorProductionTreatment;
  error?: string;
};

const NON_GENERATIVE_TREATMENTS = new Set<CreatorProductionTreatment>([
  "source_clip",
  "source_image",
  "data_visual",
  "quote_card",
  "source_card",
]);

export function hasCreatorUsableVisual(scene: CreatorRecommendedVisualScene) {
  return Boolean(scene.image || (scene.videoUrl && scene.videoStatus === "done"));
}

function appendStockHistory<TScene extends CreatorRecommendedVisualScene>(
  scene: TScene,
  asset: CreatorRecommendedStockAsset,
  createHistoryId: (sceneId: number, kind: "image" | "video") => string,
  now: () => string,
) {
  const kind = asset.mediaType === "photo" ? "image" : "video";
  const history = scene.assetHistory || [];
  if (history.some((item) => item.kind === kind && item.url === asset.publicUrl)) {
    return history;
  }
  return [
    ...history,
    {
      id: createHistoryId(scene.id, kind),
      kind,
      url: asset.publicUrl,
      createdAt: now(),
      source: "stock" as const,
      ...(asset.durationSeconds && asset.durationSeconds > 0
        ? { durationSec: asset.durationSeconds }
        : {}),
    },
  ];
}

function executionCandidates(decision: CreatorSceneProductionDecision) {
  return Array.from(new Set([
    decision.selectedTreatment,
    ...decision.fallbackTreatments,
    "ai_image" as const,
  ]));
}

export function estimateCreatorRecommendedVisualManifest(input: {
  scenes: CreatorRecommendedVisualScene[];
  decisions: CreatorSceneProductionDecision[];
  targetSceneIds: readonly number[];
  qualityMode: CreatorQualityMode;
  shouldPreserveExisting?: (
    scene: CreatorRecommendedVisualScene,
    decision: CreatorSceneProductionDecision,
  ) => boolean;
  allowFallback?: (
    scene: CreatorRecommendedVisualScene,
    decision: CreatorSceneProductionDecision,
  ) => boolean;
}) {
  const targetIds = new Set(input.targetSceneIds);
  const decisions = new Map(input.decisions.map((decision) => [decision.sceneId, decision]));
  let images = 0;
  let videos = 0;

  for (const scene of input.scenes) {
    if (!targetIds.has(scene.id)) continue;
    const decision = decisions.get(scene.id);
    if (!decision) continue;
    if (hasCreatorUsableVisual(scene) && (input.shouldPreserveExisting?.(scene, decision) ?? true)) continue;
    if (decision.selectedTreatment === "ai_video" && input.qualityMode !== "standard") {
      videos += 1;
    }
    const fallbackAllowed = input.allowFallback?.(scene, decision) ?? true;
    if (
      decision.selectedTreatment === "ai_image" ||
      decision.selectedTreatment === "image_motion" ||
      (decision.selectedTreatment === "ai_video" && !scene.image) ||
      (fallbackAllowed && (
        decision.selectedTreatment.startsWith("stock") ||
        NON_GENERATIVE_TREATMENTS.has(decision.selectedTreatment)
      ))
    ) {
      // Stock/documentary routes may use the existing paid AI-image fallback.
      // Reserving admission here does not charge; only the invoked child route settles.
      images += 1;
    }
  }

  return { images, videos };
}

export async function executeCreatorRecommendedVisualBatch<
  TScene extends CreatorRecommendedVisualScene,
>(input: {
  scenes: TScene[];
  decisions: CreatorSceneProductionDecision[];
  targetSceneIds: readonly number[];
  qualityMode: CreatorQualityMode;
  acquireStock: (
    scene: TScene,
    decision: CreatorSceneProductionDecision,
  ) => Promise<CreatorRecommendedStockAsset | null>;
  generateImage: (scene: TScene) => Promise<string>;
  generateVideo: (scene: TScene) => Promise<CreatorRecommendedVideoResult>;
  createHistoryId?: (sceneId: number, kind: "image" | "video") => string;
  now?: () => string;
  isCancelled?: () => boolean;
  onSceneStart?: (scene: TScene, decision: CreatorSceneProductionDecision) => void;
  onSceneSettled?: (scene: TScene, outcome: CreatorRecommendedVisualOutcome) => void;
  allowFallback?: (scene: TScene, decision: CreatorSceneProductionDecision) => boolean;
  shouldPreserveExisting?: (scene: TScene, decision: CreatorSceneProductionDecision) => boolean;
}) {
  const workingScenes = input.scenes.map((scene) => ({ ...scene } as TScene));
  const targetIds = new Set(input.targetSceneIds);
  const decisions = new Map(input.decisions.map((decision) => [decision.sceneId, decision]));
  const outcomes: CreatorRecommendedVisualOutcome[] = [];
  const createHistoryId = input.createHistoryId ||
    ((sceneId: number, kind: "image" | "video") => `${kind}-${sceneId}-${Date.now()}`);
  const now = input.now || (() => new Date().toISOString());

  for (let index = 0; index < workingScenes.length; index += 1) {
    if (input.isCancelled?.()) break;
    let scene = workingScenes[index];
    if (!targetIds.has(scene.id)) continue;
    const decision = decisions.get(scene.id);
    if (!decision) {
      const outcome: CreatorRecommendedVisualOutcome = {
        sceneId: scene.id,
        status: "failed",
        treatment: "reuse_existing",
        error: "CREATOR_PRODUCTION_DECISION_MISSING",
      };
      outcomes.push(outcome);
      input.onSceneSettled?.(scene, outcome);
      continue;
    }

    input.onSceneStart?.(scene, decision);
    if (hasCreatorUsableVisual(scene) && (input.shouldPreserveExisting?.(scene, decision) ?? true)) {
      const outcome: CreatorRecommendedVisualOutcome = {
        sceneId: scene.id,
        status: "preserved",
        treatment: decision.selectedTreatment,
      };
      outcomes.push(outcome);
      input.onSceneSettled?.(scene, outcome);
      continue;
    }

    try {
      let executedTreatment: CreatorProductionTreatment | null = null;
      const candidates = input.allowFallback?.(scene, decision) === false
        ? [decision.selectedTreatment]
        : executionCandidates(decision);
      for (const treatment of candidates) {
        if (treatment === "reuse_existing") continue;
        if (NON_GENERATIVE_TREATMENTS.has(treatment)) continue;

        if (treatment === "stock_photo" || treatment === "stock_video") {
          if (treatment !== decision.selectedTreatment) continue;
          const stock = await input.acquireStock(scene, decision);
          if (!stock) continue;
          scene = stock.mediaType === "photo"
            ? {
                ...scene,
                image: stock.publicUrl,
                renderMode: "image",
                videoUrl: "",
                videoStatus: "idle",
                videoJobId: "",
                videoQueueJobId: "",
                videoDurationSeconds: 0,
                assetHistory: appendStockHistory(scene, stock, createHistoryId, now),
              } as TScene
            : {
                ...scene,
                renderMode: "video",
                videoUrl: stock.publicUrl,
                videoStatus: "done",
                videoJobId: "",
                videoQueueJobId: "",
                videoDurationSeconds: stock.durationSeconds || 0,
                assetHistory: appendStockHistory(scene, stock, createHistoryId, now),
              } as TScene;
          executedTreatment = treatment;
          break;
        }

        if (treatment === "ai_video") {
          if (input.qualityMode !== "pro" && input.qualityMode !== "cinematic") continue;
          if (!scene.image) {
            scene = {
              ...scene,
              image: await input.generateImage(scene),
              videoUrl: "",
              videoStatus: "idle",
              videoJobId: "",
            } as TScene;
          }
          const video = await input.generateVideo(scene);
          scene = {
            ...scene,
            renderMode: "video",
            videoUrl: video.videoUrl,
            videoStatus: "done",
            videoJobId: video.videoJobId,
            videoQueueJobId: video.videoQueueJobId,
            videoDurationSeconds: video.videoDurationSeconds,
          } as TScene;
          executedTreatment = treatment;
          break;
        }

        if (treatment === "ai_image" || treatment === "image_motion") {
          scene = {
            ...scene,
            image: await input.generateImage(scene),
            renderMode: "image",
            videoUrl: "",
            videoStatus: "idle",
            videoJobId: "",
            videoQueueJobId: "",
            videoDurationSeconds: 0,
          } as TScene;
          executedTreatment = treatment;
          break;
        }
      }

      if (!executedTreatment) throw new Error("CREATOR_RECOMMENDED_VISUAL_TREATMENT_UNAVAILABLE");
      workingScenes[index] = scene;
      const outcome: CreatorRecommendedVisualOutcome = {
        sceneId: scene.id,
        status: "generated",
        treatment: executedTreatment,
      };
      outcomes.push(outcome);
      input.onSceneSettled?.(scene, outcome);
    } catch (error) {
      // Preserve any completed prerequisite (for example, an image created
      // before a routed video failure) rather than discarding paid success.
      workingScenes[index] = scene;
      const outcome: CreatorRecommendedVisualOutcome = {
        sceneId: scene.id,
        status: "failed",
        treatment: decision.selectedTreatment,
        error: error instanceof Error ? error.message : "CREATOR_RECOMMENDED_VISUAL_FAILED",
      };
      outcomes.push(outcome);
      input.onSceneSettled?.(scene, outcome);
    }
  }

  return { scenes: workingScenes, outcomes };
}
