"use client";

import CreatorProductionHistory from "@/components/create/CreatorProductionHistory";
import CreatorProductionSetupSummary from "@/components/create/CreatorProductionSetupSummary";
import { CREATOR_VOICE_SELECTIONS, getCreatorVoiceSelection, getCreatorVoiceSelectionLabel, normalizeCreatorVoiceSelectionId, type CreatorVoiceSelectionId } from "@/lib/creator/voiceProfiles";
import { getVoiceLibraryDisplayMeta, type CreatorVoiceLibrarySelection } from "@/lib/creator/voiceLibrary";
import CreatorBackgroundMusic from "@/components/create/CreatorBackgroundMusic";
import { createDefaultCreatorMusicTimeline, getCreatorMusicSetupMode } from "@/lib/creator/musicSetup";
import { DEFAULT_CREATOR_BACKGROUND_MUSIC, type CreatorBackgroundMusicConfig } from "@/lib/creator/backgroundMusic";
import CreatorEditor from "@/components/create/CreatorEditor";
import { getCreatorContinuityWarning } from "@/lib/creator/continuityWarnings";
import CreatorSceneProductionStatus, { getCreatorSceneTriageLabel, resolveCreatorMeasuredScriptHealthStatus } from "@/components/create/CreatorSceneProductionStatus";
import { hasCreatorUsableVisual } from "@/lib/creator/recommendedVisualExecution";
import { resolveCreatorMediaOutputState } from "@/lib/creator/mediaOutputState.mjs";
import { normalizeCreatorVisualSourceMethod, type CreatorVisualSourceMethod } from "@/lib/creator/visualSourceMethod";
import { isCreatorSceneVisualActionBlocked, isCreatorSceneVisualCountdown, isCreatorSceneVisualGenerating } from "@/lib/creator/visualGenerationStatus";
import { normalizeCreatorSceneTrim, matchesExpectedCreatorVideoSource, resolveCreatorSceneVideoSourceDuration } from "@/lib/creator/editorState";
import CreatorVisualStorageStatus from "@/components/create/CreatorVisualStorageStatus";
import CreatorStockPicker from "@/components/create/CreatorStockPicker";
import CreatorUploadPicker from "@/components/create/CreatorUploadPicker";
import CreatorVideoTrimControl from "@/components/create/CreatorVideoTrimControl";
import CreatorVisualAssetCleanupAction from "@/components/create/CreatorVisualAssetCleanupAction";
import { type CreatorProjectContinuityMode, type CreatorSceneContinuityMode } from "@/lib/creator/visualContinuity";
import { normalizeCreatorDialogueSpeakerCharacterId } from "@/lib/creator/characterIdentity";
import CreatorSceneMusicControls from "@/components/create/CreatorSceneMusicControls";
import { createCreatorProductionSetupPresentation } from "@/components/create/creatorProductionSetupPresentation";
import type { CreatorProductionSubstep } from "@/components/create/CreatorProductionSubnav";
import { type CreatorOutcome } from "@/lib/creator/creatorOutcome";
import { type CreatorQualityMode } from "@/lib/creator/mediaRouting";
import { type CreatorProfile } from "@/lib/creator/creatorProfile";
import { type CreatorAudioTimeline } from "@/lib/creator/audioTimeline";
import { type CreatorSceneHydrationAuthority } from "@/lib/creator/creatorScenePersistence";
import { type CreatorVideoCurrentness } from "@/lib/creator/videoGeneration";
import { type FlowContinuityAuditReport } from "@/lib/video/flowContinuityAudit";
import { type CreatorVisualGenerationMode } from "@/lib/creator/visualGenerationScope";
import { type CreatorUploadedMedia } from "@/lib/creator/uploadedMedia";
import type { Character, ContentLanguage, CreatorContentType, CreatorFormat, CreatorNoCastMode, CreatorProductionPackage, CreatorSceneAssetVersion, CreatorSceneInspectorTab, CreatorSceneScriptDraft, CreatorSceneScriptFitFeedback, CreatorSceneVisualOperation, CreatorScriptHealth, CreatorUndoEntry, CreatorVoicePickerTarget, ExportMovieResult, ImageDispatchCountdown, NarratorSettings, Scene, SceneTiming, VideoDispatchCountdown, VisualBible } from "./createWorkspacePanelTypes";

/** Presentation only: state, effects, authority and persistence remain in CreateWorkspace. */
export type CreatorProductionPanelProps = {
  creatorProductionSubstep: CreatorProductionSubstep;
  uiLanguage: import("@/lib/useLanguage").Language;
  creatorProductionPackage: NonNullable<CreatorProductionPackage>;
  CREATOR_FORMAT_OPTIONS: { value: CreatorFormat; label: string; guidance: string; }[];
  creatorFormat: CreatorFormat;
  getCreatorDurationLabel: () => string;
  scenes: Scene[];
  getCreatorQualityModeLabel: () => string;
  currentProjectId: string;
  creatorStageVisibility: Record<import("@/lib/creator/stageNavigation").CreatorVisibleStage, boolean>;
  creatorPresentationModeLabel: "Cast-led" | "Kadrolu anlatım" | "Presenter-led" | "Sunucu odaklı" | "Narrator-led" | "Anlatıcı odaklı" | "Faceless";
  creatorCharacterVoiceSummary: string;
  creatorMusicSummary: string;
  creatorContinuitySummary: "Independent scenes" | "Bağımsız sahneler" | "Keep continuity" | "Devamlılığı koru" | "Choose per scene" | "Sahne başına seç";
  selectCreatorProductionSubstep: (substep: CreatorProductionSubstep, persist?: boolean) => void;
  creatorProductionSetupPresentation: ReturnType<typeof createCreatorProductionSetupPresentation>;
  creatorNarratorSummary: string;
  creatorMusicConfirmationRequired: boolean;
  creatorProductionCustomizeOpen: boolean;
  setCreatorProductionCustomizeOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  creatorPresentationMode: "ensemble" | "presenter" | CreatorNoCastMode;
  characters: Character[];
  setCreatorNoCastMode: import("react").Dispatch<import("react").SetStateAction<CreatorNoCastMode>>;
  stopDialoguePlayback: () => void;
  stopStoryPlayback: () => void;
  setNarratorSettings: import("react").Dispatch<import("react").SetStateAction<NarratorSettings>>;
  clearAllSceneAudioData: () => void;
  clearAllSceneDialogueAudioData: () => void;
  clearAllSceneTimingData: () => void;
  scrollCreatorWorkspaceTo: (targetId: string) => void;
  addCharacter: () => void;
  setCharacters: import("react").Dispatch<import("react").SetStateAction<Character[]>>;
  creatorBrandConfigured: boolean;
  creatorProfile: CreatorProfile;
  setCreatorProfile: import("react").Dispatch<import("react").SetStateAction<CreatorProfile>>;
  saveCreatorProfile: () => void;
  creatorVisualDirectionConfigured: boolean;
  visualBible: VisualBible | null;
  setVisualBible: import("react").Dispatch<import("react").SetStateAction<VisualBible | null>>;
  emptyVisualBible: VisualBible;
  ui: { accessoryPlaceholder: string; appearancePlaceholder: string; cameraPlaceholder: string; cancel: string; characterLabel: string; consistencyRulesPlaceholder: string; creatingMovie: string; generateReferenceImage: string; namePlaceholder: string; outfitPlaceholder: string; palettePlaceholder: string; personalityPlaceholder: string; preparingReferenceImage: string; referenceImageAlt: string; sceneEditPlaceholder: string; stylePlaceholder: string; updateScene: string; updating: string; };
  getEffectiveNarratorVoiceProfileId: (scene?: Scene) => CreatorVoiceSelectionId;
  applyCreatorVoiceProfile: (profileId: CreatorVoiceSelectionId, role: "narrator" | "dialogue") => void;
  getEffectiveDialogueVoiceProfileId: (scene?: Scene) => CreatorVoiceSelectionId;
  narratorSettings: NarratorSettings;
  openCreatorVoiceLibrary: (target: CreatorVoicePickerTarget) => void;
  creatorBoundDialogueCharacterIds: Set<string>;
  creatorResolvedCharacterVoiceCount: number;
  getCreatorVoiceCreditEstimate: (targetScenes: Scene[]) => { narrationTracks: number; dialogueTracks: number; totalTracks: number; totalCredits: number; };
  updateCharacter: <K extends keyof Character>(index: number, field: K, value: Character[K]) => void;
  generateCharacterReference: (index: number) => Promise<void>;
  characterLoadingIndex: number | null;
  removeCharacter: (index: number) => void;
  creatorBackgroundMusicHydrationRevision: number;
  creatorAudioTimeline: CreatorAudioTimeline | null | undefined;
  getAccessTokenOrThrow: () => Promise<string>;
  creatorContentType: CreatorContentType;
  creatorOutcome: CreatorOutcome | undefined;
  input: string;
  setCreatorBackgroundMusic: import("react").Dispatch<import("react").SetStateAction<CreatorBackgroundMusicConfig>>;
  applyCreatorAudioTimelineChange: (nextTimeline: CreatorAudioTimeline) => void;
  setCreatorProjectContinuityMode: import("react").Dispatch<import("react").SetStateAction<CreatorProjectContinuityMode>>;
  creatorProjectContinuityMode: CreatorProjectContinuityMode;
  creatorSceneHydrationAuthority: CreatorSceneHydrationAuthority;
  buildStory: () => Promise<void>;
  buildingStory: boolean;
  visualAssetReadyCount: number;
  audioReadyCount: number;
  creatorFinalVideoProgressDetail: "Ready" | "Hazır" | "Music confirmation required" | "Müzik onayı gerekli" | "Ready to build" | "Oluşturmaya hazır" | "Waiting for assets" | "Varlıklar bekleniyor";
  playWholeStory: () => Promise<void>;
  isPlayingStory: boolean;
  isPreparingAudio: boolean;
  playingDialogueSceneId: number | null;
  loadingAudioSceneId: number | null;
  creatorVisualsComplete: boolean;
  creatorTimelineNeedsAttention: boolean;
  creatorVoiceOverComplete: boolean;
  creatorMotionRequired: boolean;
  creatorRoutedMotionSceneIds: number[];
  creatorMotionReadyCount: number;
  creatorMotionComplete: boolean;
  creatorProductionComplete: boolean;
  creatorNextProductionAction: { title: string; description: string; buttonLabel: string; };
  continueCreatorProduction: () => Promise<void>;
  creatorMediaPreflightLoading: boolean;
  isBatchRendering: boolean;
  isExportingMovie: boolean;
  creatorTimelineMediaGate: { status: "not_applicable"; approved: boolean; title: string; message: string; action: string; } | { status: "auto_managed"; approved: boolean; title: string; message: string; action: string; } | { status: "safe"; approved: boolean; title: string; message: string; action: string; };
  getCreatorScrollBehavior: () => ScrollBehavior;
  creatorHasFinalVideo: boolean;
  creatorFinalVideoNeedsRebuild: boolean;
  exportMovieResult: ExportMovieResult | null;
  exportedMovieUrl: string;
  creatorEditorOpen: boolean;
  setCreatorEditorOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  handleExportMovie: (forceRebuild?: boolean) => Promise<void>;
  selectedCreatorEditorSceneId: string | null;
  setSelectedCreatorEditorSceneId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  moveSelectedCreatorEditorScene: (direction: "earlier" | "later") => void;
  addCreatorEditorScene: () => void;
  duplicateSelectedCreatorEditorScene: () => void;
  deleteSelectedCreatorEditorScene: () => void;
  undoLastCreatorChange: () => void;
  creatorUndoStack: CreatorUndoEntry[];
  updateSelectedCreatorSceneTrim: (trim: { clipInSec?: number; clipOutSec?: number; sourceDurationSec?: number; }) => void;
  saveSelectedCreatorSceneText: (edit: { text: string; narration: string; dialogue: string; }) => void;
  getCreatorNarrationAudioCurrentness: (scene: Scene) => import("@/lib/creator/editorState").CreatorAudioCurrentness;
  getCreatorDialogueAudioCurrentness: (scene: Scene) => import("@/lib/creator/editorState").CreatorAudioCurrentness;
  getCreatorVideoState: (scene: Scene) => CreatorVideoCurrentness;
  flowContinuityAudit: FlowContinuityAuditReport | null;
  handleGenerateVideo: (sceneId: number, options?: { skipDispatchCountdown?: boolean; creatorOperationId?: string; batchChildOperationKey?: string; }) => Promise<boolean>;
  restoreCreatorSceneAsset: (sceneId: number, asset: CreatorSceneAssetVersion) => false | undefined;
  reuseCreatorProjectImage: (targetCreatorSceneId: string, imageUrl: string, sourceCreatorSceneId: string) => void;
  onUseCreatorStockMedia: (targetCreatorSceneId: string, asset: { publicUrl: string; mediaType: "photo" | "video"; durationSeconds: number | null; attributionText: string; }) => void;
  removeCreatorProjectHistoryUrl: (removedUrl: string) => void;
  creatorSceneStructuralOperationsDisabled: boolean;
  activeVisualGenerationSceneIds: readonly number[];
  creatorGeneratingVisualSceneIds: readonly number[];
  creatorSelectedSceneIds: number[];
  creatorVisualDispatchCountdown: ImageDispatchCountdown | null;
  videoDispatchCountdown: VideoDispatchCountdown | null;
  cancelPendingVideoDispatch: () => void;
  cancelPendingImageDispatch: () => void;
  creatorSelectedMissingVisualCount: number;
  creatorSelectedMissingVoiceCount: number;
  creatorSelectedVisualSourceMethod: "ai_image" | "ai_video" | "stock" | "recommended" | "upload" | null;
  setCreatorScenesVisualSourceMethod: (sceneIds: number[], method: CreatorVisualSourceMethod) => void;
  creatorQualityMode: CreatorQualityMode;
  setCreatorScenesRenderMode: (sceneIds: number[], renderMode: "image" | "video") => void;
  generateSelectedSceneVisuals: (sceneIdsOverride?: number[]) => Promise<boolean>;
  prepareSelectedSceneAudio: (sceneIdsOverride?: number[]) => Promise<boolean>;
  setCreatorSelectedSceneIds: import("react").Dispatch<import("react").SetStateAction<number[]>>;
  creatorSceneProductionSummaries: { id: number; number: number; title: string; status: import("@/components/create/CreatorSceneProductionStatus").CreatorSceneTriageStatus; readySteps: number; totalSteps: 3; durationSec: number; outputType: "image" | "video"; productionTreatment: string | undefined; productionExplanation: string | undefined; reviewReasons: import("@/lib/creator/sceneReviewReasons").CreatorSceneReviewReason[]; reviewAdvisories: import("@/lib/creator/sceneReviewReasons").CreatorSceneReviewReason[]; }[];
  creatorFocusedSceneId: number | null;
  setCreatorFocusedSceneId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  creatorSelectedSceneIdSet: Set<number>;
  toggleCreatorSceneSelection: (sceneId: number) => void;
  getSceneVoiceStatus: (scene: Scene) => boolean;
  creatorRoutedMotionSceneIdSet: Set<number>;
  creatorRecommendedMotionSceneIdSet: Set<number>;
  sceneScriptDrafts: Record<number, CreatorSceneScriptDraft>;
  sceneScriptFitFeedback: Record<number, CreatorSceneScriptFitFeedback>;
  assessCreatorSceneScriptDraft: ({ scene, draft, language, qualityMode, }: { scene: Scene; draft: CreatorSceneScriptDraft; language: ContentLanguage; qualityMode: CreatorQualityMode; }) => CreatorScriptHealth;
  language: ContentLanguage;
  normalizeCreatorScriptText: (value: string) => string;
  editingSceneId: number | null;
  creatorSceneInspectorTabs: Record<number, CreatorSceneInspectorTab>;
  creatorSceneVisualOperations: Record<number, CreatorSceneVisualOperation>;
  creatorSceneVisualCountdownSceneIds: number[];
  creatorVisualGenerationPhase: "idle" | "processing" | "countdown";
  creatorProcessingVisualSceneIds: number[];
  creatorSceneVideoSourceDurations: Record<string, { videoUrl: string; durationSec: number; }>;
  getSceneAudioStatus: (scene: Scene) => boolean;
  getSceneDialogueAudioStatus: (scene: Scene) => boolean;
  getCreatorSceneVoiceContext: ({ scene, role, text, companionText, hasExplicitVoiceId, voiceProfile, }: { scene: Scene; role: "narrator" | "dialogue"; text: string; companionText?: string; hasExplicitVoiceId: boolean; voiceProfile: string; }) => import("@/lib/creator/voiceRouting").CreatorVoiceRoute | null;
  getCreatorNarratorProfileHint: () => string;
  creatorAssetCompareSelection: Record<number, string[]>;
  getCreatorSceneContinuityMode: (scene: Pick<Scene, "id" | "continuityMode">) => CreatorSceneContinuityMode;
  cancelCreatorSceneVisualCountdown: (sceneId: number) => void;
  setCreatorSceneInspectorTabs: import("react").Dispatch<import("react").SetStateAction<Record<number, CreatorSceneInspectorTab>>>;
  runCreatorRecommendedVisualGeneration: ({ mode, sceneIds, }: { mode: CreatorVisualGenerationMode; sceneIds: number[]; }) => Promise<boolean>;
  redrawLoadingId: number | null;
  loadingDialogueSceneId: number | null;
  imageDispatchCountdown: ImageDispatchCountdown | null;
  creatorOpeningHookOptions: string[];
  stageCreatorOpeningHookDraft: (scene: Scene, hook: string) => void;
  openCreatorSceneEditor: (scene: Scene) => void;
  deleteCreatorScene: (creatorSceneId: string) => void;
  setSceneScriptDrafts: import("react").Dispatch<import("react").SetStateAction<Record<number, CreatorSceneScriptDraft>>>;
  autoFitCreatorSceneScript: (sceneId: number) => Promise<void>;
  sceneScriptFitLoadingId: number | null;
  splitCreatorScene: (sceneId: number) => void;
  saveCreatorSceneScript: (sceneId: number, draftOverride?: CreatorSceneScriptDraft) => boolean;
  setEditingSceneId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setScenes: import("react").Dispatch<import("react").SetStateAction<Scene[]>>;
  setSaveMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  sceneInstructions: Record<number, string>;
  setSceneInstructions: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  updateScene: (sceneId: number) => Promise<void>;
  sceneLoadingId: number | null;
  onUseCreatorUploadedMedia: (sceneId: number, asset: CreatorUploadedMedia) => void;
  removeCreatorUploadedMediaFromScene: (sceneId: number) => void;
  creatorSceneVideoPreviewRefs: import("react").RefObject<Record<string, HTMLVideoElement | null>>;
  setCreatorSceneVideoSourceDurations: import("react").Dispatch<import("react").SetStateAction<Record<string, { videoUrl: string; durationSec: number; }>>>;
  setCreatorAssetHistoryOpen: import("react").Dispatch<import("react").SetStateAction<Record<number, boolean>>>;
  updateCreatorSceneTrim: ({ creatorSceneId, clipInSec, clipOutSec, sourceDurationSec, verifiedSourceDurationSec, }: { creatorSceneId: string; clipInSec?: number; clipOutSec?: number; sourceDurationSec?: number; verifiedSourceDurationSec?: number; }) => void;
  requestCancelSceneVideo: (scene: Scene, options?: { confirm?: boolean; silent?: boolean; }) => Promise<boolean>;
  cancellingVideoSceneId: number | null;
  creatorAssetHistoryOpen: Record<number, boolean>;
  formatCreatorAssetTimestamp: (value: string, language: "tr" | "en") => string;
  toggleCreatorAssetCompare: (sceneId: number, assetId: string) => void;
  returnCreatorSceneToRecommendedOutput: (sceneId: number) => void;
  setCreatorSceneRenderMode: (sceneId: number, renderMode: "image" | "video") => void;
  creatorVideoSelectionBlockedByQuality: boolean;
  updateCreatorSceneContinuityMode: (sceneId: number, mode: CreatorSceneContinuityMode) => void;
  getCreatorResolvedContinuityMode: (scene: Pick<Scene, "id" | "continuityMode">) => "independent" | "consistent" | "previous";
  editCreatorSceneVisualDirectionWithAI: (scene: Scene) => Promise<void>;
  creatorVisualDirectionLoadingId: number | null;
  buildSceneTimingForCurrentFlow: (narrationDuration: number, dialogueDuration: number, scene?: Scene, measuredAudioCurrent?: boolean) => SceneTiming;
  getEffectiveNarratorVoiceSelection: (scene?: Scene) => CreatorVoiceLibrarySelection | undefined;
  getEffectiveDialogueVoiceSelection: (scene?: Scene) => CreatorVoiceLibrarySelection | undefined;
  playNarration: (sceneId: number, narration: string) => Promise<void>;
  playingSceneId: number | null;
  playSceneDialogue: (scene: Scene) => Promise<void>;
  CREATOR_SPEECH_TAIL_BUFFER_SECONDS: 0.75;
};

export default function CreatorProductionPanel({
  creatorProductionSubstep,
  uiLanguage,
  creatorProductionPackage,
  CREATOR_FORMAT_OPTIONS,
  creatorFormat,
  getCreatorDurationLabel,
  scenes,
  getCreatorQualityModeLabel,
  currentProjectId,
  creatorStageVisibility,
  creatorPresentationModeLabel,
  creatorCharacterVoiceSummary,
  creatorMusicSummary,
  creatorContinuitySummary,
  selectCreatorProductionSubstep,
  creatorProductionSetupPresentation,
  creatorNarratorSummary,
  creatorMusicConfirmationRequired,
  creatorProductionCustomizeOpen,
  setCreatorProductionCustomizeOpen,
  creatorPresentationMode,
  characters,
  setCreatorNoCastMode,
  stopDialoguePlayback,
  stopStoryPlayback,
  setNarratorSettings,
  clearAllSceneAudioData,
  clearAllSceneDialogueAudioData,
  clearAllSceneTimingData,
  scrollCreatorWorkspaceTo,
  addCharacter,
  setCharacters,
  creatorBrandConfigured,
  creatorProfile,
  setCreatorProfile,
  saveCreatorProfile,
  creatorVisualDirectionConfigured,
  visualBible,
  setVisualBible,
  emptyVisualBible,
  ui,
  getEffectiveNarratorVoiceProfileId,
  applyCreatorVoiceProfile,
  getEffectiveDialogueVoiceProfileId,
  narratorSettings,
  openCreatorVoiceLibrary,
  creatorBoundDialogueCharacterIds,
  creatorResolvedCharacterVoiceCount,
  getCreatorVoiceCreditEstimate,
  updateCharacter,
  generateCharacterReference,
  characterLoadingIndex,
  removeCharacter,
  creatorBackgroundMusicHydrationRevision,
  creatorAudioTimeline,
  getAccessTokenOrThrow,
  creatorContentType,
  creatorOutcome,
  input,
  setCreatorBackgroundMusic,
  applyCreatorAudioTimelineChange,
  setCreatorProjectContinuityMode,
  creatorProjectContinuityMode,
  creatorSceneHydrationAuthority,
  buildStory,
  buildingStory,
  visualAssetReadyCount,
  audioReadyCount,
  creatorFinalVideoProgressDetail,
  playWholeStory,
  isPlayingStory,
  isPreparingAudio,
  playingDialogueSceneId,
  loadingAudioSceneId,
  creatorVisualsComplete,
  creatorTimelineNeedsAttention,
  creatorVoiceOverComplete,
  creatorMotionRequired,
  creatorRoutedMotionSceneIds,
  creatorMotionReadyCount,
  creatorMotionComplete,
  creatorProductionComplete,
  creatorNextProductionAction,
  continueCreatorProduction,
  creatorMediaPreflightLoading,
  isBatchRendering,
  isExportingMovie,
  creatorTimelineMediaGate,
  getCreatorScrollBehavior,
  creatorHasFinalVideo,
  creatorFinalVideoNeedsRebuild,
  exportMovieResult,
  exportedMovieUrl,
  creatorEditorOpen,
  setCreatorEditorOpen,
  handleExportMovie,
  selectedCreatorEditorSceneId,
  setSelectedCreatorEditorSceneId,
  moveSelectedCreatorEditorScene,
  addCreatorEditorScene,
  duplicateSelectedCreatorEditorScene,
  deleteSelectedCreatorEditorScene,
  undoLastCreatorChange,
  creatorUndoStack,
  updateSelectedCreatorSceneTrim,
  saveSelectedCreatorSceneText,
  getCreatorNarrationAudioCurrentness,
  getCreatorDialogueAudioCurrentness,
  getCreatorVideoState,
  flowContinuityAudit,
  handleGenerateVideo,
  restoreCreatorSceneAsset,
  reuseCreatorProjectImage,
  onUseCreatorStockMedia,
  removeCreatorProjectHistoryUrl,
  creatorSceneStructuralOperationsDisabled,
  activeVisualGenerationSceneIds,
  creatorGeneratingVisualSceneIds,
  creatorSelectedSceneIds,
  creatorVisualDispatchCountdown,
  videoDispatchCountdown,
  cancelPendingVideoDispatch,
  cancelPendingImageDispatch,
  creatorSelectedMissingVisualCount,
  creatorSelectedMissingVoiceCount,
  creatorSelectedVisualSourceMethod,
  setCreatorScenesVisualSourceMethod,
  creatorQualityMode,
  setCreatorScenesRenderMode,
  generateSelectedSceneVisuals,
  prepareSelectedSceneAudio,
  setCreatorSelectedSceneIds,
  creatorSceneProductionSummaries,
  creatorFocusedSceneId,
  setCreatorFocusedSceneId,
  creatorSelectedSceneIdSet,
  toggleCreatorSceneSelection,
  getSceneVoiceStatus,
  creatorRoutedMotionSceneIdSet,
  creatorRecommendedMotionSceneIdSet,
  sceneScriptDrafts,
  sceneScriptFitFeedback,
  assessCreatorSceneScriptDraft,
  language,
  normalizeCreatorScriptText,
  editingSceneId,
  creatorSceneInspectorTabs,
  creatorSceneVisualOperations,
  creatorSceneVisualCountdownSceneIds,
  creatorVisualGenerationPhase,
  creatorProcessingVisualSceneIds,
  creatorSceneVideoSourceDurations,
  getSceneAudioStatus,
  getSceneDialogueAudioStatus,
  getCreatorSceneVoiceContext,
  getCreatorNarratorProfileHint,
  creatorAssetCompareSelection,
  getCreatorSceneContinuityMode,
  cancelCreatorSceneVisualCountdown,
  setCreatorSceneInspectorTabs,
  runCreatorRecommendedVisualGeneration,
  redrawLoadingId,
  loadingDialogueSceneId,
  imageDispatchCountdown,
  creatorOpeningHookOptions,
  stageCreatorOpeningHookDraft,
  openCreatorSceneEditor,
  deleteCreatorScene,
  setSceneScriptDrafts,
  autoFitCreatorSceneScript,
  sceneScriptFitLoadingId,
  splitCreatorScene,
  saveCreatorSceneScript,
  setEditingSceneId,
  setScenes,
  setSaveMessage,
  sceneInstructions,
  setSceneInstructions,
  updateScene,
  sceneLoadingId,
  onUseCreatorUploadedMedia,
  removeCreatorUploadedMediaFromScene,
  creatorSceneVideoPreviewRefs,
  setCreatorSceneVideoSourceDurations,
  setCreatorAssetHistoryOpen,
  updateCreatorSceneTrim,
  requestCancelSceneVideo,
  cancellingVideoSceneId,
  creatorAssetHistoryOpen,
  formatCreatorAssetTimestamp,
  toggleCreatorAssetCompare,
  returnCreatorSceneToRecommendedOutput,
  setCreatorSceneRenderMode,
  creatorVideoSelectionBlockedByQuality,
  updateCreatorSceneContinuityMode,
  getCreatorResolvedContinuityMode,
  editCreatorSceneVisualDirectionWithAI,
  creatorVisualDirectionLoadingId,
  buildSceneTimingForCurrentFlow,
  getEffectiveNarratorVoiceSelection,
  getEffectiveDialogueVoiceSelection,
  playNarration,
  playingSceneId,
  playSceneDialogue,
  CREATOR_SPEECH_TAIL_BUFFER_SECONDS,
}: CreatorProductionPanelProps) {
  return (
<section id="creatorlab-production-canvas" className="creatorlab-production-experience">
            <header className="creatorlab-production-heading">
              <div>
                <p className="creatorlab-production-kicker">
                  {creatorProductionSubstep === "setup"
                    ? uiLanguage === "en" ? "Step 3 · Production Setup" : "Adım 3 · Üretim Kurulumu"
                    : uiLanguage === "en" ? "Step 4 · Create & Review" : "Adım 4 · Üret ve İncele"}
                </p>
                <h1>{creatorProductionPackage.title}</h1>
                <div className="creatorlab-p2c-production-header-meta" aria-label={uiLanguage === "en" ? "Current production plan" : "Mevcut üretim planı"}>
                  <span>{CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label || creatorFormat}</span>
                  <span>{getCreatorDurationLabel()}</span>
                  <span>{scenes.length} {uiLanguage === "en" ? "scenes" : "sahne"}</span>
                  <span>{getCreatorQualityModeLabel()}</span>
                </div>
              </div>
              <span className="creatorlab-production-stage-badge">
                {scenes.length > 0
                  ? uiLanguage === "en" ? `${scenes.length} scenes planned` : `${scenes.length} sahne planlandı`
                  : uiLanguage === "en" ? "Plan approved" : "Plan onaylandı"}
              </span>
            </header>

            {currentProjectId && (
              <CreatorProductionHistory
                projectId={currentProjectId}
                language={uiLanguage === "en" ? "en" : "tr"}
              />
            )}

            {creatorStageVisibility.create_review && (
              <>
                <CreatorProductionSetupSummary
                  title={creatorProductionPackage.title}
                  premise={creatorProductionPackage.storyPremise}
                  format={CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label || creatorFormat}
                  runtime={getCreatorDurationLabel()}
                  quality={getCreatorQualityModeLabel()}
                  approach={creatorPresentationModeLabel}
                  castSummary={creatorCharacterVoiceSummary}
                  music={creatorMusicSummary}
                  continuity={creatorContinuitySummary}
                  sceneCount={scenes.length}
                  onEdit={() => selectCreatorProductionSubstep("setup")}
                  language={uiLanguage === "en" ? "en" : "tr"}
                />
              </>
            )}

            {creatorStageVisibility.production_setup && (
              <div className="creatorlab-setup-shell" data-production-substep="setup">
                <section className="creatorlab-setup-recommendation" aria-labelledby="creatorlab-setup-recommendation-title">
                  <div className="creatorlab-setup-recommendation-copy">
                    <span className="creatorlab-setup-recommendation-kicker">
                      {uiLanguage === "en" ? "Recommended setup" : "Önerilen kurulum"}
                    </span>
                    <h2 id="creatorlab-setup-recommendation-title">
                      {creatorProductionSetupPresentation.headline}
                    </h2>
                    <p>
                      {uiLanguage === "en"
                        ? "Optimized for this format, quality mode and current project settings."
                        : "Bu format, kalite modu ve mevcut proje ayarları için optimize edildi."}
                    </p>
                  </div>
                  <div className="creatorlab-setup-summary-grid" aria-label={uiLanguage === "en" ? "Current production setup" : "Mevcut üretim kurulumu"}>
                    <div><span>{uiLanguage === "en" ? "Presentation" : "Sunum"}</span><strong>{creatorPresentationModeLabel}</strong></div>
                    <div><span>{uiLanguage === "en" ? "Narrator" : "Anlatıcı"}</span><strong>{creatorNarratorSummary}</strong></div>
                    <div><span>{uiLanguage === "en" ? "Music" : "Müzik"}</span><strong>{creatorMusicSummary}</strong></div>
                    <div><span>{uiLanguage === "en" ? "Continuity" : "Devamlılık"}</span><strong>{creatorContinuitySummary}</strong></div>
                    <div className="creatorlab-setup-summary-visual"><span>{uiLanguage === "en" ? "Visual style" : "Görsel stil"}</span><strong>{creatorProductionSetupPresentation.visualStyleSummary}</strong></div>
                  </div>
                  {creatorProductionSetupPresentation.actionRequired && (
                    <div className="creatorlab-setup-action-required" role="alert">
                      <strong>{uiLanguage === "en" ? "Action required" : "Aksiyon gerekli"}</strong>
                      <span>{uiLanguage === "en" ? "Confirm the selected premium music before final production." : "Final üretimden önce seçilen premium müziği onayla."}</span>
                    </div>
                  )}
                </section>

                <details
                  id="creatorlab-production-customize"
                  className={`creatorlab-setup-customize ${creatorMusicConfirmationRequired ? "has-action-required" : ""}`}
                  open={creatorProductionCustomizeOpen}
                  onToggle={(event) =>
                    setCreatorProductionCustomizeOpen(event.currentTarget.open)
                  }
                >
                  <summary>
                    <div>
                      <strong>{uiLanguage === "en" ? "Customize production" : "Üretimi özelleştir"}</strong>
                      <span>{uiLanguage === "en" ? "Presentation, brand, voice, music and continuity" : "Sunum, marka, ses, müzik ve devamlılık"}</span>
                    </div>
                  </summary>
                  <div className="creatorlab-setup-customize-body">
                <div id="creatorlab-cast-brand" className="space-y-5">
                  <div className="creatorlab-cast-brand-body">

                <section className="creatorlab-cast-brand-section creatorlab-setup-group" data-setup-group="presentation-cast">
                  <div className="creatorlab-setup-group-label">
                    <strong>{uiLanguage === "en" ? "Presentation & Cast" : "Sunum ve Kadro"}</strong>
                    <span>{creatorPresentationModeLabel}</span>
                  </div>
                  <div className="creatorlab-cast-brand-section-heading">
                    <div>
                      <span>{uiLanguage === "en" ? "Production approach" : "Üretim yaklaşımı"}</span>
                      <h3>{uiLanguage === "en" ? "Choose how the audience experiences the story" : "Kitlenin hikâyeyi nasıl deneyimleyeceğini seç"}</h3>
                      <p>{uiLanguage === "en" ? "The current approach is inferred from the active cast and narrator configuration." : "Mevcut yaklaşım aktif kadro ve anlatıcı yapılandırmasından otomatik belirlenir."}</p>
                    </div>
                    <span className="creatorlab-cast-brand-current-mode">{creatorPresentationModeLabel}</span>
                  </div>

                  <div className="creatorlab-presentation-mode-grid">
                    <button
                      type="button"
                      className={`creatorlab-presentation-mode ${creatorPresentationMode === "faceless" ? "is-selected" : ""}`}
                      disabled={characters.length > 0}
                      onClick={() => {
                        setCreatorNoCastMode("faceless");
                        stopDialoguePlayback();
                        stopStoryPlayback();
                        setNarratorSettings((current) => ({ ...current, voiceId: "", voiceSelection: undefined }));
                        clearAllSceneAudioData();
                        clearAllSceneDialogueAudioData();
                        clearAllSceneTimingData();
                      }}
                    >
                      <span className="creatorlab-presentation-mode-mark">F</span>
                      <strong>{uiLanguage === "en" ? "Faceless" : "Faceless"}</strong>
                      <small>{uiLanguage === "en" ? "Visual storytelling without a recurring on-screen identity." : "Tekrar eden ekran kimliği olmadan görsel anlatım."}</small>
                    </button>

                    <button
                      type="button"
                      className={`creatorlab-presentation-mode ${creatorPresentationMode === "narrator" ? "is-selected" : ""}`}
                      disabled={characters.length > 0}
                      onClick={() => {
                        setCreatorNoCastMode("narrator");
                        scrollCreatorWorkspaceTo("creatorlab-cast-voice");
                      }}
                    >
                      <span className="creatorlab-presentation-mode-mark">N</span>
                      <strong>{uiLanguage === "en" ? "Narrator-led" : "Anlatıcı odaklı"}</strong>
                      <small>{uiLanguage === "en" ? "A consistent voice leads the video without an on-screen host." : "Ekran sunucusu olmadan tutarlı bir ses videoyu yönlendirir."}</small>
                    </button>

                    <button
                      type="button"
                      className={`creatorlab-presentation-mode ${creatorPresentationMode === "presenter" ? "is-selected" : ""}`}
                      onClick={() => {
                        if (characters.length === 0) {
                          addCharacter();
                        }
                        scrollCreatorWorkspaceTo("creatorlab-cast-list");
                      }}
                    >
                      <span className="creatorlab-presentation-mode-mark">P</span>
                      <strong>{uiLanguage === "en" ? "Presenter-led" : "Sunucu odaklı"}</strong>
                      <small>{uiLanguage === "en" ? "One recognizable host or persona anchors the production." : "Tek bir tanınabilir sunucu veya persona üretimi taşır."}</small>
                    </button>

                    <button
                      type="button"
                      className={`creatorlab-presentation-mode ${creatorPresentationMode === "ensemble" ? "is-selected" : ""}`}
                      onClick={() => {
                        addCharacter();
                        scrollCreatorWorkspaceTo("creatorlab-cast-list");
                      }}
                    >
                      <span className="creatorlab-presentation-mode-mark">C</span>
                      <strong>{uiLanguage === "en" ? "Cast-led" : "Kadrolu anlatım"}</strong>
                      <small>{uiLanguage === "en" ? "Multiple presenters or recurring characters share the story." : "Birden fazla sunucu veya tekrar eden karakter hikâyeyi paylaşır."}</small>
                    </button>
                  </div>

                  {characters.length > 0 && (
                    <div className="creatorlab-cast-presence-note">
                      <div>
                        <strong>{characters.length} {uiLanguage === "en" ? characters.length === 1 ? "cast member is active" : "cast members are active" : "kadro üyesi aktif"}</strong>
                        <p>{uiLanguage === "en" ? "Faceless and narrator-led modes become available after the active cast is removed." : "Faceless ve anlatıcı odaklı modlar aktif kadro kaldırıldıktan sonra kullanılabilir."}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCharacters([]);
                          setCreatorNoCastMode("faceless");
                        }}
                      >
                        {uiLanguage === "en" ? "Clear active cast" : "Aktif kadroyu temizle"}
                      </button>
                    </div>
                  )}
                </section>

                <section className="creatorlab-setup-group space-y-3" data-setup-group="brand-visual">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {uiLanguage === "en" ? "Brand & Visual Direction" : "Marka ve Görsel Yön"}
                    </span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {uiLanguage === "en" ? "Set the identity, style and atmosphere shared across the project." : "Proje genelinde kullanılan kimliği, stili ve atmosferi belirle."}
                    </p>
                  </div>
                  <div className="creatorlab-cast-brand-grid">
                  <section className="creatorlab-cast-brand-card">
                    <div className="creatorlab-cast-brand-card-heading">
                      <span>{uiLanguage === "en" ? "Brand foundation" : "Marka temeli"}</span>
                      <strong>{creatorBrandConfigured ? (uiLanguage === "en" ? "Configured" : "Yapılandırıldı") : (uiLanguage === "en" ? "Optional" : "Opsiyonel")}</strong>
                    </div>
                    <label>
                      <span>{uiLanguage === "en" ? "Creator or brand name" : "Creator veya marka adı"}</span>
                      <input
                        value={creatorProfile.brandName}
                        onChange={(event) => setCreatorProfile((current) => ({ ...current, brandName: event.target.value }))}
                        placeholder={uiLanguage === "en" ? "Example: Northstar Studio" : "Örnek: Northstar Studio"}
                      />
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Brand voice" : "Marka sesi"}</span>
                      <textarea
                        value={creatorProfile.brandVoice}
                        onChange={(event) => setCreatorProfile((current) => ({ ...current, brandVoice: event.target.value }))}
                        placeholder={uiLanguage === "en" ? "Clear, expert, confident and human — never sensational." : "Net, uzman, güven veren ve insani — sansasyonel değil."}
                      />
                    </label>
                    <button type="button" className="creatorlab-cast-brand-save" onClick={saveCreatorProfile}>
                      {uiLanguage === "en" ? "Save brand defaults" : "Marka varsayılanlarını kaydet"}
                    </button>
                  </section>

                  <section className="creatorlab-cast-brand-card">
                    <div className="creatorlab-cast-brand-card-heading">
                      <span>{uiLanguage === "en" ? "Visual direction" : "Görsel yön"}</span>
                      <strong>{creatorVisualDirectionConfigured ? (uiLanguage === "en" ? "Configured" : "Yapılandırıldı") : (uiLanguage === "en" ? "Optional" : "Opsiyonel")}</strong>
                    </div>
                    <label>
                      <span>{uiLanguage === "en" ? "Visual style" : "Görsel stil"}</span>
                      <textarea
                        value={visualBible?.style || ""}
                        onChange={(event) => setVisualBible((current) => ({ ...(current || emptyVisualBible), style: event.target.value }))}
                        placeholder={ui.stylePlaceholder}
                      />
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Palette and atmosphere" : "Palet ve atmosfer"}</span>
                      <textarea
                        value={visualBible?.palette || ""}
                        onChange={(event) => setVisualBible((current) => ({ ...(current || emptyVisualBible), palette: event.target.value }))}
                        placeholder={ui.palettePlaceholder}
                      />
                    </label>
                    <details className="creatorlab-cast-brand-nested-details">
                      <summary>{uiLanguage === "en" ? "Advanced" : "Gelişmiş"}</summary>
                      <div>
                        <label>
                          <span>{uiLanguage === "en" ? "Camera language" : "Kamera dili"}</span>
                          <textarea
                            value={visualBible?.camera || ""}
                            onChange={(event) => setVisualBible((current) => ({ ...(current || emptyVisualBible), camera: event.target.value }))}
                            placeholder={ui.cameraPlaceholder}
                          />
                        </label>
                        <label>
                          <span>{uiLanguage === "en" ? "Consistency rules" : "Tutarlılık kuralları"}</span>
                          <textarea
                            value={visualBible?.consistencyRules || ""}
                            onChange={(event) => setVisualBible((current) => ({ ...(current || emptyVisualBible), consistencyRules: event.target.value }))}
                            placeholder={ui.consistencyRulesPlaceholder}
                          />
                        </label>
                      </div>
                    </details>
                  </section>
                  </div>
                </section>

                <section id="creatorlab-cast-voice" className="creatorlab-cast-brand-section creatorlab-voice-direction-section creatorlab-setup-group" data-setup-group="voice">
                  <div className="creatorlab-setup-group-label">
                    <strong>{uiLanguage === "en" ? "Voice" : "Ses"}</strong>
                    <span>{creatorNarratorSummary}</span>
                  </div>
                  <div className="creatorlab-cast-brand-section-heading">
                    <div>
                      <span>{uiLanguage === "en" ? "Cast & Voices" : "Kadro ve Sesler"}</span>
                      <h3>{uiLanguage === "en" ? "Set narration, character defaults and individual voices" : "Anlatımı, karakter varsayılanını ve bireysel sesleri ayarla"}</h3>
                      <p>{uiLanguage === "en" ? "Characters inherit the default unless you choose an individual voice." : "Bireysel bir ses seçmediğin karakterler varsayılan sesi kullanır."}</p>
                    </div>
                    <span className="creatorlab-cast-brand-current-mode">
                      {getCreatorVoiceSelectionLabel(
                        getEffectiveNarratorVoiceProfileId(),
                        uiLanguage === "en" ? "en" : "tr",
                      )}
                    </span>
                  </div>

                  <div className="creatorlab-voice-direction-grid">
                    <label>
                      <span>{uiLanguage === "en" ? "Narrator delivery style" : "Anlatıcı ifade stili"}</span>
                      <select
                        value={getEffectiveNarratorVoiceProfileId()}
                        onChange={(event) =>
                          applyCreatorVoiceProfile(
                            event.target.value as CreatorVoiceSelectionId,
                            "narrator",
                          )
                        }
                      >
                        {CREATOR_VOICE_SELECTIONS.map((profile) => (
                          <option key={`narrator-${profile.id}`} value={profile.id}>
                            {uiLanguage === "en" ? profile.labelEn : profile.labelTr}
                          </option>
                        ))}
                      </select>
                      <small>
                        {uiLanguage === "en"
                          ? getCreatorVoiceSelection(getEffectiveNarratorVoiceProfileId()).descriptionEn
                          : getCreatorVoiceSelection(getEffectiveNarratorVoiceProfileId()).descriptionTr}
                      </small>
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Default character delivery style" : "Varsayılan karakter ifade stili"}</span>
                      <select
                        value={getEffectiveDialogueVoiceProfileId()}
                        onChange={(event) =>
                          applyCreatorVoiceProfile(
                            event.target.value as CreatorVoiceSelectionId,
                            "dialogue",
                          )
                        }
                      >
                        {CREATOR_VOICE_SELECTIONS.map((profile) => (
                          <option key={`dialogue-${profile.id}`} value={profile.id}>
                            {uiLanguage === "en" ? profile.labelEn : profile.labelTr}
                          </option>
                        ))}
                      </select>
                      <small>
                        {uiLanguage === "en"
                          ? getCreatorVoiceSelection(getEffectiveDialogueVoiceProfileId()).descriptionEn
                          : getCreatorVoiceSelection(getEffectiveDialogueVoiceProfileId()).descriptionTr}
                      </small>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {uiLanguage === "en" ? "Project narrator voice" : "Proje anlatıcı sesi"}
                          </span>
                          <strong className="mt-2 block text-sm text-slate-950">
                            {narratorSettings.voiceSelection?.name ||
                              (uiLanguage === "en" ? "Velto default voice" : "Velto varsayılan sesi")}
                          </strong>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {narratorSettings.voiceSelection
                              ? getVoiceLibraryDisplayMeta(narratorSettings.voiceSelection) ||
                                (uiLanguage === "en" ? "Selected from the voice library" : "Ses kütüphanesinden seçildi")
                              : uiLanguage === "en"
                                ? "Use the default or browse real voices by language, gender, accent and style."
                                : "Varsayılanı kullan veya gerçek sesleri dil, cinsiyet, aksan ve stile göre keşfet."}
                          </p>
                        </div>
                        {narratorSettings.voiceSelection && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                            {uiLanguage === "en" ? "Selected" : "Seçildi"}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreatorVoiceLibrary({ scope: "project_narrator" })}
                        className="mt-4 min-h-11 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                      >
                        {uiLanguage === "en" ? "Browse narrator voices" : "Anlatıcı seslerini keşfet"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {uiLanguage === "en" ? "Default Character Voice" : "Varsayılan Karakter Sesi"}
                          </span>
                          <strong className="mt-2 block text-sm text-slate-950">
                            {narratorSettings.dialogueVoiceSelection?.name ||
                              (uiLanguage === "en" ? "Velto default character voice" : "Velto varsayılan karakter sesi")}
                          </strong>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {narratorSettings.dialogueVoiceSelection
                              ? getVoiceLibraryDisplayMeta(narratorSettings.dialogueVoiceSelection) ||
                                (uiLanguage === "en" ? "Selected from the voice library" : "Ses kütüphanesinden seçildi")
                              : uiLanguage === "en"
                                ? "Characters can inherit this voice or use their own selection."
                                : "Karakterler bu sesi devralabilir veya kendi sesini kullanabilir."}
                          </p>
                        </div>
                        {narratorSettings.dialogueVoiceSelection && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                            {uiLanguage === "en" ? "Selected" : "Seçildi"}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreatorVoiceLibrary({ scope: "project_dialogue" })}
                        className="mt-4 min-h-11 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                      >
                        {uiLanguage === "en" ? "Browse character voices" : "Karakter seslerini keşfet"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-sm text-violet-950">
                    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 border-b border-violet-200 pb-3 text-xs font-semibold text-violet-900">
                      <span>{uiLanguage === "en" ? "Narrator voice · Ready" : "Anlatıcı sesi · Hazır"}</span>
                      <span>
                        {creatorBoundDialogueCharacterIds.size > 0
                          ? `${uiLanguage === "en" ? "Character voices" : "Karakter sesleri"} · ${creatorResolvedCharacterVoiceCount}/${creatorBoundDialogueCharacterIds.size} ${uiLanguage === "en" ? "resolved" : "çözümlendi"}`
                          : uiLanguage === "en"
                            ? characters.length === 0 ? "Character voices · Not needed for this project" : "Character voices · No character dialogue yet"
                            : characters.length === 0 ? "Karakter sesleri · Bu proje için gerekli değil" : "Karakter sesleri · Henüz karakter diyaloğu yok"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>
                        {uiLanguage === "en" ? "Voice generation" : "Ses üretimi"}
                      </strong>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800">
                        {getCreatorVoiceCreditEstimate(scenes).totalTracks} {uiLanguage === "en" ? "missing" : "eksik"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-violet-800">
                      {uiLanguage === "en"
                        ? `${getCreatorVoiceCreditEstimate(scenes).totalTracks} missing voice track(s).`
                        : `${getCreatorVoiceCreditEstimate(scenes).totalTracks} eksik ses kaydı var.`}
                    </p>
                  </div>

                  <details className="creatorlab-cast-brand-nested-details">
                    <summary>{uiLanguage === "en" ? "Advanced voice tuning" : "Gelişmiş ses ayarları"}</summary>
                    <div className="creatorlab-voice-direction-grid">
                      <label>
                        <span>{uiLanguage === "en" ? "Custom voice reference" : "Özel ses referansı"}</span>
                        <input
                          value={narratorSettings.voiceId || ""}
                          onChange={(event) => {
                            stopDialoguePlayback();
                            stopStoryPlayback();
                            setNarratorSettings((current) => ({
                              ...current,
                              voiceId: event.target.value,
                            }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                          placeholder={uiLanguage === "en" ? "Optional saved voice reference" : "Opsiyonel kayıtlı ses referansı"}
                        />
                        <small>{uiLanguage === "en" ? "Optional. Leave empty to use the selected Velto voice." : "Opsiyoneldir. Seçili Velto sesini kullanmak için boş bırak."}</small>
                      </label>
                      <label>
                        <span>{uiLanguage === "en" ? "Performance mode" : "Performans modu"}</span>
                        <select
                          value={narratorSettings.modelId}
                          onChange={(event) => {
                            stopDialoguePlayback();
                            stopStoryPlayback();
                            setNarratorSettings((current) => ({
                              ...current,
                              modelId: event.target.value,
                            }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                        >
                          <option value="eleven_multilingual_v2">{uiLanguage === "en" ? "Natural multilingual" : "Doğal çok dilli"}</option>
                          <option value="eleven_flash_v2_5">{uiLanguage === "en" ? "Fast preview" : "Hızlı önizleme"}</option>
                        </select>
                        <small>{uiLanguage === "en" ? "Natural delivery prioritizes nuance; Fast preview prioritizes speed." : "Doğal anlatım nüansı, Hızlı önizleme ise hızı önceliklendirir."}</small>
                      </label>
                    </div>
                    <div className="creatorlab-voice-tuning-grid">
                      <label>
                        <span>{uiLanguage === "en" ? "Stability" : "Stabilite"} · {narratorSettings.stability.toFixed(2)}</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={narratorSettings.stability}
                          onChange={(event) => {
                            stopDialoguePlayback();
                            stopStoryPlayback();
                            setNarratorSettings((current) => ({ ...current, stability: Number(event.target.value), advancedTuning: true }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                        />
                      </label>
                      <label>
                        <span>{uiLanguage === "en" ? "Similarity" : "Benzerlik"} · {narratorSettings.similarityBoost.toFixed(2)}</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={narratorSettings.similarityBoost}
                          onChange={(event) => {
                            stopDialoguePlayback();
                            stopStoryPlayback();
                            setNarratorSettings((current) => ({ ...current, similarityBoost: Number(event.target.value), advancedTuning: true }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                        />
                      </label>
                      <label>
                        <span>{uiLanguage === "en" ? "Expression" : "İfade"} · {(narratorSettings.style ?? 0.35).toFixed(2)}</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={narratorSettings.style ?? 0.35}
                          onChange={(event) => {
                            stopDialoguePlayback();
                            stopStoryPlayback();
                            setNarratorSettings((current) => ({ ...current, style: Number(event.target.value), advancedTuning: true }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                        />
                      </label>
                      <label>
                        <span>{uiLanguage === "en" ? "Pace" : "Tempo"} · {(narratorSettings.speed ?? 0.93).toFixed(2)}</span>
                        <input
                          type="range"
                          min="0.7"
                          max="1.2"
                          step="0.01"
                          value={narratorSettings.speed ?? 0.93}
                          onChange={(event) => {
                            stopDialoguePlayback();
                            stopStoryPlayback();
                            setNarratorSettings((current) => ({ ...current, speed: Number(event.target.value), advancedTuning: true }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                        />
                      </label>
                    </div>
                  </details>
                </section>

                <section id="creatorlab-cast-list" className="creatorlab-cast-brand-section creatorlab-cast-list-section creatorlab-setup-group" data-setup-group="presentation-cast">
                  <div className="creatorlab-cast-brand-section-heading">
                    <div>
                      <span>{uiLanguage === "en" ? "Presenters and personas" : "Sunucular ve personalar"}</span>
                      <h3>{uiLanguage === "en" ? "Manage only the identities the production needs" : "Yalnızca üretimin ihtiyaç duyduğu kimlikleri yönet"}</h3>
                      <p>{uiLanguage === "en" ? "Keep this empty for faceless or narrator-led formats. Add a presenter, expert, host or recurring character when visual continuity requires one." : "Faceless veya anlatıcı odaklı formatlar için boş bırak. Görsel süreklilik gerektirdiğinde sunucu, uzman, host veya tekrar eden karakter ekle."}</p>
                    </div>
                    <button
                      type="button"
                      className="creatorlab-cast-brand-add"
                      onClick={addCharacter}
                    >
                      {uiLanguage === "en" ? "Add presenter or persona" : "Sunucu veya persona ekle"}
                    </button>
                  </div>

                  {characters.length === 0 ? (
                    <div className="creatorlab-cast-empty-state">
                      <span aria-hidden="true">F</span>
                      <div>
                        <strong>{uiLanguage === "en" ? "No recurring cast is required" : "Tekrar eden kadro gerekmiyor"}</strong>
                        <p>{uiLanguage === "en" ? "The project can continue as faceless or narrator-led content without creating a blocking setup step." : "Proje, engelleyici bir kurulum adımı oluşturmadan faceless veya anlatıcı odaklı içerik olarak devam edebilir."}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="creatorlab-cast-card-list">
                      {characters.map((character, index) => (
                        <details key={character.id} className="creatorlab-cast-member">
                          <summary>
                            <div className="creatorlab-cast-member-avatar">
                              {character.referenceImage ? (
                                <img src={character.referenceImage} alt="" />
                              ) : (
                                <span>{(character.name || String(index + 1)).slice(0, 1).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="creatorlab-cast-member-summary-copy">
                              <strong>{character.name || `${ui.characterLabel} ${index + 1}`}</strong>
                              <span>{character.age || (uiLanguage === "en" ? "Role not defined" : "Rol tanımlanmadı")}</span>
                            </div>
                            <span className="creatorlab-cast-member-status">
                              {uiLanguage === "en" ? "Voice" : "Ses"} · {character.voiceSelection?.name || (uiLanguage === "en" ? "Default Character Voice" : "Varsayılan Karakter Sesi")}
                            </span>
                            <span className="creatorlab-cast-brand-chevron" aria-hidden="true">⌄</span>
                          </summary>

                          <div className="creatorlab-cast-member-body">
                            <div className="creatorlab-cast-member-grid">
                              <label>
                                <span>{uiLanguage === "en" ? "Name" : "Ad"}</span>
                                <input
                                  value={character.name}
                                  onChange={(event) => updateCharacter(index, "name", event.target.value)}
                                  placeholder={ui.namePlaceholder}
                                />
                              </label>
                              <label>
                                <span>{uiLanguage === "en" ? "Role or archetype" : "Rol veya arketip"}</span>
                                <input
                                  value={character.age}
                                  onChange={(event) => updateCharacter(index, "age", event.target.value)}
                                  placeholder={uiLanguage === "en" ? "Host, expert, customer, fictional guide..." : "Sunucu, uzman, müşteri, kurgu rehber..."}
                                />
                              </label>
                            </div>
                            <label>
                              <span>{uiLanguage === "en" ? "Appearance" : "Görünüm"}</span>
                              <textarea value={character.appearance} onChange={(event) => updateCharacter(index, "appearance", event.target.value)} placeholder={ui.appearancePlaceholder} />
                            </label>
                            <div className="creatorlab-cast-member-grid">
                              <label>
                                <span>{uiLanguage === "en" ? "Wardrobe" : "Kıyafet"}</span>
                                <textarea value={character.outfit} onChange={(event) => updateCharacter(index, "outfit", event.target.value)} placeholder={ui.outfitPlaceholder} />
                              </label>
                              <label>
                                <span>{uiLanguage === "en" ? "Personality and delivery" : "Kişilik ve anlatım"}</span>
                                <textarea value={character.personality} onChange={(event) => updateCharacter(index, "personality", event.target.value)} placeholder={ui.personalityPlaceholder} />
                              </label>
                            </div>
                            <details className="creatorlab-cast-brand-nested-details">
                              <summary>{uiLanguage === "en" ? "Additional identity controls" : "Ek kimlik kontrolleri"}</summary>
                              <div className="creatorlab-cast-member-grid">
                                <label>
                                  <span>{uiLanguage === "en" ? "Signature accessory" : "İmza aksesuar"}</span>
                                  <input value={character.accessory || ""} onChange={(event) => updateCharacter(index, "accessory", event.target.value)} placeholder={ui.accessoryPlaceholder} />
                                </label>
                                <label>
                                  <span>{uiLanguage === "en" ? "Character delivery style" : "Karakter ifade stili"}</span>
                                  <select
                                    value={normalizeCreatorVoiceSelectionId(character.voiceProfileId, "velto_warm")}
                                    onChange={(event) => {
                                      updateCharacter(
                                        index,
                                        "voiceProfileId",
                                        normalizeCreatorVoiceSelectionId(
                                          event.target.value,
                                          "velto_warm",
                                        ),
                                      );
                                      clearAllSceneDialogueAudioData();
                                      clearAllSceneTimingData();
                                    }}
                                  >
                                    {CREATOR_VOICE_SELECTIONS.map((profile) => (
                                      <option key={`character-${index}-${profile.id}`} value={profile.id}>
                                        {uiLanguage === "en" ? profile.labelEn : profile.labelTr}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    {uiLanguage === "en" ? "Actual character voice" : "Gerçek karakter sesi"}
                                  </span>
                                  <strong className="mt-2 block text-sm text-slate-950">
                                    {character.voiceSelection?.name ||
                                      (uiLanguage === "en" ? "Default Character Voice" : "Varsayılan Karakter Sesi")}
                                  </strong>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {character.voiceSelection
                                      ? getVoiceLibraryDisplayMeta(character.voiceSelection)
                                      : uiLanguage === "en"
                                        ? "Choose a real voice without copying a voice ID."
                                        : "Voice ID kopyalamadan gerçek bir ses seç."}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => openCreatorVoiceLibrary({ scope: "character", characterId: character.id || "" })}
                                    className="mt-3 min-h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    {character.voiceSelection
                                      ? uiLanguage === "en" ? "Change voice" : "Sesi değiştir"
                                      : uiLanguage === "en" ? "Choose voice" : "Ses seç"}
                                  </button>
                                  {character.voiceSelection && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCharacters((current) =>
                                          current.map((item) =>
                                            item.id === character.id
                                              ? { ...item, voiceId: "", voiceSelection: undefined }
                                              : item,
                                          ),
                                        );
                                        clearAllSceneDialogueAudioData();
                                        clearAllSceneTimingData();
                                      }}
                                      className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                      {uiLanguage === "en" ? "Use Default Character Voice" : "Varsayılan Karakter Sesini Kullan"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </details>

                            <div className="creatorlab-cast-reference-row">
                              <div>
                                <strong>{uiLanguage === "en" ? "Visual reference" : "Görsel referans"}</strong>
                                <p>{uiLanguage === "en" ? "Generate once the name and visual direction are clear." : "Ad ve görsel yön netleştiğinde üret."}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => generateCharacterReference(index)}
                                disabled={characterLoadingIndex === index}
                              >
                                {characterLoadingIndex === index
                                  ? ui.preparingReferenceImage
                                  : character.referenceImage
                                    ? (uiLanguage === "en" ? "Regenerate reference" : "Referansı yeniden üret")
                                    : ui.generateReferenceImage}
                              </button>
                            </div>

                            {character.referenceImage && (
                              <img
                                src={character.referenceImage}
                                alt={`${character.name || `${ui.characterLabel} ${index + 1}`} ${ui.referenceImageAlt}`}
                                className="creatorlab-cast-reference-image"
                              />
                            )}

                            <div className="creatorlab-cast-member-footer">
                              <span>{uiLanguage === "en" ? "Changes apply to new generations and retries." : "Değişiklikler yeni üretimlere ve tekrar denemelerine uygulanır."}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  removeCharacter(index);
                                  if (characters.length <= 1) {
                                    setCreatorNoCastMode("faceless");
                                  }
                                }}
                              >
                                {uiLanguage === "en" ? "Remove from cast" : "Kadrodan kaldır"}
                              </button>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </section>

                  </div>
                </div>

                <section className={`creatorlab-setup-group creatorlab-setup-music-group ${creatorMusicConfirmationRequired ? "has-action-required" : ""}`} data-setup-group="music">
                  <div className="creatorlab-setup-group-label">
                    <strong>{uiLanguage === "en" ? "Music" : "Müzik"}</strong>
                    <span>{creatorMusicConfirmationRequired ? (uiLanguage === "en" ? "Action required" : "Aksiyon gerekli") : creatorMusicSummary}</span>
                  </div>
                <CreatorBackgroundMusic
                  key={`creator-background-music-${creatorBackgroundMusicHydrationRevision}`}
                  timeline={creatorAudioTimeline}
                  projectId={currentProjectId}
                  sceneIds={scenes.map((scene) => scene.creatorSceneId || `legacy-${scene.id}`)}
                  getAccessToken={getAccessTokenOrThrow}
                  autoMatchInput={{ contentType: creatorContentType, outcome: creatorOutcome, format: creatorFormat, topic: input, visualStyle: visualBible?.style }}
                  onChange={(nextTimeline) => {
                    const nextMode = getCreatorMusicSetupMode(nextTimeline);
                    setCreatorBackgroundMusic({
                      ...DEFAULT_CREATOR_BACKGROUND_MUSIC,
                      mode: nextMode === "auto" ? "auto" : "none",
                    });
                    applyCreatorAudioTimelineChange(nextTimeline);
                  }}
                  language={uiLanguage === "en" ? "en" : "tr"}
                />
                </section>

                <section className="creatorlab-setup-group rounded-3xl border border-slate-200 bg-white p-5" data-setup-group="continuity">
                  <div className="creatorlab-setup-group-label">
                    <strong>{uiLanguage === "en" ? "Continuity" : "Devamlılık"}</strong>
                    <span>{creatorContinuitySummary}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700">
                      {uiLanguage === "en" ? "Visual Continuity" : "Görsel Devamlılık"}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                      {uiLanguage === "en" ? "Choose one project-level continuity rule" : "Proje düzeyinde bir devamlılık kuralı seç"}
                    </h3>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {([
                      {
                        value: "independent" as const,
                        label: uiLanguage === "en" ? "Independent scenes" : "Bağımsız sahneler",
                        description: uiLanguage === "en" ? "Each scene can use its own visual direction." : "Her sahne kendi görsel yönünü kullanabilir.",
                      },
                      {
                        value: "consistent" as const,
                        label: uiLanguage === "en" ? "Keep continuity" : "Devamlılığı koru",
                        description: uiLanguage === "en" ? "Maintain visual consistency across connected scenes." : "Bağlantılı sahnelerde görsel tutarlılığı koru.",
                      },
                      {
                        value: "selective" as const,
                        label: uiLanguage === "en" ? "Choose per scene" : "Sahne başına seç",
                        description: uiLanguage === "en" ? "Set continuity individually for each scene." : "Devamlılığı her sahne için ayrı ayarla.",
                      },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCreatorProjectContinuityMode(option.value)}
                        aria-pressed={creatorProjectContinuityMode === option.value}
                        className={`rounded-2xl border p-4 text-left transition ${creatorProjectContinuityMode === option.value ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <strong className="block text-sm text-slate-950">{option.label}</strong>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </section>

                  </div>
                </details>
                <div className="flex justify-end">
                  <button
                    type="button"
                    data-production-primary-continue="true"
                    onClick={() => selectCreatorProductionSubstep("create_review")}
                    className="creatorlab-setup-primary-action"
                  >
                    {uiLanguage === "en" ? "Continue to Create & Review" : "Üret ve İncele'ye Devam Et"}
                  </button>
                </div>
              </div>
            )}

            {creatorStageVisibility.create_review && (scenes.length === 0 ? (
              <div className="creatorlab-production-empty">
                <div className="creatorlab-production-empty-icon" aria-hidden="true">▤</div>
                <div>
                  <strong>{creatorSceneHydrationAuthority === "recovery_required"
                    ? uiLanguage === "en" ? "Saved scenes need recovery" : "Kaydedilmiş sahnelerin kurtarılması gerekiyor"
                    : uiLanguage === "en" ? "Prepare the editable scene plan" : "Düzenlenebilir sahne planını hazırla"}</strong>
                  <p>
                    {creatorSceneHydrationAuthority === "recovery_required"
                      ? uiLanguage === "en"
                        ? "A current production scene plan still exists, but the saved Create & Review state is inconsistent. Nothing has been rebuilt or discarded."
                        : "Güncel bir üretim sahne planı hâlâ mevcut, ancak kaydedilmiş Oluştur ve İncele durumu tutarsız. Hiçbir şey yeniden oluşturulmadı veya silinmedi."
                      : uiLanguage === "en"
                        ? "This creates the storyboard structure only. Visual and voice generation starts later in Create & Review."
                        : "Bu işlem yalnızca storyboard yapısını oluşturur. Görsel ve ses üretimi daha sonra Oluştur ve İncele aşamasında başlar."}
                  </p>
                </div>
                {creatorSceneHydrationAuthority !== "recovery_required" && (
                  <button
                    type="button"
                    onClick={buildStory}
                    disabled={buildingStory}
                    className="creatorlab-production-primary-action"
                  >
                    {buildingStory
                      ? uiLanguage === "en" ? "Preparing scenes..." : "Sahneler hazırlanıyor..."
                      : uiLanguage === "en" ? "Prepare Scenes" : "Sahneleri Hazırla"}
                  </button>
                )}
              </div>
            ) : (
              <>
                <section className="creatorlab-p2c-production-status" aria-labelledby="creatorlab-production-status-title">
                  <div className="creatorlab-p2c-production-status-heading">
                    <div>
                      <span>{uiLanguage === "en" ? "Create & Review" : "Üret ve İncele"}</span>
                      <h2 id="creatorlab-production-status-title">{uiLanguage === "en" ? "Production status" : "Üretim durumu"}</h2>
                    </div>
                    <p aria-live="polite">
                      {uiLanguage === "en"
                        ? `${scenes.length} scenes · ${getCreatorQualityModeLabel()} · Visuals ${visualAssetReadyCount}/${scenes.length} · Voice ${audioReadyCount}/${scenes.length} · Final ${creatorFinalVideoProgressDetail}`
                        : `${scenes.length} sahne · ${getCreatorQualityModeLabel()} · Görsel ${visualAssetReadyCount}/${scenes.length} · Ses ${audioReadyCount}/${scenes.length} · Final ${creatorFinalVideoProgressDetail}`}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-creator-preview-project="true"
                      onClick={playWholeStory}
                      disabled={
                        !isPlayingStory &&
                        (isPreparingAudio || playingDialogueSceneId !== null || loadingAudioSceneId !== null)
                      }
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isPlayingStory
                        ? uiLanguage === "en" ? "Stop Preview" : "Önizlemeyi Durdur"
                        : uiLanguage === "en" ? "Preview Project" : "Projeyi Önizle"}
                    </button>
                  </div>
                  <div
                    data-production-compact-progress="true"
                    className="creatorlab-p2c-production-progress"
                    role="list"
                    aria-label={uiLanguage === "en" ? "Production status" : "Üretim durumu"}
                  >
                  {[
                    {
                      number: 1,
                      label: uiLanguage === "en" ? "Visuals" : "Görseller",
                      detail: `${visualAssetReadyCount}/${scenes.length} ${uiLanguage === "en" ? "ready" : "hazır"}`,
                      complete: creatorVisualsComplete,
                      active: !creatorTimelineNeedsAttention && !creatorVisualsComplete,
                    },
                    {
                      number: 2,
                      label: uiLanguage === "en" ? "Voice-over" : "Seslendirme",
                      detail: `${audioReadyCount}/${scenes.length} ${uiLanguage === "en" ? "ready" : "hazır"}`,
                      complete: creatorVoiceOverComplete,
                      active: creatorVisualsComplete && !creatorVoiceOverComplete,
                    },
                    ...(creatorMotionRequired
                      ? [
                          {
                            number: 3,
                            label: uiLanguage === "en" ? "Motion" : "Hareket",
                            detail:
                              creatorRoutedMotionSceneIds.length > 0
                                ? `${creatorMotionReadyCount}/${creatorRoutedMotionSceneIds.length} ${uiLanguage === "en" ? "ready" : "hazır"}`
                                : uiLanguage === "en"
                                  ? "No Video scenes selected"
                                  : "Video sahnesi seçilmedi",
                            complete: creatorMotionComplete,
                            active:
                              creatorVisualsComplete &&
                              creatorVoiceOverComplete &&
                              !creatorMotionComplete,
                          },
                        ]
                      : []),
                    {
                      number: creatorMotionRequired ? 4 : 3,
                      label: uiLanguage === "en" ? "Final video" : "Final video",
                      detail: creatorFinalVideoProgressDetail,
                      complete: creatorProductionComplete,
                      active:
                        creatorVisualsComplete &&
                        creatorVoiceOverComplete &&
                        creatorMotionComplete &&
                        !creatorProductionComplete,
                    },
                  ].map((item) => (
                    <div
                      key={item.number}
                      role="listitem"
                      aria-current={item.active ? "step" : undefined}
                      className={item.active ? "is-active" : undefined}
                    >
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <span aria-hidden="true" data-state={item.complete ? "complete" : item.active ? "active" : "waiting"} />
                    </div>
                  ))}
                  </div>
                  {!creatorProductionComplete && (
                    <div id="creatorlab-production-action" data-production-compact-action="true" className="creatorlab-p2c-production-next-action">
                      {(creatorTimelineNeedsAttention || creatorMusicConfirmationRequired) && (
                        <div className="min-w-0" aria-live="polite">
                          <strong>{creatorNextProductionAction.title}</strong>
                          <p>{creatorNextProductionAction.description}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={continueCreatorProduction}
                        disabled={
                          creatorMediaPreflightLoading ||
                          isBatchRendering ||
                          isPreparingAudio ||
                          isExportingMovie ||
                          buildingStory ||
                          (creatorVisualsComplete && creatorVoiceOverComplete && creatorMotionComplete && creatorMusicConfirmationRequired)
                        }
                      >
                        {creatorMediaPreflightLoading
                          ? uiLanguage === "en" ? "Checking production..." : "Üretim kontrol ediliyor..."
                          : isBatchRendering
                            ? uiLanguage === "en" ? "Producing media..." : "Medya üretiliyor..."
                            : isPreparingAudio
                              ? uiLanguage === "en" ? "Generating voice-over..." : "Seslendirme üretiliyor..."
                              : isExportingMovie
                                ? ui.creatingMovie
                                : creatorNextProductionAction.buttonLabel}
                      </button>
                    </div>
                  )}
                </section>

                {(creatorMediaPreflightLoading || creatorTimelineNeedsAttention) && (
                <div id="creatorlab-production-safety" className={`creatorlab-production-safety ${creatorTimelineNeedsAttention ? "is-review" : "is-safe"}`}>
                  <div className="creatorlab-production-safety-icon" aria-hidden="true">
                    {creatorMediaPreflightLoading ? "…" : creatorTimelineNeedsAttention ? "!" : "✓"}
                  </div>
                  <div>
                    <strong>
                      {creatorMediaPreflightLoading
                        ? uiLanguage === "en" ? "Production safeguards are running" : "Üretim güvenlik kontrolleri çalışıyor"
                        : creatorTimelineMediaGate.title || (uiLanguage === "en" ? "Production safeguards are ready" : "Üretim güvenlik kontrolleri hazır")}
                    </strong>
                    <p>{creatorTimelineMediaGate.message}</p>
                  </div>
                  <span className="creatorlab-production-safety-status">
                    {creatorMediaPreflightLoading
                      ? uiLanguage === "en" ? "Checking" : "Kontrol ediliyor"
                      : creatorTimelineMediaGate.status === "auto_managed"
                        ? uiLanguage === "en" ? "Automatic" : "Otomatik"
                        : creatorTimelineNeedsAttention
                          ? uiLanguage === "en" ? "Action needed" : "Aksiyon gerekli"
                          : uiLanguage === "en" ? "Ready" : "Hazır"}
                  </span>
                </div>
                )}

                {creatorMusicConfirmationRequired && (
                  <div data-premium-music-confirmation="required" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <strong className="block text-sm font-semibold">
                      {uiLanguage === "en" ? "Premium music selected" : "Premium müzik seçildi"}
                    </strong>
                    <p className="mt-1 text-xs leading-5">
                      {uiLanguage === "en"
                        ? "Premium music must be confirmed before final export. Review and preview the exact selected track to continue."
                        : "Final dışa aktarmadan önce premium müzik onaylanmalıdır. Devam etmek için seçili parçayı inceleyip önizle."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-change-premium-music="true"
                        onClick={() => {
                          selectCreatorProductionSubstep("setup");
                          window.setTimeout(
                            () => document.getElementById("creatorlab-background-music")?.scrollIntoView({ behavior: getCreatorScrollBehavior(), block: "start" }),
                            60,
                          );
                        }}
                        className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                      >
                        {uiLanguage === "en" ? "Change Music" : "Müziği Değiştir"}
                      </button>
                    </div>
                  </div>
                )}

                {creatorHasFinalVideo && (
                  <section role="status" aria-live="polite" aria-atomic="true" data-creator-final-video-lifecycle={creatorFinalVideoNeedsRebuild ? "outdated" : "current"} className={`min-w-0 rounded-2xl border p-4 ${creatorFinalVideoNeedsRebuild ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{uiLanguage === "en" ? "Final Video" : "Final Video"}</span>
                        <strong className="mt-1 block text-sm text-slate-950">
                          {creatorFinalVideoNeedsRebuild
                            ? uiLanguage === "en" ? "Final video needs rebuild" : "Final videonun yeniden oluşturulması gerekiyor"
                            : uiLanguage === "en" ? "Final video is current" : "Final video güncel"}
                        </strong>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {creatorFinalVideoNeedsRebuild
                            ? uiLanguage === "en" ? "Your existing final video remains available while production changes are reviewed or rebuilt." : "Üretim değişiklikleri incelenirken veya yeniden oluşturulurken mevcut final video kullanılabilir kalır."
                            : uiLanguage === "en" ? "Continue editing at any time, or rebuild this output intentionally." : "İstediğin zaman düzenlemeye devam et veya bu çıktıyı bilinçli olarak yeniden oluştur."}
                        </p>
                      </div>
                      <video src={exportMovieResult?.downloadUrl || exportedMovieUrl} controls preload="metadata" className="max-h-44 w-full rounded-xl bg-black object-contain lg:w-72" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!creatorEditorOpen && <button
                        type="button"
                        data-edit-current-final-video="true"
                        onClick={() => setCreatorEditorOpen(true)}
                        className={`min-h-11 rounded-xl px-4 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${creatorFinalVideoNeedsRebuild ? "border border-slate-300 bg-white text-slate-700" : "bg-blue-700 text-white shadow-md hover:bg-blue-800"}`}
                      >
                        {uiLanguage === "en" ? "Edit Video" : "Videoyu Düzenle"}
                      </button>}
                      <button
                        type="button"
                        data-rebuild-final-video="true"
                        onClick={() => void handleExportMovie(true)}
                        disabled={isExportingMovie || creatorMusicConfirmationRequired}
                        className={`min-h-11 rounded-xl px-4 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${creatorFinalVideoNeedsRebuild ? "bg-blue-700 text-white shadow-md hover:bg-blue-800" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                      >
                        {isExportingMovie
                          ? uiLanguage === "en" ? "Building Final Video…" : "Final Video Oluşturuluyor…"
                          : uiLanguage === "en" ? "Rebuild Final Video" : "Final Videoyu Yeniden Oluştur"}
                      </button>
                    </div>
                  </section>
                )}

                {creatorEditorOpen && (
                  <CreatorEditor
                    creatorFormat={creatorFormat === "youtube_video" ? "youtube_video" : "short_form"}
                    scenes={scenes}
                    selectedCreatorSceneId={selectedCreatorEditorSceneId}
                    onSelectScene={setSelectedCreatorEditorSceneId}
                    onMoveScene={moveSelectedCreatorEditorScene}
                    onAddScene={addCreatorEditorScene}
                    onDuplicateScene={duplicateSelectedCreatorEditorScene}
                    onDeleteScene={deleteSelectedCreatorEditorScene}
                    onUndo={undoLastCreatorChange}
                    canUndo={creatorUndoStack.length > 0}
                    onUpdateTrim={updateSelectedCreatorSceneTrim}
                    onSaveText={saveSelectedCreatorSceneText}
                    getNarrationAudioState={(creatorSceneId) => {
                      const scene = scenes.find(
                        (item) => item.creatorSceneId === creatorSceneId,
                      );
                      return scene
                        ? getCreatorNarrationAudioCurrentness(scene)
                        : "missing";
                    }}
                    getDialogueAudioState={(creatorSceneId) => {
                      const scene = scenes.find(
                        (item) => item.creatorSceneId === creatorSceneId,
                      );
                      return scene
                        ? getCreatorDialogueAudioCurrentness(scene)
                        : "missing";
                    }}
                    getVideoState={(creatorSceneId) => {
                      const scene = scenes.find(
                        (item) => item.creatorSceneId === creatorSceneId,
                      );
                      return scene ? getCreatorVideoState(scene) : "missing";
                    }}
                    getContinuityWarning={(creatorSceneId) => {
                      const sceneAudit = flowContinuityAudit?.scenes.find((audit) => {
                        const scene = scenes.find((item) => item.creatorSceneId === creatorSceneId);
                        return scene && String(audit.id) === String(scene.id);
                      });
                      return getCreatorContinuityWarning(sceneAudit, uiLanguage === "en" ? "en" : "tr");
                    }}
                    onRefreshVideo={(creatorSceneId) => {
                      const scene = scenes.find(
                        (item) => item.creatorSceneId === creatorSceneId,
                      );
                      if (scene) void handleGenerateVideo(scene.id);
                    }}
                    onRestoreMedia={(creatorSceneId, assetId) => {
                      const scene = scenes.find(
                        (item) => item.creatorSceneId === creatorSceneId,
                      );
                      const asset = scene?.assetHistory?.find((item) => item.id === assetId);
                      if (scene && asset) restoreCreatorSceneAsset(scene.id, asset);
                    }}
                    onUseProjectImage={reuseCreatorProjectImage}
                    onUseStockMedia={onUseCreatorStockMedia}
                    projectId={currentProjectId}
                    getAccessToken={getAccessTokenOrThrow}
                    onProjectHistoryRemoved={removeCreatorProjectHistoryUrl}
                    audioTimeline={creatorAudioTimeline || createDefaultCreatorMusicTimeline()}
                    onAudioTimelineChange={applyCreatorAudioTimelineChange}
                    sceneOperationsDisabled={creatorSceneStructuralOperationsDisabled}
                    language={uiLanguage === "en" ? "en" : "tr"}
                  />
                )}

                <section
                  id="creatorlab-production-storyboard"
                  className="creatorlab-production-storyboard creatorlab-p2c-production-workspace"
                  data-admitted-visual-scene-ids={activeVisualGenerationSceneIds.join(",")}
                  data-generating-visual-scene-ids={creatorGeneratingVisualSceneIds.join(",")}
                >
                  <div className="creatorlab-p2c-scene-rail">
                  {(creatorSelectedSceneIds.length > 1 || creatorVisualDispatchCountdown) && (
                    <div
                      className="creatorlab-p2c-batch-toolbar creatorlab-p2c-batch-toolbar-sticky"
                      data-creator-selected-scenes-toolbar="true"
                      data-batch-selection-state={creatorSelectedSceneIds.length > 0 ? "selected" : "empty"}
                    >
                      {creatorVisualDispatchCountdown ? (
                        <div className="creatorlab-p2c-countdown" role="status" aria-live="assertive">
                          <strong>
                            {creatorVisualDispatchCountdown.scope === "batch"
                              ? `${creatorVisualDispatchCountdown.sceneCount} ${uiLanguage === "en" ? "scenes selected" : "sahne seçili"} · `
                              : ""}
                            {uiLanguage === "en" ? "Starting in" : "Başlıyor"} {creatorVisualDispatchCountdown.secondsRemaining}s
                          </strong>
                          <span>{uiLanguage === "en" ? "No generation request has been sent." : "Henüz üretim talebi gönderilmedi."}</span>
                          <button
                            type="button"
                            onClick={videoDispatchCountdown ? cancelPendingVideoDispatch : cancelPendingImageDispatch}
                            className="creatorlab-p2c-batch-action is-cancel"
                          >
                            {uiLanguage === "en" ? "Cancel" : "İptal"}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="creatorlab-p2c-batch-selection" aria-live="polite">
                            <strong>{creatorSelectedSceneIds.length}</strong> {uiLanguage === "en" ? "scenes selected" : "sahne seçili"}
                            <span>{` · ${creatorSelectedMissingVisualCount} ${uiLanguage === "en" ? "visuals" : "görsel"} · ${creatorSelectedMissingVoiceCount} ${uiLanguage === "en" ? "voice tracks missing" : "ses eksik"}`}</span>
                          </div>
                          <div className="creatorlab-p2c-batch-mode" role="group" aria-label={uiLanguage === "en" ? "Visual source" : "Görsel kaynağı"}>
                            <span>{uiLanguage === "en" ? "Source" : "Kaynak"}</span>
                            <div className="creatorlab-p2c-batch-segmented">
                              {([
                                ["recommended", uiLanguage === "en" ? "Velto Recommended" : "Velto Önerilen"],
                                ["stock", uiLanguage === "en" ? "Stock" : "Stok"],
                                ["ai_image", uiLanguage === "en" ? "AI Image" : "AI Görsel"],
                                ["ai_video", "AI Video"],
                              ] as const).map(([method, label]) => (
                                <button
                                  key={method}
                                  type="button"
                                  aria-pressed={creatorSelectedVisualSourceMethod === method}
                                  onClick={() => setCreatorScenesVisualSourceMethod(creatorSelectedSceneIds, method)}
                                  disabled={method === "ai_video" && creatorQualityMode !== "pro" && creatorQualityMode !== "cinematic"}
                                  className="creatorlab-p2c-batch-mode-button"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {creatorSelectedVisualSourceMethod === "stock" && (
                            <div className="creatorlab-p2c-batch-mode" role="group" aria-label={uiLanguage === "en" ? "Stock type" : "Stok türü"}>
                              <span>{uiLanguage === "en" ? "Stock type" : "Stok türü"}</span>
                              <div className="creatorlab-p2c-batch-segmented">
                                <button type="button" onClick={() => setCreatorScenesRenderMode(creatorSelectedSceneIds, "image")} className="creatorlab-p2c-batch-mode-button">{uiLanguage === "en" ? "Photos" : "Fotoğraflar"}</button>
                                <button type="button" onClick={() => setCreatorScenesRenderMode(creatorSelectedSceneIds, "video")} className="creatorlab-p2c-batch-mode-button">{uiLanguage === "en" ? "Videos" : "Videolar"}</button>
                              </div>
                            </div>
                          )}
                          <div className="creatorlab-p2c-batch-actions">
                            <button type="button" onClick={() => void generateSelectedSceneVisuals()} disabled={isBatchRendering || creatorMediaPreflightLoading} className="creatorlab-p2c-batch-action">
                              {uiLanguage === "en" ? "Generate Visuals" : "Görselleri Üret"}
                            </button>
                            <button type="button" onClick={() => void prepareSelectedSceneAudio()} disabled={isPreparingAudio || creatorMediaPreflightLoading} className="creatorlab-p2c-batch-action">
                              {isPreparingAudio ? (uiLanguage === "en" ? "Preparing voice..." : "Ses hazırlanıyor...") : (uiLanguage === "en" ? "Generate Voice" : "Ses Üret")}
                            </button>
                            <button type="button" onClick={() => setCreatorSelectedSceneIds([])} className="creatorlab-p2c-batch-action is-secondary">
                              {uiLanguage === "en" ? "Clear selection" : "Seçimi temizle"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <CreatorSceneProductionStatus
                    scenes={creatorSceneProductionSummaries}
                    focusedSceneId={creatorFocusedSceneId}
                    onFocusScene={setCreatorFocusedSceneId}
                    selectedSceneIds={creatorSelectedSceneIdSet}
                    onToggleSceneSelection={toggleCreatorSceneSelection}
                    language={uiLanguage === "en" ? "en" : "tr"}
                    contextualAction={!creatorEditorOpen ? (
                      <button
                        type="button"
                        data-creator-editor-entry="true"
                        onClick={() => setCreatorEditorOpen(true)}
                        className="creatorlab-p2c-open-editor"
                      >
                        {uiLanguage === "en" ? "Open Editor" : "Editörü Aç"}
                      </button>
                    ) : undefined}
                  />
                  </div>

                  <div className="creatorlab-p2c-active-scene space-y-3">
                    {scenes.filter((scene) => scene.id === creatorFocusedSceneId).map((scene) => {
                      const index = scenes.findIndex((item) => item.id === scene.id);
                      const visualReady = hasCreatorUsableVisual(scene);
                      const voiceReady = getSceneVoiceStatus(scene);
                      const motionRouted = creatorRoutedMotionSceneIdSet.has(scene.id);
                      const motionReady =
                        motionRouted &&
                        Boolean(scene.videoUrl) &&
                        scene.videoStatus === "done";
                      const motionFailed = motionRouted && scene.videoStatus === "error";
                      const outputState = resolveCreatorMediaOutputState({
                        recommendedOutput: creatorRecommendedMotionSceneIdSet.has(scene.id)
                          ? "video"
                          : "image",
                        explicitOutput: scene.renderMode,
                      });
                      const veltoRecommendedOutputMode = outputState.recommendedOutput;
                      const sceneOutputMode = outputState.effectiveOutput;
                      const sceneOutputIsUserChoice = outputState.isUserOverride;
                      const sceneVisualSourceMethod = normalizeCreatorVisualSourceMethod(
                        scene.visualSourceMethod,
                      );
                      const sceneExplicitAiVideoBlocked =
                        sceneVisualSourceMethod === "ai_video" &&
                        creatorQualityMode !== "pro" && creatorQualityMode !== "cinematic";
                      const sceneScriptDraft = sceneScriptDrafts[scene.id] || {
                        narration: scene.narration || "",
                        dialogue: scene.dialogue || "",
                      };
                      const sceneFitFeedback = sceneScriptFitFeedback[scene.id];
                      const sceneDraftHealth = assessCreatorSceneScriptDraft({
                        scene,
                        draft: sceneScriptDraft,
                        language,
                        qualityMode: creatorQualityMode,
                      });
                      const focusedSceneContinuityAudit = flowContinuityAudit?.scenes.find(
                        (audit) => String(audit.id) === String(scene.id),
                      );
                      const effectiveSceneDraftHealthStatus = resolveCreatorMeasuredScriptHealthStatus({
                        scriptHealthStatus: sceneDraftHealth.status,
                        speechMatchesMeasuredSource:
                          normalizeCreatorScriptText(sceneScriptDraft.narration) ===
                            normalizeCreatorScriptText(scene.narration || "") &&
                          normalizeCreatorScriptText(sceneScriptDraft.dialogue) ===
                            normalizeCreatorScriptText(scene.dialogue || ""),
                        narrationState: getCreatorNarrationAudioCurrentness(scene),
                        measuredNarrationDurationSec: scene.timing?.narrationDuration,
                        continuityAudit: focusedSceneContinuityAudit,
                      });
                      const measuredAudioDurationSec = Number(
                        scene.timing?.totalAudioDuration || 0,
                      );
                      const exactTimingLocked = Boolean(
                        scene.timing?.exactTimingLocked ||
                          (measuredAudioDurationSec > 0 &&
                            scene.timing?.durationMatchStatus !== "unmeasured"),
                      );
                      const plannedDurationSec = Math.max(
                        3,
                        Number(
                          scene.timing?.plannedSceneDuration ||
                            scene.targetDurationSec ||
                            scene.scriptHealth?.targetDurationSec ||
                            sceneDraftHealth.targetDurationSec,
                        ),
                      );
                      const targetDurationSec = Math.max(
                        3,
                        Number(
                          exactTimingLocked
                            ? scene.timing?.targetSceneDuration
                            : plannedDurationSec,
                        ),
                      );
                      const timingDeltaSec = exactTimingLocked
                        ? Number(
                            (
                              scene.timing?.durationDelta ??
                              targetDurationSec - plannedDurationSec
                            ).toFixed(1),
                          )
                        : 0;
                      const simpleGuidance =
                        effectiveSceneDraftHealthStatus === "too_long"
                          ? uiLanguage === "en" ? "Narration may be long" : "Anlatım uzun olabilir"
                          : effectiveSceneDraftHealthStatus === "too_short"
                            ? uiLanguage === "en" ? "Needs more substance" : "Daha zengin olmalı"
                            : index === 0 && Number(scene.intelligence?.curiosity_score || 0) >= 6
                              ? uiLanguage === "en" ? "Strong opening" : "Güçlü açılış"
                              : (scene.visualBlockPlan?.length || 0) > 1
                                ? uiLanguage === "en" ? "Visual rhythm planned" : "Görsel ritim planlandı"
                                : uiLanguage === "en" ? "Pacing balanced" : "Tempo dengeli";
                      const isEditingScene = editingSceneId === scene.id;
                      const activeSceneInspectorTab = creatorSceneInspectorTabs[scene.id] || "script";
                      const sceneVideoDispatchCountdownActive =
                        videoDispatchCountdown?.scope === "scene" &&
                        videoDispatchCountdown.sceneId === scene.id;
                      const creatorSceneVisualOperation = creatorSceneVisualOperations[scene.id];
                      const sceneVisualCountdownActive = isCreatorSceneVisualCountdown({
                        sceneId: scene.id,
                        countdownSceneIds: creatorSceneVisualCountdownSceneIds,
                      });
                      const sceneVisualGenerating = isCreatorSceneVisualGenerating({
                        sceneId: scene.id,
                        phase: creatorVisualGenerationPhase,
                        admittedSceneIds: activeVisualGenerationSceneIds,
                        processingSceneIds: creatorProcessingVisualSceneIds,
                      });
                      const sceneVisualActionBlocked = isCreatorSceneVisualActionBlocked({
                        sceneId: scene.id,
                        countdownSceneIds: creatorSceneVisualCountdownSceneIds,
                        phase: creatorVisualGenerationPhase,
                        admittedSceneIds: activeVisualGenerationSceneIds,
                        processingSceneIds: creatorProcessingVisualSceneIds,
                      });
                      const stableCreatorSceneId = scene.creatorSceneId || "";
                      const cachedSceneVideoSource =
                        creatorSceneVideoSourceDurations[stableCreatorSceneId];
                      const sceneVideoSourceDurationSec = resolveCreatorSceneVideoSourceDuration({
                        cachedSource: cachedSceneVideoSource,
                        videoUrl: scene.videoUrl,
                        persistedDurationSec: scene.videoDurationSeconds,
                      });
                      const verifiedSceneVideoSourceDurationSec =
                        cachedSceneVideoSource?.videoUrl === scene.videoUrl &&
                        Number.isFinite(cachedSceneVideoSource?.durationSec) &&
                        Number(cachedSceneVideoSource?.durationSec) > 0
                          ? Number(cachedSceneVideoSource.durationSec)
                          : undefined;
                      const sceneCardTrim = normalizeCreatorSceneTrim({
                        clipInSec: scene.clipInSec,
                        clipOutSec: scene.clipOutSec,
                        sourceDurationSec: sceneVideoSourceDurationSec,
                        sourceType: "video",
                      });
                      const sceneTrimDisabled =
                        sceneVisualActionBlocked ||
                        sceneVisualCountdownActive ||
                        sceneVisualGenerating ||
                        sceneVideoDispatchCountdownActive ||
                        scene.videoStatus === "processing" ||
                        scene.videoStatus === "delayed" ||
                        isBatchRendering ||
                        creatorMediaPreflightLoading;
                      const hasDialogue = Boolean(scene.dialogue?.trim());
                      const narrationReady = !scene.narration?.trim() || getSceneAudioStatus(scene);
                      const dialogueReady = !hasDialogue || getSceneDialogueAudioStatus(scene);
                      const narrationDurationSec = Number(scene.timing?.narrationDuration || 0);
                      const dialogueDurationSec = Number(scene.timing?.dialogueDuration || 0);
                      const effectiveNarratorVoiceProfileId =
                        getEffectiveNarratorVoiceProfileId(scene);
                      const effectiveDialogueVoiceProfileId =
                        getEffectiveDialogueVoiceProfileId(scene);
                      const sceneVoiceCreditEstimate =
                        getCreatorVoiceCreditEstimate([scene]);
                      const sceneNarratorVoiceRoute = getCreatorSceneVoiceContext({
                        scene,
                        role: "narrator",
                        text: scene.narration,
                        companionText: scene.dialogue,
                        hasExplicitVoiceId: Boolean(narratorSettings.voiceId),
                        voiceProfile: getCreatorNarratorProfileHint(),
                      });
                      const sceneAssetHistory = [...(scene.assetHistory || [])].reverse();
                      const sceneComparedAssetIds = creatorAssetCompareSelection[scene.id] || [];
                      const sceneComparedAssets = sceneComparedAssetIds
                        .map((assetId) => sceneAssetHistory.find((asset) => asset.id === assetId))
                        .filter((asset): asset is CreatorSceneAssetVersion => Boolean(asset));
                      const sceneOperationalSummary = creatorSceneProductionSummaries.find(
                        (item) => item.id === scene.id,
                      );
                      const sceneContinuityWarning = getCreatorContinuityWarning(
                        focusedSceneContinuityAudit,
                        uiLanguage === "en" ? "en" : "tr",
                      );
                      const sceneContinuitySelection = getCreatorSceneContinuityMode(scene);
                      const sceneContinuityLabel =
                        sceneContinuitySelection === "project"
                          ? uiLanguage === "en" ? "Project default" : "Proje varsayılanı"
                          : sceneContinuitySelection === "previous"
                            ? uiLanguage === "en" ? "Continue previous" : "Önceki sahneyi devam ettir"
                            : sceneContinuitySelection === "consistent"
                              ? uiLanguage === "en" ? "Keep character & world" : "Karakter ve evreni koru"
                              : uiLanguage === "en" ? "Independent scene" : "Bağımsız sahne";
                      const scenePrimaryTab: CreatorSceneInspectorTab =
                        effectiveSceneDraftHealthStatus !== "ready"
                          ? "script"
                          : !visualReady || motionFailed || (motionRouted && !motionReady)
                            ? "visual"
                            : !voiceReady
                              ? "audio"
                              : "script";
                      const scenePrimaryActionLabel =
                        effectiveSceneDraftHealthStatus !== "ready"
                          ? uiLanguage === "en" ? "Review Script" : "Metni Kontrol Et"
                          : !visualReady
                            ? uiLanguage === "en" ? "Generate Visual" : "Görsel Üret"
                            : !voiceReady
                              ? uiLanguage === "en" ? "Generate Voice" : "Ses Üret"
                              : motionFailed
                                ? uiLanguage === "en" ? "Retry Video" : "Videoyu Yeniden Dene"
                                : motionRouted && !motionReady
                                  ? uiLanguage === "en" ? "Generate Video" : "Video Üret"
                                  : uiLanguage === "en" ? "Review Scene" : "Sahneyi Kontrol Et";
                      const scenePrimaryActionUsesCredits =
                        effectiveSceneDraftHealthStatus === "ready" &&
                        (!visualReady || !voiceReady || (motionRouted && !motionReady));
                      const sceneAttentionSummary =
                        sceneVisualGenerating
                          ? uiLanguage === "en" ? "Visual generation is in progress." : "Görsel üretimi devam ediyor."
                          : scene.videoStatus === "processing" || scene.videoStatus === "delayed"
                            ? uiLanguage === "en" ? "Video generation is in progress." : "Video üretimi devam ediyor."
                          : motionFailed
                            ? uiLanguage === "en" ? "Video generation failed and can be retried." : "Video üretimi başarısız oldu ve yeniden denenebilir."
                            : effectiveSceneDraftHealthStatus !== "ready"
                              ? simpleGuidance
                              : !visualReady
                                ? uiLanguage === "en" ? "This scene needs a visual." : "Bu sahnenin görsele ihtiyacı var."
                                : !voiceReady
                                  ? uiLanguage === "en" ? "This scene needs its voice track." : "Bu sahnenin ses kaydına ihtiyacı var."
                                  : motionRouted && !motionReady
                                    ? uiLanguage === "en" ? "The scene image is ready for video generation." : "Sahne görseli video üretimine hazır."
                                    : uiLanguage === "en" ? "All required scene assets are ready for review." : "Gerekli tüm sahne varlıkları kontrole hazır.";
                      const runCreatorScenePrimaryAction = () => {
                        if (sceneVisualCountdownActive) {
                          cancelCreatorSceneVisualCountdown(scene.id);
                          return;
                        }
                        setCreatorSceneInspectorTabs((current) => ({
                          ...current,
                          [scene.id]: scenePrimaryTab,
                        }));
                        if (effectiveSceneDraftHealthStatus !== "ready") return;
                        if (!visualReady) {
                          void runCreatorRecommendedVisualGeneration({
                            mode: "single",
                            sceneIds: [scene.id],
                          });
                          return;
                        }
                        if (!voiceReady) {
                          void prepareSelectedSceneAudio([scene.id]);
                          return;
                        }
                        if (motionRouted && !motionReady) {
                          void handleGenerateVideo(scene.id);
                        }
                      };

                      return (
                        <details
                          id={`creator-scene-${scene.id}`}
                          key={`creator-scene-workspace-${scene.id}`}
                          open
                          data-focused-scene="true"
                          data-scene-triage-status={sceneOperationalSummary?.status}
                          className="creatorlab-p2c-focused-scene group overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-slate-50 md:px-5 [&::-webkit-details-marker]:hidden">
                            <input
                              type="checkbox"
                              checked={creatorSelectedSceneIdSet.has(scene.id)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleCreatorSceneSelection(scene.id)}
                              aria-label={uiLanguage === "en" ? `Select scene ${index + 1}` : `Sahne ${index + 1} seç`}
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
                            />
                            <div className="creatorlab-p2c-focused-scene-heading min-w-0 flex-1">
                              <span>
                                {uiLanguage === "en" ? `Selected Scene ${String(index + 1).padStart(2, "0")}` : `Seçili Sahne ${String(index + 1).padStart(2, "0")}`}
                              </span>
                              <strong>
                                {scene.text || (uiLanguage === "en" ? `Scene ${scene.id}` : `Sahne ${scene.id}`)}
                              </strong>
                              <p>{targetDurationSec.toFixed(0)}s · {simpleGuidance}</p>
                            </div>
                          </summary>

                          <div className="border-t border-slate-200 bg-slate-50/60 p-4 md:p-5">
                            {sceneOperationalSummary?.status === "review" && sceneOperationalSummary.reviewReasons.length > 0 && (
                              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950" data-scene-review-reasons="true">
                                <strong className="block text-sm">{uiLanguage === "en" ? "Review required" : "Kontrol gerekli"}</strong>
                                <ul className="mt-2 space-y-2 text-xs leading-5">
                                  {sceneOperationalSummary.reviewReasons.map((reason) => (
                                    <li key={reason.code}>
                                      <span className="font-semibold">{reason.message}</span>
                                      {reason.action && <span className="block text-amber-800">{uiLanguage === "en" ? "Recommended action: " : "Önerilen aksiyon: "}{reason.action}</span>}
                                    </li>
                                  ))}
                                  {sceneOperationalSummary.reviewAdvisories.map((advisory) => (
                                    <li key={advisory.code} className="text-amber-800">
                                      {advisory.message} {advisory.action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(scenePrimaryActionUsesCredits || effectiveSceneDraftHealthStatus !== "ready" || motionFailed) && <div className="creatorlab-p2c-scene-next-action" data-scene-primary-action={scenePrimaryTab}>
                              <div>
                                <span>
                                  {sceneOperationalSummary
                                    ? getCreatorSceneTriageLabel(sceneOperationalSummary.status, uiLanguage === "en" ? "en" : "tr")
                                    : uiLanguage === "en" ? "Needs action" : "Aksiyon gerekli"}
                                </span>
                                <strong>{sceneAttentionSummary}</strong>
                                {scenePrimaryActionUsesCredits && (
                                  <small>{uiLanguage === "en" ? "Generation starts after a short cancel window" : "Üretim kısa bir iptal süresinden sonra başlar"}</small>
                                )}
                              </div>
                              {(scenePrimaryActionUsesCredits || effectiveSceneDraftHealthStatus !== "ready" || motionFailed) && <button
                                type="button"
                                onClick={runCreatorScenePrimaryAction}
                                disabled={
                                  sceneVisualGenerating ||
                                  scene.videoStatus === "processing" ||
                                  scene.videoStatus === "delayed" ||
                                  redrawLoadingId === scene.id ||
                                  loadingAudioSceneId === scene.id ||
                                  loadingDialogueSceneId === scene.id ||
                                  isBatchRendering ||
                                  creatorMediaPreflightLoading ||
                                  Boolean(imageDispatchCountdown) ||
                                  Boolean(videoDispatchCountdown)
                                }
                              >
                                {sceneVisualCountdownActive
                                  ? uiLanguage === "en"
                                    ? `Cancel · ${creatorSceneVisualOperation?.secondsRemaining}s`
                                    : `İptal · ${creatorSceneVisualOperation?.secondsRemaining} sn`
                                  : sceneVisualGenerating || scene.videoStatus === "processing" || scene.videoStatus === "delayed"
                                  ? uiLanguage === "en" ? "Generating…" : "Üretiliyor…"
                                  : scenePrimaryActionLabel}
                              </button>}
                            </div>}

                            <div className="scene-production-navigator sticky top-4 z-20 mb-5">
                              <div
                                className="scene-production-navigator__tabs"
                                role="tablist"
                                aria-label={uiLanguage === "en" ? `Scene ${scene.id} production navigator` : `Sahne ${scene.id} üretim navigasyonu`}
                              >
                                <button
                                  key={`scene-${scene.id}-tab-script`}
                                  id={`scene-${scene.id}-script-tab`}
                                  type="button"
                                  role="tab"
                                  aria-selected={activeSceneInspectorTab === "script"}
                                  aria-controls={`scene-${scene.id}-script-panel`}
                                  data-production-step="script"
                                  data-complete={sceneDraftHealth.status === "ready"}
                                  data-state={
                                    activeSceneInspectorTab === "script"
                                      ? "active"
                                      : sceneDraftHealth.status === "ready"
                                        ? "ready"
                                        : "pending"
                                  }
                                  onClick={() =>
                                    setCreatorSceneInspectorTabs((prev) => ({
                                      ...prev,
                                      [scene.id]: "script",
                                    }))
                                  }
                                  className="scene-production-tab"
                                >
                                  <span className="scene-production-tab__icon" aria-hidden="true">
                                    {sceneDraftHealth.status === "ready" ? "✓" : "1"}
                                  </span>
                                  <span className="scene-production-tab__content">
                                    <strong className="scene-production-tab__title">
                                      {uiLanguage === "en" ? "Script" : "Metin"}
                                    </strong>
                                    <span className="scene-production-tab__subtitle">
                                      {uiLanguage === "en" ? "Review & edit" : "Kontrol et ve düzenle"}
                                    </span>
                                  </span>
                                </button>

                                <button
                                  key={`scene-${scene.id}-tab-visual`}
                                  id={`scene-${scene.id}-visual-tab`}
                                  type="button"
                                  role="tab"
                                  aria-selected={activeSceneInspectorTab === "visual"}
                                  aria-controls={`scene-${scene.id}-visual-panel`}
                                  data-production-step="visual"
                                  data-complete={visualReady}
                                  data-state={
                                    activeSceneInspectorTab === "visual"
                                      ? "active"
                                      : visualReady
                                        ? "ready"
                                        : "pending"
                                  }
                                  onClick={() =>
                                    setCreatorSceneInspectorTabs((prev) => ({
                                      ...prev,
                                      [scene.id]: "visual",
                                    }))
                                  }
                                  className="scene-production-tab"
                                >
                                  <span className="scene-production-tab__icon" aria-hidden="true">
                                    {visualReady ? "✓" : "2"}
                                  </span>
                                  <span className="scene-production-tab__content">
                                    <strong className="scene-production-tab__title">
                                      {uiLanguage === "en" ? "Visual" : "Görsel"}
                                    </strong>
                                    <span className="scene-production-tab__subtitle">
                                      {visualReady
                                        ? uiLanguage === "en"
                                          ? "Visual ready"
                                          : "Görsel hazır"
                                        : uiLanguage === "en"
                                          ? "Create visual"
                                          : "Görsel oluştur"}
                                    </span>
                                  </span>
                                </button>

                                <button
                                  key={`scene-${scene.id}-tab-audio`}
                                  id={`scene-${scene.id}-audio-tab`}
                                  type="button"
                                  role="tab"
                                  aria-selected={activeSceneInspectorTab === "audio"}
                                  aria-controls={`scene-${scene.id}-audio-panel`}
                                  data-production-step="audio"
                                  data-complete={voiceReady}
                                  data-state={
                                    activeSceneInspectorTab === "audio"
                                      ? "active"
                                      : voiceReady
                                        ? "ready"
                                        : "pending"
                                  }
                                  onClick={() =>
                                    setCreatorSceneInspectorTabs((prev) => ({
                                      ...prev,
                                      [scene.id]: "audio",
                                    }))
                                  }
                                  className="scene-production-tab"
                                >
                                  <span className="scene-production-tab__icon" aria-hidden="true">
                                    {voiceReady ? "✓" : "3"}
                                  </span>
                                  <span className="scene-production-tab__content">
                                    <strong className="scene-production-tab__title">
                                      {uiLanguage === "en" ? "Voice" : "Ses"}
                                    </strong>
                                    <span className="scene-production-tab__subtitle">
                                      {voiceReady
                                        ? uiLanguage === "en"
                                          ? "Audio ready"
                                          : "Ses hazır"
                                        : uiLanguage === "en"
                                          ? "Create audio"
                                          : "Ses oluştur"}
                                    </span>
                                  </span>
                                </button>

                                <button
                                  key={`scene-${scene.id}-tab-music`}
                                  id={`scene-${scene.id}-music-tab`}
                                  type="button"
                                  role="tab"
                                  aria-selected={activeSceneInspectorTab === "music"}
                                  aria-controls={`scene-${scene.id}-music-panel`}
                                  data-production-step="music"
                                  data-complete="true"
                                  data-state={activeSceneInspectorTab === "music" ? "active" : "ready"}
                                  onClick={() => setCreatorSceneInspectorTabs((prev) => ({ ...prev, [scene.id]: "music" }))}
                                  className="scene-production-tab"
                                >
                                  <span className="scene-production-tab__icon" aria-hidden="true">✓</span>
                                  <span className="scene-production-tab__content">
                                    <strong className="scene-production-tab__title">{uiLanguage === "en" ? "Music" : "Müzik"}</strong>
                                    <span className="scene-production-tab__subtitle">{uiLanguage === "en" ? "Review transitions" : "Geçişleri incele"}</span>
                                  </span>
                                </button>
                              </div>
                            </div>

                            {activeSceneInspectorTab === "script" && (
                              <div
                                id={`scene-${scene.id}-script-panel`}
                                role="tabpanel"
                                aria-labelledby={`scene-${scene.id}-script-tab`}
                                className="space-y-4"
                              >
                                {index === 0 && creatorOpeningHookOptions.length > 0 && (
                                  <details className="creatorlab-editorial-opening-alternatives" data-opening-alternatives="collapsed">
                                    <summary>{uiLanguage === "en" ? "Opening alternatives" : "Açılış alternatifleri"}</summary>
                                    <div>
                                      <p>{uiLanguage === "en" ? "Choose an opening direction while reviewing the script." : "Metni incelerken bir açılış yönü seç."}</p>
                                      <div>
                                        {creatorOpeningHookOptions.map((hook, hookIndex) => (
                                          <button key={`opening-hook-${hookIndex}`} type="button" onClick={() => stageCreatorOpeningHookDraft(scene, hook)}>{hook}</button>
                                        ))}
                                      </div>
                                    </div>
                                  </details>
                                )}
                                <div className="creatorlab-editorial-script-surface rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {uiLanguage === "en" ? "Narration" : "Anlatım"}
                                      </span>
                                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                                        {scene.narration || (uiLanguage === "en" ? "No narration" : "Anlatım yok")}
                                      </p>
                                      {hasDialogue && (
                                        <div className="mt-4 border-t border-slate-100 pt-4">
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            {uiLanguage === "en" ? "Dialogue" : "Diyalog"}
                                          </span>
                                          <p className="mt-2 text-sm leading-6 text-slate-600">{scene.dialogue}</p>
                                        </div>
                                      )}
                                    </div>
                                    {!isEditingScene && (
                                      <div className="flex shrink-0 flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openCreatorSceneEditor(scene)}
                                          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          {uiLanguage === "en" ? "Edit script" : "Metni düzenle"}
                                        </button>
                                        <button
                                          type="button"
                                          data-delete-creator-scene={scene.creatorSceneId || "missing"}
                                          aria-label={uiLanguage === "en" ? `Delete Scene ${index + 1}` : `Sahne ${index + 1} sil`}
                                          onClick={() => scene.creatorSceneId && deleteCreatorScene(scene.creatorSceneId)}
                                          disabled={
                                            !scene.creatorSceneId ||
                                            scenes.length <= 1 ||
                                            creatorSceneStructuralOperationsDisabled
                                          }
                                          className="min-h-11 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {uiLanguage === "en" ? "Delete Scene" : "Sahneyi Sil"}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="creatorlab-editorial-script-metrics mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{uiLanguage === "en" ? "Words" : "Kelime"}</span>
                                      <strong className="mt-1 block text-sm text-slate-950">{sceneDraftHealth.speechWordCount}</strong>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{uiLanguage === "en" ? "Estimated speech" : "Tahmini konuşma"}</span>
                                      <strong className="mt-1 block text-sm text-slate-950">{sceneDraftHealth.estimatedSpeechSec.toFixed(1)}s / {sceneDraftHealth.targetDurationSec.toFixed(1)}s</strong>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{uiLanguage === "en" ? "Timing" : "Süre"}</span>
                                      <strong className={`mt-1 block text-sm ${sceneDraftHealth.status === "ready" ? "text-emerald-700" : sceneDraftHealth.status === "too_long" ? "text-rose-700" : "text-amber-700"}`}>
                                        {sceneDraftHealth.status === "ready"
                                          ? uiLanguage === "en" ? "Safe" : "Güvenli"
                                          : sceneDraftHealth.status === "too_long"
                                            ? uiLanguage === "en" ? "Over target" : "Hedefi aşıyor"
                                            : uiLanguage === "en" ? "Needs substance" : "İçerik gerekli"}
                                      </strong>
                                    </div>
                                  </div>
                                </div>

                                {isEditingScene && (
                                  <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <strong className="text-sm text-slate-950">
                                          {uiLanguage === "en" ? "Script and timing" : "Metin ve süre"}
                                        </strong>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">
                                          {uiLanguage === "en"
                                            ? "Timing updates while you type. Saving rebuilds the safe scene window and visual beats."
                                            : "Yazdıkça süre güncellenir. Kaydetme, güvenli sahne aralığını ve görsel akışları yeniden kurar."}
                                        </p>
                                      </div>
                                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${sceneDraftHealth.status === "ready" ? "bg-emerald-100 text-emerald-700" : sceneDraftHealth.status === "too_long" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                        {sceneDraftHealth.status === "ready"
                                          ? uiLanguage === "en" ? "Timing safe" : "Süre güvenli"
                                          : sceneDraftHealth.status === "too_long"
                                            ? uiLanguage === "en" ? "Over target" : "Hedefi aşıyor"
                                            : uiLanguage === "en" ? "Needs more substance" : "Daha zengin olmalı"}
                                      </span>
                                    </div>

                                    <label className="text-xs font-semibold text-slate-700">
                                      {uiLanguage === "en" ? "Narration" : "Anlatım"}
                                      <textarea
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
                                        className="mt-2 min-h-40 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm font-normal leading-6 text-slate-950"
                                      />
                                    </label>

                                    {hasDialogue || sceneScriptDraft.dialogue.trim() ? (
                                      <label className="text-xs font-semibold text-slate-700">
                                        {uiLanguage === "en" ? "Dialogue · optional" : "Diyalog · opsiyonel"}
                                        <textarea
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
                                          className="mt-2 min-h-28 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm font-normal leading-6 text-slate-950"
                                        />
                                      </label>
                                    ) : (
                                      <details className="rounded-xl border border-blue-100 bg-white">
                                        <summary className="cursor-pointer list-none px-3 py-3 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                                          {uiLanguage === "en" ? "+ Add optional dialogue" : "+ Opsiyonel diyalog ekle"}
                                        </summary>
                                        <div className="border-t border-blue-100 p-3">
                                          <textarea
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
                                            placeholder={uiLanguage === "en" ? "Add dialogue only when the scene needs a speaking character." : "Yalnızca sahnede konuşan bir karakter gerekiyorsa diyalog ekle."}
                                            className="min-h-28 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm font-normal leading-6 text-slate-950"
                                          />
                                        </div>
                                      </details>
                                    )}

                                    <div className="grid gap-2 sm:grid-cols-3">
                                      <div className="rounded-xl border border-blue-100 bg-white p-3">
                                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{uiLanguage === "en" ? "Words" : "Kelime"}</span>
                                        <strong className="mt-1 block text-sm text-slate-950">{sceneDraftHealth.speechWordCount} · {sceneDraftHealth.minWords}–{sceneDraftHealth.maxWords}</strong>
                                      </div>
                                      <div className="rounded-xl border border-blue-100 bg-white p-3">
                                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{uiLanguage === "en" ? "Speech" : "Konuşma"}</span>
                                        <strong className="mt-1 block text-sm text-slate-950">{sceneDraftHealth.estimatedSpeechSec.toFixed(1)}s / {sceneDraftHealth.targetDurationSec.toFixed(1)}s</strong>
                                      </div>
                                      <div className="rounded-xl border border-blue-100 bg-white p-3">
                                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{uiLanguage === "en" ? "Visual beats" : "Görsel akış"}</span>
                                        <strong className="mt-1 block text-sm text-slate-950">{scene.visualBlockPlan?.length || sceneDraftHealth.visualBlockCount}</strong>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => autoFitCreatorSceneScript(scene.id)}
                                        disabled={sceneScriptFitLoadingId === scene.id}
                                        className="min-h-11 rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
                                      >
                                        {sceneScriptFitLoadingId === scene.id
                                          ? uiLanguage === "en" ? "Fitting..." : "Uyarlanıyor..."
                                          : uiLanguage === "en" ? "Auto-fit with AI" : "AI ile süreye uyarla"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => splitCreatorScene(scene.id)}
                                        className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                      >
                                        {uiLanguage === "en" ? "Split scene" : "Sahneyi böl"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => saveCreatorSceneScript(scene.id)}
                                        className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
                                      >
                                        {uiLanguage === "en" ? "Save script" : "Metni kaydet"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingSceneId(null);
                                          setSceneScriptDrafts((prev) => {
                                            const next = { ...prev };
                                            delete next[scene.id];
                                            return next;
                                          });
                                        }}
                                        className="min-h-11 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500"
                                      >
                                        {ui.cancel}
                                      </button>
                                    </div>

                                    {sceneFitFeedback && (
                                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950" role="status" aria-live="polite">
                                        <strong className="block">
                                          {sceneFitFeedback.state === "split_recommended"
                                            ? uiLanguage === "en" ? "Split recommended" : "Bölme önerilir"
                                            : sceneFitFeedback.state === "extend_duration"
                                              ? uiLanguage === "en" ? "Extend duration" : "Süreyi uzat"
                                              : sceneFitFeedback.state === "accepted"
                                                ? uiLanguage === "en" ? "Autofit applied" : "Auto-fit uygulandı"
                                                : uiLanguage === "en" ? "Autofit kept the original" : "Auto-fit orijinali korudu"}
                                        </strong>
                                        <span>{sceneFitFeedback.message}</span>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {sceneFitFeedback.state === "extend_duration" && sceneFitFeedback.suggestedDurationSec && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const duration = sceneFitFeedback.suggestedDurationSec!;
                                                setScenes((current) => current.map((item) => item.id === scene.id ? {
                                                  ...item,
                                                  targetDurationSec: duration,
                                                  timing: item.timing ? { ...item.timing, targetSceneDuration: duration, plannedSceneDuration: duration } : item.timing,
                                                } : item));
                                                setSaveMessage(uiLanguage === "en" ? `Scene duration updated to ${duration.toFixed(1)} seconds.` : `Sahne süresi ${duration.toFixed(1)} saniyeye güncellendi.`);
                                              }}
                                              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 font-semibold text-blue-800"
                                            >
                                              {uiLanguage === "en" ? "Apply duration" : "Süreyi uygula"}
                                            </button>
                                          )}
                                          {sceneFitFeedback.state === "split_recommended" && (
                                            <button type="button" onClick={() => splitCreatorScene(scene.id)} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 font-semibold text-blue-800">
                                              {uiLanguage === "en" ? "Split scene" : "Sahneyi böl"}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    <details className="rounded-xl border border-blue-100 bg-white">
                                      <summary className="cursor-pointer list-none px-3 py-3 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                                        {uiLanguage === "en" ? "Improve this scene with AI" : "Bu sahneyi AI ile geliştir"}
                                      </summary>
                                      <div className="border-t border-blue-100 p-3">
                                        <textarea
                                          value={sceneInstructions[scene.id] || ""}
                                          onChange={(event) =>
                                            setSceneInstructions((prev) => ({ ...prev, [scene.id]: event.target.value }))
                                          }
                                          placeholder={ui.sceneEditPlaceholder}
                                          className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-950"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => updateScene(scene.id)}
                                          disabled={sceneLoadingId === scene.id}
                                          className="mt-2 min-h-11 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50"
                                        >
                                          {sceneLoadingId === scene.id ? ui.updating : ui.updateScene}
                                        </button>
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                            )}

                            {activeSceneInspectorTab === "visual" && (
                              <div
                                id={`scene-${scene.id}-visual-panel`}
                                role="tabpanel"
                                aria-labelledby={`scene-${scene.id}-visual-tab`}
                                className="creatorlab-scene-visual-workspace"
                              >
                                        <div className="creatorlab-scene-visual-storage" data-visual-storage-status-mount="true">
                                          <CreatorVisualStorageStatus
                                            language={uiLanguage === "en" ? "en" : "tr"}
                                            getAccessToken={getAccessTokenOrThrow}
                                          />
                                        </div>
                                <div className="creatorlab-scene-visual-main space-y-3">
                                  <div className="rounded-xl border border-slate-200 bg-white p-3" data-creator-visual-source-selector="true">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      {uiLanguage === "en" ? "Visual source" : "Görsel kaynağı"}
                                    </span>
                                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={uiLanguage === "en" ? "Visual source method" : "Görsel kaynak yöntemi"}>
                                      {([
                                        ["recommended", uiLanguage === "en" ? "Velto Recommended" : "Velto Önerilen"],
                                        ["stock", uiLanguage === "en" ? "Stock" : "Stok"],
                                        ["ai_image", uiLanguage === "en" ? "AI Image" : "AI Görsel"],
                                        ["ai_video", "AI Video"],
                                        ["upload", uiLanguage === "en" ? "Upload" : "Yükle"],
                                      ] as const).map(([method, label]) => {
                                        const blocked = method === "ai_video" && creatorQualityMode !== "pro" && creatorQualityMode !== "cinematic";
                                        return (
                                          <button
                                            key={method}
                                            type="button"
                                            aria-pressed={sceneVisualSourceMethod === method}
                                            disabled={blocked}
                                            title={blocked
                                              ? (uiLanguage === "en" ? "AI Video unavailable for Standard quality" : "AI Video Standart kalitede kullanılamaz")
                                              : undefined}
                                            onClick={() => setCreatorScenesVisualSourceMethod([scene.id], method)}
                                            className={`min-h-9 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                                              sceneVisualSourceMethod === method
                                                ? "border-blue-600 bg-blue-600 text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            }`}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {sceneExplicitAiVideoBlocked && (
                                      <p className="mt-2 text-xs text-amber-700" role="status">
                                        {uiLanguage === "en" ? "AI Video unavailable for Standard quality." : "AI Video Standart kalitede kullanılamaz."}
                                      </p>
                                    )}
                                  </div>
                                  {sceneVisualSourceMethod === "stock" && currentProjectId && (
                                    <CreatorStockPicker
                                      creatorFormat={creatorFormat === "youtube_video" ? "youtube_video" : "short_form"}
                                      projectId={currentProjectId}
                                      disabled={isBatchRendering || creatorMediaPreflightLoading}
                                      language={uiLanguage === "en" ? "en" : "tr"}
                                      getAccessToken={getAccessTokenOrThrow}
                                      onUse={(asset) => onUseCreatorStockMedia(scene.creatorSceneId!, asset)}
                                    />
                                  )}
                                  {sceneVisualSourceMethod === "upload" && currentProjectId && (
                                    <CreatorUploadPicker
                                      projectId={currentProjectId}
                                      sceneId={scene.id}
                                      disabled={isBatchRendering || creatorMediaPreflightLoading}
                                      language={uiLanguage === "en" ? "en" : "tr"}
                                      hasBoundUpload={
                                        scene.assetHistory?.some((asset) =>
                                          asset.source === "uploaded" &&
                                          (asset.url === scene.image || asset.url === scene.videoUrl)
                                        ) === true
                                      }
                                      getAccessToken={getAccessTokenOrThrow}
                                      onUse={(asset) => onUseCreatorUploadedMedia(scene.id, asset)}
                                      onRemove={() => removeCreatorUploadedMediaFromScene(scene.id)}
                                    />
                                  )}
                                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {sceneOutputMode === "video" && scene.videoUrl && scene.videoStatus === "done" ? (
                                      <video
                                        data-creator-scene-video-preview="contain"
                                        ref={(element) => {
                                          creatorSceneVideoPreviewRefs.current[stableCreatorSceneId] = element;
                                        }}
                                        src={scene.videoUrl}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        onLoadedMetadata={(event) => {
                                          const videoUrl = scene.videoUrl || "";
                                          if (!matchesExpectedCreatorVideoSource({
                                            expectedUrl: videoUrl,
                                            currentSrc: event.currentTarget.currentSrc,
                                            baseUrl: event.currentTarget.ownerDocument?.baseURI,
                                          })) return;
                                          const duration = event.currentTarget.duration;
                                          if (!Number.isFinite(duration) || duration <= 0) return;
                                          setCreatorSceneVideoSourceDurations((current) => {
                                            const cached = current[stableCreatorSceneId];
                                            return cached?.videoUrl === videoUrl && cached.durationSec === duration
                                              ? current
                                              : { ...current, [stableCreatorSceneId]: { videoUrl, durationSec: duration } };
                                          });
                                          const trim = normalizeCreatorSceneTrim({
                                            clipInSec: scene.clipInSec,
                                            clipOutSec: scene.clipOutSec,
                                            sourceDurationSec: duration,
                                            sourceType: "video",
                                          });
                                          if (trim.isTrimmed) event.currentTarget.currentTime = trim.clipInSec || 0;
                                        }}
                                        onPlay={(event) => {
                                          if (!sceneCardTrim.isTrimmed) return;
                                          const start = sceneCardTrim.clipInSec || 0;
                                          const end = sceneCardTrim.clipOutSec || sceneVideoSourceDurationSec;
                                          if (event.currentTarget.currentTime < start || event.currentTarget.currentTime >= end - 0.02) {
                                            event.currentTarget.currentTime = start;
                                          }
                                        }}
                                        onTimeUpdate={(event) => {
                                          if (!sceneCardTrim.isTrimmed) return;
                                          const end = sceneCardTrim.clipOutSec || sceneVideoSourceDurationSec;
                                          if (event.currentTarget.currentTime >= end - 0.02) {
                                            event.currentTarget.currentTime = end;
                                            event.currentTarget.pause();
                                          }
                                        }}
                                        onSeeking={(event) => {
                                          if (!sceneCardTrim.isTrimmed) return;
                                          const start = sceneCardTrim.clipInSec || 0;
                                          const end = sceneCardTrim.clipOutSec || sceneVideoSourceDurationSec;
                                          if (event.currentTarget.currentTime < start) event.currentTarget.currentTime = start;
                                          if (event.currentTarget.currentTime > end) event.currentTarget.currentTime = end;
                                        }}
                                        className="aspect-video w-full bg-slate-950 object-contain"
                                      />
                                    ) : scene.image ? (
                                      <img src={scene.image} alt={`${uiLanguage === "en" ? "Scene" : "Sahne"} ${scene.id}`} className="aspect-video w-full bg-slate-950 object-contain" />
                                    ) : (
                                      <div className="flex aspect-video items-center justify-center bg-slate-100 px-4 text-center text-xs text-slate-500">
                                        {uiLanguage === "en" ? "Continue Production will generate this visual." : "Üretime Devam Et bu görseli oluşturacak."}
                                      </div>
                                    )}
                                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <strong className="text-xs text-slate-900">{simpleGuidance}</strong>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          {uiLanguage === "en"
                                            ? "Continuity and quality diagnostics run automatically in the background."
                                            : "Süreklilik ve kalite kontrolleri arka planda otomatik çalışır."}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${visualReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                          {visualReady ? uiLanguage === "en" ? "Visual ready" : "Görsel hazır" : uiLanguage === "en" ? "Visual pending" : "Görsel bekliyor"}
                                        </span>
                                        {sceneVisualSourceMethod !== "stock" && sceneVisualSourceMethod !== "upload" && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (sceneVisualCountdownActive) {
                                                cancelCreatorSceneVisualCountdown(scene.id);
                                                return;
                                              }
                                              void runCreatorRecommendedVisualGeneration({
                                                mode: "single",
                                                sceneIds: [scene.id],
                                              });
                                            }}
                                            disabled={
                                              (sceneVisualActionBlocked && !sceneVisualCountdownActive) ||
                                              scene.videoStatus === "processing" ||
                                              scene.videoStatus === "delayed" ||
                                              creatorMediaPreflightLoading ||
                                              sceneExplicitAiVideoBlocked
                                            }
                                            title={
                                              sceneExplicitAiVideoBlocked
                                                ? uiLanguage === "en" ? "AI Video unavailable for Standard quality" : "AI Video Standart kalitede kullanılamaz"
                                                : undefined
                                            }
                                            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                          >
                                            {sceneVisualCountdownActive
                                              ? uiLanguage === "en"
                                                ? `Cancel · ${creatorSceneVisualOperation?.secondsRemaining}s`
                                                : `İptal · ${creatorSceneVisualOperation?.secondsRemaining} sn`
                                              : sceneVisualGenerating
                                              ? uiLanguage === "en" ? "Generating…" : "Üretiliyor…"
                                              : sceneVisualSourceMethod === "ai_image"
                                                ? scene.image
                                                  ? uiLanguage === "en" ? "Regenerate image" : "Görseli yeniden üret"
                                                  : uiLanguage === "en" ? "Generate Image" : "Görsel Üret"
                                                : sceneVisualSourceMethod === "ai_video"
                                                  ? sceneExplicitAiVideoBlocked
                                                    ? uiLanguage === "en" ? "Pro quality required" : "Pro kalite gerekli"
                                                    : scene.videoUrl && scene.videoStatus === "done"
                                                      ? uiLanguage === "en" ? "Regenerate video" : "Videoyu yeniden üret"
                                                      : uiLanguage === "en" ? "Generate Video" : "Video Üret"
                                                  : uiLanguage === "en" ? "Generate Visual" : "Görsel Üret"}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setCreatorAssetHistoryOpen((prev) => ({ ...prev, [scene.id]: !prev[scene.id] }))}
                                          className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          {uiLanguage === "en" ? "Versions" : "Sürümler"} ({sceneAssetHistory.length})
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {stableCreatorSceneId && sceneOutputMode === "video" && scene.videoUrl && scene.videoStatus === "done" && (
                                    <section className="rounded-xl border border-slate-200 bg-white p-4" data-creator-scene-card-video-trim={stableCreatorSceneId}>
                                      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                                        <div>
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                            {uiLanguage === "en" ? "Media & Timing" : "Medya ve Zamanlama"}
                                          </span>
                                          <strong className="mt-1 block text-sm text-slate-950">
                                            {uiLanguage === "en" ? "Trim Video" : "Videoyu Kırp"}
                                          </strong>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                          {uiLanguage === "en" ? "Source" : "Kaynak"}: {sceneVideoSourceDurationSec.toFixed(1)}s
                                        </span>
                                      </div>
                                      <CreatorVideoTrimControl
                                        sourceDurationSec={sceneVideoSourceDurationSec}
                                        clipInSec={scene.clipInSec}
                                        clipOutSec={scene.clipOutSec}
                                        targetDurationSec={targetDurationSec}
                                        speechDurationSec={measuredAudioDurationSec}
                                        speechTailBufferSec={scene.timing?.speechTailBuffer}
                                        language={uiLanguage === "en" ? "en" : "tr"}
                                        disabled={sceneTrimDisabled}
                                        onPreviewBoundary={(seconds) => {
                                          const video = creatorSceneVideoPreviewRefs.current[stableCreatorSceneId];
                                          if (video) video.currentTime = seconds;
                                        }}
                                        onCommitTrim={(trim) => updateCreatorSceneTrim({
                                          creatorSceneId: stableCreatorSceneId,
                                          ...trim,
                                          verifiedSourceDurationSec: verifiedSceneVideoSourceDurationSec,
                                        })}
                                      />
                                    </section>
                                  )}

                                  {sceneVisualCountdownActive && (
                                    <span className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800" aria-live="assertive">
                                      {uiLanguage === "en"
                                        ? `Starting in ${creatorSceneVisualOperation?.secondsRemaining}s · No generation request has been sent yet.`
                                        : `${creatorSceneVisualOperation?.secondsRemaining} sn içinde başlıyor · Henüz üretim talebi gönderilmedi.`}
                                    </span>
                                  )}
                                  {sceneVideoDispatchCountdownActive && (
                                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800" aria-live="assertive">
                                      {uiLanguage === "en"
                                        ? "No generation request has been sent yet."
                                        : "Henüz üretim talebi gönderilmedi."}
                                    </p>
                                  )}

                                  {(scene.videoStatus === "processing" || scene.videoStatus === "delayed") && scene.videoQueueJobId && (
                                    <button
                                      type="button"
                                      onClick={() => void requestCancelSceneVideo(scene)}
                                      disabled={cancellingVideoSceneId === scene.id}
                                      title={uiLanguage === "en" ? "Stop this generation. A request that already started may still complete." : "Bu üretimi durdur. Başlamış bir talep yine de tamamlanabilir."}
                                      className="min-h-11 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {cancellingVideoSceneId === scene.id
                                        ? uiLanguage === "en" ? "Cancelling video..." : "Video iptal ediliyor..."
                                        : uiLanguage === "en" ? "Stop video · no refund" : "Videoyu durdur · iade yok"}
                                    </button>
                                  )}

                                  {creatorAssetHistoryOpen[scene.id] && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                      <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                          {uiLanguage === "en" ? "Asset versions" : "Varlık sürümleri"}
                                        </span>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          {uiLanguage === "en"
                                            ? "Generated images and completed video blocks remain available for comparison and restore."
                                            : "Üretilen görseller ve tamamlanan video blokları karşılaştırma ve geri yükleme için korunur."}
                                        </p>
                                      </div>

                                      <div className="mt-4 space-y-4">
                                        {sceneAssetHistory.length === 0 ? (
                                          <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
                                            {uiLanguage === "en"
                                              ? "Versions will appear after an image or video is generated."
                                              : "Bir görsel veya video üretildikten sonra sürümler burada görünecek."}
                                          </div>
                                        ) : (
                                          <div className="grid gap-3 sm:grid-cols-2">
                                            {sceneAssetHistory.map((asset, assetIndex) => {
                                              const isCurrentAsset =
                                                asset.kind === "image"
                                                  ? scene.image === asset.url
                                                  : scene.videoUrl === asset.url && scene.videoStatus === "done";
                                              const isSelectedForCompare = sceneComparedAssetIds.includes(asset.id);
                                              const assetVersionNumber = sceneAssetHistory
                                                .slice(assetIndex)
                                                .filter((item) => item.kind === asset.kind).length;

                                              return (
                                                <article
                                                  key={asset.id}
                                                  className={`overflow-hidden rounded-xl border ${
                                                    isCurrentAsset
                                                      ? "border-emerald-300 bg-emerald-50/40"
                                                      : isSelectedForCompare
                                                        ? "border-blue-300 bg-blue-50/40"
                                                        : "border-slate-200 bg-white"
                                                  }`}
                                                >
                                                  {asset.kind === "video" ? (
                                                    <video
                                                      src={asset.url}
                                                      muted
                                                      playsInline
                                                      preload="metadata"
                                                      className="aspect-video w-full bg-slate-950 object-contain"
                                                    />
                                                  ) : (
                                                    <img
                                                      src={asset.url}
                                                      alt={uiLanguage === "en" ? `Scene ${scene.id} image version` : `Sahne ${scene.id} görsel sürümü`}
                                                      className="aspect-video w-full bg-slate-950 object-contain"
                                                    />
                                                  )}
                                                  <div className="space-y-3 p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                      <div>
                                                        <strong className="text-xs text-slate-900">
                                                          {asset.kind === "video"
                                                            ? uiLanguage === "en" ? "Video version" : "Video sürümü"
                                                            : uiLanguage === "en" ? "Image version" : "Görsel sürümü"}
                                                          {` ${Math.max(1, assetVersionNumber)}`}
                                                        </strong>
                                                        <p className="mt-1 text-[10px] text-slate-500">
                                                          {formatCreatorAssetTimestamp(asset.createdAt, uiLanguage)}
                                                          {asset.durationSec ? ` · ${asset.durationSec.toFixed(1)}s` : ""}
                                                        </p>
                                                      </div>
                                                      {isCurrentAsset && (
                                                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                                          {uiLanguage === "en" ? "Used in scene" : "Sahnede kullanılıyor"}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => toggleCreatorAssetCompare(scene.id, asset.id)}
                                                        className={`min-h-10 rounded-lg border px-2 py-2 text-[11px] font-semibold ${
                                                          isSelectedForCompare
                                                            ? "border-blue-300 bg-blue-50 text-blue-800"
                                                            : "border-slate-200 bg-white text-slate-600"
                                                        }`}
                                                      >
                                                        {isSelectedForCompare
                                                          ? uiLanguage === "en" ? "Remove" : "Çıkar"
                                                          : uiLanguage === "en" ? "Compare" : "Karşılaştır"}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => restoreCreatorSceneAsset(scene.id, asset)}
                                                        disabled={isCurrentAsset}
                                                        className="min-h-10 rounded-lg border border-violet-200 bg-violet-50 px-2 py-2 text-[11px] font-semibold text-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                                                      >
                                                        {uiLanguage === "en" ? "Restore" : "Geri yükle"}
                                                      </button>
                                                    </div>
                                                    {!isCurrentAsset && (
                                                      <div data-visual-media-cleanup="asset-version">
                                                        <CreatorVisualAssetCleanupAction
                                                          mediaUrl={asset.url}
                                                          projectId={currentProjectId}
                                                          language={uiLanguage === "en" ? "en" : "tr"}
                                                          getAccessToken={getAccessTokenOrThrow}
                                                          onHistoryRemoved={removeCreatorProjectHistoryUrl}
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                </article>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {sceneComparedAssets.length > 0 && (
                                          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                              <strong className="text-xs text-blue-950">
                                                {uiLanguage === "en" ? "Version comparison" : "Sürüm karşılaştırması"}
                                              </strong>
                                              <span className="text-[10px] font-semibold text-blue-700">
                                                {sceneComparedAssets.length}/2
                                              </span>
                                            </div>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                              {sceneComparedAssets.map((asset) => (
                                                <div key={`compare-${asset.id}`} className="overflow-hidden rounded-lg border border-blue-200 bg-white">
                                                  {asset.kind === "video" ? (
                                                    <video src={asset.url} controls playsInline className="aspect-video w-full bg-slate-950 object-contain" />
                                                  ) : (
                                                    <img
                                                      src={asset.url}
                                                      alt={uiLanguage === "en" ? "Compared image version" : "Karşılaştırılan görsel sürümü"}
                                                      className="aspect-video w-full bg-slate-950 object-contain"
                                                    />
                                                  )}
                                                  <p className="px-2 py-2 text-[10px] font-semibold text-slate-600">
                                                    {asset.kind === "video"
                                                      ? uiLanguage === "en" ? "Video" : "Video"
                                                      : uiLanguage === "en" ? "Image" : "Görsel"}
                                                    {` · ${formatCreatorAssetTimestamp(asset.createdAt, uiLanguage)}`}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <aside className="creatorlab-scene-visual-inspector space-y-3">
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      {uiLanguage === "en" ? "Output" : "Çıktı"}
                                    </span>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <strong className="block text-base text-slate-950">
                                          {uiLanguage === "en" ? "Using" : "Kullanılan"}: {sceneOutputMode === "video" ? "Video" : uiLanguage === "en" ? "Image" : "Görsel"}
                                        </strong>
                                        <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${sceneOutputIsUserChoice ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>
                                          {sceneOutputIsUserChoice
                                            ? uiLanguage === "en" ? "Your choice" : "Senin seçimin"
                                            : uiLanguage === "en" ? "Velto recommended" : "Velto önerisi"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className={`mt-3 border-t border-slate-100 pt-3 ${sceneOutputIsUserChoice ? "rounded-xl border border-blue-100 bg-blue-50/50 p-3" : ""}`}>
                                      <strong className="text-[11px] text-slate-800">
                                        {sceneOutputIsUserChoice
                                          ? `${uiLanguage === "en" ? "Velto recommends" : "Velto öneriyor"} ${veltoRecommendedOutputMode === "video" ? "Video" : uiLanguage === "en" ? "Image" : "Görsel"}`
                                          : uiLanguage === "en" ? "Why this" : "Neden bu"}
                                      </strong>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {veltoRecommendedOutputMode === "video"
                                          ? uiLanguage === "en" ? "Motion strengthens this scene's visual beat." : "Hareket, bu sahnenin görsel etkisini güçlendirir."
                                          : uiLanguage === "en" ? "A focused image keeps this scene clear and efficient." : "Odaklı bir görsel bu sahneyi net ve verimli tutar."}
                                      </p>
                                      {sceneOutputIsUserChoice && (
                                        <button
                                          type="button"
                                          onClick={() => returnCreatorSceneToRecommendedOutput(scene.id)}
                                          className="mt-2 min-h-10 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                                        >
                                          {uiLanguage === "en" ? "Use recommendation" : "Öneriyi kullan"}
                                        </button>
                                      )}
                                    </div>
                                    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70">
                                      <summary className="min-h-10 cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                                        {uiLanguage === "en" ? "Change output" : "Çıktıyı değiştir"}
                                      </summary>
                                      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-2">
                                      <button
                                        type="button"
                                        onClick={() => setCreatorSceneRenderMode(scene.id, "image")}
                                        className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                          sceneOutputMode === "image"
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                                        }`}
                                      >
                                        {uiLanguage === "en" ? "Image" : "Görsel"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCreatorSceneRenderMode(scene.id, "video")}
                                        className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                          sceneOutputMode === "video"
                                            ? "border-blue-300 bg-blue-50 text-blue-800"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                                        }`}
                                      >
                                        Video
                                      </button>
                                      </div>
                                    </details>
                                    {sceneOutputMode === "video" && creatorVideoSelectionBlockedByQuality && (
                                      <p className="mt-2 text-[11px] leading-4 text-amber-700">
                                        {uiLanguage === "en"
                                          ? "Video generation requires Pro or Cinematic Production Quality."
                                          : "Video üretimi Pro veya Cinematic Production Quality gerektirir."}
                                      </p>
                                    )}
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {uiLanguage === "en" ? "Production brief" : "Üretim özeti"}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                        {(scene.visualBlockPlan?.length || sceneDraftHealth.visualBlockCount)} {uiLanguage === "en" ? "beats" : "akış"}
                                      </span>
                                    </div>
                                    <div className="mt-3 divide-y divide-slate-100">
                                      <div className="grid grid-cols-[72px_1fr] gap-3 py-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{uiLanguage === "en" ? "Camera" : "Kamera"}</span>
                                        <p className="text-xs leading-5 text-slate-600">{scene.cameraDirection || "—"}</p>
                                      </div>
                                      <div className="grid grid-cols-[72px_1fr] gap-3 py-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{uiLanguage === "en" ? "Emotion" : "Duygu"}</span>
                                        <p className="text-xs leading-5 text-slate-600">{scene.emotion || "—"}</p>
                                      </div>
                                      <div className="grid grid-cols-[72px_1fr] gap-3 py-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{uiLanguage === "en" ? "Motion" : "Hareket"}</span>
                                        <p className="text-xs leading-5 text-slate-600">{scene.motionHint || "—"}</p>
                                      </div>
                                      <details className="group/continuity py-2">
                                        <summary className="grid min-h-10 cursor-pointer list-none grid-cols-[72px_1fr_auto] items-center gap-3 rounded-lg text-left [&::-webkit-details-marker]:hidden">
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{uiLanguage === "en" ? "Continuity" : "Devamlılık"}</span>
                                          <span className="text-xs leading-5 text-slate-600">{sceneContinuityLabel}</span>
                                          <span className="text-xs text-slate-400 transition group-open/continuity:rotate-180" aria-hidden="true">⌄</span>
                                        </summary>
                                        <label className="mt-2 block">
                                          <span className="sr-only">{uiLanguage === "en" ? "Scene continuity mode" : "Sahne devamlılık modu"}</span>
                                          <select
                                            value={sceneContinuitySelection}
                                            onChange={(event) => updateCreatorSceneContinuityMode(scene.id, event.target.value as CreatorSceneContinuityMode)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                          >
                                            <option value="project">{uiLanguage === "en" ? "Use project default" : "Proje varsayılanını kullan"}</option>
                                            <option value="independent">{uiLanguage === "en" ? "Independent scene" : "Bağımsız sahne"}</option>
                                            <option value="consistent">{uiLanguage === "en" ? "Keep character & world" : "Karakter ve evreni koru"}</option>
                                            <option value="previous" disabled={index === 0}>{uiLanguage === "en" ? "Continue previous scene" : "Önceki sahneyi devam ettir"}</option>
                                          </select>
                                          <small className="mt-2 block text-[11px] leading-5 text-slate-500">
                                            {getCreatorResolvedContinuityMode(scene) === "previous"
                                              ? uiLanguage === "en" ? "Directly continues the previous scene." : "Önceki sahnenin doğrudan devamıdır."
                                              : getCreatorResolvedContinuityMode(scene) === "consistent"
                                                ? uiLanguage === "en" ? "Keeps the recurring character and visual world." : "Tekrar eden karakteri ve görsel evreni korur."
                                                : uiLanguage === "en" ? "Generated as an independent visual beat." : "Bağımsız bir görsel anlatım olarak üretilir."}
                                          </small>
                                        </label>
                                      </details>
                                    </div>
                                    {sceneContinuityWarning && (
                                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3" role="status">
                                        <strong className="text-[11px] text-amber-900">
                                          {uiLanguage === "en" ? "Continuity needs attention" : "Devamlılık kontrol edilmeli"}
                                        </strong>
                                        <ul className="mt-1 space-y-1 text-[11px] leading-5 text-amber-800">
                                          {sceneContinuityWarning.messages.map((message) => <li key={message}>{message}</li>)}
                                        </ul>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (scene.creatorSceneId) setSelectedCreatorEditorSceneId(scene.creatorSceneId);
                                            setCreatorEditorOpen(true);
                                          }}
                                          className="mt-2 min-h-10 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-semibold text-amber-900"
                                        >
                                          {uiLanguage === "en" ? "Review in editor" : "Editörde kontrol et"}
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void editCreatorSceneVisualDirectionWithAI(scene)}
                                      disabled={creatorVisualDirectionLoadingId !== null}
                                      className="mt-3 min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {creatorVisualDirectionLoadingId === scene.id
                                        ? uiLanguage === "en"
                                          ? "Improving direction..."
                                          : "Görsel yön geliştiriliyor..."
                                        : uiLanguage === "en"
                                          ? "Edit direction"
                                          : "Yönü düzenle"}
                                    </button>
                                  </div>
                                </aside>
                              </div>
                            )}

                            {activeSceneInspectorTab === "audio" && (
                              <div
                                id={`scene-${scene.id}-audio-panel`}
                                role="tabpanel"
                                aria-labelledby={`scene-${scene.id}-audio-tab`}
                                className="space-y-4"
                              >
                                <div className={`grid gap-3 ${hasDialogue ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                  <label className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                                      {uiLanguage === "en" ? "Narrator delivery for this scene" : "Bu sahnenin anlatıcı ifade stili"}
                                    </span>
                                    <select
                                      className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-950"
                                      value={scene.narratorVoiceProfileId || ""}
                                      onChange={(event) => {
                                        const nextProfileId = event.target.value
                                          ? normalizeCreatorVoiceSelectionId(event.target.value)
                                          : undefined;
                                        setScenes((currentScenes) =>
                                          currentScenes.map((item) =>
                                            item.id === scene.id
                                              ? {
                                                  ...item,
                                                  narratorVoiceProfileId: nextProfileId,
                                                  audioUrl: "",
                                                  audioPath: "",
                                                  audioSourceText: "",
                                                  audioSettingsKey: "",
                                                  timing: buildSceneTimingForCurrentFlow(
                                                    0,
                                                    item.timing?.dialogueDuration || 0,
                                                    item,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                    >
                                      <option value="">
                                        {uiLanguage === "en"
                                          ? `Project default · ${getCreatorVoiceSelectionLabel(
                                              getEffectiveNarratorVoiceProfileId(),
                                              "en",
                                            )}`
                                          : `Proje varsayılanı · ${getCreatorVoiceSelectionLabel(
                                              getEffectiveNarratorVoiceProfileId(),
                                              "tr",
                                            )}`}
                                      </option>
                                      {CREATOR_VOICE_SELECTIONS.map((profile) => (
                                        <option key={`scene-${scene.id}-narrator-${profile.id}`} value={profile.id}>
                                          {uiLanguage === "en" ? profile.labelEn : profile.labelTr}
                                        </option>
                                      ))}
                                    </select>
                                    <small className="mt-2 block text-xs leading-5 text-violet-800">
                                      {uiLanguage === "en"
                                        ? getCreatorVoiceSelection(effectiveNarratorVoiceProfileId).descriptionEn
                                        : getCreatorVoiceSelection(effectiveNarratorVoiceProfileId).descriptionTr}
                                    </small>
                                  </label>

                                  {hasDialogue && (
                                    <label className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                                        {uiLanguage === "en" ? "Dialogue delivery for this scene" : "Bu sahnenin diyalog ifade stili"}
                                      </span>
                                      <select
                                        className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-950"
                                        value={scene.dialogueVoiceProfileId || ""}
                                        onChange={(event) => {
                                          const nextProfileId = event.target.value
                                            ? normalizeCreatorVoiceSelectionId(event.target.value, "velto_warm")
                                            : undefined;
                                          setScenes((currentScenes) =>
                                            currentScenes.map((item) =>
                                              item.id === scene.id
                                                ? {
                                                    ...item,
                                                    dialogueVoiceProfileId: nextProfileId,
                                                    dialogueAudioUrl: "",
                                                    dialogueAudioPath: "",
                                                    dialogueAudioSourceText: "",
                                                    dialogueAudioSettingsKey: "",
                                                    timing: buildSceneTimingForCurrentFlow(
                                                      item.timing?.narrationDuration || 0,
                                                      0,
                                                      item,
                                                    ),
                                                  }
                                                : item,
                                            ),
                                          );
                                        }}
                                      >
                                        <option value="">
                                          {uiLanguage === "en"
                                            ? `Project or cast default · ${getCreatorVoiceSelectionLabel(
                                                effectiveDialogueVoiceProfileId,
                                                "en",
                                              )}`
                                            : `Proje veya kadro varsayılanı · ${getCreatorVoiceSelectionLabel(
                                                effectiveDialogueVoiceProfileId,
                                                "tr",
                                              )}`}
                                        </option>
                                        {CREATOR_VOICE_SELECTIONS.map((profile) => (
                                          <option key={`scene-${scene.id}-dialogue-${profile.id}`} value={profile.id}>
                                            {uiLanguage === "en" ? profile.labelEn : profile.labelTr}
                                          </option>
                                        ))}
                                      </select>
                                      <small className="mt-2 block text-xs leading-5 text-rose-800">
                                        {uiLanguage === "en"
                                          ? getCreatorVoiceSelection(effectiveDialogueVoiceProfileId).descriptionEn
                                          : getCreatorVoiceSelection(effectiveDialogueVoiceProfileId).descriptionTr}
                                      </small>
                                    </label>
                                  )}
                                </div>

                                {hasDialogue && characters.length > 0 && (
                                  <label className="block rounded-2xl border border-slate-200 bg-white p-4">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      {uiLanguage === "en" ? "Dialogue speaker" : "Diyalog konuşmacısı"}
                                    </span>
                                    <select
                                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                                      value={
                                        normalizeCreatorDialogueSpeakerCharacterId(
                                          scene.dialogueSpeakerCharacterId,
                                          characters,
                                        ) || ""
                                      }
                                      onChange={(event) => {
                                        const nextSpeakerId = normalizeCreatorDialogueSpeakerCharacterId(
                                          event.target.value,
                                          characters,
                                        );
                                        setScenes((currentScenes) =>
                                          currentScenes.map((item) =>
                                            item.id === scene.id
                                              ? {
                                                  ...item,
                                                  dialogueSpeakerCharacterId: nextSpeakerId,
                                                  dialogueAudioUrl: "",
                                                  dialogueAudioPath: "",
                                                  dialogueAudioSourceText: "",
                                                  dialogueAudioSettingsKey: "",
                                                  timing: buildSceneTimingForCurrentFlow(
                                                    item.timing?.narrationDuration || 0,
                                                    0,
                                                    item,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                    >
                                      <option value="">
                                        {uiLanguage === "en"
                                          ? "Default character voice"
                                          : "Varsayılan karakter sesi"}
                                      </option>
                                      {characters.map((character) => (
                                        <option key={character.id} value={character.id}>
                                          {character.name || (uiLanguage === "en" ? "Unnamed character" : "Adsız karakter")}
                                        </option>
                                      ))}
                                    </select>
                                    <small className="mt-2 block text-xs leading-5 text-slate-500">
                                      {uiLanguage === "en"
                                        ? "This scene supports one dialogue speaker. Selection is free and does not generate audio."
                                        : "Bu sahne tek diyalog konuşmacısını destekler. Seçim ücretsizdir ve ses üretmez."}
                                    </small>
                                  </label>
                                )}

                                <div className={`grid gap-3 ${hasDialogue ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                  <div className="creatorlab-voice-selection-card rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {uiLanguage === "en" ? "Actual narrator voice" : "Gerçek anlatıcı sesi"}
                                      </span>
                                      <strong className="mt-2 block text-sm text-slate-950">
                                        {getEffectiveNarratorVoiceSelection(scene)?.name ||
                                          (uiLanguage === "en" ? "Project / Velto default" : "Proje / Velto varsayılanı")}
                                      </strong>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {getEffectiveNarratorVoiceSelection(scene)
                                          ? getVoiceLibraryDisplayMeta(getEffectiveNarratorVoiceSelection(scene))
                                          : uiLanguage === "en"
                                            ? "This scene inherits the project narrator voice."
                                            : "Bu sahne proje anlatıcı sesini devralır."}
                                      </p>
                                      <p className="mt-1 text-[11px] leading-4 text-slate-400">
                                        {uiLanguage === "en"
                                          ? "Preview and choose another voice without leaving Velto Studio."
                                          : "Velto Studio'dan ayrılmadan başka bir sesi dinle ve seç."}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openCreatorVoiceLibrary({ scope: "scene_narrator", sceneId: scene.id })}
                                      className="creatorlab-voice-change-button"
                                      ref={(node) => {
                                        if (!node) return;
                                        node.style.setProperty("background-color", "#E8F5F1", "important");
                                        node.style.setProperty("border-color", "#B7DDD2", "important");
                                        node.style.setProperty("color", "#2F6F62", "important");
                                      }}
                                      onMouseEnter={(event) => {
                                        event.currentTarget.style.setProperty("background-color", "#DDF0EA", "important");
                                        event.currentTarget.style.setProperty("border-color", "#9DCFC1", "important");
                                      }}
                                      onMouseLeave={(event) => {
                                        event.currentTarget.style.setProperty("background-color", "#E8F5F1", "important");
                                        event.currentTarget.style.setProperty("border-color", "#B7DDD2", "important");
                                      }}
                                    >
                                      {uiLanguage === "en" ? "Change voice" : "Sesi değiştir"}
                                    </button>
                                  </div>

                                  {hasDialogue && (
                                    <div className="creatorlab-voice-selection-card rounded-2xl border border-slate-200 bg-white p-4">
                                      <div className="min-w-0">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                          {uiLanguage === "en" ? "Actual dialogue voice" : "Gerçek diyalog sesi"}
                                        </span>
                                        <strong className="mt-2 block text-sm text-slate-950">
                                          {getEffectiveDialogueVoiceSelection(scene)?.name ||
                                            (uiLanguage === "en" ? "Character / project default" : "Karakter / proje varsayılanı")}
                                        </strong>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          {getEffectiveDialogueVoiceSelection(scene)
                                            ? getVoiceLibraryDisplayMeta(getEffectiveDialogueVoiceSelection(scene))
                                            : uiLanguage === "en"
                                              ? "This scene inherits the matching character or project voice."
                                              : "Bu sahne eşleşen karakter veya proje sesini devralır."}
                                        </p>
                                        <p className="mt-1 text-[11px] leading-4 text-slate-400">
                                          {uiLanguage === "en"
                                            ? "Preview and choose another voice without leaving Velto Studio."
                                            : "Velto Studio'dan ayrılmadan başka bir sesi dinle ve seç."}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openCreatorVoiceLibrary({ scope: "scene_dialogue", sceneId: scene.id })}
                                        className="creatorlab-voice-change-button"
                                        style={{
                                          backgroundColor: "#E8F5F1",
                                          borderColor: "#B7DDD2",
                                          color: "#2F6F62",
                                        }}
                                      >
                                        {uiLanguage === "en" ? "Change voice" : "Sesi değiştir"}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className={`grid gap-3 ${hasDialogue ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                          {uiLanguage === "en" ? "Narrator" : "Anlatıcı"}
                                        </span>
                                        <strong className="mt-2 block text-sm text-slate-950">
                                          {narrationReady ? uiLanguage === "en" ? "Ready" : "Hazır" : uiLanguage === "en" ? "Pending" : "Bekliyor"}
                                        </strong>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          {scene.narration?.trim()
                                            ? `${sceneDraftHealth.speechWordCount} ${uiLanguage === "en" ? "spoken words in the scene" : "sahne konuşma kelimesi"}`
                                            : uiLanguage === "en" ? "No narrator text in this scene." : "Bu sahnede anlatıcı metni yok."}
                                        </p>
                                      </div>
                                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${narrationReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                        {narrationDurationSec > 0 ? `${narrationDurationSec.toFixed(1)}s` : "—"}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => playNarration(scene.id, scene.narration)}
                                      disabled={
                                        !scene.narration?.trim() ||
                                        loadingAudioSceneId === scene.id ||
                                        isPreparingAudio ||
                                        playingDialogueSceneId !== null
                                      }
                                      className={`mt-4 min-h-11 w-full rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                                        narrationReady
                                          ? "creatorlab-voice-listen-button"
                                          : "creatorlab-voice-generate-button"
                                      }`}
                                    >
                                      {loadingAudioSceneId === scene.id
                                        ? uiLanguage === "en" ? "Preparing narrator..." : "Anlatıcı hazırlanıyor..."
                                        : playingSceneId === scene.id
                                          ? uiLanguage === "en" ? "Stop narrator" : "Anlatıcıyı durdur"
                                          : narrationReady
                                            ? uiLanguage === "en" ? "Listen to narrator" : "Anlatıcıyı dinle"
                                            : uiLanguage === "en"
                                              ? "Generate narrator"
                                              : "Anlatıcı üret"}
                                    </button>
                                  </div>

                                  {hasDialogue && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            {uiLanguage === "en" ? "Dialogue" : "Diyalog"}
                                          </span>
                                          <strong className="mt-2 block text-sm text-slate-950">
                                            {dialogueReady ? uiLanguage === "en" ? "Ready" : "Hazır" : uiLanguage === "en" ? "Pending" : "Bekliyor"}
                                          </strong>
                                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{scene.dialogue}</p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${dialogueReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                          {dialogueDurationSec > 0 ? `${dialogueDurationSec.toFixed(1)}s` : "—"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => playSceneDialogue(scene)}
                                        disabled={
                                          loadingDialogueSceneId === scene.id ||
                                          isPreparingAudio ||
                                          isPlayingStory
                                        }
                                        className={`mt-4 min-h-11 w-full rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                                          dialogueReady
                                            ? "creatorlab-voice-listen-button"
                                            : "creatorlab-voice-generate-button"
                                        }`}
                                      >
                                        {loadingDialogueSceneId === scene.id
                                          ? uiLanguage === "en" ? "Preparing dialogue..." : "Diyalog hazırlanıyor..."
                                          : playingDialogueSceneId === scene.id
                                            ? uiLanguage === "en" ? "Stop dialogue" : "Diyaloğu durdur"
                                            : dialogueReady
                                              ? uiLanguage === "en" ? "Listen to dialogue" : "Diyaloğu dinle"
                                              : uiLanguage === "en"
                                                ? "Generate dialogue"
                                                : "Diyalog üret"}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {uiLanguage === "en" ? "Audio timing" : "Ses zamanlaması"}
                                      </span>
                                      <strong className="mt-2 block text-sm text-slate-950">
                                        {exactTimingLocked
                                          ? uiLanguage === "en"
                                            ? `${measuredAudioDurationSec.toFixed(1)}s measured audio · ${targetDurationSec.toFixed(1)}s exact scene`
                                            : `${measuredAudioDurationSec.toFixed(1)} sn ölçülen ses · ${targetDurationSec.toFixed(1)} sn kesin sahne`
                                          : uiLanguage === "en"
                                            ? `${sceneDraftHealth.estimatedSpeechSec.toFixed(1)}s estimated speech · ${plannedDurationSec.toFixed(1)}s planned scene`
                                            : `${sceneDraftHealth.estimatedSpeechSec.toFixed(1)} sn tahmini konuşma · ${plannedDurationSec.toFixed(1)} sn planlanan sahne`}
                                      </strong>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {exactTimingLocked
                                          ? uiLanguage === "en"
                                            ? `Final timing is locked to measured audio plus a ${Number(scene.timing?.transitionTail || scene.timing?.speechTailBuffer || CREATOR_SPEECH_TAIL_BUFFER_SECONDS).toFixed(2)}s transition tail. Preview and export use this same duration.`
                                            : `Final süre, ölçülen sese ${Number(scene.timing?.transitionTail || scene.timing?.speechTailBuffer || CREATOR_SPEECH_TAIL_BUFFER_SECONDS).toFixed(2)} sn geçiş payı eklenerek sabitlendi. Önizleme ve export aynı süreyi kullanır.`
                                          : uiLanguage === "en"
                                            ? "Generate the missing voice track to measure audio and lock the exact scene duration."
                                            : "Sesi ölçmek ve kesin sahne süresini sabitlemek için eksik ses kaydını üret."}
                                      </p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${voiceReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                      {exactTimingLocked
                                        ? uiLanguage === "en" ? "Exact timing" : "Kesin süre"
                                        : voiceReady
                                          ? uiLanguage === "en" ? "Audio ready" : "Ses hazır"
                                          : uiLanguage === "en" ? "Generation needed" : "Üretim gerekli"}
                                    </span>
                                  </div>
                                  {!hasDialogue && (
                                    <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
                                      {uiLanguage === "en"
                                        ? "This scene is narrator-only, so dialogue controls are intentionally hidden."
                                        : "Bu sahne yalnızca anlatıcı içerdiği için diyalog kontrolleri bilinçli olarak gizlendi."}
                                    </p>
                                  )}

                                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    <div className={`rounded-xl px-3 py-3 text-xs leading-5 ${
                                      scene.timing?.splitRecommended ||
                                      scene.timing?.durationMatchStatus === "unsafe" ||
                                      sceneNarratorVoiceRoute?.timingStatus === "blocked"
                                        ? "bg-rose-50 text-rose-800"
                                        : sceneNarratorVoiceRoute?.timingStatus === "tight"
                                          ? "bg-amber-50 text-amber-800"
                                          : "bg-emerald-50 text-emerald-800"
                                    }`}>
                                      <strong className="block">
                                        {uiLanguage === "en" ? "Speech-cut protection" : "Konuşma kesilme koruması"}
                                      </strong>
                                      <span>
                                        {scene.timing?.splitRecommended
                                          ? uiLanguage === "en"
                                            ? `Split into ${scene.timing.recommendedSplitCount || 2} scenes is recommended after measuring the real audio.`
                                            : `Gerçek ses ölçümüne göre ${scene.timing.recommendedSplitCount || 2} sahneye bölme öneriliyor.`
                                          : sceneNarratorVoiceRoute?.timingStatus === "blocked"
                                            ? uiLanguage === "en"
                                              ? "The estimated speech exceeds this scene. Generation can continue, but the timeline will extend or recommend a split."
                                              : "Tahmini konuşma bu sahneyi aşıyor. Üretim devam edebilir; timeline uzatılır veya sahne bölme önerilir."
                                            : sceneNarratorVoiceRoute?.timingStatus === "tight"
                                              ? uiLanguage === "en"
                                                ? "Speech is close to the safe limit. Smart pacing and measured audio duration will be applied."
                                                : "Konuşma güvenli sınıra yakın. Akıllı tempo ve ölçülen gerçek ses süresi uygulanır."
                                              : exactTimingLocked && timingDeltaSec < -0.35
                                                ? uiLanguage === "en"
                                                  ? `Scene shortened by ${Math.abs(timingDeltaSec).toFixed(1)}s. The silent/frozen tail is removed.`
                                                  : `Sahne ${Math.abs(timingDeltaSec).toFixed(1)} sn kısaltıldı. Sessiz/donuk kuyruk kaldırıldı.`
                                                : exactTimingLocked && timingDeltaSec > 0.35
                                                  ? uiLanguage === "en"
                                                    ? `Scene extended by ${timingDeltaSec.toFixed(1)}s so speech finishes without being cut.`
                                                    : `Konuşmanın kesilmemesi için sahne ${timingDeltaSec.toFixed(1)} sn uzatıldı.`
                                                  : exactTimingLocked
                                                    ? uiLanguage === "en"
                                                      ? "Measured audio and scene duration are exactly aligned."
                                                      : "Ölçülen ses ve sahne süresi tam olarak eşleşiyor."
                                                    : uiLanguage === "en"
                                                      ? "The script fits the planned window. Exact timing will be locked after voice generation."
                                                      : "Metin planlanan aralığa uyuyor. Kesin süre ses üretiminden sonra sabitlenecek."}
                                      </span>
                                    </div>
                                    <div className="rounded-xl bg-violet-50 px-3 py-3 text-xs leading-5 text-violet-800">
                                      <strong className="block">
                                        {uiLanguage === "en" ? "Estimated generation cost" : "Tahmini üretim maliyeti"}
                                      </strong>
                                      <span>
                                        {sceneVoiceCreditEstimate.totalTracks} {uiLanguage === "en" ? "missing track(s)" : "eksik ses kaydı"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {activeSceneInspectorTab === "music" && (
                              <div id={`scene-${scene.id}-music-panel`} role="tabpanel" aria-labelledby={`scene-${scene.id}-music-tab`}>
                                <CreatorSceneMusicControls
                                  timeline={creatorAudioTimeline || createDefaultCreatorMusicTimeline()}
                                  projectId={currentProjectId}
                                  sceneIds={scenes.map((item) => item.creatorSceneId || `legacy-${item.id}`)}
                                  sceneId={scene.creatorSceneId || `legacy-${scene.id}`}
                                  disabled={isBatchRendering || creatorMediaPreflightLoading}
                                  getAccessToken={getAccessTokenOrThrow}
                                  language={uiLanguage === "en" ? "en" : "tr"}
                                  onChange={applyCreatorAudioTimelineChange}
                                />
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </section>

              </>
            ))}
          </section>
  );
}
