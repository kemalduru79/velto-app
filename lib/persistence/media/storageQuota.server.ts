import "server-only";
import { NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence/services";
import { getStorageGenerationDecision, getStorageQuota, resolveStorageQuotaConfiguration, type StorageGenerationDecision, type StorageQuotaState } from "./quota";
import type { MediaAssetRepository, MediaUsage } from "./types";
import { getAdditionalStorageBytesForOwner } from "./storageEntitlement.server";

export type OwnerStorageQuotaStatus = {
  configured: boolean;
  enforcementEnabled: boolean;
  usedBytes: number;
  totalPhysicalBytes: number;
  activeBytes: number;
  trashedBytes: number;
  assetCount: number;
  activeAssetCount: number;
  trashedAssetCount: number;
  baseLimitBytes: number | null;
  additionalEntitlementBytes: number;
  effectiveLimitBytes: number | null;
  /** Backward-compatible alias for effectiveLimitBytes. */
  limitBytes: number | null;
  remainingBytes: number | null;
  usageRatio: number | null;
  state: StorageQuotaState | null;
  canCreateStorageIncreasingMedia: boolean;
  decision: StorageGenerationDecision;
};

function unconfiguredStatus(usage: MediaUsage, enforcementEnabled: boolean, additionalEntitlementBytes: number): OwnerStorageQuotaStatus {
  return {
    configured: false,
    enforcementEnabled,
    usedBytes: usage.totalPhysicalBytes,
    totalPhysicalBytes: usage.totalPhysicalBytes,
    activeBytes: usage.activeBytes,
    trashedBytes: usage.trashedBytes,
    assetCount: usage.assetCount,
    activeAssetCount: usage.activeAssetCount,
    trashedAssetCount: usage.trashedAssetCount,
    baseLimitBytes: null,
    additionalEntitlementBytes,
    effectiveLimitBytes: null,
    limitBytes: null,
    remainingBytes: null,
    usageRatio: null,
    state: null,
    canCreateStorageIncreasingMedia: true,
    decision: "UNCONFIGURED",
  };
}

export async function getOwnerStorageQuotaStatus(
  ownerUserId: string,
  repository: MediaAssetRepository = getPersistenceServices().mediaAssetRepository,
  env: NodeJS.ProcessEnv = process.env,
  entitlementResolver: (ownerUserId: string) => Promise<number> = getAdditionalStorageBytesForOwner,
): Promise<OwnerStorageQuotaStatus> {
  const [usage, additionalEntitlementBytes] = await Promise.all([
    repository.getUsageForOwner(ownerUserId),
    entitlementResolver(ownerUserId),
  ]);
  const config = resolveStorageQuotaConfiguration(env);
  if (!config.configured || config.limitBytes === null) {
    return unconfiguredStatus(usage, config.enforcementEnabled, additionalEntitlementBytes);
  }
  const effectiveLimitBytes = config.limitBytes + additionalEntitlementBytes;
  if (!Number.isSafeInteger(effectiveLimitBytes)) throw new Error("Effective storage limit exceeds the safe integer range.");
  const quota = getStorageQuota(usage.totalPhysicalBytes, effectiveLimitBytes);
  const decision = getStorageGenerationDecision(true, config.enforcementEnabled, quota.state);
  const blocked = decision === "BLOCKED_FULL";
  return {
    configured: true,
    enforcementEnabled: config.enforcementEnabled,
    usedBytes: usage.totalPhysicalBytes,
    totalPhysicalBytes: usage.totalPhysicalBytes,
    activeBytes: usage.activeBytes,
    trashedBytes: usage.trashedBytes,
    assetCount: usage.assetCount,
    activeAssetCount: usage.activeAssetCount,
    trashedAssetCount: usage.trashedAssetCount,
    baseLimitBytes: config.limitBytes,
    additionalEntitlementBytes,
    effectiveLimitBytes,
    limitBytes: quota.limitBytes,
    remainingBytes: quota.remainingBytes,
    usageRatio: quota.usageRatio,
    state: quota.state,
    canCreateStorageIncreasingMedia: !blocked,
    decision,
  };
}

export async function checkStorageGenerationAllowance(ownerUserId: string) {
  const storage = await getOwnerStorageQuotaStatus(ownerUserId);
  return { allowed: storage.decision !== "BLOCKED_FULL", storage };
}

export function storageQuotaFullResponse(storage: OwnerStorageQuotaStatus) {
  return NextResponse.json(
    {
      ok: false,
      code: "STORAGE_QUOTA_FULL",
      error: "Storage is full. New image and video generation is temporarily unavailable.",
      storage: { usedBytes: storage.usedBytes, limitBytes: storage.limitBytes, state: "FULL" as const },
    },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
