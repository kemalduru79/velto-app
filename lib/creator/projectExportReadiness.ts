export type CreatorProjectLifecycleStatus =
  | "draft"
  | "production_in_progress"
  | "production_ready"
  | "final_video_ready"
  | "publish_ready"
  | "exported"
  | "export_outdated";

export type CreatorProjectLifecycleNextAction =
  | "continue_brief"
  | "complete_production_assets"
  | "create_final_video"
  | "complete_publish_setup"
  | "download_publish_package"
  | "rebuild_export"
  | "none";

export type CreatorArtifactHistory = {
  hadFinalVideo: boolean;
  finalVideoSignature: string;
  hadPublishPackage: boolean;
  publishPackageSignature: string;
  packageDownloaded: boolean;
};

export const EMPTY_CREATOR_ARTIFACT_HISTORY: CreatorArtifactHistory = {
  hadFinalVideo: false,
  finalVideoSignature: "",
  hadPublishPackage: false,
  publishPackageSignature: "",
  packageDownloaded: false,
};

export type CreatorProjectExportReadinessInput = {
  hasProductionStage: boolean;
  totalScenes: number;
  visualReadyCount: number;
  voiceReadyCount: number;
  hasFinalVideo: boolean;
  currentExportSignature: string;
  storedExportSignature: string;
  publishReady: boolean;
  packageDownloaded: boolean;
  currentPublishSignature: string;
  storedPublishSignature: string;
  artifactHistory?: Partial<CreatorArtifactHistory> | null;
};

export type CreatorProjectExportReadinessReport = {
  version: "3U";
  status: CreatorProjectLifecycleStatus;
  progress: number;
  nextAction: CreatorProjectLifecycleNextAction;
  totalScenes: number;
  visualReadyCount: number;
  voiceReadyCount: number;
  assetsReady: boolean;
  finalVideo: {
    exists: boolean;
    current: boolean;
    hadArtifact: boolean;
    signature: string;
  };
  publishPackage: {
    ready: boolean;
    downloaded: boolean;
    current: boolean;
    hadArtifact: boolean;
    signature: string;
  };
  outdatedReasons: Array<"final_video_changed" | "publish_package_changed">;
};

export type CreatorProjectLifecycleSnapshot = {
  version: "3U";
  status: CreatorProjectLifecycleStatus;
  progress: number;
  totalScenes: number;
  visualReadyCount: number;
  voiceReadyCount: number;
  assetsReady: boolean;
  artifactHistory: CreatorArtifactHistory;
  updatedAt: string;
};

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function clampCount(value: unknown, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, Math.round(parsed)), maximum);
}

function normalizeHistory(
  value?: Partial<CreatorArtifactHistory> | null,
): CreatorArtifactHistory {
  return {
    hadFinalVideo: value?.hadFinalVideo === true,
    finalVideoSignature: hasText(value?.finalVideoSignature)
      ? String(value?.finalVideoSignature)
      : "",
    hadPublishPackage: value?.hadPublishPackage === true,
    publishPackageSignature: hasText(value?.publishPackageSignature)
      ? String(value?.publishPackageSignature)
      : "",
    packageDownloaded: value?.packageDownloaded === true,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function fnv1a64(value: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ (code + index), 0x85ebca6b);
  }

  return `${(left >>> 0).toString(16).padStart(8, "0")}${(
    right >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

export function createCreatorPublishArtifactSignature(
  value: unknown,
): string {
  const canonical = JSON.stringify(canonicalize(value));
  return `3U-${fnv1a64(canonical)}-${canonical.length}`;
}

export function createCreatorProjectExportReadiness(
  input: CreatorProjectExportReadinessInput,
): CreatorProjectExportReadinessReport {
  const totalScenes = Math.max(0, Math.round(Number(input.totalScenes) || 0));
  const visualReadyCount = clampCount(input.visualReadyCount, totalScenes);
  const voiceReadyCount = clampCount(input.voiceReadyCount, totalScenes);
  const assetsReady =
    totalScenes > 0 &&
    visualReadyCount >= totalScenes &&
    voiceReadyCount >= totalScenes;
  const history = normalizeHistory(input.artifactHistory);
  const currentExportSignature = hasText(input.currentExportSignature)
    ? input.currentExportSignature
    : "";
  const storedExportSignature = hasText(input.storedExportSignature)
    ? input.storedExportSignature
    : "";
  const currentPublishSignature = hasText(input.currentPublishSignature)
    ? input.currentPublishSignature
    : "";
  const storedPublishSignature = hasText(input.storedPublishSignature)
    ? input.storedPublishSignature
    : "";
  const finalVideoCurrent =
    input.hasFinalVideo &&
    Boolean(currentExportSignature) &&
    Boolean(storedExportSignature) &&
    currentExportSignature === storedExportSignature;
  const hadFinalVideo =
    history.hadFinalVideo ||
    input.hasFinalVideo ||
    Boolean(storedExportSignature) ||
    Boolean(history.finalVideoSignature);
  const packageDownloaded =
    input.packageDownloaded || history.packageDownloaded;
  const publishPackageCurrent =
    packageDownloaded &&
    finalVideoCurrent &&
    Boolean(currentPublishSignature) &&
    Boolean(storedPublishSignature) &&
    currentPublishSignature === storedPublishSignature;
  const hadPublishPackage =
    history.hadPublishPackage ||
    packageDownloaded ||
    Boolean(storedPublishSignature) ||
    Boolean(history.publishPackageSignature);
  const outdatedReasons: CreatorProjectExportReadinessReport["outdatedReasons"] =
    [];

  if (hadFinalVideo && !finalVideoCurrent) {
    outdatedReasons.push("final_video_changed");
  }

  if (hadPublishPackage && !publishPackageCurrent) {
    outdatedReasons.push("publish_package_changed");
  }

  let status: CreatorProjectLifecycleStatus;
  let nextAction: CreatorProjectLifecycleNextAction;
  let progress: number;

  if (outdatedReasons.length > 0) {
    status = "export_outdated";
    nextAction = "rebuild_export";
    progress = assetsReady ? 72 : 48;
  } else if (publishPackageCurrent) {
    status = "exported";
    nextAction = "none";
    progress = 100;
  } else if (finalVideoCurrent && input.publishReady) {
    status = "publish_ready";
    nextAction = "download_publish_package";
    progress = 90;
  } else if (finalVideoCurrent) {
    status = "final_video_ready";
    nextAction = "complete_publish_setup";
    progress = 78;
  } else if (assetsReady) {
    status = "production_ready";
    nextAction = "create_final_video";
    progress = 62;
  } else if (input.hasProductionStage || totalScenes > 0) {
    status = "production_in_progress";
    nextAction = "complete_production_assets";
    const assetDenominator = Math.max(1, totalScenes * 2);
    const assetRatio = (visualReadyCount + voiceReadyCount) / assetDenominator;
    progress = Math.max(20, Math.min(58, Math.round(20 + assetRatio * 38)));
  } else {
    status = "draft";
    nextAction = "continue_brief";
    progress = 10;
  }

  return {
    version: "3U",
    status,
    progress,
    nextAction,
    totalScenes,
    visualReadyCount,
    voiceReadyCount,
    assetsReady,
    finalVideo: {
      exists: input.hasFinalVideo,
      current: finalVideoCurrent,
      hadArtifact: hadFinalVideo,
      signature:
        storedExportSignature ||
        history.finalVideoSignature ||
        "",
    },
    publishPackage: {
      ready: input.publishReady,
      downloaded: packageDownloaded,
      current: publishPackageCurrent,
      hadArtifact: hadPublishPackage,
      signature:
        storedPublishSignature ||
        history.publishPackageSignature ||
        "",
    },
    outdatedReasons,
  };
}

export function createCreatorArtifactHistory(
  report: CreatorProjectExportReadinessReport,
): CreatorArtifactHistory {
  return {
    hadFinalVideo: report.finalVideo.hadArtifact,
    finalVideoSignature: report.finalVideo.signature,
    hadPublishPackage: report.publishPackage.hadArtifact,
    publishPackageSignature: report.publishPackage.signature,
    packageDownloaded: report.publishPackage.current,
  };
}

export function createCreatorProjectLifecycleSnapshot({
  report,
  artifactHistory,
  updatedAt = new Date().toISOString(),
}: {
  report: CreatorProjectExportReadinessReport;
  artifactHistory?: Partial<CreatorArtifactHistory> | null;
  updatedAt?: string;
}): CreatorProjectLifecycleSnapshot {
  const history = normalizeHistory(artifactHistory);
  const mergedHistory: CreatorArtifactHistory = {
    hadFinalVideo:
      history.hadFinalVideo || report.finalVideo.hadArtifact,
    finalVideoSignature:
      report.finalVideo.signature || history.finalVideoSignature,
    hadPublishPackage:
      history.hadPublishPackage || report.publishPackage.hadArtifact,
    publishPackageSignature:
      report.publishPackage.signature || history.publishPackageSignature,
    packageDownloaded: report.publishPackage.current,
  };

  return {
    version: "3U",
    status: report.status,
    progress: report.progress,
    totalScenes: report.totalScenes,
    visualReadyCount: report.visualReadyCount,
    voiceReadyCount: report.voiceReadyCount,
    assetsReady: report.assetsReady,
    artifactHistory: mergedHistory,
    updatedAt,
  };
}

export function parseCreatorProjectLifecycleSnapshot(
  value: unknown,
): CreatorProjectLifecycleSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.version !== "3U") {
    return null;
  }

  const validStatuses = new Set<CreatorProjectLifecycleStatus>([
    "draft",
    "production_in_progress",
    "production_ready",
    "final_video_ready",
    "publish_ready",
    "exported",
    "export_outdated",
  ]);
  const status = validStatuses.has(
    record.status as CreatorProjectLifecycleStatus,
  )
    ? (record.status as CreatorProjectLifecycleStatus)
    : "draft";
  const totalScenes = Math.max(0, Math.round(Number(record.totalScenes) || 0));
  const progress = Math.max(
    0,
    Math.min(100, Math.round(Number(record.progress) || 0)),
  );

  return {
    version: "3U",
    status,
    progress,
    totalScenes,
    visualReadyCount: clampCount(record.visualReadyCount, totalScenes),
    voiceReadyCount: clampCount(record.voiceReadyCount, totalScenes),
    assetsReady: record.assetsReady === true,
    artifactHistory: normalizeHistory(
      record.artifactHistory as Partial<CreatorArtifactHistory>,
    ),
    updatedAt: hasText(record.updatedAt)
      ? String(record.updatedAt)
      : "",
  };
}
