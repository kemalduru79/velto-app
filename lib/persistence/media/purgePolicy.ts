export const DEFAULT_TRASH_RETENTION_DAYS = 30;

export function resolveMediaPurgeConfiguration(env: Record<string, string | undefined>) {
  const rawDays = env.VELTO_TRASH_RETENTION_DAYS;
  const parsedDays = typeof rawDays === "string" && /^\d+$/.test(rawDays.trim()) ? Number(rawDays.trim()) : Number.NaN;
  const retentionDays = Number.isSafeInteger(parsedDays) && parsedDays >= 0
    ? parsedDays
    : DEFAULT_TRASH_RETENTION_DAYS;
  return {
    retentionDays,
    permanentDeleteEnabled: env.VELTO_PERMANENT_MEDIA_DELETE_ENABLED === "true",
  };
}

export function getMediaPurgeEligibility(trashedAt: string | null, retentionDays: number, now = Date.now()) {
  const timestamp = trashedAt ? Date.parse(trashedAt) : Number.NaN;
  if (!Number.isFinite(timestamp)) return { eligible: false, eligibleAt: null, daysRemaining: null };
  const eligibleAtMs = timestamp + retentionDays * 86_400_000;
  return {
    eligible: now >= eligibleAtMs,
    eligibleAt: new Date(eligibleAtMs).toISOString(),
    daysRemaining: Math.max(0, Math.ceil((eligibleAtMs - now) / 86_400_000)),
  };
}
