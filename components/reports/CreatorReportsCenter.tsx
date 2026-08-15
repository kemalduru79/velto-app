"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProductTopNavigation from "@/components/navigation/ProductTopNavigation";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";
import {
  createCreatorCentralPortfolioSummary,
  createCreatorProjectPerformanceReportFromRecord,
  type CreatorCentralProjectRecord,
  type CreatorCentralProjectSummary,
} from "@/lib/creator/centralReporting";
import {
  createCreatorProjectPerformanceReportHtml,
  type CreatorProjectPerformanceReport,
} from "@/lib/creator/projectPerformanceReport";
import type { CreatorProjectLifecycleStatus } from "@/lib/creator/projectExportReadiness";

type StatusFilter = "all" | CreatorProjectLifecycleStatus;

const STATUS_FILTERS: CreatorProjectLifecycleStatus[] = [
  "draft",
  "production_in_progress",
  "production_ready",
  "final_video_ready",
  "publish_ready",
  "exported",
  "export_outdated",
];

function downloadTextFile({
  fileName,
  content,
  type,
}: {
  fileName: string;
  content: string;
  type: string;
}) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "velto-project";
}

function formatDate(value: string, locale: "tr" | "en") {
  if (!value) return locale === "en" ? "Not saved" : "Kaydedilmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "en" ? "Unknown" : "Bilinmiyor";
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number, locale: "tr" | "en") {
  if (!seconds) return "—";
  if (seconds < 60) {
    return `${Math.round(seconds)} ${locale === "en" ? "sec" : "sn"}`;
  }

  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} ${
    locale === "en" ? "min" : "dk"
  }`;
}

function statusTone(status: CreatorProjectLifecycleStatus) {
  if (status === "exported") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "export_outdated") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (status === "publish_ready" || status === "final_video_ready") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (status === "production_ready") {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getProjectStageLabel(
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
    production_ready: {
      tr: "Üretim içerikleri tamamlandı",
      en: "Production Assets Complete",
    },
    final_video_ready: {
      tr: "Final video hazır",
      en: "Final Video Ready",
    },
    publish_ready: {
      tr: "Yayın paketine hazır",
      en: "Ready for Publish Package",
    },
    exported: {
      tr: "Yayın paketi güncel",
      en: "Publish Package Current",
    },
    export_outdated: {
      tr: "Çıktı güncellenmeli",
      en: "Output Requires Update",
    },
  };

  return labels[status][locale];
}

function getContinuityStatusLabel(
  status: CreatorProjectPerformanceReport["continuity"]["status"],
  copy: {
    continuityReady: string;
    continuityReview: string;
    continuityHighRisk: string;
    continuityNotMeasured: string;
  },
) {
  if (status === "ready") return copy.continuityReady;
  if (status === "review") return copy.continuityReview;
  if (status === "high_risk") return copy.continuityHighRisk;
  return copy.continuityNotMeasured;
}

function getCreditOperationLabel(
  operation: CreatorProjectPerformanceReport["credits"]["lines"][number]["operation"],
  copy: {
    operationImage: string;
    operationVoice: string;
    operationDialogueVoice: string;
    operationVideo: string;
    operationExport: string;
  },
) {
  if (operation === "image") return copy.operationImage;
  if (operation === "voice") return copy.operationVoice;
  if (operation === "dialogue_voice") return copy.operationDialogueVoice;
  if (operation === "video") return copy.operationVideo;
  return copy.operationExport;
}

function ProjectListItem({
  project,
  selected,
  locale,
  onSelect,
}: {
  project: CreatorCentralProjectSummary;
  selected: boolean;
  locale: "tr" | "en";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`reports-project-row ${selected ? "is-selected" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{project.title}</p>
          <p
            className="reports-project-date"
          >
            {formatDate(project.updatedAt || project.createdAt, locale)}
          </p>
        </div>
        <span
          className={`reports-project-progress ${statusTone(project.status)}`}
        >
          {project.progress}%
        </span>
      </div>

      <div className="reports-project-progress-track">
        <span
          className="reports-project-progress-value"
          style={{ width: `${project.progress}%` }}
        />
      </div>

      <div
        className="reports-project-meta"
      >
        <span>{getProjectStageLabel(project.status, locale)}</span>
        <span>·</span>
        <span>
          {project.sceneCount} {locale === "en" ? "scenes" : "sahne"}
        </span>
        {project.targetDurationSec > 0 && (
          <>
            <span>·</span>
            <span>{formatDuration(project.targetDurationSec, locale)}</span>
          </>
        )}
      </div>
    </button>
  );
}

function FindingList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: "positive" | "warning" | "action";
}) {
  return (
    <section className={`reports-finding reports-finding-${tone}`}>
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="mt-3 space-y-2 text-xs leading-5">
        {(items.length ? items : [emptyText]).slice(0, 5).map((item, index) => (
          <li key={`${title}-${index}`}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function CreatorReportsCenter() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const locale: "tr" | "en" = language === "en" ? "en" : "tr";
  const [projects, setProjects] = useState<CreatorCentralProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProject, setSelectedProject] =
    useState<CreatorCentralProjectRecord | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const accessTokenRef = useRef("");

  const copy =
    locale === "en"
      ? {
          eyebrow: "Reporting across all projects",
          title: "Reports",
          intro:
            "Understand what is ready, what needs attention and which CreatorLab project should be opened next. Reports reflects saved project status—not post-publish audience performance.",
          refresh: "Refresh",
          refreshing: "Refreshing...",
          portfolio: "All Projects Overview",
          portfolioHint:
            "A current summary of your saved CreatorLab projects.",
          portfolioDetails: "Secondary portfolio details",
          projects: "Saved Projects",
          search: "Search saved projects",
          allStatuses: "All project stages",
          noProjects: "No saved CreatorLab projects found.",
          startProject: "Start a CreatorLab project",
          selectProject: "Select a saved project to view its status report.",
          loadingReport: "Loading project status report...",
          report: "Project Status and Readiness Report",
          reportEyebrow: "Project readiness",
          reportHint:
            "Shows production progress, output currency, publishing readiness, and estimated credit needs for the selected project.",
          downloadHtml: "Download readable report",
          downloadJson: "Download report data",
          openStudio: "Open project in Velto Studio",
          readinessScore: "Project Readiness Score",
          readinessScoreHint:
            "Summarizes production and publishing readiness on a 100-point scale.",
          projectStage: "Project Stage",
          projectStageHint:
            "The current step in the project's production and release process.",
          mediaReadiness: "Visual and Voice Readiness",
          mediaReadinessHint:
            "Completed visual and voice assets compared with total scenes.",
          visualAssetsReady: "Visuals ready",
          voiceAssetsReady: "Voice tracks ready",
          estimatedCreditSummary: "Estimated Credit Summary",
          estimatedProjectTotal: "Estimated project total",
          estimatedUsed: "Estimated used",
          estimatedToComplete: "Estimated required to complete",
          creditEstimateBreakdown: "Estimate breakdown",
          creditUnit: "credits",
          completedUnits: "Completed",
          remainingUnits: "Remaining",
          plannedDuration: "Planned Video Duration",
          plannedDurationHint:
            "Combined target duration of the project's scenes.",
          visualTimingConsistency: "Visual and Timing Consistency",
          visualTimingConsistencyHint:
            "Checks timing coverage, visual gaps, and continuity risks.",
          publishingReadiness: "Publishing Readiness",
          publishingReadinessHint:
            "Completion of final video, thumbnail, metadata, captions, and publishing checks.",
          strengths: "What Is Ready",
          findings: "Items Requiring Attention",
          nextActions: "Recommended Next Steps",
          noStrength: "No completed readiness signal yet.",
          noFinding: "No item currently requires attention.",
          noAction: "No additional action is currently required.",
          actionRequired: "Action required",
          readySignals: "Ready",
          supportingSignals: "Supporting project details",
          history: "Project Stage History",
          noHistory: "No saved project-stage transition yet.",
          estimateNote:
            "These values are estimates based on saved project outputs and the current credit policy. They do not represent actual credit transactions or account balance.",
          totalProjects: "Total Saved Projects",
          totalProjectsHint: "All saved CreatorLab projects included in this report.",
          activeProjects: "Projects Not Yet Completed",
          activeProjectsHint: "Projects that do not currently have a completed, up-to-date publish package.",
          productionReady: "Projects with Production Assets Complete",
          productionReadyHint: "Projects whose required visuals and voice assets are complete.",
          finalVideos: "Projects with a Final Video",
          finalVideosHint: "Projects that have a generated final video, whether current or requiring update.",
          exported: "Projects with a Current Publish Package",
          exportedHint: "Projects whose latest publish package matches the saved project.",
          outdated: "Outputs Requiring Update",
          outdatedHint: "Projects changed after a final video or publish package was created.",
          sceneCount: "Total Scenes Across Projects",
          sceneCountHint: "Combined scene count across all saved CreatorLab projects.",
          reportUnavailable:
            "The selected saved project could not be converted into a status report.",
          continuityReady: "No open consistency risk",
          continuityReview: "Review recommended",
          continuityHighRisk: "High-risk issues found",
          continuityNotMeasured: "Not measured yet",
          operationImage: "Visual generation",
          operationVoice: "Narration voice-over",
          operationDialogueVoice: "Dialogue voice-over",
          operationVideo: "Video generation",
          operationExport: "Final video creation",
        }
      : {
          eyebrow: "Tüm projeler için raporlama",
          title: "Raporlar",
          intro:
            "Nelerin hazır olduğunu, nelerin dikkat gerektirdiğini ve sırada hangi CreatorLab projesinin açılması gerektiğini anlayın. Raporlar yayın sonrası kitle performansını değil, kayıtlı proje durumunu gösterir.",
          refresh: "Yenile",
          refreshing: "Yenileniyor...",
          portfolio: "Tüm Projelerin Özeti",
          portfolioHint:
            "Kayıtlı CreatorLab projelerinizin güncel durum özeti.",
          portfolioDetails: "İkincil portföy detayları",
          projects: "Kayıtlı Projeler",
          search: "Kayıtlı projelerde ara",
          allStatuses: "Tüm proje aşamaları",
          noProjects: "Kayıtlı CreatorLab projesi bulunamadı.",
          startProject: "CreatorLab projesi başlat",
          selectProject: "Durum raporunu görmek için kayıtlı bir proje seçin.",
          loadingReport: "Proje durum raporu yükleniyor...",
          report: "Proje Durum ve Hazırlık Raporu",
          reportEyebrow: "Proje hazırlığı",
          reportHint:
            "Seçili projenin üretim ilerlemesini, çıktı güncelliğini, yayın hazırlığını ve tahmini kredi ihtiyacını gösterir.",
          downloadHtml: "Okunabilir raporu indir",
          downloadJson: "Rapor verisini indir",
          openStudio: "Projeyi Velto Studio'da aç",
          readinessScore: "Proje Hazırlık Puanı",
          readinessScoreHint:
            "Üretim ve yayın hazırlığını 100 puan üzerinden özetler.",
          projectStage: "Proje Aşaması",
          projectStageHint:
            "Projenin üretim ve yayın sürecindeki mevcut adımı.",
          mediaReadiness: "Görsel ve Ses Hazırlığı",
          mediaReadinessHint:
            "Hazır görsel ve ses varlıklarının toplam sahne sayısına oranı.",
          visualAssetsReady: "Hazır görseller",
          voiceAssetsReady: "Hazır ses kayıtları",
          estimatedCreditSummary: "Tahmini Kredi Özeti",
          estimatedProjectTotal: "Tahmini proje toplamı",
          estimatedUsed: "Tahmini kullanılan",
          estimatedToComplete: "Tamamlamak için tahmini gereken",
          creditEstimateBreakdown: "Tahminin dağılımı",
          creditUnit: "kredi",
          completedUnits: "Tamamlanan",
          remainingUnits: "Kalan",
          plannedDuration: "Planlanan Video Süresi",
          plannedDurationHint:
            "Projedeki sahnelerin toplam hedef süresi.",
          visualTimingConsistency: "Görsel ve Zamanlama Tutarlılığı",
          visualTimingConsistencyHint:
            "Süre kapsamını, görsel boşlukları ve devamlılık risklerini kontrol eder.",
          publishingReadiness: "Yayına Hazırlık Durumu",
          publishingReadinessHint:
            "Final video, thumbnail, metadata, altyazı ve yayın kontrollerinin tamamlanma oranı.",
          strengths: "Hazır Olan Alanlar",
          findings: "Dikkat Gerektiren Konular",
          nextActions: "Önerilen Sonraki Adımlar",
          noStrength: "Henüz tamamlanmış bir hazırlık sinyali yok.",
          noFinding: "Şu anda dikkat gerektiren bir konu yok.",
          noAction: "Şu anda ek bir aksiyon gerekmiyor.",
          actionRequired: "Aksiyon gerekli",
          readySignals: "Hazır",
          supportingSignals: "Destekleyici proje detayları",
          history: "Proje Aşaması Geçmişi",
          noHistory: "Henüz kayıtlı proje aşaması geçişi yok.",
          estimateNote:
            "Bu değerler kayıtlı proje çıktıları ve güncel kredi politikasına göre hesaplanan tahminlerdir. Kesin kredi hareketlerini veya hesap bakiyesini göstermez.",
          totalProjects: "Toplam Kayıtlı Proje",
          totalProjectsHint: "Bu rapora dahil edilen tüm kayıtlı CreatorLab projeleri.",
          activeProjects: "Henüz Tamamlanmamış Projeler",
          activeProjectsHint: "Güncel ve tamamlanmış bir yayın paketi bulunmayan projeler.",
          productionReady: "Üretim İçerikleri Tamamlanan Projeler",
          productionReadyHint: "Gerekli görselleri ve ses kayıtları tamamlanan projeler.",
          finalVideos: "Final Videosu Bulunan Projeler",
          finalVideosHint: "Güncel veya güncellenmesi gereken bir final videosu bulunan projeler.",
          exported: "Yayın Paketi Güncel Projeler",
          exportedHint: "Son yayın paketi kayıtlı proje ile eşleşen projeler.",
          outdated: "Güncellenmesi Gereken Çıktılar",
          outdatedHint: "Final video veya yayın paketi oluşturulduktan sonra değiştirilen projeler.",
          sceneCount: "Tüm Projelerdeki Toplam Sahne",
          sceneCountHint: "Kayıtlı tüm CreatorLab projelerindeki toplam sahne sayısı.",
          reportUnavailable:
            "Seçili kayıtlı proje durum raporuna dönüştürülemedi.",
          continuityReady: "Açık tutarlılık riski yok",
          continuityReview: "Kontrol öneriliyor",
          continuityHighRisk: "Yüksek riskli sorun bulundu",
          continuityNotMeasured: "Henüz ölçülmedi",
          operationImage: "Görsel üretimi",
          operationVoice: "Anlatıcı seslendirmesi",
          operationDialogueVoice: "Diyalog seslendirmesi",
          operationVideo: "Video üretimi",
          operationExport: "Final video oluşturma",
        };

  const getAccessToken = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      router.replace("/login");
      throw new Error(
        locale === "en" ? "Session is required." : "Oturum gerekli.",
      );
    }

    accessTokenRef.current = session.access_token;
    return session.access_token;
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    setError("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !Array.isArray(data?.projects)) {
        throw new Error(
          data?.error ||
            (locale === "en"
              ? "Projects could not be loaded."
              : "Projeler yüklenemedi."),
        );
      }

      const creatorProjects = data.projects.filter(
        (project: CreatorCentralProjectRecord) => {
          const flow = String(project?.flow_type || "").toLowerCase();
          return flow === "creator_lab" || flow === "creatorlab";
        },
      );

      setProjects(creatorProjects);
      setSelectedProjectId((current) => {
        if (
          current &&
          creatorProjects.some(
            (project: CreatorCentralProjectRecord) =>
              String(project.id || "") === current,
          )
        ) {
          return current;
        }

        return String(creatorProjects[0]?.id || "");
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "en"
            ? "Projects could not be loaded."
            : "Projeler yüklenemedi.",
      );
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    // Language changes should not silently re-request the portfolio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      return;
    }

    let cancelled = false;

    const loadSelectedProject = async () => {
      setLoadingProject(true);
      setError("");

      try {
        const token = accessTokenRef.current || (await getAccessToken());
        const response = await fetch(
          `/api/load-project/${encodeURIComponent(selectedProjectId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success || !data?.project) {
          throw new Error(
            data?.error ||
              (locale === "en"
                ? "Project report could not be loaded."
                : "Proje raporu yüklenemedi."),
          );
        }

        if (!cancelled) {
          setSelectedProject(data.project);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedProject(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : copy.reportUnavailable,
          );
        }
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    };

    void loadSelectedProject();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const portfolio = useMemo(
    () => createCreatorCentralPortfolioSummary(projects),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(
      locale === "tr" ? "tr-TR" : "en-US",
    );

    return portfolio.projects.filter((project) => {
      const matchesQuery =
        !normalizedQuery ||
        project.title
          .toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US")
          .includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [locale, portfolio.projects, query, statusFilter]);

  const report: CreatorProjectPerformanceReport | null = useMemo(() => {
    if (!selectedProject) return null;

    try {
      return createCreatorProjectPerformanceReportFromRecord({
        project: selectedProject,
        locale,
      });
    } catch {
      return null;
    }
  }, [locale, selectedProject]);

  const selectedSummary = useMemo(
    () =>
      selectedProjectId
        ? portfolio.projects.find(
            (project) => project.id === selectedProjectId,
          ) || null
        : null,
    [portfolio.projects, selectedProjectId],
  );

  const handleDownloadHtml = () => {
    if (!report) return;
    const html = createCreatorProjectPerformanceReportHtml(report);

    downloadTextFile({
      fileName: `${safeFileName(report.project.title)}-project-status-report.html`,
      content: html,
      type: "text/html;charset=utf-8",
    });
  };

  const handleDownloadJson = () => {
    if (!report) return;

    downloadTextFile({
      fileName: `${safeFileName(report.project.title)}-project-status-report.json`,
      content: `${JSON.stringify(report, null, 2)}\n`,
      type: "application/json;charset=utf-8",
    });
  };

  const primaryPortfolioMetrics = [
    {
      label: copy.totalProjects,
      value: portfolio.totalProjects,
      hint: copy.totalProjectsHint,
    },
    {
      label: copy.activeProjects,
      value: portfolio.activeProjects,
      hint: copy.activeProjectsHint,
    },
    {
      label: copy.exported,
      value: portfolio.exportedProjects,
      hint: copy.exportedHint,
    },
    {
      label: copy.outdated,
      value: portfolio.outdatedProjects,
      hint: copy.outdatedHint,
    },
  ];

  const secondaryPortfolioMetrics = [
    {
      label: copy.productionReady,
      value: portfolio.productionReadyProjects,
      hint: copy.productionReadyHint,
    },
    {
      label: copy.finalVideos,
      value: portfolio.finalVideos,
      hint: copy.finalVideosHint,
    },
    {
      label: copy.sceneCount,
      value: portfolio.totalScenes,
      hint: copy.sceneCountHint,
    },
  ];

  return (
    <main className="reports-shell">
      <div className="reports-frame">
        <header className="reports-product-bar">
          <Link
            href="/dashboard"
            className="reports-brand"
          >
            <span className="reports-brand-mark">
              V
            </span>
            <span>
              <strong className="block text-sm tracking-[0.18em]">VELTO</strong>
              <small>
                {copy.title}
              </small>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <ProductTopNavigation tone="light" active="reports" />
            <div className="reports-language-switcher">
              <button
                type="button"
                onClick={() => setLanguage("tr")}
                className={`rounded-full px-3 py-2 transition ${
                  locale === "tr" ? "is-active" : ""
                }`}
              >
                TR
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded-full px-3 py-2 transition ${
                  locale === "en" ? "is-active" : ""
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        <section className="reports-header">
          <p className="reports-eyebrow">
            {copy.eyebrow}
          </p>
          <h1>
            {copy.title}
          </h1>
          <p className="reports-intro">
            {copy.intro}
          </p>
        </section>

        <section className="reports-portfolio">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.portfolio}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                {copy.portfolioHint}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadProjects()}
              disabled={loadingProjects}
              className="min-h-11 rounded-full border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 transition hover:border-slate-950 disabled:cursor-wait disabled:opacity-60"
            >
              {loadingProjects ? copy.refreshing : copy.refresh}
            </button>
          </div>

          <div className="reports-portfolio-primary">
            {primaryPortfolioMetrics.map((metric) => (
              <div
                key={metric.label}
                className="reports-portfolio-metric"
              >
                <p className="text-3xl font-black tracking-tight text-slate-950">
                  {metric.value}
                </p>
                <p className="mt-2 text-xs font-black leading-4 text-slate-700">
                  {metric.label}
                </p>
                <p className="mt-2 text-[11px] leading-4 text-slate-500">
                  {metric.hint}
                </p>
              </div>
            ))}
          </div>
          <details className="reports-portfolio-secondary">
            <summary>{copy.portfolioDetails}</summary>
            <div>
              {secondaryPortfolioMetrics.map((metric) => (
                <div key={metric.label} className="reports-portfolio-detail">
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                  <small>{metric.hint}</small>
                </div>
              ))}
            </div>
          </details>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        <section className="reports-workspace">
          <aside className="reports-project-selector">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  {copy.projects}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {filteredProjects.length}/{portfolio.totalProjects}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                aria-label={copy.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-950"
              />
              <select
                aria-label={copy.allStatuses}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none transition focus:border-slate-950"
              >
                <option value="all">{copy.allStatuses}</option>
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {getProjectStageLabel(status, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="reports-project-list">
              {!loadingProjects && filteredProjects.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    {copy.noProjects}
                  </p>
                  <Link
                    href="/create?flow=creator_lab"
                    className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                  >
                    {copy.startProject}
                  </Link>
                </div>
              )}

              {filteredProjects.map((project) => (
                <ProjectListItem
                  key={project.id}
                  project={project}
                  selected={project.id === selectedProjectId}
                  locale={locale}
                  onSelect={() => setSelectedProjectId(project.id)}
                />
              ))}
            </div>
          </aside>

          <article className="reports-project-report">
            {!selectedProjectId && (
              <div className="flex min-h-[580px] items-center justify-center text-center">
                <div>
                  <p className="text-2xl font-black text-slate-950">
                    {copy.selectProject}
                  </p>
                  <Link
                    href="/create?flow=creator_lab"
                    className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    {copy.startProject}
                  </Link>
                </div>
              </div>
            )}

            {selectedProjectId && loadingProject && (
              <div className="flex min-h-[580px] items-center justify-center">
                <p className="text-sm font-black text-slate-500">
                  {copy.loadingReport}
                </p>
              </div>
            )}

            {selectedProjectId && !loadingProject && !report && (
              <div className="flex min-h-[580px] items-center justify-center text-center">
                <p className="text-sm font-semibold text-slate-600">
                  {copy.reportUnavailable}
                </p>
              </div>
            )}

            {report && selectedSummary && !loadingProject && (
              <div>
                <div className="reports-project-header">
                  <div>
                    <p className="reports-eyebrow">
                      {copy.reportEyebrow}
                    </p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950">
                      {report.project.title}
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(
                          selectedSummary.status,
                        )}`}
                      >
                        {getProjectStageLabel(
                          selectedSummary.status,
                          locale,
                        )}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                        {formatDate(
                          selectedSummary.updatedAt ||
                            selectedSummary.createdAt,
                          locale,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="reports-report-actions">
                    <Link
                      href="/create?flow=creator_lab"
                      className="reports-primary-action"
                    >
                      {copy.openStudio}
                    </Link>
                    <button
                      type="button"
                      onClick={handleDownloadHtml}
                      className="reports-secondary-action"
                    >
                      {copy.downloadHtml}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="reports-secondary-action"
                    >
                      {copy.downloadJson}
                    </button>
                  </div>
                </div>

                <div className="reports-primary-signals">
                  {[
                    {
                      label: copy.readinessScore,
                      value: `${report.performanceScore}/100`,
                      hint: copy.readinessScoreHint,
                    },
                    {
                      label: copy.projectStage,
                      value: getProjectStageLabel(
                        report.lifecycle.status,
                        locale,
                      ),
                      hint: copy.projectStageHint,
                    },
                    {
                      label: copy.estimatedCreditSummary,
                      value: `${report.credits.estimatedRemainingCredits} ${copy.creditUnit}`,
                      hint: copy.estimatedToComplete,
                    },
                    {
                      label: copy.publishingReadiness,
                      value: `${report.publish.readinessPercent}%`,
                      hint: copy.publishingReadinessHint,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="reports-primary-signal"
                    >
                      <p className="text-xs font-black leading-4 text-slate-700">
                        {item.label}
                      </p>
                      <p className="mt-2 text-lg font-black leading-6 text-slate-950">
                        {item.value}
                      </p>
                      <p className="mt-2 text-[11px] leading-4 text-slate-500">
                        {item.hint}
                      </p>
                    </div>
                  ))}
                </div>

                <details className="reports-supporting-signals">
                  <summary>{copy.supportingSignals}</summary>
                  <div>
                    {[
                      {
                        label: copy.mediaReadiness,
                        value: `${copy.visualAssetsReady}: ${report.production.visualReadyScenes}/${report.production.totalScenes} · ${copy.voiceAssetsReady}: ${report.production.voiceReadyScenes}/${report.production.totalScenes}`,
                        hint: copy.mediaReadinessHint,
                      },
                      {
                        label: copy.plannedDuration,
                        value: formatDuration(report.production.targetDurationSec, locale),
                        hint: copy.plannedDurationHint,
                      },
                      {
                        label: copy.visualTimingConsistency,
                        value: getContinuityStatusLabel(report.continuity.status, copy),
                        hint: copy.visualTimingConsistencyHint,
                      },
                      {
                        label: copy.estimatedProjectTotal,
                        value: `${report.credits.estimatedTotalCredits} ${copy.creditUnit}`,
                        hint: `${copy.estimatedUsed}: ${report.credits.estimatedUsedCredits}`,
                      },
                    ].map((item) => (
                      <div key={item.label} className="reports-supporting-signal">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                        <small>{item.hint}</small>
                      </div>
                    ))}
                  </div>
                </details>

                <section className="reports-decisions" aria-labelledby="reports-action-required-title">
                  <div>
                    <h3 className="reports-eyebrow" id="reports-action-required-title">{copy.actionRequired}</h3>
                    <div className="reports-action-grid">
                      <FindingList
                        title={copy.findings}
                        items={[...report.findings.blockers, ...report.findings.warnings]}
                        emptyText={copy.noFinding}
                        tone="warning"
                      />
                      <FindingList
                        title={copy.nextActions}
                        items={report.nextActions}
                        emptyText={copy.noAction}
                        tone="action"
                      />
                    </div>
                    {(report.findings.blockers.length > 0 || report.findings.warnings.length > 0 || report.nextActions.length > 0) && (
                      <Link href="/create?flow=creator_lab" className="reports-inline-studio-action">
                        {copy.openStudio}
                      </Link>
                    )}
                  </div>
                  <div className="reports-ready-signals">
                    <h3 className="reports-eyebrow">{copy.readySignals}</h3>
                    <FindingList
                      title={copy.strengths}
                      items={report.findings.strengths}
                      emptyText={copy.noStrength}
                      tone="positive"
                    />
                  </div>
                </section>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <section className="rounded-[24px] border border-slate-200 p-5">
                    <h3 className="text-sm font-black text-slate-950">
                      {copy.history}
                    </h3>
                    <div className="mt-4 space-y-3">
                      {report.lifecycle.history.length === 0 && (
                        <p className="text-sm text-slate-500">
                          {copy.noHistory}
                        </p>
                      )}
                      {report.lifecycle.history
                        .slice()
                        .reverse()
                        .slice(0, 8)
                        .map((entry, index) => (
                          <div
                            key={`${entry.status}-${entry.recordedAt}-${index}`}
                            className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3"
                          >
                            <span className="text-sm font-black text-slate-800">
                              {getProjectStageLabel(
                                entry.status,
                                locale,
                              )}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {formatDate(entry.recordedAt, locale)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 p-5">
                    <h3 className="text-sm font-black text-slate-950">
                      {copy.estimatedCreditSummary}
                    </h3>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      {[
                        {
                          label: copy.estimatedUsed,
                          value: report.credits.estimatedUsedCredits,
                        },
                        {
                          label: copy.estimatedToComplete,
                          value: report.credits.estimatedRemainingCredits,
                        },
                        {
                          label: copy.estimatedProjectTotal,
                          value: report.credits.estimatedTotalCredits,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <p className="text-[11px] font-bold leading-4 text-slate-600">
                            {item.label}
                          </p>
                          <p className="mt-1 text-lg font-black text-slate-950">
                            {item.value} {copy.creditUnit}
                          </p>
                        </div>
                      ))}
                    </div>

                    <h4 className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      {copy.creditEstimateBreakdown}
                    </h4>
                    <div className="mt-3 space-y-3">
                      {report.credits.lines.map((line) => (
                        <div
                          key={line.operation}
                          className="rounded-2xl bg-slate-50 px-4 py-3"
                        >
                          <p className="text-sm font-black text-slate-800">
                            {getCreditOperationLabel(line.operation, copy)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {copy.completedUnits}: {line.completedUnits} ·{" "}
                            {copy.remainingUnits}: {line.remainingUnits}
                          </p>
                          <div className="mt-2 grid gap-1 text-xs font-semibold text-slate-700 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <span>
                              {copy.estimatedUsed}:{" "}
                              <strong>{line.estimatedUsedCredits} {copy.creditUnit}</strong>
                            </span>
                            <span>
                              {copy.estimatedToComplete}:{" "}
                              <strong>{line.estimatedRemainingCredits} {copy.creditUnit}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[11px] leading-5 text-slate-500">
                      {copy.estimateNote}
                    </p>
                  </section>
                </div>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
