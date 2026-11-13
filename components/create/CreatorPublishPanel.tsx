"use client";

import type { CreatorFormat, CreatorProductionPackage, CreatorPublishPlatform, CreatorReleaseConfirmationKey, CreatorThumbnailFont, CreatorThumbnailStudioState, CreatorThumbnailTextAlign, CreatorThumbnailTextPosition, CreatorThumbnailVariant, ExportMovieResult, ImageDispatchCountdown, Scene, VideoDispatchCountdown } from "@/components/create/createWorkspacePanelTypes";
import type { CreatorThumbnailHistoryItem, CreatorThumbnailRefinementPreset, YoutubeMetadataResult } from "./createWorkspacePublishTypes";

/** Presentation only: state, effects, authority and persistence remain in CreateWorkspace. */
export type CreatorPublishPanelProps = {
  uiLanguage: import("@/lib/useLanguage").Language;
  creatorProductionPackage: NonNullable<CreatorProductionPackage>;
  CREATOR_FORMAT_OPTIONS: { value: CreatorFormat; label: string; guidance: string; }[];
  creatorFormat: CreatorFormat;
  getCreatorDurationLabel: () => string;
  scenes: Scene[];
  creatorProductionComplete: boolean;
  creatorPublishReadinessState: "ready" | "outdated" | "needs-attention";
  creatorPublishIsOutdated: boolean;
  creatorReleaseReady: boolean;
  creatorPublishAttentionItems: { key: string; label: string; }[];
  creatorPublishPreflight: import("@/lib/creator/publishPreflight").CreatorPublishPreflightItem[];
  creatorPublishPreflightLabels: { readonly content: "Content" | "İçerik"; readonly visuals: "Visuals" | "Görseller"; readonly voice: "Voice" | "Ses"; readonly evidence: "Evidence" | "Kanıt"; readonly rights: "Rights" | "Haklar"; readonly output: "Output" | "Çıktı"; };
  creatorPublishPreflightStatusLabels: { readonly ready: "Ready" | "Hazır"; readonly review: "Review" | "Kontrol et"; readonly action_required: "Action required" | "İşlem gerekli"; readonly blocked: "Blocked" | "Engellendi"; };
  creatorPublishAssetCount: number;
  setCreatorThumbnailChooserOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  creatorThumbnailChooserOpen: boolean;
  creatorPublishThumbnailUrl: string;
  handleSelectSceneAsYoutubeThumbnail: (scene: Scene) => void;
  handleGenerateYoutubeThumbnail: () => Promise<void>;
  youtubeThumbnailLoading: boolean;
  imageDispatchCountdown: ImageDispatchCountdown | null;
  cancelPendingImageDispatch: () => void;
  handleGeneratePremiumYoutubeThumbnail: () => Promise<void>;
  videoDispatchCountdown: VideoDispatchCountdown | null;
  creatorPublishVideoUrl: string;
  exportMovieResult: ExportMovieResult | null;
  formatDurationLabel: (seconds?: number) => string;
  formatFileSizeLabel: (sizeBytes?: number) => string;
  creatorThumbnailStudio: CreatorThumbnailStudioState;
  applyCreatorThumbnailVariant: (variant: CreatorThumbnailVariant) => void;
  setCreatorThumbnailStudio: import("react").Dispatch<import("react").SetStateAction<CreatorThumbnailStudioState>>;
  creatorPublishTitle: string;
  creatorPublishHook: string;
  creatorThumbnailHasUnsavedChanges: boolean;
  handleRevertCreatorThumbnail: () => void;
  creatorThumbnailSaving: boolean;
  handleSaveCreatorThumbnail: () => Promise<void>;
  handleRefinePremiumYoutubeThumbnail: (preset: CreatorThumbnailRefinementPreset) => Promise<void>;
  creatorThumbnailRefining: CreatorThumbnailRefinementPreset | null;
  creatorThumbnailHistory: CreatorThumbnailHistoryItem[];
  setCreatorThumbnailHistory: import("react").Dispatch<import("react").SetStateAction<CreatorThumbnailHistoryItem[]>>;
  selectCreatorThumbnailHistoryItem: (item: CreatorThumbnailHistoryItem) => void;
  youtubeMetadataResult: YoutubeMetadataResult | null;
  handleGenerateYoutubeMetadata: () => Promise<void>;
  youtubeMetadataLoading: boolean;
  copyCreatorPublishText: (label: string, value: string) => Promise<void>;
  creatorPublishDescription: string;
  creatorTargetPlatforms: ("youtube" | "youtube_shorts" | "instagram_reels" | "tiktok" | "linkedin")[];
  getCreatorPlatformCopy: (platform: CreatorPublishPlatform) => string;
  getCreatorPlatformLabel: (platform: CreatorPublishPlatform) => string;
  creatorPublishChecklistCount: number;
  creatorPublishSystemChecks: { key: string; label: string; attentionLabel: string; detail: string; ready: boolean; }[];
  creatorReleaseConfirmationItems: { key: CreatorReleaseConfirmationKey; label: string; attentionLabel: string; detail: string; }[];
  creatorReleaseConfirmations: Record<CreatorReleaseConfirmationKey, boolean>;
  toggleCreatorReleaseConfirmation: (key: CreatorReleaseConfirmationKey) => void;
  creatorPublishPackageItems: { name: string; file: string; ready: boolean; }[];
  handleDownloadCreatorPackage: () => Promise<boolean>;
  isDownloadingCreatorPackage: boolean;
  creatorPackageReady: boolean;
  creatorPublishComplete: boolean;
};

export default function CreatorPublishPanel({
  uiLanguage,
  creatorProductionPackage,
  CREATOR_FORMAT_OPTIONS,
  creatorFormat,
  getCreatorDurationLabel,
  scenes,
  creatorProductionComplete,
  creatorPublishReadinessState,
  creatorPublishIsOutdated,
  creatorReleaseReady,
  creatorPublishAttentionItems,
  creatorPublishPreflight,
  creatorPublishPreflightLabels,
  creatorPublishPreflightStatusLabels,
  creatorPublishAssetCount,
  setCreatorThumbnailChooserOpen,
  creatorThumbnailChooserOpen,
  creatorPublishThumbnailUrl,
  handleSelectSceneAsYoutubeThumbnail,
  handleGenerateYoutubeThumbnail,
  youtubeThumbnailLoading,
  imageDispatchCountdown,
  cancelPendingImageDispatch,
  handleGeneratePremiumYoutubeThumbnail,
  videoDispatchCountdown,
  creatorPublishVideoUrl,
  exportMovieResult,
  formatDurationLabel,
  formatFileSizeLabel,
  creatorThumbnailStudio,
  applyCreatorThumbnailVariant,
  setCreatorThumbnailStudio,
  creatorPublishTitle,
  creatorPublishHook,
  creatorThumbnailHasUnsavedChanges,
  handleRevertCreatorThumbnail,
  creatorThumbnailSaving,
  handleSaveCreatorThumbnail,
  handleRefinePremiumYoutubeThumbnail,
  creatorThumbnailRefining,
  creatorThumbnailHistory,
  setCreatorThumbnailHistory,
  selectCreatorThumbnailHistoryItem,
  youtubeMetadataResult,
  handleGenerateYoutubeMetadata,
  youtubeMetadataLoading,
  copyCreatorPublishText,
  creatorPublishDescription,
  creatorTargetPlatforms,
  getCreatorPlatformCopy,
  getCreatorPlatformLabel,
  creatorPublishChecklistCount,
  creatorPublishSystemChecks,
  creatorReleaseConfirmationItems,
  creatorReleaseConfirmations,
  toggleCreatorReleaseConfirmation,
  creatorPublishPackageItems,
  handleDownloadCreatorPackage,
  isDownloadingCreatorPackage,
  creatorPackageReady,
  creatorPublishComplete,
}: CreatorPublishPanelProps) {
  return (
<section id="creatorlab-publish-canvas" className="creatorlab-publish-experience">
            <div className="creatorlab-publish-heading">
              <div>
                <p className="creatorlab-publish-kicker">
                  {uiLanguage === "en" ? "Step 5 · Publish" : "Adım 5 · Yayınla"}
                </p>
                <h1>{creatorProductionPackage.title}</h1>
                <div className="creatorlab-p2d-publish-meta" aria-label={uiLanguage === "en" ? "Publish package summary" : "Yayın paketi özeti"}>
                  <span>{CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label || creatorFormat}</span>
                  <span>{getCreatorDurationLabel()}</span>
                  <span>{scenes.length} {uiLanguage === "en" ? "scenes" : "sahne"}</span>
                  <span>{creatorProductionComplete
                    ? uiLanguage === "en" ? "Final video ready" : "Final video hazır"
                    : uiLanguage === "en" ? "Final video needs attention" : "Final video kontrol edilmeli"}</span>
                </div>
              </div>
              <span className="creatorlab-publish-stage-badge" data-readiness-state={creatorPublishReadinessState}>
                {creatorPublishIsOutdated
                  ? uiLanguage === "en" ? "Package needs update" : "Paket güncellenmeli"
                  : creatorReleaseReady
                    ? uiLanguage === "en" ? "Ready to publish" : "Yayına hazır"
                    : `${creatorPublishAttentionItems.length} ${uiLanguage === "en" ? "items need attention" : "öğe kontrol edilmeli"}`}
              </span>
            </div>

            <section
              className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
              aria-label={uiLanguage === "en" ? "Publish preflight" : "Yayın ön kontrolü"}
              data-creator-publish-preflight
            >
              {creatorPublishPreflight.map((item) => (
                <div
                  key={item.category}
                  className="rounded-2xl border border-orange-200/24 bg-white/74 px-4 py-3"
                  data-preflight-category={item.category}
                  data-preflight-status={item.status}
                >
                  <strong className="block text-sm text-slate-900">
                    {creatorPublishPreflightLabels[item.category]}
                  </strong>
                  <span className="mt-1 block text-xs text-slate-600">
                    {creatorPublishPreflightStatusLabels[item.status]}
                  </span>
                </div>
              ))}
            </section>

            <section
              className="creatorlab-p2d-readiness"
              data-publish-readiness={creatorPublishReadinessState}
              aria-labelledby="creatorlab-publish-readiness-title"
            >
              <div className="creatorlab-p2d-readiness-summary">
                <span aria-hidden="true">{creatorPublishIsOutdated ? "!" : creatorReleaseReady ? "✓" : creatorPublishAttentionItems.length}</span>
                <div>
                  <small>{uiLanguage === "en" ? "Publish readiness" : "Yayın hazırlığı"}</small>
                  <h2 id="creatorlab-publish-readiness-title">
                    {creatorPublishIsOutdated
                      ? uiLanguage === "en" ? "Package needs update" : "Paket güncellenmeli"
                      : creatorReleaseReady
                        ? uiLanguage === "en" ? "Ready to publish" : "Yayına hazır"
                        : uiLanguage === "en"
                          ? `${creatorPublishAttentionItems.length} items need attention`
                          : `${creatorPublishAttentionItems.length} öğe kontrol edilmeli`}
                  </h2>
                </div>
              </div>
              {creatorPublishAttentionItems.length > 0 && (
                <ul className="creatorlab-p2d-readiness-actions">
                  {creatorPublishAttentionItems.slice(0, 4).map((item) => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              )}
            </section>

            <div className="creatorlab-p2d-package-heading">
              <div>
                <span>{uiLanguage === "en" ? "Publish Package" : "Yayın Paketi"}</span>
                <h2>{uiLanguage === "en" ? "Final assets and publishing copy" : "Final varlıklar ve yayın metinleri"}</h2>
              </div>
              <div className="creatorlab-p2d-package-heading-actions">
                <small>{creatorPublishAssetCount}/3 {uiLanguage === "en" ? "core assets ready" : "temel varlık hazır"}</small>
                <button
                  type="button"
                  className="creatorlab-publish-essential-action"
                  onClick={() => setCreatorThumbnailChooserOpen((prev) => !prev)}
                  aria-expanded={creatorThumbnailChooserOpen}
                  aria-controls="creatorlab-primary-thumbnail-chooser"
                >
                  {creatorPublishThumbnailUrl
                    ? uiLanguage === "en" ? "Change thumbnail" : "Thumbnail'ı değiştir"
                    : uiLanguage === "en" ? "Select thumbnail" : "Thumbnail seç"}
                </button>
              </div>
            </div>

            {creatorThumbnailChooserOpen && (
              <div
                className="creatorlab-primary-thumbnail-chooser"
                id="creatorlab-primary-thumbnail-chooser"
              >
                <div className="creatorlab-primary-thumbnail-heading">
                  <div>
                    <span>
                      {uiLanguage === "en" ? "Release essential" : "Yayın için zorunlu"}
                    </span>
                    <strong>
                      {uiLanguage === "en"
                        ? "Select the thumbnail source"
                        : "Thumbnail kaynak görselini seç"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreatorThumbnailChooserOpen(false)}
                    aria-label={
                      uiLanguage === "en"
                        ? "Close thumbnail selection"
                        : "Thumbnail seçimini kapat"
                    }
                  >
                    ×
                  </button>
                </div>
                <div className="creatorlab-primary-thumbnail-grid">
                  {scenes
                    .filter((scene) => scene.image)
                    .slice(0, 6)
                    .map((scene) => (
                      <button
                        key={`creatorlab-primary-thumbnail-${scene.id}`}
                        type="button"
                        className={
                          creatorPublishThumbnailUrl === scene.image ? "is-selected" : ""
                        }
                        onClick={() => {
                          handleSelectSceneAsYoutubeThumbnail(scene);
                          setCreatorThumbnailChooserOpen(false);
                        }}
                      >
                        <img
                          src={scene.image}
                          alt={`${uiLanguage === "en" ? "Scene" : "Sahne"} ${scene.id}`}
                        />
                        <span>
                          {uiLanguage === "en"
                            ? `Scene ${scene.id}`
                            : `Sahne ${scene.id}`}
                        </span>
                      </button>
                    ))}
                </div>
                <div className="creatorlab-primary-thumbnail-footer">
                  <span>
                    {uiLanguage === "en"
                      ? "Selection is primary. Detailed styling stays collapsed below."
                      : "Seçim primary alandadır. Detaylı tasarım aşağıda kapalı kalır."}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateYoutubeThumbnail}
                    disabled={
                      youtubeThumbnailLoading || !scenes.some((scene) => scene.image)
                    }
                  >
                    {youtubeThumbnailLoading
                      ? uiLanguage === "en" ? "Selecting…" : "Seçiliyor…"
                      : uiLanguage === "en"
                        ? "Let AI select the best scene"
                        : "En iyi sahneyi AI seçsin"}
                  </button>
                  <button
                    type="button"
                    onClick={
                      imageDispatchCountdown?.scope === "thumbnail"
                        ? cancelPendingImageDispatch
                        : handleGeneratePremiumYoutubeThumbnail
                    }
                    disabled={
                      imageDispatchCountdown?.scope !== "thumbnail" &&
                      (youtubeThumbnailLoading ||
                        !creatorProductionPackage ||
                        Boolean(imageDispatchCountdown) ||
                        Boolean(videoDispatchCountdown))
                    }
                    title={
                      imageDispatchCountdown?.scope === "thumbnail"
                        ? uiLanguage === "en"
                          ? "Cancel before generation starts."
                          : "Üretim başlamadan iptal et."
                        : uiLanguage === "en"
                          ? "Generates an image using the selected quality tier"
                          : "Seçili kalite seviyesini kullanarak görsel üretir"
                    }
                  >
                    {imageDispatchCountdown?.scope === "thumbnail"
                      ? uiLanguage === "en"
                        ? `Cancel AI thumbnail · ${imageDispatchCountdown.secondsRemaining}s`
                        : `AI thumbnail'ı iptal et · ${imageDispatchCountdown.secondsRemaining} sn`
                      : youtubeThumbnailLoading
                        ? uiLanguage === "en" ? "Generating…" : "Üretiliyor…"
                        : uiLanguage === "en"
                          ? "Generate new AI thumbnail"
                          : "Yeni AI thumbnail üret"}
                  </button>
                </div>
              </div>
            )}

            <div className="creatorlab-publish-media-grid">
              <article id="creatorlab-publish-video" className="creatorlab-publish-video-card">
                <div className="creatorlab-publish-card-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Final video" : "Final video"}</span>
                    <strong>{creatorProductionPackage.title}</strong>
                  </div>
                  <small>{creatorPublishVideoUrl ? uiLanguage === "en" ? "Ready" : "Hazır" : uiLanguage === "en" ? "Pending" : "Bekliyor"}</small>
                </div>
                <div className="creatorlab-publish-video-frame">
                  {creatorPublishVideoUrl ? (
                    <video controls preload="metadata" src={creatorPublishVideoUrl} />
                  ) : (
                    <div className="creatorlab-publish-video-empty">
                      {uiLanguage === "en" ? "The final video will appear here after export." : "Final video export sonrasında burada görünecek."}
                    </div>
                  )}
                </div>
                <div className="creatorlab-publish-video-meta">
                  <span>
                    {exportMovieResult?.durationSeconds
                      ? `${formatDurationLabel(exportMovieResult.durationSeconds)} · ${formatFileSizeLabel(exportMovieResult.sizeBytes)}`
                      : `${getCreatorDurationLabel()} · ${scenes.length} ${uiLanguage === "en" ? "scenes" : "sahne"}`}
                  </span>
                  {creatorPublishVideoUrl && (
                    <a href={creatorPublishVideoUrl} target="_blank" rel="noreferrer">
                      {uiLanguage === "en" ? "Open video" : "Videoyu aç"}
                    </a>
                  )}
                </div>
              </article>

              <details
                id="creatorlab-publish-thumbnail"
                className="creatorlab-publish-thumbnail-card creatorlabs-thumbnail-studio creatorlab-thumbnail-studio-details"
              >
                <summary className="creatorlab-publish-card-heading creatorlab-thumbnail-studio-summary">
                  <div className="creatorlab-p2d-thumbnail-summary-preview">
                    {creatorPublishThumbnailUrl ? (
                      <img src={creatorPublishThumbnailUrl} alt="" />
                    ) : (
                      <span aria-hidden="true">+</span>
                    )}
                  </div>
                  <div className="creatorlab-p2d-thumbnail-summary-copy">
                    <span>Thumbnail</span>
                    <strong>
                      {creatorPublishThumbnailUrl
                        ? uiLanguage === "en" ? "Ready for publishing" : "Yayın için hazır"
                        : uiLanguage === "en" ? "Thumbnail required" : "Thumbnail gerekli"}
                    </strong>
                    <small>
                      {creatorPublishThumbnailUrl
                        ? uiLanguage === "en" ? "Current saved design" : "Mevcut kayıtlı tasarım"
                        : uiLanguage === "en" ? "Select a source image above" : "Yukarıdan bir kaynak görsel seç"}
                    </small>
                  </div>
                  <span className="creatorlab-p2d-thumbnail-edit-action">
                    {uiLanguage === "en" ? "Edit thumbnail" : "Thumbnail'ı düzenle"}
                  </span>
                </summary>

                <div
                  className={`creatorlab-thumbnail-studio-preview ${creatorFormat === "youtube_video" ? "is-wide" : "is-vertical"} is-${creatorThumbnailStudio.textPosition} font-${creatorThumbnailStudio.font}`}
                  style={{ "--thumbnail-headline-scale": creatorThumbnailStudio.headlineScale / 100 } as React.CSSProperties}
                >
                  {creatorPublishThumbnailUrl ? (
                    <>
                      <img
                        src={creatorPublishThumbnailUrl}
                        alt={uiLanguage === "en" ? "Thumbnail source preview" : "Thumbnail kaynak önizlemesi"}
                        style={{ objectPosition: `${creatorThumbnailStudio.focalX}% ${creatorThumbnailStudio.focalY}%` }}
                      />
                      <div className="creatorlab-thumbnail-studio-shade" />
                      <div
                        className="creatorlab-thumbnail-studio-accent"
                        style={{ backgroundColor: creatorThumbnailStudio.accentColor }}
                      />
                      <div
                        className="creatorlab-thumbnail-studio-copy"
                        style={{
                          textAlign: creatorThumbnailStudio.textAlign,
                          textShadow: creatorThumbnailStudio.textShadow ? "0 3px 18px rgba(0, 0, 0, 0.72)" : "none",
                          WebkitTextStroke: creatorThumbnailStudio.textStroke ? "1.5px rgba(0,0,0,.9)" : "0 transparent",
                        } as React.CSSProperties}
                      >
                        {creatorThumbnailStudio.showHeadline && creatorThumbnailStudio.headline.trim() && (
                          <strong
                            style={{
                              color: creatorThumbnailStudio.headlineColor,
                              WebkitTextFillColor: creatorThumbnailStudio.headlineColor,
                            }}
                          >
                            {creatorThumbnailStudio.headline}
                          </strong>
                        )}
                        {creatorThumbnailStudio.showSubHeadline && creatorThumbnailStudio.subHeadline.trim() && (
                          <span
                            style={{
                              color: creatorThumbnailStudio.subHeadlineColor,
                              WebkitTextFillColor: creatorThumbnailStudio.subHeadlineColor,
                            }}
                          >
                            {creatorThumbnailStudio.subHeadline}
                          </span>
                        )}
                      </div>
                      {creatorThumbnailStudio.safeZone && <div className="creatorlab-thumbnail-safe-zone" aria-hidden="true" />}
                    </>
                  ) : (
                    <span>{uiLanguage === "en" ? "Select a scene image to start designing." : "Tasarıma başlamak için bir sahne görseli seç."}</span>
                  )}
                </div>

                <div className="creatorlab-thumbnail-variant-row" aria-label={uiLanguage === "en" ? "Thumbnail direction" : "Thumbnail yönü"}>
                  {([
                    ["subject", uiLanguage === "en" ? "Subject-led" : "Konu odaklı"],
                    ["conflict", uiLanguage === "en" ? "Conflict-led" : "Çatışma odaklı"],
                    ["symbol", uiLanguage === "en" ? "Symbol-led" : "Sembol odaklı"],
                  ] as Array<[CreatorThumbnailVariant, string]>).map(([variant, label]) => (
                    <button
                      key={variant}
                      type="button"
                      className={creatorThumbnailStudio.variant === variant ? "is-selected" : ""}
                      onClick={() => applyCreatorThumbnailVariant(variant)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="creatorlab-thumbnail-studio-controls">
                  <label>
                    <span className="flex items-center justify-between gap-3">
                      <span>{uiLanguage === "en" ? "Headline" : "Başlık"}</span>
                      <span className="creatorlab-thumbnail-safe-toggle">
                        <input
                          type="checkbox"
                          checked={creatorThumbnailStudio.showHeadline}
                          onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, showHeadline: event.target.checked }))}
                        />
                        <span>{uiLanguage === "en" ? "Show" : "Göster"}</span>
                      </span>
                    </span>
                    <input
                      value={creatorThumbnailStudio.headline}
                      maxLength={80}
                      disabled={!creatorThumbnailStudio.showHeadline}
                      onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, headline: event.target.value }))}
                      placeholder={creatorPublishTitle}
                    />
                  </label>
                  <label>
                    <span className="flex items-center justify-between gap-3">
                      <span>{uiLanguage === "en" ? "Sub-headline" : "Alt başlık"}</span>
                      <span className="creatorlab-thumbnail-safe-toggle">
                        <input
                          type="checkbox"
                          checked={creatorThumbnailStudio.showSubHeadline}
                          onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, showSubHeadline: event.target.checked }))}
                        />
                        <span>{uiLanguage === "en" ? "Show" : "Göster"}</span>
                      </span>
                    </span>
                    <input
                      value={creatorThumbnailStudio.subHeadline}
                      maxLength={110}
                      disabled={!creatorThumbnailStudio.showSubHeadline}
                      onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, subHeadline: event.target.value }))}
                      placeholder={creatorPublishHook}
                    />
                  </label>
                  <div className="creatorlab-thumbnail-focal-controls">
                    <label>
                      <span>
                        {uiLanguage === "en" ? "Headline size" : "Başlık boyutu"} · {creatorThumbnailStudio.headlineScale}%
                      </span>
                      <input
                        type="range"
                        min="55"
                        max="125"
                        step="5"
                        value={creatorThumbnailStudio.headlineScale}
                        disabled={!creatorThumbnailStudio.showHeadline}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, headlineScale: Number(event.target.value) }))}
                      />
                    </label>
                  </div>
                  <div className="creatorlab-thumbnail-control-grid">
                    <label>
                      <span>{uiLanguage === "en" ? "Font" : "Yazı tipi"}</span>
                      <select
                        value={creatorThumbnailStudio.font}
                        disabled={!creatorThumbnailStudio.showHeadline}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, font: event.target.value as CreatorThumbnailFont }))}
                      >
                        <option value="bold_sans">Bold Sans</option>
                        <option value="editorial">Editorial</option>
                        <option value="condensed">Condensed</option>
                      </select>
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Text position" : "Metin konumu"}</span>
                      <select
                        value={creatorThumbnailStudio.textPosition}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, textPosition: event.target.value as CreatorThumbnailTextPosition }))}
                      >
                        <option value="top">{uiLanguage === "en" ? "Top" : "Üst"}</option>
                        <option value="center">{uiLanguage === "en" ? "Center" : "Orta"}</option>
                        <option value="bottom">{uiLanguage === "en" ? "Bottom" : "Alt"}</option>
                      </select>
                    </label>
                    <label className="creatorlab-thumbnail-color-control">
                      <span>{uiLanguage === "en" ? "Accent" : "Vurgu"}</span>
                      <input
                        type="color"
                        value={creatorThumbnailStudio.accentColor}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, accentColor: event.target.value }))}
                      />
                    </label>
                    <label className="creatorlab-thumbnail-color-control">
                      <span>{uiLanguage === "en" ? "Headline color" : "Başlık rengi"}</span>
                      <input
                        type="color"
                        value={creatorThumbnailStudio.headlineColor}
                        disabled={!creatorThumbnailStudio.showHeadline}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, headlineColor: event.target.value }))}
                      />
                    </label>
                    <label className="creatorlab-thumbnail-color-control">
                      <span>{uiLanguage === "en" ? "Sub-headline color" : "Alt başlık rengi"}</span>
                      <input
                        type="color"
                        value={creatorThumbnailStudio.subHeadlineColor}
                        disabled={!creatorThumbnailStudio.showSubHeadline}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, subHeadlineColor: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="creatorlab-thumbnail-typography-panel">
                    <div>
                      <span className="creatorlab-thumbnail-control-label">{uiLanguage === "en" ? "Headline color presets" : "Başlık hazır renkleri"}</span>
                      <div className="creatorlab-thumbnail-color-palette">
                        {["#ffffff", "#f8e71c", "#ff6b35", "#ff3b30", "#35c759", "#32ade6", "#5856d6", "#111827"].map((color) => (
                          <button
                            key={`headline-${color}`}
                            type="button"
                            disabled={!creatorThumbnailStudio.showHeadline}
                            className={creatorThumbnailStudio.headlineColor.toLowerCase() === color ? "is-selected" : ""}
                            style={{ backgroundColor: color }}
                            aria-label={`${uiLanguage === "en" ? "Use headline color" : "Başlık rengini kullan"} ${color}`}
                            onClick={() => setCreatorThumbnailStudio((prev) => ({ ...prev, headlineColor: color }))}
                          />
                        ))}
                      </div>
                    </div>
                    <label>
                      <span>{uiLanguage === "en" ? "Headline HEX" : "Başlık HEX"}</span>
                      <input
                        value={creatorThumbnailStudio.headlineColor}
                        maxLength={7}
                        disabled={!creatorThumbnailStudio.showHeadline}
                        onChange={(event) => {
                          const value = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
                            setCreatorThumbnailStudio((prev) => ({ ...prev, headlineColor: value }));
                          }
                        }}
                        onBlur={() => {
                          if (!/^#[0-9a-fA-F]{6}$/.test(creatorThumbnailStudio.headlineColor)) {
                            setCreatorThumbnailStudio((prev) => ({ ...prev, headlineColor: "#ffffff" }));
                          }
                        }}
                        placeholder="#ffffff"
                      />
                    </label>
                    <div>
                      <span className="creatorlab-thumbnail-control-label">{uiLanguage === "en" ? "Sub-headline color presets" : "Alt başlık hazır renkleri"}</span>
                      <div className="creatorlab-thumbnail-color-palette">
                        {["#ffffff", "#f8e71c", "#ff6b35", "#ff3b30", "#35c759", "#32ade6", "#5856d6", "#111827"].map((color) => (
                          <button
                            key={`subheadline-${color}`}
                            type="button"
                            disabled={!creatorThumbnailStudio.showSubHeadline}
                            className={creatorThumbnailStudio.subHeadlineColor.toLowerCase() === color ? "is-selected" : ""}
                            style={{ backgroundColor: color }}
                            aria-label={`${uiLanguage === "en" ? "Use sub-headline color" : "Alt başlık rengini kullan"} ${color}`}
                            onClick={() => setCreatorThumbnailStudio((prev) => ({ ...prev, subHeadlineColor: color }))}
                          />
                        ))}
                      </div>
                    </div>
                    <label>
                      <span>{uiLanguage === "en" ? "Sub-headline HEX" : "Alt başlık HEX"}</span>
                      <input
                        value={creatorThumbnailStudio.subHeadlineColor}
                        maxLength={7}
                        disabled={!creatorThumbnailStudio.showSubHeadline}
                        onChange={(event) => {
                          const value = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
                            setCreatorThumbnailStudio((prev) => ({ ...prev, subHeadlineColor: value }));
                          }
                        }}
                        onBlur={() => {
                          if (!/^#[0-9a-fA-F]{6}$/.test(creatorThumbnailStudio.subHeadlineColor)) {
                            setCreatorThumbnailStudio((prev) => ({ ...prev, subHeadlineColor: "#ffffff" }));
                          }
                        }}
                        placeholder="#ffffff"
                      />
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Alignment" : "Hizalama"}</span>
                      <select
                        value={creatorThumbnailStudio.textAlign}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, textAlign: event.target.value as CreatorThumbnailTextAlign }))}
                      >
                        <option value="left">{uiLanguage === "en" ? "Left" : "Sol"}</option>
                        <option value="center">{uiLanguage === "en" ? "Center" : "Orta"}</option>
                        <option value="right">{uiLanguage === "en" ? "Right" : "Sağ"}</option>
                      </select>
                    </label>
                    <div className="creatorlab-thumbnail-effect-toggles">
                      <label className="creatorlab-thumbnail-safe-toggle">
                        <input
                          type="checkbox"
                          checked={creatorThumbnailStudio.textStroke}
                          onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, textStroke: event.target.checked }))}
                        />
                        <span>{uiLanguage === "en" ? "Text outline" : "Yazı konturu"}</span>
                      </label>
                      <label className="creatorlab-thumbnail-safe-toggle">
                        <input
                          type="checkbox"
                          checked={creatorThumbnailStudio.textShadow}
                          onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, textShadow: event.target.checked }))}
                        />
                        <span>{uiLanguage === "en" ? "Text shadow" : "Yazı gölgesi"}</span>
                      </label>
                    </div>
                  </div>
                  <div className="creatorlab-thumbnail-focal-controls">
                    <label>
                      <span>{uiLanguage === "en" ? "Horizontal focus" : "Yatay odak"} · {creatorThumbnailStudio.focalX}%</span>
                      <input
                        type="range" min="0" max="100" value={creatorThumbnailStudio.focalX}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, focalX: Number(event.target.value) }))}
                      />
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Vertical focus" : "Dikey odak"} · {creatorThumbnailStudio.focalY}%</span>
                      <input
                        type="range" min="0" max="100" value={creatorThumbnailStudio.focalY}
                        onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, focalY: Number(event.target.value) }))}
                      />
                    </label>
                  </div>
                  <label className="creatorlab-thumbnail-safe-toggle">
                    <input
                      type="checkbox"
                      checked={creatorThumbnailStudio.safeZone}
                      onChange={(event) => setCreatorThumbnailStudio((prev) => ({ ...prev, safeZone: event.target.checked }))}
                    />
                    <span>{uiLanguage === "en" ? "Show platform safe zone" : "Platform güvenli alanını göster"}</span>
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <strong className="block text-sm text-slate-950">
                      {creatorThumbnailHasUnsavedChanges
                        ? uiLanguage === "en" ? "Unsaved thumbnail edits" : "Kaydedilmemiş thumbnail düzenlemeleri"
                        : uiLanguage === "en" ? "Thumbnail saved" : "Thumbnail kaydedildi"}
                    </strong>
                    <span className="text-xs text-slate-500">
                      {uiLanguage === "en" ? "Saving does not start generation." : "Kaydetme işlemi üretimi başlatmaz."}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="creatorlab-publish-secondary-button"
                      onClick={handleRevertCreatorThumbnail}
                      disabled={!creatorThumbnailHasUnsavedChanges || creatorThumbnailSaving}
                    >
                      {uiLanguage === "en" ? "Revert" : "Geri al"}
                    </button>
                    <button
                      type="button"
                      className="creatorlab-publish-secondary-button px-5 py-3 font-bold"
                      style={{ minWidth: "190px", borderRadius: "12px" }}
                      onClick={handleSaveCreatorThumbnail}
                      disabled={!creatorPublishThumbnailUrl || !creatorThumbnailHasUnsavedChanges || creatorThumbnailSaving}
                    >
                      {creatorThumbnailSaving
                        ? uiLanguage === "en" ? "Saving..." : "Kaydediliyor..."
                        : uiLanguage === "en" ? "Save thumbnail" : "Thumbnail'ı kaydet"}
                    </button>
                  </div>
                </div>

                {imageDispatchCountdown?.scope === "thumbnail" && (
                  <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900" aria-live="assertive">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <strong className="text-sm">
                          {uiLanguage === "en"
                            ? `AI thumbnail generation starts in ${imageDispatchCountdown.secondsRemaining} seconds`
                            : `AI thumbnail gönderimi ${imageDispatchCountdown.secondsRemaining} saniye içinde başlayacak`}
                        </strong>
                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          {uiLanguage === "en"
                            ? "Generation starts when the countdown reaches zero."
                            : "Sayaç sıfıra ulaştığında üretim başlar."}
                        </p>
                      </div>
                      <button type="button" onClick={cancelPendingImageDispatch} className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700">
                        {uiLanguage === "en" ? "Cancel start" : "Başlatmayı iptal et"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="creatorlab-publish-thumbnail-actions">
                  <button
                    type="button"
                    className="creatorlab-publish-secondary-button"
                    onClick={handleGenerateYoutubeThumbnail}
                    disabled={youtubeThumbnailLoading || !scenes.some((scene) => scene.image)}
                  >
                    {youtubeThumbnailLoading
                      ? uiLanguage === "en" ? "Selecting..." : "Seçiliyor..."
                      : creatorPublishThumbnailUrl
                        ? uiLanguage === "en" ? "Select best scene again" : "En iyi sahneyi yeniden seç"
                        : uiLanguage === "en" ? "Select best scene" : "En iyi sahneyi seç"}
                  </button>
                  <button
                    type="button"
                    className="creatorlab-publish-secondary-button"
                    onClick={
                      imageDispatchCountdown?.scope === "thumbnail"
                        ? cancelPendingImageDispatch
                        : handleGeneratePremiumYoutubeThumbnail
                    }
                    disabled={
                      imageDispatchCountdown?.scope !== "thumbnail" &&
                      (youtubeThumbnailLoading ||
                        !creatorProductionPackage ||
                        Boolean(imageDispatchCountdown) ||
                        Boolean(videoDispatchCountdown))
                    }
                  >
                    {imageDispatchCountdown?.scope === "thumbnail"
                      ? uiLanguage === "en"
                        ? `Cancel AI thumbnail · ${imageDispatchCountdown.secondsRemaining}s`
                        : `AI thumbnail'ı iptal et · ${imageDispatchCountdown.secondsRemaining} sn`
                      : youtubeThumbnailLoading
                        ? uiLanguage === "en" ? "Generating..." : "Üretiliyor..."
                        : uiLanguage === "en"
                          ? "Generate new AI thumbnail"
                          : "Yeni AI thumbnail üret"}
                  </button>
                </div>

                {creatorPublishThumbnailUrl && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <strong className="text-sm text-slate-950">{uiLanguage === "en" ? "AI quick refinements" : "AI hızlı iyileştirmeler"}</strong>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{uiLanguage === "en" ? "Each refinement generates a new image variation." : "Her iyileştirme yeni bir görsel varyasyonu üretir."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {([
                        ["focus", uiLanguage === "en" ? "Strengthen focus" : "Odağı güçlendir"],
                        ["contrast", uiLanguage === "en" ? "More contrast" : "Kontrastı artır"],
                        ["title_space", uiLanguage === "en" ? "Create title space" : "Başlık alanı aç"],
                        ["cinematic", uiLanguage === "en" ? "More cinematic" : "Daha sinematik"],
                        ["simplify_background", uiLanguage === "en" ? "Simplify background" : "Arka planı sadeleştir"],
                      ] as Array<[CreatorThumbnailRefinementPreset, string]>).map(([preset, label]) => (
                        <button key={preset} type="button" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => handleRefinePremiumYoutubeThumbnail(preset)} disabled={youtubeThumbnailLoading || Boolean(imageDispatchCountdown) || Boolean(videoDispatchCountdown)}>
                          {creatorThumbnailRefining === preset ? (uiLanguage === "en" ? "Generating..." : "Üretiliyor...") : label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {creatorThumbnailHistory.length > 0 && (
                  <div className="mt-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <strong className="block text-sm text-slate-950">{uiLanguage === "en" ? "Thumbnail history" : "Thumbnail geçmişi"}</strong>
                        <span className="text-xs text-slate-500">{uiLanguage === "en" ? "Restore any of the last 10 AI variations without generating again." : "Son 10 AI varyasyonundan birini yeniden üretmeden geri yükle."}</span>
                      </div>
                      <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-950" onClick={() => setCreatorThumbnailHistory([])}>{uiLanguage === "en" ? "Clear" : "Temizle"}</button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {creatorThumbnailHistory.map((item) => (
                        <button key={item.id} type="button" className={`overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-sm ${creatorPublishThumbnailUrl === item.result.imageUrl ? "border-slate-950 ring-1 ring-slate-950" : "border-slate-200"}`} onClick={() => selectCreatorThumbnailHistoryItem(item)}>
                          <img src={item.result.imageUrl} alt={item.label} className="aspect-video w-full object-cover" />
                          <span className="block truncate px-2 py-2 text-[10px] font-semibold text-slate-600">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </details>
            </div>

            <div className="creatorlab-publish-content-grid">
              <article id="creatorlab-publish-metadata" className="creatorlab-publish-metadata-card">
                <div className="creatorlab-publish-card-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Publishing copy" : "Yayın metinleri"}</span>
                    <strong>{uiLanguage === "en" ? "Title, hook and description" : "Başlık, hook ve açıklama"}</strong>
                  </div>
                  {!youtubeMetadataResult && (
                    <button
                      type="button"
                      className="creatorlab-publish-secondary-button"
                      onClick={handleGenerateYoutubeMetadata}
                      disabled={youtubeMetadataLoading}
                    >
                      {youtubeMetadataLoading
                        ? uiLanguage === "en" ? "Preparing..." : "Hazırlanıyor..."
                        : uiLanguage === "en" ? "Prepare metadata" : "Metadata hazırla"}
                    </button>
                  )}
                </div>
                <div className="creatorlab-publish-metadata-body">
                  <div className="creatorlab-publish-metadata-section">
                    <div className="creatorlab-publish-copy-row">
                      <span>{uiLanguage === "en" ? "Recommended title" : "Önerilen başlık"}</span>
                      <button
                        type="button"
                        className="creatorlab-publish-copy-button"
                        onClick={() => copyCreatorPublishText(uiLanguage === "en" ? "Title" : "Başlık", creatorPublishTitle)}
                      >
                        {uiLanguage === "en" ? "Copy" : "Kopyala"}
                      </button>
                    </div>
                    <strong>{creatorPublishTitle || (uiLanguage === "en" ? "Title not prepared yet" : "Başlık henüz hazırlanmadı")}</strong>
                  </div>
                  <div className="creatorlab-publish-metadata-section">
                    <div className="creatorlab-publish-copy-row">
                      <span>Hook</span>
                      <button
                        type="button"
                        className="creatorlab-publish-copy-button"
                        onClick={() => copyCreatorPublishText("Hook", creatorPublishHook)}
                      >
                        {uiLanguage === "en" ? "Copy" : "Kopyala"}
                      </button>
                    </div>
                    <p>{creatorPublishHook || (uiLanguage === "en" ? "The production hook will be included in the package." : "Üretim hook'u pakete dahil edilecek.")}</p>
                  </div>
                  <div className="creatorlab-publish-metadata-section">
                    <div className="creatorlab-publish-copy-row">
                      <span>{uiLanguage === "en" ? "Description" : "Açıklama"}</span>
                      <button
                        type="button"
                        className="creatorlab-publish-copy-button"
                        onClick={() => copyCreatorPublishText(uiLanguage === "en" ? "Description" : "Açıklama", creatorPublishDescription)}
                      >
                        {uiLanguage === "en" ? "Copy" : "Kopyala"}
                      </button>
                    </div>
                    <p>{creatorPublishDescription || (uiLanguage === "en" ? "Prepare metadata to generate a platform-ready description." : "Platforma hazır açıklama için metadata hazırla.")}</p>
                  </div>
                  {(youtubeMetadataResult?.hashtags?.length ?? 0) > 0 && (
                    <div className="creatorlab-publish-metadata-section">
                      <div className="creatorlab-publish-copy-row">
                        <span>Hashtags</span>
                        <button
                          type="button"
                          className="creatorlab-publish-copy-button"
                          onClick={() => copyCreatorPublishText("Hashtags", (youtubeMetadataResult?.hashtags ?? []).join(" "))}
                        >
                          {uiLanguage === "en" ? "Copy" : "Kopyala"}
                        </button>
                      </div>
                      <p>{(youtubeMetadataResult?.hashtags ?? []).join(" ")}</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="creatorlab-publish-platform-card">
                <div className="creatorlab-publish-card-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Selected channels" : "Seçili kanallar"}</span>
                    <strong>{uiLanguage === "en" ? "Channel-specific publishing copy" : "Kanala özel yayın metinleri"}</strong>
                  </div>
                  <small>{creatorTargetPlatforms.length} {uiLanguage === "en" ? "targets" : "hedef"}</small>
                </div>
                <div className="creatorlab-publish-platform-list">
                  {creatorTargetPlatforms.map((platform) => {
                    const platformCopy = getCreatorPlatformCopy(platform);
                    const platformLabel = getCreatorPlatformLabel(platform);
                    return (
                      <div key={platform} className="creatorlab-publish-platform-item">
                        <div className="creatorlab-publish-platform-heading">
                          <span>{platformLabel}</span>
                          <button
                            type="button"
                            className="creatorlab-publish-copy-button"
                            onClick={() => copyCreatorPublishText(platformLabel, platformCopy)}
                          >
                            {uiLanguage === "en" ? "Copy" : "Kopyala"}
                          </button>
                        </div>
                        <p>
                          {platformCopy ||
                            (uiLanguage === "en"
                              ? "Prepare metadata to create the selected channel copy."
                              : "Seçili kanal metnini oluşturmak için metadata hazırla.")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>

            <article id="creatorlab-publish-checklist" className="creatorlab-publish-checklist-card">
              <div className="creatorlab-publish-card-heading">
                <div>
                  <span>{uiLanguage === "en" ? "Release validation" : "Yayın doğrulaması"}</span>
                  <strong>{uiLanguage === "en" ? "System checks + creator approval" : "Sistem kontrolleri + creator onayı"}</strong>
                </div>
                <small>
                  {creatorPublishChecklistCount}/{creatorPublishSystemChecks.length + creatorReleaseConfirmationItems.length}
                </small>
              </div>
              <div className="creatorlab-release-validation-grid">
                <section>
                  <div className="creatorlab-release-validation-heading">
                    <strong>{uiLanguage === "en" ? "System checks" : "Sistem kontrolleri"}</strong>
                    <span>{creatorPublishSystemChecks.filter((item) => item.ready).length}/{creatorPublishSystemChecks.length}</span>
                  </div>
                  <div className="creatorlab-publish-checklist">
                    {creatorPublishSystemChecks.map((item) => (
                      <div key={item.key} className={`creatorlab-publish-check ${item.ready ? "is-ready" : "is-pending"}`}>
                        <span>{item.ready ? "✓" : "!"}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="creatorlab-release-validation-heading">
                    <strong>{uiLanguage === "en" ? "Creator confirmations" : "Creator onayları"}</strong>
                    <span>{creatorReleaseConfirmationItems.filter((item) => creatorReleaseConfirmations[item.key]).length}/{creatorReleaseConfirmationItems.length}</span>
                  </div>
                  <div className="creatorlab-release-confirmations">
                    {creatorReleaseConfirmationItems.map((item) => (
                      <label key={item.key} className={creatorReleaseConfirmations[item.key] ? "is-confirmed" : ""}>
                        <input
                          type="checkbox"
                          checked={creatorReleaseConfirmations[item.key]}
                          onChange={() => toggleCreatorReleaseConfirmation(item.key)}
                        />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </article>

            {/* REPORT-P1R CENTRAL REPORTING CENTER
                Project reporting is intentionally available from /reports,
                independent from the active production workspace. */}

            <article className="creatorlab-publish-package-card">
              <div className="creatorlab-publish-card-heading">
                <div>
                  <span>{uiLanguage === "en" ? "Creator Package contents" : "Creator Paketi içeriği"}</span>
                  <strong>{uiLanguage === "en" ? "Files prepared for publishing and reuse" : "Yayın ve yeniden kullanım için hazırlanan dosyalar"}</strong>
                </div>
                <small>{creatorPublishPackageItems.filter((item) => item.ready).length}/{creatorPublishPackageItems.length} {uiLanguage === "en" ? "ready" : "hazır"}</small>
              </div>
              <div className="creatorlab-publish-package-grid">
                {creatorPublishPackageItems.map((item) => (
                  <div
                    key={`creatorlab-package-${item.file}`}
                    className={`creatorlab-publish-package-item ${item.ready ? "is-ready" : ""}`}
                  >
                    <span>{item.ready ? uiLanguage === "en" ? "Included" : "Dahil" : uiLanguage === "en" ? "Prepared during export" : "Dışa aktarımda hazırlanır"}</span>
                    <strong>{item.name}</strong>
                    <small>{item.file}</small>
                  </div>
                ))}
              </div>
            </article>

            <div id="creatorlab-publish-action" className="creatorlab-publish-action-bar">
              <div className="creatorlab-publish-action-copy">
                <strong>
                  {creatorPublishIsOutdated
                    ? uiLanguage === "en" ? "Package needs update" : "Paket güncellenmeli"
                    : creatorReleaseReady
                      ? uiLanguage === "en" ? "Ready to export" : "Dışa aktarıma hazır"
                      : uiLanguage === "en"
                        ? `${creatorPublishAttentionItems.length} items need attention`
                        : `${creatorPublishAttentionItems.length} öğe kontrol edilmeli`}
                </strong>
                <p>
                  {youtubeMetadataResult
                    ? uiLanguage === "en"
                      ? "The ZIP includes the final video file, thumbnail, SRT/VTT captions, publishing copy, checklist and editable project data."
                      : "ZIP; final video dosyası, thumbnail, SRT/VTT altyazılar, yayın metinleri, checklist ve düzenlenebilir proje verilerini içerir."
                    : uiLanguage === "en"
                      ? "Prepare the publishing copy, complete the system checks and confirm the release before export."
                      : "Dışa aktarımdan önce yayın metinlerini hazırla, sistem kontrollerini tamamla ve yayını onayla."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCreatorPackage}
                disabled={isDownloadingCreatorPackage || !creatorPackageReady}
                title={!creatorPackageReady ? (uiLanguage === "en" ? "Complete all system checks and creator confirmations." : "Tüm sistem kontrollerini ve creator onaylarını tamamla.") : undefined}
                className="creatorlab-publish-primary-action"
              >
                {isDownloadingCreatorPackage
                  ? uiLanguage === "en" ? "Preparing package..." : "Paket hazırlanıyor..."
                  : creatorPublishIsOutdated
                    ? uiLanguage === "en" ? "Refresh Creator Package" : "Creator Paketini Güncelle"
                    : creatorPublishComplete
                      ? uiLanguage === "en" ? "Download Creator Package Again" : "Creator Paketini Yeniden İndir"
                    : uiLanguage === "en" ? "Approve & Export Creator Package" : "Onayla ve Creator Paketini Dışa Aktar"}
              </button>
            </div>
          </section>
  );
}
