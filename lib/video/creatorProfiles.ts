import { calculateRunwayCost, calculateVeoCost } from "../economics/calculators.ts";
import type { EconomicCostResult } from "../economics/types.ts";
import type { VideoProviderKey, VideoProviderRuntimeProfile } from "./providers/types";

export const CREATOR_VIDEO_ROUTING_PRICING_VERSION = "creator-video-routing-2026-08-22";
export const CREATOR_VIDEO_ROUTING_PRICING_AS_OF = "2026-08-22";

export type CreatorVideoProfileKey =
  | "pro_efficient_motion"
  | "pro_quality_motion"
  | "cinematic_precision_motion"
  | "cinematic_fast_motion"
  | "cinematic_hero_motion"
  | "veo_lite_candidate"
  | "seedance2_candidate";
export type CreatorVideoValidationState = "baseline" | "enabled" | "candidate" | "hero_gated";

export type CreatorVideoProfile = VideoProviderRuntimeProfile & {
  profileKey: CreatorVideoProfileKey;
  provider: VideoProviderKey;
  qualityClass: string;
  productEligibility: readonly ("pro" | "cinematic")[];
  supportedInputMode: "image_to_video";
  supportsFirstFrame: boolean;
  supportsLastFrame: boolean;
  supportsReferenceImages: boolean;
  maximumReferenceImages: number;
  supportedRatios: readonly string[];
  supportedDurations: readonly number[];
  durationPolicy: "normalized_5_7_10" | "fixed_8_at_1080p";
  autoRoutingEnabled: boolean;
  activationRequirement: "runway_configured" | "veo_smart_enabled" | "veo_hero_enabled" | "manual_only";
  validationState: CreatorVideoValidationState;
};

const runwayRatios = ["1280:720", "720:1280", "1104:832", "960:960", "832:1104", "1584:672"] as const;
const veoRatios = ["16:9", "9:16", "1280:720", "720:1280"] as const;

export const CREATOR_VIDEO_PROFILES: Record<CreatorVideoProfileKey, CreatorVideoProfile> = {
  pro_efficient_motion: { profileKey: "pro_efficient_motion", provider: "runway", model: "gen4_turbo", qualityClass: "professional-efficient", productEligibility: ["pro"], resolution: "ratio_defined", audioMode: "no_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: false, supportsReferenceImages: false, maximumReferenceImages: 0, supportedRatios: runwayRatios, supportedDurations: [5, 7, 10], durationPolicy: "normalized_5_7_10", autoRoutingEnabled: true, activationRequirement: "runway_configured", validationState: "baseline" },
  pro_quality_motion: { profileKey: "pro_quality_motion", provider: "runway", model: "gen4.5", qualityClass: "professional-high", productEligibility: ["pro"], resolution: "ratio_defined", audioMode: "no_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: false, supportsReferenceImages: false, maximumReferenceImages: 0, supportedRatios: runwayRatios, supportedDurations: [5, 7, 10], durationPolicy: "normalized_5_7_10", autoRoutingEnabled: true, activationRequirement: "runway_configured", validationState: "enabled" },
  cinematic_precision_motion: { profileKey: "cinematic_precision_motion", provider: "runway", model: "gen4.5", qualityClass: "premium-controlled", productEligibility: ["cinematic"], resolution: "ratio_defined", audioMode: "no_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: false, supportsReferenceImages: false, maximumReferenceImages: 0, supportedRatios: runwayRatios, supportedDurations: [5, 7, 10], durationPolicy: "normalized_5_7_10", autoRoutingEnabled: true, activationRequirement: "runway_configured", validationState: "enabled" },
  cinematic_fast_motion: { profileKey: "cinematic_fast_motion", provider: "veo", model: "veo-3.1-fast-generate-preview", qualityClass: "premium-fast", productEligibility: ["cinematic"], resolution: "1080p", audioMode: "generated_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: true, supportsReferenceImages: true, maximumReferenceImages: 3, supportedRatios: veoRatios, supportedDurations: [8], durationPolicy: "fixed_8_at_1080p", autoRoutingEnabled: true, activationRequirement: "veo_smart_enabled", validationState: "enabled" },
  cinematic_hero_motion: { profileKey: "cinematic_hero_motion", provider: "veo", model: "veo-3.1-generate-preview", qualityClass: "hero-premium", productEligibility: ["cinematic"], resolution: "1080p", audioMode: "generated_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: true, supportsReferenceImages: true, maximumReferenceImages: 3, supportedRatios: veoRatios, supportedDurations: [8], durationPolicy: "fixed_8_at_1080p", autoRoutingEnabled: true, activationRequirement: "veo_hero_enabled", validationState: "hero_gated" },
  veo_lite_candidate: { profileKey: "veo_lite_candidate", provider: "veo", model: "veo-3.1-lite-generate-preview", qualityClass: "candidate", productEligibility: ["cinematic"], resolution: "1080p", audioMode: "generated_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: true, supportsReferenceImages: true, maximumReferenceImages: 3, supportedRatios: veoRatios, supportedDurations: [8], durationPolicy: "fixed_8_at_1080p", autoRoutingEnabled: false, activationRequirement: "manual_only", validationState: "candidate" },
  seedance2_candidate: { profileKey: "seedance2_candidate", provider: "runway", model: "seedance2", qualityClass: "candidate", productEligibility: ["cinematic"], resolution: "1080p", audioMode: "no_audio", supportedInputMode: "image_to_video", supportsFirstFrame: true, supportsLastFrame: false, supportsReferenceImages: false, maximumReferenceImages: 0, supportedRatios: runwayRatios, supportedDurations: [5, 7, 10], durationPolicy: "normalized_5_7_10", autoRoutingEnabled: false, activationRequirement: "manual_only", validationState: "candidate" },
};

export function getCreatorVideoProfile(key: CreatorVideoProfileKey) { return CREATOR_VIDEO_PROFILES[key]; }
export function getCreatorProfileBilledDuration(profile: CreatorVideoProfile, requested: unknown) {
  if (profile.durationPolicy === "fixed_8_at_1080p") return 8;
  const seconds = Math.max(0, Number(requested) || 0);
  return seconds <= 5 ? 5 : seconds <= 7 ? 7 : 10;
}
export function estimateCreatorVideoProfileCost(profile: CreatorVideoProfile, billedSeconds: number): EconomicCostResult {
  return profile.provider === "runway"
    ? calculateRunwayCost(profile.model, billedSeconds, profile.resolution)
    : calculateVeoCost(profile.model, profile.resolution, billedSeconds);
}
