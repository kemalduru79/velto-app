export const CREATOR_AUDIO_TIMELINE_VERSION = 1 as const;
export const CREATOR_AUDIO_MASTER_MIX_VERSION = 1 as const;

export type CreatorAudioPlacementKind = "music" | "ambience" | "sfx";
export type CreatorAudioAssetOrigin =
  | "uploaded"
  | "licensed_catalog"
  | "generated"
  | "system";
export type CreatorAudioRightsStatus =
  | "verified"
  | "creator_attested"
  | "unknown"
  | "expired"
  | "revoked";

export type CreatorAudioRightsMetadata = {
  status: CreatorAudioRightsStatus;
  referenceId?: string;
  acquiredAt?: string;
  expiresAt?: string;
  territory?: string;
  creatorAttestedAt?: string;
};

export type CreatorAudioAssetReference = {
  assetId: string;
  origin: CreatorAudioAssetOrigin;
  mediaKind: CreatorAudioPlacementKind;
  durationMs?: number;
  rights: CreatorAudioRightsMetadata;
};

export type CreatorAudioSceneAnchor = {
  sceneId: string;
  edge: "start" | "end";
  offsetMs: number;
};

/** The end anchor is exclusive. Absolute milliseconds are derived, never persisted. */
export type CreatorAudioSceneAnchoredRange = {
  start: CreatorAudioSceneAnchor;
  end: CreatorAudioSceneAnchor;
};

export type CreatorAudioPlacement = {
  id: string;
  kind: CreatorAudioPlacementKind;
  asset: CreatorAudioAssetReference;
  range: CreatorAudioSceneAnchoredRange;
  sourceInMs: number;
  sourceOutMs?: number;
  gain: number;
  fades?: { inMs?: number; outMs?: number };
  ducking?: { mode: "none" | "under_speech" };
  status: "active" | "stale" | "unresolved";
};

export type CreatorAudioMasterMix = {
  version: typeof CREATOR_AUDIO_MASTER_MIX_VERSION;
  gains: {
    narration: number;
    music: number;
    ambience: number;
    sfx: number;
  };
  limiter: { enabled: boolean; ceiling: number };
};

export type CreatorAudioTimeline = {
  version: typeof CREATOR_AUDIO_TIMELINE_VERSION;
  timingBasis: "scene_anchored";
  placements: CreatorAudioPlacement[];
  master: CreatorAudioMasterMix;
};

export const DEFAULT_CREATOR_AUDIO_MASTER_MIX: CreatorAudioMasterMix = {
  version: CREATOR_AUDIO_MASTER_MIX_VERSION,
  gains: { narration: 1, music: 1, ambience: 1, sfx: 1 },
  limiter: { enabled: true, ceiling: 0.95 },
};

export const EMPTY_CREATOR_AUDIO_TIMELINE: CreatorAudioTimeline = {
  version: CREATOR_AUDIO_TIMELINE_VERSION,
  timingBasis: "scene_anchored",
  placements: [],
  master: DEFAULT_CREATOR_AUDIO_MASTER_MIX,
};

export class CreatorAudioTimelineError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CreatorAudioTimelineError";
    this.code = code;
  }
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const own = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const requiredText = (value: unknown, code: string, maximum = 256) => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new CreatorAudioTimelineError(code);
  }
  return value.trim();
};
const finite = (value: unknown, code: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CreatorAudioTimelineError(code);
  }
  return value;
};
const nonNegative = (value: unknown, code: string) => {
  const number = finite(value, code);
  if (number < 0) throw new CreatorAudioTimelineError(code);
  return number;
};
const positive = (value: unknown, code: string) => {
  const number = finite(value, code);
  if (number <= 0) throw new CreatorAudioTimelineError(code);
  return number;
};
const optionalText = (value: unknown, maximum = 256) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : undefined;

function normalizeRights(value: unknown): CreatorAudioRightsMetadata {
  const source = record(value);
  const statuses = new Set<CreatorAudioRightsStatus>([
    "verified", "creator_attested", "unknown", "expired", "revoked",
  ]);
  if (!source || !statuses.has(source.status as CreatorAudioRightsStatus)) {
    throw new CreatorAudioTimelineError("AUDIO_RIGHTS_STATUS_INVALID");
  }
  return {
    status: source.status as CreatorAudioRightsStatus,
    ...(optionalText(source.referenceId) ? { referenceId: optionalText(source.referenceId) } : {}),
    ...(optionalText(source.acquiredAt, 100) ? { acquiredAt: optionalText(source.acquiredAt, 100) } : {}),
    ...(optionalText(source.expiresAt, 100) ? { expiresAt: optionalText(source.expiresAt, 100) } : {}),
    ...(optionalText(source.territory, 120) ? { territory: optionalText(source.territory, 120) } : {}),
    ...(optionalText(source.creatorAttestedAt, 100)
      ? { creatorAttestedAt: optionalText(source.creatorAttestedAt, 100) }
      : {}),
  };
}

function normalizeAsset(value: unknown, kind: CreatorAudioPlacementKind): CreatorAudioAssetReference {
  const source = record(value);
  const origins = new Set<CreatorAudioAssetOrigin>([
    "uploaded", "licensed_catalog", "generated", "system",
  ]);
  if (!source) throw new CreatorAudioTimelineError("AUDIO_ASSET_INVALID");
  if (!origins.has(source.origin as CreatorAudioAssetOrigin)) {
    throw new CreatorAudioTimelineError("AUDIO_ASSET_ORIGIN_INVALID");
  }
  if (source.mediaKind !== kind) {
    throw new CreatorAudioTimelineError("AUDIO_ASSET_KIND_MISMATCH");
  }
  const durationMs = own(source, "durationMs")
    ? nonNegative(source.durationMs, "AUDIO_ASSET_DURATION_INVALID")
    : undefined;
  if (durationMs === 0) throw new CreatorAudioTimelineError("AUDIO_ASSET_DURATION_INVALID");
  return {
    assetId: requiredText(source.assetId, "AUDIO_ASSET_ID_REQUIRED"),
    origin: source.origin as CreatorAudioAssetOrigin,
    mediaKind: kind,
    ...(durationMs !== undefined ? { durationMs } : {}),
    rights: normalizeRights(source.rights),
  };
}

function normalizeAnchor(value: unknown): CreatorAudioSceneAnchor {
  const source = record(value);
  if (!source || (source.edge !== "start" && source.edge !== "end")) {
    throw new CreatorAudioTimelineError("AUDIO_ANCHOR_INVALID");
  }
  return {
    sceneId: requiredText(source.sceneId, "AUDIO_ANCHOR_SCENE_ID_REQUIRED"),
    edge: source.edge,
    offsetMs: finite(source.offsetMs, "AUDIO_ANCHOR_OFFSET_INVALID"),
  };
}

function normalizePlacement(value: unknown): CreatorAudioPlacement {
  const source = record(value);
  const range = record(source?.range);
  const kinds = new Set<CreatorAudioPlacementKind>(["music", "ambience", "sfx"]);
  const statuses = new Set(["active", "stale", "unresolved"]);
  if (!source || !kinds.has(source.kind as CreatorAudioPlacementKind)) {
    throw new CreatorAudioTimelineError("AUDIO_PLACEMENT_KIND_INVALID");
  }
  if (!range) throw new CreatorAudioTimelineError("AUDIO_RANGE_INVALID");
  if (!statuses.has(source.status as string)) {
    throw new CreatorAudioTimelineError("AUDIO_PLACEMENT_STATUS_INVALID");
  }
  const kind = source.kind as CreatorAudioPlacementKind;
  const asset = normalizeAsset(source.asset, kind);
  const sourceInMs = nonNegative(source.sourceInMs, "AUDIO_SOURCE_IN_INVALID");
  const sourceOutMs = own(source, "sourceOutMs")
    ? nonNegative(source.sourceOutMs, "AUDIO_SOURCE_OUT_INVALID")
    : undefined;
  if (sourceOutMs !== undefined && sourceOutMs <= sourceInMs) {
    throw new CreatorAudioTimelineError("AUDIO_SOURCE_RANGE_INVALID");
  }
  if (asset.durationMs !== undefined && (
    sourceInMs >= asset.durationMs ||
    (sourceOutMs !== undefined && sourceOutMs > asset.durationMs)
  )) throw new CreatorAudioTimelineError("AUDIO_SOURCE_BOUNDS_INVALID");

  const fades = own(source, "fades") ? record(source.fades) : null;
  if (own(source, "fades") && !fades) throw new CreatorAudioTimelineError("AUDIO_FADES_INVALID");
  const inMs = fades && own(fades, "inMs")
    ? nonNegative(fades.inMs, "AUDIO_FADE_IN_INVALID")
    : undefined;
  const outMs = fades && own(fades, "outMs")
    ? nonNegative(fades.outMs, "AUDIO_FADE_OUT_INVALID")
    : undefined;
  const ducking = own(source, "ducking") ? record(source.ducking) : null;
  if (own(source, "ducking") && (!ducking || !["none", "under_speech"].includes(String(ducking.mode)))) {
    throw new CreatorAudioTimelineError("AUDIO_DUCKING_INVALID");
  }
  return {
    id: requiredText(source.id, "AUDIO_PLACEMENT_ID_REQUIRED"),
    kind,
    asset,
    range: {
      start: normalizeAnchor(range.start),
      end: normalizeAnchor(range.end),
    },
    sourceInMs,
    ...(sourceOutMs !== undefined ? { sourceOutMs } : {}),
    gain: finite(source.gain, "AUDIO_GAIN_INVALID"),
    ...(fades ? { fades: {
      ...(inMs !== undefined ? { inMs } : {}),
      ...(outMs !== undefined ? { outMs } : {}),
    } } : {}),
    ...(ducking ? { ducking: { mode: ducking.mode as "none" | "under_speech" } } : {}),
    status: source.status as CreatorAudioPlacement["status"],
  };
}

function normalizeMaster(value: unknown): CreatorAudioMasterMix {
  const source = record(value);
  const gains = record(source?.gains);
  const limiter = record(source?.limiter);
  if (source?.version !== CREATOR_AUDIO_MASTER_MIX_VERSION || !gains || !limiter) {
    throw new CreatorAudioTimelineError("AUDIO_MASTER_MIX_INVALID");
  }
  return {
    version: CREATOR_AUDIO_MASTER_MIX_VERSION,
    gains: {
      narration: finite(gains.narration, "AUDIO_MASTER_GAIN_INVALID"),
      music: finite(gains.music, "AUDIO_MASTER_GAIN_INVALID"),
      ambience: finite(gains.ambience, "AUDIO_MASTER_GAIN_INVALID"),
      sfx: finite(gains.sfx, "AUDIO_MASTER_GAIN_INVALID"),
    },
    limiter: {
      enabled: limiter.enabled === true,
      ceiling: finite(limiter.ceiling, "AUDIO_LIMITER_CEILING_INVALID"),
    },
  };
}

export function normalizeCreatorAudioTimeline(value: unknown): CreatorAudioTimeline {
  const source = record(value);
  if (!source || source.version !== CREATOR_AUDIO_TIMELINE_VERSION) {
    throw new CreatorAudioTimelineError("AUDIO_TIMELINE_VERSION_UNSUPPORTED");
  }
  if (source.timingBasis !== "scene_anchored" || !Array.isArray(source.placements)) {
    throw new CreatorAudioTimelineError("AUDIO_TIMELINE_INVALID");
  }
  const placements = source.placements.map(normalizePlacement);
  if (new Set(placements.map((placement) => placement.id)).size !== placements.length) {
    throw new CreatorAudioTimelineError("AUDIO_PLACEMENT_ID_DUPLICATE");
  }
  return {
    version: CREATOR_AUDIO_TIMELINE_VERSION,
    timingBasis: "scene_anchored",
    placements,
    master: normalizeMaster(source.master),
  };
}

export type CreatorAudioTimelineField =
  | { state: "omitted" }
  | { state: "null"; value: null }
  | { state: "value"; value: CreatorAudioTimeline };

export function readCreatorAudioTimelineField(container: unknown): CreatorAudioTimelineField {
  const source = record(container);
  if (!source || !own(source, "audioTimeline")) return { state: "omitted" };
  if (source.audioTimeline === null) return { state: "null", value: null };
  return { state: "value", value: normalizeCreatorAudioTimeline(source.audioTimeline) };
}

export type CreatorLegacyMusicIntent = {
  legacyTrackId: string;
  gain?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  duckingMode?: "none" | "under_speech";
};

export type CreatorLegacyMusicMigration =
  | { state: "none"; timeline: CreatorAudioTimeline }
  | ({ state: "pending"; reason: "asset_or_scene_anchors_required" | "legacy_mix_intent_required" } & CreatorLegacyMusicIntent)
  | { state: "converted"; timeline: CreatorAudioTimeline };

export function convertLegacyCreatorBackgroundMusic(
  value: unknown,
  context: { assetId?: string; sceneIds?: string[] } = {},
): CreatorLegacyMusicMigration {
  const source = record(value);
  const trackId = optionalText(source?.selectedTrackId, 128);
  if (!source || source.mode !== "selected" || !trackId) {
    return { state: "none", timeline: EMPTY_CREATOR_AUDIO_TIMELINE };
  }
  const intent: CreatorLegacyMusicIntent = {
    legacyTrackId: trackId,
    ...(own(source, "volume") && typeof source.volume === "number" && Number.isFinite(source.volume)
      ? { gain: source.volume }
      : {}),
    ...(own(source, "fadeInSec") && typeof source.fadeInSec === "number" &&
      Number.isFinite(source.fadeInSec) && source.fadeInSec >= 0
      ? { fadeInMs: source.fadeInSec * 1000 }
      : {}),
    ...(own(source, "fadeOutSec") && typeof source.fadeOutSec === "number" &&
      Number.isFinite(source.fadeOutSec) && source.fadeOutSec >= 0
      ? { fadeOutMs: source.fadeOutSec * 1000 }
      : {}),
    ...(typeof source.autoDucking === "boolean"
      ? { duckingMode: source.autoDucking ? "under_speech" as const : "none" as const }
      : {}),
  };
  const sceneIds = (context.sceneIds || []).filter(Boolean);
  if (!context.assetId || sceneIds.length === 0) {
    return { state: "pending", ...intent, reason: "asset_or_scene_anchors_required" };
  }
  if (intent.gain === undefined) {
    return { state: "pending", ...intent, reason: "legacy_mix_intent_required" };
  }
  return {
    state: "converted",
    timeline: {
      ...EMPTY_CREATOR_AUDIO_TIMELINE,
      placements: [{
        id: `legacy-music:${context.assetId}`,
        kind: "music",
        asset: {
          assetId: context.assetId,
          origin: "licensed_catalog",
          mediaKind: "music",
          rights: { status: "unknown" },
        },
        range: {
          start: { sceneId: sceneIds[0], edge: "start", offsetMs: 0 },
          end: { sceneId: sceneIds.at(-1)!, edge: "end", offsetMs: 0 },
        },
        sourceInMs: 0,
        gain: intent.gain,
        ...(intent.fadeInMs !== undefined || intent.fadeOutMs !== undefined
          ? { fades: {
            ...(intent.fadeInMs !== undefined ? { inMs: intent.fadeInMs } : {}),
            ...(intent.fadeOutMs !== undefined ? { outMs: intent.fadeOutMs } : {}),
          } }
          : {}),
        ...(intent.duckingMode !== undefined ? { ducking: { mode: intent.duckingMode } } : {}),
        status: "active",
      }],
    },
  };
}

export type CreatorAudioReconciliationScene = {
  creatorSceneId: string;
  scriptSectionId?: string;
  scriptSegmentIndex?: number;
};

export type CreatorAudioReconciliationIssue = {
  placementId: string;
  code: "anchor_missing" | "anchor_ambiguous" | "range_inverted";
  sceneId?: string;
};

function hintMatches(left: CreatorAudioReconciliationScene, right: CreatorAudioReconciliationScene) {
  return Boolean(left.scriptSectionId) && left.scriptSectionId === right.scriptSectionId &&
    Number.isInteger(left.scriptSegmentIndex) && left.scriptSegmentIndex === right.scriptSegmentIndex;
}

export function reconcileCreatorAudioTimeline(input: {
  timeline: CreatorAudioTimeline;
  previousScenes: CreatorAudioReconciliationScene[];
  nextScenes: CreatorAudioReconciliationScene[];
}) {
  const timeline = normalizeCreatorAudioTimeline(input.timeline);
  const previousById = new Map(input.previousScenes.map((scene) => [scene.creatorSceneId, scene]));
  const nextIndex = new Map(input.nextScenes.map((scene, index) => [scene.creatorSceneId, index]));
  const issues: CreatorAudioReconciliationIssue[] = [];

  const placements = timeline.placements.map((placement) => {
    let unresolved = false;
    const resolveAnchor = (anchor: CreatorAudioSceneAnchor) => {
      if (nextIndex.has(anchor.sceneId)) return anchor;
      const previous = previousById.get(anchor.sceneId);
      const candidates = previous
        ? input.nextScenes.filter((scene) => hintMatches(previous, scene))
        : [];
      if (candidates.length === 1) return { ...anchor, sceneId: candidates[0].creatorSceneId };
      unresolved = true;
      issues.push({
        placementId: placement.id,
        code: candidates.length > 1 ? "anchor_ambiguous" : "anchor_missing",
        sceneId: anchor.sceneId,
      });
      return anchor;
    };
    const start = resolveAnchor(placement.range.start);
    const end = resolveAnchor(placement.range.end);
    if (unresolved) return { ...placement, range: { start, end }, status: "unresolved" as const };
    if (nextIndex.get(start.sceneId)! > nextIndex.get(end.sceneId)!) {
      issues.push({ placementId: placement.id, code: "range_inverted" });
      return { ...placement, range: { start, end }, status: "stale" as const };
    }
    return { ...placement, range: { start, end }, status: "active" as const };
  });
  return { timeline: { ...timeline, placements }, issues };
}

export type CreatorFinalizedAudioScene = {
  creatorSceneId: string;
  durationMs: number;
};

export type CreatorResolvedAudioPlacement = {
  id: string;
  kind: CreatorAudioPlacementKind;
  assetId: string;
  startMs: number;
  endMs: number;
  sourceInMs: number;
  sourceOutMs?: number;
  gain: number;
  fadeInMs: number;
  fadeOutMs: number;
  duckingMode: "none" | "under_speech";
  review: Array<"source_range_exceeds_placement" | "source_duration_too_short">;
};

const KIND_PRIORITY: Record<CreatorAudioPlacementKind, number> = {
  music: 0,
  ambience: 1,
  sfx: 2,
};

/** Caller must supply durations finalized by the renderer; planned client timing is rejected. */
export function resolveCreatorAudioTimeline(input: {
  timeline: CreatorAudioTimeline;
  timingAuthority: "finalized_render";
  finalizedScenes: CreatorFinalizedAudioScene[];
}) {
  if (input.timingAuthority !== "finalized_render") {
    throw new CreatorAudioTimelineError("AUDIO_FINALIZED_TIMING_REQUIRED");
  }
  const timeline = normalizeCreatorAudioTimeline(input.timeline);
  const boundaries = new Map<string, { startMs: number; endMs: number; index: number }>();
  let cursor = 0;
  input.finalizedScenes.forEach((scene, index) => {
    const sceneId = requiredText(scene.creatorSceneId, "AUDIO_FINALIZED_SCENE_ID_REQUIRED");
    if (boundaries.has(sceneId)) throw new CreatorAudioTimelineError("AUDIO_FINALIZED_SCENE_ID_DUPLICATE");
    const durationMs = positive(scene.durationMs, "AUDIO_FINALIZED_DURATION_INVALID");
    boundaries.set(sceneId, { startMs: cursor, endMs: cursor + durationMs, index });
    cursor += durationMs;
  });
  const placements: CreatorResolvedAudioPlacement[] = timeline.placements.map((placement) => {
    if (placement.status !== "active") throw new CreatorAudioTimelineError("AUDIO_PLACEMENT_NOT_RENDERABLE");
    const startScene = boundaries.get(placement.range.start.sceneId);
    const endScene = boundaries.get(placement.range.end.sceneId);
    if (!startScene || !endScene) throw new CreatorAudioTimelineError("AUDIO_ANCHOR_UNRESOLVED");
    const startBoundary = placement.range.start.edge === "start" ? startScene.startMs : startScene.endMs;
    const endBoundary = placement.range.end.edge === "start" ? endScene.startMs : endScene.endMs;
    const startMs = startBoundary + placement.range.start.offsetMs;
    const endMs = endBoundary + placement.range.end.offsetMs;
    if (startMs < 0 || endMs <= startMs || startScene.index > endScene.index) {
      throw new CreatorAudioTimelineError("AUDIO_RANGE_NOT_RENDERABLE");
    }
    const placementDuration = endMs - startMs;
    const requestedSourceDuration = placement.sourceOutMs === undefined
      ? undefined
      : placement.sourceOutMs - placement.sourceInMs;
    const availableSourceDuration = placement.asset.durationMs === undefined
      ? undefined
      : placement.asset.durationMs - placement.sourceInMs;
    const review: CreatorResolvedAudioPlacement["review"] = [];
    if (requestedSourceDuration !== undefined && requestedSourceDuration > placementDuration) {
      review.push("source_range_exceeds_placement");
    }
    if (availableSourceDuration !== undefined && availableSourceDuration < placementDuration) {
      review.push("source_duration_too_short");
    }
    return {
      id: placement.id,
      kind: placement.kind,
      assetId: placement.asset.assetId,
      startMs,
      endMs,
      sourceInMs: placement.sourceInMs,
      ...(placement.sourceOutMs !== undefined ? { sourceOutMs: placement.sourceOutMs } : {}),
      gain: placement.gain,
      fadeInMs: placement.fades?.inMs || 0,
      fadeOutMs: placement.fades?.outMs || 0,
      duckingMode: placement.ducking?.mode || "none",
      review,
    };
  });
  placements.sort((left, right) =>
    left.startMs - right.startMs ||
    KIND_PRIORITY[left.kind] - KIND_PRIORITY[right.kind] ||
    left.id.localeCompare(right.id));
  return { durationMs: cursor, placements };
}

/** Speech remains scene-owned; this render-only type is intentionally not an AudioPlacement. */
export type CreatorDerivedSpeechRange = {
  creatorSceneId: string;
  startMs: number;
  endMs: number;
  kind: "narration" | "dialogue";
};
