import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDefaultCreatorMusicTimeline,
  getSelectedCreatorMusicDisplayName,
  getCreatorMusicSetupMode,
  hydrateCreatorMusicTimeline,
  selectUploadedCreatorMusic,
  setCreatorMusicSetupMode,
} from "../lib/creator/musicSetup.ts";
import { normalizeCreatorAudioTimeline } from "../lib/creator/audioTimeline.ts";

const component = readFileSync(new URL("../components/create/CreatorBackgroundMusic.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/creator-audio-assets/route.ts", import.meta.url), "utf8");

const initial = createDefaultCreatorMusicTimeline();
assert.equal(getCreatorMusicSetupMode(initial), "auto");
assert.deepEqual(normalizeCreatorAudioTimeline(initial).musicIntent, { mode: "auto" });

const narration = { url: "narration.mp3", text: "untouched" };
const selected = selectUploadedCreatorMusic({
  timeline: initial,
  sceneIds: ["scene-a", "scene-b"],
  asset: {
    assetId: "asset-uploaded",
    displayName: "Creator Track.mp3",
    origin: "uploaded",
    mediaKind: "music",
    durationMs: 12_000,
    rights: { status: "creator_attested", creatorAttestedAt: "2026-09-10T00:00:00.000Z" },
  },
});
assert.equal(getCreatorMusicSetupMode(selected), "browse");
assert.equal(selected.placements.length, 1);
assert.equal(selected.placements[0].asset.assetId, "asset-uploaded");
assert.equal(getSelectedCreatorMusicDisplayName(selected), "Creator Track.mp3");
assert.equal(selected.placements[0].asset.rights.status, "creator_attested");

const noMusic = setCreatorMusicSetupMode(selected, "none");
assert.equal(noMusic.placements.some((placement) => placement.kind === "music" && placement.status === "active"), false);
assert.deepEqual(narration, { url: "narration.mp3", text: "untouched" });
assert.equal(getCreatorMusicSetupMode(setCreatorMusicSetupMode(noMusic, "auto")), "auto");

assert.equal(getCreatorMusicSetupMode(hydrateCreatorMusicTimeline({ timeline: initial })), "auto");
assert.equal(getCreatorMusicSetupMode(hydrateCreatorMusicTimeline({ timeline: undefined, legacyMode: "none" })), "none");
assert.equal(getCreatorMusicSetupMode(hydrateCreatorMusicTimeline({ timeline: undefined, legacyMode: "selected" })), "browse");

for (const label of ["No Music", "Auto Match", "Choose Music", "Upload your own music"]) assert.match(component, new RegExp(label));
assert.doesNotMatch(component, /<h3[^>]*>\{english \? "Music"/);
assert.match(component, /Velto will match music to your content\./);
assert.match(component, /I have the right to use this audio\./);
assert.match(component, /\/api\/creator-audio-assets/);
assert.match(component, /action: "initiate"/);
assert.match(component, /uploadToSignedUrl/);
assert.match(component, /action: "finalize"/);
assert.match(component, /creatorAttested: true/);
assert.match(route, /authorizeCreatorAudioAssetRequest/);
assert.match(route, /createSignedPublicUpload/);
assert.match(route, /finalizeCreatorAudioUpload/);
assert.doesNotMatch(component, /\/api\/creator-music|Epidemic|dummy song|Music level|Auto Ducking|\bgain\b|\bfade\b|\bBPM\b|waveform|timeline scrubber/i);
assert.doesNotMatch(component, /Start here|Continue|Change here|Stop after this scene|scene-level volume/i);
assert.doesNotMatch(component, /FFmpeg|Railway|mixing|renderer/i);

const musicHandler = page.slice(page.indexOf("onChange={(nextTimeline)"), page.indexOf("language={uiLanguage", page.indexOf("onChange={(nextTimeline)")));
assert.match(musicHandler, /setCreatorAudioTimeline\(nextTimeline\)/);
assert.match(musicHandler, /setExportedMovieUrl\(""\)/);
assert.doesNotMatch(musicHandler, /setScenes|setCreatorScript|setCreatorMentorResult|research|generate|fetch\(/i);
assert.match(page, /setCreatorAudioTimeline\(hydrateCreatorMusicTimeline/);
assert.match(page, /creatorAudioTimelineSnapshotFields\(creatorAudioTimeline\)/);
assert.match(page, /creatorSelectedMusicDisplayName \|\|/);
assert.match(page, /"No Music"/);

console.log("STAGE_0_13C_D_PRODUCTION_SETUP_MUSIC_UX=PASS");
