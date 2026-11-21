import type { CreatorResolvedContinuityMode } from "./visualContinuity";

export const CREATOR_CONTINUITY_CONTRACT_VERSION = "creator-continuity-v1" as const;

export type CreatorContinuityFallbackRecommendation =
  | "none"
  | "bridge"
  | "establishing"
  | "broll"
  | "cutaway";

export type CreatorContinuityImpactType =
  | "order"
  | "visual"
  | "script"
  | "duration"
  | "deletion"
  | "framing";

export type CreatorContinuityStateField =
  | "charactersPresent"
  | "location"
  | "timeOfDay"
  | "lighting"
  | "wardrobe"
  | "props"
  | "productState"
  | "actionStart"
  | "actionEnd"
  | "screenDirection"
  | "cameraIntent"
  | "emotionalState";

export type CreatorProductionIdentity = {
  version: typeof CREATOR_CONTINUITY_CONTRACT_VERSION;
  characterAnchors: Array<{
    name: string;
    appearance?: string;
    wardrobe?: string;
    accessory?: string;
    role?: string;
  }>;
  visualStyle?: string;
  palette?: string;
  cameraLanguage?: string;
  productionUniverse?: string;
  consistencyRules?: string;
};

export type CreatorSceneContinuityState = {
  sceneId?: number;
  charactersPresent?: string[];
  location?: string;
  timeOfDay?: string;
  lighting?: string;
  wardrobe?: string[];
  props?: string[];
  productState?: string;
  actionStart?: string;
  actionEnd?: string;
  screenDirection?: string;
  cameraIntent?: string;
  emotionalState?: string;
  continuityNotes?: string[];
  explicitChanges?: CreatorContinuityStateField[];
};

export type CreatorTransitionContract = {
  version: typeof CREATOR_CONTINUITY_CONTRACT_VERSION;
  mode: CreatorResolvedContinuityMode;
  mustPreserve: string[];
  allowedChanges: string[];
  inheritedState: CreatorSceneContinuityState;
  explicitChanges: CreatorContinuityStateField[];
  continuityWarnings: string[];
  fallbackRecommendation: CreatorContinuityFallbackRecommendation;
};

export type CreatorContinuityGuardResult = {
  version: typeof CREATOR_CONTINUITY_CONTRACT_VERSION;
  status: "safe" | "review_recommended" | "repair_available";
  contradictions: string[];
  missingInformation: string[];
  contextAugmentations: string[];
};

export type CreatorGenerationContinuityContext = {
  version: typeof CREATOR_CONTINUITY_CONTRACT_VERSION;
  productionIdentity: CreatorProductionIdentity;
  previousState?: CreatorSceneContinuityState;
  currentState?: CreatorSceneContinuityState;
  nextState?: CreatorSceneContinuityState;
  transition: CreatorTransitionContract;
  guard: CreatorContinuityGuardResult;
};
