import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function loadTsModule(path) {
  let source = fs.readFileSync(path, "utf8")
    .replace(/import \{ CREATOR_ECONOMICS_PRICING_AS_OF, CREATOR_ECONOMICS_PRICING_VERSION, CREATOR_PROVIDER_PRICING \} from "\.\/pricingCatalog(?:\.ts)?";/, fs.readFileSync("lib/economics/pricingCatalog.ts", "utf8").replace(/export /g, ""))
    .replace(/import type \{ EconomicCostResult \} from "\.\/types(?:\.ts)?";/, "")
    .replace(/export /g, "");
  source += "\nreturn { calculateOpenAITextCost, calculateOpenAIImageCost, calculateElevenLabsCost, calculateRunwayCost, calculateVeoCost, unknownCost };";
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
  return Function(js)();
}

const c = loadTsModule("lib/economics/calculators.ts");
assert.equal(c.calculateOpenAITextCost("gpt-4.1-mini", { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 }).providerCostUsd, 2);
assert.equal(c.calculateOpenAITextCost("gpt-5-mini", { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 }).providerCostUsd, 2.25);
assert.equal(c.calculateOpenAIImageCost("gpt-image-2", { textInputTokens: 1_000_000, imageInputTokens: 1_000_000, imageOutputTokens: 1_000_000 }).providerCostUsd, 43);
assert.equal(c.calculateElevenLabsCost("eleven_multilingual_v2", 1000).providerCostUsd, 0.1);
for (const seconds of [5, 7, 10]) assert.equal(c.calculateRunwayCost("gen4_turbo", seconds).providerCostUsd, Math.round(seconds * 0.05 * 1e6) / 1e6);
for (const seconds of [5, 7, 10]) assert.equal(c.calculateRunwayCost("gen4.5", seconds).providerCostUsd, Math.round(seconds * 0.12 * 1e6) / 1e6);
assert.equal(c.calculateRunwayCost("seedance2", 10, "1080p").providerCostUsd, 4);
assert.equal(c.calculateVeoCost("veo-3.1-generate-preview").providerCostUsd, 3.2);
assert.equal(c.calculateVeoCost("unsupported").costStatus, "unknown");

const policy = fs.readFileSync("lib/credits/operationPolicy.ts", "utf8");
for (const expected of [
  "creator_image: { draft: 0, standard: 1, pro: 2, cinematic: 4 }",
  "creator_voice: { draft: 0, standard: 1, pro: 2, cinematic: 3 }",
  "creator_dialogue_voice: { draft: 0, standard: 1, pro: 2, cinematic: 3 }",
  "creator_video: { draft: 0, standard: 0, pro: 6, cinematic: 10 }",
  "creator_export: { draft: 0, standard: 1, pro: 2, cinematic: 3 }",
]) assert.match(policy, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const routing = fs.readFileSync("lib/creator/mediaRouting.ts", "utf8");
assert.match(routing, /pro:[\s\S]*videoBlockRatio: 0\.45/);
assert.match(routing, /cinematic:[\s\S]*videoBlockRatio: 0\.75/);
const migration = fs.readFileSync("supabase/migrations/20260822100000_stage_0_10b_creator_economics.sql", "utf8");
assert.match(migration, /attempt_key text not null unique/);
assert.match(migration, /revoke all on table[^;]+from public, anon, authenticated/);
const repo = fs.readFileSync("lib/economics/repository.ts", "utf8");
assert.doesNotMatch(repo, /prompt|script|dialogue|narration/i);
const worker = fs.readFileSync("lib/worker/jobHandlers.mjs", "utf8");
assert.doesNotMatch(worker, /persistEconomicOperation/);
const economicsRepository = fs.readFileSync("lib/economics/repository.ts", "utf8");
assert.match(economicsRepository, /upsert\(row, \{ onConflict: "attempt_key" \}\)/);
const imageRoute = fs.readFileSync("app/api/image/route.ts", "utf8");
assert.ok(imageRoute.indexOf("providerAccepted = true") > imageRoute.indexOf("imageProvider.generate"));
assert.ok(imageRoute.indexOf("persistEconomicOperationBestEffort(economicAttempt)") < imageRoute.indexOf("settleMeteredOperation(reservation"));
const voiceRoute = fs.readFileSync("app/api/store-audio/route.ts", "utf8");
assert.ok(voiceRoute.indexOf("persistEconomicOperationBestEffort(economicAttempt)") < voiceRoute.indexOf("uploadPublic"));
assert.match(voiceRoute, /application_failed_after_provider_cost/);
const dialogueRoute = fs.readFileSync("app/api/store-dialogue-audio/route.ts", "utf8");
assert.ok(dialogueRoute.indexOf("persistEconomicOperationBestEffort(economicAttempt)") < dialogueRoute.indexOf("uploadPublic"));
const videoRoute = fs.readFileSync("app/api/creator-video/route.ts", "utf8");
assert.match(videoRoute, /generation:1/);
assert.match(videoRoute, /fallbackProvider: selection\.usedFallback/);
const exportRoute = fs.readFileSync("app/api/creator-export/route.ts", "utf8");
assert.match(exportRoute, /elapsedRuntimeMs/);
assert.match(exportRoute, /exportDispatched[\s\S]*application_failed_after_provider_cost/);
for (const file of ["app/api/creator-mentor/route.ts", "app/api/creator-script-plan/route.ts", "app/api/creator-scene-script-fit/route.ts", "app/api/creator-youtube-metadata/route.ts", "app/api/youtube-research/route.ts", "app/api/optimize-scenes-ai/route.ts"]) {
  assert.match(fs.readFileSync(file, "utf8"), /recordOpenAITextEconomics/);
}
console.log("Stage 0.10B economics tests passed.");
