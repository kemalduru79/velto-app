import assert from "node:assert/strict";
import fs from "node:fs";
import { getOperationCreditCost } from "../lib/credits/operationPolicy.ts";
import { aggregateCreatorEconomicUsage } from "../lib/economics/usageAggregation.ts";

const route = fs.readFileSync(
  new URL("../app/api/character-image/route.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");

assert.equal(getOperationCreditCost("creator_image", "standard"), 1);
assert.equal(getOperationCreditCost("creator_image", "pro"), 2);
assert.equal(getOperationCreditCost("creator_image", "cinematic"), 4);
assert.equal(getOperationCreditCost("creator_image", "draft"), 0);

assert.match(route, /isCreatorLab && normalizedQualityMode === "draft"/);
assert.ok(
  route.indexOf('normalizedQualityMode === "draft"') <
    route.indexOf("client.images.generate"),
);
assert.match(route, /operationType: "creator_image"/);
assert.match(route, /qualityMode: normalizedQualityMode/);
assert.match(route, /requireCostGuardConfirmation: true/);
assert.match(route, /reservation = await reserveMeteredOperation\(req,/);
assert.ok(
  route.indexOf("reserveMeteredOperation(req") < route.indexOf("client.images.generate"),
);
assert.match(route, /providerSucceeded = true;[\s\S]*settleMeteredOperation\(reservation/);
assert.match(route, /if \(providerSucceeded\)[\s\S]*settleMeteredOperation[\s\S]*else \{[\s\S]*releaseMeteredOperation/);
assert.match(route, /getCreditErrorResponse\(error\)/);
assert.doesNotMatch(route, /body\.(?:credits|creditCost|estimatedCredits)/);
assert.match(route, /accounting: \{[\s\S]*operationType: "creator_character_image"/);
assert.match(route, /operationType: isCreatorLab \? "creator_character_image" : "legacy_character_image"/);
assert.match(route, /metadata: \{[\s\S]*purpose: "character_reference"/);
assert.doesNotMatch(route, /metadata: \{[^}]*?(?:prompt|appearance|base64|apiKey)/s);

const characterUsage = aggregateCreatorEconomicUsage([
  {
    operation_type: "creator_character_image",
    provider: "openai",
    model: "gpt-image-2-2026-04-21",
    state: "provider_billed",
    actual_provider_cost_usd: 0.12,
    cost_status: "exact",
  },
]);
assert.equal(characterUsage.byOperation.creator_character_image.operations, 1);
assert.equal(characterUsage.byOperation.creator_character_image.actualCogsUsd, 0.12);

const serverReserve = route.indexOf("reserveMeteredOperation(req");
const serverDispatch = route.indexOf("client.images.generate");
const serverSettle = route.indexOf("settleMeteredOperation(reservation");
assert.ok(serverReserve >= 0 && serverReserve < serverDispatch && serverDispatch < serverSettle);

assert.match(page, /const generateCharacterReference = async \(index: number\) =>/);
assert.match(page, /getOperationCreditCost\("creator_image", creatorQualityMode\)/);
assert.match(page, /operationName: uiLanguage === "en" \? "Reference image"/);
assert.match(page, /estimatedCredits,[\s\S]*qualityLabel: getCreatorQualityModeLabel\(\)/);
assert.ok(
  page.indexOf("requestCreatorCostGuardConfirmation({", page.indexOf("const generateCharacterReference")) <
    page.indexOf('fetch("/api/character-image"', page.indexOf("const generateCharacterReference")),
);
assert.match(page, /if \(!creatorOperationId\) return;/);
assert.match(page, /characterLoadingIndex === index/);
assert.match(page, /\.\.\.creatorCostGuardHeaders\(creatorOperationId\)/);
assert.match(page, /Authorization: `Bearer \$\{accessToken\}`/);
assert.match(page, /retainAmbiguousCreatorOperationId\(creatorOperationKey, creatorOperationId\)/);
assert.match(page, /retireAmbiguousCreatorOperationId\(creatorOperationKey, creatorOperationId\)/);
assert.match(page, /isCreatorOperationHttpOutcomeAmbiguous\(res\)/);
assert.match(page, /window\.crypto\.randomUUID\(\)/);
assert.match(page, /notifyCreditAccountChanged\(data\.credits\)/);

assert.match(page, /i === index \? \{ \.\.\.item, referenceImage: data\.image \} : item/);
assert.doesNotMatch(
  page.slice(
    page.indexOf("const generateCharacterReference"),
    page.indexOf("const buildStory", page.indexOf("const generateCharacterReference")),
  ),
  /setCharacters\(\[|voiceId:\s*""|id:\s*createCreatorCharacterId/,
);

assert.match(route, /const isCreatorLab = normalizedProductProfile === "creatorlab"/);
assert.match(route, /if \(isCreatorLab\) \{\s*reservation = await reserveMeteredOperation/);
assert.match(route, /: \{\s*model: "gpt-image-1"/);
assert.equal((page.match(/fetch\("\/api\/character-image"/g) || []).length, 1);

console.log("CreatorLab character reference Cost Guard smoke test passed (26 checks).");
