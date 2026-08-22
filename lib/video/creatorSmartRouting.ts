import { CREATOR_VIDEO_PROFILES, estimateCreatorVideoProfileCost, getCreatorProfileBilledDuration, type CreatorVideoProfile, type CreatorVideoProfileKey } from "./creatorProfiles.ts";
import { isProviderConfigured } from "../runtime/providerEnvironment.mjs";

export const CREATOR_VIDEO_ROUTING_POLICY = {
  proUpgrade: { productionPriority: 0.84, motionImportance: 0.78, continuityImportance: 0.72, visualImportance: 0.88 },
  cinematicVeoFast: { productionPriority: 0.82, motionImportance: 0.76, durationCompatibleSeconds: [7, 8] as const, materialReferenceCount: 2 },
  cinematicHero: { productionPriority: 0.94, visualImportance: 0.9, motionImportance: 0.85 },
} as const;

export type CreatorVideoRoutingIntent = {
  qualityTier: string; visualImportance: number; motionImportance: number; continuityImportance: number;
  productionPriority: number; recommendedSeconds: number; referenceAvailabilityCount: number;
  lastFrameAvailable: boolean; requestedRatio: string; sceneRole?: string;
};
export type CreatorVideoRuntimeContext = { runwayAvailable: boolean; veoAvailable: boolean; veoSmartRoutingEnabled: boolean; veoHeroStandardEnabled: boolean };
export type CreatorVideoRouteDecision = {
  selectedProfile: CreatorVideoProfile | null; requestedDurationSec: number; providerBilledDurationSec: number | null;
  estimatedProviderCostUsd: number | null; pricingVersion: string | null; reasonCodes: string[];
  fallbackProfiles: CreatorVideoProfileKey[]; capabilityMatch: boolean; routingConfidence: number;
};
const score = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));
const enabled = (value: unknown) => value === true || String(value || "").toLowerCase() === "true" || value === "1";
export function getCreatorVideoRuntimeContext(): CreatorVideoRuntimeContext {
  return { runwayAvailable: isProviderConfigured("runway"), veoAvailable: isProviderConfigured("veo"), veoSmartRoutingEnabled: enabled(process.env.VELTO_VEO_SMART_ROUTING_ENABLED), veoHeroStandardEnabled: enabled(process.env.VELTO_VEO_HERO_STANDARD_ENABLED) };
}
function capabilityFits(profile: CreatorVideoProfile, intent: CreatorVideoRoutingIntent) {
  if (!profile.supportedRatios.includes(intent.requestedRatio)) return false;
  if (intent.lastFrameAvailable && !profile.supportsLastFrame) return false;
  return true;
}
function available(profile: CreatorVideoProfile, context: CreatorVideoRuntimeContext) {
  if (!profile.autoRoutingEnabled) return false;
  if (profile.provider === "runway") return context.runwayAvailable;
  if (!context.veoAvailable || !context.veoSmartRoutingEnabled) return false;
  return profile.profileKey !== "cinematic_hero_motion" || context.veoHeroStandardEnabled;
}
export function selectCreatorVideoProfile(raw: CreatorVideoRoutingIntent, context: CreatorVideoRuntimeContext): CreatorVideoRouteDecision {
  const intent = { ...raw, visualImportance: score(raw.visualImportance), motionImportance: score(raw.motionImportance), continuityImportance: score(raw.continuityImportance), productionPriority: score(raw.productionPriority), referenceAvailabilityCount: Math.max(0, Math.floor(Number(raw.referenceAvailabilityCount) || 0)) };
  if (intent.qualityTier !== "pro" && intent.qualityTier !== "cinematic") return { selectedProfile: null, requestedDurationSec: Number(raw.recommendedSeconds) || 0, providerBilledDurationSec: null, estimatedProviderCostUsd: null, pricingVersion: null, reasonCodes: ["PAID_VIDEO_INELIGIBLE_TIER"], fallbackProfiles: [], capabilityMatch: false, routingConfidence: 1 };
  let keys: CreatorVideoProfileKey[];
  if (intent.qualityTier === "pro") {
    const p = CREATOR_VIDEO_ROUTING_POLICY.proUpgrade;
    const upgrade = intent.productionPriority >= p.productionPriority && (intent.motionImportance >= p.motionImportance || intent.continuityImportance >= p.continuityImportance || intent.visualImportance >= p.visualImportance);
    keys = upgrade ? ["pro_quality_motion", "pro_efficient_motion"] : ["pro_efficient_motion"];
  } else {
    const h = CREATOR_VIDEO_ROUTING_POLICY.cinematicHero;
    const hero = intent.productionPriority >= h.productionPriority && intent.visualImportance >= h.visualImportance && intent.motionImportance >= h.motionImportance && ["hook", "climax", "demonstration"].includes(String(intent.sceneRole || ""));
    const v = CREATOR_VIDEO_ROUTING_POLICY.cinematicVeoFast;
    const durationFitsFixedEight = v.durationCompatibleSeconds.includes(intent.recommendedSeconds as 7 | 8);
    const capabilityJustifiesDurationMismatch = intent.lastFrameAvailable || intent.referenceAvailabilityCount >= v.materialReferenceCount;
    const veoFit = intent.productionPriority >= v.productionPriority && intent.motionImportance >= v.motionImportance && (durationFitsFixedEight || capabilityJustifiesDurationMismatch);
    keys = hero ? ["cinematic_hero_motion", "cinematic_fast_motion", "cinematic_precision_motion", "pro_efficient_motion"] : veoFit ? ["cinematic_fast_motion", "cinematic_precision_motion", "pro_efficient_motion"] : ["cinematic_precision_motion", "cinematic_fast_motion", "pro_efficient_motion"];
  }
  const selected = keys.map((key) => CREATOR_VIDEO_PROFILES[key]).find((profile) => available(profile, context) && capabilityFits(profile, intent)) || null;
  if (!selected) return { selectedProfile: null, requestedDurationSec: intent.recommendedSeconds, providerBilledDurationSec: null, estimatedProviderCostUsd: null, pricingVersion: null, reasonCodes: ["NO_AVAILABLE_CAPABILITY_MATCH", "IMAGE_MOTION_FALLBACK"], fallbackProfiles: keys, capabilityMatch: false, routingConfidence: 0.5 };
  const billed = getCreatorProfileBilledDuration(selected, intent.recommendedSeconds);
  const cost = estimateCreatorVideoProfileCost(selected, billed);
  return { selectedProfile: selected, requestedDurationSec: intent.recommendedSeconds, providerBilledDurationSec: billed, estimatedProviderCostUsd: cost.providerCostUsd, pricingVersion: cost.pricingVersion, reasonCodes: [selected.profileKey === keys[0] ? "PRIMARY_POLICY_MATCH" : "PRE_DISPATCH_FALLBACK", selected.durationPolicy === "fixed_8_at_1080p" ? "VEO_1080P_FIXED_8_SECONDS" : "RUNWAY_TIMELINE_DURATION_FIT"], fallbackProfiles: keys.filter((key) => key !== selected.profileKey), capabilityMatch: true, routingConfidence: selected.profileKey === keys[0] ? 0.92 : 0.78 };
}
