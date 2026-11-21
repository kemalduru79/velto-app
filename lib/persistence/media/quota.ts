export type StorageQuotaState = "NORMAL" | "APPROACHING" | "CRITICAL" | "FULL";
export type StorageGenerationDecision = "UNCONFIGURED" | "ALLOWED" | "FULL_BUT_NOT_ENFORCED" | "BLOCKED_FULL";
export type StorageQuotaConfigurationIssue = "MISSING_LIMIT" | "INVALID_LIMIT" | "INVALID_ADMISSION_TTL";

export type StorageQuota = {
  state: StorageQuotaState;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usageRatio: number;
  canCreateStorageIncreasingMedia: boolean;
};

export class StorageQuotaConfigurationValidationError extends Error {
  constructor() {
    super("Storage quota configuration is invalid.");
    this.name = "StorageQuotaConfigurationValidationError";
  }
}

export function resolveStorageQuotaConfiguration(env: Record<string, string | undefined>) {
  const rawLimit = env.VELTO_STORAGE_LIMIT_BYTES;
  const normalizedLimit = typeof rawLimit === "string" ? rawLimit.trim() : "";
  const parsedLimit = /^\d+$/.test(normalizedLimit)
    ? Number(normalizedLimit)
    : Number.NaN;
  const limitBytes = Number.isSafeInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
  const rawTtl = env.VELTO_STORAGE_ADMISSION_TTL_MINUTES;
  const normalizedTtl = typeof rawTtl === "string" ? rawTtl.trim() : "";
  const explicitTtl = normalizedTtl.length > 0;
  const parsedTtl = /^\d+$/.test(normalizedTtl) ? Number(normalizedTtl) : Number.NaN;
  const admissionTtlValid = !explicitTtl || (Number.isSafeInteger(parsedTtl) && parsedTtl > 0);
  const configurationIssue: StorageQuotaConfigurationIssue | null = limitBytes === null
    ? normalizedLimit.length === 0 ? "MISSING_LIMIT" : "INVALID_LIMIT"
    : !admissionTtlValid ? "INVALID_ADMISSION_TTL" : null;
  return {
    configured: limitBytes !== null,
    limitBytes,
    enforcementEnabled: env.VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED === "true",
    admissionTtlMinutes: admissionTtlValid && explicitTtl ? parsedTtl : 60,
    admissionTtlValid,
    configurationIssue,
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
  if (!Number.isSafeInteger(usedBytes) || usedBytes < 0 || !Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
    throw new Error("Storage quota inputs must be safe non-negative usage and a positive safe limit.");
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

export function evaluateStorageQuota(
  usedBytes: number,
  additionalEntitlementBytes: number,
  env: Record<string, string | undefined>,
) {
  const config = resolveStorageQuotaConfiguration(env);
  if (config.enforcementEnabled && config.configurationIssue) {
    throw new StorageQuotaConfigurationValidationError();
  }
  if (!Number.isSafeInteger(usedBytes) || usedBytes < 0 || !Number.isSafeInteger(additionalEntitlementBytes) || additionalEntitlementBytes < 0) {
    throw new StorageQuotaConfigurationValidationError();
  }
  if (!config.configured || config.limitBytes === null) {
    return { config, effectiveLimitBytes: null, quota: null, decision: "UNCONFIGURED" as const, allowed: true };
  }
  const effectiveLimitBytes = config.limitBytes + additionalEntitlementBytes;
  if (!Number.isSafeInteger(effectiveLimitBytes) || effectiveLimitBytes <= 0) {
    throw new StorageQuotaConfigurationValidationError();
  }
  const quota = getStorageQuota(usedBytes, effectiveLimitBytes);
  const decision = getStorageGenerationDecision(true, config.enforcementEnabled, quota.state);
  return { config, effectiveLimitBytes, quota, decision, allowed: decision !== "BLOCKED_FULL" };
}
