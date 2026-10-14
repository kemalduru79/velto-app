import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveCreatorAudioPreviewPlan,
  validateCreatorProjectPreviewAudio,
} from "../lib/creator/audioPreviewPlan.ts";
import { CREATOR_AUDIO_MIX_POLICY } from "../export-service/src/creatorAudioPolicy.js";

const sceneIds = ["scene-1", "scene-2", "scene-3"];
const scenes = (ids = sceneIds) => ids.map((creatorSceneId, index) => ({
  creatorSceneId,
  durationMs: 1000,
  narrationDurationMs: index === 1 ? 600 : 0,
}));
const asset = (id, rights = "verified") => ({ assetId: `catalog:${id}`, origin: "licensed_catalog", mediaKind: "music", rights: { status: rights } });
const placement = (id, startScene, startEdge, endScene, endEdge, overrides = {}) => ({
  id: `music-${id}`, kind: "music", asset: asset(id),
  range: { start: { sceneId: startScene, edge: startEdge, offsetMs: 0 }, end: { sceneId: endScene, edge: endEdge, offsetMs: 0 } },
  sourceInMs: 0, gain: 1, ducking: { mode: "under_speech" }, status: "active", ...overrides,
});
const timeline = (placements, mode = "browse") => ({
  version: 1, timingBasis: "scene_anchored", musicIntent: { mode }, placements,
  master: { version: 1, gains: { narration: 1, music: 1, ambience: 1, sfx: 1 }, limiter: { enabled: true, ceiling: 0.95 } },
});
const plan = (placements, inputScenes = scenes(), mode = "browse") =>
  deriveCreatorAudioPreviewPlan({ timeline: timeline(placements, mode), scenes: inputScenes });
const activeIds = (value) => value.scenes.map((scene) => scene.music?.trackId || null);

const previewAudioScene = (overrides = {}) => ({
  id: 1,
  hasNarration: true,
  narrationAudioUrl: "https://assets.test/narration.mp3",
  narrationState: "current",
  hasDialogue: false,
  dialogueState: "not_required",
  ...overrides,
});
assert.deepEqual(validateCreatorProjectPreviewAudio([previewAudioScene()]), {
  ready: true,
  unavailableSceneIds: [],
});
assert.deepEqual(validateCreatorProjectPreviewAudio([
  previewAudioScene({ id: 1, narrationAudioUrl: "", narrationState: "missing" }),
  previewAudioScene({ id: 2, narrationState: "stale" }),
  previewAudioScene({ id: 3, hasDialogue: true, dialogueAudioUrl: "", dialogueState: "missing" }),
  previewAudioScene({ id: 4, hasDialogue: true, dialogueAudioUrl: "https://assets.test/dialogue.mp3", dialogueState: "stale" }),
]), { ready: false, unavailableSceneIds: [1, 2, 3, 4] }, "missing and stale narration/dialogue are reported as advisory scene IDs");
assert.equal(validateCreatorProjectPreviewAudio([
  previewAudioScene({ hasDialogue: true, dialogueAudioUrl: "https://assets.test/dialogue.mp3", dialogueState: "current" }),
]).ready, true, "fully current narration and dialogue allow preview");

const defaultA = plan([placement("A", "scene-1", "start", "scene-3", "end")]);
assert.deepEqual(activeIds(defaultA), ["A", "A", "A"], "default A continues across scenes");

const changed = plan([
  placement("A", "scene-1", "start", "scene-2", "start"),
  placement("B", "scene-2", "start", "scene-3", "end"),
]);
assert.deepEqual(activeIds(changed), ["A", "B", "B"], "scene 2 change replaces default");

const stopped = plan([
  placement("A", "scene-1", "start", "scene-2", "start"),
  placement("B", "scene-2", "start", "scene-2", "end"),
]);
assert.deepEqual(activeIds(stopped), ["A", "B", null], "stop after scene 2 leaves scene 3 silent");

const laterStart = plan([placement("A", "scene-2", "start", "scene-3", "end")], scenes(), "none");
assert.deepEqual(activeIds(laterStart), [null, "A", "A"], "No Music can be overridden by an explicit later start");

const finalStop = plan([placement("A", "scene-1", "start", "scene-3", "end")]);
assert.equal(finalStop.scenes.at(-1).music?.trackId, "A", "end anchor includes the final scene");

const canonicalWins = deriveCreatorAudioPreviewPlan({ timeline: timeline([], "none"), scenes: scenes(), backgroundMusic: { mode: "selected", selectedTrackId: "legacy" } });
assert.deepEqual(activeIds(canonicalWins), [null, null, null], "canonical timeline ignores legacy authority");

const unresolved = plan([
  placement("A", "scene-1", "start", "scene-3", "end", { status: "unresolved" }),
  placement("B", "scene-1", "start", "scene-3", "end", { status: "stale" }),
]);
assert.deepEqual(activeIds(unresolved), [null, null, null], "unresolved and stale placements are not playable");

const canonical = timeline([placement("A", "scene-1", "start", "scene-3", "end")]);
const before = structuredClone(canonical);
deriveCreatorAudioPreviewPlan({ timeline: canonical, scenes: scenes() });
assert.deepEqual(canonical, before);
assert.equal(JSON.stringify(canonical).includes("startMs"), false, "preview timing remains ephemeral");

assert.deepEqual(defaultA.scenes[1].speechWindows, [{ startMs: 1000, endMs: 1600 }], "authoritative narration duration drives speech timing");
assert.equal(defaultA.scenes[1].music.gain, CREATOR_AUDIO_MIX_POLICY.musicBedGain);
assert.equal(defaultA.scenes[1].music.duckedGain, CREATOR_AUDIO_MIX_POLICY.musicBedGain * CREATOR_AUDIO_MIX_POLICY.duckingGain);
assert.ok(defaultA.scenes[1].music.duckedGain < defaultA.scenes[1].music.gain, "music attenuates under narration");
assert.equal(defaultA.scenes[0].speechWindows.length, 0, "music restores to bed gain outside speech");
assert.equal(defaultA.scenes[0].music.previewAuthority, "provider_preview");
assert.equal(defaultA.scenes[0].music.provesExportEntitlement, false);
assert.equal("streamUrl" in defaultA.scenes[0].music, false, "provider preview URLs remain ephemeral playback data");

const reordered = plan([placement("A", "scene-3", "start", "scene-2", "end")], scenes(["scene-3", "scene-1", "scene-2"]));
assert.deepEqual(activeIds(reordered), ["A", "A", "A"], "current scene order resolves canonical anchors");

const renderer = readFileSync(new URL("../export-service/src/creatorAudioMixPlan.js", import.meta.url), "utf8");
const playback = readFileSync(new URL("../components/create/useCreatorAudioPreviewPlayback.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(renderer, /CREATOR_AUDIO_MIX_POLICY/, "renderer retains shared canonical policy");
assert.match(playback, /\/api\/creator-music\?\$\{params\}/);
assert.match(playback, /setSpeechActive/);
assert.match(playback, /duckingAttackMs[\s\S]*duckingReleaseMs/);
assert.match(playback, /fadeOutAndStop[\s\S]*musicRef\.current\?\.fadeOutMs/, "track changes and stops retain fade semantics");
assert.match(page, /deriveCreatorAudioPreviewPlan[\s\S]*creatorAudioPreviewPlayback\.sync/);
const creatorWorkspaceStart = page.indexOf("{creatorStageVisibility.create_review");
const legacyWorkspaceStart = page.indexOf("{!isCreatorLabFlow && scenes.length > 0");
assert.ok(creatorWorkspaceStart >= 0 && legacyWorkspaceStart > creatorWorkspaceStart, "CreatorLab Create & Review boundary remains explicit");
const creatorWorkspace = page.slice(creatorWorkspaceStart, legacyWorkspaceStart);
assert.match(creatorWorkspace, /data-creator-preview-project="true"[\s\S]*?onClick=\{playWholeStory\}/, "CreatorLab Create & Review exposes the existing combined preview path");
assert.match(creatorWorkspace, /isPlayingStory[\s\S]*?"Stop Preview"[\s\S]*?"Preview Project"/, "project preview exposes idle and stop states");
assert.match(creatorWorkspace, /onClick=\{\(\) => playNarration\(scene\.id, scene\.narration\)\}/, "Listen Narrator retains its narration-only path");
assert.doesNotMatch(creatorWorkspace, /data-creator-preview-project="true"[\s\S]{0,500}CreatorMusicLibraryPicker/, "project preview is not owned by the music picker");
assert.equal((page.match(/const playWholeStory = async/g) || []).length, 1, "combined playback retains one implementation");
const wholeStory = page.slice(page.indexOf("const playWholeStory = async"), page.indexOf("const executePersistProject"));
assert.match(wholeStory, /validateCreatorProjectPreviewAudio/);
assert.match(wholeStory, /Preview is using available audio[\s\S]*previewAudio\.unavailableSceneIds\.join\(", "\)/, "unavailable audio produces a non-blocking localized advisory");
const advisoryStart = wholeStory.indexOf("const previewAudio =");
const playbackStart = wholeStory.indexOf("setIsPlayingStory(true)");
assert.doesNotMatch(wholeStory.slice(advisoryStart, playbackStart), /return;/, "unavailable CreatorLab audio cannot block project preview");
assert.match(wholeStory, /narrationPlayable[\s\S]*narrationState === "current"[\s\S]*narrationAudioUrl\?\.trim/);
assert.match(wholeStory, /dialoguePlayable[\s\S]*dialogueState === "current"[\s\S]*dialogueAudioUrl\?\.trim/);
const creatorSceneActivation = wholeStory.indexOf("setPlayingSceneId(scene.id)", wholeStory.indexOf("for (const scene of scenes)"));
assert.ok(creatorSceneActivation >= 0, "CreatorLab preview explicitly activates every scene");
assert.ok(creatorSceneActivation < wholeStory.indexOf("creatorAudioPreviewPlayback.sync", creatorSceneActivation), "scene activation precedes music sync");
assert.ok(creatorSceneActivation < wholeStory.indexOf("const narrationPlayable", creatorSceneActivation), "scene activation is independent of narration availability");
assert.ok(creatorSceneActivation < wholeStory.indexOf("const dialoguePlayable", creatorSceneActivation), "scene activation is independent of dialogue availability");
assert.match(wholeStory, /if \(isCreatorLabFlow\) \{\s*if \(playbackToken !== storyPlaybackTokenRef\.current\) \{\s*return;\s*\}\s*setPlayingSceneId\(scene\.id\);\s*const remainingSceneDurationMs/, "tail activation is cancellation-guarded before the CreatorLab visual remains active through the silent scene tail");
assert.match(wholeStory, /narrationAudioUrl = isCreatorLabFlow[\s\S]*?scene\.audioUrl as string/);
assert.match(wholeStory, /dialogueAudioUrl = isCreatorLabFlow[\s\S]*?scene\.dialogueAudioUrl as string/);
assert.match(wholeStory, /scene\.audioUrl as string\s*:\s*await getSceneAudioUrl\(scene\)/, "CreatorLab selects persisted narration before the legacy Storyverse generation path");
assert.match(wholeStory, /scene\.dialogueAudioUrl as string\s*:\s*await getSceneDialogueUrl\(scene\)/, "CreatorLab selects persisted dialogue before the legacy Storyverse generation path");
assert.doesNotMatch(wholeStory, /\/api\/(?:store-audio|store-dialogue-audio)|reserveMeteredOperation|settleMeteredOperation|provider/i, "project preview owns no generation, credit, or provider dispatch");
assert.match(wholeStory, /remainingSceneDurationMs[\s\S]*getCreatorPlannedSceneDuration\(scene\)[\s\S]*waitForStoryPlaybackDuration/, "silent tracks retain the planned CreatorLab scene window");
assert.ok(
  wholeStory.indexOf("validateCreatorProjectPreviewAudio") < wholeStory.indexOf("setIsPlayingStory(true)"),
  "read-only audio preflight completes before project playback begins",
);
assert.match(page, /const stopStoryPlayback = \(\) => \{[\s\S]*?stopCurrentAudio\(\);[\s\S]*?creatorAudioPreviewPlayback\.stop\(\);[\s\S]*?\};/, "Stop Preview stops narration and music through the existing stop path");
assert.doesNotMatch(playback, /acquire|entitlement|storagePath/, "preview playback cannot become export authority");

console.log("STAGE_0_13C_G_PREVIEW_PARITY=PASS");
