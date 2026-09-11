import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCreatorPremiumMusicQuery, isCreatorPremiumMusicTrackId } from "../lib/creator/musicLibrary.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const adapter = await read("lib/providers/music/epidemic.ts");
const environment = await read("lib/runtime/providerEnvironment.mjs");
const types = await read("lib/providers/music/types.ts");
const route = await read("app/api/creator-music/route.ts");
const picker = await read("components/create/CreatorMusicLibraryPicker.tsx");
const setup = await read("components/create/CreatorBackgroundMusic.tsx");
const scene = await read("components/create/CreatorSceneMusicControls.tsx");
const musicSetup = await read("lib/creator/musicSetup.ts");

assert.match(environment, /EPIDEMIC_SOUND_API_KEY/);
assert.match(adapter, /resolveProviderEnvironmentValue\("epidemic", "apiKey"\)/);
assert.match(adapter, /const API_BASE = "https:\/\/partner-content-api\.epidemicsound\.com"/);
assert.match(adapter, /AbortSignal\.timeout/); assert.match(adapter, /normalizePremiumMusicTrack/);
assert.doesNotMatch(types, /epidemic|apiKey|providerUrl|rawResponse/i);
assert.match(route, /authenticateRequest\(request\)/); assert.match(route, /getMusicProvider/);
assert.match(route, /action === "auto"/); assert.match(route, /isCreatorPremiumMusicTrackId\(trackId\)/);
assert.match(picker, /\/api\/creator-music/); assert.match(picker, /action: "preview"/);
assert.match(picker, /Music Library/); assert.match(picker, /Search music/); assert.match(picker, /Use track/);
assert.match(picker, /if \(playingId === track\.id\) return stopPreview\(\)/);
assert.doesNotMatch(picker + setup + scene, /EPIDEMIC_SOUND_API_KEY|partner-content-api/);
assert.doesNotMatch(picker, /volume|gain|fade|ducking|waveform|BPM/i);
assert.match(setup, /CreatorMusicLibraryPicker/); assert.match(scene, /CreatorMusicLibraryPicker/);
assert.match(musicSetup, /origin: "licensed_catalog"/); assert.match(musicSetup, /status: "unresolved"/);
assert.doesNotMatch(musicSetup, /previewUrl|streamUrl/);
assert.equal(isCreatorPremiumMusicTrackId("premium.track:ABC_123~v2"), true);
assert.equal(isCreatorPremiumMusicTrackId("https://invalid.example/track"), false);
const context = { contentType: "documentary", topic: "Ocean recovery", visualStyle: "cinematic" };
assert.equal(buildCreatorPremiumMusicQuery(context), buildCreatorPremiumMusicQuery(context));

console.log("CreatorLab premium music catalog smoke test passed (canonical AudioTimeline UX).");
