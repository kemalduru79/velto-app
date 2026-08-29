import type { CreatorQualityMode } from "./mediaRouting";
import type { TimelineScenePlan } from "../video/timelineSync";
import type { StockMediaCandidate, StockMediaType, StockOrientation } from "../providers/stock/types";

export type CreatorProductionTreatment =
  | "reuse_existing"
  | "stock_photo"
  | "stock_video"
  | "ai_image"
  | "image_motion"
  | "ai_video"
  | "source_clip"
  | "source_image"
  | "data_visual"
  | "quote_card"
  | "source_card";

/**
 * Canonical documentary-production treatment taxonomy. H-4A exposes these
 * treatments without changing the legacy automatic routing policy; the five
 * evidence/source-aware treatments become routable in later H-4 slices.
 */
export const CREATOR_PRODUCTION_TREATMENTS: readonly CreatorProductionTreatment[] = [
  "reuse_existing",
  "stock_photo",
  "stock_video",
  "ai_image",
  "image_motion",
  "ai_video",
  "source_clip",
  "source_image",
  "data_visual",
  "quote_card",
  "source_card",
] as const;

export type CreatorSceneRole = "hook" | "exposition" | "demonstration" | "evidence" | "emotion" | "transition" | "climax" | "call_to_action" | "other";
export type CreatorContentNature = "real_world" | "person" | "product" | "location" | "process" | "abstract" | "data" | "interface" | "conceptual" | "mixed";
export type CreatorProductionSignals = { sceneRole: CreatorSceneRole; contentNature: CreatorContentNature; motionImportance: number; visualImportance: number; continuityImportance: number; stockSuitability: number; customGenerationNeed: number; authenticityValue: number; stockSearchQuery: string };
export type CreatorSceneProductionDecision = {
  sceneId: number; creatorSceneId: string | null; qualityTier: CreatorQualityMode; selectedTreatment: CreatorProductionTreatment; fallbackTreatments: CreatorProductionTreatment[];
  signals: CreatorProductionSignals; scores: Record<CreatorProductionTreatment, number>; confidence: number; reasonCodes: string[]; explanation: string;
  stockIntent: { query: string; mediaType: StockMediaType; orientation: StockOrientation; minimumWidth: number; minimumHeight: number; minimumDurationSeconds: number | null } | null;
  videoIntent: { visualImportance: number; motionImportance: number; continuityImportance: number; sceneRole: CreatorSceneRole; recommendedSeconds: 5 | 7 | 10; qualityIntent: "professional" | "premium"; referenceAvailabilityCount: number; fallbackTreatment: CreatorProductionTreatment; productionPriority: number } | null;
  overrideState: "automatic" | "user_forced_image" | "user_forced_video" | "existing_asset_preserved";
  expectedPaidGeneration: boolean; expectedCreditOperation: "none" | "image" | "video"; providerCostCategory: "not_billable" | "known_estimate" | "unknown";
};

export type CreatorProductionSceneInput = Partial<CreatorProductionSignals> & { id: number; creatorSceneId?: string; text?: string; narration?: string; dialogue?: string; visualPrompt?: string; cameraDirection?: string; motionHint?: string; renderMode?: "image" | "video"; image?: string; videoUrl?: string; videoStatus?: string; videoCurrent?: boolean; imageCurrent?: boolean; assetPreserved?: boolean; referenceAvailabilityCount?: number; timeline?: TimelineScenePlan | null; orientation?: StockOrientation };
const routedTreatments: CreatorProductionTreatment[] = ["reuse_existing", "stock_photo", "stock_video", "ai_image", "image_motion", "ai_video"];
const clamp = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;
const words = (text: string, pattern: RegExp) => (text.match(pattern) || []).length;
const cleanQuery = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 100).toLocaleLowerCase("en-US");
const sceneRoles = new Set<CreatorSceneRole>(["hook", "exposition", "demonstration", "evidence", "emotion", "transition", "climax", "call_to_action", "other"]);
const contentNatures = new Set<CreatorContentNature>(["real_world", "person", "product", "location", "process", "abstract", "data", "interface", "conceptual", "mixed"]);

export function inferCreatorProductionSignals(scene: CreatorProductionSceneInput): CreatorProductionSignals {
  const text = [scene.text, scene.narration, scene.dialogue, scene.visualPrompt, scene.cameraDirection, scene.motionHint].filter(Boolean).join(" ").toLocaleLowerCase("en-US");
  const strongMotion = words(text, /\b(run|jump|chase|race|dance|fight|explode|transform|crash|fly|sprint|pour|cut|build|koş|zıpla|kovala|yarış|dans|dövüş|patla|dönüş|inşa)\w*/g);
  const real = words(text, /\b(city|street|office|factory|nature|mountain|beach|restaurant|travel|building|landscape|şehir|sokak|ofis|fabrika|doğa|dağ|sahil|seyahat)\b/g);
  const abstract = words(text, /\b(idea|concept|future|mind|dream|metaphor|data|chart|interface|screen|fikir|kavram|gelecek|zihin|veri|grafik|arayüz)\b/g);
  const character = words(text, /\b(character|hero|fictional|same person|recurring|persona|karakter|kahraman|kurgusal|aynı kişi)\b/g) + (scene.dialogue?.trim() ? 1 : 0);
  const product = words(text, /\b(product|brand|logo|app|dashboard|device|ürün|marka|logo|uygulama|panel|cihaz)\b/g);
  const role: CreatorSceneRole = sceneRoles.has(scene.sceneRole as CreatorSceneRole) ? scene.sceneRole as CreatorSceneRole : (words(text, /\b(call to action|subscribe|follow|buy|learn more|abone|takip|satın al)\b/g) ? "call_to_action" : strongMotion >= 2 ? "demonstration" : words(text, /\b(proof|evidence|result|kanıt|sonuç)\b/g) ? "evidence" : "exposition");
  const nature: CreatorContentNature = contentNatures.has(scene.contentNature as CreatorContentNature) ? scene.contentNature as CreatorContentNature : (abstract ? (words(text, /\b(data|chart|interface|screen|veri|grafik|arayüz)\b/g) ? "data" : "abstract") : character ? "person" : product ? "product" : real ? "real_world" : "mixed");
  const motion = clamp(scene.motionImportance, Math.min(1, 0.12 + strongMotion * 0.22 + (scene.timeline?.visualAction === "split_scene" ? 0.2 : 0)));
  const continuity = clamp(scene.continuityImportance, Math.min(1, 0.12 + character * 0.28));
  const stock = clamp(scene.stockSuitability, Math.min(1, 0.18 + real * 0.2 + (nature === "real_world" || nature === "location" ? 0.3 : 0) - character * 0.25 - abstract * 0.12 - product * 0.12));
  const custom = clamp(scene.customGenerationNeed, Math.min(1, 0.18 + abstract * 0.2 + character * 0.24 + product * 0.1));
  const authenticity = clamp(scene.authenticityValue, Math.min(1, 0.2 + real * 0.2 + (nature === "real_world" ? 0.25 : 0)));
  return { sceneRole: role, contentNature: nature, motionImportance: motion, visualImportance: clamp(scene.visualImportance, role === "hook" || role === "climax" ? 0.9 : 0.65), continuityImportance: continuity, stockSuitability: stock, customGenerationNeed: custom, authenticityValue: authenticity, stockSearchQuery: cleanQuery(scene.stockSearchQuery || scene.visualPrompt || scene.text || scene.narration || "scene") };
}

export function planCreatorSceneProduction(scene: CreatorProductionSceneInput, qualityTier: CreatorQualityMode): CreatorSceneProductionDecision {
  const signals = inferCreatorProductionSignals(scene); const currentVideo = Boolean(scene.videoUrl && scene.videoStatus === "done" && scene.videoCurrent !== false); const currentImage = Boolean(scene.image && scene.imageCurrent !== false); const usableExisting = scene.assetPreserved === true || currentVideo || currentImage;
  const reuseScore = currentVideo ? 0.99 : scene.assetPreserved ? 0.98 : currentImage ? 0.72 + (1 - signals.motionImportance) * 0.2 : 0.02;
  const scores: Record<CreatorProductionTreatment, number> = {
    reuse_existing: reuseScore,
    stock_photo: 0.18 + signals.stockSuitability * 0.52 + signals.authenticityValue * 0.2 - signals.motionImportance * 0.2 - signals.continuityImportance * 0.28,
    stock_video: 0.12 + signals.stockSuitability * 0.44 + signals.authenticityValue * 0.22 + signals.motionImportance * 0.25 - signals.continuityImportance * 0.3,
    ai_image: 0.28 + signals.customGenerationNeed * 0.42 + signals.continuityImportance * 0.28 - signals.motionImportance * 0.12,
    image_motion: 0.3 + signals.visualImportance * 0.2 + signals.continuityImportance * 0.2 + (1 - Math.abs(signals.motionImportance - 0.42)) * 0.2,
    ai_video: 0.08 + signals.motionImportance * 0.5 + signals.visualImportance * 0.22 + (signals.sceneRole === "climax" || signals.sceneRole === "demonstration" ? 0.12 : 0) + (signals.motionImportance > 0.82 && signals.visualImportance > 0.8 ? 0.18 : 0) - signals.stockSuitability * signals.authenticityValue * 0.18 - signals.continuityImportance * 0.08,
    source_clip: 0,
    source_image: 0,
    data_visual: 0,
    quote_card: 0,
    source_card: 0,
  };
  if (qualityTier === "draft") for (const treatment of routedTreatments) scores[treatment] = treatment === "reuse_existing" && usableExisting ? 1 : treatment === "ai_image" ? 0.2 : 0;
  if (qualityTier === "standard") scores.ai_video = -1;
  if (qualityTier === "pro") scores.ai_video -= 0.08;
  if (qualityTier === "cinematic") scores.ai_video += signals.motionImportance * 0.08;
  let overrideState: CreatorSceneProductionDecision["overrideState"] = "automatic";
  let selectedTreatment: CreatorProductionTreatment;
  if (scene.assetPreserved && usableExisting) { selectedTreatment = "reuse_existing"; overrideState = "existing_asset_preserved"; }
  else if (scene.renderMode === "image") { selectedTreatment = currentImage ? "reuse_existing" : signals.motionImportance > 0.28 ? "image_motion" : "ai_image"; overrideState = "user_forced_image"; }
  else if (scene.renderMode === "video") { selectedTreatment = qualityTier === "pro" || qualityTier === "cinematic" ? (currentVideo ? "reuse_existing" : "ai_video") : (currentImage ? "reuse_existing" : "image_motion"); overrideState = "user_forced_video"; }
  else selectedTreatment = routedTreatments.reduce((best, item) => scores[item] > scores[best] ? item : best, qualityTier === "draft" ? "ai_image" : "image_motion");
  if (qualityTier === "draft" && !usableExisting) selectedTreatment = "ai_image";
  const ranked = routedTreatments.filter((item) => item !== selectedTreatment && !(qualityTier === "standard" && item === "ai_video")).sort((a,b) => scores[b]-scores[a]);
  const reasonCodes = selectedTreatment === "reuse_existing" ? ["CURRENT_ASSET_VALID"] : selectedTreatment.startsWith("stock") ? ["AUTHENTIC_REAL_WORLD_MATCH", signals.motionImportance > 0.45 ? "NATURAL_MOTION_VALUE" : "STATIC_STOCK_FIT"] : selectedTreatment === "ai_video" ? ["MOTION_MATERIALLY_IMPROVES_SCENE", "HIGH_PRODUCTION_VALUE"] : signals.continuityImportance > 0.55 ? ["CUSTOM_CONTINUITY_REQUIRED"] : signals.contentNature === "abstract" || signals.contentNature === "conceptual" ? ["CUSTOM_CONCEPTUAL_VISUAL"] : ["CONTROLLED_VISUAL_TREATMENT"];
  const explanation = selectedTreatment === "reuse_existing" ? "The current scene asset remains valid and avoids unnecessary regeneration." : selectedTreatment === "stock_video" ? "Authentic real-world footage fits this scene better than generated motion." : selectedTreatment === "stock_photo" ? "A production-quality real-world still is a strong fit for this scene." : selectedTreatment === "ai_video" ? "Motion is important to communicate the action and production value." : selectedTreatment === "image_motion" ? "A controlled still with subtle motion communicates the scene well." : "Custom visual control is more important than stock availability.";
  const recommendedSeconds = scene.timeline?.recommendedClipSeconds || (signals.motionImportance > 0.8 ? 10 : signals.motionImportance > 0.55 ? 7 : 5);
  const selectedScore = scores[selectedTreatment]; const second = scores[ranked[0]];
  return { sceneId: scene.id, creatorSceneId: scene.creatorSceneId || null, qualityTier, selectedTreatment, fallbackTreatments: ranked.slice(0, 2), signals, scores: Object.fromEntries(CREATOR_PRODUCTION_TREATMENTS.map((key) => [key, Math.round(Math.max(0, Math.min(1, scores[key])) * 1000) / 1000])) as Record<CreatorProductionTreatment, number>, confidence: Math.round(Math.max(0.5, Math.min(0.98, 0.62 + (selectedScore-second)*0.5))*100)/100, reasonCodes, explanation,
    stockIntent: selectedTreatment === "stock_photo" || selectedTreatment === "stock_video" ? { query: signals.stockSearchQuery, mediaType: selectedTreatment === "stock_video" ? "video" : "photo", orientation: scene.orientation || "landscape", minimumWidth: selectedTreatment === "stock_video" ? 1280 : 1600, minimumHeight: selectedTreatment === "stock_video" ? 720 : 900, minimumDurationSeconds: selectedTreatment === "stock_video" ? Math.min(recommendedSeconds, 5) : null } : null,
    videoIntent: selectedTreatment === "ai_video" ? { visualImportance: signals.visualImportance, motionImportance: signals.motionImportance, continuityImportance: signals.continuityImportance, sceneRole: signals.sceneRole, recommendedSeconds, qualityIntent: qualityTier === "cinematic" ? "premium" : "professional", referenceAvailabilityCount: Math.max(0, Number(scene.referenceAvailabilityCount || (currentImage ? 1 : 0))), fallbackTreatment: ranked.find((item) => item !== "ai_video") || "image_motion", productionPriority: Math.round((signals.visualImportance*0.45+signals.motionImportance*0.55)*100)/100 } : null,
    overrideState, expectedPaidGeneration: qualityTier !== "draft" && (selectedTreatment === "ai_image" || selectedTreatment === "image_motion" || selectedTreatment === "ai_video"), expectedCreditOperation: qualityTier === "draft" ? "none" : selectedTreatment === "ai_video" ? "video" : selectedTreatment === "ai_image" || selectedTreatment === "image_motion" ? "image" : "none", providerCostCategory: qualityTier === "draft" || selectedTreatment.startsWith("stock") || selectedTreatment === "reuse_existing" ? "not_billable" : "known_estimate" };
}

export function planCreatorProjectProduction(scenes: CreatorProductionSceneInput[], qualityTier: CreatorQualityMode) { return scenes.map((scene) => planCreatorSceneProduction(scene, qualityTier)); }

export function rankStockCandidates(decision: CreatorSceneProductionDecision, candidates: StockMediaCandidate[]) {
  const intent = decision.stockIntent; if (!intent) return [];
  return candidates.map((candidate, index) => { const rendition = candidate.renditions.find((item) => item.quality === "production" && item.width >= intent.minimumWidth && item.height >= intent.minimumHeight); const durationFit = candidate.mediaType !== "video" || (candidate.durationSeconds || 0) >= (intent.minimumDurationSeconds || 0); const accepted = candidate.mediaType === intent.mediaType && candidate.orientation === intent.orientation && Boolean(rendition) && durationFit; return { candidate, rendition, accepted, score: accepted ? 1-index/Math.max(100,candidates.length)+(candidate.mediaType === "video" && candidate.durationSeconds && decision.videoIntent ? Math.max(0, 0.08-Math.abs(candidate.durationSeconds-decision.videoIntent.recommendedSeconds)*0.01) : 0) : -1 }; }).filter((item) => item.accepted).sort((a,b) => b.score-a.score);
}

export const CREATOR_PRODUCTION_TREATMENT_LABELS: Record<CreatorProductionTreatment, { en: string; tr: string }> = {
  reuse_existing: { en: "Existing asset", tr: "Mevcut varlık" },
  stock_photo: { en: "Stock photo", tr: "Stok fotoğraf" },
  stock_video: { en: "Stock footage", tr: "Stok görüntü" },
  ai_image: { en: "AI visual", tr: "AI görsel" },
  image_motion: { en: "Image motion", tr: "Görsel hareketi" },
  ai_video: { en: "Generative motion", tr: "Üretken hareket" },
  source_clip: { en: "Source clip", tr: "Kaynak klibi" },
  source_image: { en: "Source image", tr: "Kaynak görsel" },
  data_visual: { en: "Data visual", tr: "Veri görseli" },
  quote_card: { en: "Quote card", tr: "Alıntı kartı" },
  source_card: { en: "Source card", tr: "Kaynak kartı" },
};
