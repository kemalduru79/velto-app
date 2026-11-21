import "server-only";
import { NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence/services";
import { evaluateStorageQuota, resolveStorageQuotaConfiguration, StorageQuotaConfigurationValidationError, type StorageGenerationDecision, type StorageQuotaState } from "./quota";
import type { MediaAssetRepository, MediaUsage } from "./types";
import { getAdditionalStorageBytesForOwner } from "./storageEntitlement.server";

export type StorageActivationReadiness = "READY_DISABLED" | "READY_ENABLED" | "NOT_READY_CONFIG" | "NOT_READY_INFRASTRUCTURE";

export class StorageQuotaOperationalError extends Error {
  constructor(
    readonly code: "STORAGE_QUOTA_CONFIGURATION_ERROR" | "STORAGE_QUOTA_INFRASTRUCTURE_ERROR",
  ) {
    super(code === "STORAGE_QUOTA_CONFIGURATION_ERROR"
      ? "Storage quota enforcement configuration is invalid."
      : "Storage quota infrastructure is temporarily unavailable.");
    this.name = "StorageQuotaOperationalError";
  }
}

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
  const config = resolveStorageQuotaConfiguration(env);
  if (config.enforcementEnabled && config.configurationIssue) {
    throw new StorageQuotaOperationalError("STORAGE_QUOTA_CONFIGURATION_ERROR");
  }
  let usage: MediaUsage;
  let additionalEntitlementBytes: number;
  try {
    [usage, additionalEntitlementBytes] = await Promise.all([
      repository.getUsageForOwner(ownerUserId),
      entitlementResolver(ownerUserId),
    ]);
  } catch {
    throw new StorageQuotaOperationalError("STORAGE_QUOTA_INFRASTRUCTURE_ERROR");
  }
  if (!Number.isSafeInteger(additionalEntitlementBytes) || additionalEntitlementBytes < 0) {
    throw new StorageQuotaOperationalError("STORAGE_QUOTA_INFRASTRUCTURE_ERROR");
  }
  if (!config.configured || config.limitBytes === null) {
    return unconfiguredStatus(usage, config.enforcementEnabled, additionalEntitlementBytes);
  }
  let evaluated: ReturnType<typeof evaluateStorageQuota>;
  try {
    evaluated = evaluateStorageQuota(usage.totalPhysicalBytes, additionalEntitlementBytes, env);
  } catch (error) {
    if (error instanceof StorageQuotaConfigurationValidationError) {
      throw new StorageQuotaOperationalError("STORAGE_QUOTA_CONFIGURATION_ERROR");
    }
    throw error;
  }
  if (!evaluated.quota || evaluated.effectiveLimitBytes === null) {
    return unconfiguredStatus(usage, config.enforcementEnabled, additionalEntitlementBytes);
  }
  const { quota, decision, effectiveLimitBytes } = evaluated;
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

export function storageQuotaOperationalErrorResponse(error: StorageQuotaOperationalError) {
  return NextResponse.json(
    { ok: false, code: error.code, error: error.message },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function getStorageActivationReadiness(
  ownerUserId: string,
  repository: MediaAssetRepository = getPersistenceServices().mediaAssetRepository,
  env: NodeJS.ProcessEnv = process.env,
  entitlementResolver: (ownerUserId: string) => Promise<number> = getAdditionalStorageBytesForOwner,
): Promise<StorageActivationReadiness> {
  const config = resolveStorageQuotaConfiguration(env);
  if (config.configurationIssue) return "NOT_READY_CONFIG";
  try {
    await getOwnerStorageQuotaStatus(ownerUserId, repository, env, entitlementResolver);
    return config.enforcementEnabled ? "READY_ENABLED" : "READY_DISABLED";
  } catch (error) {
    return error instanceof StorageQuotaOperationalError && error.code === "STORAGE_QUOTA_CONFIGURATION_ERROR"
      ? "NOT_READY_CONFIG"
      : "NOT_READY_INFRASTRUCTURE";
  }
}
