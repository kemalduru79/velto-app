import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const transpile = (source) => ts.transpile(source, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const importSource = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

const librarySource = await read("lib/creator/musicLibrary.ts");
const adapter = await read("lib/providers/music/epidemic.ts");
const types = await read("lib/providers/music/types.ts");
const providerIndex = await read("lib/providers/music/index.ts");
const route = await read("app/api/creator-music/route.ts");
const exportRoute = await read("app/api/creator-export/route.ts");
const picker = await read("components/create/CreatorBackgroundMusic.tsx");
const page = await read("app/create/page.tsx");
const background = await read("lib/creator/backgroundMusic.ts");
const operationPolicy = await read("lib/credits/operationPolicy.ts");
const packageJson = JSON.parse(await read("package.json"));
const packageLock = JSON.parse(await read("package-lock.json"));
const library = await importSource(transpile(librarySource));
const backgroundContract = await importSource(transpile(background));

check("product contract is normalized and provider-independent", () => {
  for (const field of ["id: string", "title: string", "moods: string[]", "genres: string[]", "previewAvailable: boolean"]) assert.match(types, new RegExp(field.replace(/[\[\]]/g, "\\$&")));
  assert.doesNotMatch(types, /epidemic|downloadUrl|apiKey|providerUrl/i);
});
check("API key remains backend-only and cannot serialize", () => {
  assert.match(adapter, /process\.env\.EPIDEMIC_SOUND_API_KEY/);
  assert.doesNotMatch(picker + page + types, /EPIDEMIC_SOUND_API_KEY/);
  assert.doesNotMatch(route, /EPIDEMIC_SOUND_API_KEY/);
});
check("adapter uses fixed endpoints, timeout, bounded search, and normalization", () => {
  assert.match(adapter, /const API_BASE = "https:\/\/partner-content-api\.epidemicsound\.com"/);
  assert.match(adapter, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.match(adapter, /Math\.min\(20, Math\.max\(1/);
  assert.match(adapter, /normalizePremiumMusicTrack/);
  assert.doesNotMatch(adapter, /create-version|adapt-length/i);
});
check("adapter returns product shapes rather than raw provider payload", () => {
  assert.match(adapter, /return \{ tracks, limit, offset, hasMore/);
  assert.doesNotMatch(types, /rawResponse|providerPayload|streamUrl.*CreatorPremiumMusicTrack/);
});
check("authenticated proxy is narrow, anonymized, and validates IDs", () => {
  assert.match(route, /authenticateRequest\(request\)/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /velto:premium-music:v1:/);
  assert.match(route, /isCreatorPremiumMusicTrackId\(trackId\)/);
  assert.doesNotMatch(route, /url\.searchParams\.get\("url"\)|fetch\(.*searchParams/);
});
check("errors are provider-independent and rate-limit friendly", () => {
  for (const message of ["Premium music is currently unavailable.", "Music library could not be loaded. Try again.", "Music library is busy. Please try again shortly."]) assert.match(route, new RegExp(message.replace(/[.]/g, "\\.")));
});
check("deterministic Auto Match query makes no AI call", () => {
  const input = { contentType: "documentary", outcome: "educate", format: "youtube", topic: "Ocean recovery", visualStyle: "cinematic" };
  assert.equal(library.buildCreatorPremiumMusicQuery(input), library.buildCreatorPremiumMusicQuery(input));
  assert.match(library.buildCreatorPremiumMusicQuery(input), /cinematic emotional reflective/);
  assert.doesNotMatch(librarySource, /fetch\(|openai|anthropic|generate/i);
  assert.match(route, /action === "auto"/);
  assert.match(route, /action === "auto" \? 3/);
});
check("Browse and search UI is provider-backed without provider branding", () => {
  for (const marker of ["Velto Premium Music", "Browse Music", "Search music", "No matching tracks found.", "Load more"]) assert.match(picker, new RegExp(marker.replace(/[.]/g, "\\.")));
  assert.match(picker, /\/api\/creator-music/);
  assert.doesNotMatch(picker, /Epidemic|partner-content-api/i);
});
check("selection persists only stable ID after explicit choice", () => {
  assert.match(picker, /const selectTrack = \(track:[\s\S]*stopPreview\(\);[\s\S]*mode: "selected", selectedTrackId: track\.id/);
  assert.match(picker, /<button type="button" onClick=\{\(\) => selectTrack\(track\)\}[\s\S]*Select track/);
  assert.doesNotMatch(background, /previewUrl|downloadUrl|artworkUrl/);
  assert.match(background, /mode === "selected" && !selectedTrackId\) mode = "none"/);
});
check("dynamic opaque IDs normalize without static catalog membership", () => {
  const dynamicId = "premium.track:ABC_123~v2";
  const selected = backgroundContract.normalizeCreatorBackgroundMusicConfig(
    { mode: "selected", selectedTrackId: dynamicId, previewUrl: "https://temporary.example/stream.m3u8" },
    [],
    library.isCreatorPremiumMusicTrackId,
  );
  assert.equal(selected.mode, "selected");
  assert.equal(selected.selectedTrackId, dynamicId);
  assert.equal("previewUrl" in selected, false);
  for (const malformed of [
    "https://example.com/track",
    "/tmp/track",
    "folder\\track",
    " track-id",
    "track id",
    "track\ncontrol",
    "x".repeat(129),
    { id: "track-id" },
  ]) {
    const normalized = backgroundContract.normalizeCreatorBackgroundMusicConfig(
      { mode: "selected", selectedTrackId: malformed },
      [],
      library.isCreatorPremiumMusicTrackId,
    );
    assert.equal(normalized.mode, "none");
    assert.equal(normalized.selectedTrackId, undefined);
  }
});
check("selection stays local, visible, and invalidates the prior export", () => {
  assert.match(picker, /const selectTrack[\s\S]*?stopPreview\(\);\s*onChange\(\{ \.\.\.value, mode: "selected", selectedTrackId: track\.id \}\)/);
  assert.match(picker, /value\.selectedTrackId === track\.id \? \(english \? "Selected"/);
  assert.match(page, /normalizeCreatorBackgroundMusicConfig\(nextValue, \[\], isCreatorPremiumMusicTrackId\)[\s\S]*setExportSignature\(""\)/);
});
check("UI navigation is independent from persisted music mode", () => {
  assert.match(picker, /type MusicView = "none" \| "auto" \| "browse"/);
  assert.match(picker, /useState<MusicView>\(\(\) => getInitialMusicView\(value\.mode\)\)/);
  assert.match(picker, /if \(mode === "selected"\) return "browse"/);
  assert.match(picker, /onClick=\{\(\) => setView\(view\)\}/);
  assert.match(picker, /aria-pressed=\{musicView === view\}/);
  assert.doesNotMatch(picker, /pickerOpen|value\.mode !== "auto"/);
  assert.match(page, /key=\{`creator-background-music-\$\{creatorBackgroundMusicHydrationRevision\}`\}/);
  assert.equal((page.match(/setCreatorBackgroundMusicHydrationRevision\(\(revision\) => revision \+ 1\)/g) || []).length, 2);
});
check("Auto Match and Browse switch panels without erasing a valid selection", () => {
  assert.match(picker, /if \(nextView === "auto"\) \{\s*if \(!value\.selectedTrackId\) onChange\(\{ \.\.\.value, mode: "auto", selectedTrackId: undefined \}\);\s*void loadTracks\(\{ auto: true \}\)/);
  assert.match(picker, /void loadTracks\(\);\s*\};/);
  assert.match(picker, /musicView === "browse" && <div/);
  assert.match(picker, /musicView !== "none" && <div/);
});
check("selection never changes the active Auto or Browse view", () => {
  const selectTrackBody = picker.match(/const selectTrack = \(track: CreatorPremiumMusicTrack\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
  assert.match(selectTrackBody, /mode: "selected", selectedTrackId: track\.id/);
  assert.doesNotMatch(selectTrackBody, /setMusicView|setView/);
});
check("No Music is the only view action that explicitly clears selection", () => {
  assert.match(picker, /if \(nextView === "none"\) \{\s*onChange\(\{ \.\.\.value, mode: "none", selectedTrackId: undefined \}\)/);
  assert.equal((picker.match(/mode: "none", selectedTrackId: undefined/g) || []).length, 1);
  assert.match(picker, /const setView[\s\S]*?stopPreview\(\)/);
});
check("preview is temporary, authenticated, one-at-a-time, and non-persistent", () => {
  assert.match(picker, /stopPreview\(\)[\s\S]*action: "preview"/);
  assert.match(picker, /audio\.src = body\.streamUrl/);
  assert.match(picker, /application\/vnd\.apple\.mpegurl/);
  assert.doesNotMatch(page + background, /streamUrl|expiresAt/);
  assert.doesNotMatch(route, /reserveMeteredOperation|CostGuard/);
});
check("preview lifecycle remains complete", () => {
  assert.match(picker, /useEffect\(\(\) => stopPreview/);
  assert.match(picker, /if \(playingId === track\.id\) return stopPreview\(\)/);
  assert.match(picker, /if \(audioRef\.current\) audioRef\.current\.src = ""/);
});
check("approved hls.js version is installed exactly", () => {
  assert.equal(packageJson.dependencies["hls.js"], "1.6.16");
  assert.equal(packageLock.packages["node_modules/hls.js"].version, "1.6.16");
});
check("Chromium uses hls.js and Safari keeps native HLS", () => {
  assert.match(picker, /import Hls from "hls\.js"/);
  assert.match(picker, /Hls\.isSupported\(\)/);
  assert.match(picker, /new Hls\(\)/);
  assert.match(picker, /Hls\.Events\.MEDIA_ATTACHED/);
  assert.match(picker, /Hls\.Events\.MANIFEST_PARSED/);
  assert.match(picker, /safari\/i\.test\(window\.navigator\.userAgent\)/);
  assert.match(picker, /reliableNativeHls/);
});
check("HLS instances are destroyed across every preview lifecycle boundary", () => {
  assert.match(picker, /hlsRef\.current\?\.destroy\(\)/);
  assert.match(picker, /hlsRef\.current = null/);
  assert.match(picker, /if \(playingId === track\.id\) return stopPreview\(\)/);
  assert.match(picker, /const setView[\s\S]*stopPreview\(\)/);
  assert.match(picker, /useEffect\(\(\) => stopPreview, \[\]\)/);
  assert.match(picker, /audio\.onended = stopPreview/);
});
check("fatal HLS errors destroy playback with friendly copy", () => {
  assert.match(picker, /Hls\.Events\.ERROR/);
  assert.match(picker, /if \(!data\.fatal\) return;\s*stopPreview\(\)/);
  assert.match(picker, /Preview could not be played\. Try again\./);
  assert.doesNotMatch(picker, /Epidemic|partner-content-api/i);
});
check("selected premium music blocks export before reservation", () => {
  const blockIndex = exportRoute.indexOf("creator_premium_music_confirmation_required");
  const reserveIndex = exportRoute.indexOf("reserveMeteredOperation(request");
  assert.ok(blockIndex > 0 && reserveIndex > blockIndex);
  assert.match(exportRoute, /creditReserved: false/);
  assert.match(page, /creatorBackgroundMusic\.mode === "selected"[\s\S]*Premium music must be confirmed before final export\.[\s\S]*return;/);
  assert.doesNotMatch(exportRoute.slice(0, reserveIndex), /downloadTrack|createVersion/);
});
check("credits and Cost Guard remain untouched", () => {
  assert.doesNotMatch(operationPolicy, /creator_music/);
  assert.doesNotMatch(picker + route + adapter + providerIndex, /creator_music|estimatedCredits|reserveMeteredOperation/);
});
check("catalog revision remains deterministic in render signature", () => {
  assert.equal(library.CREATOR_MUSIC_LIBRARY_VERSION, "creator-premium-music-v1");
  assert.match(page, /musicLibraryVersion: CREATOR_MUSIC_LIBRARY_VERSION/);
  assert.doesNotMatch(librarySource, /Date\.now|new Date/);
});
check("normal tests consume no provider quota", () => {
  assert.doesNotMatch(new URL(import.meta.url).pathname, /RUN_CREATOR_MUSIC_LIVE_TEST/);
  assert.doesNotMatch(adapter, /this\.request\([^\n]*(?:download|acqui)|create-version|adapt-length/);
});

console.log(`\nCreatorLab premium music catalog smoke test passed (${checks.length} checks).`);
