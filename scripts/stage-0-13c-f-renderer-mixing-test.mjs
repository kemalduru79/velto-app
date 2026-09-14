import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCreatorAudioMixPlan, CreatorAudioMixPlanError, CREATOR_AUDIO_RENDER_DEFAULTS } from "../export-service/src/creatorAudioMixPlan.js";

const scenes = (durations = [1000, 2000, 3000]) => durations.map((durationMs, index) => ({
  creatorSceneId: `scene-${index + 1}`, durationMs,
  speech: index === 1 ? [{ kind: "narration", startOffsetMs: 100, durationMs: 700 }] : [],
}));
const asset = (id) => ({ assetId: id, origin: "uploaded", mediaKind: "music", durationMs: 60_000, rights: { status: "creator_attested" } });
const runtime = (...ids) => ids.map((assetId) => ({ assetId, localPath: `/fixture/${assetId}.mp3` }));
const placement = (id, startScene, startEdge, endScene, endEdge, overrides = {}) => ({
  id: `placement-${id}`, kind: "music", asset: asset(id),
  range: { start: { sceneId: startScene, edge: startEdge, offsetMs: 0 }, end: { sceneId: endScene, edge: endEdge, offsetMs: 0 } },
  sourceInMs: 0, gain: 0.5, status: "active", ...overrides,
});
const timeline = (placements) => ({
  version: 1, timingBasis: "scene_anchored", musicIntent: { mode: placements.length ? "browse" : "none" }, placements,
  master: { version: 1, gains: { narration: 1, music: 0.8, ambience: 1, sfx: 1 }, limiter: { enabled: true, ceiling: 0.95 } },
});
const plan = (placements, finalizedScenes = scenes(), ids = placements.map((item) => item.asset?.assetId).filter(Boolean)) =>
  resolveCreatorAudioMixPlan({ timeline: timeline(placements), finalizedScenes, assets: runtime(...ids) });

const defaultOnly = plan([placement("a", "scene-1", "start", "scene-3", "end")]);
assert.deepEqual(defaultOnly.music.map(({ assetId, startMs, endMs }) => ({ assetId, startMs, endMs })), [{ assetId: "a", startMs: 0, endMs: 6000 }]);

const changed = plan([
  placement("a", "scene-1", "start", "scene-3", "start"),
  placement("b", "scene-3", "start", "scene-3", "end"),
]);
assert.deepEqual(changed.music.map(({ assetId, startMs, endMs }) => [assetId, startMs, endMs]), [["a", 0, 3000], ["b", 3000, 6000]]);

const replaced = plan([
  placement("c", "scene-1", "start", "scene-3", "start"),
  placement("b", "scene-3", "start", "scene-3", "end"),
]);
assert.deepEqual(replaced.music.map(({ assetId }) => assetId), ["c", "b"], "default replacement preserves explicit change");

const laterStart = plan([placement("d", "scene-2", "start", "scene-3", "end")]);
assert.equal(laterStart.music[0].startMs, 1000, "No Music remains silent before explicit start");

const stopped = plan([placement("a", "scene-1", "start", "scene-3", "end")], scenes([1000, 2000, 2500]));
assert.equal(stopped.music[0].endMs, 5500, "stop-after anchor resolves to scene end");

const multiple = plan([
  placement("a", "scene-1", "start", "scene-2", "start"),
  placement("b", "scene-2", "start", "scene-3", "start"),
  placement("c", "scene-3", "start", "scene-3", "end"),
]);
assert.deepEqual(multiple.transitions.map(({ atMs }) => atMs), [1000, 3000]);
assert.deepEqual(multiple.speech, [{ creatorSceneId: "scene-2", kind: "narration", startMs: 1100, endMs: 1800 }]);
assert.deepEqual(multiple.duckingWindows, [{ startMs: 1100, endMs: 1800, gain: 0.24, attackMs: 180, releaseMs: 500 }]);
assert.equal(multiple.music[0].gain, 0.072);
assert.equal(CREATOR_AUDIO_RENDER_DEFAULTS.musicBedGain, 0.18, "unity canonical music is rendered at a spoken-word-safe bed level");
assert.ok(CREATOR_AUDIO_RENDER_DEFAULTS.duckingGain >= 0.18 && CREATOR_AUDIO_RENDER_DEFAULTS.duckingGain <= 0.30);
assert.ok(CREATOR_AUDIO_RENDER_DEFAULTS.duckingAttackMs > 0 && CREATOR_AUDIO_RENDER_DEFAULTS.duckingReleaseMs > CREATOR_AUDIO_RENDER_DEFAULTS.duckingAttackMs);
const adjacentSpeech = plan(
  [placement("a", "scene-1", "start", "scene-1", "end")],
  [{ creatorSceneId: "scene-1", durationMs: 2000, speech: [
    { kind: "narration", startOffsetMs: 100, durationMs: 700 },
    { kind: "dialogue", startOffsetMs: 900, durationMs: 600 },
  ] }],
);
assert.deepEqual(adjacentSpeech.duckingWindows.map(({ startMs, endMs }) => ({ startMs, endMs })), [{ startMs: 100, endMs: 1500 }], "nearby speech is one bounded duck window instead of multiplying envelopes");
assert.equal(multiple.music[0].fadeInMs, 350);
assert.equal(multiple.music[0].fadeOutMs, 350);
assert.deepEqual(plan(multiple.music.length ? [placement("a", "scene-1", "start", "scene-3", "end")] : []).music[0].fadeInMs, 350);

const canonical = timeline([placement("a", "scene-1", "start", "scene-3", "end")]);
const before = structuredClone(canonical);
const variable = resolveCreatorAudioMixPlan({ timeline: canonical, finalizedScenes: scenes([1500, 2500, 4000]), assets: runtime("a") });
assert.equal(variable.music[0].endMs, 8000);
assert.deepEqual(canonical, before);
assert.equal(JSON.stringify(canonical).includes("startMs"), false, "absolute milliseconds are not persisted");

assert.throws(() => plan([placement("a", "missing", "start", "scene-3", "end")]), (error) => error instanceof CreatorAudioMixPlanError && error.code === "AUDIO_ANCHOR_UNRESOLVED");
assert.throws(() => plan([placement("a", "scene-1", "start", "scene-3", "end")], scenes(), []), /AUDIO_ASSET_NOT_RENDERABLE/);
assert.throws(() => resolveCreatorAudioMixPlan({ timeline: timeline([placement("a", "scene-1", "start", "scene-3", "end")]), finalizedScenes: scenes(), assets: [{ assetId: "a", localPath: "/preview", previewOnly: true }] }), /AUDIO_ASSET_NOT_RENDERABLE/);
assert.throws(() => plan([{ ...placement("a", "scene-1", "start", "scene-3", "end"), asset: { ...asset("a"), rights: { status: "unknown" } } }]), /AUDIO_ASSET_RIGHTS_NOT_RENDERABLE/);
assert.throws(() => plan([
  placement("a", "scene-1", "start", "scene-3", "end"),
  placement("b", "scene-2", "start", "scene-3", "end"),
]), /AUDIO_PLACEMENTS_OVERLAP/);
assert.throws(() => resolveCreatorAudioMixPlan({ timeline: timeline([placement("project-a", "scene-1", "start", "scene-3", "end")]), finalizedScenes: scenes(), assets: runtime("project-b") }), /AUDIO_ASSET_NOT_RENDERABLE/, "project asset sets cannot cross-resolve");

const routeSource = readFileSync(new URL("../app/api/creator-export/route.ts", import.meta.url), "utf8");
const audioRenderabilitySource = readFileSync(new URL("../lib/creator/audioRenderability.server.ts", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("../export-service/src/server.js", import.meta.url), "utf8");
assert.match(routeSource, /persistedCreatorState\?\.production\.audioTimeline/);
assert.match(routeSource, /resolveCreatorAudioRenderability/);
assert.match(audioRenderabilitySource, /resolveOwnedCreatorAudioAsset/);
assert.doesNotMatch(routeSource.slice(routeSource.indexOf('if \(productProfile === "creatorlab"\)')), /exportPayload\.backgroundMusic\s*=/);
assert.match(rendererSource, /resolveCreatorAudioMixPlan\(\{ timeline: body\.audioTimeline, finalizedScenes: finalizedAudioScenes/);
assert.match(rendererSource, /A required narration asset is missing/);
assert.match(rendererSource, /mixFinalVideoWithCreatorAudioPlan/);
assert.match(rendererSource, /volume='if\(lt\(t,[\s\S]*:eval=frame/, "ducking uses deterministic smooth gain automation");
assert.match(rendererSource, /amix=inputs=\$\{musicLabels\.length \+ 1\}:duration=first:dropout_transition=0:normalize=0\$\{limiter\}/);
assert.match(rendererSource, /alimiter=limit=/, "master limiter remains in the canonical final mix");

console.log("Stage 0.13C-F canonical renderer mixing tests passed.");
