import { getOperationCreditCost } from "../credits/operationPolicy.ts";
import { CREATOR_VIDEO_PROFILES, estimateCreatorVideoProfileCost, getCreatorProfileBilledDuration, type CreatorVideoProfileKey } from "../video/creatorProfiles.ts";
import { calculateElevenLabsCost, calculateOpenAIImageCost, calculateOpenAITextCost } from "./calculators.ts";
import { CREATOR_MARGIN_BENCHMARKS, type CreatorBenchmarkTier } from "./marginBenchmark.ts";

export const CREATOR_PACKAGE_VALIDATION_VERSION = "creator-package-validation-2026-08-22";
export type CreatorPackageScenarioKind = "stock_rich" | "typical" | "generation_heavy_p90" | "retry_stress";

export type CreatorPackageScenario = {
  kind: CreatorPackageScenarioKind;
  finishedMinutes: number;
  scenesPerFinishedMinute: number;
  stockReuseShare: number;
  aiImagesPerFinishedMinute: number;
  voiceOperationsPerFinishedMinute: number;
  dialogueVoiceOperationsPerFinishedMinute: number;
  voiceCharactersPerFinishedMinute: number;
  intelligenceInputTokensPerFinishedMinute: number;
  intelligenceOutputTokensPerFinishedMinute: number;
  exports: number;
  retryRate: number;
  videoProfiles: Partial<Record<CreatorVideoProfileKey, { clipsPerFinishedMinute: number; requestedSeconds: 5 | 7 | 8 | 10 }>>;
};

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const count = (perMinute: number, minutes: number) => Math.ceil(Math.max(0, perMinute) * Math.max(0, minutes));
const providerCost = (result: { providerCostUsd: number | null }) => { if (result.providerCostUsd === null) throw new Error("PACKAGE_SIMULATION_UNKNOWN_PROVIDER_COST"); return result.providerCostUsd; };

export function simulateCreatorPackageEconomics(input: { tier: CreatorBenchmarkTier; candidatePriceUsd?: number; scenario: CreatorPackageScenario }) {
  const { tier, scenario } = input; const benchmark = CREATOR_MARGIN_BENCHMARKS[tier]; const price = input.candidatePriceUsd ?? benchmark.benchmarkPriceUsd;
  const minutes = Math.max(0, scenario.finishedMinutes); const images = count(scenario.aiImagesPerFinishedMinute, minutes); const voices = count(scenario.voiceOperationsPerFinishedMinute, minutes); const dialogueVoices = count(scenario.dialogueVoiceOperationsPerFinishedMinute, minutes); const exports = Math.ceil(Math.max(0, scenario.exports));
  const imageCost = providerCost(calculateOpenAIImageCost("gpt-image-2", { textInputTokens: images * 250, imageOutputTokens: images * 3000 }));
  const voiceCost = providerCost(calculateElevenLabsCost("eleven_multilingual_v2", scenario.voiceCharactersPerFinishedMinute * minutes));
  const intelligenceCost = providerCost(calculateOpenAITextCost("gpt-5-mini", { inputTokens: scenario.intelligenceInputTokensPerFinishedMinute * minutes, cachedInputTokens: scenario.intelligenceInputTokensPerFinishedMinute * minutes * 0.2, outputTokens: scenario.intelligenceOutputTokensPerFinishedMinute * minutes }));
  let videoCost = 0, videos = 0, billedVideoSeconds = 0; const videoCostByProfile: Partial<Record<CreatorVideoProfileKey, number>> = {};
  for (const [key, mix] of Object.entries(scenario.videoProfiles) as [CreatorVideoProfileKey, NonNullable<CreatorPackageScenario["videoProfiles"][CreatorVideoProfileKey]>][]) {
    const profile = CREATOR_VIDEO_PROFILES[key];
    if (!profile.autoRoutingEnabled || profile.validationState === "candidate") throw new Error(`PACKAGE_SIMULATION_DISABLED_PROFILE:${key}`);
    if (!profile.productEligibility.includes(tier as "pro" | "cinematic")) throw new Error(`PACKAGE_SIMULATION_INELIGIBLE_PROFILE:${key}`);
    const clipCount = count(mix.clipsPerFinishedMinute, minutes); const billedDuration = getCreatorProfileBilledDuration(profile, mix.requestedSeconds); const cost = providerCost(estimateCreatorVideoProfileCost(profile, billedDuration)) * clipCount;
    videos += clipCount; billedVideoSeconds += billedDuration * clipCount; videoCost += cost; videoCostByProfile[key] = round(cost);
  }
  const retryMultiplier = 1 + Math.max(0, scenario.retryRate); const baseProviderCogs = imageCost + voiceCost + intelligenceCost + videoCost; const modeledProviderCogsUsd = round(baseProviderCogs * retryMultiplier); const videoCogsUsd = round(videoCost * retryMultiplier);
  const creditBurn = {
    images: images * getOperationCreditCost("creator_image", tier),
    voices: voices * getOperationCreditCost("creator_voice", tier),
    dialogueVoices: dialogueVoices * getOperationCreditCost("creator_dialogue_voice", tier),
    videos: videos * getOperationCreditCost("creator_video", tier),
    exports: exports * getOperationCreditCost("creator_export", tier),
  };
  const creditsRequired = Object.values(creditBurn).reduce((sum, value) => sum + value, 0); const p50Headroom = benchmark.p50CogsCeilingUsd - modeledProviderCogsUsd; const p90Headroom = benchmark.p90CogsCeilingUsd - modeledProviderCogsUsd; const stressHeadroom = benchmark.stressCogsCeilingUsd - modeledProviderCogsUsd;
  const dominantCreditConsumers = Object.entries(creditBurn).sort((a, b) => b[1] - a[1]).map(([operation, credits]) => ({ operation, credits })); const dominantProviderCosts = Object.entries({ video: videoCogsUsd, image: round(imageCost * retryMultiplier), voice: round(voiceCost * retryMultiplier), intelligence: round(intelligenceCost * retryMultiplier) }).sort((a, b) => b[1] - a[1]).map(([operation, costUsd]) => ({ operation, costUsd }));
  return {
    version: CREATOR_PACKAGE_VALIDATION_VERSION, tier, scenario: scenario.kind, candidatePriceUsd: price, finishedMinutes: minutes, scenesPerFinishedMinute: scenario.scenesPerFinishedMinute,
    counts: { images, voices, dialogueVoices, videos, exports }, creditBurn, creditsRequired, creditsPerFinishedMinute: round(creditsRequired / minutes), dominantCreditConsumers, billedVideoSeconds,
    providerCogs: { imageUsd: round(imageCost * retryMultiplier), voiceUsd: round(voiceCost * retryMultiplier), intelligenceUsd: round(intelligenceCost * retryMultiplier), videoUsd: videoCogsUsd, byVideoProfileUsd: videoCostByProfile, totalUsd: modeledProviderCogsUsd },
    retryProviderCogsUsd: round(baseProviderCogs * Math.max(0, scenario.retryRate)), dominantProviderCosts, providerCogsPerFinishedMinute: round(modeledProviderCogsUsd / minutes), salePricePerFinishedMinute: round(price / minutes),
    grossMarginEstimate: round((price - modeledProviderCogsUsd) / price), ceilings: { p50Usd: benchmark.p50CogsCeilingUsd, p90Usd: benchmark.p90CogsCeilingUsd, stressUsd: benchmark.stressCogsCeilingUsd },
    remainingUnpricedInfrastructureHeadroom: { atP50Usd: round(p50Headroom), atP90Usd: round(p90Headroom), atStressUsd: round(stressHeadroom) },
    status: modeledProviderCogsUsd <= benchmark.p50CogsCeilingUsd ? "p50_pass" as const : modeledProviderCogsUsd <= benchmark.p90CogsCeilingUsd ? "p90_pass" as const : modeledProviderCogsUsd <= benchmark.stressCogsCeilingUsd ? "stress_only" as const : "no_go" as const,
    infrastructureCostStatus: "unknown" as const,
  };
}

const scenario = (kind: CreatorPackageScenarioKind, tier: CreatorBenchmarkTier, overrides: Partial<CreatorPackageScenario>): CreatorPackageScenario => ({
  kind, finishedMinutes: CREATOR_MARGIN_BENCHMARKS[tier].normalizedFinishedMinutes, scenesPerFinishedMinute: 8, stockReuseShare: 0.6, aiImagesPerFinishedMinute: 1.5, voiceOperationsPerFinishedMinute: 8, dialogueVoiceOperationsPerFinishedMinute: 0, voiceCharactersPerFinishedMinute: 900, intelligenceInputTokensPerFinishedMinute: 3000, intelligenceOutputTokensPerFinishedMinute: 1000, exports: 4, retryRate: 0.05, videoProfiles: {}, ...overrides,
});

export const CREATOR_PACKAGE_SCENARIOS: Record<CreatorBenchmarkTier, Record<CreatorPackageScenarioKind, CreatorPackageScenario>> = {
  standard: {
    stock_rich: scenario("stock_rich", "standard", { stockReuseShare: 0.82, aiImagesPerFinishedMinute: 0.8, retryRate: 0.02 }),
    typical: scenario("typical", "standard", { stockReuseShare: 0.7 }),
    generation_heavy_p90: scenario("generation_heavy_p90", "standard", { stockReuseShare: 0.55, aiImagesPerFinishedMinute: 2.2, retryRate: 0.1 }),
    retry_stress: scenario("retry_stress", "standard", { scenesPerFinishedMinute: 10, stockReuseShare: 0.45, aiImagesPerFinishedMinute: 3, voiceOperationsPerFinishedMinute: 10, retryRate: 0.25 }),
  },
  pro: {
    stock_rich: scenario("stock_rich", "pro", { stockReuseShare: 0.72, aiImagesPerFinishedMinute: 1.5, videoProfiles: { pro_efficient_motion: { clipsPerFinishedMinute: 0.2, requestedSeconds: 7 } }, retryRate: 0.03, exports: 4 }),
    typical: scenario("typical", "pro", { stockReuseShare: 0.55, aiImagesPerFinishedMinute: 2.4, dialogueVoiceOperationsPerFinishedMinute: 0.2, videoProfiles: { pro_efficient_motion: { clipsPerFinishedMinute: 0.42, requestedSeconds: 7 }, pro_quality_motion: { clipsPerFinishedMinute: 0.08, requestedSeconds: 7 } }, exports: 4 }),
    generation_heavy_p90: scenario("generation_heavy_p90", "pro", { stockReuseShare: 0.4, aiImagesPerFinishedMinute: 2.8, dialogueVoiceOperationsPerFinishedMinute: 0.3, videoProfiles: { pro_efficient_motion: { clipsPerFinishedMinute: 0.48, requestedSeconds: 7 }, pro_quality_motion: { clipsPerFinishedMinute: 0.17, requestedSeconds: 7 } }, retryRate: 0.12, exports: 5 }),
    retry_stress: scenario("retry_stress", "pro", { scenesPerFinishedMinute: 10, stockReuseShare: 0.3, aiImagesPerFinishedMinute: 3.6, voiceOperationsPerFinishedMinute: 10, dialogueVoiceOperationsPerFinishedMinute: 0.4, videoProfiles: { pro_efficient_motion: { clipsPerFinishedMinute: 0.5, requestedSeconds: 7 }, pro_quality_motion: { clipsPerFinishedMinute: 0.3, requestedSeconds: 7 } }, retryRate: 0.3, exports: 6 }),
  },
  cinematic: {
    stock_rich: scenario("stock_rich", "cinematic", { stockReuseShare: 0.58, aiImagesPerFinishedMinute: 2, dialogueVoiceOperationsPerFinishedMinute: 0.3, videoProfiles: { cinematic_precision_motion: { clipsPerFinishedMinute: 0.35, requestedSeconds: 7 }, cinematic_fast_motion: { clipsPerFinishedMinute: 0.12, requestedSeconds: 7 } }, retryRate: 0.04, exports: 4 }),
    typical: scenario("typical", "cinematic", { stockReuseShare: 0.38, aiImagesPerFinishedMinute: 3, dialogueVoiceOperationsPerFinishedMinute: 0.5, videoProfiles: { cinematic_precision_motion: { clipsPerFinishedMinute: 0.55, requestedSeconds: 7 }, cinematic_fast_motion: { clipsPerFinishedMinute: 0.25, requestedSeconds: 7 }, cinematic_hero_motion: { clipsPerFinishedMinute: 0.015, requestedSeconds: 8 } }, exports: 4 }),
    generation_heavy_p90: scenario("generation_heavy_p90", "cinematic", { stockReuseShare: 0.25, aiImagesPerFinishedMinute: 4, dialogueVoiceOperationsPerFinishedMinute: 0.7, videoProfiles: { cinematic_precision_motion: { clipsPerFinishedMinute: 0.7, requestedSeconds: 7 }, cinematic_fast_motion: { clipsPerFinishedMinute: 0.42, requestedSeconds: 7 }, cinematic_hero_motion: { clipsPerFinishedMinute: 0.025, requestedSeconds: 8 } }, retryRate: 0.15, exports: 5 }),
    retry_stress: scenario("retry_stress", "cinematic", { scenesPerFinishedMinute: 10, stockReuseShare: 0.18, aiImagesPerFinishedMinute: 5, voiceOperationsPerFinishedMinute: 10, dialogueVoiceOperationsPerFinishedMinute: 1, videoProfiles: { cinematic_precision_motion: { clipsPerFinishedMinute: 0.8, requestedSeconds: 7 }, cinematic_fast_motion: { clipsPerFinishedMinute: 0.55, requestedSeconds: 7 }, cinematic_hero_motion: { clipsPerFinishedMinute: 0.04, requestedSeconds: 8 } }, retryRate: 0.3, exports: 6 }),
  },
};

export function validateCreatorPackage(tier: CreatorBenchmarkTier) {
  const simulations = Object.fromEntries(Object.entries(CREATOR_PACKAGE_SCENARIOS[tier]).map(([kind, manifest]) => [kind, simulateCreatorPackageEconomics({ tier, scenario: manifest })])) as Record<CreatorPackageScenarioKind, ReturnType<typeof simulateCreatorPackageEconomics>>;
  const typical = simulations.typical; const p90 = simulations.generation_heavy_p90; const stress = simulations.retry_stress; const candidateMonthlyCredits = Math.ceil(typical.creditsRequired * 1.15 / 100) * 100;
  const p90Headroom = p90.remainingUnpricedInfrastructureHeadroom.atP90Usd; const verdict = p90.providerCogs.totalUsd > p90.ceilings.p90Usd || p90Headroom < p90.candidatePriceUsd * 0.05 || candidateMonthlyCredits < typical.creditsRequired ? "NO_GO" as const : "CONDITIONAL_GO" as const;
  return { tier, candidateMonthlyCredits, indicativeFinishedMinutes: typical.finishedMinutes, remainingTypicalCredits: candidateMonthlyCredits - typical.creditsRequired, simulations, verdict, conditions: ["Infrastructure COGS remains unpriced.", "Perceptual output quality requires beta sample review."] };
}

export const INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT = {
  version: CREATOR_PACKAGE_VALIDATION_VERSION, visibility: "internal", lifecycle: "beta_candidate", billingTruth: false,
  tiers: {
    standard: { candidatePriceUsd: 59, candidateMonthlyCredits: validateCreatorPackage("standard").candidateMonthlyCredits, indicativeFinishedMinutes: 60, qualityIntent: "Professional stock-first production", validationStatus: "conditional_go" },
    pro: { candidatePriceUsd: 199, candidateMonthlyCredits: validateCreatorPackage("pro").candidateMonthlyCredits, indicativeFinishedMinutes: 90, qualityIntent: "Professional production with selective generative motion", validationStatus: "conditional_go" },
    cinematic: { candidatePriceUsd: 399, candidateMonthlyCredits: validateCreatorPackage("cinematic").candidateMonthlyCredits, indicativeFinishedMinutes: 60, qualityIntent: "Premium scene-level visual and motion production", validationStatus: "conditional_go_invitation_only" },
  },
} as const;

export const CREATOR_PACKAGE_QUALITY_FLOORS = {
  standard: ["semantic_scene_fit", "publishable_source_resolution", "appropriate_stock", "clear_narration", "audio_sync", "complete_export", "attribution_integrity", "no_placeholder_media"],
  pro: ["standard_floor", "selective_motion_relevance", "visual_coherence", "production_value_above_standard"],
  cinematic: ["pro_floor", "premium_motion_control", "continuity_when_required", "hero_scene_fidelity", "premium_value_above_pro"],
} as const;

export const CREATOR_PACKAGE_QUALITY_SCENARIOS = [
  { contentType: "real_world_documentary", expectedBehavior: "authentic_stock_first", suitableTiers: ["standard", "pro", "cinematic"], profileClass: "stock_or_selective_motion", qualityRationale: "Authenticity outranks synthetic coverage.", costRationale: "Reuse and stock avoid unnecessary generation." },
  { contentType: "product_business_explainer", expectedBehavior: "stock_interface_and_custom_visual_mix", suitableTiers: ["standard", "pro", "cinematic"], profileClass: "selective_professional_motion", qualityRationale: "Product clarity and semantic fit are primary.", costRationale: "Premium motion is reserved for demonstrations and hooks." },
  { contentType: "abstract_conceptual_video", expectedBehavior: "custom_visuals_with_selective_motion", suitableTiers: ["pro", "cinematic"], profileClass: "professional_or_premium_motion", qualityRationale: "Abstract concepts benefit from purpose-built visuals.", costRationale: "Still imagery and motion are mixed rather than generating every scene." },
  { contentType: "recurring_character_story", expectedBehavior: "continuity_sensitive_references", suitableTiers: ["cinematic"], profileClass: "premium_continuity", qualityRationale: "Reference continuity is a first-class requirement.", costRationale: "Higher-cost generation is justified only for continuity-sensitive scenes." },
  { contentType: "motion_heavy_hook", expectedBehavior: "high_value_motion", suitableTiers: ["pro", "cinematic"], profileClass: "selective_high_motion", qualityRationale: "Motion relevance materially affects the opening.", costRationale: "Spend is concentrated in a short high-value segment." },
  { contentType: "low_motion_educational", expectedBehavior: "reuse_stock_image_motion", suitableTiers: ["standard", "pro", "cinematic"], profileClass: "efficient_visual_support", qualityRationale: "Clarity and narration matter more than dense generation.", costRationale: "Paid video would add little production value." },
  { contentType: "stock_rich_travel", expectedBehavior: "authentic_stock_first", suitableTiers: ["standard", "pro", "cinematic"], profileClass: "stock", qualityRationale: "Real footage is often the strongest creative treatment.", costRationale: "Safe stock has non-billable provider COGS." },
  { contentType: "data_interface_scene", expectedBehavior: "interface_capture_or_custom_graphic", suitableTiers: ["standard", "pro", "cinematic"], profileClass: "static_or_controlled_motion", qualityRationale: "Legibility and factual fidelity outrank generative motion.", costRationale: "Avoids costly motion that can distort interfaces or data." },
  { contentType: "cinematic_transformation_hero", expectedBehavior: "explicit_hero_gated_motion", suitableTiers: ["cinematic"], profileClass: "exceptional_hero", qualityRationale: "A transformation can justify the highest controlled treatment.", costRationale: "Exceptional use prevents hero economics becoming the default." },
  { contentType: "long_form_mixed_project", expectedBehavior: "scene_level_mixed_treatments", suitableTiers: ["standard", "pro", "cinematic"], profileClass: "mixed_by_scene_value", qualityRationale: "Treatment follows each scene rather than a project-wide percentage.", costRationale: "Reuse, stock, imagery, and selective motion balance quality and spend." },
] as const;
