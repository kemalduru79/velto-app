"use client";

import CreatorScriptReview from "@/components/create/CreatorScriptReview";
import type { ContentLanguage, CreatorFormat } from "@/components/create/createWorkspacePanelTypes";
import { type CreatorScript } from "@/lib/creator/creatorScript";
import type { CreatorScriptPendingRefinement, CreatorScriptRevisionHistoryEntry } from "@/lib/creator/creatorScriptRevisions";
import type { CreatorAgeGroup, CreatorStrategyDirection, CreatorWorkspaceIconName, YoutubePatternSummary, YoutubeResearchVideo } from "./createWorkspaceStrategyTypes";

/** Presentation only: state, effects, authority and persistence remain in CreateWorkspace. */
export type CreatorStrategyPanelProps = {
  uiLanguage: import("@/lib/useLanguage").Language;
  input: string;
  CREATOR_AGE_GROUP_OPTIONS: { value: CreatorAgeGroup; label: string; }[];
  creatorAgeGroup: CreatorAgeGroup;
  CREATOR_FORMAT_OPTIONS: { value: CreatorFormat; label: string; guidance: string; }[];
  creatorFormat: CreatorFormat;
  getCreatorDurationLabel: () => string;
  getCreatorQualityModeLabel: () => string;
  navigateCreatorWorkspaceStep: (step: 1 | 2 | 3 | 4) => void;
  creatorSelectedStrategyDirectionId: string;
  creatorMentorRecommendedIdea: { title: string; reason: string; };
  setCreatorSelectedStrategyDirectionId: import("react").Dispatch<import("react").SetStateAction<string>>;
  CREATOR_COUNTRY_OPTIONS: { value: string; label: string; }[];
  creatorCountry: string;
  getCreatorSceneCount: () => number;
  creatorAudienceFitLabel: "Strong" | "Güçlü" | "Defined" | "Tanımlı" | "Needs review" | "Kontrol gerekli";
  creatorMentorAudienceInsights: string[];
  creatorSelectedStrategyHook: string;
  youtubeResearchVideos: YoutubeResearchVideo[];
  youtubePatternSummary: YoutubePatternSummary | null;
  creatorCompetitionLabel: "Low competition" | "Düşük rekabet" | "High competition" | "Yüksek rekabet" | "Moderate competition" | "Orta rekabet" | "Evidence available" | "Pazar kanıtı mevcut" | "Not added" | "Eklenmedi";
  setCreatorMarketEvidenceReviewOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  youtubeResearchLoading: boolean;
  handleYoutubeResearch: () => Promise<void>;
  creatorStrategyHookOptions: string[];
  setCreatorSelectedHookPattern: import("react").Dispatch<import("react").SetStateAction<string>>;
  creatorStrategyAlternativeDirections: CreatorStrategyDirection[];
  creatorMarketEvidenceReviewOpen: boolean;
  ui: { patternEngineLoading: string; patternTopTitles: string; youtubeResearchLoading: string; youtubeResearchViews: string; };
  handleYoutubePatternEngine: () => Promise<void>;
  youtubePatternLoading: boolean;
  creatorMarketEvidenceSubject: string;
  CreatorWorkspaceIcon: ({ name }: { name: CreatorWorkspaceIconName; }) => import("react/jsx-runtime").JSX.Element;
  formatYoutubeNumber: (value?: number) => string;
  formatYoutubeDuration: (seconds?: number) => string;
  creatorMentorProductionPlan: string[];
  creatorScriptEditorialState: import("@/lib/creator/creatorEditorialQa").CreatorScriptEditorialState;
  creatorSelectedStrategyDirection: CreatorStrategyDirection;
  handleCreatorProductionPackage: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
  creatorWorkflowLoadingState: import("@/lib/creator/creatorWorkflowAuthority").CreatorWorkflowLoadingState;
  creatorScriptIsCurrent: boolean;
  creatorScript: CreatorScript | null;
  currentProjectId: string;
  creatorStrategyFingerprint: string;
  language: ContentLanguage;
  creatorScriptBusySectionId: string | null;
  handleSaveCreatorScriptDocument: (text: string) => Promise<void>;
  handleRegenerateCreatorScriptSection: (sectionId: string) => Promise<void>;
  handleReviewCreatorScriptSources: import("react").ComponentProps<typeof CreatorScriptReview>["onReviewSources"];
  handleRefineCreatorScript: (refinement: { scope: "selection" | "opening" | "whole_script"; mode: "focused_edit" | "editorial_rewrite" | "research_backed_rewrite"; instruction: string; selectionStart?: number; selectionEnd?: number; selectedText?: string; }) => Promise<boolean>;
  creatorScriptPendingRefinement: CreatorScriptPendingRefinement | null;
  creatorScriptRevisionHistory: CreatorScriptRevisionHistoryEntry[];
  handleResolveCreatorScriptRefinement: (action: "apply" | "discard") => Promise<boolean>;
  creatorScriptRefinementHighlights: { start: number; end: number; }[];
  handleApproveCreatorScriptAndBuildScenes: (documentText: string) => Promise<void>;
};

export default function CreatorStrategyPanel({
  uiLanguage,
  input,
  CREATOR_AGE_GROUP_OPTIONS,
  creatorAgeGroup,
  CREATOR_FORMAT_OPTIONS,
  creatorFormat,
  getCreatorDurationLabel,
  getCreatorQualityModeLabel,
  navigateCreatorWorkspaceStep,
  creatorSelectedStrategyDirectionId,
  creatorMentorRecommendedIdea,
  setCreatorSelectedStrategyDirectionId,
  CREATOR_COUNTRY_OPTIONS,
  creatorCountry,
  getCreatorSceneCount,
  creatorAudienceFitLabel,
  creatorMentorAudienceInsights,
  creatorSelectedStrategyHook,
  youtubeResearchVideos,
  youtubePatternSummary,
  creatorCompetitionLabel,
  setCreatorMarketEvidenceReviewOpen,
  youtubeResearchLoading,
  handleYoutubeResearch,
  creatorStrategyHookOptions,
  setCreatorSelectedHookPattern,
  creatorStrategyAlternativeDirections,
  creatorMarketEvidenceReviewOpen,
  ui,
  handleYoutubePatternEngine,
  youtubePatternLoading,
  creatorMarketEvidenceSubject,
  CreatorWorkspaceIcon,
  formatYoutubeNumber,
  formatYoutubeDuration,
  creatorMentorProductionPlan,
  creatorScriptEditorialState,
  creatorSelectedStrategyDirection,
  handleCreatorProductionPackage,
  creatorWorkflowLoadingState,
  creatorScriptIsCurrent,
  creatorScript,
  currentProjectId,
  creatorStrategyFingerprint,
  language,
  creatorScriptBusySectionId,
  handleSaveCreatorScriptDocument,
  handleRegenerateCreatorScriptSection,
  handleReviewCreatorScriptSources,
  handleRefineCreatorScript,
  creatorScriptPendingRefinement,
  creatorScriptRevisionHistory,
  handleResolveCreatorScriptRefinement,
  creatorScriptRefinementHighlights,
  handleApproveCreatorScriptAndBuildScenes,
}: CreatorStrategyPanelProps) {
  return (
<section id="creatorlab-strategy-canvas" className="creatorlab-strategy-experience">
            <header className="creatorlab-strategy-heading">
              <div>
                <p className="creatorlab-strategy-kicker">
                  {uiLanguage === "en" ? "Step 2 · Strategy" : "Adım 2 · Strateji"}
                </p>
                <h1>{uiLanguage === "en" ? "Strategy" : "Strateji"}</h1>
                <p>
                  {uiLanguage === "en"
                    ? "Validate the strongest creative direction before media generation. Review the audience signal, opening angle and production scope, then create the production plan."
                    : "Medya üretimine geçmeden önce en güçlü yaratıcı yönü doğrula. Kitle sinyalini, açılış açısını ve üretim kapsamını inceleyip üretim planını oluştur."}
                </p>
              </div>
              <span className="creatorlab-strategy-stage-badge">
                {uiLanguage === "en" ? "Opportunity analyzed" : "Fırsat analiz edildi"}
              </span>
            </header>

            <div className="creatorlab-strategy-brief-strip">
              <div className="creatorlab-strategy-brief-copy">
                <span>{uiLanguage === "en" ? "Brief complete" : "Brief tamamlandı"}</span>
                <strong title={input.trim()}>
                  {input.trim() || (uiLanguage === "en" ? "Untitled creator brief" : "İsimsiz içerik brief'i")}
                </strong>
                <div className="creatorlab-strategy-brief-meta">
                  <span className="creatorlab-strategy-chip">
                    {CREATOR_AGE_GROUP_OPTIONS.find((option) => option.value === creatorAgeGroup)?.label}
                  </span>
                  <span className="creatorlab-strategy-chip">
                    {CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label}
                  </span>
                  <span className="creatorlab-strategy-chip">{getCreatorDurationLabel()}</span>
                  <span className="creatorlab-strategy-chip">{getCreatorQualityModeLabel()}</span>
                </div>
              </div>
              <button
                type="button"
                className="creatorlab-strategy-edit-button"
                onClick={() => navigateCreatorWorkspaceStep(1)}
              >
                {uiLanguage === "en" ? "Review or edit brief" : "Brief'i incele veya düzenle"}
              </button>
            </div>

            <article
              id="creatorlab-strategy-recommendation"
              className={`creatorlab-strategy-recommendation ${
                creatorSelectedStrategyDirectionId === "recommended" ? "is-selected" : ""
              }`}
            >
              <div className="creatorlab-strategy-recommendation-copy">
                <div className="creatorlab-strategy-recommendation-topline">
                  <span className="creatorlab-strategy-recommendation-label">
                    {uiLanguage === "en" ? "Recommended direction" : "Önerilen yön"}
                  </span>
                  <span className={`creatorlab-strategy-selection-badge ${
                    creatorSelectedStrategyDirectionId === "recommended" ? "is-selected" : ""
                  }`}>
                    {creatorSelectedStrategyDirectionId === "recommended"
                      ? uiLanguage === "en" ? "Selected direction" : "Seçili yön"
                      : uiLanguage === "en" ? "Mentor recommendation" : "Mentor önerisi"}
                  </span>
                </div>
                <h2>{creatorMentorRecommendedIdea.title}</h2>
                <p>{creatorMentorRecommendedIdea.reason}</p>
                {creatorSelectedStrategyDirectionId !== "recommended" && (
                  <button
                    type="button"
                    className="creatorlab-strategy-direction-button"
                    onClick={() => setCreatorSelectedStrategyDirectionId("recommended")}
                  >
                    {uiLanguage === "en" ? "Use recommendation" : "Önerilen yönü kullan"}
                  </button>
                )}
              </div>
              <div className="creatorlab-strategy-recommendation-aside">
                <div>
                  <span>{uiLanguage === "en" ? "Market" : "Pazar"}</span>
                  <strong>
                    {CREATOR_COUNTRY_OPTIONS.find((option) => option.value === creatorCountry)?.label}
                  </strong>
                </div>
                <div>
                  <span>{uiLanguage === "en" ? "Format" : "Format"}</span>
                  <strong>
                    {CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label}
                  </strong>
                </div>
                <div>
                  <span>{uiLanguage === "en" ? "Planned scenes" : "Planlanan sahne"}</span>
                  <strong>{getCreatorSceneCount()}</strong>
                </div>
              </div>
            </article>

            <div id="creatorlab-strategy-signals" className="creatorlab-strategy-signal-grid">
              <div className="creatorlab-strategy-signal-card is-decision">
                <span>{uiLanguage === "en" ? "Audience fit" : "Kitle uyumu"}</span>
                <strong>{creatorAudienceFitLabel}</strong>
                <p>
                  {creatorMentorAudienceInsights[0] ||
                    (uiLanguage === "en"
                      ? "Review the audience promise before production."
                      : "Üretimden önce kitle vaadini kontrol et.")}
                </p>
              </div>
              <div className="creatorlab-strategy-signal-card is-decision">
                <span>{uiLanguage === "en" ? "Opening direction" : "Açılış yönü"}</span>
                <strong>{creatorSelectedStrategyHook || (uiLanguage === "en" ? "Choose below" : "Aşağıdan seç")}</strong>
                <p>{uiLanguage === "en" ? "Strategic angle for the first scene" : "İlk sahne için stratejik açı"}</p>
              </div>
              <div className="creatorlab-strategy-signal-card is-decision">
                <span>{uiLanguage === "en" ? "Market evidence" : "Pazar kanıtı"}</span>
                <strong>
                  {youtubeResearchVideos.length > 0 || youtubePatternSummary
                    ? uiLanguage === "en" ? "Included" : "Eklendi"
                    : uiLanguage === "en" ? "Not added" : "Eklenmedi"}
                </strong>
                <p>
                  {youtubeResearchVideos.length > 0 || youtubePatternSummary
                    ? creatorCompetitionLabel
                    : uiLanguage === "en"
                      ? "Optional market and trend signals to strengthen positioning."
                      : "Konumlandırmayı güçlendiren isteğe bağlı pazar ve trend sinyalleri."}
                </p>
                <button
                  type="button"
                  className="creatorlab-strategy-secondary-action"
                  onClick={() => {
                    setCreatorMarketEvidenceReviewOpen(true);
                    if (youtubeResearchVideos.length === 0 && !youtubeResearchLoading) {
                      void handleYoutubeResearch();
                    } else {
                      window.setTimeout(() => document.getElementById("creatorlab-strategy-youtube")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
                    }
                  }}
                  disabled={youtubeResearchLoading}
                >
                  {youtubeResearchLoading
                    ? uiLanguage === "en" ? "Adding…" : "Ekleniyor…"
                    : youtubeResearchVideos.length > 0 || youtubePatternSummary
                      ? uiLanguage === "en" ? "Review" : "İncele"
                      : uiLanguage === "en" ? "Add market evidence" : "Pazar kanıtı ekle"}
                </button>
              </div>
              <div className="creatorlab-strategy-signal-card is-decision">
                <span>{uiLanguage === "en" ? "Production scope" : "Üretim kapsamı"}</span>
                <strong>{getCreatorDurationLabel()}</strong>
                <p>{uiLanguage === "en" ? `${getCreatorSceneCount()} scenes · ${getCreatorQualityModeLabel()}` : `${getCreatorSceneCount()} sahne · ${getCreatorQualityModeLabel()}`}</p>
              </div>
            </div>

            <div className="creatorlab-strategy-grid">
              <section className="creatorlab-strategy-panel">
                <div className="creatorlab-strategy-panel-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Audience & opening" : "Kitle ve açılış"}</span>
                    <h3>{uiLanguage === "en" ? "Why this direction can work" : "Bu yön neden çalışabilir"}</h3>
                    <p>{uiLanguage === "en" ? "Review the essential audience signals, then choose the strategic opening angle." : "Temel kitle sinyallerini incele, ardından stratejik açılış açısını seç."}</p>
                  </div>
                </div>
                <ul className="creatorlab-strategy-insight-list">
                  {creatorMentorAudienceInsights.map((item, index) => (
                    <li key={`strategy-audience-${index}`}>{item}</li>
                  ))}
                </ul>
                <div className="creatorlab-strategy-hook-selector">
                  <div>
                    <strong>{uiLanguage === "en" ? "Choose the opening direction" : "Açılış yönünü seç"}</strong>
                    <p>
                      {uiLanguage === "en"
                        ? "Select the strategic angle here. Exact narration and timing remain editable in Production."
                        : "Stratejik açıyı burada seç. Kesin anlatım ve süre Production aşamasında düzenlenebilir."}
                    </p>
                  </div>
                  {creatorStrategyHookOptions.length > 0 ? (
                    <div className="creatorlab-strategy-hook-options">
                      {creatorStrategyHookOptions.map((hook, index) => {
                        const isSelected = hook === creatorSelectedStrategyHook;
                        return (
                          <button
                            key={`strategy-hook-${index}`}
                            type="button"
                            className={`creatorlab-strategy-hook-option ${isSelected ? "is-selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() => setCreatorSelectedHookPattern(hook)}
                          >
                            <span>{isSelected ? "✓" : String(index + 1).padStart(2, "0")}</span>
                            <strong>{hook}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="creatorlab-strategy-hook-empty">
                      {uiLanguage === "en"
                        ? "No separate hook angle was returned; the selected creative direction will guide the opening scene."
                        : "Ayrı bir hook açısı üretilmedi; seçilen yaratıcı yön açılış sahnesini yönlendirecek."}
                    </p>
                  )}
                </div>
              </section>

              <section className="creatorlab-strategy-panel">
                <div className="creatorlab-strategy-panel-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Creative options" : "Yaratıcı seçenekler"}</span>
                    <h3>{uiLanguage === "en" ? "Compare and approve one direction" : "Tek bir yönü karşılaştır ve onayla"}</h3>
                    <p>{uiLanguage === "en" ? "The recommendation remains selected by default. Two useful alternatives stay available without creating decision overload." : "Önerilen yön varsayılan olarak seçilidir. Karar yükü oluşturmadan iki yararlı alternatif erişilebilir kalır."}</p>
                  </div>
                </div>
                {creatorStrategyAlternativeDirections.length > 0 ? (
                  <div className="creatorlab-strategy-idea-list">
                    {creatorStrategyAlternativeDirections.map((direction, index) => {
                      const isSelected = creatorSelectedStrategyDirectionId === direction.id;
                      return (
                        <article
                          key={direction.id}
                          className={`creatorlab-strategy-idea-card ${isSelected ? "is-selected" : ""}`}
                        >
                          <span className="creatorlab-strategy-idea-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <div className="creatorlab-strategy-idea-title-row">
                              <strong>{direction.title}</strong>
                              {isSelected && (
                                <span>{uiLanguage === "en" ? "Selected" : "Seçildi"}</span>
                              )}
                            </div>
                            <p>{direction.concept}</p>
                          </div>
                          <button
                            type="button"
                            className="creatorlab-strategy-direction-button"
                            disabled={isSelected}
                            onClick={() => setCreatorSelectedStrategyDirectionId(direction.id)}
                          >
                            {isSelected
                              ? uiLanguage === "en" ? "Selected" : "Seçildi"
                              : uiLanguage === "en" ? "Use this direction" : "Bu yönü kullan"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="creatorlab-strategy-direction-empty">
                    <strong>{uiLanguage === "en" ? "The mentor recommendation is the approved direction." : "Mentor önerisi onaylanan yön olarak kullanılacak."}</strong>
                    <p>{uiLanguage === "en" ? "No additional direction is needed to continue." : "Devam etmek için ek bir yön seçimi gerekmiyor."}</p>
                  </div>
                )}
              </section>
            </div>

            {creatorMarketEvidenceReviewOpen && (
            <section id="creatorlab-strategy-youtube" className="creatorlab-strategy-panel creatorlab-strategy-youtube">
              <div className="creatorlab-strategy-panel-heading">
                <div>
                  <span>{uiLanguage === "en" ? "Market evidence" : "Pazar kanıtı"}</span>
                  <h3>{uiLanguage === "en" ? "Optional market and trend intelligence" : "İsteğe bağlı pazar ve trend içgörüleri"}</h3>
                  <p>{uiLanguage === "en" ? "Additional strategic signals can strengthen positioning without changing the grounded evidence foundation." : "Ek stratejik sinyaller, kaynaklara dayalı kanıt temelini değiştirmeden konumlandırmayı güçlendirebilir."}</p>
                </div>
                <div className="creatorlab-strategy-youtube-actions">
                  <button
                    type="button"
                    className="creatorlab-strategy-secondary-action"
                    onClick={handleYoutubeResearch}
                    disabled={youtubeResearchLoading}
                  >
                    {youtubeResearchLoading
                      ? ui.youtubeResearchLoading
                      : youtubeResearchVideos.length > 0
                        ? uiLanguage === "en" ? "Refresh insights" : "İçgörüleri yenile"
                        : uiLanguage === "en" ? "Research YouTube trends" : "YouTube trendlerini araştır"}
                  </button>
                  <button
                    type="button"
                    className="creatorlab-strategy-secondary-action"
                    onClick={handleYoutubePatternEngine}
                    disabled={youtubePatternLoading || youtubeResearchVideos.length === 0}
                  >
                    {youtubePatternLoading
                      ? ui.patternEngineLoading
                      : youtubePatternSummary
                        ? uiLanguage === "en" ? "Refresh pattern analysis" : "Pattern analizini yenile"
                        : uiLanguage === "en" ? "Analyze patterns" : "Pattern analizi yap"}
                  </button>
                </div>
              </div>

              {youtubeResearchVideos.length > 0 && (
                <div className="creatorlab-strategy-research-context">
                  <div>
                    <span>{uiLanguage === "en" ? "Research subject" : "Araştırma konusu"}</span>
                    <strong>{creatorMarketEvidenceSubject}</strong>
                  </div>
                  <small>
                    {youtubeResearchVideos.length} {uiLanguage === "en" ? "relevant references retained" : "ilgili referans korundu"}
                  </small>
                </div>
              )}

              {youtubeResearchVideos.length === 0 ? (
                <div className="creatorlab-strategy-empty">
                  <div className="creatorlab-strategy-empty-icon">
                    <CreatorWorkspaceIcon name="insights" />
                  </div>
                  <div>
                    <strong>{uiLanguage === "en" ? "No external research is required to continue." : "Devam etmek için harici araştırma zorunlu değil."}</strong>
                    <p>{uiLanguage === "en" ? "Run YouTube research only when current market signals will improve the decision." : "YouTube araştırmasını yalnızca güncel pazar sinyalleri kararı iyileştirecekse çalıştır."}</p>
                  </div>
                </div>
              ) : (
                <div className="creatorlab-strategy-research-preview">
                  {youtubeResearchVideos.slice(0, 3).map((video) => (
                    <a
                      key={video.id}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="creatorlab-strategy-video-card"
                    >
                      <div className="creatorlab-strategy-video-thumb">
                        {video.thumbnail ? <img src={video.thumbnail} alt="" /> : null}
                      </div>
                      <div className="creatorlab-strategy-video-copy">
                        <div className="creatorlab-strategy-video-title-row">
                          <strong>{video.title}</strong>
                          {typeof video.relevanceScore === "number" && (
                            <span className="creatorlab-strategy-video-match">
                              {Math.min(100, Math.max(0, Math.round(video.relevanceScore)))}% {uiLanguage === "en" ? "match" : "uyum"}
                            </span>
                          )}
                        </div>
                        <span>{formatYoutubeNumber(video.views)} {ui.youtubeResearchViews} · {video.channel}</span>
                        <p className="creatorlab-strategy-video-reason">
                          {video.relevanceReason ||
                            (uiLanguage === "en"
                              ? "Retained as evidence for title, opening and duration patterns."
                              : "Başlık, açılış ve süre pattern'leri için kanıt olarak korundu.")}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {youtubePatternSummary && (
                <div className="creatorlab-strategy-pattern">
                  <div className="creatorlab-strategy-pattern-metrics">
                    <div className="creatorlab-strategy-pattern-metric">
                      <span>{uiLanguage === "en" ? "Opportunity" : "Fırsat"}</span>
                      <strong>{youtubePatternSummary.opportunityScore}/100</strong>
                    </div>
                    <div className="creatorlab-strategy-pattern-metric">
                      <span>{uiLanguage === "en" ? "Competition" : "Rekabet"}</span>
                      <strong>{youtubePatternSummary.competitionLevel}</strong>
                    </div>
                    <div className="creatorlab-strategy-pattern-metric">
                      <span>{uiLanguage === "en" ? "Suggested duration" : "Önerilen süre"}</span>
                      <strong>{formatYoutubeDuration(youtubePatternSummary.recommendedDurationSec)}</strong>
                    </div>
                  </div>
                  <div className="creatorlab-strategy-angle">
                    <strong>{uiLanguage === "en" ? "Recommended content angle" : "Önerilen içerik açısı"}</strong>
                    {youtubePatternSummary.recommendedContentAngle}
                  </div>
                </div>
              )}

              {(youtubeResearchVideos.length > 0 || youtubePatternSummary) && (
                <details className="creatorlab-strategy-details">
                  <summary>{uiLanguage === "en" ? "View research details" : "Araştırma detaylarını görüntüle"}</summary>
                  <div className="creatorlab-strategy-details-body">
                    {youtubeResearchVideos.length > 3 && (
                      <div className="creatorlab-strategy-raw-grid">
                        {youtubeResearchVideos.slice(3).map((video) => (
                          <div key={`strategy-research-${video.id}`}>
                            <strong>{video.title}</strong>
                            <ul>
                              <li>{video.channel}</li>
                              <li>{formatYoutubeNumber(video.views)} {ui.youtubeResearchViews}</li>
                              <li>{formatYoutubeDuration(video.durationSec)}</li>
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    {youtubePatternSummary && (
                      <div className="creatorlab-strategy-raw-grid">
                        <div>
                          <strong>{ui.patternTopTitles}</strong>
                          <ul>
                            {youtubePatternSummary.topTitlePatterns.map((item, index) => (
                              <li key={`strategy-title-pattern-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong>{uiLanguage === "en" ? "Opening application" : "Açılış uygulaması"}</strong>
                          <ul>
                            <li>
                              {uiLanguage === "en"
                                ? "Hook alternatives are available inside the opening scene in Production."
                                : "Hook alternatifleri Production içindeki açılış sahnesinde kullanılabilir."}
                            </li>
                          </ul>
                        </div>
                        <div>
                          <strong>{uiLanguage === "en" ? "Reasoning" : "Gerekçe"}</strong>
                          <ul>
                            {youtubePatternSummary.reasoning.map((item, index) => (
                              <li key={`strategy-reasoning-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </section>
            )}

            <section className="creatorlab-strategy-panel">
              <div className="creatorlab-strategy-panel-heading">
                <div>
                  <span>{uiLanguage === "en" ? "Production package preview" : "Üretim paketi önizlemesi"}</span>
                  <h3>{uiLanguage === "en" ? "What the production plan will contain" : "Üretim planı neleri içerecek"}</h3>
                  <p>{uiLanguage === "en" ? "This is the approved strategic outline. Scene-level planning is created only after the next action." : "Bu, onaylanan stratejik taslaktır. Sahne düzeyi planlama yalnızca sıradaki aksiyondan sonra oluşturulur."}</p>
                </div>
              </div>
              <ol className="creatorlab-strategy-production-list">
                {creatorMentorProductionPlan.map((item, index) => (
                  <li key={`strategy-production-${index}`}>{item}</li>
                ))}
              </ol>
            </section>

            {creatorScriptEditorialState !== "current" && (
            <div id="creatorlab-strategy-action" className="creatorlab-strategy-action-bar">
              <div className="creatorlab-strategy-action-copy">
                <strong>{creatorScriptEditorialState === "stale"
                  ? (uiLanguage === "en" ? "Your strategy has changed" : "Stratejin değişti")
                  : (uiLanguage === "en" ? "Ready to approve this strategy?" : "Bu stratejiyi onaylamaya hazır mısın?")}</strong>
                <p>
                  {creatorScriptEditorialState === "stale"
                    ? (uiLanguage === "en"
                        ? "Your previous script is preserved, but it no longer matches the current direction. Rebuild the script to continue."
                        : "Önceki metnin korunuyor ancak artık mevcut yönle eşleşmiyor. Devam etmek için metni yeniden oluştur.")
                    : uiLanguage === "en"
                      ? `Velto Studio will use “${creatorSelectedStrategyDirection?.title || creatorMentorRecommendedIdea.title}” and the selected opening direction to build one grounded full script for review. No scenes or paid media are generated yet.`
                      : `Velto Studio, “${creatorSelectedStrategyDirection?.title || creatorMentorRecommendedIdea.title}” yönünü ve seçilen açılış açısını kullanarak inceleme için kaynaklı bir tam metin oluşturacak. Henüz sahne veya ücretli medya üretilmez.`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreatorProductionPackage}
                disabled={creatorWorkflowLoadingState.scriptGenerating || creatorWorkflowLoadingState.scenesBuilding}
                className="creatorlab-strategy-primary-action"
              >
                {creatorWorkflowLoadingState.scriptGenerating
                  ? uiLanguage === "en" ? "Building full script..." : "Tam metin oluşturuluyor..."
                  : creatorScriptEditorialState === "stale"
                    ? (uiLanguage === "en" ? "Rebuild script" : "Metni yeniden oluştur")
                    : (uiLanguage === "en" ? "Approve Strategy & Build Script" : "Stratejiyi Onayla ve Metni Oluştur")}
              </button>
            </div>
            )}

            {creatorScriptIsCurrent && creatorScript && (
              <CreatorScriptReview
                key={`${currentProjectId || "unsaved"}:${creatorScript.revision}`}
                script={creatorScript}
                currentStrategyFingerprint={creatorStrategyFingerprint}
                language={language}
                busySectionId={creatorScriptBusySectionId}
                buildingScenes={creatorWorkflowLoadingState.scenesBuilding}
                generatingScript={creatorWorkflowLoadingState.scriptGenerating}
                onSaveDocument={handleSaveCreatorScriptDocument}
                onRegenerateSection={handleRegenerateCreatorScriptSection}
                onReviewSources={handleReviewCreatorScriptSources}
                onRefine={handleRefineCreatorScript}
                pendingRefinement={creatorScriptPendingRefinement}
                revisionHistory={creatorScriptRevisionHistory}
                onApplyRefinement={() => handleResolveCreatorScriptRefinement("apply")}
                onDiscardRefinement={() => handleResolveCreatorScriptRefinement("discard")}
                refinementHighlights={creatorScriptRefinementHighlights}
                onApproveAndBuildScenes={handleApproveCreatorScriptAndBuildScenes}
              />
            )}
          </section>
  );
}
