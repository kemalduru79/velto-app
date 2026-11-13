// Shared structural types moved unchanged from app/create/page.tsx. No runtime values.
import type { CreatorVoiceSelectionId } from "@/lib/creator/voiceProfiles";
import type { CreatorVoiceLibrarySelection } from "@/lib/creator/voiceLibrary";
import type { CreatorBackgroundMusicConfig } from "@/lib/creator/backgroundMusic";
import type { CreatorVisualSourceMethod } from "@/lib/creator/visualSourceMethod";
import type { CreatorProjectContinuityMode, CreatorSceneContinuityMode } from "@/lib/creator/visualContinuity";
import type { CreatorOutcome } from "@/lib/creator/creatorOutcome";
import type { AudioDurationMatchStatus } from "@/lib/video/audioDurationMatching";
import type { CreatorSceneContinuityState } from "@/lib/creator/continuityContracts";
import type { CreatorVisualCoverageBeat } from "@/lib/creator/visualCoverage";
import type { CreatorQualityMode } from "@/lib/creator/mediaRouting";
import type { TimelineSyncPlan } from "@/lib/video/timelineSync";
import type { CreatorPlatformId, CreatorPlatformOutputPlan } from "@/lib/creator/platformPresets";
import type { CreatorAudioTimeline } from "@/lib/creator/audioTimeline";
import type { CreatorProjectLifecycleSnapshot } from "@/lib/creator/projectExportReadiness";
import type { CreatorProjectPerformanceHistoryEntry } from "@/lib/creator/projectPerformanceReport";

export type Character = {
  id?: string;
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory?: string;
  personality: string;
  referenceImage?: string;
  voiceId?: string;
  voiceProfileId?: CreatorVoiceSelectionId;
  voiceSelection?: CreatorVoiceLibrarySelection;
};

export type ContentLanguage = "tr" | "en";

export type CreatorContentType =
  | "documentary_biography"
  | "educational_explainer"
  | "news_commentary"
  | "business_thought_leadership"
  | "product_brand_story"
  | "review_comparison"
  | "case_study"
  | "interview_podcast"
  | "entertainment_storytelling"
  | "social_campaign";

export type CreatorDurationPreset =
  | "short_15"
  | "short_30"
  | "short_45"
  | "short_60"
  | "video_180"
  | "video_300"
  | "video_480"
  | "video_600"
  | "video_900"
  | "custom";

export type CreatorFormat = "short_form" | "youtube_video";

export type CreatorNoCastMode = "faceless" | "narrator";

export type CreatorProductionPackage = {
  sourceScriptRevision?: number;
  outcome?: CreatorOutcome;
  format?: CreatorFormat;
  contentType?: CreatorContentType;
  durationPreset?: CreatorDurationPreset;
  title: string;
  hook: string;
  storyPremise: string;
  characters: Character[];
  visualBible: VisualBible;
  scenes: CreatorProductionScene[];
  thumbnailIdea: string;
  youtubeTitle: string;
  caption: string;
  durationSec?: number;
  sceneCount?: number;
  targetSceneDurationSec?: number;
  qualityMode?: CreatorQualityMode;
  timelineSyncPlan?: TimelineSyncPlan;
  targetPlatforms?: CreatorPublishPlatform[];
  platformOutputPlan?: CreatorPlatformOutputPlan;
  backgroundMusic?: CreatorBackgroundMusicConfig;
  voicePreferences?: {
    narratorProfileId: CreatorVoiceSelectionId;
    dialogueProfileId: CreatorVoiceSelectionId;
    voiceId?: string;
    voiceSelection?: CreatorVoiceLibrarySelection;
    dialogueVoiceId?: string;
    dialogueVoiceSelection?: CreatorVoiceLibrarySelection;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    advancedTuning?: boolean;
  };
  scriptPlan?: {
    version: string;
    durationSec: number;
    sceneCount: number;
    readySceneCount: number;
    needsReviewSceneIds: number[];
    providerAwareVisualBlocks: boolean;
  };
};

export type CreatorProductionScene = {
  id: number;
  creatorSceneId?: string;
  text: string;
  narration: string;
  dialogue: string;
  cameraDirection: string;
  emotion: string;
  motionHint: string;
  visualPrompt?: string;
  audioUrl?: string;
  audioPath?: string;
  audioSourceText?: string;
  audioSettingsKey?: string;
  dialogueAudioUrl?: string;
  dialogueAudioPath?: string;
  dialogueAudioSourceText?: string;
  dialogueAudioSettingsKey?: string;
  timing?: SceneTiming;
  continuity?: CreatorSceneContinuityState;
  intelligence?: SceneIntelligence;
  targetDurationSec?: number;
  estimatedSpeechSec?: number;
  speechWordCount?: number;
  scriptHealth?: CreatorScriptHealth;
  visualBlockPlan?: CreatorVisualBlockPlan[];
  visualCoveragePlan?: CreatorVisualCoverageBeat[];
  clipInSec?: number;
  clipOutSec?: number;
  scriptRevision?: number;
  scriptSectionId?: string;
  scriptSegmentIndex?: number;
  editorialClaimIds?: string[];
};

export type CreatorPublishPlatform = CreatorPlatformId;

export type CreatorReleaseConfirmationKey =
  | "videoReviewed"
  | "claimsVerified"
  | "rightsConfirmed"
  | "thumbnailApproved";

export type CreatorSceneAssetKind = "image" | "video";

export type CreatorSceneAssetVersion = {
  id: string;
  kind: CreatorSceneAssetKind;
  url: string;
  createdAt: string;
  source: "generated" | "restored" | "loaded" | "stock" | "uploaded";
  durationSec?: number;
  generationSignature?: string;
};

export type CreatorSceneInspectorTab = "script" | "visual" | "audio" | "music";

export type CreatorSceneScriptDraft = {
  narration: string;
  dialogue: string;
};

export type CreatorSceneScriptFitFeedback = {
  state: "accepted" | "extend_duration" | "split_recommended" | "rejected";
  message: string;
  suggestedDurationSec?: number;
};

export type CreatorSceneVisualOperation = {
  phase: "countdown" | "processing";
  secondsRemaining: number;
  mediaKind: "image" | "video";
};

export type CreatorScriptHealth = {
  status: "ready" | "too_short" | "too_long";
  speechWordCount: number;
  estimatedSpeechSec: number;
  targetDurationSec: number;
  minWords: number;
  targetWords: number;
  maxWords: number;
  visualBlockCount: number;
  maxMotionBlockSec: number;
};

export type CreatorThumbnailFont = "bold_sans" | "editorial" | "condensed";

export type CreatorThumbnailStudioState = {
  variant: CreatorThumbnailVariant;
  headline: string;
  subHeadline: string;
  accentColor: string;
  headlineColor: string;
  subHeadlineColor: string;
  showHeadline: boolean;
  showSubHeadline: boolean;
  /** Legacy field retained only for migration of previously saved designs. */
  textColor?: string;
  textPosition: CreatorThumbnailTextPosition;
  font: CreatorThumbnailFont;
  focalX: number;
  focalY: number;
  safeZone: boolean;
  headlineScale: number;
  textAlign: CreatorThumbnailTextAlign;
  textStroke: boolean;
  textShadow: boolean;
};

export type CreatorThumbnailTextAlign = "left" | "center" | "right";

export type CreatorThumbnailTextPosition = "top" | "center" | "bottom";

export type CreatorThumbnailVariant = "subject" | "conflict" | "symbol";

export type CreatorUndoEntry = {
  id: string;
  label: string;
  createdAt: string;
  scenes: Scene[];
  productionPackage: CreatorProductionPackage | null;
  refinedScenes: CreatorProductionScene[];
  audioTimeline: CreatorAudioTimeline | null | undefined;
  exportSignature: string;
  selectedCreatorSceneId: string | null;
  focusedCreatorSceneId: string | null;
  directorState: {
    input: string;
    selectedStrategyDirectionId: string;
    selectedHookPattern: string;
    thumbnailStudio: CreatorThumbnailStudioState;
    thumbnailResult: YoutubeThumbnailResult | null;
    releaseConfirmations: Record<CreatorReleaseConfirmationKey, boolean>;
  };
};

export type CreatorVisualBlockPlan = {
  id: string;
  durationSec: number;
  purpose: string;
  prompt: string;
};

export type CreatorVoicePickerTarget =
  | { scope: "project_narrator" }
  | { scope: "project_dialogue" }
  | { scope: "scene_narrator"; sceneId: number }
  | { scope: "scene_dialogue"; sceneId: number }
  | { scope: "character"; characterId: string };

export type ExportMovieResult = {
  movieUrl: string;
  downloadUrl?: string;
  fileName?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  sceneCount?: number;
  projectLifecycle?: CreatorProjectLifecycleSnapshot;
  projectPerformanceHistory?: CreatorProjectPerformanceHistoryEntry[];
};

export type ImageDispatchCountdown = {
  scope: "scene" | "batch" | "thumbnail";
  sceneId: number | null;
  sceneCount: number;
  secondsRemaining: number;
  totalSeconds: number;
};

export type NarratorSettings = {
  voiceId?: string;
  voiceSelection?: CreatorVoiceLibrarySelection;
  dialogueVoiceId?: string;
  dialogueVoiceSelection?: CreatorVoiceLibrarySelection;
  voiceProfileId?: CreatorVoiceSelectionId;
  dialogueVoiceProfileId?: CreatorVoiceSelectionId;
  advancedTuning?: boolean;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style?: number;
  speed?: number;
};

export type Scene = {
  renderMode?: "video" | "image";
  visualSourceMethod?: CreatorVisualSourceMethod;
  projectContinuityMode?: CreatorProjectContinuityMode;
  continuityMode?: CreatorSceneContinuityMode;
  continuity?: CreatorSceneContinuityState;
  id: number;
  creatorSceneId?: string;
  text: string;
  narration: string;
  dialogue: string;
  dialogueSpeakerCharacterId?: string;
  cameraDirection: string;
  emotion: string;
  motionHint: string;
  visualPrompt?: string;
  image?: string;
  audioUrl?: string;
  audioPath?: string;
  audioSourceText?: string;
  audioSettingsKey?: string;
  dialogueAudioUrl?: string;
  dialogueAudioPath?: string;
  dialogueAudioSourceText?: string;
  dialogueAudioSettingsKey?: string;
  narratorVoiceProfileId?: CreatorVoiceSelectionId;
  dialogueVoiceProfileId?: CreatorVoiceSelectionId;
  narratorVoiceSelection?: CreatorVoiceLibrarySelection;
  dialogueVoiceSelection?: CreatorVoiceLibrarySelection;
  videoUrl?: string;
  videoStatus?: "idle" | "processing" | "delayed" | "done" | "error";
  videoJobId?: string;
  videoQueueJobId?: string;
  videoStorageAdmissionId?: string;
  videoDurationSeconds?: number;
  videoGenerationSignature?: string;
  videoPendingGenerationSignature?: string;
  clipInSec?: number;
  clipOutSec?: number;
  timing?: SceneTiming;
  intelligence?: SceneIntelligence;
  targetDurationSec?: number;
  estimatedSpeechSec?: number;
  speechWordCount?: number;
  scriptHealth?: CreatorScriptHealth;
  visualBlockPlan?: CreatorVisualBlockPlan[];
  visualCoveragePlan?: CreatorVisualCoverageBeat[];
  assetHistory?: CreatorSceneAssetVersion[];
  sceneRole?: import("@/lib/creator/productionIntelligence").CreatorSceneRole;
  contentNature?: import("@/lib/creator/productionIntelligence").CreatorContentNature;
  motionImportance?: number;
  visualImportance?: number;
  continuityImportance?: number;
  stockSuitability?: number;
  customGenerationNeed?: number;
  authenticityValue?: number;
  stockSearchQuery?: string;
  scriptRevision?: number;
  scriptSectionId?: string;
  scriptSegmentIndex?: number;
  editorialClaimIds?: string[];
};

export type SceneIntelligence = {
  scene_type?:
    | "hook"
    | "discovery"
    | "dialogue"
    | "action"
    | "mystery"
    | "emotional"
    | "comedy"
    | "climax"
    | "resolution"
    | string;
  emotional_intensity?: number;
  pacing_level?: "slow" | "medium" | "fast" | string;
  curiosity_score?: number;
  tension_score?: number;
  climax_level?: number;
};

export type SceneTiming = {
  narrationDuration: number;
  dialogueDuration: number;
  totalAudioDuration: number;
  targetSceneDuration: number;
  maxSpeechDuration?: number;
  freezeDuration: number;
  needsFreezeFrame: boolean;
  durationMatchStatus?: AudioDurationMatchStatus;
  plannedSceneDuration?: number;
  durationDelta?: number;
  speechTailBuffer?: number;
  transitionTail?: number;
  exactTimingLocked?: boolean;
  unnecessaryExtensionRemoved?: number;
  splitRecommended?: boolean;
  recommendedSplitCount?: number;
};

export type VideoDispatchCountdown = {
  scope: "scene" | "batch";
  sceneId: number | null;
  sceneCount: number;
  secondsRemaining: number;
  totalSeconds: number;
};

export type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
};

export type YoutubeThumbnailResult = {
  imageUrl: string;
  prompt: string;
  headline: string;
  subHeadline: string;
  sourceImageUrl?: string;
  design?: CreatorThumbnailStudioState;
};
