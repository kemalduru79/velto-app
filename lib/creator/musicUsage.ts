import { createHash } from "node:crypto";
import { getPersistenceServices } from "@/lib/persistence";
import type { CreatorMusicUsageEventIdentity, CreatorMusicUsageEventRepository } from "@/lib/persistence/music";
import { CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION, CREATOR_PREMIUM_MUSIC_PROVIDER_KEY } from "./musicEntitlement";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EXPORT_USAGE_DOMAIN = "velto:premium-music-export-usage:v1:";

export function deriveCreatorMusicExportUsageKey(entitlementId: string, exportIdempotencyKey: unknown) {
  const normalizedKey = typeof exportIdempotencyKey === "string" ? exportIdempotencyKey.trim() : "";
  if (!UUID_PATTERN.test(entitlementId) || !normalizedKey || normalizedKey.length > 512 || /[\u0000-\u001f\u007f]/.test(normalizedKey)) return null;
  return createHash("sha256").update(`${EXPORT_USAGE_DOMAIN}${entitlementId}:${normalizedKey}`).digest("hex");
}

export function buildCreatorMusicUsageEventIdentity(input: {
  entitlementId: string;
  userId: string;
  projectId: string;
  trackId: string;
  exportIdempotencyKey: unknown;
}): CreatorMusicUsageEventIdentity | null {
  const exportUsageKey = deriveCreatorMusicExportUsageKey(input.entitlementId, input.exportIdempotencyKey);
  if (!exportUsageKey || !UUID_PATTERN.test(input.userId) || !PROJECT_ID_PATTERN.test(input.projectId) || !TRACK_ID_PATTERN.test(input.trackId)) return null;
  return {
    entitlementId: input.entitlementId, userId: input.userId, projectId: input.projectId,
    providerKey: CREATOR_PREMIUM_MUSIC_PROVIDER_KEY, trackId: input.trackId,
    licensePolicyVersion: CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION, exportUsageKey,
  };
}

export async function registerCreatorMusicExportUsage(
  identity: CreatorMusicUsageEventIdentity,
  repository: CreatorMusicUsageEventRepository = getPersistenceServices().creatorMusicUsageEventRepository,
) {
  return repository.createOrGetPending(identity);
}
