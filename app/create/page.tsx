"use client";
import { useEffect, useRef, useState } from "react";

type SceneTiming = {
  narrationDuration: number;
  dialogueDuration: number;
  totalAudioDuration: number;
  targetSceneDuration: number;
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

const DEFAULT_VIDEO_DURATION_SECONDS = 4;
const MIN_SCENE_DURATION_SECONDS = 3.5;
const FREEZE_TOLERANCE_SECONDS = 0.35;

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
  const targetSceneDuration = Math.max(
    totalAudioDuration,
    MIN_SCENE_DURATION_SECONDS
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
    freezeDuration,
    needsFreezeFrame,
  };
};

export default function CreatePage() {
  const [input, setInput] = useState("");
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
          duration: 4,
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
    const videoScenes = scenes.filter(
      (scene) => scene.videoUrl && scene.videoStatus === "done"
    );

    if (videoScenes.length === 0) {
      setError("Film oluşturmak için en az bir hazır sahne videosu gerekli.");
      return;
    }

    setIsExportingMovie(true);
    setError("");
    setSaveMessage("");
    setExportedMovieUrl("");

    try {
      const res = await fetch("/api/export-movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          projectId: getProjectKey(),
          scenes: videoScenes.map((scene) => ({
            ...scene,
            timing: scene.timing || buildSceneTiming(0, 0),
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok || !data.movieUrl) {
        throw new Error(data?.error || "Film export işlemi başarısız oldu.");
      }

      setExportedMovieUrl(data.movieUrl);
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

    const res = await fetch("/api/save-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: currentProjectId || undefined,
        title,
        inputPrompt: input,
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

    setIsSavingProject(true);
    setError("");
    setSaveMessage("");

    try {
      await persistProject(true);
    } catch {
      setError("Kaydetme sırasında hata oluştu.");
    } finally {
      setIsSavingProject(false);
    }
  };

  const loadProject = async () => {
    if (!loadProjectId.trim()) {
      setError("Lütfen bir proje ID gir.");
      return;
    }

    setIsLoadingProject(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch(`/api/load-project/${loadProjectId}`, {
        method: "GET",
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
      setTitle(project.title || "");
      setInput(project.input_prompt || "");
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
    } catch {
      setError("Yükleme sırasında hata oluştu.");
    } finally {
      setIsLoadingProject(false);
    }
  };

  const createSetup = async () => {
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
        body: JSON.stringify({ prompt: input }),
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

    try {
      const res = await fetch("/api/build-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
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

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">VELTO</h1>
          <p className="text-gray-300">
            Önce karakterleri ve görsel dünyayı kur, sonra hikayeyi sahnelere dönüştür.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-xl font-semibold">Kayıtlı Projeyi Yükle</h2>

          <input
            className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
            placeholder="Proje ID gir"
            value={loadProjectId}
            onChange={(e) => setLoadProjectId(e.target.value)}
          />

          <div className="flex justify-center">
            <button
              onClick={loadProject}
              disabled={isLoadingProject}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
            >
              {isLoadingProject ? "Yükleniyor..." : "Projeyi Yükle"}
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <label className="block text-sm font-medium text-gray-300">
            Nasıl bir hikaye yapmak istiyorsun?
          </label>

          <textarea
            className="min-h-36 w-full rounded-xl border border-gray-700 bg-white p-4 text-black placeholder:text-gray-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Örn: 3 kardeşin ormandaki gizemli macerası"
          />

          <div className="flex justify-center">
            <button
              onClick={createSetup}
              disabled={loadingSetup}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-105 disabled:opacity-50"
            >
              {loadingSetup ? "Kurulum hazırlanıyor..." : "Karakterleri Oluştur"}
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

        {setupReady && (
          <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
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
                disabled={isExportingMovie || readyVideoCount === 0}
                className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              >
                {isExportingMovie
                  ? "Film oluşturuluyor..."
                  : `🎞 Filmi Oluştur (${readyVideoCount})`}
              </button>
            </div>

            {exportedMovieUrl && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">Final Film</h3>
                  <p className="mt-1 text-sm text-gray-300">
                    Sahne videoları birleştirildi. Aşağıdan izleyebilirsin.
                  </p>
                </div>

                <video
                  src={exportedMovieUrl}
                  controls
                  className="w-full rounded-xl"
                />

                <a
                  href={exportedMovieUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-lg border border-white/20 px-4 py-2 text-sm"
                >
                  Yeni sekmede aç
                </a>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Sahneler</h2>

              {scenes.map((scene) => {
                const isLastScene = scene.id === scenes[scenes.length - 1]?.id;
                const isAudioReady = getSceneAudioStatus(scene);

                return (
                  <div
                    key={scene.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="mb-2 text-lg font-semibold">Sahne {scene.id}</h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            isAudioReady
                              ? "border border-green-500/30 bg-green-500/10 text-green-200"
                              : "border border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                          }`}
                        >
                          {isAudioReady ? "Ses hazır" : "Ses hazır değil"}
                        </span>

                        <span
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
                            ? "Video hazır"
                            : scene.videoStatus === "processing"
                            ? "Video hazırlanıyor"
                            : scene.videoStatus === "error"
                            ? "Video hatası"
                            : "Video yok"}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            playingDialogueSceneId === scene.id
                              ? "border border-pink-500/30 bg-pink-500/10 text-pink-200"
                              : "border border-white/20 bg-white/5 text-gray-300"
                          }`}
                        >
                          {playingDialogueSceneId === scene.id
                            ? "Diyalog oynuyor"
                            : "Diyalog hazır"}
                        </span>
                      </div>

                      {isLastScene && (
                        <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-gray-300">
                          Son sahne
                        </span>
                      )}
                    </div>

                    <p className="text-gray-200">{scene.text}</p>

                    <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-200">
                      <p><strong>Anlatıcı:</strong> {scene.narration}</p>
                      <p><strong>Diyalog:</strong> {scene.dialogue || "Yok"}</p>
                      <p><strong>Kamera:</strong> {scene.cameraDirection}</p>
                      <p><strong>Duygu:</strong> {scene.emotion}</p>
                      <p><strong>Hareket:</strong> {scene.motionHint}</p>
                    </div>

                    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-50">
                      <p className="mb-2 font-semibold">Sahne Zamanlama Analizi</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <p>
                          <strong>Narration:</strong>{" "}
                          {scene.timing?.narrationDuration?.toFixed(2) || "0.00"} sn
                        </p>
                        <p>
                          <strong>Dialogue:</strong>{" "}
                          {scene.timing?.dialogueDuration?.toFixed(2) || "0.00"} sn
                        </p>
                        <p>
                          <strong>Toplam Ses:</strong>{" "}
                          {scene.timing?.totalAudioDuration?.toFixed(2) || "0.00"} sn
                        </p>
                        <p>
                          <strong>Hedef Sahne Süresi:</strong>{" "}
                          {scene.timing?.targetSceneDuration?.toFixed(2) || "0.00"} sn
                        </p>
                        <p>
                          <strong>Freeze Süresi:</strong>{" "}
                          {scene.timing?.freezeDuration?.toFixed(2) || "0.00"} sn
                        </p>
                        <p>
                          <strong>Karar:</strong>{" "}
                          {scene.timing?.needsFreezeFrame
                            ? "Video sonuna freeze gerekli"
                            : "Mevcut video süresi yeterli"}
                        </p>
                      </div>
                    </div>

                    {scene.image ? (
                      <img
                        src={scene.image}
                        alt={`Sahne ${scene.id}`}
                        className="mt-4 w-full rounded-xl"
                      />
                    ) : (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                        {redrawLoadingId === scene.id
                          ? "Görsel yeniden hazırlanıyor..."
                          : "Görsel hazırlanıyor..."}
                      </div>
                    )}

                    {scene.videoUrl && (
                      <video
                        src={scene.videoUrl}
                        controls
                        className="mt-4 w-full rounded-xl"
                      />
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
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
    </main>
  );
}