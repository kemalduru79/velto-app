import {
  getOperationCreditCost,
  normalizeCreditQualityMode,
  type CreditQualityMode,
} from "../credits/operationPolicy";
import type {
  CreatorProjectExportReadinessReport,
  CreatorProjectLifecycleNextAction,
  CreatorProjectLifecycleStatus,
} from "./projectExportReadiness";

export type CreatorProjectPerformanceHistoryEntry = {
  status: CreatorProjectLifecycleStatus;
  recordedAt: string;
};

export type CreatorProjectPerformanceScene = {
  id: string | number;
  renderMode?: "auto" | "video" | "image";
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
  narration?: string;
  dialogue?: string;
  audioUrl?: string;
  dialogueAudioUrl?: string;
  timing?: {
    targetSceneDuration?: number;
    narrationDuration?: number;
    dialogueDuration?: number;
    durationMatchStatus?: string;
    splitRecommended?: boolean;
  } | null;
};

export type CreatorProjectPerformanceContinuity = {
  status?: "ready" | "review" | "high_risk";
  safeScenes?: number;
  warningScenes?: number;
  highRiskScenes?: number;
  unmeasuredAudioScenes?: number;
  freezeRiskScenes?: number;
  totalAudioDurationSec?: number;
  totalTargetDurationSec?: number;
  totalVisualDurationSec?: number;
  totalUncoveredDurationSec?: number;
};

export type CreatorProjectPerformanceFinalGate = {
  status?: "checking" | "blocked" | "review" | "ready";
};

export type CreatorProjectPerformanceInput = {
  locale: "tr" | "en";
  title: string;
  projectId?: string;
  generatedAt?: string;
  qualityMode: CreditQualityMode | string;
  format: "short_form" | "youtube_video" | string;
  targetPlatforms: string[];
  scenes: CreatorProjectPerformanceScene[];
  lifecycle?: CreatorProjectExportReadinessReport | null;
  lifecycleHistory?: CreatorProjectPerformanceHistoryEntry[] | null;
  timelineApproved: boolean;
  continuity?: CreatorProjectPerformanceContinuity | null;
  finalGate?: CreatorProjectPerformanceFinalGate | null;
  publish: {
    finalVideoReady: boolean;
    thumbnailReady: boolean;
    metadataReady: boolean;
    captionsReady: boolean;
    systemChecksReady: number;
    systemChecksTotal: number;
    confirmationsReady: number;
    confirmationsTotal: number;
    packageDownloaded: boolean;
  };
  intelligence?: {
    hookScore?: number;
    hookLevel?: string;
  } | null;
};

export type CreatorProjectPerformanceCreditLine = {
  operation: "image" | "voice" | "dialogue_voice" | "video" | "export";
  completedUnits: number;
  remainingUnits: number;
  creditsPerUnit: number;
  estimatedUsedCredits: number;
  estimatedRemainingCredits: number;
};

export type CreatorProjectPerformanceReport = {
  version: "REPORT-P1";
  generatedAt: string;
  locale: "tr" | "en";
  project: {
    id: string;
    title: string;
    format: string;
    qualityMode: CreditQualityMode;
    targetPlatforms: string[];
  };
  status: "ready" | "attention" | "blocked";
  performanceScore: number;
  lifecycle: {
    status: CreatorProjectLifecycleStatus;
    progress: number;
    nextAction: CreatorProjectLifecycleNextAction;
    outdatedReasons: string[];
    history: CreatorProjectPerformanceHistoryEntry[];
  };
  production: {
    totalScenes: number;
    targetDurationSec: number;
    imageReadyScenes: number;
    videoReadyScenes: number;
    visualReadyScenes: number;
    narrationScenes: number;
    dialogueScenes: number;
    voiceReadyScenes: number;
    exactTimedScenes: number;
    splitRecommendedScenes: number;
  };
  continuity: {
    status: "ready" | "review" | "high_risk" | "not_measured";
    safeScenes: number;
    warningScenes: number;
    highRiskScenes: number;
    freezeRiskScenes: number;
    unmeasuredAudioScenes: number;
    uncoveredDurationSec: number;
  };
  publish: {
    finalVideoReady: boolean;
    thumbnailReady: boolean;
    metadataReady: boolean;
    captionsReady: boolean;
    systemChecksReady: number;
    systemChecksTotal: number;
    confirmationsReady: number;
    confirmationsTotal: number;
    packageDownloaded: boolean;
    readinessPercent: number;
  };
  credits: {
    estimateOnly: true;
    estimatedUsedCredits: number;
    estimatedRemainingCredits: number;
    estimatedTotalCredits: number;
    lines: CreatorProjectPerformanceCreditLine[];
    note: string;
  };
  intelligence: {
    hookScore: number | null;
    hookLevel: string;
  };
  findings: {
    strengths: string[];
    warnings: string[];
    blockers: string[];
  };
  nextActions: string[];
};

const LIFECYCLE_STATUSES = new Set<CreatorProjectLifecycleStatus>([
  "draft",
  "production_in_progress",
  "production_ready",
  "final_video_ready",
  "publish_ready",
  "exported",
  "export_outdated",
]);

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeIso(value: unknown, fallback = new Date().toISOString()) {
  if (!hasText(value)) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function uniqueText(values: string[], max = 8) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(
    0,
    max,
  );
}

function defaultLifecycle(): CreatorProjectExportReadinessReport {
  return {
    version: "3U",
    status: "draft",
    progress: 10,
    nextAction: "continue_brief",
    totalScenes: 0,
    visualReadyCount: 0,
    voiceReadyCount: 0,
    assetsReady: false,
    finalVideo: {
      exists: false,
      current: false,
      hadArtifact: false,
      signature: "",
    },
    publishPackage: {
      ready: false,
      downloaded: false,
      current: false,
      hadArtifact: false,
      signature: "",
    },
    outdatedReasons: [],
  };
}

export function parseCreatorProjectPerformanceHistory(
  value: unknown,
): CreatorProjectPerformanceHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const result: CreatorProjectPerformanceHistoryEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    const status = String(record.status || "") as CreatorProjectLifecycleStatus;

    if (!LIFECYCLE_STATUSES.has(status)) continue;

    const nextEntry = {
      status,
      recordedAt: safeIso(record.recordedAt),
    };
    const previous = result[result.length - 1];

    if (previous?.status === nextEntry.status) {
      result[result.length - 1] = nextEntry;
    } else {
      result.push(nextEntry);
    }
  }

  return result.slice(-20);
}

export function appendCreatorProjectPerformanceHistory({
  history,
  status,
  recordedAt = new Date().toISOString(),
}: {
  history?: CreatorProjectPerformanceHistoryEntry[] | null;
  status: CreatorProjectLifecycleStatus;
  recordedAt?: string;
}): CreatorProjectPerformanceHistoryEntry[] {
  const normalized = parseCreatorProjectPerformanceHistory(history);
  const nextEntry = {
    status,
    recordedAt: safeIso(recordedAt),
  };
  const previous = normalized[normalized.length - 1];

  if (previous?.status === status) {
    return normalized;
  }

  return [...normalized, nextEntry].slice(-20);
}

function getSceneTargetDuration(scene: CreatorProjectPerformanceScene) {
  return Math.max(0, safeNumber(scene.timing?.targetSceneDuration));
}

function sceneHasReadyVideo(scene: CreatorProjectPerformanceScene) {
  return hasText(scene.videoUrl) && String(scene.videoStatus || "").toLowerCase() === "done";
}

function sceneHasReadyVisual(scene: CreatorProjectPerformanceScene) {
  if (scene.renderMode === "video") return sceneHasReadyVideo(scene);
  if (scene.renderMode === "image") return hasText(scene.image);
  return sceneHasReadyVideo(scene) || hasText(scene.image);
}

function sceneHasReadyVoice(scene: CreatorProjectPerformanceScene) {
  const narrationReady = !hasText(scene.narration) || hasText(scene.audioUrl);
  const dialogueReady = !hasText(scene.dialogue) || hasText(scene.dialogueAudioUrl);
  return narrationReady && dialogueReady;
}

function buildCreditLine({
  operation,
  completedUnits,
  remainingUnits,
  creditsPerUnit,
}: {
  operation: CreatorProjectPerformanceCreditLine["operation"];
  completedUnits: number;
  remainingUnits: number;
  creditsPerUnit: number;
}): CreatorProjectPerformanceCreditLine {
  return {
    operation,
    completedUnits,
    remainingUnits,
    creditsPerUnit,
    estimatedUsedCredits: completedUnits * creditsPerUnit,
    estimatedRemainingCredits: remainingUnits * creditsPerUnit,
  };
}

function getLifecycleActionText(
  action: CreatorProjectLifecycleNextAction,
  isTr: boolean,
) {
  const labels: Record<CreatorProjectLifecycleNextAction, [string, string]> = {
    continue_brief: ["Brief ve içerik yönünü tamamla.", "Complete the brief and content direction."],
    complete_production_assets: ["Eksik görsel ve ses varlıklarını tamamla.", "Complete the missing visual and voice assets."],
    create_final_video: ["Final videoyu oluştur.", "Create the final video."],
    complete_publish_setup: ["Thumbnail, metadata ve yayın kontrollerini tamamla.", "Complete thumbnail, metadata, and publishing checks."],
    download_publish_package: ["Creator Package paketini indir.", "Download the Creator Package."],
    rebuild_export: ["Güncelliğini kaybeden çıktıları yeniden oluştur.", "Rebuild the outdated outputs."],
    none: ["Proje ve yayın paketi güncel.", "The project and release package are current."],
  };

  return labels[action][isTr ? 0 : 1];
}

export function createCreatorProjectPerformanceReport(
  input: CreatorProjectPerformanceInput,
): CreatorProjectPerformanceReport {
  const isTr = input.locale === "tr";
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  const lifecycle = input.lifecycle || defaultLifecycle();
  const qualityMode = normalizeCreditQualityMode(input.qualityMode);
  const totalScenes = scenes.length;
  const imageReadyScenes = scenes.filter((scene) => hasText(scene.image)).length;
  const videoReadyScenes = scenes.filter(sceneHasReadyVideo).length;
  const visualReadyScenes = scenes.filter(sceneHasReadyVisual).length;
  const narrationScenes = scenes.filter((scene) => hasText(scene.narration)).length;
  const dialogueScenes = scenes.filter((scene) => hasText(scene.dialogue)).length;
  const voiceReadyScenes = scenes.filter(sceneHasReadyVoice).length;
  const narrationTracksReady = scenes.filter(
    (scene) => hasText(scene.narration) && hasText(scene.audioUrl),
  ).length;
  const dialogueTracksReady = scenes.filter(
    (scene) => hasText(scene.dialogue) && hasText(scene.dialogueAudioUrl),
  ).length;
  const exactTimedScenes = scenes.filter((scene) => {
    const status = String(scene.timing?.durationMatchStatus || "").toLowerCase();
    return status === "matched" || status === "safe" || status === "measured";
  }).length;
  const splitRecommendedScenes = scenes.filter(
    (scene) => scene.timing?.splitRecommended === true,
  ).length;
  const targetDurationSec = round(
    scenes.reduce((sum, scene) => sum + getSceneTargetDuration(scene), 0),
    1,
  );
  const desiredVideoScenes = scenes.filter((scene) => scene.renderMode === "video").length;
  const missingVideoScenes = scenes.filter(
    (scene) => scene.renderMode === "video" && !sceneHasReadyVideo(scene),
  ).length;
  const missingImageScenes = scenes.filter(
    (scene) => !hasText(scene.image) && !sceneHasReadyVideo(scene),
  ).length;
  const missingNarrationTracks = scenes.filter(
    (scene) => hasText(scene.narration) && !hasText(scene.audioUrl),
  ).length;
  const missingDialogueTracks = scenes.filter(
    (scene) => hasText(scene.dialogue) && !hasText(scene.dialogueAudioUrl),
  ).length;
  const finalVideoCurrent = lifecycle.finalVideo.current || input.publish.finalVideoReady;
  const creditLines = [
    buildCreditLine({
      operation: "image",
      completedUnits: imageReadyScenes,
      remainingUnits: missingImageScenes,
      creditsPerUnit: getOperationCreditCost("creator_image", qualityMode),
    }),
    buildCreditLine({
      operation: "voice",
      completedUnits: narrationTracksReady,
      remainingUnits: missingNarrationTracks,
      creditsPerUnit: getOperationCreditCost("creator_voice", qualityMode),
    }),
    buildCreditLine({
      operation: "dialogue_voice",
      completedUnits: dialogueTracksReady,
      remainingUnits: missingDialogueTracks,
      creditsPerUnit: getOperationCreditCost("creator_dialogue_voice", qualityMode),
    }),
    buildCreditLine({
      operation: "video",
      completedUnits: Math.min(videoReadyScenes, desiredVideoScenes || videoReadyScenes),
      remainingUnits: missingVideoScenes,
      creditsPerUnit: getOperationCreditCost("creator_video", qualityMode),
    }),
    buildCreditLine({
      operation: "export",
      completedUnits: finalVideoCurrent ? 1 : 0,
      remainingUnits: finalVideoCurrent || totalScenes === 0 ? 0 : 1,
      creditsPerUnit: getOperationCreditCost("creator_export", qualityMode),
    }),
  ];
  const estimatedUsedCredits = creditLines.reduce(
    (sum, line) => sum + line.estimatedUsedCredits,
    0,
  );
  const estimatedRemainingCredits = creditLines.reduce(
    (sum, line) => sum + line.estimatedRemainingCredits,
    0,
  );
  const continuityStatus = input.continuity?.status || "not_measured";
  const systemChecksTotal = Math.max(0, input.publish.systemChecksTotal);
  const confirmationsTotal = Math.max(0, input.publish.confirmationsTotal);
  const publishReadyUnits =
    clamp(input.publish.systemChecksReady, 0, systemChecksTotal) +
    clamp(input.publish.confirmationsReady, 0, confirmationsTotal);
  const publishTotalUnits = systemChecksTotal + confirmationsTotal;
  const readinessPercent = input.publish.packageDownloaded
    ? 100
    : publishTotalUnits > 0
      ? Math.round((publishReadyUnits / publishTotalUnits) * 100)
      : 0;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];

  if (!input.timelineApproved && totalScenes > 0) {
    blockers.push(
      isTr
        ? "Timeline kontrolü henüz onaylanmadı."
        : "The timeline check has not been approved yet.",
    );
  }
  if (visualReadyScenes < totalScenes) {
    blockers.push(
      isTr
        ? `${totalScenes - visualReadyScenes} sahnede görsel varlık eksik.`
        : `${totalScenes - visualReadyScenes} scene(s) are missing a visual asset.`,
    );
  }
  if (voiceReadyScenes < totalScenes) {
    blockers.push(
      isTr
        ? `${totalScenes - voiceReadyScenes} sahnede ses hazırlığı eksik.`
        : `${totalScenes - voiceReadyScenes} scene(s) are missing voice readiness.`,
    );
  }
  if (input.finalGate?.status === "blocked") {
    blockers.push(
      isTr
        ? "Final üretim kontrolü export işlemini engelliyor."
        : "The final production gate is blocking export.",
    );
  }
  if (continuityStatus === "high_risk") {
    blockers.push(
      isTr
        ? "Akış denetiminde yüksek süreklilik riski var."
        : "The continuity audit contains high-risk findings.",
    );
  }
  if (lifecycle.status === "export_outdated") {
    warnings.push(
      isTr
        ? "Önceki final video veya yayın paketi güncelliğini kaybetti."
        : "A previous final video or release package is outdated.",
    );
  }
  if (continuityStatus === "review") {
    warnings.push(
      isTr
        ? "Akış denetimindeki uyarılar export öncesinde gözden geçirilmeli."
        : "Continuity warnings should be reviewed before export.",
    );
  }
  if (safeNumber(input.continuity?.unmeasuredAudioScenes) > 0) {
    warnings.push(
      isTr
        ? `${safeNumber(input.continuity?.unmeasuredAudioScenes)} sahnede ses süresi ölçülmedi.`
        : `${safeNumber(input.continuity?.unmeasuredAudioScenes)} scene(s) have unmeasured audio duration.`,
    );
  }
  if (!input.publish.metadataReady) {
    warnings.push(isTr ? "Yayın metadata'sı hazır değil." : "Publishing metadata is not ready.");
  }
  if (!input.publish.thumbnailReady) {
    warnings.push(isTr ? "Thumbnail seçimi tamamlanmadı." : "Thumbnail selection is incomplete.");
  }
  if (input.publish.confirmationsReady < confirmationsTotal) {
    warnings.push(
      isTr
        ? "Creator yayın onaylarının tamamı verilmedi."
        : "Not all creator release confirmations are complete.",
    );
  }

  if (totalScenes > 0) {
    strengths.push(
      isTr ? `${totalScenes} sahnelik üretim planı mevcut.` : `A ${totalScenes}-scene production plan is available.`,
    );
  }
  if (visualReadyScenes === totalScenes && totalScenes > 0) {
    strengths.push(isTr ? "Tüm sahne görselleri hazır." : "All scene visuals are ready.");
  }
  if (voiceReadyScenes === totalScenes && totalScenes > 0) {
    strengths.push(isTr ? "Tüm sahnelerin ses hazırlığı tamamlandı." : "Voice readiness is complete for all scenes.");
  }
  if (continuityStatus === "ready") {
    strengths.push(isTr ? "Akış sürekliliği denetimi temiz." : "The continuity audit is clear.");
  }
  if (finalVideoCurrent) {
    strengths.push(isTr ? "Final video güncel." : "The final video is current.");
  }
  if (input.publish.packageDownloaded) {
    strengths.push(isTr ? "Publish-ready Creator Package teslim edildi." : "The publish-ready Creator Package was delivered.");
  }

  const lifecycleHistory = appendCreatorProjectPerformanceHistory({
    history: input.lifecycleHistory,
    status: lifecycle.status,
    recordedAt: input.generatedAt,
  });
  const nextActions = [getLifecycleActionText(lifecycle.nextAction, isTr)];

  if (!input.timelineApproved && totalScenes > 0) {
    nextActions.push(isTr ? "Timeline kontrolünü çalıştır ve onayla." : "Run and approve the timeline check.");
  }
  if (visualReadyScenes < totalScenes) {
    nextActions.push(isTr ? "Eksik sahne görsellerini üret." : "Generate the missing scene visuals.");
  }
  if (voiceReadyScenes < totalScenes) {
    nextActions.push(isTr ? "Eksik seslendirmeleri üret." : "Generate the missing voice tracks.");
  }
  if (continuityStatus === "high_risk" || continuityStatus === "review") {
    nextActions.push(isTr ? "Akış ve süre uyarılarını gözden geçir." : "Review continuity and timing findings.");
  }
  if (finalVideoCurrent && !input.publish.metadataReady) {
    nextActions.push(isTr ? "Yayın metadata'sını hazırla." : "Prepare publishing metadata.");
  }
  if (finalVideoCurrent && !input.publish.thumbnailReady) {
    nextActions.push(isTr ? "Yayın thumbnail'ını seç." : "Select the publishing thumbnail.");
  }
  if (
    input.publish.systemChecksReady === systemChecksTotal &&
    input.publish.confirmationsReady === confirmationsTotal &&
    !input.publish.packageDownloaded
  ) {
    nextActions.push(isTr ? "Creator Package paketini indir." : "Download the Creator Package.");
  }

  const productionRatio = totalScenes
    ? (visualReadyScenes + voiceReadyScenes) / (totalScenes * 2)
    : 0;
  const continuityScore =
    continuityStatus === "ready"
      ? 100
      : continuityStatus === "review"
        ? 65
        : continuityStatus === "high_risk"
          ? 25
          : 45;
  const performanceScore = clamp(
    Math.round(
      lifecycle.progress * 0.45 +
        productionRatio * 100 * 0.25 +
        continuityScore * 0.15 +
        readinessPercent * 0.15,
    ),
    0,
    100,
  );
  const status = blockers.length > 0
    ? "blocked"
    : warnings.length > 0 || lifecycle.status === "export_outdated"
      ? "attention"
      : "ready";

  return {
    version: "REPORT-P1",
    generatedAt: safeIso(input.generatedAt),
    locale: input.locale,
    project: {
      id: String(input.projectId || ""),
      title: String(input.title || "").trim() || (isTr ? "İsimsiz proje" : "Untitled project"),
      format: String(input.format || ""),
      qualityMode,
      targetPlatforms: Array.from(
        new Set((input.targetPlatforms || []).map((item) => String(item).trim()).filter(Boolean)),
      ),
    },
    status,
    performanceScore,
    lifecycle: {
      status: lifecycle.status,
      progress: lifecycle.progress,
      nextAction: lifecycle.nextAction,
      outdatedReasons: [...lifecycle.outdatedReasons],
      history: lifecycleHistory,
    },
    production: {
      totalScenes,
      targetDurationSec,
      imageReadyScenes,
      videoReadyScenes,
      visualReadyScenes,
      narrationScenes,
      dialogueScenes,
      voiceReadyScenes,
      exactTimedScenes,
      splitRecommendedScenes,
    },
    continuity: {
      status: continuityStatus,
      safeScenes: Math.max(0, safeNumber(input.continuity?.safeScenes)),
      warningScenes: Math.max(0, safeNumber(input.continuity?.warningScenes)),
      highRiskScenes: Math.max(0, safeNumber(input.continuity?.highRiskScenes)),
      freezeRiskScenes: Math.max(0, safeNumber(input.continuity?.freezeRiskScenes)),
      unmeasuredAudioScenes: Math.max(0, safeNumber(input.continuity?.unmeasuredAudioScenes)),
      uncoveredDurationSec: round(
        Math.max(0, safeNumber(input.continuity?.totalUncoveredDurationSec)),
        2,
      ),
    },
    publish: {
      finalVideoReady: input.publish.finalVideoReady,
      thumbnailReady: input.publish.thumbnailReady,
      metadataReady: input.publish.metadataReady,
      captionsReady: input.publish.captionsReady,
      systemChecksReady: clamp(input.publish.systemChecksReady, 0, systemChecksTotal),
      systemChecksTotal,
      confirmationsReady: clamp(input.publish.confirmationsReady, 0, confirmationsTotal),
      confirmationsTotal,
      packageDownloaded: input.publish.packageDownloaded,
      readinessPercent,
    },
    credits: {
      estimateOnly: true,
      estimatedUsedCredits,
      estimatedRemainingCredits,
      estimatedTotalCredits: estimatedUsedCredits + estimatedRemainingCredits,
      lines: creditLines,
      note: isTr
        ? "Bu değer proje varlıklarından ve güncel kredi politikasından hesaplanan tahmindir; kesin faturalama kaydı değildir."
        : "This is an estimate derived from project assets and the current credit policy; it is not an authoritative billing ledger.",
    },
    intelligence: {
      hookScore: Number.isFinite(Number(input.intelligence?.hookScore))
        ? clamp(Math.round(Number(input.intelligence?.hookScore)), 0, 100)
        : null,
      hookLevel: String(input.intelligence?.hookLevel || ""),
    },
    findings: {
      strengths: uniqueText(strengths),
      warnings: uniqueText(warnings),
      blockers: uniqueText(blockers),
    },
    nextActions: uniqueText(nextActions, 6),
  };
}

export function isCreatorProjectPerformanceReport(
  value: unknown,
): value is CreatorProjectPerformanceReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === "REPORT-P1" &&
    typeof record.generatedAt === "string" &&
    typeof record.performanceScore === "number" &&
    Boolean(record.project && typeof record.project === "object") &&
    Boolean(record.production && typeof record.production === "object") &&
    Boolean(record.lifecycle && typeof record.lifecycle === "object")
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDuration(seconds: number, isTr: boolean) {
  if (seconds >= 120) {
    return `${round(seconds / 60, 1)} ${isTr ? "dk" : "min"}`;
  }
  return `${round(seconds, 1)} ${isTr ? "sn" : "sec"}`;
}

function listHtml(items: string[], emptyText: string) {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function getLifecycleStatusLabel(
  status: CreatorProjectLifecycleStatus,
  isTr: boolean,
) {
  const labels: Record<CreatorProjectLifecycleStatus, [string, string]> = {
    draft: ["Taslak", "Draft"],
    production_in_progress: ["Üretim devam ediyor", "In Production"],
    production_ready: [
      "Üretim içerikleri tamamlandı",
      "Production Assets Complete",
    ],
    final_video_ready: ["Final video hazır", "Final Video Ready"],
    publish_ready: ["Yayın paketine hazır", "Ready for Publish Package"],
    exported: ["Yayın paketi güncel", "Publish Package Current"],
    export_outdated: ["Çıktı güncellenmeli", "Output Requires Update"],
  };

  return labels[status][isTr ? 0 : 1];
}

function getContinuityStatusLabel(
  status: CreatorProjectPerformanceReport["continuity"]["status"],
  isTr: boolean,
) {
  const labels: Record<
    CreatorProjectPerformanceReport["continuity"]["status"],
    [string, string]
  > = {
    ready: ["Açık tutarlılık riski yok", "No open consistency risk"],
    review: ["Kontrol öneriliyor", "Review recommended"],
    high_risk: ["Yüksek riskli sorun bulundu", "High-risk issues found"],
    not_measured: ["Henüz ölçülmedi", "Not measured yet"],
  };

  return labels[status][isTr ? 0 : 1];
}

function getCreditOperationLabel(
  operation: CreatorProjectPerformanceCreditLine["operation"],
  isTr: boolean,
) {
  const labels: Record<
    CreatorProjectPerformanceCreditLine["operation"],
    [string, string]
  > = {
    image: ["Görsel üretimi", "Visual generation"],
    voice: ["Anlatıcı seslendirmesi", "Narration voice-over"],
    dialogue_voice: ["Diyalog seslendirmesi", "Dialogue voice-over"],
    video: ["Video üretimi", "Video generation"],
    export: ["Final video oluşturma", "Final video creation"],
  };

  return labels[operation][isTr ? 0 : 1];
}

function getReportStatusLabel(
  status: CreatorProjectPerformanceReport["status"],
  isTr: boolean,
) {
  const labels: Record<
    CreatorProjectPerformanceReport["status"],
    [string, string]
  > = {
    ready: ["Hazır", "Ready"],
    attention: ["Kontrol gerekli", "Review required"],
    blocked: ["İlerleme engelli", "Blocked"],
  };

  return labels[status][isTr ? 0 : 1];
}

export function createCreatorProjectPerformanceReportHtml(
  report: CreatorProjectPerformanceReport,
) {
  const isTr = report.locale === "tr";
  const lifecycleHistory = report.lifecycle.history
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(
          getLifecycleStatusLabel(entry.status, isTr),
        )}</td><td>${escapeHtml(
          new Date(entry.recordedAt).toLocaleString(isTr ? "tr-TR" : "en-US"),
        )}</td></tr>`,
    )
    .join("");
  const creditRows = report.credits.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(getCreditOperationLabel(line.operation, isTr))}</td>
        <td>${line.completedUnits}</td>
        <td>${line.remainingUnits}</td>
        <td>${line.creditsPerUnit} ${isTr ? "kredi" : "credits"}</td>
        <td>${line.estimatedUsedCredits} ${isTr ? "kredi" : "credits"}</td>
        <td>${line.estimatedRemainingCredits} ${isTr ? "kredi" : "credits"}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${isTr ? "tr" : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(report.project.title)} · ${isTr ? "Proje Durum ve Hazırlık Raporu" : "Project Status and Readiness Report"}</title>
<style>
  :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f7fb; color: #0f172a; }
  main { width: min(1080px, calc(100% - 32px)); margin: 32px auto; }
  header, section { background: #fff; border: 1px solid #dbe4ef; border-radius: 22px; padding: 24px; margin-bottom: 18px; box-shadow: 0 12px 30px rgba(15, 23, 42, .06); }
  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: 30px; margin-bottom: 8px; }
  h2 { font-size: 18px; margin-bottom: 16px; }
  .eyebrow { text-transform: uppercase; letter-spacing: .15em; font-size: 11px; font-weight: 800; color: #64748b; }
  .muted { color: #64748b; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .metric { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc; }
  .metric span { display: block; color: #64748b; font-size: 12px; }
  .metric strong { display: block; margin-top: 7px; font-size: 22px; }
  .status { display: inline-flex; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; background: #e2e8f0; }
  .status.ready { background: #dcfce7; color: #166534; }
  .status.attention { background: #fef3c7; color: #92400e; }
  .status.blocked { background: #ffe4e6; color: #9f1239; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 13px; }
  th { color: #475569; }
  ul { padding-left: 20px; margin-bottom: 0; }
  li { margin: 7px 0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  footer { color: #64748b; font-size: 12px; text-align: center; padding: 10px; }
  @media (max-width: 760px) { .grid, .two { grid-template-columns: 1fr; } main { width: min(100% - 20px, 1080px); margin: 10px auto; } }
  @media print { body { background: #fff; } main { width: 100%; margin: 0; } header, section { box-shadow: none; break-inside: avoid; } }
</style>
</head>
<body>
<!-- Legacy report identifier: Project Performance Report -->
<main>
<header>
  <div class="eyebrow">VELTO · REPORT-P1</div>
  <h1>${escapeHtml(report.project.title)}</h1>
  <p class="muted">${isTr ? "CreatorLab Proje Durum ve Hazırlık Raporu" : "CreatorLab Project Status and Readiness Report"} · ${escapeHtml(new Date(report.generatedAt).toLocaleString(isTr ? "tr-TR" : "en-US"))}</p>
  <p class="muted">${isTr ? "Bu rapor yayın sonrası izlenme veya etkileşim performansını değil, projenin üretim ve yayın hazırlığını gösterir." : "This report shows production and publishing readiness, not post-publish audience or engagement performance."}</p>
  <span class="status ${escapeHtml(report.status)}">${escapeHtml(getReportStatusLabel(report.status, isTr))}</span>
</header>
<section>
  <h2>${isTr ? "Proje özeti" : "Project summary"}</h2>
  <div class="grid">
    <div class="metric"><span>${isTr ? "Proje hazırlık puanı" : "Project readiness score"}</span><strong>${report.performanceScore}/100</strong></div>
    <div class="metric"><span>${isTr ? "Proje aşaması" : "Project stage"}</span><strong>${escapeHtml(getLifecycleStatusLabel(report.lifecycle.status, isTr))}</strong></div>
    <div class="metric"><span>${isTr ? "Toplam sahne" : "Total scenes"}</span><strong>${report.production.totalScenes}</strong></div>
    <div class="metric"><span>${isTr ? "Planlanan video süresi" : "Planned video duration"}</span><strong>${escapeHtml(formatDuration(report.production.targetDurationSec, isTr))}</strong></div>
  </div>
</section>
<section>
  <h2>${isTr ? "Görsel, ses ve yayın hazırlığı" : "Visual, voice, and publishing readiness"}</h2>
  <div class="grid">
    <div class="metric"><span>${isTr ? "Hazır görseller" : "Visuals ready"}</span><strong>${report.production.visualReadyScenes}/${report.production.totalScenes}</strong></div>
    <div class="metric"><span>${isTr ? "Hazır ses kayıtları" : "Voice tracks ready"}</span><strong>${report.production.voiceReadyScenes}/${report.production.totalScenes}</strong></div>
    <div class="metric"><span>${isTr ? "Hazır video sahneleri" : "Video scenes ready"}</span><strong>${report.production.videoReadyScenes}</strong></div>
    <div class="metric"><span>${isTr ? "Yayına hazırlık durumu" : "Publishing readiness"}</span><strong>${report.publish.readinessPercent}%</strong></div>
  </div>
</section>
<section>
  <h2>${isTr ? "Görsel ve zamanlama tutarlılığı" : "Visual and timing consistency"}</h2>
  <div class="grid">
    <div class="metric"><span>${isTr ? "Genel durum" : "Overall status"}</span><strong>${escapeHtml(getContinuityStatusLabel(report.continuity.status, isTr))}</strong></div>
    <div class="metric"><span>${isTr ? "Sorunsuz sahneler" : "Scenes without open risk"}</span><strong>${report.continuity.safeScenes}</strong></div>
    <div class="metric"><span>${isTr ? "Yüksek riskli sahneler" : "High-risk scenes"}</span><strong>${report.continuity.highRiskScenes}</strong></div>
    <div class="metric"><span>${isTr ? "Görsel kapsamı eksik süre" : "Duration without visual coverage"}</span><strong>${escapeHtml(formatDuration(report.continuity.uncoveredDurationSec, isTr))}</strong></div>
  </div>
</section>
<section>
  <h2>${isTr ? "Tahmini kredi özeti" : "Estimated credit summary"}</h2>
  <div class="grid">
    <div class="metric"><span>${isTr ? "Tahmini kullanılan" : "Estimated used"}</span><strong>${report.credits.estimatedUsedCredits} ${isTr ? "kredi" : "credits"}</strong></div>
    <div class="metric"><span>${isTr ? "Tamamlamak için tahmini gereken" : "Estimated required to complete"}</span><strong>${report.credits.estimatedRemainingCredits} ${isTr ? "kredi" : "credits"}</strong></div>
    <div class="metric"><span>${isTr ? "Tahmini proje toplamı" : "Estimated project total"}</span><strong>${report.credits.estimatedTotalCredits} ${isTr ? "kredi" : "credits"}</strong></div>
    <div class="metric"><span>${isTr ? "Seçili üretim kalitesi" : "Selected production quality"}</span><strong>${escapeHtml(report.project.qualityMode)}</strong></div>
  </div>
  <p class="muted" style="margin-top: 14px">${escapeHtml(report.credits.note)}</p>
  <h3>${isTr ? "Tahminin dağılımı" : "Estimate breakdown"}</h3>
  <table>
    <thead><tr><th>${isTr ? "Üretim adımı" : "Production step"}</th><th>${isTr ? "Tamamlanan birim" : "Completed units"}</th><th>${isTr ? "Kalan birim" : "Remaining units"}</th><th>${isTr ? "Birim başına kredi" : "Credits per unit"}</th><th>${isTr ? "Tahmini kullanılan" : "Estimated used"}</th><th>${isTr ? "Tamamlamak için tahmini gereken" : "Estimated required to complete"}</th></tr></thead>
    <tbody>${creditRows}</tbody>
  </table>
</section>
<section class="two">
  <div><h2>${isTr ? "Hazır olan alanlar" : "What is ready"}</h2>${listHtml(report.findings.strengths, isTr ? "Henüz tamamlanmış bir hazırlık sinyali yok." : "No completed readiness signal yet.")}</div>
  <div><h2>${isTr ? "Dikkat gerektiren konular" : "Items requiring attention"}</h2>${listHtml([...report.findings.blockers, ...report.findings.warnings], isTr ? "Şu anda dikkat gerektiren bir konu yok." : "No item currently requires attention.")}</div>
</section>
<section>
  <h2>${isTr ? "Önerilen sonraki aksiyonlar" : "Recommended next actions"}</h2>
  ${listHtml(report.nextActions, isTr ? "Ek aksiyon gerekmiyor." : "No further action is required.")}
</section>
<section>
  <h2>${isTr ? "Proje aşaması geçmişi" : "Project stage history"}</h2>
  <table><thead><tr><th>${isTr ? "Durum" : "Status"}</th><th>${isTr ? "Kaydedilme zamanı" : "Recorded at"}</th></tr></thead><tbody>${lifecycleHistory}</tbody></table>
</section>
<footer>VELTO REPORT-P1 · ${isTr ? "Proje durum ve hazırlık raporu" : "Project status and readiness report"} · ${escapeHtml(report.project.id || "local-project")}</footer>
</main>
</body>
</html>`;
}
