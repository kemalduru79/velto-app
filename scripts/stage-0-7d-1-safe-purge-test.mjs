import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadTs(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const read = (file) => fs.readFileSync(file, "utf8");
const policy = await loadTs("lib/persistence/media/purgePolicy.ts");
const migration = read("supabase/migrations/20260818200000_stage_0_7d_1_safe_media_purge.sql");
const correctiveMigration = read("supabase/migrations/20260818203000_stage_0_7d_1_fix_purge_reference_ambiguity.sql");
const referenceMigration = read("supabase/migrations/20260818160000_stage_0_7b_safe_media_trash.sql");
const mediaRepo = read("lib/persistence/media/supabaseMediaAssetRepository.ts");
const storageRepo = read("lib/persistence/storage/supabaseObjectStorageRepository.ts");
const orchestrator = read("lib/persistence/media/mediaPurge.server.ts");
const recovery = read("scripts/stage-0-7d-1-purge-recovery.mjs");
const api = read("app/api/media-assets/[assetId]/purge/route.ts");
const restoreApi = read("app/api/media-assets/[assetId]/restore/route.ts");
const inventory = read("app/api/media-assets/route.ts");
const ui = read("components/create/CreatorProjectAssets.tsx");

assert.deepEqual(policy.resolveMediaPurgeConfiguration({}), { retentionDays: 30, permanentDeleteEnabled: false });
assert.equal(policy.resolveMediaPurgeConfiguration({ VELTO_TRASH_RETENTION_DAYS: "bad" }).retentionDays, 30);
assert.equal(policy.resolveMediaPurgeConfiguration({ VELTO_TRASH_RETENTION_DAYS: "0" }).retentionDays, 0);
assert.equal(policy.resolveMediaPurgeConfiguration({ VELTO_TRASH_RETENTION_DAYS: "7", VELTO_PERMANENT_MEDIA_DELETE_ENABLED: "true" }).permanentDeleteEnabled, true);
assert.equal(policy.resolveMediaPurgeConfiguration({ VELTO_PERMANENT_MEDIA_DELETE_ENABLED: "TRUE" }).permanentDeleteEnabled, false);
assert.equal(policy.getMediaPurgeEligibility("2026-01-01T00:00:00.000Z", 30, Date.parse("2026-01-15T00:00:00.000Z")).eligible, false);
assert.equal(policy.getMediaPurgeEligibility("2026-01-01T00:00:00.000Z", 30, Date.parse("2026-02-01T00:00:00.000Z")).eligible, true);

assert.match(migration, /add column if not exists purge_started_at timestamptz/);
assert.match(migration, /add column if not exists purge_token uuid/);
assert.match(migration, /gen_random_uuid\(\)/);
assert.match(migration, /where id = p_asset_id and owner_user_id = p_owner_user_id[\s\S]*for update/);
assert.match(migration, /lifecycle_state <> 'trashed'/);
assert.match(migration, /trashed_at is null/);
assert.match(migration, /v_eligible_at > now\(\)/);
assert.match(migration, /velto_media_asset_references[\s\S]*return query select 'in_use'/);
assert.match(migration, /purge_already_pending/);
assert.match(migration, /purge_token is distinct from p_purge_token/);
assert.match(migration, /lifecycle_state = 'purged', purged_at = now\(\)/);
assert.match(migration, /velto_restore_media_asset[\s\S]*for update[\s\S]*return 'purge_pending'/);
assert.match(referenceMigration, /asset\.lifecycle_state <> 'active'/);
for (const fn of ["velto_begin_media_asset_purge", "velto_complete_media_asset_purge", "velto_abort_media_asset_purge", "velto_restore_media_asset"]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*grant execute[\\s\\S]*service_role`));
}
const correctedBeginRpc = correctiveMigration.match(/create or replace function public\.velto_begin_media_asset_purge[\s\S]*?\n\$\$;/)?.[0] || "";
const correctedReferenceCheck = correctedBeginRpc.match(/if exists \([\s\S]*?\) then/)?.[0] || "";
assert.match(correctedReferenceCheck, /from public\.velto_media_asset_references r\s+where r\.asset_id = p_asset_id\s+and r\.owner_user_id = p_owner_user_id/);
assert.doesNotMatch(correctedReferenceCheck, /where\s+asset_id = p_asset_id|and\s+owner_user_id = p_owner_user_id/);
assert.match(correctiveMigration, /security definer\s+set search_path = public/);
assert.match(correctiveMigration, /revoke all on function public\.velto_begin_media_asset_purge[\s\S]*grant execute[\s\S]*service_role/);

assert.match(mediaRepo, /beginPurgeForOwner/);
assert.match(mediaRepo, /completePurgeForOwner/);
assert.match(mediaRepo, /abortPurgeForOwner/);
assert.match(mediaRepo, /velto_restore_media_asset/);
assert.match(storageRepo, /\.storage\.from\(bucket\)\.remove\(\[path\]\)/);
assert.doesNotMatch(storageRepo, /remove\(\[[^\]]*,|remove\([^[]|recursive|wildcard/i);
const removeAt = orchestrator.indexOf("removeObject");
const completeAt = orchestrator.indexOf("completePurgeForOwner", removeAt);
assert.ok(orchestrator.indexOf("beginPurgeForOwner") < removeAt && removeAt < completeAt);
assert.ok(orchestrator.indexOf("abortPurgeForOwner", removeAt) < completeAt, "storage failure abort occurs before completion phase");
assert.doesNotMatch(orchestrator.slice(completeAt), /abortPurgeForOwner/);
assert.match(orchestrator.slice(completeAt), /MEDIA_PURGE_RECOVERY_REQUIRED/);
assert.match(orchestrator, /bucket: begun\.bucket, path: begun\.storagePath/);

assert.match(recovery, /const apply = process\.argv\.includes\("--apply"\)/);
assert.match(recovery, /OBJECT_PRESENT/);
assert.match(recovery, /OBJECT_MISSING/);
assert.match(recovery, /UNKNOWN_ERROR/);
assert.match(recovery, /if \(item\.state !== "OBJECT_MISSING"\) continue/);
assert.match(recovery, /velto_complete_media_asset_purge/);
assert.doesNotMatch(recovery, /\.remove\(|velto_abort_media_asset_purge/);
for (const field of ["pendingCount", "missingCount", "presentCount", "errorCount", "recoverableBytes"]) assert.match(recovery, new RegExp(field));

assert.match(api, /authenticateRequest\(request\)/);
assert.match(api, /confirmPermanentDeletion !== true/);
assert.match(api, /key !== "confirmPermanentDeletion"/);
assert.match(api, /FEATURE_DISABLED/);
assert.match(api, /purgeMediaAssetForOwner\(principal\.id, assetId\)/);
assert.doesNotMatch(api, /ownerUserId|bucket|storagePath|purgeToken/);
assert.match(restoreApi, /restored !== "restored"/);
assert.match(inventory, /permanentDeleteEligible/);
assert.match(inventory, /references\.length === 0/);

assert.match(ui, /Permanent deletion available in \$\{asset\.purgeDaysRemaining\} days/);
assert.match(ui, /asset\.permanentDeleteEnabled && asset\.permanentDeleteEligible/);
assert.match(ui, /Delete permanently/);
assert.match(ui, /This permanently removes the file and cannot be undone/);
assert.match(ui, /Confirm permanent deletion/);
assert.match(ui, /confirmPermanentDeletion: true/);
assert.match(ui, /await loadCleanupAssets\(\)/);
assert.match(ui, /Items in Trash still use storage/);

const usage = (rows) => rows.filter((row) => row.state !== "purged").reduce((sum, row) => sum + row.bytes, 0);
const rows = [{ state: "active", bytes: 10 }, { state: "trashed", bytes: 20 }];
assert.equal(usage(rows), 30);
rows[1].state = "purged";
assert.equal(usage(rows), 10, "successful complete frees physical quota");
rows[1].state = "trashed";
assert.equal(usage(rows), 30, "failed physical purge remains counted");

assert.doesNotMatch(read("app/api/creator-store-image/route.ts"), /generationAdmission|checkStorageGenerationAllowance/);
assert.doesNotMatch(read("app/api/store-image/route.ts"), /generationAdmission|checkStorageGenerationAllowance/);
assert.doesNotMatch(read("app/api/store-video/route.ts"), /generationAdmission|checkStorageGenerationAllowance/);
assert.match(read("app/api/creator-store-video/route.ts"), /validatePersistedVideoJobBinding/);
assert.doesNotMatch(migration + orchestrator + recovery + api + ui, /cron|schedule|empty trash|bulk delete|checkout|stripe|subscription|payment/i);

console.log("stage-0.7d-1 safe purge: all checks passed");
