import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const route = read("app/api/stitch-video/route.ts");
const nativeMedia = read("lib/video/stitching/nativeMedia.server.ts");
const service = read("lib/video/stitching/stitchVideoService.server.ts");
const nextConfig = read("next.config.ts");

assert.ok(route.split("\n").length <= 10, "stitch-video route must remain thin");
assert.match(route, /export async function POST/);
assert.match(route, /handleStitchVideoRequest/);
assert.doesNotMatch(route, /ffmpeg|ffprobe|mkdtemp|createSceneVideoBase/);

for (const marker of [
  'import ffmpegPath from "ffmpeg-static"',
  'import ffprobeStatic from "ffprobe-static"',
  '"/usr/bin/ffprobe"',
  "execFile(ffmpegExecutable, [\"-y\", ...args]",
  "execFile(ffprobeExecutable, args",
  'const OUTPUT_SIZE = "960:960"',
  'const OUTPUT_AUDIO_SAMPLE_RATE = "44100"',
  '"-preset",\n    "veryfast"',
  '"-crf",\n    "20"',
  '"-video_track_timescale",\n    "90000"',
]) {
  assert.ok(nativeMedia.includes(marker), `native media marker missing: ${marker}`);
}

for (const header of [
  "X-Scene-Count",
  "X-Timeline-Aware",
  "X-Audio-Safe-Stitch",
  "X-Audio-Duration-Matched",
  "X-Audio-Mismatch-Scenes",
  "X-Split-Recommended-Scenes",
  "X-Unnecessary-Extension-Removed",
  "X-Visual-Filler-Scenes",
  "X-Visual-Filler-Duration",
  "X-Visual-Filler-Strategies",
  "X-Freeze-Frame-Fallback",
  "X-Stitch-Continuity",
  "X-Export-Preflight",
  "X-Export-Auto-Fixes",
  "X-Clip-Trim",
  "X-Transition-Mode",
  "X-Scene-Gap-Removal",
  "X-Black-Frame-Guard",
  "X-Expected-Duration",
  "X-Final-Duration",
  "X-Final-AV-Drift",
  "X-Max-Scene-AV-Drift",
  "X-Timeline-Visual-Actions",
]) {
  assert.ok(service.includes(`"${header}"`), `response header missing: ${header}`);
}

for (const marker of [
  'version === "3N-5"',
  "{ status: 409 }",
  'manualConfirmationGranted !== true',
  "body.videoUrls.map",
  "applyTimelineSyncPlanToScenes",
  '"No scenes with videoUrl or imageUrl provided"',
  '"Content-Type": "video/mp4"',
  'filename="velto-final-video.mp4"',
  "crypto.randomUUID()",
  "await fs.rm(tempDir, { recursive: true, force: true })",
  'console.error("SCENE COMPOSER CLEANUP ERROR:"',
]) {
  assert.ok(service.includes(marker), `stitch service marker missing: ${marker}`);
}

assert.match(nextConfig, /const ffmpegExecutable = `\.\/node_modules\/ffmpeg-static\/ffmpeg\$\{executableExtension\}`/);
assert.match(nextConfig, /const ffprobeExecutable = `\.\/node_modules\/ffprobe-static\/bin\/\$\{process\.platform\}\/\$\{process\.arch\}\/ffprobe\$\{executableExtension\}`/);
assert.doesNotMatch(nextConfig, /"\.\/node_modules\/ffprobe-static\/\*\*\/\*"/);

console.log("Stage 0.8C Slice B stitch modularization regression passed.");
