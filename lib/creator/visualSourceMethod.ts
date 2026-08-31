import type { CreatorQualityMode } from "./mediaRouting.ts";
import type {
  CreatorProductionTreatment,
  CreatorSceneProductionDecision,
} from "./productionIntelligence.ts";

export const CREATOR_VISUAL_SOURCE_METHODS = [
  "recommended",
  "stock",
  "ai_image",
  "ai_video",
  "upload",
] as const;

export type CreatorVisualSourceMethod = typeof CREATOR_VISUAL_SOURCE_METHODS[number];

export type CreatorVisualSourceScene = {
  id: number;
  creatorSceneId?: string;
  renderMode?: "image" | "video";
  visualSourceMethod?: CreatorVisualSourceMethod;
};

export function normalizeCreatorVisualSourceMethod(value: unknown): CreatorVisualSourceMethod {
  return CREATOR_VISUAL_SOURCE_METHODS.includes(value as CreatorVisualSourceMethod)
    ? value as CreatorVisualSourceMethod
    : "recommended";
}

export function persistedCreatorVisualSourceMethod(method: CreatorVisualSourceMethod) {
  return method === "recommended" ? undefined : method;
}

export function isCreatorVisualSourceMethodExecutable(method: CreatorVisualSourceMethod) {
  return true;
}

function stockTreatment(scene: CreatorVisualSourceScene, decision: CreatorSceneProductionDecision) {
  if (scene.renderMode === "video" || decision.selectedTreatment === "stock_video") {
    return "stock_video" as const;
  }
  return "stock_photo" as const;
}

function expectedEconomics(treatment: CreatorProductionTreatment, qualityMode: CreatorQualityMode) {
  const paid = treatment === "ai_image" || treatment === "image_motion" || treatment === "ai_video";
  return {
    expectedPaidGeneration: qualityMode !== "draft" && paid,
    expectedCreditOperation: qualityMode === "draft"
      ? "none" as const
      : treatment === "ai_video"
        ? "video" as const
        : treatment === "ai_image" || treatment === "image_motion"
          ? "image" as const
          : "none" as const,
    providerCostCategory: qualityMode === "draft" || !paid
      ? "not_billable" as const
      : "known_estimate" as const,
  };
}

export function applyCreatorVisualSourceOverride(input: {
  scene: CreatorVisualSourceScene;
  decision: CreatorSceneProductionDecision;
  qualityMode: CreatorQualityMode;
  method?: CreatorVisualSourceMethod;
}) {
  const method = normalizeCreatorVisualSourceMethod(
    input.method ?? input.scene.visualSourceMethod,
  );
  if (method === "recommended") {
    return { method, decision: input.decision, preserveExisting: true, executable: true };
  }
  if (method === "upload") {
    return { method, decision: input.decision, preserveExisting: true, executable: true };
  }

  const treatment: CreatorProductionTreatment = method === "stock"
    ? stockTreatment(input.scene, input.decision)
    : method;
  const stockMediaType = treatment === "stock_video" ? "video" as const : "photo" as const;
  const decision: CreatorSceneProductionDecision = {
    ...input.decision,
    qualityTier: input.qualityMode,
    selectedTreatment: treatment,
    fallbackTreatments: [],
    stockIntent: method === "stock"
      ? {
          query: input.decision.signals.stockSearchQuery,
          mediaType: stockMediaType,
          orientation: input.decision.stockIntent?.orientation || "landscape",
          minimumWidth: stockMediaType === "video" ? 1280 : 1600,
          minimumHeight: stockMediaType === "video" ? 720 : 900,
          minimumDurationSeconds: stockMediaType === "video"
            ? Math.min(input.decision.videoIntent?.recommendedSeconds || 5, 5)
            : null,
        }
      : null,
    overrideState: treatment === "ai_video" ? "user_forced_video" : "user_forced_image",
    ...expectedEconomics(treatment, input.qualityMode),
  };
  return { method, decision, preserveExisting: false, executable: true };
}

export function resolveCreatorVisualSourceBatch(input: {
  scenes: CreatorVisualSourceScene[];
  decisions: CreatorSceneProductionDecision[];
  targetSceneIds: number[];
  qualityMode: CreatorQualityMode;
  batchMethod?: CreatorVisualSourceMethod;
}) {
  const targetIds = new Set(input.targetSceneIds);
  const decisions = new Map(input.decisions.map((decision) => [decision.sceneId, decision]));
  return input.scenes.flatMap((scene) => {
    if (!targetIds.has(scene.id)) return [];
    const decision = decisions.get(scene.id);
    if (!decision) return [];
    return [applyCreatorVisualSourceOverride({
      scene,
      decision,
      qualityMode: input.qualityMode,
      method: input.batchMethod,
    })];
  });
}
