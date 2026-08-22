import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregateCreatorEconomicUsage, collectCreatorEconomicUsagePages, deriveProjectDuration } from "../lib/economics/usageAggregation.ts";
import { CREATOR_MARGIN_BENCHMARKS, CREATOR_MARGIN_BENCHMARK_VERSION, evaluateCreatorMarginHealth } from "../lib/economics/marginBenchmark.ts";
import { evaluateCreatorEconomicAdmission, getCreatorMarginEnforcementMode } from "../lib/economics/economicAdmission.ts";

const rows = [
  { operation_type: "creator_video", provider: "runway", model: "gen4_turbo", state: "provider_billed", generation_attempt: 1, quantities: { requestedSeconds: 7, providerBilledSeconds: 7, profileKey: "pro_efficient_motion" }, actual_provider_cost_usd: .35, cost_status: "exact" },
  { operation_type: "creator_video", provider: "veo", model: "veo-3.1-fast-generate-preview", state: "provider_accepted", generation_attempt: 1, quantities: { requestedSeconds: 7, providerBilledSeconds: 8, profileKey: "cinematic_fast_motion" }, estimated_provider_cost_usd: .96, cost_status: "estimated" },
  { operation_type: "creator_video", provider: "veo", model: "veo-3.1-fast-generate-preview", state: "provider_billed", generation_attempt: 2, fallback_attempt: true, quantities: { requestedSeconds: 7, providerBilledSeconds: 8, profileKey: "cinematic_fast_motion" }, actual_provider_cost_usd: .96, cost_status: "exact" },
  { operation_type: "creator_export", provider: "velto-export", state: "provider_billed", quantities: { timelineDurationSec: 120, outputBytes: 1000 }, cost_status: "unknown" },
  { operation_type: "creator_export", provider: "velto-export", state: "provider_billed", quantities: { timelineDurationSec: 180, outputBytes: 2000 }, cost_status: "unknown" },
  { operation_type: "creator_intelligence", provider: "openai", model: "gpt-5-mini", actual_provider_cost_usd: .02, cost_status: "exact", quantities: { inputTokens: 10, outputTokens: 5 } },
  { operation_type: "creator_image", provider: "openai", model: "gpt-image-2", actual_provider_cost_usd: .1, cost_status: "exact", quantities: { width: 1024, height: 1024, referenceCount: 1 } },
  { operation_type: "creator_voice", provider: "elevenlabs", model: "eleven_multilingual_v2", actual_provider_cost_usd: .05, cost_status: "exact", quantities: { characterCount: 500, durationSec: 12 } },
  { operation_type: "stock_search", provider: "pexels", cost_status: "not_billable", quantities: {} },
  { operation_type: "stock_import", provider: "pexels", cost_status: "not_billable", quantities: { storageBytes: 200 } },
];
const usage = aggregateCreatorEconomicUsage(rows, { activeBytes: 5000, totalPhysicalBytes: 7000, assetCount: 4 });
assert.equal(usage.exports.count, 2); assert.equal(usage.exports.finishedSeconds, 300); assert.equal(usage.exports.outputBytes, 3000);
assert.notEqual(usage.video.providerBilledSeconds / 60, usage.exports.finishedMinutes); assert.equal(usage.video.requestedSeconds, 21); assert.equal(usage.video.providerBilledSeconds, 23);
assert.equal(usage.actualProviderCostUsd, 1.48); assert.equal(usage.estimatedAdditionalCogsUsd, .96); assert.equal(usage.video.retryAttempts, 1); assert.equal(usage.video.fallbackAttempts, 1); assert.equal(usage.video.retryCogsUsd, .96); assert.equal(usage.video.fallbackCogsUsd, .96);
assert.equal(usage.committedEconomicExposureUsd, 2.44); assert.equal(usage.actualProviderCogsUsd, 1.48); assert.equal(usage.estimatedPendingProviderCogsUsd, .96); assert.equal(usage.byOperation.creator_video.actualCogsUsd, 1.31); assert.equal(usage.byOperation.creator_video.estimatedCogsUsd, .96); assert.equal(usage.byOperation.creator_video.committedExposureUsd, 2.27);
const finalizedAttempt = aggregateCreatorEconomicUsage([{ operation_type: "creator_video", actual_provider_cost_usd: .96, estimated_provider_cost_usd: null, cost_status: "exact" }]); assert.equal(finalizedAttempt.committedEconomicExposureUsd, .96); assert.equal(finalizedAttempt.estimatedPendingProviderCogsUsd, 0);
assert.equal(usage.byOperation.creator_intelligence.actualCogsUsd, .02); assert.equal(usage.byOperation.creator_image.actualCogsUsd, .1); assert.equal(usage.byOperation.creator_voice.actualCogsUsd, .05); assert.equal(usage.notBillableOperations, 2);
assert.equal(usage.unknownInfrastructureCost, true); assert.equal(usage.costCoverageStatus, "partial"); assert.equal(usage.storage.usdCostStatus, "unknown");
assert.deepEqual(deriveProjectDuration({ scenes: [{ timing: { targetSceneDuration: 9 } }] }, usage), { seconds: 150, source: "final_export" });
assert.deepEqual(deriveProjectDuration({ scenes: [{ timing: { targetSceneDuration: 9 } }, { duration: 6 }] }, aggregateCreatorEconomicUsage([])), { seconds: 15, source: "scene_sum" });
assert.deepEqual(deriveProjectDuration({ timeline: { durationSeconds: 44 } }, aggregateCreatorEconomicUsage([])), { seconds: 44, source: "timeline" });

assert.equal(CREATOR_MARGIN_BENCHMARK_VERSION, "creator-margin-benchmark-2026-08-22");
assert.deepEqual(CREATOR_MARGIN_BENCHMARKS.standard, { benchmarkPriceUsd: 59, normalizedFinishedMinutes: 60, p50CogsCeilingUsd: 20.65, p90CogsCeilingUsd: 23.6, stressCogsCeilingUsd: 29.5, videoCogsPerFinishedMinuteGuardrailUsd: 0 });
assert.equal(CREATOR_MARGIN_BENCHMARKS.pro.p90CogsCeilingUsd / 90, 79.6 / 90); assert.equal(Math.round(CREATOR_MARGIN_BENCHMARKS.cinematic.p90CogsCeilingUsd / 60 * 100), 266); assert.equal(CREATOR_MARGIN_BENCHMARKS.pro.videoCogsPerFinishedMinuteGuardrailUsd, .45); assert.equal(CREATOR_MARGIN_BENCHMARKS.cinematic.videoCogsPerFinishedMinuteGuardrailUsd, 1.75);
const health = (knownCogsUsd, finishedMinutes = 90, coverage = "complete") => evaluateCreatorMarginHealth({ tier: "pro", knownCogsUsd, finishedMinutes, costCoverageStatus: coverage });
assert.equal(health(60).status, "healthy"); assert.equal(health(75).status, "watch"); assert.equal(health(85).status, "p90_pressure"); assert.equal(health(110).status, "stress"); assert.equal(health(10, null).status, "insufficient_data"); assert.equal(health(10, 90, "partial").provisional, true);

const baseAdmission = { tier: "pro", operationType: "creator_video", estimatedProviderCostUsd: .35, currentActualCogsUsd: 10, currentEstimatedExposureUsd: 0, currentCommittedExposureUsd: 10, currentVideoActualCogsUsd: 1, currentVideoEstimatedExposureUsd: 0, currentVideoCommittedExposureUsd: 1, finishedMinutes: 90, costCoverageStatus: "complete", aggregationComplete: true, origin: "automatic" };
assert.equal(getCreatorMarginEnforcementMode({}), "monitor"); assert.equal(getCreatorMarginEnforcementMode({ VELTO_CREATOR_MARGIN_ENFORCEMENT_MODE: "guard" }), "guard");
assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, currentCommittedExposureUsd: 200, enforcementMode: "monitor" }).allowed, true);
assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, enforcementMode: "guard" }).allowed, true);
assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, currentCommittedExposureUsd: 200, enforcementMode: "guard", origin: "manual" }).allowed, false);
assert.deepEqual(evaluateCreatorEconomicAdmission({ ...baseAdmission, currentCommittedExposureUsd: 200, enforcementMode: "guard", qualityEquivalentFallbackAvailable: true }).reasonCodes, ["SAFE_FALLBACK_REQUIRED"]);
assert.deepEqual(evaluateCreatorEconomicAdmission({ ...baseAdmission, currentCommittedExposureUsd: 200, enforcementMode: "guard", acceptableProductionFallbackAvailable: true }).reasonCodes, ["SAFE_FALLBACK_REQUIRED"]);
assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, estimatedProviderCostUsd: null }).allowed, false);
assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, estimatedProviderCostUsd: Number.NaN }).allowed, false);
const pendingVeo = evaluateCreatorEconomicAdmission({ ...baseAdmission, tier: "cinematic", currentActualCogsUsd: 0, currentEstimatedExposureUsd: 2.88, currentCommittedExposureUsd: 2.88, currentVideoActualCogsUsd: 0, currentVideoEstimatedExposureUsd: 2.88, currentVideoCommittedExposureUsd: 2.88, finishedMinutes: 1, estimatedProviderCostUsd: .96, enforcementMode: "guard" }); assert.equal(pendingVeo.allowed, false); assert.equal(pendingVeo.estimatedExposureContributed, true);
const monitorPending = evaluateCreatorEconomicAdmission({ ...baseAdmission, tier: "cinematic", currentActualCogsUsd: 0, currentEstimatedExposureUsd: 2.88, currentCommittedExposureUsd: 2.88, currentVideoActualCogsUsd: 0, currentVideoEstimatedExposureUsd: 2.88, currentVideoCommittedExposureUsd: 2.88, finishedMinutes: 1, estimatedProviderCostUsd: .96, enforcementMode: "monitor" }); assert.equal(monitorPending.allowed, true); assert.equal(monitorPending.mode, "soft_pressure");
assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, aggregationComplete: false, enforcementMode: "guard" }).allowed, false); assert.equal(evaluateCreatorEconomicAdmission({ ...baseAdmission, aggregationComplete: false, enforcementMode: "monitor" }).allowed, true);

const synthetic = Array.from({ length: 5007 }, (_, index) => ({ id: `row-${index}`, created_at: `2026-08-${String(22 - Math.floor(index / 1000)).padStart(2, "0")}T00:00:00Z`, project_id: index % 2 ? "project-a" : "project-b", operation_type: "creator_image", actual_provider_cost_usd: 1, cost_status: "exact" }));
const paged = await collectCreatorEconomicUsagePages(async (from, to) => synthetic.slice(from, to + 1), { pageSize: 1000 }); assert.equal(paged.rows.length, 5007); assert.equal(new Set(paged.rows.map((row) => row.id)).size, 5007); assert.equal(aggregateCreatorEconomicUsage(paged.rows).actualProviderCogsUsd, 5007); assert.equal(paged.aggregationComplete, true);
const capped = await collectCreatorEconomicUsagePages(async (from, to) => synthetic.slice(from, to + 1), { pageSize: 1000, maximumRows: 5000 }); const cappedUsage = aggregateCreatorEconomicUsage(capped.rows, undefined, capped); assert.equal(capped.aggregationComplete, false); assert.equal(capped.truncated, true); assert.equal(cappedUsage.costCoverageStatus, "insufficient");
assert.equal(synthetic.filter((row) => row.project_id === "project-a").length, 2503);
const usageServiceSource = readFileSync(new URL("../lib/economics/usageService.server.ts", import.meta.url), "utf8"); assert.match(usageServiceSource, /\.eq\("project_id", input\.projectId\)/); assert.match(usageServiceSource, /getCreatorUsageWindowStart/); assert.match(usageServiceSource, /rolling_30_days/); assert.match(usageServiceSource, /\.order\("created_at"[\s\S]*\.order\("id"[\s\S]*\.range\(from, to\)/); assert.doesNotMatch(usageServiceSource, /\.limit\(5000\)/);
const candidatePressure = readFileSync(new URL("../lib/video/creatorProfiles.ts", import.meta.url), "utf8"); assert.match(candidatePressure, /veo_lite_candidate[\s\S]*autoRoutingEnabled: false/); assert.match(candidatePressure, /seedance2_candidate[\s\S]*autoRoutingEnabled: false/);
const route = readFileSync(new URL("../app/api/creator-usage/route.ts", import.meta.url), "utf8"); assert.match(route, /authenticateRequest/); assert.match(route, /getForOwner|PROJECT_NOT_FOUND/); assert.doesNotMatch(route, /benchmarkPriceUsd|knownProviderCogsUsd|byProviderModelProfile/);
const boundary = readFileSync(new URL("../lib/security/creatorVideoTaskBindingBoundary.ts", import.meta.url), "utf8"); for (const field of ["enforcementMode", "benchmarkPriceUsd", "economicAdmission", "costOverride"]) assert.match(boundary, new RegExp(`"${field}"`));
const credits = readFileSync(new URL("../lib/credits/operationPolicy.ts", import.meta.url), "utf8"); assert.match(credits, /creator_video: \{ draft: 0, standard: 0, pro: 6, cinematic: 10 \}/); assert.match(credits, /creator_image: \{ draft: 0, standard: 1, pro: 2, cinematic: 4 \}/);
console.log("Stage 0.10F usage, entitlement, margin, and admission tests passed.");
