import {
  createCreatorProjectPerformanceReport,
  parseCreatorProjectPerformanceHistory,
  type CreatorProjectPerformanceContinuity,
  type CreatorProjectPerformanceFinalGate,
  type CreatorProjectPerformanceReport,
  type CreatorProjectPerformanceScene,
} from "./projectPerformanceReport";
import {
  parseCreatorProjectLifecycleSnapshot,
  type CreatorArtifactHistory,
  type CreatorProjectExportReadinessReport,
  type CreatorProjectLifecycleNextAction,
  type CreatorProjectLifecycleStatus,
} from "./projectExportReadiness";

export type CreatorCentralProjectRecord = Record<string, unknown> & {
  id?: string;
};

export type CreatorCentralProjectSummary = {
  id: string;
  title: string;
  status: CreatorProjectLifecycleStatus;
  progress: number;
  sceneCount: number;
  targetDurationSec: number;
  updatedAt: string;
  createdAt: string;
  finalVideoReady: boolean;
  publishPackageReady: boolean;
  needsAttention: boolean;
};

export type CreatorCentralPortfolioSummary = {
  totalProjects: number;
  activeProjects: number;
  productionReadyProjects: number;
  publishReadyProjects: number;
  exportedProjects: number;
  outdatedProjects: number;
  totalScenes: number;
  finalVideos: number;
  statusCounts: Record<CreatorProjectLifecycleStatus, number>;
  projects: CreatorCentralProjectSummary[];
};

const ALL_STATUSES: CreatorProjectLifecycleStatus[] = [
  "draft",
  "production_in_progress",
  "production_ready",
  "final_video_ready",
  "publish_ready",
  "exported",
  "export_outdated",
];

const PROGRESS_BY_STATUS: Record<CreatorProjectLifecycleStatus, number> = {
  draft: 10,
  production_in_progress: 35,
  production_ready: 62,
  final_video_ready: 78,
  publish_ready: 90,
  exported: 100,
  export_outdated: 72,
};

const NEXT_ACTION_BY_STATUS: Record<
  CreatorProjectLifecycleStatus,
  CreatorProjectLifecycleNextAction
> = {
  draft: "continue_brief",
  production_in_progress: "complete_production_assets",
  production_ready: "create_final_video",
  final_video_ready: "complete_publish_setup",
  publish_ready: "download_publish_package",
  exported: "none",
  export_outdated: "rebuild_export",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeIsoDate(value: unknown) {
  if (!hasText(value)) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function sceneHasReadyVideo(scene: Record<string, unknown>) {
  return (
    hasText(scene.videoUrl) &&
    String(scene.videoStatus || "").toLowerCase() === "done"
  );
}

function sceneHasReadyVisual(scene: Record<string, unknown>) {
  return hasText(scene.image) || sceneHasReadyVideo(scene);
}

function sceneHasReadyVoice(scene: Record<string, unknown>) {
  const narrationReady =
    !hasText(scene.narration) || hasText(scene.audioUrl);
  const dialogueReady =
    !hasText(scene.dialogue) || hasText(scene.dialogueAudioUrl);

  return narrationReady && dialogueReady;
}

function getSceneDuration(scene: Record<string, unknown>) {
  const timing = asRecord(scene.timing);
  return Math.max(
    0,
    safeNumber(
      timing.targetSceneDuration ??
        timing.targetDurationSec ??
        scene.durationSec,
    ),
  );
}

function getProjectScenes(project: CreatorCentralProjectRecord) {
  return asArray(project.scenes).map(asRecord);
}

function getProjectExportResult(project: CreatorCentralProjectRecord) {
  return asRecord(project.exported_movie_result);
}

function isCreatorLabProject(project: CreatorCentralProjectRecord) {
  const flow = String(project.flow_type || "").toLowerCase();
  return flow === "creator_lab" || flow === "creatorlab";
}

function inferLifecycleStatus(
  project: CreatorCentralProjectRecord,
  sceneCount: number,
): CreatorProjectLifecycleStatus {
  const exportResult = getProjectExportResult(project);
  const lifecycleSnapshot = parseCreatorProjectLifecycleSnapshot(
    exportResult.projectLifecycle,
  );

  if (lifecycleSnapshot) return lifecycleSnapshot.status;
  if (hasText(project.exported_movie_url)) return "final_video_ready";
  if (sceneCount > 0) return "production_in_progress";
  return "draft";
}

function getArtifactHistory(
  project: CreatorCentralProjectRecord,
): CreatorArtifactHistory {
  const exportResult = getProjectExportResult(project);
  const lifecycleSnapshot = parseCreatorProjectLifecycleSnapshot(
    exportResult.projectLifecycle,
  );

  if (lifecycleSnapshot) return lifecycleSnapshot.artifactHistory;

  return {
    hadFinalVideo: hasText(project.exported_movie_url),
    finalVideoSignature: hasText(project.export_signature)
      ? String(project.export_signature)
      : "",
    hadPublishPackage: false,
    publishPackageSignature: "",
    packageDownloaded: false,
  };
}

function getLifecycleReport(
  project: CreatorCentralProjectRecord,
): CreatorProjectExportReadinessReport {
  const scenes = getProjectScenes(project);
  const exportResult = getProjectExportResult(project);
  const lifecycleSnapshot = parseCreatorProjectLifecycleSnapshot(
    exportResult.projectLifecycle,
  );
  const status = inferLifecycleStatus(project, scenes.length);
  const artifactHistory = getArtifactHistory(project);
  const finalVideoExists = hasText(project.exported_movie_url);
  const finalVideoCurrent =
    status === "final_video_ready" ||
    status === "publish_ready" ||
    status === "exported";
  const publishPackageCurrent = status === "exported";
  const visualReadyCount = lifecycleSnapshot?.visualReadyCount ??
    scenes.filter(sceneHasReadyVisual).length;
  const voiceReadyCount = lifecycleSnapshot?.voiceReadyCount ??
    scenes.filter(sceneHasReadyVoice).length;
  const totalScenes = scenes.length;

  return {
    version: "3U",
    status,
    progress:
      lifecycleSnapshot?.progress ?? PROGRESS_BY_STATUS[status],
    nextAction: NEXT_ACTION_BY_STATUS[status],
    totalScenes,
    visualReadyCount,
    voiceReadyCount,
    assetsReady:
      lifecycleSnapshot?.assetsReady ??
      (totalScenes > 0 &&
        visualReadyCount >= totalScenes &&
        voiceReadyCount >= totalScenes),
    finalVideo: {
      exists: finalVideoExists,
      current: finalVideoCurrent,
      hadArtifact: artifactHistory.hadFinalVideo || finalVideoExists,
      signature:
        (hasText(project.export_signature)
          ? String(project.export_signature)
          : artifactHistory.finalVideoSignature) || "",
    },
    publishPackage: {
      ready: status === "publish_ready" || status === "exported",
      downloaded:
        publishPackageCurrent || artifactHistory.packageDownloaded,
      current: publishPackageCurrent,
      hadArtifact:
        artifactHistory.hadPublishPackage ||
        artifactHistory.packageDownloaded ||
        publishPackageCurrent,
      signature: artifactHistory.publishPackageSignature || "",
    },
    outdatedReasons:
      status === "export_outdated"
        ? artifactHistory.hadFinalVideo
          ? ["final_video_changed", ...(artifactHistory.hadPublishPackage
              ? (["publish_package_changed"] as const)
              : [])]
          : artifactHistory.hadPublishPackage
            ? ["publish_package_changed"]
            : ["final_video_changed"]
        : [],
  };
}

function getQualityMode(project: CreatorCentralProjectRecord) {
  const production = asRecord(project.creator_production_package);
  const quality = production.qualityMode ?? production.quality_mode;

  return quality === "draft" ||
    quality === "pro" ||
    quality === "cinematic"
    ? quality
    : "standard";
}

function getFormat(project: CreatorCentralProjectRecord) {
  const production = asRecord(project.creator_production_package);
  const explicit = production.format;

  if (explicit === "youtube_video" || explicit === "short_form") {
    return explicit;
  }

  return safeNumber(production.durationSec) > 180
    ? "youtube_video"
    : "short_form";
}

function getTargetPlatforms(project: CreatorCentralProjectRecord) {
  const production = asRecord(project.creator_production_package);
  const platforms = asArray(
    production.targetPlatforms ?? production.target_platforms,
  )
    .filter(hasText)
    .map(String);

  return platforms.length ? platforms : ["youtube"];
}

function getContinuity(
  project: CreatorCentralProjectRecord,
): CreatorProjectPerformanceContinuity | null {
  const exportResult = getProjectExportResult(project);
  const production = asRecord(project.creator_production_package);
  const candidate = asRecord(
    exportResult.flowContinuityAudit ??
      exportResult.continuity ??
      production.flowContinuityAudit,
  );

  if (!Object.keys(candidate).length) return null;

  return {
    status:
      candidate.status === "ready" ||
      candidate.status === "review" ||
      candidate.status === "high_risk"
        ? candidate.status
        : undefined,
    safeScenes: safeNumber(candidate.safeScenes),
    warningScenes: safeNumber(candidate.warningScenes),
    highRiskScenes: safeNumber(candidate.highRiskScenes),
    unmeasuredAudioScenes: safeNumber(candidate.unmeasuredAudioScenes),
    freezeRiskScenes: safeNumber(candidate.freezeRiskScenes),
    totalAudioDurationSec: safeNumber(candidate.totalAudioDurationSec),
    totalTargetDurationSec: safeNumber(candidate.totalTargetDurationSec),
    totalVisualDurationSec: safeNumber(candidate.totalVisualDurationSec),
    totalUncoveredDurationSec: safeNumber(candidate.totalUncoveredDurationSec),
  };
}

function getFinalGate(
  project: CreatorCentralProjectRecord,
): CreatorProjectPerformanceFinalGate | null {
  const exportResult = getProjectExportResult(project);
  const candidate = asRecord(
    exportResult.finalProductionGate ?? exportResult.productionGate,
  );
  const status = candidate.status;

  return status === "checking" ||
    status === "blocked" ||
    status === "review" ||
    status === "ready"
    ? { status }
    : null;
}

function hasMetadata(project: CreatorCentralProjectRecord) {
  const metadata = asRecord(project.youtube_metadata);
  return (
    hasText(metadata.recommendedTitle) ||
    hasText(metadata.description) ||
    asArray(metadata.titleOptions).length > 0
  );
}

function hasThumbnail(project: CreatorCentralProjectRecord) {
  const thumbnail = asRecord(project.youtube_thumbnail);
  return hasText(thumbnail.imageUrl) || hasText(thumbnail.sourceImageUrl);
}

function hasCaptions(project: CreatorCentralProjectRecord) {
  return getProjectScenes(project).some(
    (scene) =>
      hasText(scene.narration) ||
      hasText(scene.dialogue) ||
      hasText(scene.text),
  );
}

function timelineApproved(
  project: CreatorCentralProjectRecord,
  status: CreatorProjectLifecycleStatus,
) {
  if (
    status === "production_ready" ||
    status === "final_video_ready" ||
    status === "publish_ready" ||
    status === "exported" ||
    status === "export_outdated"
  ) {
    return true;
  }

  const production = asRecord(project.creator_production_package);
  const timeline = asRecord(production.timelineSyncPlan);

  return (
    timeline.approved === true ||
    timeline.status === "approved" ||
    timeline.status === "ready"
  );
}

function toPerformanceScenes(
  project: CreatorCentralProjectRecord,
): CreatorProjectPerformanceScene[] {
  return getProjectScenes(project).map((scene, index) => ({
    id:
      typeof scene.id === "string" || typeof scene.id === "number"
        ? scene.id
        : index + 1,
    renderMode:
      scene.renderMode === "video" ||
      scene.renderMode === "image" ||
      scene.renderMode === "auto"
        ? scene.renderMode
        : "auto",
    image: hasText(scene.image) ? String(scene.image) : undefined,
    videoUrl: hasText(scene.videoUrl) ? String(scene.videoUrl) : undefined,
    videoStatus: hasText(scene.videoStatus)
      ? String(scene.videoStatus)
      : undefined,
    narration: hasText(scene.narration)
      ? String(scene.narration)
      : undefined,
    dialogue: hasText(scene.dialogue)
      ? String(scene.dialogue)
      : undefined,
    audioUrl: hasText(scene.audioUrl) ? String(scene.audioUrl) : undefined,
    dialogueAudioUrl: hasText(scene.dialogueAudioUrl)
      ? String(scene.dialogueAudioUrl)
      : undefined,
    timing: Object.keys(asRecord(scene.timing)).length
      ? {
          targetSceneDuration: safeNumber(
            asRecord(scene.timing).targetSceneDuration,
          ),
          narrationDuration: safeNumber(
            asRecord(scene.timing).narrationDuration,
          ),
          dialogueDuration: safeNumber(
            asRecord(scene.timing).dialogueDuration,
          ),
          durationMatchStatus: hasText(
            asRecord(scene.timing).durationMatchStatus,
          )
            ? String(asRecord(scene.timing).durationMatchStatus)
            : undefined,
          splitRecommended:
            asRecord(scene.timing).splitRecommended === true,
        }
      : null,
  }));
}

export function createCreatorCentralProjectSummary(
  project: CreatorCentralProjectRecord,
): CreatorCentralProjectSummary {
  const scenes = getProjectScenes(project);
  const status = inferLifecycleStatus(project, scenes.length);
  const exportResult = getProjectExportResult(project);
  const lifecycleSnapshot = parseCreatorProjectLifecycleSnapshot(
    exportResult.projectLifecycle,
  );

  return {
    id: hasText(project.id) ? String(project.id) : "",
    title: hasText(project.title) ? String(project.title) : "Untitled project",
    status,
    progress:
      lifecycleSnapshot?.progress ?? PROGRESS_BY_STATUS[status],
    sceneCount: scenes.length,
    targetDurationSec: Math.round(
      scenes.reduce((sum, scene) => sum + getSceneDuration(scene), 0) * 10,
    ) / 10,
    updatedAt: safeIsoDate(project.updated_at),
    createdAt: safeIsoDate(project.created_at),
    finalVideoReady: hasText(project.exported_movie_url),
    publishPackageReady: status === "exported",
    needsAttention: status === "export_outdated",
  };
}

export function createCreatorCentralPortfolioSummary(
  records: CreatorCentralProjectRecord[],
): CreatorCentralPortfolioSummary {
  const projects = (Array.isArray(records) ? records : [])
    .filter(isCreatorLabProject)
    .map(createCreatorCentralProjectSummary)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(
        right.updatedAt || right.createdAt || 0,
      ).getTime();
      return rightTime - leftTime;
    });

  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map((status) => [status, 0]),
  ) as Record<CreatorProjectLifecycleStatus, number>;

  projects.forEach((project) => {
    statusCounts[project.status] += 1;
  });

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter(
      (project) => project.status !== "exported",
    ).length,
    productionReadyProjects: projects.filter((project) =>
      [
        "production_ready",
        "final_video_ready",
        "publish_ready",
        "exported",
      ].includes(project.status),
    ).length,
    publishReadyProjects: statusCounts.publish_ready,
    exportedProjects: statusCounts.exported,
    outdatedProjects: statusCounts.export_outdated,
    totalScenes: projects.reduce(
      (sum, project) => sum + project.sceneCount,
      0,
    ),
    finalVideos: projects.filter((project) => project.finalVideoReady).length,
    statusCounts,
    projects,
  };
}

export function createCreatorProjectPerformanceReportFromRecord({
  project,
  locale,
}: {
  project: CreatorCentralProjectRecord;
  locale: "tr" | "en";
}): CreatorProjectPerformanceReport {
  const lifecycle = getLifecycleReport(project);
  const exportResult = getProjectExportResult(project);
  const metadataReady = hasMetadata(project);
  const thumbnailReady = hasThumbnail(project);
  const captionsReady = hasCaptions(project);
  const finalVideoReady = lifecycle.finalVideo.current;
  const systemChecks = [
    finalVideoReady,
    thumbnailReady,
    metadataReady,
    captionsReady,
  ];
  const confirmationsTotal = 4;
  const confirmationsReady = lifecycle.publishPackage.current
    ? confirmationsTotal
    : 0;
  const history = parseCreatorProjectPerformanceHistory(
    exportResult.projectPerformanceHistory,
  );
  const production = asRecord(project.creator_production_package);
  const mentor = asRecord(project.creator_mentor_result);

  return createCreatorProjectPerformanceReport({
    locale,
    title: hasText(project.title)
      ? String(project.title)
      : locale === "tr"
        ? "İsimsiz CreatorLab projesi"
        : "Untitled CreatorLab project",
    projectId: hasText(project.id) ? String(project.id) : undefined,
    generatedAt: new Date().toISOString(),
    qualityMode: getQualityMode(project),
    format: getFormat(project),
    targetPlatforms: getTargetPlatforms(project),
    scenes: toPerformanceScenes(project),
    lifecycle,
    lifecycleHistory: history,
    timelineApproved: timelineApproved(project, lifecycle.status),
    continuity: getContinuity(project),
    finalGate: getFinalGate(project),
    publish: {
      finalVideoReady,
      thumbnailReady,
      metadataReady,
      captionsReady,
      systemChecksReady: systemChecks.filter(Boolean).length,
      systemChecksTotal: systemChecks.length,
      confirmationsReady,
      confirmationsTotal,
      packageDownloaded: lifecycle.publishPackage.current,
    },
    intelligence: {
      hookScore:
        safeNumber(
          production.hookScore ??
            production.opportunityScore ??
            mentor.hookScore,
          -1,
        ) >= 0
          ? safeNumber(
              production.hookScore ??
                production.opportunityScore ??
                mentor.hookScore,
            )
          : undefined,
      hookLevel: hasText(production.hookLevel)
        ? String(production.hookLevel)
        : undefined,
    },
  });
}

export function getCreatorCentralStatusLabel(
  status: CreatorProjectLifecycleStatus,
  locale: "tr" | "en",
) {
  const labels: Record<
    CreatorProjectLifecycleStatus,
    { tr: string; en: string }
  > = {
    draft: { tr: "Taslak", en: "Draft" },
    production_in_progress: {
      tr: "Üretim devam ediyor",
      en: "In Production",
    },
    production_ready: { tr: "Üretime hazır", en: "Production Ready" },
    final_video_ready: {
      tr: "Final video hazır",
      en: "Final Video Ready",
    },
    publish_ready: { tr: "Yayına hazır", en: "Publish Ready" },
    exported: { tr: "Dışa aktarıldı", en: "Exported" },
    export_outdated: {
      tr: "Çıktı güncel değil",
      en: "Export Outdated",
    },
  };

  return labels[status][locale];
}
