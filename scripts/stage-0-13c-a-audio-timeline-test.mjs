import assert from "node:assert/strict";
import {
  DEFAULT_CREATOR_AUDIO_MASTER_MIX,
  convertLegacyCreatorBackgroundMusic,
  normalizeCreatorAudioTimeline,
  readCreatorAudioTimelineField,
  reconcileCreatorAudioTimeline,
  resolveCreatorAudioTimeline,
} from "../lib/creator/audioTimeline.ts";

const scenes = (...ids) => ids.map((creatorSceneId) => ({ creatorSceneId }));
const asset = (assetId, mediaKind = "music", extra = {}) => ({
  assetId, origin: "uploaded", mediaKind, rights: { status: "creator_attested" }, ...extra,
});
const placement = (id, start, end, extra = {}) => ({
  id, kind: "music", asset: asset(`asset-${id}`),
  range: {
    start: { sceneId: start, edge: "start", offsetMs: 0 },
    end: { sceneId: end, edge: "end", offsetMs: 0 },
  },
  sourceInMs: 0, gain: 0.16, fades: { inMs: 1500, outMs: 2000 },
  ducking: { mode: "under_speech" }, status: "active", ...extra,
});
const timeline = (placements = []) => ({
  version: 1, timingBasis: "scene_anchored", placements,
  master: DEFAULT_CREATOR_AUDIO_MASTER_MIX,
});
const rejects = (value, code) => assert.throws(
  () => normalizeCreatorAudioTimeline(value),
  (error) => error?.code === code,
);
const withNumeric = (field, value) => {
  const candidate = placement(`numeric-${field}`, "A", "B");
  if (field === "offsetMs") candidate.range.start.offsetMs = value;
  else candidate[field] = value;
  return timeline([candidate]);
};

const sanitized = normalizeCreatorAudioTimeline({
  ...timeline([{
    ...placement("one", "A", "D"), provider: "must-disappear",
    asset: { ...asset("asset-one"), provider: "must-disappear", rights: { status: "verified", providerLicense: "discard", referenceId: "policy-1" } },
  }]),
  renderer: { filter: "discard" },
});
assert.equal(sanitized.placements.length, 1, "valid timeline normalizes");
assert.equal("provider" in sanitized.placements[0], false, "placement provider metadata is discarded");
assert.equal("provider" in sanitized.placements[0].asset, false, "asset provider metadata is discarded");
assert.deepEqual(sanitized.placements[0].asset.rights, { status: "verified", referenceId: "policy-1" });
assert.equal("renderer" in sanitized, false, "renderer metadata is discarded");

rejects({ ...timeline(), version: 2 }, "AUDIO_TIMELINE_VERSION_UNSUPPORTED");
rejects(timeline([{ ...placement("bad", "A", "B"), range: { start: { sceneId: "A", edge: "middle", offsetMs: 0 }, end: { sceneId: "B", edge: "end", offsetMs: 0 } } }]), "AUDIO_ANCHOR_INVALID");
rejects(timeline([{ ...placement("bad", "A", "B"), kind: "narration" }]), "AUDIO_PLACEMENT_KIND_INVALID");
rejects(timeline([{ ...placement("bad", "A", "B"), sourceInMs: -1 }]), "AUDIO_SOURCE_IN_INVALID");
rejects(timeline([{ ...placement("bad", "A", "B"), gain: Infinity }]), "AUDIO_GAIN_INVALID");
rejects(timeline([{ ...placement("bad", "A", "B"), fades: { inMs: -1 } }]), "AUDIO_FADE_IN_INVALID");
rejects(timeline([{ ...placement("bad", "A", "B"), ducking: { mode: "provider_magic" } }]), "AUDIO_DUCKING_INVALID");
rejects(timeline([placement("duplicate", "A", "B"), placement("duplicate", "B", "C")]), "AUDIO_PLACEMENT_ID_DUPLICATE");
rejects(timeline([{ ...placement("bad", "A", "B"), range: { start: null, end: placement("x", "A", "B").range.end } }]), "AUDIO_ANCHOR_INVALID");
for (const field of ["offsetMs", "sourceInMs", "gain"]) {
  const code = field === "offsetMs" ? "AUDIO_ANCHOR_OFFSET_INVALID"
    : field === "sourceInMs" ? "AUDIO_SOURCE_IN_INVALID" : "AUDIO_GAIN_INVALID";
  for (const invalid of [null, "", "   ", "0", false, true, Number.NaN, Infinity, -Infinity]) {
    rejects(withNumeric(field, invalid), code);
  }
}
assert.equal(normalizeCreatorAudioTimeline(withNumeric("offsetMs", 0)).placements[0].range.start.offsetMs, 0);
assert.equal(normalizeCreatorAudioTimeline(withNumeric("sourceInMs", 0)).placements[0].sourceInMs, 0);
assert.equal(normalizeCreatorAudioTimeline(withNumeric("gain", 0)).placements[0].gain, 0);
for (const invalidSourceOut of [null, "", "   ", "100", false, Number.NaN, Infinity, -Infinity]) {
  rejects(timeline([{ ...placement("source-out", "A", "B"), sourceOutMs: invalidSourceOut }]), "AUDIO_SOURCE_OUT_INVALID");
}

const preservedEdges = normalizeCreatorAudioTimeline(timeline([{
  ...placement("edges", "A", "C"),
  range: {
    start: { sceneId: "A", edge: "end", offsetMs: -100 },
    end: { sceneId: "C", edge: "start", offsetMs: 100 },
  },
}]));
assert.deepEqual(preservedEdges.placements[0].range, {
  start: { sceneId: "A", edge: "end", offsetMs: -100 },
  end: { sceneId: "C", edge: "start", offsetMs: 100 },
});

assert.deepEqual(readCreatorAudioTimelineField({}), { state: "omitted" });
assert.deepEqual(readCreatorAudioTimelineField({ audioTimeline: null }), { state: "null", value: null });
assert.equal(readCreatorAudioTimelineField({ audioTimeline: timeline() }).state, "value");

assert.equal(convertLegacyCreatorBackgroundMusic({ mode: "none" }).state, "none");
const pending = convertLegacyCreatorBackgroundMusic({
  mode: "selected", selectedTrackId: "track-1", volume: 0.2,
  autoDucking: false, fadeInSec: 1.25, fadeOutSec: 2.5,
});
assert.deepEqual(pending, {
  state: "pending", legacyTrackId: "track-1", gain: 0.2,
  fadeInMs: 1250, fadeOutMs: 2500, duckingMode: "none",
  reason: "asset_or_scene_anchors_required",
});
const sparsePending = convertLegacyCreatorBackgroundMusic({ mode: "selected", selectedTrackId: "track-sparse" });
assert.deepEqual(sparsePending, {
  state: "pending", legacyTrackId: "track-sparse", reason: "asset_or_scene_anchors_required",
}, "absent legacy values are not invented");
const converted = convertLegacyCreatorBackgroundMusic(
  { mode: "selected", selectedTrackId: "track-1", volume: 0.2, autoDucking: true, fadeInSec: 1, fadeOutSec: 2 },
  { assetId: "velto-asset-1", sceneIds: ["A", "B", "C", "D"] },
);
assert.equal(converted.state, "converted");
assert.equal(converted.timeline.placements.length, 1, "whole-video legacy music becomes one placement");
assert.equal(converted.timeline.placements[0].range.start.sceneId, "A");
assert.equal(converted.timeline.placements[0].range.end.sceneId, "D");
assert.equal(converted.timeline.placements[0].gain, 0.2);
assert.deepEqual(converted.timeline.placements[0].fades, { inMs: 1000, outMs: 2000 });
assert.deepEqual(converted.timeline.placements[0].ducking, { mode: "under_speech" });

const edgeCases = [
  ["start", "start", 0, 3000],
  ["start", "end", 0, 4000],
  ["end", "start", 1000, 3000],
  ["end", "end", 1000, 4000],
];
for (const [startEdge, endEdge, expectedStart, expectedEnd] of edgeCases) {
  const edgeResolved = resolveCreatorAudioTimeline({
    timeline: timeline([{
      ...placement(`${startEdge}-${endEdge}`, "A", "C"),
      range: {
        start: { sceneId: "A", edge: startEdge, offsetMs: 0 },
        end: { sceneId: "C", edge: endEdge, offsetMs: 0 },
      },
    }]),
    timingAuthority: "finalized_render",
    finalizedScenes: ["A", "B", "C"].map((creatorSceneId) => ({ creatorSceneId, durationMs: creatorSceneId === "B" ? 2000 : 1000 })),
  });
  assert.deepEqual([edgeResolved.placements[0].startMs, edgeResolved.placements[0].endMs], [expectedStart, expectedEnd]);
}

const continuous = timeline([placement("continuous", "A", "D")]);
const continuousResolved = resolveCreatorAudioTimeline({
  timeline: continuous, timingAuthority: "finalized_render",
  finalizedScenes: ["A", "B", "C", "D"].map((creatorSceneId) => ({ creatorSceneId, durationMs: 1000 })),
});
assert.equal(continuousResolved.placements.length, 1, "multi-scene music remains one continuous placement");
assert.deepEqual([continuousResolved.placements[0].startMs, continuousResolved.placements[0].endMs], [0, 4000]);
const mixedContinuous = timeline([{
  ...placement("mixed-continuous", "A", "D"),
  range: {
    start: { sceneId: "A", edge: "end", offsetMs: 0 },
    end: { sceneId: "D", edge: "start", offsetMs: 0 },
  },
}]);
const mixedContinuousResolved = resolveCreatorAudioTimeline({
  timeline: mixedContinuous, timingAuthority: "finalized_render",
  finalizedScenes: ["A", "B", "C", "D"].map((creatorSceneId) => ({ creatorSceneId, durationMs: 1000 })),
});
assert.equal(mixedContinuousResolved.placements.length, 1);
assert.deepEqual([mixedContinuousResolved.placements[0].startMs, mixedContinuousResolved.placements[0].endMs], [1000, 3000]);

const changes = timeline([placement("track-b", "C", "E"), placement("track-a", "A", "B")]);
const changesResolved = resolveCreatorAudioTimeline({
  timeline: changes, timingAuthority: "finalized_render",
  finalizedScenes: ["A", "B", "C", "D", "E"].map((creatorSceneId) => ({ creatorSceneId, durationMs: 1000 })),
});
assert.deepEqual(changesResolved.placements.map((item) => item.id), ["track-a", "track-b"]);

const reordered = reconcileCreatorAudioTimeline({
  timeline: timeline([{
    ...placement("range", "A", "D"),
    range: {
      start: { sceneId: "A", edge: "end", offsetMs: 0 },
      end: { sceneId: "D", edge: "start", offsetMs: 0 },
    },
  }]),
  previousScenes: scenes("A", "B", "C", "D"), nextScenes: scenes("A", "C", "B", "D"),
});
assert.equal(reordered.timeline.placements[0].status, "active");
assert.deepEqual(reordered.timeline.placements[0].range, {
  start: { sceneId: "A", edge: "end", offsetMs: 0 },
  end: { sceneId: "D", edge: "start", offsetMs: 0 },
});
const reorderedResolved = resolveCreatorAudioTimeline({
  timeline: reordered.timeline, timingAuthority: "finalized_render",
  finalizedScenes: ["A", "C", "B", "D"].map((creatorSceneId) => ({ creatorSceneId, durationMs: 1000 })),
});
assert.equal(reorderedResolved.placements[0].endMs, 3000, "range follows reordered stable anchors");

const inverted = reconcileCreatorAudioTimeline({
  timeline: timeline([{
    ...placement("range", "A", "C"),
    range: {
      start: { sceneId: "A", edge: "end", offsetMs: 0 },
      end: { sceneId: "C", edge: "start", offsetMs: 0 },
    },
  }]),
  previousScenes: scenes("A", "B", "C"), nextScenes: scenes("C", "B", "A"),
});
assert.equal(inverted.timeline.placements[0].status, "stale");
assert.equal(inverted.issues[0].code, "range_inverted");

const inserted = reconcileCreatorAudioTimeline({
  timeline: timeline([placement("range", "A", "C")]),
  previousScenes: scenes("A", "B", "C"), nextScenes: scenes("A", "B", "X", "C"),
});
assert.equal(inserted.timeline.placements[0].status, "active");
const insertedResolved = resolveCreatorAudioTimeline({
  timeline: inserted.timeline, timingAuthority: "finalized_render",
  finalizedScenes: ["A", "B", "X", "C"].map((creatorSceneId) => ({ creatorSceneId, durationMs: 1000 })),
});
assert.equal(insertedResolved.placements[0].endMs, 4000, "inserted scene is naturally spanned");

const deleted = reconcileCreatorAudioTimeline({
  timeline: timeline([placement("range", "A", "C")]),
  previousScenes: scenes("A", "B", "C"), nextScenes: scenes("A", "B"),
});
assert.equal(deleted.timeline.placements.length, 1);
assert.equal(deleted.timeline.placements[0].status, "unresolved");
assert.equal(deleted.timeline.placements[0].range.end.sceneId, "C", "deleted anchor identity is preserved");

const beforeDuration = timeline([placement("range", "A", "B")]);
const short = resolveCreatorAudioTimeline({ timeline: beforeDuration, timingAuthority: "finalized_render", finalizedScenes: [{ creatorSceneId: "A", durationMs: 1000 }, { creatorSceneId: "B", durationMs: 1000 }] });
const long = resolveCreatorAudioTimeline({ timeline: beforeDuration, timingAuthority: "finalized_render", finalizedScenes: [{ creatorSceneId: "A", durationMs: 2500 }, { creatorSceneId: "B", durationMs: 1000 }] });
assert.equal(short.placements[0].endMs, 2000);
assert.equal(long.placements[0].endMs, 3500);
assert.deepEqual(beforeDuration.placements[0].range, placement("x", "A", "B").range, "duration changes do not mutate anchors");
const endBoundaryTimeline = timeline([{
  ...placement("end-boundary", "A", "B"),
  range: {
    start: { sceneId: "A", edge: "end", offsetMs: 0 },
    end: { sceneId: "B", edge: "end", offsetMs: 0 },
  },
}]);
const endBoundaryShort = resolveCreatorAudioTimeline({ timeline: endBoundaryTimeline, timingAuthority: "finalized_render", finalizedScenes: [{ creatorSceneId: "A", durationMs: 1000 }, { creatorSceneId: "B", durationMs: 1000 }] });
const endBoundaryLong = resolveCreatorAudioTimeline({ timeline: endBoundaryTimeline, timingAuthority: "finalized_render", finalizedScenes: [{ creatorSceneId: "A", durationMs: 2500 }, { creatorSceneId: "B", durationMs: 1000 }] });
assert.deepEqual([endBoundaryShort.placements[0].startMs, endBoundaryShort.placements[0].endMs], [1000, 2000]);
assert.deepEqual([endBoundaryLong.placements[0].startMs, endBoundaryLong.placements[0].endMs], [2500, 3500]);

for (const invalidDuration of [0, -1, Number.NaN, Infinity, "1000", null]) {
  assert.throws(
    () => resolveCreatorAudioTimeline({
      timeline: timeline(), timingAuthority: "finalized_render",
      finalizedScenes: [{ creatorSceneId: "A", durationMs: invalidDuration }],
    }),
    (error) => error?.code === "AUDIO_FINALIZED_DURATION_INVALID",
  );
}

const previousScenes = [
  { creatorSceneId: "old-a", scriptSectionId: "opening", scriptSegmentIndex: 0 },
  { creatorSceneId: "stable", scriptSectionId: "body", scriptSegmentIndex: 0 },
];
const stableRebuild = reconcileCreatorAudioTimeline({
  timeline: timeline([placement("stable", "stable", "stable")]), previousScenes,
  nextScenes: [{ creatorSceneId: "stable", scriptSectionId: "changed", scriptSegmentIndex: 9 }],
});
assert.equal(stableRebuild.timeline.placements[0].range.start.sceneId, "stable", "stable ID wins over hints");
const hintRebuild = reconcileCreatorAudioTimeline({
  timeline: timeline([placement("hint", "old-a", "old-a")]), previousScenes,
  nextScenes: [{ creatorSceneId: "new-a", scriptSectionId: "opening", scriptSegmentIndex: 0 }],
});
assert.equal(hintRebuild.timeline.placements[0].range.start.sceneId, "new-a");
assert.equal(hintRebuild.timeline.placements[0].status, "active");
const ambiguous = reconcileCreatorAudioTimeline({
  timeline: timeline([placement("ambiguous", "old-a", "old-a")]), previousScenes,
  nextScenes: [
    { creatorSceneId: "new-a", scriptSectionId: "opening", scriptSegmentIndex: 0 },
    { creatorSceneId: "new-b", scriptSectionId: "opening", scriptSegmentIndex: 0 },
  ],
});
assert.equal(ambiguous.timeline.placements[0].status, "unresolved");
assert.equal(ambiguous.timeline.placements[0].range.start.sceneId, "old-a");
assert.ok(ambiguous.issues.every((issue) => issue.code === "anchor_ambiguous"));

assert.throws(
  () => resolveCreatorAudioTimeline({ timeline: timeline(), timingAuthority: "planned_client", finalizedScenes: [] }),
  (error) => error?.code === "AUDIO_FINALIZED_TIMING_REQUIRED",
);
rejects(timeline([{ ...placement("offset", "A", "A"), sourceInMs: 900, sourceOutMs: 1100, asset: asset("offset", "music", { durationMs: 1000 }) }]), "AUDIO_SOURCE_BOUNDS_INVALID");
const offsetReview = resolveCreatorAudioTimeline({
  timeline: timeline([{ ...placement("offset", "A", "A"), sourceOutMs: 3000 }]),
  timingAuthority: "finalized_render", finalizedScenes: [{ creatorSceneId: "A", durationMs: 1000 }],
});
assert.deepEqual(offsetReview.placements[0].review, ["source_range_exceeds_placement"]);

const sameStartOrder = resolveCreatorAudioTimeline({
  timeline: timeline([
    { ...placement("z-sfx", "A", "A"), kind: "sfx", asset: asset("sfx", "sfx") },
    placement("z-music", "A", "A"), placement("a-music", "A", "A"),
    { ...placement("a-ambience", "A", "A"), kind: "ambience", asset: asset("ambience", "ambience") },
  ]),
  timingAuthority: "finalized_render", finalizedScenes: [{ creatorSceneId: "A", durationMs: 1000 }],
});
assert.deepEqual(sameStartOrder.placements.map((item) => item.id), ["a-music", "z-music", "a-ambience", "z-sfx"]);
assert.ok(sanitized.placements.every((item) => item.kind !== "narration" && item.kind !== "dialogue"), "narration is excluded from editable placements");

console.log("STAGE_0_13C_A_AUDIO_TIMELINE=PASS");
