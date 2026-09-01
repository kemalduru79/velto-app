import { calculateElevenLabsCost, calculateOpenAIImageCost, calculateOpenAITextCost } from "./calculators.ts";
import { CREATOR_MARGIN_BENCHMARKS, type CreatorBenchmarkTier } from "./marginBenchmark.ts";
import { CREATOR_VIDEO_PROFILES, estimateCreatorVideoProfileCost, getCreatorProfileBilledDuration, type CreatorVideoProfileKey } from "../video/creatorProfiles.ts";

export const CREATOR_SCALE_ENVELOPE_VERSION = "creator-scale-envelope-2026-09-01";
export const CREATOR_TARGET_GROSS_MARGIN = 0.65;
export const CREATOR_P90_GROSS_MARGIN_WARNING_FLOOR = 0.6;

export type ScaleEvidenceClass = "measured" | "modeled" | "unknown";
export type ScaleHealth = "GREEN" | "AMBER" | "RED";
export type CreatorScaleWorkload = {
  key: "light_creator" | "regular_creator" | "power_creator";
  label: string;
  evidence: "modeled";
  tier: CreatorBenchmarkTier;
  monthlyRevenueUsd: number;
  projects: number;
  scenesPerProject: number;
  finishedMinutes: number;
  researchRuns: number;
  aiImages: number;
  videoMix: Partial<Record<CreatorVideoProfileKey, { clips: number; requestedSeconds: 5 | 7 | 8 | 10 }>>;
  voiceMinutes: number;
  uploads: number;
  stockImports: number;
  finalExports: number;
  creatorPackageExports: number;
  storageGb: number;
  egressGb: number;
  retryRate: number;
};

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const requireNonNegative = (label: string, value: number) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_SCALE_INPUT:${label}`);
  return value;
};
const requirePositive = (label: string, value: number) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`INVALID_SCALE_INPUT:${label}`);
  return value;
};
const providerCost = (result: { providerCostUsd: number | null }) => {
  if (result.providerCostUsd === null) throw new Error("SCALE_ENVELOPE_UNKNOWN_PROVIDER_COST");
  return result.providerCostUsd;
};

export const CREATOR_NORMALIZED_WORKLOADS: readonly CreatorScaleWorkload[] = [
  { key: "light_creator", label: "Light Creator", evidence: "modeled", tier: "standard", monthlyRevenueUsd: 59, projects: 2, scenesPerProject: 8, finishedMinutes: 4, researchRuns: 2, aiImages: 4, videoMix: {}, voiceMinutes: 4, uploads: 2, stockImports: 4, finalExports: 2, creatorPackageExports: 2, storageGb: 0.25, egressGb: 1, retryRate: 0.05 },
  { key: "regular_creator", label: "Regular Creator", evidence: "modeled", tier: "pro", monthlyRevenueUsd: 199, projects: 6, scenesPerProject: 10, finishedMinutes: 24, researchRuns: 6, aiImages: 30, videoMix: { pro_efficient_motion: { clips: 6, requestedSeconds: 7 } }, voiceMinutes: 24, uploads: 8, stockImports: 20, finalExports: 6, creatorPackageExports: 6, storageGb: 1.5, egressGb: 5, retryRate: 0.08 },
  { key: "power_creator", label: "Power Creator", evidence: "modeled", tier: "cinematic", monthlyRevenueUsd: 399, projects: 12, scenesPerProject: 12, finishedMinutes: 72, researchRuns: 12, aiImages: 100, videoMix: { cinematic_precision_motion: { clips: 26, requestedSeconds: 7 }, cinematic_fast_motion: { clips: 9, requestedSeconds: 8 }, cinematic_hero_motion: { clips: 1, requestedSeconds: 8 } }, voiceMinutes: 72, uploads: 20, stockImports: 40, finalExports: 12, creatorPackageExports: 12, storageGb: 6, egressGb: 25, retryRate: 0.12 },
] as const;

export function calculateCreatorScaleWorkload(workload: CreatorScaleWorkload) {
  for (const [key, value] of Object.entries(workload)) if (typeof value === "number") requireNonNegative(key, value);
  requirePositive("monthlyRevenueUsd", workload.monthlyRevenueUsd);
  requirePositive("projects", workload.projects);
  requirePositive("finishedMinutes", workload.finishedMinutes);
  const imageUsd = providerCost(calculateOpenAIImageCost("gpt-image-2", { textInputTokens: workload.aiImages * 250, imageOutputTokens: workload.aiImages * 3_000 }));
  const voiceUsd = providerCost(calculateElevenLabsCost("eleven_multilingual_v2", workload.voiceMinutes * 900));
  const intelligenceUsd = providerCost(calculateOpenAITextCost("gpt-5-mini", { inputTokens: workload.researchRuns * 6_000, cachedInputTokens: workload.researchRuns * 1_200, outputTokens: workload.researchRuns * 1_500 }));
  let videoUsd = 0;
  let generatedVideoSeconds = 0;
  for (const [profileKey, mix] of Object.entries(workload.videoMix) as [CreatorVideoProfileKey, { clips: number; requestedSeconds: 5 | 7 | 8 | 10 }][]) {
    requireNonNegative(`${profileKey}.clips`, mix.clips);
    const profile = CREATOR_VIDEO_PROFILES[profileKey];
    if (!profile.autoRoutingEnabled || !profile.productEligibility.includes(workload.tier as "pro" | "cinematic")) throw new Error(`INVALID_SCALE_VIDEO_PROFILE:${profileKey}`);
    const seconds = getCreatorProfileBilledDuration(profile, mix.requestedSeconds) * mix.clips;
    videoUsd += providerCost(estimateCreatorVideoProfileCost(profile, seconds));
    generatedVideoSeconds += seconds;
  }
  const retryMultiplier = 1 + workload.retryRate;
  const providerCogsUsd = round((imageUsd + voiceUsd + intelligenceUsd + videoUsd) * retryMultiplier);
  const providerGrossMargin = round((workload.monthlyRevenueUsd - providerCogsUsd) / workload.monthlyRevenueUsd);
  return {
    ...workload,
    totalScenes: workload.projects * workload.scenesPerProject,
    generatedVideoSeconds,
    knownProviderCogs: { imageUsd: round(imageUsd * retryMultiplier), voiceUsd: round(voiceUsd * retryMultiplier), intelligenceUsd: round(intelligenceUsd * retryMultiplier), videoUsd: round(videoUsd * retryMultiplier), totalUsd: providerCogsUsd },
    infrastructureCostUsd: null,
    infrastructureCostStatus: "deployment-plan pricing verification required" as const,
    totalMonthlyCogsUsd: null,
    knownCogsPerProjectUsd: round(providerCogsUsd / workload.projects),
    knownCogsPerFinishedMinuteUsd: round(providerCogsUsd / workload.finishedMinutes),
    providerGrossMargin,
    grossMarginStatus: providerGrossMargin >= CREATOR_TARGET_GROSS_MARGIN ? "GREEN" as const : providerGrossMargin >= CREATOR_P90_GROSS_MARGIN_WARNING_FLOOR ? "AMBER" as const : "RED" as const,
    grossMarginProvisional: true,
    benchmark: CREATOR_MARGIN_BENCHMARKS[workload.tier],
  };
}

export function calculateSmallBetaCohort() {
  const composition = { light_creator: 2, regular_creator: 2, power_creator: 1 } as const;
  const members = CREATOR_NORMALIZED_WORKLOADS.map((workload) => ({ result: calculateCreatorScaleWorkload(workload), users: composition[workload.key] }));
  const sum = (select: (entry: typeof members[number]["result"]) => number) => round(members.reduce((total, entry) => total + select(entry.result) * entry.users, 0));
  const revenueUsd = sum((entry) => entry.monthlyRevenueUsd);
  const knownProviderCogsUsd = sum((entry) => entry.knownProviderCogs.totalUsd);
  const providerGrossMargin = round((revenueUsd - knownProviderCogsUsd) / revenueUsd);
  return { key: "small_beta_cohort" as const, label: "Small Beta Cohort", evidence: "modeled" as const, users: 5, composition, projects: sum((entry) => entry.projects), scenes: sum((entry) => entry.totalScenes), finishedMinutes: sum((entry) => entry.finishedMinutes), researchRuns: sum((entry) => entry.researchRuns), aiImages: sum((entry) => entry.aiImages), generatedVideoSeconds: sum((entry) => entry.generatedVideoSeconds), voiceMinutes: sum((entry) => entry.voiceMinutes), uploads: sum((entry) => entry.uploads), stockImports: sum((entry) => entry.stockImports), finalExports: sum((entry) => entry.finalExports), creatorPackageExports: sum((entry) => entry.creatorPackageExports), storageGb: sum((entry) => entry.storageGb), egressGb: sum((entry) => entry.egressGb), revenueUsd, knownProviderCogsUsd, infrastructureCostUsd: null, totalMonthlyCogsUsd: null, knownCogsPerProjectUsd: round(knownProviderCogsUsd / sum((entry) => entry.projects)), knownCogsPerFinishedMinuteUsd: round(knownProviderCogsUsd / sum((entry) => entry.finishedMinutes)), providerGrossMargin, grossMarginStatus: providerGrossMargin >= CREATOR_TARGET_GROSS_MARGIN ? "GREEN" as const : providerGrossMargin >= CREATOR_P90_GROSS_MARGIN_WARNING_FLOOR ? "AMBER" as const : "RED" as const, grossMarginProvisional: true };
}

export type UpgradeEvidence = { measuredOperationalBlocker?: boolean; sustainedAmberNearRed?: boolean; betaOrRevenueRequirement?: boolean; securityOrComplianceRequirement?: boolean; totalCostEconomicsJustify?: boolean; azureTrigger?: boolean };
export function evaluateScaleUpgradePolicy(evidence: UpgradeEvidence = {}) {
  const reasons = Object.entries(evidence).filter(([key, value]) => key !== "azureTrigger" && value === true).map(([key]) => key);
  return { planUpgradeRequiredNow: reasons.length > 0, reasons, azureDeferred: evidence.azureTrigger !== true };
}

export const CREATOR_CAPACITY_EVIDENCE = {
  syntheticConcurrency10: { evidence: "measured" as const, environment: "local_stubbed", status: "GREEN" as const, productionClaim: false },
  creatorPackageConcurrency3: { evidence: "measured" as const, environment: "local_stubbed", status: "GREEN" as const, productionClaim: false },
  privateUse: { evidence: "modeled" as const, users: 1, status: "GREEN" as const },
  earlyBeta5: { evidence: "modeled" as const, users: 5, status: "AMBER" as const },
  earlyBeta10: { evidence: "modeled" as const, users: 10, status: "AMBER" as const },
  future25: { evidence: "modeled" as const, users: 25, status: "RED" as const, reason: "deployed capacity not proven" },
} as const;
