import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CreatorMusicEntitlement,
  CreatorMusicEntitlementKey,
  CreatorMusicEntitlementRepository,
  CreatorMusicEntitlementStatus,
  CreatorMusicStoredAsset,
} from "./types";

type Row = Record<string, unknown>;

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function mapRow(row: Row): CreatorMusicEntitlement {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    providerKey: String(row.provider_key),
    trackId: String(row.track_id),
    licensePolicyVersion: String(row.license_policy_version),
    status: String(row.status) as CreatorMusicEntitlementStatus,
    ...(optionalText(row.storage_bucket) ? { storageBucket: String(row.storage_bucket) } : {}),
    ...(optionalText(row.storage_path) ? { storagePath: String(row.storage_path) } : {}),
    ...(row.content_type === "audio/mpeg" ? { contentType: "audio/mpeg" as const } : {}),
    ...(typeof row.size_bytes === "number" ? { sizeBytes: row.size_bytes } : {}),
    ...(optionalText(row.checksum) ? { checksum: String(row.checksum) } : {}),
    ...(optionalText(row.provider_acquisition_id) ? { providerAcquisitionId: String(row.provider_acquisition_id) } : {}),
    providerLicenseMetadata:
      row.provider_license_metadata && typeof row.provider_license_metadata === "object" && !Array.isArray(row.provider_license_metadata)
        ? row.provider_license_metadata as Record<string, string>
        : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(optionalText(row.acquired_at) ? { acquiredAt: String(row.acquired_at) } : {}),
  };
}

function identityQuery(query: any, key: CreatorMusicEntitlementKey) {
  return query
    .eq("user_id", key.userId)
    .eq("project_id", key.projectId)
    .eq("provider_key", key.providerKey)
    .eq("track_id", key.trackId)
    .eq("license_policy_version", key.licensePolicyVersion);
}

export class SupabaseCreatorMusicEntitlementRepository implements CreatorMusicEntitlementRepository {
  async getByIdForOwner(id: string, userId: string, projectId: string) {
    const { data, error } = await createServerSupabaseClient().from("creator_music_entitlements")
      .select("*").eq("id", id).eq("user_id", userId).eq("project_id", projectId).maybeSingle();
    if (error) throw new Error("Music entitlement could not be read.");
    return data ? mapRow(data as Row) : null;
  }

  async getByKeyForOwner(key: CreatorMusicEntitlementKey) {
    const { data, error } = await identityQuery(
      createServerSupabaseClient().from("creator_music_entitlements").select("*"), key,
    ).maybeSingle();
    if (error) throw new Error("Music entitlement could not be read.");
    return data ? mapRow(data as Row) : null;
  }

  async createOrGetPending(key: CreatorMusicEntitlementKey) {
    const client = createServerSupabaseClient();
    const payload = {
      user_id: key.userId, project_id: key.projectId, provider_key: key.providerKey,
      track_id: key.trackId, license_policy_version: key.licensePolicyVersion, status: "pending",
    };
    const { data, error } = await client.from("creator_music_entitlements")
      .upsert(payload, {
        onConflict: "user_id,project_id,provider_key,track_id,license_policy_version",
        ignoreDuplicates: true,
      }).select("*").maybeSingle();
    if (error) throw new Error("Music entitlement could not be created.");
    if (data) return { entitlement: mapRow(data as Row), created: true };
    const existing = await this.getByKeyForOwner(key);
    if (!existing) throw new Error("Music entitlement concurrency could not be resolved.");
    return { entitlement: existing, created: false };
  }

  private async updateOwned(id: string, userId: string, values: Row, expectedStatuses: CreatorMusicEntitlementStatus[]) {
    const { data, error } = await createServerSupabaseClient().from("creator_music_entitlements")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", userId).in("status", expectedStatuses).select("*").maybeSingle();
    if (error || !data) throw new Error("Music entitlement could not be updated.");
    return mapRow(data as Row);
  }

  stageStoredAsset(id: string, userId: string, asset: CreatorMusicStoredAsset) {
    return this.updateOwned(id, userId, {
      storage_bucket: asset.storageBucket, storage_path: asset.storagePath,
      content_type: asset.contentType, size_bytes: asset.sizeBytes, checksum: asset.checksum,
      provider_acquisition_id: asset.providerAcquisitionId || null,
      provider_license_metadata: asset.providerLicenseMetadata,
    }, ["pending"]);
  }

  markAcquired(id: string, userId: string) {
    return this.updateOwned(id, userId, { status: "acquired", acquired_at: new Date().toISOString() }, ["pending"]);
  }
  markFailed(id: string, userId: string) {
    return this.updateOwned(id, userId, { status: "failed" }, ["pending"]);
  }
  markRevoked(id: string, userId: string) {
    return this.updateOwned(id, userId, { status: "revoked" }, ["pending", "acquired", "failed"]);
  }
}
