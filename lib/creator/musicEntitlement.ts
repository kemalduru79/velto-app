import { createHash } from "node:crypto";
import { normalizeCreatorPremiumMusicTrackId } from "./musicLibrary";
import { getPersistenceServices } from "@/lib/persistence";
import type { CreatorMusicEntitlement, CreatorMusicEntitlementRepository } from "@/lib/persistence/music";
import type { ObjectStorageRepository } from "@/lib/persistence/storage";
import type { ProjectRepository } from "@/lib/persistence/projects";
import { getMusicProvider, type MusicProvider } from "@/lib/providers/music";
import { isPremiumMusicAcquisitionEnabled, MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES, PREMIUM_MUSIC_CONTENT_TYPE } from "@/lib/providers/music/downloadSecurity";

export const CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION = "creator-premium-music-license-v1" as const;
export const CREATOR_PREMIUM_MUSIC_PROVIDER_KEY = "premium_music_catalog" as const;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_LICENSE_METADATA_KEYS = new Set(["licenseType", "territory", "expiresAt", "policyReference"]);

export class CreatorMusicAcquisitionError extends Error {
  constructor(public readonly code: "disabled" | "invalid_request" | "forbidden" | "in_progress" | "failed" | "revoked" | "unavailable") {
    super("Premium music acquisition is unavailable.");
    this.name = "CreatorMusicAcquisitionError";
  }
}

export type CreatorMusicExportEntitlementDependencies = {
  projectRepository: ProjectRepository;
  entitlementRepository: CreatorMusicEntitlementRepository;
  acquisitionEnabled: boolean;
  privateBucket?: string;
};

export type CreatorMusicExportEntitlement = {
  entitlementId: string;
  trackId: string;
};

export type CreatorMusicAcquisitionDependencies = {
  projectRepository: ProjectRepository;
  entitlementRepository: CreatorMusicEntitlementRepository;
  objectStorage: ObjectStorageRepository;
  provider: MusicProvider;
  acquisitionEnabled: boolean;
  privateBucket?: string;
};

function productionDependencies(): CreatorMusicAcquisitionDependencies {
  const persistence = getPersistenceServices();
  return {
    projectRepository: persistence.projectRepository,
    entitlementRepository: persistence.creatorMusicEntitlementRepository,
    objectStorage: persistence.objectStorage,
    provider: getMusicProvider(),
    acquisitionEnabled: isPremiumMusicAcquisitionEnabled(),
    privateBucket: process.env.CREATOR_PREMIUM_MUSIC_BUCKET?.trim(),
  };
}

function requirePrivateBucket(value?: string) {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(value)) {
    throw new CreatorMusicAcquisitionError("unavailable");
  }
  return value;
}

export function buildCreatorPremiumMusicObjectPath(userId: string, entitlementId: string, checksum: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(entitlementId) || !CHECKSUM_PATTERN.test(checksum)) {
    throw new CreatorMusicAcquisitionError("invalid_request");
  }
  return `creator/${userId}/music/${entitlementId}/${checksum}.mp3`;
}

export function sanitizeProviderLicenseMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const safe: Record<string, string> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!SAFE_LICENSE_METADATA_KEYS.has(key) || typeof candidate !== "string") continue;
    const normalized = candidate.trim().slice(0, 120);
    if (normalized && !/https?:\/\//i.test(normalized)) safe[key] = normalized;
  }
  return safe;
}

function safeProviderAcquisitionId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 160);
  return normalized && !/https?:\/\//i.test(normalized) ? normalized : undefined;
}

function hasStagedAsset(entitlement: CreatorMusicEntitlement) {
  return Boolean(entitlement.storageBucket && entitlement.storagePath && entitlement.contentType === PREMIUM_MUSIC_CONTENT_TYPE && entitlement.sizeBytes && entitlement.checksum);
}

export async function resolveCreatorPremiumMusicExportEntitlement(
  input: { userId: string; projectId: unknown; trackId: unknown },
  dependencies?: CreatorMusicExportEntitlementDependencies,
): Promise<CreatorMusicExportEntitlement | null> {
  const persistence = dependencies ? null : getPersistenceServices();
  const resolvedDependencies = dependencies || {
    projectRepository: persistence!.projectRepository,
    entitlementRepository: persistence!.creatorMusicEntitlementRepository,
    acquisitionEnabled: isPremiumMusicAcquisitionEnabled(),
    privateBucket: process.env.CREATOR_PREMIUM_MUSIC_BUCKET?.trim(),
  };
  if (!resolvedDependencies.acquisitionEnabled) return null;
  if (typeof input.projectId !== "string" || !PROJECT_ID_PATTERN.test(input.projectId)) return null;
  const trackId = normalizeCreatorPremiumMusicTrackId(input.trackId);
  if (!trackId) return null;
  let bucket: string;
  try {
    bucket = requirePrivateBucket(resolvedDependencies.privateBucket);
  } catch {
    return null;
  }
  const project = await resolvedDependencies.projectRepository.getForOwner(input.projectId, input.userId);
  if (!project || (project.flow_type ?? project.flowType) !== "creator_lab") return null;
  const entitlement = await resolvedDependencies.entitlementRepository.getByKeyForOwner({
    userId: input.userId,
    projectId: input.projectId,
    providerKey: CREATOR_PREMIUM_MUSIC_PROVIDER_KEY,
    trackId,
    licensePolicyVersion: CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION,
  });
  if (
    !entitlement || entitlement.status !== "acquired" ||
    entitlement.storageBucket !== bucket || !entitlement.storagePath ||
    entitlement.contentType !== PREMIUM_MUSIC_CONTENT_TYPE ||
    !Number.isSafeInteger(entitlement.sizeBytes) || Number(entitlement.sizeBytes) <= 0 || Number(entitlement.sizeBytes) > MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES ||
    !entitlement.checksum || !CHECKSUM_PATTERN.test(entitlement.checksum)
  ) return null;
  let canonicalPath: string;
  try {
    canonicalPath = buildCreatorPremiumMusicObjectPath(input.userId, entitlement.id, entitlement.checksum);
  } catch {
    return null;
  }
  if (entitlement.storagePath !== canonicalPath) return null;
  return { entitlementId: entitlement.id, trackId };
}

export async function acquireCreatorPremiumMusic(
  input: { userId: string; projectId: string; trackId: unknown },
  dependencies: CreatorMusicAcquisitionDependencies = productionDependencies(),
) {
  // Disabled means no project/database mutation, provider dispatch, or storage.
  if (!dependencies.acquisitionEnabled) throw new CreatorMusicAcquisitionError("disabled");
  const bucket = requirePrivateBucket(dependencies.privateBucket);
  if (!PROJECT_ID_PATTERN.test(input.projectId)) throw new CreatorMusicAcquisitionError("invalid_request");
  const trackId = normalizeCreatorPremiumMusicTrackId(input.trackId);
  if (!trackId) throw new CreatorMusicAcquisitionError("invalid_request");

  const project = await dependencies.projectRepository.getForOwner(input.projectId, input.userId);
  if (!project || (project.flow_type ?? project.flowType) !== "creator_lab") {
    throw new CreatorMusicAcquisitionError("forbidden");
  }

  const key = {
    userId: input.userId,
    projectId: input.projectId,
    providerKey: CREATOR_PREMIUM_MUSIC_PROVIDER_KEY,
    trackId,
    licensePolicyVersion: CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION,
  };
  const { entitlement, created } = await dependencies.entitlementRepository.createOrGetPending(key);
  if (entitlement.status === "acquired") return { status: "acquired" as const, entitlement, reused: true };
  if (entitlement.status === "revoked") throw new CreatorMusicAcquisitionError("revoked");
  if (entitlement.status === "failed") throw new CreatorMusicAcquisitionError("failed");
  if (!created) {
    if (hasStagedAsset(entitlement)) {
      const acquired = await dependencies.entitlementRepository.markAcquired(entitlement.id, input.userId);
      return { status: "acquired" as const, entitlement: acquired, reused: true };
    }
    throw new CreatorMusicAcquisitionError("in_progress");
  }

  const partnerUserId = `velto-${createHash("sha256").update(`velto:premium-music:v1:${input.userId}`).digest("hex").slice(0, 32)}`;
  const downloaded = await dependencies.provider.downloadTrack({
    trackId,
    partnerUserId,
    acquisitionContext: { projectId: input.projectId, licensePolicyVersion: CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION },
  });
  if (downloaded.contentType !== PREMIUM_MUSIC_CONTENT_TYPE || !CHECKSUM_PATTERN.test(downloaded.checksum) || downloaded.contentLength !== downloaded.body.byteLength || downloaded.contentLength < 1) {
    throw new CreatorMusicAcquisitionError("unavailable");
  }
  const path = buildCreatorPremiumMusicObjectPath(input.userId, entitlement.id, downloaded.checksum);
  const stored = await dependencies.objectStorage.uploadPrivate({
    bucket, path, body: downloaded.body, contentType: PREMIUM_MUSIC_CONTENT_TYPE, upsert: true,
  });
  const staged = await dependencies.entitlementRepository.stageStoredAsset(entitlement.id, input.userId, {
    storageBucket: stored.bucket,
    storagePath: stored.path,
    contentType: PREMIUM_MUSIC_CONTENT_TYPE,
    sizeBytes: downloaded.contentLength,
    checksum: downloaded.checksum,
    ...(safeProviderAcquisitionId(downloaded.providerAcquisitionId) ? { providerAcquisitionId: safeProviderAcquisitionId(downloaded.providerAcquisitionId) } : {}),
    providerLicenseMetadata: sanitizeProviderLicenseMetadata(downloaded.licenseMetadata),
  });
  const acquired = await dependencies.entitlementRepository.markAcquired(staged.id, input.userId);
  return { status: "acquired" as const, entitlement: acquired, reused: false };
}
