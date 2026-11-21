import type { CreatorBackgroundMusicConfig } from "./backgroundMusic";
import {
  normalizeCreatorAudioTimeline,
  type CreatorAudioTimeline,
} from "./audioTimeline.ts";

export class CreatorFinalProductionSignatureError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CreatorFinalProductionSignatureError";
    this.code = code;
  }
}

export type ParsedCreatorFinalProductionSignature = {
  version: "creator-final-production-v2";
  scenes: Array<{
    creatorSceneId: string;
    exportSource: "image" | "video";
    selectedMedia: string;
    clipInSec: number;
    clipOutSec: number;
    timing: {
      targetSceneDuration: number;
      narrationDuration: number;
      dialogueDuration: number;
      speechTailBuffer: number;
    };
    visualCoveragePlan?: Array<{
      startSec: number;
      endSec: number;
      durationSec: number;
      kind: "image" | "video";
      source: string;
      sourceStartSec: number;
      renderer: string;
      motionPreset: string;
    }>;
  }>;
  audioTimeline?: CreatorAudioTimeline | null;
  backgroundMusic?:
    | { mode: "none" | "auto" }
    | { mode: "selected"; selectedTrackId: string; confirmedTrackId: string; volume: number; autoDucking: boolean; fadeInSec: number; fadeOutSec: number };
};

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
  visualCoveragePlan?: Array<{
    startSec?: number;
    endSec?: number;
    durationSec?: number;
    kind?: string;
    sourceUrl?: string;
    sourceStartSec?: number;
    renderer?: string;
    motionPreset?: string;
  }>;
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

function renderAudioTimeline(timeline: CreatorAudioTimeline) {
  const normalized = normalizeCreatorAudioTimeline(timeline);
  return {
    ...normalized,
    placements: [...normalized.placements].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  };
}

export function buildCreatorFinalProductionSignature(input: {
  scenes: FinalProductionScene[];
  backgroundMusic: CreatorBackgroundMusicConfig;
  audioTimeline?: CreatorAudioTimeline | null;
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
        ...(scene.visualCoveragePlan?.length ? {
          visualCoveragePlan: scene.visualCoveragePlan.map((beat) => ({
            startSec: Number(beat.startSec || 0),
            endSec: Number(beat.endSec || 0),
            durationSec: Number(beat.durationSec || 0),
            kind: beat.kind || "",
            source: canonicalCreatorMediaIdentity(beat.sourceUrl),
            sourceStartSec: Number(beat.sourceStartSec || 0),
            renderer: beat.renderer || "",
            motionPreset: beat.motionPreset || "",
          })),
        } : {}),
      })),
    ...(Object.prototype.hasOwnProperty.call(input, "audioTimeline")
      ? { audioTimeline: input.audioTimeline === null ? null : renderAudioTimeline(input.audioTimeline!) }
      : { backgroundMusic: renderMusicConfig(input.backgroundMusic) }),
  });
}

const signatureRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const signatureText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";
const signatureNumber = (value: unknown, code: string, positive = false) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (positive && value <= 0)) {
    throw new CreatorFinalProductionSignatureError(code);
  }
  return value;
};
const canonicalSignatureValue = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonicalSignatureValue)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalSignatureValue(item)]))
    : value;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

function parseCanonicalBackgroundMusic(value: unknown): NonNullable<ParsedCreatorFinalProductionSignature["backgroundMusic"]> {
  const music = signatureRecord(value);
  if (!music) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_BACKGROUND_MUSIC_INVALID");
  if (music.mode === "none" || music.mode === "auto") {
    if (!exactKeys(music, ["mode"])) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_BACKGROUND_MUSIC_INVALID");
    return { mode: music.mode };
  }
  const selectedKeys = ["mode", "selectedTrackId", "confirmedTrackId", "volume", "autoDucking", "fadeInSec", "fadeOutSec"] as const;
  if (music.mode !== "selected" || !exactKeys(music, selectedKeys) || !signatureText(music.selectedTrackId) || typeof music.confirmedTrackId !== "string" ||
      typeof music.autoDucking !== "boolean" || typeof music.volume !== "number" || !Number.isFinite(music.volume) || music.volume < 0.04 || music.volume > 0.3 ||
      typeof music.fadeInSec !== "number" || !Number.isFinite(music.fadeInSec) || music.fadeInSec < 0 || music.fadeInSec > 5 ||
      typeof music.fadeOutSec !== "number" || !Number.isFinite(music.fadeOutSec) || music.fadeOutSec < 0 || music.fadeOutSec > 8) {
    throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_BACKGROUND_MUSIC_INVALID");
  }
  return { mode: "selected", selectedTrackId: signatureText(music.selectedTrackId), confirmedTrackId: music.confirmedTrackId, volume: music.volume, autoDucking: music.autoDucking, fadeInSec: music.fadeInSec, fadeOutSec: music.fadeOutSec };
}

/** Strictly validates a persisted signature without repairing or defaulting malformed authority. */
export function parseCreatorFinalProductionSignature(value: unknown): ParsedCreatorFinalProductionSignature {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_JSON_INVALID");
  }
  const root = signatureRecord(parsed);
  if (!root || root.version !== "creator-final-production-v2" || !Array.isArray(root.scenes) || root.scenes.length === 0) {
    throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_SHAPE_INVALID");
  }
  const allowedRootKeys = new Set(["version", "scenes", "audioTimeline", "backgroundMusic"]);
  const hasAudioTimeline = Object.prototype.hasOwnProperty.call(root, "audioTimeline");
  const hasBackgroundMusic = Object.prototype.hasOwnProperty.call(root, "backgroundMusic");
  if (Object.keys(root).some((key) => !allowedRootKeys.has(key)) || hasAudioTimeline === hasBackgroundMusic) {
    throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_SHAPE_INVALID");
  }
  const seen = new Set<string>();
  const scenes = root.scenes.map((item) => {
    const scene = signatureRecord(item);
    const creatorSceneId = signatureText(scene?.creatorSceneId);
    if (!scene || !creatorSceneId || seen.has(creatorSceneId)) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_SCENE_ID_INVALID");
    seen.add(creatorSceneId);
    if (scene.exportSource !== "image" && scene.exportSource !== "video") throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_EXPORT_SOURCE_INVALID");
    const selectedMedia = signatureText(scene.selectedMedia);
    if (!selectedMedia) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_SELECTED_MEDIA_MISSING");
    const timing = signatureRecord(scene.timing);
    if (!timing) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_TIMING_INVALID");
    const result: ParsedCreatorFinalProductionSignature["scenes"][number] = {
      creatorSceneId,
      exportSource: scene.exportSource,
      selectedMedia,
      clipInSec: signatureNumber(scene.clipInSec, "FINAL_SIGNATURE_CLIP_INVALID"),
      clipOutSec: signatureNumber(scene.clipOutSec, "FINAL_SIGNATURE_CLIP_INVALID"),
      timing: {
        targetSceneDuration: signatureNumber(timing.targetSceneDuration, "FINAL_SIGNATURE_TIMING_INVALID", true),
        narrationDuration: signatureNumber(timing.narrationDuration, "FINAL_SIGNATURE_TIMING_INVALID"),
        dialogueDuration: signatureNumber(timing.dialogueDuration, "FINAL_SIGNATURE_TIMING_INVALID"),
        speechTailBuffer: signatureNumber(timing.speechTailBuffer, "FINAL_SIGNATURE_TIMING_INVALID"),
      },
    };
    if (scene.visualCoveragePlan !== undefined) {
      if (!Array.isArray(scene.visualCoveragePlan) || scene.visualCoveragePlan.length === 0) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_COVERAGE_INVALID");
      result.visualCoveragePlan = scene.visualCoveragePlan.map((rawBeat) => {
        const beat = signatureRecord(rawBeat);
        if (!beat || (beat.kind !== "image" && beat.kind !== "video") || !signatureText(beat.source) || !signatureText(beat.renderer)) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_COVERAGE_INVALID");
        const startSec = signatureNumber(beat.startSec, "FINAL_SIGNATURE_COVERAGE_INVALID");
        const endSec = signatureNumber(beat.endSec, "FINAL_SIGNATURE_COVERAGE_INVALID", true);
        const durationSec = signatureNumber(beat.durationSec, "FINAL_SIGNATURE_COVERAGE_INVALID", true);
        if (endSec <= startSec || Math.abs(durationSec - (endSec - startSec)) > 0.02) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_COVERAGE_INVALID");
        return { startSec, endSec, durationSec, kind: beat.kind, source: signatureText(beat.source), sourceStartSec: signatureNumber(beat.sourceStartSec, "FINAL_SIGNATURE_COVERAGE_INVALID"), renderer: signatureText(beat.renderer), motionPreset: typeof beat.motionPreset === "string" ? beat.motionPreset : "" };
      });
    }
    return result;
  });
  const result: ParsedCreatorFinalProductionSignature = { version: "creator-final-production-v2", scenes };
  if ("audioTimeline" in root) {
    if (root.audioTimeline === null) result.audioTimeline = null;
    else {
      const normalized = normalizeCreatorAudioTimeline(root.audioTimeline);
      if (JSON.stringify(canonicalSignatureValue(normalized)) !== JSON.stringify(canonicalSignatureValue(root.audioTimeline))) throw new CreatorFinalProductionSignatureError("FINAL_SIGNATURE_AUDIO_TIMELINE_NOT_CANONICAL");
      result.audioTimeline = normalized;
    }
  }
  if ("backgroundMusic" in root) result.backgroundMusic = parseCanonicalBackgroundMusic(root.backgroundMusic);
  return result;
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
