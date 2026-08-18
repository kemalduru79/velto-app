import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function loadPending() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("velto_media_assets")
      .select("id,owner_user_id,bucket,storage_path,size_bytes,purge_token,purge_started_at,lifecycle_state")
      .eq("lifecycle_state", "trashed").not("purge_started_at", "is", null)
      .not("purge_token", "is", null).range(from, from + 499);
    if (error) throw new Error(`Pending purge inventory failed: ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < 500) return rows;
  }
}

async function classifyObject(asset) {
  try {
    const slash = asset.storage_path.lastIndexOf("/");
    const directory = slash >= 0 ? asset.storage_path.slice(0, slash) : "";
    const name = slash >= 0 ? asset.storage_path.slice(slash + 1) : asset.storage_path;
    const { data, error } = await supabase.storage.from(asset.bucket).list(directory, { limit: 2, search: name });
    if (error) return { state: "UNKNOWN_ERROR", message: error.message };
    return { state: (data || []).some((item) => item.name === name) ? "OBJECT_PRESENT" : "OBJECT_MISSING" };
  } catch (error) {
    return { state: "UNKNOWN_ERROR", message: error instanceof Error ? error.message : "unknown error" };
  }
}

const pending = await loadPending();
const inspected = [];
for (const asset of pending) inspected.push({ asset, ...(await classifyObject(asset)) });

let finalized = 0;
let finalizeErrors = 0;
if (apply) {
  for (const item of inspected) {
    if (item.state !== "OBJECT_MISSING") continue;
    const { data, error } = await supabase.rpc("velto_complete_media_asset_purge", {
      p_owner_user_id: item.asset.owner_user_id,
      p_asset_id: item.asset.id,
      p_purge_token: item.asset.purge_token,
    });
    if (error || data !== "purged") finalizeErrors += 1;
    else finalized += 1;
  }
}

for (const item of inspected) {
  console.log(JSON.stringify({ assetId: item.asset.id, state: item.state, sizeBytes: Number(item.asset.size_bytes), ...(item.message ? { error: item.message } : {}) }));
}
const summary = {
  mode: apply ? "APPLY" : "DRY_RUN",
  pendingCount: inspected.length,
  missingCount: inspected.filter((item) => item.state === "OBJECT_MISSING").length,
  presentCount: inspected.filter((item) => item.state === "OBJECT_PRESENT").length,
  errorCount: inspected.filter((item) => item.state === "UNKNOWN_ERROR").length + finalizeErrors,
  recoverableBytes: inspected.filter((item) => item.state === "OBJECT_MISSING").reduce((sum, item) => sum + Number(item.asset.size_bytes), 0),
  finalizedCount: finalized,
};
console.log(JSON.stringify(summary, null, 2));
if (summary.errorCount > 0) process.exitCode = 2;
