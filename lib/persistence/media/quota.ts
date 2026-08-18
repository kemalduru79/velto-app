export type StorageQuotaState = "NORMAL" | "APPROACHING" | "CRITICAL" | "FULL";

export type StorageQuota = {
  state: StorageQuotaState;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usageRatio: number;
  canCreateStorageIncreasingMedia: boolean;
};

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
    // Foundation contract only. No endpoint consumes this value in Stage 0.7A.
    canCreateStorageIncreasingMedia: state !== "FULL",
  };
}
