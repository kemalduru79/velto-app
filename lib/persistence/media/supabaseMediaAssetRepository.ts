import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MediaAssetRepository,
  MediaUsage,
  ProjectMediaReference,
  RecordStoredAssetInput,
  StoredMediaAsset,
  MediaReferenceSummary,
  BeginMediaPurgeResult,
} from "./types";

type AssetRow = {
  id: string;
  owner_user_id: string;
  bucket: string;
  storage_path: string;
  public_url: string | null;
  media_kind: StoredMediaAsset["mediaKind"];
  mime_type: string | null;
  size_bytes: number | string;
  lifecycle_state: StoredMediaAsset["lifecycleState"];
  trashed_at: string | null;
  purge_started_at?: string | null;
};

const BASE_ASSET_FIELDS: string = "id,owner_user_id,bucket,storage_path,public_url,media_kind,mime_type,size_bytes,lifecycle_state,trashed_at";

function assetFields() {
  return process.env.VELTO_PERMANENT_MEDIA_DELETE_ENABLED === "true"
    ? `${BASE_ASSET_FIELDS},purge_started_at`
    : BASE_ASSET_FIELDS;
}

function asset(row: AssetRow): StoredMediaAsset {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    mediaKind: row.media_kind,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    lifecycleState: row.lifecycle_state,
    trashedAt: row.trashed_at,
    purgeStartedAt: row.purge_started_at ?? null,
  };
}

function requireOwner(value: string) {
  const owner = value.trim();
  if (!owner) throw new Error("Authenticated media owner is required.");
  return owner;
}

export class SupabaseMediaAssetRepository implements MediaAssetRepository {
  async recordStoredAsset(input: RecordStoredAssetInput): Promise<StoredMediaAsset> {
    const ownerUserId = requireOwner(input.ownerUserId);
    const client = createServerSupabaseClient();
    const payload = {
      owner_user_id: ownerUserId,
      bucket: input.bucket,
      storage_path: input.storagePath,
      public_url: input.publicUrl,
      media_kind: input.mediaKind,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      lifecycle_state: "active",
      metadata: input.metadata || {},
    };
    const { data, error } = await client.from("velto_media_assets").insert(payload).select(assetFields()).single();
    if (!error && data) return asset(data as unknown as AssetRow);

    // Physical identity is globally unique. An idempotent replay is allowed only
    // when the existing object's authoritative owner and metadata agree.
    const existing = await this.findByStorageObject(ownerUserId, input.bucket, input.storagePath);
    if (
      existing && existing.sizeBytes === input.sizeBytes &&
      existing.mediaKind === input.mediaKind && existing.mimeType === input.mimeType &&
      existing.publicUrl === input.publicUrl
    ) return existing;
    throw new Error(`Stored media registration failed: ${error?.message || "physical identity conflict"}`);
  }

  async findByStorageObject(ownerUserId: string, bucket: string, storagePath: string) {
    const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
      .select(assetFields()).eq("owner_user_id", requireOwner(ownerUserId)).eq("bucket", bucket)
      .eq("storage_path", storagePath).maybeSingle();
    if (error) throw new Error(`Media asset could not be found: ${error.message}`);
    return data ? asset(data as unknown as AssetRow) : null;
  }

  async findByPublicUrl(ownerUserId: string, publicUrl: string) {
    const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
      .select(assetFields()).eq("owner_user_id", requireOwner(ownerUserId)).eq("public_url", publicUrl).maybeSingle();
    if (error) throw new Error(`Media asset could not be found: ${error.message}`);
    return data ? asset(data as unknown as AssetRow) : null;
  }

  async getForOwner(assetId: string, ownerUserId: string) {
    const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
      .select(assetFields()).eq("id", assetId).eq("owner_user_id", requireOwner(ownerUserId)).maybeSingle();
    if (error) throw new Error(`Media asset could not be read: ${error.message}`);
    return data ? asset(data as unknown as AssetRow) : null;
  }

  async listForOwner(ownerUserId: string) {
    const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
      .select(assetFields()).eq("owner_user_id", requireOwner(ownerUserId)).order("created_at", { ascending: false });
    if (error) throw new Error(`Media inventory could not be listed: ${error.message}`);
    return (data || []).map((row) => asset(row as unknown as AssetRow));
  }

  async getUsageForOwner(ownerUserId: string): Promise<MediaUsage> {
    const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
      .select("media_kind,size_bytes,lifecycle_state").eq("owner_user_id", requireOwner(ownerUserId)).neq("lifecycle_state", "purged");
    if (error) throw new Error(`Media usage could not be calculated: ${error.message}`);
    const usage: MediaUsage = { totalBytes: 0, totalPhysicalBytes: 0, activeBytes: 0, trashedBytes: 0, assetCount: 0, activeAssetCount: 0, trashedAssetCount: 0, imageBytes: 0, videoBytes: 0, audioBytes: 0, otherBytes: 0 };
    for (const row of data || []) {
      const bytes = Number(row.size_bytes);
      usage.totalBytes += bytes;
      usage.totalPhysicalBytes += bytes;
      usage.assetCount += 1;
      if (row.lifecycle_state === "trashed") {
        usage.trashedBytes += bytes;
        usage.trashedAssetCount += 1;
      } else {
        usage.activeBytes += bytes;
        usage.activeAssetCount += 1;
      }
      if (row.media_kind === "image" || row.media_kind === "thumbnail") usage.imageBytes += bytes;
      else if (row.media_kind === "video" || row.media_kind === "final_video") usage.videoBytes += bytes;
      else if (row.media_kind === "narration_audio" || row.media_kind === "dialogue_audio" || row.media_kind === "music") usage.audioBytes += bytes;
      else usage.otherBytes += bytes;
    }
    return usage;
  }

  async replaceProjectReferences(ownerUserId: string, projectId: string, references: ProjectMediaReference[]) {
    const owner = requireOwner(ownerUserId);
    const urls = [...new Set(references.map((reference) => reference.url))];
    const assetsByUrl = new Map<string, string>();
    if (urls.length) {
      const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
        .select("id,public_url").eq("owner_user_id", owner).in("public_url", urls);
      if (error) throw new Error(`Project media could not be resolved: ${error.message}`);
      for (const row of data || []) if (row.public_url) assetsByUrl.set(row.public_url, row.id);
    }
    const resolved = references.flatMap((reference) => {
      const assetId = assetsByUrl.get(reference.url);
      return assetId ? [{ asset_id: assetId, reference_type: reference.referenceType, reference_key: reference.referenceKey }] : [];
    });
    const { error } = await createServerSupabaseClient().rpc("velto_replace_project_media_references", {
      p_owner_user_id: owner,
      p_project_id: projectId,
      p_references: resolved,
    });
    if (error) throw new Error(`Project media references could not be reconciled: ${error.message}`);
  }

  async listReferencesForAsset(assetId: string, ownerUserId: string) {
    const { data, error } = await createServerSupabaseClient().from("velto_media_asset_references")
      .select("reference_type,reference_key,velto_media_assets!inner(public_url)")
      .eq("asset_id", assetId).eq("owner_user_id", requireOwner(ownerUserId));
    if (error) throw new Error(`Media references could not be listed: ${error.message}`);
    return (data || []).flatMap((row) => {
      const joined = row.velto_media_assets as unknown as { public_url?: string };
      return joined?.public_url ? [{ url: joined.public_url, referenceType: row.reference_type, referenceKey: row.reference_key }] : [];
    }) as ProjectMediaReference[];
  }

  async getReferenceSummaryForOwner(assetId: string, ownerUserId: string): Promise<MediaReferenceSummary[]> {
    const owner = requireOwner(ownerUserId);
    const ownedAsset = await this.getForOwner(assetId, owner);
    if (!ownedAsset) return [];
    const { data, error } = await createServerSupabaseClient().from("velto_media_asset_references")
      .select("project_id,reference_type,reference_key,created_at")
      .eq("asset_id", assetId).eq("owner_user_id", owner)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Media reference summary could not be read: ${error.message}`);
    return (data || []).map((row) => ({
      projectId: row.project_id,
      referenceType: row.reference_type,
      referenceKey: row.reference_key,
      createdAt: row.created_at,
    })) as MediaReferenceSummary[];
  }

  async trashForOwner(assetId: string, ownerUserId: string) {
    const { data, error } = await createServerSupabaseClient().rpc("velto_trash_media_asset_if_unreferenced", {
      p_asset_id: assetId,
      p_owner_user_id: requireOwner(ownerUserId),
    });
    if (error) throw new Error(`Media asset could not be moved to Trash: ${error.message}`);
    return data as "trashed" | "not_found" | "state_changed" | "in_use";
  }

  async restoreForOwner(assetId: string, ownerUserId: string) {
    if (process.env.VELTO_PERMANENT_MEDIA_DELETE_ENABLED !== "true") {
      const { data, error } = await createServerSupabaseClient().from("velto_media_assets")
        .update({ lifecycle_state: "active", trashed_at: null, updated_at: new Date().toISOString() })
        .eq("id", assetId).eq("owner_user_id", requireOwner(ownerUserId)).eq("lifecycle_state", "trashed")
        .select("id").maybeSingle();
      if (error) throw new Error(`Media asset could not be restored: ${error.message}`);
      return data ? "restored" as const : "state_changed" as const;
    }
    const { data, error } = await createServerSupabaseClient().rpc("velto_restore_media_asset", {
      p_asset_id: assetId, p_owner_user_id: requireOwner(ownerUserId),
    });
    if (error) throw new Error(`Media asset could not be restored: ${error.message}`);
    return data as "restored" | "not_found" | "state_changed" | "purge_pending";
  }

  async beginPurgeForOwner(assetId: string, ownerUserId: string, retentionDays: number): Promise<BeginMediaPurgeResult> {
    const { data, error } = await createServerSupabaseClient().rpc("velto_begin_media_asset_purge", {
      p_asset_id: assetId, p_owner_user_id: requireOwner(ownerUserId), p_retention_days: retentionDays,
    });
    if (error) throw new Error(`Media purge could not begin: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.status !== "ready") return { status: row?.status || "not_found" } as BeginMediaPurgeResult;
    return {
      status: "ready", assetId: row.asset_id, bucket: row.bucket, storagePath: row.storage_path,
      purgeToken: row.purge_token, sizeBytes: Number(row.size_bytes), mediaKind: row.media_kind,
    };
  }

  async completePurgeForOwner(assetId: string, ownerUserId: string, purgeToken: string) {
    const { data, error } = await createServerSupabaseClient().rpc("velto_complete_media_asset_purge", {
      p_asset_id: assetId, p_owner_user_id: requireOwner(ownerUserId), p_purge_token: purgeToken,
    });
    if (error) throw new Error(`Media purge could not be finalized: ${error.message}`);
    return data as "purged" | "not_found" | "not_trashed" | "token_mismatch" | "in_use";
  }

  async abortPurgeForOwner(assetId: string, ownerUserId: string, purgeToken: string) {
    const { data, error } = await createServerSupabaseClient().rpc("velto_abort_media_asset_purge", {
      p_asset_id: assetId, p_owner_user_id: requireOwner(ownerUserId), p_purge_token: purgeToken,
    });
    if (error) throw new Error(`Media purge could not be aborted: ${error.message}`);
    return data as "aborted" | "not_found" | "not_trashed" | "token_mismatch";
  }
}
