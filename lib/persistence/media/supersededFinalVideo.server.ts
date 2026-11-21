import "server-only";
import type { ObjectStorageRepository } from "../storage/types.ts";
import type { MediaAssetRepository } from "./types.ts";

type SupersededFinalVideoDependencies = Readonly<{
  mediaAssetRepository: MediaAssetRepository;
  objectStorage: ObjectStorageRepository;
}>;

async function purgeSupersededFinalVideoForOwner(input: {
  ownerUserId: string;
  assetId: string;
  projectId: string;
  dependencies: SupersededFinalVideoDependencies;
}) {
  const asset = await input.dependencies.mediaAssetRepository.getForOwner(
    input.assetId,
    input.ownerUserId,
  );
  if (!asset) return { status: "not_found" } as const;
  if (
    asset.ownerUserId !== input.ownerUserId ||
    asset.mediaKind !== "final_video" ||
    asset.metadata?.projectId !== input.projectId
  ) {
    return { status: "asset_mismatch" } as const;
  }
  if (asset.lifecycleState === "purged") {
    return { status: "already_purged" } as const;
  }
  if (asset.lifecycleState === "active") {
    const trashed =
      await input.dependencies.mediaAssetRepository.trashForOwner(
        asset.id,
        input.ownerUserId,
      );
    if (trashed !== "trashed") return { status: trashed } as const;
  } else if (asset.lifecycleState !== "trashed") {
    return { status: "state_changed" } as const;
  }

  const begun =
    await input.dependencies.mediaAssetRepository.beginPurgeForOwner(
      asset.id,
      input.ownerUserId,
      0,
    );
  if (begun.status !== "ready") return { status: begun.status } as const;
  if (begun.mediaKind !== "final_video") {
    try {
      await input.dependencies.mediaAssetRepository.abortPurgeForOwner(
        asset.id,
        input.ownerUserId,
        begun.purgeToken,
      );
    } catch {
      // The database marker remains recoverable and no object was removed.
    }
    return { status: "asset_mismatch" } as const;
  }

  try {
    await input.dependencies.objectStorage.removeObject({
      bucket: begun.bucket,
      path: begun.storagePath,
    });
  } catch (error) {
    try {
      await input.dependencies.mediaAssetRepository.abortPurgeForOwner(
        asset.id,
        input.ownerUserId,
        begun.purgeToken,
      );
    } catch {
      // The failed physical deletion remains recoverable from the purge marker.
    }
    return {
      status: "storage_remove_failed",
      recoverable: true,
      error,
    } as const;
  }

  try {
    const completed =
      await input.dependencies.mediaAssetRepository.completePurgeForOwner(
        asset.id,
        input.ownerUserId,
        begun.purgeToken,
      );
    if (completed === "purged") {
      return { status: "purged", freedBytes: begun.sizeBytes } as const;
    }
    return {
      status: "recovery_required",
      recoverable: true,
      completionStatus: completed,
    } as const;
  } catch (error) {
    // Physical deletion succeeded. Never abort: the purge marker is durable
    // evidence for the existing recovery command to finish the database step.
    return {
      status: "recovery_required",
      recoverable: true,
      error,
    } as const;
  }
}

export async function reconcileSupersededFinalVideosForProject(input: {
  ownerUserId: string;
  projectId: string;
  authoritativePublicUrl: string;
  dependencies: SupersededFinalVideoDependencies;
}) {
  const assets =
    await input.dependencies.mediaAssetRepository.listFinalVideosForProject(
      input.ownerUserId,
      input.projectId,
    );
  const current = assets.find((asset) =>
    asset.publicUrl === input.authoritativePublicUrl
  );
  if (
    !current || current.ownerUserId !== input.ownerUserId ||
    current.mediaKind !== "final_video" || current.lifecycleState !== "active" ||
    current.metadata?.projectId !== input.projectId
  ) {
    return { status: "current_asset_invalid", results: [] } as const;
  }

  const results = [];
  for (const stale of assets) {
    if (stale.id === current.id || stale.publicUrl === current.publicUrl) continue;
    if (
      stale.ownerUserId !== input.ownerUserId ||
      stale.mediaKind !== "final_video" ||
      stale.metadata?.projectId !== input.projectId ||
      stale.lifecycleState === "purged"
    ) {
      results.push({ assetId: stale.id, status: "asset_mismatch" as const });
      continue;
    }
    try {
      const result = await purgeSupersededFinalVideoForOwner({
        ownerUserId: input.ownerUserId,
        assetId: stale.id,
        projectId: input.projectId,
        dependencies: input.dependencies,
      });
      results.push({ assetId: stale.id, ...result });
    } catch (error) {
      results.push({
        assetId: stale.id,
        status: "unexpected_error" as const,
        recoverable: true as const,
        error,
      });
    }
  }
  return {
    status: "reconciled",
    currentAssetId: current.id,
    results,
  } as const;
}
