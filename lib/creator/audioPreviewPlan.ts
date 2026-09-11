import { CREATOR_AUDIO_MIX_POLICY } from "../../export-service/src/creatorAudioPolicy.js";
import { normalizeCreatorAudioTimeline, type CreatorAudioPlacement, type CreatorAudioTimeline } from "./audioTimeline.ts";
import { normalizeCreatorPremiumMusicTrackId } from "./musicLibrary.ts";

export type CreatorAudioPreviewSceneInput = {
  creatorSceneId: string;
  durationMs: number;
  narrationDurationMs?: number;
  dialogueDurationMs?: number;
};

export type CreatorAudioPreviewMusic = {
  placementId: string;
  assetId: string;
  trackId: string;
  previewAuthority: "provider_preview";
  provesExportEntitlement: false;
  gain: number;
  duckedGain: number;
  duckingMode: "none" | "under_speech";
  fadeInMs: number;
  fadeOutMs: number;
};

export type CreatorAudioPreviewScene = {
  creatorSceneId: string;
  startMs: number;
  endMs: number;
  music?: CreatorAudioPreviewMusic;
  musicUnavailable: boolean;
  speechWindows: Array<{ startMs: number; endMs: number }>;
};

const validRights = (placement: CreatorAudioPlacement) =>
  placement.asset && ["verified", "creator_attested"].includes(placement.asset.rights.status);

const catalogTrackId = (placement: CreatorAudioPlacement) => {
  const assetId = placement.asset?.assetId || "";
  return assetId.startsWith("catalog:")
    ? normalizeCreatorPremiumMusicTrackId(assetId.slice("catalog:".length))
    : undefined;
};

/** Derives ephemeral preview timing from canonical scene anchors without mutating persistence. */
export function deriveCreatorAudioPreviewPlan(input: {
  timeline: CreatorAudioTimeline;
  scenes: CreatorAudioPreviewSceneInput[];
}) {
  const timeline = normalizeCreatorAudioTimeline(input.timeline);
  const boundaries = new Map<string, { startMs: number; endMs: number; index: number }>();
  let cursor = 0;
  for (const [index, scene] of input.scenes.entries()) {
    if (!scene.creatorSceneId || !Number.isFinite(scene.durationMs) || scene.durationMs <= 0) continue;
    boundaries.set(scene.creatorSceneId, { startMs: cursor, endMs: cursor + scene.durationMs, index });
    cursor += scene.durationMs;
  }
  const activeMusic = timeline.placements.filter((placement) =>
    placement.kind === "music" && placement.status === "active" && validRights(placement));
  const resolved = activeMusic.flatMap((placement) => {
    const startScene = boundaries.get(placement.range.start.sceneId);
    const endScene = boundaries.get(placement.range.end.sceneId);
    if (!startScene || !endScene) return [];
    const startMs = (placement.range.start.edge === "start" ? startScene.startMs : startScene.endMs) + placement.range.start.offsetMs;
    const endMs = (placement.range.end.edge === "start" ? endScene.startMs : endScene.endMs) + placement.range.end.offsetMs;
    if (startMs < 0 || endMs <= startMs || endMs > cursor + 1) return [];
    return [{ placement, startMs, endMs, trackId: catalogTrackId(placement) }];
  });
  const scenes: CreatorAudioPreviewScene[] = input.scenes.flatMap((scene) => {
    const boundary = boundaries.get(scene.creatorSceneId);
    if (!boundary) return [];
    const active = resolved.find(({ startMs, endMs }) => startMs < boundary.endMs && endMs > boundary.startMs);
    const narrationMs = Math.max(0, Number(scene.narrationDurationMs) || 0);
    const dialogueMs = Math.max(0, Number(scene.dialogueDurationMs) || 0);
    const speechWindows = [] as Array<{ startMs: number; endMs: number }>;
    if (narrationMs > 0) speechWindows.push({ startMs: boundary.startMs, endMs: Math.min(boundary.endMs, boundary.startMs + narrationMs) });
    if (dialogueMs > 0) {
      const dialogueStart = Math.min(boundary.endMs, boundary.startMs + narrationMs);
      speechWindows.push({ startMs: dialogueStart, endMs: Math.min(boundary.endMs, dialogueStart + dialogueMs) });
    }
    const gain = active
      ? active.placement.gain * timeline.master.gains.music * CREATOR_AUDIO_MIX_POLICY.musicBedGain
      : 0;
    return [{
      creatorSceneId: scene.creatorSceneId,
      startMs: boundary.startMs,
      endMs: boundary.endMs,
      ...(active?.trackId && active.placement.asset ? { music: {
        placementId: active.placement.id,
        assetId: active.placement.asset.assetId,
        trackId: active.trackId,
        previewAuthority: "provider_preview" as const,
        provesExportEntitlement: false as const,
        gain,
        duckedGain: gain * CREATOR_AUDIO_MIX_POLICY.duckingGain,
        duckingMode: active.placement.ducking?.mode || CREATOR_AUDIO_MIX_POLICY.duckingMode,
        fadeInMs: active.placement.fades?.inMs ?? CREATOR_AUDIO_MIX_POLICY.fadeInMs,
        fadeOutMs: active.placement.fades?.outMs ?? CREATOR_AUDIO_MIX_POLICY.fadeOutMs,
      } } : {}),
      musicUnavailable: Boolean(active && !active.trackId),
      speechWindows,
    }];
  });
  return { version: 1 as const, timingAuthority: "derived_preview" as const, durationMs: cursor, scenes };
}
