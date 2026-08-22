import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREATOR_VIDEO_PROFILES, estimateCreatorVideoProfileCost, getCreatorProfileBilledDuration } from "../lib/video/creatorProfiles.ts";
import { selectCreatorVideoProfile } from "../lib/video/creatorSmartRouting.ts";
import { calculateRunwayCost, calculateVeoCost } from "../lib/economics/calculators.ts";

const context = { runwayAvailable: true, veoAvailable: true, veoSmartRoutingEnabled: true, veoHeroStandardEnabled: false };
const intent = (overrides = {}) => ({ qualityTier: "pro", visualImportance: .7, motionImportance: .65, continuityImportance: .3, productionPriority: .7, recommendedSeconds: 7, referenceAvailabilityCount: 0, lastFrameAvailable: false, requestedRatio: "1280:720", sceneRole: "exposition", ...overrides });
const key = (input, runtime = context) => selectCreatorVideoProfile(intent(input), runtime).selectedProfile?.profileKey || null;

assert.equal(key({ qualityTier: "standard" }), null);
assert.equal(key({}), "pro_efficient_motion");
assert.equal(key({ productionPriority: .9, motionImportance: .8 }), "pro_quality_motion");
assert.equal(key({ productionPriority: .9, visualImportance: .9 }), "pro_quality_motion");
assert.equal(key({ qualityTier: "cinematic", recommendedSeconds: 5, productionPriority: .9, motionImportance: .9 }), "cinematic_precision_motion");
assert.equal(key({ qualityTier: "cinematic", recommendedSeconds: 8, productionPriority: .9, motionImportance: .9, referenceAvailabilityCount: 1 }), "cinematic_fast_motion");
assert.equal(key({ qualityTier: "cinematic", recommendedSeconds: 8, productionPriority: .9, motionImportance: .9, referenceAvailabilityCount: 1 }, { ...context, veoSmartRoutingEnabled: false }), "cinematic_precision_motion");
assert.notEqual(key({ qualityTier: "cinematic", productionPriority: .99, visualImportance: .99, motionImportance: .99, recommendedSeconds: 8, sceneRole: "climax" }), "cinematic_hero_motion");
assert.notEqual(key({ qualityTier: "cinematic", productionPriority: .8, visualImportance: .8, motionImportance: .8, recommendedSeconds: 8, sceneRole: "exposition" }, { ...context, veoHeroStandardEnabled: true }), "cinematic_hero_motion");
assert.equal(key({ qualityTier: "cinematic", productionPriority: .99, visualImportance: .99, motionImportance: .99, recommendedSeconds: 8, sceneRole: "climax" }, { ...context, veoHeroStandardEnabled: true }), "cinematic_hero_motion");
assert.equal(CREATOR_VIDEO_PROFILES.seedance2_candidate.autoRoutingEnabled, false);
assert.equal(CREATOR_VIDEO_PROFILES.veo_lite_candidate.autoRoutingEnabled, false);
assert.equal(key({ provider: "veo", model: "veo-3.1-generate-preview" }), "pro_efficient_motion");
assert.equal(key({ qualityTier: "cinematic", lastFrameAvailable: true, recommendedSeconds: 7 }, { ...context, veoSmartRoutingEnabled: false }), null);
assert.deepEqual(selectCreatorVideoProfile(intent(), context), selectCreatorVideoProfile(intent(), context));

for (const [seconds, turbo, quality] of [[5,.25,.6],[7,.35,.84],[10,.5,1.2]]) { assert.equal(calculateRunwayCost("gen4_turbo", seconds).providerCostUsd, turbo); assert.equal(calculateRunwayCost("gen4.5", seconds).providerCostUsd, quality); }
assert.equal(calculateRunwayCost("seedance2", 5, "720p").providerCostUsd, 1.8);
assert.equal(calculateRunwayCost("seedance2", 5, "1080p").providerCostUsd, 2);
assert.equal(calculateVeoCost("veo-3.1-fast-generate-preview", "1080p", 8).providerCostUsd, .96);
assert.equal(calculateVeoCost("veo-3.1-generate-preview", "1080p", 8).providerCostUsd, 3.2);
assert.equal(calculateVeoCost("veo-3.1-lite-generate-preview", "1080p", 8).providerCostUsd, .64);
assert.equal(calculateVeoCost("unsupported", "1080p", 8).costStatus, "unknown");
assert.equal(getCreatorProfileBilledDuration(CREATOR_VIDEO_PROFILES.cinematic_fast_motion, 5), 8);
assert.equal(estimateCreatorVideoProfileCost(CREATOR_VIDEO_PROFILES.cinematic_fast_motion, 8).providerCostUsd, .96);

const proIntents = Array.from({ length: 12 }, (_, i) => intent(i < 2 ? { productionPriority: .9, motionImportance: .85 } : {}));
const proRoutes = proIntents.map((item) => selectCreatorVideoProfile(item, context));
assert.deepEqual(proRoutes.reduce((out, item) => ({ ...out, [item.selectedProfile.profileKey]: (out[item.selectedProfile.profileKey] || 0) + 1 }), {}), { pro_quality_motion: 2, pro_efficient_motion: 10 });
const cinematicIntents = [intent({ qualityTier: "cinematic", recommendedSeconds: 5 }), intent({ qualityTier: "cinematic", recommendedSeconds: 7 }), intent({ qualityTier: "cinematic", recommendedSeconds: 8, productionPriority: .9, motionImportance: .9, referenceAvailabilityCount: 1 }), intent({ qualityTier: "cinematic", recommendedSeconds: 8, productionPriority: .99, visualImportance: .99, motionImportance: .99, sceneRole: "climax" })];
const cinematicRoutes = cinematicIntents.map((item) => selectCreatorVideoProfile(item, context));
assert.equal(cinematicRoutes.filter((item) => item.selectedProfile?.profileKey === "cinematic_hero_motion").length, 0);
assert.ok(cinematicRoutes.reduce((sum, item) => sum + (item.estimatedProviderCostUsd || 0), 0) < 4 * 3.2);

const boundary = readFileSync(new URL("../lib/security/creatorVideoTaskBindingBoundary.ts", import.meta.url), "utf8");
assert.match(boundary, /"model"/); assert.match(boundary, /runtimeProfile/);
const route = readFileSync(new URL("../app/api/creator-video/route.ts", import.meta.url), "utf8");
assert.match(route, /selectCreatorVideoProfile/); assert.match(route, /providerBilledDurationSec/); assert.match(route, /pricingVersion/);
const worker = readFileSync(new URL("../lib/worker/jobHandlers.mjs", import.meta.url), "utf8");
assert.doesNotMatch(worker, /createTask|selectCreatorVideoProfile/);
const providerStatus = readFileSync(new URL("../app/api/internal/jobs/[jobId]/provider-status/route.ts", import.meta.url), "utf8");
assert.match(providerStatus, /status === "SUCCEEDED"[\s\S]*binding\.provider === "veo"/); assert.match(providerStatus, /billingMoment: "successful_generation"/);
const exportMedia = readFileSync(new URL("../lib/video/stitching/nativeMedia.server.ts", import.meta.url), "utf8");
assert.match(exportMedia, /"-an"/);
const credits = readFileSync(new URL("../lib/credits/operationPolicy.ts", import.meta.url), "utf8");
assert.match(credits, /video:[\s\S]*standard:\s*0[\s\S]*pro:\s*6[\s\S]*cinematic:\s*10/);
console.log("Stage 0.10E smart premium routing tests passed.");
