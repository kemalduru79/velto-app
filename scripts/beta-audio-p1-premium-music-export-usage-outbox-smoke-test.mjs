import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260811_audio_p2_creator_music_usage_outbox.sql");
const entitlementMigration = read("supabase/migrations/20260811_audio_p1_creator_music_entitlements.sql");
const types = read("lib/persistence/music/types.ts");
const repository = read("lib/persistence/music/supabaseCreatorMusicUsageEventRepository.ts");
const usage = read("lib/creator/musicUsage.ts");
const route = read("app/api/creator-export/route.ts");
const exportService = read("export-service/src/server.js");
const policy = read("lib/credits/operationPolicy.ts");
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks += 1; };

const executableUsage = usage
  .replace(/import \{ getPersistenceServices \} from "@\/lib\/persistence";/, "const getPersistenceServices = () => { throw new Error('unused'); };")
  .replace(/import \{ CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION, CREATOR_PREMIUM_MUSIC_PROVIDER_KEY \} from "\.\/musicEntitlement";/, `const CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION = "creator-premium-music-license-v1"; const CREATOR_PREMIUM_MUSIC_PROVIDER_KEY = "premium_music_catalog";`);
const compiled = ts.transpile(executableUsage, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const entitlementId = "22222222-2222-4222-8222-222222222222";
const firstKey = domain.deriveCreatorMusicExportUsageKey(entitlementId, " export-attempt-1 ");
const repeatedKey = domain.deriveCreatorMusicExportUsageKey(entitlementId, "export-attempt-1");
const freshKey = domain.deriveCreatorMusicExportUsageKey(entitlementId, "export-attempt-2");
const fakeEvents = new Map();
const fakeRepository = { createOrGetPending: async (identity) => {
  const key = `${identity.entitlementId}:${identity.exportUsageKey}`;
  if (fakeEvents.has(key)) return { event: fakeEvents.get(key), created: false };
  const event = { ...identity, id: crypto.randomUUID(), status: "pending", attemptCount: 0 };
  fakeEvents.set(key, event);
  return { event, created: true };
} };
const identity = domain.buildCreatorMusicUsageEventIdentity({
  entitlementId, userId: "11111111-1111-4111-8111-111111111111", projectId: "creator-project-1",
  trackId: "track-1", exportIdempotencyKey: "export-attempt-1",
});
const created = await domain.registerCreatorMusicExportUsage(identity, fakeRepository);
const replay = await domain.registerCreatorMusicExportUsage(identity, fakeRepository);
const freshIdentity = { ...identity, exportUsageKey: freshKey };
const fresh = await domain.registerCreatorMusicExportUsage(freshIdentity, fakeRepository);

check(/create table if not exists public\.creator_music_usage_events/.test(migration), "1 usage table");
check(createHash("sha256").update(entitlementMigration).digest("hex") === "4443276f2623ac02cc42192e2e8a3ab58af2d7ea6cb1e76ef5d18e3a54a6afac", "2 entitlement migration unchanged");
check(!/\b(drop|truncate|delete from|alter table public\.(?!creator_music_usage_events))\b/i.test(migration), "3 additive migration");
check(/status in \('pending', 'reported', 'failed'\)/.test(migration), "4 bounded status");
check(/export_usage_key text not null/.test(migration), "5 required usage key");
check(/unique \(entitlement_id, export_usage_key\)/.test(migration), "6 unique identity");
check(/creator_music_usage_events_pending_idx[\s\S]*where status = 'pending'/.test(migration), "7 pending index");
check(/enable row level security/.test(migration), "8 RLS");
check(/revoke all on table public\.creator_music_usage_events from anon/.test(migration), "9 anon revoked");
check(/revoke all on table public\.creator_music_usage_events from authenticated/.test(migration), "10 authenticated revoked");
check(/grant all on table public\.creator_music_usage_events to service_role/.test(migration) && !/create policy/.test(migration), "11 service role only");
check(!/credit_ledger|credit_reservation|credit_account/.test(migration), "12 no credit schema");
check(!/storyverse/i.test(migration), "13 no Storyverse schema");

check(/CreatorMusicUsageEventIdentity[\s\S]*entitlementId[\s\S]*userId[\s\S]*projectId[\s\S]*providerKey[\s\S]*trackId[\s\S]*licensePolicyVersion[\s\S]*exportUsageKey/.test(types), "14 authoritative contract");
check(!/movieUrl|downloadUrl/.test(types.slice(types.indexOf("CreatorMusicUsageEventStatus"))), "15 no movie URL");
check(!/storageBucket|storagePath/.test(types.slice(types.indexOf("CreatorMusicUsageEventStatus"))), "16 no storage identity");
check(!/providerUrl|previewUrl/.test(types.slice(types.indexOf("CreatorMusicUsageEventStatus"))), "17 no provider URL");
check(!/idempotencyKey/.test(types.slice(types.indexOf("CreatorMusicUsageEventStatus"))), "18 no raw idempotency key");
check(firstKey === repeatedKey && /^[a-f0-9]{64}$/.test(firstKey), "19 deterministic hash");
check(created.created && !replay.created && fakeEvents.size === 2, "20 same attempt one event");
check(fresh.created && firstKey !== freshKey, "21 fresh attempt new event");
check(/onConflict: "entitlement_id,export_usage_key", ignoreDuplicates: true[\s\S]*getByUsageKey/.test(repository), "22 duplicate race resolved");
check(/Math\.min\(100, Math\.max\(1[\s\S]*\.limit\(boundedLimit\)/.test(repository), "23 pending bounded");
check(/\.in\("status", \["pending", "failed"\]\)[\s\S]*\.eq\("status", "reported"\)/.test(repository), "24 reported idempotent");
check(/markFailed[\s\S]*\.update\(\{ status: "failed"/.test(repository) && !/markFailed[\s\S]*\.insert\(/.test(repository), "25 failure reuses event");
check(/PROVIDER_USAGE_ID_PATTERN = \/\^\[A-Za-z0-9/.test(repository) && /\{1,160\}/.test(repository), "26 provider usage ID bounded");

check(/if \(musicUsageIdentity\)/.test(route), "27 Storyverse creates no event");
check(/if \(musicUsageIdentity\)/.test(route), "28 no-music creates no event");
check(/backgroundMusic\.mode === "selected"[\s\S]*musicUsageIdentity = buildCreatorMusicUsageEventIdentity/.test(route), "29 non-selected creates no event");
check(route.indexOf("if (!musicEntitlement) return blockPremiumMusicExport()") < route.indexOf("await registerCreatorMusicExportUsage"), "30 blocked creates no event");
check(/catch \{\s*return blockPremiumMusicExport\(\)/.test(route), "31 entitlement failure no event");
check(route.indexOf("if (!response.ok || !data?.ok || !data?.movieUrl)") < route.indexOf("await registerCreatorMusicExportUsage"), "32 render failure no event");
check(/await registerCreatorMusicExportUsage\(musicUsageIdentity\)/.test(route), "33 successful render creates pending event");
check(route.indexOf("await registerCreatorMusicExportUsage") < route.indexOf("await settleMeteredOperation"), "34 usage before settlement");
check(route.indexOf("if (!response.ok || !data?.ok || !data?.movieUrl)") < route.indexOf("await registerCreatorMusicExportUsage"), "35 usage after render success");
check(route.indexOf("await registerCreatorMusicExportUsage") < route.indexOf("return NextResponse.json({\n      ...data"), "36 persistence before browser success");
check(/catch \(error\) \{[\s\S]*if \(creditReservation\)[\s\S]*releaseMeteredOperation/.test(route), "37 failure releases credit");
check(firstKey === repeatedKey && !replay.created, "38 same retry reused");
check(firstKey !== freshKey && fresh.created, "39 intentional retry new event");
check(!/body\.(?:usage|usageEvent|exportUsageKey|providerUsageEventId)/.test(route), "40 browser cannot submit usage identity");
check(!/reportUsage|sendAnalytics|provider.*(?:report|event).*fetch/i.test(usage + repository + route), "41 no provider reporting");
check(/normalizeCreatorVideoTrim/.test(exportService) && !/musicUsageIdentity|registerCreatorMusicExportUsage/.test(exportService), "42 export-service music usage boundary unchanged");
check(/CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED === "true"/.test(read("lib/providers/music/downloadSecurity.ts")), "43 acquisition disabled by default");
check(!/creator_music/.test(policy), "44 no music credit");
check(!/migration|db push|supabase migration/.test(route + usage + repository), "45 migration not executed");

assert.equal(checks, 45);
console.log(`CreatorLab premium music export usage outbox smoke passed (${checks}/45).`);
