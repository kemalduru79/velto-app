import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CreatorProductionSnapshot, CreatorProductionSnapshotSummary } from "@/lib/creator/creatorProductionHistory";

type CaptureInput = {
  projectId: string;
  ownerUserId: string;
  expectedUpdatedAt: string;
  mutationId: string;
  invalidationReason: string;
  sourceScriptRevision: number;
  scriptFingerprint: string;
  approvalFingerprint: string;
};

const mapSummary = (row: Record<string, unknown>): CreatorProductionSnapshotSummary => ({
  id: String(row.id || ""),
  projectId: String(row.project_id || ""),
  sourceScriptRevision: Number(row.source_script_revision || 0),
  invalidationReason: String(row.invalidation_reason || "script_changed"),
  invalidatedAt: String(row.invalidated_at || ""),
  createdAt: String(row.created_at || ""),
  sceneCount: Number(row.scene_count || 0),
  hasFinalVideo: Boolean(row.has_final_video),
});

export async function captureCreatorProductionSnapshotBeforeInvalidation(input: CaptureInput) {
  const { data, error } = await createServerSupabaseClient().rpc("velto_capture_creator_production_snapshot", {
    p_owner_user_id: input.ownerUserId,
    p_project_id: input.projectId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_mutation_id: input.mutationId,
    p_invalidation_reason: input.invalidationReason,
    p_source_script_revision: input.sourceScriptRevision,
    p_script_fingerprint: input.scriptFingerprint,
    p_approval_fingerprint: input.approvalFingerprint,
  });
  if (error) throw new Error(`CREATOR_PRODUCTION_SNAPSHOT_FAILED:${error.message}`);
  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  if (!result || result.qualified !== true || typeof result.snapshotId !== "string") {
    throw new Error("CREATOR_PRODUCTION_SNAPSHOT_FAILED:QUALIFYING_PRODUCTION_NOT_CAPTURED");
  }
  return { snapshotId: result.snapshotId, created: result.created === true };
}

export async function listCreatorProductionSnapshotsForOwner(projectId: string, ownerUserId: string) {
  const { data, error } = await createServerSupabaseClient()
    .from("velto_creator_production_snapshots")
    .select("id,project_id,source_script_revision,invalidation_reason,invalidated_at,created_at,scene_count,has_final_video")
    .eq("project_id", projectId)
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Creator production history could not be listed: ${error.message}`);
  return (data || []).map((row) => mapSummary(row as Record<string, unknown>));
}

export async function getCreatorProductionSnapshotForOwner(input: {
  projectId: string;
  snapshotId: string;
  ownerUserId: string;
}): Promise<CreatorProductionSnapshot | null> {
  const { data, error } = await createServerSupabaseClient()
    .from("velto_creator_production_snapshots")
    .select("id,project_id,source_script_revision,invalidation_reason,invalidated_at,created_at,scene_count,has_final_video,mutation_id,script_fingerprint,approval_fingerprint,snapshot_json,velto_creator_production_snapshot_media_refs(count)")
    .eq("id", input.snapshotId)
    .eq("project_id", input.projectId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle();
  if (error) throw new Error(`Creator production history could not be read: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  const referenceAggregate = Array.isArray(row.velto_creator_production_snapshot_media_refs)
    ? row.velto_creator_production_snapshot_media_refs[0] as Record<string, unknown> | undefined
    : undefined;
  return {
    ...mapSummary(row),
    mutationId: String(row.mutation_id || ""),
    scriptFingerprint: String(row.script_fingerprint || ""),
    approvalFingerprint: String(row.approval_fingerprint || ""),
    snapshot: row.snapshot_json && typeof row.snapshot_json === "object" && !Array.isArray(row.snapshot_json)
      ? row.snapshot_json as Record<string, unknown>
      : {},
    mediaReferenceCount: Number(referenceAggregate?.count || 0),
  };
}
