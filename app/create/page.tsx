"use client";




// X11.4D Creator Lab Phase Language Final: removes Phase-2A/2C/3 and technical Creator Lab wording from visible UI.

// X11.4C Phase Language Targeted Fix: only visible PHASE labels are replaced; identifiers remain untouched.






// X9.2.2 Creator Lab Storyverse Reference Cleanup: Creator Lab hides Storyverse intro/catalog/package layers and uses flow-neutral production copy.

// X9.2.1 Storyverse Workspace Declutter: Storyverse screen hides catalog/dashboard layers and focuses on Storyverse production only.

// X.7.27 Cinematic Immersion Pass: richer magical background atmosphere and premium depth.
// X.7.28 Section Cleanup & Simplification: softer section rhythm and reduced visual density.
// X.7.29 Final QA & X7 Closure: final visual consistency and contrast polish.

// X.7.26 Mobile & Tablet Cohesion Polish: responsive spacing and mobile readability refinements.

// X.7.18 Page Layout Authority Pass: global create-page atmosphere aligned with playful product UI.
// X.7.19 Create Page Color System Harmonization: unified warm pastel page surfaces and lower-section color harmony.
// X.7.20 Full Visual Audit & Design System Pass: unified cold/neon remnants into warm readable creative-kids palette.
// X.7.21 Global Background Ownership Fix: create page owns visible pastel background layer inside main.
// X.7.22 Section Blend & Depth Pass: section surfaces blended into the owned pastel background.
// X.7.23 Final Visual Cohesion Pass: reduced section density and refined hierarchy for X7 closure.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";
import { getFlowByKey, type FlowZone } from "../../lib/flows";
import StoryverseCinematicIntro from "@/components/create/StoryverseCinematicIntro";
import WorldFocusRouter from "@/components/create/WorldFocusRouter";
import FocusedWorldWorkspace from "@/components/create/FocusedWorldWorkspace";
import { WorldProvider } from "@/components/create/WorldContext";
import StoryverseShell from "@/components/experience/StoryverseShell";
import CreatorLabShell from "@/components/experience/CreatorLabShell";
import { flowCardMessages } from "@/lib/i18n/flowCard";
import { DEFAULT_CHARACTER } from "@/lib/characterConfig";
import { CREATOR_DEFAULT_VIDEO_SCENE_COST_USD } from "@/lib/creatorCostConfig";
import {
  getCreatorMediaRoute,
  getCreatorVideoBlockSceneIds,
  isCreatorMediaActionAllowed,
  type CreatorMediaAction,
  type CreatorQualityMode,
} from "@/lib/creator/mediaRouting";
import { getCreatorVoiceRoute } from "@/lib/creator/voiceRouting";
import {
  createCreatorFinalVideoReadiness,
  type CreatorFinalVideoReadinessReport,
} from "@/lib/creator/finalVideoReadiness";
import {
  createCreatorIntelligence,
  type CreatorIntelligenceReport,
} from "@/lib/creator/creatorIntelligence";
import {
  CREATOR_PROFILE_STORAGE_KEY,
  EMPTY_CREATOR_PROFILE,
  hasCreatorProfileContext,
  parseCreatorProfile,
  type CreatorProfile,
} from "@/lib/creator/creatorProfile";
import { createCreatorProjectReadiness } from "@/lib/creator/projectReadiness";
import {
  createFlowContinuityAudit,
  type FlowContinuityAuditReport,
} from "@/lib/video/flowContinuityAudit";
import {
  applyExportFlowAutoFixes,
  createExportFlowValidation,
  type ExportFlowValidationInputScene,
  type ExportFlowValidationReport,
} from "@/lib/video/exportFlowValidation";
import {
  matchAudioDurationToScene,
  type AudioDurationMatchStatus,
} from "@/lib/video/audioDurationMatching";
import type { TimelineScenePlan, TimelineSyncPlan } from "@/lib/video/timelineSync";

type CreatorWorkspaceIconName = "insights" | "ideas" | "safety" | "package";
type CreatorWorkspaceTone = "blue" | "violet" | "green" | "amber";
type CreatorNoCastMode = "faceless" | "narrator";

function CreatorWorkspaceIcon({ name }: { name: CreatorWorkspaceIconName }) {
  const sharedProps = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "ideas") {
    return (
      <svg {...sharedProps}>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.4 1.5-1.5 2.5h-4c-.1-1-.6-1.8-1.5-2.5Z" />
        <path d="M12 2V1" />
        <path d="m4.9 4.9-.7-.7" />
        <path d="m19.8 4.2-.7.7" />
      </svg>
    );
  }

  if (name === "safety") {
    return (
      <svg {...sharedProps}>
        <path d="M12 3 5.5 5.7v5.1c0 4.4 2.7 8.1 6.5 10.2 3.8-2.1 6.5-5.8 6.5-10.2V5.7L12 3Z" />
        <path d="m9.2 11.8 1.8 1.8 3.9-4" />
      </svg>
    );
  }

  if (name === "package") {
    return (
      <svg {...sharedProps}>
        <path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" />
        <path d="m4.4 7.6 7.6 4.2 7.6-4.2" />
        <path d="M12 12v9" />
        <path d="m8 5.2 8 4.4" />
      </svg>
    );
  }

  return (
    <svg {...sharedProps}>
      <path d="M4 18V9" />
      <path d="M10 18V5" />
      <path d="M16 18v-7" />
      <path d="M22 18V3" />
      <path d="M2 18h22" />
    </svg>
  );
}

type CreatorEditPlanPriority = "render_safe" | "review" | "edit_required";

type CreatorEditPlanItem = {
  sceneId: string | number;
  priority: CreatorEditPlanPriority;
  decision: string;
  reason: string;
  recommendation: string;
  speechSeconds: number;
  visualBlocks: number;
};

type CreatorEditPlan = {
  status: "ready_to_render" | "needs_edit_plan";
  summary: string;
  items: CreatorEditPlanItem[];
};

type SceneTiming = {
  narrationDuration: number;
  dialogueDuration: number;
  totalAudioDuration: number;
  targetSceneDuration: number;
  maxSpeechDuration?: number;
  freezeDuration: number;
  needsFreezeFrame: boolean;
  durationMatchStatus?: AudioDurationMatchStatus;
  plannedSceneDuration?: number;
  unnecessaryExtensionRemoved?: number;
  splitRecommended?: boolean;
  recommendedSplitCount?: number;
};

type SceneIntelligence = {
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

type Scene = {
  renderMode?: "auto" | "video" | "image";
  id: number;
  text: string;
  narration: string;
  dialogue: string;
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
  videoUrl?: string;
  videoStatus?: "idle" | "processing" | "done" | "error";
  videoJobId?: string;
  videoDurationSeconds?: number;
  timing?: SceneTiming;
  intelligence?: SceneIntelligence;
};

type BatchSceneStatus = "pending" | "processing" | "done" | "failed" | "skipped";

type BatchRenderItem = {
  sceneId: number;
  status: BatchSceneStatus;
  step:
    | "waiting"
    | "route"
    | "image"
    | "audio"
    | "video"
    | "save"
    | "complete"
    | "error";
  message?: string;
  updatedAt: string;
};

type Character = {
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory?: string;
  personality: string;
  referenceImage?: string;
  voiceId?: string;
};

type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
};

type StorySetup = {
  title: string;
  storyPremise: string;
  characters: Character[];
  visualBible: VisualBible;
};

type NarratorSettings = {
  voiceId?: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style?: number;
  speed?: number;
};

type ParsedDialogueLine = {
  speaker: string;
  text: string;
  voiceId?: string;
};

type ExportMovieResult = {
  movieUrl: string;
  downloadUrl?: string;
  fileName?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  sceneCount?: number;
};

type ChildProfile = {
  id: string;
  nickname: string;
};

type ContentLanguage = "tr" | "en";

type CreatorAgeGroup = "broad_18" | "mainstream_18" | "niche_18" | "professional_18";
type CreatorContentType =
  | "educational"
  | "fun_facts"
  | "story"
  | "cartoon"
  | "science"
  | "history"
  | "life_skills";
type CreatorFormat = "short_form" | "youtube_video";
type CreatorDurationPreset =
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

type CreatorVideoIdea = {
  title: string;
  concept: string;
};

type BulkIdeaResult = {
  topic: string;
  title: string;
  hook: string;
  score: number;
  angle: string;
  reason: string;
};


type CreatorMentorResult = {
  audienceInsight: string[];
  hookPatterns: string[];
  videoIdeas: CreatorVideoIdea[];
  recommendedIdea: {
    title: string;
    reason: string;
  };
  productionPlan: string[];
};

type CreatorProductionScene = {
  id: number;
  text: string;
  narration: string;
  dialogue: string;
  cameraDirection: string;
  emotion: string;
  motionHint: string;
  visualPrompt?: string;
  intelligence?: SceneIntelligence;
};

type CreatorProductionPackage = {
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
  timelineSyncPlan?: TimelineSyncPlan;
};

type YoutubeMetadataResult = {
  titleOptions: string[];
  recommendedTitle: string;
  description: string;
  hashtags: string[];
  firstComment: string;
  thumbnailTextIdeas: string[];
  seoKeywords: string[];
  audiencePromise: string;
  hookAlternatives: string[];
  chapters: string[];
  shortCaption: string;
  linkedInCaption: string;
  uploadChecklist: string[];
  publishingNotes: string[];
};

type YoutubeThumbnailResult = {
  imageUrl: string;
  prompt: string;
  headline: string;
  subHeadline: string;
};

type SceneOptimizationResult = {
  sceneId: number;
  exportMode: "video" | "image";
  reason: string;
  confidence: "low" | "medium" | "high";
  estimatedCostUsd: number;
};

type SceneOptimizationSummary = {
  totalScenes: number;
  recommendedVideoScenes: number;
  recommendedImageScenes: number;
  estimatedRunwayCostUsd: number;
  estimatedFullVideoCostUsd: number;
  estimatedSavingsPercent: number;
  pricingBasis?: string;
};


type YoutubeResearchVideo = {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  views: number;
  likes: number;
  durationSec: number;
  thumbnail: string;
  url: string;
};

type YoutubePatternSummary = {
  topTitlePatterns: string[];
  hookPatterns: string[];
  recommendedDurationSec: number;
  opportunityScore: number;
  competitionLevel: "low" | "medium" | "high";
  recommendedContentAngle: string;
  reasoning: string[];
};

type CreatorVideoDurationSec = number;

const CREATOR_SCENE_CLIP_DURATION_SECONDS = 10;
const CREATOR_MAX_SCENE_COUNT = 36;

const getCreatorSceneCountForTargetDuration = (durationSec: number) => {
  return Math.min(
    CREATOR_MAX_SCENE_COUNT,
    Math.max(1, Math.ceil(durationSec / CREATOR_SCENE_CLIP_DURATION_SECONDS))
  );
};

type CreatorDurationOption = {
  preset: CreatorDurationPreset;
  seconds: number;
  label: string;
};

const CREATOR_SHORT_DURATION_OPTIONS: CreatorDurationOption[] = [
  { preset: "short_15", seconds: 15, label: "15 sec" },
  { preset: "short_30", seconds: 30, label: "30 sec" },
  { preset: "short_45", seconds: 45, label: "45 sec" },
  { preset: "short_60", seconds: 60, label: "60 sec" },
];

const CREATOR_VIDEO_DURATION_OPTIONS: CreatorDurationOption[] = [
  { preset: "video_180", seconds: 180, label: "3 min" },
  { preset: "video_300", seconds: 300, label: "5 min" },
  { preset: "video_480", seconds: 480, label: "8 min" },
  { preset: "video_600", seconds: 600, label: "10 min" },
  { preset: "video_900", seconds: 900, label: "15 min" },
];

const getCreatorDurationOptionsByFormat = (format: CreatorFormat) => {
  return format === "youtube_video"
    ? CREATOR_VIDEO_DURATION_OPTIONS
    : CREATOR_SHORT_DURATION_OPTIONS;
};

const getNearestCreatorDurationOption = (
  format: CreatorFormat,
  durationSec: number
) => {
  const options = getCreatorDurationOptionsByFormat(format);
  return options.reduce((best, option) => {
    return Math.abs(option.seconds - durationSec) < Math.abs(best.seconds - durationSec)
      ? option
      : best;
  }, options[0]);
};

const getCreatorSceneCountByDuration = (durationSec: CreatorVideoDurationSec) => {
  return getCreatorSceneCountForTargetDuration(durationSec);
};

const CREATOR_COUNTRY_OPTIONS = [
  { value: "global", label: "Global / International" },
  { value: "us", label: "United States" },
  { value: "canada", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
  { value: "australia", label: "Australia" },
  { value: "germany", label: "Germany" },
  { value: "france", label: "France" },
  { value: "spain", label: "Spain" },
  { value: "turkey", label: "Türkiye" },
];

const CREATOR_AGE_GROUP_OPTIONS: Array<{ value: CreatorAgeGroup; label: string }> = [
  { value: "broad_18", label: "Broad consumer / 18+" },
  { value: "mainstream_18", label: "Mainstream adult / 18+" },
  { value: "niche_18", label: "Niche expert audience / 18+" },
  { value: "professional_18", label: "Professional / B2B / 18+" },
];

const CREATOR_CONTENT_TYPE_OPTIONS: Array<{ value: CreatorContentType; label: string }> = [
  { value: "educational", label: "Educational" },
  { value: "fun_facts", label: "Fun Facts" },
  { value: "story", label: "Storytelling" },
  { value: "cartoon", label: "Cartoon" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "life_skills", label: "Life Skills" },
];

const CREATOR_FORMAT_OPTIONS: Array<{
  value: CreatorFormat;
  label: string;
  guidance: string;
}> = [
  {
    value: "short_form",
    label: "Shorts / Reels / TikTok",
    guidance: "Best for 15-60 second vertical social content.",
  },
  {
    value: "youtube_video",
    label: "YouTube Video",
    guidance: "Best for 3-15 minute structured video packages.",
  },
];

const CREATOR_QUALITY_MODE_OPTIONS: Array<{
  value: CreatorQualityMode;
  labelEn: string;
  labelTr: string;
  guidanceEn: string;
  guidanceTr: string;
  creditTierEn: string;
  creditTierTr: string;
}> = [
  {
    value: "draft",
    labelEn: "Draft",
    labelTr: "Taslak",
    guidanceEn: "Strategy, hook, script outline and metadata planning only. No media generation.",
    guidanceTr: "Strateji, hook, script taslağı ve metadata planlama. Medya üretimi yok.",
    creditTierEn: "Lowest credit use",
    creditTierTr: "En düşük kredi kullanımı",
  },
  {
    value: "standard",
    labelEn: "Standard",
    labelTr: "Standart",
    guidanceEn: "Balanced production for usable social packages with controlled image and voice generation.",
    guidanceTr: "Kontrollü görsel ve ses üretimiyle dengeli sosyal medya paketi.",
    creditTierEn: "Balanced credit use",
    creditTierTr: "Dengeli kredi kullanımı",
  },
  {
    value: "pro",
    labelEn: "Pro",
    labelTr: "Pro",
    guidanceEn: "Stronger scene planning, thumbnail/metadata intelligence and higher-quality visual routing.",
    guidanceTr: "Daha güçlü sahne planı, thumbnail/metadata zekası ve daha kaliteli görsel yönlendirme.",
    creditTierEn: "Higher credit use",
    creditTierTr: "Daha yüksek kredi kullanımı",
  },
  {
    value: "cinematic",
    labelEn: "Cinematic",
    labelTr: "Sinematik",
    guidanceEn: "Maximum-quality path for premium video blocks, voice-over and continuity-aware export.",
    guidanceTr: "Premium video blokları, seslendirme ve süreklilik odaklı export için maksimum kalite yolu.",
    creditTierEn: "Maximum credit use",
    creditTierTr: "Maksimum kredi kullanımı",
  },
];


const emptyVisualBible: VisualBible = {
  style: "",
  palette: "",
  camera: "",
  consistencyRules: "",
};

const defaultNarratorSettings: NarratorSettings = {
  voiceId: "",
  modelId: "eleven_multilingual_v2",
  stability: 0.32,
  similarityBoost: 0.8,
  style: 0.35,
  speed: 0.93,
};

const isDefaultGuideCharacter = (character?: Partial<Character> | null) => {
  return (character?.name || "").trim().toLowerCase() === "joe";
};

const withDefaultGuideCharacter = (incomingCharacters?: Character[]): Character[] => {
  const safeCharacters = Array.isArray(incomingCharacters) ? incomingCharacters : [];
  const normalizedCharacters = safeCharacters.map((character) => ({
    ...character,
    voiceId: character.voiceId || "",
  }));

  if (normalizedCharacters.some(isDefaultGuideCharacter)) {
    return normalizedCharacters;
  }

  const defaultGuideCharacter: Character = {
    name: DEFAULT_CHARACTER.name,
    age: DEFAULT_CHARACTER.age,
    appearance: DEFAULT_CHARACTER.appearance,
    outfit: DEFAULT_CHARACTER.outfit,
    accessory: DEFAULT_CHARACTER.accessory,
    personality: DEFAULT_CHARACTER.personality,
    voiceId: "",
  };

  return [defaultGuideCharacter, ...normalizedCharacters];
};


const isCreatorLabSystemCharacter = (character?: Partial<Character> | null) => {
  const name = (character?.name || "").trim().toLowerCase();
  return name === "creatorlab narrator";
};

const normalizeCreatorLabCharacters = (incomingCharacters?: Character[]): Character[] => {
  return Array.isArray(incomingCharacters)
    ? incomingCharacters
        .filter((character) => !isCreatorLabSystemCharacter(character))
        .map((character) => ({
          ...character,
          voiceId: character.voiceId || "",
        }))
    : [];
};

const emphasizeHook = (value: string) => {
  return value
    .replace(/\bthree\b/gi, "THREE")
    .replace(/\b3\b/g, "THREE")
    .replace(/\btwo\b/gi, "TWO")
    .replace(/\b2\b/g, "TWO");
};

const cleanHookTopic = (value?: string) => {
  return String(value || "")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
};

const buildOptimizedOpeningHook = (topic?: string, fallbackHook?: string) => {
  const source = cleanHookTopic(topic || fallbackHook);
  const fallback = cleanHookTopic(fallbackHook);

  if (!source && fallback) {
    return emphasizeHook(fallback);
  }

  if (!source) {
    return "Wait… what just happened?!";
  }

  const lower = source.toLowerCase();

  const whyHaveMatch = lower.match(/^why\s+(do|does)\s+(.+?)\s+have\s+(.+)$/i);
  if (whyHaveMatch) {
    const subject = source.match(/^why\s+(?:do|does)\s+(.+?)\s+have\s+(.+)$/i);
    if (subject?.[1] && subject?.[2]) {
      return emphasizeHook(`Wait… ${subject[1]} have ${subject[2]}?!`);
    }
  }

  const whatIfMatch = source.match(/^what\s+if\s+(.+)$/i);
  if (whatIfMatch?.[1]) {
    return emphasizeHook(`What if ${whatIfMatch[1]}?!`);
  }

  const whyMatch = source.match(/^why\s+(.+)$/i);
  if (whyMatch?.[1]) {
    return emphasizeHook(`Why ${whyMatch[1]}?!`);
  }

  const howMatch = source.match(/^how\s+(.+)$/i);
  if (howMatch?.[1]) {
    return emphasizeHook(`How ${howMatch[1]}?!`);
  }

  const didYouKnowMatch = source.match(/^did\s+you\s+know\s+(.+)$/i);
  if (didYouKnowMatch?.[1]) {
    return emphasizeHook(`Wait… ${didYouKnowMatch[1]}?!`);
  }

  return emphasizeHook(`Wait… ${source}?!`);
};

const optimizeCreatorPackageOpeningHook = (
  productionPackage: CreatorProductionPackage,
  topic?: string
): CreatorProductionPackage => {
  const scenes = Array.isArray(productionPackage.scenes)
    ? [...productionPackage.scenes]
    : [];

  const currentHook =
    productionPackage.hook ||
    scenes[0]?.dialogue ||
    scenes[0]?.narration ||
    productionPackage.title ||
    topic ||
    "";

  const optimizedHook = buildOptimizedOpeningHook(topic, currentHook);

  if (!scenes.length) {
    return {
      ...productionPackage,
      hook: optimizedHook,
    };
  }

  const firstScene = scenes[0];
  const firstDialogue = firstScene.dialogue?.trim()
    ? firstScene.dialogue
    : optimizedHook;

  scenes[0] = {
    ...firstScene,
    text: firstScene.text?.trim()
      ? firstScene.text
      : `The opening scene reveals the main question with a direct creator hook: ${optimizedHook}`,
    narration: firstScene.narration?.trim()
      ? firstScene.narration
      : optimizedHook,
    dialogue: firstDialogue.toLowerCase().includes("did you know")
      ? optimizedHook
      : firstDialogue,
    emotion: firstScene.emotion || "focused curiosity",
    motionHint: firstScene.motionHint || "fast creator-style opening with a clear visual reveal",
  };

  return {
    ...productionPackage,
    hook: optimizedHook,
    scenes,
  };
};


const clampSceneScore = (value: unknown, fallback: number) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(10, Math.round(parsed)));
};

const inferSceneType = (scene: Partial<Scene>, index: number, total: number): SceneIntelligence["scene_type"] => {
  const source = `${scene.text || ""} ${scene.narration || ""} ${scene.dialogue || ""} ${scene.emotion || ""}`.toLowerCase();

  if (index === 0) return "hook";
  if (index >= total - 1) return "resolution";
  if (source.includes("climax") || source.includes("final") || source.includes("son") || source.includes("zirve")) return "climax";
  if (source.includes("mystery") || source.includes("secret") || source.includes("gizem") || source.includes("sır")) return "mystery";
  if (source.includes("laugh") || source.includes("funny") || source.includes("komik") || source.includes("gül")) return "comedy";
  if (source.includes("run") || source.includes("jump") || source.includes("race") || source.includes("koş") || source.includes("zıpla")) return "action";
  if (source.includes("sad") || source.includes("happy") || source.includes("fear") || source.includes("duygu") || source.includes("mutlu") || source.includes("üzgün")) return "emotional";
  if ((scene.dialogue || "").trim().length > 80) return "dialogue";

  return "discovery";
};

const buildFallbackSceneIntelligence = (
  scene: Partial<Scene>,
  index: number,
  total: number
): SceneIntelligence => {
  const source = `${scene.text || ""} ${scene.narration || ""} ${scene.dialogue || ""} ${scene.emotion || ""}`.toLowerCase();
  const isFirst = index === 0;
  const isLast = index >= total - 1;
  const hasQuestion = source.includes("?") || source.includes("why") || source.includes("how") || source.includes("neden") || source.includes("nasıl");
  const hasUrgency = source.includes("!") || source.includes("wait") || source.includes("dur") || source.includes("suddenly") || source.includes("birden");
  const hasMystery = source.includes("mystery") || source.includes("secret") || source.includes("hidden") || source.includes("gizem") || source.includes("sır") || source.includes("saklı");
  const hasAction = source.includes("run") || source.includes("jump") || source.includes("race") || source.includes("koş") || source.includes("zıpla") || source.includes("hızlı");

  const curiosityBase = 5 + (hasQuestion ? 2 : 0) + (hasMystery ? 2 : 0) + (isFirst ? 1 : 0);
  const tensionBase = 4 + (hasUrgency ? 2 : 0) + (hasMystery ? 1 : 0) + (hasAction ? 1 : 0);
  const climaxBase = isLast ? 7 : isFirst ? 5 : Math.min(8, 3 + Math.round((index / Math.max(total - 1, 1)) * 5));
  const emotionBase = 5 + (hasUrgency ? 1 : 0) + (hasMystery ? 1 : 0) + (hasAction ? 1 : 0);

  const pacingLevel: SceneIntelligence["pacing_level"] =
    hasAction || hasUrgency || isFirst ? "fast" : isLast ? "slow" : "medium";

  return {
    scene_type: inferSceneType(scene, index, total),
    emotional_intensity: clampSceneScore(emotionBase, 5),
    pacing_level: pacingLevel,
    curiosity_score: clampSceneScore(curiosityBase, 6),
    tension_score: clampSceneScore(tensionBase, 4),
    climax_level: clampSceneScore(climaxBase, 4),
  };
};

const normalizeSceneIntelligenceForUi = (
  intelligence: SceneIntelligence | undefined,
  scene: Partial<Scene>,
  index: number,
  total: number
): SceneIntelligence => {
  const fallback = buildFallbackSceneIntelligence(scene, index, total);
  const validPacing =
    intelligence?.pacing_level === "slow" ||
    intelligence?.pacing_level === "medium" ||
    intelligence?.pacing_level === "fast"
      ? intelligence.pacing_level
      : fallback.pacing_level;

  return {
    scene_type: intelligence?.scene_type || fallback.scene_type,
    emotional_intensity: clampSceneScore(intelligence?.emotional_intensity, fallback.emotional_intensity || 5),
    pacing_level: validPacing,
    curiosity_score: clampSceneScore(intelligence?.curiosity_score, fallback.curiosity_score || 6),
    tension_score: clampSceneScore(intelligence?.tension_score, fallback.tension_score || 4),
    climax_level: clampSceneScore(intelligence?.climax_level, fallback.climax_level || 4),
  };
};

const normalizeScenesWithIntelligence = <T extends Partial<Scene>>(
  sourceScenes: T[]
): T[] => {
  const total = sourceScenes.length;

  return sourceScenes.map((scene, index) => ({
    ...scene,
    intelligence: normalizeSceneIntelligenceForUi(scene.intelligence, scene, index, total),
  }));
};

const DEFAULT_VIDEO_DURATION_SECONDS = 10;
const TARGET_SCENE_DURATION_SECONDS = 10;
const MAX_SCENE_DURATION_SECONDS = 12;
const MIN_SCENE_DURATION_SECONDS = 8;
const CREATOR_MIN_SCENE_DURATION_SECONDS = 3;
const CREATOR_MAX_SCENE_DURATION_SECONDS = 30;
const CREATOR_PREFERRED_MAX_SCENE_DURATION_SECONDS = 20;
const CREATOR_SPEECH_TAIL_BUFFER_SECONDS = 0.75;
const FREEZE_TOLERANCE_SECONDS = 0.35;
const MAX_SPEECH_RATIO = 0.82;
const CREATOR_LAB_MAX_SPEECH_RATIO = 0.95;

const UI_TEXT = {
  tr: {
    loading: "Yükleniyor...",
    roleLoading: "Rol yükleniyor...",
    episodePackage: "Bölüm Paketi",
    notCreatedYet: "Henüz oluşturulmadı",
    episodePackageSubtitle: "Storyverse çıktısı artık paylaşılabilir bir ürün haline geldi.",
    flow: "Akış",
    language: "Dil",
    character: "Karakter",
    scene: "Sahne",
    audioReady: "Ses Hazır",
    videoReady: "Video Hazır",
    createMovie: "🎬 Film Oluştur",
    shareLinkCreate: "🔗 Paylaşım Linki Oluştur",
    shareLinkCreating: "Link oluşturuluyor...",
    copyLink: "📋 Linki Kopyala",
    copied: "✅ Kopyalandı",
    download: "⬇️ İndir",
    shareLink: "Paylaşım Linki",
    openQr: "QR ile telefonda aç",
    qrHint: "Telefon kamerasıyla okutarak hikayeyi public episode sayfasında açabilirsiniz.",
    duration: "Süre",
    size: "Boyut",
    adminMode: "Admin Mode aktif → YouTube Engine burada konumlanacak.",
    parentMode: "Experience Lab Mode aktif.",
    selectedFlow: "Seçili Akış",
    activeProductBehavior: "Aktif ürün davranışı: Storyverse, hikaye fikrini çocuk dostu çizgi film üretim akışına göre çerçeveler.",
    nonStoryversePilot: "Bu akış roadmap aşamasındadır. Mevcut çalışan üretim motoru Storyverse üzerinden güvenli şekilde kullanılmaya devam eder.",
    studioBadge: "AI Hikaye Stüdyosu",
    studioTitle: "VELTO",
    studioDescription: "Hikaye, sahne, görsel, anlatıcı sesi, karakter diyaloğu, video ve final film çıktısını aynı akışta üreten üretim stüdyosu. Bu ekran artık sadece geliştirme paneli değil, AI Experience Lab içindeki ortak üretim çekirdeği olarak kurgulanıyor.",
    storySetupChip: "Hikaye kurulumu",
    sceneTimingChip: "Sahne zamanlaması",
    voiceDialogueChip: "Ses + Diyalog",
    runwayVideoChip: "AI video blockları",
    finalExportChip: "Final export",
    sceneStatus: "Sahne Durumu",
    totalScene: "Toplam sahne",
    exportReady: "Export Hazır",
    exportReadyDesc: "Video veya görsel ile export edilebilir sahne",
    readyAudio: "Hazır Ses",
    readyAudioDesc: "Anlatıcı cache hazır",
    estimatedDuration: "Tahmini Süre",
    estimatedDurationDesc: "Toplam hedef film akışı",
    journey: "İş Akışı",
    studioRouteMap: "Stüdyo Yol Haritası",
    studioRouteMapDesc: "Bu ekran artık sadece üretim paneli değil; Experience Lab ve hızlı içerik üretimi için ortak akış merkezi.",
    nextSurface: "Sonraki Katman",
    quickContentMode: "Hızlı İçerik Modu",
    quickContentModeDesc: "Creator Lab fikir, senaryo, thumbnail, metadata ve yayına hazır paket üretimine odaklanır.",
    quickItem1: "Tek prompt ile bölüm üretimi",
    quickItem2: "Seri formatı + export hazır akış",
    quickItem3: "Experience Lab içerikleriyle ortak evren",
    childProfile: "Çocuk Profili",
    activeChild: "Aktif",
    noChildSelected: "Çocuk seçilmedi",
    chooseChild: "Çocuk seç",
    newChildName: "Yeni çocuk adı",
    add: "Ekle",
    adding: "Ekleniyor...",
    childProfileHint: "Experience Lab akışında hikaye üretmeden önce aktif çocuk profili seçilmelidir.",
    myProjects: "Projelerim",
    refresh: "Yenile",
    refreshing: "Yenileniyor...",
    projectsLoading: "Projeler yükleniyor...",
    noProjects: "Henüz kayıtlı proje yok. İlk hikayeni oluşturduğunda burada görünecek.",
    untitledProject: "Başlıksız Proje",
    lastUpdate: "Son güncelleme",
    open: "Aç",
    contentLanguage: "İçerik Dili",
    contentLanguageHint: "Seçilen dil; hikaye, narration, dialogue ve devam sahneleri için içerik üretim dilini belirler.",
    turkish: "Türkçe",
    english: "English",
    storyPromptLabel: "Storyverse için nasıl bir çizgi film / hikaye yapmak istiyorsun?",
    storyPromptPlaceholder: "Örn: Deniz kenarında yaşayan meraklı bir çocuğun kayıp yıldız haritasını bulması",
    genericPromptLabel: "Bu akış için nasıl bir deneyim başlatmak istiyorsun?",
    genericPromptPlaceholder: "Örn: Çocuğun karar verdiği kısa ve güvenli bir deneyim akışı",
    preparingSetup: "Kurulum hazırlanıyor...",
    createCharacters: "Karakterleri Oluştur",
    studioSnapshot: "Stüdyo Özeti",
    setupReady: "Kurulum hazır",
    setupWaiting: "Kurulum bekliyor",
    studioSnapshotDesc: "Karakter ve görsel dünya hazırlandığında hikaye üretimine geçilir.",
    dialogueLayer: "Diyalog Katmanı",
    sceneCountLabel: "sahne",
    dialogueLayerDesc: "Karakter sesleri hazırlanmış sahne sayısı.",
    freezeRisk: "Story Flow Checki",
    freezeRiskDesc: "Video süresinin ses akışını taşımakta zorlandığı sahneler.",
    quickModePrep: "Quick Mode Hazırlığı",
    activePlan: "Aktif plan",
    quickModePrepDesc: "Bu ekran bir sonraki adımda hızlı YouTube üretim moduna ayrışacak.",
    initialDesign: "Başlangıç Tasarımı",
    initialDesignHint: "Buradaki bilgileri düzelt. Her şey doğruysa sahneleri daha sonra oluştur.",
    storyTitle: "Hikaye Başlığı",
    minuteShort: "dk",
    secondShort: "sn",
    episodePackageProductDesc: "Storyverse çıktısı artık ürün formatında",
    saveProjectFirstTitle: "Önce projeyi kaydetmelisin",
    publicShareTitle: "Public paylaşım linki oluştur",
    projectId: "Proje ID",
    storyPremiseLabel: "Hikaye Özeti / Yönü",
    narratorSettings: "Anlatıcı Ayarları",
    narratorVoiceHint: "Boş bırakırsan sunucu tarafındaki varsayılan narrator voice kullanılır.",
    narratorRecommended: "Önerilen narrator başlangıcı:",
    narratorCacheHint: "Ses kimliği değişirse mevcut narrator ve dialogue cache’leri temizlenir.",
    charactersTitle: "Karakterler",
    addCharacter: "Karakter Ekle",
    characterLabel: "Karakter",
    delete: "Sil",
    namePlaceholder: "Ad",
    agePlaceholder: "Yaş",
    appearancePlaceholder: "Dış görünüş",
    outfitPlaceholder: "Kıyafet",
    accessoryPlaceholder: "Aksesuar",
    personalityPlaceholder: "Karakter enerjisi / kişiliği",
    characterVoicePlaceholder: "Karakter voiceId (ElevenLabs)",
    characterVoiceHint: "Diyaloglarda karakter sesi için buraya ElevenLabs voiceId girebilirsin. Boş bırakılırsa sistem varsayılan sesle devam eder.",
    preparingReferenceImage: "Referans görsel hazırlanıyor...",
    generateReferenceImage: "Referans Görsel Üret",
    referenceImageAlt: "referans görseli",
    noCharacterReference: "Bu karakter için henüz referans görsel üretilmedi.",
    visualStyle: "Görsel Stil",
    stylePlaceholder: "Stil",
    palettePlaceholder: "Renk paleti",
    cameraPlaceholder: "Kamera yaklaşımı",
    consistencyRulesPlaceholder: "Tutarlılık kuralları",
    buildingStory: "Hikaye kuruluyor...",
    buildStoryAndScenes: "Hikayeyi ve Sahneleri Oluştur",
    savingProject: "Kaydediliyor...",
    saveProject: "Projeyi Kaydet",
    preparingAudio: "Sesler hazırlanıyor...",
    prepareAudio: "Sesleri Hazırla",
    stopStory: "Hikayeyi Durdur",
    listenStory: "Hikayeyi Dinle",
    creatingMovie: "Film oluşturuluyor...",
    createFinalMovieWithCount: "🎞 Filmi Oluştur",
    finalMovie: "Final Film",
    finalMovieDesc: "Sahne videoları birleştirildi. Aşağıdan izleyebilir, indirebilir veya linki paylaşabilirsin.",
    sceneProductionPanel: "Sahne Üretim Paneli",
    sceneProductionPanelDesc: "Her sahne kartı üretim, ses, video ve export kararını aynı yüzeyde gösterir.",
    lastScene: "Son sahne",
    sceneCardPurpose: "Bu kart sahnenin hikaye, ses, video ve export kararını tek bakışta yönetmen için tasarlandı.",
    videoCreating: "Video oluşturuluyor...",
    convertToVideo: "🎬 Videoya Çevir",
    editScene: "Sahneyi Düzenle",
    branchAfterScene: "Bu Sahneden Sonra Devam Et",
    redrawing: "Yeniden çiziliyor...",
    redraw: "Yeniden Çiz",
    scenePreviews: "Scene previews",
    imageReady: "Image ready",
    imagePending: "Image pending",
    videoPending: "Video pending",
    readySceneImage: "Hazır sahne görseli",
    noSceneImagePreview: "Bu sahne için henüz görsel önizleme yok. Görsel üretildiğinde burada görünecek.",
    readySceneVideo: "Hazır sahne videosu",
    noSceneVideoPreview: "Bu sahne için henüz video önizleme yok. Video hazır olduğunda burada görünecek.",
    target: "Hedef",
    speech: "Konuşma",
    intelligencePanel: "Dynamic Scene Intelligence",
    sceneType: "Sahne Tipi",
    emotionalIntensity: "Duygu",
    pacingLevel: "Tempo",
    curiosityScore: "Merak",
    tensionScore: "Gerilim",
    climaxLevel: "Zirve",
    thumbnailScore: "Thumbnail",
    bestThumbnailCandidate: "Best Thumbnail",
    hookScore: "Hook",
    bestHookCandidate: "Best Hook",
    retentionRisk: "Retention",
    lowRisk: "Low Risk",
    mediumRisk: "Medium Risk",
    highRisk: "High Risk",
    youtubeReadiness: "YouTube Ready",
    strongReady: "Strong",
    moderateReady: "Moderate",
    weakReady: "Weak",
    recommendation: "Recommendation",
    noSceneIntelligence: "Bu sahne için intelligence metadata henüz oluşmadı. Bu sahneyi yeniden üretirsen otomatik gelir.",
    speechTooLong: "⚠️ Konuşma bu sahne için fazla uzun. Düzenleyip kısalt.",
    speechTimingOk: "✅ Sahne ve konuşma süresi uyumlu.",
    sceneEditQuestion: "Bu sahnede neyi değiştirmek istiyorsun?",
    sceneEditPlaceholder: "Buraya bir robot gelsin, sahne daha komik olsun...",
    updating: "Güncelleniyor...",
    updateScene: "Sahneyi Güncelle",
    cancel: "Vazgeç",
    branchQuestion: "Bu sahneden sonra hikaye nasıl devam etsin?",
    branchPlaceholder: "Örn: Bu sahneden sonra çocuklar gizli bir geçit keşfetsin.",
    branchWarning: "Bu işlem, bu sahneden sonraki mevcut akışı kaldırır ve yeni bir devam sahnesi üretir.",
    writingNewFlow: "Yeni akış yazılıyor...",
    continueFromHere: "Bu Noktadan Devam Et",
    continueFromLastScene: "Son Sahneden Devam Et",
    continueFromLastSceneDesc: "Hikayenin mevcut son sahnesinden sonra ne olmasını istediğini yaz.",
    continuePromptPlaceholder: "Örn: Çocuklar mağaranın içinde parlayan bir kapı bulsun.",
    writingContinue: "Devam yazılıyor...",
    writeContinue: "Devamını Yaz",
    sceneListTitle: "Sahneler",
    creatorMentor: "Content Creator Mentor",
    creatorStrategySetup: "Creator Strategy Brief",
    creatorMentorDesc: "Üretime geçmeden önce hedef pazar, kitle, format ve süreyi netleştir. Velto bu brief’i analiz, sahne planı, timeline ve export paketi için kullanır.",
    targetMarket: "Hedef Pazar",
    ageGroup: "Kitle Profili",
    contentType: "İçerik Tipi",
    videoFormat: "Üretim Formatı",
    analyzeContentOpportunity: "İçerik Fırsatını Analiz Et",
    analyzingContentOpportunity: "İçerik fırsatı analiz ediliyor...",
    creatorTopicLabel: "Content Creator Lab hangi konu veya video fikrini analiz etsin?",
    creatorTopicPlaceholder: "Örn: LinkedIn’de AI trendleri nasıl anlatılmalı? veya YouTube için güçlü bir faceless video fikri öner",
    mentorAnalysisTitle: "Mentor Analizi",
    audienceInsight: "Audience Insight",
    hookPatterns: "Hook Patterns",
    videoIdeas: "Video Fikirleri",
    recommendedIdea: "Önerilen Fikir",
    productionPlan: "Production Plan",
    continueToProduction: "Bu fikri üretim paketine dönüştür",
    creatorProductionTitle: "Üretim Paketi",
    creatorProductionDesc: "Önerilen fikri sahneler, anlatım, görsel yönlendirmeler, thumbnail ve caption içeren üretim paketine dönüştürür.",
    convertingProductionPackage: "Üretim paketi hazırlanıyor...",
    productionPackageReady: "Üretim paketi hazır ✅",
    thumbnailIdea: "Thumbnail Fikri",
    youtubeTitle: "YouTube Başlığı",
    youtubeCaption: "YouTube Caption",
    youtubeMetadataEngine: "YouTube Metadata Engine",
    youtubeMetadataDesc: "Başlık, açıklama, hashtag ve first comment önerilerini üretir.",
    generateYoutubeMetadata: "YouTube Metadata Üret",
    generatingYoutubeMetadata: "Metadata üretiliyor...",
    recommendedYoutubeTitle: "Önerilen Başlık",
    titleOptions: "Başlık Alternatifleri",
    youtubeDescription: "YouTube Açıklaması",
    hashtags: "Hashtagler",
    firstComment: "İlk Yorum",
    thumbnailTextIdeas: "Thumbnail Metinleri",
    seoKeywords: "SEO Anahtar Kelimeleri",
    audiencePromise: "İzleyici Vaadi",
    thumbnailGenerationEngine: "Scene Thumbnail Selector",
    thumbnailGenerationDesc: "Ek görsel üretmeden, mevcut sahne görselleri arasından thumbnail seçmeni sağlar.",
    generateThumbnail: "En İyi Sahneyi Seç",
    generatingThumbnail: "Thumbnail seçiliyor...",
    generatedThumbnail: "Seçilen Thumbnail",
    thumbnailPrompt: "Source Scene",
    thumbnailHeadline: "Thumbnail Başlığı",
    thumbnailSubHeadline: "Thumbnail Alt Metni",
    sceneThumbnailCandidates: "Sahne Thumbnail Adayları",
    useSceneAsThumbnail: "Thumbnail Olarak Kullan",
    noSceneThumbnailsYet: "Thumbnail seçmek için önce sahne görsellerini oluştur.",
    exportCreatorPackage: "Creator Package Export",
    exportCreatorPackageDesc: "Video linki, başlık, açıklama, hashtag, ilk yorum, thumbnail ve sahne datasını ZIP paketi olarak indirir.",
    downloadCreatorPackage: "Creator Package İndir",
    downloadingCreatorPackage: "Paket hazırlanıyor...",
    costOptimizationEngine: "Credit Efficiency Advisor",
    costOptimizationDesc: "Mevcut sahne planı için daha kredi-verimli medya yönlendirmesi önerir. Toplam kredi tahmini Production Quality alanında kalır.",
    costPricingNote: "Not: Bu alan yeni bir kredi tahmini üretmez; yalnızca seçilen üretim planını daha verimli hale getirecek önerileri gösterir.",
    optimizeScenes: "Sahneleri Optimize Et",
    optimizingScenes: "Sahneler optimize ediliyor...",
    costSummary: "Verimlilik Özeti",
    recommendedVideoScenes: "Premium Video Blokları",
    recommendedImageScenes: "Image-motion Blokları",
    estimatedCost: "Kredi Rotası",
    estimatedSavings: "Verimlilik Kazancı",
    applyOptimization: "Önerileri Uygula",
    optimizationApplied: "Optimizasyon önerileri uygulandı ✅",
    aiOptimizeScenes: "AI Optimize",
    aiOptimizingScenes: "AI optimize ediyor...",
    youtubeAutoMode: "YouTube Auto Mode",
    youtubeAutoModeDesc: "Konu fikrinden production package, metadata, thumbnail, kredi verimliliği önerileri ve kayıt adımlarını tek akışta hazırlar. Video üretmez; premium render kararı sende kalır.",
    generateFullYoutubePackage: "Full YouTube Package Üret",
    generatingFullYoutubePackage: "Full package hazırlanıyor...",
    fullYoutubePackageReady: "Full YouTube package hazır ✅",
    productionBridgeTitle: "Üretime Devam Et",
    productionBridgeDesc: "Creator Lab paketi hazır. Önce paketi düzenlenebilir üretim sahnelerine dönüştür; görsel, ses, video ve export adımları ayrı kontrol edilir.",
    productionBridgeButton: "🎬 Production Stage Oluştur",
    productionBridgeReady: "Creator Lab paketi hazır. Henüz düzenlenebilir üretim sahnesi oluşturulmadı.",
    productionBridgeCostNote: "Not: Bu adım yalnızca metin tabanlı sahne yapısını oluşturur; görsel, ses, video veya export kredi kullanımı başlatmaz.",
    bulkGeneratorTitle: "Idea Machine",
    bulkGeneratorDesc: "Birden fazla video fikrini hızlıca analiz eder. Bu aşamada video veya thumbnail üretmez; sadece seçilebilir fikir kartları oluşturur.",
    bulkTopicsLabel: "Her satıra bir video fikri yaz",
    bulkTopicsPlaceholder: "Örn:\nWhy do ants work so hard?\nHow do rockets fly?\nWhy is the ocean blue?",
    bulkGenerate: "Toplu Fikir Üret",
    bulkGenerating: "Fikirler üretiliyor...",
    bulkEmpty: "Henüz toplu fikir üretilmedi.",
    bulkScore: "Skor",
    bulkAngle: "Açı",
    bulkReason: "Gerekçe",
    useBulkTopic: "Bu fikri ana konu yap",
    generateFullPackageFromBulk: "🚀 Full Package Üret",
    bulkPackageStarted: "Bulk fikrinden full package üretimi başlatıldı ✅",
    bulkTopicApplied: "Bulk fikri ana konuya aktarıldı ✅",
    generateSelectedBulk: "🚀 Seçilenleri Üret",
    generatingSelectedBulk: "Seçilenler üretiliyor...",
    selectedBulkCount: "Seçili fikir",
    productionPackageNote: "Bu paket hazırlandıktan sonra CreatorLab akışı sahne, görsel, ses, video, thumbnail ve metadata üretimine devam eder.",
    refineScenes: "Sahneleri AI ile Geliştir",
    refiningScenes: "Sahneler geliştiriliyor...",
    refinedScenesReady: "Sahneler AI ile geliştirildi ✅",
    refinedScenesNote: "Refine edilen sahneler hazır. Artık sahne üretimine geçebilirsin.",
    youtubeResearchTitle: "YouTube Trend Analizi",
    youtubeResearchDesc: "Seçilen konu ve hedef pazara göre YouTube'daki mevcut video sinyallerini inceler. Bu adım yalnızca pazar verisi toplar; üretim akışını değiştirmez.",
    youtubeResearchButton: "YouTube Trend Analizi Yap",
    youtubeResearchLoading: "YouTube verisi analiz ediliyor...",
    youtubeResearchEmpty: "YouTube tarafında uygun video sonucu bulunamadı.",
    youtubeResearchViews: "izlenme",
    youtubeResearchLikes: "beğeni",
    youtubeResearchDuration: "süre",
    patternEngineTitle: "Smart Creator Tips",
    patternEngineDesc: "YouTube örneklerinden başlık, hook, süre, rekabet ve fırsat sinyallerini çıkarır.",
    patternEngineButton: "Akıllı Creator İpuçlarını Bul",
    patternEngineLoading: "Pattern analiz ediliyor...",
    patternEngineEmpty: "Pattern analizi için önce YouTube Trend Analizi çalıştır.",
    patternTopTitles: "Başlık Pattern’leri",
    patternHooks: "Hook Pattern’leri",
    patternDuration: "Önerilen Süre",
    patternOpportunity: "Opportunity Score",
    patternCompetition: "Rekabet Seviyesi",
    patternAngle: "Önerilen İçerik Açısı",
    patternReasoning: "Gerekçe",
    creatorDurationTitle: "Hedef Süre",
    creatorDurationDesc: "Format ve süre seçimi sahne sayısını, anlatım uzunluğunu, timeline riskini ve kredi verimliliği önerilerini yönlendirir. Custom süre seçerek özgürce hedef belirleyebilirsin.",
    creatorQualityTitle: "Üretim Kalitesi",
    creatorQualityDesc: "Kalite modu; kredi tüketimini, görsel/video yönlendirmesini ve render aşamasında hangi üretim hattının kullanılacağını belirler.",
    creditProfile: "Kredi Profili",
    mediaRouting: "Medya Yönlendirme",
    customDuration: "Custom Süre",
    customDurationSeconds: "Süre (saniye)",
    customDurationMinutes: "Süre (dakika)",
    durationScenePlan: "Tahmini sahne planı",
    usePatternDuration: "Pattern önerisini kullan",
    autoSaved: "Otomatik kaydedildi ✅",
    projectSaved: "Proje kaydedildi ✅",
    projectUpdated: "Proje güncellendi ✅",
    childAdded: "Çocuk profili eklendi ✅",
    projectLoaded: "Proje yüklendi ✅",
    movieCreated: "Film oluşturuldu ✅",
    videoReadySaved: "Video hazırlandı ve kaydedildi ✅",
    allAudioReady: "Tüm sahne sesleri ve diyalogları hazırlandı ✅",
    shareCreated: "Paylaşım linki oluşturuldu ✅",
    shareCopied: "Paylaşım linki kopyalandı ✅",
  },
  en: {
    loading: "Loading...",
    roleLoading: "Loading role...",
    episodePackage: "Episode Package",
    notCreatedYet: "Not created yet",
    episodePackageSubtitle: "The Storyverse output is now a shareable product package.",
    flow: "Flow",
    language: "Language",
    character: "Characters",
    scene: "Scenes",
    audioReady: "Audio Ready",
    videoReady: "Video Ready",
    createMovie: "🎬 Create Movie",
    shareLinkCreate: "🔗 Create Share Link",
    shareLinkCreating: "Creating link...",
    copyLink: "📋 Copy Link",
    copied: "✅ Copied",
    download: "⬇️ Download",
    shareLink: "Share Link",
    openQr: "Open on phone with QR",
    qrHint: "Scan with a phone camera to open the story on the public episode page.",
    duration: "Duration",
    size: "Size",
    adminMode: "Admin Mode active → YouTube Engine will be positioned here.",
    parentMode: "Experience Lab Mode active.",
    selectedFlow: "Selected Flow",
    activeProductBehavior: "Active product behavior: Storyverse frames the story idea as a child-safe cartoon production flow.",
    nonStoryversePilot: "This flow is currently on the roadmap. The working production engine continues safely through Storyverse.",
    studioBadge: "Story Studio",
    studioTitle: "VELTO",
    studioDescription: "A focused production workspace for preparing scenes, visuals, narrator voice and final video output for the selected experience.",
    storySetupChip: "Story setup",
    sceneTimingChip: "Scene timing",
    voiceDialogueChip: "Voice + Dialogue",
    runwayVideoChip: "AI video blocks",
    finalExportChip: "Final export",
    sceneStatus: "Scene Status",
    totalScene: "Total scenes",
    exportReady: "Export Ready",
    exportReadyDesc: "Scenes exportable with video or image",
    readyAudio: "Ready Audio",
    readyAudioDesc: "Narrator cache ready",
    estimatedDuration: "Estimated Duration",
    estimatedDurationDesc: "Total target movie flow",
    journey: "Journey",
    studioRouteMap: "Journey Map",
    studioRouteMapDesc: "This workspace guides the selected experience from setup to production package and final export.",
    nextSurface: "Next Surface",
    quickContentMode: "Quick Content Mode",
    quickContentModeDesc: "The next product layer will add a fast YouTube content generation mode on top of this studio. This screen is its core production infrastructure.",
    quickItem1: "Episode generation with one prompt",
    quickItem2: "Series format + export-ready flow",
    quickItem3: "Shared universe with Experience Lab content",
    childProfile: "Child Profile",
    activeChild: "Active",
    noChildSelected: "No child selected",
    chooseChild: "Choose child",
    newChildName: "New child name",
    add: "Add",
    adding: "Adding...",
    childProfileHint: "An active child profile must be selected before generating a story in the Experience Lab flow.",
    myProjects: "My Projects",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    projectsLoading: "Loading projects...",
    noProjects: "No saved projects yet. Your first story will appear here after you create it.",
    untitledProject: "Untitled Project",
    lastUpdate: "Last update",
    open: "Open",
    contentLanguage: "Content Language",
    contentLanguageHint: "The selected language controls the generation language for the selected workspace outputs.",
    turkish: "Turkish",
    english: "English",
    storyPromptLabel: "What kind of cartoon / story do you want to create in Storyverse?",
    storyPromptPlaceholder: "Example: A curious child by the sea discovers a lost star map",
    genericPromptLabel: "What kind of experience do you want to start for this flow?",
    genericPromptPlaceholder: "Example: A short, safe experience flow where the child makes choices",
    preparingSetup: "Preparing setup...",
    createCharacters: "Create Characters",
    studioSnapshot: "Quick View",
    setupReady: "Setup ready",
    setupWaiting: "Setup waiting",
    studioSnapshotDesc: "Once the idea and visual direction are ready, you can continue creating.",
    dialogueLayer: "Character Voices",
    sceneCountLabel: "scenes",
    dialogueLayerDesc: "Scenes with prepared character voices.",
    freezeRisk: "Story Flow Check",
    freezeRiskDesc: "Scenes that may need smoother story timing.",
    quickModePrep: "Fast Creator Mode",
    activePlan: "Active plan",
    quickModePrepDesc: "Creator Lab stays focused on ideas, scripts, thumbnails, creator details and ready-to-share packages.",
    initialDesign: "Initial Design",
    initialDesignHint: "Review and correct the setup information. If everything looks right, generate the scenes next.",
    storyTitle: "Story Title",
    minuteShort: "min",
    secondShort: "sec",
    episodePackageProductDesc: "Storyverse output is now a product-ready package.",
    saveProjectFirstTitle: "Save the project first",
    publicShareTitle: "Create public share link",
    projectId: "Project ID",
    storyPremiseLabel: "Story Summary / Direction",
    narratorSettings: "Narrator Settings",
    narratorVoiceHint: "If left empty, the default server-side narrator voice will be used.",
    narratorRecommended: "Recommended narrator starting point:",
    narratorCacheHint: "If the voice identity changes, existing narrator and dialogue caches will be cleared.",
    charactersTitle: "Characters",
    addCharacter: "Add Character",
    characterLabel: "Character",
    delete: "Delete",
    namePlaceholder: "Name",
    agePlaceholder: "Age",
    appearancePlaceholder: "Appearance",
    outfitPlaceholder: "Outfit",
    accessoryPlaceholder: "Accessory",
    personalityPlaceholder: "Character energy / personality",
    characterVoicePlaceholder: "Character voiceId (ElevenLabs)",
    characterVoiceHint: "You can enter an ElevenLabs voiceId here for character dialogue. If left empty, the system will continue with the default voice.",
    preparingReferenceImage: "Preparing reference image...",
    generateReferenceImage: "Generate Reference Image",
    referenceImageAlt: "reference image",
    noCharacterReference: "No reference image has been generated for this character yet.",
    visualStyle: "Visual Style",
    stylePlaceholder: "Style",
    palettePlaceholder: "Color palette",
    cameraPlaceholder: "Camera approach",
    consistencyRulesPlaceholder: "Consistency rules",
    buildingStory: "Building story...",
    buildStoryAndScenes: "Create Story and Scenes",
    savingProject: "Saving...",
    saveProject: "Save Project",
    preparingAudio: "Preparing audio...",
    prepareAudio: "Prepare Audio",
    stopStory: "Stop Story",
    listenStory: "Listen to Story",
    creatingMovie: "Creating movie...",
    createFinalMovieWithCount: "🎞 Create Movie",
    finalMovie: "Final Movie",
    finalMovieDesc: "Scene videos have been merged. You can watch, download, or share the link below.",
    sceneProductionPanel: "Scene Production Panel",
    sceneProductionPanelDesc: "Each scene card shows production, audio, video, and export decisions on one surface.",
    lastScene: "Last scene",
    sceneCardPurpose: "This card is designed to manage story, audio, video, and export decisions for the scene at a glance.",
    videoCreating: "Creating video...",
    convertToVideo: "🎬 Convert to Video",
    editScene: "Edit Scene",
    branchAfterScene: "Continue After This Scene",
    redrawing: "Redrawing...",
    redraw: "Redraw",
    scenePreviews: "Scene previews",
    imageReady: "Image ready",
    imagePending: "Image pending",
    videoPending: "Video pending",
    readySceneImage: "Ready scene image",
    noSceneImagePreview: "No image preview for this scene yet. It will appear here once generated.",
    readySceneVideo: "Ready scene video",
    noSceneVideoPreview: "No video preview for this scene yet. It will appear here once ready.",
    target: "Target",
    speech: "Speech",
    intelligencePanel: "Dynamic Scene Intelligence",
    sceneType: "Scene Type",
    emotionalIntensity: "Emotion",
    pacingLevel: "Pacing",
    curiosityScore: "Curiosity",
    tensionScore: "Tension",
    climaxLevel: "Climax",
    thumbnailScore: "Thumbnail",
    bestThumbnailCandidate: "Best Thumbnail",
    hookScore: "Hook",
    bestHookCandidate: "Best Hook",
    retentionRisk: "Retention",
    lowRisk: "Low Risk",
    mediumRisk: "Medium Risk",
    highRisk: "High Risk",
    youtubeReadiness: "YouTube Ready",
    strongReady: "Strong",
    moderateReady: "Moderate",
    weakReady: "Weak",
    recommendation: "Recommendation",
    noSceneIntelligence: "This scene does not have intelligence metadata yet. Regenerate this scene to add it automatically.",
    speechTooLong: "⚠️ Speech is too long for this scene. Edit and shorten it.",
    speechTimingOk: "✅ Scene and speech duration are aligned.",
    sceneEditQuestion: "What do you want to change in this scene?",
    sceneEditPlaceholder: "Example: Add a robot and make the scene funnier...",
    updating: "Updating...",
    updateScene: "Update Scene",
    cancel: "Cancel",
    branchQuestion: "How should the story continue after this scene?",
    branchPlaceholder: "Example: After this scene, the children discover a secret passage.",
    branchWarning: "This action removes the current flow after this scene and generates a new continuation scene.",
    writingNewFlow: "Writing new flow...",
    continueFromHere: "Continue From Here",
    continueFromLastScene: "Continue From Last Scene",
    continueFromLastSceneDesc: "Write what you want to happen after the current final scene of the story.",
    continuePromptPlaceholder: "Example: The children find a glowing door inside the cave.",
    writingContinue: "Writing continuation...",
    writeContinue: "Write Continuation",
    sceneListTitle: "Scenes",
    creatorMentor: "Content Creator Mentor",
    creatorStrategySetup: "Creator Strategy Brief",
    creatorMentorDesc: "Define the target market, audience, format and duration before production. Velto uses this brief to shape opportunity analysis, scene planning, timeline safety and export packaging.",
    targetMarket: "Target Market",
    ageGroup: "Audience Profile",
    contentType: "Content Type",
    videoFormat: "Production Format",
    analyzeContentOpportunity: "Analyze Content Opportunity",
    analyzingContentOpportunity: "Analyzing content opportunity...",
    creatorTopicLabel: "What topic or video idea should Content Creator Lab analyze?",
    creatorTopicPlaceholder: "Example: How should AI trends be explained on LinkedIn, or suggest a strong faceless YouTube video idea",
    mentorAnalysisTitle: "Mentor Analysis",
    audienceInsight: "Audience Insight",
    hookPatterns: "Hook Patterns",
    videoIdeas: "Video Ideas",
    recommendedIdea: "Recommended Idea",
    productionPlan: "Production Plan",
    continueToProduction: "Turn this idea into a production package",
    creatorProductionTitle: "Production Package",
    creatorProductionDesc: "Turns the recommended idea into a production-ready package with scenes, narration, visual directions, thumbnail, and caption.",
    convertingProductionPackage: "Preparing production package...",
    productionPackageReady: "Production package is ready ✅",
    thumbnailIdea: "Thumbnail Idea",
    youtubeTitle: "YouTube Title",
    youtubeCaption: "YouTube Caption",
    youtubeMetadataEngine: "YouTube Metadata Engine",
    youtubeMetadataDesc: "Generates title options, description, hashtags, and first comment suggestions.",
    generateYoutubeMetadata: "Generate YouTube Metadata",
    generatingYoutubeMetadata: "Generating metadata...",
    recommendedYoutubeTitle: "Recommended Title",
    titleOptions: "Title Options",
    youtubeDescription: "YouTube Description",
    hashtags: "Hashtags",
    firstComment: "First Comment",
    thumbnailTextIdeas: "Thumbnail Text Ideas",
    seoKeywords: "SEO Keywords",
    audiencePromise: "Audience Promise",
    thumbnailGenerationEngine: "Scene Thumbnail Selector",
    thumbnailGenerationDesc: "Selects a thumbnail from existing scene images without generating an extra image.",
    generateThumbnail: "Select Best Scene",
    generatingThumbnail: "Selecting thumbnail...",
    generatedThumbnail: "Selected Thumbnail",
    thumbnailPrompt: "Source Scene",
    thumbnailHeadline: "Thumbnail Headline",
    thumbnailSubHeadline: "Thumbnail Sub-headline",
    sceneThumbnailCandidates: "Scene Thumbnail Candidates",
    useSceneAsThumbnail: "Use as Thumbnail",
    noSceneThumbnailsYet: "Generate scene images first to select a thumbnail.",
    exportCreatorPackage: "Creator Package Export",
    exportCreatorPackageDesc: "Downloads video link, title, description, hashtags, first comment, thumbnail, and scene data as a ZIP package.",
    downloadCreatorPackage: "Download Creator Package",
    downloadingCreatorPackage: "Preparing package...",
    costOptimizationEngine: "Credit Efficiency Advisor",
    costOptimizationDesc: "Recommends a more credit-efficient media route for the current scene plan. The total credit estimate stays in Production Quality.",
    costPricingNote: "Note: This area does not create a second credit estimate; it only suggests ways to make the selected production plan more efficient.",
    optimizeScenes: "Optimize Scenes",
    optimizingScenes: "Optimizing scenes...",
    costSummary: "Efficiency Summary",
    recommendedVideoScenes: "Premium Video Blocks",
    recommendedImageScenes: "Image-motion Blocks",
    estimatedCost: "Credit Route",
    estimatedSavings: "Efficiency Gain",
    applyOptimization: "Apply Recommendations",
    optimizationApplied: "Optimization recommendations applied ✅",
    aiOptimizeScenes: "AI Optimize",
    aiOptimizingScenes: "AI optimizing...",
    youtubeAutoMode: "YouTube Auto Mode",
    youtubeAutoModeDesc: "Builds production package, metadata, thumbnail, credit-efficiency recommendations, and save steps from one topic. It does not render video; premium rendering remains under your control.",
    generateFullYoutubePackage: "Create Ready-to-Share Package",
    generatingFullYoutubePackage: "Preparing full package...",
    fullYoutubePackageReady: "Full YouTube package is ready ✅",
    productionBridgeTitle: "Continue to Production",
    productionBridgeDesc: "The Creator Lab package is ready. Convert it into editable production scenes first; image, voice, video and export actions remain separate.",
    productionBridgeButton: "🎬 Create Production Stage",
    productionBridgeReady: "Creator Lab package is ready. No editable production scenes have been created yet.",
    productionBridgeCostNote: "Note: This step creates a text-only scene structure; it does not start image, voice, video or export credit usage.",
    bulkGeneratorTitle: "Idea Machine",
    bulkGeneratorDesc: "Quickly turns multiple video ideas into simple idea cards you can choose from.",
    bulkTopicsLabel: "Write one video idea per line",
    bulkTopicsPlaceholder: "Example:\nWhy do ants work so hard?\nHow do rockets fly?\nWhy is the ocean blue?",
    bulkGenerate: "Create Idea Cards",
    bulkGenerating: "Generating ideas...",
    bulkEmpty: "No bulk ideas generated yet.",
    bulkScore: "Score",
    bulkAngle: "Angle",
    bulkReason: "Reason",
    useBulkTopic: "Use this as main topic",
    generateFullPackageFromBulk: "🚀 Generate Full Package",
    bulkPackageStarted: "Full package generation started from bulk idea ✅",
    bulkTopicApplied: "Bulk idea copied to main topic ✅",
    generateSelectedBulk: "🚀 Generate Selected",
    generatingSelectedBulk: "Generating selected...",
    selectedBulkCount: "Selected ideas",
    productionPackageNote: "After this package is prepared, CreatorLab continues into scenes, visuals, audio, video, thumbnail and metadata production.",
    refineScenes: "Refine Scenes with AI",
    refiningScenes: "Refining scenes...",
    refinedScenesReady: "Scenes refined with AI ✅",
    refinedScenesNote: "Refined scenes are ready. You can now continue to scene production.",
    youtubeResearchTitle: "Explore Popular Ideas",
    youtubeResearchDesc: "Looks for useful creator signals for the selected topic and audience. This helps choose a stronger video idea.",
    youtubeResearchButton: "Run Explore Popular Ideas",
    youtubeResearchLoading: "Analyzing YouTube data...",
    youtubeResearchEmpty: "No suitable YouTube video results were found.",
    youtubeResearchViews: "views",
    youtubeResearchLikes: "likes",
    youtubeResearchDuration: "duration",
    patternEngineTitle: "Smart Creator Tips",
    patternEngineDesc: "Finds useful title, hook, duration and opportunity tips from selected examples.",
    patternEngineButton: "Find Smart Creator Tips",
    patternEngineLoading: "Analyzing patterns...",
    patternEngineEmpty: "Explore popular ideas first to unlock Smart Creator Tips.",
    patternTopTitles: "Title Patterns",
    patternHooks: "Hook Patterns",
    patternDuration: "Recommended Duration",
    patternOpportunity: "Opportunity Score",
    patternCompetition: "Competition Level",
    patternAngle: "Recommended Content Angle",
    patternReasoning: "Reasoning",
    creatorDurationTitle: "Target Duration",
    creatorDurationDesc: "Format and duration guide scene count, narration length, timeline risk and credit-efficiency recommendations. Choose a preset or set a custom duration freely.",
    creatorQualityTitle: "Production Quality",
    creatorQualityDesc: "Quality mode controls credit usage, visual/video routing and which production path is used during rendering.",
    creditProfile: "Credit Profile",
    mediaRouting: "Media Routing",
    customDuration: "Custom Duration",
    customDurationSeconds: "Duration (seconds)",
    customDurationMinutes: "Duration (minutes)",
    durationScenePlan: "Estimated scene plan",
    usePatternDuration: "Use pattern recommendation",
    autoSaved: "Autosaved ✅",
    projectSaved: "Project saved ✅",
    projectUpdated: "Project updated ✅",
    childAdded: "Child profile added ✅",
    projectLoaded: "Project loaded ✅",
    movieCreated: "Movie created ✅",
    videoReadySaved: "Video prepared and saved ✅",
    allAudioReady: "All scene narration and dialogue audio are ready ✅",
    shareCreated: "Share link created ✅",
    shareCopied: "Share link copied ✅",
  },
};


const getAudioDurationFromUrl = (url?: string) => {
  return new Promise<number>((resolve) => {
    if (!url) {
      resolve(0);
      return;
    }

    const audio = new Audio(url);
    let resolved = false;

    const finish = (value: number) => {
      if (!resolved) {
        resolved = true;
        resolve(Number.isFinite(value) ? value : 0);
      }
    };

    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      finish(audio.duration || 0);
    };

    audio.onerror = () => {
      finish(0);
    };
  });
};

const buildSceneTiming = (
  narrationDuration: number,
  dialogueDuration: number,
  options?: {
    audioFirst?: boolean;
    plannedDuration?: number;
  },
): SceneTiming => {
  const safeNarration = Number.isFinite(narrationDuration) ? narrationDuration : 0;
  const safeDialogue = Number.isFinite(dialogueDuration) ? dialogueDuration : 0;
  const totalAudioDuration = safeNarration + safeDialogue;

  if (options?.audioFirst) {
    const durationMatch = matchAudioDurationToScene({
      audioDurationSec: totalAudioDuration,
      plannedDurationSec:
        options.plannedDuration || TARGET_SCENE_DURATION_SECONDS,
      fallbackDurationSec: TARGET_SCENE_DURATION_SECONDS,
      minDurationSec: CREATOR_MIN_SCENE_DURATION_SECONDS,
      maxDurationSec: CREATOR_MAX_SCENE_DURATION_SECONDS,
      preferredMaxSceneDurationSec:
        CREATOR_PREFERRED_MAX_SCENE_DURATION_SECONDS,
      tailBufferSec: CREATOR_SPEECH_TAIL_BUFFER_SECONDS,
    });
    const targetSceneDuration = durationMatch.targetDurationSec;
    const maxSpeechDuration = Number(
      Math.max(
        0,
        targetSceneDuration - CREATOR_SPEECH_TAIL_BUFFER_SECONDS,
      ).toFixed(2),
    );
    const freezeDuration = Math.max(
      0,
      Number(
        (
          targetSceneDuration - durationMatch.plannedDurationSec
        ).toFixed(2),
      ),
    );

    return {
      narrationDuration: safeNarration,
      dialogueDuration: safeDialogue,
      totalAudioDuration,
      targetSceneDuration,
      maxSpeechDuration,
      freezeDuration,
      needsFreezeFrame: freezeDuration > FREEZE_TOLERANCE_SECONDS,
      durationMatchStatus: durationMatch.status,
      plannedSceneDuration: durationMatch.plannedDurationSec,
      unnecessaryExtensionRemoved:
        durationMatch.unnecessaryExtensionRemovedSec,
      splitRecommended: durationMatch.splitRecommended,
      recommendedSplitCount: durationMatch.recommendedSplitCount,
    };
  }

  const adaptiveDurationFromSpeech =
    totalAudioDuration > 0
      ? totalAudioDuration / MAX_SPEECH_RATIO
      : TARGET_SCENE_DURATION_SECONDS;

  const targetSceneDuration = Math.min(
    MAX_SCENE_DURATION_SECONDS,
    Math.max(
      TARGET_SCENE_DURATION_SECONDS,
      adaptiveDurationFromSpeech,
      MIN_SCENE_DURATION_SECONDS
    )
  );

  const maxSpeechDuration = Number(
    (targetSceneDuration * MAX_SPEECH_RATIO).toFixed(2)
  );

  const freezeDuration = Math.max(
    0,
    targetSceneDuration - DEFAULT_VIDEO_DURATION_SECONDS
  );

  const needsFreezeFrame = freezeDuration > FREEZE_TOLERANCE_SECONDS;

  return {
    narrationDuration: safeNarration,
    dialogueDuration: safeDialogue,
    totalAudioDuration,
    targetSceneDuration,
    maxSpeechDuration,
    freezeDuration,
    needsFreezeFrame,
  };
};

const formatSceneIntelligenceValue = (value: unknown, fallback = "-") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
};

const formatSceneScore = (value: unknown) => {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return "-";
  }

  return `${Math.max(1, Math.min(10, Math.round(parsed)))}/10`;
};


const calculateThumbnailScore = (intelligence?: SceneIntelligence) => {
  if (!intelligence) {
    return 0;
  }

  const curiosity = Number(intelligence.curiosity_score || 0);
  const emotion = Number(intelligence.emotional_intensity || 0);
  const climax = Number(intelligence.climax_level || 0);

  let pacingBonus = 0;

  if (intelligence.pacing_level === "fast") {
    pacingBonus = 1;
  } else if (intelligence.pacing_level === "medium") {
    pacingBonus = 0.5;
  }

  const score =
    curiosity * 0.45 +
    emotion * 0.3 +
    climax * 0.15 +
    pacingBonus;

  return Math.min(10, Number(score.toFixed(1)));
};

const isBestThumbnailCandidate = (
  currentScene: { intelligence?: SceneIntelligence },
  candidateScenes: Array<{ intelligence?: SceneIntelligence }>
) => {
  const scores = candidateScenes.map((candidateScene) =>
    calculateThumbnailScore(candidateScene?.intelligence)
  );

  const bestScore = Math.max(...scores, 0);
  const currentScore = calculateThumbnailScore(currentScene?.intelligence);

  return currentScore > 0 && currentScore === bestScore;
};


const calculateHookScore = (intelligence?: SceneIntelligence) => {
  if (!intelligence) {
    return 0;
  }

  const curiosity = Number(intelligence.curiosity_score || 0);
  const tension = Number(intelligence.tension_score || 0);
  const emotion = Number(intelligence.emotional_intensity || 0);

  let typeBonus = 0;

  if (intelligence.scene_type === "hook") {
    typeBonus = 1.2;
  } else if (intelligence.scene_type === "mystery") {
    typeBonus = 1;
  } else if (intelligence.scene_type === "discovery") {
    typeBonus = 0.6;
  }

  let pacingBonus = 0;

  if (intelligence.pacing_level === "fast") {
    pacingBonus = 0.8;
  } else if (intelligence.pacing_level === "medium") {
    pacingBonus = 0.4;
  }

  const score =
    curiosity * 0.5 +
    tension * 0.25 +
    emotion * 0.15 +
    typeBonus +
    pacingBonus;

  return Math.min(10, Number(score.toFixed(1)));
};

const isBestHookCandidate = (
  currentScene: { intelligence?: SceneIntelligence },
  candidateScenes: Array<{ intelligence?: SceneIntelligence }>
) => {
  const scores = candidateScenes.map((candidateScene) =>
    calculateHookScore(candidateScene?.intelligence)
  );

  const bestScore = Math.max(...scores, 0);
  const currentScore = calculateHookScore(currentScene?.intelligence);

  return currentScore > 0 && currentScore === bestScore;
};

const calculateRetentionRisk = (intelligence?: SceneIntelligence) => {
  if (!intelligence) {
    return {
      level: "medium",
      score: 5,
    };
  }

  let riskScore = 0;

  const curiosity = Number(intelligence.curiosity_score || 0);
  const tension = Number(intelligence.tension_score || 0);
  const emotion = Number(intelligence.emotional_intensity || 0);

  if (curiosity <= 4) {
    riskScore += 3;
  }

  if (intelligence.pacing_level === "slow") {
    riskScore += 2;
  }

  if (tension <= 3) {
    riskScore += 2;
  }

  if (emotion <= 4) {
    riskScore += 1;
  }

  if (riskScore <= 2) {
    return {
      level: "low",
      score: riskScore,
    };
  }

  if (riskScore <= 5) {
    return {
      level: "medium",
      score: riskScore,
    };
  }

  return {
    level: "high",
    score: riskScore,
  };
};



const calculateYoutubeReadinessScore = (intelligence?: SceneIntelligence) => {
  if (!intelligence) {
    return 0;
  }

  const thumbnailScore = calculateThumbnailScore(intelligence);
  const hookScore = calculateHookScore(intelligence);
  const retentionRisk = calculateRetentionRisk(intelligence);

  const retentionBoost =
    retentionRisk.level === "low"
      ? 2
      : retentionRisk.level === "medium"
      ? 1
      : 0;

  const score =
    thumbnailScore * 0.35 +
    hookScore * 0.35 +
    retentionBoost * 1.5 +
    Number(intelligence.climax_level || 0) * 0.15;

  return Math.min(10, Number(score.toFixed(1)));
};

const getYoutubeReadinessLevel = (score: number) => {
  if (score >= 7.5) {
    return "strong";
  }

  if (score >= 5.5) {
    return "moderate";
  }

  return "weak";
};

const generateSceneRecommendation = (
  intelligence?: SceneIntelligence
) => {
  if (!intelligence) {
    return "No recommendation available yet.";
  }

  const recommendations: string[] = [];

  const curiosity = Number(intelligence.curiosity_score || 0);
  const emotion = Number(intelligence.emotional_intensity || 0);
  const climax = Number(intelligence.climax_level || 0);
  const tension = Number(intelligence.tension_score || 0);

  if (curiosity >= 8) {
    recommendations.push("Strong hook.");
  }

  if (intelligence.pacing_level === "fast") {
    recommendations.push("Shorts-ready pacing.");
  }

  if (emotion >= 7) {
    recommendations.push("Strong emotion.");
  }

  if (climax <= 4) {
    recommendations.push("Needs stronger climax.");
  }

  if (tension <= 3) {
    recommendations.push("Increase tension.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Balanced scene.");
  }

  return recommendations.slice(0, 2).join(" ");
};







const formatTimelineSeconds = (value?: number) => {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0s";
  }

  return `${Math.round(numericValue * 10) / 10}s`;
};

const getTimelineActionLabel = (action?: TimelineScenePlan["visualAction"]) => {
  switch (action) {
    case "keep_clip":
      return "Keep clip";
    case "slow_clip":
      return "Slow clip";
    case "image_motion_tail":
      return "Image motion tail";
    case "split_scene":
      return "Split scene";
    case "rewrite_voice":
      return "Rewrite voice";
    default:
      return "Review";
  }
};

const getTimelineRiskLabel = (plan: TimelineSyncPlan) => {
  const criticalCount = plan.scenes.filter(
    (scene) => scene.audioMismatch === "critical" || scene.speechFit === "too_long",
  ).length;
  const longCount = plan.scenes.filter(
    (scene) => scene.audioMismatch === "long" || scene.speechFit === "tight",
  ).length;

  if (criticalCount > 0) {
    return {
      label: "Needs edit plan",
      className: "border-rose-400/30 bg-rose-500/[0.12] text-rose-100",
    };
  }

  if (longCount > 0) {
    return {
      label: "Tight timing",
      className: "border-amber-400/30 bg-amber-500/[0.12] text-amber-100",
    };
  }

  return {
    label: "Timeline safe",
    className: "border-emerald-400/30 bg-emerald-500/[0.12] text-emerald-100",
  };
};

const creatorTimelineNeedsEditPlan = (plan?: TimelineSyncPlan | null) => {
  if (!plan || !Array.isArray(plan.scenes)) {
    return false;
  }

  return plan.scenes.some(
    (scene) =>
      scene.audioMismatch === "critical" ||
      scene.speechFit === "too_long" ||
      scene.visualAction === "split_scene" ||
      scene.visualAction === "rewrite_voice" ||
      scene.visualAction === "image_motion_tail",
  );
};

const getCreatorEditRecommendation = (scene: TimelineScenePlan) => {
  if (scene.visualAction === "split_scene") {
    return "Split this scene into two shorter visual beats before cinematic rendering.";
  }

  if (scene.visualAction === "rewrite_voice") {
    return "Shorten or rewrite the narration so the speech lands inside the visual beat.";
  }

  if (scene.visualAction === "image_motion_tail" || scene.speechFit === "too_long") {
    return "Keep the AI video clip as the opening visual block, then complete the remaining narration with image-motion, B-roll, or cutaway visuals.";
  }

  if (scene.visualAction === "slow_clip" || scene.speechFit === "tight") {
    return "Render with sentence-boundary cuts and avoid cutting speech at the 7-second clip boundary.";
  }

  return "Safe for standard visual rendering.";
};


const CREATOR_TIMELINE_TARGET_WORDS_PER_SECOND = 2.15;
const CREATOR_TIMELINE_SAFE_CLIP_SECONDS = 6.4;
const CREATOR_TIMELINE_TIGHT_CLIP_SECONDS = 6.9;

const trimCreatorSpeechToWords = (value: string, maxWords: number) => {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  const trimmed = words.slice(0, Math.max(8, maxWords)).join(" ").replace(/[,.!?:;]+$/, "");
  return `${trimmed}.`;
};

const getTimelineOptimizedSpeechTargetWords = (scenePlan?: TimelineScenePlan) => {
  if (!scenePlan) {
    return Math.round(CREATOR_TIMELINE_SAFE_CLIP_SECONDS * CREATOR_TIMELINE_TARGET_WORDS_PER_SECOND);
  }

  if (
    scenePlan.visualAction === "image_motion_tail" ||
    scenePlan.visualAction === "split_scene" ||
    scenePlan.visualAction === "rewrite_voice" ||
    scenePlan.speechFit === "too_long" ||
    scenePlan.audioMismatch === "critical"
  ) {
    return Math.round(CREATOR_TIMELINE_SAFE_CLIP_SECONDS * CREATOR_TIMELINE_TARGET_WORDS_PER_SECOND);
  }

  if (
    scenePlan.visualAction === "slow_clip" ||
    scenePlan.speechFit === "tight" ||
    scenePlan.audioMismatch === "long"
  ) {
    return Math.round(CREATOR_TIMELINE_TIGHT_CLIP_SECONDS * CREATOR_TIMELINE_TARGET_WORDS_PER_SECOND);
  }

  return Math.round(CREATOR_TIMELINE_TIGHT_CLIP_SECONDS * CREATOR_TIMELINE_TARGET_WORDS_PER_SECOND);
};

const sceneNeedsTimelineTextOptimization = (scenePlan?: TimelineScenePlan) => {
  if (!scenePlan) {
    return false;
  }

  return (
    scenePlan.audioMismatch === "critical" ||
    scenePlan.audioMismatch === "long" ||
    scenePlan.speechFit === "too_long" ||
    scenePlan.speechFit === "tight" ||
    scenePlan.visualAction === "image_motion_tail" ||
    scenePlan.visualAction === "split_scene" ||
    scenePlan.visualAction === "rewrite_voice" ||
    scenePlan.visualAction === "slow_clip"
  );
};

const optimizeCreatorScenesForTimelineText = <T extends Partial<CreatorProductionScene & Scene>>(
  sourceScenes: T[],
  plan: TimelineSyncPlan,
): T[] => {
  const planById = new Map(
    plan.scenes.map((scenePlan) => [String(scenePlan.id), scenePlan]),
  );

  return sourceScenes.map((scene, index) => {
    const sceneId = scene.id || index + 1;
    const scenePlan = planById.get(String(sceneId)) || plan.scenes[index];

    if (!sceneNeedsTimelineTextOptimization(scenePlan)) {
      return scene;
    }

    const targetWords = getTimelineOptimizedSpeechTargetWords(scenePlan);
    const sourceSpeech = [scene.narration, scene.dialogue]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" ") || String(scene.text || "").trim();
    const optimizedNarration = trimCreatorSpeechToWords(sourceSpeech, targetWords);

    return {
      ...scene,
      narration: optimizedNarration,
      dialogue: "",
      text: String(scene.text || "").trim() || optimizedNarration,
      motionHint: scene.motionHint || "sentence-boundary editorial beat",
    };
  });
};

const createCreatorEditPlanFromTimeline = (plan: TimelineSyncPlan): CreatorEditPlan => {
  const items = plan.scenes.map((scene) => {
    const needsEdit =
      scene.audioMismatch === "critical" ||
      scene.speechFit === "too_long" ||
      scene.visualAction === "split_scene" ||
      scene.visualAction === "rewrite_voice" ||
      scene.visualAction === "image_motion_tail";
    const needsReview =
      !needsEdit &&
      (scene.audioMismatch === "long" ||
        scene.speechFit === "tight" ||
        scene.visualAction === "slow_clip");

    const priority: CreatorEditPlanPriority = needsEdit
      ? "edit_required"
      : needsReview
        ? "review"
        : "render_safe";

    return {
      sceneId: scene.id,
      priority,
      decision: getTimelineActionLabel(scene.visualAction),
      reason: `${scene.speechFit || "safe"} speech fit · ${scene.audioMismatch || "no"} mismatch`,
      recommendation: getCreatorEditRecommendation(scene),
      speechSeconds: Number(scene.estimatedSpeechSeconds || 0),
      visualBlocks: scene.visualBlocks?.length || 0,
    };
  });

  const requiredEdits = items.filter((item) => item.priority === "edit_required").length;
  const reviews = items.filter((item) => item.priority === "review").length;

  return {
    status: requiredEdits > 0 ? "needs_edit_plan" : "ready_to_render",
    summary:
      requiredEdits > 0
        ? `${requiredEdits} scene(s) need timeline edits before paid cinematic rendering. ${reviews} additional scene(s) should be reviewed.`
        : reviews > 0
          ? `${reviews} scene(s) have tight timing but can proceed with careful sentence-boundary editing.`
          : "All scenes are safe for standard rendering.",
    items,
  };
};

function CreatorTimelinePreviewPanel({
  plan,
  editPlan,
  onGenerateEditPlan,
  onOptimizeTimeline,
  isOptimizingTimeline,
}: {
  plan?: TimelineSyncPlan | null;
  editPlan?: CreatorEditPlan | null;
  onGenerateEditPlan?: () => void;
  onOptimizeTimeline?: () => void;
  isOptimizingTimeline?: boolean;
}) {
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    return null;
  }

  const risk = getTimelineRiskLabel(plan);
  const sceneCount = plan.scenes.length;
  const criticalScenes = plan.scenes.filter(
    (scene) => scene.audioMismatch === "critical" || scene.speechFit === "too_long",
  ).length;
  const imageMotionScenes = plan.scenes.filter(
    (scene) => scene.visualAction === "image_motion_tail",
  ).length;
  const splitScenes = plan.scenes.filter(
    (scene) => scene.visualAction === "split_scene",
  ).length;
  const visualBlockCount = plan.scenes.reduce(
    (sum, scene) => sum + (scene.visualBlocks?.length || 0),
    0,
  );
  const previewScenes = plan.scenes.slice(0, 6);

  return (
    <div className="mt-5 rounded-[30px] border border-white/10 bg-slate-950/72 p-5 text-sm text-slate-200 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/70">
            Timeline preview
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Audio-first continuity plan
          </h3>
          <p className="mt-2 max-w-3xl leading-6 text-slate-300">
            CreatorLab now checks narration timing before final rendering and decides whether each scene should keep the generated clip, slow it down, add image-motion/B-roll, or split the scene.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className={`rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] ${risk.className}`}>
            {risk.label}
          </div>
          {onOptimizeTimeline && (
            <button
              type="button"
              onClick={onOptimizeTimeline}
              disabled={Boolean(isOptimizingTimeline)}
              className="rounded-2xl border border-orange-300/30 bg-orange-400 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOptimizingTimeline ? "Optimizing…" : "Optimize Timeline"}
            </button>
          )}
          {onGenerateEditPlan && creatorTimelineNeedsEditPlan(plan) && (
            <button
              type="button"
              onClick={onGenerateEditPlan}
              className="rounded-2xl border border-cyan-300/25 bg-cyan-300 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-cyan-200"
            >
              Generate Edit Plan
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Scenes</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sceneCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Speech</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatTimelineSeconds(plan.estimatedSpeechSeconds)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Blocks</p>
          <p className="mt-2 text-2xl font-semibold text-white">{visualBlockCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Image tails</p>
          <p className="mt-2 text-2xl font-semibold text-white">{imageMotionScenes}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Splits</p>
          <p className="mt-2 text-2xl font-semibold text-white">{splitScenes}</p>
        </div>
      </div>

      {criticalScenes > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-amber-100">
          {criticalScenes} scene(s) should be split, rewritten, or supported with B-roll before expensive cinematic rendering. Speech should not be cut at the 7-second clip boundary.
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <div className="grid min-w-[640px] grid-cols-[72px_1fr_140px_120px] gap-3 bg-white/[0.06] px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          <span>Scene</span>
          <span>Decision</span>
          <span>Speech</span>
          <span>Blocks</span>
        </div>

        <div className="divide-y divide-white/10">
          {previewScenes.map((scene) => (
            <div
              key={`timeline-scene-${scene.id}`}
              className="grid min-w-[640px] grid-cols-[72px_1fr_140px_120px] gap-3 px-4 py-3 text-slate-200"
            >
              <span className="font-semibold text-white">#{scene.id}</span>
              <span>
                {getTimelineActionLabel(scene.visualAction)}
                <span className="ml-2 text-slate-500">· {scene.speechFit}</span>
              </span>
              <span>{formatTimelineSeconds(scene.estimatedSpeechSeconds)}</span>
              <span>{scene.visualBlocks?.length || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {editPlan && (
        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">
                Edit plan
              </p>
              <h4 className="mt-2 text-lg font-semibold text-white">
                Pre-render actions
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {editPlan.summary}
              </p>
            </div>
            <span className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300">
              {editPlan.status === "needs_edit_plan" ? "Edit required" : "Render ready"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {editPlan.items.slice(0, 6).map((item) => (
              <div
                key={`creator-edit-plan-${item.sceneId}`}
                className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">Scene #{item.sceneId}</p>
                  <span className={
                    item.priority === "edit_required"
                      ? "rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-rose-100"
                      : item.priority === "review"
                        ? "rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-100"
                        : "rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-100"
                  }>
                    {item.priority.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {item.decision} · {formatTimelineSeconds(item.speechSeconds)} · {item.visualBlocks} block(s)
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {item.reason}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  {item.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.warnings?.length > 0 && (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-xs leading-5 text-slate-400">
          {plan.warnings.slice(0, 3).map((warning, index) => (
            <li key={`timeline-warning-${index}`}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}


export default function CreatePage() {
  const router = useRouter();
  const [selectedFlowKey, setSelectedFlowKey] = useState("storyverse");
  const selectedFlow = getFlowByKey(selectedFlowKey);
  const activeFlowKey =
    (selectedFlow as any)?.key || (selectedFlow as any)?.id || selectedFlowKey || "storyverse";
  const isStoryverseFlow = activeFlowKey === "storyverse";
  const isCreatorLabFlow = activeFlowKey === "creator_lab";
  const [authLoading, setAuthLoading] = useState(true);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creatorProjectsHidden, setCreatorProjectsHidden] = useState(true);
  const [userRole, setUserRole] = useState<"parent" | "admin" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [input, setInput] = useState("");
  const { language: uiLanguage, setLanguage: setUiLanguage } = useLanguage();
  const [language, setLanguage] = useState<ContentLanguage>(
    uiLanguage === "en" ? "en" : "tr"
  );
  const ui = UI_TEXT[uiLanguage] ?? UI_TEXT.tr;
  const localizedFlowMessages = flowCardMessages[uiLanguage] ?? flowCardMessages.tr;
  const localizedSelectedFlow = localizedFlowMessages.flows[activeFlowKey] ?? selectedFlow;

  const [creatorCountry, setCreatorCountry] = useState("global");
  const [creatorAgeGroup, setCreatorAgeGroup] = useState<CreatorAgeGroup>("professional_18");
  const [creatorContentType, setCreatorContentType] =
    useState<CreatorContentType>("educational");
  const [creatorFormat, setCreatorFormat] = useState<CreatorFormat>("short_form");
  const [creatorDurationPreset, setCreatorDurationPreset] =
    useState<CreatorDurationPreset>("short_60");
  const [creatorVideoDurationSec, setCreatorVideoDurationSec] =
    useState<CreatorVideoDurationSec>(60);
  const [creatorCustomDurationSec, setCreatorCustomDurationSec] =
    useState<CreatorVideoDurationSec>(60);
  const [creatorQualityMode, setCreatorQualityMode] =
    useState<CreatorQualityMode>("standard");
  const [creatorProfile, setCreatorProfile] =
    useState<CreatorProfile>(EMPTY_CREATOR_PROFILE);
  const [creatorProfileLoaded, setCreatorProfileLoaded] = useState(false);
  const [creatorMentorResult, setCreatorMentorResult] =
    useState<CreatorMentorResult | null>(null);
  const [creatorMentorLoading, setCreatorMentorLoading] = useState(false);
  const [creatorSelectedWorkspaceStep, setCreatorSelectedWorkspaceStep] =
    useState<1 | 2 | 3 | 4>(1);
  const creatorLastAutoStepRef = useRef<1 | 2 | 3 | 4>(1);
  const [creatorBriefEditorOpen, setCreatorBriefEditorOpen] = useState(false);
  const [creatorProductionDetailsOpen, setCreatorProductionDetailsOpen] = useState(false);
  const [creatorNoCastMode, setCreatorNoCastMode] = useState<CreatorNoCastMode>("faceless");
  const [creatorProductionPackage, setCreatorProductionPackage] =
    useState<CreatorProductionPackage | null>(null);
  const [creatorTimelinePreviewPlan, setCreatorTimelinePreviewPlan] =
    useState<TimelineSyncPlan | null>(null);
  const [creatorEditPlan, setCreatorEditPlan] =
    useState<CreatorEditPlan | null>(null);
  const [creatorTimelineApprovedSignature, setCreatorTimelineApprovedSignature] =
    useState("");
  const [creatorTimelinePreviewLoading, setCreatorTimelinePreviewLoading] =
    useState(false);
  const [creatorTimelineOptimizeLoading, setCreatorTimelineOptimizeLoading] =
    useState(false);
  const [creatorProductionLoading, setCreatorProductionLoading] = useState(false);
  const [isGeneratingFullYoutubePackage, setIsGeneratingFullYoutubePackage] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [bulkTopics, setBulkTopics] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkIdeaResult[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<number[]>([]);
  const [selectedBulkLoading, setSelectedBulkLoading] = useState(false);
  const [refinedCreatorScenes, setRefinedCreatorScenes] = useState<
    CreatorProductionScene[]
  >([]);
  const [refineScenesLoading, setRefineScenesLoading] = useState(false);
  const [youtubeResearchVideos, setYoutubeResearchVideos] = useState<
    YoutubeResearchVideo[]
  >([]);
  const [youtubeResearchLoading, setYoutubeResearchLoading] = useState(false);
  const [youtubePatternSummary, setYoutubePatternSummary] =
    useState<YoutubePatternSummary | null>(null);
  const [youtubePatternLoading, setYoutubePatternLoading] = useState(false);
  const [youtubeMetadataResult, setYoutubeMetadataResult] =
    useState<YoutubeMetadataResult | null>(null);
  const [youtubeMetadataLoading, setYoutubeMetadataLoading] = useState(false);
  const [youtubeThumbnailResult, setYoutubeThumbnailResult] =
    useState<YoutubeThumbnailResult | null>(null);
  const [youtubeThumbnailLoading, setYoutubeThumbnailLoading] = useState(false);
  const [isDownloadingCreatorPackage, setIsDownloadingCreatorPackage] = useState(false);
  const [creatorPackageDownloaded, setCreatorPackageDownloaded] = useState(false);
  const [sceneOptimizationResult, setSceneOptimizationResult] = useState<
    SceneOptimizationResult[]
  >([]);
  const [sceneOptimizationSummary, setSceneOptimizationSummary] =
    useState<SceneOptimizationSummary | null>(null);
  const [sceneOptimizationLoading, setSceneOptimizationLoading] = useState(false);
  const [sceneOptimizationAILoading, setSceneOptimizationAILoading] = useState(false);

  const [storySetup, setStorySetup] = useState<StorySetup | null>(null);

  const [title, setTitle] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [visualBible, setVisualBible] = useState<VisualBible | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);

  const [loadingSetup, setLoadingSetup] = useState(false);
  const [buildingStory, setBuildingStory] = useState(false);
  const [error, setError] = useState("");

  const [saveMessage, setSaveMessage] = useState("");

  const [continuePrompt, setContinuePrompt] = useState("");
  const [isContinuing, setIsContinuing] = useState(false);

  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [sceneInstructions, setSceneInstructions] = useState<Record<number, string>>({});
  const [sceneLoadingId, setSceneLoadingId] = useState<number | null>(null);

  const [branchingSceneId, setBranchingSceneId] = useState<number | null>(null);
  const [branchInstructions, setBranchInstructions] = useState<Record<number, string>>({});
  const [branchLoadingId, setBranchLoadingId] = useState<number | null>(null);

  const [characterLoadingIndex, setCharacterLoadingIndex] = useState<number | null>(null);
  const [redrawLoadingId, setRedrawLoadingId] = useState<number | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);

  const [loadProjectId, setLoadProjectId] = useState("");
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  const [currentProjectId, setCurrentProjectId] = useState<string>("");

  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [batchRenderItems, setBatchRenderItems] = useState<BatchRenderItem[]>([]);
  const [batchRenderStartedAt, setBatchRenderStartedAt] = useState<string>("");
  const [retryingSceneId, setRetryingSceneId] = useState<number | null>(null);
  const batchRenderCancelRef = useRef(false);

  const [playingSceneId, setPlayingSceneId] = useState<number | null>(null);
  const [loadingAudioSceneId, setLoadingAudioSceneId] = useState<number | null>(null);
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);

  const [playingDialogueSceneId, setPlayingDialogueSceneId] = useState<number | null>(null);
  const [loadingDialogueSceneId, setLoadingDialogueSceneId] = useState<number | null>(null);

  const [isExportingMovie, setIsExportingMovie] = useState(false);
  const [exportedMovieUrl, setExportedMovieUrl] = useState("");
  const [exportMovieResult, setExportMovieResult] = useState<ExportMovieResult | null>(null);
  const [exportSignature, setExportSignature] = useState("");

  useEffect(() => {
    setCreatorPackageDownloaded(false);
  }, [exportedMovieUrl, youtubeMetadataResult, youtubeThumbnailResult]);


  const [shareUrl, setShareUrl] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [narratorSettings, setNarratorSettings] = useState<NarratorSettings>(
    defaultNarratorSettings
  );

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipAutosaveRef = useRef(true);
  const isHydratingRef = useRef(false);
  const suspendAutosaveRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const storyPlaybackTokenRef = useRef(0);
  const dialoguePlaybackTokenRef = useRef(0);
  const draftProjectKeyRef = useRef(`draft-${crypto.randomUUID()}`);
  const videoPollIntervalsRef = useRef<Record<number, NodeJS.Timeout>>({});
  const exportApiBase = process.env.NEXT_PUBLIC_EXPORT_API_URL || "";

  const getActiveMaxSpeechRatio = () => {
    return activeFlowKey === "creator_lab"
      ? CREATOR_LAB_MAX_SPEECH_RATIO
      : MAX_SPEECH_RATIO;
  };

  const getBatchLabel = (key: "start" | "cancel" | "rendering" | "completed" | "failed" | "progress" | "statusTitle" | "retryFailed" | "retryScene" | "retrying") => {
    const labels = {
      tr: {
        start: "🚀 Tüm Sahneleri Üret",
        cancel: "Durdur",
        rendering: "Batch render çalışıyor...",
        completed: "Batch render tamamlandı ✅",
        failed: "Batch render sırasında bazı sahneler hata aldı.",
        progress: "İlerleme",
        statusTitle: "Batch Render Durumu",
        retryFailed: "🔁 Hatalı Sahneleri Yeniden Üret",
        retryScene: "Tekrar dene",
        retrying: "Yeniden deneniyor...",
      },
      en: {
        start: "🚀 Generate All Scenes",
        cancel: "Stop",
        rendering: "Batch render is running...",
        completed: "Batch render completed ✅",
        failed: "Some scenes failed during batch render.",
        progress: "Progress",
        statusTitle: "Batch Render Status",
        retryFailed: "🔁 Retry Failed Scenes",
        retryScene: "Retry",
        retrying: "Retrying...",
      },
    } as const;

    return (labels[uiLanguage] ?? labels.tr)[key];
  };

  const updateBatchRenderItem = (
    sceneId: number,
    patch: Partial<Omit<BatchRenderItem, "sceneId">>
  ) => {
    setBatchRenderItems((prev) =>
      prev.map((item) =>
        item.sceneId === sceneId
          ? {
              ...item,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const resetBatchRenderItems = (nextScenes: Scene[]) => {
    setBatchRenderItems(
      nextScenes.map((scene) => ({
        sceneId: scene.id,
        status: "pending",
        step: "waiting",
        message: "",
        updatedAt: new Date().toISOString(),
      }))
    );
  };

  const getBatchProgress = () => {
    if (batchRenderItems.length === 0) {
      return 0;
    }

    const finishedCount = batchRenderItems.filter((item) =>
      ["done", "failed", "skipped"].includes(item.status)
    ).length;

    return Math.round((finishedCount / batchRenderItems.length) * 100);
  };

  const isSceneSpeechTooLong = (timing?: SceneTiming) => {
    if (!timing) {
      return false;
    }

    const targetDuration =
      timing.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS;
    const maxSpeechDuration = Number(
      (targetDuration * getActiveMaxSpeechRatio()).toFixed(2)
    );

    return timing.totalAudioDuration > maxSpeechDuration;
  };


  useEffect(() => {
    if (isHydratingRef.current) {
      return;
    }

    const hasStartedStory = Boolean(
      title ||
        input ||
        storySetup ||
        characters.length > 0 ||
        visualBible ||
        scenes.length > 0
    );

    if (hasStartedStory) {
      return;
    }

    setLanguage(uiLanguage === "en" ? "en" : "tr");
  }, [uiLanguage, title, input, storySetup, characters.length, visualBible, scenes.length]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CREATOR_PROFILE_STORAGE_KEY);
      if (saved) {
        setCreatorProfile(parseCreatorProfile(JSON.parse(saved)));
      }
    } catch {
      // A profile is optional; an invalid local value must not block the workspace.
    } finally {
      setCreatorProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedFlow = params.get("flow");
    setSelectedFlowKey(
      requestedFlow === "creator_lab" || requestedFlow === "creatorlab"
        ? "creator_lab"
        : "storyverse",
    );
  }, []);


  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.push("/login");
      } else {
        setAuthLoading(false);
      }
    };

    checkUser();
  }, [router]);

  useEffect(() => {
    if (!authLoading) {
      fetchProjects();
      fetchUserRole();
    }
  }, [authLoading]);

  useEffect(() => {
    const loadChildren = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        return;
      }

      setChildrenLoading(true);

      const { data, error } = await supabase
        .from("children")
        .select("id, nickname")
        .eq("parent_id", authData.user.id)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        const nextChildren = data as ChildProfile[];
        setChildren(nextChildren);

        if (nextChildren.length > 0) {
          setSelectedChildId((prev) => prev || nextChildren[0].id);
        }
      }

      setChildrenLoading(false);
    };

    loadChildren();
  }, []);

  const handleAddChild = async () => {
    const nickname = newChildName.trim();

    if (!nickname) {
      setError("Lütfen çocuk adı / nickname gir.");
      return;
    }

    setAddingChild(true);
    setError("");
    setSaveMessage("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("children")
        .insert({
          parent_id: authData.user.id,
          nickname,
        })
        .select("id, nickname")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Çocuk kaydedilemedi.");
      }

      setChildren((prev) => [...prev, data as ChildProfile]);
      setSelectedChildId(data.id);
      setNewChildName("");
      setSaveMessage(ui.childAdded);
    } catch (e: any) {
      setError(e?.message || "Çocuk eklenirken bir hata oluştu.");
    } finally {
      setAddingChild(false);
    }
  };

  const selectedChild = children.find((child) => child.id === selectedChildId) || null;
  const activeFlowType = activeFlowKey;
  const filteredProjects = projects.filter(
    (project) => (project.flow_type || "storyverse") === activeFlowType
  );
  const selectedFlowProjectTitle =
    activeFlowKey === "creator_lab"
      ? "Creator Lab Projects"
      : activeFlowKey === "storyverse"
        ? "Storyverse Projects"
        : `${localizedSelectedFlow.shortTitle || localizedSelectedFlow.title} Projects`;

  const getProjectPreviewImage = (project: any) => {
    if (!Array.isArray(project?.scenes)) {
      return "";
    }

    const previewScene = project.scenes.find((scene: any) => scene?.image);
    return previewScene?.image || "";
  };

  const getProjectStatusLabel = (project: any) => {
    if (project?.exported_movie_url) {
      return uiLanguage === "en" ? "🎬 Ready" : "🎬 Hazır";
    }

    if (Array.isArray(project?.scenes) && project.scenes.length > 0) {
      return uiLanguage === "en" ? "⏳ In Progress" : "⏳ Devam Ediyor";
    }

    return uiLanguage === "en" ? "🧩 Draft" : "🧩 Taslak";
  };

  const getCreatorProjectSnapshot = (project: any) => {
    const projectScenes = Array.isArray(project?.scenes) ? project.scenes : [];
    const totalScenes = projectScenes.length;
    const visualReadyCount = projectScenes.filter((scene: any) =>
      Boolean(scene?.image || (scene?.videoUrl && scene?.videoStatus === "done")),
    ).length;
    const voiceReadyCount = projectScenes.filter((scene: any) => {
      const hasNarration = Boolean(scene?.audioUrl);
      const hasDialogue = Boolean(String(scene?.dialogue || "").trim());
      const dialogueReady = !hasDialogue || Boolean(scene?.dialogueAudioUrl);
      return hasNarration && dialogueReady;
    }).length;
    const exported = Boolean(project?.exported_movie_url);
    const assetsReady =
      totalScenes > 0 &&
      visualReadyCount >= totalScenes &&
      voiceReadyCount >= totalScenes;
    const status: "draft" | "ready" | "exported" = exported
      ? "exported"
      : assetsReady
        ? "ready"
        : "draft";
    const baseProgress = project?.title || project?.input_prompt ? 15 : 0;
    const planProgress = project?.creator_production_package || totalScenes > 0 ? 20 : 0;
    const visualProgress = totalScenes > 0 ? (visualReadyCount / totalScenes) * 25 : 0;
    const voiceProgress = totalScenes > 0 ? (voiceReadyCount / totalScenes) * 25 : 0;
    const exportProgress = exported ? 15 : 0;
    const progress = exported
      ? 100
      : Math.min(95, Math.round(baseProgress + planProgress + visualProgress + voiceProgress + exportProgress));

    return {
      totalScenes,
      visualReadyCount,
      voiceReadyCount,
      exported,
      status,
      progress,
    };
  };

  const formatCreatorProjectUpdatedAt = (value?: string) => {
    if (!value) {
      return uiLanguage === "en" ? "Not saved yet" : "Henüz kaydedilmedi";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return uiLanguage === "en" ? "Update time unavailable" : "Güncelleme zamanı bulunamadı";
    }

    return date.toLocaleString(uiLanguage === "en" ? "en-US" : "tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProjectFlowLabel = (project: any) => {
    const projectFlowType = project?.flow_type || "storyverse";

    if (projectFlowType === "creator_lab") {
      return "Creator Lab";
    }


    return "Storyverse";
  };

  const formatYoutubeNumber = (value?: number) => {
    const safeValue = Number(value || 0);

    if (safeValue >= 1_000_000) {
      return `${(safeValue / 1_000_000).toFixed(1)}M`;
    }

    if (safeValue >= 1_000) {
      return `${(safeValue / 1_000).toFixed(1)}K`;
    }

    return `${safeValue}`;
  };

  const formatYoutubeDuration = (seconds?: number) => {
    const safeSeconds = Number(seconds || 0);

    if (!safeSeconds) {
      return "-";
    }

    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;

    return `${mins}:${String(secs).padStart(2, "0")}`;
  };


  const getAccessTokenOrThrow = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yap.");
    }

    return session.access_token;
  };


  const fetchUserRole = async () => {
    try {
      setRoleLoading(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();

      if (error || !data?.role) {
        setUserRole("parent");
        return;
      }

      setUserRole(data.role as "parent" | "admin");
    } catch (e) {
      console.error("fetchUserRole error:", e);
      setUserRole("parent");
    } finally {
      setRoleLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);

      const accessToken = await getAccessTokenOrThrow();

      const res = await fetch("/api/projects", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Projeler yüklenemedi.");
      }

      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (e) {
      console.error("fetchProjects error:", e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProjectById = async (projectId: string) => {
    setLoadProjectId(projectId);
    await loadProject(projectId);
  };

  const formatDurationLabel = (seconds?: number) => {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
      return "-";
    }

    if (seconds < 60) {
      return `${seconds.toFixed(1)} ${ui.secondShort}`;
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins} ${ui.minuteShort} ${secs} ${ui.secondShort}`;
  };

  const formatFileSizeLabel = (sizeBytes?: number) => {
    if (!sizeBytes || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return "-";
    }

    const mb = sizeBytes / (1024 * 1024);

    if (mb < 1) {
      const kb = sizeBytes / 1024;
      return `${kb.toFixed(0)} KB`;
    }

    return `${mb.toFixed(2)} MB`;
  };

  const getSceneExportSource = (scene: Scene): "video" | "image" | "none" => {
    if (scene.renderMode === "image") {
      return scene.image ? "image" : "none";
    }

    if (scene.renderMode === "video") {
      return scene.videoUrl && scene.videoStatus === "done" ? "video" : "none";
    }

    if (scene.videoUrl && scene.videoStatus === "done") {
      return "video";
    }

    if (scene.image) {
      return "image";
    }

    return "none";
  };

  const buildFlowContinuityInputScenes = (
    sourceScenes: Scene[] = scenes,
  ): ExportFlowValidationInputScene[] => {
    const timelinePlan = getCreatorActiveTimelinePlan();

    return sourceScenes.map((scene) => {
      const timelineScene = timelinePlan?.scenes?.find(
        (item) => Number(item.id) === Number(scene.id),
      );
      const exportSource = getSceneExportSource(scene);

      return {
        id: scene.id,
        source: exportSource,
        hasNarration: Boolean(scene.narration?.trim()),
        hasDialogue: Boolean(scene.dialogue?.trim()),
        narrationDurationSec: scene.timing?.narrationDuration,
        dialogueDurationSec: scene.timing?.dialogueDuration,
        targetDurationSec:
          scene.timing?.targetSceneDuration ||
          timelineScene?.targetVisualSeconds ||
          TARGET_SCENE_DURATION_SECONDS,
        videoDurationSec: scene.videoDurationSeconds,
        fallbackVideoDurationSec:
          timelineScene?.recommendedClipSeconds ||
          DEFAULT_VIDEO_DURATION_SECONDS,
        visualBlocks: timelineScene?.visualBlocks,
        hasReferenceImage: Boolean(scene.image),
      };
    });
  };

  const buildFlowContinuityAudit = (
    sourceScenes: Scene[] = scenes,
  ): FlowContinuityAuditReport =>
    createFlowContinuityAudit(buildFlowContinuityInputScenes(sourceScenes));

  const buildExportFlowValidation = (
    sourceScenes: Scene[] = scenes,
  ): ExportFlowValidationReport =>
    createExportFlowValidation({
      scenes: buildFlowContinuityInputScenes(sourceScenes),
      maxSceneDurationSec: CREATOR_MAX_SCENE_DURATION_SECONDS,
      speechTailBufferSec: CREATOR_SPEECH_TAIL_BUFFER_SECONDS,
    });

  const approveExportFlow = (sourceScenes: Scene[]) => {
    if (!isCreatorLabFlow) {
      return null;
    }

    const report = buildExportFlowValidation(sourceScenes);

    if (!report.canExport) {
      const sceneList = report.blockingSceneIds.join(", ");
      setError(
        uiLanguage === "en"
          ? `Export blocked: scene(s) ${sceneList} have unresolved critical visual or timing risks.`
          : `Export durduruldu: ${sceneList} numaralı sahnelerde çözülemeyen kritik görsel veya süre riski var.`,
      );
      return undefined;
    }

    if (report.requiresManualConfirmation) {
      const approved = window.confirm(
        uiLanguage === "en"
          ? `${report.reviewSceneIds.length} scene(s) contain unmeasured audio or timing warnings. Safe visual fixes will be applied automatically. Continue with export?`
          : `${report.reviewSceneIds.length} sahnede ölçülmemiş ses veya süre uyarısı var. Güvenli görsel düzeltmeler otomatik uygulanacak. Export'a devam edilsin mi?`,
      );

      if (!approved) {
        setSaveMessage(
          uiLanguage === "en"
            ? "Export cancelled for review."
            : "Kontrol için export iptal edildi.",
        );
        return undefined;
      }
    }

    return report;
  };

  const buildExportSignature = (nextTitle: string, nextScenes: Scene[]) => {
    const exportableScenes = nextScenes
      .filter((scene) => getSceneExportSource(scene) !== "none")
      .map((scene) => {
        const exportSource = getSceneExportSource(scene);

        return {
          id: scene.id,
          renderMode: scene.renderMode || "auto",
          exportSource,
          text: scene.text || "",
          narration: scene.narration || "",
          dialogue: scene.dialogue || "",
          cameraDirection: scene.cameraDirection || "",
          emotion: scene.emotion || "",
          motionHint: scene.motionHint || "",
          image: scene.image || "",
          videoUrl: exportSource === "video" ? scene.videoUrl || "" : "",
          videoStatus: scene.videoStatus || "idle",
          videoDurationSeconds: scene.videoDurationSeconds || 0,
          timing: scene.timing || null,
        };
      });

    return JSON.stringify({
      title: nextTitle || "",
      scenes: exportableScenes,
    });
  };

  const getCurrentExportSignature = () => buildExportSignature(title, scenes);

  const hasReusableExport = () => {
    if (!exportedMovieUrl || !exportSignature) {
      return false;
    }

    return exportSignature === getCurrentExportSignature();
  };

  const handleDownloadVideo = async () => {
    const downloadSource =
      exportMovieResult?.downloadUrl || exportMovieResult?.movieUrl || exportedMovieUrl;

    if (!downloadSource) {
      setError("İndirilecek video bulunamadı.");
      return;
    }

    try {
      setError("");

      const response = await fetch(downloadSource);

      if (!response.ok) {
        throw new Error("Video indirilemedi.");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download =
        exportMovieResult?.fileName ||
        `velto-video-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("download video error:", err);

      setError(
        err?.message ||
          "Video indirilemedi. Linki yeni sekmede açıp manuel indirebilirsin."
      );
    }
  };

  const handleStitchVideo = async () => {
    const stitchSourceScenes = scenes.filter(
      (scene) => scene.videoUrl && scene.videoStatus === "done",
    );

    if (stitchSourceScenes.length < 2) {
      setError("Final video oluşturmak için en az 2 hazır sahne videosu gerekir.");
      return;
    }

    const exportFlowValidation = approveExportFlow(stitchSourceScenes);

    if (isCreatorLabFlow && !exportFlowValidation) {
      return;
    }

    const preparedStitchScenes = exportFlowValidation
      ? applyExportFlowAutoFixes(stitchSourceScenes, exportFlowValidation)
      : stitchSourceScenes;
    const stitchScenes = preparedStitchScenes
      .map((scene) => ({
        id: scene.id,
        videoUrl: scene.videoUrl,
        imageUrl: scene.image,
        audioUrl: scene.audioUrl,
        dialogueAudioUrl: scene.dialogueAudioUrl,
        durationSec: scene.timing?.targetSceneDuration,
        timing: scene.timing,
      }));

    try {
      setIsExportingMovie(true);
      setError("");
      setSaveMessage("");

      const response = await fetch("/api/stitch-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenes: stitchScenes,
          timelineSyncPlan: getCreatorActiveTimelinePlan(),
          exportFlowValidation,
          manualConfirmationGranted:
            exportFlowValidation?.requiresManualConfirmation || false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Final video birleştirilemedi.");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const fileName = `velto-final-video-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.mp4`;

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);

      setSaveMessage("Final video oluşturuldu ve indirildi ✅");
    } catch (err: any) {
      console.error("stitch video error:", err);
      setError(err?.message || "Final video oluşturulamadı.");
    } finally {
      setIsExportingMovie(false);
    }
  };

  const updateSceneTimingData = (sceneId: number, timing: SceneTiming) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              timing,
            }
          : scene
      )
    );
  };

  const getCreatorPlannedSceneDuration = (scene?: Scene) => {
    const timelinePlan =
      creatorProductionPackage?.timelineSyncPlan || creatorTimelinePreviewPlan;
    const timelineScene = timelinePlan?.scenes?.find(
      (item) => Number(item.id) === Number(scene?.id),
    );
    const fallbackSceneCount = Math.max(
      1,
      scenes.length || getCreatorSceneCountByDuration(creatorVideoDurationSec),
    );

    return Math.min(
      CREATOR_MAX_SCENE_DURATION_SECONDS,
      Math.max(
        CREATOR_MIN_SCENE_DURATION_SECONDS,
        Number(
          timelineScene?.durationMatch?.plannedDurationSec ||
            timelineScene?.targetVisualSeconds ||
            scene?.timing?.plannedSceneDuration ||
            creatorVideoDurationSec / fallbackSceneCount,
        ),
      ),
    );
  };

  const buildSceneTimingForCurrentFlow = (
    narrationDuration: number,
    dialogueDuration: number,
    scene?: Scene,
  ) =>
    buildSceneTiming(narrationDuration, dialogueDuration, {
      audioFirst: isCreatorLabFlow,
      plannedDuration: isCreatorLabFlow
        ? getCreatorPlannedSceneDuration(scene)
        : undefined,
    });

  const clearSceneTimingData = (sceneId: number) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              timing: buildSceneTimingForCurrentFlow(0, 0, scene),
            }
          : scene
      )
    );
  };

  const clearAllSceneTimingData = () => {
    setScenes((prev) =>
      prev.map((scene) => ({
        ...scene,
        timing: buildSceneTimingForCurrentFlow(0, 0, scene),
      }))
    );
  };

  const refreshSceneTiming = async (
    sceneId: number,
    overrides?: {
      audioUrl?: string;
      dialogueAudioUrl?: string;
    }
  ) => {
    const currentScene = scenes.find((scene) => scene.id === sceneId);

    const narrationUrl = overrides?.audioUrl ?? currentScene?.audioUrl;
    const dialogueUrl = overrides?.dialogueAudioUrl ?? currentScene?.dialogueAudioUrl;

    const [narrationDuration, dialogueDuration] = await Promise.all([
      getAudioDurationFromUrl(narrationUrl),
      getAudioDurationFromUrl(dialogueUrl),
    ]);

    const timing = buildSceneTimingForCurrentFlow(
      narrationDuration,
      dialogueDuration,
      currentScene,
    );

    updateSceneTimingData(sceneId, timing);

    return timing;
  };

  const clearVideoPollForScene = (sceneId: number) => {
    const existing = videoPollIntervalsRef.current[sceneId];
    if (existing) {
      clearInterval(existing);
      delete videoPollIntervalsRef.current[sceneId];
    }
  };

  const clearAllVideoPolls = () => {
    Object.values(videoPollIntervalsRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    videoPollIntervalsRef.current = {};
  };

  const getCreatorNarratorProfileHint = () => {
    const narratorProfile = characters.find((character) =>
      /(narrator|anlatıcı|brand voice|marka sesi|host|sunucu|presenter|persona)/i.test(
        `${character.name} ${character.personality} ${character.appearance}`,
      ),
    );

    if (narratorProfile) {
      return [
        narratorProfile.name,
        narratorProfile.personality,
        narratorProfile.appearance,
      ]
        .filter(Boolean)
        .join(" ");
    }

    return narratorSettings.voiceId ? "brand voice" : "faceless narrator";
  };

  const getCreatorSceneVoiceContext = ({
    scene,
    role,
    text,
    companionText,
    hasExplicitVoiceId,
    voiceProfile,
  }: {
    scene: Scene;
    role: "narrator" | "dialogue";
    text: string;
    companionText?: string;
    hasExplicitVoiceId: boolean;
    voiceProfile: string;
  }) => {
    if (!isCreatorLabFlow) {
      return null;
    }

    const timelineScene = getCreatorActiveTimelinePlan()?.scenes?.find(
      (item) => Number(item.id) === Number(scene.id),
    );
    const fallbackSceneCount = Math.max(1, scenes.length || getCreatorSceneCount());
    const targetSceneDurationSec =
      timelineScene?.targetVisualSeconds ||
      scene.timing?.plannedSceneDuration ||
      scene.timing?.targetSceneDuration ||
      Math.max(3, creatorVideoDurationSec / fallbackSceneCount);
    const sceneIndex = Math.max(
      0,
      scenes.findIndex((item) => item.id === scene.id),
    );

    return getCreatorVoiceRoute({
      qualityMode: creatorQualityMode,
      format: creatorFormat,
      role,
      language,
      text,
      companionText,
      targetSceneDurationSec,
      sceneIndex,
      sceneCount: fallbackSceneCount,
      voiceProfile,
      hasExplicitVoiceId,
    });
  };

  const getNarratorSettingsKey = (
    settings: NarratorSettings,
    routeKey = "",
    voiceIdentityKey = "",
  ) => {
    return [
      settings.voiceId || "",
      settings.modelId,
      settings.stability,
      settings.similarityBoost,
      settings.style ?? "",
      settings.speed ?? "",
      routeKey,
      voiceIdentityKey,
    ].join("-");
  };

  const getSceneAudioStatus = (scene: Scene) => {
    const voiceRoute = getCreatorSceneVoiceContext({
      scene,
      role: "narrator",
      text: scene.narration,
      companionText: scene.dialogue,
      hasExplicitVoiceId: Boolean(narratorSettings.voiceId),
      voiceProfile: getCreatorNarratorProfileHint(),
    });
    const currentSettingsKey = getNarratorSettingsKey(
      narratorSettings,
      voiceRoute?.routeKey,
    );

    return !!(
      scene.audioUrl &&
      scene.audioSourceText &&
      scene.audioSourceText === scene.narration &&
      scene.audioSettingsKey === currentSettingsKey
    );
  };

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setPlayingSceneId(null);
  };

  const stopDialoguePlayback = () => {
    dialoguePlaybackTokenRef.current += 1;
    setPlayingDialogueSceneId(null);
    setLoadingDialogueSceneId(null);
    stopCurrentAudio();
  };

  const stopStoryPlayback = () => {
    storyPlaybackTokenRef.current += 1;
    setIsPlayingStory(false);
    stopCurrentAudio();
  };

  const clearAllSceneAudioData = () => {
    setScenes((prev) =>
      prev.map((scene) => ({
        ...scene,
        audioUrl: "",
        audioPath: "",
        audioSourceText: "",
        audioSettingsKey: "",
        timing: buildSceneTimingForCurrentFlow(
          0,
          scene.timing?.dialogueDuration || 0,
          scene,
        ),
      }))
    );
  };

  const clearSceneDialogueAudioData = (sceneId: number) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              dialogueAudioUrl: "",
              dialogueAudioPath: "",
              dialogueAudioSourceText: "",
              dialogueAudioSettingsKey: "",
              timing: buildSceneTimingForCurrentFlow(
                scene.timing?.narrationDuration || 0,
                0,
                scene,
              ),
            }
          : scene
      )
    );
  };

  const clearAllSceneDialogueAudioData = () => {
    setScenes((prev) =>
      prev.map((scene) => ({
        ...scene,
        dialogueAudioUrl: "",
        dialogueAudioPath: "",
        dialogueAudioSourceText: "",
        dialogueAudioSettingsKey: "",
        timing: buildSceneTimingForCurrentFlow(
          scene.timing?.narrationDuration || 0,
          0,
          scene,
        ),
      }))
    );
  };

  const resetStoryFlow = () => {
    clearAllVideoPolls();
    stopDialoguePlayback();
    stopStoryPlayback();
    setStorySetup(null);
    setCreatorMentorResult(null);
    setCreatorProductionPackage(null);
    setIsGeneratingFullYoutubePackage(false);
    setIsAdvancedMode(false);
    setBulkResults([]);
    setSelectedBulkIds([]);
    setYoutubeResearchVideos([]);
    setYoutubePatternSummary(null);
    setYoutubeMetadataResult(null);
    setYoutubeThumbnailResult(null);
    setSceneOptimizationResult([]);
    setSceneOptimizationSummary(null);
    setRefinedCreatorScenes([]);
    setTitle("");
    setCharacters([]);
    setVisualBible(null);
    setScenes([]);
    setContinuePrompt("");
    setEditingSceneId(null);
    setSceneInstructions({});
    setBranchingSceneId(null);
    setBranchInstructions({});
    setRedrawLoadingId(null);
    setSaveMessage("");
    setCurrentProjectId("");
    setLoadProjectId("");
    setIsBatchRendering(false);
    setBatchRenderItems([]);
    setBatchRenderStartedAt("");
    batchRenderCancelRef.current = false;
    setLoadingAudioSceneId(null);
    setLoadingDialogueSceneId(null);
    setIsPreparingAudio(false);
    setIsExportingMovie(false);
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setShareUrl("");
    setShareCopied(false);
    setNarratorSettings(defaultNarratorSettings);
    draftProjectKeyRef.current = `draft-${crypto.randomUUID()}`;
  };

  const getProjectKey = () => {
    return currentProjectId || draftProjectKeyRef.current;
  };

  const limitForImagePrompt = (value: unknown, maxLength = 900) => {
    const textValue = String(value || "")
      .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (textValue.length <= maxLength) {
      return textValue;
    }

    return `${textValue.slice(0, maxLength)}...`;
  };

  const getSafeCharactersForImagePrompt = (sceneText = "") => {
    const normalizedSceneText = sceneText.toLocaleLowerCase("en-US");
    const prioritizedCharacters = [...characters].sort((left, right) => {
      const leftName = left.name.trim().toLocaleLowerCase("en-US");
      const rightName = right.name.trim().toLocaleLowerCase("en-US");
      const leftMentioned = Boolean(
        leftName && normalizedSceneText.includes(leftName),
      );
      const rightMentioned = Boolean(
        rightName && normalizedSceneText.includes(rightName),
      );

      return Number(rightMentioned) - Number(leftMentioned);
    });

    return prioritizedCharacters.slice(0, 12).map((character) => ({
      name: limitForImagePrompt(character.name, 80),
      age: limitForImagePrompt(character.age, 40),
      appearance: limitForImagePrompt(character.appearance, 500),
      outfit: limitForImagePrompt(character.outfit, 300),
      accessory: limitForImagePrompt(character.accessory, 250),
      personality: limitForImagePrompt(character.personality, 300),
      referenceImage: character.referenceImage?.startsWith("http")
        ? character.referenceImage
        : "",
    }));
  };

  const getSafeVisualBibleForImagePrompt = () => {
    return {
      style: limitForImagePrompt(visualBible?.style, 600),
      palette: limitForImagePrompt(visualBible?.palette, 500),
      camera: limitForImagePrompt(visualBible?.camera, 500),
      consistencyRules: limitForImagePrompt(visualBible?.consistencyRules, 700),
    };
  };

  const getSafeSceneForImagePrompt = (
    scene: Pick<Scene, "id" | "text" | "cameraDirection" | "emotion" | "motionHint">
  ) => {
    return {
      id: scene.id,
      text: limitForImagePrompt(scene.text, 900),
      cameraDirection: limitForImagePrompt(scene.cameraDirection, 500),
      emotion: limitForImagePrompt(scene.emotion, 180),
      motionHint: limitForImagePrompt(scene.motionHint, 600),
    };
  };

  const getSafeCreatorContinuityContext = (sceneId: number) => {
    const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);

    if (sceneIndex < 0) {
      return {
        sceneId,
        sceneCount: scenes.length || 1,
        previousScene: null,
        nextScene: null,
      };
    }

    const toContinuityScene = (scene?: Scene) =>
      scene
        ? {
            text: limitForImagePrompt(scene.text, 500),
            cameraDirection: limitForImagePrompt(scene.cameraDirection, 240),
            emotion: limitForImagePrompt(scene.emotion, 120),
            motionHint: limitForImagePrompt(scene.motionHint, 240),
          }
        : null;

    return {
      sceneId,
      sceneCount: scenes.length,
      previousScene: toContinuityScene(scenes[sceneIndex - 1]),
      nextScene: toContinuityScene(scenes[sceneIndex + 1]),
    };
  };

  const generateSceneImage = async (
    scene: Pick<Scene, "id" | "text" | "cameraDirection" | "emotion" | "motionHint">,
    options?: {
      isHookScene?: boolean;
      isThumbnail?: boolean;
      premiumVisualMode?: boolean;
      imageUseCase?: "scene" | "thumbnail" | "hook";
    }
  ) => {
    if (!canRunCreatorMediaAction("visuals")) {
      throw new Error(getCreatorMediaActionError());
    }

    const safeScene = getSafeSceneForImagePrompt(scene);
    const isHookScene = Boolean(options?.isHookScene || scene.id === 1);
    const isThumbnail = Boolean(options?.isThumbnail);
    const premiumVisualMode = Boolean(
      options?.premiumVisualMode || isHookScene || isThumbnail
    );
    const imageUseCase =
      options?.imageUseCase || (isThumbnail ? "thumbnail" : isHookScene ? "hook" : "scene");

    const imageRes = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productProfile: isCreatorLabFlow ? "creatorlab" : "storyverse",
        qualityMode: isCreatorLabFlow ? creatorQualityMode : "standard",
        creatorFormat: isCreatorLabFlow ? creatorFormat : undefined,
        title: limitForImagePrompt(title, 160),
        sceneText: safeScene.text,
        cameraDirection: safeScene.cameraDirection,
        emotion: safeScene.emotion,
        motionHint: safeScene.motionHint,
        characters: getSafeCharactersForImagePrompt(safeScene.text),
        visualBible: getSafeVisualBibleForImagePrompt(),
        isHookScene,
        isThumbnail,
        premiumVisualMode,
        imageUseCase,
        continuityContext: isCreatorLabFlow
          ? getSafeCreatorContinuityContext(scene.id)
          : undefined,
      }),
    });

    const imageData = await imageRes.json();

    if (!imageRes.ok) {
      throw new Error(imageData.error || "Görsel üretilemedi.");
    }

    const rawImage = imageData.image as string;

    const storeRes = await fetch("/api/store-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: rawImage,
        sceneId: scene.id,
        projectId: getProjectKey(),
      }),
    });

    const storeData = await storeRes.json();

    if (!storeRes.ok || !storeData.ok || !storeData.imageUrl) {
      throw new Error(storeData?.error || "Görsel kalıcı olarak kaydedilemedi.");
    }

    return storeData.imageUrl as string;
  };

  const updateSceneAudioData = (
    sceneId: number,
    audioUrl: string,
    audioPath: string,
    audioSourceText: string,
    audioSettingsKey: string,
  ) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              audioUrl,
              audioPath,
              audioSourceText,
              audioSettingsKey,
            }
          : scene
      )
    );
  };

  const clearSceneAudioData = (sceneId: number) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              audioUrl: "",
              audioPath: "",
              audioSourceText: "",
              audioSettingsKey: "",
              timing: buildSceneTimingForCurrentFlow(
                0,
                scene.timing?.dialogueDuration || 0,
                scene,
              ),
            }
          : scene
      )
    );
  };

  const getSceneAudioUrl = async (scene: Scene) => {
    const voiceProfile = getCreatorNarratorProfileHint();
    const voiceRoute = getCreatorSceneVoiceContext({
      scene,
      role: "narrator",
      text: scene.narration,
      companionText: scene.dialogue,
      hasExplicitVoiceId: Boolean(narratorSettings.voiceId),
      voiceProfile,
    });
    const currentSettingsKey = getNarratorSettingsKey(
      narratorSettings,
      voiceRoute?.routeKey,
    );

    if (
      scene.audioUrl &&
      scene.audioSourceText &&
      scene.audioSourceText === scene.narration &&
      scene.audioSettingsKey === currentSettingsKey
    ) {
      return scene.audioUrl;
    }

    if (!canRunCreatorMediaAction("voice_over")) {
      throw new Error(getCreatorMediaActionError("voice_over"));
    }

    if (voiceRoute && !voiceRoute.canGenerate) {
      throw new Error(
        uiLanguage === "en"
          ? voiceRoute.warning
          : "Anlatım bu sahnenin güvenli süresini aşıyor. Ses üretmeden önce metni kısalt veya sahneyi böl.",
      );
    }

    const res = await fetch("/api/store-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: scene.narration,
        sceneId: scene.id,
        projectKey: getProjectKey(),
        narratorSettings,
        language,
        productProfile: isCreatorLabFlow ? "creatorlab" : "storyverse",
        qualityMode: creatorQualityMode,
        creatorFormat,
        targetSceneDurationSec: voiceRoute?.targetSceneDurationSec,
        sceneIndex: scenes.findIndex((item) => item.id === scene.id),
        sceneCount: scenes.length,
        voiceProfile,
        companionText: scene.dialogue,
        clientSettingsKey: currentSettingsKey,
      }),
    });

    const responseText = await res.text();
    let data: any = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = { raw: responseText };
    }

    if (!res.ok) {
      console.error("store-audio response error:", data);
      throw new Error(
        data?.details ||
          data?.detail ||
          data?.error ||
          data?.raw ||
          "Ses üretilemedi."
      );
    }

    updateSceneAudioData(
      scene.id,
      data.audioUrl,
      data.audioPath,
      data.audioSourceText,
      data.settingsKey || currentSettingsKey,
    );

    const refreshedTiming = await refreshSceneTiming(scene.id, {
      audioUrl: data.audioUrl,
      dialogueAudioUrl: scene.dialogueAudioUrl,
    });

    if (data?.voiceRoute?.warning) {
      setSaveMessage(
        uiLanguage === "en"
          ? `Narration generated. ${data.voiceRoute.warning}`
          : refreshedTiming?.splitRecommended
            ? `Anlatım üretildi. Gerçek ses süresine göre bu sahnenin ${refreshedTiming.recommendedSplitCount || 2} parçaya bölünmesi öneriliyor.`
            : "Anlatım üretildi. Gerçek ses süresi timeline'a uygulandı.",
      );
    }

    return data.audioUrl as string;
  };

  const normalizeName = (value: string) =>
    value
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();

  const parseDialogueLines = (dialogue: string): ParsedDialogueLine[] => {
    if (!dialogue?.trim()) {
      return [];
    }

    const cleanedDialogue = dialogue.trim();

    const characterMap = new Map(
      characters.map((character) => [normalizeName(character.name), character])
    );

    const result: ParsedDialogueLine[] = [];

    for (const rawLine of cleanedDialogue.split("\n")) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      const match = line.match(/^([^:\-–—]+)\s*[:\-–—]\s*(.+)$/);

      if (!match) {
        continue;
      }

      const speaker = match[1].trim();
      const text = match[2].trim().replace(/^["'“”]+|["'“”]+$/g, "");

      if (!text) {
        continue;
      }

      const character = characterMap.get(normalizeName(speaker));

      result.push({
        speaker,
        text,
        voiceId: character?.voiceId || "",
      });
    }

    if (result.length > 0) {
      return result;
    }

    const quoteMatches = Array.from(cleanedDialogue.matchAll(/["“](.+?)["”]/g));

    if (quoteMatches.length > 0) {
      const fallbackCharacter = characters[0];

      for (const match of quoteMatches) {
        const text = (match[1] || "").trim();

        if (!text) {
          continue;
        }

        result.push({
          speaker: fallbackCharacter?.name || "Karakter",
          text,
          voiceId: fallbackCharacter?.voiceId || "",
        });
      }

      if (result.length > 0) {
        return result;
      }
    }

    const fallbackCharacter = characters[0];

    return [
      {
        speaker: fallbackCharacter?.name || "Karakter",
        text: cleanedDialogue.replace(/^["'“”]+|["'“”]+$/g, ""),
        voiceId: fallbackCharacter?.voiceId || "",
      },
    ];
  };

  const getSceneDialogueUrl = async (scene: Scene) => {
    const lines = parseDialogueLines(scene.dialogue);

    if (lines.length === 0) {
      throw new Error("Bu sahnede diyalog üretilecek içerik bulunamadı.");
    }

    const voiceIdentityKey = lines
      .map((line) => `${line.speaker}:${line.voiceId || "fallback"}`)
      .join("|");
    const voiceRoute = getCreatorSceneVoiceContext({
      scene,
      role: "dialogue",
      text: lines.map((line) => line.text).join(" "),
      companionText: scene.narration,
      hasExplicitVoiceId: lines.some((line) => Boolean(line.voiceId)),
      voiceProfile: voiceIdentityKey,
    });
    const currentSettingsKey = getNarratorSettingsKey(
      narratorSettings,
      voiceRoute?.routeKey,
      voiceIdentityKey,
    );

    if (
      scene.dialogueAudioUrl &&
      scene.dialogueAudioSourceText &&
      scene.dialogueAudioSourceText === scene.dialogue &&
      scene.dialogueAudioSettingsKey === currentSettingsKey
    ) {
      return scene.dialogueAudioUrl;
    }

    if (!canRunCreatorMediaAction("voice_over")) {
      throw new Error(getCreatorMediaActionError("voice_over"));
    }

    if (voiceRoute && !voiceRoute.canGenerate) {
      throw new Error(
        uiLanguage === "en"
          ? voiceRoute.warning
          : "Diyalog bu sahnenin güvenli süresini aşıyor. Ses üretmeden önce metni kısalt veya sahneyi böl.",
      );
    }

    const res = await fetch("/api/store-dialogue-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lines,
        sceneId: scene.id,
        projectKey: getProjectKey(),
        sourceText: scene.dialogue,
        modelId: narratorSettings.modelId,
        stability: narratorSettings.stability,
        similarityBoost: narratorSettings.similarityBoost,
        style: narratorSettings.style,
        speed: narratorSettings.speed,
        language,
        productProfile: isCreatorLabFlow ? "creatorlab" : "storyverse",
        qualityMode: creatorQualityMode,
        creatorFormat,
        targetSceneDurationSec: voiceRoute?.targetSceneDurationSec,
        sceneIndex: scenes.findIndex((item) => item.id === scene.id),
        sceneCount: scenes.length,
        voiceProfile: voiceIdentityKey,
        companionText: scene.narration,
        clientSettingsKey: currentSettingsKey,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok || !data.audioUrl) {
      throw new Error(data?.error || "Diyalog sesi üretilemedi.");
    }

    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              dialogueAudioUrl: data.audioUrl,
              dialogueAudioPath: data.audioPath || "",
              dialogueAudioSourceText: data.sourceText || scene.dialogue,
              dialogueAudioSettingsKey: data.settingsKey || currentSettingsKey,
            }
          : item
      )
    );

    const refreshedTiming = await refreshSceneTiming(scene.id, {
      audioUrl: scene.audioUrl,
      dialogueAudioUrl: data.audioUrl,
    });

    if (data?.voiceRoute?.warning) {
      setSaveMessage(
        uiLanguage === "en"
          ? `Dialogue generated. ${data.voiceRoute.warning}`
          : refreshedTiming?.splitRecommended
            ? `Diyalog üretildi. Gerçek ses süresine göre bu sahnenin ${refreshedTiming.recommendedSplitCount || 2} parçaya bölünmesi öneriliyor.`
            : "Diyalog üretildi. Gerçek ses süresi timeline'a uygulandı.",
      );
    }

    return data.audioUrl as string;
  };

  const playAudioFromUrl = async (sceneId: number, audioUrl: string) => {
    stopDialoguePlayback();
    stopCurrentAudio();

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onplay = () => {
      setPlayingSceneId(sceneId);
    };

    audio.onended = () => {
      stopCurrentAudio();
    };

    audio.onerror = () => {
      stopCurrentAudio();
      setError("Ses oynatılırken bir hata oluştu.");
    };

    await audio.play();
  };

  const waitForAudioToFinish = async (
    sceneId: number,
    audioUrl: string,
    playbackToken: number
  ) => {
    return new Promise<void>((resolve, reject) => {
      if (playbackToken !== storyPlaybackTokenRef.current) {
        resolve();
        return;
      }

      stopCurrentAudio();

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingSceneId(sceneId);
      };

      audio.onended = () => {
        if (playbackToken === storyPlaybackTokenRef.current) {
          setPlayingSceneId(null);
        }
        audioRef.current = null;
        resolve();
      };

      audio.onerror = () => {
        if (playbackToken === storyPlaybackTokenRef.current) {
          setPlayingSceneId(null);
        }
        audioRef.current = null;
        reject(new Error("Ses oynatılırken bir hata oluştu."));
      };

      audio.play().catch((err) => {
        reject(err);
      });
    });
  };

  const playSceneDialogue = async (scene: Scene) => {
    if (!scene.dialogue?.trim()) {
      setError("Bu sahnede oynatılacak diyalog yok.");
      return;
    }

    if (playingDialogueSceneId === scene.id && audioRef.current) {
      stopDialoguePlayback();
      return;
    }

    setError("");
    setSaveMessage("");

    try {
      if (isPlayingStory) {
        stopStoryPlayback();
      }

      stopCurrentAudio();
      setLoadingDialogueSceneId(scene.id);

      const audioUrl = await getSceneDialogueUrl(scene);

      stopCurrentAudio();

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingDialogueSceneId(scene.id);
      };

      audio.onended = () => {
        setPlayingDialogueSceneId(null);
        stopCurrentAudio();
      };

      audio.onerror = () => {
        setPlayingDialogueSceneId(null);
        stopCurrentAudio();
        setError("Diyalog sesi oynatılırken bir hata oluştu.");
      };

      await audio.play();
    } catch (e: any) {
      console.error("playSceneDialogue error:", e);
      stopDialoguePlayback();
      setError(e?.message || "Diyalog oynatılırken bir hata oluştu.");
    } finally {
      setLoadingDialogueSceneId(null);
    }
  };

  const pollVideoStatus = (sceneId: number, taskId: string) => {
    clearVideoPollForScene(sceneId);

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/video?taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data?.error || "Video durumu alınamadı.");
        }

        const status = String(data.status || "").toUpperCase();

        if (status === "SUCCEEDED") {
          clearVideoPollForScene(sceneId);

          if (!data.videoUrl) {
            throw new Error("AI video çıktısı alınamadı.");
          }

          const storeRes = await fetch("/api/store-video", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              videoUrl: data.videoUrl,
              sceneId,
              projectId: getProjectKey(),
            }),
          });

          const storeData = await storeRes.json();

          if (!storeRes.ok || !storeData.ok || !storeData.videoUrl) {
            throw new Error(storeData?.error || "Video kaydedilemedi");
          }

          setScenes((prev) =>
            prev.map((scene) =>
              scene.id === sceneId
                ? {
                    ...scene,
                    videoStatus: "done",
                    videoUrl: storeData.videoUrl,
                    videoJobId: taskId,
                  }
                : scene
            )
          );

          setSaveMessage(ui.videoReadySaved);
          return;
        }

        if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
          clearVideoPollForScene(sceneId);

          setScenes((prev) =>
            prev.map((scene) =>
              scene.id === sceneId
                ? {
                    ...scene,
                    videoStatus: "error",
                    videoJobId: taskId,
                  }
                : scene
            )
          );

          setError(data.failureMessage || `Video oluşturulamadı. Status: ${status}`);
          return;
        }
      } catch (e: any) {
        console.error("pollVideoStatus error:", e);
        clearVideoPollForScene(sceneId);

        setScenes((prev) =>
          prev.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  videoStatus: "error",
                }
              : scene
          )
        );

        setError(e?.message || "Video durumu kontrol edilirken hata oluştu.");
      }
    }, 5000);

    videoPollIntervalsRef.current[sceneId] = intervalId;
  };

  const getCreatorCinematicVideoInputs = (scene: Scene) => {
    if (!isCreatorLabFlow || creatorQualityMode !== "cinematic") {
      return {};
    }

    const sceneIndex = scenes.findIndex((item) => item.id === scene.id);
    const lastFrameUrl = sceneIndex >= 0
      ? scenes[sceneIndex + 1]?.image
      : undefined;
    const referenceImageUrls = Array.from(
      new Set(
        characters
          .map((character) => character.referenceImage?.trim())
          .filter((url): url is string => Boolean(url)),
      ),
    ).slice(0, 3);

    return {
      lastFrameUrl,
      referenceImageUrls,
    };
  };

  const handleGenerateVideo = async (sceneId: number) => {
    const scene = scenes.find((s) => s.id === sceneId);

    if (!scene) {
      setError("Sahne bulunamadı.");
      return;
    }

    if (!canRunCreatorMediaAction("ai_video_blocks")) {
      return;
    }

    if (!scene.image) {
      setError("Önce sahne görseli hazır olmalı.");
      return;
    }

    clearVideoPollForScene(sceneId);
    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");

    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              videoStatus: "processing",
              videoUrl: "",
              videoDurationSeconds: 0,
            }
          : s
      )
    );

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productProfile: isCreatorLabFlow ? "creatorlab" : "storyverse",
          qualityMode: isCreatorLabFlow ? creatorQualityMode : "standard",
          creatorFormat: isCreatorLabFlow ? creatorFormat : undefined,
          imageUrl: scene.image,
          text: scene.text,
          motionHint: scene.motionHint,
          cameraDirection: scene.cameraDirection,
          emotion: scene.emotion,
          duration: scene.timing?.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS,
          ...getCreatorCinematicVideoInputs(scene),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Video oluşturma başlatılamadı.");
      }

      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                videoJobId: data.taskId,
                videoStatus: "processing",
                videoDurationSeconds: Number(data.duration) || 0,
              }
            : s
        )
      );

      pollVideoStatus(sceneId, data.taskId);
    } catch (e: any) {
      console.error("handleGenerateVideo error:", e);

      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                videoStatus: "error",
              }
            : s
        )
      );

      setError(e?.message || "Video oluşturulurken bir hata oluştu.");
    }
  };

  const persistProjectSnapshot = async (snapshotScenes: Scene[]) => {
    if (!title || snapshotScenes.length === 0) {
      return;
    }

    if (!selectedChildId && !isCreatorLabFlow) {
      throw new Error("Lütfen önce bir çocuk seç.");
    }

    const accessToken = await getAccessTokenOrThrow();

    const res = await fetch("/api/save-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        projectId: currentProjectId || undefined,
        childId: getProjectChildId(),
        title,
        inputPrompt: input,
        flowKey: activeFlowKey,
        flowTitle: selectedFlow.title,
        flowType: activeFlowKey || "storyverse",
        language,
        storyPremise: storySetup?.storyPremise || "",
        characters,
        visualBible,
        scenes: snapshotScenes,
        creatorProductionPackage,
        youtubeMetadataResult,
        youtubeThumbnailResult,
        sceneOptimizationResult,
        sceneOptimizationSummary,
        exportedMovieUrl: null,
        exportedMovieResult: null,
        exportSignature: null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Kaydedilemedi.");
    }

    if (data?.project?.id) {
      setCurrentProjectId(data.project.id);
      setLoadProjectId(data.project.id);
    }
  };

  const waitForRunwayVideoAndStore = async (scene: Scene, taskId: string) => {
    const maxAttempts = 72; // 72 x 5 sec = max 6 minutes per scene
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (batchRenderCancelRef.current) {
        throw new Error("Batch render durduruldu.");
      }

      const res = await fetch(`/api/video?taskId=${encodeURIComponent(taskId)}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Video durumu alınamadı.");
      }

      const status = String(data.status || "").toUpperCase();

      if (status === "SUCCEEDED") {
        if (!data.videoUrl) {
          throw new Error("AI video çıktısı alınamadı.");
        }

        const storeRes = await fetch("/api/store-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            videoUrl: data.videoUrl,
            sceneId: scene.id,
            projectId: getProjectKey(),
          }),
        });

        const storeData = await storeRes.json();

        if (!storeRes.ok || !storeData.ok || !storeData.videoUrl) {
          throw new Error(storeData?.error || "Video kaydedilemedi.");
        }

        return storeData.videoUrl as string;
      }

      if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
        throw new Error(data.failureMessage || `Video oluşturulamadı. Status: ${status}`);
      }

      await wait(5000);
    }

    throw new Error("Video üretimi zaman aşımına uğradı.");
  };

  const generateSceneVideoAndWait = async (scene: Scene) => {
    if (!scene.image) {
      throw new Error("Video için önce sahne görseli hazırlanmalı.");
    }

    if (!canRunCreatorMediaAction("ai_video_blocks")) {
      throw new Error(getCreatorMediaActionError("ai_video_blocks"));
    }

    clearVideoPollForScene(scene.id);

    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              videoStatus: "processing",
              videoUrl: "",
            }
          : item
      )
    );

    const res = await fetch("/api/video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productProfile: isCreatorLabFlow ? "creatorlab" : "storyverse",
        qualityMode: isCreatorLabFlow ? creatorQualityMode : "standard",
        creatorFormat: isCreatorLabFlow ? creatorFormat : undefined,
        imageUrl: scene.image,
        text: scene.text,
        motionHint: scene.motionHint,
        cameraDirection: scene.cameraDirection,
        emotion: scene.emotion,
        duration: scene.timing?.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS,
        ...getCreatorCinematicVideoInputs(scene),
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok || !data.taskId) {
      throw new Error(data?.error || "Video oluşturma başlatılamadı.");
    }

    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              videoJobId: data.taskId,
              videoStatus: "processing",
              videoDurationSeconds: Number(data.duration) || 0,
            }
          : item
      )
    );

    const videoUrl = await waitForRunwayVideoAndStore(scene, data.taskId);

    setScenes((prev) =>
      prev.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              videoStatus: "done",
              videoUrl,
              videoJobId: data.taskId,
              videoDurationSeconds: Number(data.duration) || 0,
            }
          : item
      )
    );

    return {
      videoUrl,
      videoJobId: data.taskId as string,
      videoDurationSeconds: Number(data.duration) || 0,
    };
  };

  const stopBatchRender = () => {
    batchRenderCancelRef.current = true;
    setIsBatchRendering(false);
    setSaveMessage(uiLanguage === "en" ? "Batch render stop requested." : "Batch render durdurma isteği alındı.");
  };

  const generateAllSceneVisuals = async () => {
    if (scenes.length === 0) {
      setError(uiLanguage === "en" ? "Create the production stage first." : "Önce production stage oluşturmalısın.");
      return;
    }

    if (!selectedChildId && !isCreatorLabFlow) {
      setError("Lütfen önce bir çocuk seç.");
      return;
    }

    if (!canRunCreatorMediaAction("visuals")) {
      return;
    }

    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setIsBatchRendering(true);
    setBatchRenderStartedAt(new Date().toISOString());
    batchRenderCancelRef.current = false;
    suspendAutosaveRef.current = true;
    resetBatchRenderItems(scenes);

    const workingScenes: Scene[] = scenes.map((scene) => ({ ...scene }));
    let hasFailure = false;

    try {
      for (let index = 0; index < workingScenes.length; index += 1) {
        if (batchRenderCancelRef.current) {
          break;
        }

        let scene = workingScenes[index];

        updateBatchRenderItem(scene.id, {
          status: "processing",
          step: "image",
          message: uiLanguage === "en" ? "Generating visual..." : "Görsel üretiliyor...",
        });

        try {
          let nextImage = scene.image || "";

          if (!nextImage) {
            setRedrawLoadingId(scene.id);
            nextImage = await generateSceneImage(scene);
            scene = {
              ...scene,
              image: nextImage,
              videoUrl: "",
              videoStatus: "idle",
              videoJobId: "",
            };
            workingScenes[index] = scene;

            setScenes((prev) =>
              prev.map((item) => (item.id === scene.id ? scene : item))
            );
          }

          updateBatchRenderItem(scene.id, {
            status: "done",
            step: "image",
            message: uiLanguage === "en" ? "Visual ready." : "Görsel hazır.",
          });
        } catch (sceneError: any) {
          hasFailure = true;
          console.error("visual generation error:", scene.id, sceneError);

          updateBatchRenderItem(scene.id, {
            status: "failed",
            step: "image",
            message: sceneError?.message || (uiLanguage === "en" ? "Visual generation failed." : "Görsel üretimi başarısız oldu."),
          });
        } finally {
          setRedrawLoadingId(null);
        }
      }

      setScenes([...workingScenes]);

      try {
        await persistProjectSnapshot([...workingScenes]);
      } catch (persistError) {
        console.error("visual generation persist error:", persistError);
      }

      if (batchRenderCancelRef.current) {
        setSaveMessage(uiLanguage === "en" ? "Visual generation stopped." : "Görsel üretimi durduruldu.");
      } else if (hasFailure) {
        setError(uiLanguage === "en" ? "Some visuals could not be generated." : "Bazı görseller üretilemedi.");
      } else {
        setSaveMessage(uiLanguage === "en" ? "Visuals generated." : "Görseller üretildi.");
      }
    } finally {
      suspendAutosaveRef.current = false;
      setIsBatchRendering(false);
      setRedrawLoadingId(null);
    }
  };

  const generateAllAiVideoBlocks = async () => {
    if (scenes.length === 0) {
      setError(uiLanguage === "en" ? "Create the production stage first." : "Önce production stage oluşturmalısın.");
      return;
    }

    if (!selectedChildId && !isCreatorLabFlow) {
      setError("Lütfen önce bir çocuk seç.");
      return;
    }

    if (!canRunCreatorMediaAction("ai_video_blocks")) {
      return;
    }

    if (scenes.some((scene) => !scene.image)) {
      setError(
        uiLanguage === "en"
          ? "Generate visuals before creating AI video blocks."
          : "AI video block üretmeden önce görselleri üretmelisin."
      );
      return;
    }

    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setIsBatchRendering(true);
    setBatchRenderStartedAt(new Date().toISOString());
    batchRenderCancelRef.current = false;
    suspendAutosaveRef.current = true;
    resetBatchRenderItems(scenes);

    const workingScenes: Scene[] = scenes.map((scene) => ({ ...scene }));
    const routedVideoSceneIds = isCreatorLabFlow
      ? getCreatorRoutedVideoSceneIds(workingScenes)
      : workingScenes.map((scene) => scene.id);
    const routedVideoSceneIdSet = new Set(routedVideoSceneIds);
    let hasFailure = false;

    try {
      for (let index = 0; index < workingScenes.length; index += 1) {
        if (batchRenderCancelRef.current) {
          break;
        }

        let scene = workingScenes[index];

        if (!routedVideoSceneIdSet.has(scene.id)) {
          updateBatchRenderItem(scene.id, {
            status: "done",
            step: "route",
            message:
              uiLanguage === "en"
                ? "Image-motion route selected; no AI video credit used."
                : "Image-motion rotası seçildi; AI video kredisi kullanılmadı.",
          });
          continue;
        }

        updateBatchRenderItem(scene.id, {
          status: "processing",
          step: "video",
          message: uiLanguage === "en" ? "Generating AI video block..." : "AI video block üretiliyor...",
        });

        try {
          if (!scene.videoUrl || scene.videoStatus !== "done") {
            const videoResult = await generateSceneVideoAndWait(scene);
            scene = {
              ...scene,
              videoUrl: videoResult.videoUrl,
              videoStatus: "done",
              videoJobId: videoResult.videoJobId,
              videoDurationSeconds: videoResult.videoDurationSeconds,
            };
            workingScenes[index] = scene;
          }

          setScenes([...workingScenes]);
          await persistProjectSnapshot([...workingScenes]);

          updateBatchRenderItem(scene.id, {
            status: "done",
            step: "video",
            message: uiLanguage === "en" ? "AI video block ready." : "AI video block hazır.",
          });
        } catch (sceneError: any) {
          hasFailure = true;
          console.error("ai video block generation error:", scene.id, sceneError);

          workingScenes[index] = {
            ...workingScenes[index],
            videoStatus: workingScenes[index].videoStatus === "processing" ? "error" : workingScenes[index].videoStatus,
          };

          setScenes([...workingScenes]);

          updateBatchRenderItem(scene.id, {
            status: "failed",
            step: "video",
            message: sceneError?.message || (uiLanguage === "en" ? "AI video block failed." : "AI video block üretimi başarısız oldu."),
          });

          try {
            await persistProjectSnapshot([...workingScenes]);
          } catch (persistError) {
            console.error("ai video block persist after failure error:", persistError);
          }
        }
      }

      if (batchRenderCancelRef.current) {
        setSaveMessage(uiLanguage === "en" ? "AI video block generation stopped." : "AI video block üretimi durduruldu.");
      } else if (hasFailure) {
        setError(uiLanguage === "en" ? "Some AI video blocks could not be generated." : "Bazı AI video block'lar üretilemedi.");
      } else {
        setSaveMessage(
          uiLanguage === "en"
            ? `${routedVideoSceneIds.length} routed AI video block(s) generated.`
            : `${routedVideoSceneIds.length} yönlendirilmiş AI video block üretildi.`
        );
      }
    } finally {
      suspendAutosaveRef.current = false;
      setIsBatchRendering(false);
      setLoadingAudioSceneId(null);
      setLoadingDialogueSceneId(null);
    }
  };

  const startBatchRender = async () => {
    if (scenes.length === 0) {
      setError("Önce sahneleri oluşturmalısın.");
      return;
    }

    if (!selectedChildId && !isCreatorLabFlow) {
      setError("Lütfen önce bir çocuk seç.");
      return;
    }

    if (!canRunCreatorMediaAction("batch_render")) {
      return;
    }

    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setIsBatchRendering(true);
    setBatchRenderStartedAt(new Date().toISOString());
    batchRenderCancelRef.current = false;
    suspendAutosaveRef.current = true;
    resetBatchRenderItems(scenes);

    const workingScenes: Scene[] = scenes.map((scene) => ({ ...scene }));
    const routedVideoSceneIds = isCreatorLabFlow
      ? getCreatorRoutedVideoSceneIds(workingScenes)
      : workingScenes.map((scene) => scene.id);
    const routedVideoSceneIdSet = new Set(routedVideoSceneIds);
    let hasFailure = false;

    try {
      for (let index = 0; index < workingScenes.length; index += 1) {
        if (batchRenderCancelRef.current) {
          break;
        }

        let scene = workingScenes[index];

        updateBatchRenderItem(scene.id, {
          status: "processing",
          step: "image",
          message: uiLanguage === "en" ? "Preparing image..." : "Görsel hazırlanıyor...",
        });

        try {
          let nextImage = scene.image || "";

          if (!nextImage) {
            setRedrawLoadingId(scene.id);
            nextImage = await generateSceneImage(scene);
            scene = {
              ...scene,
              image: nextImage,
              videoUrl: "",
              videoStatus: "idle",
              videoJobId: "",
            };
            workingScenes[index] = scene;

            setScenes((prev) =>
              prev.map((item) => (item.id === scene.id ? scene : item))
            );
          }

          updateBatchRenderItem(scene.id, {
            status: "processing",
            step: "audio",
            message: uiLanguage === "en" ? "Preparing audio..." : "Ses hazırlanıyor...",
          });

          let nextAudioUrl = scene.audioUrl || "";
          let nextDialogueAudioUrl = scene.dialogueAudioUrl || "";

          if (scene.narration?.trim()) {
            setLoadingAudioSceneId(scene.id);
            nextAudioUrl = await getSceneAudioUrl(scene);
          }

          if (scene.dialogue?.trim()) {
            setLoadingDialogueSceneId(scene.id);
            nextDialogueAudioUrl = await getSceneDialogueUrl(scene);
          }

          const nextTiming = await refreshSceneTiming(scene.id, {
            audioUrl: nextAudioUrl,
            dialogueAudioUrl: nextDialogueAudioUrl,
          });

          scene = {
            ...scene,
            image: nextImage,
            audioUrl: nextAudioUrl || scene.audioUrl || "",
            dialogueAudioUrl: nextDialogueAudioUrl || scene.dialogueAudioUrl || "",
            timing: nextTiming || scene.timing,
          };
          workingScenes[index] = scene;

          const shouldGenerateVideo =
            routedVideoSceneIdSet.has(scene.id) &&
            (!scene.videoUrl || scene.videoStatus !== "done");

          if (shouldGenerateVideo) {
            updateBatchRenderItem(scene.id, {
              status: "processing",
              step: "video",
              message: uiLanguage === "en" ? "Generating routed video block..." : "Yönlendirilmiş video block üretiliyor...",
            });

            const videoResult = await generateSceneVideoAndWait(scene);
            scene = {
              ...scene,
              videoUrl: videoResult.videoUrl,
              videoStatus: "done",
              videoJobId: videoResult.videoJobId,
              videoDurationSeconds: videoResult.videoDurationSeconds,
            };
            workingScenes[index] = scene;
          } else if (!routedVideoSceneIdSet.has(scene.id)) {
            updateBatchRenderItem(scene.id, {
              status: "processing",
              step: "route",
              message:
                uiLanguage === "en"
                  ? "Image-motion route selected; skipping AI video generation."
                  : "Image-motion rotası seçildi; AI video üretimi atlanıyor.",
            });
          }

          updateBatchRenderItem(scene.id, {
            status: "processing",
            step: "save",
            message: uiLanguage === "en" ? "Saving project..." : "Proje kaydediliyor...",
          });

          setScenes([...workingScenes]);
          await persistProjectSnapshot([...workingScenes]);

          updateBatchRenderItem(scene.id, {
            status: "done",
            step: "complete",
            message: uiLanguage === "en" ? "Scene ready." : "Sahne hazır.",
          });
        } catch (sceneError: any) {
          hasFailure = true;
          console.error("batch scene error:", scene.id, sceneError);

          workingScenes[index] = {
            ...workingScenes[index],
            videoStatus: workingScenes[index].videoStatus === "processing" ? "error" : workingScenes[index].videoStatus,
          };

          setScenes([...workingScenes]);

          updateBatchRenderItem(scene.id, {
            status: "failed",
            step: "error",
            message: sceneError?.message || "Sahne üretimi başarısız oldu.",
          });

          try {
            await persistProjectSnapshot([...workingScenes]);
          } catch (persistError) {
            console.error("batch persist after scene failure error:", persistError);
          }
        } finally {
          setRedrawLoadingId(null);
          setLoadingAudioSceneId(null);
          setLoadingDialogueSceneId(null);
        }
      }

      if (batchRenderCancelRef.current) {
        setSaveMessage(uiLanguage === "en" ? "Batch render stopped." : "Batch render durduruldu.");
      } else if (hasFailure) {
        setError(getBatchLabel("failed"));
      } else {
        setSaveMessage(getBatchLabel("completed"));
      }
    } finally {
      suspendAutosaveRef.current = false;
      setIsBatchRendering(false);
      setRedrawLoadingId(null);
      setLoadingAudioSceneId(null);
      setLoadingDialogueSceneId(null);
    }
  };

  const retryFailedScenes = async (specificSceneId?: number) => {
    const failedSceneIds = specificSceneId
      ? [specificSceneId]
      : batchRenderItems
          .filter((item) => item.status === "failed")
          .map((item) => item.sceneId);

    const fallbackFailedSceneIds = scenes
      .filter((scene) => scene.videoStatus === "error")
      .map((scene) => scene.id);

    const uniqueSceneIds = Array.from(
      new Set(failedSceneIds.length > 0 ? failedSceneIds : fallbackFailedSceneIds)
    );

    if (uniqueSceneIds.length === 0) {
      setSaveMessage(
        uiLanguage === "en"
          ? "No failed scenes to retry."
          : "Yeniden denenecek hatalı sahne bulunamadı."
      );
      return;
    }

    if (!canRunCreatorMediaAction("batch_render")) {
      return;
    }

    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setIsBatchRendering(true);
    batchRenderCancelRef.current = false;
    suspendAutosaveRef.current = true;

    if (batchRenderItems.length === 0) {
      resetBatchRenderItems(scenes);
    }

    const workingScenes: Scene[] = scenes.map((scene) => ({ ...scene }));
    const routedVideoSceneIds = isCreatorLabFlow
      ? getCreatorRoutedVideoSceneIds(workingScenes)
      : workingScenes.map((scene) => scene.id);
    const routedVideoSceneIdSet = new Set(routedVideoSceneIds);
    let hasFailure = false;

    try {
      for (const sceneId of uniqueSceneIds) {
        if (batchRenderCancelRef.current) {
          break;
        }

        const index = workingScenes.findIndex((item) => item.id === sceneId);

        if (index < 0) {
          continue;
        }

        let scene = workingScenes[index];
        setRetryingSceneId(scene.id);

        updateBatchRenderItem(scene.id, {
          status: "processing",
          step: "image",
          message: uiLanguage === "en" ? "Retry: preparing image..." : "Retry: görsel hazırlanıyor...",
        });

        try {
          let nextImage = scene.image || "";

          if (!nextImage) {
            setRedrawLoadingId(scene.id);
            nextImage = await generateSceneImage(scene);
            scene = {
              ...scene,
              image: nextImage,
              videoUrl: "",
              videoStatus: "idle",
              videoJobId: "",
            };
            workingScenes[index] = scene;

            setScenes((prev) =>
              prev.map((item) => (item.id === scene.id ? scene : item))
            );
          }

          updateBatchRenderItem(scene.id, {
            status: "processing",
            step: "audio",
            message: uiLanguage === "en" ? "Retry: preparing audio..." : "Retry: ses hazırlanıyor...",
          });

          let nextAudioUrl = scene.audioUrl || "";
          let nextDialogueAudioUrl = scene.dialogueAudioUrl || "";

          if (scene.narration?.trim()) {
            setLoadingAudioSceneId(scene.id);
            nextAudioUrl = await getSceneAudioUrl(scene);
          }

          if (scene.dialogue?.trim()) {
            setLoadingDialogueSceneId(scene.id);
            nextDialogueAudioUrl = await getSceneDialogueUrl(scene);
          }

          const nextTiming = await refreshSceneTiming(scene.id, {
            audioUrl: nextAudioUrl,
            dialogueAudioUrl: nextDialogueAudioUrl,
          });

          scene = {
            ...scene,
            image: nextImage,
            audioUrl: nextAudioUrl || scene.audioUrl || "",
            dialogueAudioUrl: nextDialogueAudioUrl || scene.dialogueAudioUrl || "",
            timing: nextTiming || scene.timing,
            videoUrl: "",
            videoStatus: "idle",
            videoJobId: "",
          };
          workingScenes[index] = scene;

          if (routedVideoSceneIdSet.has(scene.id)) {
            updateBatchRenderItem(scene.id, {
              status: "processing",
              step: "video",
              message: uiLanguage === "en" ? "Retry: generating routed video block..." : "Retry: yönlendirilmiş video block üretiliyor...",
            });

            const videoResult = await generateSceneVideoAndWait(scene);
            scene = {
              ...scene,
              videoUrl: videoResult.videoUrl,
              videoStatus: "done",
              videoJobId: videoResult.videoJobId,
              videoDurationSeconds: videoResult.videoDurationSeconds,
            };
            workingScenes[index] = scene;
          } else {
            updateBatchRenderItem(scene.id, {
              status: "processing",
              step: "route",
              message:
                uiLanguage === "en"
                  ? "Retry uses the image-motion route; no AI video credit used."
                  : "Retry image-motion rotasını kullanıyor; AI video kredisi kullanılmadı.",
            });
          }

          updateBatchRenderItem(scene.id, {
            status: "processing",
            step: "save",
            message: uiLanguage === "en" ? "Saving retry result..." : "Retry sonucu kaydediliyor...",
          });

          setScenes([...workingScenes]);
          await persistProjectSnapshot([...workingScenes]);

          updateBatchRenderItem(scene.id, {
            status: "done",
            step: "complete",
            message: uiLanguage === "en" ? "Scene fixed." : "Sahne düzeltildi.",
          });
        } catch (sceneError: any) {
          hasFailure = true;
          console.error("retry scene error:", scene.id, sceneError);

          workingScenes[index] = {
            ...workingScenes[index],
            videoStatus: workingScenes[index].videoStatus === "processing" ? "error" : workingScenes[index].videoStatus,
          };

          setScenes([...workingScenes]);

          updateBatchRenderItem(scene.id, {
            status: "failed",
            step: "error",
            message: sceneError?.message || "Sahne yeniden üretimi başarısız oldu.",
          });

          try {
            await persistProjectSnapshot([...workingScenes]);
          } catch (persistError) {
            console.error("retry persist after scene failure error:", persistError);
          }
        } finally {
          setRedrawLoadingId(null);
          setLoadingAudioSceneId(null);
          setLoadingDialogueSceneId(null);
          setRetryingSceneId(null);
        }
      }

      if (batchRenderCancelRef.current) {
        setSaveMessage(uiLanguage === "en" ? "Retry stopped." : "Retry durduruldu.");
      } else if (hasFailure) {
        setError(uiLanguage === "en" ? "Some scenes still failed after retry." : "Bazı sahneler retry sonrası hâlâ hata aldı.");
      } else {
        setSaveMessage(uiLanguage === "en" ? "Failed scenes fixed ✅" : "Hatalı sahneler düzeltildi ✅");
      }
    } finally {
      suspendAutosaveRef.current = false;
      setIsBatchRendering(false);
      setRetryingSceneId(null);
      setRedrawLoadingId(null);
      setLoadingAudioSceneId(null);
      setLoadingDialogueSceneId(null);
    }
  };


  const handleResetExport = () => {
    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setSaveMessage(uiLanguage === "en" ? "Export reset ✅" : "Export sıfırlandı ✅");
  };

  const getCreatorFinalVideoReadinessMessage = (
    readiness: CreatorFinalVideoReadinessReport,
  ) => {
    const missingVisuals = readiness.missingVisualSceneIds.join(", ");
    const missingVoice = readiness.missingVoiceSceneIds.join(", ");
    const blockingScenes = readiness.blockingSceneIds.join(", ");

    if (readiness.status === "production_stage_required") {
      return uiLanguage === "en"
        ? "Create the Production Stage before creating the final video."
        : "Final videodan önce Production Stage oluştur.";
    }

    if (readiness.status === "timeline_required") {
      return uiLanguage === "en"
        ? "Run and approve the Timeline Check before creating the final video."
        : "Final videodan önce Timeline Kontrolü'nü çalıştır ve onayla.";
    }

    if (readiness.status === "visuals_required") {
      return uiLanguage === "en"
        ? `Generate Visuals first. Missing scene(s): ${missingVisuals}.`
        : `Önce Görselleri Üret. Eksik sahne(ler): ${missingVisuals}.`;
    }

    if (readiness.status === "voice_over_required") {
      return uiLanguage === "en"
        ? `Generate Voice-over first. Missing scene(s): ${missingVoice}.`
        : `Önce Seslendirme Üret. Eksik sahne(ler): ${missingVoice}.`;
    }

    if (readiness.status === "continuity_blocked") {
      return uiLanguage === "en"
        ? `Final video is blocked by unresolved continuity risk in scene(s): ${blockingScenes}.`
        : `Final video, ${blockingScenes} numaralı sahnelerdeki çözülmemiş akış riski nedeniyle durduruldu.`;
    }

    if (readiness.status === "confirmation_required") {
      return uiLanguage === "en"
        ? "Assets are ready. Timing warnings will require confirmation when final video production starts."
        : "Görseller ve sesler hazır. Final video başlarken süre uyarıları için onay istenecek.";
    }

    return uiLanguage === "en"
      ? "Timeline, visuals, voice-over and continuity are ready."
      : "Timeline, görseller, seslendirme ve akış hazır.";
  };

  const handleExportMovie = async (forceRebuild = false) => {
    const currentSignature = buildExportSignature(title, scenes);

    if (
      !forceRebuild &&
      exportedMovieUrl &&
      exportSignature === currentSignature
    ) {
      setError("");
      setSaveMessage(ui.movieCreated);

      if (typeof window !== "undefined") {
        window.open(
          exportMovieResult?.downloadUrl || exportedMovieUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }

      return;
    }

    if (isCreatorLabFlow) {
      if (!canRunCreatorMediaAction("final_video")) {
        return;
      }

      const readiness = createCreatorFinalVideoReadiness({
        scenes,
        timelineApproved: getCreatorTimelineMediaGate().approved,
        flowValidation: buildExportFlowValidation(scenes),
      });

      if (!readiness.canStartFinalVideo) {
        setSaveMessage("");
        setError(getCreatorFinalVideoReadinessMessage(readiness));
        return;
      }
    }

    const rawExportScenes = scenes.filter(
      (scene) => getSceneExportSource(scene) !== "none"
    );

    if (rawExportScenes.length === 0) {
      setError("Film oluşturmak için en az bir görsel veya hazır video içeren sahne gerekli.");
      return;
    }

    if (!isCreatorLabFlow && !canRunCreatorMediaAction("final_video")) {
      return;
    }

    if (!exportApiBase) {
      setError("Export servisi URL'i tanımlı değil. Vercel ortam değişkenlerinde NEXT_PUBLIC_EXPORT_API_URL eklenmeli.");
      return;
    }

    const exportFlowValidation = approveExportFlow(scenes);

    if (isCreatorLabFlow && !exportFlowValidation) {
      return;
    }

    const exportScenes = exportFlowValidation
      ? applyExportFlowAutoFixes(rawExportScenes, exportFlowValidation)
      : rawExportScenes;
    const flowContinuityAudit = exportFlowValidation?.audit || null;

    setIsExportingMovie(true);
    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");

    try {
      const res = await fetch(`${exportApiBase}/export-movie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          projectId: getProjectKey(),
          exportMode: "mixed",
          flowContinuityAudit,
          exportFlowValidation,
          manualConfirmationGranted:
            exportFlowValidation?.requiresManualConfirmation || false,
          scenes: exportScenes.map((scene) => {
            const timing =
              scene.timing || buildSceneTimingForCurrentFlow(0, 0, scene);
            const normalizedTarget = isCreatorLabFlow
              ? Math.min(
                  CREATOR_MAX_SCENE_DURATION_SECONDS,
                  Math.max(
                    CREATOR_MIN_SCENE_DURATION_SECONDS,
                    timing.targetSceneDuration ||
                      getCreatorPlannedSceneDuration(scene),
                  ),
                )
              : Math.min(
                  Math.max(
                    timing.targetSceneDuration ||
                      TARGET_SCENE_DURATION_SECONDS,
                    TARGET_SCENE_DURATION_SECONDS,
                  ),
                  MAX_SCENE_DURATION_SECONDS,
                );

            return {
              ...scene,
              exportSource: getSceneExportSource(scene),
              videoUrl: getSceneExportSource(scene) === "video" ? scene.videoUrl : "",
              timing: {
                ...timing,
                targetSceneDuration: normalizedTarget,
                maxSpeechDuration: isCreatorLabFlow
                  ? Number(
                      Math.max(
                        0,
                        normalizedTarget -
                          CREATOR_SPEECH_TAIL_BUFFER_SECONDS,
                      ).toFixed(2),
                    )
                  : Number(
                      (
                        normalizedTarget * getActiveMaxSpeechRatio()
                      ).toFixed(2),
                    ),
              },
            };
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok || !data.movieUrl) {
        throw new Error(data?.error || "Film export işlemi başarısız oldu.");
      }

      const nextExportResult: ExportMovieResult = {
        movieUrl: data.movieUrl,
        downloadUrl: data.downloadUrl || data.movieUrl,
        fileName: data.fileName || "",
        sizeBytes: data.sizeBytes || 0,
        durationSeconds: data.durationSeconds || 0,
        sceneCount: data.sceneCount || exportScenes.length,
      };

      setExportedMovieUrl(nextExportResult.movieUrl);
      setExportMovieResult(nextExportResult);
      setExportSignature(currentSignature);

      try {
        const accessToken = await getAccessTokenOrThrow();

        const saveRes = await fetch("/api/save-project", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            projectId: currentProjectId || undefined,
            childId: getProjectChildId(),
            title,
            inputPrompt: input,
            flowKey: activeFlowKey,
            flowTitle: selectedFlow.title,
            flowType: activeFlowKey || "storyverse",
            language,
            storyPremise: storySetup?.storyPremise || "",
            characters,
            visualBible,
            scenes,
            creatorProductionPackage,
            youtubeMetadataResult,
            youtubeThumbnailResult,
            sceneOptimizationResult,
            sceneOptimizationSummary,
            exportedMovieUrl: nextExportResult.movieUrl,
            exportedMovieResult: nextExportResult,
            exportSignature: currentSignature,
          }),
        });

        const saveData = await saveRes.json();

        if (saveRes.ok && saveData?.project?.id) {
          setCurrentProjectId(saveData.project.id);
          setLoadProjectId(saveData.project.id);
          await fetchProjects();
        }
      } catch (saveError) {
        console.error("export cache save error:", saveError);
      }

      setSaveMessage(ui.movieCreated);
    } catch (e: any) {
      console.error("handleExportMovie error:", e);
      setError(e?.message || "Film export sırasında hata oluştu.");
    } finally {
      setIsExportingMovie(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!currentProjectId) {
      setError("Paylaşım linki için önce projeyi kaydetmelisin.");
      return;
    }

    setShareLoading(true);
    setShareCopied(false);
    setError("");
    setSaveMessage("");

    try {
      await persistProject(false);

      const accessToken = await getAccessTokenOrThrow();

      const res = await fetch("/api/share-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          projectId: currentProjectId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.shareId) {
        throw new Error(data?.error || "Paylaşım linki oluşturulamadı.");
      }

      const nextShareUrl =
        data.shareUrl || `${window.location.origin}/episode/public/${data.shareId}`;

      setShareUrl(nextShareUrl);
      setSaveMessage(ui.shareCreated);
    } catch (e: any) {
      setError(e?.message || "Paylaşım linki oluşturulurken hata oluştu.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) {
      setError("Kopyalanacak paylaşım linki yok.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setSaveMessage(ui.shareCopied);
    } catch {
      setError("Link kopyalanamadı. Lütfen manuel kopyala.");
    }
  };

  const prepareAllAudio = async () => {
    if (scenes.length === 0) {
      setError("Önce sahneleri oluşturmalısın.");
      return;
    }

    if (!canRunCreatorMediaAction("voice_over")) {
      return;
    }

    setError("");
    setSaveMessage("");
    setIsPreparingAudio(true);
    suspendAutosaveRef.current = true;

    try {
      for (const scene of scenes) {
        let latestNarrationUrl = scene.audioUrl || "";
        let latestDialogueUrl = scene.dialogueAudioUrl || "";

        if (scene.narration?.trim()) {
          setLoadingAudioSceneId(scene.id);
          latestNarrationUrl = await getSceneAudioUrl(scene);
        }

        if (scene.dialogue?.trim()) {
          setLoadingDialogueSceneId(scene.id);
          latestDialogueUrl = await getSceneDialogueUrl(scene);
        }

        await refreshSceneTiming(scene.id, {
          audioUrl: latestNarrationUrl,
          dialogueAudioUrl: latestDialogueUrl,
        });
      }

      setSaveMessage(ui.allAudioReady);
    } catch (e: any) {
      console.error("prepareAllAudio error:", e);
      setError(e?.message || "Sesler hazırlanırken bir hata oluştu.");
    } finally {
      suspendAutosaveRef.current = false;
      setIsPreparingAudio(false);
      setLoadingAudioSceneId(null);
      setLoadingDialogueSceneId(null);
    }
  };

  const playNarration = async (sceneId: number, narration: string) => {
    if (!narration?.trim()) {
      setError("Bu sahnede seslendirilecek anlatıcı metni yok.");
      return;
    }

    setError("");

    try {
      if (isPlayingStory) {
        stopStoryPlayback();
        return;
      }

      if (playingDialogueSceneId !== null) {
        stopDialoguePlayback();
      }

      if (playingSceneId === sceneId && audioRef.current) {
        stopCurrentAudio();
        return;
      }

      setLoadingAudioSceneId(sceneId);

      const scene = scenes.find((item) => item.id === sceneId);
      if (!scene) {
        throw new Error("Sahne bulunamadı.");
      }

      const audioUrl = await getSceneAudioUrl(scene);
      await playAudioFromUrl(sceneId, audioUrl);
    } catch (e: any) {
      console.error("playNarration error:", e);
      stopCurrentAudio();
      setError(e?.message || "Ses oluşturulurken veya oynatılırken bir hata oluştu.");
    } finally {
      setLoadingAudioSceneId(null);
    }
  };

  const playWholeStory = async () => {
    if (scenes.length === 0) {
      setError("Önce sahneleri oluşturmalısın.");
      return;
    }

    if (isPlayingStory) {
      stopStoryPlayback();
      return;
    }

    stopDialoguePlayback();
    setError("");
    setIsPlayingStory(true);
    storyPlaybackTokenRef.current += 1;
    const playbackToken = storyPlaybackTokenRef.current;

    try {
      for (const scene of scenes) {
        if (playbackToken !== storyPlaybackTokenRef.current) {
          return;
        }

        if (scene.narration?.trim()) {
          setLoadingAudioSceneId(scene.id);

          const narrationAudioUrl = await getSceneAudioUrl(scene);

          if (playbackToken !== storyPlaybackTokenRef.current) {
            return;
          }

          setLoadingAudioSceneId(null);
          await waitForAudioToFinish(scene.id, narrationAudioUrl, playbackToken);
        }

        if (playbackToken !== storyPlaybackTokenRef.current) {
          return;
        }

        if (scene.dialogue?.trim()) {
          setLoadingDialogueSceneId(scene.id);

          const dialogueAudioUrl = await getSceneDialogueUrl(scene);

          if (playbackToken !== storyPlaybackTokenRef.current) {
            return;
          }

          setLoadingDialogueSceneId(null);
          await waitForAudioToFinish(scene.id, dialogueAudioUrl, playbackToken);
        }
      }
    } catch (e: any) {
      console.error("playWholeStory error:", e);
      setError(e?.message || "Hikaye oynatılırken bir hata oluştu.");
    } finally {
      if (playbackToken === storyPlaybackTokenRef.current) {
        setIsPlayingStory(false);
        setLoadingAudioSceneId(null);
        setLoadingDialogueSceneId(null);
        stopCurrentAudio();
      }
    }
  };

  const persistProject = async (showManualMessage = false) => {
    if (!title || scenes.length === 0) {
      return;
    }

    if (!selectedChildId && !isCreatorLabFlow) {
      setError("Lütfen önce bir çocuk seç.");
      return;
    }

    const accessToken = await getAccessTokenOrThrow();

    const res = await fetch("/api/save-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        projectId: currentProjectId || undefined,
        childId: getProjectChildId(),
        title,
        inputPrompt: input,
        flowKey: activeFlowKey,
        flowTitle: selectedFlow.title,
        flowType: activeFlowKey || "storyverse",
        language,
        storyPremise: storySetup?.storyPremise || "",
        characters,
        visualBible,
        scenes,
        creatorProductionPackage,
        youtubeMetadataResult,
        youtubeThumbnailResult,
        sceneOptimizationResult,
        sceneOptimizationSummary,
        exportedMovieUrl: hasReusableExport() ? exportedMovieUrl : null,
        exportedMovieResult: hasReusableExport() ? exportMovieResult : null,
        exportSignature: hasReusableExport() ? exportSignature : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Kaydedilemedi.");
    }

    if (data?.project?.id) {
      setCurrentProjectId(data.project.id);
      setLoadProjectId(data.project.id);
    }

    await fetchProjects();

    if (showManualMessage) {
      setSaveMessage(
        data.mode === "created" ? ui.projectSaved : ui.projectUpdated
      );
    }
  };

  const saveProject = async () => {
    if (!title || scenes.length === 0) {
      setError("Kaydetmek için önce hikaye oluşturmalısın.");
      return;
    }

    if (!selectedChildId && !isCreatorLabFlow) {
      setError("Lütfen önce bir çocuk seç.");
      return;
    }

    setIsSavingProject(true);
    setError("");
    setSaveMessage("");

    try {
      await persistProject(true);
    } catch (e: any) {
      setError(e?.message || "Kaydetme sırasında hata oluştu.");
    } finally {
      setIsSavingProject(false);
    }
  };

  const loadProject = async (projectIdOverride?: string) => {
    const projectIdToLoad = (projectIdOverride || loadProjectId).trim();

    if (!projectIdToLoad) {
      setError("Lütfen bir proje seç veya proje ID gir.");
      return;
    }

    setIsLoadingProject(true);
    setError("");
    setSaveMessage("");

    try {
      const accessToken = await getAccessTokenOrThrow();

      const res = await fetch(`/api/load-project/${projectIdToLoad}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Proje yüklenemedi.");
        return;
      }

      const project = data.project;

      isHydratingRef.current = true;

      clearAllVideoPolls();
      stopDialoguePlayback();
      stopStoryPlayback();

      setCurrentProjectId(project.id || "");
      setLoadProjectId(project.id || projectIdToLoad);
      setSelectedChildId(project.child_id || "");
      setTitle(project.title || "");
      setInput(project.input_prompt || "");
      // SADECE content language güncellensin
      setLanguage(project.language === "en" ? "en" : "tr");
      setCharacters(
        project.flow_type === "creator_lab"
          ? normalizeCreatorLabCharacters(project.characters)
          : withDefaultGuideCharacter(project.characters)
      );
      setVisualBible(project.visual_bible || emptyVisualBible);
      setScenes(
        Array.isArray(project.scenes)
          ? project.scenes.map((scene: Scene) => ({
              ...scene,
              audioUrl: scene.audioUrl || "",
              audioPath: scene.audioPath || "",
              audioSourceText: scene.audioSourceText || "",
              audioSettingsKey: scene.audioSettingsKey || "",
              dialogueAudioUrl: scene.dialogueAudioUrl || "",
              dialogueAudioPath: scene.dialogueAudioPath || "",
              dialogueAudioSourceText: scene.dialogueAudioSourceText || "",
              dialogueAudioSettingsKey: scene.dialogueAudioSettingsKey || "",
              videoUrl: scene.videoUrl || "",
              videoStatus: scene.videoStatus || "idle",
              videoJobId: scene.videoJobId || "",
              timing: scene.timing || buildSceneTiming(0, 0),
            }))
          : []
      );

      setExportedMovieUrl(project.exported_movie_url || "");
      setExportMovieResult(project.exported_movie_result || null);
      setExportSignature(project.export_signature || "");

      setCreatorMentorResult(project.creator_mentor_result || null);
      setCreatorProductionPackage(project.creator_production_package || null);
      setYoutubeMetadataResult(project.youtube_metadata || null);
      setYoutubeThumbnailResult(project.youtube_thumbnail || null);
      setSceneOptimizationResult(
        Array.isArray(project.scene_optimization) ? project.scene_optimization : []
      );
      setSceneOptimizationSummary(project.scene_optimization_summary || null);
      setRefinedCreatorScenes(
        Array.isArray(project.refined_creator_scenes)
          ? project.refined_creator_scenes
          : []
      );
      setShareUrl(project.share_id ? `${window.location.origin}/episode/public/${project.share_id}` : "");
      setShareCopied(false);
      setStorySetup({
        title: project.title || "",
        storyPremise: project.story_premise || "",
        characters: project.flow_type === "creator_lab"
          ? normalizeCreatorLabCharacters(project.characters)
          : Array.isArray(project.characters)
            ? project.characters.map((character: Character) => ({
                ...character,
                voiceId: character.voiceId || "",
              }))
            : [],
        visualBible: project.visual_bible || emptyVisualBible,
      });

      setSaveMessage(ui.projectLoaded);

      setTimeout(() => {
        isHydratingRef.current = false;
        skipAutosaveRef.current = false;
      }, 0);
    } catch (e: any) {
      setError(e?.message || "Yükleme sırasında hata oluştu.");
    } finally {
      setIsLoadingProject(false);
    }
  };

  const getProjectChildId = (): string | null => {
    if (selectedChildId) {
      return selectedChildId;
    }

    // CreatorLab projects belong directly to the authenticated user and are
    // not associated with a Storyverse child profile. The database column is
    // UUID-typed, so a textual sentinel such as "creator_lab" must never be sent.
    return isCreatorLabFlow ? null : "";
  };

  const getCreatorCountryLabel = () => {
    return (
      CREATOR_COUNTRY_OPTIONS.find((option) => option.value === creatorCountry)?.label ||
      creatorCountry
    );
  };

  const applyCreatorProfile = (profile = creatorProfile) => {
    const safeProfile = parseCreatorProfile(profile);
    setCreatorCountry(safeProfile.defaultCountry);
    setCreatorFormat(safeProfile.defaultFormat);
    setCreatorQualityMode(safeProfile.defaultQualityMode);
    const defaultOption = getCreatorDurationOptionsByFormat(safeProfile.defaultFormat)[0];
    if (defaultOption) {
      setCreatorDurationPreset(defaultOption.preset);
      setCreatorVideoDurationSec(defaultOption.seconds);
      setCreatorCustomDurationSec(defaultOption.seconds);
    }
  };

  const saveCreatorProfile = () => {
    const nextProfile = parseCreatorProfile({
      ...creatorProfile,
      defaultCountry: creatorCountry,
      defaultFormat: creatorFormat,
      defaultQualityMode: creatorQualityMode,
    });
    setCreatorProfile(nextProfile);
    window.localStorage.setItem(CREATOR_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    setSaveMessage(uiLanguage === "en" ? "Creator profile saved on this device ✅" : "Creator profili bu cihazda kaydedildi ✅");
  };

  const getCreatorFormatLabel = () => {
    return (
      CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label ||
      creatorFormat
    );
  };

  const getCreatorDurationOptions = () => {
    return getCreatorDurationOptionsByFormat(creatorFormat);
  };

  const formatCreatorDuration = (durationSec: number) => {
    if (durationSec >= 120) {
      const minutes = durationSec / 60;
      return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
    }

    return `${durationSec} sec`;
  };

  const getCreatorDurationLabel = () => {
    const selectedOption = getCreatorDurationOptions().find(
      (option) => option.preset === creatorDurationPreset
    );

    if (creatorDurationPreset === "custom") {
      return `Custom / ${formatCreatorDuration(creatorVideoDurationSec)}`;
    }

    return selectedOption?.label || formatCreatorDuration(creatorVideoDurationSec);
  };

  const getCreatorQualityModeOption = () => {
    return (
      CREATOR_QUALITY_MODE_OPTIONS.find((option) => option.value === creatorQualityMode) ||
      CREATOR_QUALITY_MODE_OPTIONS[1]
    );
  };

  const getCreatorQualityModeLabel = () => {
    const option = getCreatorQualityModeOption();
    return uiLanguage === "en" ? option.labelEn : option.labelTr;
  };

  const getCreatorQualityModeGuidance = () => {
    const option = getCreatorQualityModeOption();
    return uiLanguage === "en" ? option.guidanceEn : option.guidanceTr;
  };

  const getCreatorQualityCreditTier = () => {
    const option = getCreatorQualityModeOption();
    return uiLanguage === "en" ? option.creditTierEn : option.creditTierTr;
  };

  const getCreatorQualityEstimate = () => {
    const sceneCount = getCreatorSceneCount();
    const durationMinutes = Math.max(1, Math.ceil(creatorVideoDurationSec / 60));

    const modePolicy: Record<
      CreatorQualityMode,
      {
        baseCredits: number;
        sceneCredits: number;
        durationCredits: number;
        videoRatio: number;
        mediaPathEn: string;
        mediaPathTr: string;
        timelineGateEn: string;
        timelineGateTr: string;
        exportReadinessEn: string;
        exportReadinessTr: string;
      }
    > = {
      draft: {
        baseCredits: 1,
        sceneCredits: 0,
        durationCredits: 0,
        videoRatio: 0,
        mediaPathEn: "Text-only strategy package",
        mediaPathTr: "Yalnızca metin strateji paketi",
        timelineGateEn: "No paid media. Timeline preview is advisory.",
        timelineGateTr: "Ücretli medya yok. Timeline önizleme danışman niteliğinde.",
        exportReadinessEn: "Brief, hooks, scene outline and metadata draft",
        exportReadinessTr: "Brief, hook, sahne taslağı ve metadata ön çalışması",
      },
      standard: {
        baseCredits: 3,
        sceneCredits: 1,
        durationCredits: 1,
        videoRatio: 0.25,
        mediaPathEn: "Mostly images, voice and light motion",
        mediaPathTr: "Ağırlıklı görsel, ses ve hafif hareket",
        timelineGateEn: "Timeline should be reviewed before asset generation.",
        timelineGateTr: "Asset üretiminden önce timeline kontrol edilmeli.",
        exportReadinessEn: "Usable creator package with controlled credit use",
        exportReadinessTr: "Kontrollü kredi kullanımıyla hazırlanabilir creator paketi",
      },
      pro: {
        baseCredits: 6,
        sceneCredits: 2,
        durationCredits: 2,
        videoRatio: 0.45,
        mediaPathEn: "Selective video blocks, stronger voice and thumbnail routing",
        mediaPathTr: "Seçili video blokları, daha güçlü ses ve thumbnail yönlendirme",
        timelineGateEn: "Edit plan is recommended before paid rendering.",
        timelineGateTr: "Ücretli render öncesi edit plan önerilir.",
        exportReadinessEn: "Professional publish-ready package",
        exportReadinessTr: "Profesyonel yayına hazır paket",
      },
      cinematic: {
        baseCredits: 10,
        sceneCredits: 4,
        durationCredits: 4,
        videoRatio: 0.75,
        mediaPathEn: "Premium video blocks, continuity-aware export and higher-end voice",
        mediaPathTr: "Premium video blokları, süreklilik odaklı export ve üst kalite ses",
        timelineGateEn: "Timeline must be safe or approved before cinematic rendering.",
        timelineGateTr: "Sinematik render öncesi timeline güvenli ya da onaylı olmalı.",
        exportReadinessEn: "Highest-quality production path",
        exportReadinessTr: "En yüksek kalite üretim hattı",
      },
    };

    const policy = modePolicy[creatorQualityMode];
    const estimatedCredits = policy.baseCredits + sceneCount * policy.sceneCredits + durationMinutes * policy.durationCredits;
    const estimatedVideoBlocks = Math.min(sceneCount, Math.max(0, Math.round(sceneCount * policy.videoRatio)));
    const estimatedImageMotionBlocks = Math.max(0, sceneCount - estimatedVideoBlocks);

    return {
      estimatedCredits,
      estimatedVideoBlocks,
      estimatedImageMotionBlocks,
      mediaPath: uiLanguage === "en" ? policy.mediaPathEn : policy.mediaPathTr,
      timelineGate: uiLanguage === "en" ? policy.timelineGateEn : policy.timelineGateTr,
      exportReadiness: uiLanguage === "en" ? policy.exportReadinessEn : policy.exportReadinessTr,
    };
  };

  const getCreatorSceneCount = () => {
    return getCreatorSceneCountByDuration(creatorVideoDurationSec);
  };

  const getCreatorCustomDurationInputValue = () => {
    if (creatorFormat === "youtube_video") {
      return Number((creatorCustomDurationSec / 60).toFixed(1));
    }

    return creatorCustomDurationSec;
  };

  const getCreatorActiveTimelinePlan = () =>
    creatorProductionPackage?.timelineSyncPlan || creatorTimelinePreviewPlan;

  const creatorMediaRoute = getCreatorMediaRoute(creatorQualityMode);

  const isCreatorActionBlocked = (action: CreatorMediaAction) =>
    isCreatorLabFlow &&
    !isCreatorMediaActionAllowed(creatorMediaRoute, action);

  const getCreatorMediaRoutingError = (action: CreatorMediaAction) => {
    if (creatorQualityMode === "draft") {
      return uiLanguage === "en"
        ? "Draft is a text-only planning mode. Select Standard, Pro or Cinematic before using media credits."
        : "Draft yalnızca metin tabanlı planlama modudur. Medya kredisi kullanmadan önce Standard, Pro veya Cinematic seç.";
    }

    if (action === "ai_video_blocks" && creatorQualityMode === "standard") {
      return uiLanguage === "en"
        ? "Standard uses images, voice and light motion. Select Pro or Cinematic for AI video blocks."
        : "Standard; görsel, ses ve hafif hareket kullanır. AI video block için Pro veya Cinematic seç.";
    }

    return uiLanguage === "en"
      ? "This media action is not available for the selected production quality."
      : "Bu medya aksiyonu seçilen üretim kalitesinde kullanılamaz.";
  };

  const getCreatorRoutedVideoSceneIds = (sourceScenes: Scene[]) =>
    getCreatorVideoBlockSceneIds({
      route: creatorMediaRoute,
      sceneIds: sourceScenes.map((scene) => scene.id),
      timelinePlan: getCreatorActiveTimelinePlan(),
    });

  const buildCreatorTimelineGateSignature = () =>
    JSON.stringify({
      qualityMode: creatorQualityMode,
      durationSec: creatorVideoDurationSec,
      sceneCount: scenes.length,
      scenes: scenes.map((scene) => ({
        id: scene.id,
        text: scene.text || "",
        narration: scene.narration || "",
        dialogue: scene.dialogue || "",
        visualPrompt: scene.visualPrompt || "",
        renderMode: scene.renderMode || "auto",
      })),
    });

  const getCreatorTimelineMediaGate = () => {
    if (!isCreatorLabFlow || scenes.length === 0) {
      return {
        status: "not_applicable" as const,
        approved: true,
        title: "",
        message: "",
        action: "",
      };
    }

    const plan = getCreatorActiveTimelinePlan();
    const signature = buildCreatorTimelineGateSignature();
    const manuallyApproved = creatorTimelineApprovedSignature === signature;

    if (!plan) {
      return {
        status: "needs_preview" as const,
        approved: false,
        title: uiLanguage === "en" ? "Timeline check required" : "Timeline kontrolü gerekli",
        message:
          uiLanguage === "en"
            ? "Run a timeline check before image, voice, video or export credit usage starts."
            : "Görsel, ses, video veya export kredi kullanımı başlamadan önce timeline kontrolü çalıştır.",
        action: uiLanguage === "en" ? "Run Timeline Check" : "Timeline Kontrolü Çalıştır",
      };
    }

    if (creatorTimelineNeedsEditPlan(plan) && !manuallyApproved) {
      return {
        status: "blocked" as const,
        approved: false,
        title: uiLanguage === "en" ? "Media generation is gated" : "Medya üretimi kilitli",
        message:
          uiLanguage === "en"
            ? "The current timeline has narration or visual-block risks. Optimize it, review the edit plan, or explicitly approve the risk before using credits."
            : "Mevcut timeline’da anlatım veya visual-block riski var. Kredi kullanmadan önce optimize et, edit planı incele veya riski açıkça onayla.",
        action: uiLanguage === "en" ? "Optimize Timeline" : "Timeline Optimize Et",
      };
    }

    if (creatorTimelineNeedsEditPlan(plan) && manuallyApproved) {
      return {
        status: "approved_with_risk" as const,
        approved: true,
        title: uiLanguage === "en" ? "Timeline risk approved" : "Timeline riski onaylandı",
        message:
          uiLanguage === "en"
            ? "Media actions are available, but this plan still carries timing risk. Use Pro/Cinematic rendering carefully."
            : "Medya aksiyonları açık, ancak bu planda hâlâ zamanlama riski var. Pro/Cinematic render’ı dikkatli kullan.",
        action: uiLanguage === "en" ? "Re-check Timeline" : "Timeline’ı Tekrar Kontrol Et",
      };
    }

    return {
      status: "safe" as const,
      approved: true,
      title: uiLanguage === "en" ? "Timeline safe" : "Timeline güvenli",
      message:
        uiLanguage === "en"
          ? "Media generation can continue. The current narration and visual block plan are safe enough for rendering."
          : "Medya üretimine geçilebilir. Mevcut anlatım ve visual block planı render için yeterince güvenli.",
      action: uiLanguage === "en" ? "Re-check Timeline" : "Timeline’ı Tekrar Kontrol Et",
    };
  };

  const creatorTimelineGateSignature = buildCreatorTimelineGateSignature();
  const creatorTimelineMediaGate = getCreatorTimelineMediaGate();
  const isCreatorMediaGenerationBlocked =
    isCreatorLabFlow && scenes.length > 0 && !creatorTimelineMediaGate.approved;

  const getCreatorTimelineGateError = () =>
    creatorTimelineMediaGate.message ||
    (uiLanguage === "en"
      ? "Run and approve the CreatorLab timeline before using media credits."
      : "Medya kredisi kullanmadan önce CreatorLab timeline kontrolünü çalıştır ve onayla.");

  const getCreatorMediaActionError = (
    action: CreatorMediaAction = "paid_media",
  ) =>
    isCreatorActionBlocked(action)
      ? getCreatorMediaRoutingError(action)
      : getCreatorTimelineGateError();

  const canRunCreatorMediaAction = (
    action: CreatorMediaAction = "paid_media",
  ) => {
    if (isCreatorActionBlocked(action)) {
      setSaveMessage("");
      setError(getCreatorMediaRoutingError(action));
      return false;
    }

    if (!isCreatorMediaGenerationBlocked) {
      return true;
    }

    setSaveMessage("");
    setError(getCreatorTimelineGateError());
    return false;
  };

  const approveCreatorTimelineRisk = () => {
    setCreatorTimelineApprovedSignature(creatorTimelineGateSignature);
    setError("");
    setSaveMessage(
      uiLanguage === "en"
        ? "Timeline risk approved for this version of the scenes. Media actions are now available."
        : "Bu sahne versiyonu için timeline riski onaylandı. Medya aksiyonları artık açık."
    );
  };

  const handleCreatorFormatChange = (nextFormat: CreatorFormat) => {
    setCreatorFormat(nextFormat);

    const defaultOption = nextFormat === "youtube_video"
      ? CREATOR_VIDEO_DURATION_OPTIONS[1]
      : CREATOR_SHORT_DURATION_OPTIONS[3];

    setCreatorDurationPreset(defaultOption.preset);
    setCreatorVideoDurationSec(defaultOption.seconds);
    setCreatorCustomDurationSec(defaultOption.seconds);
  };

  const handleCreatorDurationPresetChange = (preset: CreatorDurationPreset) => {
    setCreatorDurationPreset(preset);

    if (preset === "custom") {
      setCreatorVideoDurationSec(creatorCustomDurationSec);
      return;
    }

    const selectedOption = getCreatorDurationOptions().find(
      (option) => option.preset === preset
    );

    if (selectedOption) {
      setCreatorVideoDurationSec(selectedOption.seconds);
    }
  };

  const handleCreatorCustomDurationChange = (rawValue: string) => {
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    const nextDurationSec = creatorFormat === "youtube_video"
      ? Math.round(parsed * 60)
      : Math.round(parsed);
    const minDuration = creatorFormat === "youtube_video" ? 60 : 5;
    const maxDuration = creatorFormat === "youtube_video" ? 3600 : 180;
    const clampedDuration = Math.min(maxDuration, Math.max(minDuration, nextDurationSec));

    setCreatorCustomDurationSec(clampedDuration);
    setCreatorVideoDurationSec(clampedDuration);
    setCreatorDurationPreset("custom");
  };

  const applyPatternRecommendedDuration = () => {
    const recommended = youtubePatternSummary?.recommendedDurationSec;

    if (!recommended) {
      return;
    }

    const nextFormat: CreatorFormat = recommended <= 90 ? "short_form" : "youtube_video";
    const nearestOption = getNearestCreatorDurationOption(nextFormat, recommended);

    setCreatorFormat(nextFormat);
    setCreatorDurationPreset(nearestOption.preset);
    setCreatorVideoDurationSec(nearestOption.seconds);
    setCreatorCustomDurationSec(nearestOption.seconds);
  };

  const getCreatorContentTypeLabel = () => {
    return (
      CREATOR_CONTENT_TYPE_OPTIONS.find((option) => option.value === creatorContentType)
        ?.label || creatorContentType
    );
  };

  const handleYoutubeResearch = async () => {
    if (!input.trim()) {
      setError(
        uiLanguage === "en"
          ? "Please enter a topic or video idea before running YouTube analysis."
          : "YouTube analizi için önce bir konu veya video fikri yaz."
      );
      return;
    }

    setYoutubeResearchLoading(true);
    setYoutubeResearchVideos([]);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/youtube-research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: input,
          country: creatorCountry,
          countryLabel: getCreatorCountryLabel(),
          language,
          maxResults: 12,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error ||
            (uiLanguage === "en"
              ? "YouTube research could not be completed."
              : "YouTube araştırması tamamlanamadı.")
        );
      }

      setYoutubeResearchVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (e: any) {
      console.error("handleYoutubeResearch error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "YouTube research failed."
            : "YouTube araştırması sırasında hata oluştu.")
      );
    } finally {
      setYoutubeResearchLoading(false);
    }
  };

  const handleYoutubePatternEngine = async () => {
    if (!youtubeResearchVideos.length) {
      setError(ui.patternEngineEmpty);
      return;
    }

    setYoutubePatternLoading(true);
    setYoutubePatternSummary(null);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/youtube-pattern-engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: input,
          country: getCreatorCountryLabel(),
          ageGroup: creatorAgeGroup,
          contentType: getCreatorContentTypeLabel(),
          format: getCreatorFormatLabel(),
          qualityMode: creatorQualityMode,
          language,
          videos: youtubeResearchVideos,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.summary) {
        throw new Error(
          data?.error ||
            (uiLanguage === "en"
              ? "Pattern analysis could not be completed."
              : "Pattern analizi tamamlanamadı.")
        );
      }

      setYoutubePatternSummary(data.summary as YoutubePatternSummary);
    } catch (e: any) {
      console.error("handleYoutubePatternEngine error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Pattern analysis failed."
            : "Pattern analizi sırasında hata oluştu.")
      );
    } finally {
      setYoutubePatternLoading(false);
    }
  };

  const handleBulkGenerateIdeas = async () => {
    const topics = bulkTopics
      .split("\n")
      .map((topic: string) => topic.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (!topics.length) {
      setError(
        uiLanguage === "en"
          ? "Please enter at least one topic."
          : "Lütfen en az bir konu gir."
      );
      return;
    }

    setBulkLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/bulk-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topics,
          language,
          targetMarket: creatorCountry,
          ageGroup: creatorAgeGroup,
          contentType: creatorContentType,
          format: creatorFormat,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !Array.isArray(data?.ideas)) {
        throw new Error(data?.error || "Bulk idea generation failed.");
      }

      setBulkResults(data.ideas as BulkIdeaResult[]);
      setSelectedBulkIds([]);
    } catch (e: any) {
      console.error("handleBulkGenerateIdeas error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Bulk ideas could not be generated."
            : "Toplu fikirler üretilemedi.")
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUseBulkTopic = (idea: BulkIdeaResult) => {
    setInput(idea.topic || idea.title || "");
    setSaveMessage(ui.bulkTopicApplied);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerateFullPackageFromBulk = async (idea: BulkIdeaResult) => {
    const nextTopic = idea.topic || idea.title || "";

    if (!nextTopic.trim()) {
      return;
    }

    setInput(nextTopic);
    setSaveMessage(ui.bulkPackageStarted);
    await handleGenerateFullYoutubePackage(nextTopic);
  };

  const toggleBulkSelection = (index: number) => {
    setSelectedBulkIds((prev) =>
      prev.includes(index)
        ? prev.filter((item) => item !== index)
        : [...prev, index]
    );
  };

  const handleGenerateSelectedBulk = async () => {
    const selectedIdeas = selectedBulkIds
      .map((index) => bulkResults[index])
      .filter((idea): idea is BulkIdeaResult => Boolean(idea));

    if (selectedIdeas.length === 0) {
      return;
    }

    setSelectedBulkLoading(true);
    setError("");
    setSaveMessage("");

    try {
      for (const idea of selectedIdeas) {
        const nextTopic = idea.topic || idea.title || "";

        if (nextTopic.trim()) {
          setInput(nextTopic);
          await handleGenerateFullYoutubePackage(nextTopic, {
            forceNewProject: true,
          });
        }
      }

      setSaveMessage(
        uiLanguage === "en"
          ? "Selected bulk ideas generated as separate projects ✅"
          : "Seçilen bulk fikirleri ayrı projeler olarak üretildi ✅"
      );
    } catch (e: any) {
      console.error("handleGenerateSelectedBulk error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Selected bulk ideas could not be generated."
            : "Seçilen bulk fikirleri üretilemedi.")
      );
    } finally {
      setSelectedBulkLoading(false);
    }
  };

  const buildCreatorTimelineInputScenes = (
    sourceScenes: Array<Partial<CreatorProductionScene & Scene>>
  ) =>
    sourceScenes.map((scene, index) => ({
      id: scene.id || index + 1,
      text: scene.text || scene.narration || `CreatorLab scene ${index + 1}`,
      narration: scene.narration || "",
      dialogue: scene.dialogue || "",
      visualPrompt:
        scene.visualPrompt ||
        scene.motionHint ||
        scene.cameraDirection ||
        `Professional CreatorLab visual beat ${index + 1}`,
      cameraDirection: scene.cameraDirection || "Clean editorial shot with readable composition.",
      motionHint: scene.motionHint || "controlled editorial motion",
    }));

  const fetchCreatorTimelinePreviewPlan = async (
    topicForPreview: string,
    mentorAnalysisOverride?: CreatorMentorResult | null,
    scenesOverride?: Array<Partial<CreatorProductionScene & Scene>> | null,
  ) => {
    const accessToken = await getAccessTokenOrThrow();

    const res = await fetch("/api/creator-timeline-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        topic: topicForPreview,
        country: getCreatorCountryLabel(),
        ageGroup: creatorAgeGroup,
        contentType: getCreatorContentTypeLabel(),
        format: getCreatorFormatLabel(),
        durationSec: creatorVideoDurationSec,
        qualityMode: creatorQualityMode,
        sceneCount: scenesOverride?.length || getCreatorSceneCount(),
        language,
        mentorAnalysis: mentorAnalysisOverride || creatorMentorResult,
        scenes:
          scenesOverride && scenesOverride.length > 0
            ? buildCreatorTimelineInputScenes(scenesOverride)
            : undefined,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success || !data?.timelineSyncPlan) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "Timeline preview could not be generated."
            : "Timeline önizlemesi oluşturulamadı."),
      );
    }

    return data.timelineSyncPlan as TimelineSyncPlan;
  };

  const handleGenerateCreatorEditPlan = () => {
    const nextPlan =
      creatorProductionPackage?.timelineSyncPlan || creatorTimelinePreviewPlan;

    if (!nextPlan) {
      setError(
        uiLanguage === "en"
          ? "Generate a timeline preview before creating an edit plan."
          : "Edit plan oluşturmadan önce timeline önizlemesi üret."
      );
      return;
    }

    const nextEditPlan = createCreatorEditPlanFromTimeline(nextPlan);
    setCreatorEditPlan(nextEditPlan);
    setSaveMessage(
      nextEditPlan.status === "needs_edit_plan"
        ? uiLanguage === "en"
          ? "Edit plan is ready. Review the risky scenes before paid rendering."
          : "Edit plan hazır. Ücretli render öncesi riskli sahneleri kontrol et."
        : uiLanguage === "en"
          ? "Edit plan is ready. Timeline is safe for rendering."
          : "Edit plan hazır. Timeline render için güvenli."
    );
  };

  const handleOptimizeCreatorTimeline = async () => {
    const sourceScenes =
      creatorProductionPackage?.scenes?.length
        ? creatorProductionPackage.scenes
        : scenes.length > 0
          ? scenes
          : [];

    if (sourceScenes.length === 0) {
      setError(
        uiLanguage === "en"
          ? "Create the text production stage first. Timeline optimization needs editable scenes, but it will not generate image, video, or voice assets."
          : "Önce text production stage oluştur. Timeline optimizasyonu düzenlenebilir sahnelere ihtiyaç duyar; görsel, video veya ses üretmez."
      );
      return;
    }

    setCreatorTimelineOptimizeLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const initialPlan = await fetchCreatorTimelinePreviewPlan(
        input.trim() || creatorProductionPackage?.title || "CreatorLab video",
        creatorMentorResult,
        sourceScenes,
      );

      const optimizedScenes = creatorTimelineNeedsEditPlan(initialPlan)
        ? optimizeCreatorScenesForTimelineText(sourceScenes, initialPlan)
        : sourceScenes;

      const nextPlan =
        optimizedScenes !== sourceScenes
          ? await fetchCreatorTimelinePreviewPlan(
              input.trim() || creatorProductionPackage?.title || "CreatorLab video",
              creatorMentorResult,
              optimizedScenes,
            )
          : initialPlan;

      setCreatorTimelinePreviewPlan(nextPlan);
      setCreatorEditPlan(createCreatorEditPlanFromTimeline(nextPlan));

      if (creatorProductionPackage) {
        setCreatorProductionPackage({
          ...creatorProductionPackage,
          scenes: normalizeScenesWithIntelligence(
            optimizedScenes as CreatorProductionScene[],
          ) as CreatorProductionScene[],
          timelineSyncPlan: nextPlan,
        });
      } else if (scenes.length > 0) {
        setScenes(
          normalizeScenesWithIntelligence(optimizedScenes as Scene[]) as Scene[],
        );
      }

      setSaveMessage(
        optimizedScenes !== sourceScenes
          ? uiLanguage === "en"
            ? "Timeline optimized the editable scene narration. No image, video, voice, or export credit usage was triggered."
            : "Timeline, düzenlenebilir sahne anlatımlarını kısalttı. Görsel, video, ses veya export kredi kullanımı tetiklenmedi."
          : uiLanguage === "en"
            ? "Timeline checked against actual editable scenes. No image, video, voice, or export credit usage was triggered."
            : "Timeline, gerçek düzenlenebilir sahnelere göre kontrol edildi. Görsel, video, ses veya export kredi kullanımı tetiklenmedi."
      );
    } catch (e: any) {
      console.error("handleOptimizeCreatorTimeline error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Timeline optimization failed."
            : "Timeline optimizasyonu başarısız oldu.")
      );
    } finally {
      setCreatorTimelineOptimizeLoading(false);
    }
  };

  const handleGenerateFullYoutubePackage = async (
    topicOverride?: string,
    options?: { forceNewProject?: boolean }
  ) => {
    const topic = (topicOverride || input).trim();
    const forceNewProject = Boolean(options?.forceNewProject);

    if (!isCreatorLabFlow) {
      return;
    }

    if (!topic) {
      setError(
        uiLanguage === "en"
          ? "Please enter a topic or video idea first."
          : "Lütfen önce bir konu veya video fikri yaz."
      );
      return;
    }

    setCreatorTimelinePreviewLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const guardPlan = await fetchCreatorTimelinePreviewPlan(topic);
      setCreatorTimelinePreviewPlan(guardPlan);

      if (creatorTimelineNeedsEditPlan(guardPlan)) {
        setCreatorEditPlan(createCreatorEditPlanFromTimeline(guardPlan));
        setSaveMessage(
          uiLanguage === "en"
            ? "Pre-render guard stopped the full package. Review the edit plan before paid cinematic rendering."
            : "Render öncesi kontrol tam paketi durdurdu. Ücretli cinematic render öncesi edit planı kontrol et."
        );
        return;
      }

      setCreatorEditPlan(null);
    } catch (e: any) {
      console.error("pre-render timeline guard error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Pre-render timeline check failed."
            : "Render öncesi timeline kontrolü başarısız oldu.")
      );
      return;
    } finally {
      setCreatorTimelinePreviewLoading(false);
    }

    setIsGeneratingFullYoutubePackage(true);
    setCreatorMentorLoading(true);
    setCreatorProductionLoading(true);
    setYoutubeMetadataLoading(true);
    setYoutubeThumbnailLoading(true);
    setSceneOptimizationAILoading(true);
    setLoadingSetup(true);
    setError("");
    setSaveMessage("");

    try {
      const accessToken = await getAccessTokenOrThrow();

      // 1) Mentor analysis
      const mentorRes = await fetch("/api/creator-mentor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic,
          country: getCreatorCountryLabel(),
          ageGroup: creatorAgeGroup,
          contentType: getCreatorContentTypeLabel(),
          format: getCreatorFormatLabel(),
          qualityMode: creatorQualityMode,
          language,
          youtubeData: youtubeResearchVideos,
          creatorProfile,
        }),
      });

      const mentorData = await mentorRes.json().catch(() => null);

      if (!mentorRes.ok || !mentorData?.success || !mentorData?.analysis) {
        throw new Error(
          mentorData?.error ||
            (uiLanguage === "en"
              ? "Creator mentor analysis could not be generated."
              : "Creator mentor analizi oluşturulamadı.")
        );
      }

      const nextMentorResult = mentorData.analysis as CreatorMentorResult;
      setCreatorMentorResult(nextMentorResult);
      setCreatorMentorLoading(false);

      // 2) Production package
      const productionRes = await fetch("/api/creator-production", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic,
          country: getCreatorCountryLabel(),
          ageGroup: creatorAgeGroup,
          contentType: getCreatorContentTypeLabel(),
          format: getCreatorFormatLabel(),
          durationSec: creatorVideoDurationSec,
          qualityMode: creatorQualityMode,
          sceneCount: getCreatorSceneCount(),
          language,
          mentorAnalysis: nextMentorResult,
          creatorProfile,
        }),
      });

      const productionData = await productionRes.json().catch(() => null);

      if (
        !productionRes.ok ||
        !productionData?.success ||
        !productionData?.productionPackage
      ) {
        throw new Error(
          productionData?.error ||
            (uiLanguage === "en"
              ? "Production package could not be generated."
              : "Üretim paketi oluşturulamadı.")
        );
      }

      const nextPackage = optimizeCreatorPackageOpeningHook(
        productionData.productionPackage as CreatorProductionPackage,
        topic
      );
      const nextCharacters = normalizeCreatorLabCharacters(
        Array.isArray(nextPackage.characters)
          ? nextPackage.characters.map((character: Character) => ({
              ...character,
              voiceId: character.voiceId || "",
            }))
          : []
      );
      const nextVisualBible = nextPackage.visualBible || emptyVisualBible;

      setCreatorProductionPackage(nextPackage);
      setCreatorTimelinePreviewPlan(nextPackage.timelineSyncPlan || null);
      setRefinedCreatorScenes([]);
      setStorySetup({
        title: nextPackage.title || "",
        storyPremise: nextPackage.storyPremise || "",
        characters: nextCharacters,
        visualBible: nextVisualBible,
      });
      setTitle(nextPackage.title || "");
      setCharacters(nextCharacters);
      setVisualBible(nextVisualBible);
      setScenes([]);
      setContinuePrompt("");
      setEditingSceneId(null);
      setSceneInstructions({});
      setBranchingSceneId(null);
      setBranchInstructions({});
      setExportedMovieUrl("");
      setExportMovieResult(null);
      setExportSignature("");
      setCreatorProductionLoading(false);

      // 3) YouTube metadata
      const metadataRes = await fetch("/api/creator-youtube-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          package: nextPackage,
          language,
          targetMarket: creatorCountry,
          ageGroup: creatorAgeGroup,
          contentType: creatorContentType,
          creatorFormat,
          videoDurationSec: creatorVideoDurationSec,
          patternSummary: youtubePatternSummary,
        }),
      });

      const metadataData = await metadataRes.json().catch(() => null);

      if (!metadataRes.ok || !metadataData?.metadata) {
        throw new Error(metadataData?.error || "YouTube metadata üretilemedi.");
      }

      const nextMetadata = metadataData.metadata as YoutubeMetadataResult;
      setYoutubeMetadataResult(nextMetadata);
      setYoutubeMetadataLoading(false);

      // 4) Thumbnail
      // Scene-based thumbnail selection is intentionally used to avoid extra AI image credit usage.
      // A thumbnail will be selected manually or automatically from generated scene images.
      const nextThumbnail: YoutubeThumbnailResult | null = null;
      setYoutubeThumbnailResult(null);
      setYoutubeThumbnailLoading(false);

      // 5) AI credit-efficiency optimization
      const optimizeRes = await fetch("/api/optimize-scenes-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenes: nextPackage.scenes || [],
          mode: "balanced",
          estimatedVideoCostUsd: CREATOR_DEFAULT_VIDEO_SCENE_COST_USD,
          language,
          ageGroup: creatorAgeGroup,
          contentType: creatorContentType,
          videoDurationSec: creatorVideoDurationSec,
          title: nextPackage.title || "",
          storyPremise: nextPackage.storyPremise || "",
        }),
      });

      const optimizeData = await optimizeRes.json().catch(() => null);

      if (!optimizeRes.ok) {
        throw new Error(optimizeData?.error || "AI scene optimization failed.");
      }

      const nextOptimizationResult = optimizeData?.result || [];
      const nextOptimizationSummary = optimizeData?.summary || null;

      setSceneOptimizationResult(nextOptimizationResult);
      setSceneOptimizationSummary(nextOptimizationSummary);
      setSceneOptimizationAILoading(false);

      // 6) Persist without rendering video/image/audio.
      const saveRes = await fetch("/api/save-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          projectId: forceNewProject ? undefined : currentProjectId || undefined,
          childId: getProjectChildId(),
          title: nextPackage.title || topic,
          inputPrompt: topic,
          flowKey: activeFlowKey,
          flowTitle: selectedFlow.title,
          flowType: activeFlowKey || "storyverse",
          language,
          storyPremise: nextPackage.storyPremise || "",
          characters: nextCharacters,
          visualBible: nextVisualBible,
          scenes: [],
          creatorMentorResult: nextMentorResult,
          creatorProductionPackage: nextPackage,
          youtubeMetadataResult: nextMetadata,
          youtubeThumbnailResult: nextThumbnail,
          sceneOptimizationResult: nextOptimizationResult,
          sceneOptimizationSummary: nextOptimizationSummary,
          exportedMovieUrl: null,
          exportedMovieResult: null,
          exportSignature: null,
        }),
      });

      const saveData = await saveRes.json().catch(() => null);

      if (!saveRes.ok) {
        throw new Error(saveData?.error || "Auto mode package kaydedilemedi.");
      }

      if (saveData?.project?.id && !forceNewProject) {
        setCurrentProjectId(saveData.project.id);
        setLoadProjectId(saveData.project.id);
      }

      await fetchProjects();

      setSaveMessage(ui.fullYoutubePackageReady);
    } catch (e: any) {
      console.error("handleGenerateFullYoutubePackage error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "YouTube Auto Mode failed."
            : "YouTube Auto Mode sırasında hata oluştu.")
      );
    } finally {
      setIsGeneratingFullYoutubePackage(false);
      setCreatorMentorLoading(false);
      setCreatorProductionLoading(false);
      setYoutubeMetadataLoading(false);
      setYoutubeThumbnailLoading(false);
      setSceneOptimizationAILoading(false);
      setLoadingSetup(false);
    }
  };

  const handleCreatorMentorAnalysis = async () => {
    if (!input.trim()) {
      setError(
        uiLanguage === "en"
          ? "Please enter a topic or video idea first."
          : "Lütfen önce bir konu veya video fikri yaz."
      );
      return;
    }

    setCreatorMentorLoading(true);
    setLoadingSetup(true);
    setCreatorMentorResult(null);
    setCreatorTimelinePreviewPlan(null);
    setCreatorProductionPackage(null);
    setError("");
    setSaveMessage("");

    try {
      const accessToken = await getAccessTokenOrThrow();

      const res = await fetch("/api/creator-mentor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic: input,
          country: getCreatorCountryLabel(),
          ageGroup: creatorAgeGroup,
          contentType: getCreatorContentTypeLabel(),
          format: getCreatorFormatLabel(),
          qualityMode: creatorQualityMode,
          language,
          youtubeData: youtubeResearchVideos,
          creatorProfile,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.analysis) {
        throw new Error(
          data?.error ||
            (uiLanguage === "en"
              ? "Creator mentor analysis could not be generated."
              : "Creator mentor analizi oluşturulamadı.")
        );
      }

      setCreatorMentorResult(data.analysis as CreatorMentorResult);
      setSaveMessage(
        uiLanguage === "en"
          ? "Creator mentor analysis is ready ✅"
          : "Creator mentor analizi hazır ✅"
      );
    } catch (e: any) {
      console.error("handleCreatorMentorAnalysis error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Creator mentor analysis failed."
            : "Creator mentor analizi sırasında hata oluştu.")
      );
    } finally {
      setCreatorMentorLoading(false);
      setLoadingSetup(false);
    }
  };


  const handleCreatorTimelinePreviewOnly = async () => {
    const topic = input.trim();

    if (!topic) {
      setError(
        uiLanguage === "en"
          ? "Please enter a CreatorLab topic before previewing the timeline."
          : "Timeline önizlemesi için önce CreatorLab konusu gir."
      );
      return;
    }

    setCreatorTimelinePreviewLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const nextPlan = await fetchCreatorTimelinePreviewPlan(topic);
      setCreatorTimelinePreviewPlan(nextPlan);
      setCreatorEditPlan(null);
      setSaveMessage(
        uiLanguage === "en"
          ? "Dry-run timeline preview is ready. No video, image, voice, or export credit usage was triggered."
          : "Dry-run timeline önizlemesi hazır. Video, görsel, ses veya export kredi kullanımı tetiklenmedi."
      );
    } catch (e: any) {
      console.error("handleCreatorTimelinePreviewOnly error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Timeline preview failed."
            : "Timeline önizlemesi sırasında hata oluştu.")
      );
    } finally {
      setCreatorTimelinePreviewLoading(false);
    }
  };


  const handleCreatorProductionPackage = async () => {
    if (!creatorMentorResult) {
      setError(
        uiLanguage === "en"
          ? "Please run the mentor analysis first."
          : "Lütfen önce mentor analizini oluştur."
      );
      return;
    }

    setCreatorProductionLoading(true);
    setLoadingSetup(true);
    setError("");
    setSaveMessage("");

    try {
      const accessToken = await getAccessTokenOrThrow();

      const res = await fetch("/api/creator-production", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic: input,
          country: getCreatorCountryLabel(),
          ageGroup: creatorAgeGroup,
          contentType: getCreatorContentTypeLabel(),
          format: getCreatorFormatLabel(),
          durationSec: creatorVideoDurationSec,
          qualityMode: creatorQualityMode,
          sceneCount: getCreatorSceneCount(),
          language,
          mentorAnalysis: creatorMentorResult,
          creatorProfile,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.productionPackage) {
        throw new Error(
          data?.error ||
            (uiLanguage === "en"
              ? "Production package could not be generated."
              : "Üretim paketi oluşturulamadı.")
        );
      }

      const nextPackage = optimizeCreatorPackageOpeningHook(
        {
          ...(data.productionPackage as CreatorProductionPackage),
          scenes: normalizeScenesWithIntelligence(
            ((data.productionPackage as CreatorProductionPackage).scenes || []) as CreatorProductionScene[]
          ) as CreatorProductionScene[],
        },
        input
      );

      setCreatorProductionPackage(nextPackage);
      setCreatorTimelinePreviewPlan(nextPackage.timelineSyncPlan || null);
      setRefinedCreatorScenes([]);

      setStorySetup({
        title: nextPackage.title || "",
        storyPremise: nextPackage.storyPremise || "",
        characters: normalizeCreatorLabCharacters(
          Array.isArray(nextPackage.characters)
            ? nextPackage.characters.map((character: Character) => ({
                ...character,
                voiceId: character.voiceId || "",
              }))
            : []
        ),
        visualBible: nextPackage.visualBible || emptyVisualBible,
      });

      setTitle(nextPackage.title || "");
      setCharacters(
        normalizeCreatorLabCharacters(
          Array.isArray(nextPackage.characters)
            ? nextPackage.characters.map((character: Character) => ({
                ...character,
                voiceId: character.voiceId || "",
              }))
            : []
        )
      );
      setVisualBible(nextPackage.visualBible || emptyVisualBible);
      setScenes([]);
      setContinuePrompt("");
      setEditingSceneId(null);
      setSceneInstructions({});
      setBranchingSceneId(null);
      setBranchInstructions({});
      setExportedMovieUrl("");
      setExportMovieResult(null);
      setExportSignature("");

      setSaveMessage(ui.productionPackageReady);
    } catch (e: any) {
      console.error("handleCreatorProductionPackage error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Production package generation failed."
            : "Üretim paketi oluşturulurken hata oluştu.")
      );
    } finally {
      setCreatorProductionLoading(false);
      setLoadingSetup(false);
    }
  };


  const handleOptimizeScenes = async () => {
    const sourceScenes =
      creatorProductionPackage?.scenes?.length
        ? creatorProductionPackage.scenes
        : scenes;

    if (!sourceScenes || sourceScenes.length === 0) {
      setError(
        uiLanguage === "en"
          ? "Create scenes or a production package first."
          : "Önce sahneleri veya üretim paketini oluşturmalısın."
      );
      return;
    }

    setSceneOptimizationLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/optimize-scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenes: sourceScenes,
          mode: "balanced",
          estimatedVideoCostUsd: CREATOR_DEFAULT_VIDEO_SCENE_COST_USD,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Scene optimization failed.");
      }

      setSceneOptimizationResult(data.result || []);
      setSceneOptimizationSummary(data.summary || null);
    } catch (e: any) {
      console.error("handleOptimizeScenes error:", e);
      setError(e?.message || "Scene optimization failed.");
    } finally {
      setSceneOptimizationLoading(false);
    }
  };

  const handleOptimizeScenesAI = async () => {
    const sourceScenes =
      creatorProductionPackage?.scenes?.length
        ? creatorProductionPackage.scenes
        : scenes;

    if (!sourceScenes || sourceScenes.length === 0) {
      setError(
        uiLanguage === "en"
          ? "Create scenes or a production package first."
          : "Önce sahneleri veya üretim paketini oluşturmalısın."
      );
      return;
    }

    setSceneOptimizationAILoading(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/optimize-scenes-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenes: sourceScenes,
          mode: "balanced",
          estimatedVideoCostUsd: CREATOR_DEFAULT_VIDEO_SCENE_COST_USD,
          language,
          ageGroup: creatorAgeGroup,
          contentType: creatorContentType,
          videoDurationSec: creatorVideoDurationSec,
          title: creatorProductionPackage?.title || title,
          storyPremise: creatorProductionPackage?.storyPremise || storySetup?.storyPremise || "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AI scene optimization failed.");
      }

      setSceneOptimizationResult(data.result || []);
      setSceneOptimizationSummary(data.summary || null);
      setSaveMessage(
        uiLanguage === "en"
          ? "AI optimization completed ✅"
          : "AI optimizasyon tamamlandı ✅"
      );
    } catch (e: any) {
      console.error("handleOptimizeScenesAI error:", e);
      setError(e?.message || "AI scene optimization failed.");
    } finally {
      setSceneOptimizationAILoading(false);
    }
  };

  const handleApplySceneOptimization = () => {
    if (!sceneOptimizationResult.length) {
      return;
    }

    setScenes((prev) =>
      prev.map((scene) => {
        const recommendation = sceneOptimizationResult.find(
          (item) => Number(item.sceneId) === Number(scene.id)
        );

        if (!recommendation) {
          return scene;
        }

        return {
          ...scene,
          renderMode: recommendation.exportMode,
        };
      })
    );

    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    setSaveMessage(ui.optimizationApplied);
  };

  const handleDownloadCreatorPackage = async () => {
    if (!creatorProductionPackage) {
      setError(
        uiLanguage === "en"
          ? "Create a production package first."
          : "Önce üretim paketini oluşturmalısın."
      );
      return;
    }

    if (!exportedMovieUrl && !exportMovieResult?.movieUrl) {
      setError(
        uiLanguage === "en"
          ? "Create the final movie first."
          : "Önce final filmi oluşturmalısın."
      );
      return;
    }

    setIsDownloadingCreatorPackage(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/export-creator-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          videoUrl: exportMovieResult?.downloadUrl || exportMovieResult?.movieUrl || exportedMovieUrl,
          productionPackage: creatorProductionPackage,
          metadata: youtubeMetadataResult,
          creatorIntelligence: creatorIntelligenceReport,
          thumbnail: youtubeThumbnailResult,
          scenes,
          timelineSyncPlan: creatorProductionPackage?.timelineSyncPlan,
          language,
          flowType: activeFlowKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Creator package indirilemedi.");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = (title || creatorProductionPackage.title || "velto-creator-package")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      link.href = blobUrl;
      link.download = `${safeTitle || "velto-creator-package"}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);

      setCreatorPackageDownloaded(true);
      setSaveMessage(
        uiLanguage === "en"
          ? "Creator package downloaded ✅"
          : "Creator package indirildi ✅"
      );
    } catch (e: any) {
      console.error("handleDownloadCreatorPackage error:", e);
      setError(e?.message || "Creator package indirilemedi.");
    } finally {
      setIsDownloadingCreatorPackage(false);
    }
  };

  const getShortThumbnailHeadline = () => {
    const textCandidates = [
      youtubeMetadataResult?.thumbnailTextIdeas?.[0],
      creatorProductionPackage?.hook,
      youtubeMetadataResult?.recommendedTitle,
      creatorProductionPackage?.title,
      title,
      input,
    ];

    const sourceText =
      textCandidates.find((item) => typeof item === "string" && item.trim()) ||
      "HOW?!";

    const normalized = sourceText
      .replace(/did you know/gi, "")
      .replace(/discover/gi, "")
      .replace(/learn/gi, "")
      .replace(/explained/gi, "")
      .replace(/fun facts?/gi, "")
      .replace(/[?.!,]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/octopus|octop/i.test(normalized)) {
      return uiLanguage === "en" ? "THREE HEARTS?!" : "3 KALP?!";
    }

    if (/rocket|roket/i.test(normalized)) {
      return uiLanguage === "en" ? "ROCKET POWER?!" : "ROKET GÜCÜ?!";
    }

    if (/gravity|yer çekimi|yerçekimi/i.test(normalized)) {
      return uiLanguage === "en" ? "NO GRAVITY?!" : "YER ÇEKİMİ YOK?!";
    }

    if (/sun|güneş/i.test(normalized)) {
      return uiLanguage === "en" ? "NO SUN?!" : "GÜNEŞ YOK?!";
    }

    const words = normalized
      .split(" ")
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");

    return `${words || "HOW"}?!`.toUpperCase();
  };

  const buildPremiumThumbnailPrompt = () => {
    const packageTitle = creatorProductionPackage?.title || title || input || "YouTube video";
    const packageHook = creatorProductionPackage?.hook || youtubeMetadataResult?.audiencePromise || "";
    const thumbnailIdea = creatorProductionPackage?.thumbnailIdea || "";
    const recommendedTitle = youtubeMetadataResult?.recommendedTitle || "";
    const thumbnailTextIdeas = Array.isArray(youtubeMetadataResult?.thumbnailTextIdeas)
      ? youtubeMetadataResult?.thumbnailTextIdeas.join(" | ")
      : "";
    const shortHeadline = getShortThumbnailHeadline();

    return [
      `Create a premium 16:9 YouTube thumbnail for a professional creator video titled: ${packageTitle}`,
      packageHook ? `Core hook: ${packageHook}` : "",
      recommendedTitle ? `YouTube title: ${recommendedTitle}` : "",
      thumbnailIdea ? `Thumbnail idea: ${thumbnailIdea}` : "",
      thumbnailTextIdeas ? `Raw text ideas to simplify: ${thumbnailTextIdeas}` : "",
      `Use this short thumbnail headline concept only: ${shortHeadline}`,
      "Do not use Joe or a default child presenter unless the user explicitly requested that character.",
      "Use a professional presenter, faceless creator visual, product-led composition, or bold symbolic subject depending on the topic.",
      "Use one oversized focal object related to the topic on the opposite side of the frame.",
      "Make the image feel like a scroll-stopping YouTube thumbnail, not an educational poster or infographic.",
      "Use bold contrast, cinematic lighting, large readable shapes, platform-native creator energy, strong depth, and premium visual style.",
      "Leave clean empty space for a short headline overlay. Prefer no rendered text inside the image; if text appears, use only the short headline.",
      "Avoid multi-line text, subtitles, poster layout, labels, arrows, clutter, tiny details, scary imagery, or confusing composition.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const generatePremiumYoutubeThumbnailImage = async () => {
    if (!canRunCreatorMediaAction("visuals")) {
      throw new Error(getCreatorMediaActionError());
    }

    const thumbnailPrompt = buildPremiumThumbnailPrompt();

    const imageRes = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productProfile: "creatorlab",
        qualityMode: creatorQualityMode,
        creatorFormat,
        title: limitForImagePrompt(
          youtubeMetadataResult?.recommendedTitle || creatorProductionPackage?.title || title,
          180
        ),
        sceneText: limitForImagePrompt(thumbnailPrompt, 1200),
        cameraDirection:
          "wide 16:9 YouTube thumbnail composition, large subject focus, bold readable layout",
        emotion: "surprise, curiosity, excitement",
        motionHint:
          "dynamic hero pose, cinematic energy, clear emotional reaction",
        characters: getSafeCharactersForImagePrompt(thumbnailPrompt),
        visualBible: getSafeVisualBibleForImagePrompt(),
        isThumbnail: true,
        premiumVisualMode: true,
        imageUseCase: "thumbnail",
      }),
    });

    const imageData = await imageRes.json();

    if (!imageRes.ok || !imageData?.image) {
      throw new Error(imageData?.error || "Premium thumbnail görseli üretilemedi.");
    }

    const storeRes = await fetch("/api/store-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageData.image,
        sceneId: "thumbnail",
        projectId: getProjectKey(),
      }),
    });

    const storeData = await storeRes.json();

    if (!storeRes.ok || !storeData?.ok || !storeData?.imageUrl) {
      throw new Error(storeData?.error || "Thumbnail kalıcı olarak kaydedilemedi.");
    }

    return {
      imageUrl: storeData.imageUrl as string,
      prompt: thumbnailPrompt,
      headline:
        youtubeMetadataResult?.thumbnailTextIdeas?.[0] ||
        youtubeMetadataResult?.recommendedTitle ||
        creatorProductionPackage?.youtubeTitle ||
        creatorProductionPackage?.title ||
        "",
      subHeadline:
        youtubeMetadataResult?.thumbnailTextIdeas?.[1] ||
        creatorProductionPackage?.hook ||
        creatorProductionPackage?.thumbnailIdea ||
        "",
    };
  };

  const buildSceneBasedThumbnailResult = (scene: Scene): YoutubeThumbnailResult => {
    return {
      imageUrl: scene.image || "",
      prompt:
        uiLanguage === "en"
          ? `Selected from Scene ${scene.id}. No extra AI thumbnail image was generated.`
          : `Sahne ${scene.id} içinden seçildi. Ek AI thumbnail görseli üretilmedi.`,
      headline:
        youtubeMetadataResult?.thumbnailTextIdeas?.[0] ||
        youtubeMetadataResult?.recommendedTitle ||
        creatorProductionPackage?.youtubeTitle ||
        creatorProductionPackage?.title ||
        title ||
        "",
      subHeadline:
        youtubeMetadataResult?.thumbnailTextIdeas?.[1] ||
        creatorProductionPackage?.hook ||
        creatorProductionPackage?.thumbnailIdea ||
        "",
    };
  };

  const handleSelectSceneAsYoutubeThumbnail = (scene: Scene) => {
    if (!scene.image) {
      setError(
        uiLanguage === "en"
          ? "This scene does not have an image yet."
          : "Bu sahnede henüz görsel yok."
      );
      return;
    }

    setYoutubeThumbnailResult(buildSceneBasedThumbnailResult(scene));
    setSaveMessage(
      uiLanguage === "en"
        ? `Scene ${scene.id} selected as thumbnail ✅`
        : `Sahne ${scene.id} thumbnail olarak seçildi ✅`
    );
  };

  const handleGenerateYoutubeThumbnail = async () => {
    if (!creatorProductionPackage) {
      setError(
        uiLanguage === "en"
          ? "Create a production package first."
          : "Önce üretim paketini oluşturmalısın."
      );
      return;
    }

    const sceneCandidates = scenes.filter((scene) => scene.image);

    if (!sceneCandidates.length) {
      setError(
        uiLanguage === "en"
          ? "Generate scene images first. Thumbnail selection now uses existing scene images only."
          : "Önce sahne görsellerini oluştur. Thumbnail seçimi artık sadece mevcut sahne görsellerini kullanıyor."
      );
      return;
    }

    setYoutubeThumbnailLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const bestScene = sceneCandidates.reduce((bestSceneCandidate, currentScene) => {
        const bestScore = calculateThumbnailScore(bestSceneCandidate.intelligence);
        const currentScore = calculateThumbnailScore(currentScene.intelligence);

        return currentScore > bestScore ? currentScene : bestSceneCandidate;
      }, sceneCandidates[0]);

      setYoutubeThumbnailResult(buildSceneBasedThumbnailResult(bestScene));
      setSaveMessage(
        uiLanguage === "en"
          ? `Best scene thumbnail selected from Scene ${bestScene.id} ✅`
          : `En iyi sahne thumbnail olarak seçildi: Sahne ${bestScene.id} ✅`
      );
    } catch (e: any) {
      console.error("handleGenerateYoutubeThumbnail error:", e);
      setError(e?.message || "Thumbnail seçilemedi.");
    } finally {
      setYoutubeThumbnailLoading(false);
    }
  };

  const handleGenerateYoutubeMetadata = async () => {
    if (!creatorProductionPackage) {
      setError(
        uiLanguage === "en"
          ? "Create a production package first."
          : "Önce üretim paketini oluşturmalısın."
      );
      return;
    }

    setYoutubeMetadataLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/creator-youtube-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          package: creatorProductionPackage,
          language,
          targetMarket: creatorCountry,
          ageGroup: creatorAgeGroup,
          contentType: creatorContentType,
          creatorFormat,
          videoDurationSec: creatorVideoDurationSec,
          patternSummary: youtubePatternSummary,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "YouTube metadata üretilemedi.");
      }

      setYoutubeMetadataResult(data.metadata as YoutubeMetadataResult);
      setSaveMessage(
        uiLanguage === "en"
          ? "YouTube metadata generated ✅"
          : "YouTube metadata üretildi ✅"
      );
    } catch (e: any) {
      console.error("handleGenerateYoutubeMetadata error:", e);
      setError(e?.message || "YouTube metadata üretilemedi.");
    } finally {
      setYoutubeMetadataLoading(false);
    }
  };

  const handleRefineCreatorScenes = async () => {
    if (!creatorProductionPackage?.scenes?.length) {
      setError(
        uiLanguage === "en"
          ? "Please create a production package first."
          : "Lütfen önce üretim paketini oluştur."
      );
      return;
    }

    setRefineScenesLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const accessToken = await getAccessTokenOrThrow();

      const res = await fetch("/api/creator-refine-scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic: input,
          country: getCreatorCountryLabel(),
          ageGroup: creatorAgeGroup,
          contentType: getCreatorContentTypeLabel(),
          format: getCreatorFormatLabel(),
          durationSec: creatorVideoDurationSec,
          qualityMode: creatorQualityMode,
          sceneCount: getCreatorSceneCount(),
          language,
          productionPackage: creatorProductionPackage,
          scenes: creatorProductionPackage.scenes,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !Array.isArray(data.scenes)) {
        throw new Error(
          data?.error ||
            (uiLanguage === "en"
              ? "Scenes could not be refined."
              : "Sahneler geliştirilemedi.")
        );
      }

      setRefinedCreatorScenes(data.scenes as CreatorProductionScene[]);
      setSaveMessage(ui.refinedScenesReady);
    } catch (e: any) {
      console.error("handleRefineCreatorScenes error:", e);
      setError(
        e?.message ||
          (uiLanguage === "en"
            ? "Scene refinement failed."
            : "Sahneler geliştirilirken hata oluştu.")
      );
    } finally {
      setRefineScenesLoading(false);
    }
  };

  const buildFlowAwarePrompt = (rawPrompt: string) => {
    const trimmedPrompt = rawPrompt.trim();

    if (!isStoryverseFlow) {
      return trimmedPrompt;
    }

    const storyverseFrame =
      language === "en"
        ? [
            "PRODUCT FLOW: Storyverse Lab.",
            "Create a child-safe AI cartoon/story experience.",
            "The output should support character creation, a coherent visual world, short scenes, narration, dialogue, and later video generation.",
            "Avoid including voice direction metadata inside narration or dialogue text.",
            "User idea:",
          ].join("\n")
        : [
            "ÜRÜN AKIŞI: Storyverse Lab.",
            "Çocuklara uygun, güvenli bir AI çizgi film / hikaye deneyimi oluştur.",
            "Çıktı; karakter oluşturma, tutarlı görsel dünya, kısa sahneler, anlatıcı metni, karakter diyaloğu ve ileride video üretimini desteklemeli.",
            "Anlatıcı veya diyalog metinlerinin içine ses tonu / anlatım tonu gibi metadata ekleme.",
            "Kullanıcı fikri:",
          ].join("\n");

    return `${storyverseFrame}\n${trimmedPrompt}`;
  };

  const getFlowAwareInputLabel = () => {
    if (isCreatorLabFlow) {
      return ui.creatorTopicLabel;
    }

    return isStoryverseFlow ? ui.storyPromptLabel : ui.genericPromptLabel;
  };

  const getFlowAwarePlaceholder = () => {
    if (isCreatorLabFlow) {
      return ui.creatorTopicPlaceholder;
    }

    return isStoryverseFlow ? ui.storyPromptPlaceholder : ui.genericPromptPlaceholder;
  };

  const createSetup = async () => {
    if (isCreatorLabFlow) {
      await handleCreatorMentorAnalysis();
      return;
    }

    if (!selectedChildId) {
      setError("Lütfen önce bir çocuk seç.");
      return;
    }

    if (!input.trim()) {
      setError("Lütfen önce hikaye fikrini yaz.");
      return;
    }

    setLoadingSetup(true);
    setError("");
    setSaveMessage("");
    resetStoryFlow();

    try {
      const res = await fetch("/api/story-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildFlowAwarePrompt(input),
          originalPrompt: input,
          flowKey: activeFlowKey,
          flowTitle: selectedFlow.title,
          language,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Karakter tasarımı oluşturulamadı.");
        return;
      }

      const nextSetup: StorySetup = {
        title: data.title || "",
        storyPremise: data.storyPremise || "",
        characters: withDefaultGuideCharacter(data.characters),
        visualBible: data.visualBible || emptyVisualBible,
      };

      setStorySetup(nextSetup);
      setTitle(nextSetup.title);
      setCharacters(nextSetup.characters);
      setVisualBible(nextSetup.visualBible);

      setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);
    } catch (e: any) {
      console.error("createSetup error:", e);
      setError(e?.message || "Kurulum oluşturulurken bir hata oluştu.");
    } finally {
      setLoadingSetup(false);
    }
  };

  const updateCharacter = (
    index: number,
    field: keyof Character,
    value: string
  ) => {
    setCharacters((prev) =>
      prev.map((character, i) =>
        i === index ? { ...character, [field]: value } : character
      )
    );
  };

  const addCharacter = () => {
    setCharacters((prev) => [
      ...prev,
      {
        name: "",
        age: "",
        appearance: "",
        outfit: "",
        accessory: "",
        personality: "",
        referenceImage: "",
        voiceId: "",
      },
    ]);
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const generateCharacterReference = async (index: number) => {
    const character = characters[index];

    if (!character) {
      setError("Karakter bulunamadı.");
      return;
    }

    if (!character.name.trim()) {
      setError("Önce karakter adı gir.");
      return;
    }

    if (!visualBible) {
      setError("Önce görsel stil bilgisi olmalı.");
      return;
    }

    setCharacterLoadingIndex(index);
    setError("");

    try {
      const res = await fetch("/api/character-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          character,
          visualBible,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Karakter referans görseli üretilemedi.");
        return;
      }

      setCharacters((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, referenceImage: data.image } : item
        )
      );
    } catch {
      setError("Karakter referans görseli oluşturulurken hata oluştu.");
    } finally {
      setCharacterLoadingIndex(null);
    }
  };

  const buildStory = async () => {
    if (isCreatorLabFlow && creatorProductionPackage?.scenes?.length) {
      setBuildingStory(true);
      setError("");
      setSaveMessage("");
      setScenes([]);
      setContinuePrompt("");
      setEditingSceneId(null);
      setSceneInstructions({});
      setBranchingSceneId(null);
      setBranchInstructions({});
      clearAllVideoPolls();
      stopDialoguePlayback();
      stopStoryPlayback();
      setExportedMovieUrl("");
      setExportMovieResult(null);
      setExportSignature("");

      try {
        const creatorSourceScenes =
          refinedCreatorScenes.length > 0
            ? refinedCreatorScenes
            : creatorProductionPackage.scenes;

        const packageScenes: Scene[] = creatorSourceScenes.map((scene, index) => ({
          id: scene.id,
          text: scene.text || "",
          narration: scene.narration || "",
          dialogue: scene.dialogue || "",
          cameraDirection: scene.cameraDirection || "",
          emotion: scene.emotion || "",
          motionHint: scene.motionHint || scene.visualPrompt || "",
          image: "",
          audioUrl: "",
          audioPath: "",
          audioSourceText: "",
          audioSettingsKey: "",
          dialogueAudioUrl: "",
          dialogueAudioPath: "",
          dialogueAudioSourceText: "",
          dialogueAudioSettingsKey: "",
          videoUrl: "",
          videoStatus: "idle",
          videoJobId: "",
          timing: buildSceneTiming(0, 0),
          intelligence: normalizeSceneIntelligenceForUi(
            scene.intelligence,
            scene,
            index,
            creatorSourceScenes.length
          ),
        }));

        setScenes(packageScenes);
        setSaveMessage(
          uiLanguage === "en"
            ? "Editable production scenes are ready. No image, video, voice, or export credit usage was triggered."
            : "Düzenlenebilir production sahneleri hazır. Görsel, video, ses veya export kredi kullanımı tetiklenmedi."
        );
      } finally {
        setBuildingStory(false);
      }

      return;
    }

    if (!title.trim()) {
      setError("Başlık boş olamaz.");
      return;
    }

    if (characters.length === 0) {
      setError("En az bir karakter olmalı.");
      return;
    }

    if (!visualBible) {
      setError("Görsel stil bilgisi eksik.");
      return;
    }

    setBuildingStory(true);
    setError("");
    setSaveMessage("");
    setScenes([]);
    setContinuePrompt("");
    setEditingSceneId(null);
    setSceneInstructions({});
    setBranchingSceneId(null);
    setBranchInstructions({});
    clearAllVideoPolls();
    stopDialoguePlayback();
    stopStoryPlayback();
    setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");

    try {
      const res = await fetch("/api/build-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          language,
          flowKey: activeFlowKey,
          flowTitle: selectedFlow.title,
          storyPremise: storySetup?.storyPremise || "",
          characters,
          visualBible,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Hikaye oluşturulamadı.");
        return;
      }

      const rawGeneratedScenes: Scene[] = data.scenes || [];
      const scenesWithImages: Scene[] = rawGeneratedScenes.map((scene: Scene, index: number) => ({
        ...scene,
        image: "",
        audioUrl: "",
        audioPath: "",
        audioSourceText: "",
        audioSettingsKey: "",
        dialogueAudioUrl: "",
        dialogueAudioPath: "",
        dialogueAudioSourceText: "",
        dialogueAudioSettingsKey: "",
        videoUrl: "",
        videoStatus: "idle",
        videoJobId: "",
        timing: buildSceneTiming(0, 0),
        intelligence: normalizeSceneIntelligenceForUi(
          scene.intelligence,
          scene,
          index,
          rawGeneratedScenes.length
        ),
      }));

      setScenes(scenesWithImages);

      for (const scene of scenesWithImages) {
        try {
          const image = await generateSceneImage(scene);

          setScenes((prev) =>
            prev.map((s) => (s.id === scene.id ? { ...s, image } : s))
          );
        } catch {}
      }
    } catch {
      setError("Hikaye oluşturulurken bir hata oluştu.");
    } finally {
      setBuildingStory(false);
    }
  };

  const redrawSceneImage = async (scene: Scene) => {
    if (!title || !visualBible || (!isCreatorLabFlow && characters.length === 0)) {
      setError(
        isCreatorLabFlow
          ? (uiLanguage === "en" ? "Complete the production setup before redrawing this scene." : "Bu sahneyi yeniden üretmeden önce production kurulumunu tamamla.")
          : "Önce hikaye kurulumu tamamlanmalı.",
      );
      return;
    }

    setRedrawLoadingId(scene.id);
    setError("");

    try {
      clearVideoPollForScene(scene.id);
      setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");

      setScenes((prev) =>
        prev.map((item) =>
          item.id === scene.id
            ? {
                ...item,
                image: "",
                videoUrl: "",
                videoStatus: "idle",
                videoJobId: "",
              }
            : item
        )
      );

      const image = await generateSceneImage(scene);

      setScenes((prev) =>
        prev.map((item) => (item.id === scene.id ? { ...item, image } : item))
      );
    } catch {
      setError("Sahne görseli yeniden oluşturulurken bir hata oluştu.");
    } finally {
      setRedrawLoadingId(null);
    }
  };

  const updateScene = async (sceneId: number) => {
    const userInstruction = sceneInstructions[sceneId]?.trim();

    if (!userInstruction) {
      setError("Lütfen sahne için bir yönlendirme yaz.");
      return;
    }

    const existingScene = scenes.find((scene) => scene.id === sceneId);

    if (!existingScene) {
      setError("Güncellenecek sahne bulunamadı.");
      return;
    }

    setSceneLoadingId(sceneId);
    setError("");

    try {
      const res = await fetch("/api/edit-scene", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          language,
          scenes,
          sceneId,
          userInstruction,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sahne güncellenemedi.");
        return;
      }

      const updatedScene = data.updatedScene || {};
      const narrationChanged =
        typeof updatedScene.narration === "string" &&
        updatedScene.narration !== existingScene.narration;
      const dialogueChanged =
        typeof updatedScene.dialogue === "string" &&
        updatedScene.dialogue !== existingScene.dialogue;

      clearSceneAudioData(sceneId);
      clearSceneDialogueAudioData(sceneId);
      clearVideoPollForScene(sceneId);
      setExportedMovieUrl("");
      setExportMovieResult(null);
      setExportSignature("");

      setScenes((prevScenes) =>
        prevScenes.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                ...updatedScene,

                // Non-destructive edit:
                // Keep existing visual assets unless the user explicitly uses redraw/regenerate image.
                image: scene.image || existingScene.image || "",
                videoUrl: "",
                videoStatus: "idle",
                videoJobId: "",

                // Audio/video must be refreshed after narration or dialogue edits.
                audioUrl: narrationChanged ? "" : scene.audioUrl,
                audioPath: narrationChanged ? "" : scene.audioPath,
                audioSourceText: narrationChanged ? "" : scene.audioSourceText,
                audioSettingsKey: narrationChanged ? "" : scene.audioSettingsKey,
                dialogueAudioUrl: dialogueChanged ? "" : scene.dialogueAudioUrl,
                dialogueAudioPath: dialogueChanged ? "" : scene.dialogueAudioPath,
                dialogueAudioSourceText: dialogueChanged
                  ? ""
                  : scene.dialogueAudioSourceText,
                dialogueAudioSettingsKey: dialogueChanged
                  ? ""
                  : scene.dialogueAudioSettingsKey,

                timing: buildSceneTiming(
                  narrationChanged ? 0 : scene.timing?.narrationDuration || 0,
                  dialogueChanged ? 0 : scene.timing?.dialogueDuration || 0
                ),
              }
            : scene
        )
      );

      setSceneInstructions((prev) => ({
        ...prev,
        [sceneId]: "",
      }));

      setEditingSceneId(null);
      setSaveMessage(
        uiLanguage === "en"
          ? "Scene updated. Existing image was preserved ✅"
          : "Sahne güncellendi. Mevcut görsel korundu ✅"
      );
    } catch {
      setError("Sahne güncellenirken bir hata oluştu.");
    } finally {
      setSceneLoadingId(null);
    }
  };

  const handleContinueStory = async () => {
    if (!title || scenes.length === 0) {
      setError("Önce bir hikaye oluşturmalısın.");
      return;
    }

    setIsContinuing(true);
    setError("");

    try {
      const continueRes = await fetch("/api/continue-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          language,
          flowKey: activeFlowKey,
          flowTitle: selectedFlow.title,
          scenes,
          childDirection: continuePrompt,
        }),
      });

      const continueData = await continueRes.json();

      if (!continueRes.ok) {
        setError(continueData.error || "Yeni sahne oluşturulamadı.");
        return;
      }

      const newScene: Scene = {
        ...continueData.scene,
        image: "",
        audioUrl: "",
        audioPath: "",
        audioSourceText: "",
        audioSettingsKey: "",
        dialogueAudioUrl: "",
        dialogueAudioPath: "",
        dialogueAudioSourceText: "",
        dialogueAudioSettingsKey: "",
        videoUrl: "",
        videoStatus: "idle",
        videoJobId: "",
        timing: buildSceneTiming(0, 0),
      };

      setScenes((prev) => [...prev, newScene]);

      const image = await generateSceneImage(newScene);

      setScenes((prev) =>
        prev.map((scene) => (scene.id === newScene.id ? { ...scene, image } : scene))
      );

      setContinuePrompt("");
      setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    } catch {
      setError("Hikayenin devamı oluşturulurken bir hata oluştu.");
    } finally {
      setIsContinuing(false);
    }
  };

  const handleBranchFromScene = async (fromSceneId: number) => {
    if (!title || scenes.length === 0) {
      setError("Önce bir hikaye oluşturmalısın.");
      return;
    }

    const childDirection = branchInstructions[fromSceneId]?.trim() || "";
    const baseScenes = scenes.filter((scene) => scene.id <= fromSceneId);

    if (baseScenes.length === 0) {
      setError("Geçerli bir sahne bulunamadı.");
      return;
    }

    setBranchLoadingId(fromSceneId);
    setError("");

    try {
      const continueRes = await fetch("/api/continue-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          language,
          flowKey: activeFlowKey,
          flowTitle: selectedFlow.title,
          scenes: baseScenes,
          childDirection,
          fromSceneId,
        }),
      });

      const continueData = await continueRes.json();

      if (!continueRes.ok) {
        setError(continueData.error || "Bu sahneden devam üretilemedi.");
        return;
      }

      const newScene: Scene = {
        ...continueData.scene,
        image: "",
        audioUrl: "",
        audioPath: "",
        audioSourceText: "",
        audioSettingsKey: "",
        dialogueAudioUrl: "",
        dialogueAudioPath: "",
        dialogueAudioSourceText: "",
        dialogueAudioSettingsKey: "",
        videoUrl: "",
        videoStatus: "idle",
        videoJobId: "",
        timing: buildSceneTiming(0, 0),
      };

      clearAllVideoPolls();
      stopDialoguePlayback();
      stopStoryPlayback();
      setScenes([...baseScenes, newScene]);

      const image = await generateSceneImage(newScene);

      setScenes((prev) =>
        prev.map((scene) => (scene.id === newScene.id ? { ...scene, image } : scene))
      );

      setBranchInstructions((prev) => ({
        ...prev,
        [fromSceneId]: "",
      }));

      setBranchingSceneId(null);
      setExportedMovieUrl("");
    setExportMovieResult(null);
    setExportSignature("");
    } catch {
      setError("Bu sahneden devam oluşturulurken bir hata oluştu.");
    } finally {
      setBranchLoadingId(null);
    }
  };

  useEffect(() => {
    scenes.forEach((scene) => {
      if (
        scene.videoStatus === "processing" &&
        scene.videoJobId &&
        !videoPollIntervalsRef.current[scene.id]
      ) {
        pollVideoStatus(scene.id, scene.videoJobId);
      }
    });
  }, [scenes]);

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (isHydratingRef.current) {
      return;
    }

    if (suspendAutosaveRef.current) {
      return;
    }

    if (!title || scenes.length === 0) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await persistProject(false);
        setSaveMessage(ui.autoSaved);
      } catch {
        setError("Otomatik kaydetme sırasında hata oluştu.");
      }
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [title, input, storySetup, characters, visualBible, scenes]);

  useEffect(() => {
    return () => {
      clearAllVideoPolls();
      stopDialoguePlayback();
      stopStoryPlayback();
    };
  }, []);

  const setupReady = !!storySetup;
  const readyVideoCount = scenes.filter(
    (scene) => scene.videoUrl && scene.videoStatus === "done"
  ).length;
  const readyExportCount = scenes.filter(
    (scene) => getSceneExportSource(scene) !== "none"
  ).length;
  const audioReadyCount = scenes.filter((scene) => getSceneAudioStatus(scene)).length;
  const freezeNeededCount = scenes.filter((scene) => scene.timing?.needsFreezeFrame).length;
  const dialogueReadyCount = scenes.filter((scene) => !!scene.dialogueAudioUrl).length;
  const totalTargetDuration = scenes.reduce(
    (sum, scene) => sum + (scene.timing?.targetSceneDuration || 0),
    0
  );
  const flowContinuityAudit = isCreatorLabFlow
    ? buildFlowContinuityAudit(scenes)
    : null;
  const exportFlowValidation = isCreatorLabFlow
    ? buildExportFlowValidation(scenes)
    : null;
  const creatorFinalVideoReadiness = isCreatorLabFlow
    ? createCreatorFinalVideoReadiness({
        scenes,
        timelineApproved: creatorTimelineMediaGate.approved,
        flowValidation: exportFlowValidation,
      })
    : null;
  const creatorFinalVideoReadinessMessage = creatorFinalVideoReadiness
    ? getCreatorFinalVideoReadinessMessage(creatorFinalVideoReadiness)
    : "";
  const creatorProjectReadiness = isCreatorLabFlow
    ? createCreatorProjectReadiness({
        hasProductionStage: Boolean(creatorProductionPackage || scenes.length > 0),
        totalScenes: scenes.length,
        visualReadyCount: readyExportCount,
        voiceReadyCount: audioReadyCount,
        finalVideoReady: creatorFinalVideoReadiness?.status === "ready",
        hasExportedVideo: Boolean(exportedMovieUrl && hasReusableExport()),
        qualityMode: creatorQualityMode,
      })
    : null;
  const creatorIntelligenceReport: CreatorIntelligenceReport | null =
    isCreatorLabFlow && (creatorProductionPackage || creatorMentorResult)
      ? createCreatorIntelligence({
          title:
            creatorProductionPackage?.title ||
            creatorMentorResult?.recommendedIdea.title ||
            title ||
            input,
          hook:
            creatorProductionPackage?.hook ||
            creatorMentorResult?.hookPatterns?.[0] ||
            creatorMentorResult?.recommendedIdea.title ||
            input,
          format: creatorFormat,
          durationSec: creatorVideoDurationSec,
          locale: uiLanguage === "en" ? "en" : "tr",
          metadata: youtubeMetadataResult,
          mentorAnalysis: creatorMentorResult,
          patternSummary: youtubePatternSummary,
        })
      : null;
  const creatorBriefComplete = Boolean(input.trim() || creatorMentorResult);
  const creatorStrategyComplete = Boolean(creatorProductionPackage);
  const creatorProductionComplete = Boolean(exportedMovieUrl && hasReusableExport());
  const creatorPublishComplete = creatorPackageDownloaded;
  const creatorProgressStep: 1 | 2 | 3 | 4 = creatorProductionComplete || creatorPublishComplete
    ? 4
    : creatorProductionPackage || scenes.length > 0
      ? 3
      : creatorMentorResult
        ? 2
        : 1;
  const creatorWorkspaceStep: 1 | 2 | 3 | 4 = creatorSelectedWorkspaceStep;
  const creatorBriefCanvasVisible =
    !isCreatorLabFlow ||
    creatorWorkspaceStep === 1 ||
    (creatorWorkspaceStep === 2 && creatorBriefEditorOpen);
  const creatorAssetProgress = creatorProjectReadiness?.totalScenes
    ? ((creatorProjectReadiness.visualReadyCount + creatorProjectReadiness.voiceReadyCount) /
        (creatorProjectReadiness.totalScenes * 2)) * 30
    : 0;
  const creatorReadinessPercent = creatorPublishComplete
    ? 100
    : Math.min(
        95,
        Math.round(
          (creatorBriefComplete ? 20 : input.trim() ? 10 : 0) +
            (creatorMentorResult ? 15 : 0) +
            (creatorStrategyComplete ? 15 : 0) +
            creatorAssetProgress +
            (creatorProductionComplete ? 15 : 0),
        ),
      );
  const creatorRawProjectTitle =
    creatorProductionPackage?.title || title || input.trim() ||
    (uiLanguage === "en" ? "Untitled creator project" : "İsimsiz içerik projesi");
  const creatorProjectDisplayTitle =
    creatorRawProjectTitle.length > 62
      ? `${creatorRawProjectTitle.slice(0, 59).trim()}…`
      : creatorRawProjectTitle;
  const creatorReadinessLabel = creatorPublishComplete
    ? uiLanguage === "en" ? "Exported" : "Dışa aktarıldı"
    : creatorProductionComplete
      ? uiLanguage === "en" ? "Ready" : "Hazır"
      : uiLanguage === "en" ? "Draft" : "Taslak";
  const creatorProjectRecords = isCreatorLabFlow
    ? [...filteredProjects].sort((left, right) => {
        const leftTime = new Date(left?.updated_at || left?.created_at || 0).getTime();
        const rightTime = new Date(right?.updated_at || right?.created_at || 0).getTime();
        return rightTime - leftTime;
      })
    : [];
  const currentCreatorProjectRecord = creatorProjectRecords.find(
    (project) => String(project?.id || "") === currentProjectId,
  );
  const creatorCurrentProjectUpdatedLabel = formatCreatorProjectUpdatedAt(
    currentCreatorProjectRecord?.updated_at || currentCreatorProjectRecord?.created_at,
  );
  const creatorProjectStatusLabel = (status: "draft" | "ready" | "exported") =>
    status === "exported"
      ? uiLanguage === "en" ? "Exported" : "Dışa aktarıldı"
      : status === "ready"
        ? uiLanguage === "en" ? "Ready" : "Hazır"
        : uiLanguage === "en" ? "Draft" : "Taslak";
  const creatorMentorAudienceInsights = Array.isArray(creatorMentorResult?.audienceInsight)
    ? creatorMentorResult.audienceInsight
    : [];
  const creatorMentorHookPatterns = Array.isArray(creatorMentorResult?.hookPatterns)
    ? creatorMentorResult.hookPatterns
    : [];
  const creatorMentorVideoIdeas = Array.isArray(creatorMentorResult?.videoIdeas)
    ? creatorMentorResult.videoIdeas
    : [];
  const creatorMentorProductionPlan = Array.isArray(creatorMentorResult?.productionPlan)
    ? creatorMentorResult.productionPlan
    : [];
  const creatorMentorRecommendedIdea = {
    title:
      creatorMentorResult?.recommendedIdea?.title?.trim() ||
      input.trim() ||
      (uiLanguage === "en" ? "Creator direction" : "İçerik yönü"),
    reason:
      creatorMentorResult?.recommendedIdea?.reason?.trim() ||
      (uiLanguage === "en"
        ? "The opportunity analysis is ready. Review the available signals and continue to the production plan."
        : "Fırsat analizi hazır. Mevcut sinyalleri inceleyip üretim planına geç."),
  };

  useEffect(() => {
    if (!isCreatorLabFlow) {
      return;
    }

    const previousProgressStep = creatorLastAutoStepRef.current;

    if (creatorProgressStep > previousProgressStep) {
      setCreatorSelectedWorkspaceStep(creatorProgressStep);
      setCreatorBriefEditorOpen(false);
    } else if (creatorProgressStep < previousProgressStep) {
      setCreatorSelectedWorkspaceStep((current: 1 | 2 | 3 | 4) =>
        current > creatorProgressStep ? creatorProgressStep : current,
      );
    }

    creatorLastAutoStepRef.current = creatorProgressStep;
  }, [creatorProgressStep, isCreatorLabFlow]);

  useEffect(() => {
    if (!isCreatorLabFlow || creatorWorkspaceStep === 3) {
      return;
    }

    setCreatorProductionDetailsOpen(false);
  }, [creatorWorkspaceStep, isCreatorLabFlow]);

  const creatorCanOpenWorkspaceStep = (step: 1 | 2 | 3 | 4) =>
    step === 1 || step <= creatorProgressStep;

  const creatorWorkspaceRootId = (step: 1 | 2 | 3 | 4) =>
    step === 1
      ? "creatorlab-brief-canvas"
      : step === 2
        ? "creatorlab-strategy-canvas"
        : step === 3
          ? "creatorlab-production-canvas"
          : "creatorlab-publish-canvas";

  const navigateCreatorWorkspaceStep = (step: 1 | 2 | 3 | 4) => {
    if (!creatorCanOpenWorkspaceStep(step)) {
      return;
    }

    setCreatorSelectedWorkspaceStep(step);
    setCreatorBriefEditorOpen(false);

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const target =
          document.getElementById(creatorWorkspaceRootId(step)) ||
          document.getElementById("creatorlab-main-workspace");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  };

  const creatorWorkflowSteps = [
    {
      id: 1 as const,
      title: "Brief",
      description: uiLanguage === "en" ? "Define the project" : "Projeyi tanımla",
      complete: creatorBriefComplete,
    },
    {
      id: 2 as const,
      title: uiLanguage === "en" ? "Strategy" : "Strateji",
      description: uiLanguage === "en" ? "Validate the direction" : "Yönü doğrula",
      complete: creatorStrategyComplete,
    },
    {
      id: 3 as const,
      title: uiLanguage === "en" ? "Production" : "Üretim",
      description: uiLanguage === "en" ? "Generate visuals and voice" : "Görsel ve sesi üret",
      complete: creatorProductionComplete,
    },
    {
      id: 4 as const,
      title: uiLanguage === "en" ? "Publish" : "Yayınla",
      description: uiLanguage === "en" ? "Finalize and package" : "Sonlandır ve paketle",
      complete: creatorPublishComplete,
    },
  ];
  const creatorVisualsComplete = scenes.length > 0 && readyExportCount >= scenes.length;
  const creatorVoiceOverComplete = scenes.length > 0 && audioReadyCount >= scenes.length;
  const creatorTimelineNeedsAttention = scenes.length > 0 && !creatorTimelineMediaGate.approved;

  const scrollCreatorWorkspaceTo = (targetId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const targetStep: 1 | 2 | 3 | 4 | null = targetId === "creatorlab-projects-readiness" || targetId.startsWith("creatorlab-brief") || targetId === "creatorlab-topic-input"
      ? 1
      : targetId.startsWith("creatorlab-strategy")
        ? 2
        : targetId.startsWith("creatorlab-production") || targetId.startsWith("creatorlab-cast")
          ? 3
          : targetId.startsWith("creatorlab-publish")
            ? 4
            : null;

    if (targetStep && targetStep !== creatorWorkspaceStep) {
      if (!creatorCanOpenWorkspaceStep(targetStep)) {
        return;
      }

      setCreatorSelectedWorkspaceStep(targetStep);
      setCreatorBriefEditorOpen(false);
    }

    window.setTimeout(() => {
      const target =
        document.getElementById(targetId) ||
        (targetStep ? document.getElementById(creatorWorkspaceRootId(targetStep)) : null) ||
        document.getElementById("creatorlab-main-workspace");

      if (!target) {
        return;
      }

      const detailsElement = target instanceof HTMLDetailsElement
        ? target
        : target.closest("details");

      if (detailsElement instanceof HTMLDetailsElement) {
        detailsElement.open = true;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, targetStep && targetStep !== creatorWorkspaceStep ? 90 : 30);
  };

  const creatorBriefSignalCount = input.trim() ? 5 : 4;
  const creatorBriefSignalPercent = Math.round((creatorBriefSignalCount / 5) * 100);
  const creatorVisualProgressPercent = scenes.length > 0
    ? Math.round((readyExportCount / scenes.length) * 100)
    : 0;
  const creatorVoiceProgressPercent = scenes.length > 0
    ? Math.round((audioReadyCount / scenes.length) * 100)
    : 0;
  const creatorProductionProgressPercent = scenes.length > 0
    ? Math.round((creatorVisualProgressPercent + creatorVoiceProgressPercent) / 2)
    : 0;
  const creatorPublishChecklistCount = youtubeMetadataResult
    ? youtubeMetadataResult.uploadChecklist.length + youtubeMetadataResult.publishingNotes.length
    : 0;
  const creatorStrategySignalCount = [
    Boolean(creatorMentorResult),
    Boolean(youtubePatternSummary),
    Boolean(creatorIntelligenceReport),
    Boolean(creatorProductionPackage),
  ].filter(Boolean).length;
  const creatorStrategyProgressPercent = Math.round((creatorStrategySignalCount / 4) * 100);
  const creatorPublishProgressPercent = creatorPublishComplete
    ? 100
    : Math.round(
        ([
          Boolean(exportedMovieUrl),
          Boolean(youtubeMetadataResult),
          creatorProductionComplete,
          creatorPublishChecklistCount > 0,
        ].filter(Boolean).length / 4) * 100,
      );

  const creatorPublishVideoUrl =
    exportMovieResult?.downloadUrl || exportMovieResult?.movieUrl || exportedMovieUrl;
  const creatorPublishThumbnailUrl =
    youtubeThumbnailResult?.imageUrl || scenes.find((scene) => scene.image)?.image || "";
  const creatorPublishTitle =
    youtubeMetadataResult?.recommendedTitle ||
    creatorProductionPackage?.youtubeTitle ||
    creatorProductionPackage?.title ||
    title ||
    input;
  const creatorPublishDescription =
    youtubeMetadataResult?.description || creatorProductionPackage?.caption || "";
  const creatorPublishHook =
    youtubeMetadataResult?.hookAlternatives?.[0] ||
    creatorProductionPackage?.hook ||
    creatorIntelligenceReport?.recommendedOpening ||
    "";
  const creatorPackageReady = Boolean(creatorProductionPackage && creatorPublishVideoUrl);
  const creatorPublishAssetCount = [
    Boolean(creatorPublishVideoUrl),
    Boolean(creatorPublishThumbnailUrl),
    Boolean(youtubeMetadataResult),
  ].filter(Boolean).length;

  const creatorWorkspaceStageProgress = creatorWorkspaceStep === 1
    ? creatorBriefSignalPercent
    : creatorWorkspaceStep === 2
      ? creatorStrategyProgressPercent
      : creatorWorkspaceStep === 3
        ? creatorProductionProgressPercent
        : creatorPublishProgressPercent;

  const creatorWorkspaceStageStatus = creatorWorkspaceStep === 1
    ? input.trim()
      ? uiLanguage === "en" ? "Ready to analyze" : "Analize hazır"
      : uiLanguage === "en" ? "Topic required" : "Konu gerekli"
    : creatorWorkspaceStep === 2
      ? creatorProductionPackage
        ? uiLanguage === "en" ? "Plan created" : "Plan oluşturuldu"
        : uiLanguage === "en" ? "Direction review" : "Yön değerlendirmesi"
      : creatorWorkspaceStep === 3
        ? creatorTimelineNeedsAttention
          ? uiLanguage === "en" ? "Action required" : "Aksiyon gerekli"
          : creatorProductionComplete
            ? uiLanguage === "en" ? "Media ready" : "Medya hazır"
            : uiLanguage === "en" ? "In production" : "Üretimde"
        : creatorPublishComplete
          ? uiLanguage === "en" ? "Package exported" : "Paket dışa aktarıldı"
          : uiLanguage === "en" ? "Final review" : "Final kontrol";

  const creatorWorkspaceCards: Array<{
    title: string;
    description: string;
    status: string;
    metric?: string;
    progress?: number;
    targetId: string;
    icon: CreatorWorkspaceIconName;
    tone: CreatorWorkspaceTone;
    attention?: boolean;
  }> = creatorWorkspaceStep === 1
    ? [
        {
          title: uiLanguage === "en" ? "Profile defaults" : "Profil varsayılanları",
          description: hasCreatorProfileContext(creatorProfile)
            ? uiLanguage === "en" ? "Audience and brand context are available for this brief." : "Kitle ve marka bağlamı bu brief için kullanılabilir."
            : uiLanguage === "en" ? "Optional defaults can be added without blocking the brief." : "Opsiyonel varsayılanlar brief'i engellemeden eklenebilir.",
          status: hasCreatorProfileContext(creatorProfile)
            ? uiLanguage === "en" ? "Available" : "Mevcut"
            : uiLanguage === "en" ? "Optional" : "İsteğe bağlı",
          metric: creatorProfile.brandName || creatorProfile.defaultAudience || (uiLanguage === "en" ? "No saved defaults" : "Kayıtlı varsayılan yok"),
          targetId: "creatorlab-brief-profile",
          icon: "ideas",
          tone: "violet",
        },
        {
          title: uiLanguage === "en" ? "Format guidance" : "Format yönlendirmesi",
          description: uiLanguage === "en" ? "Format, duration and language are aligned in one brief." : "Format, süre ve dil tek brief içinde uyumlandırıldı.",
          status: uiLanguage === "en" ? "Configured" : "Yapılandırıldı",
          metric: `${CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label || "-"} · ${getCreatorDurationLabel()} · ${language.toUpperCase()}`,
          targetId: "creatorlab-brief-settings",
          icon: "insights",
          tone: "blue",
        },
        {
          title: uiLanguage === "en" ? "Production quality" : "Üretim kalitesi",
          description: uiLanguage === "en" ? "The single authoritative quality and credit decision." : "Tek yetkili kalite ve kredi kararı.",
          status: getCreatorQualityModeLabel(),
          metric: getCreatorQualityCreditTier(),
          targetId: "creatorlab-quality-panel",
          icon: "safety",
          tone: "green",
        },
        {
          title: uiLanguage === "en" ? "Opportunity analysis" : "Fırsat analizi",
          description: input.trim()
            ? uiLanguage === "en" ? "The brief has enough context for the opportunity check." : "Brief, fırsat kontrolü için yeterli bağlama sahip."
            : uiLanguage === "en" ? "Add the topic or video idea before analysis." : "Analizden önce konu veya video fikrini ekle.",
          status: creatorMentorLoading
            ? uiLanguage === "en" ? "Analyzing" : "Analiz ediliyor"
            : creatorMentorResult
              ? uiLanguage === "en" ? "Ready" : "Hazır"
              : input.trim()
                ? uiLanguage === "en" ? "Next action" : "Sıradaki aksiyon"
                : uiLanguage === "en" ? "Blocked" : "Bekliyor",
          metric: input.trim()
            ? uiLanguage === "en" ? "Topic captured" : "Konu tanımlandı"
            : uiLanguage === "en" ? "Topic missing" : "Konu eksik",
          progress: creatorBriefSignalPercent,
          targetId: input.trim() ? "creatorlab-brief-action" : "creatorlab-topic-input",
          icon: "package",
          tone: "amber",
          attention: !input.trim(),
        },
      ]
    : creatorWorkspaceStep === 2
      ? [
          {
            title: uiLanguage === "en" ? "YouTube insights" : "YouTube içgörüleri",
            description: youtubePatternSummary
              ? uiLanguage === "en" ? "Opportunity and competition signals are summarized." : "Fırsat ve rekabet sinyalleri özetlendi."
              : uiLanguage === "en" ? "Research remains optional until additional market evidence is useful." : "Ek pazar kanıtı gerektiğinde araştırma kullanılabilir.",
            status: youtubePatternSummary
              ? uiLanguage === "en" ? "Ready" : "Hazır"
              : youtubeResearchVideos.length > 0
                ? uiLanguage === "en" ? "Research available" : "Araştırma mevcut"
                : uiLanguage === "en" ? "Optional" : "İsteğe bağlı",
            metric: youtubePatternSummary
              ? `${uiLanguage === "en" ? "Opportunity" : "Fırsat"} ${youtubePatternSummary.opportunityScore}/100 · ${youtubePatternSummary.competitionLevel}`
              : `${youtubeResearchVideos.length} ${uiLanguage === "en" ? "reference videos" : "referans video"}`,
            targetId: "creatorlab-strategy-youtube",
            icon: "insights",
            tone: "blue",
          },
          {
            title: uiLanguage === "en" ? "Hook & thumbnail" : "Hook ve thumbnail",
            description: creatorIntelligenceReport
              ? creatorIntelligenceReport.recommendedOpening
              : uiLanguage === "en" ? "Opening and thumbnail directions will appear with the strategy signal." : "Açılış ve thumbnail yönleri strateji sinyaliyle görünür.",
            status: creatorIntelligenceReport
              ? uiLanguage === "en" ? "Available" : "Mevcut"
              : uiLanguage === "en" ? "Pending" : "Bekliyor",
            metric: creatorIntelligenceReport
              ? `${uiLanguage === "en" ? "Hook score" : "Hook skoru"} ${creatorIntelligenceReport.hookScore}/100`
              : uiLanguage === "en" ? "Awaiting intelligence" : "İçgörü bekleniyor",
            progress: creatorIntelligenceReport?.hookScore,
            targetId: "creatorlab-strategy-signals",
            icon: "ideas",
            tone: "violet",
          },
          {
            title: uiLanguage === "en" ? "Audience signal" : "Kitle sinyali",
            description: creatorMentorAudienceInsights[0] || (uiLanguage === "en" ? "Audience fit is checked before production credits are used." : "Üretim kredileri kullanılmadan önce kitle uyumu kontrol edilir."),
            status: creatorMentorResult
              ? uiLanguage === "en" ? "Available" : "Mevcut"
              : uiLanguage === "en" ? "Pending" : "Bekliyor",
            metric: creatorMentorResult
              ? `${creatorMentorAudienceInsights.length} ${uiLanguage === "en" ? "signals" : "sinyal"}`
              : uiLanguage === "en" ? "No signal yet" : "Henüz sinyal yok",
            targetId: "creatorlab-strategy-recommendation",
            icon: "safety",
            tone: "green",
          },
          {
            title: uiLanguage === "en" ? "Production plan" : "Üretim planı",
            description: uiLanguage === "en" ? "Convert the approved direction into an editable scene plan." : "Onaylanan yönü düzenlenebilir sahne planına dönüştür.",
            status: creatorProductionPackage
              ? uiLanguage === "en" ? "Created" : "Oluşturuldu"
              : uiLanguage === "en" ? "Next action" : "Sıradaki aksiyon",
            metric: creatorMentorResult
              ? `${creatorMentorProductionPlan.length} ${uiLanguage === "en" ? "plan points" : "plan maddesi"}`
              : uiLanguage === "en" ? "Strategy required" : "Strateji gerekli",
            progress: creatorStrategyProgressPercent,
            targetId: "creatorlab-strategy-action",
            icon: "package",
            tone: "amber",
          },
        ]
      : creatorWorkspaceStep === 3
        ? [
            {
              title: uiLanguage === "en" ? "Timeline safety" : "Timeline güvenliği",
              description: creatorTimelineNeedsAttention
                ? creatorTimelineMediaGate.message
                : uiLanguage === "en" ? "The current plan is safe for the next production action." : "Mevcut plan sıradaki üretim aksiyonu için güvenli.",
              status: creatorTimelineMediaGate.approved
                ? uiLanguage === "en" ? "Approved" : "Onaylandı"
                : uiLanguage === "en" ? "Review" : "Kontrol et",
              metric: creatorTimelineNeedsAttention
                ? uiLanguage === "en" ? "Blocking risk detected" : "Engelleyici risk algılandı"
                : uiLanguage === "en" ? "No blocking risk" : "Engelleyici risk yok",
              progress: creatorTimelineMediaGate.approved ? 100 : 35,
              targetId: "creatorlab-production-safety",
              icon: "safety",
              tone: "amber",
              attention: creatorTimelineNeedsAttention,
            },
            {
              title: uiLanguage === "en" ? "Visual readiness" : "Görsel hazırlığı",
              description: uiLanguage === "en" ? "Missing scene visuals are generated through the guided action." : "Eksik sahne görselleri yönlendirmeli aksiyonla üretilir.",
              status: creatorVisualsComplete
                ? uiLanguage === "en" ? "Ready" : "Hazır"
                : uiLanguage === "en" ? "In progress" : "Devam ediyor",
              metric: `${readyExportCount}/${scenes.length || 0}`,
              progress: creatorVisualProgressPercent,
              targetId: "creatorlab-production-storyboard",
              icon: "ideas",
              tone: "violet",
            },
            {
              title: uiLanguage === "en" ? "Voice-over readiness" : "Voice-over hazırlığı",
              description: uiLanguage === "en" ? "Narration readiness and duration fit are tracked together." : "Anlatım hazırlığı ve süre uyumu birlikte takip edilir.",
              status: creatorVoiceOverComplete
                ? uiLanguage === "en" ? "Ready" : "Hazır"
                : uiLanguage === "en" ? "In progress" : "Devam ediyor",
              metric: `${audioReadyCount}/${scenes.length || 0}`,
              progress: creatorVoiceProgressPercent,
              targetId: "creatorlab-production-storyboard",
              icon: "insights",
              tone: "blue",
            },
            {
              title: uiLanguage === "en" ? "Continuity" : "Devamlılık",
              description: uiLanguage === "en" ? "Freeze and flow risks stay summarized; technical details remain secondary." : "Donma ve akış riskleri özetlenir; teknik detaylar ikincil kalır.",
              status: exportFlowValidation?.canExport
                ? uiLanguage === "en" ? "Safe" : "Güvenli"
                : uiLanguage === "en" ? "Monitoring" : "İzleniyor",
              metric: freezeNeededCount > 0
                ? `${freezeNeededCount} ${uiLanguage === "en" ? "scene risks" : "sahne riski"}`
                : uiLanguage === "en" ? "No freeze risk" : "Donma riski yok",
              targetId: "creatorlab-production-package-details",
              icon: "package",
              tone: "green",
            },
          ]
        : [
            {
              title: uiLanguage === "en" ? "Final video" : "Final video",
              description: uiLanguage === "en" ? "Review the latest production output before packaging." : "Paketlemeden önce son üretim çıktısını kontrol et.",
              status: exportedMovieUrl
                ? uiLanguage === "en" ? "Ready" : "Hazır"
                : uiLanguage === "en" ? "Pending" : "Bekliyor",
              metric: exportMovieResult?.durationSeconds
                ? `${Math.round(exportMovieResult.durationSeconds)} sec`
                : creatorFinalVideoReadinessMessage,
              progress: exportedMovieUrl ? 100 : creatorProductionComplete ? 85 : 35,
              targetId: "creatorlab-publish-video",
              icon: "insights",
              tone: "blue",
            },
            {
              title: uiLanguage === "en" ? "Metadata & chapters" : "Metadata ve chapters",
              description: uiLanguage === "en" ? "Title, description, hooks and discovery data stay together." : "Başlık, açıklama, hook ve keşif verileri birlikte tutulur.",
              status: youtubeMetadataResult
                ? uiLanguage === "en" ? "Ready" : "Hazır"
                : uiLanguage === "en" ? "Pending" : "Bekliyor",
              metric: youtubeMetadataResult
                ? `${youtubeMetadataResult.titleOptions.length} ${uiLanguage === "en" ? "title options" : "başlık seçeneği"}`
                : uiLanguage === "en" ? "Metadata not prepared" : "Metadata hazırlanmadı",
              targetId: "creatorlab-publish-metadata",
              icon: "ideas",
              tone: "violet",
            },
            {
              title: uiLanguage === "en" ? "Publishing checklist" : "Yayın kontrol listesi",
              description: uiLanguage === "en" ? "Confirm platform readiness without exposing export diagnostics." : "Export tanılarını göstermeden platform hazırlığını doğrula.",
              status: creatorPublishChecklistCount > 0
                ? uiLanguage === "en" ? "Available" : "Mevcut"
                : uiLanguage === "en" ? "Pending" : "Bekliyor",
              metric: `${creatorPublishChecklistCount} ${uiLanguage === "en" ? "checks" : "kontrol"}`,
              progress: creatorPublishChecklistCount > 0 ? 100 : 0,
              targetId: "creatorlab-publish-checklist",
              icon: "safety",
              tone: "green",
            },
            {
              title: uiLanguage === "en" ? "Creator Package" : "Creator Paketi",
              description: uiLanguage === "en" ? "Collect the final video, metadata and platform adaptations." : "Final video, metadata ve platform uyarlamalarını bir araya getir.",
              status: creatorPublishComplete
                ? uiLanguage === "en" ? "Exported" : "Dışa aktarıldı"
                : uiLanguage === "en" ? "Next action" : "Sıradaki aksiyon",
              metric: creatorPublishComplete
                ? uiLanguage === "en" ? "Package delivered" : "Paket teslim edildi"
                : uiLanguage === "en" ? "Package available after review" : "Kontrol sonrası paket hazır",
              progress: creatorPublishProgressPercent,
              targetId: "creatorlab-publish-action",
              icon: "package",
              tone: "amber",
            },
          ];

  const creatorWorkspaceGuidance = creatorWorkspaceStep === 1
    ? uiLanguage === "en" ? "Complete the brief, then analyze the content opportunity." : "Brief'i tamamla, ardından içerik fırsatını analiz et."
    : creatorWorkspaceStep === 2
      ? uiLanguage === "en" ? "Choose the strongest direction before creating the production plan." : "Üretim planını oluşturmadan önce en güçlü yönü seç."
      : creatorWorkspaceStep === 3
        ? uiLanguage === "en" ? "Generate media in sequence and resolve only blocking risks." : "Medyayı sırayla üret ve yalnızca engelleyici riskleri çöz."
        : uiLanguage === "en" ? "Review the final output and download the publish-ready package." : "Final çıktıyı incele ve yayına hazır paketi indir.";

  const creatorWorkspaceNextAction = creatorWorkspaceStep === 1
    ? {
        title: input.trim()
          ? uiLanguage === "en" ? "Analyze the content opportunity" : "İçerik fırsatını analiz et"
          : uiLanguage === "en" ? "Add the project topic" : "Proje konusunu ekle",
        description: input.trim()
          ? uiLanguage === "en" ? "The brief is configured. Continue from the single primary action in the main canvas." : "Brief yapılandırıldı. Ana çalışma alanındaki tek ana aksiyondan devam et."
          : uiLanguage === "en" ? "The topic is the only blocking brief input." : "Konu, brief içindeki tek engelleyici girdidir.",
        label: input.trim()
          ? uiLanguage === "en" ? "Go to analysis" : "Analize git"
          : uiLanguage === "en" ? "Go to topic" : "Konuya git",
        targetId: input.trim() ? "creatorlab-brief-action" : "creatorlab-topic-input",
      }
    : creatorWorkspaceStep === 2
      ? {
          title: uiLanguage === "en" ? "Create the production plan" : "Üretim planını oluştur",
          description: creatorIntelligenceReport?.nextBestAction || (uiLanguage === "en" ? "Use the approved direction to create the editable production package." : "Onaylanan yönü kullanarak düzenlenebilir üretim paketini oluştur."),
          label: uiLanguage === "en" ? "Go to production plan" : "Üretim planına git",
          targetId: "creatorlab-strategy-action",
        }
      : creatorWorkspaceStep === 3
        ? scenes.length === 0
          ? {
              title: uiLanguage === "en" ? "Prepare the scenes" : "Sahneleri hazırla",
              description: uiLanguage === "en" ? "Create the editable storyboard before generating paid media." : "Ücretli medya üretmeden önce düzenlenebilir storyboard'u oluştur.",
              label: uiLanguage === "en" ? "Go to scene setup" : "Sahne hazırlığına git",
              targetId: "creatorlab-production-canvas",
            }
          : creatorTimelineNeedsAttention
            ? {
                title: uiLanguage === "en" ? "Review timeline safety" : "Timeline güvenliğini incele",
                description: creatorTimelineMediaGate.message,
                label: uiLanguage === "en" ? "Go to timeline action" : "Timeline aksiyonuna git",
                targetId: "creatorlab-production-action",
              }
            : !creatorVisualsComplete
              ? {
                  title: uiLanguage === "en" ? "Generate the missing visuals" : "Eksik görselleri üret",
                  description: uiLanguage === "en" ? "CreatorLab will keep visual routing decisions internal." : "CreatorLab görsel yönlendirme kararlarını sistem içinde tutar.",
                  label: uiLanguage === "en" ? "Go to visual generation" : "Görsel üretimine git",
                  targetId: "creatorlab-production-action",
                }
              : !creatorVoiceOverComplete
                ? {
                    title: uiLanguage === "en" ? "Generate voice-over" : "Seslendirme üret",
                    description: uiLanguage === "en" ? "Narration duration will be matched to each scene automatically." : "Anlatım süresi her sahneyle otomatik eşleştirilir.",
                    label: uiLanguage === "en" ? "Go to voice-over" : "Seslendirmeye git",
                    targetId: "creatorlab-production-action",
                  }
                : {
                    title: uiLanguage === "en" ? "Create the final video" : "Final videoyu oluştur",
                    description: creatorFinalVideoReadinessMessage,
                    label: uiLanguage === "en" ? "Go to final video" : "Final videoya git",
                    targetId: "creatorlab-production-action",
                  }
        : {
            title: creatorPublishComplete
              ? uiLanguage === "en" ? "Review the exported package" : "Dışa aktarılan paketi incele"
              : uiLanguage === "en" ? "Complete the publish-ready package" : "Yayına hazır paketi tamamla",
            description: uiLanguage === "en" ? "Review the final video, metadata and platform adaptations in one place." : "Final video, metadata ve platform uyarlamalarını tek yerde kontrol et.",
            label: uiLanguage === "en" ? "Go to publish details" : "Yayın detaylarına git",
            targetId: "creatorlab-publish-canvas",
          };

  const creatorPresentationMode = characters.length > 1
    ? "ensemble"
    : characters.length === 1
      ? "presenter"
      : creatorNoCastMode;
  const creatorPresentationModeLabel = creatorPresentationMode === "ensemble"
    ? uiLanguage === "en" ? "Cast-led" : "Kadrolu anlatım"
    : creatorPresentationMode === "presenter"
      ? uiLanguage === "en" ? "Presenter-led" : "Sunucu odaklı"
      : creatorPresentationMode === "narrator"
        ? uiLanguage === "en" ? "Narrator-led" : "Anlatıcı odaklı"
        : uiLanguage === "en" ? "Faceless" : "Faceless";
  const creatorBrandConfigured = Boolean(
    creatorProfile.brandName.trim() || creatorProfile.brandVoice.trim(),
  );
  const creatorVisualDirectionConfigured = Boolean(
    visualBible?.style?.trim() ||
      visualBible?.palette?.trim() ||
      visualBible?.camera?.trim() ||
      visualBible?.consistencyRules?.trim(),
  );
  const creatorVoiceDirectionConfigured = Boolean(narratorSettings.voiceId?.trim());
  const creatorCastBrandConfiguredCount = [
    creatorBrandConfigured,
    creatorVisualDirectionConfigured,
    characters.length > 0 || creatorVoiceDirectionConfigured,
  ].filter(Boolean).length;

  const audioDurationMatchedCount = scenes.filter(
    (scene) =>
      scene.timing?.durationMatchStatus &&
      scene.timing.durationMatchStatus !== "unmeasured",
  ).length;
  const audioSplitRecommendedCount = scenes.filter(
    (scene) => scene.timing?.splitRecommended,
  ).length;
  const unnecessaryExtensionRemovedTotal = scenes.reduce(
    (sum, scene) =>
      sum + Number(scene.timing?.unnecessaryExtensionRemoved || 0),
    0,
  );

  const currentJourneyStep = !setupReady
    ? 1
    : scenes.length === 0
    ? 2
    : readyExportCount === 0
    ? 3
    : 4;

  const journeySteps = [
    {
      id: 1,
      title: ui.storySetupChip,
      description: ui.studioRouteMapDesc,
      active: currentJourneyStep === 1,
      complete: setupReady,
    },
    {
      id: 2,
      title: ui.initialDesign,
      description: ui.initialDesignHint,
      active: currentJourneyStep === 2,
      complete: setupReady && scenes.length > 0,
    },
    {
      id: 3,
      title: ui.sceneTimingChip,
      description: ui.exportReadyDesc,
      active: currentJourneyStep === 3,
      complete: readyExportCount > 0,
    },
    {
      id: 4,
      title: ui.finalExportChip,
      description: ui.quickItem2,
      active: currentJourneyStep === 4,
      complete: !!exportedMovieUrl,
    },
  ];

  if (authLoading) {
    return <div style={{ padding: 40 }}>{ui.loading}</div>;
  }

  if (roleLoading) {
    return <div style={{ padding: 40 }}>{ui.roleLoading}</div>;
  }

  const ActiveProductShell = isCreatorLabFlow ? CreatorLabShell : StoryverseShell;

  return (
    <WorldProvider>
      <ActiveProductShell>
        {isCreatorLabFlow && (
          <style>{`
.creatorlab-product-frame {
  --cl-page: #f7f6f2;
  --cl-surface: #fffdf9;
  --cl-surface-raised: #ffffff;
  --cl-surface-muted: #f5f4f0;
  --cl-border: #e7e4de;
  --cl-border-strong: #d8d4cc;
  --cl-divider: #eeece7;
  --cl-text-strong: #14233b;
  --cl-text: #24344d;
  --cl-muted: #667085;
  --cl-soft: #7b8493;
  --cl-disabled: #9ba2ad;
  --cl-accent: #1769e0;
  --cl-accent-hover: #1158c4;
  --cl-accent-soft: #edf4ff;
  --cl-accent-border: #c7daf8;
  --cl-success: #18835b;
  --cl-success-soft: #eef9f4;
  --cl-warning: #b56a12;
  --cl-warning-soft: #fff7e8;
  --cl-danger: #b33a45;
  --cl-danger-soft: #fff2f3;
  --cl-font-display: Georgia, "Times New Roman", serif;
  --cl-font-ui: Arial, Helvetica, sans-serif;
  --cl-shadow-card: 0 8px 24px rgba(19, 36, 62, 0.055);
}
/* CreatorLab UX-R2 — product workspace shell
   The shell establishes the persistent workflow, project readiness and contextual AI areas.
   Existing product functions remain in the center canvas and are migrated step by step. */
.creatorlab-product-frame {
  display: grid;
  grid-template-columns: minmax(224px, 252px) minmax(0, 1fr) minmax(276px, 312px);
  grid-template-rows: auto minmax(0, 1fr);
  align-items: start;
  width: min(100%, 1680px);
  min-height: 100vh;
  margin: 0 auto;
  background: #fffdf9;
  border-inline: 1px solid var(--cl-border);
}

.creatorlab-product-frame > * {
  min-width: 0;
  margin-block: 0 !important;
}

.creatorlab-main-column {
  grid-column: 2;
  grid-row: 2;
  display: grid;
  align-content: start;
  gap: 22px;
  min-width: 0;
  padding: 28px;
}

.creatorlab-workspace-topbar {
  position: sticky;
  top: 0;
  z-index: 60;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(360px, auto) minmax(190px, 1fr);
  align-items: center;
  min-height: 82px;
  padding: 12px 22px;
  background: rgba(255, 253, 249, 0.97);
  border-bottom: 1px solid var(--cl-border);
  box-shadow: 0 1px 0 rgba(19, 36, 62, 0.025) !important;
}

.creatorlab-brand-block {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.creatorlab-brand-mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 46px;
  height: 46px;
  color: var(--cl-accent);
  background: #fffefa;
  border: 1px solid var(--cl-border-strong);
  border-radius: 50%;
  box-shadow: 0 5px 16px rgba(19, 36, 62, 0.06);
  font-family: var(--cl-font-display);
  font-size: 1.1rem;
  letter-spacing: -0.04em;
}

.creatorlab-brand-name {
  color: var(--cl-text-strong);
  font-family: var(--cl-font-display);
  font-size: clamp(1.7rem, 2.1vw, 2.25rem);
  line-height: 1;
  letter-spacing: -0.045em;
}

.creatorlab-project-name {
  max-width: 34rem;
  margin-top: 5px;
  overflow: hidden;
  color: var(--cl-soft) !important;
  font-size: 0.72rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-readiness-block {
  display: grid;
  grid-template-columns: auto minmax(120px, 190px) auto auto;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.creatorlab-readiness-copy {
  display: grid;
  gap: 2px;
  text-align: right;
}

.creatorlab-readiness-copy span {
  color: var(--cl-soft);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.creatorlab-readiness-copy strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.72rem;
  font-weight: 650;
}

.creatorlab-readiness-track {
  height: 5px;
  overflow: hidden;
  background: #eceae5;
  border-radius: 999px;
}

.creatorlab-readiness-track span {
  display: block;
  height: 100%;
  background: var(--cl-accent);
  border-radius: inherit;
  transition: width 260ms ease;
}

.creatorlab-readiness-value {
  color: var(--cl-accent);
  font-size: 0.74rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.creatorlab-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 27px;
  padding: 5px 10px;
  border: 1px solid var(--cl-border);
  border-radius: 999px;
  color: var(--cl-muted);
  background: #f7f6f2;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.creatorlab-status-pill.is-ready {
  color: var(--cl-success);
  background: var(--cl-success-soft);
  border-color: #c8e5d7;
}

.creatorlab-status-pill.is-exported {
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-color: var(--cl-accent-border);
}

.creatorlab-topbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.creatorlab-language-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
  padding: 3px;
  background: #f3f2ee;
  border: 1px solid var(--cl-border);
  border-radius: 10px;
}

.creatorlab-language-toggle button {
  min-width: 34px;
  min-height: 28px;
  padding: 4px 8px;
  color: var(--cl-soft) !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 7px;
  box-shadow: none !important;
  font-size: 0.67rem;
  font-weight: 750;
}

.creatorlab-language-toggle button[aria-pressed="true"] {
  color: var(--cl-text-strong) !important;
  background: #ffffff !important;
  box-shadow: 0 1px 3px rgba(19, 36, 62, 0.08) !important;
}

.creatorlab-pulse-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--cl-muted);
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 12px;
}

.creatorlab-workflow-rail,
.creatorlab-ai-workspace {
  position: sticky;
  top: 82px;
  z-index: 20;
  align-self: start;
  height: calc(100vh - 82px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #fffdf9;
  box-shadow: none !important;
  scrollbar-width: thin;
  scrollbar-color: #d9d6cf transparent;
}

.creatorlab-workflow-rail {
  grid-column: 1;
  grid-row: 2;
  padding: 30px 18px 24px 22px;
  border-right: 1px solid var(--cl-border);
}

.creatorlab-ai-workspace {
  grid-column: 3;
  grid-row: 2;
  padding: 30px 22px 24px 18px;
  border-left: 1px solid var(--cl-border);
}

.creatorlab-rail-kicker {
  margin: 0 0 22px;
  color: var(--cl-soft) !important;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.creatorlab-step-list {
  position: relative;
  display: grid;
  gap: 14px;
}

.creatorlab-workflow-step {
  width: 100%;
  appearance: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.creatorlab-workflow-step:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.creatorlab-workflow-step:not(:disabled):hover {
  border-color: var(--cl-accent-border);
  background: var(--cl-accent-soft);
}

.creatorlab-workflow-step {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 11px 10px 11px 4px;
  border: 1px solid transparent;
  border-radius: 13px;
}

.creatorlab-workflow-step:not(:last-child)::after {
  position: absolute;
  top: 63px;
  left: 24px;
  width: 1px;
  height: 35px;
  background: #d9d6d0;
  content: "";
}

.creatorlab-workflow-step.is-active {
  background: #f6f9ff;
  border-color: var(--cl-accent-border);
  box-shadow: inset 3px 0 0 var(--cl-accent);
}

.creatorlab-workflow-step.is-complete:not(.is-active) .creatorlab-step-number {
  color: var(--cl-accent);
  border-color: var(--cl-accent);
}

.creatorlab-workflow-step.is-complete:not(:last-child)::after {
  background: var(--cl-accent);
}

.creatorlab-step-number {
  position: relative;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--cl-muted);
  background: #fffefa;
  border: 1px solid var(--cl-border-strong);
  border-radius: 50%;
  font-family: var(--cl-font-display);
  font-size: 1.2rem;
  line-height: 1;
}

.creatorlab-workflow-step.is-active .creatorlab-step-number {
  color: var(--cl-accent);
  background: #ffffff;
  border-color: var(--cl-accent);
  box-shadow: 0 0 0 3px rgba(23, 105, 224, 0.08);
}

.creatorlab-step-check {
  position: absolute;
  right: -4px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  color: #ffffff;
  background: var(--cl-accent);
  border: 2px solid #fffdf9;
  border-radius: 50%;
  font-family: var(--cl-font-ui);
  font-size: 0.55rem;
  font-weight: 800;
}

.creatorlab-step-copy {
  display: grid;
  gap: 5px;
}

.creatorlab-step-copy strong {
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.02rem;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.creatorlab-workflow-step.is-active .creatorlab-step-copy strong {
  color: var(--cl-accent) !important;
}

.creatorlab-step-copy span {
  color: var(--cl-soft);
  font-size: 0.74rem;
  line-height: 1.4;
}

.creatorlab-complete-badge {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: var(--cl-success);
  background: var(--cl-success-soft);
  border: 1px solid #9fd5bd;
  border-radius: 50%;
  font-size: 0.64rem;
  font-weight: 800;
}

.creatorlab-rail-promise {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 28px;
  padding: 13px 14px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 12px;
}

.creatorlab-rail-promise span {
  font-size: 1rem;
}

.creatorlab-rail-promise p {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.4;
}

.creatorlab-ai-heading {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 20px;
}

.creatorlab-ai-spark {
  color: var(--cl-accent);
  font-size: 1.1rem;
}

.creatorlab-ai-heading div {
  display: grid;
  gap: 2px;
}

.creatorlab-ai-heading p {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.creatorlab-ai-heading span {
  color: var(--cl-soft);
  font-size: 0.72rem;
}

.creatorlab-ai-card-list {
  display: grid;
  gap: 12px;
}

.creatorlab-ai-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  padding: 15px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 13px;
  box-shadow: 0 5px 15px rgba(19, 36, 62, 0.04) !important;
}

.creatorlab-ai-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-radius: 11px;
}

.creatorlab-ai-icon.is-violet {
  color: #7547bf;
  background: #f2edfb;
}

.creatorlab-ai-icon.is-green {
  color: var(--cl-success);
  background: var(--cl-success-soft);
}

.creatorlab-ai-icon.is-amber {
  color: var(--cl-warning);
  background: var(--cl-warning-soft);
}

.creatorlab-ai-card-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.creatorlab-ai-card-copy strong {
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.2;
}

.creatorlab-ai-card-copy p {
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
  line-height: 1.45;
}

.creatorlab-ai-card-copy span {
  width: fit-content;
  margin-top: 2px;
  color: var(--cl-accent);
  font-size: 0.66rem;
  font-weight: 750;
}

.creatorlab-stage-guidance {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 11px;
  margin-top: 18px;
  padding: 15px;
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 13px;
}

.creatorlab-stage-guidance-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: var(--cl-muted);
  background: var(--cl-surface-muted);
  border-radius: 9px;
}

.creatorlab-stage-guidance strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-size: 0.74rem;
  line-height: 1.35;
}

.creatorlab-stage-guidance p {
  margin: 5px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.71rem;
  line-height: 1.5;
}

/* CreatorLab UX-R6 — contextual AI workspace */
.creatorlab-ai-workspace {
  scrollbar-width: thin;
  scrollbar-color: var(--cl-border-strong) transparent;
}

.creatorlab-ai-stage-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 10px;
  margin-bottom: 15px;
  padding: 14px;
  background: var(--cl-surface-muted);
  border: 1px solid var(--cl-border);
  border-radius: 13px;
}

.creatorlab-ai-stage-summary-copy {
  display: grid;
  gap: 3px;
}

.creatorlab-ai-stage-summary-copy span {
  color: var(--cl-soft);
  font-size: 0.63rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.creatorlab-ai-stage-summary-copy strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.8rem;
  line-height: 1.3;
}

.creatorlab-ai-stage-summary small {
  align-self: end;
  color: var(--cl-accent);
  font-size: 0.7rem;
  font-weight: 800;
}

.creatorlab-ai-stage-progress {
  grid-column: 1 / -1;
  height: 5px;
  overflow: hidden;
  background: #e4e8ee;
  border-radius: 999px;
}

.creatorlab-ai-stage-progress span,
.creatorlab-ai-card-progress span {
  display: block;
  height: 100%;
  background: var(--cl-accent);
  border-radius: inherit;
  transition: width 220ms ease;
}

.creatorlab-ai-card {
  width: 100%;
  min-height: 0;
  color: inherit !important;
  text-align: left;
  cursor: pointer;
  appearance: none;
}

.creatorlab-ai-card:hover {
  transform: translateY(-1px);
  border-color: var(--cl-accent-border);
  box-shadow: 0 8px 22px rgba(19, 36, 62, 0.07) !important;
}

.creatorlab-ai-card:focus-visible {
  outline: 3px solid rgba(23, 105, 224, 0.18);
  outline-offset: 2px;
}

.creatorlab-ai-card.is-attention {
  background: var(--cl-warning-soft);
  border-color: #efd6ad;
}

.creatorlab-ai-card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.creatorlab-ai-card-title-row > strong {
  min-width: 0;
}

.creatorlab-ai-card-status {
  flex: 0 0 auto;
  max-width: 88px;
  overflow: hidden;
  color: var(--cl-accent) !important;
  font-family: var(--cl-font-ui) !important;
  font-size: 0.58rem !important;
  font-weight: 800 !important;
  line-height: 1.2 !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-ai-card-metric {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--cl-text) !important;
  font-size: 0.66rem !important;
  font-weight: 700 !important;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-ai-card-progress {
  height: 4px;
  margin-top: 2px;
  overflow: hidden;
  background: #e7ebf0;
  border-radius: 999px;
}

.creatorlab-ai-card-link {
  display: inline-flex;
  width: fit-content;
  margin-top: 2px;
  color: var(--cl-muted) !important;
  font-size: 0.61rem !important;
  font-weight: 700 !important;
}

.creatorlab-ai-card:hover .creatorlab-ai-card-link {
  color: var(--cl-accent) !important;
}

.creatorlab-stage-guidance {
  background: var(--cl-accent-soft);
  border-color: var(--cl-accent-border);
}

.creatorlab-stage-guidance-kicker {
  display: block;
  margin-bottom: 5px;
  color: var(--cl-accent) !important;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.creatorlab-stage-guidance button {
  width: 100%;
  min-height: 34px;
  margin-top: 11px;
  padding: 8px 10px !important;
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.68rem !important;
  font-weight: 750 !important;
}

.creatorlab-stage-guidance button:hover {
  background: var(--cl-accent-hover) !important;
  border-color: var(--cl-accent-hover) !important;
}

.creatorlab-ai-guidance-note {
  margin: 12px 2px 0 !important;
  color: var(--cl-soft) !important;
  font-size: 0.65rem !important;
  line-height: 1.5;
}

#creatorlab-projects-readiness,
#creatorlab-topic-input,
#creatorlab-brief-settings,
#creatorlab-quality-panel,
#creatorlab-brief-action,
#creatorlab-strategy-canvas,
#creatorlab-strategy-recommendation,
#creatorlab-strategy-youtube,
#creatorlab-strategy-signals,
#creatorlab-strategy-action,
#creatorlab-production-canvas,
#creatorlab-production-safety,
#creatorlab-production-storyboard,
#creatorlab-production-action,
#creatorlab-production-package-details,
#creatorlab-publish-canvas,
#creatorlab-publish-video,
#creatorlab-publish-metadata,
#creatorlab-publish-checklist,
#creatorlab-publish-action {
  scroll-margin-top: 104px;
}

/* CreatorLab UX-R3 — focused Brief experience */
.creatorlab-project-access {
  display: grid;
  gap: 0;
  padding: 14px 16px;
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(19, 36, 62, 0.035) !important;
}

.creatorlab-project-access > div:first-child {
  align-items: center;
}

.creatorlab-project-access h2 {
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1rem !important;
  font-weight: 500 !important;
  letter-spacing: -0.015em;
}

.creatorlab-project-access button {
  min-height: 34px;
  padding: 7px 12px !important;
  color: var(--cl-text) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.72rem !important;
}

.creatorlab-brief-experience {
  display: grid;
  gap: 18px;
  padding: 0;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.creatorlab-brief-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 4px 2px 2px;
}

.creatorlab-brief-kicker {
  margin: 0 0 7px;
  color: var(--cl-accent) !important;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.creatorlab-brief-heading h1 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: clamp(2rem, 3.3vw, 3rem);
  font-weight: 500;
  line-height: 1.02;
  letter-spacing: -0.045em;
}

.creatorlab-brief-heading p:last-child {
  max-width: 42rem;
  margin: 9px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.84rem;
  line-height: 1.6;
}

.creatorlab-brief-step-badge {
  flex: 0 0 auto;
  padding: 8px 11px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 750;
  white-space: nowrap;
}

.creatorlab-topic-card,
.creatorlab-brief-card {
  background: #ffffff !important;
  border: 1px solid var(--cl-border) !important;
  border-radius: 16px !important;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-topic-card {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.creatorlab-topic-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.creatorlab-topic-header label,
.creatorlab-field-label {
  display: block;
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-size: 0.76rem;
  font-weight: 750;
  line-height: 1.35;
}

.creatorlab-topic-header p {
  margin: 4px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
  line-height: 1.45;
}

.creatorlab-required-label {
  flex: 0 0 auto;
  padding: 5px 8px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-radius: 999px;
  font-size: 0.63rem;
  font-weight: 750;
}

.creatorlab-topic-textarea {
  width: 100%;
  min-height: 128px;
  resize: vertical;
  padding: 15px 16px !important;
  color: var(--cl-text-strong) !important;
  background: #fffefa !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 12px !important;
  box-shadow: inset 0 1px 0 rgba(19, 36, 62, 0.015) !important;
  font-size: 0.9rem;
  line-height: 1.6;
}

.creatorlab-topic-textarea:focus {
  border-color: var(--cl-accent) !important;
  box-shadow: 0 0 0 3px rgba(23, 105, 224, 0.1) !important;
}

.creatorlab-brief-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.creatorlab-brief-chip {
  display: inline-flex;
  align-items: center;
  min-height: 29px;
  padding: 5px 9px;
  color: var(--cl-muted);
  background: #f7f6f2;
  border: 1px solid var(--cl-border);
  border-radius: 999px;
  font-size: 0.67rem;
  font-weight: 650;
}

.creatorlab-brief-language-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1fr);
  gap: 12px;
  padding: 16px 18px;
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-brief-language-row > div:last-child {
  display: flex;
  align-items: center;
  padding: 12px 14px !important;
  color: var(--cl-muted) !important;
  background: #f7f6f2 !important;
  border-color: var(--cl-divider) !important;
  border-radius: 10px !important;
  font-size: 0.74rem !important;
  line-height: 1.5;
}

.creatorlab-brief-card {
  display: grid;
  gap: 18px;
  padding: 20px !important;
}

.creatorlab-brief-card > div:first-child p:first-child {
  color: var(--cl-accent) !important;
}

.creatorlab-brief-card > div:first-child h3 {
  margin-top: 6px !important;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.45rem !important;
  font-weight: 500 !important;
  letter-spacing: -0.025em;
}

.creatorlab-brief-card > div:first-child p:last-child {
  max-width: 48rem;
  margin-top: 6px !important;
  color: var(--cl-muted) !important;
  font-size: 0.78rem !important;
  line-height: 1.55 !important;
}

.creatorlab-profile-details,
.creatorlab-secondary-panel {
  overflow: hidden;
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 13px;
}

.creatorlab-profile-details > summary,
.creatorlab-secondary-panel > summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  min-height: 62px;
  padding: 13px 15px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.creatorlab-profile-details > summary::-webkit-details-marker,
.creatorlab-secondary-panel > summary::-webkit-details-marker {
  display: none;
}

.creatorlab-profile-summary-copy strong,
.creatorlab-secondary-summary-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 0.98rem;
  font-weight: 500;
}

.creatorlab-profile-summary-copy span,
.creatorlab-secondary-summary-copy span {
  display: block;
  margin-top: 4px;
  color: var(--cl-muted);
  font-size: 0.7rem;
  line-height: 1.4;
}

.creatorlab-profile-summary-values {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.creatorlab-profile-summary-values span,
.creatorlab-secondary-status {
  padding: 5px 8px;
  color: var(--cl-muted);
  background: #f3f2ee;
  border: 1px solid var(--cl-border);
  border-radius: 999px;
  font-size: 0.63rem;
  font-weight: 700;
  white-space: nowrap;
}

.creatorlab-details-chevron {
  color: var(--cl-soft);
  font-size: 0.9rem;
  transition: transform 160ms ease;
}

.creatorlab-profile-details[open] .creatorlab-details-chevron,
.creatorlab-secondary-panel[open] .creatorlab-details-chevron {
  transform: rotate(180deg);
}

.creatorlab-profile-body,
.creatorlab-secondary-body {
  padding: 16px;
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-profile-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.creatorlab-profile-actions p {
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
}

.creatorlab-profile-actions button {
  min-height: 34px;
  padding: 7px 11px !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.69rem !important;
}

.creatorlab-profile-actions button:first-child {
  color: var(--cl-text) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border-strong) !important;
}

.creatorlab-profile-actions button:last-child {
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
}

.creatorlab-profile-input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.creatorlab-profile-input-grid input,
.creatorlab-brief-fields input,
.creatorlab-brief-fields select,
.creatorlab-brief-language-row select {
  min-height: 43px;
  padding: 10px 12px !important;
  color: var(--cl-text-strong) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 10px !important;
  box-shadow: none !important;
  font-size: 0.76rem !important;
}

.creatorlab-profile-input-grid input:focus,
.creatorlab-brief-fields input:focus,
.creatorlab-brief-fields select:focus,
.creatorlab-brief-language-row select:focus {
  border-color: var(--cl-accent) !important;
  box-shadow: 0 0 0 3px rgba(23, 105, 224, 0.09) !important;
}

.creatorlab-brief-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.creatorlab-brief-fields > div {
  min-width: 0;
}

.creatorlab-brief-fields label {
  margin-bottom: 7px !important;
  color: var(--cl-text) !important;
  font-size: 0.67rem !important;
  font-weight: 750 !important;
  letter-spacing: 0.08em !important;
}

.creatorlab-brief-fields > div:nth-child(5) {
  grid-column: span 2;
}

.creatorlab-quality-panel {
  grid-column: 1 / -1;
  display: grid;
  gap: 14px;
  padding: 16px;
  background: #f9f8f5;
  border: 1px solid var(--cl-border);
  border-radius: 13px;
}

.creatorlab-quality-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.creatorlab-quality-heading label {
  color: var(--cl-text-strong) !important;
  font-size: 0.74rem !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}

.creatorlab-quality-heading p {
  max-width: 42rem;
  margin: 5px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.71rem;
  line-height: 1.45;
}

.creatorlab-credit-profile {
  flex: 0 0 auto;
  padding: 7px 10px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 10px;
  text-align: right;
}

.creatorlab-credit-profile span {
  display: block;
  color: var(--cl-soft);
  font-size: 0.56rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-credit-profile strong {
  display: block;
  margin-top: 2px;
  color: var(--cl-accent) !important;
  font-size: 0.72rem;
}

.creatorlab-quality-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.creatorlab-quality-option {
  min-height: 92px;
  padding: 12px !important;
  color: var(--cl-text) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border) !important;
  border-radius: 11px !important;
  box-shadow: none !important;
  text-align: left;
}

.creatorlab-quality-option:hover {
  border-color: var(--cl-border-strong) !important;
  transform: none !important;
}

.creatorlab-quality-option.is-selected {
  color: var(--cl-text-strong) !important;
  background: #f4f8ff !important;
  border-color: var(--cl-accent) !important;
  box-shadow: inset 0 0 0 1px var(--cl-accent) !important;
}

.creatorlab-quality-option strong {
  display: block;
  color: inherit !important;
  font-size: 0.76rem;
}

.creatorlab-quality-option span {
  display: block;
  margin-top: 6px;
  color: var(--cl-muted) !important;
  font-size: 0.65rem;
  line-height: 1.4;
}

.creatorlab-quality-summary {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px 13px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 11px;
}

.creatorlab-quality-metric span {
  display: block;
  color: var(--cl-soft);
  font-size: 0.58rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-quality-metric strong {
  display: block;
  margin-top: 3px;
  color: var(--cl-text-strong) !important;
  font-size: 0.82rem;
}

.creatorlab-quality-summary p {
  margin: 0;
  padding-left: 14px;
  color: var(--cl-muted) !important;
  border-left: 1px solid var(--cl-divider);
  font-size: 0.68rem;
  line-height: 1.5;
}

.creatorlab-brief-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px;
  background: #f4f8ff;
  border: 1px solid var(--cl-accent-border);
  border-radius: 13px;
}

.creatorlab-brief-action-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1rem;
  font-weight: 500;
}

.creatorlab-brief-action-copy p {
  margin: 4px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.7rem;
  line-height: 1.45;
}

.creatorlab-primary-action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 224px;
  min-height: 46px;
  padding: 11px 18px !important;
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
  border-radius: 11px !important;
  box-shadow: 0 8px 18px rgba(23, 105, 224, 0.17) !important;
  font-size: 0.76rem !important;
  font-weight: 750 !important;
}

.creatorlab-primary-action:hover:not(:disabled) {
  background: var(--cl-accent-hover) !important;
  transform: translateY(-1px) !important;
}

.creatorlab-primary-action:disabled {
  cursor: not-allowed;
  color: #ffffff !important;
  background: #aab8cc !important;
  border-color: #aab8cc !important;
  box-shadow: none !important;
}

.creatorlab-secondary-panel {
  background: #fffefa;
}

.creatorlab-secondary-panel > summary {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.creatorlab-secondary-panel[open] {
  background: #ffffff;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-secondary-body > div,
.creatorlab-secondary-body > section {
  margin: 0 !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.creatorlab-secondary-body button {
  border-radius: 10px !important;
}


/* CreatorLab UX-R4 — decision-focused Strategy experience */
.creatorlab-strategy-experience {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.creatorlab-strategy-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 2px 2px 4px;
}

.creatorlab-strategy-kicker {
  margin: 0 0 8px;
  color: var(--cl-accent) !important;
  font-size: 0.69rem;
  font-weight: 760;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.creatorlab-strategy-heading h1 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: clamp(2rem, 3.2vw, 3rem);
  font-weight: 500;
  line-height: 1.02;
  letter-spacing: -0.045em;
}

.creatorlab-strategy-heading p:last-child {
  max-width: 48rem;
  margin: 10px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.91rem;
  line-height: 1.65;
}

.creatorlab-strategy-stage-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 7px 11px;
  color: var(--cl-success);
  background: var(--cl-success-soft);
  border: 1px solid #c8e5d7;
  border-radius: 999px;
  font-size: 0.69rem;
  font-weight: 760;
  white-space: nowrap;
}

.creatorlab-strategy-stage-badge::before {
  width: 7px;
  height: 7px;
  background: var(--cl-success);
  border-radius: 50%;
  content: "";
}

.creatorlab-strategy-brief-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 16px 18px;
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(19, 36, 62, 0.035) !important;
}

.creatorlab-strategy-brief-copy {
  min-width: 0;
}

.creatorlab-strategy-brief-copy > span {
  display: block;
  color: var(--cl-success);
  font-size: 0.65rem;
  font-weight: 760;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.creatorlab-strategy-brief-copy strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-size: 0.93rem;
  font-weight: 680;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-strategy-brief-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 9px;
}

.creatorlab-strategy-chip {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 4px 9px;
  color: var(--cl-muted);
  background: #f5f4f0;
  border: 1px solid var(--cl-border);
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 650;
}

.creatorlab-strategy-edit-button,
.creatorlab-strategy-secondary-action {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 8px 12px !important;
  color: var(--cl-text) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.72rem !important;
  font-weight: 720 !important;
  white-space: nowrap;
}

.creatorlab-strategy-edit-button:hover,
.creatorlab-strategy-secondary-action:hover:not(:disabled) {
  color: var(--cl-accent) !important;
  border-color: var(--cl-accent-border) !important;
  transform: none !important;
}

.creatorlab-strategy-secondary-action:disabled {
  color: #a8a29e !important;
  background: #f7f6f3 !important;
  cursor: not-allowed;
  opacity: 1 !important;
}

.creatorlab-strategy-recommendation {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(190px, 0.3fr);
  gap: 22px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid var(--cl-accent-border);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(19, 36, 62, 0.055) !important;
}

.creatorlab-strategy-recommendation-copy {
  display: grid;
  align-content: start;
  gap: 9px;
  min-width: 0;
}

.creatorlab-strategy-recommendation-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  color: var(--cl-accent);
  font-size: 0.68rem;
  font-weight: 760;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.creatorlab-strategy-recommendation-label::before {
  width: 24px;
  height: 1px;
  background: var(--cl-accent);
  content: "";
}

.creatorlab-strategy-recommendation h2 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: clamp(1.55rem, 2.3vw, 2.1rem);
  font-weight: 500;
  line-height: 1.17;
  letter-spacing: -0.03em;
}

.creatorlab-strategy-recommendation p {
  max-width: 52rem;
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.88rem;
  line-height: 1.68;
}

.creatorlab-strategy-recommendation-aside {
  display: grid;
  align-content: center;
  gap: 0;
  padding-left: 22px;
  border-left: 1px solid var(--cl-divider);
}

.creatorlab-strategy-recommendation-aside div {
  display: grid;
  gap: 3px;
  padding: 10px 0;
}

.creatorlab-strategy-recommendation-aside div + div {
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-strategy-recommendation-aside span {
  color: var(--cl-soft);
  font-size: 0.62rem;
  font-weight: 720;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.creatorlab-strategy-recommendation-aside strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.78rem;
  font-weight: 680;
}

.creatorlab-strategy-signal-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.creatorlab-strategy-signal-card {
  display: grid;
  gap: 7px;
  min-height: 94px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 13px;
}

.creatorlab-strategy-signal-card span {
  color: var(--cl-soft);
  font-size: 0.62rem;
  font-weight: 720;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.creatorlab-strategy-signal-card strong {
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.05rem;
  font-weight: 500;
  line-height: 1.2;
}

.creatorlab-strategy-signal-card p {
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.69rem;
  line-height: 1.45;
}

.creatorlab-strategy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.creatorlab-strategy-panel {
  min-width: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 15px;
  box-shadow: 0 6px 18px rgba(19, 36, 62, 0.04) !important;
}

.creatorlab-strategy-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.creatorlab-strategy-panel-heading > div {
  min-width: 0;
}

.creatorlab-strategy-panel-heading span {
  display: block;
  margin-bottom: 5px;
  color: var(--cl-accent);
  font-size: 0.63rem;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.creatorlab-strategy-panel-heading h3 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.creatorlab-strategy-panel-heading p {
  margin: 7px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.74rem;
  line-height: 1.5;
}

.creatorlab-strategy-insight-list,
.creatorlab-strategy-production-list {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.creatorlab-strategy-insight-list li,
.creatorlab-strategy-production-list li {
  position: relative;
  padding: 11px 12px 11px 34px;
  color: var(--cl-text);
  background: #faf9f6;
  border: 1px solid var(--cl-divider);
  border-radius: 10px;
  font-size: 0.76rem;
  line-height: 1.52;
}

.creatorlab-strategy-insight-list li::before {
  position: absolute;
  top: 13px;
  left: 13px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  color: #ffffff;
  background: var(--cl-success);
  border-radius: 50%;
  font-size: 0.55rem;
  font-weight: 800;
  content: "✓";
}

.creatorlab-strategy-production-list {
  counter-reset: strategy-plan;
}

.creatorlab-strategy-production-list li {
  counter-increment: strategy-plan;
}

.creatorlab-strategy-production-list li::before {
  position: absolute;
  top: 11px;
  left: 11px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-radius: 50%;
  font-size: 0.62rem;
  font-weight: 800;
  content: counter(strategy-plan);
}

.creatorlab-strategy-hook-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.creatorlab-strategy-hook {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 10px;
  color: #53389e;
  background: #f5f1fb;
  border: 1px solid #e3d8f4;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 650;
  line-height: 1.35;
}

.creatorlab-strategy-idea-list {
  display: grid;
  gap: 9px;
}

.creatorlab-strategy-idea-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 11px;
  padding: 12px;
  background: #faf9f6;
  border: 1px solid var(--cl-divider);
  border-radius: 11px;
}

.creatorlab-strategy-idea-number {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-radius: 8px;
  font-size: 0.69rem;
  font-weight: 800;
}

.creatorlab-strategy-idea-card strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-size: 0.77rem;
  font-weight: 690;
  line-height: 1.4;
}

.creatorlab-strategy-idea-card p {
  margin: 4px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.7rem;
  line-height: 1.5;
}

.creatorlab-strategy-youtube {
  display: grid;
  gap: 16px;
}

.creatorlab-strategy-youtube-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.creatorlab-strategy-empty {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 16px;
  color: var(--cl-muted);
  background: #faf9f6;
  border: 1px dashed var(--cl-border-strong);
  border-radius: 12px;
  font-size: 0.75rem;
  line-height: 1.55;
}

.creatorlab-strategy-empty-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-radius: 10px;
}

.creatorlab-strategy-research-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.creatorlab-strategy-video-card {
  overflow: hidden;
  background: #faf9f6;
  border: 1px solid var(--cl-divider);
  border-radius: 11px;
}

.creatorlab-strategy-video-thumb {
  aspect-ratio: 16 / 8.5;
  overflow: hidden;
  background: #eceae5;
}

.creatorlab-strategy-video-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creatorlab-strategy-video-copy {
  display: grid;
  gap: 5px;
  padding: 10px;
}

.creatorlab-strategy-video-copy strong {
  display: -webkit-box;
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-size: 0.71rem;
  font-weight: 680;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.creatorlab-strategy-video-copy span {
  color: var(--cl-soft);
  font-size: 0.63rem;
}

.creatorlab-strategy-pattern {
  display: grid;
  gap: 14px;
  padding-top: 16px;
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-strategy-pattern-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.creatorlab-strategy-pattern-metric {
  display: grid;
  gap: 5px;
  padding: 12px;
  background: #f7f9fd;
  border: 1px solid #dce7f7;
  border-radius: 10px;
}

.creatorlab-strategy-pattern-metric span {
  color: var(--cl-soft);
  font-size: 0.59rem;
  font-weight: 720;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-strategy-pattern-metric strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.83rem;
  font-weight: 720;
}

.creatorlab-strategy-angle {
  padding: 14px;
  color: var(--cl-text);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 11px;
  font-size: 0.76rem;
  line-height: 1.58;
}

.creatorlab-strategy-angle strong {
  display: block;
  margin-bottom: 4px;
  color: var(--cl-accent) !important;
  font-size: 0.64rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-strategy-details {
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 11px;
}

.creatorlab-strategy-details > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 10px 12px;
  color: var(--cl-text) !important;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 680;
  list-style: none;
}

.creatorlab-strategy-details > summary::-webkit-details-marker {
  display: none;
}

.creatorlab-strategy-details > summary::after {
  color: var(--cl-soft);
  font-size: 0.85rem;
  content: "+";
}

.creatorlab-strategy-details[open] > summary::after {
  content: "−";
}

.creatorlab-strategy-details-body {
  display: grid;
  gap: 12px;
  padding: 0 12px 12px;
}

.creatorlab-strategy-raw-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.creatorlab-strategy-raw-grid > div {
  padding: 12px;
  background: #ffffff;
  border: 1px solid var(--cl-divider);
  border-radius: 10px;
}

.creatorlab-strategy-raw-grid strong {
  display: block;
  margin-bottom: 7px;
  color: var(--cl-text-strong) !important;
  font-size: 0.72rem;
}

.creatorlab-strategy-raw-grid ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 16px;
  color: var(--cl-muted);
  font-size: 0.69rem;
  line-height: 1.48;
}

.creatorlab-strategy-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  background: #f7f9fd;
  border: 1px solid var(--cl-accent-border);
  border-radius: 15px;
}

.creatorlab-strategy-action-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.05rem;
  font-weight: 500;
}

.creatorlab-strategy-action-copy p {
  max-width: 44rem;
  margin: 5px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
  line-height: 1.5;
}

.creatorlab-strategy-primary-action {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-width: 190px;
  min-height: 44px;
  padding: 10px 18px !important;
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 18px rgba(23, 105, 224, 0.18) !important;
  font-size: 0.78rem !important;
  font-weight: 760 !important;
  white-space: nowrap;
}

.creatorlab-strategy-primary-action:hover:not(:disabled) {
  background: var(--cl-accent-hover) !important;
  border-color: var(--cl-accent-hover) !important;
  transform: translateY(-1px) !important;
}

.creatorlab-strategy-primary-action:disabled {
  color: #ffffff !important;
  background: #9eb9df !important;
  border-color: #9eb9df !important;
  box-shadow: none !important;
  cursor: wait;
}

@media (max-width: 1180px) {
  .creatorlab-strategy-signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .creatorlab-strategy-recommendation {
    grid-template-columns: minmax(0, 1fr) 180px;
  }
}

@media (max-width: 760px) {
  .creatorlab-strategy-heading,
  .creatorlab-strategy-action-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .creatorlab-strategy-stage-badge {
    width: fit-content;
  }

  .creatorlab-strategy-brief-strip,
  .creatorlab-strategy-recommendation,
  .creatorlab-strategy-grid {
    grid-template-columns: 1fr;
  }

  .creatorlab-strategy-recommendation-aside {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-top: 14px;
    padding-left: 0;
    border-top: 1px solid var(--cl-divider);
    border-left: 0;
  }

  .creatorlab-strategy-recommendation-aside div {
    padding: 0 10px;
  }

  .creatorlab-strategy-recommendation-aside div + div {
    border-top: 0;
    border-left: 1px solid var(--cl-divider);
  }

  .creatorlab-strategy-edit-button {
    width: 100%;
  }

  .creatorlab-strategy-research-preview,
  .creatorlab-strategy-pattern-metrics,
  .creatorlab-strategy-raw-grid {
    grid-template-columns: 1fr;
  }

  .creatorlab-strategy-youtube-actions {
    justify-content: stretch;
  }

  .creatorlab-strategy-youtube-actions button,
  .creatorlab-strategy-primary-action {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .creatorlab-strategy-signal-grid,
  .creatorlab-strategy-recommendation-aside {
    grid-template-columns: 1fr;
  }

  .creatorlab-strategy-recommendation-aside div {
    padding: 8px 0;
  }

  .creatorlab-strategy-recommendation-aside div + div {
    border-top: 1px solid var(--cl-divider);
    border-left: 0;
  }
}

@media (max-width: 1180px) {
  .creatorlab-brief-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .creatorlab-brief-fields > div:nth-child(5) {
    grid-column: span 1;
  }

  .creatorlab-quality-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 699px) {
  .creatorlab-brief-heading,
  .creatorlab-topic-header,
  .creatorlab-quality-heading,
  .creatorlab-brief-action-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .creatorlab-brief-step-badge,
  .creatorlab-required-label {
    width: fit-content;
  }

  .creatorlab-brief-language-row,
  .creatorlab-brief-fields,
  .creatorlab-profile-input-grid,
  .creatorlab-quality-summary {
    grid-template-columns: 1fr;
  }

  .creatorlab-brief-fields > div:nth-child(5) {
    grid-column: auto;
  }

  .creatorlab-quality-summary p {
    padding-top: 10px;
    padding-left: 0;
    border-top: 1px solid var(--cl-divider);
    border-left: 0;
  }

  .creatorlab-primary-action {
    width: 100%;
    min-width: 0;
  }

  .creatorlab-profile-details > summary,
  .creatorlab-secondary-panel > summary {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .creatorlab-profile-summary-values {
    display: none;
  }
}


.creatorlab-strategy-empty-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 22px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 16px;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-strategy-empty-state strong {
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.08rem;
  font-weight: 600;
}

.creatorlab-strategy-empty-state p {
  max-width: 42rem;
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.86rem;
  line-height: 1.6;
}

.creatorlab-strategy-empty-state button {
  min-height: 40px;
  margin-top: 4px;
  padding: 9px 14px !important;
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
  border-radius: 10px !important;
  font-size: 0.78rem !important;
  font-weight: 750 !important;
}

/* UX-R5 Production Experience */
.creatorlab-production-experience {
  display: grid;
  gap: 16px;
}

.creatorlab-production-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 4px 2px 0;
}

.creatorlab-production-kicker {
  margin: 0 0 7px;
  color: var(--cl-accent) !important;
  font-size: 0.67rem;
  font-weight: 760;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.creatorlab-production-heading h1 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: clamp(2rem, 3.2vw, 2.75rem);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.045em;
}

.creatorlab-production-heading p:not(.creatorlab-production-kicker) {
  max-width: 45rem;
  margin: 9px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.82rem;
  line-height: 1.62;
}

.creatorlab-production-stage-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 30px;
  padding: 6px 10px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 730;
}

.creatorlab-production-project-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 19px 20px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 15px;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-production-project-copy {
  min-width: 0;
}

.creatorlab-production-project-copy span {
  display: block;
  margin-bottom: 5px;
  color: var(--cl-soft);
  font-size: 0.62rem;
  font-weight: 730;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.creatorlab-production-project-copy strong {
  display: block;
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-production-project-copy p {
  max-width: 48rem;
  margin: 6px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.73rem;
  line-height: 1.5;
}

.creatorlab-production-project-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(80px, auto));
  gap: 0;
}

.creatorlab-production-project-meta div {
  min-width: 90px;
  padding: 4px 14px;
}

.creatorlab-production-project-meta div + div {
  border-left: 1px solid var(--cl-divider);
}

.creatorlab-production-project-meta span {
  display: block;
  color: var(--cl-soft);
  font-size: 0.58rem;
  font-weight: 720;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-production-project-meta strong {
  display: block;
  margin-top: 4px;
  color: var(--cl-text-strong) !important;
  font-size: 0.78rem;
  font-weight: 700;
}

.creatorlab-production-empty {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 15px;
  align-items: center;
  padding: 20px;
  background: #f7f9fd;
  border: 1px solid var(--cl-accent-border);
  border-radius: 15px;
}

.creatorlab-production-empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  color: var(--cl-accent);
  background: #ffffff;
  border: 1px solid var(--cl-accent-border);
  border-radius: 13px;
  font-size: 1.25rem;
}

.creatorlab-production-empty strong,
.creatorlab-production-action-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.05rem;
  font-weight: 500;
}

.creatorlab-production-empty p,
.creatorlab-production-action-copy p {
  margin: 5px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
  line-height: 1.5;
}

.creatorlab-production-progress {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-production-progress-step {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 70px;
  padding: 13px 15px;
}

.creatorlab-production-progress-step + .creatorlab-production-progress-step {
  border-left: 1px solid var(--cl-divider);
}

.creatorlab-production-progress-number {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--cl-soft);
  background: #f7f6f2;
  border: 1px solid var(--cl-border);
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 780;
}

.creatorlab-production-progress-step.is-active {
  background: #f7f9fd;
}

.creatorlab-production-progress-step.is-active .creatorlab-production-progress-number {
  color: #ffffff;
  background: var(--cl-accent);
  border-color: var(--cl-accent);
}

.creatorlab-production-progress-step.is-complete .creatorlab-production-progress-number {
  color: #ffffff;
  background: var(--cl-success);
  border-color: var(--cl-success);
}

.creatorlab-production-progress-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-size: 0.74rem;
  font-weight: 700;
}

.creatorlab-production-progress-copy span {
  display: block;
  margin-top: 3px;
  color: var(--cl-muted);
  font-size: 0.65rem;
  line-height: 1.4;
}

.creatorlab-production-safety {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 13px;
  align-items: center;
  padding: 16px 17px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-production-safety.is-safe {
  background: var(--cl-success-soft);
  border-color: #cde9dc;
}

.creatorlab-production-safety.is-review {
  background: var(--cl-warning-soft);
  border-color: #f0d6ac;
}

.creatorlab-production-safety-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--cl-success);
  background: #ffffff;
  border: 1px solid currentColor;
  border-radius: 11px;
  font-size: 1rem;
}

.creatorlab-production-safety.is-review .creatorlab-production-safety-icon {
  color: var(--cl-warning);
}

.creatorlab-production-safety strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-size: 0.78rem;
  font-weight: 710;
}

.creatorlab-production-safety p {
  margin: 4px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.7rem;
  line-height: 1.48;
}

.creatorlab-production-safety-status {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 9px;
  color: var(--cl-success);
  background: #ffffff;
  border: 1px solid #cde9dc;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 740;
  white-space: nowrap;
}

.creatorlab-production-safety.is-review .creatorlab-production-safety-status {
  color: var(--cl-warning);
  border-color: #f0d6ac;
}

.creatorlab-production-storyboard {
  padding: 19px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 15px;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-production-storyboard-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 13px;
}

.creatorlab-production-storyboard-heading span {
  display: block;
  margin-bottom: 5px;
  color: var(--cl-accent);
  font-size: 0.62rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.creatorlab-production-storyboard-heading h2 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.35rem;
  font-weight: 500;
}

.creatorlab-production-storyboard-heading p {
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.7rem;
}

.creatorlab-production-scene-list {
  display: grid;
  gap: 9px;
}

.creatorlab-production-scene {
  display: grid;
  grid-template-columns: 38px 92px minmax(0, 1fr) minmax(92px, auto) minmax(92px, auto) 34px;
  gap: 12px;
  align-items: center;
  min-height: 86px;
  padding: 10px 12px;
  background: #fffefa;
  border: 1px solid var(--cl-divider);
  border-radius: 12px;
}

.creatorlab-production-scene-number {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 780;
}

.creatorlab-production-scene-preview {
  display: grid;
  place-items: center;
  width: 92px;
  height: 58px;
  overflow: hidden;
  color: var(--cl-soft);
  background: #f2f1ed;
  border: 1px solid var(--cl-border);
  border-radius: 9px;
  font-size: 0.62rem;
  font-weight: 720;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.creatorlab-production-scene-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creatorlab-production-scene-copy {
  min-width: 0;
}

.creatorlab-production-scene-copy strong {
  display: block;
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 0.93rem;
  font-weight: 500;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-production-scene-copy p {
  display: -webkit-box;
  overflow: hidden;
  margin: 5px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.68rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.creatorlab-production-scene-status {
  min-width: 0;
  padding-left: 12px;
  border-left: 1px solid var(--cl-divider);
}

.creatorlab-production-scene-status span {
  display: block;
  color: var(--cl-soft);
  font-size: 0.57rem;
  font-weight: 720;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-production-scene-status strong {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  color: var(--cl-muted) !important;
  font-size: 0.67rem;
  font-weight: 680;
}

.creatorlab-production-scene-status strong::before {
  width: 7px;
  height: 7px;
  background: #c6cbd2;
  border-radius: 50%;
  content: "";
}

.creatorlab-production-scene-status.is-ready strong {
  color: var(--cl-success) !important;
}

.creatorlab-production-scene-status.is-ready strong::before {
  background: var(--cl-success);
}

.creatorlab-production-scene-edit {
  display: grid !important;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0 !important;
  color: var(--cl-muted) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.85rem !important;
}

.creatorlab-production-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  background: #f7f9fd;
  border: 1px solid var(--cl-accent-border);
  border-radius: 15px;
}

.creatorlab-production-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
}

.creatorlab-production-secondary-action {
  min-height: 42px;
  padding: 9px 13px !important;
  color: var(--cl-text) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 10px !important;
  box-shadow: none !important;
  font-size: 0.72rem !important;
  font-weight: 690 !important;
}

.creatorlab-production-primary-action {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-width: 175px;
  min-height: 44px;
  padding: 10px 18px !important;
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 18px rgba(23, 105, 224, 0.18) !important;
  font-size: 0.78rem !important;
  font-weight: 760 !important;
  white-space: nowrap;
}

.creatorlab-production-primary-action:hover:not(:disabled) {
  background: var(--cl-accent-hover) !important;
  border-color: var(--cl-accent-hover) !important;
  transform: translateY(-1px) !important;
}

.creatorlab-production-primary-action:disabled {
  color: #ffffff !important;
  background: #9eb9df !important;
  border-color: #9eb9df !important;
  box-shadow: none !important;
}

.creatorlab-production-detail-panel {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-production-detail-panel > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 50px;
  padding: 12px 16px;
  color: var(--cl-text) !important;
  cursor: pointer;
  font-size: 0.73rem;
  font-weight: 690;
  list-style: none;
}

.creatorlab-production-detail-panel > summary::-webkit-details-marker {
  display: none;
}

.creatorlab-production-detail-panel > summary::after {
  color: var(--cl-soft);
  content: "+";
}

.creatorlab-production-detail-panel[open] > summary::after {
  content: "−";
}

.creatorlab-production-detail-body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-legacy-scene-workspace {
  display: none;
}

.creatorlab-legacy-scene-workspace.is-open {
  display: contents;
}

@media (max-width: 1080px) {
  .creatorlab-production-project-card {
    grid-template-columns: 1fr;
  }

  .creatorlab-production-project-meta {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .creatorlab-production-scene {
    grid-template-columns: 34px 78px minmax(0, 1fr) 86px 34px;
  }

  .creatorlab-production-scene-status.is-voice-status {
    display: none;
  }

  .creatorlab-production-scene-preview {
    width: 78px;
  }
}

@media (max-width: 720px) {
  .creatorlab-production-heading,
  .creatorlab-production-action-bar,
  .creatorlab-production-storyboard-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .creatorlab-production-stage-badge {
    width: fit-content;
  }

  .creatorlab-production-empty {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .creatorlab-production-empty .creatorlab-production-primary-action {
    grid-column: 1 / -1;
    width: 100%;
  }

  .creatorlab-production-progress {
    grid-template-columns: 1fr;
  }

  .creatorlab-production-progress-step + .creatorlab-production-progress-step {
    border-top: 1px solid var(--cl-divider);
    border-left: 0;
  }

  .creatorlab-production-safety {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .creatorlab-production-safety-status {
    grid-column: 2;
    width: fit-content;
  }

  .creatorlab-production-scene {
    grid-template-columns: 32px 70px minmax(0, 1fr) 34px;
  }

  .creatorlab-production-scene-status {
    display: none;
  }

  .creatorlab-production-scene-preview {
    width: 70px;
    height: 52px;
  }

  .creatorlab-production-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .creatorlab-production-secondary-action,
  .creatorlab-production-primary-action {
    width: 100%;
  }
}

/* CreatorLab UX-R8 — Publish Experience */
.creatorlab-publish-experience {
  display: grid;
  gap: 16px;
}

.creatorlab-publish-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 4px 2px 0;
}

.creatorlab-publish-kicker {
  margin: 0 0 7px;
  color: var(--cl-accent) !important;
  font-size: 0.67rem;
  font-weight: 760;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.creatorlab-publish-heading h1 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: clamp(2rem, 3.2vw, 2.75rem);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.045em;
}

.creatorlab-publish-heading p:not(.creatorlab-publish-kicker) {
  max-width: 47rem;
  margin: 9px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.82rem;
  line-height: 1.62;
}

.creatorlab-publish-stage-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 30px;
  padding: 6px 10px;
  color: var(--cl-success);
  background: var(--cl-success-soft);
  border: 1px solid #cde8dc;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 730;
}

.creatorlab-publish-readiness {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-publish-readiness-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  min-height: 72px;
  padding: 14px 16px;
}

.creatorlab-publish-readiness-card + .creatorlab-publish-readiness-card {
  border-left: 1px solid var(--cl-divider);
}

.creatorlab-publish-readiness-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: var(--cl-soft);
  background: #f5f5f2;
  border: 1px solid var(--cl-border);
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 780;
}

.creatorlab-publish-readiness-card.is-ready .creatorlab-publish-readiness-icon {
  color: var(--cl-success);
  background: var(--cl-success-soft);
  border-color: #cde8dc;
}

.creatorlab-publish-readiness-copy span {
  display: block;
  color: var(--cl-soft);
  font-size: 0.58rem;
  font-weight: 720;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-publish-readiness-copy strong {
  display: block;
  margin-top: 4px;
  color: var(--cl-text-strong) !important;
  font-size: 0.76rem;
  font-weight: 700;
}

.creatorlab-publish-media-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(250px, 0.75fr);
  gap: 16px;
}

.creatorlab-publish-video-card,
.creatorlab-publish-thumbnail-card,
.creatorlab-publish-metadata-card,
.creatorlab-publish-platform-card,
.creatorlab-publish-checklist-card {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 15px;
  box-shadow: var(--cl-shadow-card) !important;
}

.creatorlab-publish-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 49px;
  padding: 12px 15px;
  border-bottom: 1px solid var(--cl-divider);
}

.creatorlab-publish-card-heading div {
  min-width: 0;
}

.creatorlab-publish-card-heading span {
  display: block;
  color: var(--cl-soft);
  font-size: 0.57rem;
  font-weight: 720;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-publish-card-heading strong {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 0.96rem;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-publish-card-heading small {
  flex: 0 0 auto;
  color: var(--cl-success);
  font-size: 0.63rem;
  font-weight: 720;
}

.creatorlab-publish-video-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #101826;
}

.creatorlab-publish-video-frame video {
  width: 100%;
  height: 100%;
  background: #101826;
  object-fit: contain;
}

.creatorlab-publish-video-empty {
  display: grid;
  place-items: center;
  min-height: 280px;
  padding: 30px;
  color: rgba(255, 255, 255, 0.74) !important;
  text-align: center;
}

.creatorlab-publish-video-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 15px;
  color: var(--cl-muted) !important;
  font-size: 0.65rem;
}

.creatorlab-publish-video-meta a {
  color: var(--cl-accent) !important;
  font-weight: 700;
  text-decoration: none;
}

.creatorlab-publish-thumbnail-preview {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  margin: 14px;
  color: var(--cl-soft) !important;
  background: #f2f1ed;
  border: 1px dashed var(--cl-border-strong);
  border-radius: 11px;
  font-size: 0.68rem;
  text-align: center;
}

.creatorlab-publish-thumbnail-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creatorlab-publish-thumbnail-copy {
  padding: 0 15px 15px;
}

.creatorlab-publish-thumbnail-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.3;
}

.creatorlab-publish-thumbnail-copy p {
  display: -webkit-box;
  overflow: hidden;
  margin: 5px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.67rem;
  line-height: 1.48;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.creatorlab-publish-secondary-button {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-height: 35px;
  padding: 7px 11px !important;
  color: var(--cl-text) !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.66rem !important;
  font-weight: 700 !important;
}

.creatorlab-publish-thumbnail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 15px 15px;
}

.creatorlab-publish-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(245px, 0.75fr);
  gap: 16px;
}

.creatorlab-publish-metadata-body {
  display: grid;
  gap: 0;
}

.creatorlab-publish-metadata-section {
  padding: 15px;
}

.creatorlab-publish-metadata-section + .creatorlab-publish-metadata-section {
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-publish-metadata-section span {
  display: block;
  margin-bottom: 6px;
  color: var(--cl-soft);
  font-size: 0.57rem;
  font-weight: 720;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-publish-metadata-section strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.02rem;
  font-weight: 500;
  line-height: 1.35;
}

.creatorlab-publish-metadata-section p {
  margin: 0;
  color: var(--cl-muted) !important;
  font-size: 0.71rem;
  line-height: 1.6;
  white-space: pre-line;
}

.creatorlab-publish-platform-list {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.creatorlab-publish-platform-item {
  padding: 12px;
  background: #f8f9fc;
  border: 1px solid var(--cl-divider);
  border-radius: 11px;
}

.creatorlab-publish-platform-item span {
  display: block;
  color: var(--cl-accent);
  font-size: 0.57rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.creatorlab-publish-platform-item p {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 0;
  color: var(--cl-muted) !important;
  font-size: 0.67rem;
  line-height: 1.5;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.creatorlab-publish-checklist {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 14px;
}

.creatorlab-publish-check {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  min-height: 48px;
  padding: 10px;
  background: #fffefa;
  border: 1px solid var(--cl-divider);
  border-radius: 10px;
  color: var(--cl-muted) !important;
  font-size: 0.65rem;
  line-height: 1.45;
}

.creatorlab-publish-check > span {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: var(--cl-success) !important;
  background: var(--cl-success-soft);
  border-radius: 50%;
  font-size: 0.62rem;
  font-weight: 800;
}

.creatorlab-publish-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 19px 20px;
  background: #14233b;
  border: 1px solid #14233b;
  border-radius: 15px;
  box-shadow: 0 10px 24px rgba(20, 35, 59, 0.11) !important;
}

.creatorlab-publish-action-copy strong {
  display: block;
  color: #ffffff !important;
  font-family: var(--cl-font-display);
  font-size: 1.07rem;
  font-weight: 500;
}

.creatorlab-publish-action-copy p {
  max-width: 48rem;
  margin: 5px 0 0;
  color: rgba(255, 255, 255, 0.67) !important;
  font-size: 0.69rem;
  line-height: 1.5;
}

.creatorlab-publish-primary-action {
  display: inline-flex !important;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 205px;
  min-height: 46px;
  padding: 10px 18px !important;
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 20px rgba(23, 105, 224, 0.22) !important;
  font-size: 0.78rem !important;
  font-weight: 760 !important;
  white-space: nowrap;
}

.creatorlab-publish-primary-action:hover:not(:disabled) {
  background: var(--cl-accent-hover) !important;
  border-color: var(--cl-accent-hover) !important;
  transform: translateY(-1px) !important;
}

.creatorlab-publish-primary-action:disabled {
  color: rgba(255, 255, 255, 0.9) !important;
  background: #78879d !important;
  border-color: #78879d !important;
  box-shadow: none !important;
}

.creatorlab-publish-detail-panel {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-publish-detail-panel > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 50px;
  padding: 12px 16px;
  color: var(--cl-text) !important;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 690;
  list-style: none;
}

.creatorlab-publish-detail-panel > summary::-webkit-details-marker {
  display: none;
}

.creatorlab-publish-detail-panel > summary::after {
  color: var(--cl-soft);
  content: "+";
}

.creatorlab-publish-detail-panel[open] > summary::after {
  content: "−";
}

.creatorlab-publish-detail-body {
  display: grid;
  gap: 14px;
  padding: 15px;
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-publish-title-options,
.creatorlab-publish-chapters,
.creatorlab-publish-thumbnail-candidates {
  padding: 14px;
  background: #fffefa;
  border: 1px solid var(--cl-divider);
  border-radius: 11px;
}

.creatorlab-publish-title-options h3,
.creatorlab-publish-chapters h3,
.creatorlab-publish-thumbnail-candidates h3 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 0.94rem;
  font-weight: 500;
}

.creatorlab-publish-title-options ul,
.creatorlab-publish-chapters ol {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--cl-muted) !important;
  font-size: 0.68rem;
  line-height: 1.55;
}

.creatorlab-publish-thumbnail-candidate-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  margin-top: 11px;
}

.creatorlab-publish-thumbnail-candidate {
  overflow: hidden;
  padding: 0 !important;
  background: #ffffff !important;
  border: 1px solid var(--cl-border) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
}

.creatorlab-publish-thumbnail-candidate img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.creatorlab-publish-thumbnail-candidate span {
  display: block;
  padding: 7px;
  color: var(--cl-muted) !important;
  font-size: 0.59rem;
  font-weight: 690;
  text-align: left;
}

@media (max-width: 1080px) {
  .creatorlab-publish-media-grid,
  .creatorlab-publish-content-grid {
    grid-template-columns: 1fr;
  }

  .creatorlab-publish-thumbnail-card {
    display: grid;
    grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1fr);
    align-items: center;
  }

  .creatorlab-publish-thumbnail-card .creatorlab-publish-card-heading {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .creatorlab-publish-heading,
  .creatorlab-publish-action-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .creatorlab-publish-readiness,
  .creatorlab-publish-checklist {
    grid-template-columns: 1fr;
  }

  .creatorlab-publish-readiness-card + .creatorlab-publish-readiness-card {
    border-top: 1px solid var(--cl-divider);
    border-left: 0;
  }

  .creatorlab-publish-thumbnail-card {
    display: block;
  }

  .creatorlab-publish-primary-action {
    width: 100%;
    min-width: 0;
  }

  .creatorlab-publish-thumbnail-candidate-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* CreatorLab UX-R7.1 — discoverable Cast & Brand entry */
.creatorlab-cast-entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid #dce3ee;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.creatorlab-cast-entry-copy {
  min-width: 0;
}

.creatorlab-cast-entry-copy > span {
  display: block;
  margin-bottom: 7px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.creatorlab-cast-entry-copy > strong {
  display: block;
  color: #172033;
  font-size: 17px;
  line-height: 1.35;
}

.creatorlab-cast-entry-copy > p {
  max-width: 720px;
  margin-top: 7px;
  color: #5f6b7a !important;
  font-size: 13px;
  line-height: 1.6;
}

.creatorlab-cast-entry-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.creatorlab-cast-entry-actions > span {
  border: 1px solid #d8dee8;
  border-radius: 999px;
  background: #f7f8fa;
  color: #667085;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.creatorlab-cast-entry-actions > span.is-ready {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #16794a;
}

.creatorlab-cast-entry-actions > button {
  min-height: 44px;
  border: 1px solid #1d4ed8;
  border-radius: 12px;
  background: #2563eb;
  color: #ffffff !important;
  padding: 11px 16px;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.16);
}

.creatorlab-cast-entry-actions > button:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

@media (max-width: 760px) {
  .creatorlab-cast-entry-card {
    align-items: stretch;
    flex-direction: column;
    padding: 18px;
  }

  .creatorlab-cast-entry-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .creatorlab-cast-entry-actions > span {
    align-self: flex-start;
  }

  .creatorlab-cast-entry-actions > button {
    width: 100%;
  }
}

/* CreatorLab UX-R7 — Cast & Brand secondary production area */
.creatorlab-cast-brand-panel {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 16px;
  box-shadow: 0 7px 22px rgba(19, 36, 62, 0.045) !important;
}

.creatorlab-cast-brand-panel > summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  min-height: 88px;
  padding: 17px 18px;
  cursor: pointer;
  list-style: none;
}

.creatorlab-cast-brand-panel > summary::-webkit-details-marker,
.creatorlab-cast-member > summary::-webkit-details-marker,
.creatorlab-cast-brand-nested-details > summary::-webkit-details-marker {
  display: none;
}

.creatorlab-cast-brand-panel[open] > summary {
  background: #fffefa;
  border-bottom: 1px solid var(--cl-divider);
}

.creatorlab-cast-brand-summary-copy {
  min-width: 0;
}

.creatorlab-cast-brand-summary-copy > span,
.creatorlab-cast-brand-section-heading span,
.creatorlab-cast-brand-card-heading > span,
.creatorlab-cast-brand-intro > div:first-child > span {
  display: block;
  color: var(--cl-accent) !important;
  font-size: 0.62rem;
  font-weight: 760;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.creatorlab-cast-brand-summary-copy strong {
  display: block;
  margin-top: 5px;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.12rem;
  line-height: 1.15;
}

.creatorlab-cast-brand-summary-copy p {
  max-width: 48rem;
  margin-top: 5px;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
  line-height: 1.55;
}

.creatorlab-cast-brand-summary-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
}

.creatorlab-cast-brand-mode-pill,
.creatorlab-cast-brand-readiness,
.creatorlab-cast-brand-current-mode {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 9px;
  color: var(--cl-text) !important;
  background: var(--cl-surface-muted);
  border: 1px solid var(--cl-border);
  border-radius: 999px;
  font-size: 0.63rem;
  font-weight: 720;
  white-space: nowrap;
}

.creatorlab-cast-brand-mode-pill {
  color: var(--cl-accent) !important;
  background: var(--cl-accent-soft);
  border-color: var(--cl-accent-border);
}

.creatorlab-cast-brand-chevron {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: var(--cl-soft) !important;
  transition: transform 160ms ease;
}

.creatorlab-cast-brand-panel[open] > summary .creatorlab-cast-brand-chevron,
.creatorlab-cast-member[open] > summary .creatorlab-cast-brand-chevron {
  transform: rotate(180deg);
}

.creatorlab-cast-brand-body {
  display: grid;
  gap: 18px;
  padding: 18px;
  background: #fbfaf7;
}

.creatorlab-cast-brand-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 17px 18px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-cast-brand-intro strong {
  display: block;
  max-width: 54rem;
  margin-top: 6px;
  color: var(--cl-text-strong) !important;
  font-size: 0.96rem;
  line-height: 1.35;
}

.creatorlab-cast-brand-intro p {
  max-width: 56rem;
  margin-top: 6px;
  color: var(--cl-muted) !important;
  font-size: 0.72rem;
  line-height: 1.6;
}

.creatorlab-cast-brand-signal-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.creatorlab-cast-brand-signal-row span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 9px;
  color: var(--cl-soft) !important;
  background: var(--cl-surface-muted);
  border: 1px solid var(--cl-border);
  border-radius: 9px;
  font-size: 0.63rem;
  font-weight: 700;
}

.creatorlab-cast-brand-signal-row span.is-ready {
  color: var(--cl-success) !important;
  background: var(--cl-success-soft);
  border-color: #cfe8dc;
}

.creatorlab-cast-brand-section,
.creatorlab-cast-brand-card {
  padding: 18px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 14px;
}

.creatorlab-cast-brand-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 15px;
}

.creatorlab-cast-brand-section-heading h3 {
  margin-top: 5px;
  color: var(--cl-text-strong) !important;
  font-size: 0.94rem;
  line-height: 1.35;
}

.creatorlab-cast-brand-section-heading p {
  max-width: 52rem;
  margin-top: 5px;
  color: var(--cl-muted) !important;
  font-size: 0.7rem;
  line-height: 1.55;
}

.creatorlab-presentation-mode-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.creatorlab-presentation-mode {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  gap: 2px 10px;
  min-height: 112px;
  padding: 13px;
  text-align: left;
  background: #ffffff !important;
  border: 1px solid var(--cl-border) !important;
  border-radius: 12px !important;
  box-shadow: none !important;
}

.creatorlab-presentation-mode:hover:not(:disabled) {
  background: #fbfdff !important;
  border-color: var(--cl-accent-border) !important;
  transform: translateY(-1px) !important;
}

.creatorlab-presentation-mode.is-selected {
  background: var(--cl-accent-soft) !important;
  border-color: var(--cl-accent-border) !important;
  box-shadow: inset 0 0 0 1px rgba(23, 105, 224, 0.08) !important;
}

.creatorlab-presentation-mode:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.creatorlab-presentation-mode-mark {
  display: grid;
  grid-row: 1 / span 2;
  place-items: center;
  width: 32px;
  height: 32px;
  color: var(--cl-accent) !important;
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 9px;
  font-size: 0.7rem;
  font-weight: 800;
}

.creatorlab-presentation-mode strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.73rem;
  line-height: 1.35;
}

.creatorlab-presentation-mode small {
  grid-column: 2;
  color: var(--cl-muted) !important;
  font-size: 0.64rem;
  line-height: 1.5;
}

.creatorlab-cast-presence-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 12px 13px;
  background: var(--cl-warning-soft);
  border: 1px solid #efd9b6;
  border-radius: 11px;
}

.creatorlab-cast-presence-note strong {
  color: #76501c !important;
  font-size: 0.71rem;
}

.creatorlab-cast-presence-note p {
  margin-top: 3px;
  color: #8e6b39 !important;
  font-size: 0.64rem;
  line-height: 1.5;
}

.creatorlab-cast-presence-note button,
.creatorlab-cast-member-footer button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 7px 10px;
  color: var(--cl-danger) !important;
  background: #ffffff !important;
  border: 1px solid #edc9cd !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.64rem !important;
  font-weight: 720 !important;
}

.creatorlab-cast-brand-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.creatorlab-cast-brand-card {
  display: grid;
  align-content: start;
  gap: 12px;
}

.creatorlab-cast-brand-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.creatorlab-cast-brand-card-heading > strong {
  color: var(--cl-soft) !important;
  font-size: 0.63rem;
  font-weight: 720;
}

.creatorlab-cast-brand-card label,
.creatorlab-voice-direction-grid label,
.creatorlab-cast-member-body > label,
.creatorlab-cast-member-grid label,
.creatorlab-voice-tuning-grid label,
.creatorlab-cast-brand-nested-details label {
  display: grid;
  gap: 6px;
  color: var(--cl-text) !important;
  font-size: 0.66rem;
  font-weight: 700;
}

.creatorlab-cast-brand-card input,
.creatorlab-cast-brand-card textarea,
.creatorlab-voice-direction-grid input,
.creatorlab-voice-direction-grid select,
.creatorlab-cast-member input,
.creatorlab-cast-member textarea,
.creatorlab-cast-brand-nested-details input,
.creatorlab-cast-brand-nested-details textarea {
  width: 100%;
  padding: 10px 11px !important;
  color: var(--cl-text-strong) !important;
  background: #fffefa !important;
  border: 1px solid var(--cl-border) !important;
  border-radius: 10px !important;
  box-shadow: inset 0 1px 1px rgba(19, 36, 62, 0.02) !important;
  font-size: 0.72rem !important;
  font-weight: 500 !important;
  line-height: 1.5;
}

.creatorlab-cast-brand-card textarea,
.creatorlab-cast-member textarea,
.creatorlab-cast-brand-nested-details textarea {
  min-height: 76px;
  resize: vertical;
}

.creatorlab-cast-brand-card input:focus,
.creatorlab-cast-brand-card textarea:focus,
.creatorlab-voice-direction-grid input:focus,
.creatorlab-voice-direction-grid select:focus,
.creatorlab-cast-member input:focus,
.creatorlab-cast-member textarea:focus,
.creatorlab-cast-brand-nested-details input:focus,
.creatorlab-cast-brand-nested-details textarea:focus {
  border-color: var(--cl-accent) !important;
  box-shadow: 0 0 0 3px rgba(23, 105, 224, 0.09) !important;
}

.creatorlab-cast-brand-save,
.creatorlab-cast-brand-add,
.creatorlab-cast-reference-row button {
  justify-self: start;
  min-height: 35px;
  padding: 8px 12px;
  color: var(--cl-accent) !important;
  background: var(--cl-accent-soft) !important;
  border: 1px solid var(--cl-accent-border) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.66rem !important;
  font-weight: 740 !important;
}

.creatorlab-cast-brand-nested-details {
  overflow: hidden;
  background: #fbfaf7;
  border: 1px solid var(--cl-border);
  border-radius: 10px;
}

.creatorlab-cast-brand-nested-details > summary {
  padding: 10px 11px;
  color: var(--cl-text) !important;
  cursor: pointer;
  font-size: 0.67rem;
  font-weight: 720;
  list-style: none;
}

.creatorlab-cast-brand-nested-details > summary::after {
  float: right;
  color: var(--cl-soft);
  content: "+";
}

.creatorlab-cast-brand-nested-details[open] > summary::after {
  content: "−";
}

.creatorlab-cast-brand-nested-details > div {
  display: grid;
  gap: 11px;
  padding: 0 11px 11px;
  border-top: 1px solid var(--cl-divider);
  padding-top: 11px;
}

.creatorlab-voice-direction-grid,
.creatorlab-voice-tuning-grid,
.creatorlab-cast-member-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.creatorlab-voice-direction-grid small {
  color: var(--cl-soft) !important;
  font-size: 0.61rem;
  font-weight: 500;
  line-height: 1.45;
}

.creatorlab-voice-direction-section > .creatorlab-cast-brand-nested-details {
  margin-top: 12px;
}

.creatorlab-voice-tuning-grid label {
  padding: 11px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 9px;
}

.creatorlab-voice-tuning-grid input[type="range"] {
  padding: 0 !important;
  accent-color: var(--cl-accent);
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.creatorlab-cast-empty-state {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  min-height: 92px;
  padding: 15px;
  background: #fbfaf7;
  border: 1px dashed var(--cl-border-strong);
  border-radius: 12px;
}

.creatorlab-cast-empty-state > span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--cl-accent) !important;
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: 800;
}

.creatorlab-cast-empty-state strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.76rem;
}

.creatorlab-cast-empty-state p {
  margin-top: 4px;
  color: var(--cl-muted) !important;
  font-size: 0.66rem;
  line-height: 1.55;
}

.creatorlab-cast-card-list {
  display: grid;
  gap: 10px;
}

.creatorlab-cast-member {
  overflow: hidden;
  background: #fffefa;
  border: 1px solid var(--cl-border);
  border-radius: 12px;
}

.creatorlab-cast-member > summary {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 11px 12px;
  cursor: pointer;
  list-style: none;
}

.creatorlab-cast-member[open] > summary {
  background: #ffffff;
  border-bottom: 1px solid var(--cl-divider);
}

.creatorlab-cast-member-avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  overflow: hidden;
  color: var(--cl-accent) !important;
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-accent-border);
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 800;
}

.creatorlab-cast-member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creatorlab-cast-member-summary-copy strong {
  display: block;
  color: var(--cl-text-strong) !important;
  font-size: 0.74rem;
}

.creatorlab-cast-member-summary-copy span {
  display: block;
  margin-top: 3px;
  color: var(--cl-muted) !important;
  font-size: 0.63rem;
}

.creatorlab-cast-member-status {
  color: var(--cl-soft) !important;
  font-size: 0.61rem;
  font-weight: 700;
  white-space: nowrap;
}

.creatorlab-cast-member-body {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.creatorlab-cast-reference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  background: var(--cl-surface-muted);
  border: 1px solid var(--cl-border);
  border-radius: 10px;
}

.creatorlab-cast-reference-row strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.7rem;
}

.creatorlab-cast-reference-row p {
  margin-top: 3px;
  color: var(--cl-muted) !important;
  font-size: 0.62rem;
  line-height: 1.5;
}

.creatorlab-cast-reference-image {
  width: min(100%, 380px);
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border: 1px solid var(--cl-border);
  border-radius: 12px;
}

.creatorlab-cast-member-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 11px;
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-cast-member-footer span {
  color: var(--cl-soft) !important;
  font-size: 0.61rem;
}

.creatorlab-cast-brand-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: #14233b;
  border-radius: 12px;
}

.creatorlab-cast-brand-footer strong {
  color: #ffffff !important;
  font-size: 0.72rem;
}

.creatorlab-cast-brand-footer p {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.68) !important;
  font-size: 0.63rem;
  line-height: 1.5;
}

.creatorlab-cast-brand-footer > span {
  flex: 0 0 auto;
  padding: 6px 9px;
  color: #cfe1ff !important;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  font-size: 0.61rem;
  font-weight: 720;
}

@media (max-width: 1080px) {
  .creatorlab-presentation-mode-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .creatorlab-cast-brand-grid {
    grid-template-columns: 1fr;
  }

  .creatorlab-cast-brand-intro {
    grid-template-columns: 1fr;
  }

  .creatorlab-cast-brand-signal-row {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .creatorlab-cast-brand-panel > summary,
  .creatorlab-cast-brand-section-heading,
  .creatorlab-cast-presence-note,
  .creatorlab-cast-reference-row,
  .creatorlab-cast-member-footer,
  .creatorlab-cast-brand-footer {
    align-items: stretch;
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .creatorlab-cast-brand-summary-meta {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .creatorlab-cast-brand-chevron {
    display: none;
  }

  .creatorlab-presentation-mode-grid,
  .creatorlab-voice-direction-grid,
  .creatorlab-voice-tuning-grid,
  .creatorlab-cast-member-grid {
    grid-template-columns: 1fr;
  }

  .creatorlab-cast-brand-add,
  .creatorlab-cast-reference-row button,
  .creatorlab-cast-presence-note button {
    width: 100%;
  }

  .creatorlab-cast-member > summary {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .creatorlab-cast-member-status {
    grid-column: 2;
  }
}

/* CreatorLab UX-R9 — projects and readiness */
.creatorlab-project-hub {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 16px;
  box-shadow: 0 5px 18px rgba(19, 36, 62, 0.04) !important;
}

.creatorlab-project-hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.creatorlab-project-hub-heading {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.creatorlab-project-hub-kicker {
  margin: 0 !important;
  color: var(--cl-accent) !important;
  font-size: 0.62rem !important;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.creatorlab-project-hub-heading h2 {
  margin: 0;
  color: var(--cl-text-strong) !important;
  font-family: var(--cl-font-display);
  font-size: 1.08rem;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.creatorlab-project-hub-heading p:last-child {
  margin: 0 !important;
  color: var(--cl-muted) !important;
  font-size: 0.7rem !important;
  line-height: 1.45;
}

.creatorlab-project-hub-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.creatorlab-project-hub-actions button {
  min-height: 34px;
  padding: 7px 11px !important;
  color: var(--cl-text) !important;
  background: #fffefa !important;
  border: 1px solid var(--cl-border-strong) !important;
  border-radius: 9px !important;
  box-shadow: none !important;
  font-size: 0.68rem !important;
  font-weight: 720 !important;
}

.creatorlab-project-hub-actions button:hover:not(:disabled) {
  color: var(--cl-accent) !important;
  border-color: var(--cl-accent-border) !important;
}

.creatorlab-current-project {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) auto minmax(265px, 0.9fr);
  align-items: center;
  gap: 18px;
  padding: 15px;
  background: #fffefa;
  border: 1px solid var(--cl-divider);
  border-radius: 13px;
}

.creatorlab-current-project-copy {
  min-width: 0;
}

.creatorlab-current-project-copy span {
  display: block;
  margin-bottom: 4px;
  color: var(--cl-soft);
  font-size: 0.59rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.creatorlab-current-project-copy strong {
  display: block;
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-size: 0.8rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-current-project-copy small {
  display: block;
  margin-top: 4px;
  color: var(--cl-muted);
  font-size: 0.64rem;
  line-height: 1.4;
}

.creatorlab-project-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 5px 10px;
  color: var(--cl-muted);
  background: var(--cl-surface-muted);
  border: 1px solid var(--cl-border);
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 780;
  white-space: nowrap;
}

.creatorlab-project-status.is-ready {
  color: var(--cl-success);
  background: var(--cl-success-soft);
  border-color: #c8e5d7;
}

.creatorlab-project-status.is-exported {
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-color: var(--cl-accent-border);
}

.creatorlab-current-readiness {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.creatorlab-readiness-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 8px 9px;
  background: #ffffff;
  border: 1px solid var(--cl-divider);
  border-radius: 9px;
}

.creatorlab-readiness-item > span:first-child {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--cl-soft);
  background: var(--cl-surface-muted);
  border-radius: 50%;
  font-size: 0.56rem;
  font-weight: 800;
}

.creatorlab-readiness-item.is-ready > span:first-child {
  color: #ffffff;
  background: var(--cl-success);
}

.creatorlab-readiness-item div {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.creatorlab-readiness-item strong {
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-size: 0.61rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-readiness-item small {
  color: var(--cl-soft);
  font-size: 0.56rem;
  line-height: 1.2;
}

.creatorlab-project-library {
  display: grid;
  gap: 11px;
  padding-top: 13px;
  border-top: 1px solid var(--cl-divider);
}

.creatorlab-project-library-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.creatorlab-project-library-summary strong {
  color: var(--cl-text-strong) !important;
  font-size: 0.72rem;
}

.creatorlab-project-library-summary span {
  color: var(--cl-soft);
  font-size: 0.62rem;
}

.creatorlab-project-empty {
  display: grid;
  place-items: center;
  min-height: 104px;
  padding: 20px;
  color: var(--cl-muted) !important;
  background: var(--cl-surface-muted);
  border: 1px dashed var(--cl-border-strong);
  border-radius: 12px;
  font-size: 0.72rem;
  line-height: 1.5;
  text-align: center;
}

.creatorlab-project-list {
  display: grid;
  gap: 9px;
}

.creatorlab-project-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) minmax(116px, 0.42fr) auto;
  align-items: center;
  gap: 13px;
  padding: 10px;
  background: #ffffff;
  border: 1px solid var(--cl-border);
  border-radius: 12px;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.creatorlab-project-row:hover {
  transform: translateY(-1px);
  border-color: var(--cl-accent-border);
  box-shadow: 0 7px 18px rgba(19, 36, 62, 0.055) !important;
}

.creatorlab-project-row.is-current {
  background: #fbfdff;
  border-color: var(--cl-accent-border);
}

.creatorlab-project-thumbnail {
  display: grid;
  place-items: center;
  width: 86px;
  height: 58px;
  overflow: hidden;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border: 1px solid var(--cl-divider);
  border-radius: 9px;
  font-family: var(--cl-font-display);
  font-size: 0.83rem;
}

.creatorlab-project-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creatorlab-project-row-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.creatorlab-project-row-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.creatorlab-project-row-title strong {
  overflow: hidden;
  color: var(--cl-text-strong) !important;
  font-size: 0.73rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creatorlab-current-badge {
  flex: 0 0 auto;
  padding: 3px 6px;
  color: var(--cl-accent);
  background: var(--cl-accent-soft);
  border-radius: 999px;
  font-size: 0.52rem;
  font-weight: 800;
  text-transform: uppercase;
}

.creatorlab-project-row-copy p {
  margin: 0 !important;
  color: var(--cl-soft) !important;
  font-size: 0.6rem !important;
  line-height: 1.35;
}

.creatorlab-project-row-readiness {
  display: grid;
  gap: 6px;
}

.creatorlab-project-row-status-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.creatorlab-project-row-status-line span:last-child {
  color: var(--cl-accent);
  font-size: 0.6rem;
  font-weight: 800;
}

.creatorlab-project-row-track {
  height: 4px;
  overflow: hidden;
  background: #e8e7e2;
  border-radius: 999px;
}

.creatorlab-project-row-track span {
  display: block;
  height: 100%;
  background: var(--cl-accent);
  border-radius: inherit;
}

.creatorlab-project-row-signals {
  color: var(--cl-soft);
  font-size: 0.56rem;
  line-height: 1.35;
}

.creatorlab-project-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.creatorlab-project-row-actions button,
.creatorlab-project-row-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 6px 10px !important;
  border-radius: 8px !important;
  box-shadow: none !important;
  font-size: 0.63rem !important;
  font-weight: 750 !important;
  text-decoration: none;
  white-space: nowrap;
}

.creatorlab-project-row-actions button {
  color: #ffffff !important;
  background: var(--cl-accent) !important;
  border: 1px solid var(--cl-accent) !important;
}

.creatorlab-project-row-actions button:hover:not(:disabled) {
  background: var(--cl-accent-hover) !important;
  border-color: var(--cl-accent-hover) !important;
}

.creatorlab-project-row-actions a {
  color: var(--cl-text) !important;
  background: #fffefa !important;
  border: 1px solid var(--cl-border-strong) !important;
}

.creatorlab-project-row-actions button:disabled {
  cursor: wait;
  opacity: 0.58;
}

@media (max-width: 1080px) {
  .creatorlab-current-project {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .creatorlab-current-readiness {
    grid-column: 1 / -1;
  }

  .creatorlab-project-row {
    grid-template-columns: 72px minmax(0, 1fr) auto;
  }

  .creatorlab-project-thumbnail {
    width: 72px;
    height: 54px;
  }

  .creatorlab-project-row-readiness {
    grid-column: 2;
  }

  .creatorlab-project-row-actions {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
}

@media (max-width: 720px) {
  .creatorlab-project-hub-header,
  .creatorlab-project-library-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .creatorlab-project-hub-actions {
    width: 100%;
  }

  .creatorlab-project-hub-actions button {
    flex: 1;
  }

  .creatorlab-current-project {
    grid-template-columns: 1fr;
  }

  .creatorlab-current-project > .creatorlab-project-status {
    width: fit-content;
  }

  .creatorlab-current-readiness {
    grid-template-columns: 1fr;
  }

  .creatorlab-project-row {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .creatorlab-project-thumbnail {
    width: 64px;
    height: 52px;
  }

  .creatorlab-project-row-readiness,
  .creatorlab-project-row-actions {
    grid-column: 1 / -1;
    grid-row: auto;
  }

  .creatorlab-project-row-actions {
    justify-content: stretch;
  }

  .creatorlab-project-row-actions button,
  .creatorlab-project-row-actions a {
    flex: 1;
  }
}

/* The current center experience stays fully functional while later sprints move
   its capability groups into the four workflow stages. */
.creatorlab-main-column > * {
  min-width: 0;
  margin-block: 0 !important;
}

@media (max-width: 1379px) {
  .creatorlab-product-frame {
    grid-template-columns: 224px minmax(0, 1fr) 282px;
  }

  .creatorlab-main-column {
    padding-inline: 20px;
  }

  .creatorlab-workspace-topbar {
    grid-template-columns: minmax(220px, 1fr) minmax(330px, auto) minmax(150px, 1fr);
    padding-inline: 18px;
  }
}

@media (max-width: 1199px) {
  .creatorlab-product-frame {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .creatorlab-workspace-topbar {
    grid-column: 1 / -1;
    grid-template-columns: minmax(230px, 1fr) minmax(300px, auto) auto;
  }

  .creatorlab-workflow-rail {
    grid-column: 1;
  }

  .creatorlab-ai-workspace {
    display: none;
  }

  .creatorlab-main-column {
    grid-column: 2;
    grid-row: 2;
  }
}

@media (max-width: 899px) {
  .creatorlab-product-frame {
    display: block;
    border-inline: 0;
  }

  .creatorlab-workspace-topbar {
    position: sticky;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    min-height: 74px;
    padding: 10px 14px;
  }

  .creatorlab-readiness-block {
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: auto minmax(80px, 1fr) auto;
    width: 100%;
    padding-top: 8px;
    border-top: 1px solid var(--cl-divider);
  }

  .creatorlab-readiness-copy strong,
  .creatorlab-status-pill {
    display: none;
  }

  .creatorlab-topbar-actions {
    grid-column: 2;
    grid-row: 1;
  }

  .creatorlab-pulse-icon {
    display: none;
  }

  .creatorlab-workflow-rail {
    position: static;
    height: auto;
    padding: 14px;
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid var(--cl-border);
  }

  .creatorlab-rail-kicker,
  .creatorlab-rail-promise,
  .creatorlab-complete-badge {
    display: none;
  }

  .creatorlab-step-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(118px, 1fr));
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .creatorlab-workflow-step {
    grid-template-columns: 32px minmax(0, 1fr);
    min-height: 64px;
    padding: 9px;
  }

  .creatorlab-workflow-step::after {
    display: none;
  }

  .creatorlab-step-number {
    width: 32px;
    height: 32px;
    font-size: 0.95rem;
  }

  .creatorlab-step-copy strong {
    font-size: 0.84rem;
  }

  .creatorlab-step-copy span {
    font-size: 0.64rem;
  }

  .creatorlab-main-column {
    display: grid;
    gap: 18px;
    padding: 16px 14px 20px;
  }
}

@media (max-width: 599px) {
  .creatorlab-brand-mark {
    width: 38px;
    height: 38px;
    font-size: 0.95rem;
  }

  .creatorlab-brand-name {
    font-size: 1.5rem;
  }

  .creatorlab-project-name {
    max-width: 13rem;
  }

  .creatorlab-language-toggle button {
    min-width: 30px;
    padding-inline: 5px;
  }

  .creatorlab-readiness-copy span {
    font-size: 0.58rem;
  }
}


/* CreatorLab UX-R10 — responsive, state, accessibility and final product polish */
.creatorlab-product-frame {
  color-scheme: light;
  isolation: isolate;
}

.creatorlab-skip-link {
  position: fixed;
  top: 10px;
  left: 12px;
  z-index: 1000;
  padding: 10px 14px;
  color: #ffffff !important;
  background: var(--cl-accent);
  border: 1px solid var(--cl-accent);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(19, 36, 62, 0.18) !important;
  font-size: 0.75rem;
  font-weight: 750;
  text-decoration: none;
  transform: translateY(-160%);
  transition: transform 160ms ease;
}

.creatorlab-skip-link:focus {
  transform: translateY(0);
}

.creatorlab-product-frame :where(button, a, input, textarea, select, summary):focus-visible {
  outline: 3px solid rgba(23, 105, 224, 0.24) !important;
  outline-offset: 2px !important;
}

.creatorlab-product-frame :where(button, [role="button"], summary) {
  -webkit-tap-highlight-color: transparent;
}

.creatorlab-product-frame button:disabled,
.creatorlab-product-frame [aria-disabled="true"] {
  cursor: not-allowed !important;
  filter: saturate(0.62);
  opacity: 0.56 !important;
}

.creatorlab-product-frame button:not(:disabled):active,
.creatorlab-product-frame a:active,
.creatorlab-product-frame summary:active {
  transform: translateY(0) scale(0.99) !important;
}

.creatorlab-product-frame details > summary {
  min-height: 44px;
  cursor: pointer;
  user-select: none;
}

.creatorlab-product-frame input,
.creatorlab-product-frame textarea,
.creatorlab-product-frame select {
  min-height: 44px;
}

.creatorlab-product-frame textarea {
  line-height: 1.55;
  resize: vertical;
}

.creatorlab-product-frame ::selection {
  color: var(--cl-text-strong);
  background: #dbe9ff;
}

.creatorlab-main-column:focus {
  outline: none;
}

.creatorlab-main-column > [role="alert"] {
  color: #8f2632 !important;
  background: var(--cl-danger-soft) !important;
  border-color: #efc5ca !important;
}

.creatorlab-main-column > [role="status"] {
  color: #126847 !important;
  background: var(--cl-success-soft) !important;
  border-color: #c4e3d3 !important;
}

.creatorlab-workflow-rail::-webkit-scrollbar,
.creatorlab-ai-workspace::-webkit-scrollbar {
  width: 8px;
}

.creatorlab-workflow-rail::-webkit-scrollbar-thumb,
.creatorlab-ai-workspace::-webkit-scrollbar-thumb {
  background: #d9d6cf;
  border: 2px solid #fffdf9;
  border-radius: 999px;
}

.creatorlab-brief-heading h1,
.creatorlab-strategy-heading h1,
.creatorlab-production-heading h1,
.creatorlab-publish-heading h1 {
  text-wrap: balance;
}

.creatorlab-brief-heading > div > p:last-child,
.creatorlab-strategy-heading > div > p:last-child,
.creatorlab-production-heading > div > p:last-child,
.creatorlab-publish-heading > div > p:last-child {
  max-width: 720px;
  text-wrap: pretty;
}

@media (max-width: 1199px) and (min-width: 900px) {
  .creatorlab-ai-workspace {
    position: static;
    display: block;
    grid-column: 2;
    grid-row: 3;
    height: auto;
    max-height: none;
    padding: 22px 20px 28px;
    overflow: visible;
    border-top: 1px solid var(--cl-border);
    border-left: 0;
  }

  .creatorlab-ai-card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .creatorlab-stage-guidance {
    grid-template-columns: 34px minmax(0, 1fr);
  }
}

@media (max-width: 899px) {
  .creatorlab-product-frame {
    display: flex;
    flex-direction: column;
  }

  .creatorlab-workspace-topbar {
    order: 1;
  }

  .creatorlab-workflow-rail {
    order: 2;
  }

  .creatorlab-main-column {
    order: 3;
  }

  .creatorlab-ai-workspace {
    position: static;
    display: block;
    order: 4;
    width: 100%;
    height: auto;
    max-height: none;
    padding: 22px 14px 28px;
    overflow: visible;
    border-top: 1px solid var(--cl-border);
    border-left: 0;
  }

  .creatorlab-ai-card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .creatorlab-ai-heading,
  .creatorlab-ai-stage-summary,
  .creatorlab-stage-guidance,
  .creatorlab-ai-guidance-note {
    max-width: 760px;
    margin-inline: auto;
  }

  .creatorlab-ai-card-list {
    width: min(100%, 760px);
    margin-inline: auto;
  }

  .creatorlab-brief-action-bar,
  .creatorlab-strategy-action-bar,
  .creatorlab-production-action-bar,
  .creatorlab-publish-action-bar {
    position: sticky;
    bottom: 10px;
    z-index: 35;
    border-color: var(--cl-accent-border) !important;
    box-shadow: 0 14px 34px rgba(19, 36, 62, 0.13) !important;
  }
}

@media (max-width: 599px) {
  .creatorlab-workspace-topbar {
    gap: 9px;
  }

  .creatorlab-brand-block {
    gap: 10px;
  }

  .creatorlab-project-name {
    font-size: 0.67rem;
  }

  .creatorlab-step-list {
    scroll-snap-type: x proximity;
  }

  .creatorlab-workflow-step {
    scroll-snap-align: start;
  }

  .creatorlab-ai-card-list {
    grid-template-columns: 1fr;
  }

  .creatorlab-ai-card,
  .creatorlab-stage-guidance,
  .creatorlab-ai-stage-summary {
    border-radius: 12px;
  }

  .creatorlab-main-column {
    padding-bottom: 28px;
  }

  .creatorlab-brief-action-bar,
  .creatorlab-strategy-action-bar,
  .creatorlab-production-action-bar,
  .creatorlab-publish-action-bar {
    margin-inline: -2px;
    padding: 12px !important;
    border-radius: 14px !important;
  }

  .creatorlab-primary-action,
  .creatorlab-strategy-primary-action,
  .creatorlab-production-primary-action,
  .creatorlab-publish-primary-action {
    width: 100%;
    min-height: 48px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .creatorlab-product-frame *,
  .creatorlab-product-frame *::before,
  .creatorlab-product-frame *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
          `}</style>
        )}
        <WorldFocusRouter />
        <main
          data-storyverse-ui={isStoryverseFlow ? "true" : undefined}
          data-creatorlab-ui={isCreatorLabFlow ? "true" : undefined}
          className={`relative min-h-screen overflow-hidden ${
            isCreatorLabFlow
              ? "px-0 py-0 text-slate-900"
              : `px-3 py-6 sm:px-4 md:px-6 md:py-10 ${isStoryverseFlow ? "text-slate-100" : "text-slate-900"}`
          }`}
        >
      {isStoryverseFlow ? (
        <>
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_6%,rgba(56,189,248,0.18)_0%,transparent_31%),radial-gradient(circle_at_88%_10%,rgba(129,140,248,0.15)_0%,transparent_34%),radial-gradient(circle_at_52%_88%,rgba(14,165,233,0.10)_0%,transparent_38%),linear-gradient(180deg,#06111f_0%,#071727_48%,#09111f_100%)]" />
          <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-white/[0.08] to-transparent" />
          <div className="pointer-events-none fixed left-1/2 top-36 -z-10 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-cyan-300/[0.08] blur-3xl" />
          <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-72 w-full bg-gradient-to-t from-slate-950/70 to-transparent" />
        </>
      ) : isCreatorLabFlow ? (
        <>
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[#f7f6f2]" />
        </>
      ) : (
        <>
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_6%,#ffdff1_0%,transparent_30%),radial-gradient(circle_at_88%_10%,#d6f5ff_0%,transparent_34%),radial-gradient(circle_at_52%_88%,#fff0b8_0%,transparent_38%),radial-gradient(circle_at_16%_78%,#dcfff5_0%,transparent_28%),linear-gradient(180deg,#fffaf4_0%,#f7fbff_48%,#f4fff8_100%)]" />
          <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-white/70 to-transparent" />
          <div className="pointer-events-none fixed left-1/2 top-36 -z-10 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-white/35 blur-3xl" />
          <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-72 w-full bg-gradient-to-t from-white/55 to-transparent" />
        </>
      )}
      <div
        className={
          isCreatorLabFlow
            ? "creatorlab-product-frame relative z-10 w-full"
            : "relative z-10 mx-auto w-full max-w-7xl space-y-6 sm:space-y-8 md:space-y-12"
        }
      >
        {isCreatorLabFlow && (
          <a className="creatorlab-skip-link" href="#creatorlab-main-workspace">
            {uiLanguage === "en" ? "Skip to workspace" : "Çalışma alanına geç"}
          </a>
        )}

        {isCreatorLabFlow && (
          <header className="creatorlab-workspace-topbar">
            <div className="creatorlab-brand-block">
              <div className="creatorlab-brand-mark" aria-hidden="true">CL</div>
              <div className="min-w-0">
                <div className="creatorlab-brand-name">CreatorLab</div>
                <p className="creatorlab-project-name" title={creatorRawProjectTitle}>
                  {creatorProjectDisplayTitle}
                </p>
              </div>
            </div>

            <div className="creatorlab-readiness-block">
              <div className="creatorlab-readiness-copy">
                <span>{uiLanguage === "en" ? "Project readiness" : "Proje hazırlığı"}</span>
                <strong>{creatorReadinessLabel}</strong>
              </div>
              <div
                className="creatorlab-readiness-track"
                role="progressbar"
                aria-label={uiLanguage === "en" ? "Project readiness" : "Proje hazırlığı"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={creatorReadinessPercent}
              >
                <span style={{ width: `${creatorReadinessPercent}%` }} />
              </div>
              <span className="creatorlab-readiness-value">{creatorReadinessPercent}%</span>
              <span className={`creatorlab-status-pill is-${creatorProjectReadiness?.status || "draft"}`}>
                {creatorReadinessLabel}
              </span>
            </div>

            <div className="creatorlab-topbar-actions">
              <div className="creatorlab-language-toggle" aria-label={uiLanguage === "en" ? "Interface language" : "Arayüz dili"}>
                <button
                  type="button"
                  onClick={() => setUiLanguage("tr")}
                  aria-pressed={uiLanguage === "tr"}
                >
                  TR
                </button>
                <button
                  type="button"
                  onClick={() => setUiLanguage("en")}
                  aria-pressed={uiLanguage === "en"}
                >
                  EN
                </button>
              </div>
              <button
                type="button"
                className="creatorlab-pulse-icon"
                onClick={() => scrollCreatorWorkspaceTo("creatorlab-projects-readiness")}
                aria-label={uiLanguage === "en" ? "Open projects and readiness" : "Projeler ve hazırlık alanını aç"}
                title={uiLanguage === "en" ? "Projects and readiness" : "Projeler ve hazırlık"}
              >
                <CreatorWorkspaceIcon name="insights" />
              </button>
            </div>
          </header>
        )}

        {isCreatorLabFlow && (
          <aside className="creatorlab-workflow-rail" aria-label={uiLanguage === "en" ? "Project workflow" : "Proje akışı"}>
            <p className="creatorlab-rail-kicker">{uiLanguage === "en" ? "Project workflow" : "Proje akışı"}</p>
            <nav className="creatorlab-step-list" aria-label={uiLanguage === "en" ? "CreatorLab workflow steps" : "CreatorLab iş akışı adımları"}>
              {creatorWorkflowSteps.map((step) => {
                const isActive = creatorWorkspaceStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`creatorlab-workflow-step ${isActive ? "is-active" : ""} ${step.complete ? "is-complete" : ""}`}
                    aria-current={isActive ? "step" : undefined}
                    aria-disabled={!creatorCanOpenWorkspaceStep(step.id)}
                    disabled={!creatorCanOpenWorkspaceStep(step.id)}
                    onClick={() => navigateCreatorWorkspaceStep(step.id)}
                  >
                    <div className="creatorlab-step-number" aria-hidden="true">
                      {step.id}
                      {step.complete && <span className="creatorlab-step-check">✓</span>}
                    </div>
                    <div className="creatorlab-step-copy">
                      <strong>{step.title}</strong>
                      <span>{step.description}</span>
                    </div>
                    {step.complete && <span className="creatorlab-complete-badge" aria-label={uiLanguage === "en" ? "Complete" : "Tamamlandı"}>✓</span>}
                  </button>
                );
              })}
            </nav>
            <div className="creatorlab-rail-promise">
              <span aria-hidden="true">✦</span>
              <p>Brief in. Creator package out.</p>
            </div>
          </aside>
        )}

        {isCreatorLabFlow && (
          <aside className="creatorlab-ai-workspace" aria-label={uiLanguage === "en" ? "AI Workspace" : "AI Çalışma Alanı"}>
            <div className="creatorlab-ai-heading">
              <span className="creatorlab-ai-spark" aria-hidden="true">✦</span>
              <div>
                <p>AI Workspace</p>
                <span>{creatorWorkflowSteps[creatorWorkspaceStep - 1]?.title}</span>
              </div>
            </div>

            <div className="creatorlab-ai-stage-summary">
              <div className="creatorlab-ai-stage-summary-copy">
                <span>{uiLanguage === "en" ? "Stage readiness" : "Aşama hazırlığı"}</span>
                <strong>{creatorWorkspaceStageStatus}</strong>
              </div>
              <div
                className="creatorlab-ai-stage-progress"
                role="progressbar"
                aria-label={uiLanguage === "en" ? "Stage readiness" : "Aşama hazırlığı"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={creatorWorkspaceStageProgress}
              >
                <span style={{ width: `${creatorWorkspaceStageProgress}%` }} />
              </div>
              <small>{creatorWorkspaceStageProgress}%</small>
            </div>

            <div className="creatorlab-ai-card-list">
              {creatorWorkspaceCards.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className={`creatorlab-ai-card ${card.attention ? "is-attention" : ""}`}
                  onClick={() => scrollCreatorWorkspaceTo(card.targetId)}
                  aria-label={`${card.title}: ${card.status}`}
                >
                  <div className={`creatorlab-ai-icon is-${card.tone}`}>
                    <CreatorWorkspaceIcon name={card.icon} />
                  </div>
                  <div className="creatorlab-ai-card-copy">
                    <div className="creatorlab-ai-card-title-row">
                      <strong>{card.title}</strong>
                      <span className="creatorlab-ai-card-status">{card.status}</span>
                    </div>
                    <p>{card.description}</p>
                    {card.metric && <span className="creatorlab-ai-card-metric">{card.metric}</span>}
                    {typeof card.progress === "number" && (
                      <div className="creatorlab-ai-card-progress" aria-hidden="true">
                        <span style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }} />
                      </div>
                    )}
                    <span className="creatorlab-ai-card-link">
                      {uiLanguage === "en" ? "View in workspace" : "Çalışma alanında görüntüle"} →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="creatorlab-stage-guidance">
              <div className="creatorlab-stage-guidance-icon">
                <CreatorWorkspaceIcon name="safety" />
              </div>
              <div>
                <span className="creatorlab-stage-guidance-kicker">
                  {uiLanguage === "en" ? "Next best action" : "Sıradaki en iyi aksiyon"}
                </span>
                <strong>{creatorWorkspaceNextAction.title}</strong>
                <p>{creatorWorkspaceNextAction.description}</p>
                <button
                  type="button"
                  onClick={() => scrollCreatorWorkspaceTo(creatorWorkspaceNextAction.targetId)}
                >
                  {creatorWorkspaceNextAction.label}
                </button>
              </div>
            </div>

            <p className="creatorlab-ai-guidance-note">{creatorWorkspaceGuidance}</p>
          </aside>
        )}
                <div
                  id={isCreatorLabFlow ? "creatorlab-main-workspace" : undefined}
                  tabIndex={isCreatorLabFlow ? -1 : undefined}
                  className={isCreatorLabFlow ? "creatorlab-main-column" : "contents"}
                >
<div className={isCreatorLabFlow ? "hidden" : "flex justify-end"}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/22 px-2 py-1 text-xs text-slate-300 shadow-lg shadow-black/20 backdrop-blur-xl">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {uiLanguage === "en" ? "Interface" : "Arayüz"}
            </span>
            <button
              type="button"
              onClick={() => setUiLanguage("tr")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${uiLanguage === "tr" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
            >
              TR
            </button>
            <button
              type="button"
              onClick={() => setUiLanguage("en")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${uiLanguage === "en" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
            >
              EN
            </button>
          </div>
        </div>

        {/* X.1.B.2: Creator Lab shell foundation is available for creator-specific render activation. */}
        {isStoryverseFlow ? (
          <StoryverseCinematicIntro />
        ) : null}


        {isStoryverseFlow ? <FocusedWorldWorkspace /> : null}

{/* 🚀 EPISODE PACKAGE PANEL */}
<div className={`${isStoryverseFlow ? "" : "hidden"} rounded-[36px] border border-purple-400/20 bg-violet-50/80 p-6 mb-6`}>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-purple-300">
        {ui.episodePackage}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">
        {title || ui.notCreatedYet}
      </h3>
      <p className="text-sm text-violet-700/80 mt-1">
        {ui.episodePackageProductDesc}
      </p>
    </div>

    <div className="text-right text-sm text-violet-700">
      <div>{ui.flow}: {localizedSelectedFlow.shortTitle}</div>
      <div>{ui.language}: {language.toUpperCase()}</div>
    </div>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-center">
    <div>
      <p className="text-2xl font-bold">{characters.length}</p>
      <p className="text-xs text-violet-700/70">{ui.character}</p>
    </div>
    <div>
      <p className="text-2xl font-bold">{scenes.length}</p>
      <p className="text-xs text-violet-700/70">{ui.scene}</p>
    </div>
    <div>
      <p className="text-2xl font-bold">{audioReadyCount}</p>
      <p className="text-xs text-violet-700/70">{ui.audioReady}</p>
    </div>
    <div>
      <p className="text-2xl font-bold">{readyVideoCount}</p>
      <p className="text-xs text-violet-700/70">{ui.videoReady}</p>
    </div>
  </div>

  <div className="mt-6 flex flex-wrap gap-3">
    <button
      onClick={() => handleExportMovie(false)}
      disabled={isExportingMovie}
      className="rounded-2xl bg-purple-500 px-4 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
    >
      {exportedMovieUrl && hasReusableExport()
        ? (uiLanguage === "en" ? "▶ Open Existing Movie" : "▶ Mevcut Filmi Aç")
        : ui.createMovie}
    </button>

    <button
      type="button"
      onClick={() => handleExportMovie(true)}
      disabled={isExportingMovie || readyExportCount === 0 || isCreatorMediaGenerationBlocked}
      className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 transition hover:bg-amber-300/10 disabled:opacity-50"
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
      className="rounded-2xl border border-red-300/40 bg-rose-50/80 px-4 py-2 text-sm text-rose-700 transition hover:bg-red-300/10 disabled:opacity-50"
    >
      {uiLanguage === "en" ? "🗑 Reset Export" : "🗑 Exportu Sıfırla"}
    </button>

    <button
      onClick={handleCreateShareLink}
      disabled={shareLoading || !currentProjectId}
      className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
      title={!currentProjectId ? ui.saveProjectFirstTitle : ui.publicShareTitle}
    >
      {shareLoading ? ui.shareLinkCreating : ui.shareLinkCreate}
    </button>

    {shareUrl && (
      <button
        onClick={handleCopyShareLink}
        className="rounded-2xl border border-sky-200 px-4 py-2 text-sm text-sky-800"
      >
        {shareCopied ? ui.copied : ui.copyLink}
      </button>
    )}

    {(exportMovieResult?.downloadUrl || exportedMovieUrl) && (
      <button
        type="button"
        onClick={handleDownloadVideo}
        className="rounded-2xl border border-purple-300/40 px-4 py-2 text-sm transition hover:bg-purple-300/10"
      >
        {ui.download}
      </button>
    )}
  </div>

  {shareUrl && (
    <div className="mt-4 rounded-[28px] border border-sky-200 bg-sky-50/80 p-3 text-sm text-sky-800">
      <p className="text-xs uppercase tracking-[0.18em] text-sky-700">{ui.shareLink}</p>
      <a
        href={shareUrl}
        target="_blank"
        className="mt-1 block break-all text-sky-800 underline decoration-cyan-300/50 underline-offset-4"
      >
        {shareUrl}
      </a>
    </div>
  )}



  {shareUrl && (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-[28px] border border-purple-300/20 bg-violet-50/80 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-violet-700">
        {ui.openQr}
      </p>

      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
        alt="QR Code"
        className="rounded-2xl bg-white/82 p-2"
      />

      <p className="max-w-xs text-center text-xs text-violet-700/70">
        {ui.qrHint}
      </p>
    </div>
  )}

  {exportMovieResult && (
    <div className="mt-4 text-sm text-violet-700/80">
      <div>{ui.duration}: {formatDurationLabel(exportMovieResult.durationSeconds)}</div>
      <div>{ui.size}: {formatFileSizeLabel(exportMovieResult.sizeBytes)}</div>
      <div>{ui.scene}: {exportMovieResult.sceneCount}</div>
    </div>
  )}
</div>

        {userRole === "admin" && !isStoryverseFlow && !isCreatorLabFlow && (
          <div className="rounded-[28px] border border-yellow-400/30 bg-yellow-500/10 p-4 text-amber-700">
            {ui.adminMode}
          </div>
        )}

        {userRole === "parent" && !isStoryverseFlow && !isCreatorLabFlow && (
          <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-4 text-sky-700">
            {ui.parentMode}
          </div>
        )}

        <div className={`${isStoryverseFlow || isCreatorLabFlow ? "hidden" : ""} rounded-[28px] border border-sky-200 bg-sky-50/80 p-4 text-sky-800`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-sky-700">{ui.selectedFlow}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{localizedSelectedFlow.title}</h2>
              <p className="mt-1 text-sm leading-6 text-sky-800/90">{localizedSelectedFlow.description}</p>
              {isStoryverseFlow && (
                <p className="mt-2 text-xs leading-5 text-sky-800/80">
                  {ui.activeProductBehavior}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-orange-200/24 bg-white/74 px-3 py-1 text-slate-900">{selectedFlow.ageBand}</span>
              <span className="rounded-full border border-orange-200/24 bg-white/74 px-3 py-1 text-slate-900">{selectedFlow.durationMin} {ui.minuteShort}</span>
              {(activeFlowKey === "creator_lab"
                ? selectedFlow.zones.filter((zone: FlowZone) => zone !== "VR")
                : selectedFlow.zones
              ).map((zone: FlowZone) => (
                <span key={zone} className="rounded-full border border-orange-200/24 bg-white/74 px-3 py-1 text-slate-900">
                  {zone}
                </span>
              ))}
            </div>
          </div>
          {activeFlowKey !== "storyverse" && activeFlowKey !== "creator_lab" && (
            <p className="mt-3 rounded-2xl border border-yellow-300/20 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
              {ui.nonStoryversePilot}
            </p>
          )}
        </div>

        <div className={`${isCreatorLabFlow ? "hidden" : ""} overflow-hidden rounded-[32px] border border-orange-200/24 bg-white/74 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.35)]`}>
          <div className="grid gap-6 px-6 py-7 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-700">
                {ui.studioBadge}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">VELTO</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                  {ui.studioDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600 md:text-sm">
                <div className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1.5">{ui.storySetupChip}</div>
                <div className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1.5">{ui.sceneTimingChip}</div>
                <div className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1.5">{ui.voiceDialogueChip}</div>
                <div className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1.5">{ui.runwayVideoChip}</div>
                <div className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1.5">{ui.finalExportChip}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.sceneStatus}</p>
                <p className="mt-3 text-3xl font-semibold">{scenes.length}</p>
                <p className="mt-2 text-sm text-slate-600">{ui.totalScene}</p>
              </div>
              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.exportReady}</p>
                <p className="mt-3 text-3xl font-semibold">{readyExportCount}</p>
                <p className="mt-2 text-sm text-slate-600">{ui.exportReadyDesc}</p>
              </div>
              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.readyAudio}</p>
                <p className="mt-3 text-3xl font-semibold">{audioReadyCount}</p>
                <p className="mt-2 text-sm text-slate-600">{ui.readyAudioDesc}</p>
              </div>
              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.estimatedDuration}</p>
                <p className="mt-3 text-3xl font-semibold">{totalTargetDuration.toFixed(1)} {ui.secondShort}</p>
                <p className="mt-2 text-sm text-slate-600">{ui.estimatedDurationDesc}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={isCreatorLabFlow ? "block" : "grid gap-10 xl:grid-cols-[280px_minmax(0,1fr)]"}>
          <aside className={`${isCreatorLabFlow ? "hidden" : ""} space-y-4 xl:sticky xl:top-6 xl:self-start`}>
            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
              <p className="text-xs uppercase tracking-[0.22em] text-sky-700">{ui.journey}</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">{ui.studioRouteMap}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {ui.studioRouteMapDesc}
              </p>

              <div className="mt-5 space-y-3">
                {journeySteps.map((step) => (
                  <div
                    key={step.id}
                    className={`rounded-[28px] border p-4 transition ${
                      step.active
                        ? "border-sky-200 bg-sky-50/80"
                        : step.complete
                        ? "border-emerald-400/20 bg-teal-50/80"
                        : "border-orange-200/24 bg-white/74"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                          step.complete
                            ? "bg-emerald-400/20 text-teal-700"
                            : step.active
                            ? "bg-sky-50/80 text-sky-800"
                            : "bg-white/68 text-slate-600"
                        }`}
                      >
                        {step.complete ? "✓" : step.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
</aside>

          <div className="space-y-10">
        {!isCreatorLabFlow && (
        <div className="rounded-[28px] border border-orange-200/24 bg-white/62 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{ui.childProfile}</h2>
            {selectedChild ? (
              <span className="rounded-full border border-emerald-400/30 bg-teal-50/80 px-3 py-1 text-xs text-teal-700">
                {ui.activeChild}: {selectedChild.nickname}
              </span>
            ) : (
              <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs text-amber-700">
                {ui.noChildSelected}
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              disabled={childrenLoading}
            >
              <option value="">{ui.chooseChild}</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.nickname}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                placeholder={ui.newChildName}
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
              />
              <button
                onClick={handleAddChild}
                disabled={addingChild}
                className="rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
              >
                {addingChild ? ui.adding : ui.add}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            {ui.childProfileHint}
          </p>
        </div>
        )}

        {isCreatorLabFlow ? (
          <section id="creatorlab-projects-readiness" className={`creatorlab-project-hub ${creatorWorkspaceStep === 1 ? "" : "hidden"}`} aria-label={uiLanguage === "en" ? "Projects and readiness" : "Projeler ve hazırlık"}>
            <div className="creatorlab-project-hub-header">
              <div className="creatorlab-project-hub-heading">
                <p className="creatorlab-project-hub-kicker">{uiLanguage === "en" ? "Projects & readiness" : "Projeler ve hazırlık"}</p>
                <h2>{uiLanguage === "en" ? "Continue without losing context" : "Bağlamı kaybetmeden devam et"}</h2>
                <p>
                  {uiLanguage === "en"
                    ? "The current project stays visible; recent projects open only when you need them."
                    : "Mevcut proje görünür kalır; önceki projeler yalnızca ihtiyaç duyduğunda açılır."}
                </p>
              </div>
              <div className="creatorlab-project-hub-actions">
                {!creatorProjectsHidden && (
                  <button type="button" onClick={fetchProjects} disabled={loadingProjects}>
                    {loadingProjects ? ui.refreshing : ui.refresh}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCreatorProjectsHidden((previous) => !previous)}
                  aria-expanded={!creatorProjectsHidden}
                  aria-controls="creatorlab-project-library"
                >
                  {creatorProjectsHidden
                    ? uiLanguage === "en" ? "Open recent projects" : "Son projeleri aç"
                    : uiLanguage === "en" ? "Close projects" : "Projeleri kapat"}
                </button>
              </div>
            </div>

            <div className="creatorlab-current-project">
              <div className="creatorlab-current-project-copy">
                <span>{uiLanguage === "en" ? "Current project" : "Mevcut proje"}</span>
                <strong title={creatorRawProjectTitle}>{creatorProjectDisplayTitle}</strong>
                <small>
                  {currentProjectId
                    ? `${uiLanguage === "en" ? "Last saved" : "Son kayıt"}: ${creatorCurrentProjectUpdatedLabel}`
                    : input.trim()
                      ? uiLanguage === "en" ? "New project · not saved yet" : "Yeni proje · henüz kaydedilmedi"
                      : uiLanguage === "en" ? "Start with a brief to create a project" : "Proje oluşturmak için brief ile başla"}
                </small>
              </div>

              <span className={`creatorlab-project-status is-${creatorProjectReadiness?.status || "draft"}`}>
                {creatorReadinessLabel}
              </span>

              <div className="creatorlab-current-readiness" aria-label={uiLanguage === "en" ? "Current project readiness" : "Mevcut proje hazırlığı"}>
                {[
                  {
                    label: uiLanguage === "en" ? "Visuals" : "Görseller",
                    ready: creatorProjectReadiness?.visuals === "ready",
                    detail: creatorProjectReadiness?.totalScenes
                      ? `${creatorProjectReadiness.visualReadyCount}/${creatorProjectReadiness.totalScenes}`
                      : uiLanguage === "en" ? "Not started" : "Başlamadı",
                  },
                  {
                    label: uiLanguage === "en" ? "Voice-over" : "Seslendirme",
                    ready: creatorProjectReadiness?.voiceOver === "ready",
                    detail: creatorProjectReadiness?.totalScenes
                      ? `${creatorProjectReadiness.voiceReadyCount}/${creatorProjectReadiness.totalScenes}`
                      : uiLanguage === "en" ? "Not started" : "Başlamadı",
                  },
                  {
                    label: uiLanguage === "en" ? "Final video" : "Final video",
                    ready: creatorProjectReadiness?.finalVideo === "ready",
                    detail: creatorProjectReadiness?.finalVideo === "ready"
                      ? uiLanguage === "en" ? "Ready" : "Hazır"
                      : uiLanguage === "en" ? "Pending" : "Bekliyor",
                  },
                ].map((item) => (
                  <div key={item.label} className={`creatorlab-readiness-item ${item.ready ? "is-ready" : ""}`}>
                    <span aria-hidden="true">{item.ready ? "✓" : "○"}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!creatorProjectsHidden && (
              <div id="creatorlab-project-library" className="creatorlab-project-library">
                <div className="creatorlab-project-library-summary">
                  <strong>{uiLanguage === "en" ? "Recent CreatorLab projects" : "Son CreatorLab projeleri"}</strong>
                  <span>
                    {creatorProjectRecords.length} {uiLanguage === "en" ? "saved projects" : "kayıtlı proje"}
                  </span>
                </div>

                {loadingProjects ? (
                  <div className="creatorlab-project-empty">{ui.projectsLoading}</div>
                ) : creatorProjectRecords.length === 0 ? (
                  <div className="creatorlab-project-empty">
                    {uiLanguage === "en"
                      ? "No CreatorLab project has been saved yet. Your first saved production will appear here."
                      : "Henüz kayıtlı CreatorLab projesi yok. İlk kaydedilen üretimin burada görünecek."}
                  </div>
                ) : (
                  <div className="creatorlab-project-list">
                    {creatorProjectRecords.slice(0, 6).map((project) => {
                      const previewImage = getProjectPreviewImage(project);
                      const snapshot = getCreatorProjectSnapshot(project);
                      const isCurrentProject = String(project?.id || "") === currentProjectId;

                      return (
                        <article key={project.id} className={`creatorlab-project-row ${isCurrentProject ? "is-current" : ""}`}>
                          <div className="creatorlab-project-thumbnail">
                            {previewImage ? (
                              <img src={previewImage} alt="" />
                            ) : (
                              <span aria-hidden="true">CL</span>
                            )}
                          </div>

                          <div className="creatorlab-project-row-copy">
                            <div className="creatorlab-project-row-title">
                              <strong title={project.title || ui.untitledProject}>
                                {project.title || ui.untitledProject}
                              </strong>
                              {isCurrentProject && (
                                <span className="creatorlab-current-badge">{uiLanguage === "en" ? "Current" : "Mevcut"}</span>
                              )}
                            </div>
                            <p>
                              {uiLanguage === "en" ? "Updated" : "Güncellendi"}: {formatCreatorProjectUpdatedAt(project.updated_at || project.created_at)}
                            </p>
                          </div>

                          <div className="creatorlab-project-row-readiness">
                            <div className="creatorlab-project-row-status-line">
                              <span className={`creatorlab-project-status is-${snapshot.status}`}>
                                {creatorProjectStatusLabel(snapshot.status)}
                              </span>
                              <span>{snapshot.progress}%</span>
                            </div>
                            <div className="creatorlab-project-row-track" aria-hidden="true">
                              <span style={{ width: `${snapshot.progress}%` }} />
                            </div>
                            <span className="creatorlab-project-row-signals">
                              {uiLanguage === "en" ? "Visuals" : "Görsel"} {snapshot.visualReadyCount}/{snapshot.totalScenes} · {uiLanguage === "en" ? "Voice" : "Ses"} {snapshot.voiceReadyCount}/{snapshot.totalScenes}
                            </span>
                          </div>

                          <div className="creatorlab-project-row-actions">
                            <button
                              type="button"
                              onClick={() => loadProjectById(project.id)}
                              disabled={isLoadingProject}
                            >
                              {isLoadingProject
                                ? uiLanguage === "en" ? "Opening…" : "Açılıyor…"
                                : isCurrentProject
                                  ? uiLanguage === "en" ? "Reload" : "Yeniden yükle"
                                  : uiLanguage === "en" ? "Continue" : "Devam et"}
                            </button>
                            {project.exported_movie_url && (
                              <a href={project.exported_movie_url} target="_blank" rel="noreferrer">
                                {uiLanguage === "en" ? "Video" : "Video"}
                              </a>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-[28px] border border-orange-200/24 bg-white/62 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedFlowProjectTitle}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {uiLanguage === "en" ? "Only Storyverse projects are shown." : "Yalnızca Storyverse projeleri gösteriliyor."}
                </p>
              </div>
              <button
                onClick={fetchProjects}
                disabled={loadingProjects}
                className="rounded-2xl border border-orange-200/24 bg-white/68 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/82/15 disabled:opacity-50"
              >
                {loadingProjects ? ui.refreshing : ui.refresh}
              </button>
            </div>

            {loadingProjects ? (
              <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-4 text-sm text-slate-600">{ui.projectsLoading}</div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-4 text-sm text-slate-600">{ui.noProjects}</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredProjects.map((project) => {
                  const previewImage = getProjectPreviewImage(project);
                  const projectStatus = getProjectStatusLabel(project);
                  const flowLabel = getProjectFlowLabel(project);

                  return (
                    <article key={project.id} className="overflow-hidden rounded-[28px] border border-orange-200/24 bg-white/74 transition hover:border-sky-200 hover:bg-white/78">
                      <div className="h-36 w-full overflow-hidden bg-white/74">
                        {previewImage ? (
                          <img src={previewImage} alt={project.title || ui.untitledProject} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            {uiLanguage === "en" ? "No Preview" : "Önizleme Yok"}
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-5 text-slate-900">{project.title || ui.untitledProject}</h3>
                          <span className="rounded-full border border-sky-200 bg-sky-50/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">{flowLabel}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span>{projectStatus}</span>
                          <span>{project.updated_at ? new Date(project.updated_at).toLocaleString() : "-"}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => loadProjectById(project.id)} disabled={isLoadingProject} className="rounded-2xl border border-orange-200/24 bg-white/68 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/74 disabled:cursor-not-allowed disabled:opacity-60">{ui.open}</button>
                          {project.exported_movie_url ? (
                            <a href={project.exported_movie_url} target="_blank" rel="noreferrer" className="rounded-2xl bg-cyan-400 px-3 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-cyan-300">{uiLanguage === "en" ? "Movie" : "Film"}</a>
                          ) : (
                            <button type="button" disabled className="rounded-2xl border border-orange-200/24 bg-white/74 px-3 py-2 text-xs font-semibold text-slate-500">{uiLanguage === "en" ? "No Movie" : "Film Yok"}</button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div id={isCreatorLabFlow ? "creatorlab-brief-canvas" : undefined} className={isCreatorLabFlow ? (creatorBriefCanvasVisible ? "creatorlab-brief-experience" : "hidden") : "space-y-4 rounded-[28px] border border-orange-200/24 bg-white/62 p-6"}>
          {isCreatorLabFlow && (
            <>
              <div className="creatorlab-brief-heading">
                <div>
                  <p className="creatorlab-brief-kicker">{uiLanguage === "en" ? "Step 1 · Brief" : "Adım 1 · Brief"}</p>
                  <h1>{uiLanguage === "en" ? "Project Brief" : "Proje Brief'i"}</h1>
                  <p>
                    {uiLanguage === "en"
                      ? "Define the idea and essential production choices. CreatorLab will use this brief to validate the opportunity before media credits are spent."
                      : "Fikri ve temel üretim tercihlerini tanımla. CreatorLab, medya kredileri kullanılmadan önce içerik fırsatını bu brief üzerinden doğrular."}
                  </p>
                </div>
                <span className="creatorlab-brief-step-badge">{uiLanguage === "en" ? "Draft stage" : "Taslak aşaması"}</span>
              </div>

              <section className="creatorlab-topic-card">
                <div className="creatorlab-topic-header">
                  <div>
                    <label htmlFor="creatorlab-topic-input">
                      {uiLanguage === "en" ? "What do you want to create?" : "Ne üretmek istiyorsun?"}
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
            </>
          )}

          <div className={isCreatorLabFlow ? "creatorlab-brief-language-row" : "grid gap-4 md:grid-cols-2"}>
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

          {isCreatorLabFlow && (
            <section id="creatorlab-brief-settings" className="creatorlab-brief-card">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-sky-700">
                  {uiLanguage === "en" ? "Essential choices" : "Temel tercihler"}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {uiLanguage === "en" ? "Shape the production brief" : "Üretim brief'ini şekillendir"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-sky-800/80">
                  {uiLanguage === "en"
                    ? "Choose the audience, market, format, duration and one authoritative production quality level."
                    : "Hedef kitleyi, pazarı, formatı, süreyi ve tek yetkili Production Quality seviyesini seç."}
                </p>
              </div>

              <details id="creatorlab-brief-profile" className="creatorlab-profile-details">
                <summary>
                  <div className="creatorlab-profile-summary-copy">
                    <strong>{uiLanguage === "en" ? "Creator Profile defaults" : "Creator Profile varsayılanları"}</strong>
                    <span>
                      {uiLanguage === "en"
                        ? "Apply your audience, brand voice and visual direction when they are useful."
                        : "Gerektiğinde hedef kitle, marka sesi ve görsel yön varsayılanlarını uygula."}
                    </span>
                  </div>
                  <div className="creatorlab-profile-summary-values" aria-hidden="true">
                    <span>{creatorProfile.brandName || (uiLanguage === "en" ? "No brand" : "Marka yok")}</span>
                    <span>{creatorProfile.defaultAudience || (uiLanguage === "en" ? "Audience optional" : "Kitle opsiyonel")}</span>
                  </div>
                  <span className="creatorlab-details-chevron" aria-hidden="true">⌄</span>
                </summary>

                <div className="creatorlab-profile-body">
                  <div className="creatorlab-profile-actions">
                    <p>
                      {uiLanguage === "en"
                        ? "Profile values remain optional and never block the brief."
                        : "Profil değerleri opsiyoneldir ve brief akışını engellemez."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyCreatorProfile()}
                        disabled={!creatorProfileLoaded || !hasCreatorProfileContext(creatorProfile)}
                      >
                        {uiLanguage === "en" ? "Apply defaults" : "Varsayılanları uygula"}
                      </button>
                      <button type="button" onClick={saveCreatorProfile}>
                        {uiLanguage === "en" ? "Save profile" : "Profili kaydet"}
                      </button>
                    </div>
                  </div>

                  <div className="creatorlab-profile-input-grid">
                    <input
                      value={creatorProfile.brandName}
                      onChange={(event) => setCreatorProfile((current) => ({ ...current, brandName: event.target.value }))}
                      placeholder={uiLanguage === "en" ? "Creator or brand name" : "Creator veya marka adı"}
                    />
                    <input
                      value={creatorProfile.defaultAudience}
                      onChange={(event) => setCreatorProfile((current) => ({ ...current, defaultAudience: event.target.value }))}
                      placeholder={uiLanguage === "en" ? "Default audience" : "Varsayılan hedef kitle"}
                    />
                    <input
                      value={creatorProfile.brandVoice}
                      onChange={(event) => setCreatorProfile((current) => ({ ...current, brandVoice: event.target.value }))}
                      placeholder={uiLanguage === "en" ? "Brand voice (direct, credible, optimistic...)" : "Marka sesi (net, güvenilir, iyimser...)"}
                    />
                    <input
                      value={creatorProfile.defaultVisualStyle}
                      onChange={(event) => setCreatorProfile((current) => ({ ...current, defaultVisualStyle: event.target.value }))}
                      placeholder={uiLanguage === "en" ? "Default visual style" : "Varsayılan görsel stil"}
                    />
                  </div>
                </div>
              </details>

              <div className="creatorlab-brief-fields">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.targetMarket}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    value={creatorCountry}
                    onChange={(e) => setCreatorCountry(e.target.value)}
                  >
                    {CREATOR_COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.ageGroup}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    value={creatorAgeGroup}
                    onChange={(e) => setCreatorAgeGroup(e.target.value as CreatorAgeGroup)}
                  >
                    {CREATOR_AGE_GROUP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.contentType}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    value={creatorContentType}
                    onChange={(e) =>
                      setCreatorContentType(e.target.value as CreatorContentType)
                    }
                  >
                    {CREATOR_CONTENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-1">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.videoFormat}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    value={creatorFormat}
                    onChange={(e) => handleCreatorFormatChange(e.target.value as CreatorFormat)}
                  >
                    {CREATOR_FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-sky-800/75">
                    {CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.guidance}
                  </p>
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.creatorDurationTitle}
                  </label>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(160px,0.55fr)]">
                    <select
                      className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                      value={creatorDurationPreset}
                      onChange={(e) =>
                        handleCreatorDurationPresetChange(
                          e.target.value as CreatorDurationPreset
                        )
                      }
                    >
                      {getCreatorDurationOptions().map((option) => (
                        <option key={option.preset} value={option.preset}>
                          {option.label} / {getCreatorSceneCountForTargetDuration(option.seconds)} {ui.sceneCountLabel}
                        </option>
                      ))}
                      <option value="custom">{ui.customDuration}</option>
                    </select>

                    {creatorDurationPreset === "custom" && (
                      <input
                        type="number"
                        min={creatorFormat === "youtube_video" ? 1 : 5}
                        max={creatorFormat === "youtube_video" ? 60 : 180}
                        step={creatorFormat === "youtube_video" ? 0.5 : 1}
                        className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                        value={getCreatorCustomDurationInputValue()}
                        onChange={(e) => handleCreatorCustomDurationChange(e.target.value)}
                        aria-label={
                          creatorFormat === "youtube_video"
                            ? ui.customDurationMinutes
                            : ui.customDurationSeconds
                        }
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-sky-800/75">
                    {ui.durationScenePlan}: {getCreatorDurationLabel()} / {getCreatorSceneCount()} {ui.sceneCountLabel}
                  </p>
                </div>

                <div id="creatorlab-quality-panel" className="creatorlab-quality-panel">
                  <div className="creatorlab-quality-heading">
                    <div>
                      <label>{ui.creatorQualityTitle}</label>
                      <p>
                        {uiLanguage === "en"
                          ? "This is the single quality and credit decision for the project. Technical media routing stays internal."
                          : "Bu alan projenin tek kalite ve kredi kararıdır. Teknik medya yönlendirmesi sistem içinde kalır."}
                      </p>
                    </div>
                    <div className="creatorlab-credit-profile">
                      <span>{ui.creditProfile}</span>
                      <strong>{getCreatorQualityCreditTier()}</strong>
                    </div>
                  </div>

                  <div className="creatorlab-quality-options">
                    {CREATOR_QUALITY_MODE_OPTIONS.map((option) => {
                      const isSelected = option.value === creatorQualityMode;
                      const label = uiLanguage === "en" ? option.labelEn : option.labelTr;
                      const guidance = uiLanguage === "en" ? option.guidanceEn : option.guidanceTr;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setCreatorQualityMode(option.value)}
                          className={`creatorlab-quality-option ${isSelected ? "is-selected" : ""}`}
                          aria-pressed={isSelected}
                        >
                          <strong>{label}</strong>
                          <span>{guidance}</span>
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const estimate = getCreatorQualityEstimate();
                    return (
                      <div className="creatorlab-quality-summary">
                        <div className="creatorlab-quality-metric">
                          <span>{uiLanguage === "en" ? "Credit estimate" : "Kredi tahmini"}</span>
                          <strong>{estimate.estimatedCredits}</strong>
                        </div>
                        <div className="creatorlab-quality-metric">
                          <span>{uiLanguage === "en" ? "Selected quality" : "Seçilen kalite"}</span>
                          <strong>{getCreatorQualityModeLabel()}</strong>
                        </div>
                        <p>{getCreatorQualityModeGuidance()}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div id="creatorlab-brief-action" className="creatorlab-brief-action-bar">
                <div className="creatorlab-brief-action-copy">
                  <strong>{uiLanguage === "en" ? "Ready to validate the idea?" : "Fikri doğrulamaya hazır mısın?"}</strong>
                  <p>
                    {input.trim()
                      ? (uiLanguage === "en" ? "CreatorLab will analyze the opportunity and prepare the Strategy workspace." : "CreatorLab içerik fırsatını analiz edip Strategy çalışma alanını hazırlayacak.")
                      : (uiLanguage === "en" ? "Enter a topic or video idea to continue." : "Devam etmek için bir konu veya video fikri gir.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={createSetup}
                  disabled={loadingSetup || !input.trim()}
                  className="creatorlab-primary-action"
                >
                  {creatorMentorLoading ? ui.analyzingContentOpportunity : ui.analyzeContentOpportunity}
                </button>
              </div>
            </section>
          )}

          {isCreatorLabFlow && (
            <details className="creatorlab-secondary-panel">
              <summary>
                <div className="creatorlab-secondary-summary-copy">
                  <strong>{uiLanguage === "en" ? "Advanced idea tools" : "Gelişmiş fikir araçları"}</strong>
                  <span>{uiLanguage === "en" ? "YouTube research, pattern analysis and bulk idea generation remain available on demand." : "YouTube araştırması, pattern analizi ve toplu fikir üretimi gerektiğinde kullanılabilir."}</span>
                </div>
                <span className="creatorlab-secondary-status">{youtubeResearchVideos.length > 0 || bulkResults.length > 0 ? (uiLanguage === "en" ? "Results available" : "Sonuç mevcut") : (uiLanguage === "en" ? "Optional" : "Opsiyonel")}</span>
                <span className="creatorlab-details-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="creatorlab-secondary-body space-y-4">
            <div className="rounded-[28px] border border-rose-200 bg-rose-50/80 p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-red-200">
                    Explore Popular Ideas
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {ui.youtubeResearchTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-red-50/80">
                    {ui.youtubeResearchDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleYoutubeResearch}
                  disabled={youtubeResearchLoading}
                  className="rounded-[28px] bg-red-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {youtubeResearchLoading
                    ? ui.youtubeResearchLoading
                    : ui.youtubeResearchButton}
                </button>
              </div>

              {youtubeResearchVideos.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {youtubeResearchVideos.map((video) => (
                    <article
                      key={video.id}
                      className="overflow-hidden rounded-[28px] border border-orange-200/24 bg-white/74"
                    >
                      <div className="h-32 w-full overflow-hidden bg-white/74">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            YouTube
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 p-3">
                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                          {video.title}
                        </h4>
                        <p className="text-xs text-slate-500">{video.channel}</p>

                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                          <span>
                            {formatYoutubeNumber(video.views)} {ui.youtubeResearchViews}
                          </span>
                          <span>•</span>
                          <span>
                            {formatYoutubeNumber(video.likes)} {ui.youtubeResearchLikes}
                          </span>
                          <span>•</span>
                          <span>
                            {ui.youtubeResearchDuration}: {formatYoutubeDuration(video.durationSec)}
                          </span>
                        </div>

                        <a
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-2xl border border-orange-200/24 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-white/68"
                        >
                          YouTube
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {!youtubeResearchLoading && youtubeResearchVideos.length === 0 && (
                <p className="text-sm text-red-50/70">
                  {ui.youtubeResearchEmpty}
                </p>
              )}
            </div>

            <div className="rounded-[28px] border border-purple-300/20 bg-violet-50/80 p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-violet-700">
                    Smart Creator Tips
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {ui.patternEngineTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-purple-50/80">
                    {ui.patternEngineDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleYoutubePatternEngine}
                  disabled={youtubePatternLoading || youtubeResearchVideos.length === 0}
                  className="rounded-[28px] bg-purple-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {youtubePatternLoading
                    ? ui.patternEngineLoading
                    : ui.patternEngineButton}
                </button>
              </div>

              {!youtubePatternSummary && !youtubePatternLoading && (
                <p className="text-sm text-purple-50/70">
                  {ui.patternEngineEmpty}
                </p>
              )}

              {youtubePatternSummary && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">{ui.patternTopTitles}</h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                      {youtubePatternSummary.topTitlePatterns.map((item, index) => (
                        <li key={`title-pattern-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">{ui.patternHooks}</h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                      {youtubePatternSummary.hookPatterns.map((item, index) => (
                        <li key={`hook-pattern-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">{ui.patternAngle}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {youtubePatternSummary.recommendedContentAngle}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {ui.patternDuration}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {youtubePatternSummary.recommendedDurationSec}s
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {ui.patternOpportunity}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {youtubePatternSummary.opportunityScore}/100
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {ui.patternCompetition}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900 capitalize">
                          {youtubePatternSummary.competitionLevel}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-400/10 p-3 text-sm text-purple-50">
                      <p>
                        {ui.creatorDurationTitle}: {getCreatorDurationLabel()} /{" "}
                        {getCreatorSceneCount()} {ui.sceneCountLabel}
                      </p>
                      <button
                        type="button"
                        onClick={applyPatternRecommendedDuration}
                        className="mt-3 rounded-2xl border border-purple-200/30 px-3 py-2 text-xs font-semibold text-purple-50 transition hover:bg-purple-200/10"
                      >
                        {ui.usePatternDuration}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 lg:col-span-2">
                    <h4 className="font-semibold text-slate-900">{ui.patternReasoning}</h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                      {youtubePatternSummary.reasoning.map((item, index) => (
                        <li key={`pattern-reasoning-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <section
              data-bulk-generator-panel="true"
              className="rounded-[28px] border border-indigo-200 bg-indigo-50/800/[0.08] p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-indigo-700">
                    Idea Machine
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {ui.bulkGeneratorTitle}
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-indigo-700/80">
                    {ui.bulkGeneratorDesc}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <label className="block text-sm font-medium text-indigo-700">
                    {ui.bulkTopicsLabel}
                  </label>
                  <textarea
                    value={bulkTopics}
                    onChange={(e) => setBulkTopics(e.target.value)}
                    placeholder={ui.bulkTopicsPlaceholder}
                    className="mt-2 min-h-32 w-full rounded-[28px] border border-indigo-200 bg-white/82 p-4 text-sm text-black placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleBulkGenerateIdeas}
                    disabled={bulkLoading || !bulkTopics.trim()}
                    className="w-full rounded-[28px] border border-indigo-300/40 bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                  >
                    {bulkLoading ? ui.bulkGenerating : ui.bulkGenerate}
                  </button>
                </div>
              </div>

              {bulkResults.length === 0 && (
                <div className="mt-5 rounded-[28px] border border-orange-200/24 bg-white/74 p-4 text-sm text-indigo-700/70">
                  {ui.bulkEmpty}
                </div>
              )}

              {bulkResults.length > 0 && (
                <div
                  data-bulk-selection-toolbar="true"
                  className="mt-5 flex flex-col gap-3 rounded-[28px] border border-indigo-200 bg-white/74 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="text-sm text-indigo-700/80">
                    {ui.selectedBulkCount}:{" "}
                    <span className="font-semibold text-slate-900">
                      {selectedBulkIds.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSelectedBulk}
                    disabled={
                      selectedBulkIds.length === 0 ||
                      selectedBulkLoading ||
                      isGeneratingFullYoutubePackage ||
                      loadingSetup
                    }
                    className="rounded-2xl border border-teal-200 bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selectedBulkLoading
                      ? ui.generatingSelectedBulk
                      : ui.generateSelectedBulk}
                  </button>
                </div>
              )}

              {bulkResults.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {bulkResults.map((idea, index) => (
                    <div
                      key={`${idea.topic}-${index}`}
                      className={`rounded-[28px] border p-4 transition ${
                        selectedBulkIds.includes(index)
                          ? "border-emerald-300/50 bg-teal-50/80"
                          : "border-orange-200/24 bg-white/68"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedBulkIds.includes(index)}
                            onChange={() => toggleBulkSelection(index)}
                            className="h-4 w-4 rounded border-orange-200/26"
                          />
                          {uiLanguage === "en" ? "Select" : "Seç"}
                        </label>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold leading-6 text-slate-900">
                          {idea.title}
                        </h3>
                        <span className="rounded-full bg-indigo-400/15 px-3 py-1 text-xs font-semibold text-indigo-700">
                          {ui.bulkScore}: {Math.round((idea.score || 0) * 100)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {idea.hook}
                      </p>

                      <div className="mt-4 rounded-2xl border border-orange-200/24 bg-white/62 p-3 text-xs leading-5 text-slate-600">
                        <div>
                          <span className="font-semibold text-indigo-700">
                            {ui.bulkAngle}:
                          </span>{" "}
                          {idea.angle}
                        </div>
                        <div className="mt-2">
                          <span className="font-semibold text-indigo-700">
                            {ui.bulkReason}:
                          </span>{" "}
                          {idea.reason}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUseBulkTopic(idea)}
                        className="mt-4 w-full rounded-2xl border border-indigo-300/30 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-400/20"
                      >
                        {ui.useBulkTopic}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateFullPackageFromBulk(idea)}
                        disabled={isGeneratingFullYoutubePackage || loadingSetup}
                        className="mt-3 w-full rounded-2xl border border-purple-300/30 bg-purple-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isGeneratingFullYoutubePackage
                          ? ui.generatingFullYoutubePackage
                          : ui.generateFullPackageFromBulk}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
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

        {error && (
          <div role={isCreatorLabFlow ? "alert" : undefined} aria-live={isCreatorLabFlow ? "assertive" : undefined} className="rounded-2xl border border-red-500/30 bg-rose-50/80 p-4 text-red-200">
            {error}
          </div>
        )}

        {saveMessage && (
          <div role={isCreatorLabFlow ? "status" : undefined} aria-live={isCreatorLabFlow ? "polite" : undefined} className="rounded-2xl border border-green-200 bg-green-50/80 p-4 text-green-700">
            {saveMessage}
          </div>
        )}

        {currentProjectId && !isCreatorLabFlow && (
          <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-4 text-sm text-slate-600">
            {ui.projectId}: <span className="font-mono">{currentProjectId}</span>
          </div>
        )}

        {isCreatorLabFlow && creatorWorkspaceStep === 2 && !creatorMentorResult && (
          <section id="creatorlab-strategy-canvas" className="creatorlab-strategy-experience">
            <header className="creatorlab-strategy-heading">
              <div>
                <p className="creatorlab-strategy-kicker">
                  {uiLanguage === "en" ? "Step 2 · Strategy" : "Adım 2 · Strateji"}
                </p>
                <h1>{uiLanguage === "en" ? "Strategy is not ready yet" : "Strateji henüz hazır değil"}</h1>
                <p>
                  {uiLanguage === "en"
                    ? "The opportunity analysis did not produce a usable strategy result. Return to Brief and run the analysis again; your project inputs are preserved."
                    : "İçerik fırsatı analizi kullanılabilir bir strateji sonucu üretmedi. Brief'e dönüp analizi yeniden çalıştır; proje girdilerin korunur."}
                </p>
              </div>
            </header>
            <div className="creatorlab-strategy-empty-state">
              <strong>{uiLanguage === "en" ? "No strategy data is available" : "Strateji verisi bulunamadı"}</strong>
              <p>
                {uiLanguage === "en"
                  ? "This screen will never remain blank. Review the brief and retry the opportunity analysis."
                  : "Bu ekran boş kalmaz. Brief'i kontrol edip içerik fırsatı analizini yeniden dene."}
              </p>
              <button type="button" onClick={() => navigateCreatorWorkspaceStep(1)}>
                {uiLanguage === "en" ? "Return to Brief" : "Brief'e Dön"}
              </button>
            </div>
          </section>
        )}

        {isCreatorLabFlow && creatorWorkspaceStep === 2 && creatorMentorResult && (
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
                onClick={() => setCreatorBriefEditorOpen((current) => !current)}
              >
                {creatorBriefEditorOpen
                  ? uiLanguage === "en" ? "Close brief editor" : "Brief düzenleyiciyi kapat"
                  : uiLanguage === "en" ? "Review or edit brief" : "Brief'i incele veya düzenle"}
              </button>
            </div>

            <article id="creatorlab-strategy-recommendation" className="creatorlab-strategy-recommendation">
              <div className="creatorlab-strategy-recommendation-copy">
                <span className="creatorlab-strategy-recommendation-label">
                  {uiLanguage === "en" ? "Creator Mentor recommendation" : "Creator Mentor önerisi"}
                </span>
                <h2>{creatorMentorRecommendedIdea.title}</h2>
                <p>{creatorMentorRecommendedIdea.reason}</p>
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
              <div className="creatorlab-strategy-signal-card">
                <span>{uiLanguage === "en" ? "Audience signals" : "Kitle sinyalleri"}</span>
                <strong>{creatorMentorAudienceInsights.length}</strong>
                <p>{uiLanguage === "en" ? "Decision-ready audience observations" : "Karara hazır kitle gözlemleri"}</p>
              </div>
              <div className="creatorlab-strategy-signal-card">
                <span>{uiLanguage === "en" ? "Hook directions" : "Hook yönleri"}</span>
                <strong>{creatorMentorHookPatterns.length}</strong>
                <p>{uiLanguage === "en" ? "Opening patterns available for the plan" : "Plan için kullanılabilir açılış kalıpları"}</p>
              </div>
              <div className="creatorlab-strategy-signal-card">
                <span>{uiLanguage === "en" ? "Creative alternatives" : "Yaratıcı alternatif"}</span>
                <strong>{creatorMentorVideoIdeas.length}</strong>
                <p>{uiLanguage === "en" ? "Directions retained for comparison" : "Karşılaştırma için korunan yönler"}</p>
              </div>
              <div className="creatorlab-strategy-signal-card">
                <span>{uiLanguage === "en" ? "Production scope" : "Üretim kapsamı"}</span>
                <strong>{getCreatorDurationLabel()}</strong>
                <p>{uiLanguage === "en" ? `${getCreatorSceneCount()} planned scenes` : `${getCreatorSceneCount()} planlanan sahne`}</p>
              </div>
            </div>

            <div className="creatorlab-strategy-grid">
              <section className="creatorlab-strategy-panel">
                <div className="creatorlab-strategy-panel-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Audience & opening" : "Kitle ve açılış"}</span>
                    <h3>{uiLanguage === "en" ? "Why this direction can work" : "Bu yön neden çalışabilir"}</h3>
                    <p>{uiLanguage === "en" ? "The essential signals stay visible; deeper research remains optional." : "Temel sinyaller görünür kalır; derin araştırma isteğe bağlıdır."}</p>
                  </div>
                </div>
                <ul className="creatorlab-strategy-insight-list">
                  {creatorMentorAudienceInsights.map((item, index) => (
                    <li key={`strategy-audience-${index}`}>{item}</li>
                  ))}
                </ul>
                <div className="creatorlab-strategy-hook-list">
                  {creatorMentorHookPatterns.map((item, index) => (
                    <span key={`strategy-hook-${index}`} className="creatorlab-strategy-hook">{item}</span>
                  ))}
                </div>
              </section>

              <section className="creatorlab-strategy-panel">
                <div className="creatorlab-strategy-panel-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Creative options" : "Yaratıcı seçenekler"}</span>
                    <h3>{uiLanguage === "en" ? "Alternative directions" : "Alternatif yönler"}</h3>
                    <p>{uiLanguage === "en" ? "Keep useful options visible without turning Strategy into an idea dashboard." : "Strategy ekranını fikir panosuna çevirmeden yararlı seçenekleri görünür tut."}</p>
                  </div>
                </div>
                <div className="creatorlab-strategy-idea-list">
                  {creatorMentorVideoIdeas.map((idea, index) => (
                    <article key={`${idea.title}-${index}`} className="creatorlab-strategy-idea-card">
                      <span className="creatorlab-strategy-idea-number">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{idea.title}</strong>
                        <p>{idea.concept}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <section id="creatorlab-strategy-youtube" className="creatorlab-strategy-panel creatorlab-strategy-youtube">
              <div className="creatorlab-strategy-panel-heading">
                <div>
                  <span>{uiLanguage === "en" ? "YouTube intelligence" : "YouTube zekâsı"}</span>
                  <h3>{uiLanguage === "en" ? "Opportunity and pattern signals" : "Fırsat ve pattern sinyalleri"}</h3>
                  <p>{uiLanguage === "en" ? "Research is optional, but available here when market evidence can strengthen the direction." : "Araştırma isteğe bağlıdır; pazar kanıtı yönü güçlendirecekse burada kullanılabilir."}</p>
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
                        <strong>{video.title}</strong>
                        <span>{formatYoutubeNumber(video.views)} {ui.youtubeResearchViews} · {video.channel}</span>
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
                          <strong>{ui.patternHooks}</strong>
                          <ul>
                            {youtubePatternSummary.hookPatterns.map((item, index) => (
                              <li key={`strategy-hook-pattern-${index}`}>{item}</li>
                            ))}
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

            <div id="creatorlab-strategy-action" className="creatorlab-strategy-action-bar">
              <div className="creatorlab-strategy-action-copy">
                <strong>{uiLanguage === "en" ? "Ready to create the production plan?" : "Üretim planını oluşturmaya hazır mısın?"}</strong>
                <p>{uiLanguage === "en" ? "CreatorLab will convert the approved direction into a scene-ready production package without generating paid media yet." : "CreatorLab, onaylanan yönü henüz ücretli medya üretmeden sahneye hazır üretim paketine dönüştürecek."}</p>
              </div>
              <button
                type="button"
                onClick={handleCreatorProductionPackage}
                disabled={creatorProductionLoading}
                className="creatorlab-strategy-primary-action"
              >
                {creatorProductionLoading
                  ? uiLanguage === "en" ? "Creating production plan..." : "Üretim planı oluşturuluyor..."
                  : uiLanguage === "en" ? "Create Production Plan" : "Üretim Planı Oluştur"}
              </button>
            </div>
          </section>
        )}

        {isCreatorLabFlow && creatorWorkspaceStep === 3 && creatorProductionPackage && (
          <section id="creatorlab-production-canvas" className="creatorlab-production-experience">
            <header className="creatorlab-production-heading">
              <div>
                <p className="creatorlab-production-kicker">
                  {uiLanguage === "en" ? "Step 3 · Production" : "Adım 3 · Üretim"}
                </p>
                <h1>{uiLanguage === "en" ? "Production" : "Üretim"}</h1>
                <p>
                  {uiLanguage === "en"
                    ? "Turn the approved plan into visuals, voice-over and a safe final video. CreatorLab keeps the technical routing in the background and shows only the next useful action."
                    : "Onaylanan planı görsellere, seslendirmeye ve güvenli bir final videoya dönüştür. CreatorLab teknik yönlendirmeyi arka planda tutar ve yalnızca sıradaki yararlı aksiyonu gösterir."}
                </p>
              </div>
              <span className="creatorlab-production-stage-badge">
                {scenes.length > 0
                  ? uiLanguage === "en" ? `${scenes.length} scenes planned` : `${scenes.length} sahne planlandı`
                  : uiLanguage === "en" ? "Plan approved" : "Plan onaylandı"}
              </span>
            </header>

            <article className="creatorlab-production-project-card">
              <div className="creatorlab-production-project-copy">
                <span>{uiLanguage === "en" ? "Approved production plan" : "Onaylanan üretim planı"}</span>
                <strong title={creatorProductionPackage.title}>{creatorProductionPackage.title}</strong>
                <p>{creatorProductionPackage.storyPremise}</p>
              </div>
              <div className="creatorlab-production-project-meta">
                <div>
                  <span>{uiLanguage === "en" ? "Format" : "Format"}</span>
                  <strong>{CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label}</strong>
                </div>
                <div>
                  <span>{uiLanguage === "en" ? "Runtime" : "Süre"}</span>
                  <strong>{getCreatorDurationLabel()}</strong>
                </div>
                <div>
                  <span>{uiLanguage === "en" ? "Quality" : "Kalite"}</span>
                  <strong>{getCreatorQualityModeLabel()}</strong>
                </div>
              </div>
            </article>

            <section id="creatorlab-cast-entry" className="creatorlab-cast-entry-card" aria-labelledby="creatorlab-cast-entry-title">
              <div className="creatorlab-cast-entry-copy">
                <span>{uiLanguage === "en" ? "Cast & Brand" : "Cast & Brand"}</span>
                <strong id="creatorlab-cast-entry-title">
                  {characters.length > 0
                    ? uiLanguage === "en"
                      ? `${characters.length} presenter or character ${characters.length === 1 ? "is" : "are"} configured`
                      : `${characters.length} sunucu veya karakter yapılandırıldı`
                    : uiLanguage === "en"
                      ? "No presenter or character configured"
                      : "Henüz sunucu veya karakter yapılandırılmadı"}
                </strong>
                <p>
                  {characters.length > 0
                    ? uiLanguage === "en"
                      ? "Review the cast, brand voice and visual direction before generating or retrying media."
                      : "Medya üretmeden veya yeniden denemeden önce karakter kadrosunu, marka sesini ve görsel yönü kontrol et."
                    : uiLanguage === "en"
                      ? "Faceless production remains valid. Add a presenter, persona or recurring character only when the concept needs one."
                      : "Faceless üretim geçerlidir. Yalnızca içerik gerektiriyorsa sunucu, persona veya tekrar eden karakter ekle."}
                </p>
              </div>
              <div className="creatorlab-cast-entry-actions">
                <span className={characters.length > 0 ? "is-ready" : ""}>
                  {characters.length > 0
                    ? uiLanguage === "en" ? "Cast configured" : "Karakter planı hazır"
                    : uiLanguage === "en" ? "Optional setup" : "Opsiyonel kurulum"}
                </span>
                <button
                  type="button"
                  onClick={() => scrollCreatorWorkspaceTo("creatorlab-cast-brand")}
                >
                  {characters.length > 0
                    ? uiLanguage === "en" ? "Manage Cast & Brand" : "Cast & Brand'i Yönet"
                    : uiLanguage === "en" ? "Add Presenter or Character" : "Sunucu veya Karakter Ekle"}
                </button>
              </div>
            </section>

            <details id="creatorlab-cast-brand" className="creatorlab-cast-brand-panel">
              <summary>
                <div className="creatorlab-cast-brand-summary-copy">
                  <span>{uiLanguage === "en" ? "Secondary production setup" : "İkincil üretim ayarları"}</span>
                  <strong>{uiLanguage === "en" ? "Cast & Brand" : "Cast & Brand"}</strong>
                  <p>
                    {uiLanguage === "en"
                      ? "Configure presenters, recurring personas, brand voice, visual direction and voice performance only when the production needs them."
                      : "Sunucu, tekrar eden persona, marka sesi, görsel yön ve ses performansını yalnızca üretim gerektirdiğinde yapılandır."}
                  </p>
                </div>
                <div className="creatorlab-cast-brand-summary-meta">
                  <span className="creatorlab-cast-brand-mode-pill">{creatorPresentationModeLabel}</span>
                  <span className="creatorlab-cast-brand-readiness">
                    {creatorCastBrandConfiguredCount}/3 {uiLanguage === "en" ? "configured" : "yapılandırıldı"}
                  </span>
                  <span className="creatorlab-cast-brand-chevron" aria-hidden="true">⌄</span>
                </div>
              </summary>

              <div className="creatorlab-cast-brand-body">
                <div className="creatorlab-cast-brand-intro">
                  <div>
                    <span>{uiLanguage === "en" ? "Optional by design" : "Tasarım gereği opsiyonel"}</span>
                    <strong>
                      {uiLanguage === "en"
                        ? "Keep the production simple, then add identity where it improves the result."
                        : "Üretimi sade tut; yalnızca sonucu iyileştirdiğinde kimlik katmanı ekle."}
                    </strong>
                    <p>
                      {uiLanguage === "en"
                        ? "Changes made here guide new visual generation, voice-over and retries. Existing scene copy or completed assets are not rewritten automatically."
                        : "Buradaki değişiklikler yeni görsel üretimini, seslendirmeyi ve tekrar denemeleri yönlendirir. Mevcut sahne metni veya tamamlanmış varlıklar otomatik olarak yeniden yazılmaz."}
                    </p>
                  </div>
                  <div className="creatorlab-cast-brand-signal-row" aria-label={uiLanguage === "en" ? "Cast and brand readiness" : "Cast ve marka hazırlığı"}>
                    <span className={creatorBrandConfigured ? "is-ready" : ""}>
                      {creatorBrandConfigured ? "✓" : "1"} {uiLanguage === "en" ? "Brand" : "Marka"}
                    </span>
                    <span className={creatorVisualDirectionConfigured ? "is-ready" : ""}>
                      {creatorVisualDirectionConfigured ? "✓" : "2"} {uiLanguage === "en" ? "Visual direction" : "Görsel yön"}
                    </span>
                    <span className={characters.length > 0 || creatorVoiceDirectionConfigured ? "is-ready" : ""}>
                      {characters.length > 0 || creatorVoiceDirectionConfigured ? "✓" : "3"} {uiLanguage === "en" ? "Presence" : "Anlatım kimliği"}
                    </span>
                  </div>
                </div>

                <section className="creatorlab-cast-brand-section">
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
                        setNarratorSettings((current) => ({ ...current, voiceId: "" }));
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
                      <summary>{uiLanguage === "en" ? "Camera and consistency guidance" : "Kamera ve tutarlılık yönlendirmesi"}</summary>
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

                <section id="creatorlab-cast-voice" className="creatorlab-cast-brand-section creatorlab-voice-direction-section">
                  <div className="creatorlab-cast-brand-section-heading">
                    <div>
                      <span>{uiLanguage === "en" ? "Voice direction" : "Ses yönü"}</span>
                      <h3>{uiLanguage === "en" ? "Set the narrator or presenter performance" : "Anlatıcı veya sunucu performansını ayarla"}</h3>
                      <p>{uiLanguage === "en" ? "The main workflow shows readiness only. Fine tuning stays here as an optional production control." : "Ana akış yalnızca hazırlık durumunu gösterir. İnce ayarlar opsiyonel üretim kontrolü olarak burada kalır."}</p>
                    </div>
                    <span className="creatorlab-cast-brand-current-mode">
                      {creatorVoiceDirectionConfigured ? (uiLanguage === "en" ? "Voice selected" : "Ses seçildi") : (uiLanguage === "en" ? "Default voice" : "Varsayılan ses")}
                    </span>
                  </div>

                  <div className="creatorlab-voice-direction-grid">
                    <label>
                      <span>{uiLanguage === "en" ? "Saved voice reference" : "Kayıtlı ses referansı"}</span>
                      <input
                        value={narratorSettings.voiceId || ""}
                        onChange={(event) => {
                          stopDialoguePlayback();
                          stopStoryPlayback();
                          setNarratorSettings((current) => ({ ...current, voiceId: event.target.value }));
                          clearAllSceneAudioData();
                          clearAllSceneDialogueAudioData();
                          clearAllSceneTimingData();
                        }}
                        placeholder={uiLanguage === "en" ? "Optional saved voice reference" : "Opsiyonel kayıtlı ses referansı"}
                      />
                      <small>{uiLanguage === "en" ? "Leave empty to let CreatorLab use the default production voice." : "CreatorLab'in varsayılan üretim sesini kullanması için boş bırak."}</small>
                    </label>
                    <label>
                      <span>{uiLanguage === "en" ? "Voice performance mode" : "Ses performans modu"}</span>
                      <select
                        value={narratorSettings.modelId}
                        onChange={(event) => {
                          stopDialoguePlayback();
                          stopStoryPlayback();
                          setNarratorSettings((current) => ({ ...current, modelId: event.target.value }));
                          clearAllSceneAudioData();
                          clearAllSceneDialogueAudioData();
                          clearAllSceneTimingData();
                        }}
                      >
                        <option value="eleven_multilingual_v2">{uiLanguage === "en" ? "Natural multilingual" : "Doğal çok dilli"}</option>
                        <option value="eleven_flash_v2_5">{uiLanguage === "en" ? "Fast preview" : "Hızlı önizleme"}</option>
                      </select>
                      <small>{uiLanguage === "en" ? "Provider and model decisions remain internal." : "Provider ve model kararları sistem içinde kalır."}</small>
                    </label>
                  </div>

                  <details className="creatorlab-cast-brand-nested-details">
                    <summary>{uiLanguage === "en" ? "Advanced voice tuning" : "Gelişmiş ses ayarları"}</summary>
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
                            setNarratorSettings((current) => ({ ...current, stability: Number(event.target.value) }));
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
                            setNarratorSettings((current) => ({ ...current, similarityBoost: Number(event.target.value) }));
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
                            setNarratorSettings((current) => ({ ...current, style: Number(event.target.value) }));
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
                            setNarratorSettings((current) => ({ ...current, speed: Number(event.target.value) }));
                            clearAllSceneAudioData();
                            clearAllSceneDialogueAudioData();
                            clearAllSceneTimingData();
                          }}
                        />
                      </label>
                    </div>
                  </details>
                </section>

                <section id="creatorlab-cast-list" className="creatorlab-cast-brand-section creatorlab-cast-list-section">
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
                        <details key={`creator-cast-${index}`} className="creatorlab-cast-member">
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
                              {character.referenceImage ? (uiLanguage === "en" ? "Reference ready" : "Referans hazır") : (uiLanguage === "en" ? "Needs details" : "Detay gerekli")}
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
                                  <span>{uiLanguage === "en" ? "Character voice reference" : "Karakter ses referansı"}</span>
                                  <input value={character.voiceId || ""} onChange={(event) => updateCharacter(index, "voiceId", event.target.value)} placeholder={uiLanguage === "en" ? "Optional saved voice reference" : "Opsiyonel kayıtlı ses referansı"} />
                                </label>
                              </div>
                            </details>

                            <div className="creatorlab-cast-reference-row">
                              <div>
                                <strong>{uiLanguage === "en" ? "Visual reference" : "Görsel referans"}</strong>
                                <p>{uiLanguage === "en" ? "Generate once the name and visual direction are clear. This may use media credits." : "Ad ve görsel yön netleştiğinde üret. Bu işlem medya kredisi kullanabilir."}</p>
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

                <div className="creatorlab-cast-brand-footer">
                  <div>
                    <strong>{uiLanguage === "en" ? "Production identity summary" : "Üretim kimliği özeti"}</strong>
                    <p>
                      {creatorPresentationModeLabel} · {creatorProfile.brandName || (uiLanguage === "en" ? "No brand name" : "Marka adı yok")} · {creatorVisualDirectionConfigured ? (uiLanguage === "en" ? "Visual direction ready" : "Görsel yön hazır") : (uiLanguage === "en" ? "Default visual direction" : "Varsayılan görsel yön")}
                    </p>
                  </div>
                  <span>{uiLanguage === "en" ? "Non-blocking" : "Engelleyici değil"}</span>
                </div>
              </div>
            </details>

            {scenes.length === 0 ? (
              <div className="creatorlab-production-empty">
                <div className="creatorlab-production-empty-icon" aria-hidden="true">▤</div>
                <div>
                  <strong>{uiLanguage === "en" ? "Prepare the editable scene plan" : "Düzenlenebilir sahne planını hazırla"}</strong>
                  <p>
                    {uiLanguage === "en"
                      ? "This creates the storyboard structure only. Visual and voice credits are not used until you start media generation."
                      : "Bu işlem yalnızca storyboard yapısını oluşturur. Medya üretimini başlatana kadar görsel veya ses kredisi kullanılmaz."}
                  </p>
                </div>
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
              </div>
            ) : (
              <>
                <div className="creatorlab-production-progress" aria-label={uiLanguage === "en" ? "Production progress" : "Üretim ilerlemesi"}>
                  {[
                    {
                      number: 1,
                      label: uiLanguage === "en" ? "Generate visuals" : "Görselleri üret",
                      detail: `${readyExportCount}/${scenes.length} ${uiLanguage === "en" ? "ready" : "hazır"}`,
                      complete: creatorVisualsComplete,
                      active: !creatorTimelineNeedsAttention && !creatorVisualsComplete,
                    },
                    {
                      number: 2,
                      label: uiLanguage === "en" ? "Generate voice-over" : "Seslendirme üret",
                      detail: `${audioReadyCount}/${scenes.length} ${uiLanguage === "en" ? "ready" : "hazır"}`,
                      complete: creatorVoiceOverComplete,
                      active: creatorVisualsComplete && !creatorVoiceOverComplete,
                    },
                    {
                      number: 3,
                      label: uiLanguage === "en" ? "Create final video" : "Final video oluştur",
                      detail: creatorProductionComplete
                        ? uiLanguage === "en" ? "Ready" : "Hazır"
                        : uiLanguage === "en" ? "Waiting for assets" : "Varlıklar bekleniyor",
                      complete: creatorProductionComplete,
                      active: creatorVisualsComplete && creatorVoiceOverComplete && !creatorProductionComplete,
                    },
                  ].map((item) => (
                    <div
                      key={item.number}
                      className={`creatorlab-production-progress-step ${item.complete ? "is-complete" : ""} ${item.active ? "is-active" : ""}`}
                    >
                      <span className="creatorlab-production-progress-number">{item.complete ? "✓" : item.number}</span>
                      <div className="creatorlab-production-progress-copy">
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div id="creatorlab-production-safety" className={`creatorlab-production-safety ${creatorTimelineNeedsAttention ? "is-review" : "is-safe"}`}>
                  <div className="creatorlab-production-safety-icon" aria-hidden="true">
                    {creatorTimelineNeedsAttention ? "!" : "✓"}
                  </div>
                  <div>
                    <strong>
                      {creatorTimelineNeedsAttention
                        ? uiLanguage === "en" ? "Timeline review is needed before media generation" : "Medya üretiminden önce timeline kontrolü gerekiyor"
                        : uiLanguage === "en" ? "Timeline is safe for the next production action" : "Timeline sıradaki üretim aksiyonu için güvenli"}
                    </strong>
                    <p>{creatorTimelineMediaGate.message}</p>
                  </div>
                  <span className="creatorlab-production-safety-status">
                    {creatorTimelineNeedsAttention
                      ? uiLanguage === "en" ? "Action needed" : "Aksiyon gerekli"
                      : uiLanguage === "en" ? "Safe" : "Güvenli"}
                  </span>
                </div>

                <section id="creatorlab-production-storyboard" className="creatorlab-production-storyboard">
                  <div className="creatorlab-production-storyboard-heading">
                    <div>
                      <span>{uiLanguage === "en" ? "Storyboard" : "Storyboard"}</span>
                      <h2>{uiLanguage === "en" ? "Scene production plan" : "Sahne üretim planı"}</h2>
                    </div>
                    <p>{uiLanguage === "en" ? "Visual and voice status at a glance" : "Görsel ve ses durumu tek bakışta"}</p>
                  </div>

                  <div className="creatorlab-production-scene-list">
                    {scenes.map((scene, index) => {
                      const visualReady = getSceneExportSource(scene) !== "none";
                      const voiceReady = getSceneAudioStatus(scene);
                      const sceneSummary = scene.text || scene.narration || scene.dialogue || (uiLanguage === "en" ? "Scene plan" : "Sahne planı");

                      return (
                        <article key={`production-overview-${scene.id}`} className="creatorlab-production-scene">
                          <span className="creatorlab-production-scene-number">{String(index + 1).padStart(2, "0")}</span>
                          <div className="creatorlab-production-scene-preview">
                            {scene.image ? (
                              <img src={scene.image} alt={`${uiLanguage === "en" ? "Scene" : "Sahne"} ${scene.id}`} />
                            ) : (
                              <span>{uiLanguage === "en" ? "Pending" : "Bekliyor"}</span>
                            )}
                          </div>
                          <div className="creatorlab-production-scene-copy">
                            <strong>{uiLanguage === "en" ? `Scene ${scene.id}` : `Sahne ${scene.id}`}</strong>
                            <p>{sceneSummary}</p>
                          </div>
                          <div className={`creatorlab-production-scene-status ${visualReady ? "is-ready" : ""}`}>
                            <span>{uiLanguage === "en" ? "Visual" : "Görsel"}</span>
                            <strong>{visualReady ? uiLanguage === "en" ? "Ready" : "Hazır" : uiLanguage === "en" ? "Pending" : "Bekliyor"}</strong>
                          </div>
                          <div className={`creatorlab-production-scene-status is-voice-status ${voiceReady ? "is-ready" : ""}`}>
                            <span>{uiLanguage === "en" ? "Voice" : "Ses"}</span>
                            <strong>{voiceReady ? uiLanguage === "en" ? "Ready" : "Hazır" : uiLanguage === "en" ? "Pending" : "Bekliyor"}</strong>
                          </div>
                          <button
                            type="button"
                            className="creatorlab-production-scene-edit"
                            aria-label={uiLanguage === "en" ? `Edit scene ${scene.id}` : `Sahne ${scene.id} düzenle`}
                            onClick={() => {
                              setCreatorProductionDetailsOpen(true);
                              window.setTimeout(() => {
                                document.getElementById(`creatorlab-scene-editor-${scene.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 50);
                            }}
                          >
                            ⋯
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <div id="creatorlab-production-action" className="creatorlab-production-action-bar">
                  <div className="creatorlab-production-action-copy">
                    <strong>
                      {creatorTimelineNeedsAttention
                        ? uiLanguage === "en" ? "Resolve the timeline gate first" : "Önce timeline kontrolünü tamamla"
                        : !creatorVisualsComplete
                          ? uiLanguage === "en" ? "Ready to generate the scene visuals?" : "Sahne görsellerini üretmeye hazır mısın?"
                          : !creatorVoiceOverComplete
                            ? uiLanguage === "en" ? "Visuals are ready. Add the voice-over next." : "Görseller hazır. Şimdi seslendirmeyi ekle."
                            : uiLanguage === "en" ? "All required assets are ready for the final video." : "Gerekli tüm varlıklar final video için hazır."}
                    </strong>
                    <p>
                      {creatorTimelineNeedsAttention
                        ? creatorTimelineMediaGate.message
                        : !creatorVisualsComplete
                          ? uiLanguage === "en" ? "CreatorLab will generate the missing visuals while keeping routing decisions internal." : "CreatorLab eksik görselleri üretirken medya yönlendirme kararlarını arka planda tutacak."
                          : !creatorVoiceOverComplete
                            ? uiLanguage === "en" ? "Voice duration will be measured and matched to each scene automatically." : "Ses süresi otomatik olarak ölçülüp her sahneyle eşleştirilecek."
                            : creatorFinalVideoReadinessMessage}
                    </p>
                  </div>
                  <div className="creatorlab-production-actions">
                    <button
                      type="button"
                      className="creatorlab-production-secondary-action"
                      onClick={() => setCreatorProductionDetailsOpen((current) => !current)}
                    >
                      {creatorProductionDetailsOpen
                        ? uiLanguage === "en" ? "Hide production details" : "Üretim detaylarını gizle"
                        : uiLanguage === "en" ? "Production details" : "Üretim detayları"}
                    </button>

                    {creatorVisualsComplete && (creatorQualityMode === "pro" || creatorQualityMode === "cinematic") && (
                      <button
                        type="button"
                        className="creatorlab-production-secondary-action"
                        onClick={generateAllAiVideoBlocks}
                        disabled={isBatchRendering || isPreparingAudio || isExportingMovie}
                        title={
                          isCreatorMediaGenerationBlocked
                            ? getCreatorMediaActionError("ai_video_blocks")
                            : (uiLanguage === "en"
                              ? "Convert the routed scene visuals into AI motion blocks."
                              : "Yönlendirilen sahne görsellerini AI hareketli video bloklarına dönüştür.")
                        }
                      >
                        {isBatchRendering
                          ? (uiLanguage === "en" ? "Creating motion..." : "Hareket üretiliyor...")
                          : (uiLanguage === "en" ? "Create AI Motion Blocks" : "AI Hareketli Blokları Üret")}
                      </button>
                    )}

                    {creatorTimelineNeedsAttention ? (
                      <button
                        type="button"
                        onClick={handleOptimizeCreatorTimeline}
                        disabled={creatorTimelineOptimizeLoading}
                        className="creatorlab-production-primary-action"
                      >
                        {creatorTimelineOptimizeLoading
                          ? uiLanguage === "en" ? "Reviewing timeline..." : "Timeline inceleniyor..."
                          : uiLanguage === "en" ? "Review Timeline Safety" : "Timeline Güvenliğini İncele"}
                      </button>
                    ) : !creatorVisualsComplete ? (
                      <button
                        type="button"
                        onClick={generateAllSceneVisuals}
                        disabled={isBatchRendering || isPreparingAudio || isExportingMovie || isCreatorMediaGenerationBlocked || isCreatorActionBlocked("visuals")}
                        className="creatorlab-production-primary-action"
                      >
                        {isBatchRendering
                          ? uiLanguage === "en" ? "Generating visuals..." : "Görseller üretiliyor..."
                          : uiLanguage === "en" ? "Generate Visuals" : "Görselleri Üret"}
                      </button>
                    ) : !creatorVoiceOverComplete ? (
                      <button
                        type="button"
                        onClick={prepareAllAudio}
                        disabled={isPreparingAudio || isPlayingStory || playingDialogueSceneId !== null || isCreatorMediaGenerationBlocked || isCreatorActionBlocked("voice_over")}
                        className="creatorlab-production-primary-action"
                      >
                        {isPreparingAudio
                          ? ui.preparingAudio
                          : uiLanguage === "en" ? "Generate Voice-over" : "Seslendirme Üret"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleExportMovie(false)}
                        disabled={isExportingMovie || isCreatorActionBlocked("final_video")}
                        title={creatorFinalVideoReadinessMessage}
                        className="creatorlab-production-primary-action"
                      >
                        {isExportingMovie
                          ? ui.creatingMovie
                          : exportedMovieUrl && hasReusableExport()
                            ? uiLanguage === "en" ? "Open Final Video" : "Final Videoyu Aç"
                            : uiLanguage === "en" ? "Create Final Video" : "Final Video Oluştur"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {isCreatorLabFlow && creatorWorkspaceStep === 4 && creatorProductionPackage && (
          <section id="creatorlab-publish-canvas" className="creatorlab-publish-experience">
            <div className="creatorlab-publish-heading">
              <div>
                <p className="creatorlab-publish-kicker">
                  {uiLanguage === "en" ? "Step 4 · Publish" : "Adım 4 · Yayınla"}
                </p>
                <h1>
                  {uiLanguage === "en"
                    ? "Review the final output and take the complete creator package."
                    : "Final çıktıyı kontrol et ve eksiksiz creator paketini al."}
                </h1>
                <p>
                  {uiLanguage === "en"
                    ? "Your final video, thumbnail, publishing copy and platform adaptations are organized in one release workspace."
                    : "Final video, thumbnail, yayın metinleri ve platform uyarlamaları tek teslim çalışma alanında düzenlendi."}
                </p>
              </div>
              <span className="creatorlab-publish-stage-badge">
                {creatorPublishComplete
                  ? uiLanguage === "en" ? "Package delivered" : "Paket teslim edildi"
                  : `${creatorPublishAssetCount}/3 ${uiLanguage === "en" ? "release assets" : "yayın varlığı"}`}
              </span>
            </div>

            <div className="creatorlab-publish-readiness" aria-label={uiLanguage === "en" ? "Publishing readiness" : "Yayın hazırlığı"}>
              <div className={`creatorlab-publish-readiness-card ${creatorPublishVideoUrl ? "is-ready" : ""}`}>
                <span className="creatorlab-publish-readiness-icon" aria-hidden="true">✓</span>
                <div className="creatorlab-publish-readiness-copy">
                  <span>{uiLanguage === "en" ? "Final video" : "Final video"}</span>
                  <strong>{creatorPublishVideoUrl ? uiLanguage === "en" ? "Ready to publish" : "Yayına hazır" : uiLanguage === "en" ? "Pending" : "Bekliyor"}</strong>
                </div>
              </div>
              <div className={`creatorlab-publish-readiness-card ${creatorPublishThumbnailUrl ? "is-ready" : ""}`}>
                <span className="creatorlab-publish-readiness-icon" aria-hidden="true">{creatorPublishThumbnailUrl ? "✓" : "2"}</span>
                <div className="creatorlab-publish-readiness-copy">
                  <span>Thumbnail</span>
                  <strong>{creatorPublishThumbnailUrl ? uiLanguage === "en" ? "Selected" : "Seçildi" : uiLanguage === "en" ? "Selection recommended" : "Seçim öneriliyor"}</strong>
                </div>
              </div>
              <div className={`creatorlab-publish-readiness-card ${youtubeMetadataResult ? "is-ready" : ""}`}>
                <span className="creatorlab-publish-readiness-icon" aria-hidden="true">{youtubeMetadataResult ? "✓" : "3"}</span>
                <div className="creatorlab-publish-readiness-copy">
                  <span>{uiLanguage === "en" ? "Publishing copy" : "Yayın metinleri"}</span>
                  <strong>{youtubeMetadataResult ? uiLanguage === "en" ? "Prepared" : "Hazırlandı" : uiLanguage === "en" ? "Can be generated" : "Üretilebilir"}</strong>
                </div>
              </div>
            </div>

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

              <article className="creatorlab-publish-thumbnail-card">
                <div className="creatorlab-publish-card-heading">
                  <div>
                    <span>Thumbnail</span>
                    <strong>{uiLanguage === "en" ? "Selected cover" : "Seçilen kapak"}</strong>
                  </div>
                  <small>{creatorPublishThumbnailUrl ? uiLanguage === "en" ? "Selected" : "Seçildi" : uiLanguage === "en" ? "Optional" : "İsteğe bağlı"}</small>
                </div>
                <div className="creatorlab-publish-thumbnail-preview">
                  {creatorPublishThumbnailUrl ? (
                    <img src={creatorPublishThumbnailUrl} alt={uiLanguage === "en" ? "Selected video thumbnail" : "Seçilen video thumbnail"} />
                  ) : (
                    <span>{uiLanguage === "en" ? "No thumbnail selected yet" : "Henüz thumbnail seçilmedi"}</span>
                  )}
                </div>
                <div className="creatorlab-publish-thumbnail-copy">
                  <strong>{youtubeThumbnailResult?.headline || creatorProductionPackage.thumbnailIdea}</strong>
                  <p>{youtubeThumbnailResult?.subHeadline || creatorProductionPackage.hook}</p>
                </div>
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
                </div>
              </article>
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
                    <span>{uiLanguage === "en" ? "Recommended title" : "Önerilen başlık"}</span>
                    <strong>{creatorPublishTitle || (uiLanguage === "en" ? "Title not prepared yet" : "Başlık henüz hazırlanmadı")}</strong>
                  </div>
                  <div className="creatorlab-publish-metadata-section">
                    <span>Hook</span>
                    <p>{creatorPublishHook || (uiLanguage === "en" ? "The production hook will be included in the package." : "Üretim hook'u pakete dahil edilecek.")}</p>
                  </div>
                  <div className="creatorlab-publish-metadata-section">
                    <span>{uiLanguage === "en" ? "Description" : "Açıklama"}</span>
                    <p>{creatorPublishDescription || (uiLanguage === "en" ? "Prepare metadata to generate a platform-ready description." : "Platforma hazır açıklama için metadata hazırla.")}</p>
                  </div>
                  {(youtubeMetadataResult?.hashtags?.length ?? 0) > 0 && (
                    <div className="creatorlab-publish-metadata-section">
                      <span>Hashtags</span>
                      <p>{(youtubeMetadataResult?.hashtags ?? []).join(" ")}</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="creatorlab-publish-platform-card">
                <div className="creatorlab-publish-card-heading">
                  <div>
                    <span>{uiLanguage === "en" ? "Platform adaptations" : "Platform uyarlamaları"}</span>
                    <strong>{uiLanguage === "en" ? "Ready-to-use channel copy" : "Kullanıma hazır kanal metinleri"}</strong>
                  </div>
                </div>
                <div className="creatorlab-publish-platform-list">
                  <div className="creatorlab-publish-platform-item">
                    <span>YouTube</span>
                    <p>{youtubeMetadataResult?.firstComment || creatorProductionPackage.caption || (uiLanguage === "en" ? "Metadata can be prepared for YouTube publishing." : "YouTube yayını için metadata hazırlanabilir.")}</p>
                  </div>
                  <div className="creatorlab-publish-platform-item">
                    <span>Shorts / Reels / TikTok</span>
                    <p>{youtubeMetadataResult?.shortCaption || (uiLanguage === "en" ? "Short-form adaptation will be included when metadata is prepared." : "Metadata hazırlandığında kısa format uyarlaması pakete eklenecek.")}</p>
                  </div>
                  <div className="creatorlab-publish-platform-item">
                    <span>LinkedIn</span>
                    <p>{youtubeMetadataResult?.linkedInCaption || (uiLanguage === "en" ? "LinkedIn adaptation will be included when metadata is prepared." : "Metadata hazırlandığında LinkedIn uyarlaması pakete eklenecek.")}</p>
                  </div>
                </div>
              </article>
            </div>

            <article id="creatorlab-publish-checklist" className="creatorlab-publish-checklist-card">
              <div className="creatorlab-publish-card-heading">
                <div>
                  <span>{uiLanguage === "en" ? "Publishing checklist" : "Yayın kontrol listesi"}</span>
                  <strong>{uiLanguage === "en" ? "Final release checks" : "Son yayın kontrolleri"}</strong>
                </div>
                <small>{creatorPublishChecklistCount || 4} {uiLanguage === "en" ? "checks" : "kontrol"}</small>
              </div>
              <div className="creatorlab-publish-checklist">
                {(youtubeMetadataResult?.uploadChecklist?.length
                  ? youtubeMetadataResult.uploadChecklist.slice(0, 4)
                  : [
                      uiLanguage === "en" ? "Final video reviewed" : "Final video kontrol edildi",
                      uiLanguage === "en" ? "Thumbnail selected" : "Thumbnail seçildi",
                      uiLanguage === "en" ? "Title and description confirmed" : "Başlık ve açıklama doğrulandı",
                      uiLanguage === "en" ? "Platform adaptations included" : "Platform uyarlamaları eklendi",
                    ]).map((item, index) => (
                  <div key={`creatorlab-release-check-${index}`} className="creatorlab-publish-check">
                    <span>✓</span>
                    <div>{item}</div>
                  </div>
                ))}
              </div>
            </article>

            <details className="creatorlab-publish-detail-panel">
              <summary>
                <span>{uiLanguage === "en" ? "Publishing alternatives and package contents" : "Yayın alternatifleri ve paket içeriği"}</span>
                <span>{uiLanguage === "en" ? "Secondary" : "İkincil"}</span>
              </summary>
              <div className="creatorlab-publish-detail-body">
                {(youtubeMetadataResult?.titleOptions?.length ?? 0) > 0 && (
                  <div className="creatorlab-publish-title-options">
                    <h3>{uiLanguage === "en" ? "Alternative titles" : "Alternatif başlıklar"}</h3>
                    <ul>
                      {(youtubeMetadataResult?.titleOptions ?? []).map((item, index) => (
                        <li key={`creatorlab-publish-title-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(youtubeMetadataResult?.chapters?.length ?? 0) > 0 && (
                  <div className="creatorlab-publish-chapters">
                    <h3>Chapters</h3>
                    <ol>
                      {(youtubeMetadataResult?.chapters ?? []).map((item, index) => (
                        <li key={`creatorlab-publish-chapter-${index}`}>{item}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {scenes.some((scene) => scene.image) && (
                  <div className="creatorlab-publish-thumbnail-candidates">
                    <h3>{uiLanguage === "en" ? "Thumbnail alternatives" : "Thumbnail alternatifleri"}</h3>
                    <div className="creatorlab-publish-thumbnail-candidate-grid">
                      {scenes.filter((scene) => scene.image).slice(0, 4).map((scene) => (
                        <button
                          key={`creatorlab-publish-scene-thumbnail-${scene.id}`}
                          type="button"
                          className="creatorlab-publish-thumbnail-candidate"
                          onClick={() => handleSelectSceneAsYoutubeThumbnail(scene)}
                        >
                          <img src={scene.image} alt={`${uiLanguage === "en" ? "Scene" : "Sahne"} ${scene.id}`} />
                          <span>{uiLanguage === "en" ? `Use scene ${scene.id}` : `Sahne ${scene.id} kullan`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div id="creatorlab-publish-action" className="creatorlab-publish-action-bar">
              <div className="creatorlab-publish-action-copy">
                <strong>
                  {creatorPublishComplete
                    ? uiLanguage === "en" ? "Creator Package delivered" : "Creator Paketi teslim edildi"
                    : uiLanguage === "en" ? "Your publish-ready package is assembled" : "Yayına hazır paketin bir araya getirildi"}
                </strong>
                <p>
                  {youtubeMetadataResult
                    ? uiLanguage === "en"
                      ? "The ZIP includes the final video link, thumbnail, metadata, platform copy, checklist and editable scene data."
                      : "ZIP; final video bağlantısı, thumbnail, metadata, platform metinleri, checklist ve düzenlenebilir sahne verilerini içerir."
                    : uiLanguage === "en"
                      ? "The package can be downloaded now. Prepare metadata first for the richest publish-ready output."
                      : "Paket şimdi indirilebilir. En kapsamlı yayına hazır çıktı için önce metadata hazırlaman önerilir."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCreatorPackage}
                disabled={isDownloadingCreatorPackage || !creatorPackageReady}
                className="creatorlab-publish-primary-action"
              >
                {isDownloadingCreatorPackage
                  ? uiLanguage === "en" ? "Preparing package..." : "Paket hazırlanıyor..."
                  : creatorPublishComplete
                    ? uiLanguage === "en" ? "Download Creator Package Again" : "Creator Paketini Yeniden İndir"
                    : uiLanguage === "en" ? "Download Creator Package" : "Creator Paketini İndir"}
              </button>
            </div>
          </section>
        )}

        {isCreatorLabFlow && creatorWorkspaceStep === 3 && creatorProductionPackage && (
          <details id="creatorlab-production-package-details" className="creatorlab-production-detail-panel">
            <summary>
              <span>{uiLanguage === "en" ? "Production package, metadata and optimization details" : "Üretim paketi, metadata ve optimizasyon detayları"}</span>
              <span>{uiLanguage === "en" ? "Secondary" : "İkincil"}</span>
            </summary>
            <div className="creatorlab-production-detail-body">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.25em] text-teal-700">
                {ui.creatorProductionTitle}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {creatorProductionPackage.title}
              </h2>
              <p className="mt-3 max-w-4xl leading-6 text-emerald-50/85">
                {creatorProductionPackage.storyPremise}
              </p>
            </div>

            {scenes.length === 0 && (
              <div className="mb-5 rounded-[28px] border border-purple-300/25 bg-violet-50/80 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-violet-700">
                      {ui.productionBridgeTitle}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">
                      {ui.productionBridgeReady}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-purple-100/80">
                      {ui.productionBridgeDesc}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-purple-100/60">
                      {ui.productionBridgeCostNote}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={buildStory}
                    disabled={buildingStory}
                    className="rounded-[28px] border border-purple-300/30 bg-purple-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {buildingStory ? ui.buildingStory : ui.productionBridgeButton}
                  </button>
                </div>
              </div>
            )}

            {scenes.length > 0 ? (
              <>
                <CreatorTimelinePreviewPanel
                  plan={creatorProductionPackage.timelineSyncPlan}
                  editPlan={creatorEditPlan}
                  onGenerateEditPlan={handleGenerateCreatorEditPlan}
                  onOptimizeTimeline={handleOptimizeCreatorTimeline}
                  isOptimizingTimeline={creatorTimelineOptimizeLoading}
                />

                <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <h3 className="font-semibold text-slate-900">{ui.thumbnailIdea}</h3>
                <p className="mt-3 leading-6 text-slate-600">
                  {creatorProductionPackage.thumbnailIdea}
                </p>
              </div>

              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <h3 className="font-semibold text-slate-900">{ui.youtubeTitle}</h3>
                <p className="mt-3 leading-6 text-slate-600">
                  {creatorProductionPackage.youtubeTitle}
                </p>
              </div>

              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <h3 className="font-semibold text-slate-900">{ui.youtubeCaption}</h3>
                <p className="mt-3 leading-6 text-slate-600">
                  {creatorProductionPackage.caption}
                </p>
              </div>
            </div>

            <div id="creatorlab-publish-metadata-legacy" className="mt-5 rounded-[28px] border border-sky-300/20 bg-sky-50/800/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {ui.youtubeMetadataEngine}
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {ui.youtubeMetadataDesc}
                  </p>
                </div>

                {isAdvancedMode && (
                  <button
                    type="button"
                    onClick={handleGenerateYoutubeMetadata}
                    disabled={youtubeMetadataLoading}
                    className="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {youtubeMetadataLoading
                      ? ui.generatingYoutubeMetadata
                      : ui.generateYoutubeMetadata}
                  </button>
                )}
              </div>

              {youtubeMetadataResult && (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.recommendedYoutubeTitle}
                    </h4>
                    <p className="mt-3 leading-6 text-slate-700">
                      {youtubeMetadataResult.recommendedTitle}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.titleOptions}
                    </h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                      {youtubeMetadataResult.titleOptions.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 lg:col-span-2">
                    <h4 className="font-semibold text-slate-900">
                      {ui.youtubeDescription}
                    </h4>
                    <p className="mt-3 whitespace-pre-line leading-6 text-slate-600">
                      {youtubeMetadataResult.description}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.hashtags}
                    </h4>
                    <p className="mt-3 leading-6 text-slate-700">
                      {youtubeMetadataResult.hashtags.join(" ")}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.firstComment}
                    </h4>
                    <p className="mt-3 leading-6 text-slate-600">
                      {youtubeMetadataResult.firstComment}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.thumbnailTextIdeas}
                    </h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                      {youtubeMetadataResult.thumbnailTextIdeas.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.seoKeywords}
                    </h4>
                    <p className="mt-3 leading-6 text-slate-600">
                      {youtubeMetadataResult.seoKeywords.join(", ")}
                    </p>
                    <p className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sm text-slate-700">
                      {youtubeMetadataResult.audiencePromise}
                    </p>
                  </div>

                  {((youtubeMetadataResult.hookAlternatives?.length ?? 0) > 0 ||
                    (youtubeMetadataResult.chapters?.length ?? 0) > 0) && (
                    <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                      <h4 className="font-semibold text-slate-900">
                        {uiLanguage === "en" ? "Hooks & chapters" : "Hook'lar ve bölümler"}
                      </h4>
                      {(youtubeMetadataResult.hookAlternatives?.length ?? 0) > 0 && (
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                          {youtubeMetadataResult.hookAlternatives.map((item, index) => (
                            <li key={`publish-hook-${index}`}>{item}</li>
                          ))}
                        </ul>
                      )}
                      {(youtubeMetadataResult.chapters?.length ?? 0) > 0 && (
                        <ol className="mt-4 space-y-2 text-sm text-slate-600">
                          {youtubeMetadataResult.chapters.map((item, index) => (
                            <li key={`publish-chapter-${index}`}>{item}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}

                  {(youtubeMetadataResult.shortCaption ||
                    youtubeMetadataResult.linkedInCaption) && (
                    <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 lg:col-span-2">
                      <h4 className="font-semibold text-slate-900">
                        {uiLanguage === "en" ? "Platform adaptations" : "Platform uyarlamaları"}
                      </h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sm leading-6 text-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                            Shorts / Reels / TikTok
                          </p>
                          <p className="mt-2 whitespace-pre-line">{youtubeMetadataResult.shortCaption}</p>
                        </div>
                        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sm leading-6 text-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                            LinkedIn
                          </p>
                          <p className="mt-2 whitespace-pre-line">{youtubeMetadataResult.linkedInCaption}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {((youtubeMetadataResult.uploadChecklist?.length ?? 0) > 0 ||
                    (youtubeMetadataResult.publishingNotes?.length ?? 0) > 0) && (
                    <div className="rounded-[28px] border border-emerald-300/25 bg-emerald-50/80 p-4 lg:col-span-2">
                      <h4 className="font-semibold text-emerald-950">
                        {uiLanguage === "en" ? "Publishing checklist" : "Yayın kontrol listesi"}
                      </h4>
                      <ul className="mt-3 grid gap-2 text-sm text-emerald-900 md:grid-cols-2">
                        {(youtubeMetadataResult.uploadChecklist || []).map((item, index) => (
                          <li key={`publish-check-${index}`}>✓ {item}</li>
                        ))}
                        {(youtubeMetadataResult.publishingNotes || []).map((item, index) => (
                          <li key={`publish-note-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {creatorIntelligenceReport && (
                <div className="mt-5 rounded-[28px] border border-violet-300/25 bg-violet-50/80 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                        {uiLanguage === "en" ? "Creator intelligence" : "Creator intelligence"}
                      </p>
                      <h4 className="mt-1 font-semibold text-slate-900">
                        {uiLanguage === "en"
                          ? "A focused release plan from your current package"
                          : "Mevcut paketinden çıkarılan odaklı yayın planı"}
                      </h4>
                    </div>
                    <span className="rounded-full border border-violet-300/30 bg-white px-3 py-1 text-sm font-semibold text-violet-800">
                      {uiLanguage === "en" ? "Hook readiness" : "Hook hazırlığı"}: {creatorIntelligenceReport.hookScore}/100
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-violet-200/70 bg-white/80 p-4">
                      <h5 className="font-semibold text-slate-900">
                        {uiLanguage === "en" ? "Opening" : "Açılış"}
                      </h5>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {creatorIntelligenceReport.recommendedOpening}
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {creatorIntelligenceReport.hookSignals.map((signal, index) => (
                          <li key={`hook-signal-${index}`}>• {signal}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-violet-200/70 bg-white/80 p-4">
                      <h5 className="font-semibold text-slate-900">
                        {uiLanguage === "en" ? "Thumbnail angles" : "Thumbnail açıları"}
                      </h5>
                      <div className="mt-3 space-y-3">
                        {creatorIntelligenceReport.thumbnailAngles.slice(0, 2).map((angle, index) => (
                          <div key={`thumbnail-angle-${index}`}>
                            <p className="text-sm font-semibold text-violet-900">{angle.label}: {angle.text}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{angle.guidance}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-violet-200/70 bg-white/80 p-4">
                      <h5 className="font-semibold text-slate-900">
                        {uiLanguage === "en" ? "Platform strategy" : "Platform stratejisi"}
                      </h5>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {creatorIntelligenceReport.platformStrategy}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {creatorIntelligenceReport.audienceAngle}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-2xl border border-violet-200/70 bg-white/70 p-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{uiLanguage === "en" ? "Next:" : "Sonraki adım:"}</span>{" "}
                    {creatorIntelligenceReport.nextBestAction}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-[28px] border border-fuchsia-300/20 bg-fuchsia-500/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {ui.thumbnailGenerationEngine}
                  </h3>
                  <p className="mt-1 text-sm text-pink-700">
                    {ui.thumbnailGenerationDesc}
                  </p>
                </div>

                {isAdvancedMode && (
                  <button
                    type="button"
                    onClick={handleGenerateYoutubeThumbnail}
                    disabled={youtubeThumbnailLoading}
                    className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {youtubeThumbnailLoading
                      ? ui.generatingThumbnail
                      : ui.generateThumbnail}
                  </button>
                )}
              </div>

              {scenes.some((scene) => scene.image) ? (
                <div className="mt-5 rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                  <h4 className="font-semibold text-slate-900">
                    {ui.sceneThumbnailCandidates}
                  </h4>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {scenes
                      .filter((scene) => scene.image)
                      .map((scene) => (
                        <div
                          key={`thumbnail-candidate-${scene.id}`}
                          className="rounded-2xl border border-orange-200/24 bg-white/74 p-3"
                        >
                          <img
                            src={scene.image}
                            alt={`Scene ${scene.id} thumbnail candidate`}
                            className="aspect-video w-full rounded-xl object-cover"
                          />

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700">
                              Scene {scene.id}
                            </span>
                            <span className="rounded-full bg-teal-50/80 px-2 py-1 text-[11px] font-semibold text-teal-800">
                              {calculateThumbnailScore(scene.intelligence)}/10
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectSceneAsYoutubeThumbnail(scene)}
                            className="mt-3 w-full rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                          >
                            {ui.useSceneAsThumbnail}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-sm text-pink-700">
                  {ui.noSceneThumbnailsYet}
                </p>
              )}

              {youtubeThumbnailResult && (
                <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                    <h4 className="font-semibold text-slate-900">
                      {ui.generatedThumbnail}
                    </h4>
                    <img
                      src={youtubeThumbnailResult.imageUrl}
                      alt="Selected YouTube thumbnail"
                      className="mt-3 aspect-video w-full rounded-2xl object-cover"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                      <h4 className="font-semibold text-slate-900">
                        {ui.thumbnailHeadline}
                      </h4>
                      <p className="mt-3 text-slate-700">
                        {youtubeThumbnailResult.headline}
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                      <h4 className="font-semibold text-slate-900">
                        {ui.thumbnailSubHeadline}
                      </h4>
                      <p className="mt-3 text-slate-600">
                        {youtubeThumbnailResult.subHeadline}
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                      <h4 className="font-semibold text-slate-900">
                        {ui.thumbnailPrompt}
                      </h4>
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {youtubeThumbnailResult.prompt}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-[28px] border border-orange-300/20 bg-orange-500/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {ui.exportCreatorPackage}
                  </h3>
                  <p className="mt-1 text-sm text-sky-800/75">
                    {ui.exportCreatorPackageDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCreatorPackage}
                  disabled={isDownloadingCreatorPackage || !creatorProductionPackage || !exportedMovieUrl}
                  className="rounded-2xl border border-orange-300/30 bg-orange-400/10 px-5 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDownloadingCreatorPackage
                    ? ui.downloadingCreatorPackage
                    : ui.downloadCreatorPackage}
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-orange-50/80 md:grid-cols-3">
                <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                  video_link.txt
                </div>
                <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                  title / hooks / chapters / captions
                </div>
                <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                  thumbnail + checklist + scenes.json
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-lime-300/20 bg-lime-500/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-lime-50">
                    {ui.costOptimizationEngine}
                  </h3>
                  <p className="mt-1 text-sm text-lime-100/75">
                    {ui.costOptimizationDesc}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOptimizeScenes}
                    disabled={sceneOptimizationLoading}
                    className="rounded-2xl border border-lime-300/30 bg-lime-400/10 px-5 py-3 text-sm font-semibold text-lime-100 transition hover:bg-lime-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sceneOptimizationLoading
                      ? ui.optimizingScenes
                      : ui.optimizeScenes}
                  </button>

                  <button
                    type="button"
                    onClick={handleOptimizeScenesAI}
                    disabled={sceneOptimizationAILoading}
                    className="rounded-2xl border border-purple-300/30 bg-purple-400/10 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sceneOptimizationAILoading
                      ? ui.aiOptimizingScenes
                      : ui.aiOptimizeScenes}
                  </button>

                  {sceneOptimizationResult.length > 0 && (
                    <button
                      type="button"
                      onClick={handleApplySceneOptimization}
                      className="rounded-2xl border border-teal-200 bg-teal-50/80 px-5 py-3 text-sm font-semibold text-teal-800 transition hover:bg-emerald-400/20"
                    >
                      {ui.applyOptimization}
                    </button>
                  )}
                </div>
              </div>

              {sceneOptimizationSummary && (
                <>
                <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-lime-50">
                    <div className="text-lime-100/60">{ui.recommendedVideoScenes}</div>
                    <div className="mt-1 text-xl font-semibold">
                      {sceneOptimizationSummary.recommendedVideoScenes}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-lime-50">
                    <div className="text-lime-100/60">{ui.recommendedImageScenes}</div>
                    <div className="mt-1 text-xl font-semibold">
                      {sceneOptimizationSummary.recommendedImageScenes}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-lime-50">
                    <div className="text-lime-100/60">{ui.estimatedSavings}</div>
                    <div className="mt-1 text-xl font-semibold">
                      {sceneOptimizationSummary.estimatedSavingsPercent}%
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-lime-100/60">
                  {ui.costPricingNote}
                </p>
                </>
              )}

              {sceneOptimizationResult.length > 0 && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {sceneOptimizationResult.map((item) => (
                    <div
                      key={item.sceneId}
                      className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-slate-900">
                          Scene {item.sceneId}
                        </h4>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.exportMode === "video"
                              ? "bg-sky-400/15 text-slate-700"
                              : "bg-amber-400/15 text-amber-700"
                          }`}
                        >
                          {item.exportMode.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {item.reason}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>Confidence: {item.confidence}</span>
                        <span>{item.exportMode === "video" ? (uiLanguage === "en" ? "Premium route" : "Premium rota") : (uiLanguage === "en" ? "Lower-credit route" : "Daha düşük kredi rotası")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-[28px] border border-teal-200 bg-teal-50/80 p-4 text-emerald-50">
              {ui.productionPackageNote}
            </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 text-slate-600">
                    {refinedCreatorScenes.length > 0
                      ? ui.refinedScenesNote
                      : ui.creatorProductionDesc}
                  </div>

                  <button
                    type="button"
                    onClick={handleRefineCreatorScenes}
                    disabled={refineScenesLoading}
                    className="rounded-[28px] border border-teal-200 bg-teal-50/80 px-5 py-3 text-sm font-semibold text-teal-800 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refineScenesLoading ? ui.refiningScenes : ui.refineScenes}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-[28px] border border-orange-300/20 bg-orange-500/10 p-5 text-sm leading-6 text-orange-50/85">
                {uiLanguage === "en"
                  ? "Next step: start scene production to create editable text scenes. Timeline optimization, metadata, thumbnail, export and credit-efficiency guidance will appear after scenes exist."
                  : "Sonraki adım: düzenlenebilir metin sahnelerini oluşturmak için sahne üretimini başlat. Timeline optimizasyonu, metadata, thumbnail, export ve kredi verimliliği yönlendirmesi sahneler oluştuktan sonra görünür."}
              </div>
            )}
            </div>
          </details>
        )}

        {!isCreatorLabFlow && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.studioSnapshot}</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{setupReady ? ui.setupReady : ui.setupWaiting}</p>
              <p className="mt-2 text-sm text-slate-600">{ui.studioSnapshotDesc}</p>
            </div>
            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.dialogueLayer}</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{dialogueReadyCount} {ui.sceneCountLabel}</p>
              <p className="mt-2 text-sm text-slate-600">{ui.dialogueLayerDesc}</p>
            </div>
            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.freezeRisk}</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{freezeNeededCount} {ui.sceneCountLabel}</p>
              <p className="mt-2 text-sm text-slate-600">{ui.freezeRiskDesc}</p>
            </div>
            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ui.quickModePrep}</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{ui.activePlan}</p>
              <p className="mt-2 text-sm text-slate-600">{ui.quickModePrepDesc}</p>
            </div>
          </div>
        )}

        {!isCreatorLabFlow && setupReady && (
          <div className="space-y-6 rounded-[28px] border border-orange-200/24 bg-white/74 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{ui.initialDesign}</h2>
              <p className="text-sm text-slate-600">
                {ui.initialDesignHint}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-slate-600">{ui.storyTitle}</label>
              <input
                className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-slate-600">{ui.storyPremiseLabel}</label>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                value={storySetup?.storyPremise || ""}
                onChange={(e) =>
                  setStorySetup((prev) =>
                    prev
                      ? {
                          ...prev,
                          storyPremise: e.target.value,
                        }
                      : prev
                  )
                }
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-orange-200/24 bg-white/74 p-4">
  <h3 className="text-xl font-semibold">{ui.narratorSettings}</h3>

  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2">
      <label className="block text-sm text-slate-600">Narrator Voice ID</label>
      <input
        className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
        placeholder="ElevenLabs narrator voiceId"
        value={narratorSettings.voiceId || ""}
        onChange={(e) => {
          stopDialoguePlayback();
          stopStoryPlayback();
          setNarratorSettings((prev) => ({
            ...prev,
            voiceId: e.target.value,
          }));
          clearAllSceneAudioData();
          clearAllSceneDialogueAudioData();
          clearAllSceneTimingData();
        }}
      />
      <p className="text-xs text-slate-500">
        {ui.narratorVoiceHint}
      </p>
    </div>

    <div className="space-y-2">
      <label className="block text-sm text-slate-600">Model</label>
      <select
        className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
        value={narratorSettings.modelId}
        onChange={(e) => {
          stopDialoguePlayback();
          stopStoryPlayback();
          setNarratorSettings((prev) => ({
            ...prev,
            modelId: e.target.value,
          }));
          clearAllSceneAudioData();
          clearAllSceneDialogueAudioData();
          clearAllSceneTimingData();
        }}
      >
        <option value="eleven_multilingual_v2">Multilingual v2</option>
        <option value="eleven_flash_v2_5">Flash v2.5</option>
      </select>
    </div>

    <div className="space-y-2">
      <label className="block text-sm text-slate-600">
        Stability: {narratorSettings.stability.toFixed(2)}
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={narratorSettings.stability}
        onChange={(e) => {
          stopDialoguePlayback();
          stopStoryPlayback();
          setNarratorSettings((prev) => ({
            ...prev,
            stability: Number(e.target.value),
          }));
          clearAllSceneAudioData();
          clearAllSceneDialogueAudioData();
          clearAllSceneTimingData();
        }}
        className="w-full"
      />
    </div>

    <div className="space-y-2">
      <label className="block text-sm text-slate-600">
        Similarity Boost: {narratorSettings.similarityBoost.toFixed(2)}
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={narratorSettings.similarityBoost}
        onChange={(e) => {
          stopDialoguePlayback();
          stopStoryPlayback();
          setNarratorSettings((prev) => ({
            ...prev,
            similarityBoost: Number(e.target.value),
          }));
          clearAllSceneAudioData();
          clearAllSceneDialogueAudioData();
          clearAllSceneTimingData();
        }}
        className="w-full"
      />
    </div>

    <div className="space-y-2">
      <label className="block text-sm text-slate-600">
        Style: {(narratorSettings.style ?? 0).toFixed(2)}
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={narratorSettings.style ?? 0.35}
        onChange={(e) => {
          stopDialoguePlayback();
          stopStoryPlayback();
          setNarratorSettings((prev) => ({
            ...prev,
            style: Number(e.target.value),
          }));
          clearAllSceneAudioData();
          clearAllSceneDialogueAudioData();
          clearAllSceneTimingData();
        }}
        className="w-full"
      />
    </div>

    <div className="space-y-2">
      <label className="block text-sm text-slate-600">
        Speed: {(narratorSettings.speed ?? 0.93).toFixed(2)}
      </label>
      <input
        type="range"
        min="0.7"
        max="1.2"
        step="0.01"
        value={narratorSettings.speed ?? 0.93}
        onChange={(e) => {
          stopDialoguePlayback();
          stopStoryPlayback();
          setNarratorSettings((prev) => ({
            ...prev,
            speed: Number(e.target.value),
          }));
          clearAllSceneAudioData();
          clearAllSceneDialogueAudioData();
          clearAllSceneTimingData();
        }}
        className="w-full"
      />
    </div>
  </div>

  <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-3 text-xs text-slate-500 space-y-1">
    <p>
      {ui.narratorRecommended}
      <span className="ml-1 text-gray-200">
        stability 0.28–0.35 / similarity 0.75–0.82 / style 0.30–0.45 / speed 0.90–0.95
      </span>
    </p>
    <p>
      {ui.narratorCacheHint}
    </p>
  </div>
</div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{ui.charactersTitle}</h3>
                <button
                  onClick={addCharacter}
                  className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                >
                  {ui.addCharacter}
                </button>
              </div>

              {characters.map((character, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-2xl border border-orange-200/24 bg-white/74 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{ui.characterLabel} {index + 1}</h4>
                    {characters.length > 1 && (
                      <button
                        onClick={() => removeCharacter(index)}
                        className="rounded-xl border border-red-400/30 px-3 py-1 text-xs text-red-200"
                      >
                        {ui.delete}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                      placeholder={ui.namePlaceholder}
                      value={character.name}
                      onChange={(e) => updateCharacter(index, "name", e.target.value)}
                    />
                    <input
                      className="rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                      placeholder={ui.agePlaceholder}
                      value={character.age}
                      onChange={(e) => updateCharacter(index, "age", e.target.value)}
                    />
                  </div>

                  <textarea
                    className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    placeholder={ui.appearancePlaceholder}
                    value={character.appearance}
                    onChange={(e) => updateCharacter(index, "appearance", e.target.value)}
                  />

                  <textarea
                    className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    placeholder={ui.outfitPlaceholder}
                    value={character.outfit}
                    onChange={(e) => updateCharacter(index, "outfit", e.target.value)}
                  />

                  <input
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    placeholder={ui.accessoryPlaceholder}
                    value={character.accessory || ""}
                    onChange={(e) => updateCharacter(index, "accessory", e.target.value)}
                  />

                  <textarea
                    className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    placeholder={ui.personalityPlaceholder}
                    value={character.personality}
                    onChange={(e) => updateCharacter(index, "personality", e.target.value)}
                  />

                  <input
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    placeholder={ui.characterVoicePlaceholder}
                    value={character.voiceId || ""}
                    onChange={(e) => updateCharacter(index, "voiceId", e.target.value)}
                  />

                  <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-3 text-xs text-slate-500">
                    {ui.characterVoiceHint}
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => generateCharacterReference(index)}
                      disabled={characterLoadingIndex === index}
                      className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {characterLoadingIndex === index
                        ? ui.preparingReferenceImage
                        : ui.generateReferenceImage}
                    </button>

                    {character.referenceImage ? (
                      <img
                        src={character.referenceImage}
                        alt={`${character.name || `${ui.characterLabel} ${index + 1}`} ${ui.referenceImageAlt}`}
                        className="w-full max-w-md rounded-2xl"
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-orange-200/24 p-4 text-sm text-slate-500">
                        {ui.noCharacterReference}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{ui.visualStyle}</h3>

              <textarea
                className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                placeholder={ui.stylePlaceholder}
                value={visualBible?.style || ""}
                onChange={(e) =>
                  setVisualBible((prev) => ({
                    ...(prev || emptyVisualBible),
                    style: e.target.value,
                  }))
                }
              />

              <textarea
                className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                placeholder={ui.palettePlaceholder}
                value={visualBible?.palette || ""}
                onChange={(e) =>
                  setVisualBible((prev) => ({
                    ...(prev || emptyVisualBible),
                    palette: e.target.value,
                  }))
                }
              />

              <textarea
                className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                placeholder={ui.cameraPlaceholder}
                value={visualBible?.camera || ""}
                onChange={(e) =>
                  setVisualBible((prev) => ({
                    ...(prev || emptyVisualBible),
                    camera: e.target.value,
                  }))
                }
              />

              <textarea
                className="min-h-20 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                placeholder={ui.consistencyRulesPlaceholder}
                value={visualBible?.consistencyRules || ""}
                onChange={(e) =>
                  setVisualBible((prev) => ({
                    ...(prev || emptyVisualBible),
                    consistencyRules: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={buildStory}
                disabled={buildingStory}
                className="rounded-2xl bg-white/82 px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
              >
                {buildingStory ? ui.buildingStory : ui.buildStoryAndScenes}
              </button>
            </div>
          </div>
        )}

        {scenes.length > 0 && (
          <div className={isCreatorLabFlow ? (creatorWorkspaceStep === 3 ? `creatorlab-legacy-scene-workspace ${creatorProductionDetailsOpen ? "is-open" : ""}` : "hidden") : "contents"}>
            {isCreatorLabFlow && (
              <div className="rounded-[28px] border border-rose-300/20 bg-slate-950/55 p-5 shadow-[0_16px_44px_rgba(15,23,42,0.28)]">
                <p className="text-xs uppercase tracking-[0.25em] text-rose-200/80">
                  {uiLanguage === "en" ? "CreatorLab Scene Review" : "CreatorLab Sahne İnceleme"}
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
                      <button
                        type="button"
                        onClick={handleOptimizeCreatorTimeline}
                        disabled={creatorTimelineOptimizeLoading}
                        className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50"
                      >
                        {creatorTimelineOptimizeLoading
                          ? (uiLanguage === "en" ? "Checking…" : "Kontrol ediliyor…")
                          : creatorTimelineMediaGate.action}
                      </button>

                      {getCreatorActiveTimelinePlan() &&
                        creatorTimelineNeedsEditPlan(getCreatorActiveTimelinePlan() as TimelineSyncPlan) &&
                        creatorTimelineMediaGate.status === "blocked" && (
                          <button
                            type="button"
                            onClick={approveCreatorTimelineRisk}
                            className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15"
                          >
                            {uiLanguage === "en" ? "Approve risk" : "Riski onayla"}
                          </button>
                        )}
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

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <button
                      onClick={saveProject}
                      disabled={isSavingProject}
                      className="rounded-2xl bg-green-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-[1.02] disabled:opacity-50"
                    >
                      {isSavingProject ? ui.savingProject : ui.saveProject}
                    </button>

                    <button
                      onClick={generateAllSceneVisuals}
                      disabled={isBatchRendering || isPreparingAudio || isExportingMovie || isCreatorMediaGenerationBlocked || isCreatorActionBlocked("visuals")}
                      className="rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-[1.02] disabled:opacity-50"
                    >
                      {isBatchRendering
                        ? (uiLanguage === "en" ? "Generating visuals..." : "Görseller üretiliyor...")
                        : uiLanguage === "en"
                          ? "Generate Visuals"
                          : "Görselleri Üret"}
                    </button>

                    <button
                      onClick={prepareAllAudio}
                      disabled={isPreparingAudio || isPlayingStory || playingDialogueSceneId !== null || isCreatorMediaGenerationBlocked || isCreatorActionBlocked("voice_over")}
                      className="rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-[1.02] disabled:opacity-50"
                    >
                      {isPreparingAudio
                        ? ui.preparingAudio
                        : uiLanguage === "en"
                          ? "Generate Voice-over"
                          : "Seslendirme Üret"}
                    </button>

                    <button
                      onClick={() => handleExportMovie(false)}
                      disabled={isExportingMovie || isCreatorActionBlocked("final_video")}
                      title={creatorFinalVideoReadinessMessage}
                      className="rounded-2xl bg-orange-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-[1.02] disabled:opacity-50"
                    >
                      {isExportingMovie
                        ? ui.creatingMovie
                        : exportedMovieUrl && hasReusableExport()
                          ? (uiLanguage === "en" ? "▶ Open Existing Video" : "▶ Mevcut Videoyu Aç")
                          : (uiLanguage === "en" ? `Create Final Video (${readyExportCount})` : `Final Video Oluştur (${readyExportCount})`)}
                    </button>
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
                      <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                        {uiLanguage === "en" ? "Advanced controls" : "Gelişmiş kontroller"}
                      </p>
                      <p className="mb-3 text-xs leading-5 text-slate-500">
                        {uiLanguage === "en"
                          ? "Use AI video blocks only when you want scene-level premium motion before creating the final video."
                          : "AI video block üretimini yalnızca final video öncesinde sahne bazlı premium hareket istediğinde kullan."}
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          onClick={generateAllAiVideoBlocks}
                          disabled={
                            isBatchRendering ||
                            isPreparingAudio ||
                            isExportingMovie ||
                            playingDialogueSceneId !== null
                          }
                          title={
                            isCreatorActionBlocked("ai_video_blocks") || isCreatorMediaGenerationBlocked
                              ? getCreatorMediaActionError("ai_video_blocks")
                              : (uiLanguage === "en" ? "Generate routed AI video blocks for all eligible scenes." : "Uygun tüm sahneler için yönlendirilmiş AI video blokları üret.")
                          }
                          className="rounded-2xl bg-fuchsia-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                        >
                          {isBatchRendering
                            ? uiLanguage === "en"
                              ? "Generating AI video blocks..."
                              : "AI video block üretiliyor..."
                            : uiLanguage === "en"
                              ? "Generate AI Video Blocks"
                              : "AI Video Block Üret"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportMovie(true)}
                          disabled={isExportingMovie || isCreatorActionBlocked("final_video")}
                          title={creatorFinalVideoReadinessMessage}
                          className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-6 py-3 font-semibold text-amber-700 transition hover:scale-105 disabled:opacity-50"
                        >
                          {isExportingMovie
                            ? ui.creatingMovie
                            : uiLanguage === "en"
                              ? "🔁 Re-create Video"
                              : "🔁 Videoyu Yeniden Oluştur"}
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
                          onClick={isBatchRendering ? stopBatchRender : startBatchRender}
                          disabled={
                            isPreparingAudio ||
                            isExportingMovie ||
                            playingDialogueSceneId !== null ||
                            (loadingAudioSceneId !== null && !isBatchRendering) ||
                            (!isBatchRendering &&
                              (isCreatorMediaGenerationBlocked ||
                                isCreatorActionBlocked("batch_render")))
                          }
                          className="rounded-2xl bg-cyan-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                        >
                          {isBatchRendering ? getBatchLabel("cancel") : getBatchLabel("start")}
                        </button>

                        {batchRenderItems.some((item) => item.status === "failed") && !isBatchRendering && (
                          <button
                            onClick={() => retryFailedScenes()}
                            disabled={isPreparingAudio || isExportingMovie || playingDialogueSceneId !== null || isCreatorMediaGenerationBlocked || isCreatorActionBlocked("batch_render")}
                            className="rounded-2xl bg-rose-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                          >
                            {getBatchLabel("retryFailed")}
                          </button>
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
                    onClick={isBatchRendering ? stopBatchRender : startBatchRender}
                    disabled={
                      isPreparingAudio ||
                      isExportingMovie ||
                      playingDialogueSceneId !== null ||
                      (loadingAudioSceneId !== null && !isBatchRendering) ||
                      (!isBatchRendering && isCreatorMediaGenerationBlocked)
                    }
                    className="rounded-2xl bg-cyan-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                  >
                    {isBatchRendering ? getBatchLabel("cancel") : getBatchLabel("start")}
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
                                : scene.videoStatus === "processing"
                                ? "border border-blue-500/30 bg-blue-500/10 text-blue-200"
                                : scene.videoStatus === "error"
                                ? "border border-red-500/30 bg-rose-50/80 text-red-200"
                                : "border border-orange-200/65/30 bg-gray-500/10 text-gray-200"
                            }`}
                          >
                            {scene.videoStatus === "done"
                              ? "Video ready"
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
                          value={scene.renderMode || "auto"}
                          onChange={(e) => {
                            const mode = e.target.value as "auto" | "video" | "image";

                            setScenes((prev) =>
                              prev.map((item) =>
                                item.id === scene.id
                                  ? { ...item, renderMode: mode }
                                  : item
                              )
                            );

                            setExportedMovieUrl("");
                            setExportMovieResult(null);
                            setExportSignature("");
                          }}
                          className="rounded-md border border-orange-200/24 bg-[radial-gradient(circle_at_10%_6%,#ffe0f2_0%,transparent_30%),radial-gradient(circle_at_90%_10%,#d9f5ff_0%,transparent_32%),radial-gradient(circle_at_48%_92%,#fff0bd_0%,transparent_36%),linear-gradient(180deg,#fffaf4_0%,#f8fbff_46%,#f4fff8_100%)] px-2 py-1 text-xs text-slate-900"
                        >
                          <option value="auto">Auto</option>
                          <option value="video">Video</option>
                          <option value="image">Image</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleGenerateVideo(scene.id)}
                        disabled={scene.videoStatus === "processing" || !scene.image}
                        title={
                          !scene.image
                            ? (uiLanguage === "en" ? "Generate the scene visual first." : "Önce sahne görselini üret.")
                            : isCreatorActionBlocked("ai_video_blocks") || isCreatorMediaGenerationBlocked
                              ? getCreatorMediaActionError("ai_video_blocks")
                              : (uiLanguage === "en" ? "Create an AI motion block from this visual." : "Bu görselden AI hareketli video bloğu üret.")
                        }
                        className="rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-100 disabled:opacity-50"
                      >
                        {scene.videoStatus === "processing"
                          ? ui.videoCreating
                          : ui.convertToVideo}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSceneId(scene.id);
                          setBranchingSceneId(null);
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
                        onClick={() => redrawSceneImage(scene)}
                        disabled={redrawLoadingId === scene.id}
                        title={
                          isCreatorActionBlocked("visuals") || isCreatorMediaGenerationBlocked
                            ? getCreatorMediaActionError("visuals")
                            : (uiLanguage === "en" ? "Regenerate this scene visual." : "Bu sahne görselini yeniden üret.")
                        }
                        className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {redrawLoadingId === scene.id ? ui.redrawing : ui.redraw}
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
        )}
      </div>
        </div>
              </div>
</div>
        </main>
      </ActiveProductShell>
    </WorldProvider>
  );
}
