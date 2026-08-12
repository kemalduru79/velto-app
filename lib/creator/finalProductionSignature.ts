import type { CreatorBackgroundMusicConfig } from "./backgroundMusic";

type FinalProductionScene = {
  id: string | number;
  creatorSceneId?: string;
  renderMode?: string;
  exportSource: "video" | "image" | "none";
  image?: string;
  videoUrl?: string;
  clipInSec?: number;
  clipOutSec?: number;
  audioUrl?: string;
  dialogueAudioUrl?: string;
  timing?: {
    targetSceneDuration?: number;
    narrationDuration?: number;
    dialogueDuration?: number;
    speechTailBuffer?: number;
  } | null;
};

export function canonicalCreatorMediaIdentity(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return raw.split(/[?#]/, 1)[0];
  }
}

function renderMusicConfig(music: CreatorBackgroundMusicConfig) {
  if (music.mode !== "selected" || !music.selectedTrackId) {
    return { mode: music.mode };
  }
  return {
    mode: "selected" as const,
    selectedTrackId: music.selectedTrackId,
    confirmedTrackId: music.confirmedTrackId || "",
    volume: music.volume,
    autoDucking: music.autoDucking,
    fadeInSec: music.fadeInSec,
    fadeOutSec: music.fadeOutSec,
  };
}

export function buildCreatorFinalProductionSignature(input: {
  scenes: FinalProductionScene[];
  backgroundMusic: CreatorBackgroundMusicConfig;
}) {
  return JSON.stringify({
    version: "creator-final-production-v2",
    scenes: input.scenes
      .filter((scene) => scene.exportSource !== "none")
      .map((scene) => ({
        creatorSceneId: scene.creatorSceneId || `legacy-${scene.id}`,
        renderMode: scene.renderMode || scene.exportSource,
        exportSource: scene.exportSource,
        selectedMedia: canonicalCreatorMediaIdentity(
          scene.exportSource === "video" ? scene.videoUrl : scene.image,
        ),
        clipInSec: Number(scene.clipInSec || 0),
        clipOutSec: Number(scene.clipOutSec || 0),
        narrationAudio: canonicalCreatorMediaIdentity(scene.audioUrl),
        dialogueAudio: canonicalCreatorMediaIdentity(scene.dialogueAudioUrl),
        timing: {
          targetSceneDuration: Number(scene.timing?.targetSceneDuration || 0),
          narrationDuration: Number(scene.timing?.narrationDuration || 0),
          dialogueDuration: Number(scene.timing?.dialogueDuration || 0),
          speechTailBuffer: Number(scene.timing?.speechTailBuffer || 0),
        },
      })),
    backgroundMusic: renderMusicConfig(input.backgroundMusic),
  });
}

export function projectLegacyCreatorFinalProductionSignature(value: string) {
  try {
    const legacy = JSON.parse(value) as {
      scenes?: FinalProductionScene[];
      backgroundMusic?: CreatorBackgroundMusicConfig;
    };
    if (!Array.isArray(legacy.scenes) || !legacy.backgroundMusic) return "";
    return buildCreatorFinalProductionSignature({
      scenes: legacy.scenes,
      backgroundMusic: legacy.backgroundMusic,
    });
  } catch {
    return "";
  }
}
