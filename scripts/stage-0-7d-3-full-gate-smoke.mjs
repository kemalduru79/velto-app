const { evaluateStorageQuota, StorageQuotaConfigurationValidationError } = await import("../lib/persistence/media/quota.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
let liveUsageVerified = false;
let liveOwnerUsage = null;
if (url && serviceRoleKey) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (usersError) throw new Error("Read-only owner lookup failed.");
  const ownerUserId = usersPage.users[0]?.id;
  if (ownerUserId) {
    const { data, error } = await supabase.from("velto_media_assets").select("size_bytes,lifecycle_state").eq("owner_user_id", ownerUserId);
    if (error) throw new Error("Read-only owner usage lookup failed.");
    liveOwnerUsage = (data || []).filter((row) => row.lifecycle_state !== "purged").reduce((sum, row) => sum + Number(row.size_bytes), 0);
    if (!Number.isSafeInteger(liveOwnerUsage) || liveOwnerUsage < 0) throw new Error("Live owner usage was invalid.");
    liveUsageVerified = true;
  }
}

const usedBytes = liveOwnerUsage && liveOwnerUsage > 0 ? liveOwnerUsage : 100;
const artificialLimit = String(Math.max(1, usedBytes));
const enforced = evaluateStorageQuota(usedBytes, 0, {
  VELTO_STORAGE_LIMIT_BYTES: artificialLimit,
  VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true",
});
if (enforced.decision !== "BLOCKED_FULL" || enforced.allowed !== false) throw new Error("Enforced FULL did not block.");

const disabled = evaluateStorageQuota(usedBytes, 0, {
  VELTO_STORAGE_LIMIT_BYTES: artificialLimit,
  VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "false",
});
if (disabled.decision !== "FULL_BUT_NOT_ENFORCED" || disabled.allowed !== true) throw new Error("Disabled FULL semantics failed.");

for (const env of [
  { VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" },
  { VELTO_STORAGE_LIMIT_BYTES: "malformed", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" },
  { VELTO_STORAGE_LIMIT_BYTES: String(Number.MAX_SAFE_INTEGER), VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" },
]) {
  let failedClosed = false;
  try {
    evaluateStorageQuota(usedBytes, env.VELTO_STORAGE_LIMIT_BYTES === String(Number.MAX_SAFE_INTEGER) ? 1 : 0, env);
  } catch (error) {
    failedClosed = error instanceof StorageQuotaConfigurationValidationError;
  }
  if (!failedClosed) throw new Error("Invalid activation configuration did not fail closed.");
}

const unconfigured = evaluateStorageQuota(usedBytes, 0, { VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "false" });
if (unconfigured.decision !== "UNCONFIGURED" || unconfigured.allowed !== true) throw new Error("Disabled unconfigured behavior regressed.");

console.log(JSON.stringify({ liveUsageVerified, liveOwnerUsage, fixtureUsedForFull: !(liveOwnerUsage > 0), scenarios: 6, writes: 0 }, null, 2));
console.log("STAGE_0_7D_3_FULL_GATE_SMOKE=PASS");
