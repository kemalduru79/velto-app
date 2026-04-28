"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";
import { getFlowByKey, type FlowZone } from "../../lib/flows";
import { flowCardMessages } from "@/lib/i18n/flowCard";

type SceneTiming = {
  narrationDuration: number;
  dialogueDuration: number;
  totalAudioDuration: number;
  targetSceneDuration: number;
  maxSpeechDuration?: number;
  freezeDuration: number;
  needsFreezeFrame: boolean;
};

type Scene = {
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

const CREATOR_SCENE_CLIP_DURATION_SECONDS = 7;
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

const DEFAULT_VIDEO_DURATION_SECONDS = 8;
const TARGET_SCENE_DURATION_SECONDS = 8;
const MAX_SCENE_DURATION_SECONDS = 10;
const MIN_SCENE_DURATION_SECONDS = 6.5;
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
    workflow: "İş Akışı",
    studioRouteMap: "Stüdyo Yol Haritası",
    studioRouteMapDesc: "Bu ekran artık sadece üretim paneli değil; Experience Lab ve hızlı içerik üretimi için ortak akış merkezi.",
    nextSurface: "Sonraki Katman",
    quickContentMode: "Hızlı İçerik Modu",
    quickContentModeDesc: "Bir sonraki ürün katmanında bu stüdyonun üstüne hızlı YouTube içerik üretim modu gelecek. Bu ekran onun için çekirdek üretim altyapısıdır.",
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
    freezeRisk: "Freeze Riski",
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
    patternEngineTitle: "Pattern Engine",
    patternEngineDesc: "YouTube örneklerinden başlık, hook, süre, rekabet ve fırsat sinyallerini çıkarır.",
    patternEngineButton: "Pattern Engine Çalıştır",
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
    creatorDurationDesc: "Seçilen hedef süre, 7 saniyelik güvenli video kliplerine bölünerek üretilecek sahne sayısını belirler. Örn: 60 sn hedef ≈ 9 sahne.",
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
    studioBadge: "AI Story Studio",
    studioTitle: "VELTO",
    studioDescription: "A production studio that generates story, scenes, visuals, narrator voice, character dialogue, video, and final movie output in one flow. This screen is no longer just a development panel; it is designed as the shared production core of AI Experience Lab.",
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
    workflow: "Workflow",
    studioRouteMap: "Studio Route Map",
    studioRouteMapDesc: "This screen is no longer only a production panel; it is the shared flow hub for Experience Lab and fast content creation.",
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
    contentLanguageHint: "The selected language controls the generation language for story, narration, dialogue, and continuation scenes.",
    turkish: "Türkçe",
    english: "English",
    storyPromptLabel: "What kind of cartoon / story do you want to create in Storyverse?",
    storyPromptPlaceholder: "Example: A curious child by the sea discovers a lost star map",
    genericPromptLabel: "What kind of experience do you want to start for this flow?",
    genericPromptPlaceholder: "Example: A short, safe experience flow where the child makes choices",
    preparingSetup: "Preparing setup...",
    createCharacters: "Create Characters",
    studioSnapshot: "Studio Snapshot",
    setupReady: "Setup ready",
    setupWaiting: "Setup waiting",
    studioSnapshotDesc: "Once the characters and visual world are ready, you can continue to story production.",
    dialogueLayer: "Dialogue Layer",
    sceneCountLabel: "scenes",
    dialogueLayerDesc: "Number of scenes with prepared character voices.",
    freezeRisk: "Freeze Risk",
    freezeRiskDesc: "Scenes where the video duration may not carry the audio flow comfortably.",
    quickModePrep: "Quick Mode Preparation",
    activePlan: "Active plan",
    quickModePrepDesc: "This screen will later branch into a fast YouTube production mode.",
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
    creatorMentorDesc: "This mode guides the AI to think like a content strategist before generating scenes. YouTube Data API integration is planned for Phase 2; this MVP uses the mentor analysis layer first.",
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
    productionPackageNote: "After this package is prepared, you can continue with the existing Storyverse production engine for characters, scenes, visuals, audio, and video.",
    refineScenes: "Refine Scenes with AI",
    refiningScenes: "Refining scenes...",
    refinedScenesReady: "Scenes refined with AI ✅",
    refinedScenesNote: "Refined scenes are ready. You can now continue to scene production.",
    youtubeResearchTitle: "YouTube Trend Analysis",
    youtubeResearchDesc: "Reviews current YouTube video signals for the selected topic and target market. This step only collects market data; it does not change the production flow.",
    youtubeResearchButton: "Run YouTube Trend Analysis",
    youtubeResearchLoading: "Analyzing YouTube data...",
    youtubeResearchEmpty: "No suitable YouTube video results were found.",
    youtubeResearchViews: "views",
    youtubeResearchLikes: "likes",
    youtubeResearchDuration: "duration",
    patternEngineTitle: "Pattern Engine",
    patternEngineDesc: "Extracts title, hook, duration, competition, and opportunity signals from the YouTube sample.",
    patternEngineButton: "Run Pattern Engine",
    patternEngineLoading: "Analyzing patterns...",
    patternEngineEmpty: "Run YouTube Trend Analysis first to use Pattern Engine.",
    patternTopTitles: "Title Patterns",
    patternHooks: "Hook Patterns",
    patternDuration: "Recommended Duration",
    patternOpportunity: "Opportunity Score",
    patternCompetition: "Competition Level",
    patternAngle: "Recommended Content Angle",
    patternReasoning: "Reasoning",
    creatorDurationTitle: "Video Duration",
    creatorDurationDesc: "The selected target duration is split into safe 7-second video clips to determine the scene count. Example: 60 sec target ≈ 9 scenes.",
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

  const maxSpeechFromTarget = TARGET_SCENE_DURATION_SECONDS * MAX_SPEECH_RATIO;
  const boundedSpeechDuration = Math.min(totalAudioDuration, maxSpeechFromTarget);

  const targetSceneDuration = Math.min(
    MAX_SCENE_DURATION_SECONDS,
    Math.max(
      TARGET_SCENE_DURATION_SECONDS,
      boundedSpeechDuration,
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
  const [userRole, setUserRole] = useState<"parent" | "admin" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [input, setInput] = useState("");
  const { language: uiLanguage } = useLanguage();
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
    return (project?.flow_type || "storyverse") === "creator_lab"
      ? "Creator Lab"
      : "Storyverse";
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

  const buildExportSignature = (nextTitle: string, nextScenes: Scene[]) => {
    const exportableScenes = nextScenes
      .filter((scene) => (scene.videoUrl && scene.videoStatus === "done") || scene.image)
      .map((scene) => ({
        id: scene.id,
        text: scene.text || "",
        narration: scene.narration || "",
        dialogue: scene.dialogue || "",
        cameraDirection: scene.cameraDirection || "",
        emotion: scene.emotion || "",
        motionHint: scene.motionHint || "",
        image: scene.image || "",
        videoUrl: scene.videoUrl || "",
        videoStatus: scene.videoStatus || "idle",
        timing: scene.timing || null,
      }));

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
    const stitchScenes = scenes
      .filter((scene) => scene.videoUrl || scene.image)
      .map((scene) => ({
        id: scene.id,
        imageUrl: scene.image || "",
        videoUrl: scene.videoStatus === "done" ? scene.videoUrl || "" : "",
        audioUrl: scene.audioUrl || "",
        dialogueAudioUrl: scene.dialogueAudioUrl || "",
        durationSec: CREATOR_SCENE_CLIP_DURATION_SECONDS,
      }));

    if (stitchScenes.length < 1) {
      setError("Final video oluşturmak için en az 1 görsel veya video içeren sahne gerekir.");
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
        body: JSON.stringify({ scenes: stitchScenes }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        try {
          const parsedError = JSON.parse(errorText);
          throw new Error(parsedError?.error || "Final video oluşturulamadı.");
        } catch {
          throw new Error(errorText || "Final video oluşturulamadı.");
        }
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

      setSaveMessage("Final video sesli olarak oluşturuldu ve indirildi ✅");
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

    updateSceneTimingData(
      sceneId,
      buildSceneTiming(narrationDuration, dialogueDuration)
    );
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
    setYoutubeResearchVideos([]);
    setYoutubePatternSummary(null);
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
    scene: Pick<Scene, "id" | "text" | "cameraDirection" | "emotion" | "motionHint">
  ) => {
    const safeScene = getSafeSceneForImagePrompt(scene);

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

  const handleExportMovie = async () => {
    const exportScenes = scenes.filter(
      (scene) =>
        (scene.videoUrl && scene.videoStatus === "done") ||
        scene.image
    );

    for (const scene of exportScenes) {
      const timing = scene.timing || buildSceneTiming(0, 0);

      if (isSceneSpeechTooLong(timing)) {
        setError(
          `Sahne ${scene.id}: Konuşma çok uzun. Lütfen sahneyi kısalt veya yeniden üret.`
        );
        return;
      }
    }

    if (exportScenes.length === 0) {
      setError("Film oluşturmak için en az bir görsel veya hazır video içeren sahne gerekli.");
      return;
    }

    if (!exportApiBase) {
      setError("Export servisi URL'i tanımlı değil. Vercel ortam değişkenlerinde NEXT_PUBLIC_EXPORT_API_URL eklenmeli.");
      return;
    }

    const currentSignature = buildExportSignature(title, scenes);

    if (exportedMovieUrl && exportSignature === currentSignature) {
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
              exportSource:
                scene.videoUrl && scene.videoStatus === "done" ? "video" : "image",
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
            language,
            storyPremise: storySetup?.storyPremise || "",
            characters,
            visualBible,
            scenes,
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

        if (!scene.narration?.trim()) {
          continue;
        }

        setLoadingAudioSceneId(scene.id);

        const audioUrl = await getSceneAudioUrl(scene);

        if (playbackToken !== storyPlaybackTokenRef.current) {
          return;
        }

        setLoadingAudioSceneId(null);
        await waitForAudioToFinish(scene.id, audioUrl, playbackToken);
      }
    } catch (e: any) {
      console.error("playWholeStory error:", e);
      setError(e?.message || "Hikaye oynatılırken bir hata oluştu.");
    } finally {
      if (playbackToken === storyPlaybackTokenRef.current) {
        setIsPlayingStory(false);
        setLoadingAudioSceneId(null);
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
      setCharacters(
        Array.isArray(project.characters)
          ? project.characters.map((character: Character) => ({
              ...character,
              voiceId: character.voiceId || "",
            }))
          : []
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

      const nextPackage = data.productionPackage as CreatorProductionPackage;

      setCreatorProductionPackage(nextPackage);
      setRefinedCreatorScenes([]);

      setStorySetup({
        title: nextPackage.title || "",
        storyPremise: nextPackage.storyPremise || "",
        characters: Array.isArray(nextPackage.characters)
          ? nextPackage.characters.map((character: Character) => ({
              ...character,
              voiceId: character.voiceId || "",
            }))
          : [],
        visualBible: nextPackage.visualBible || emptyVisualBible,
      });

      setTitle(nextPackage.title || "");
      setCharacters(
        Array.isArray(nextPackage.characters)
          ? nextPackage.characters.map((character: Character) => ({
              ...character,
              voiceId: character.voiceId || "",
            }))
          : []
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
        characters: Array.isArray(data.characters)
          ? data.characters.map((character: Character) => ({
              ...character,
              voiceId: character.voiceId || "",
            }))
          : [],
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

        const packageScenes: Scene[] = creatorSourceScenes.map((scene) => ({
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

      const scenesWithImages: Scene[] = (data.scenes || []).map((scene: Scene) => ({
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
                ...data.updatedScene,
                image: "",
                videoUrl: "",
                videoStatus: "idle",
                videoJobId: "",
                timing: buildSceneTiming(0, 0),
              }
            : scene
        )
      );

      const image = await generateSceneImage({
        id: sceneId,
        text: data.updatedScene.text,
        cameraDirection: data.updatedScene.cameraDirection,
        emotion: data.updatedScene.emotion,
        motionHint: data.updatedScene.motionHint,
      });

      setScenes((prev) =>
        prev.map((scene) => (scene.id === sceneId ? { ...scene, image } : scene))
      );

      setSceneInstructions((prev) => ({
        ...prev,
        [sceneId]: "",
      }));

      setEditingSceneId(null);
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
    (scene) => (scene.videoUrl && scene.videoStatus === "done") || scene.image
  ).length;
  const audioReadyCount = scenes.filter((scene) => getSceneAudioStatus(scene)).length;
  const freezeNeededCount = scenes.filter((scene) => scene.timing?.needsFreezeFrame).length;
  const dialogueReadyCount = scenes.filter((scene) => !!scene.dialogueAudioUrl).length;
  const totalTargetDuration = scenes.reduce(
    (sum, scene) => sum + (scene.timing?.targetSceneDuration || 0),
    0
  );

  const currentWorkflowStep = !setupReady
    ? 1
    : scenes.length === 0
    ? 2
    : readyExportCount === 0
    ? 3
    : 4;

  const workflowSteps = [
    {
      id: 1,
      title: ui.storySetupChip,
      description: ui.studioRouteMapDesc,
      active: currentWorkflowStep === 1,
      complete: setupReady,
    },
    {
      id: 2,
      title: ui.initialDesign,
      description: ui.initialDesignHint,
      active: currentWorkflowStep === 2,
      complete: setupReady && scenes.length > 0,
    },
    {
      id: 3,
      title: ui.sceneTimingChip,
      description: ui.exportReadyDesc,
      active: currentWorkflowStep === 3,
      complete: readyExportCount > 0,
    },
    {
      id: 4,
      title: ui.finalExportChip,
      description: ui.quickItem2,
      active: currentWorkflowStep === 4,
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_#050816_0%,_#020617_45%,_#000000_100%)] px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
{/* 🚀 EPISODE PACKAGE PANEL */}
<div className="rounded-3xl border border-purple-400/20 bg-purple-500/10 p-6 mb-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-purple-300">
        {ui.episodePackage}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-white">
        {title || ui.notCreatedYet}
      </h3>
      <p className="text-sm text-purple-200/80 mt-1">
        {ui.episodePackageProductDesc}
      </p>
    </div>

    <div className="text-right text-sm text-purple-200">
      <div>{ui.flow}: {localizedSelectedFlow.shortTitle}</div>
      <div>{ui.language}: {language.toUpperCase()}</div>
    </div>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-center">
    <div>
      <p className="text-2xl font-bold">{characters.length}</p>
      <p className="text-xs text-purple-200/70">{ui.character}</p>
    </div>
    <div>
      <p className="text-2xl font-bold">{scenes.length}</p>
      <p className="text-xs text-purple-200/70">{ui.scene}</p>
    </div>
    <div>
      <p className="text-2xl font-bold">{audioReadyCount}</p>
      <p className="text-xs text-purple-200/70">{ui.audioReady}</p>
    </div>
    <div>
      <p className="text-2xl font-bold">{readyVideoCount}</p>
      <p className="text-xs text-purple-200/70">{ui.videoReady}</p>
    </div>
  </div>

  <div className="mt-6 flex flex-wrap gap-3">
    <button
      onClick={handleExportMovie}
      disabled={isExportingMovie}
      className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
    >
      {exportedMovieUrl && hasReusableExport()
        ? (uiLanguage === "en" ? "▶ Open Existing Movie" : "▶ Mevcut Filmi Aç")
        : ui.createMovie}
    </button>

    <button
      onClick={handleCreateShareLink}
      disabled={shareLoading || !currentProjectId}
      className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
      title={!currentProjectId ? ui.saveProjectFirstTitle : ui.publicShareTitle}
    >
      {shareLoading ? ui.shareLinkCreating : ui.shareLinkCreate}
    </button>

    {shareUrl && (
      <button
        onClick={handleCopyShareLink}
        className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm text-cyan-100"
      >
        {shareCopied ? ui.copied : ui.copyLink}
      </button>
    )}

    {(exportMovieResult?.downloadUrl || exportedMovieUrl) && (
      <button
        type="button"
        onClick={handleDownloadVideo}
        className="rounded-xl border border-purple-300/40 px-4 py-2 text-sm transition hover:bg-purple-300/10"
      >
        {ui.download}
      </button>
    )}
  </div>

  {shareUrl && (
    <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">{ui.shareLink}</p>
      <a
        href={shareUrl}
        target="_blank"
        className="mt-1 block break-all text-cyan-50 underline decoration-cyan-300/50 underline-offset-4"
      >
        {shareUrl}
      </a>
    </div>
  )}



  {shareUrl && (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-purple-200">
        {ui.openQr}
      </p>

      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
        alt="QR Code"
        className="rounded-xl bg-white p-2"
      />

      <p className="max-w-xs text-center text-xs text-purple-200/70">
        {ui.qrHint}
      </p>
    </div>
  )}

  {exportMovieResult && (
    <div className="mt-4 text-sm text-purple-200/80">
      <div>{ui.duration}: {formatDurationLabel(exportMovieResult.durationSeconds)}</div>
      <div>{ui.size}: {formatFileSizeLabel(exportMovieResult.sizeBytes)}</div>
      <div>{ui.scene}: {exportMovieResult.sceneCount}</div>
    </div>
  )}
</div>

        {userRole === "admin" && (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-yellow-200">
            {ui.adminMode}
          </div>
        )}

        {userRole === "parent" && (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-200">
            {ui.parentMode}
          </div>
        )}

        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-cyan-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{ui.selectedFlow}</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{localizedSelectedFlow.title}</h2>
              <p className="mt-1 text-sm leading-6 text-cyan-100/90">{localizedSelectedFlow.description}</p>
              {isStoryverseFlow && (
                <p className="mt-2 text-xs leading-5 text-cyan-100/80">
                  {ui.activeProductBehavior}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white">{selectedFlow.ageBand}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white">{selectedFlow.durationMin} {ui.minuteShort}</span>
              {(activeFlowKey === "creator_lab"
                ? selectedFlow.zones.filter((zone: FlowZone) => zone !== "VR")
                : selectedFlow.zones
              ).map((zone: FlowZone) => (
                <span key={zone} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white">
                  {zone}
                </span>
              ))}
            </div>
          </div>
          {activeFlowKey !== "storyverse" && activeFlowKey !== "creator_lab" && (
            <p className="mt-3 rounded-xl border border-yellow-300/20 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
              {ui.nonStoryversePilot}
            </p>
          )}
        </div>
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="grid gap-6 px-6 py-7 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                {ui.studioBadge}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">VELTO</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  {ui.studioDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300 md:text-sm">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{ui.storySetupChip}</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{ui.sceneTimingChip}</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{ui.voiceDialogueChip}</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{ui.runwayVideoChip}</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{ui.finalExportChip}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.sceneStatus}</p>
                <p className="mt-3 text-3xl font-semibold">{scenes.length}</p>
                <p className="mt-2 text-sm text-slate-300">{ui.totalScene}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.exportReady}</p>
                <p className="mt-3 text-3xl font-semibold">{readyExportCount}</p>
                <p className="mt-2 text-sm text-slate-300">{ui.exportReadyDesc}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.readyAudio}</p>
                <p className="mt-3 text-3xl font-semibold">{audioReadyCount}</p>
                <p className="mt-2 text-sm text-slate-300">{ui.readyAudioDesc}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.estimatedDuration}</p>
                <p className="mt-3 text-3xl font-semibold">{totalTargetDuration.toFixed(1)} {ui.secondShort}</p>
                <p className="mt-2 text-sm text-slate-300">{ui.estimatedDurationDesc}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{ui.workflow}</p>
              <h2 className="mt-3 text-xl font-semibold text-white">{ui.studioRouteMap}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {ui.studioRouteMapDesc}
              </p>

              <div className="mt-5 space-y-3">
                {workflowSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-4 transition ${
                      step.active
                        ? "border-cyan-400/30 bg-cyan-400/10"
                        : step.complete
                        ? "border-emerald-400/20 bg-emerald-400/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                          step.complete
                            ? "bg-emerald-400/20 text-emerald-200"
                            : step.active
                            ? "bg-cyan-400/20 text-cyan-100"
                            : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {step.complete ? "✓" : step.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{step.title}</p>
                        <p className="mt-1 text-xs text-slate-300">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-violet-400/20 bg-violet-500/10 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
              <p className="text-xs uppercase tracking-[0.22em] text-violet-200">{ui.nextSurface}</p>
              <h3 className="mt-3 text-lg font-semibold text-white">{ui.quickContentMode}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {ui.quickContentModeDesc}
              </p>

              <div className="mt-4 space-y-2 text-xs text-slate-200">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{ui.quickItem1}</div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{ui.quickItem2}</div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{ui.quickItem3}</div>
              </div>
            </div>
          </aside>

          <div className="space-y-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{ui.childProfile}</h2>
            {selectedChild ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                {ui.activeChild}: {selectedChild.nickname}
              </span>
            ) : (
              <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-200">
                {ui.noChildSelected}
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                placeholder={ui.newChildName}
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
              />
              <button
                onClick={handleAddChild}
                disabled={addingChild}
                className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {addingChild ? ui.adding : ui.add}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-300">
            {ui.childProfileHint}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{selectedFlowProjectTitle}</h2>
            <button
              onClick={fetchProjects}
              disabled={loadingProjects}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              {loadingProjects ? ui.refreshing : ui.refresh}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setSelectedFlowKey("storyverse")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                activeFlowKey === "storyverse"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              Storyverse
            </button>

            <button
              type="button"
              onClick={() => setSelectedFlowKey("creator_lab")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                activeFlowKey === "creator_lab"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              Creator Lab
            </button>
          </div>

          {loadingProjects ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              {ui.projectsLoading}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
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
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
                  >
                    <div className="h-36 w-full overflow-hidden bg-black/40">
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
                        <h3 className="text-sm font-semibold leading-5 text-white">
                          {project.title || ui.untitledProject}
                        </h3>

                        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                          {flowLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
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
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ui.open}
                        </button>

                        {project.exported_movie_url ? (
                          <a
                            href={project.exported_movie_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-cyan-400 px-3 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
                          >
                            {uiLanguage === "en" ? "Movie" : "Film"}
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-500"
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

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">{ui.contentLanguage}</label>
              <select
                className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                value={language}
                onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              >
                <option value="tr">{ui.turkish}</option>
                <option value="en">{ui.english}</option>
              </select>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              {ui.contentLanguageHint}
            </div>
          </div>

          {isCreatorLabFlow && (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">
                  {ui.creatorMentor}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {ui.creatorStrategySetup}
                </h3>
                <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                  {ui.creatorMentorDesc}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-cyan-100">
                    {ui.targetMarket}
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-cyan-100">
                    {ui.ageGroup}
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-cyan-100">
                    {ui.contentType}
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-cyan-100">
                    {ui.videoFormat}
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-cyan-100">
                    {ui.creatorDurationTitle}
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
            <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-red-200">
                    Phase-2A
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
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
                  className="rounded-2xl bg-red-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                    >
                      <div className="h-32 w-full overflow-hidden bg-black/40">
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
                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                          {video.title}
                        </h4>
                        <p className="text-xs text-slate-400">{video.channel}</p>

                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
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
                          className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-white/10"
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
            <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-purple-200">
                    Phase-2C
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
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
                  className="rounded-2xl bg-purple-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h4 className="font-semibold text-white">{ui.patternTopTitles}</h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {youtubePatternSummary.topTitlePatterns.map((item, index) => (
                        <li key={`title-pattern-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h4 className="font-semibold text-white">{ui.patternHooks}</h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {youtubePatternSummary.hookPatterns.map((item, index) => (
                        <li key={`hook-pattern-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h4 className="font-semibold text-white">{ui.patternAngle}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {youtubePatternSummary.recommendedContentAngle}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {ui.patternDuration}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {youtubePatternSummary.recommendedDurationSec}s
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {ui.patternOpportunity}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {youtubePatternSummary.opportunityScore}/100
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {ui.patternCompetition}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white capitalize">
                          {youtubePatternSummary.competitionLevel}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-purple-300/20 bg-purple-400/10 p-3 text-sm text-purple-50">
                      <p>
                        {ui.creatorDurationTitle}: {getCreatorDurationLabel()} /{" "}
                        {getCreatorSceneCount()} {ui.sceneCountLabel}
                      </p>
                      <button
                        type="button"
                        onClick={applyPatternRecommendedDuration}
                        className="mt-3 rounded-xl border border-purple-200/30 px-3 py-2 text-xs font-semibold text-purple-50 transition hover:bg-purple-200/10"
                      >
                        {ui.usePatternDuration}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 lg:col-span-2">
                    <h4 className="font-semibold text-white">{ui.patternReasoning}</h4>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {youtubePatternSummary.reasoning.map((item, index) => (
                        <li key={`pattern-reasoning-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

<label className="block text-sm font-medium text-gray-300">
  {getFlowAwareInputLabel()}
</label>

          <textarea
            className="min-h-36 w-full rounded-xl border border-gray-700 bg-white p-4 text-black placeholder:text-gray-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={getFlowAwarePlaceholder()}
          />

          <div className="flex justify-center">
            <button
              onClick={createSetup}
              disabled={loadingSetup}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
            >
              {isCreatorLabFlow
                ? creatorMentorLoading
                  ? ui.analyzingContentOpportunity
                  : ui.analyzeContentOpportunity
                : loadingSetup
                  ? ui.preparingSetup
                  : ui.createCharacters}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {saveMessage && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-200">
            {saveMessage}
          </div>
        )}

        {currentProjectId && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            {ui.projectId}: <span className="font-mono">{currentProjectId}</span>
          </div>
        )}

        {isCreatorLabFlow && creatorMentorResult && (
          <section className="rounded-[28px] border border-cyan-300/20 bg-cyan-500/[0.08] p-5 text-sm text-slate-200">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">
                {ui.creatorMentor}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {ui.mentorAnalysisTitle}
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-white">{ui.audienceInsight}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
                  {creatorMentorResult.audienceInsight.map((item, index) => (
                    <li key={`audience-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-white">{ui.hookPatterns}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
                  {creatorMentorResult.hookPatterns.map((item, index) => (
                    <li key={`hook-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <h3 className="font-semibold text-white">{ui.videoIdeas}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {creatorMentorResult.videoIdeas.map((idea, index) => (
                  <article
                    key={`${idea.title}-${index}`}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <p className="font-semibold text-cyan-100">
                      {index + 1}. {idea.title}
                    </p>
                    <p className="mt-2 leading-6 text-slate-300">{idea.concept}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <h3 className="font-semibold text-emerald-100">
                  {ui.recommendedIdea}
                </h3>
                <p className="mt-3 font-semibold text-white">
                  {creatorMentorResult.recommendedIdea.title}
                </p>
                <p className="mt-2 leading-6 text-emerald-50/85">
                  {creatorMentorResult.recommendedIdea.reason}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-white">{ui.productionPlan}</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-300">
                  {creatorMentorResult.productionPlan.map((item, index) => (
                    <li key={`plan-${index}`}>{item}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-cyan-50">
              {ui.creatorProductionDesc}
            </div>

            <button
              type="button"
              onClick={handleCreatorProductionPackage}
              disabled={creatorProductionLoading}
              className="mt-5 w-full rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatorProductionLoading
                ? ui.convertingProductionPackage
                : ui.continueToProduction}
            </button>
          </section>
        )}

        {isCreatorLabFlow && creatorProductionPackage && (
          <section className="rounded-[28px] border border-emerald-300/20 bg-emerald-500/[0.08] p-5 text-sm text-slate-200">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">
                {ui.creatorProductionTitle}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {creatorProductionPackage.title}
              </h2>
              <p className="mt-3 max-w-4xl leading-6 text-emerald-50/85">
                {creatorProductionPackage.storyPremise}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-white">{ui.thumbnailIdea}</h3>
                <p className="mt-3 leading-6 text-slate-300">
                  {creatorProductionPackage.thumbnailIdea}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-white">{ui.youtubeTitle}</h3>
                <p className="mt-3 leading-6 text-slate-300">
                  {creatorProductionPackage.youtubeTitle}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-white">{ui.youtubeCaption}</h3>
                <p className="mt-3 leading-6 text-slate-300">
                  {creatorProductionPackage.caption}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-emerald-50">
              {ui.productionPackageNote}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-300">
                {refinedCreatorScenes.length > 0
                  ? ui.refinedScenesNote
                  : ui.creatorProductionDesc}
              </div>

              <button
                type="button"
                onClick={handleRefineCreatorScenes}
                disabled={refineScenesLoading}
                className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refineScenesLoading ? ui.refiningScenes : ui.refineScenes}
              </button>
            </div>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.studioSnapshot}</p>
            <p className="mt-3 text-lg font-semibold text-white">{setupReady ? ui.setupReady : ui.setupWaiting}</p>
            <p className="mt-2 text-sm text-slate-300">{ui.studioSnapshotDesc}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.dialogueLayer}</p>
            <p className="mt-3 text-lg font-semibold text-white">{dialogueReadyCount} {ui.sceneCountLabel}</p>
            <p className="mt-2 text-sm text-slate-300">{ui.dialogueLayerDesc}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.freezeRisk}</p>
            <p className="mt-3 text-lg font-semibold text-white">{freezeNeededCount} {ui.sceneCountLabel}</p>
            <p className="mt-2 text-sm text-slate-300">{ui.freezeRiskDesc}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.quickModePrep}</p>
            <p className="mt-3 text-lg font-semibold text-white">{ui.activePlan}</p>
            <p className="mt-2 text-sm text-slate-300">{ui.quickModePrepDesc}</p>
          </div>
        </div>

        {setupReady && (
          <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{ui.initialDesign}</h2>
              <p className="text-sm text-gray-300">
                {ui.initialDesignHint}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-300">{ui.storyTitle}</label>
              <input
                className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-300">{ui.storyPremiseLabel}</label>
              <textarea
                className="min-h-24 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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

            <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
  <h3 className="text-xl font-semibold">{ui.narratorSettings}</h3>

  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2">
      <label className="block text-sm text-gray-300">Narrator Voice ID</label>
      <input
        className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
      <p className="text-xs text-gray-400">
        {ui.narratorVoiceHint}
      </p>
    </div>

    <div className="space-y-2">
      <label className="block text-sm text-gray-300">Model</label>
      <select
        className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
      <label className="block text-sm text-gray-300">
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
      <label className="block text-sm text-gray-300">
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
      <label className="block text-sm text-gray-300">
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
      <label className="block text-sm text-gray-300">
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

  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400 space-y-1">
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
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                >
                  {ui.addCharacter}
                </button>
              </div>

              {characters.map((character, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{ui.characterLabel} {index + 1}</h4>
                    {characters.length > 1 && (
                      <button
                        onClick={() => removeCharacter(index)}
                        className="rounded-lg border border-red-400/30 px-3 py-1 text-xs text-red-200"
                      >
                        {ui.delete}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-xl border border-gray-700 bg-white p-3 text-black"
                      placeholder={ui.namePlaceholder}
                      value={character.name}
                      onChange={(e) => updateCharacter(index, "name", e.target.value)}
                    />
                    <input
                      className="rounded-xl border border-gray-700 bg-white p-3 text-black"
                      placeholder={ui.agePlaceholder}
                      value={character.age}
                      onChange={(e) => updateCharacter(index, "age", e.target.value)}
                    />
                  </div>

                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder={ui.appearancePlaceholder}
                    value={character.appearance}
                    onChange={(e) => updateCharacter(index, "appearance", e.target.value)}
                  />

                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder={ui.outfitPlaceholder}
                    value={character.outfit}
                    onChange={(e) => updateCharacter(index, "outfit", e.target.value)}
                  />

                  <input
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder={ui.accessoryPlaceholder}
                    value={character.accessory || ""}
                    onChange={(e) => updateCharacter(index, "accessory", e.target.value)}
                  />

                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder={ui.personalityPlaceholder}
                    value={character.personality}
                    onChange={(e) => updateCharacter(index, "personality", e.target.value)}
                  />

                  <input
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder={ui.characterVoicePlaceholder}
                    value={character.voiceId || ""}
                    onChange={(e) => updateCharacter(index, "voiceId", e.target.value)}
                  />

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                    {ui.characterVoiceHint}
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => generateCharacterReference(index)}
                      disabled={characterLoadingIndex === index}
                      className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {characterLoadingIndex === index
                        ? ui.preparingReferenceImage
                        : ui.generateReferenceImage}
                    </button>

                    {character.referenceImage ? (
                      <img
                        src={character.referenceImage}
                        alt={`${character.name || `${ui.characterLabel} ${index + 1}`} ${ui.referenceImageAlt}`}
                        className="w-full max-w-md rounded-xl"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-400">
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
                className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
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
                className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
              >
                {buildingStory ? ui.buildingStory : ui.buildStoryAndScenes}
              </button>
            </div>
          </div>
        )}

        {scenes.length > 0 && (
          <>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
              <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={saveProject}
                disabled={isSavingProject}
                className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {isSavingProject ? ui.savingProject : ui.saveProject}
              </button>

              <button
                onClick={prepareAllAudio}
                disabled={isPreparingAudio || isPlayingStory || playingDialogueSceneId !== null}
                className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
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
                className="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {isPlayingStory ? ui.stopStory : ui.listenStory}
              </button>

              <button
                onClick={handleExportMovie}
                disabled={isExportingMovie || readyExportCount === 0}
                className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {isExportingMovie
                  ? ui.creatingMovie
                  : exportedMovieUrl && hasReusableExport()
                    ? (uiLanguage === "en" ? "▶ Open Existing Movie" : "▶ Mevcut Filmi Aç")
                    : `${ui.createFinalMovieWithCount} (${readyExportCount})`}
              </button>
              </div>
            </div>

            {exportedMovieUrl && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{ui.finalMovie}</h3>
                  <p className="mt-1 text-sm text-gray-300">
                    {ui.finalMovieDesc}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dosya</p>
                    <p className="mt-2 text-sm font-medium text-white break-all">
                      {exportMovieResult?.fileName || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Süre</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatDurationLabel(exportMovieResult?.durationSeconds)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Boyut</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatFileSizeLabel(exportMovieResult?.sizeBytes)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-gray-300">Final Video URL</p>
                  <a
                    href={exportMovieResult?.downloadUrl || exportedMovieUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-sm text-cyan-300 underline"
                  >
                    {exportMovieResult?.downloadUrl || exportedMovieUrl}
                  </a>
                </div>

                <video
                  src={exportedMovieUrl}
                  controls
                  className="w-full rounded-xl border border-white/10 bg-black"
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadVideo}
                    className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:scale-105"
                  >
                    {ui.download}
                  </button>

                  <button
                    type="button"
                    onClick={handleStitchVideo}
                    disabled={
                      isExportingMovie ||
                      scenes.filter((scene) => scene.videoUrl || scene.image).length < 1
                    }
                    className="inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:scale-105 disabled:opacity-50"
                  >
                    {isExportingMovie
                      ? ui.creatingMovie
                      : uiLanguage === "en"
                        ? "Stitch Final Video"
                        : "Sesli Final Video Oluştur"}
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
                    className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:scale-105"
                  >
                    Linki Kopyala
                  </button>

                  <a
                    href={exportMovieResult?.downloadUrl || exportedMovieUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:scale-105"
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
                  <p className="mt-1 text-sm text-slate-300">{ui.sceneProductionPanelDesc}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
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
                    className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                            Scene {scene.id}
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              isAudioReady
                                ? "border border-green-500/30 bg-green-500/10 text-green-200"
                                : "border border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                            }`}
                          >
                            {isAudioReady ? "Narration ready" : "Narration pending"}
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              dialogueReady
                                ? "border border-pink-500/30 bg-pink-500/10 text-pink-200"
                                : "border border-orange-500/30 bg-orange-500/10 text-orange-200"
                            }`}
                          >
                            {dialogueReady ? "Dialogue ready" : "Dialogue pending"}
                          </div>

                          <div
                            className={`rounded-full px-3 py-1 text-xs ${
                              scene.videoStatus === "done"
                                ? "border border-green-500/30 bg-green-500/10 text-green-200"
                                : scene.videoStatus === "processing"
                                ? "border border-blue-500/30 bg-blue-500/10 text-blue-200"
                                : scene.videoStatus === "error"
                                ? "border border-red-500/30 bg-red-500/10 text-red-200"
                                : "border border-gray-500/30 bg-gray-500/10 text-gray-200"
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
                            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">
                              {ui.lastScene}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold text-white">Production Scene Card</h3>
                          <p className="mt-1 max-w-2xl text-sm text-slate-300">
                            {ui.sceneCardPurpose}
                          </p>
                        </div>
                      </div>

                      <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 lg:w-[360px]">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Production score</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{productionScore}/4</p>
                          <p className="mt-1 text-xs text-slate-400">Image, narration, dialogue ve video durumu.</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Target duration</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{totalDuration.toFixed(1)}s</p>
                          <p className="mt-1 text-xs text-slate-400">Audio + video ritmi için hesaplanan hedef.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-base leading-7 text-gray-100">{scene.text}</p>
                        </div>

                        <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-200 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-400">Narration</p>
                            <p>{scene.narration}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-400">Dialogue</p>
                            <p>{scene.dialogue || "Yok"}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-400">Camera</p>
                            <p>{scene.cameraDirection}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-400">Emotion</p>
                            <p>{scene.emotion}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-400">Motion hint</p>
                            <p>{scene.motionHint}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-50">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="font-semibold">Timing & export kararları</p>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                                scene.timing?.needsFreezeFrame
                                  ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                                  : "border border-green-500/30 bg-green-500/10 text-green-200"
                              }`}
                            >
                              {scene.timing?.needsFreezeFrame ? "Freeze required" : "Video sufficient"}
                            </span>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Audio total</p>
                              <p className="mt-2 text-lg font-semibold text-white">{totalAudio.toFixed(2)}s</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Target scene</p>
                              <p className="mt-2 text-lg font-semibold text-white">{totalDuration.toFixed(2)}s</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Freeze need</p>
                              <p className="mt-2 text-lg font-semibold text-white">{(scene.timing?.freezeDuration || 0).toFixed(2)}s</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Scene pipeline</p>
                          <div className="mt-3 grid gap-2">
                            {[
                              { label: "Image", ready: hasImage, pending: redrawLoadingId === scene.id },
                              { label: "Narration", ready: narrationReady, pending: loadingAudioSceneId === scene.id },
                              { label: "Dialogue", ready: dialogueReady, pending: loadingDialogueSceneId === scene.id && hasDialogue },
                              { label: "Video", ready: hasVideo, pending: scene.videoStatus === "processing" },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                <span className="text-sm text-slate-200">{item.label}</span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                                    item.pending
                                      ? "border border-blue-500/30 bg-blue-500/10 text-blue-200"
                                      : item.ready
                                      ? "border border-green-500/30 bg-green-500/10 text-green-200"
                                      : "border border-white/15 bg-white/5 text-slate-400"
                                  }`}
                                >
                                  {item.pending ? "Processing" : item.ready ? "Ready" : "Pending"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Quick actions</p>
                          <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={() => playNarration(scene.id, scene.narration)}
                        disabled={
                          loadingAudioSceneId === scene.id ||
                          isPreparingAudio ||
                          (isPlayingStory && playingSceneId !== scene.id) ||
                          playingDialogueSceneId !== null
                        }
                        className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-sm text-purple-100 disabled:opacity-50"
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
                        className="rounded-lg border border-pink-400/40 bg-pink-500/10 px-4 py-2 text-sm text-pink-100 disabled:opacity-50"
                      >
                        {loadingDialogueSceneId === scene.id
                          ? "Diyalog hazırlanıyor..."
                          : playingDialogueSceneId === scene.id
                          ? "Diyaloğu Durdur"
                          : "Karakter Diyaloğunu Dinle"}
                      </button>

                      <button
                        onClick={() => handleGenerateVideo(scene.id)}
                        disabled={scene.videoStatus === "processing" || !scene.image}
                        className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-100 disabled:opacity-50"
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
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                      >
                        {ui.editScene}
                      </button>

                      <button
                        onClick={() => {
                          setBranchingSceneId(scene.id);
                          setEditingSceneId(null);
                        }}
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                      >
                        {ui.branchAfterScene}
                      </button>

                      <button
                        onClick={() => redrawSceneImage(scene)}
                        disabled={redrawLoadingId === scene.id}
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {redrawLoadingId === scene.id ? ui.redrawing : ui.redraw}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{ui.scenePreviews}</p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className={`rounded-full px-2.5 py-1 ${hasImage ? "border border-green-500/30 bg-green-500/10 text-green-200" : "border border-white/15 bg-white/5 text-slate-400"}`}>
                            {hasImage ? ui.imageReady : ui.imagePending}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 ${hasVideo ? "border border-green-500/30 bg-green-500/10 text-green-200" : "border border-white/15 bg-white/5 text-slate-400"}`}>
                            {hasVideo ? ui.videoReady : ui.videoPending}
                          </span>
                        </div>
                      </div>

                      {scene.image ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">{ui.readySceneImage}</p>
                          <img
                            src={scene.image}
                            alt={`${ui.scene} ${scene.id}`}
                            className="w-full rounded-2xl border border-white/10 bg-black/30 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          {ui.noSceneImagePreview}
                        </div>
                      )}

                      {scene.videoUrl && scene.videoStatus === "done" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">{ui.readySceneVideo}</p>
                          <video
                            src={scene.videoUrl}
                            controls
                            playsInline
                            className="w-full rounded-2xl border border-white/10 bg-black/30"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          {ui.noSceneVideoPreview}
                        </div>
                      )}
                    </div>
                  </div>

                    
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
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
                      <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                        <label className="block text-sm text-gray-300">
                          {ui.sceneEditQuestion}
                        </label>

                        <textarea
                          className="min-h-24 w-full rounded-xl border border-gray-700 bg-white p-3 text-black placeholder:text-gray-500"
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
                            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
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
                            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                          >
                            {ui.cancel}
                          </button>
                        </div>
                      </div>
                    )}

                    {branchingSceneId === scene.id && (
                      <div className="mt-4 space-y-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                        <label className="block text-sm text-yellow-100">
                          {ui.branchQuestion}
                        </label>

                        <textarea
                          className="min-h-24 w-full rounded-xl border border-gray-700 bg-white p-3 text-black placeholder:text-gray-500"
                          value={branchInstructions[scene.id] || ""}
                          onChange={(e) =>
                            setBranchInstructions((prev) => ({
                              ...prev,
                              [scene.id]: e.target.value,
                            }))
                          }
                          placeholder={ui.branchPlaceholder}
                        />

                        <p className="text-xs text-gray-300">
                          {ui.branchWarning}
                        </p>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleBranchFromScene(scene.id)}
                            disabled={branchLoadingId === scene.id}
                            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
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
                            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{ui.continueFromLastScene}</h3>
                <p className="mt-1 text-sm text-gray-300">
                  {ui.continueFromLastSceneDesc}
                </p>
              </div>

              <textarea
                className="min-h-28 w-full rounded-xl border border-gray-700 bg-white p-4 text-black placeholder:text-gray-500"
                value={continuePrompt}
                onChange={(e) => setContinuePrompt(e.target.value)}
                placeholder={ui.continuePromptPlaceholder}
              />

              <div>
                <button
                  onClick={handleContinueStory}
                  disabled={isContinuing}
                  className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
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
  );
}
