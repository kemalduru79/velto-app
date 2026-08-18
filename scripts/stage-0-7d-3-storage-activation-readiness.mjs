const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) throw new Error("Supabase readiness credentials are required.");

const { createClient } = await import("@supabase/supabase-js");
const { resolveStorageQuotaConfiguration } = await import("../lib/persistence/media/quota.ts");
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const findings = [];
const add = (category, status, message, details = undefined) => findings.push({ category, status, message, ...(details ? { details } : {}) });
const quotaConfig = resolveStorageQuotaConfiguration(process.env);
add(
  "configuration",
  quotaConfig.configurationIssue ? "ERROR" : "PASS",
  quotaConfig.configurationIssue ? "Storage activation configuration is incomplete or invalid." : "Storage activation configuration is valid.",
);

async function readRows(table, columns) {
  const { data, error } = await supabase.from(table).select(columns).limit(1000);
  if (error) {
    add("infrastructure", "ERROR", `${table} is not readable.`);
    return null;
  }
  add("infrastructure", "PASS", `${table} is readable.`);
  return data || [];
}

const [assets, entitlements, admissions] = await Promise.all([
  readRows("velto_media_assets", "id,lifecycle_state,trashed_at,purged_at,purge_started_at,purge_token"),
  readRows("velto_storage_entitlements", "id,bytes_granted,status,starts_at,expires_at,revoked_at"),
  readRows("velto_storage_admissions", "id,media_kind,purpose,project_reference,created_at,expires_at,consumption_started_at,consumption_token,consumed_at"),
]);

const requiredFunctions = [
  "velto_get_additional_storage_bytes",
  "velto_begin_storage_admission_consumption",
  "velto_complete_storage_admission_consumption",
  "velto_abort_storage_admission_consumption",
  "velto_begin_media_asset_purge",
  "velto_complete_media_asset_purge",
  "velto_abort_media_asset_purge",
];
try {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/openapi+json" },
  });
  const schema = response.ok ? await response.json() : null;
  const paths = schema?.paths || {};
  for (const name of requiredFunctions) {
    const exists = Boolean(paths[`/rpc/${name}`]);
    add("rpc_contract", exists ? "PASS" : "UNVERIFIED", `${name} ${exists ? "is discoverable" : "could not be verified without invocation"}.`);
  }
} catch {
  for (const name of requiredFunctions) add("rpc_contract", "UNVERIFIED", `${name} could not be verified without invocation.`);
}

let pendingPurgeCount = 0;
let malformedMediaCount = 0;
if (assets) {
  for (const row of assets) {
    const purgePair = Boolean(row.purge_started_at) === Boolean(row.purge_token);
    const lifecycleValid = row.lifecycle_state === "active"
      ? !row.trashed_at && !row.purged_at
      : row.lifecycle_state === "trashed"
        ? Boolean(row.trashed_at) && !row.purged_at
        : row.lifecycle_state === "purged" && Boolean(row.purged_at);
    const purgeValid = purgePair && (!row.purge_started_at || row.lifecycle_state === "trashed");
    if (!lifecycleValid || !purgeValid) malformedMediaCount += 1;
    if (row.purge_started_at && row.purge_token) pendingPurgeCount += 1;
  }
}
add("purge_coordination", pendingPurgeCount === 0 ? "PASS" : "RECOVERY_REQUIRED", "Pending purge operations.", { count: pendingPurgeCount });
add("media_coordination", malformedMediaCount === 0 ? "PASS" : "ERROR", "Malformed media lifecycle or purge coordination rows.", { count: malformedMediaCount });

let malformedEntitlementCount = 0;
if (entitlements) {
  for (const row of entitlements) {
    const bytes = Number(row.bytes_granted);
    const lifecycleValid = row.status === "active" ? !row.revoked_at : row.status === "revoked" && Boolean(row.revoked_at);
    const datesValid = !row.expires_at || Date.parse(row.expires_at) > Date.parse(row.starts_at);
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || !lifecycleValid || !datesValid) malformedEntitlementCount += 1;
  }
}
add("entitlements", malformedEntitlementCount === 0 ? "PASS" : "ERROR", "Malformed entitlement lifecycle rows.", { count: malformedEntitlementCount });

let malformedAdmissionCount = 0;
const pendingAdmissions = [];
if (admissions) {
  for (const row of admissions) {
    const pendingPair = Boolean(row.consumption_started_at) === Boolean(row.consumption_token);
    const stateValid = pendingPair && !(row.consumed_at && row.consumption_started_at);
    const kindValid = row.media_kind === "image" || row.media_kind === "video";
    const purposeValid = ["creator_generated_image", "storyverse_generated_image", "storyverse_generated_video", "final_movie_export"].includes(row.purpose);
    if (!stateValid || !kindValid || !purposeValid || Date.parse(row.expires_at) <= Date.parse(row.created_at)) malformedAdmissionCount += 1;
    if (row.consumption_started_at && row.consumption_token && !row.consumed_at) pendingAdmissions.push(row);
  }
}
const oldestPendingAdmissionAgeSeconds = pendingAdmissions.length
  ? Math.max(0, Math.floor((Date.now() - Math.min(...pendingAdmissions.map((row) => Date.parse(row.consumption_started_at)))) / 1000))
  : null;
const pendingAdmissionPurposes = Object.fromEntries([...new Set(pendingAdmissions.map((row) => row.purpose))].sort().map((purpose) => [purpose, pendingAdmissions.filter((row) => row.purpose === purpose).length]));
add("admission_coordination", malformedAdmissionCount === 0 ? "PASS" : "ERROR", "Malformed admission coordination rows.", { count: malformedAdmissionCount });
add("admission_pending", pendingAdmissions.length === 0 ? "PASS" : "RECOVERY_REQUIRED", "Pending admission-consumption operations require operator investigation.", {
  count: pendingAdmissions.length,
  oldestAgeSeconds: oldestPendingAdmissionAgeSeconds,
  purposeDistribution: pendingAdmissionPurposes,
});

const blocking = findings.some((finding) => ["ERROR", "RECOVERY_REQUIRED"].includes(finding.status));
const unverified = findings.some((finding) => finding.status === "UNVERIFIED");
const activationReadiness = quotaConfig.configurationIssue
  ? "NOT_READY_CONFIG"
  : findings.some((finding) => finding.category !== "configuration" && ["ERROR", "RECOVERY_REQUIRED", "UNVERIFIED"].includes(finding.status))
    ? "NOT_READY_INFRASTRUCTURE"
    : quotaConfig.enforcementEnabled ? "READY_ENABLED" : "READY_DISABLED";
const result = !blocking && !unverified ? "READY" : "NOT_READY";
console.log(JSON.stringify({ result, activationReadiness, readOnly: true, findings }, null, 2));
console.log(`STAGE_0_7D_3_STORAGE_ACTIVATION_READINESS=${result}`);
if (result !== "READY") process.exitCode = 1;
