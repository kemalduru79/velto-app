import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCreatorAccountingAdmission } from "../lib/credits/creatorAccountingAdmission.ts";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const accountStates = [
  { balanceCredits: 0, availableCredits: 0, reservedCredits: 0 },
  { balanceCredits: 0, availableCredits: 0, reservedCredits: 4 },
  { balanceCredits: 2, availableCredits: 0, reservedCredits: 2 },
  { balanceCredits: 0, availableCredits: 0, reservedCredits: 0, historicalLedger: true },
];
for (const account of accountStates) {
  let claims = 0;
  const snapshot = structuredClone(account);
  const admission = await createCreatorAccountingAdmission(
    { attemptKey: "operation:provider:1", logicalOperationId: "operation", userId: "creator", route: "/api/test", operationType: "creator_test" },
    async () => { claims += 1; },
  );
  assert.equal(admission.mode, "creator_accounting");
  assert.equal(admission.reservedCredits, 0);
  assert.equal(admission.accountAfterReserve, null);
  assert.equal(claims, 1);
  assert.deepEqual(account, snapshot, "account balance and historical ledger remain untouched");
}

let providerCalls = 0;
const claimed = new Set();
const dispatch = async (key) => {
  await createCreatorAccountingAdmission(
    { attemptKey: key, logicalOperationId: key, userId: "creator", route: "/api/test", operationType: "creator_test" },
    async ({ attemptKey }) => {
      if (claimed.has(attemptKey)) throw new Error("duplicate operation");
      claimed.add(attemptKey);
    },
  );
  providerCalls += 1;
};
await dispatch("same-operation");
await assert.rejects(dispatch("same-operation"), /duplicate operation/);
assert.equal(providerCalls, 1, "duplicate admission never reaches the paid provider");
await assert.rejects(
  createCreatorAccountingAdmission(
    { attemptKey: "db-failure", logicalOperationId: "db-failure", userId: "creator", route: "/api/test", operationType: "creator_test" },
    async () => { throw new Error("database unavailable"); },
  ),
  /database unavailable/,
  "accounting persistence fails closed",
);

const routes = [
  ["app/api/image/route.ts", "creator_image"],
  ["app/api/character-image/route.ts", "creator_character_image"],
  ["app/api/store-audio/route.ts", "creator_voice"],
  ["app/api/store-dialogue-audio/route.ts", "creator_dialogue_voice"],
  ["app/api/creator-video/route.ts", "creator_video"],
  ["app/api/creator-export/route.ts", "creator_export"],
];
for (const [path, operation] of routes) {
  const source = read(path);
  assert.match(source, /admissionMode:[\s\S]{0,100}"creator_accounting"/, `${path} uses accounting-only admission`);
  assert.match(source, new RegExp(`operationType: ["']${operation}["']`));
  assert.match(source, /attemptKey:/, `${path} claims a durable idempotency identity before dispatch`);
}

const metering = read("lib/credits/serverMetering.ts");
assert.match(metering, /claimEconomicOperation/);
assert.match(metering, /EconomicOperationClaimError[\s\S]*DUPLICATE_OPERATION/);
assert.match(metering, /creditEngine\.reserve/, "legacy balance-backed admission remains available");
assert.match(metering, /releaseEconomicOperationClaim/, "pre-provider failures release the accounting claim");
assert.ok(metering.indexOf('input.admissionMode === "creator_accounting"') < metering.indexOf("creditEngine.reserve"));

const economics = read("lib/economics/repository.ts");
assert.match(economics, /\.insert\(row\)/, "claim uses unique insert rather than permissive upsert");
assert.match(economics, /error\.code === "23505"/);
assert.match(economics, /\.upsert\(row, \{ onConflict: "attempt_key" \}\)/, "existing COGS enrichment remains intact");

const video = read("app/api/creator-video/route.ts");
assert.match(video, /CREATOR_PRODUCTION_ALLOWANCE_EXCEEDED/);
assert.match(video, /persistEconomicOperationBestEffort\(economicAttempt/);

const accountMenu = read("components/auth/UserAccountMenu.tsx");
assert.doesNotMatch(accountMenu, /\/api\/credits|availableCredits|reservedCredits|balanceCredits/);
const page = read("app/create/page.tsx");
assert.doesNotMatch(page, /Generate new AI thumbnail · Credits apply|Kredi kullanır|media-generation credits|Velto credits/);
assert.doesNotMatch(page, /<CreatorCostGuard/);
assert.match(page, /startVideoDispatchCountdown/);
assert.match(page, /startImageDispatchCountdown/);

console.log("STAGE_0_11E_CREATORLAB_ZERO_CREDIT_GATING=PASS");
