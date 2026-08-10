import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ts from "typescript";

const execFileAsync = promisify(execFile);

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const transpile = (source) => ts.transpile(source, {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
});
const importSource = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
};

const contractSource = await read("lib/creator/backgroundMusic.ts");
const librarySource = await read("lib/creator/musicLibrary.ts");
const page = await read("app/create/page.tsx");
const picker = await read("components/create/CreatorBackgroundMusic.tsx");
const route = await read("app/api/creator-export/route.ts");
const renderer = await read("export-service/src/server.js");
const saveRoute = await read("app/api/save-project/route.ts");
const packageJson = await read("package.json");

const contract = await importSource(transpile(contractSource));
const library = await importSource(transpile(librarySource));
const allowed = ["approved-track"];

check("legacy config defaults safely to no music", () => {
  assert.deepEqual(contract.normalizeCreatorBackgroundMusicConfig(undefined), contract.DEFAULT_CREATOR_BACKGROUND_MUSIC);
});
check("mode and bounds normalize deterministically", () => {
  const invalid = contract.normalizeCreatorBackgroundMusicConfig({ mode: "filesystem", volume: 99, fadeInSec: -3, fadeOutSec: 99 });
  assert.equal(invalid.mode, "none");
  assert.equal(invalid.volume, 0.3);
  assert.equal(invalid.fadeInSec, 0);
  assert.equal(invalid.fadeOutSec, 8);
});
check("unknown IDs and client paths are never trusted", () => {
  const unknown = contract.normalizeCreatorBackgroundMusicConfig({ mode: "selected", selectedTrackId: "/tmp/music.mp3", previewUrl: "https://bad.example/music" }, allowed);
  assert.equal(unknown.mode, "none");
  assert.equal(unknown.selectedTrackId, undefined);
  assert.equal("previewUrl" in unknown, false);
  const known = contract.normalizeCreatorBackgroundMusicConfig({ mode: "selected", selectedTrackId: allowed[0] }, allowed);
  assert.equal(known.selectedTrackId, allowed[0]);
});
check("auto mode remains valid with an empty library", () => {
  const auto = contract.normalizeCreatorBackgroundMusicConfig({ mode: "auto" }, []);
  assert.equal(auto.mode, "auto");
  assert.equal(auto.selectedTrackId, undefined);
});
check("library is honest, deterministic, and provider-free", () => {
  assert.match(librarySource, /CREATOR_MUSIC_LIBRARY[^=]*= \[\]/);
  assert.equal(library.CREATOR_MUSIC_LIBRARY_VERSION, "creator-music-v1");
  assert.doesNotMatch(librarySource, /fetch\(|openai|elevenlabs|spotify|youtube/i);
  assert.match(librarySource, /sort\(\(left, right\)/);
});
check("picker exposes product modes and local preview lifecycle", () => {
  for (const label of ["No Music", "Auto Match", "Choose Music", "Preview", "Stop"]) assert.match(picker, new RegExp(label));
  assert.match(picker, /new Audio\(track\.previewUrl\)/);
  assert.match(picker, /useEffect\(\(\) => stopPreview/);
  assert.match(picker, /onClick=\{\(\) => \{\s*stopPreview\(\);\s*onChange\(\{ \.\.\.value, mode: "selected", selectedTrackId: track\.id \}\)/);
  assert.doesNotMatch(picker, /ElevenLabs|Spotify|YouTube Music/);
});
check("Choose Music opens browsing state without persisting incomplete selection", () => {
  assert.match(picker, /const \[pickerOpen, setPickerOpen\] = useState\(value\.mode === "selected"\)/);
  assert.match(picker, /if \(mode === "selected"\) \{\s*setPickerOpen\(true\);\s*return;/);
  assert.match(picker, /\{pickerOpen && \(/);
  assert.match(picker, /The approved music library is currently empty/);
  assert.match(picker, /onChange\(\{ \.\.\.value, mode: "selected", selectedTrackId: track\.id \}\)/);
});
check("persistence and stale signature include normalized music", () => {
  assert.match(page, /backgroundMusic: creatorBackgroundMusic/);
  assert.match(page, /setCreatorBackgroundMusic\([\s\S]*normalizeCreatorBackgroundMusicConfig/);
  assert.match(saveRoute, /creatorProductionPackage: body\.creatorProductionPackage/);
});
check("new-project reset clears music without changing narrower rerun paths", () => {
  assert.match(page, /const resetStoryFlow = \(\) => \{[\s\S]*setCreatorBackgroundMusic\(DEFAULT_CREATOR_BACKGROUND_MUSIC\)/);
  assert.equal((page.match(/setCreatorBackgroundMusic\(DEFAULT_CREATOR_BACKGROUND_MUSIC\)/g) || []).length, 1);
});
check("Auto Match inputs reach both export payload and render signature", () => {
  for (const field of ["contentType: creatorContentType", "outcome: creatorOutcome", "creatorFormat", "visualStyle: visualBible?.style"]) {
    assert.ok(page.split(field).length >= 3, `${field} must appear in payload and signature`);
  }
  assert.match(page, /autoMatchInputs/);
  assert.match(page, /musicLibraryVersion: CREATOR_MUSIC_LIBRARY_VERSION/);
  assert.match(route, /contentType: typeof body\.contentType/);
  assert.match(route, /visualStyle: typeof body\.visualStyle/);
});
check("product and renderer registries have exact safe parity", () => {
  const registryBody = renderer.match(/const CREATOR_MUSIC_ASSET_BY_ID = Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1];
  assert.notEqual(registryBody, undefined);
  const rendererEntries = [...registryBody.matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)]
    .map((match) => [match[1], match[2]]);
  const rendererAssets = new Map(rendererEntries);
  const rendererIds = rendererEntries.map(([id]) => id);
  const productIds = library.CREATOR_MUSIC_LIBRARY.map((track) => track.id);
  assert.equal(new Set(productIds).size, productIds.length);
  assert.equal(new Set(rendererIds).size, rendererIds.length);
  for (const track of library.CREATOR_MUSIC_LIBRARY) {
    if (track.previewUrl) {
      assert.match(track.previewUrl, /^\/(?!\/)/);
      assert.doesNotMatch(track.previewUrl, /:\/\//);
    }
    if (track.exportAssetKey) {
      assert.match(track.exportAssetKey, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
      assert.equal(rendererAssets.get(track.id), track.exportAssetKey);
    }
  }
  for (const [rendererId, assetName] of rendererEntries) {
    assert.match(assetName, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
    const productTrack = library.CREATOR_MUSIC_LIBRARY.find((track) => track.id === rendererId);
    assert.equal(productTrack?.exportAssetKey, assetName);
  }
  assert.deepEqual(productIds, []);
  assert.deepEqual(rendererIds, []);
});
check("CreatorLab payload is normalized server-side and Storyverse is scoped", () => {
  assert.match(route, /normalizeCreatorBackgroundMusicConfig/);
  assert.match(route, /productProfile === "creatorlab"/);
  assert.match(renderer, /isCreatorLabExport/);
  assert.match(renderer, /CREATOR_MUSIC_ASSET_BY_ID/);
  assert.match(renderer, /path\.join\(process\.cwd\(\), "assets", "music", creatorMusic\.assetName\)/);
});
check("renderer loops, trims, fades, ducks, limits, and keeps duration", () => {
  for (const marker of ["-stream_loop", "atrim=duration=", "afade=t=in", "afade=t=out", "sidechaincompress", "alimiter=limit=0.95", "duration=first", "-shortest"]) assert.match(renderer, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(renderer, /audioForClip = await mixSceneAudioWithAmbient/);
  assert.match(renderer, /verifyRenderedContinuity\([\s\S]*finalOutputFilePath/);
});
check("ducking control is speech-only and timeline aligned", () => {
  assert.match(renderer, /createSpeechDuckingControl/);
  assert.match(renderer, /speechAudioPath: finalAudioPath/);
  assert.match(renderer, /durationSeconds: clipResult\.durationSec/);
  assert.match(renderer, /if \(!speechAudioPath\) \{\s*await createSilentAudio/);
  assert.match(renderer, /concatSpeechDuckingControls/);
  assert.match(renderer, /\[music\]\[2:a\]sidechaincompress/);
  assert.doesNotMatch(renderer, /\[music\]\[0:a\]sidechaincompress/);
});
check("audible final mix preserves ambience and control failure disables only ducking", () => {
  assert.match(renderer, /\[0:a\]\[bed\]\$\{finalMixOptions\}/);
  assert.match(renderer, /audioForClip = await mixSceneAudioWithAmbient/);
  assert.match(renderer, /music will be mixed without ducking/);
  assert.match(renderer, /Boolean\(speechControlPath\)/);
  assert.match(renderer, /speechControlPath,/);
});
check("CreatorLab preserves program level while Storyverse keeps legacy amix", () => {
  assert.match(renderer, /preserveProgramLevel = false/);
  assert.match(renderer, /preserveProgramLevel \? ":normalize=0" : ""/);
  assert.match(renderer, /preserveProgramLevel: isCreatorLabExport/);
  assert.match(renderer, /alimiter=limit=0\.95/);
});
check("Storyverse legacy BGM remains separate", () => {
  assert.match(renderer, /: path\.join\(process\.cwd\(\), "assets", "bgm\.mp3"\)/);
  assert.match(renderer, /isCreatorLabExport \? creatorMusic\.volume : 0\.16/);
});
check("continuity wording changed without semantic values", () => {
  for (const label of ["Independent scenes", "Keep continuity", "Mixed / Choose per scene"]) assert.match(page, new RegExp(label.replace("/", "\\/")));
  for (const value of ["independent", "consistent", "selective"]) assert.match(page, new RegExp(`setCreatorProjectContinuityMode\\("${value}"\\)`));
});
check("no package or database migration was introduced", () => {
  JSON.parse(packageJson);
  assert.doesNotMatch(contractSource + librarySource + picker + route + renderer, /create table|alter table|package install/i);
});

const fixtureDir = await mkdtemp(join(tmpdir(), "velto-speech-ducking-smoke-"));
try {
  assert.ok(ffmpegPath, "ffmpeg-static binary is required by the existing export stack");
  const fixtureOutput = join(fixtureDir, "speech-ducked-mix.m4a");
  await execFileAsync(ffmpegPath, [
    "-y",
    "-f", "lavfi", "-t", "1.5", "-i", "sine=frequency=180:sample_rate=44100",
    "-f", "lavfi", "-t", "1.5", "-i", "sine=frequency=440:sample_rate=44100",
    "-f", "lavfi", "-t", "1.5", "-i", "sine=frequency=880:sample_rate=44100",
    "-filter_complex",
    "[1:a]volume=0.16[music];[music][2:a]sidechaincompress=threshold=0.035:ratio=6:attack=25:release=450:makeup=1[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[a]",
    "-map", "[a]", "-c:a", "aac", "-ar", "44100", "-ac", "2", fixtureOutput,
  ]);
  assert.ok((await stat(fixtureOutput)).size > 0);
  checks.push("temporary ffmpeg speech-sidechain fixture executes");
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
}

console.log(`\nCreatorLab background music smoke test passed (${checks.length} checks).`);
