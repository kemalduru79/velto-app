import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CreatorMusicUsageErrorCode,
  CreatorMusicUsageEvent,
  CreatorMusicUsageEventIdentity,
  CreatorMusicUsageEventRepository,
  CreatorMusicUsageEventStatus,
} from "./types";

type Row = Record<string, unknown>;
const USAGE_KEY_PATTERN = /^[a-f0-9]{64}$/;
const PROVIDER_USAGE_ID_PATTERN = /^[A-Za-z0-9._~:-]{1,160}$/;

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function mapRow(row: Row): CreatorMusicUsageEvent {
  return {
    id: String(row.id), entitlementId: String(row.entitlement_id), userId: String(row.user_id),
    projectId: String(row.project_id), providerKey: String(row.provider_key), trackId: String(row.track_id),
    licensePolicyVersion: String(row.license_policy_version), exportUsageKey: String(row.export_usage_key),
    status: String(row.status) as CreatorMusicUsageEventStatus,
    attemptCount: Number(row.attempt_count) || 0,
    ...(optionalText(row.last_error_code) ? { lastErrorCode: String(row.last_error_code) as CreatorMusicUsageErrorCode } : {}),
    ...(optionalText(row.provider_usage_event_id) ? { providerUsageEventId: String(row.provider_usage_event_id) } : {}),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    ...(optionalText(row.reported_at) ? { reportedAt: String(row.reported_at) } : {}),
  };
}

export class SupabaseCreatorMusicUsageEventRepository implements CreatorMusicUsageEventRepository {
  async getByUsageKey(entitlementId: string, exportUsageKey: string) {
    if (!USAGE_KEY_PATTERN.test(exportUsageKey)) throw new Error("Music usage key is invalid.");
    const { data, error } = await createServerSupabaseClient().from("creator_music_usage_events")
      .select("*").eq("entitlement_id", entitlementId).eq("export_usage_key", exportUsageKey).maybeSingle();
    if (error) throw new Error("Music usage event could not be read.");
    return data ? mapRow(data as Row) : null;
  }

  async createOrGetPending(identity: CreatorMusicUsageEventIdentity) {
    if (!USAGE_KEY_PATTERN.test(identity.exportUsageKey)) throw new Error("Music usage key is invalid.");
    const { data, error } = await createServerSupabaseClient().from("creator_music_usage_events")
      .upsert({
        entitlement_id: identity.entitlementId, user_id: identity.userId, project_id: identity.projectId,
        provider_key: identity.providerKey, track_id: identity.trackId,
        license_policy_version: identity.licensePolicyVersion, export_usage_key: identity.exportUsageKey,
        status: "pending",
      }, { onConflict: "entitlement_id,export_usage_key", ignoreDuplicates: true })
      .select("*").maybeSingle();
    if (error) throw new Error("Music usage event could not be registered.");
    if (data) return { event: mapRow(data as Row), created: true };
    const existing = await this.getByUsageKey(identity.entitlementId, identity.exportUsageKey);
    if (!existing) throw new Error("Music usage event concurrency could not be resolved.");
    return { event: existing, created: false };
  }

  async listPending(limit = 50) {
    const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const { data, error } = await createServerSupabaseClient().from("creator_music_usage_events")
      .select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(boundedLimit);
    if (error) throw new Error("Pending music usage events could not be read.");
    return (data || []).map((row) => mapRow(row as Row));
  }

  async markReported(id: string, providerUsageEventId?: string) {
    if (providerUsageEventId && !PROVIDER_USAGE_ID_PATTERN.test(providerUsageEventId)) {
      throw new Error("Provider usage event identity is invalid.");
    }
    const client = createServerSupabaseClient();
    const { data, error } = await client.from("creator_music_usage_events")
      .update({ status: "reported", provider_usage_event_id: providerUsageEventId || null, reported_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error_code: null })
      .eq("id", id).in("status", ["pending", "failed"]).select("*").maybeSingle();
    if (error) throw new Error("Music usage event could not be reported.");
    if (data) return mapRow(data as Row);
    const { data: existing, error: existingError } = await client.from("creator_music_usage_events")
      .select("*").eq("id", id).eq("status", "reported").maybeSingle();
    if (existingError || !existing) throw new Error("Music usage event could not be reported.");
    return mapRow(existing as Row);
  }

  async markFailed(id: string, errorCode: CreatorMusicUsageErrorCode) {
    const client = createServerSupabaseClient();
    const { data: current, error: readError } = await client.from("creator_music_usage_events")
      .select("attempt_count,status").eq("id", id).maybeSingle();
    if (readError || !current || current.status === "reported") throw new Error("Music usage event could not be failed.");
    const { data, error } = await client.from("creator_music_usage_events")
      .update({ status: "failed", attempt_count: Number(current.attempt_count || 0) + 1, last_error_code: errorCode, updated_at: new Date().toISOString() })
      .eq("id", id).neq("status", "reported").select("*").maybeSingle();
    if (error || !data) throw new Error("Music usage event could not be failed.");
    return mapRow(data as Row);
  }
}
