export const CREATOR_AUDIO_RENDER_DEFAULTS = Object.freeze({
  fadeInMs: 350,
  fadeOutMs: 350,
  musicBedGain: 0.18,
  duckingMode: "under_speech",
  duckingGain: 0.24,
  duckingAttackMs: 180,
  duckingReleaseMs: 500,
});

export class CreatorAudioMixPlanError extends Error {
  constructor(code) {
    super(code);
    this.name = "CreatorAudioMixPlanError";
    this.code = code;
  }
}

const fail = (code) => { throw new CreatorAudioMixPlanError(code); };
const finite = (value, code) => Number.isFinite(value) ? Number(value) : fail(code);
const text = (value, code) => typeof value === "string" && value.trim() ? value.trim() : fail(code);

function resolveAnchor(anchor, boundaries) {
  if (!anchor || (anchor.edge !== "start" && anchor.edge !== "end")) fail("AUDIO_ANCHOR_INVALID");
  const boundary = boundaries.get(text(anchor.sceneId, "AUDIO_ANCHOR_SCENE_ID_REQUIRED"));
  if (!boundary) fail("AUDIO_ANCHOR_UNRESOLVED");
  return (anchor.edge === "start" ? boundary.startMs : boundary.endMs) + finite(anchor.offsetMs, "AUDIO_ANCHOR_OFFSET_INVALID");
}

/**
 * Resolves persisted scene anchors into an ephemeral final-render mix plan.
 * The input timeline is never mutated and absolute times are never persisted.
 */
export function resolveCreatorAudioMixPlan({ timeline, finalizedScenes, assets }) {
  if (!timeline || timeline.version !== 1 || timeline.timingBasis !== "scene_anchored" || !Array.isArray(timeline.placements)) {
    fail("AUDIO_TIMELINE_INVALID");
  }
  if (!Array.isArray(finalizedScenes) || finalizedScenes.length === 0) fail("AUDIO_FINALIZED_TIMING_REQUIRED");
  const runtimeAssets = new Map((Array.isArray(assets) ? assets : []).map((asset) => [asset?.assetId, asset]));
  const boundaries = new Map();
  const scenes = [];
  const speech = [];
  let cursor = 0;

  for (const [index, scene] of finalizedScenes.entries()) {
    const creatorSceneId = text(scene?.creatorSceneId, "AUDIO_FINALIZED_SCENE_ID_REQUIRED");
    if (boundaries.has(creatorSceneId)) fail("AUDIO_FINALIZED_SCENE_ID_DUPLICATE");
    const durationMs = finite(scene?.durationMs, "AUDIO_FINALIZED_DURATION_INVALID");
    if (durationMs <= 0) fail("AUDIO_FINALIZED_DURATION_INVALID");
    const boundary = { creatorSceneId, index, startMs: cursor, endMs: cursor + durationMs, durationMs };
    boundaries.set(creatorSceneId, boundary);
    scenes.push(boundary);
    for (const segment of Array.isArray(scene.speech) ? scene.speech : []) {
      if (segment?.kind !== "narration" && segment?.kind !== "dialogue") fail("AUDIO_SPEECH_SEGMENT_INVALID");
      const offsetMs = finite(segment.startOffsetMs, "AUDIO_SPEECH_SEGMENT_INVALID");
      const segmentDurationMs = finite(segment.durationMs, "AUDIO_SPEECH_SEGMENT_INVALID");
      if (offsetMs < 0 || segmentDurationMs <= 0 || offsetMs + segmentDurationMs > durationMs + 1) {
        fail("AUDIO_SPEECH_SEGMENT_INVALID");
      }
      speech.push({ creatorSceneId, kind: segment.kind, startMs: cursor + offsetMs, endMs: cursor + offsetMs + segmentDurationMs });
    }
    cursor += durationMs;
  }

  const music = [];
  for (const placement of timeline.placements) {
    if (placement?.kind !== "music") continue;
    if (placement.status !== "active") fail("AUDIO_PLACEMENT_NOT_RENDERABLE");
    const assetId = text(placement.asset?.assetId, "AUDIO_ASSET_INVALID");
    if (!["verified", "creator_attested"].includes(placement.asset?.rights?.status)) fail("AUDIO_ASSET_RIGHTS_NOT_RENDERABLE");
    const asset = runtimeAssets.get(assetId);
    if (!asset || asset.previewOnly === true || !asset.localPath) fail("AUDIO_ASSET_NOT_RENDERABLE");
    const startMs = resolveAnchor(placement.range?.start, boundaries);
    const endMs = resolveAnchor(placement.range?.end, boundaries);
    if (startMs < 0 || endMs <= startMs || endMs > cursor + 1) fail("AUDIO_RANGE_NOT_RENDERABLE");
    const sourceInMs = finite(placement.sourceInMs, "AUDIO_SOURCE_IN_INVALID");
    const sourceOutMs = placement.sourceOutMs === undefined ? undefined : finite(placement.sourceOutMs, "AUDIO_SOURCE_OUT_INVALID");
    if (sourceInMs < 0 || (sourceOutMs !== undefined && sourceOutMs <= sourceInMs)) fail("AUDIO_SOURCE_RANGE_INVALID");
    if (sourceOutMs !== undefined && sourceOutMs - sourceInMs < endMs - startMs) fail("AUDIO_SOURCE_RANGE_TOO_SHORT");
    const spanMs = endMs - startMs;
    const fadeInMs = Math.min(spanMs / 2, placement.fades?.inMs ?? CREATOR_AUDIO_RENDER_DEFAULTS.fadeInMs);
    const fadeOutMs = Math.min(spanMs / 2, placement.fades?.outMs ?? CREATOR_AUDIO_RENDER_DEFAULTS.fadeOutMs);
    music.push({
      placementId: text(placement.id, "AUDIO_PLACEMENT_ID_REQUIRED"), assetId, localPath: asset.localPath,
      startMs, endMs, sourceInMs, ...(sourceOutMs === undefined ? {} : { sourceOutMs }),
      gain: finite(placement.gain, "AUDIO_GAIN_INVALID") *
        finite(timeline.master?.gains?.music, "AUDIO_MASTER_GAIN_INVALID") *
        CREATOR_AUDIO_RENDER_DEFAULTS.musicBedGain,
      fadeInMs, fadeOutMs, duckingMode: placement.ducking?.mode ?? CREATOR_AUDIO_RENDER_DEFAULTS.duckingMode,
    });
  }
  music.sort((a, b) => a.startMs - b.startMs || a.placementId.localeCompare(b.placementId));
  for (let index = 1; index < music.length; index += 1) {
    if (music[index].startMs < music[index - 1].endMs) fail("AUDIO_PLACEMENTS_OVERLAP");
  }
  const mergedSpeechWindows = speech
    .map(({ startMs, endMs }) => ({ startMs, endMs }))
    .sort((left, right) => left.startMs - right.startMs)
    .reduce((windows, current) => {
      const previous = windows.at(-1);
      if (previous && current.startMs <= previous.endMs + CREATOR_AUDIO_RENDER_DEFAULTS.duckingReleaseMs) {
        previous.endMs = Math.max(previous.endMs, current.endMs);
      } else {
        windows.push({ ...current });
      }
      return windows;
    }, []);
  const duckingWindows = mergedSpeechWindows.map(({ startMs, endMs }) => ({
    startMs,
    endMs,
    gain: CREATOR_AUDIO_RENDER_DEFAULTS.duckingGain,
    attackMs: CREATOR_AUDIO_RENDER_DEFAULTS.duckingAttackMs,
    releaseMs: CREATOR_AUDIO_RENDER_DEFAULTS.duckingReleaseMs,
  }));
  return {
    version: 1, timingAuthority: "finalized_render", durationMs: cursor, scenes, speech, music,
    transitions: music.slice(1).map((segment, index) => ({ atMs: segment.startMs, fromPlacementId: music[index].placementId, toPlacementId: segment.placementId })),
    duckingWindows,
    master: { narrationGain: finite(timeline.master?.gains?.narration, "AUDIO_MASTER_GAIN_INVALID"), limiter: timeline.master?.limiter },
  };
}
