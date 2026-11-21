"use client";

import { type CreatorFinalVideoReadinessReport } from "@/lib/creator/finalVideoReadiness";
import { type CreatorFinalProductionGateReport } from "@/lib/creator/finalProductionGate";
import { type FlowContinuityAuditReport } from "@/lib/video/flowContinuityAudit";
import { type ExportFlowValidationReport } from "@/lib/video/exportFlowValidation";
import type { ContentLanguage, CreatorSceneScriptDraft, CreatorScriptHealth, ExportMovieResult, ImageDispatchCountdown, Scene, SceneIntelligence, SceneTiming, VideoDispatchCountdown } from "@/components/create/createWorkspacePanelTypes";
import { type CreatorMediaAction, type CreatorQualityMode } from "@/lib/creator/mediaRouting";
import type { BatchRenderItem, CreatorOpsStatus } from "./createWorkspaceSceneTypes";

/** Presentation only: state, effects, authority and persistence remain in CreateWorkspace. */
export type StoryverseScenePanelProps = {
  isCreatorLabFlow: boolean;
  uiLanguage: import("@/lib/useLanguage").Language;
  creatorTimelineMediaGate: { status: "not_applicable"; approved: boolean; title: string; message: string; action: string; } | { status: "auto_managed"; approved: boolean; title: string; message: string; action: string; } | { status: "safe"; approved: boolean; title: string; message: string; action: string; };
  creatorMediaPreflightLoading: boolean;
  saveProject: () => Promise<void>;
  isSavingProject: boolean;
  ui: { bestHookCandidate: string; bestThumbnailCandidate: string; branchAfterScene: string; branchPlaceholder: string; branchQuestion: string; branchWarning: string; cancel: string; climaxLevel: string; continueFromHere: string; continueFromLastScene: string; continueFromLastSceneDesc: string; continuePromptPlaceholder: string; convertToVideo: string; createFinalMovieWithCount: string; creatingMovie: string; curiosityScore: string; download: string; editScene: string; emotionalIntensity: string; finalMovie: string; finalMovieDesc: string; highRisk: string; hookScore: string; imagePending: string; imageReady: string; intelligencePanel: string; lastScene: string; listenStory: string; lowRisk: string; mediumRisk: string; moderateReady: string; noSceneImagePreview: string; noSceneIntelligence: string; noSceneVideoPreview: string; pacingLevel: string; prepareAudio: string; preparingAudio: string; readySceneImage: string; readySceneVideo: string; recommendation: string; redraw: string; redrawing: string; retentionRisk: string; saveProject: string; savingProject: string; scene: string; sceneCardPurpose: string; sceneEditPlaceholder: string; sceneEditQuestion: string; sceneListTitle: string; scenePreviews: string; sceneProductionPanelDesc: string; sceneType: string; secondShort: string; speech: string; speechTimingOk: string; speechTooLong: string; stopStory: string; strongReady: string; target: string; tensionScore: string; thumbnailScore: string; updateScene: string; updating: string; videoCreating: string; videoPending: string; videoReady: string; weakReady: string; writeContinue: string; writingContinue: string; writingNewFlow: string; youtubeReadiness: string; };
  creatorFinalVideoReadiness: CreatorFinalVideoReadinessReport | null;
  creatorFinalVideoReadinessMessage: string;
  creatorFinalProductionGate: CreatorFinalProductionGateReport | null;
  creatorFinalProductionGateMessage: string;
  refreshCreatorOpsStatus: () => Promise<CreatorOpsStatus | null>;
  creatorOpsStatus: CreatorOpsStatus;
  flowContinuityAudit: FlowContinuityAuditReport | null;
  exportFlowValidation: ExportFlowValidationReport | null;
  audioDurationMatchedCount: number;
  audioSplitRecommendedCount: number;
  unnecessaryExtensionRemovedTotal: number;
  setIsAdvancedMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  isAdvancedMode: boolean;
  batchRenderItems: BatchRenderItem[];
  isBatchRendering: boolean;
  retryFailedScenes: (specificSceneId?: number) => Promise<void>;
  isPreparingAudio: boolean;
  isExportingMovie: boolean;
  playingDialogueSceneId: number | null;
  getBatchLabel: (key: "start" | "cancel" | "rendering" | "completed" | "failed" | "progress" | "statusTitle" | "retryFailed" | "retryScene" | "retrying") => "🚀 Tüm Sahneleri Üret" | "Durdur" | "Batch render çalışıyor..." | "Batch render tamamlandı ✅" | "Batch render sırasında bazı sahneler hata aldı." | "İlerleme" | "Batch Render Durumu" | "🔁 Hatalı Sahneleri Yeniden Üret" | "Tekrar dene" | "Yeniden deneniyor..." | "🚀 Generate All Scenes" | "Stop" | "Batch render is running..." | "Batch render completed ✅" | "Some scenes failed during batch render." | "Progress" | "Batch Render Status" | "🔁 Retry Failed Scenes" | "Retry" | "Retrying...";
  prepareAllAudio: () => Promise<void>;
  isPlayingStory: boolean;
  isCreatorMediaGenerationBlocked: boolean;
  playWholeStory: () => Promise<void>;
  loadingAudioSceneId: number | null;
  handleExportMovie: (forceRebuild?: boolean) => Promise<void>;
  readyExportCount: number;
  exportedMovieUrl: string;
  hasReusableExport: (sourceScenes?: Scene[]) => boolean;
  handleResetExport: () => Promise<void>;
  videoDispatchCountdown: VideoDispatchCountdown | null;
  cancelPendingVideoDispatch: () => void;
  imageDispatchCountdown: ImageDispatchCountdown | null;
  cancelPendingImageDispatch: () => void;
  stopBatchRender: () => Promise<void>;
  startBatchRender: () => Promise<void>;
  getBatchProgress: () => number;
  batchRenderStartedAt: string;
  retryingSceneId: number | null;
  exportMovieResult: ExportMovieResult | null;
  formatDurationLabel: (seconds?: number) => string;
  formatFileSizeLabel: (sizeBytes?: number) => string;
  handleDownloadVideo: () => Promise<void>;
  handleStitchVideo: () => Promise<void>;
  scenes: Scene[];
  setSaveMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setError: import("react").Dispatch<import("react").SetStateAction<string>>;
  getSceneAudioStatus: (scene: Scene) => boolean;
  sceneScriptDrafts: Record<number, CreatorSceneScriptDraft>;
  assessCreatorSceneScriptDraft: ({ scene, draft, language, qualityMode, }: { scene: Scene; draft: CreatorSceneScriptDraft; language: ContentLanguage; qualityMode: CreatorQualityMode; }) => CreatorScriptHealth;
  language: ContentLanguage;
  creatorQualityMode: CreatorQualityMode;
  roundCreatorTiming: (value: number, digits?: number) => number;
  redrawLoadingId: number | null;
  loadingDialogueSceneId: number | null;
  playNarration: (sceneId: number, narration: string) => Promise<void>;
  playingSceneId: number | null;
  isCreatorActionBlocked: (action: CreatorMediaAction) => boolean;
  getCreatorMediaActionError: (action?: CreatorMediaAction) => string;
  playSceneDialogue: (scene: Scene) => Promise<void>;
  setScenes: import("react").Dispatch<import("react").SetStateAction<Scene[]>>;
  setExportedMovieUrl: import("react").Dispatch<import("react").SetStateAction<string>>;
  setExportMovieResult: import("react").Dispatch<import("react").SetStateAction<ExportMovieResult | null>>;
  setExportSignature: import("react").Dispatch<import("react").SetStateAction<string>>;
  handleGenerateVideo: (sceneId: number, options?: { skipDispatchCountdown?: boolean; creatorOperationId?: string; batchChildOperationKey?: string; }) => Promise<boolean>;
  getCreatorEffectiveSceneOutputMode: (scene: Scene, sourceScenes?: Scene[]) => "image" | "video";
  getCreatorMediaRoutingError: (action: CreatorMediaAction) => "Draft is a text-only planning mode. Select Standard, Pro or Cinematic before generating media." | "Draft yalnızca metin tabanlı planlama modudur. Medya üretmeden önce Standard, Pro veya Cinematic seç." | "Standard uses images, voice and light motion. Select Pro or Cinematic for AI video blocks." | "Standard; görsel, ses ve hafif hareket kullanır. AI video block için Pro veya Cinematic seç." | "This media action is not available for the selected production quality." | "Bu medya aksiyonu seçilen üretim kalitesinde kullanılamaz.";
  requestCancelSceneVideo: (scene: Scene, options?: { confirm?: boolean; silent?: boolean; }) => Promise<boolean>;
  cancellingVideoSceneId: number | null;
  openCreatorSceneEditor: (scene: Scene) => void;
  setEditingSceneId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setBranchingSceneId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  redrawSceneImage: (scene: Scene) => Promise<void>;
  formatSceneIntelligenceValue: (value: unknown, fallback?: string) => string;
  formatSceneScore: (value: unknown) => string;
  calculateThumbnailScore: (intelligence?: SceneIntelligence) => number;
  isBestThumbnailCandidate: (currentScene: { intelligence?: SceneIntelligence; }, candidateScenes: Array<{ intelligence?: SceneIntelligence; }>) => boolean;
  calculateHookScore: (intelligence?: SceneIntelligence) => number;
  isBestHookCandidate: (currentScene: { intelligence?: SceneIntelligence; }, candidateScenes: Array<{ intelligence?: SceneIntelligence; }>) => boolean;
  calculateRetentionRisk: (intelligence?: SceneIntelligence) => { level: string; score: number; };
  calculateYoutubeReadinessScore: (intelligence?: SceneIntelligence) => number;
  getYoutubeReadinessLevel: (score: number) => "strong" | "moderate" | "weak";
  generateSceneRecommendation: (intelligence?: SceneIntelligence) => string;
  TARGET_SCENE_DURATION_SECONDS: 10;
  isSceneSpeechTooLong: (timing?: SceneTiming) => boolean;
  editingSceneId: number | null;
  setSceneScriptDrafts: import("react").Dispatch<import("react").SetStateAction<Record<number, CreatorSceneScriptDraft>>>;
  saveCreatorSceneScript: (sceneId: number, draftOverride?: CreatorSceneScriptDraft) => boolean;
  autoFitCreatorSceneScript: (sceneId: number) => Promise<void>;
  sceneScriptFitLoadingId: number | null;
  addCreatorSceneVisualBlock: (sceneId: number) => void;
  splitCreatorScene: (sceneId: number) => void;
  setSceneInstructions: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  sceneInstructions: Record<number, string>;
  updateScene: (sceneId: number) => Promise<void>;
  sceneLoadingId: number | null;
  branchingSceneId: number | null;
  branchInstructions: Record<number, string>;
  setBranchInstructions: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  handleBranchFromScene: (fromSceneId: number) => Promise<void>;
  branchLoadingId: number | null;
  continuePrompt: string;
  setContinuePrompt: import("react").Dispatch<import("react").SetStateAction<string>>;
  handleContinueStory: () => Promise<void>;
  isContinuing: boolean;
};

export default function StoryverseScenePanel({
  isCreatorLabFlow,
  uiLanguage,
  creatorTimelineMediaGate,
  creatorMediaPreflightLoading,
  saveProject,
  isSavingProject,
  ui,
  creatorFinalVideoReadiness,
  creatorFinalVideoReadinessMessage,
  creatorFinalProductionGate,
  creatorFinalProductionGateMessage,
  refreshCreatorOpsStatus,
  creatorOpsStatus,
  flowContinuityAudit,
  exportFlowValidation,
  audioDurationMatchedCount,
  audioSplitRecommendedCount,
  unnecessaryExtensionRemovedTotal,
  setIsAdvancedMode,
  isAdvancedMode,
  batchRenderItems,
  isBatchRendering,
  retryFailedScenes,
  isPreparingAudio,
  isExportingMovie,
  playingDialogueSceneId,
  getBatchLabel,
  prepareAllAudio,
  isPlayingStory,
  isCreatorMediaGenerationBlocked,
  playWholeStory,
  loadingAudioSceneId,
  handleExportMovie,
  readyExportCount,
  exportedMovieUrl,
  hasReusableExport,
  handleResetExport,
  videoDispatchCountdown,
  cancelPendingVideoDispatch,
  imageDispatchCountdown,
  cancelPendingImageDispatch,
  stopBatchRender,
  startBatchRender,
  getBatchProgress,
  batchRenderStartedAt,
  retryingSceneId,
  exportMovieResult,
  formatDurationLabel,
  formatFileSizeLabel,
  handleDownloadVideo,
  handleStitchVideo,
  scenes,
  setSaveMessage,
  setError,
  getSceneAudioStatus,
  sceneScriptDrafts,
  assessCreatorSceneScriptDraft,
  language,
  creatorQualityMode,
  roundCreatorTiming,
  redrawLoadingId,
  loadingDialogueSceneId,
  playNarration,
  playingSceneId,
  isCreatorActionBlocked,
  getCreatorMediaActionError,
  playSceneDialogue,
  setScenes,
  setExportedMovieUrl,
  setExportMovieResult,
  setExportSignature,
  handleGenerateVideo,
  getCreatorEffectiveSceneOutputMode,
  getCreatorMediaRoutingError,
  requestCancelSceneVideo,
  cancellingVideoSceneId,
  openCreatorSceneEditor,
  setEditingSceneId,
  setBranchingSceneId,
  redrawSceneImage,
  formatSceneIntelligenceValue,
  formatSceneScore,
  calculateThumbnailScore,
  isBestThumbnailCandidate,
  calculateHookScore,
  isBestHookCandidate,
  calculateRetentionRisk,
  calculateYoutubeReadinessScore,
  getYoutubeReadinessLevel,
  generateSceneRecommendation,
  TARGET_SCENE_DURATION_SECONDS,
  isSceneSpeechTooLong,
  editingSceneId,
  setSceneScriptDrafts,
  saveCreatorSceneScript,
  autoFitCreatorSceneScript,
  sceneScriptFitLoadingId,
  addCreatorSceneVisualBlock,
  splitCreatorScene,
  setSceneInstructions,
  sceneInstructions,
  updateScene,
  sceneLoadingId,
  branchingSceneId,
  branchInstructions,
  setBranchInstructions,
  handleBranchFromScene,
  branchLoadingId,
  continuePrompt,
  setContinuePrompt,
  handleContinueStory,
  isContinuing,
}: StoryverseScenePanelProps) {
  return (
<div className="contents">
            {isCreatorLabFlow && (
              <div className="rounded-[28px] border border-rose-300/20 bg-slate-950/55 p-5 shadow-[0_16px_44px_rgba(15,23,42,0.28)]">
                <p className="text-xs uppercase tracking-[0.25em] text-rose-200/80">
                  {uiLanguage === "en" ? "Velto Studio Scene Review" : "Velto Studio Sahne İnceleme"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {uiLanguage === "en" ? "Review scenes before asset generation" : "Medya üretiminden önce sahneleri kontrol et"}
                </h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                  {uiLanguage === "en"
                    ? "Edit narration, dialogue, visual prompts and timeline decisions here before starting image, voice, video or export actions."
                    : "Görsel, ses, video veya export aksiyonlarından önce narration, dialogue, visual prompt ve timeline kararlarını burada düzenle."}
                </p>

                <div className={`mt-4 rounded-3xl border p-4 ${
                  creatorTimelineMediaGate.approved
                    ? "border-emerald-300/25 bg-emerald-500/10"
                    : "border-amber-300/30 bg-amber-500/10"
                }`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        {uiLanguage === "en" ? "Media generation gate" : "Medya üretim kontrolü"}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {creatorTimelineMediaGate.title}
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                        {creatorTimelineMediaGate.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                        {creatorMediaPreflightLoading
                          ? uiLanguage === "en" ? "Automatic check running" : "Otomatik kontrol çalışıyor"
                          : uiLanguage === "en" ? "Managed automatically" : "Otomatik yönetiliyor"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
              {isCreatorLabFlow ? (
                <div>
                  <div className="flex flex-col gap-2 text-center md:text-left">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      {uiLanguage === "en" ? "Guided production" : "Yönlendirmeli üretim"}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {uiLanguage === "en" ? "Simple creator workflow" : "Sade creator akışı"}
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">
                      {uiLanguage === "en"
                        ? "Use the main actions for the standard workflow. Advanced AI video block controls stay hidden unless advanced mode is enabled."
                        : "Standart akış için ana aksiyonları kullan. Gelişmiş AI video block kontrolleri yalnızca advanced mode açıkken görünür."}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/75 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {uiLanguage === "en" ? "Production actions are centralized" : "Üretim aksiyonları tek alanda toplandı"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {uiLanguage === "en"
                          ? "Use Continue Production above. Velto Studio selects visuals, voice, motion and final-video actions in the correct order."
                          : "Yukarıdaki Üretime Devam Et aksiyonunu kullan. Velto Studio görsel, ses, hareket ve final-video işlemlerini doğru sırada seçer."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveProject}
                        disabled={isSavingProject}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                      >
                        {isSavingProject ? ui.savingProject : ui.saveProject}
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById("creatorlab-production-action")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        {uiLanguage === "en" ? "Back to production control" : "Üretim kontrolüne dön"}
                      </button>
                    </div>
                  </div>

                  {creatorFinalVideoReadiness && (
                    <p
                      className={`mt-3 text-center text-xs leading-5 ${
                        creatorFinalVideoReadiness.status === "ready"
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      <span className="font-semibold">Final video:</span>{" "}
                      {creatorFinalVideoReadinessMessage}
                    </p>
                  )}

                  {creatorFinalProductionGate && (
                    <div
                      className={`mt-4 rounded-3xl border p-4 ${
                        creatorFinalProductionGate.status === "ready"
                          ? "border-emerald-300/50 bg-emerald-50/90"
                          : creatorFinalProductionGate.status === "review"
                            ? "border-amber-300/50 bg-amber-50/90"
                            : creatorFinalProductionGate.status === "checking"
                              ? "border-blue-300/50 bg-blue-50/90"
                              : "border-rose-300/50 bg-rose-50/90"
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            3Q · {uiLanguage === "en" ? "Final Production Gate" : "Final Üretim Kontrolü"}
                          </p>
                          <h4 className="mt-2 text-sm font-semibold text-slate-950">
                            {creatorFinalProductionGate.status === "ready"
                              ? uiLanguage === "en" ? "Ready to create the final video" : "Final video üretimine hazır"
                              : creatorFinalProductionGate.status === "review"
                                ? uiLanguage === "en" ? "Ready with confirmation" : "Onay ile hazır"
                                : creatorFinalProductionGate.status === "checking"
                                  ? uiLanguage === "en" ? "Production service check required" : "Üretim servisi kontrolü gerekli"
                                  : uiLanguage === "en" ? "Final production is blocked" : "Final üretim engellendi"}
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {creatorFinalProductionGateMessage}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void refreshCreatorOpsStatus()}
                          disabled={creatorOpsStatus.status === "checking"}
                          className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          {creatorOpsStatus.status === "checking"
                            ? uiLanguage === "en" ? "Checking…" : "Kontrol ediliyor…"
                            : uiLanguage === "en" ? "Check again" : "Tekrar kontrol et"}
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                        {([
                          ["Timeline", creatorFinalProductionGate.checks.timeline],
                          [uiLanguage === "en" ? "Visuals" : "Görseller", creatorFinalProductionGate.checks.visuals],
                          [uiLanguage === "en" ? "Voice" : "Ses", creatorFinalProductionGate.checks.voiceOver],
                          [uiLanguage === "en" ? "Audio" : "Ses miks", creatorFinalProductionGate.checks.audio],
                          [uiLanguage === "en" ? "Continuity" : "Devamlılık", creatorFinalProductionGate.checks.continuity],
                          [uiLanguage === "en" ? "Final service" : "Final servis", creatorFinalProductionGate.checks.exportService],
                        ] as Array<[string, string]>).map(([label, status]) => (
                          <div key={label} className="rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-center">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
                            <p className={`mt-1 text-xs font-semibold ${
                              status === "ready"
                                ? "text-emerald-700"
                                : status === "review"
                                  ? "text-amber-700"
                                  : status === "checking"
                                    ? "text-blue-700"
                                    : "text-rose-700"
                            }`}>
                              {status === "ready"
                                ? uiLanguage === "en" ? "Ready" : "Hazır"
                                : status === "review"
                                  ? uiLanguage === "en" ? "Review" : "Kontrol"
                                  : status === "checking"
                                    ? uiLanguage === "en" ? "Checking" : "Kontrol"
                                    : uiLanguage === "en" ? "Blocked" : "Engelli"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {flowContinuityAudit && (
                    <div
                      className={`mt-4 rounded-3xl border p-4 ${
                        exportFlowValidation?.status === "blocked"
                          ? "border-rose-300/40 bg-rose-50/90"
                          : exportFlowValidation?.status === "confirmation_required"
                            ? "border-amber-300/40 bg-amber-50/90"
                            : "border-emerald-300/40 bg-emerald-50/90"
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            3N-1 · {uiLanguage === "en" ? "Flow continuity audit" : "Akış sürekliliği denetimi"}
                          </p>
                          <h4 className="mt-2 text-sm font-semibold text-slate-950">
                            {flowContinuityAudit.status === "ready"
                              ? uiLanguage === "en"
                                ? "No freeze or duration gap detected"
                                : "Donma veya süre boşluğu tespit edilmedi"
                              : flowContinuityAudit.status === "review"
                                ? uiLanguage === "en"
                                  ? "Review timing warnings before export"
                                  : "Export öncesi süre uyarılarını kontrol et"
                                : uiLanguage === "en"
                                  ? "High freeze or duration risk detected"
                                  : "Yüksek donma veya süre riski tespit edildi"}
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {uiLanguage === "en"
                              ? "Detection only: this micro-sprint reports risk and does not change or block the export."
                              : "Yalnızca tespit: bu mikro sprint riski raporlar; export'u değiştirmez veya engellemez."}
                          </p>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-emerald-700">
                            <p className="text-base font-semibold">{flowContinuityAudit.safeScenes}</p>
                            <p>{uiLanguage === "en" ? "Safe" : "Güvenli"}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-amber-700">
                            <p className="text-base font-semibold">{flowContinuityAudit.warningScenes}</p>
                            <p>{uiLanguage === "en" ? "Review" : "Kontrol"}</p>
                          </div>
                          <div className="rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-rose-700">
                            <p className="text-base font-semibold">{flowContinuityAudit.highRiskScenes}</p>
                            <p>{uiLanguage === "en" ? "High" : "Yüksek"}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-slate-700">
                            <p className="text-base font-semibold">
                              {flowContinuityAudit.totalUncoveredDurationSec.toFixed(1)}s
                            </p>
                            <p>{uiLanguage === "en" ? "Gap" : "Boşluk"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-sky-200/70 bg-white/75 px-3 py-2 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
                        <p>
                          <span className="font-semibold text-sky-800">
                            3N-2 · {uiLanguage === "en" ? "Audio-first duration matching" : "Ses öncelikli süre eşleme"}
                          </span>
                          {" · "}
                          {audioDurationMatchedCount > 0
                            ? uiLanguage === "en"
                              ? `${audioDurationMatchedCount} scene duration(s) matched to measured audio.`
                              : `${audioDurationMatchedCount} sahnenin süresi ölçülen sese eşlendi.`
                            : uiLanguage === "en"
                              ? "Generate voice-over to measure and match scene durations."
                              : "Sahne sürelerini ölçüp eşlemek için seslendirme üret."}
                        </p>
                        <p className={audioSplitRecommendedCount > 0 ? "font-semibold text-amber-700" : "text-slate-500"}>
                          {audioSplitRecommendedCount > 0
                            ? uiLanguage === "en"
                              ? `${audioSplitRecommendedCount} long scene(s): split suggested`
                              : `${audioSplitRecommendedCount} uzun sahne: bölme öneriliyor`
                            : uiLanguage === "en"
                              ? `${unnecessaryExtensionRemovedTotal.toFixed(1)}s unnecessary extension removed`
                              : `${unnecessaryExtensionRemovedTotal.toFixed(1)} sn gereksiz uzama kaldırıldı`}
                        </p>
                      </div>

                      {exportFlowValidation && (
                        <div
                          className={`mt-3 flex flex-col gap-2 rounded-2xl border px-3 py-2 text-xs md:flex-row md:items-center md:justify-between ${
                            exportFlowValidation.status === "blocked"
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : exportFlowValidation.status === "confirmation_required"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          <p>
                            <span className="font-semibold">
                              3N-5 · {uiLanguage === "en" ? "Export preflight" : "Export öncesi kontrol"}
                            </span>
                            {" · "}
                            {exportFlowValidation.status === "blocked"
                              ? uiLanguage === "en"
                                ? `Export is blocked for scene(s): ${exportFlowValidation.blockingSceneIds.join(", ")}.`
                                : `Export şu sahneler için durdurulacak: ${exportFlowValidation.blockingSceneIds.join(", ")}.`
                              : exportFlowValidation.status === "confirmation_required"
                                ? uiLanguage === "en"
                                  ? "Export will ask for confirmation because timing is not fully measured."
                                  : "Süreler tam ölçülmediği için export onay isteyecek."
                                : uiLanguage === "en"
                                  ? "Export can start safely."
                                  : "Export güvenle başlatılabilir."}
                          </p>
                          <p className="font-semibold">
                            {uiLanguage === "en"
                              ? `${exportFlowValidation.autoFixedScenes} safe auto-fix(es)`
                              : `${exportFlowValidation.autoFixedScenes} güvenli otomatik düzeltme`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setIsAdvancedMode((prev) => !prev)}
                      className="rounded-2xl border border-slate-300 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100"
                    >
                      {isAdvancedMode
                        ? uiLanguage === "en"
                          ? "Hide Advanced Mode"
                          : "Advanced Mode'u Gizle"
                        : uiLanguage === "en"
                          ? "Show Advanced Mode"
                          : "Advanced Mode'u Göster"}
                    </button>
                  </div>

                  {!isAdvancedMode && (
                    <p className="mt-3 rounded-2xl border border-slate-200 bg-white/60 p-3 text-center text-xs leading-5 text-slate-500">
                      {uiLanguage === "en"
                        ? "Standard users can create the output with visuals, voice-over and final video. Advanced AI video blocks are optional for Pro/Cinematic workflows."
                        : "Standart kullanıcı görseller, seslendirme ve final video ile çıktıyı oluşturabilir. Gelişmiş AI video block üretimi Pro/Cinematic akışlar için opsiyoneldir."}
                    </p>
                  )}

                  {isAdvancedMode && (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {uiLanguage === "en" ? "Production diagnostics" : "Üretim tanılama"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {uiLanguage === "en"
                          ? "Media generation remains controlled by Continue Production. This area shows recovery actions only when generation fails."
                          : "Medya üretimi Üretime Devam Et tarafından yönetilir. Bu alan yalnızca üretim başarısız olduğunda kurtarma aksiyonlarını gösterir."}
                      </p>

                      <div className="mt-3 flex flex-wrap justify-center gap-3">
                        {batchRenderItems.some((item) => item.status === "failed") && !isBatchRendering ? (
                          <button
                            type="button"
                            onClick={() => retryFailedScenes()}
                            disabled={isPreparingAudio || isExportingMovie || playingDialogueSceneId !== null}
                            className="rounded-2xl bg-rose-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
                          >
                            {getBatchLabel("retryFailed")}
                          </button>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {uiLanguage === "en" ? "No failed media tasks" : "Başarısız medya görevi yok"}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={saveProject}
                    disabled={isSavingProject}
                    className="rounded-2xl bg-green-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isSavingProject ? ui.savingProject : ui.saveProject}
                  </button>

                  <button
                    onClick={prepareAllAudio}
                    disabled={isPreparingAudio || isPlayingStory || playingDialogueSceneId !== null || isCreatorMediaGenerationBlocked}
                    className="rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isPreparingAudio ? ui.preparingAudio : ui.prepareAudio}
                  </button>

                  <button
                    onClick={playWholeStory}
                    disabled={
                      (loadingAudioSceneId !== null && !isPlayingStory) ||
                      isPreparingAudio ||
                      playingDialogueSceneId !== null
                    }
                    className="rounded-2xl bg-purple-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isPlayingStory ? ui.stopStory : ui.listenStory}
                  </button>

                  <button
                    onClick={() => handleExportMovie(false)}
                    disabled={isExportingMovie || readyExportCount === 0 || isCreatorMediaGenerationBlocked}
                    className="rounded-2xl bg-orange-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isExportingMovie
                      ? ui.creatingMovie
                      : exportedMovieUrl && hasReusableExport()
                        ? (uiLanguage === "en" ? "▶ Open Existing Movie" : "▶ Mevcut Filmi Aç")
                        : `${ui.createFinalMovieWithCount} (${readyExportCount})`}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportMovie(true)}
                    disabled={isExportingMovie || readyExportCount === 0 || isCreatorMediaGenerationBlocked}
                    className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-6 py-3 font-semibold text-amber-700 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isExportingMovie
                      ? ui.creatingMovie
                      : uiLanguage === "en"
                        ? "🔁 Re-create Movie"
                        : "🔁 Yeniden Oluştur"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetExport}
                    disabled={isExportingMovie || !exportedMovieUrl}
                    className="rounded-2xl border border-red-400/40 bg-rose-50/80 px-6 py-3 font-semibold text-rose-700 transition hover:scale-105 disabled:opacity-50"
                  >
                    {uiLanguage === "en" ? "🗑 Reset Export" : "🗑 Exportu Sıfırla"}
                  </button>

                  <button
                    onClick={
                      videoDispatchCountdown?.scope === "batch"
                        ? cancelPendingVideoDispatch
                        : imageDispatchCountdown?.scope === "batch"
                          ? cancelPendingImageDispatch
                          : isBatchRendering
                            ? stopBatchRender
                            : startBatchRender
                    }
                    disabled={
                      videoDispatchCountdown?.scope !== "batch" &&
                      imageDispatchCountdown?.scope !== "batch" &&
                      (isPreparingAudio ||
                        isExportingMovie ||
                        playingDialogueSceneId !== null ||
                        Boolean(videoDispatchCountdown) ||
                        Boolean(imageDispatchCountdown) ||
                        (loadingAudioSceneId !== null && !isBatchRendering) ||
                        (!isBatchRendering && isCreatorMediaGenerationBlocked))
                    }
                    className={`rounded-2xl px-6 py-3 font-semibold transition hover:scale-105 disabled:opacity-50 ${
                      videoDispatchCountdown?.scope === "batch" || imageDispatchCountdown?.scope === "batch"
                        ? "border border-rose-300 bg-rose-50 text-rose-700"
                        : "bg-cyan-600 text-slate-900"
                    }`}
                  >
                    {videoDispatchCountdown?.scope === "batch"
                      ? uiLanguage === "en"
                        ? `Cancel batch start · ${videoDispatchCountdown.secondsRemaining}s`
                        : `Toplu başlangıcı iptal et · ${videoDispatchCountdown.secondsRemaining} sn`
                      : imageDispatchCountdown?.scope === "batch"
                        ? uiLanguage === "en"
                          ? `Cancel image start · ${imageDispatchCountdown.secondsRemaining}s`
                          : `Görsel başlangıcını iptal et · ${imageDispatchCountdown.secondsRemaining} sn`
                        : isBatchRendering
                          ? getBatchLabel("cancel")
                          : getBatchLabel("start")}
                  </button>

                  {batchRenderItems.some((item) => item.status === "failed") && !isBatchRendering && (
                    <button
                      onClick={() => retryFailedScenes()}
                      disabled={isPreparingAudio || isExportingMovie || playingDialogueSceneId !== null || isCreatorMediaGenerationBlocked}
                      className="rounded-2xl bg-rose-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                    >
                      {getBatchLabel("retryFailed")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {imageDispatchCountdown?.scope === "batch" && (
              <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm" aria-live="assertive">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="text-sm">
                      {uiLanguage === "en"
                        ? `Image generation starts in ${imageDispatchCountdown.secondsRemaining} seconds`
                        : `Görsel gönderimi ${imageDispatchCountdown.secondsRemaining} saniye içinde başlayacak`}
                    </strong>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      {uiLanguage === "en"
                        ? `${imageDispatchCountdown.sceneCount} image task(s) are pending. Generation begins when the countdown reaches zero.`
                        : `${imageDispatchCountdown.sceneCount} görsel görevi bekliyor. Sayaç sıfıra ulaştığında üretim başlar.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelPendingImageDispatch}
                    className="min-h-11 shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700"
                  >
                    {uiLanguage === "en" ? "Cancel start" : "Başlatmayı iptal et"}
                  </button>
                </div>
              </div>
            )}

            {videoDispatchCountdown?.scope === "batch" && (
              <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm" aria-live="assertive">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="text-sm">
                      {uiLanguage === "en"
                        ? `Video generation starts in ${videoDispatchCountdown.secondsRemaining} seconds`
                        : `Video gönderimi ${videoDispatchCountdown.secondsRemaining} saniye içinde başlayacak`}
                    </strong>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      {uiLanguage === "en"
                        ? `${videoDispatchCountdown.sceneCount} video task(s) are pending. Generation begins when the countdown reaches zero.`
                        : `${videoDispatchCountdown.sceneCount} video görevi bekliyor. Sayaç sıfıra ulaştığında üretim başlar.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelPendingVideoDispatch}
                    className="min-h-11 shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700"
                  >
                    {uiLanguage === "en" ? "Cancel start" : "Başlatmayı iptal et"}
                  </button>
                </div>
              </div>
            )}

            {(batchRenderItems.length > 0 || isBatchRendering) && (
              <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {getBatchLabel("statusTitle")}
                    </h3>
                    <p className="mt-1 text-sm text-sky-800/80">
                      {isBatchRendering
                        ? getBatchLabel("rendering")
                        : `${getBatchLabel("progress")}: ${getBatchProgress()}%`}
                    </p>
                    {batchRenderStartedAt && (
                      <p className="mt-1 text-xs text-sky-800/50">
                        {new Date(batchRenderStartedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="min-w-[120px] text-right text-2xl font-bold text-sky-800">
                    {getBatchProgress()}%
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-white/74">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${getBatchProgress()}%` }}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {batchRenderItems.map((item) => (
                    <div
                      key={item.sceneId}
                      className="rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {ui.scene} {item.sceneId}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            item.status === "done"
                              ? "bg-green-50/800/20 text-green-700"
                              : item.status === "failed"
                                ? "bg-red-500/20 text-red-200"
                                : item.status === "processing"
                                  ? "bg-yellow-500/20 text-yellow-100"
                                  : "bg-white/68 text-gray-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-sky-800/70">
                        {item.step} {item.message ? `→ ${item.message}` : ""}
                      </p>
                      {item.status === "failed" && !isBatchRendering && (
                        <button
                          onClick={() => retryFailedScenes(item.sceneId)}
                          disabled={retryingSceneId === item.sceneId}
                          className="mt-3 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                        >
                          {retryingSceneId === item.sceneId
                            ? getBatchLabel("retrying")
                            : getBatchLabel("retryScene")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exportedMovieUrl && (
              <div className="rounded-[28px] border border-orange-200/24 bg-white/62 p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{ui.finalMovie}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {ui.finalMovieDesc}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dosya</p>
                    <p className="mt-2 text-sm font-medium text-slate-900 break-all">
                      {exportMovieResult?.fileName || "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Süre</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatDurationLabel(exportMovieResult?.durationSeconds)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Boyut</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatFileSizeLabel(exportMovieResult?.sizeBytes)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-white p-4">
                  <p className="text-sm text-slate-600">Final Video URL</p>
                  <a
                    href={exportMovieResult?.downloadUrl || exportedMovieUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-sm text-sky-700 underline"
                  >
                    {exportMovieResult?.downloadUrl || exportedMovieUrl}
                  </a>
                </div>

                <video
                  src={exportedMovieUrl}
                  controls
                  className="w-full rounded-2xl border border-orange-200/24 bg-black"
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadVideo}
                    className="inline-flex items-center rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:scale-105"
                  >
                    {ui.download}
                  </button>

                  <button
                    type="button"
                    onClick={handleStitchVideo}
                    disabled={
                      isExportingMovie ||
                      scenes.filter((scene) => scene.videoUrl && scene.videoStatus === "done").length < 2
                    }
                    className="inline-flex items-center rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isExportingMovie
                      ? ui.creatingMovie
                      : uiLanguage === "en"
                        ? "Stitch Final Video"
                        : "Final Videoyu Birleştir"}
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(exportMovieResult?.downloadUrl || exportedMovieUrl);
                        setSaveMessage("Final film linki kopyalandı ✅");
                      } catch {
                        setError("Link kopyalanamadı.");
                      }
                    }}
                    className="inline-flex items-center rounded-xl border border-orange-200/26 px-4 py-2 text-sm text-slate-900 transition hover:scale-105"
                  >
                    Linki Kopyala
                  </button>

                  <a
                    href={exportMovieResult?.downloadUrl || exportedMovieUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl border border-orange-200/26 px-4 py-2 text-sm text-slate-900 transition hover:scale-105"
                  >
                    Yeni sekmede aç
                  </a>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">{ui.sceneListTitle}</h2>
                  <p className="mt-1 text-sm text-slate-600">{ui.sceneProductionPanelDesc}</p>
                </div>
                <div className="rounded-full border border-orange-200/24 bg-white/62 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-600">
                  Studio Timeline View
                </div>
              </div>

              {scenes.map((scene) => {
                const isLastScene = scene.id === scenes[scenes.length - 1]?.id;
                const isAudioReady = getSceneAudioStatus(scene);
                const hasDialogue = !!scene.dialogue?.trim();
                const hasImage = !!scene.image;
                const hasVideo = !!scene.videoUrl && scene.videoStatus === "done";
                const narrationReady = !!scene.audioUrl;
                const dialogueReady = !hasDialogue || !!scene.dialogueAudioUrl;
                const totalDuration = scene.timing?.targetSceneDuration || 0;
                const totalAudio = scene.timing?.totalAudioDuration || 0;
                const productionScore =
                  [hasImage, narrationReady, dialogueReady, hasVideo].filter(Boolean).length;
                const sceneVideoDispatchCountdownActive =
                  videoDispatchCountdown?.scope === "scene" &&
                  videoDispatchCountdown.sceneId === scene.id;
                const sceneImageDispatchCountdownActive =
                  imageDispatchCountdown?.scope === "scene" &&
                  imageDispatchCountdown.sceneId === scene.id;
                const sceneScriptDraft = sceneScriptDrafts[scene.id] || {
                  narration: scene.narration || "",
                  dialogue: scene.dialogue || "",
                };
                const sceneDraftHealth = assessCreatorSceneScriptDraft({
                  scene,
                  draft: sceneScriptDraft,
                  language,
                  qualityMode: creatorQualityMode,
                });
                const sceneDraftOverrunSec = Math.max(
                  0,
                  roundCreatorTiming(
                    sceneDraftHealth.estimatedSpeechSec -
                      Math.max(0, sceneDraftHealth.targetDurationSec - 0.8),
                    1,
                  ),
                );
                const sceneDraftGapSec = Math.max(
                  0,
                  roundCreatorTiming(
                    sceneDraftHealth.targetDurationSec -
                      sceneDraftHealth.estimatedSpeechSec -
                      1.8,
                    1,
                  ),
                );

                return (
                  <div
                    id={`creatorlab-scene-editor-${scene.id}`}
                    key={scene.id}
                    className="overflow-hidden rounded-[30px] border border-orange-200/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-800">
                            Scene {scene.id}
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              isAudioReady
                                ? "border border-green-200 bg-green-50/80 text-green-700"
                                : "border border-yellow-500/30 bg-yellow-500/10 text-amber-700"
                            }`}
                          >
                            {isAudioReady ? "Narration ready" : "Narration pending"}
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              dialogueReady
                                ? "border border-pink-500/30 bg-pink-500/10 text-pink-200"
                                : "border border-orange-500/30 bg-orange-500/10 text-orange-700"
                            }`}
                          >
                            {dialogueReady ? "Dialogue ready" : "Dialogue pending"}
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              scene.videoStatus === "done"
                                ? "border border-green-200 bg-green-50/80 text-green-700"
                                : scene.videoStatus === "delayed"
                                ? "border border-amber-300 bg-amber-50 text-amber-800"
                                : scene.videoStatus === "processing"
                                ? "border border-blue-500/30 bg-blue-500/10 text-blue-200"
                                : scene.videoStatus === "error"
                                ? "border border-red-500/30 bg-rose-50/80 text-red-200"
                                : "border border-orange-200/65/30 bg-gray-500/10 text-gray-200"
                            }`}
                          >
                            {scene.videoStatus === "done"
                              ? "Video ready"
                              : scene.videoStatus === "delayed"
                              ? "Video delayed · refresh to check"
                              : scene.videoStatus === "processing"
                              ? "Video rendering"
                              : scene.videoStatus === "error"
                              ? "Video error"
                              : "Video pending"}
                          </div>

                          {isLastScene && (
                            <span className="rounded-full border border-orange-200/22 px-3 py-1 text-xs text-slate-600">
                              {ui.lastScene}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">Production Scene Card</h3>
                          <p className="mt-1 max-w-2xl text-sm text-slate-600">
                            {ui.sceneCardPurpose}
                          </p>
                        </div>
                      </div>

                      <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 lg:w-[360px]">
                        <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Production score</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{productionScore}/4</p>
                          <p className="mt-1 text-xs text-slate-500">Image, narration, dialogue ve video durumu.</p>
                        </div>
                        <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Target duration</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalDuration.toFixed(1)}s</p>
                          <p className="mt-1 text-xs text-slate-500">Audio + video ritmi için hesaplanan hedef.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                      <div className="space-y-4">
                        <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                          <p className="text-base leading-7 text-gray-100">{scene.text}</p>
                        </div>

                        <div className="grid gap-3 rounded-[28px] border border-orange-200/24 bg-white/74 p-4 text-sm text-gray-200 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Narration</p>
                            <p>{scene.narration}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Dialogue</p>
                            <p>{scene.dialogue || "Yok"}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Camera</p>
                            <p>{scene.cameraDirection}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Emotion</p>
                            <p>{scene.emotion}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Motion hint</p>
                            <p>{scene.motionHint}</p>
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-800">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="font-semibold">Timing & export kararları</p>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                                scene.timing?.needsFreezeFrame
                                  ? "border border-yellow-500/30 bg-yellow-500/10 text-amber-700"
                                  : "border border-green-200 bg-green-50/80 text-green-700"
                              }`}
                            >
                              {scene.timing?.needsFreezeFrame ? "Freeze required" : "Video sufficient"}
                            </span>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-700/70">Audio total</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{totalAudio.toFixed(2)}s</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-700/70">Target scene</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{totalDuration.toFixed(2)}s</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-700/70">Freeze need</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{(scene.timing?.freezeDuration || 0).toFixed(2)}s</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Scene pipeline</p>
                          <div className="mt-3 grid gap-2">
                            {[
                              { label: uiLanguage === "en" ? "Image" : "Görsel", ready: hasImage, pending: redrawLoadingId === scene.id },
                              { label: uiLanguage === "en" ? "Narration" : "Anlatım", ready: narrationReady, pending: loadingAudioSceneId === scene.id },
                              { label: uiLanguage === "en" ? "Dialogue" : "Diyalog", ready: dialogueReady, pending: loadingDialogueSceneId === scene.id && hasDialogue },
                              { label: uiLanguage === "en" ? "Video" : "Video", ready: hasVideo, pending: scene.videoStatus === "processing" },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-orange-200/24 bg-white/62 px-3 py-2">
                                <span className="text-sm text-slate-700">{item.label}</span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                                    item.pending
                                      ? "border border-blue-500/30 bg-blue-500/10 text-blue-200"
                                      : item.ready
                                      ? "border border-green-200 bg-green-50/80 text-green-700"
                                      : "border border-orange-200/22 bg-white/62 text-slate-500"
                                  }`}
                                >
                                  {item.pending ? (uiLanguage === "en" ? "Processing" : "İşleniyor") : item.ready ? (uiLanguage === "en" ? "Ready" : "Hazır") : (uiLanguage === "en" ? "Pending" : "Bekliyor")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{uiLanguage === "en" ? "Quick actions" : "Hızlı aksiyonlar"}</p>
                          <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => playNarration(scene.id, scene.narration)}
                        disabled={
                          !scene.narration?.trim() ||
                          loadingAudioSceneId === scene.id ||
                          isPreparingAudio ||
                          (isPlayingStory && playingSceneId !== scene.id) ||
                          playingDialogueSceneId !== null
                        }
                        title={
                          !scene.narration?.trim()
                            ? (uiLanguage === "en" ? "This scene has no narrator text." : "Bu sahnede anlatıcı metni yok.")
                            : isCreatorActionBlocked("voice_over") || isCreatorMediaGenerationBlocked
                              ? getCreatorMediaActionError("voice_over")
                              : (uiLanguage === "en" ? "Generate or play this scene's narration." : "Bu sahnenin anlatımını üret veya oynat.")
                        }
                        className="rounded-xl border border-purple-400/40 bg-violet-50/80 px-4 py-2 text-sm text-purple-100 disabled:opacity-50"
                      >
                        {loadingAudioSceneId === scene.id
                          ? (uiLanguage === "en" ? "Preparing narration..." : "Ses hazırlanıyor...")
                          : playingSceneId === scene.id
                          ? (uiLanguage === "en" ? "Stop narration" : "Sesi Durdur")
                          : (uiLanguage === "en" ? "Listen to narrator" : "Anlatıcıyı Dinle")}
                      </button>

                      <button
                        type="button"
                        onClick={() => playSceneDialogue(scene)}
                        disabled={
                          !hasDialogue ||
                          loadingDialogueSceneId === scene.id ||
                          isPlayingStory ||
                          isPreparingAudio
                        }
                        title={
                          !hasDialogue
                            ? (uiLanguage === "en" ? "This scene has no character dialogue." : "Bu sahnede karakter diyaloğu yok.")
                            : isCreatorActionBlocked("voice_over") || isCreatorMediaGenerationBlocked
                              ? getCreatorMediaActionError("voice_over")
                              : (uiLanguage === "en" ? "Generate or play this scene's character dialogue." : "Bu sahnenin karakter diyaloğunu üret veya oynat.")
                        }
                        className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-4 py-2 text-sm text-pink-100 disabled:opacity-50"
                      >
                        {loadingDialogueSceneId === scene.id
                          ? (uiLanguage === "en" ? "Preparing dialogue..." : "Diyalog hazırlanıyor...")
                          : playingDialogueSceneId === scene.id
                          ? (uiLanguage === "en" ? "Stop dialogue" : "Diyaloğu Durdur")
                          : (uiLanguage === "en" ? "Listen to character dialogue" : "Karakter Diyaloğunu Dinle")}
                      </button>

                      <label className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-teal-50/80 px-3 py-2 text-xs text-teal-800">
                        <span>{uiLanguage === "en" ? "Export" : "Dışa aktar"}</span>
                        <select
                          value={scene.renderMode || ""}
                          onChange={(e) => {
                            const mode = e.target.value as "" | "video" | "image";

                            setScenes((prev) =>
                              prev.map((item) =>
                                item.id === scene.id
                                  ? { ...item, renderMode: mode || undefined }
                                  : item
                              )
                            );

                            setExportedMovieUrl("");
                            setExportMovieResult(null);
                            setExportSignature("");
                          }}
                          className="rounded-md border border-orange-200/24 bg-[radial-gradient(circle_at_10%_6%,#ffe0f2_0%,transparent_30%),radial-gradient(circle_at_90%_10%,#d9f5ff_0%,transparent_32%),radial-gradient(circle_at_48%_92%,#fff0bd_0%,transparent_36%),linear-gradient(180deg,#fffaf4_0%,#f8fbff_46%,#f4fff8_100%)] px-2 py-1 text-xs text-slate-900"
                        >
                          <option value="">{uiLanguage === "en" ? "Auto · Production Quality" : "Otomatik · Üretim Kalitesi"}</option>
                          <option value="video">Video</option>
                          <option value="image">Image</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          if (sceneVideoDispatchCountdownActive) {
                            cancelPendingVideoDispatch();
                          } else {
                            void handleGenerateVideo(scene.id);
                          }
                        }}
                        disabled={
                          !sceneVideoDispatchCountdownActive &&
                          ((scene.videoStatus === "processing" || scene.videoStatus === "delayed") ||
                            !scene.image ||
                            creatorMediaPreflightLoading ||
                            Boolean(videoDispatchCountdown) ||
                            Boolean(imageDispatchCountdown) ||
                            (isCreatorLabFlow &&
                              getCreatorEffectiveSceneOutputMode(scene) !== "video"))
                        }
                        title={
                          sceneVideoDispatchCountdownActive
                            ? uiLanguage === "en"
                              ? "Cancel before generation starts."
                              : "Üretim başlamadan iptal et."
                            : !scene.image
                              ? (uiLanguage === "en" ? "Generate the scene visual first." : "Önce sahne görselini üret.")
                              : isCreatorActionBlocked("ai_video_blocks")
                                ? getCreatorMediaRoutingError("ai_video_blocks")
                                : isCreatorLabFlow && getCreatorEffectiveSceneOutputMode(scene) !== "video"
                                  ? (uiLanguage === "en"
                                      ? "Production Quality routes this scene to Image."
                                      : "Üretim Kalitesi bu sahneyi Görsel rotasına yönlendiriyor.")
                                  : (uiLanguage === "en" ? "Create an AI motion block from this visual." : "Bu görselden AI hareketli video bloğu üret.")
                        }
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                          sceneVideoDispatchCountdownActive
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : "border-blue-400/40 bg-blue-500/10 text-blue-100"
                        }`}
                      >
                        {sceneVideoDispatchCountdownActive
                          ? uiLanguage === "en"
                            ? `Cancel start · ${videoDispatchCountdown?.secondsRemaining}s`
                            : `Başlatmayı iptal et · ${videoDispatchCountdown?.secondsRemaining} sn`
                          : creatorMediaPreflightLoading
                            ? uiLanguage === "en" ? "Checking video service..." : "Video servisi kontrol ediliyor..."
                            : scene.videoStatus === "processing"
                              ? ui.videoCreating
                              : scene.videoStatus === "delayed"
                                ? uiLanguage === "en" ? "Taking longer · refresh to check" : "Uzun sürüyor · kontrol için yenile"
                              : isCreatorActionBlocked("ai_video_blocks")
                                ? uiLanguage === "en" ? "Pro quality required" : "Pro kalite gerekli"
                                : ui.convertToVideo}
                      </button>

                      {sceneVideoDispatchCountdownActive && (
                        <span className="basis-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800" aria-live="assertive">
                          {uiLanguage === "en"
                            ? "No generation request has been sent yet. You can cancel until the countdown reaches zero."
                            : "Henüz üretim talebi gönderilmedi. Geri sayım sıfıra ulaşana kadar iptal edebilirsiniz."}
                        </span>
                      )}

                      {(scene.videoStatus === "processing" || scene.videoStatus === "delayed") && scene.videoQueueJobId && (
                        <button
                          type="button"
                          onClick={() => void requestCancelSceneVideo(scene)}
                          disabled={cancellingVideoSceneId === scene.id}
                          title={uiLanguage === "en" ? "Stop this generation. A request that already started may still complete." : "Bu üretimi durdur. Başlamış bir talep yine de tamamlanabilir."}
                          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cancellingVideoSceneId === scene.id
                            ? uiLanguage === "en" ? "Cancelling..." : "İptal ediliyor..."
                            : uiLanguage === "en" ? "Stop video · no refund" : "Videoyu durdur · iade yok"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isCreatorLabFlow) {
                            openCreatorSceneEditor(scene);
                          } else {
                            setEditingSceneId(scene.id);
                            setBranchingSceneId(null);
                          }
                        }}
                        className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                      >
                        {ui.editScene}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBranchingSceneId(scene.id);
                          setEditingSceneId(null);
                        }}
                        className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                      >
                        {ui.branchAfterScene}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (sceneImageDispatchCountdownActive) {
                            cancelPendingImageDispatch();
                          } else {
                            void redrawSceneImage(scene);
                          }
                        }}
                        disabled={
                          !sceneImageDispatchCountdownActive &&
                          (redrawLoadingId === scene.id ||
                            Boolean(imageDispatchCountdown) ||
                            Boolean(videoDispatchCountdown))
                        }
                        title={
                          sceneImageDispatchCountdownActive
                            ? uiLanguage === "en"
                              ? "Cancel before generation starts."
                              : "Üretim başlamadan iptal et."
                            : isCreatorActionBlocked("visuals") || isCreatorMediaGenerationBlocked
                              ? getCreatorMediaActionError("visuals")
                              : (uiLanguage === "en" ? "Regenerate this scene visual." : "Bu sahne görselini yeniden üret.")
                        }
                        className={`rounded-xl border px-4 py-2 text-sm disabled:opacity-50 ${
                          sceneImageDispatchCountdownActive
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : "border-orange-200/26"
                        }`}
                      >
                        {sceneImageDispatchCountdownActive
                          ? uiLanguage === "en"
                            ? `Cancel start · ${imageDispatchCountdown?.secondsRemaining}s`
                            : `Başlatmayı iptal et · ${imageDispatchCountdown?.secondsRemaining} sn`
                          : redrawLoadingId === scene.id ? ui.redrawing : ui.redraw}
                      </button>
                    </div>

                    <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{ui.scenePreviews}</p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className={`rounded-full px-2.5 py-1 ${hasImage ? "border border-green-200 bg-green-50/80 text-green-700" : "border border-orange-200/22 bg-white/62 text-slate-500"}`}>
                            {hasImage ? ui.imageReady : ui.imagePending}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 ${hasVideo ? "border border-green-200 bg-green-50/80 text-green-700" : "border border-orange-200/22 bg-white/62 text-slate-500"}`}>
                            {hasVideo ? ui.videoReady : ui.videoPending}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-sky-700">{ui.intelligencePanel}</p>
                          <span className="rounded-full border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-[11px] text-sky-800">v1</span>
                        </div>

                        {scene.intelligence ? (
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{ui.sceneType}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{formatSceneIntelligenceValue(scene.intelligence.scene_type)}</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{ui.pacingLevel}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{formatSceneIntelligenceValue(scene.intelligence.pacing_level)}</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{ui.emotionalIntensity}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{formatSceneScore(scene.intelligence.emotional_intensity)}</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{ui.curiosityScore}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{formatSceneScore(scene.intelligence.curiosity_score)}</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{ui.tensionScore}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{formatSceneScore(scene.intelligence.tension_score)}</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{ui.climaxLevel}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{formatSceneScore(scene.intelligence.climax_level)}</p>
                            </div>

                            <div className="rounded-2xl border border-emerald-500/30 bg-teal-50/80 p-3">
                              <p className="text-[9px] uppercase tracking-[0.12em] opacity-80 text-emerald-300">
                                {ui.thumbnailScore}
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {calculateThumbnailScore(scene.intelligence)}/10
                              </p>

                              {isBestThumbnailCandidate(scene, scenes) ? (
                                <div className="mt-2">
                                  <span className="inline-flex max-w-full rounded-full border border-emerald-400/30 bg-teal-50/80 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-teal-700">
                                    ⭐ {ui.bestThumbnailCandidate}
                                  </span>
                                </div>
                              ) : null}
                            </div>

                            <div className="rounded-2xl border border-sky-500/30 bg-sky-50/800/10 p-3">
                              <p className="text-[9px] uppercase tracking-[0.12em] opacity-80 text-sky-300">
                                {ui.hookScore}
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {calculateHookScore(scene.intelligence)}/10
                              </p>

                              {isBestHookCandidate(scene, scenes) ? (
                                <div className="mt-2">
                                  <span className="inline-flex max-w-full rounded-full border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-sky-200">
                                    ⚡ {ui.bestHookCandidate}
                                  </span>
                                </div>
                              ) : null}
                            </div>

                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                              <p className="text-[9px] uppercase tracking-[0.12em] opacity-80 text-amber-300">
                                {ui.retentionRisk}
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {calculateRetentionRisk(scene.intelligence).level === "low"
                                  ? ui.lowRisk
                                  : calculateRetentionRisk(scene.intelligence).level === "medium"
                                  ? ui.mediumRisk
                                  : ui.highRisk}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
                              <p className="text-[9px] uppercase tracking-[0.12em] opacity-80 text-fuchsia-300">
                                {ui.youtubeReadiness}
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {calculateYoutubeReadinessScore(scene.intelligence)}/10
                              </p>

                              <p className="mt-1 text-[11px] font-medium text-slate-700">
                                {getYoutubeReadinessLevel(calculateYoutubeReadinessScore(scene.intelligence)) === "strong"
                                  ? ui.strongReady
                                  : getYoutubeReadinessLevel(calculateYoutubeReadinessScore(scene.intelligence)) === "moderate"
                                  ? ui.moderateReady
                                  : ui.weakReady}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-violet-500/30 bg-violet-50/800/10 p-3 md:col-span-2 lg:col-span-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <p className="shrink-0 text-[9px] uppercase tracking-[0.12em] opacity-80 text-violet-300">
                                  {ui.recommendation}
                                </p>

                                <p className="text-left text-[11px] leading-snug text-violet-700/85 sm:text-right">
                                  {generateSceneRecommendation(scene.intelligence)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-orange-200/24 bg-white/62 p-4 text-sm text-slate-500">
                            {ui.noSceneIntelligence}
                          </div>
                        )}
                      </div>

                      {scene.image ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">{ui.readySceneImage}</p>
                          <img
                            src={scene.image}
                            alt={`${ui.scene} ${scene.id}`}
                            className="w-full rounded-[28px] border border-orange-200/24 bg-white/74 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-orange-200/24 bg-white/62 p-4 text-sm text-slate-500">
                          {ui.noSceneImagePreview}
                        </div>
                      )}

                      {scene.videoUrl && scene.videoStatus === "done" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">{ui.readySceneVideo}</p>
                          <video
                            src={scene.videoUrl}
                            controls
                            playsInline
                            className="w-full rounded-[28px] border border-orange-200/24 bg-white/74"
                          />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-orange-200/24 bg-white/62 p-4 text-sm text-slate-500">
                          {ui.noSceneVideoPreview}
                        </div>
                      )}
                    </div>
                  </div>


                <div className="mt-3 rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-xs text-slate-600">
                  <div className="flex flex-wrap gap-3">
                    <span>🎯 {ui.target}: {(scene.timing?.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS).toFixed(1)} {ui.secondShort}</span>
                    <span>🎤 {ui.speech}: {(scene.timing?.totalAudioDuration || 0).toFixed(1)} {ui.secondShort}</span>
                    <span>🧊 Freeze: {(scene.timing?.freezeDuration || 0).toFixed(1)} {ui.secondShort}</span>
                  </div>

                  {isSceneSpeechTooLong(scene.timing) ? (
                    <p className="mt-2 text-rose-300">{ui.speechTooLong}</p>
                  ) : (
                    <p className="mt-2 text-emerald-300">{ui.speechTimingOk}</p>
                  )}
                </div>

{editingSceneId === scene.id && (
                      isCreatorLabFlow ? (
                      <div className="mt-4 space-y-4 rounded-[28px] border border-sky-200 bg-sky-50/70 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                              {uiLanguage === "en" ? "Script & timing" : "Metin ve süre"}
                            </p>
                            <h4 className="mt-1 text-base font-semibold text-slate-950">
                              {uiLanguage === "en"
                                ? "Edit the spoken content safely"
                                : "Konuşma metnini güvenli şekilde düzenle"}
                            </h4>
                            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                              {uiLanguage === "en"
                                ? "Timing is recalculated while you type. Saving automatically adjusts the scene window and visual beats to prevent cutoffs or dead time."
                                : "Yazdıkça süre yeniden hesaplanır. Kaydetme sırasında kesilme veya boş süreyi önlemek için sahne aralığı ve görsel akış otomatik ayarlanır."}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                              sceneDraftHealth.status === "ready"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : sceneDraftHealth.status === "too_long"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {sceneDraftHealth.status === "ready"
                              ? uiLanguage === "en" ? "Timing safe" : "Süre güvenli"
                              : sceneDraftHealth.status === "too_long"
                                ? uiLanguage === "en" ? "Over target" : "Hedefi aşıyor"
                                : uiLanguage === "en" ? "Needs more substance" : "Daha zengin olmalı"}
                          </span>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {uiLanguage === "en" ? "Narration" : "Anlatım"}
                            <textarea
                              className="mt-2 min-h-40 w-full rounded-2xl border border-sky-200 bg-white p-3 text-sm leading-6 text-slate-950 placeholder:text-slate-400"
                              value={sceneScriptDraft.narration}
                              onChange={(event) =>
                                setSceneScriptDrafts((prev) => ({
                                  ...prev,
                                  [scene.id]: {
                                    narration: event.target.value,
                                    dialogue: prev[scene.id]?.dialogue ?? scene.dialogue ?? "",
                                  },
                                }))
                              }
                              placeholder={
                                uiLanguage === "en"
                                  ? "Write clear, information-rich narration for this scene."
                                  : "Bu sahne için açık ve içerik açısından zengin bir anlatım yaz."
                              }
                            />
                          </label>

                          <label className="block text-sm font-medium text-slate-700">
                            {uiLanguage === "en" ? "Dialogue · optional" : "Diyalog · opsiyonel"}
                            <textarea
                              className="mt-2 min-h-40 w-full rounded-2xl border border-sky-200 bg-white p-3 text-sm leading-6 text-slate-950 placeholder:text-slate-400"
                              value={sceneScriptDraft.dialogue}
                              onChange={(event) =>
                                setSceneScriptDrafts((prev) => ({
                                  ...prev,
                                  [scene.id]: {
                                    narration: prev[scene.id]?.narration ?? scene.narration ?? "",
                                    dialogue: event.target.value,
                                  },
                                }))
                              }
                              placeholder={
                                uiLanguage === "en"
                                  ? "Leave empty for narrator-led scenes."
                                  : "Anlatıcı odaklı sahnelerde boş bırak."
                              }
                            />
                          </label>
                        </div>

                        <div
                          className={`rounded-2xl border p-4 ${
                            sceneDraftHealth.status === "ready"
                              ? "border-emerald-200 bg-emerald-50/80"
                              : sceneDraftHealth.status === "too_long"
                                ? "border-rose-200 bg-rose-50/80"
                                : "border-amber-200 bg-amber-50/80"
                          }`}
                        >
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                {uiLanguage === "en" ? "Words" : "Kelime"}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-950">
                                {sceneDraftHealth.speechWordCount} · {sceneDraftHealth.minWords}–{sceneDraftHealth.maxWords}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                {uiLanguage === "en" ? "Estimated speech" : "Tahmini konuşma"}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-950">
                                {sceneDraftHealth.estimatedSpeechSec.toFixed(1)}s / {sceneDraftHealth.targetDurationSec.toFixed(1)}s
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                {uiLanguage === "en" ? "Visual beats" : "Görsel akış"}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-950">
                                {scene.visualBlockPlan?.length || sceneDraftHealth.visualBlockCount}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs leading-5 text-slate-700">
                            {sceneDraftHealth.status === "ready"
                              ? uiLanguage === "en"
                                ? "The script fits the planned scene and can be saved safely."
                                : "Metin planlanan sahneye uyuyor ve güvenle kaydedilebilir."
                              : sceneDraftHealth.status === "too_long"
                                ? uiLanguage === "en"
                                  ? `Speech exceeds the safe window by about ${sceneDraftOverrunSec.toFixed(1)} seconds. Auto-fit, add a visual beat, or split the scene.`
                                  : `Konuşma güvenli aralığı yaklaşık ${sceneDraftOverrunSec.toFixed(1)} saniye aşıyor. Auto-fit kullan, görsel akış ekle veya sahneyi böl.`
                                : uiLanguage === "en"
                                  ? `The scene may contain about ${sceneDraftGapSec.toFixed(1)} seconds of weak or idle time. Auto-fit can enrich the script; saving will also tighten the scene automatically.`
                                  : `Sahnede yaklaşık ${sceneDraftGapSec.toFixed(1)} saniyelik zayıf veya boş süre oluşabilir. Auto-fit metni zenginleştirir; kaydetme de sahneyi otomatik daraltır.`}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => saveCreatorSceneScript(scene.id)}
                            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
                          >
                            {uiLanguage === "en" ? "Save Script" : "Metni Kaydet"}
                          </button>

                          <button
                            type="button"
                            onClick={() => autoFitCreatorSceneScript(scene.id)}
                            disabled={sceneScriptFitLoadingId === scene.id}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                          >
                            {sceneScriptFitLoadingId === scene.id
                              ? uiLanguage === "en" ? "Fitting…" : "Uyarlanıyor…"
                              : uiLanguage === "en" ? "Auto-fit with AI" : "AI ile Auto-fit"}
                          </button>

                          <button
                            type="button"
                            onClick={() => addCreatorSceneVisualBlock(scene.id)}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            {uiLanguage === "en" ? "Add Visual Beat" : "Görsel Akış Ekle"}
                          </button>

                          <button
                            type="button"
                            onClick={() => splitCreatorScene(scene.id)}
                            disabled={sceneDraftHealth.status !== "too_long"}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {uiLanguage === "en" ? "Split Scene" : "Sahneyi Böl"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingSceneId(null);
                              setSceneInstructions((prev) => ({
                                ...prev,
                                [scene.id]: "",
                              }));
                              setSceneScriptDrafts((prev) => {
                                const next = { ...prev };
                                delete next[scene.id];
                                return next;
                              });
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                          >
                            {ui.cancel}
                          </button>
                        </div>

                        <details className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                            {uiLanguage === "en" ? "Refine the full scene with AI" : "Sahnenin tamamını AI ile geliştir"}
                          </summary>
                          <div className="mt-3 space-y-3">
                            <textarea
                              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-950 placeholder:text-slate-400"
                              value={sceneInstructions[scene.id] || ""}
                              onChange={(event) =>
                                setSceneInstructions((prev) => ({
                                  ...prev,
                                  [scene.id]: event.target.value,
                                }))
                              }
                              placeholder={ui.sceneEditPlaceholder}
                            />
                            <button
                              type="button"
                              onClick={() => updateScene(scene.id)}
                              disabled={sceneLoadingId === scene.id}
                              className="rounded-xl border border-slate-300 bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {sceneLoadingId === scene.id ? ui.updating : ui.updateScene}
                            </button>
                          </div>
                        </details>
                      </div>
                      ) : (
                      <div className="mt-4 space-y-3 rounded-2xl border border-orange-200/24 bg-white/74 p-4">
                        <label className="block text-sm text-slate-600">
                          {ui.sceneEditQuestion}
                        </label>

                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black placeholder:text-slate-500"
                          value={sceneInstructions[scene.id] || ""}
                          onChange={(e) =>
                            setSceneInstructions((prev) => ({
                              ...prev,
                              [scene.id]: e.target.value,
                            }))
                          }
                          placeholder={ui.sceneEditPlaceholder}
                        />

                        <div className="flex gap-3">
                          <button
                            onClick={() => updateScene(scene.id)}
                            disabled={sceneLoadingId === scene.id}
                            className="rounded-xl bg-white/82 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                          >
                            {sceneLoadingId === scene.id ? ui.updating : ui.updateScene}
                          </button>

                          <button
                            onClick={() => {
                              setEditingSceneId(null);
                              setSceneInstructions((prev) => ({
                                ...prev,
                                [scene.id]: "",
                              }));
                            }}
                            className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                          >
                            {ui.cancel}
                          </button>
                        </div>
                      </div>
                      )
                    )}

                    {branchingSceneId === scene.id && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                        <label className="block text-sm text-yellow-100">
                          {ui.branchQuestion}
                        </label>

                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black placeholder:text-slate-500"
                          value={branchInstructions[scene.id] || ""}
                          onChange={(e) =>
                            setBranchInstructions((prev) => ({
                              ...prev,
                              [scene.id]: e.target.value,
                            }))
                          }
                          placeholder={ui.branchPlaceholder}
                        />

                        <p className="text-xs text-slate-600">
                          {ui.branchWarning}
                        </p>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleBranchFromScene(scene.id)}
                            disabled={branchLoadingId === scene.id}
                            className="rounded-xl bg-white/82 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                          >
                            {branchLoadingId === scene.id ? ui.writingNewFlow : ui.continueFromHere}
                          </button>

                          <button
                            onClick={() => {
                              setBranchingSceneId(null);
                              setBranchInstructions((prev) => ({
                                ...prev,
                                [scene.id]: "",
                              }));
                            }}
                            className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                          >
                            {ui.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-orange-200/24 bg-white/62 p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{ui.continueFromLastScene}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {ui.continueFromLastSceneDesc}
                </p>
              </div>

              <textarea
                className="min-h-28 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-4 text-black placeholder:text-slate-500"
                value={continuePrompt}
                onChange={(e) => setContinuePrompt(e.target.value)}
                placeholder={ui.continuePromptPlaceholder}
              />

              <div>
                <button
                  onClick={handleContinueStory}
                  disabled={isContinuing}
                  className="rounded-2xl bg-white/82 px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
                >
                  {isContinuing ? ui.writingContinue : ui.writeContinue}
                </button>
              </div>
            </div>
          </div>
  );
}
