import "server-only";
import { getPersistenceServices } from "@/lib/persistence/services";
import type { MediaAssetRepository } from "./types";
import type { ObjectStorageRepository } from "@/lib/persistence/storage";
import { resolveMediaPurgeConfiguration } from "./purgePolicy";

export function getServerMediaPurgeConfiguration() {
  return resolveMediaPurgeConfiguration(process.env);
}

type PurgeDependencies = {
  mediaAssetRepository: MediaAssetRepository;
  objectStorage: ObjectStorageRepository;
};

export async function purgeMediaAssetForOwner(
  ownerUserId: string,
  assetId: string,
  dependencies: PurgeDependencies = getPersistenceServices(),
) {
  const { retentionDays } = getServerMediaPurgeConfiguration();
  const begun = await dependencies.mediaAssetRepository.beginPurgeForOwner(assetId, ownerUserId, retentionDays);
  if (begun.status !== "ready") return { status: begun.status } as const;

  try {
    await dependencies.objectStorage.removeObject({ bucket: begun.bucket, path: begun.storagePath });
  } catch (error) {
    try {
      await dependencies.mediaAssetRepository.abortPurgeForOwner(assetId, ownerUserId, begun.purgeToken);
    } catch (abortError) {
      console.error("MEDIA_PURGE_ABORT_FAILED", { assetId, ownerUserId, bucket: begun.bucket, path: begun.storagePath, purgeToken: begun.purgeToken, error: abortError });
    }
    return { status: "storage_remove_failed", recoverable: true, error } as const;
  }

  try {
    const completed = await dependencies.mediaAssetRepository.completePurgeForOwner(assetId, ownerUserId, begun.purgeToken);
    if (completed === "purged") return { status: "purged", freedBytes: begun.sizeBytes } as const;
    console.error("MEDIA_PURGE_RECOVERY_REQUIRED", { assetId, ownerUserId, bucket: begun.bucket, path: begun.storagePath, purgeToken: begun.purgeToken, completionStatus: completed });
    return { status: "recovery_required", recoverable: true } as const;
  } catch (error) {
    // Physical deletion already succeeded. Never abort: the pending marker is
    // the durable evidence used by the recovery command to finish the DB step.
    console.error("MEDIA_PURGE_RECOVERY_REQUIRED", { assetId, ownerUserId, bucket: begun.bucket, path: begun.storagePath, purgeToken: begun.purgeToken, error });
    return { status: "recovery_required", recoverable: true } as const;
  }
}
