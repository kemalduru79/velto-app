import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { CREATOR_MARGIN_BENCHMARKS } from "../lib/economics/marginBenchmark.ts";
import { CREATOR_PACKAGE_QUALITY_FLOORS, CREATOR_PACKAGE_QUALITY_SCENARIOS, CREATOR_PACKAGE_SCENARIOS, INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT, simulateCreatorPackageEconomics, validateCreatorPackage } from "../lib/economics/packageValidation.ts";
import { CREATOR_VIDEO_PROFILES } from "../lib/video/creatorProfiles.ts";

const expected = {
  standard: { price: 59, minutes: 60, salePerMinute: 59 / 60, credits: 800 },
  pro: { price: 199, minutes: 90, salePerMinute: 199 / 90, credits: 2700 },
  cinematic: { price: 399, minutes: 60, salePerMinute: 399 / 60, credits: 3300 },
};

for (const tier of ["standard", "pro", "cinematic"]) {
  const benchmark = CREATOR_MARGIN_BENCHMARKS[tier]; const validation = validateCreatorPackage(tier); const typical = validation.simulations.typical; const p90 = validation.simulations.generation_heavy_p90; const stress = validation.simulations.retry_stress;
  assert.equal(benchmark.benchmarkPriceUsd, expected[tier].price); assert.equal(benchmark.normalizedFinishedMinutes, expected[tier].minutes); assert.equal(benchmark.p50CogsCeilingUsd, Math.round(expected[tier].price * .35 * 100) / 100); assert.equal(benchmark.p90CogsCeilingUsd, Math.round(expected[tier].price * .4 * 100) / 100); assert.equal(benchmark.stressCogsCeilingUsd, Math.round(expected[tier].price * .5 * 100) / 100);
  assert.equal(typical.salePricePerFinishedMinute, Math.round(expected[tier].salePerMinute * 1_000_000) / 1_000_000); assert.equal(validation.candidateMonthlyCredits, expected[tier].credits); assert.equal(validation.candidateMonthlyCredits, Math.ceil(typical.creditsRequired * 1.15 / 100) * 100);
  assert.equal(typical.creditsRequired, Object.values(typical.creditBurn).reduce((sum, value) => sum + value, 0)); assert.ok(typical.creditBurn.stockPhotos > 0); assert.ok(typical.creditBurn.stockVideos > 0); assert.equal(typical.creditBurn.reusedAssets, 0); assert.equal(validation.remainingTypicalCredits, validation.candidateMonthlyCredits - typical.creditsRequired); assert.ok(typical.dominantCreditConsumers[0].credits >= typical.dominantCreditConsumers[1].credits); assert.ok(typical.dominantProviderCosts[0].costUsd >= typical.dominantProviderCosts[1].costUsd); assert.notEqual(typical.creditsRequired, typical.providerCogs.totalUsd); assert.equal(typical.infrastructureCostStatus, "unknown"); assert.equal(typical.remainingUnpricedInfrastructureHeadroom.atP90Usd, Math.round((benchmark.p90CogsCeilingUsd - typical.providerCogs.totalUsd) * 1_000_000) / 1_000_000);
  assert.ok(typical.providerCogs.totalUsd <= benchmark.p50CogsCeilingUsd); assert.ok(p90.providerCogs.totalUsd <= benchmark.p90CogsCeilingUsd); assert.ok(stress.providerCogs.totalUsd <= benchmark.stressCogsCeilingUsd); assert.equal(validation.verdict, "CONDITIONAL_GO");
}

assert.equal(validateCreatorPackage("standard").simulations.typical.providerCogs.videoUsd, 0); assert.equal(Object.keys(CREATOR_PACKAGE_SCENARIOS.standard.typical.videoProfiles).length, 0);
const proTypical = validateCreatorPackage("pro").simulations.typical; assert.ok(proTypical.counts.videos < proTypical.finishedMinutes * proTypical.scenesPerFinishedMinute); assert.ok(proTypical.providerCogs.byVideoProfileUsd.pro_efficient_motion > proTypical.providerCogs.byVideoProfileUsd.pro_quality_motion);
const cinematicTypical = validateCreatorPackage("cinematic").simulations.typical; assert.ok(CREATOR_PACKAGE_SCENARIOS.cinematic.typical.reusedAssetsPerFinishedMinute > 0); assert.ok(CREATOR_PACKAGE_SCENARIOS.cinematic.typical.videoProfiles.cinematic_hero_motion.clipsPerFinishedMinute * 60 < 1); assert.ok(cinematicTypical.providerCogs.videoUsd < 105);
assert.equal(CREATOR_VIDEO_PROFILES.veo_lite_candidate.autoRoutingEnabled, false); assert.equal(CREATOR_VIDEO_PROFILES.seedance2_candidate.autoRoutingEnabled, false);
assert.throws(() => simulateCreatorPackageEconomics({ tier: "cinematic", scenario: { ...CREATOR_PACKAGE_SCENARIOS.cinematic.typical, videoProfiles: { veo_lite_candidate: { clipsPerFinishedMinute: 1, requestedSeconds: 8 } } } }), /DISABLED_PROFILE/);
assert.throws(() => simulateCreatorPackageEconomics({ tier: "cinematic", scenario: { ...CREATOR_PACKAGE_SCENARIOS.cinematic.typical, videoProfiles: { seedance2_candidate: { clipsPerFinishedMinute: 1, requestedSeconds: 7 } } } }), /DISABLED_PROFILE/);

const retryBase = simulateCreatorPackageEconomics({ tier: "pro", scenario: { ...CREATOR_PACKAGE_SCENARIOS.pro.typical, retryRate: 0 } }); const retryHigh = simulateCreatorPackageEconomics({ tier: "pro", scenario: { ...CREATOR_PACKAGE_SCENARIOS.pro.typical, retryRate: .5 } }); assert.ok(retryHigh.providerCogs.totalUsd > retryBase.providerCogs.totalUsd * 1.49); assert.equal(retryHigh.creditsRequired, retryBase.creditsRequired);
const dense = simulateCreatorPackageEconomics({ tier: "pro", scenario: { ...CREATOR_PACKAGE_SCENARIOS.pro.typical, scenesPerFinishedMinute: 12, voiceOperationsPerFinishedMinute: 12, aiImagesPerFinishedMinute: 3.6 } }); assert.ok(dense.creditsRequired > proTypical.creditsRequired); assert.ok(dense.providerCogs.totalUsd > proTypical.providerCogs.totalUsd);
const noGo = simulateCreatorPackageEconomics({ tier: "pro", scenario: { ...CREATOR_PACKAGE_SCENARIOS.pro.generation_heavy_p90, videoProfiles: { pro_quality_motion: { clipsPerFinishedMinute: 4, requestedSeconds: 10 } } } }); assert.ok(noGo.providerCogs.totalUsd > noGo.ceilings.p90Usd); assert.equal(noGo.status, "no_go");

assert.equal(CREATOR_PACKAGE_QUALITY_SCENARIOS.length, 10); assert.ok(CREATOR_PACKAGE_QUALITY_SCENARIOS.some((item) => item.contentType === "stock_rich_travel" && item.suitableTiers.includes("cinematic"))); assert.ok(CREATOR_PACKAGE_QUALITY_FLOORS.standard.includes("no_placeholder_media")); assert.ok(CREATOR_PACKAGE_QUALITY_FLOORS.cinematic.includes("premium_value_above_pro"));
const customerContract = JSON.stringify(INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT); for (const provider of ["runway", "veo", "seedance", "openai", "elevenlabs"]) assert.doesNotMatch(customerContract, new RegExp(provider, "i")); assert.equal(INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT.version, "creator-package-validation-2026-08-23"); assert.equal(INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT.visibility, "internal"); assert.equal(INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT.lifecycle, "beta_candidate"); assert.equal(INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT.billingTruth, false);

const changed = execFileSync("git", ["diff", "--name-only", "ec69cbdf6c9225fb7bd1622f37dfd18655d4279a"], { encoding: "utf8" }).trim().split("\n").filter(Boolean); assert.equal(changed.some((file) => file.startsWith("supabase/migrations/") || file.startsWith("prisma/migrations/")), false); assert.equal(changed.some((file) => /checkout|stripe|subscription/i.test(file)), false);
const apiFiles = execFileSync("git", ["ls-files", "app/api/**/route.ts"], { encoding: "utf8" }).trim().split("\n"); for (const file of apiFiles) assert.doesNotMatch(readFileSync(file, "utf8"), /packageValidation|INTERNAL_CREATOR_PACKAGE_VALIDATION_CONTRACT/);
assert.equal(execFileSync("git", ["diff", "--name-only", "ec69cbdf6c9225fb7bd1622f37dfd18655d4279a", "--", "lib/video/creatorProfiles.ts", "lib/creator/productionIntelligence.ts"], { encoding: "utf8" }).trim(), "");
const simulatorSource = readFileSync(new URL("../lib/economics/packageValidation.ts", import.meta.url), "utf8"); assert.doesNotMatch(simulatorSource, /generatedVideoPercentage|videoQuota|45%|75%/); assert.match(simulatorSource, /infrastructureCostStatus: "unknown"/);

console.log("Stage 0.10G package economics, quality contract, and closure tests passed.");
