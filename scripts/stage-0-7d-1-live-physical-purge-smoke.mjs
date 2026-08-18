import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_CONFIRMATION = "STAGE_0_7D_1_DISPOSABLE_ONLY";
const TEST_BUCKET = "images";
const TEST_PREFIX = "stage-0-7d-1-live-smoke/";
const TEST_STAGE = "0.7D-1-live-physical-smoke";
const args = process.argv.slice(2);

if (args.length !== 1 || args[0] !== "--apply" || process.env.VELTO_LIVE_PURGE_SMOKE_CONFIRM !== REQUIRED_CONFIRMATION) {
  console.log(JSON.stringify({
    mode: "NO_MUTATION",
    requiredFlag: "--apply",
    requiredConfirmation: "VELTO_LIVE_PURGE_SMOKE_CONFIRM=STAGE_0_7D_1_DISPOSABLE_ONLY",
  }, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const generatedAssetId = randomUUID();
const generatedTestPath = `${TEST_PREFIX}${generatedAssetId}.png`;
const generatedFileName = `${generatedAssetId}.png`;
const pngBytes = createTinyTestPng();
let ownerUserId = "";
let uploadAttempted = false;
let registrationAttempted = false;
let rowRegistered = false;
let physicalDeletionSucceeded = false;
let purgeCompleted = false;
let purgeToken = "";
let usageBefore = 0;
let usageAfterRegister = 0;

function createTinyTestPng() {
  // Generated in-memory 1x1 transparent PNG; no user or repository media is read.
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw5nAAAAAElFTkSuQmCC", "base64");
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function isDisposableRow(row) {
  return row?.id === generatedAssetId
    && row?.owner_user_id === ownerUserId
    && row?.bucket === TEST_BUCKET
    && row?.storage_path === generatedTestPath
    && row?.metadata?.stage === TEST_STAGE
    && row?.metadata?.disposable === true;
}

async function getPhysicalUsageForOwner() {
  let total = 0;
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("velto_media_assets")
      .select("size_bytes,lifecycle_state")
      .eq("owner_user_id", ownerUserId)
      .neq("lifecycle_state", "purged")
      .range(from, from + 499);
    if (error) throw new Error(`Physical usage query failed: ${error.message}`);
    for (const row of data || []) total += Number(row.size_bytes);
    if ((data || []).length < 500) return total;
  }
}

async function getGeneratedRow() {
  const { data, error } = await supabase.from("velto_media_assets")
    .select("id,owner_user_id,bucket,storage_path,size_bytes,lifecycle_state,trashed_at,purged_at,purge_started_at,purge_token,metadata")
    .eq("id", generatedAssetId)
    .maybeSingle();
  if (error) throw new Error(`Synthetic registry lookup failed: ${error.message}`);
  return data;
}

async function generatedObjectExists() {
  const { data, error } = await supabase.storage.from(TEST_BUCKET)
    .list(TEST_PREFIX.slice(0, -1), { limit: 2, search: generatedFileName });
  if (error) throw new Error(`Exact object verification failed: ${error.message}`);
  return (data || []).some((item) => item.name === generatedFileName);
}

async function removeExactGeneratedObject() {
  const { error } = await supabase.storage.from(TEST_BUCKET).remove([generatedTestPath]);
  if (error) throw new Error(`Exact Storage removal failed: ${error.message}`);
}

async function cleanUpBeforePhysicalDeletion() {
  if (!uploadAttempted && !registrationAttempted) return;
  const row = registrationAttempted ? await getGeneratedRow() : null;
  if (row && !isDisposableRow(row)) throw new Error("Cleanup refused: synthetic registry identity mismatch.");
  rowRegistered = Boolean(row);
  if (purgeToken) {
    const { data, error } = await supabase.rpc("velto_abort_media_asset_purge", {
      p_owner_user_id: ownerUserId,
      p_asset_id: generatedAssetId,
      p_purge_token: purgeToken,
    });
    if (error || data !== "aborted") throw new Error(`Cleanup refused: purge abort failed (${error?.message || data}).`);
    purgeToken = "";
  }
  if (uploadAttempted && await generatedObjectExists()) await removeExactGeneratedObject();
  if (rowRegistered) {
    const { error } = await supabase.from("velto_media_assets").delete()
      .eq("id", generatedAssetId)
      .eq("owner_user_id", ownerUserId)
      .eq("bucket", TEST_BUCKET)
      .eq("storage_path", generatedTestPath);
    if (error) throw new Error(`Synthetic registry cleanup failed: ${error.message}`);
  }
}

try {
  ensure(generatedTestPath === `stage-0-7d-1-live-smoke/${generatedAssetId}.png`, "Generated path escaped the smoke prefix.");
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (usersError) throw new Error(`Existing owner lookup failed: ${usersError.message}`);
  ownerUserId = usersPage.users[0]?.id || "";
  ensure(ownerUserId.length > 0, "No existing owner is available for the disposable smoke asset.");

  usageBefore = await getPhysicalUsageForOwner();
  uploadAttempted = true;
  const { data: upload, error: uploadError } = await supabase.storage.from(TEST_BUCKET)
    .upload(generatedTestPath, pngBytes, { contentType: "image/png", upsert: false });
  if (uploadError) throw new Error(`Disposable PNG upload failed: ${uploadError.message}`);
  ensure(upload?.path === generatedTestPath, "Storage returned an unexpected upload path.");
  ensure(await generatedObjectExists(), "Disposable PNG was not found after upload.");

  const metadata = { stage: TEST_STAGE, disposable: true };
  registrationAttempted = true;
  const { data: inserted, error: insertError } = await supabase.from("velto_media_assets").insert({
    id: generatedAssetId,
    owner_user_id: ownerUserId,
    bucket: TEST_BUCKET,
    storage_path: generatedTestPath,
    public_url: null,
    media_kind: "image",
    mime_type: "image/png",
    size_bytes: pngBytes.byteLength,
    lifecycle_state: "active",
    metadata,
  }).select("id,owner_user_id,bucket,storage_path,size_bytes,lifecycle_state,metadata").single();
  if (insertError) throw new Error(`Disposable registry insert failed: ${insertError.message}`);
  rowRegistered = true;
  ensure(isDisposableRow(inserted), "Inserted registry row does not match the generated disposable identity.");
  ensure(Number(inserted.size_bytes) === pngBytes.byteLength, "Inserted registry size does not match the generated PNG.");

  usageAfterRegister = await getPhysicalUsageForOwner();
  ensure(usageAfterRegister === usageBefore + pngBytes.byteLength, "Physical usage did not increase by the exact test asset size.");

  const { data: trashStatus, error: trashError } = await supabase.rpc("velto_trash_media_asset_if_unreferenced", {
    p_owner_user_id: ownerUserId,
    p_asset_id: generatedAssetId,
  });
  if (trashError || trashStatus !== "trashed") throw new Error(`Trash failed: ${trashError?.message || trashStatus}`);

  const { data: beginRows, error: beginError } = await supabase.rpc("velto_begin_media_asset_purge", {
    p_owner_user_id: ownerUserId,
    p_asset_id: generatedAssetId,
    p_retention_days: 0,
  });
  if (beginError) throw new Error(`BEGIN PURGE failed: ${beginError.message}`);
  ensure(Array.isArray(beginRows) && beginRows.length === 1 && beginRows[0].status === "ready", "BEGIN PURGE did not return ready.");
  const begun = beginRows[0];
  ensure(begun.asset_id === generatedAssetId && begun.bucket === TEST_BUCKET && begun.storage_path === generatedTestPath, "BEGIN PURGE returned unexpected object identity.");
  ensure(typeof begun.purge_token === "string" && begun.purge_token.length > 0, "BEGIN PURGE did not return a purge token.");
  ensure(Number(begun.size_bytes) === pngBytes.byteLength, "BEGIN PURGE returned an unexpected size.");
  purgeToken = begun.purge_token;

  const pendingRow = await getGeneratedRow();
  ensure(isDisposableRow(pendingRow), "Pre-delete registry identity verification failed.");
  ensure(pendingRow.lifecycle_state === "trashed" && pendingRow.purge_started_at && pendingRow.purge_token === purgeToken, "Pre-delete purge coordination state is invalid.");
  ensure(await generatedObjectExists(), "Disposable object disappeared before the exact purge delete.");

  await removeExactGeneratedObject();
  physicalDeletionSucceeded = true;
  ensure(!(await generatedObjectExists()), "Exact Storage object still exists after removal.");

  const { data: completeStatus, error: completeError } = await supabase.rpc("velto_complete_media_asset_purge", {
    p_owner_user_id: ownerUserId,
    p_asset_id: generatedAssetId,
    p_purge_token: purgeToken,
  });
  if (completeError || completeStatus !== "purged") throw new Error(`COMPLETE PURGE failed: ${completeError?.message || completeStatus}`);
  purgeCompleted = true;

  const auditedRow = await getGeneratedRow();
  ensure(isDisposableRow(auditedRow), "Purged registry audit row is missing or changed identity.");
  ensure(auditedRow.lifecycle_state === "purged" && auditedRow.purged_at, "Registry lifecycle did not finalize as purged.");
  ensure(auditedRow.purge_started_at === null && auditedRow.purge_token === null, "Purge coordination fields were not cleared.");
  const usageAfterPurge = await getPhysicalUsageForOwner();
  ensure(usageAfterRegister - usageAfterPurge === pngBytes.byteLength, "Physical usage did not decrease by the exact test asset size.");
  ensure(usageAfterPurge === usageBefore, "Physical usage did not return to the owner baseline.");

  console.log(JSON.stringify({
    status: "PASS",
    assetId: generatedAssetId,
    bucket: TEST_BUCKET,
    storagePath: generatedTestPath,
    sizeBytes: pngBytes.byteLength,
    usageBefore,
    usageAfterRegister,
    usageAfterPurge,
    lifecycleState: auditedRow.lifecycle_state,
    auditRowRetained: true,
  }, null, 2));
  console.log("STAGE_0_7D_1_LIVE_PHYSICAL_PURGE_SMOKE=PASS");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown live purge smoke failure";
  if (physicalDeletionSucceeded) {
    if (!purgeCompleted) {
      console.error("RECOVERY_REQUIRED");
      console.error(JSON.stringify({ status: "RECOVERY_REQUIRED", assetId: generatedAssetId, sizeBytes: pngBytes.byteLength, error: message }, null, 2));
    } else {
      console.error(JSON.stringify({ status: "FAIL_AFTER_COMPLETE", assetId: generatedAssetId, sizeBytes: pngBytes.byteLength, auditRowPreserved: true, error: message }, null, 2));
    }
  } else {
    try {
      await cleanUpBeforePhysicalDeletion();
    } catch (cleanupError) {
      console.error(JSON.stringify({ status: "CLEANUP_FAILED", assetId: generatedAssetId, error: cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup failure" }, null, 2));
    }
    console.error(JSON.stringify({ status: "FAIL", assetId: generatedAssetId, error: message }, null, 2));
  }
  process.exitCode = 1;
}
