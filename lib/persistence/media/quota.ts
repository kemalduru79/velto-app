export type StorageQuotaState = "NORMAL" | "APPROACHING" | "CRITICAL" | "FULL";
export type StorageGenerationDecision = "UNCONFIGURED" | "ALLOWED" | "FULL_BUT_NOT_ENFORCED" | "BLOCKED_FULL";

export type StorageQuota = {
  state: StorageQuotaState;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usageRatio: number;
  canCreateStorageIncreasingMedia: boolean;
};

export function resolveStorageQuotaConfiguration(env: Record<string, string | undefined>) {
  const rawLimit = env.VELTO_STORAGE_LIMIT_BYTES;
  const parsedLimit = typeof rawLimit === "string" && /^\d+$/.test(rawLimit.trim())
    ? Number(rawLimit.trim())
    : Number.NaN;
  const limitBytes = Number.isSafeInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
  return {
    configured: limitBytes !== null,
    limitBytes,
    enforcementEnabled: env.VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED === "true",
  };
}

export function getStorageGenerationDecision(
  configured: boolean,
  enforcementEnabled: boolean,
  state: StorageQuotaState | null,
): StorageGenerationDecision {
  if (!configured || state === null) return "UNCONFIGURED";
  if (state !== "FULL") return "ALLOWED";
  return enforcementEnabled ? "BLOCKED_FULL" : "FULL_BUT_NOT_ENFORCED";
}

export function getStorageQuota(usedBytes: number, limitBytes: number): StorageQuota {
  if (!Number.isFinite(usedBytes) || usedBytes < 0 || !Number.isFinite(limitBytes) || limitBytes <= 0) {
    throw new Error("Storage quota inputs must be finite non-negative usage and a positive limit.");
  }
  const usageRatio = usedBytes / limitBytes;
  const state: StorageQuotaState = usageRatio >= 1
    ? "FULL"
    : usageRatio >= 0.95
      ? "CRITICAL"
      : usageRatio >= 0.8
        ? "APPROACHING"
        : "NORMAL";
  return {
    state,
    usedBytes,
    limitBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    usageRatio,
    // Stage 0.7C consumes the normalized state through the server quota guard.
    canCreateStorageIncreasingMedia: state !== "FULL",
  };
}
