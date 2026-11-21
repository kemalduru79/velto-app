"use client";

import CreatorOutcomeStart from "@/components/create/CreatorOutcomeStart";
import type { ContentLanguage, CreatorContentType, CreatorDurationPreset, CreatorFormat, CreatorPublishPlatform } from "@/components/create/createWorkspacePanelTypes";
import type { CreatorAgeGroup, CreatorWorkspaceIconName } from "@/components/create/createWorkspaceStrategyTypes";
import { CREATOR_PLATFORM_IDS, CREATOR_PLATFORM_PRESETS, type CreatorPlatformOutputPlan } from "@/lib/creator/platformPresets";
import { CREATOR_QUALITY_MODE_OPTIONS, type CreatorQualityMode } from "@/lib/creator/mediaRouting";
import { type CreatorOutcome } from "@/lib/creator/creatorOutcome";
import { type CreatorProfile } from "@/lib/creator/creatorProfile";
import { type CreatorScript } from "@/lib/creator/creatorScript";
import type { BulkIdeaResult, CreatorDurationOption } from "./createWorkspaceBriefTypes";

/** Presentation only: state, effects, authority and persistence remain in CreateWorkspace. */
export type CreateBriefPanelProps = {
  isCreatorLabFlow: boolean;
  creatorBriefCanvasVisible: boolean;
  uiLanguage: import("@/lib/useLanguage").Language;
  creatorOutcome: CreatorOutcome | undefined;
  handleCreatorOutcomeSelect: (nextOutcome: CreatorOutcome) => void;
  input: string;
  setInput: import("react").Dispatch<import("react").SetStateAction<string>>;
  getFlowAwarePlaceholder: () => string;
  CREATOR_FORMAT_OPTIONS: { value: CreatorFormat; label: string; guidance: string; }[];
  creatorFormat: CreatorFormat;
  getCreatorDurationLabel: () => string;
  language: ContentLanguage;
  getCreatorQualityModeLabel: () => string;
  creatorProfile: CreatorProfile;
  setCreatorProfile: import("react").Dispatch<import("react").SetStateAction<CreatorProfile>>;
  saveCreatorProfile: () => void;
  ui: { ageGroup: string; analyzeContentOpportunity: string; analyzingContentOpportunity: string; bulkAngle: string; bulkEmpty: string; bulkGenerate: string; bulkGenerating: string; bulkReason: string; bulkScore: string; bulkTopicsLabel: string; bulkTopicsPlaceholder: string; contentLanguage: string; contentLanguageHint: string; contentType: string; createCharacters: string; creatorDurationTitle: string; creatorQualityTitle: string; customDuration: string; customDurationMinutes: string; customDurationSeconds: string; english: string; generateFullPackageFromBulk: string; generateSelectedBulk: string; generatingFullYoutubePackage: string; generatingSelectedBulk: string; preparingSetup: string; sceneCountLabel: string; selectedBulkCount: string; targetMarket: string; turkish: string; useBulkTopic: string; videoFormat: string; };
  setLanguage: import("react").Dispatch<import("react").SetStateAction<ContentLanguage>>;
  creatorBriefDraftRestored: boolean;
  creatorCountry: string;
  setCreatorCountry: import("react").Dispatch<import("react").SetStateAction<string>>;
  CREATOR_COUNTRY_OPTIONS: { value: string; label: string; }[];
  creatorAgeGroup: CreatorAgeGroup;
  setCreatorAgeGroup: import("react").Dispatch<import("react").SetStateAction<CreatorAgeGroup>>;
  CREATOR_AGE_GROUP_OPTIONS: { value: CreatorAgeGroup; label: string; }[];
  creatorContentType: CreatorContentType;
  setCreatorContentType: import("react").Dispatch<import("react").SetStateAction<CreatorContentType>>;
  CREATOR_CONTENT_TYPE_OPTIONS: { value: CreatorContentType; labelEn: string; labelTr: string; }[];
  creatorNarrativePolicy: "science_documentary_v1" | undefined;
  creatorScript: CreatorScript | null;
  setCreatorNarrativePolicy: import("react").Dispatch<import("react").SetStateAction<"science_documentary_v1" | undefined>>;
  creatorVideoDurationSec: number;
  handleCreatorFormatChange: (nextFormat: CreatorFormat) => void;
  creatorTargetPlatforms: ("youtube" | "youtube_shorts" | "instagram_reels" | "tiktok" | "linkedin")[];
  creatorPlatformOutputPlan: CreatorPlatformOutputPlan;
  toggleCreatorTargetPlatform: (platform: CreatorPublishPlatform) => void;
  getCreatorSceneCount: () => number;
  getCreatorDurationOptions: () => CreatorDurationOption[];
  creatorDurationPreset: CreatorDurationPreset;
  handleCreatorDurationPresetChange: (preset: CreatorDurationPreset) => void;
  getCreatorSceneCountForTargetDuration: (durationSec: number) => number;
  setCreatorDurationPreset: import("react").Dispatch<import("react").SetStateAction<CreatorDurationPreset>>;
  getCreatorCustomDurationInputValue: () => number;
  handleCreatorCustomDurationChange: (rawValue: string) => void;
  creatorQualityMode: CreatorQualityMode;
  setCreatorQualityMode: import("react").Dispatch<import("react").SetStateAction<CreatorQualityMode>>;
  getCreatorQualityModeGuidance: () => string;
  CreatorWorkspaceIcon: ({ name }: { name: CreatorWorkspaceIconName; }) => import("react/jsx-runtime").JSX.Element;
  createSetup: () => Promise<void>;
  loadingSetup: boolean;
  creatorMentorLoading: boolean;
  bulkResults: BulkIdeaResult[];
  bulkTopics: string;
  setBulkTopics: import("react").Dispatch<import("react").SetStateAction<string>>;
  handleBulkGenerateIdeas: () => Promise<void>;
  bulkLoading: boolean;
  selectedBulkIds: number[];
  handleGenerateSelectedBulk: () => Promise<void>;
  selectedBulkLoading: boolean;
  isGeneratingFullYoutubePackage: boolean;
  toggleBulkSelection: (index: number) => void;
  handleUseBulkTopic: (idea: BulkIdeaResult) => void;
  handleGenerateFullPackageFromBulk: (idea: BulkIdeaResult) => Promise<void>;
  getFlowAwareInputLabel: () => string;
};

export default function CreateBriefPanel({
  isCreatorLabFlow,
  creatorBriefCanvasVisible,
  uiLanguage,
  creatorOutcome,
  handleCreatorOutcomeSelect,
  input,
  setInput,
  getFlowAwarePlaceholder,
  CREATOR_FORMAT_OPTIONS,
  creatorFormat,
  getCreatorDurationLabel,
  language,
  getCreatorQualityModeLabel,
  creatorProfile,
  setCreatorProfile,
  saveCreatorProfile,
  ui,
  setLanguage,
  creatorBriefDraftRestored,
  creatorCountry,
  setCreatorCountry,
  CREATOR_COUNTRY_OPTIONS,
  creatorAgeGroup,
  setCreatorAgeGroup,
  CREATOR_AGE_GROUP_OPTIONS,
  creatorContentType,
  setCreatorContentType,
  CREATOR_CONTENT_TYPE_OPTIONS,
  creatorNarrativePolicy,
  creatorScript,
  setCreatorNarrativePolicy,
  creatorVideoDurationSec,
  handleCreatorFormatChange,
  creatorTargetPlatforms,
  creatorPlatformOutputPlan,
  toggleCreatorTargetPlatform,
  getCreatorSceneCount,
  getCreatorDurationOptions,
  creatorDurationPreset,
  handleCreatorDurationPresetChange,
  getCreatorSceneCountForTargetDuration,
  setCreatorDurationPreset,
  getCreatorCustomDurationInputValue,
  handleCreatorCustomDurationChange,
  creatorQualityMode,
  setCreatorQualityMode,
  getCreatorQualityModeGuidance,
  CreatorWorkspaceIcon,
  createSetup,
  loadingSetup,
  creatorMentorLoading,
  bulkResults,
  bulkTopics,
  setBulkTopics,
  handleBulkGenerateIdeas,
  bulkLoading,
  selectedBulkIds,
  handleGenerateSelectedBulk,
  selectedBulkLoading,
  isGeneratingFullYoutubePackage,
  toggleBulkSelection,
  handleUseBulkTopic,
  handleGenerateFullPackageFromBulk,
  getFlowAwareInputLabel,
}: CreateBriefPanelProps) {
  return (
<div id={isCreatorLabFlow ? "creatorlab-brief-canvas" : undefined} className={isCreatorLabFlow ? (creatorBriefCanvasVisible ? "creatorlab-brief-experience" : "hidden") : "space-y-4 rounded-[28px] border border-orange-200/24 bg-white/62 p-6"}>
          {isCreatorLabFlow && (
            <>
              <div className="creatorlab-brief-heading">
                <div>
                  <p className="creatorlab-brief-kicker">{uiLanguage === "en" ? "Step 1 · Brief" : "Adım 1 · Brief"}</p>
                  <h1>{uiLanguage === "en" ? "Project Brief" : "Proje Brief'i"}</h1>
                  <p>
                    {uiLanguage === "en"
                      ? "Define the idea and essential production choices. Velto Studio will use this brief to validate the opportunity before production begins."
                      : "Fikri ve temel üretim tercihlerini tanımla. Velto Studio, üretim başlamadan önce içerik fırsatını bu brief üzerinden doğrular."}
                  </p>
                </div>
                <span className="creatorlab-brief-step-badge">{uiLanguage === "en" ? "Draft stage" : "Taslak aşaması"}</span>
              </div>

              <CreatorOutcomeStart
                language={uiLanguage === "en" ? "en" : "tr"}
                value={creatorOutcome}
                onSelect={handleCreatorOutcomeSelect}
              />

              <section className="creatorlab-topic-card">
                <div className="creatorlab-topic-header">
                  <div>
                    <label htmlFor="creatorlab-topic-input">
                      {uiLanguage === "en" ? "Describe your idea" : "Fikrini anlat"}
                    </label>
                    <p>
                      {uiLanguage === "en"
                        ? "Describe the topic, angle or video idea in your own words."
                        : "Konuyu, yaklaşımı veya video fikrini kendi kelimelerinle anlat."}
                    </p>
                  </div>
                  <span className="creatorlab-required-label">{uiLanguage === "en" ? "Required" : "Zorunlu"}</span>
                </div>
                <textarea
                  id="creatorlab-topic-input"
                  className="creatorlab-topic-textarea"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={getFlowAwarePlaceholder()}
                />
                <div className="creatorlab-brief-chip-row" aria-label={uiLanguage === "en" ? "Current brief summary" : "Mevcut brief özeti"}>
                  <span className="creatorlab-brief-chip">{CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label}</span>
                  <span className="creatorlab-brief-chip">{getCreatorDurationLabel()}</span>
                  <span className="creatorlab-brief-chip">{language.toUpperCase()}</span>
                  <span className="creatorlab-brief-chip">{getCreatorQualityModeLabel()}</span>
                </div>
              </section>

              <details id="creatorlab-brand-memory" className="creatorlab-context-details creatorlab-brand-memory">
                <summary>
                  <div>
                    <div className="creatorlab-brand-memory-title-row">
                      <strong>{uiLanguage === "en" ? "Brand Memory" : "Marka Hafızası"}</strong>
                      <span className="creatorlab-brand-memory-optional">
                        {uiLanguage === "en" ? "Optional" : "İsteğe bağlı"}
                      </span>
                    </div>
                    <span>
                      {uiLanguage === "en"
                        ? "Save the essentials Velto should remember for future projects."
                        : "Velto'nun gelecek projelerde hatırlamasını istediğin temel bilgileri kaydet."}
                    </span>
                  </div>
                  <div className="creatorlab-context-summary-values" aria-hidden="true">
                    {creatorProfile.brandName && <span>{creatorProfile.brandName}</span>}
                    {creatorProfile.defaultAudience && <span>{creatorProfile.defaultAudience}</span>}
                  </div>
                  <span className="creatorlab-details-chevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="creatorlab-context-body">
                  <div className="creatorlab-profile-input-grid">
                    <label className="creatorlab-brief-field">
                      <span>{uiLanguage === "en" ? "Brand / Creator Name" : "Marka / Creator Adı"}</span>
                      <input
                        value={creatorProfile.brandName}
                        onChange={(event) =>
                          setCreatorProfile((current) => ({
                            ...current,
                            brandName: event.target.value,
                          }))
                        }
                        placeholder={uiLanguage === "en" ? "Example: Northstar Studio" : "Örnek: Northstar Studio"}
                      />
                      <small>
                        {uiLanguage === "en"
                          ? "The name Velto should associate with this creator or brand."
                          : "Velto'nun bu creator veya marka ile ilişkilendireceği ad."}
                      </small>
                    </label>
                    <label className="creatorlab-brief-field">
                      <span>{uiLanguage === "en" ? "Primary Audience" : "Ana Hedef Kitle"}</span>
                      <input
                        value={creatorProfile.defaultAudience}
                        onChange={(event) =>
                          setCreatorProfile((current) => ({
                            ...current,
                            defaultAudience: event.target.value,
                          }))
                        }
                        placeholder={
                          uiLanguage === "en"
                            ? "Example: B2B technology decision makers"
                            : "Örnek: B2B teknoloji karar vericileri"
                        }
                      />
                      <small>
                        {uiLanguage === "en"
                          ? "Reusable audience context, more specific than the project-level audience profile."
                          : "Proje bazlı kitle profilinden daha spesifik, yeniden kullanılabilir hedef kitle bağlamı."}
                      </small>
                    </label>
                  </div>
                  <div className="creatorlab-brand-memory-footer">
                    <p>
                      {uiLanguage === "en"
                        ? "Saved on this device. Format, platform, duration and quality stay project-specific."
                        : "Bu cihazda saklanır. Format, platform, süre ve kalite proje bazında kalır."}
                    </p>
                    <button type="button" className="cl-primary-button" onClick={saveCreatorProfile}>
                      {uiLanguage === "en"
                        ? "Remember for future projects"
                        : "Gelecek projeler için hatırla"}
                    </button>
                  </div>
                </div>
              </details>
            </>
          )}

          {!isCreatorLabFlow && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">{ui.contentLanguage}</label>
                <select
                  className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
                >
                  <option value="tr">{ui.turkish}</option>
                  <option value="en">{ui.english}</option>
                </select>
              </div>
              <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-4 text-sm text-slate-600">
                {ui.contentLanguageHint}
              </div>
            </div>
          )}

          {isCreatorLabFlow && (
            <section id="creatorlab-brief-settings" className="creatorlab-brief-card creatorlab-brief-card-v2">
              <div className="creatorlab-brief-section-heading">
                <div>
                  <p>{uiLanguage === "en" ? "Essential decisions" : "Temel kararlar"}</p>
                  <h3>{uiLanguage === "en" ? "Define the output, not the engine" : "Motoru değil, çıktıyı tanımla"}</h3>
                  <span>
                    {uiLanguage === "en"
                      ? "Choose only the decisions that shape your result. Velto Studio handles the production details."
                      : "Yalnızca sonucu şekillendiren kararları verin. Velto Studio üretim ayrıntılarını yönetir."}
                  </span>
                </div>
                {creatorBriefDraftRestored && (
                  <span className="creatorlab-restored-badge">
                    {uiLanguage === "en" ? "Draft restored" : "Taslak geri yüklendi"}
                  </span>
                )}
              </div>

              <div className="creatorlab-brief-core-grid">
                <label className="creatorlab-brief-field">
                  <span>{ui.contentLanguage}</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value as ContentLanguage)}>
                    <option value="tr">{ui.turkish}</option>
                    <option value="en">{ui.english}</option>
                  </select>
                  <small>{uiLanguage === "en" ? "Narration, metadata and captions" : "Anlatım, metadata ve altyazılar"}</small>
                </label>

                <label className="creatorlab-brief-field">
                  <span>{ui.targetMarket}</span>
                  <select value={creatorCountry} onChange={(event) => setCreatorCountry(event.target.value)}>
                    {CREATOR_COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <small>
                    {uiLanguage === "en"
                      ? "Used only when regional context improves the result."
                      : "Yalnızca bölgesel bağlam sonucu iyileştirecekse kullanılır."}
                  </small>
                </label>

                <label className="creatorlab-brief-field">
                  <span>{ui.ageGroup}</span>
                  <select value={creatorAgeGroup} onChange={(event) => setCreatorAgeGroup(event.target.value as CreatorAgeGroup)}>
                    {CREATOR_AGE_GROUP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <small>{uiLanguage === "en" ? "Who should immediately understand and value it?" : "İçeriği kim hemen anlamalı ve değerli bulmalı?"}</small>
                </label>

                <label className="creatorlab-brief-field">
                  <span>{ui.contentType}</span>
                  <select value={creatorContentType} onChange={(event) => setCreatorContentType(event.target.value as CreatorContentType)}>
                    {CREATOR_CONTENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {uiLanguage === "en" ? option.labelEn : option.labelTr}
                      </option>
                    ))}
                  </select>
                  <small>{uiLanguage === "en" ? "The primary storytelling structure" : "Ana anlatım ve içerik yapısı"}</small>
                </label>

                <label className="creatorlab-brief-field">
                  <span>{uiLanguage === "en" ? "Narrative policy" : "Anlatı politikası"}</span>
                  <select
                    value={creatorNarrativePolicy || "standard"}
                    disabled={Boolean(creatorScript)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCreatorNarrativePolicy(
                        value === "science_documentary_v1"
                          ? "science_documentary_v1"
                          : undefined,
                      );
                    }}
                  >
                    <option value="standard">
                      {uiLanguage === "en" ? "Standard" : "Standart"}
                    </option>
                    <option
                      value="science_documentary_v1"
                      disabled={creatorVideoDurationSec !== 480}
                    >
                      {uiLanguage === "en"
                        ? "Evidence-driven Science Documentary"
                        : "Kanıta dayalı Bilim Belgeseli"}
                    </option>
                  </select>
                  <small>
                    {creatorScript
                      ? uiLanguage === "en"
                        ? "The policy is locked after script approval to protect the accepted script."
                        : "Kabul edilen metni korumak için politika metin onayından sonra kilitlenir."
                      : uiLanguage === "en"
                        ? "Science Documentary is an explicit five-section option for the 8-minute format."
                        : "Bilim Belgeseli, 8 dakikalık format için açıkça seçilen beş bölümlü bir seçenektir."}
                  </small>
                </label>
              </div>

              <section className="creatorlab-brief-decision-section" aria-labelledby="creatorlab-format-title">
                <div className="creatorlab-decision-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Output" : "Çıktı"}</span>
                    <strong id="creatorlab-format-title">{ui.videoFormat}</strong>
                  </div>
                  <small>{uiLanguage === "en" ? "Choose where the main version will live." : "Ana versiyonun yayınlanacağı formatı seç."}</small>
                </div>
                <div className="creatorlab-format-choice-grid">
                  {CREATOR_FORMAT_OPTIONS.map((option) => {
                    const isSelected = creatorFormat === option.value;
                    const localizedGuidance = option.value === "short_form"
                      ? uiLanguage === "en" ? "Vertical, fast and optimized for short-form feeds." : "Dikey, hızlı ve kısa video akışları için optimize."
                      : uiLanguage === "en" ? "Structured long-form package ready for platform adaptation." : "Platformlara uyarlanmaya hazır, yapılandırılmış uzun video paketi.";
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`creatorlab-format-choice ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleCreatorFormatChange(option.value)}
                        disabled={Boolean(creatorNarrativePolicy)}
                        aria-pressed={isSelected}
                      >
                        <span className="creatorlab-format-choice-mark" aria-hidden="true">
                          {option.value === "short_form" ? "9:16" : "16:9"}
                        </span>
                        <div>
                          <strong>{option.label}</strong>
                          <small>{localizedGuidance}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="creatorlab-brief-decision-section" aria-labelledby="creatorlab-platform-title">
                <div className="creatorlab-decision-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Distribution" : "Dağıtım"}</span>
                    <strong id="creatorlab-platform-title">
                      {uiLanguage === "en" ? "Target platforms" : "Hedef platformlar"}
                    </strong>
                  </div>
                  <small>
                    {creatorTargetPlatforms.length} {uiLanguage === "en" ? "selected" : "seçili"}
                  </small>
                </div>
                <div className="creatorlab-platform-choice-grid">
                  {CREATOR_PLATFORM_IDS.map((platform) => {
                    const isSelected = creatorTargetPlatforms.includes(platform);
                    const preset = CREATOR_PLATFORM_PRESETS[platform];
                    const outputPlan = creatorPlatformOutputPlan.find(
                      (item) => item.platform === platform,
                    );
                    return (
                      <button
                        key={platform}
                        type="button"
                        className={`creatorlab-platform-choice ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleCreatorTargetPlatform(platform)}
                        aria-pressed={isSelected}
                      >
                        <span className="creatorlab-platform-choice-check" aria-hidden="true">
                          {isSelected ? "✓" : "+"}
                        </span>
                        <div>
                          <strong>{preset.label[uiLanguage]}</strong>
                          <small>
                            {preset.recommendedAspectRatio} · {preset.metadataPreset[uiLanguage]}
                          </small>
                        </div>
                        <em>
                          {isSelected && outputPlan?.needsAdaptation
                            ? uiLanguage === "en"
                              ? "Adapt at Publish"
                              : "Publish aşamasında uyarlanacak"
                            : preset.guidance[uiLanguage]}
                        </em>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="creatorlab-brief-decision-section" aria-labelledby="creatorlab-duration-title">
                <div className="creatorlab-decision-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Runtime" : "Süre"}</span>
                    <strong id="creatorlab-duration-title">{ui.creatorDurationTitle}</strong>
                  </div>
                  <small>{getCreatorSceneCount()} {ui.sceneCountLabel} · {getCreatorDurationLabel()}</small>
                </div>
                <div className="creatorlab-duration-choice-row">
                  {getCreatorDurationOptions().map((option) => {
                    const isSelected = creatorDurationPreset === option.preset;
                    return (
                      <button
                        key={option.preset}
                        type="button"
                        className={`creatorlab-duration-choice ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleCreatorDurationPresetChange(option.preset)}
                        disabled={Boolean(creatorNarrativePolicy) && option.seconds !== 480}
                        aria-pressed={isSelected}
                      >
                        <strong>{option.label}</strong>
                        <span>{getCreatorSceneCountForTargetDuration(option.seconds)} {ui.sceneCountLabel}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`creatorlab-duration-choice ${creatorDurationPreset === "custom" ? "is-selected" : ""}`}
                    onClick={() => setCreatorDurationPreset("custom")}
                    disabled={Boolean(creatorNarrativePolicy)}
                    aria-pressed={creatorDurationPreset === "custom"}
                  >
                    <strong>{ui.customDuration}</strong>
                    <span>{uiLanguage === "en" ? "Set exact runtime" : "Kesin süre belirle"}</span>
                  </button>
                </div>
                {creatorDurationPreset === "custom" && (
                  <label className="creatorlab-custom-duration-field">
                    <span>{creatorFormat === "youtube_video" ? ui.customDurationMinutes : ui.customDurationSeconds}</span>
                    <input
                      type="number"
                      min={creatorFormat === "youtube_video" ? 1 : 5}
                      max={creatorFormat === "youtube_video" ? 60 : 180}
                      step={creatorFormat === "youtube_video" ? 0.5 : 1}
                      value={getCreatorCustomDurationInputValue()}
                      disabled={Boolean(creatorNarrativePolicy)}
                      onChange={(event) => handleCreatorCustomDurationChange(event.target.value)}
                    />
                  </label>
                )}
              </section>



              <div id="creatorlab-quality-panel" className="creatorlab-quality-panel">
                <div className="creatorlab-quality-heading">
                  <div>
                    <label>{ui.creatorQualityTitle}</label>
                    <p>
                      {uiLanguage === "en"
                        ? "Choose the finish and production quality that best fit this project."
                        : "Bu projeye en uygun sonuç ve üretim kalitesini seç."}
                    </p>
                  </div>
                </div>
                <div className="creatorlab-quality-options">
                  {CREATOR_QUALITY_MODE_OPTIONS.map((option) => {
                    const isSelected = option.value === creatorQualityMode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCreatorQualityMode(option.value)}
                        className={`creatorlab-quality-option ${isSelected ? "is-selected" : ""}`}
                        aria-pressed={isSelected}
                      >
                        <strong>{uiLanguage === "en" ? option.labelEn : option.labelTr}</strong>
                        <span>{uiLanguage === "en" ? option.guidanceEn : option.guidanceTr}</span>
                      </button>
                    );
                  })}
                </div>
                {(() => (
                    <div className="creatorlab-quality-summary">
                      <div className="creatorlab-quality-metric">
                        <span>{uiLanguage === "en" ? "Selected quality" : "Seçilen kalite"}</span>
                        <strong>{getCreatorQualityModeLabel()}</strong>
                      </div>
                      <p>{getCreatorQualityModeGuidance()}</p>
                    </div>
                ))()}
              </div>

              <div className="creatorlab-brief-strategy-note">
                <CreatorWorkspaceIcon name="insights" />
                <p>
                  {uiLanguage === "en"
                    ? "Trend research, creative alternatives and evidence review are handled in Strategy after this brief is analyzed."
                    : "Trend araştırması, yaratıcı alternatifler ve kanıt incelemesi bu brief analiz edildikten sonra Strateji aşamasında ele alınır."}
                </p>
              </div>

              <div id="creatorlab-brief-action" className="creatorlab-brief-action-bar">
                <div className="creatorlab-brief-action-copy">
                  <strong>{uiLanguage === "en" ? "Ready to validate the idea?" : "Fikri doğrulamaya hazır mısın?"}</strong>
                  <p>
                    {input.trim()
                      ? uiLanguage === "en" ? "Velto Studio will analyze the opportunity and prepare the Strategy workspace." : "Velto Studio içerik fırsatını analiz edip Strateji çalışma alanını hazırlayacak."
                      : uiLanguage === "en" ? "Enter a topic or video idea to continue." : "Devam etmek için bir konu veya video fikri gir."}
                  </p>
                </div>
                <button type="button" onClick={createSetup} disabled={loadingSetup || !input.trim()} className="creatorlab-primary-action">
                  {creatorMentorLoading ? ui.analyzingContentOpportunity : ui.analyzeContentOpportunity}
                </button>
              </div>
            </section>
          )}

          {isCreatorLabFlow && (
            <details className="creatorlab-secondary-panel creatorlab-idea-lab-panel">
              <summary>
                <div className="creatorlab-secondary-summary-copy">
                  <strong>{uiLanguage === "en" ? "Idea Lab · multi-topic mode" : "Idea Lab · çoklu konu modu"}</strong>
                  <span>
                    {uiLanguage === "en"
                      ? "Generate and compare several creator directions without crowding the main brief."
                      : "Ana brief'i kalabalıklaştırmadan birden fazla içerik yönü üret ve karşılaştır."}
                  </span>
                </div>
                <span className="creatorlab-secondary-status">
                  {bulkResults.length > 0 ? (uiLanguage === "en" ? `${bulkResults.length} ideas` : `${bulkResults.length} fikir`) : (uiLanguage === "en" ? "Optional" : "Opsiyonel")}
                </span>
                <span className="creatorlab-details-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="creatorlab-secondary-body creatorlab-idea-lab-body">
                <div className="creatorlab-idea-lab-entry">
                  <label>
                    <span>{ui.bulkTopicsLabel}</span>
                    <textarea
                      value={bulkTopics}
                      onChange={(event) => setBulkTopics(event.target.value)}
                      placeholder={ui.bulkTopicsPlaceholder}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleBulkGenerateIdeas}
                    disabled={bulkLoading || !bulkTopics.trim()}
                  >
                    {bulkLoading ? ui.bulkGenerating : ui.bulkGenerate}
                  </button>
                </div>

                {bulkResults.length === 0 ? (
                  <div className="creatorlab-idea-lab-empty">{ui.bulkEmpty}</div>
                ) : (
                  <>
                    <div className="creatorlab-idea-lab-toolbar">
                      <span>{ui.selectedBulkCount}: <strong>{selectedBulkIds.length}</strong></span>
                      <button
                        type="button"
                        onClick={handleGenerateSelectedBulk}
                        disabled={selectedBulkIds.length === 0 || selectedBulkLoading || isGeneratingFullYoutubePackage || loadingSetup}
                      >
                        {selectedBulkLoading ? ui.generatingSelectedBulk : ui.generateSelectedBulk}
                      </button>
                    </div>
                    <div className="creatorlab-idea-lab-grid">
                      {bulkResults.map((idea, index) => (
                        <article key={`${idea.topic}-${index}`} className={selectedBulkIds.includes(index) ? "is-selected" : ""}>
                          <label className="creatorlab-idea-select">
                            <input
                              type="checkbox"
                              checked={selectedBulkIds.includes(index)}
                              onChange={() => toggleBulkSelection(index)}
                            />
                            <span>{uiLanguage === "en" ? "Select" : "Seç"}</span>
                          </label>
                          <div className="creatorlab-idea-title-row">
                            <strong>{idea.title}</strong>
                            <span>{ui.bulkScore}: {Math.round((idea.score || 0) * 100)}</span>
                          </div>
                          <p>{idea.hook}</p>
                          <small><b>{ui.bulkAngle}:</b> {idea.angle}</small>
                          <small><b>{ui.bulkReason}:</b> {idea.reason}</small>
                          <div className="creatorlab-idea-actions">
                            <button type="button" onClick={() => handleUseBulkTopic(idea)}>{ui.useBulkTopic}</button>
                            <button
                              type="button"
                              onClick={() => handleGenerateFullPackageFromBulk(idea)}
                              disabled={isGeneratingFullYoutubePackage || loadingSetup}
                            >
                              {isGeneratingFullYoutubePackage ? ui.generatingFullYoutubePackage : ui.generateFullPackageFromBulk}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </details>
          )}

          {!isCreatorLabFlow && (
            <>
          <label className="block text-sm font-medium text-slate-600">
  {getFlowAwareInputLabel()}
</label>

          <textarea
            className="min-h-36 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-4 text-black placeholder:text-slate-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={getFlowAwarePlaceholder()}
          />


          <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
            <button
              onClick={createSetup}
              disabled={loadingSetup}
              className="rounded-2xl bg-white/82 px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
            >
              {loadingSetup ? ui.preparingSetup : ui.createCharacters}
            </button>
          </div>
            </>
          )}
        </div>
  );
}
