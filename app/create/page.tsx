"use client";

// X12.2C Career Lab Experience Cleanup: removes development/readiness panels from the child-facing mission surface.
// X12.2B Career Lab Cinematic Mission Intro: adds low-risk immersive mission intro layer.

// X12.1 Career Lab Mission Experience Enrichment: strengthens mission/report language without changing logic.

// X11.6A Career Lab Dev Language Cleanup: remaining Career Lab internal/dev copy converted to child-friendly mission language.

// X11.4D Creator Lab Phase Language Final: removes Phase-2A/2C/3 and technical Creator Lab wording from visible UI.

// X11.4C Phase Language Targeted Fix: only visible PHASE labels are replaced; identifiers remain untouched.

// X10.4G Saved Career Missions Blue Contrast Root-Cause Fix: fixes actual blue low-contrast classes in saved mission block.

// X10.4E Saved Missions + Hide Production Studio: fixes saved missions contrast and hides production workspace from Career Lab.

// X10.4C Targeted Career Contrast Fix: fixes low-contrast Career Lab report/readiness sections without JSX structure changes.
// X10.4D Saved Missions + Decision Profile Contrast Fix: fixes remaining emerald/fuchsia Career Lab surfaces.

// X10.3B.1 Career Cleanup Safe Hotfix: syntax-safe child-friendly Career Lab wording, no JSX wrapper edits.
// X10.3B.2 Identifier Recovery Hotfix: restore formatCareerFinalReportMarkdown after wording cleanup.

// X10.3A Career Child Mode Extraction: Storyverse flagship and dashboard/catalog layers are hidden from Career Lab child mode.

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
import { experienceFlows, getFlowByKey, type FlowZone } from "../../lib/flows";
import WorldGateway from "@/components/create/WorldGateway";
import StoryverseCinematicIntro from "@/components/create/StoryverseCinematicIntro";
import CreatorStudioIntro from "@/components/create/CreatorStudioIntro";
import CareerMentorIntro from "@/components/create/CareerMentorIntro";
import CareerMissionIntro from "@/components/create/CareerMissionIntro";
import CareerMissionChat from "@/components/create/CareerMissionChat";
import WorldFocusRouter from "@/components/create/WorldFocusRouter";
import FocusedWorldWorkspace from "@/components/create/FocusedWorldWorkspace";
import { WorldProvider } from "@/components/create/WorldContext";
import StoryverseShell from "@/components/experience/StoryverseShell";
import CreatorLabShell from "@/components/experience/CreatorLabShell";
import { flowCardMessages } from "@/lib/i18n/flowCard";
import { DEFAULT_CHARACTER } from "@/lib/characterConfig";
import { CREATOR_COST_BASIS_LABEL, CREATOR_DEFAULT_VIDEO_SCENE_COST_USD } from "@/lib/creatorCostConfig";
import { CAREER_LAB_COPY, CAREER_LAB_PROFESSIONS, CAREER_TRAIT_LABELS, calculateCareerTraitProfile, getCareerAdaptiveFeedback, getCareerAdaptiveNextChallenge, getCareerExperienceReportPreview, formatCareerFinalReportMarkdown, formatCareerNarrativeReportPayload, formatCareerNarrativeReportPrompt, formatCareerSessionSnapshotJson, getCareerCinematicRecapBlueprint, getCareerFinalReport, getCareerMission, getCareerLocalDecisionConsequence, getCareerLocalFollowUpPrompt, getCareerMissionOutcomeMap, getCareerThinkingJourneyMap, getCareerCognitivePatternSignals, getCareerPremiumDevelopmentalReport, getCareerDevelopmentalOutputSummary, getCareerSimulationOutputPackage, getCareerProfession, getCareerTraitSummary, type CareerDecisionOption, type CareerProfessionKey } from "@/lib/careerLabConfig";

type SceneTiming = {
  narrationDuration: number;
  dialogueDuration: number;
  totalAudioDuration: number;
  targetSceneDuration: number;
  maxSpeechDuration?: number;
  freezeDuration: number;
  needsFreezeFrame: boolean;
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
  timing?: SceneTiming;
  intelligence?: SceneIntelligence;
};

type BatchSceneStatus = "pending" | "processing" | "done" | "failed" | "skipped";

type BatchRenderItem = {
  sceneId: number;
  status: BatchSceneStatus;
  step: "waiting" | "image" | "audio" | "video" | "save" | "complete" | "error";
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

type CreatorAgeGroup = "6-8" | "8-12" | "10-16" | "13-17";
type CreatorContentType =
  | "educational"
  | "fun_facts"
  | "story"
  | "cartoon"
  | "science"
  | "history"
  | "life_skills";
type CreatorFormat = "shorts_60" | "two_min" | "five_min";

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

type CreatorVideoDurationSec = 60 | 90 | 180 | 300;

const CREATOR_SCENE_CLIP_DURATION_SECONDS = 10;
const CREATOR_MAX_SCENE_COUNT = 36;

const getCreatorSceneCountForTargetDuration = (durationSec: number) => {
  return Math.min(
    CREATOR_MAX_SCENE_COUNT,
    Math.max(1, Math.ceil(durationSec / CREATOR_SCENE_CLIP_DURATION_SECONDS))
  );
};

const CREATOR_DURATION_OPTIONS: Array<{
  value: CreatorVideoDurationSec;
  label: string;
  sceneCount: number;
}> = [
  { value: 60, label: "60 sec", sceneCount: getCreatorSceneCountForTargetDuration(60) },
  { value: 90, label: "90 sec", sceneCount: getCreatorSceneCountForTargetDuration(90) },
  { value: 180, label: "180 sec", sceneCount: getCreatorSceneCountForTargetDuration(180) },
  { value: 300, label: "300 sec", sceneCount: getCreatorSceneCountForTargetDuration(300) },
];

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
  { value: "6-8", label: "6–8" },
  { value: "8-12", label: "8–12" },
  { value: "10-16", label: "10–16" },
  { value: "13-17", label: "13–17" },
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

const CREATOR_FORMAT_OPTIONS: Array<{ value: CreatorFormat; label: string }> = [
  { value: "shorts_60", label: "Shorts / 60 sec" },
  { value: "two_min", label: "2 min video" },
  { value: "five_min", label: "5 min video" },
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
    : `Joe: ${optimizedHook}`;

  scenes[0] = {
    ...firstScene,
    text: firstScene.text?.toLowerCase().includes("joe")
      ? firstScene.text
      : `Joe reacts with surprise as the episode reveals the main question: ${optimizedHook}`,
    narration: firstScene.narration?.trim()
      ? firstScene.narration
      : "Joe spots something surprising right away.",
    dialogue: firstDialogue.toLowerCase().includes("did you know")
      ? `Joe: ${optimizedHook}`
      : firstDialogue,
    emotion: firstScene.emotion || "surprised curiosity",
    motionHint: firstScene.motionHint || "Joe leans forward with wide-eyed surprise",
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
    runwayVideoChip: "Runway video",
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
    creatorStrategySetup: "YouTube Strateji Kurulumu",
    creatorMentorDesc: "Bu mod, sahne üretmeden önce AI’ın içerik stratejisti gibi düşünmesini sağlar. YouTube Data API entegrasyonu Faz-2 yol haritasındadır; bu MVP önce mentor analiz katmanını kullanır.",
    targetMarket: "Hedef Pazar",
    ageGroup: "Yaş Grubu",
    contentType: "İçerik Tipi",
    videoFormat: "Video Formatı",
    analyzeContentOpportunity: "İçerik Fırsatını Analiz Et",
    analyzingContentOpportunity: "İçerik fırsatı analiz ediliyor...",
    creatorTopicLabel: "Content Creator Lab hangi konu veya video fikrini analiz etsin?",
    creatorTopicPlaceholder: "Örn: Ahtapotlar neden çok zeki? veya çocuklara yönelik yüksek potansiyelli bir bilim videosu fikri öner",
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
    costOptimizationEngine: "Cost Optimization Engine",
    costOptimizationDesc: "Sahneler için Video / Image önerisi üretir ve tahmini Runway maliyetini azaltır.",
    costPricingNote: `Fiyat bazı: ${CREATOR_COST_BASIS_LABEL}`,
    optimizeScenes: "Sahneleri Optimize Et",
    optimizingScenes: "Sahneler optimize ediliyor...",
    costSummary: "Maliyet Özeti",
    recommendedVideoScenes: "Önerilen Video Sahneleri",
    recommendedImageScenes: "Önerilen Image Sahneleri",
    estimatedCost: "Tahmini Maliyet",
    estimatedSavings: "Tahmini Tasarruf",
    applyOptimization: "Önerileri Uygula",
    optimizationApplied: "Optimizasyon önerileri uygulandı ✅",
    aiOptimizeScenes: "AI Optimize",
    aiOptimizingScenes: "AI optimize ediyor...",
    youtubeAutoMode: "YouTube Auto Mode",
    youtubeAutoModeDesc: "Konu fikrinden production package, metadata, thumbnail, cost optimization ve kayıt adımlarını tek akışta hazırlar. Video üretmez; maliyetli render kararı sende kalır.",
    generateFullYoutubePackage: "Full YouTube Package Üret",
    generatingFullYoutubePackage: "Full package hazırlanıyor...",
    fullYoutubePackageReady: "Full YouTube package hazır ✅",
    productionBridgeTitle: "Üretime Devam Et",
    productionBridgeDesc: "Creator Lab paketi hazır. Şimdi bu paketi gerçek sahnelere dönüştürebilir, ardından görsel/ses/video üretimine geçebilirsin.",
    productionBridgeButton: "🎬 Sahne Üretimine Başla",
    productionBridgeReady: "Creator Lab paketi hazır. Henüz üretim sahnesi oluşturulmadı.",
    productionBridgeCostNote: "Not: Bu adım sahne görsellerini üretmeye başlayabilir; maliyet kontrolü sende kalır.",
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
    productionPackageNote: "Bu paket hazırlandıktan sonra mevcut Storyverse üretim motoru ile karakter, sahne, görsel, ses ve video üretimine devam edebilirsin.",
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
    creatorDurationTitle: "Video Süresi",
    creatorDurationDesc: "Seçilen hedef süre, 10 saniyelik varsayılan sahne ritmine göre hesaplanır. Sistem konuşma yoğunluğuna göre sahneleri 8-12 saniye aralığında dengeler. Örn: 60 sn hedef ≈ 6 sahne.",
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
    runwayVideoChip: "Runway video",
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
    turkish: "Türkçe",
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
    creatorStrategySetup: "YouTube Strategy Setup",
    creatorMentorDesc: "This mode helps shape the idea before creating scenes. It looks at the topic, audience, format and creator direction first.",
    targetMarket: "Target Market",
    ageGroup: "Age Group",
    contentType: "Content Type",
    videoFormat: "Video Format",
    analyzeContentOpportunity: "Analyze Content Opportunity",
    analyzingContentOpportunity: "Analyzing content opportunity...",
    creatorTopicLabel: "What topic or video idea should Content Creator Lab analyze?",
    creatorTopicPlaceholder: "Example: Why octopuses are so intelligent, or recommend a high-potential kids science video idea",
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
    costOptimizationEngine: "Cost Optimization Engine",
    costOptimizationDesc: "Generates Video / Image recommendations per scene and reduces estimated Runway cost.",
    costPricingNote: `Pricing basis: ${CREATOR_COST_BASIS_LABEL}`,
    optimizeScenes: "Optimize Scenes",
    optimizingScenes: "Optimizing scenes...",
    costSummary: "Cost Summary",
    recommendedVideoScenes: "Recommended Video Scenes",
    recommendedImageScenes: "Recommended Image Scenes",
    estimatedCost: "Estimated Cost",
    estimatedSavings: "Estimated Savings",
    applyOptimization: "Apply Recommendations",
    optimizationApplied: "Optimization recommendations applied ✅",
    aiOptimizeScenes: "AI Optimize",
    aiOptimizingScenes: "AI optimizing...",
    youtubeAutoMode: "YouTube Auto Mode",
    youtubeAutoModeDesc: "Builds production package, metadata, thumbnail, cost optimization, and save steps from one topic. It does not render video; expensive rendering remains under your control.",
    generateFullYoutubePackage: "Create Ready-to-Share Package",
    generatingFullYoutubePackage: "Preparing full package...",
    fullYoutubePackageReady: "Full YouTube package is ready ✅",
    productionBridgeTitle: "Continue to Production",
    productionBridgeDesc: "The Creator Lab package is ready. Convert it into production scenes, then continue with image, audio, and video generation.",
    productionBridgeButton: "🎬 Start Scene Production",
    productionBridgeReady: "Creator Lab package is ready. No production scenes have been created yet.",
    productionBridgeCostNote: "Note: This step may start generating scene visuals; rendering cost remains under your control.",
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
    productionPackageNote: "After this package is prepared, you can continue with the existing Storyverse production engine for characters, scenes, visuals, audio, and video.",
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
    creatorDurationTitle: "Video Duration",
    creatorDurationDesc: "The selected target duration is calculated with a 10-second default scene rhythm. The system balances scenes within an 8-12 second adaptive range based on speech density. Example: 60 sec target ≈ 6 scenes.",
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
  dialogueDuration: number
): SceneTiming => {
  const safeNarration = Number.isFinite(narrationDuration) ? narrationDuration : 0;
  const safeDialogue = Number.isFinite(dialogueDuration) ? dialogueDuration : 0;
  const totalAudioDuration = safeNarration + safeDialogue;

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






export default function CreatePage() {
  const router = useRouter();
  const [selectedFlowKey, setSelectedFlowKey] = useState("storyverse");
  const selectedFlow = getFlowByKey(selectedFlowKey);
  const activeFlowKey =
    (selectedFlow as any)?.key || (selectedFlow as any)?.id || selectedFlowKey || "storyverse";
  const isStoryverseFlow = activeFlowKey === "storyverse";
  const isCreatorLabFlow = activeFlowKey === "creator_lab";
  const isCareerLabFlow = activeFlowKey === "career_lab";
  const [authLoading, setAuthLoading] = useState(true);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [userRole, setUserRole] = useState<"parent" | "admin" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [input, setInput] = useState("");
  const { language: uiLanguage } = useLanguage();
  const careerLabCopy = CAREER_LAB_COPY[uiLanguage === "en" ? "en" : "tr"];
  const [careerDecisionAnswers, setCareerDecisionAnswers] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<ContentLanguage>(
    uiLanguage === "en" ? "en" : "tr"
  );
  const ui = UI_TEXT[uiLanguage] ?? UI_TEXT.tr;
  const localizedFlowMessages = flowCardMessages[uiLanguage] ?? flowCardMessages.tr;
  const localizedSelectedFlow = localizedFlowMessages.flows[activeFlowKey] ?? selectedFlow;

  const [creatorCountry, setCreatorCountry] = useState("global");
  const [creatorAgeGroup, setCreatorAgeGroup] = useState<CreatorAgeGroup>("8-12");
  const [creatorContentType, setCreatorContentType] =
    useState<CreatorContentType>("educational");
  const [creatorFormat, setCreatorFormat] = useState<CreatorFormat>("shorts_60");
  const [creatorVideoDurationSec, setCreatorVideoDurationSec] =
    useState<CreatorVideoDurationSec>(60);
  const [creatorMentorResult, setCreatorMentorResult] =
    useState<CreatorMentorResult | null>(null);
  const [creatorMentorLoading, setCreatorMentorLoading] = useState(false);
  const [creatorProductionPackage, setCreatorProductionPackage] =
    useState<CreatorProductionPackage | null>(null);
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
  const [sceneOptimizationResult, setSceneOptimizationResult] = useState<
    SceneOptimizationResult[]
  >([]);
  const [sceneOptimizationSummary, setSceneOptimizationSummary] =
    useState<SceneOptimizationSummary | null>(null);
  const [sceneOptimizationLoading, setSceneOptimizationLoading] = useState(false);
  const [sceneOptimizationAILoading, setSceneOptimizationAILoading] = useState(false);
  const [selectedCareerProfession, setSelectedCareerProfession] =
    useState<CareerProfessionKey>("astronaut");

  const [storySetup, setStorySetup] = useState<StorySetup | null>(null);

  const [title, setTitle] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [visualBible, setVisualBible] = useState<VisualBible | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);

  const [loadingSetup, setLoadingSetup] = useState(false);
  const [buildingStory, setBuildingStory] = useState(false);
  const [error, setError] = useState("");
const [careerAiNarrativeReport, setCareerAiNarrativeReport] = useState("");
const [careerAiNarrativeLoading, setCareerAiNarrativeLoading] = useState(false);
const [careerAiNarrativeError, setCareerAiNarrativeError] = useState("");
const [careerAiNarrativeMeta, setCareerAiNarrativeMeta] = useState<{
  model?: string;
  safetyNote?: string;
  usage?: any;
  generatedAt?: string;
} | null>(null);
const [careerAiNarrativeGenerationCount, setCareerAiNarrativeGenerationCount] = useState(0);
const [careerSessionSaveLoading, setCareerSessionSaveLoading] = useState(false);
const [careerSessionSaveError, setCareerSessionSaveError] = useState("");
const [careerSessionSaveSuccess, setCareerSessionSaveSuccess] = useState("");
const [savedCareerSessionId, setSavedCareerSessionId] = useState("");
const [careerSavedSessions, setCareerSavedSessions] = useState<any[]>([]);
const [careerSessionsLoading, setCareerSessionsLoading] = useState(false);
const [careerSessionsError, setCareerSessionsError] = useState("");
const [careerSessionLoadLoading, setCareerSessionLoadLoading] = useState(false);
const [careerMentorReflections, setCareerMentorReflections] = useState<Record<string, string>>({});
const [careerMentorReflectionLoadingId, setCareerMentorReflectionLoadingId] = useState("");
const [careerMentorReflectionError, setCareerMentorReflectionError] = useState("");
const [careerDecisionReasons, setCareerDecisionReasons] = useState<Record<string, string>>({});
const [careerMentorReflectionCounts, setCareerMentorReflectionCounts] = useState<Record<string, number>>({});
const [careerFollowUpAnswers, setCareerFollowUpAnswers] = useState<Record<string, string>>({});

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
    const params = new URLSearchParams(window.location.search);
    setSelectedFlowKey(params.get("flow") || "storyverse");
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
  const selectedCareerProfessionConfig = getCareerProfession(selectedCareerProfession);
  const selectedCareerMission = getCareerMission(selectedCareerProfession);
  const careerTraitProfile = calculateCareerTraitProfile(selectedCareerMission, careerDecisionAnswers);
  const careerTraitSummary = getCareerTraitSummary(careerTraitProfile, uiLanguage === "en" ? "en" : "tr");
  const answeredCareerDecisionCount = Object.keys(careerDecisionAnswers).length;
  const isCareerMissionComplete = answeredCareerDecisionCount >= selectedCareerMission.decisionPoints.length;
  const careerAdaptiveFeedback = getCareerAdaptiveFeedback(careerTraitProfile, answeredCareerDecisionCount, selectedCareerMission.decisionPoints.length, uiLanguage === "en" ? "en" : "tr");
  const careerExperienceReportPreview = getCareerExperienceReportPreview(selectedCareerProfessionConfig, selectedCareerMission, careerTraitProfile, careerDecisionAnswers, uiLanguage === "en" ? "en" : "tr");
  const careerFinalReport = getCareerFinalReport(selectedCareerProfessionConfig, selectedCareerMission, careerTraitProfile, careerDecisionAnswers, uiLanguage === "en" ? "en" : "tr");
  const careerFinalReportMarkdown = formatCareerFinalReportMarkdown(careerFinalReport, uiLanguage === "en" ? "en" : "tr");
  const careerSessionSnapshotJson = formatCareerSessionSnapshotJson({
    professionKey: selectedCareerProfession,
    profession: selectedCareerProfessionConfig,
    mission: selectedCareerMission,
    profile: careerTraitProfile,
    answers: careerDecisionAnswers,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerCinematicRecapBlueprint = getCareerCinematicRecapBlueprint(selectedCareerProfessionConfig, selectedCareerMission, careerTraitProfile, careerDecisionAnswers, uiLanguage === "en" ? "en" : "tr");
  const careerSimulationOutputPackage = getCareerSimulationOutputPackage(uiLanguage === "en" ? "en" : "tr");
  const careerAdaptiveNextChallenge = getCareerAdaptiveNextChallenge({
    profession: selectedCareerProfessionConfig,
    mission: selectedCareerMission,
    profile: careerTraitProfile,
    answers: careerDecisionAnswers,
    reasons: careerDecisionReasons,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerMissionOutcomeMap = getCareerMissionOutcomeMap({
    mission: selectedCareerMission,
    profile: careerTraitProfile,
    answers: careerDecisionAnswers,
    reasons: careerDecisionReasons,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerDevelopmentalOutputSummary = getCareerDevelopmentalOutputSummary({
    outcomeMap: careerMissionOutcomeMap,
    nextChallenge: careerAdaptiveNextChallenge,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerThinkingJourneyMap = getCareerThinkingJourneyMap({
    mission: selectedCareerMission,
    answers: careerDecisionAnswers,
    reasons: careerDecisionReasons,
    followUpAnswers: careerFollowUpAnswers,
    mentorReflections: careerMentorReflections,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerCognitivePatternSignals = getCareerCognitivePatternSignals({
    mission: selectedCareerMission,
    answers: careerDecisionAnswers,
    reasons: careerDecisionReasons,
    followUpAnswers: careerFollowUpAnswers,
    mentorReflections: careerMentorReflections,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerPremiumDevelopmentalReport = getCareerPremiumDevelopmentalReport({
    finalReport: careerFinalReport,
    outcomeMap: careerMissionOutcomeMap,
    thinkingJourneyMap: careerThinkingJourneyMap,
    cognitivePatternSignals: careerCognitivePatternSignals,
    nextChallenge: careerAdaptiveNextChallenge,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerEnrichedSessionSnapshotJson = JSON.stringify(
    {
      ...JSON.parse(careerSessionSnapshotJson),
      decisionReasons: careerDecisionReasons,
      mentorReflections: careerMentorReflections,
      mentorReflectionCounts: careerMentorReflectionCounts,
      followUpAnswers: careerFollowUpAnswers,
      missionOutcomeMap: careerMissionOutcomeMap,
      adaptiveNextChallenge: careerAdaptiveNextChallenge,
      developmentalOutputSummary: careerDevelopmentalOutputSummary,
      thinkingJourneyMap: careerThinkingJourneyMap,
      cognitivePatternSignals: careerCognitivePatternSignals,
      premiumDevelopmentalReport: careerPremiumDevelopmentalReport,
    },
    null,
    2
  );
  const careerNarrativeReportPrompt = formatCareerNarrativeReportPrompt({
    profession: selectedCareerProfessionConfig,
    mission: selectedCareerMission,
    report: careerFinalReport,
    recapBlueprint: careerCinematicRecapBlueprint,
    snapshotJson: careerEnrichedSessionSnapshotJson,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const careerNarrativeReportPayload = formatCareerNarrativeReportPayload({
    professionKey: selectedCareerProfession,
    profession: selectedCareerProfessionConfig,
    mission: selectedCareerMission,
    profile: careerTraitProfile,
    answers: careerDecisionAnswers,
    report: careerFinalReport,
    recapBlueprint: careerCinematicRecapBlueprint,
    snapshotJson: careerEnrichedSessionSnapshotJson,
    prompt: careerNarrativeReportPrompt,
    language: uiLanguage === "en" ? "en" : "tr",
  });
  const handleCareerDecision = (decisionId: string, option: CareerDecisionOption) => {
    setCareerDecisionAnswers((current: Record<string, string>) => ({
      ...current,
      [decisionId]: option.id,
    }));
  };
  const handleCopyCareerReport = async () => {
    if (!careerFinalReportMarkdown) return;

    try {
      await navigator.clipboard.writeText(careerFinalReportMarkdown);
      setError("");
    } catch (e) {
      setError(uiLanguage === "en" ? "Could not copy the report." : "Rapor kopyalanamadı.");
    }
  };

  const handleDownloadCareerReport = () => {
    if (!careerFinalReportMarkdown) return;

    const blob = new Blob([careerFinalReportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeProfession = selectedCareerProfession.replace(/[^a-z0-9_-]/gi, "-");
    anchor.href = url;
    anchor.download = `velto-career-lab-${safeProfession}-report.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  
const handleGenerateCareerAiNarrativeReport = async () => {
  if (careerAiNarrativeGenerationCount > 0) {
    const confirmed = window.confirm(
      uiLanguage === "en"
        ? "This will generate a new AI report and may create additional OpenAI cost. Continue?"
        : "Bu işlem yeni bir AI raporu üretecek ve ek OpenAI maliyeti oluşturabilir. Devam edilsin mi?"
    );

    if (!confirmed) return;
  }

  try {
    setCareerAiNarrativeLoading(true);
    setCareerAiNarrativeError("");
    setCareerAiNarrativeReport("");
    setCareerAiNarrativeMeta(null);

    const response = await fetch("/api/career-narrative-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: uiLanguage === "en" ? "en" : "tr",
        prompt: careerNarrativeReportPrompt,
        payload: JSON.parse(careerNarrativeReportPayload),
        sessionSnapshot: JSON.parse(careerEnrichedSessionSnapshotJson),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "AI narrative generation failed."
            : "AI anlatı üretimi başarısız oldu.")
      );
    }

    setCareerAiNarrativeReport(String(data?.narrativeReport || "").trim());
    setCareerAiNarrativeMeta({
      model: data?.model,
      safetyNote: data?.safetyNote,
      usage: data?.usage,
      generatedAt: new Date().toISOString(),
    });
    setCareerAiNarrativeGenerationCount((current) => current + 1);
  } catch (err: any) {
    setCareerAiNarrativeError(
      err?.message ||
        (uiLanguage === "en"
          ? "AI narrative generation failed."
          : "AI anlatı üretimi başarısız oldu.")
    );
  } finally {
    setCareerAiNarrativeLoading(false);
  }
};

const handleCopyCareerAiNarrativeReport = async () => {
  if (!careerAiNarrativeReport) return;

  try {
    await navigator.clipboard.writeText(careerAiNarrativeReport);
    setError("");
  } catch (e) {
    setCareerAiNarrativeError(
      uiLanguage === "en"
        ? "Could not copy the AI narrative report."
        : "AI anlatı raporu kopyalanamadı."
    );
  }
};

const handleDownloadCareerAiNarrativeReport = () => {
  if (!careerAiNarrativeReport) return;

  const blob = new Blob([careerAiNarrativeReport], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeProfession = selectedCareerProfession.replace(/[^a-z0-9_-]/gi, "-");
  anchor.href = url;
  anchor.download = `velto-career-lab-${safeProfession}-ai-narrative-report.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const handleGenerateCareerMentorReflection = async (decision: any, selectedOption: any) => {
  if ((careerMentorReflectionCounts[decision.id] || 0) > 0) {
    const confirmed = window.confirm(
      uiLanguage === "en"
        ? "This will regenerate the AI mentor reflection and may create additional OpenAI cost. Continue?"
        : "Bu işlem AI mentor reflection çıktısını yeniden üretecek ve ek OpenAI maliyeti oluşturabilir. Devam edilsin mi?"
    );

    if (!confirmed) return;
  }

  try {
    setCareerMentorReflectionLoadingId(decision.id);
    setCareerMentorReflectionError("");

    const response = await fetch("/api/career-mentor-reflection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: uiLanguage === "en" ? "en" : "tr",
        professionTitle:
          selectedCareerProfessionConfig.title[uiLanguage] ??
          selectedCareerProfessionConfig.title.tr,
        missionTitle:
          selectedCareerMission.title[uiLanguage] ??
          selectedCareerMission.title.tr,
        decisionTitle: decision.title[uiLanguage] ?? decision.title.tr,
        decisionScenario: decision.scenario[uiLanguage] ?? decision.scenario.tr,
        selectedOption: selectedOption.label[uiLanguage] ?? selectedOption.label.tr,
        selectedEffect: selectedOption.effect[uiLanguage] ?? selectedOption.effect.tr,
        childReason: careerDecisionReasons[decision.id] || "",
        traitProfile: careerTraitProfile,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "AI mentor reflection could not be generated."
            : "AI mentor reflection üretilemedi.")
      );
    }

    setCareerMentorReflections((current) => ({
      ...current,
      [decision.id]: String(data?.reflection || "").trim(),
    }));
    setCareerMentorReflectionCounts((current) => ({
      ...current,
      [decision.id]: (current[decision.id] || 0) + 1,
    }));
  } catch (err: any) {
    setCareerMentorReflectionError(
      err?.message ||
        (uiLanguage === "en"
          ? "AI mentor reflection could not be generated."
          : "AI mentor reflection üretilemedi.")
    );
  } finally {
    setCareerMentorReflectionLoadingId("");
  }
};

const handleListCareerSessions = async () => {
  try {
    setCareerSessionsLoading(true);
    setCareerSessionsError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.access_token) {
      throw new Error(
        uiLanguage === "en"
          ? "Please sign in before loading Career Lab sessions."
          : "Career Lab oturumlarını yüklemeden önce lütfen giriş yap."
      );
    }

    const response = await fetch("/api/career-sessions?limit=20", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "Career Lab sessions could not be listed."
            : "Career Lab oturumları listelenemedi.")
      );
    }

    setCareerSavedSessions(Array.isArray(data?.sessions) ? data.sessions : []);
  } catch (err: any) {
    setCareerSessionsError(
      err?.message ||
        (uiLanguage === "en"
          ? "Career Lab sessions could not be listed."
          : "Career Lab oturumları listelenemedi.")
    );
  } finally {
    setCareerSessionsLoading(false);
  }
};

const handleDeleteCareerSession = async (sessionId: string) => {
  const confirmed = window.confirm(
    uiLanguage === "en"
      ? "Delete this Career Lab session? This cannot be undone."
      : "Bu Career Lab oturumu silinsin mi? Bu işlem geri alınamaz."
  );

  if (!confirmed) return;

  try {
    setCareerSessionLoadLoading(true);
    setCareerSessionsError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.access_token) {
      throw new Error(
        uiLanguage === "en"
          ? "Please sign in before deleting a Career Lab session."
          : "Career Lab oturumu silmeden önce lütfen giriş yap."
      );
    }

    const response = await fetch(`/api/career-sessions?id=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "Career Lab session could not be deleted."
            : "Career Lab oturumu silinemedi.")
      );
    }

    setCareerSavedSessions((current) => current.filter((session) => session.id !== sessionId));

    if (savedCareerSessionId === sessionId) {
      setSavedCareerSessionId("");
      setCareerSessionSaveSuccess("");
    }
  } catch (err: any) {
    setCareerSessionsError(
      err?.message ||
        (uiLanguage === "en"
          ? "Career Lab session could not be deleted."
          : "Career Lab oturumu silinemedi.")
    );
  } finally {
    setCareerSessionLoadLoading(false);
  }
};

const handleLoadCareerSession = async (sessionId: string) => {
  try {
    setCareerSessionLoadLoading(true);
    setCareerSessionsError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.access_token) {
      throw new Error(
        uiLanguage === "en"
          ? "Please sign in before loading a Career Lab session."
          : "Career Lab oturumu yüklemeden önce lütfen giriş yap."
      );
    }

    const response = await fetch(`/api/career-sessions?id=${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data?.ok || !data?.session) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "Career Lab session could not be loaded."
            : "Career Lab oturumu yüklenemedi.")
      );
    }

    const loaded = data.session;
    const professionKey = loaded.profession_key as CareerProfessionKey;
    const loadedSnapshot =
      loaded.session_snapshot && typeof loaded.session_snapshot === "object"
        ? loaded.session_snapshot
        : {};

    setSelectedCareerProfession(professionKey);
    setCareerDecisionAnswers(
      loaded.decision_answers && typeof loaded.decision_answers === "object"
        ? loaded.decision_answers
        : {}
    );
    setCareerDecisionReasons(
      loadedSnapshot?.decisionReasons && typeof loadedSnapshot.decisionReasons === "object"
        ? loadedSnapshot.decisionReasons
        : {}
    );
    setCareerMentorReflections(
      loadedSnapshot?.mentorReflections && typeof loadedSnapshot.mentorReflections === "object"
        ? loadedSnapshot.mentorReflections
        : {}
    );
    setCareerMentorReflectionCounts(
      loadedSnapshot?.mentorReflectionCounts && typeof loadedSnapshot.mentorReflectionCounts === "object"
        ? loadedSnapshot.mentorReflectionCounts
        : {}
    );
    setCareerFollowUpAnswers(
      loadedSnapshot?.followUpAnswers && typeof loadedSnapshot.followUpAnswers === "object"
        ? loadedSnapshot.followUpAnswers
        : {}
    );
    setSavedCareerSessionId(loaded.id || "");
    setCareerAiNarrativeReport(loaded.ai_narrative_report || "");
    setCareerAiNarrativeError("");
    setCareerSessionSaveSuccess(
      uiLanguage === "en"
        ? "Career Lab session loaded."
        : "Career Lab oturumu yüklendi."
    );
  } catch (err: any) {
    setCareerSessionsError(
      err?.message ||
        (uiLanguage === "en"
          ? "Career Lab session could not be loaded."
          : "Career Lab oturumu yüklenemedi.")
    );
  } finally {
    setCareerSessionLoadLoading(false);
  }
};

const handleSaveCareerSession = async () => {
  try {
    setCareerSessionSaveLoading(true);
    setCareerSessionSaveError("");
    setCareerSessionSaveSuccess("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.access_token) {
      throw new Error(
        uiLanguage === "en"
          ? "Please sign in before saving a Career Lab session."
          : "Career Lab oturumunu kaydetmeden önce lütfen giriş yap."
      );
    }

    const sessionSnapshot = JSON.parse(careerEnrichedSessionSnapshotJson);
    const cinematicBlueprint = JSON.parse(JSON.stringify(careerCinematicRecapBlueprint));

    const response = await fetch("/api/career-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        id: savedCareerSessionId || undefined,
        child_id: selectedChild?.id || null,
        profession_key: selectedCareerProfession,
        profession_title:
          selectedCareerProfessionConfig.title[uiLanguage] ??
          selectedCareerProfessionConfig.title.tr,
        mission_title:
          selectedCareerMission.title[uiLanguage] ??
          selectedCareerMission.title.tr,
        language: uiLanguage === "en" ? "en" : "tr",
        status: isCareerMissionComplete ? "completed" : "draft",
        decision_answers: careerDecisionAnswers,
        trait_profile: careerTraitProfile,
        session_snapshot: sessionSnapshot,
        final_report_markdown: careerFinalReportMarkdown,
        ai_narrative_report: careerAiNarrativeReport || null,
        cinematic_recap_blueprint: cinematicBlueprint,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          (uiLanguage === "en"
            ? "Career Lab session could not be saved."
            : "Career Lab oturumu kaydedilemedi.")
      );
    }

    setSavedCareerSessionId(data?.session?.id || "");
    setCareerSessionSaveSuccess(
      uiLanguage === "en"
        ? "Career Lab session saved."
        : "Career Lab oturumu kaydedildi."
    );
  } catch (err: any) {
    setCareerSessionSaveError(
      err?.message ||
        (uiLanguage === "en"
          ? "Career Lab session could not be saved."
          : "Career Lab oturumu kaydedilemedi.")
    );
  } finally {
    setCareerSessionSaveLoading(false);
  }
};

const handleResetCareerMission = () => {
    setCareerDecisionAnswers({});
    setCareerAiNarrativeReport("");
    setCareerAiNarrativeError("");
    setCareerAiNarrativeMeta(null);
    setCareerAiNarrativeGenerationCount(0);
    setCareerSessionSaveError("");
    setCareerSessionSaveSuccess("");
    setSavedCareerSessionId("");
    setCareerMentorReflections({});
    setCareerMentorReflectionError("");
    setCareerDecisionReasons({});
    setCareerMentorReflectionCounts({});
    setCareerFollowUpAnswers({});
    setError("");
  };
  const handleCopyCareerSnapshot = async () => {
    if (!careerSessionSnapshotJson) return;

    try {
      await navigator.clipboard.writeText(careerSessionSnapshotJson);
      setError("");
    } catch (e) {
      setError(uiLanguage === "en" ? "Could not copy the session snapshot." : "Oturum çıktısı kopyalanamadı.");
    }
  };

  const handleDownloadCareerSnapshot = () => {
    if (!careerSessionSnapshotJson) return;

    const blob = new Blob([careerSessionSnapshotJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeProfession = selectedCareerProfession.replace(/[^a-z0-9_-]/gi, "-");
    anchor.href = url;
    anchor.download = `velto-career-lab-${safeProfession}-session.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
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

  const getProjectFlowLabel = (project: any) => {
    const projectFlowType = project?.flow_type || "storyverse";

    if (projectFlowType === "creator_lab") {
      return "Creator Lab";
    }

    if (projectFlowType === "career_lab") {
      return "Career Lab";
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
    const videoUrls = scenes
      .filter((scene) => scene.videoUrl && scene.videoStatus === "done")
      .map((scene) => scene.videoUrl as string);

    if (videoUrls.length < 2) {
      setError("Final video oluşturmak için en az 2 hazır sahne videosu gerekir.");
      return;
    }

    try {
      setIsExportingMovie(true);
      setError("");
      setSaveMessage("");

      const response = await fetch("/api/stitch-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrls }),
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

  const clearSceneTimingData = (sceneId: number) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              timing: buildSceneTiming(0, 0),
            }
          : scene
      )
    );
  };

  const clearAllSceneTimingData = () => {
    setScenes((prev) =>
      prev.map((scene) => ({
        ...scene,
        timing: buildSceneTiming(0, 0),
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

    const timing = buildSceneTiming(narrationDuration, dialogueDuration);

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

  const getNarratorSettingsKey = (settings: NarratorSettings) => {
  return [
    settings.voiceId || "",
    settings.modelId,
    settings.stability,
    settings.similarityBoost,
    settings.style ?? "",
    settings.speed ?? "",
  ].join("-");
};

  const getSceneAudioStatus = (scene: Scene) => {
    const currentSettingsKey = getNarratorSettingsKey(narratorSettings);

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
        timing: buildSceneTiming(0, scene.timing?.dialogueDuration || 0),
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
              timing: buildSceneTiming(scene.timing?.narrationDuration || 0, 0),
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
        timing: buildSceneTiming(scene.timing?.narrationDuration || 0, 0),
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

  const getSafeCharactersForImagePrompt = () => {
    return characters.slice(0, 6).map((character) => ({
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

  const generateSceneImage = async (
    scene: Pick<Scene, "id" | "text" | "cameraDirection" | "emotion" | "motionHint">,
    options?: {
      isHookScene?: boolean;
      isThumbnail?: boolean;
      premiumVisualMode?: boolean;
      imageUseCase?: "scene" | "thumbnail" | "hook";
    }
  ) => {
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
        title: limitForImagePrompt(title, 160),
        sceneText: safeScene.text,
        cameraDirection: safeScene.cameraDirection,
        emotion: safeScene.emotion,
        motionHint: safeScene.motionHint,
        characters: getSafeCharactersForImagePrompt(),
        visualBible: getSafeVisualBibleForImagePrompt(),
        isHookScene,
        isThumbnail,
        premiumVisualMode,
        imageUseCase,
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
    audioSourceText: string
  ) => {
    const currentSettingsKey = getNarratorSettingsKey(narratorSettings);

    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              audioUrl,
              audioPath,
              audioSourceText,
              audioSettingsKey: currentSettingsKey,
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
              timing: buildSceneTiming(0, scene.timing?.dialogueDuration || 0),
            }
          : scene
      )
    );
  };

  const getSceneAudioUrl = async (scene: Scene) => {
    const currentSettingsKey = getNarratorSettingsKey(narratorSettings);

    if (
      scene.audioUrl &&
      scene.audioSourceText &&
      scene.audioSourceText === scene.narration &&
      scene.audioSettingsKey === currentSettingsKey
    ) {
      return scene.audioUrl;
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
        language, // 🔥 EKLENDİ
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
      data.audioSourceText
    );

    await refreshSceneTiming(scene.id, {
      audioUrl: data.audioUrl,
      dialogueAudioUrl: scene.dialogueAudioUrl,
    });

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
    const currentSettingsKey = getNarratorSettingsKey(narratorSettings);

    if (
      scene.dialogueAudioUrl &&
      scene.dialogueAudioSourceText &&
      scene.dialogueAudioSourceText === scene.dialogue &&
      scene.dialogueAudioSettingsKey === currentSettingsKey
    ) {
      return scene.dialogueAudioUrl;
    }

    const lines = parseDialogueLines(scene.dialogue);

    if (lines.length === 0) {
      throw new Error("Bu sahnede diyalog üretilecek içerik bulunamadı.");
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
        language, // 🔥 EKLENDİ
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

    await refreshSceneTiming(scene.id, {
      audioUrl: scene.audioUrl,
      dialogueAudioUrl: data.audioUrl,
    });

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
            throw new Error("Runway video URL dönmedi.");
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

  const handleGenerateVideo = async (sceneId: number) => {
    const scene = scenes.find((s) => s.id === sceneId);

    if (!scene) {
      setError("Sahne bulunamadı.");
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
          imageUrl: scene.image,
          text: scene.text,
          motionHint: scene.motionHint,
          cameraDirection: scene.cameraDirection,
          emotion: scene.emotion,
          duration: scene.timing?.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS,
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

    if (!selectedChildId) {
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
        childId: selectedChildId,
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
          throw new Error("Runway video URL dönmedi.");
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
        imageUrl: scene.image,
        text: scene.text,
        motionHint: scene.motionHint,
        cameraDirection: scene.cameraDirection,
        emotion: scene.emotion,
        duration: scene.timing?.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS,
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
            }
          : item
      )
    );

    return {
      videoUrl,
      videoJobId: data.taskId as string,
    };
  };

  const stopBatchRender = () => {
    batchRenderCancelRef.current = true;
    setIsBatchRendering(false);
    setSaveMessage(uiLanguage === "en" ? "Batch render stop requested." : "Batch render durdurma isteği alındı.");
  };

  const startBatchRender = async () => {
    if (scenes.length === 0) {
      setError("Önce sahneleri oluşturmalısın.");
      return;
    }

    if (!selectedChildId) {
      setError("Lütfen önce bir çocuk seç.");
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

          updateBatchRenderItem(scene.id, {
            status: "processing",
            step: "video",
            message: uiLanguage === "en" ? "Generating video..." : "Video üretiliyor...",
          });

          const shouldGenerateVideo = !scene.videoUrl || scene.videoStatus !== "done";

          if (shouldGenerateVideo) {
            const videoResult = await generateSceneVideoAndWait(scene);
            scene = {
              ...scene,
              videoUrl: videoResult.videoUrl,
              videoStatus: "done",
              videoJobId: videoResult.videoJobId,
            };
            workingScenes[index] = scene;
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

          updateBatchRenderItem(scene.id, {
            status: "processing",
            step: "video",
            message: uiLanguage === "en" ? "Retry: generating video..." : "Retry: video üretiliyor...",
          });

          const videoResult = await generateSceneVideoAndWait(scene);
          scene = {
            ...scene,
            videoUrl: videoResult.videoUrl,
            videoStatus: "done",
            videoJobId: videoResult.videoJobId,
          };
          workingScenes[index] = scene;

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

  const handleExportMovie = async (forceRebuild = false) => {
    const exportScenes = scenes.filter(
      (scene) => getSceneExportSource(scene) !== "none"
    );

    if (exportScenes.length === 0) {
      setError("Film oluşturmak için en az bir görsel veya hazır video içeren sahne gerekli.");
      return;
    }

    if (!exportApiBase) {
      setError("Export servisi URL'i tanımlı değil. Vercel ortam değişkenlerinde NEXT_PUBLIC_EXPORT_API_URL eklenmeli.");
      return;
    }

    const currentSignature = buildExportSignature(title, scenes);

    if (!forceRebuild && exportedMovieUrl && exportSignature === currentSignature) {
      setError("");
      setSaveMessage(ui.movieCreated);

      if (typeof window !== "undefined") {
        window.open(exportMovieResult?.downloadUrl || exportedMovieUrl, "_blank", "noopener,noreferrer");
      }

      return;
    }

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
          scenes: exportScenes.map((scene) => {
            const timing = scene.timing || buildSceneTiming(0, 0);
            const normalizedTarget = Math.min(
              Math.max(
                timing.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS,
                TARGET_SCENE_DURATION_SECONDS
              ),
              MAX_SCENE_DURATION_SECONDS
            );

            return {
              ...scene,
              exportSource: getSceneExportSource(scene),
              videoUrl: getSceneExportSource(scene) === "video" ? scene.videoUrl : "",
              timing: {
                ...timing,
                targetSceneDuration: normalizedTarget,
                maxSpeechDuration: Number(
                  (normalizedTarget * getActiveMaxSpeechRatio()).toFixed(2)
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
            childId: selectedChildId,
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

    if (!selectedChildId) {
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
        childId: selectedChildId,
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

    if (!selectedChildId) {
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
      setCharacters(withDefaultGuideCharacter(project.characters));
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
        characters: Array.isArray(project.characters)
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

  const getCreatorCountryLabel = () => {
    return (
      CREATOR_COUNTRY_OPTIONS.find((option) => option.value === creatorCountry)?.label ||
      creatorCountry
    );
  };

  const getCreatorFormatLabel = () => {
    return (
      CREATOR_FORMAT_OPTIONS.find((option) => option.value === creatorFormat)?.label ||
      creatorFormat
    );
  };

  const getCreatorDurationLabel = () => {
    return (
      CREATOR_DURATION_OPTIONS.find(
        (option) => option.value === creatorVideoDurationSec
      )?.label || `${creatorVideoDurationSec} sec`
    );
  };

  const getCreatorSceneCount = () => {
    return getCreatorSceneCountByDuration(creatorVideoDurationSec);
  };

  const applyPatternRecommendedDuration = () => {
    const recommended = youtubePatternSummary?.recommendedDurationSec;

    if (!recommended) {
      return;
    }

    if (recommended <= 75) {
      setCreatorVideoDurationSec(60);
      return;
    }

    if (recommended <= 120) {
      setCreatorVideoDurationSec(90);
      return;
    }

    if (recommended <= 220) {
      setCreatorVideoDurationSec(180);
      return;
    }

    setCreatorVideoDurationSec(300);
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

    if (!selectedChildId) {
      setError("Lütfen önce bir çocuk seç.");
      return;
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
          language,
          youtubeData: youtubeResearchVideos,
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
          sceneCount: getCreatorSceneCount(),
          language,
          mentorAnalysis: nextMentorResult,
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
      const nextCharacters = withDefaultGuideCharacter(
        Array.isArray(nextPackage.characters)
          ? nextPackage.characters.map((character: Character) => ({
              ...character,
              voiceId: character.voiceId || "",
            }))
          : []
      );
      const nextVisualBible = nextPackage.visualBible || emptyVisualBible;

      setCreatorProductionPackage(nextPackage);
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
      // Scene-based thumbnail selection is intentionally used to avoid extra AI image cost.
      // A thumbnail will be selected manually or automatically from generated scene images.
      const nextThumbnail: YoutubeThumbnailResult | null = null;
      setYoutubeThumbnailResult(null);
      setYoutubeThumbnailLoading(false);

      // 5) AI cost optimization
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
          childId: selectedChildId,
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
          language,
          youtubeData: youtubeResearchVideos,
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
          sceneCount: getCreatorSceneCount(),
          language,
          mentorAnalysis: creatorMentorResult,
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
      setRefinedCreatorScenes([]);

      setStorySetup({
        title: nextPackage.title || "",
        storyPremise: nextPackage.storyPremise || "",
        characters: withDefaultGuideCharacter(
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
        withDefaultGuideCharacter(
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
          thumbnail: youtubeThumbnailResult,
          scenes,
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
      `Create a premium 16:9 YouTube thumbnail for a kids curiosity video titled: ${packageTitle}`,
      packageHook ? `Core hook: ${packageHook}` : "",
      recommendedTitle ? `YouTube title: ${recommendedTitle}` : "",
      thumbnailIdea ? `Thumbnail idea: ${thumbnailIdea}` : "",
      thumbnailTextIdeas ? `Raw text ideas to simplify: ${thumbnailTextIdeas}` : "",
      `Use this short thumbnail headline concept only: ${shortHeadline}`,
      "Show Joe, the recurring 10-year-old guide character, very close to camera with a huge shocked / amazed / no-way expression.",
      "Use one oversized focal object related to the topic on the opposite side of the frame.",
      "Make the image feel like a scroll-stopping YouTube thumbnail, not an educational poster or infographic.",
      "Use bold contrast, cinematic lighting, large readable shapes, bright kid-friendly colors, strong depth, and premium animated movie style.",
      "Leave clean empty space for a short headline overlay. Prefer no rendered text inside the image; if text appears, use only the short headline.",
      "Avoid multi-line text, subtitles, poster layout, labels, arrows, clutter, tiny details, scary imagery, or confusing composition.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const generatePremiumYoutubeThumbnailImage = async () => {
    const thumbnailPrompt = buildPremiumThumbnailPrompt();

    const imageRes = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
        characters: getSafeCharactersForImagePrompt(),
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

        for (const scene of packageScenes) {
          try {
            const image = await generateSceneImage(scene);

            setScenes((prev) =>
              prev.map((s) => (s.id === scene.id ? { ...s, image } : s))
            );
          } catch (imageError) {
            console.error("creator package scene image error:", imageError);
          }
        }
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
    if (!title || !visualBible || characters.length === 0) {
      setError("Önce hikaye kurulumu tamamlanmalı.");
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

  return (
    <WorldProvider>
      <StoryverseShell>
        <WorldFocusRouter />
        <main className="relative min-h-screen overflow-hidden px-3 py-6 text-slate-900 sm:px-4 md:px-6 md:py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_6%,#ffdff1_0%,transparent_30%),radial-gradient(circle_at_88%_10%,#d6f5ff_0%,transparent_34%),radial-gradient(circle_at_52%_88%,#fff0b8_0%,transparent_38%),radial-gradient(circle_at_16%_78%,#dcfff5_0%,transparent_28%),linear-gradient(180deg,#fffaf4_0%,#f7fbff_48%,#f4fff8_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="pointer-events-none fixed left-1/2 top-36 -z-10 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-white/35 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-72 w-full bg-gradient-to-t from-white/55 to-transparent" />
      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-6 sm:space-y-8 md:space-y-12">
        {/* X.1.B.2: Creator Lab shell foundation is available for creator-specific render activation. */}
        {isStoryverseFlow ? (
          <StoryverseCinematicIntro />
        ) : null}

        {isCreatorLabFlow ? (
          <CreatorStudioIntro />
        ) : null}

        {isCareerLabFlow ? (
          <CareerMentorIntro />
        ) : null}

        {isStoryverseFlow ? <FocusedWorldWorkspace /> : null}

        {!isStoryverseFlow && !isCreatorLabFlow && !isCareerLabFlow ? (
          <WorldGateway
            flows={experienceFlows}
            activeFlowKey={activeFlowKey}
            language={uiLanguage}
            onSelectFlow={setSelectedFlowKey}
          />
        ) : null}

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
      disabled={isExportingMovie || readyExportCount === 0}
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

        {userRole === "admin" && !isStoryverseFlow && !isCareerLabFlow && (
          <div className="rounded-[28px] border border-yellow-400/30 bg-yellow-500/10 p-4 text-amber-700">
            {ui.adminMode}
          </div>
        )}

        {userRole === "parent" && !isStoryverseFlow && !isCareerLabFlow && (
          <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-4 text-sky-700">
            {ui.parentMode}
          </div>
        )}

        <div className={`${isStoryverseFlow || isCreatorLabFlow || isCareerLabFlow ? "hidden" : ""} rounded-[28px] border border-sky-200 bg-sky-50/80 p-4 text-sky-800`}>
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

        {isCareerLabFlow && (
          <section className="rounded-[32px] border border-violet-300/20 bg-violet-50/800/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.24em] text-violet-700">
                  {uiLanguage === "en" ? "Future Mission Experience" : "Gelecek Görevi Deneyimi"}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">
                  {uiLanguage === "en" ? "Step into a living career mission" : "Yaşayan bir kariyer görevine adım at"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-violet-700/90 md:text-base">
                  {uiLanguage === "en"
                    ? "Choose a future role first, then enter a cinematic mission where every decision shapes your mentor reflection."
                    : "Önce gelecekteki rolünü seç, ardından her kararın mentor yansımanı şekillendirdiği sinematik bir göreve gir."}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <h3 className="text-lg font-semibold text-slate-900">
                {uiLanguage === "en" ? "Choose your future role" : "Gelecekteki rolünü seç"}
              </h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {CAREER_LAB_PROFESSIONS.map((profession) => {
                  const isSelected = profession.key === selectedCareerProfession;

                  return (
                    <button
                      key={profession.key}
                      type="button"
                      onClick={() => { setSelectedCareerProfession(profession.key); setCareerDecisionAnswers({}); }}
                      className={`rounded-[28px] border p-4 text-left transition ${
                        isSelected
                          ? "border-violet-300/60 bg-violet-400/20 shadow-[0_0_0_1px_rgba(196,181,253,0.25)]"
                          : "border-orange-200/24 bg-white/74 hover:border-violet-300/30 hover:bg-white/78"
                      }`}
                    >
                      <div className="text-2xl">{profession.icon}</div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {profession.title[uiLanguage] ?? profession.title.tr}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {profession.subtitle[uiLanguage] ?? profession.subtitle.tr}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <CareerMissionIntro
                professionKey={selectedCareerProfession}
                professionTitle={selectedCareerProfessionConfig.title[uiLanguage] ?? selectedCareerProfessionConfig.title.tr}
                missionTitle={selectedCareerMission.title[uiLanguage] ?? selectedCareerMission.title.tr}
                missionBriefing={selectedCareerMission.briefing[uiLanguage] ?? selectedCareerMission.briefing.tr}
                missionObjective={selectedCareerMission.objective[uiLanguage] ?? selectedCareerMission.objective.tr}
                language={uiLanguage === "en" ? "en" : "tr"}
                answeredCount={answeredCareerDecisionCount}
                totalCount={selectedCareerMission.decisionPoints.length}
                isComplete={isCareerMissionComplete}
              />
            </div>

            <div className="mt-7">
              <CareerMissionChat
                language={uiLanguage === "en" ? "en" : "tr"}
                professionKey={selectedCareerProfession}
                professionTitle={selectedCareerProfessionConfig.title[uiLanguage] ?? selectedCareerProfessionConfig.title.tr}
                missionTitle={selectedCareerMission.title[uiLanguage] ?? selectedCareerMission.title.tr}
                missionBriefing={selectedCareerMission.briefing[uiLanguage] ?? selectedCareerMission.briefing.tr}
                missionObjective={selectedCareerMission.objective[uiLanguage] ?? selectedCareerMission.objective.tr}
                mentorName={
                  selectedCareerProfession === "astronaut"
                    ? "Commander Orion"
                    : selectedCareerProfession === "doctor"
                      ? "Dr. Lyra"
                      : selectedCareerProfession === "cyber_detective"
                        ? "Detective Nyx"
                        : selectedCareerProfession === "pilot"
                          ? "Captain Nova"
                          : "Mentor Ada"
                }
              />
            </div>

            {answeredCareerDecisionCount > 0 && (
              <div className="mt-6 rounded-[28px] border border-teal-200 bg-teal-50/80 p-5 text-sm text-teal-800">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-700">
                {uiLanguage === "en" ? "Mission Memory" : "Görev hafızası"}
              </p>
              <h4 className="mt-3 text-lg font-semibold text-slate-900">
                {uiLanguage === "en" ? "Save this mission" : "Bu görevi kaydet"}
              </h4>
              <p className="mt-2 max-w-3xl leading-6 text-teal-800/85">
                {uiLanguage === "en"
                  ? "Save your mission choices, mentor notes and progress so you can continue the experience later."
                  : "Görev seçimlerini, mentor notlarını ve ilerlemeni kaydet; daha sonra aynı deneyime kaldığın yerden devam et."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={careerSessionSaveLoading}
                  onClick={handleSaveCareerSession}
                  className="rounded-2xl border border-teal-200 bg-emerald-400/15 px-4 py-2 text-xs font-semibold text-teal-800 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {careerSessionSaveLoading
                    ? (uiLanguage === "en" ? "Saving..." : "Kaydediliyor...")
                    : savedCareerSessionId
                      ? (uiLanguage === "en" ? "Update saved mission" : "Kayıtlı görevi güncelle")
                      : (uiLanguage === "en" ? "Save mission" : "Görevi kaydet")}
                </button>

                {savedCareerSessionId ? (
                  <span className="rounded-2xl border border-orange-200/24 bg-white px-3 py-2 text-xs text-teal-800/80">
                    ID: {savedCareerSessionId}
                  </span>
                ) : null}
              </div>

              {careerSessionSaveError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-red-400/10 p-3 text-xs text-rose-700">
                  {careerSessionSaveError}
                </div>
              ) : null}

              {careerSessionSaveSuccess ? (
                <div className="mt-4 rounded-2xl border border-teal-200 bg-white p-3 text-xs text-teal-800">
                  {careerSessionSaveSuccess}
                </div>
              ) : null}
              </div>
            )}

            <div className="mt-6 rounded-[28px] border border-blue-200 bg-white p-5 text-sm text-slate-800 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-blue-800">
                {uiLanguage === "en" ? "Continue later" : "Daha sonra devam et"}
              </p>
              <h4 className="mt-3 text-lg font-semibold text-slate-900">
                {uiLanguage === "en" ? "Continue a mission" : "Bir göreve devam et"}
              </h4>
              <p className="mt-2 max-w-3xl leading-6 text-slate-700">
                {uiLanguage === "en"
                  ? "Open saved missions only when you want to return to a previous experience."
                  : "Önceki bir deneyime dönmek istediğinde kayıtlı görevlerini aç."}
              </p>

              <button
                type="button"
                disabled={careerSessionsLoading}
                onClick={handleListCareerSessions}
                className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {careerSessionsLoading
                  ? (uiLanguage === "en" ? "Loading..." : "Yükleniyor...")
                  : (uiLanguage === "en" ? "Refresh missions" : "Kayıtlı oturumları yenile")}
              </button>

              {careerSessionsError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-red-400/10 p-3 text-xs text-rose-700">
                  {careerSessionsError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {careerSavedSessions.length > 0 ? (
                  careerSavedSessions.map((session) => (
                    <div key={session.id} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h5 className="font-semibold text-slate-900">
                            {session.profession_title || session.profession_key}
                          </h5>
                          <p className="mt-1 text-xs text-slate-600">
                            {session.mission_title} · {session.status} · {session.language?.toUpperCase?.()}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {session.updated_at ? new Date(session.updated_at).toLocaleString() : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={careerSessionLoadLoading}
                          onClick={() => handleLoadCareerSession(session.id)}
                          className="rounded-2xl border border-orange-200/24 bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/68 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uiLanguage === "en" ? "Load session" : "Oturumu yükle"}
                        </button>
                        <button
                          type="button"
                          disabled={careerSessionLoadLoading}
                          onClick={() => handleDeleteCareerSession(session.id)}
                          className="rounded-2xl border border-rose-200 bg-red-400/10 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uiLanguage === "en" ? "Delete session" : "Oturumu sil"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : null}
              </div>
            </div>


            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-green-300/20 bg-green-400/10 p-5 text-sm text-green-100">
                <p className="text-xs uppercase tracking-[0.22em] text-green-700">
                  {uiLanguage === "en" ? "Mission outcome" : "Görev sonucu"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerMissionOutcomeMap.title}
                </h4>
                <p className="mt-2 text-sm font-semibold text-green-100">
                  {careerMissionOutcomeMap.status}
                </p>
                <p className="mt-2 max-w-3xl leading-6 text-green-100/85">
                  {careerMissionOutcomeMap.summary}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {careerMissionOutcomeMap.outcomeCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-green-700">
                        {card.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {card.value}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-green-100/75">
                        {card.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-teal-200 bg-teal-50/80 p-5 text-sm text-teal-800">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-700">
                  {uiLanguage === "en" ? "Mission completed" : "Görev tamamlandı"}
                </p>
                <h4 className="mt-3 text-xl font-semibold text-slate-900">
                  {uiLanguage === "en"
                    ? "You did more than choose answers — you built a thinking journey."
                    : "Sadece cevap seçmedin — bir düşünme yolculuğu oluşturdun."}
                </h4>
                <p className="mt-3 max-w-4xl leading-6 text-teal-800/85">
                  {uiLanguage === "en"
                    ? "Your decisions, written reasons, follow-up answers, and mentor reflections now form a developmental output. This is not a career test; it is a simulation-based learning snapshot."
                    : "Kararların, yazılı gerekçelerin, takip cevapların ve mentor reflection çıktıların artık gelişimsel bir çıktıya dönüştü. Bu bir kariyer testi değil; simülasyon bazlı bir öğrenme anlık görüntüsüdür."}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-teal-700">
                      {uiLanguage === "en" ? "Decisions" : "Kararlar"}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {Object.keys(careerDecisionAnswers).length}/{selectedCareerMission.decisionPoints.length}
                    </p>
                    <p className="mt-1 text-xs text-teal-800/70">
                      {uiLanguage === "en" ? "Mission choices completed" : "Görev seçimleri tamamlandı"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-teal-700">
                      {uiLanguage === "en" ? "Reflection depth" : "Reflection derinliği"}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {Object.values(careerDecisionReasons).filter((value) => value?.trim()).length +
                        Object.values(careerFollowUpAnswers).filter((value) => value?.trim()).length}
                    </p>
                    <p className="mt-1 text-xs text-teal-800/70">
                      {uiLanguage === "en" ? "Written thinking inputs" : "Yazılı düşünme girdisi"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-teal-700">
                      {uiLanguage === "en" ? "AI mentor" : "AI mentor"}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {Object.values(careerMentorReflections).filter((value) => value?.trim()).length}
                    </p>
                    <p className="mt-1 text-xs text-teal-800/70">
                      {uiLanguage === "en" ? "Reflection outputs generated" : "Reflection çıktısı üretildi"}
                    </p>
                  </div>
                </div>
              </div>
            )}


            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-fuchsia-200 bg-white/88 p-5 text-sm text-slate-800 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-800">
                  {uiLanguage === "en" ? "Premium developmental report" : "Premium gelişim raporu"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerPremiumDevelopmentalReport.title}
                </h4>
                <p className="mt-1 text-sm text-pink-700">
                  {careerPremiumDevelopmentalReport.subtitle}
                </p>
                <p className="mt-3 max-w-4xl leading-6 text-slate-700">
                  {careerPremiumDevelopmentalReport.executiveSummary}
                </p>

                <div className="mt-4 grid gap-4">
                  {careerPremiumDevelopmentalReport.sections.map((section) => (
                    <div key={section.title} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <h5 className="font-semibold text-slate-900">
                        {section.title}
                      </h5>
                      <p className="mt-2 text-xs leading-5 text-slate-700">
                        {section.description}
                      </p>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-pink-700">
                        {section.items.slice(0, 5).map((item) => (
                          <li key={item} className="rounded-xl border border-orange-200/24 bg-white/62 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-xs leading-5 text-pink-700">
                  {careerPremiumDevelopmentalReport.closingNote}
                </div>
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-orange-200 bg-white/88 p-5 text-sm text-slate-800 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-orange-700">
                  {uiLanguage === "en" ? "Cognitive signals" : "Cognitive sinyaller"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerCognitivePatternSignals.title}
                </h4>
                <p className="mt-2 max-w-3xl leading-6 text-slate-700">
                  {careerCognitivePatternSignals.description}
                </p>
                <p className="mt-2 rounded-2xl border border-orange-200/24 bg-white/74 px-3 py-2 text-xs text-orange-100/80">
                  {careerCognitivePatternSignals.summary}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {careerCognitivePatternSignals.signals.map((signal, index) => (
                    <div
                      key={`${signal.label}-${index}`}
                      className="rounded-2xl border border-orange-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="font-semibold text-slate-900">
                            {signal.label}
                          </h5>
                          <p className="mt-2 text-xs leading-5 text-orange-100/75">
                            {signal.explanation}
                          </p>
                        </div>

                        <span className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1 text-[11px] uppercase tracking-[0.12em]">
                          {signal.confidence}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-purple-300/20 bg-purple-400/10 p-5 text-sm text-purple-100">
                <p className="text-xs uppercase tracking-[0.22em] text-violet-700">
                  {uiLanguage === "en" ? "Thinking journey" : "Düşünme yolculuğu"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerThinkingJourneyMap.title}
                </h4>
                <p className="mt-2 max-w-3xl leading-6 text-purple-100/85">
                  {careerThinkingJourneyMap.description}
                </p>
                <p className="mt-2 rounded-2xl border border-orange-200/24 bg-white/74 px-3 py-2 text-xs text-purple-100/80">
                  {careerThinkingJourneyMap.summary}
                </p>

                <div className="mt-4 grid gap-3">
                  {careerThinkingJourneyMap.steps.map((step, index) => (
                    <div key={`${step.decisionTitle}-${index}`} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-violet-700">
                            {uiLanguage === "en" ? "Step" : "Adım"} {index + 1}
                          </p>
                          <h5 className="mt-1 font-semibold text-slate-900">
                            {step.decisionTitle}
                          </h5>
                          <p className="mt-1 text-xs text-purple-100/75">
                            {step.selectedOption}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1">
                            {step.reasonStatus}
                          </span>
                          <span className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1">
                            {step.followUpStatus}
                          </span>
                          <span className="rounded-full border border-orange-200/24 bg-white/62 px-3 py-1">
                            {step.mentorStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-teal-300/20 bg-teal-400/10 p-5 text-sm text-teal-100">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-200">
                  {uiLanguage === "en" ? "Developmental output" : "Gelişimsel çıktı"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerDevelopmentalOutputSummary.title}
                </h4>
                <p className="mt-2 max-w-3xl leading-6 text-teal-100/85">
                  {careerDevelopmentalOutputSummary.summary}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {careerDevelopmentalOutputSummary.items.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-teal-200">
                        {item.label}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {item.value}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-teal-100/75">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-yellow-300/20 bg-yellow-400/10 p-5 text-sm text-yellow-100">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-700">
                  {uiLanguage === "en" ? "Adaptive learning path" : "Adaptif öğrenme yolu"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerAdaptiveNextChallenge.title}
                </h4>
                <p className="mt-2 max-w-3xl leading-6 text-yellow-100/85">
                  {careerAdaptiveNextChallenge.description}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                      {uiLanguage === "en" ? "Next challenge" : "Sonraki görev"}
                    </p>
                    <h5 className="mt-2 font-semibold text-slate-900">
                      {careerAdaptiveNextChallenge.challengeName}
                    </h5>
                    <p className="mt-2 text-xs leading-5 text-yellow-100/80">
                      {careerAdaptiveNextChallenge.challengeBrief}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                      {uiLanguage === "en" ? "Reflection focus" : "Reflection odağı"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-yellow-100/80">
                      {careerAdaptiveNextChallenge.focusQuestion}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                      {uiLanguage === "en" ? "Suggested mode" : "Önerilen mod"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-yellow-100/80">
                      {careerAdaptiveNextChallenge.suggestedMode}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {answeredCareerDecisionCount > 0 && (
              <div className="mt-6 rounded-[28px] border border-sky-200 bg-white/88 p-5 text-sm text-slate-800 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-sky-800">
                {uiLanguage === "en" ? "Mission reflection" : "Görev yansıması"}
              </p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">
                    {careerExperienceReportPreview.title}
                  </h4>
                  <p className="mt-1 text-slate-700">
                    {careerExperienceReportPreview.subtitle}
                  </p>
                  <p className="mt-3 leading-6 text-slate-700">
                    {careerExperienceReportPreview.summary}
                  </p>
                  <p className="mt-3 rounded-2xl border border-orange-200 bg-white px-3 py-2 text-xs text-slate-700">
                    {careerExperienceReportPreview.disclaimer}
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-200">
                      {uiLanguage === "en" ? "Mission choice highlights" : "Görev seçimi özetleri"}
                    </p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                      {careerExperienceReportPreview.decisionHighlights.length > 0 ? (
                        careerExperienceReportPreview.decisionHighlights.map((item) => (
                          <li key={item} className="rounded-xl border border-orange-200/24 bg-white/62 px-3 py-2">
                            {item}
                          </li>
                        ))
                      ) : (
                        <li className="rounded-xl border border-orange-200/24 bg-white/62 px-3 py-2">
                          {uiLanguage === "en" ? "No mission choice selected yet." : "Henüz karar seçilmedi."}
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-200">
                      {uiLanguage === "en" ? "Mentor signals" : "Mentor sinyalleri"}
                    </p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                      {careerExperienceReportPreview.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              </div>
            )}

            {answeredCareerDecisionCount > 0 && (
              <div className={`mt-6 rounded-[28px] border p-5 text-sm ${
              isCareerMissionComplete
                ? "border-teal-200 bg-teal-50/80 text-teal-800"
                : "border-slate-300/20 bg-slate-400/10 text-slate-800"
            }`}>
              <p className={`text-xs uppercase tracking-[0.22em] ${
                isCareerMissionComplete ? "text-teal-700" : "text-slate-600"
              }`}>
                {uiLanguage === "en" ? "Mission status" : "Görev durumu"}
              </p>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">
                    {isCareerMissionComplete
                      ? (uiLanguage === "en" ? "Mission completed" : "Görev tamamlandı")
                      : (uiLanguage === "en" ? "Mission in progress" : "Görev devam ediyor")}
                  </h4>
                  <p className="mt-2 max-w-3xl leading-6 opacity-90">
                    {isCareerMissionComplete
                      ? (uiLanguage === "en"
                          ? "All mission choices are complete. Your mentor can now prepare the final reflection."
                          : "Tüm görev kararları tamamlandı. Mentorun artık final yansımasını hazırlayabilir.")
                      : (uiLanguage === "en"
                          ? "Complete each mission decision to unlock the final mentor reflection."
                          : "Final mentor yansımasını açmak için tüm görev kararlarını tamamla.")}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-200/24 bg-white/74 px-4 py-3">
                  <p className="text-xs opacity-75">
                    {uiLanguage === "en" ? "Progress" : "İlerleme"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {answeredCareerDecisionCount}/{selectedCareerMission.decisionPoints.length}
                  </p>
                </div>
              </div>

              {isCareerMissionComplete && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] opacity-75">
                      {uiLanguage === "en" ? "Ready output" : "Hazır çıktı"}
                    </p>
                    <p className="mt-2 text-slate-900">
                      {uiLanguage === "en" ? "Mission Report" : "Görev Raporu"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] opacity-75">
                      {uiLanguage === "en" ? "Mentor reflection" : "Mentor yansıması"}
                    </p>
                    <p className="mt-2 text-slate-900">
                      {uiLanguage === "en" ? "Ready after completion" : "Tamamlanınca hazır"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] opacity-75">
                      {uiLanguage === "en" ? "Memory moment" : "Hafıza anı"}
                    </p>
                    <p className="mt-2 text-slate-900">
                      {uiLanguage === "en" ? "Cinematic recap" : "Sinematik özet"}
                    </p>
                  </div>
                </div>
              )}
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-fuchsia-200 bg-white/88 p-5 text-sm text-slate-800 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-800">
                  {uiLanguage === "en" ? "Final mission report" : "Final görev raporu"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerFinalReport.title}
                </h4>
                <div className="mt-4 grid gap-3">
                  {careerFinalReport.sections.map((section) => (
                    <div key={section.title} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <h5 className="font-semibold text-slate-900">
                        {section.title}
                      </h5>
                      <p className="mt-2 leading-6 text-slate-700">
                        {section.body}
                      </p>
                      {section.items && (
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
                          {section.items.map((item) => (
                            <li key={item} className="rounded-xl border border-orange-200/24 bg-white/62 px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCopyCareerReport}
                    className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/15 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-400/25"
                  >
                    {uiLanguage === "en" ? "Copy report" : "Raporu kopyala"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCareerReport}
                    className="rounded-2xl border border-orange-200/24 bg-white/74 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/68"
                  >
                    {uiLanguage === "en" ? "Download report" : "Raporu indir"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCareerMission}
                    className="rounded-2xl border border-orange-200/24 bg-white/62 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/68"
                  >
                    {uiLanguage === "en" ? "Restart mission" : "Görevi sıfırla"}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-xs leading-5 text-pink-700">
                  {uiLanguage === "en"
                    ? "This local report is now ready for the next sprint: downloadable report package or AI-enhanced narrative report."
                    : "Bu yerel rapor artık bir sonraki sprint için hazır: indirilebilir rapor paketi veya AI destekli anlatı raporu."}
                </div>
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-indigo-200 bg-indigo-400/10 p-5 text-sm text-indigo-700">
                <p className="text-xs uppercase tracking-[0.22em] text-indigo-700">
                  {uiLanguage === "en" ? "Cinematic recap blueprint" : "Sinematik özet planı"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerCinematicRecapBlueprint.title}
                </h4>
                <p className="mt-2 max-w-3xl leading-6 text-indigo-700/85">
                  {careerCinematicRecapBlueprint.description}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {careerCinematicRecapBlueprint.scenes.map((scene, index) => (
                    <div key={scene.title} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-indigo-700">
                        {uiLanguage === "en" ? "Recap scene" : "Özet sahnesi"} {index + 1}
                      </p>
                      <h5 className="mt-2 font-semibold text-slate-900">
                        {scene.title}
                      </h5>
                      <p className="mt-2 text-xs leading-5 text-indigo-700/80">
                        <span className="font-semibold">{uiLanguage === "en" ? "Visual" : "Görsel"}: </span>
                        {scene.visualDirection}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-indigo-700/80">
                        <span className="font-semibold">{uiLanguage === "en" ? "Narration" : "Anlatım"}: </span>
                        {scene.narration}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-orange-200/24 bg-white/74 p-3 text-xs leading-5 text-indigo-700/75">
                  {careerCinematicRecapBlueprint.productionNote}
                </div>
              </div>
            )}

            {isCareerMissionComplete && (
              <div className="mt-6 rounded-[28px] border border-teal-300/20 bg-teal-400/10 p-5 text-sm text-teal-100">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-200">
                  {uiLanguage === "en" ? "Pilot output package" : "Pilot çıktı paketi"}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {careerSimulationOutputPackage.title}
                </h4>
                <p className="mt-2 max-w-3xl leading-6 text-teal-100/85">
                  {careerSimulationOutputPackage.description}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {careerSimulationOutputPackage.items.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-orange-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h5 className="font-semibold text-slate-900">
                          {item.title}
                        </h5>
                        <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.16em] ${
                          item.status === "ready"
                            ? "border-teal-200 bg-teal-50/80 text-teal-800"
                            : "border-slate-300/20 bg-slate-400/10 text-slate-700"
                        }`}>
                          {item.status === "ready"
                            ? (uiLanguage === "en" ? "Ready" : "Hazır")
                            : (uiLanguage === "en" ? "Planned" : "Planlı")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-teal-100/80">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}


          
{isCareerMissionComplete && (
  <div className="mt-6 rounded-[28px] border border-sky-200 bg-sky-50/80 p-5 text-sm text-sky-800">
    <p className="text-xs uppercase tracking-[0.22em] text-sky-700">
      {uiLanguage === "en" ? "AI narrative generation" : "AI anlatı üretimi"}
    </p>

    <h4 className="mt-3 text-lg font-semibold text-slate-900">
      {uiLanguage === "en"
        ? "Career Lab AI Narrative Report"
        : "Career Lab AI Anlatı Raporu"}
    </h4>

    <p className="mt-2 max-w-3xl leading-6 text-sky-800/85">
      {uiLanguage === "en"
        ? "Turn the completed mission into a mentor-style reflection that feels personal, encouraging, and safe."
        : "Tamamlanan görevi kişisel, cesaretlendirici ve güvenli bir mentor anlatısına dönüştür."}
    </p>

    <button
      type="button"
      disabled={careerAiNarrativeLoading}
      onClick={handleGenerateCareerAiNarrativeReport}
      className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-2 text-xs font-semibold text-sky-800 transition hover:bg-sky-50/80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {careerAiNarrativeLoading
        ? (uiLanguage === "en" ? "Generating..." : "Üretiliyor...")
        : careerAiNarrativeReport
          ? (uiLanguage === "en"
              ? "Regenerate AI Narrative Report"
              : "AI Anlatı Raporunu Yeniden Üret")
          : (uiLanguage === "en"
              ? "Generate AI Narrative Report"
              : "AI Anlatı Raporu Üret")}
    </button>

    <div className="mt-3 rounded-2xl border border-sky-200 bg-white/74 px-3 py-2 text-xs leading-5 text-sky-800/75">
      {uiLanguage === "en"
        ? "Generate the final mentor reflection when the mission choices feel ready."
        : "Görev seçimleri hazır olduğunda final mentor yansımasını üret."}
      {careerAiNarrativeGenerationCount > 0 ? (
        <span className="ml-2 font-semibold text-slate-900">
          {uiLanguage === "en" ? "AI generation count" : "Üretim sayısı"}: {careerAiNarrativeGenerationCount}
        </span>
      ) : null}
    </div>

    {careerAiNarrativeError ? (
      <div className="mt-4 rounded-2xl border border-rose-200 bg-red-400/10 p-3 text-xs text-rose-700">
        {careerAiNarrativeError}
      </div>
    ) : null}

    {careerAiNarrativeReport ? (
      <div className="mt-4 rounded-2xl border border-orange-200/24 bg-white/74 p-4">
        <div className="mb-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopyCareerAiNarrativeReport}
            className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-2 text-xs font-semibold text-sky-800 transition hover:bg-sky-50/80"
          >
            {uiLanguage === "en" ? "Copy AI report" : "AI raporu kopyala"}
          </button>
          <button
            type="button"
            onClick={handleDownloadCareerAiNarrativeReport}
            className="rounded-2xl border border-orange-200/24 bg-white/62 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/68"
          >
            {uiLanguage === "en" ? "Download AI report" : "AI raporu indir"}
          </button>
        </div>
        {careerAiNarrativeMeta ? (
          <div className="mb-3 grid gap-2 rounded-2xl border border-orange-200/24 bg-white/62 p-3 text-xs text-sky-800/80 md:grid-cols-3">
            <div>
              <span className="font-semibold text-slate-900">{uiLanguage === "en" ? "Model" : "Model"}: </span>
              {careerAiNarrativeMeta.model || "-"}
            </div>
            <div>
              <span className="font-semibold text-slate-900">{uiLanguage === "en" ? "Generated" : "Üretim"}: </span>
              {careerAiNarrativeMeta.generatedAt
                ? new Date(careerAiNarrativeMeta.generatedAt).toLocaleString()
                : "-"}
            </div>
            <div>
              <span className="font-semibold text-slate-900">{uiLanguage === "en" ? "Tokens" : "Token"}: </span>
              {careerAiNarrativeMeta.usage?.total_tokens ??
                careerAiNarrativeMeta.usage?.totalTokens ??
                "-"}
            </div>
            {careerAiNarrativeMeta.safetyNote ? (
              <div className="md:col-span-3 rounded-xl border border-sky-200 bg-white/74 px-3 py-2">
                {careerAiNarrativeMeta.safetyNote}
              </div>
            ) : null}
          </div>
        ) : null}

        <pre className="overflow-auto whitespace-pre-wrap text-xs leading-6 text-sky-800/85">
          {careerAiNarrativeReport}
        </pre>
      </div>
    ) : null}
  </div>
)}
          </section>
        )}
        <div className={`${isCareerLabFlow ? "hidden" : ""} overflow-hidden rounded-[32px] border border-orange-200/24 bg-white/74 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.35)]`}>
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

        <div className={`${isCareerLabFlow ? "hidden" : ""} grid gap-10 xl:grid-cols-[280px_minmax(0,1fr)]`}>
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
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

        <div className="rounded-[28px] border border-orange-200/24 bg-white/62 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{selectedFlowProjectTitle}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {activeFlowKey === "creator_lab"
                  ? (uiLanguage === "en" ? "Only Creator Lab projects are shown." : "Yalnızca Creator Lab projeleri gösteriliyor.")
                  : activeFlowKey === "career_lab"
                    ? (uiLanguage === "en" ? "Only Career Lab projects are shown." : "Yalnızca Career Lab projeleri gösteriliyor.")
                    : (uiLanguage === "en" ? "Only Storyverse projects are shown." : "Yalnızca Storyverse projeleri gösteriliyor.")}
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
            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-4 text-sm text-slate-600">
              {ui.projectsLoading}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-4 text-sm text-slate-600">
              {ui.noProjects}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredProjects.map((project) => {
                const previewImage = getProjectPreviewImage(project);
                const projectStatus = getProjectStatusLabel(project);
                const flowLabel = getProjectFlowLabel(project);

                return (
                  <article
                    key={project.id}
                    className="overflow-hidden rounded-[28px] border border-orange-200/24 bg-white/74 transition hover:border-sky-200 hover:bg-white/78"
                  >
                    <div className="h-36 w-full overflow-hidden bg-white/74">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt={project.title || ui.untitledProject}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                          {uiLanguage === "en" ? "No Preview" : "Önizleme Yok"}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold leading-5 text-slate-900">
                          {project.title || ui.untitledProject}
                        </h3>

                        <span className="rounded-full border border-sky-200 bg-sky-50/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
                          {flowLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>{projectStatus}</span>
                        <span>
                          {project.updated_at
                            ? new Date(project.updated_at).toLocaleString()
                            : "-"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => loadProjectById(project.id)}
                          disabled={isLoadingProject}
                          className="rounded-2xl border border-orange-200/24 bg-white/68 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/74 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ui.open}
                        </button>

                        {project.exported_movie_url ? (
                          <a
                            href={project.exported_movie_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-cyan-400 px-3 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
                          >
                            {uiLanguage === "en" ? "Movie" : "Film"}
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-2xl border border-orange-200/24 bg-white/74 px-3 py-2 text-xs font-semibold text-slate-500"
                          >
                            {uiLanguage === "en" ? "No Movie" : "Film Yok"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[28px] border border-orange-200/24 bg-white/62 p-6">
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

          {isCreatorLabFlow && (
            <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-sky-700">
                  {ui.creatorMentor}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {ui.creatorStrategySetup}
                </h3>
                <p className="mt-2 text-sm leading-6 text-sky-800/80">
                  {ui.creatorMentorDesc}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.videoFormat}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    value={creatorFormat}
                    onChange={(e) => setCreatorFormat(e.target.value as CreatorFormat)}
                  >
                    {CREATOR_FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-sky-800">
                    {ui.creatorDurationTitle}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-orange-200/26 bg-white/82 p-3 text-black"
                    value={creatorVideoDurationSec}
                    onChange={(e) =>
                      setCreatorVideoDurationSec(
                        Number(e.target.value) as CreatorVideoDurationSec
                      )
                    }
                  >
                    {CREATOR_DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} / {option.sceneCount} {ui.sceneCountLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {isCreatorLabFlow && (
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
          )}

          {isCreatorLabFlow && (
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
          )}

{isCreatorLabFlow && (
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
          )}

          <label className="block text-sm font-medium text-slate-600">
  {getFlowAwareInputLabel()}
</label>

          <textarea
            className="min-h-36 w-full rounded-2xl border border-orange-200/26 bg-white/82 p-4 text-black placeholder:text-slate-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={getFlowAwarePlaceholder()}
          />

          {isCreatorLabFlow && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsAdvancedMode((prev) => !prev)}
                className="rounded-full border border-orange-200/24 bg-white/62 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-orange-200/26 hover:bg-white/68 hover:text-slate-900"
              >
                {isAdvancedMode ? "Hide Advanced Tools" : "Show Advanced Tools"}
              </button>
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
            {!isCreatorLabFlow && (
              <button
                onClick={createSetup}
                disabled={loadingSetup}
                className="rounded-2xl bg-white/82 px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
              >
                {loadingSetup ? ui.preparingSetup : ui.createCharacters}
              </button>
            )}

            {isCreatorLabFlow && isAdvancedMode && (
              <button
                onClick={createSetup}
                disabled={loadingSetup}
                className="rounded-2xl bg-white/82 px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
              >
                {creatorMentorLoading
                  ? ui.analyzingContentOpportunity
                  : ui.analyzeContentOpportunity}
              </button>
            )}

            {isCreatorLabFlow && (
              <button
                type="button"
                data-auto-mode-button="true"
                onClick={() => handleGenerateFullYoutubePackage()}
                disabled={isGeneratingFullYoutubePackage || loadingSetup || !input.trim()}
                className="rounded-2xl border border-purple-300/40 bg-purple-400 px-6 py-3 font-semibold text-slate-950 transition hover:scale-105 hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingFullYoutubePackage
                  ? ui.generatingFullYoutubePackage
                  : ui.generateFullYoutubePackage}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-rose-50/80 p-4 text-red-200">
            {error}
          </div>
        )}

        {saveMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 text-green-700">
            {saveMessage}
          </div>
        )}

        {currentProjectId && (
          <div className="rounded-2xl border border-orange-200/24 bg-white/62 p-4 text-sm text-slate-600">
            {ui.projectId}: <span className="font-mono">{currentProjectId}</span>
          </div>
        )}

        {isCreatorLabFlow && isAdvancedMode && creatorMentorResult && (
          <section className="rounded-[28px] border border-sky-200 bg-cyan-500/[0.08] p-5 text-sm text-slate-700">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-700">
                {ui.creatorMentor}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {ui.mentorAnalysisTitle}
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <h3 className="font-semibold text-slate-900">{ui.audienceInsight}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                  {creatorMentorResult.audienceInsight.map((item, index) => (
                    <li key={`audience-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <h3 className="font-semibold text-slate-900">{ui.hookPatterns}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                  {creatorMentorResult.hookPatterns.map((item, index) => (
                    <li key={`hook-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
              <h3 className="font-semibold text-slate-900">{ui.videoIdeas}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {creatorMentorResult.videoIdeas.map((idea, index) => (
                  <article
                    key={`${idea.title}-${index}`}
                    className="rounded-2xl border border-orange-200/24 bg-white/74 p-3"
                  >
                    <p className="font-semibold text-sky-800">
                      {index + 1}. {idea.title}
                    </p>
                    <p className="mt-2 leading-6 text-slate-600">{idea.concept}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[28px] border border-teal-200 bg-teal-50/80 p-4">
                <h3 className="font-semibold text-teal-800">
                  {ui.recommendedIdea}
                </h3>
                <p className="mt-3 font-semibold text-slate-900">
                  {creatorMentorResult.recommendedIdea.title}
                </p>
                <p className="mt-2 leading-6 text-emerald-50/85">
                  {creatorMentorResult.recommendedIdea.reason}
                </p>
              </div>

              <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                <h3 className="font-semibold text-slate-900">{ui.productionPlan}</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-600">
                  {creatorMentorResult.productionPlan.map((item, index) => (
                    <li key={`plan-${index}`}>{item}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-sky-200 bg-sky-50/80 p-4 text-sky-800">
              {ui.creatorProductionDesc}
            </div>

            <button
              type="button"
              onClick={handleCreatorProductionPackage}
              disabled={creatorProductionLoading}
              className="mt-5 w-full rounded-[28px] bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatorProductionLoading
                ? ui.convertingProductionPackage
                : ui.continueToProduction}
            </button>
          </section>
        )}

        {isCreatorLabFlow && creatorProductionPackage && (
          <section className="rounded-[28px] border border-teal-200 bg-emerald-500/[0.08] p-5 text-sm text-slate-700">
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

            <div className="mt-5 rounded-[28px] border border-sky-300/20 bg-sky-50/800/10 p-5">
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
                  <p className="mt-1 text-sm text-orange-100/75">
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
                  title / description / hashtags
                </div>
                <div className="rounded-2xl border border-orange-200/24 bg-white/74 p-3">
                  thumbnail.png + scenes.json
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-lime-300/20 bg-lime-500/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {ui.costOptimizationEngine}
                  </h3>
                  <p className="mt-1 text-sm text-lime-100/75">
                    {ui.costOptimizationDesc}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isAdvancedMode && (
                    <>
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
                    </>
                  )}

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
                <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
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
                    <div className="text-lime-100/60">{ui.estimatedCost}</div>
                    <div className="mt-1 text-xl font-semibold">
                      ${sceneOptimizationSummary.estimatedRunwayCostUsd.toFixed(2)}
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
                  {sceneOptimizationSummary.pricingBasis || ui.costPricingNote}
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
                        <span>${item.estimatedCostUsd.toFixed(2)}</span>
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
          </section>
        )}

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

        {setupReady && (
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
          <>
            <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
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
                disabled={isPreparingAudio || isPlayingStory || playingDialogueSceneId !== null}
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
                disabled={isExportingMovie || readyExportCount === 0}
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
                disabled={isExportingMovie || readyExportCount === 0}
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
                  (loadingAudioSceneId !== null && !isBatchRendering)
                }
                className="rounded-2xl bg-cyan-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
              >
                {isBatchRendering ? getBatchLabel("cancel") : getBatchLabel("start")}
              </button>

              {batchRenderItems.some((item) => item.status === "failed") && !isBatchRendering && (
                <button
                  onClick={() => retryFailedScenes()}
                  disabled={isPreparingAudio || isExportingMovie || playingDialogueSceneId !== null}
                  className="rounded-2xl bg-rose-600 px-6 py-3 font-semibold text-slate-900 transition hover:scale-105 disabled:opacity-50"
                >
                  {getBatchLabel("retryFailed")}
                </button>
              )}
              </div>
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
                              { label: "Image", ready: hasImage, pending: redrawLoadingId === scene.id },
                              { label: "Narration", ready: narrationReady, pending: loadingAudioSceneId === scene.id },
                              { label: "Dialogue", ready: dialogueReady, pending: loadingDialogueSceneId === scene.id && hasDialogue },
                              { label: "Video", ready: hasVideo, pending: scene.videoStatus === "processing" },
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
                                  {item.pending ? "Processing" : item.ready ? "Ready" : "Pending"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-orange-200/24 bg-white/74 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Quick actions</p>
                          <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={() => playNarration(scene.id, scene.narration)}
                        disabled={
                          loadingAudioSceneId === scene.id ||
                          isPreparingAudio ||
                          (isPlayingStory && playingSceneId !== scene.id) ||
                          playingDialogueSceneId !== null
                        }
                        className="rounded-xl border border-purple-400/40 bg-violet-50/80 px-4 py-2 text-sm text-purple-100 disabled:opacity-50"
                      >
                        {loadingAudioSceneId === scene.id
                          ? "Ses hazırlanıyor..."
                          : playingSceneId === scene.id
                          ? "Sesi Durdur"
                          : "Anlatıcıyı Dinle"}
                      </button>

                      <button
                        onClick={() => playSceneDialogue(scene)}
                        disabled={
                          loadingDialogueSceneId === scene.id ||
                          isPlayingStory ||
                          isPreparingAudio
                        }
                        className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-4 py-2 text-sm text-pink-100 disabled:opacity-50"
                      >
                        {loadingDialogueSceneId === scene.id
                          ? "Diyalog hazırlanıyor..."
                          : playingDialogueSceneId === scene.id
                          ? "Diyaloğu Durdur"
                          : "Karakter Diyaloğunu Dinle"}
                      </button>

                      <label className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-teal-50/80 px-3 py-2 text-xs text-teal-800">
                        <span>Export</span>
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
                        onClick={() => handleGenerateVideo(scene.id)}
                        disabled={scene.videoStatus === "processing" || !scene.image}
                        className="rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-100 disabled:opacity-50"
                      >
                        {scene.videoStatus === "processing"
                          ? ui.videoCreating
                          : ui.convertToVideo}
                      </button>

                      <button
                        onClick={() => {
                          setEditingSceneId(scene.id);
                          setBranchingSceneId(null);
                        }}
                        className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                      >
                        {ui.editScene}
                      </button>

                      <button
                        onClick={() => {
                          setBranchingSceneId(scene.id);
                          setEditingSceneId(null);
                        }}
                        className="rounded-xl border border-orange-200/26 px-4 py-2 text-sm"
                      >
                        {ui.branchAfterScene}
                      </button>

                      <button
                        onClick={() => redrawSceneImage(scene)}
                        disabled={redrawLoadingId === scene.id}
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
          </>
        )}
      </div>
        </div>
      </div>
        </main>
      </StoryverseShell>
    </WorldProvider>
  );
}