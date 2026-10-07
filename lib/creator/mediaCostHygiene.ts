export const DEFAULT_CREATOR_MEDIA_ORPHAN_GRACE_HOURS = 72;

export type CreatorMediaCostHygieneCleanupState =
  | "IN_USE"
  | "HISTORY_ONLY"
  | "UNREFERENCED"
  | "TRASHED";

export type CreatorMediaCostHygieneAsset = {
  id: string;
  mediaKind: string;
  sizeBytes: number;
  lifecycleState: "active" | "trashed" | "purged";
  createdAt?: string | null;
  cleanupState: CreatorMediaCostHygieneCleanupState;
};

export type CreatorMediaCostHygieneAudit = {
  version: "0.20F1";
  status: "clean" | "attention";
  requiresManualReview: boolean;
  graceHours: number;
  metrics: {
    totalAssetCount: number;
    activeAssetCount: number;
    trashedAssetCount: number;
    inUseAssetCount: number;
    historyOnlyAssetCount: number;
    recentUnreferencedAssetCount: number;
    cleanupCandidateCount: number;
    reviewRequiredCount: number;
    totalBytes: number;
    activeBytes: number;
    trashedBytes: number;
    inUseBytes: number;
    historyOnlyBytes: number;
    recentUnreferencedBytes: number;
    potentialReclaimableBytes: number;
    reviewRequiredBytes: number;
  };
  cleanupCandidateAssetIds: string[];
  reviewRequiredAssetIds: string[];
};

function safeBytes(value: unknown) {
  const bytes = Number(value);
  return Number.isFinite(bytes) && bytes >= 0 ? Math.trunc(bytes) : 0;
}

function resolveGraceHours(value: unknown) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0
    ? hours
    : DEFAULT_CREATOR_MEDIA_ORPHAN_GRACE_HOURS;
}

export type CreatorMediaOrphanTrashReason =
  | "unsupported_kind"
  | "state_changed"
  | "in_use"
  | "history_only"
  | "age_unknown"
  | "grace_not_met";

export type CreatorMediaOrphanTrashEligibility =
  | {
      eligible: true;
      graceHours: number;
      ageHours: number;
    }
  | {
      eligible: false;
      reason: CreatorMediaOrphanTrashReason;
      graceHours: number;
      ageHours: number | null;
    };

export function resolveCreatorMediaOrphanTrashEligibility(
  asset: CreatorMediaCostHygieneAsset,
  options: {
    now?: number;
    graceHours?: number;
  } = {},
): CreatorMediaOrphanTrashEligibility {
  const graceHours = resolveGraceHours(options.graceHours);

  if (!["image", "video", "final_video"].includes(asset.mediaKind)) {
    return {
      eligible: false,
      reason: "unsupported_kind",
      graceHours,
      ageHours: null,
    };
  }

  if (asset.lifecycleState !== "active") {
    return {
      eligible: false,
      reason: "state_changed",
      graceHours,
      ageHours: null,
    };
  }

  if (asset.cleanupState === "IN_USE") {
    return {
      eligible: false,
      reason: "in_use",
      graceHours,
      ageHours: null,
    };
  }

  if (asset.cleanupState === "HISTORY_ONLY") {
    return {
      eligible: false,
      reason: "history_only",
      graceHours,
      ageHours: null,
    };
  }

  if (asset.cleanupState !== "UNREFERENCED") {
    return {
      eligible: false,
      reason: "state_changed",
      graceHours,
      ageHours: null,
    };
  }

  const createdAtMs = asset.createdAt
    ? Date.parse(asset.createdAt)
    : Number.NaN;

  if (!Number.isFinite(createdAtMs)) {
    return {
      eligible: false,
      reason: "age_unknown",
      graceHours,
      ageHours: null,
    };
  }

  const now = Number.isFinite(options.now)
    ? Number(options.now)
    : Date.now();

  const ageHours = Math.max(0, now - createdAtMs) / 3_600_000;

  if (ageHours < graceHours) {
    return {
      eligible: false,
      reason: "grace_not_met",
      graceHours,
      ageHours,
    };
  }

  return {
    eligible: true,
    graceHours,
    ageHours,
  };
}

export function auditCreatorMediaCostHygiene(
  assets: readonly CreatorMediaCostHygieneAsset[],
  options: {
    now?: number;
    graceHours?: number;
  } = {},
): CreatorMediaCostHygieneAudit {
  const now = Number.isFinite(options.now)
    ? Number(options.now)
    : Date.now();

  const graceHours = resolveGraceHours(options.graceHours);
  const graceMs = graceHours * 60 * 60 * 1000;

  const cleanupCandidateAssetIds: string[] = [];
  const reviewRequiredAssetIds: string[] = [];

  const metrics = {
    totalAssetCount: 0,
    activeAssetCount: 0,
    trashedAssetCount: 0,
    inUseAssetCount: 0,
    historyOnlyAssetCount: 0,
    recentUnreferencedAssetCount: 0,
    cleanupCandidateCount: 0,
    reviewRequiredCount: 0,
    totalBytes: 0,
    activeBytes: 0,
    trashedBytes: 0,
    inUseBytes: 0,
    historyOnlyBytes: 0,
    recentUnreferencedBytes: 0,
    potentialReclaimableBytes: 0,
    reviewRequiredBytes: 0,
  };

  for (const asset of assets) {
    if (asset.lifecycleState === "purged") continue;

    const bytes = safeBytes(asset.sizeBytes);
    metrics.totalAssetCount += 1;
    metrics.totalBytes += bytes;

    if (asset.lifecycleState === "trashed") {
      metrics.trashedAssetCount += 1;
      metrics.trashedBytes += bytes;
      continue;
    }

    metrics.activeAssetCount += 1;
    metrics.activeBytes += bytes;

    if (asset.cleanupState === "IN_USE") {
      metrics.inUseAssetCount += 1;
      metrics.inUseBytes += bytes;
      continue;
    }

    if (asset.cleanupState === "HISTORY_ONLY") {
      metrics.historyOnlyAssetCount += 1;
      metrics.historyOnlyBytes += bytes;
      continue;
    }

    if (asset.cleanupState !== "UNREFERENCED") {
      metrics.reviewRequiredCount += 1;
      metrics.reviewRequiredBytes += bytes;
      reviewRequiredAssetIds.push(asset.id);
      continue;
    }

    const createdAtMs = asset.createdAt
      ? Date.parse(asset.createdAt)
      : Number.NaN;

    if (!Number.isFinite(createdAtMs)) {
      metrics.reviewRequiredCount += 1;
      metrics.reviewRequiredBytes += bytes;
      reviewRequiredAssetIds.push(asset.id);
      continue;
    }

    const ageMs = Math.max(0, now - createdAtMs);

    if (ageMs < graceMs) {
      metrics.recentUnreferencedAssetCount += 1;
      metrics.recentUnreferencedBytes += bytes;
      continue;
    }

    metrics.cleanupCandidateCount += 1;
    metrics.potentialReclaimableBytes += bytes;
    cleanupCandidateAssetIds.push(asset.id);
  }

  cleanupCandidateAssetIds.sort();
  reviewRequiredAssetIds.sort();

  const requiresManualReview = reviewRequiredAssetIds.length > 0;
  const status =
    cleanupCandidateAssetIds.length > 0 || requiresManualReview
      ? "attention"
      : "clean";

  return {
    version: "0.20F1",
    status,
    requiresManualReview,
    graceHours,
    metrics,
    cleanupCandidateAssetIds,
    reviewRequiredAssetIds,
  };
}
