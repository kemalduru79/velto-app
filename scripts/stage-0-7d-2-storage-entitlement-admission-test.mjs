import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const migration = read("supabase/migrations/20260818220000_stage_0_7d_2_storage_entitlements_admissions.sql");
const admission = read("lib/persistence/media/storageAdmission.server.ts");
const entitlement = read("lib/persistence/media/storageEntitlement.server.ts");
const quota = read("lib/persistence/media/storageQuota.server.ts");
const image = read("app/api/image/route.ts");
const video = read("app/api/video/route.ts");
const creatorStoreImage = read("app/api/creator-store-image/route.ts");
const storyStoreImage = read("app/api/store-image/route.ts");
const storyStoreVideo = read("app/api/store-video/route.ts");
const creatorStoreVideo = read("app/api/creator-store-video/route.ts");
const page = read("app/create/page.tsx");
const liveSmoke = read("scripts/stage-0-7d-2-live-entitlement-admission-smoke.mjs");

const now = Date.parse("2026-08-18T12:00:00.000Z");
const grants = [
  { owner: "a", bytes: 10, status: "active", starts: now - 1, expires: null, revoked: null },
  { owner: "a", bytes: 20, status: "active", starts: now - 1, expires: now + 1, revoked: null },
  { owner: "a", bytes: 40, status: "active", starts: now + 1, expires: null, revoked: null },
  { owner: "a", bytes: 80, status: "active", starts: now - 2, expires: now - 1, revoked: null },
  { owner: "a", bytes: 160, status: "revoked", starts: now - 1, expires: null, revoked: now - 1 },
  { owner: "b", bytes: 320, status: "active", starts: now - 1, expires: null, revoked: null },
];
const additional = (owner) => grants.filter((g) => g.owner === owner && g.status === "active" && g.starts <= now && (g.expires === null || g.expires > now) && g.revoked === null).reduce((sum, g) => sum + g.bytes, 0);
assert.equal(additional("none"), 0, "no entitlement");
assert.equal(additional("a"), 30, "multiple currently active grants sum; future/expired/revoked excluded");
assert.equal(additional("b"), 320, "wrong owner excluded");
assert.equal(100 + additional("a"), 130, "base plus additional entitlement");
assert.deepEqual({ configured: false, effective: null, additional: additional("a") }, { configured: false, effective: null, additional: 30 });

assert.match(migration, /create table if not exists public\.velto_storage_entitlements/);
assert.match(migration, /bytes_granted bigint not null check \(bytes_granted > 0\)/);
assert.match(migration, /status in \('active', 'revoked'\)/);
assert.match(migration, /source in \('manual', 'payment_provider', 'promotion', 'migration'\)/);
assert.match(migration, /unique index[\s\S]*\(source, external_reference\)[\s\S]*where external_reference is not null/);
assert.match(migration, /e\.owner_user_id = p_owner_user_id[\s\S]*e\.starts_at <= now\(\)[\s\S]*e\.expires_at is null or e\.expires_at > now\(\)[\s\S]*e\.revoked_at is null/);
assert.match(migration, /enable row level security/g);
assert.equal((migration.match(/security definer\s+set search_path = ''/g) || []).length, 4);
assert.match(migration, /revoke all on table public\.velto_storage_entitlements from public, anon, authenticated/);
assert.doesNotMatch(migration, /grant (?:insert|update|delete|all)[^;]*authenticated|create policy/);
assert.match(entitlement, /velto_get_additional_storage_bytes/);
assert.match(quota, /config\.limitBytes \+ additionalEntitlementBytes/);
assert.match(quota, /baseLimitBytes: null[\s\S]*additionalEntitlementBytes[\s\S]*effectiveLimitBytes: null/);

assert.match(migration, /create table if not exists public\.velto_storage_admissions/);
assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/);
assert.match(migration, /expires_at timestamptz not null/);
assert.match(migration, /for update/);
assert.match(migration, /a\.owner_user_id = p_owner_user_id/);
assert.match(migration, /expires_at <= now\(\)[\s\S]*'expired'/);
assert.match(migration, /media_kind <> p_media_kind[\s\S]*'media_kind_mismatch'/);
assert.match(migration, /purpose <> p_purpose[\s\S]*'purpose_mismatch'/);
assert.match(migration, /consumption_started_at is not null[\s\S]*'consumption_pending'/);
assert.match(migration, /gen_random_uuid\(\)/);
assert.match(migration, /consumption_token is distinct from p_consumption_token[\s\S]*'token_mismatch'/);
assert.match(migration, /set consumed_at = now\(\), consumption_started_at = null, consumption_token = null/);
assert.match(migration, /set consumption_started_at = null, consumption_token = null[\s\S]*return 'aborted'/);
for (const fn of ["velto_begin_storage_admission_consumption", "velto_complete_storage_admission_consumption", "velto_abort_storage_admission_consumption"]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*grant execute[\\s\\S]*service_role`));
}

assert.match(admission, /DEFAULT_STORAGE_ADMISSION_TTL_MINUTES = 60/);
assert.match(admission, /parsed > 0/);
assert.match(admission, /\.from\("velto_storage_admissions"\)[\s\S]*\.insert\(/);
assert.doesNotMatch(admission, /NEXT_PUBLIC.*ADMISSION/);
const durableBranch = admission.slice(admission.indexOf("if (durableStorageStarted)"), admission.indexOf("} else {", admission.indexOf("if (durableStorageStarted)")));
assert.doesNotMatch(durableBranch, /abortStorageAdmissionConsumption/);
assert.match(admission, /STORAGE_ADMISSION_RECOVERY_REQUIRED/);

for (const route of [creatorStoreImage, storyStoreImage, storyStoreVideo]) {
  assert.match(route, /storageAdmissionId/);
  assert.match(route, /consumeStorageAdmissionForMedia/);
  assert.ok(route.indexOf("consumeStorageAdmissionForMedia") < route.indexOf("uploadPublic"), "admission begins before upload");
}
assert.match(creatorStoreImage, /purpose: "creator_generated_image"/);
assert.match(storyStoreImage, /purpose: "storyverse_generated_image"/);
assert.match(storyStoreVideo, /purpose: "storyverse_generated_video"/);
assert.match(image, /checkStorageGenerationAllowance[\s\S]*issueStorageAdmissionForOwner[\s\S]*reserveMeteredOperation[\s\S]*\.generate\(/);
assert.match(video, /checkStorageGenerationAllowance[\s\S]*issueStorageAdmissionForOwner[\s\S]*createTask\(/);
assert.match(image, /storageAdmissionId/);
assert.match(video, /storageAdmissionId/);
assert.match(page, /storageAdmissionId: imageData\.storageAdmissionId/);
assert.match(page, /videoStorageAdmissionId/);
assert.match(page, /storageAdmissionId,[\s\S]*sceneId/);
assert.match(creatorStoreVideo, /validatePersistedVideoJobBinding/);
assert.doesNotMatch(creatorStoreVideo, /storageAdmissionId/);

const state = { pending: false, consumed: false };
const begin = () => state.consumed ? "consumed" : state.pending ? "consumption_pending" : (state.pending = true, "ready");
const abort = () => { assert.equal(state.pending, true); state.pending = false; return "aborted"; };
const complete = () => { assert.equal(state.pending, true); state.pending = false; state.consumed = true; return "consumed"; };
assert.equal(begin(), "ready");
assert.equal(begin(), "consumption_pending", "parallel begin rejected");
assert.equal(abort(), "aborted");
assert.equal(begin(), "ready", "abort restores use before expiry");
assert.equal(complete(), "consumed");
assert.equal(begin(), "consumed", "consumed admission cannot replay");

assert.doesNotMatch(creatorStoreImage + storyStoreImage + storyStoreVideo, /checkStorageGenerationAllowance/);
assert.match(admission, /operation: \(markDurableStorageStarted/);
assert.match(read(".env.container.example"), /VELTO_STORAGE_ADMISSION_TTL_MINUTES=60/);
assert.match(read(".env.container.example"), /VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED=false/);
assert.doesNotMatch(migration + admission + quota + page, /stripe|paddle|lemon|iyzico|checkout|pricing card|subscription/i);

assert.match(liveSmoke, /args\.length !== 1 \|\| args\[0\] !== "--apply"/);
assert.match(liveSmoke, /VELTO_LIVE_STORAGE_SMOKE_CONFIRM !== REQUIRED_CONFIRMATION/);
assert.match(liveSmoke, /STAGE_0_7D_2_DISPOSABLE_ONLY/);
assert.match(liveSmoke, /console\.log\("NO_MUTATION"\)/);
assert.ok((liveSmoke.match(/randomUUID\(\)/g) || []).length >= 6, "live smoke generates all test identities internally");
assert.doesNotMatch(liveSmoke, /\.storage\.from|\.upload\(|\.remove\(|uploadPublic|safeRemoteMediaFetch|generate\(|createTask\(|provider|reserveMeteredOperation|credit/i);
assert.match(liveSmoke, /generatedIds = \{[\s\S]*entitlementId, duplicateEntitlementId[\s\S]*admissionId, expiredAdmissionId/);
assert.match(liveSmoke, /verifyDisposableRows\(table, ids\)[\s\S]*ids\.includes\(row\.id\)[\s\S]*row\.owner_user_id === ownerUserId[\s\S]*row\.metadata\?\.stage === STAGE && row\.metadata\?\.disposable === true/);
assert.match(liveSmoke, /\.delete\(\)[\s\S]*\.eq\("id", row\.id\)[\s\S]*\.eq\("owner_user_id", ownerUserId\)[\s\S]*\.contains\("metadata", disposableMetadata\)/);
assert.match(liveSmoke, /additionalBytesAfter === additionalBytesBefore/);
assert.match(liveSmoke, /status: "CLEANUP_REQUIRED"/);
assert.match(liveSmoke, /STAGE_0_7D_2_LIVE_ENTITLEMENT_ADMISSION_SMOKE=PASS/);
assert.doesNotMatch(liveSmoke, /velto_media_assets|velto_projects|credit_accounts|VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED|VELTO_PERMANENT_MEDIA_DELETE_ENABLED|db push|db reset|migration repair/i);

console.log("stage-0.7d-2 storage entitlement/admission: all checks passed");
