import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAdditionalStorageBytesForOwner(ownerUserId: string) {
  const { data, error } = await createServerSupabaseClient().rpc(
    "velto_get_additional_storage_bytes",
    { p_owner_user_id: ownerUserId },
  );
  if (error) throw new Error(`Storage entitlement resolution failed: ${error.message}`);
  const bytes = Number(data ?? 0);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Storage entitlement total is invalid.");
  return bytes;
}
