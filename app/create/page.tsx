"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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
  const [language, setLanguage] = useState<ContentLanguage>("tr");
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
      setSaveMessage("Çocuk profili eklendi ✅");
    } catch (e: any) {
      setError(e?.message || "Çocuk eklenirken bir hata oluştu.");
    } finally {
      setAddingChild(false);
    }
  };

  const selectedChild = children.find((child) => child.id === selectedChildId) || null;

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
      return `${seconds.toFixed(1)} sn`;
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins} dk ${secs} sn`;
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
    setNarratorSettings(defaultNarratorSettings);
    draftProjectKeyRef.current = `draft-${crypto.randomUUID()}`;
  };

  const getProjectKey = () => {
    return currentProjectId || draftProjectKeyRef.current;
  };

  const generateSceneImage = async (
    scene: Pick<Scene, "id" | "text" | "cameraDirection" | "emotion" | "motionHint">
  ) => {
    const imageRes = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        sceneText: scene.text,
        cameraDirection: scene.cameraDirection,
        emotion: scene.emotion,
        motionHint: scene.motionHint,
        characters,
        visualBible,
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

          setSaveMessage("Video hazırlandı ve kaydedildi ✅");
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

      if (
        timing.maxSpeechDuration &&
        timing.totalAudioDuration > timing.maxSpeechDuration
      ) {
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

    setIsExportingMovie(true);
    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");
    setExportMovieResult(null);

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
                  (normalizedTarget * MAX_SPEECH_RATIO).toFixed(2)
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
      setSaveMessage("Film oluşturuldu ✅");
    } catch (e: any) {
      console.error("handleExportMovie error:", e);
      setError(e?.message || "Film export sırasında hata oluştu.");
    } finally {
      setIsExportingMovie(false);
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

      setSaveMessage("Tüm sahne sesleri ve diyalogları hazırlandı ✅");
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
        language,
        storyPremise: storySetup?.storyPremise || "",
        characters,
        visualBible,
        scenes,
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
        data.mode === "created" ? "Proje kaydedildi ✅" : "Proje güncellendi ✅"
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

      setExportedMovieUrl("");
      setExportMovieResult(null);
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

      setSaveMessage("Proje yüklendi ✅");

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

  const createSetup = async () => {
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
        body: JSON.stringify({ prompt: input, language }),
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

    try {
      const res = await fetch("/api/build-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          language,
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
        setSaveMessage("Otomatik kaydedildi ✅");
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
      title: "Fikir ve kurulum",
      description: "Hikaye fikrini gir, başlangıç tasarımını oluştur.",
      active: currentWorkflowStep === 1,
      complete: setupReady,
    },
    {
      id: 2,
      title: "Dünya ve karakterler",
      description: "Karakterleri, sesleri ve görsel dili netleştir.",
      active: currentWorkflowStep === 2,
      complete: setupReady && scenes.length > 0,
    },
    {
      id: 3,
      title: "Sahne üretimi",
      description: "Görsel, ses, timing ve video katmanlarını üret.",
      active: currentWorkflowStep === 3,
      complete: readyExportCount > 0,
    },
    {
      id: 4,
      title: "Final çıktı",
      description: "Film export al ve içerik üretim hattına bağla.",
      active: currentWorkflowStep === 4,
      complete: !!exportedMovieUrl,
    },
  ];

  if (authLoading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (roleLoading) {
    return <div style={{ padding: 40 }}>Role yükleniyor...</div>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_#050816_0%,_#020617_45%,_#000000_100%)] px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        {userRole === "admin" && (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-yellow-200">
            Admin Mode aktif → YouTube Engine burada konumlanacak.
          </div>
        )}

        {userRole === "parent" && (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-200">
            Experience Lab Mode aktif.
          </div>
        )}
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="grid gap-6 px-6 py-7 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                AI Story Studio
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">VELTO</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Hikâye, sahne, görsel, anlatıcı sesi, karakter diyaloğu, video ve final film çıktısını aynı akışta üreten üretim stüdyosu.
                  Bu ekran artık sadece geliştirme paneli değil, AI Experience Lab içindeki ortak üretim çekirdeği olarak kurgulanıyor.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300 md:text-sm">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Story setup</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Scene timing</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Voice + Dialogue</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Runway video</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Final export</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sahne Durumu</p>
                <p className="mt-3 text-3xl font-semibold">{scenes.length}</p>
                <p className="mt-2 text-sm text-slate-300">Toplam sahne</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Export Hazır</p>
                <p className="mt-3 text-3xl font-semibold">{readyExportCount}</p>
                <p className="mt-2 text-sm text-slate-300">Video veya görsel ile export edilebilir sahne</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hazır Ses</p>
                <p className="mt-3 text-3xl font-semibold">{audioReadyCount}</p>
                <p className="mt-2 text-sm text-slate-300">Narrator cache hazır</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tahmini Süre</p>
                <p className="mt-3 text-3xl font-semibold">{totalTargetDuration.toFixed(1)} sn</p>
                <p className="mt-2 text-sm text-slate-300">Toplam hedef film akışı</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Workflow</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Studio Route Map</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Bu ekran artık sadece üretim paneli değil; Experience Lab ve hızlı içerik üretimi için ortak akış merkezi.
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
              <p className="text-xs uppercase tracking-[0.22em] text-violet-200">Next Surface</p>
              <h3 className="mt-3 text-lg font-semibold text-white">Quick Content Mode</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Bir sonraki ürün katmanında bu stüdyonun üstüne hızlı YouTube içerik üretim modu gelecek. Bu ekran onun için çekirdek üretim altyapısıdır.
              </p>

              <div className="mt-4 space-y-2 text-xs text-slate-200">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Tek prompt ile bölüm üretimi</div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Seri formatı + export hazır akış</div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Experience Lab içerikleriyle ortak evren</div>
              </div>
            </div>
          </aside>

          <div className="space-y-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Çocuk Profili</h2>
            {selectedChild ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                Aktif: {selectedChild.nickname}
              </span>
            ) : (
              <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-200">
                Çocuk seçilmedi
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
              <option value="">Çocuk seç</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.nickname}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                placeholder="Yeni çocuk adı"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
              />
              <button
                onClick={handleAddChild}
                disabled={addingChild}
                className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {addingChild ? "Ekleniyor..." : "Ekle"}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-300">
            Experience Lab akışında hikâye üretmeden önce aktif çocuk profili seçilmelidir.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Projelerim</h2>
            <button
              onClick={fetchProjects}
              disabled={loadingProjects}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              {loadingProjects ? "Yenileniyor..." : "Yenile"}
            </button>
          </div>

          {loadingProjects ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              Projeler yükleniyor...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              Henüz kayıtlı proje yok. İlk hikayeni oluşturduğunda burada görünecek.
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => loadProjectById(project.id)}
                  disabled={isLoadingProject}
                  className="w-full rounded-xl border border-gray-700 bg-black/20 p-4 text-left transition hover:bg-white/10 disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{project.title || "Başlıksız Proje"}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Son güncelleme: {project.updated_at ? new Date(project.updated_at).toLocaleString() : "-"}
                      </div>
                    </div>

                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                      Aç
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">İçerik Dili</label>
              <select
                className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                value={language}
                onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              Seçilen dil; hikaye, narration, dialogue ve devam sahneleri için içerik üretim dilini belirler.
            </div>
          </div>


<label className="block text-sm font-medium text-gray-300">
  {language === "tr"
    ? "Nasıl bir hikaye yapmak istiyorsun?"
    : "What kind of story do you want to create?"}
</label>

          <textarea
            className="min-h-36 w-full rounded-xl border border-gray-700 bg-white p-4 text-black placeholder:text-gray-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={language === "tr" ? "Örn: 3 kardeşin ormandaki gizemli macerası" : "Example: 3 siblings on a mysterious forest adventure"}
          />

          <div className="flex justify-center">
            <button
              onClick={createSetup}
              disabled={loadingSetup}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
            >
              {loadingSetup ? (language === "tr" ? "Kurulum hazırlanıyor..." : "Preparing setup...") : (language === "tr" ? "Karakterleri Oluştur" : "Create Characters")}
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
            Proje ID: <span className="font-mono">{currentProjectId}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Studio Snapshot</p>
            <p className="mt-3 text-lg font-semibold text-white">{setupReady ? "Kurulum hazır" : "Kurulum bekliyor"}</p>
            <p className="mt-2 text-sm text-slate-300">Karakter ve görsel dünya hazırlandığında hikâye üretimine geçilir.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dialogue Layer</p>
            <p className="mt-3 text-lg font-semibold text-white">{dialogueReadyCount} sahne</p>
            <p className="mt-2 text-sm text-slate-300">Karakter sesleri hazırlanmış sahne sayısı.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Freeze Riski</p>
            <p className="mt-3 text-lg font-semibold text-white">{freezeNeededCount} sahne</p>
            <p className="mt-2 text-sm text-slate-300">Video süresinin ses akışını taşımakta zorlandığı sahneler.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick Mode Hazırlığı</p>
            <p className="mt-3 text-lg font-semibold text-white">Aktif plan</p>
            <p className="mt-2 text-sm text-slate-300">Bu ekran bir sonraki adımda hızlı YouTube üretim moduna ayrışacak.</p>
          </div>
        </div>

        {setupReady && (
          <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Başlangıç Tasarımı</h2>
              <p className="text-sm text-gray-300">
                Buradaki bilgileri düzelt. Her şey doğruysa sahneleri daha sonra oluştur.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Hikaye Başlığı</label>
              <input
                className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Hikaye Özeti / Yönü</label>
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
  <h3 className="text-xl font-semibold">Anlatıcı Ayarları</h3>

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
        Boş bırakırsan sunucu tarafındaki varsayılan narrator voice kullanılır.
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
      Önerilen narrator başlangıcı:
      <span className="ml-1 text-gray-200">
        stability 0.28–0.35 / similarity 0.75–0.82 / style 0.30–0.45 / speed 0.90–0.95
      </span>
    </p>
    <p>
      Ses kimliği değişirse mevcut narrator ve dialogue cache’leri temizlenir.
    </p>
  </div>
</div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Karakterler</h3>
                <button
                  onClick={addCharacter}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                >
                  Karakter Ekle
                </button>
              </div>

              {characters.map((character, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Karakter {index + 1}</h4>
                    {characters.length > 1 && (
                      <button
                        onClick={() => removeCharacter(index)}
                        className="rounded-lg border border-red-400/30 px-3 py-1 text-xs text-red-200"
                      >
                        Sil
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-xl border border-gray-700 bg-white p-3 text-black"
                      placeholder="Ad"
                      value={character.name}
                      onChange={(e) => updateCharacter(index, "name", e.target.value)}
                    />
                    <input
                      className="rounded-xl border border-gray-700 bg-white p-3 text-black"
                      placeholder="Yaş"
                      value={character.age}
                      onChange={(e) => updateCharacter(index, "age", e.target.value)}
                    />
                  </div>

                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder="Dış görünüş"
                    value={character.appearance}
                    onChange={(e) => updateCharacter(index, "appearance", e.target.value)}
                  />

                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder="Kıyafet"
                    value={character.outfit}
                    onChange={(e) => updateCharacter(index, "outfit", e.target.value)}
                  />

                  <input
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder="Aksesuar"
                    value={character.accessory || ""}
                    onChange={(e) => updateCharacter(index, "accessory", e.target.value)}
                  />

                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder="Karakter enerjisi / kişiliği"
                    value={character.personality}
                    onChange={(e) => updateCharacter(index, "personality", e.target.value)}
                  />

                  <input
                    className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                    placeholder="Karakter voiceId (ElevenLabs)"
                    value={character.voiceId || ""}
                    onChange={(e) => updateCharacter(index, "voiceId", e.target.value)}
                  />

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                    Diyaloglarda karakter sesi için buraya ElevenLabs voiceId girebilirsin.
                    Boş bırakılırsa sistem varsayılan sesle devam eder.
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => generateCharacterReference(index)}
                      disabled={characterLoadingIndex === index}
                      className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {characterLoadingIndex === index
                        ? "Referans görsel hazırlanıyor..."
                        : "Referans Görsel Üret"}
                    </button>

                    {character.referenceImage ? (
                      <img
                        src={character.referenceImage}
                        alt={`${character.name || `Karakter ${index + 1}`} referans görseli`}
                        className="w-full max-w-md rounded-xl"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-400">
                        Bu karakter için henüz referans görsel üretilmedi.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Görsel Stil</h3>

              <textarea
                className="min-h-20 w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
                placeholder="Stil"
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
                placeholder="Renk paleti"
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
                placeholder="Kamera yaklaşımı"
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
                placeholder="Tutarlılık kuralları"
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
                {buildingStory ? "Hikaye kuruluyor..." : "Hikayeyi ve Sahneleri Oluştur"}
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
                {isSavingProject ? "Kaydediliyor..." : "Projeyi Kaydet"}
              </button>

              <button
                onClick={prepareAllAudio}
                disabled={isPreparingAudio || isPlayingStory || playingDialogueSceneId !== null}
                className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {isPreparingAudio ? "Sesler hazırlanıyor..." : "Sesleri Hazırla"}
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
                {isPlayingStory ? "Hikayeyi Durdur" : "Hikayeyi Dinle"}
              </button>

              <button
                onClick={handleExportMovie}
                disabled={isExportingMovie || readyExportCount === 0}
                className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {isExportingMovie
                  ? "Film oluşturuluyor..."
                  : `🎞 Filmi Oluştur (${readyExportCount})`}
              </button>
              </div>
            </div>

            {exportedMovieUrl && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">Final Film</h3>
                  <p className="mt-1 text-sm text-gray-300">
                    Sahne videoları birleştirildi. Aşağıdan izleyebilir, indirebilir veya linki paylaşabilirsin.
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
                  <a
                    href={exportMovieResult?.downloadUrl || exportedMovieUrl}
                    download={exportMovieResult?.fileName || true}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:scale-105"
                  >
                    Download
                  </a>

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
                  <h2 className="text-2xl font-bold">Sahneler</h2>
                  <p className="mt-1 text-sm text-slate-300">Her sahne kartı üretim, ses, video ve export kararını aynı yüzeyde gösterir.</p>
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
                              Son sahne
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold text-white">Production Scene Card</h3>
                          <p className="mt-1 max-w-2xl text-sm text-slate-300">
                            Bu kart sahnenin hikâye, ses, video ve export kararını tek bakışta yönetmen için tasarlandı.
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
                          ? "Video oluşturuluyor..."
                          : "🎬 Videoya Çevir"}
                      </button>

                      <button
                        onClick={() => {
                          setEditingSceneId(scene.id);
                          setBranchingSceneId(null);
                        }}
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                      >
                        Sahneyi Düzenle
                      </button>

                      <button
                        onClick={() => {
                          setBranchingSceneId(scene.id);
                          setEditingSceneId(null);
                        }}
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                      >
                        Bu Sahneden Sonra Devam Et
                      </button>

                      <button
                        onClick={() => redrawSceneImage(scene)}
                        disabled={redrawLoadingId === scene.id}
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {redrawLoadingId === scene.id ? "Yeniden çiziliyor..." : "Yeniden Çiz"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Scene previews</p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className={`rounded-full px-2.5 py-1 ${hasImage ? "border border-green-500/30 bg-green-500/10 text-green-200" : "border border-white/15 bg-white/5 text-slate-400"}`}>
                            {hasImage ? "Image ready" : "Image pending"}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 ${hasVideo ? "border border-green-500/30 bg-green-500/10 text-green-200" : "border border-white/15 bg-white/5 text-slate-400"}`}>
                            {hasVideo ? "Video ready" : "Video pending"}
                          </span>
                        </div>
                      </div>

                      {scene.image ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">Hazır sahne görseli</p>
                          <img
                            src={scene.image}
                            alt={`Sahne ${scene.id} görseli`}
                            className="w-full rounded-2xl border border-white/10 bg-black/30 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          Bu sahne için henüz görsel önizleme yok. Görsel üretildiğinde burada görünecek.
                        </div>
                      )}

                      {scene.videoUrl && scene.videoStatus === "done" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">Hazır sahne videosu</p>
                          <video
                            src={scene.videoUrl}
                            controls
                            playsInline
                            className="w-full rounded-2xl border border-white/10 bg-black/30"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          Bu sahne için henüz video önizleme yok. Video hazır olduğunda burada görünecek.
                        </div>
                      )}
                    </div>
                  </div>

                    
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                  <div className="flex flex-wrap gap-3">
                    <span>🎯 Hedef: {(scene.timing?.targetSceneDuration || TARGET_SCENE_DURATION_SECONDS).toFixed(1)} sn</span>
                    <span>🎤 Konuşma: {(scene.timing?.totalAudioDuration || 0).toFixed(1)} sn</span>
                    <span>🧊 Freeze: {(scene.timing?.freezeDuration || 0).toFixed(1)} sn</span>
                  </div>

                  {(scene.timing?.maxSpeechDuration || TARGET_SCENE_DURATION_SECONDS * MAX_SPEECH_RATIO) <
                  (scene.timing?.totalAudioDuration || 0) ? (
                    <p className="mt-2 text-rose-300">⚠️ Konuşma bu sahne için fazla uzun. Düzenleyip kısalt.</p>
                  ) : (
                    <p className="mt-2 text-emerald-300">✅ Sahne ve konuşma süresi uyumlu.</p>
                  )}
                </div>

{editingSceneId === scene.id && (
                      <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                        <label className="block text-sm text-gray-300">
                          Bu sahnede neyi değiştirmek istiyorsun?
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
                          placeholder="Buraya bir robot gelsin, sahne daha komik olsun..."
                        />

                        <div className="flex gap-3">
                          <button
                            onClick={() => updateScene(scene.id)}
                            disabled={sceneLoadingId === scene.id}
                            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                          >
                            {sceneLoadingId === scene.id ? "Güncelleniyor..." : "Sahneyi Güncelle"}
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
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}

                    {branchingSceneId === scene.id && (
                      <div className="mt-4 space-y-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                        <label className="block text-sm text-yellow-100">
                          Bu sahneden sonra hikaye nasıl devam etsin?
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
                          placeholder="Örn: Bu sahneden sonra çocuklar gizli bir geçit keşfetsin."
                        />

                        <p className="text-xs text-gray-300">
                          Bu işlem, bu sahneden sonraki mevcut akışı kaldırır ve yeni bir devam sahnesi üretir.
                        </p>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleBranchFromScene(scene.id)}
                            disabled={branchLoadingId === scene.id}
                            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                          >
                            {branchLoadingId === scene.id ? "Yeni akış yazılıyor..." : "Bu Noktadan Devam Et"}
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
                            Vazgeç
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
                <h3 className="text-xl font-semibold">Son Sahneden Devam Et</h3>
                <p className="mt-1 text-sm text-gray-300">
                  Hikayenin mevcut son sahnesinden sonra ne olmasını istediğini yaz.
                </p>
              </div>

              <textarea
                className="min-h-28 w-full rounded-xl border border-gray-700 bg-white p-4 text-black placeholder:text-gray-500"
                value={continuePrompt}
                onChange={(e) => setContinuePrompt(e.target.value)}
                placeholder="Örn: Çocuklar mağaranın içinde parlayan bir kapı bulsun."
              />

              <div>
                <button
                  onClick={handleContinueStory}
                  disabled={isContinuing}
                  className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
                >
                  {isContinuing ? "Devam yazılıyor..." : "Devamını Yaz"}
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