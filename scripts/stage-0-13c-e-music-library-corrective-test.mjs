import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creatorCatalogTrackAsset, selectCatalogCreatorMusic } from "../lib/creator/musicSetup.ts";
import { createDefaultCreatorMusicTimeline } from "../lib/creator/musicSetup.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const picker = read("components/create/CreatorMusicLibraryPicker.tsx");
const setup = read("components/create/CreatorBackgroundMusic.tsx");
const scene = read("components/create/CreatorSceneMusicControls.tsx");
const page = read("app/create/page.tsx");
const editor = read("components/create/CreatorEditor.tsx");
const route = read("app/api/creator-music/route.ts");
const acquire = read("app/api/creator-music/acquire/route.ts");
const adapter = read("lib/providers/music/epidemic.ts");
const security = read("lib/providers/music/downloadSecurity.ts");

assert.match(route, /getMusicProvider/); assert.match(adapter, /class EpidemicMusicAdapter/);
assert.match(picker, /\/api\/creator-music\?\$\{params\}/);
assert.match(picker, /action: autoOnly \? "auto" : "search"/);
assert.match(picker, /action: "preview"/);
assert.match(picker, /playingId === track\.id/);
assert.match(picker, /Music Library/); assert.match(picker, /Search music\.\.\./);
assert.match(picker, /Preview/); assert.match(picker, /Use track/);
assert.doesNotMatch(picker + setup + scene + page, /EPIDEMIC_SOUND_API_KEY|partner-content-api/);
assert.equal((setup.match(/CreatorMusicLibraryPicker/g) || []).length >= 3, true);
assert.equal((scene.match(/<CreatorMusicLibraryPicker/g) || []).length, 1);
assert.doesNotMatch(scene, /fetch\("\/api\/creator-music/);
assert.match(setup, /\/api\/creator-audio-assets/); assert.match(setup, /uploadToSignedUrl/);
assert.match(acquire, /acquireCreatorPremiumMusic/); assert.match(security, /isPremiumMusicAcquisitionEnabled/);
assert.doesNotMatch(acquire + security, /acquisitionEnabled\s*=\s*true/);
assert.doesNotMatch(picker, /entitlementId|assetId|raw rights|COGS/);
assert.doesNotMatch(picker, /volume|gain|fade|ducking|waveform|BPM|sourceIn|sourceOut/i);
assert.doesNotMatch(page, /setCreatorAudioTimeline[^\n]*backgroundMusic/);
assert.match(page, /creatorSelectedSceneIds\.length > 1 \|\| creatorVisualDispatchCountdown/);
for (const label of ["Selected Scene", "Visual", "Script & Voice"]) assert.match(editor, new RegExp(label.replace("&", "&")));
assert.match(page, /!creatorEditorOpen && <button[\s\S]*data-edit-current-final-video/);

const track = { id: "opaque-track", title: "Calm Horizon", artist: "Artist", durationSec: 90, moods: [], genres: [], previewAvailable: true };
const asset = creatorCatalogTrackAsset(track);
assert.equal(asset.origin, "licensed_catalog"); assert.equal(asset.rights.status, "unknown");
assert.equal("previewUrl" in asset, false); assert.equal("streamUrl" in asset, false);
const selected = selectCatalogCreatorMusic({ timeline: createDefaultCreatorMusicTimeline(), track, sceneIds: ["a", "b"] });
assert.equal(selected.placements[0].status, "unresolved");
assert.equal(selected.placements[0].asset.displayName, "Calm Horizon · Artist");

console.log("STAGE_0_13C_E_MUSIC_LIBRARY_CORRECTIVE=PASS");
