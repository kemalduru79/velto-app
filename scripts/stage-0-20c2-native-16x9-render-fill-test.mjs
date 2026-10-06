import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import {
  buildCreatorVisualFitFilters,
  resolveCreatorVisualFitMode,
} from "../export-service/src/creatorVisualFit.js";

assert.equal(
  resolveCreatorVisualFitMode({
    productProfile: "creatorlab",
    creatorFormat: "youtube_video",
  }),
  "cover",
);

assert.equal(
  resolveCreatorVisualFitMode({
    productProfile: "creatorlab",
    creatorFormat: "short_form",
  }),
  "contain",
);

assert.equal(
  resolveCreatorVisualFitMode({
    productProfile: "storyverse",
    creatorFormat: "youtube_video",
  }),
  "contain",
);

const cover = buildCreatorVisualFitFilters({
  mode: "cover",
  outputWidth: 1280,
  outputHeight: 720,
}).join(",");

assert.match(cover, /force_original_aspect_ratio=increase/);
assert.match(cover, /crop=1280:720/);
assert.doesNotMatch(cover, /\bpad=/);

const contain = buildCreatorVisualFitFilters({
  mode: "contain",
  outputWidth: 1280,
  outputHeight: 720,
}).join(",");

assert.match(contain, /force_original_aspect_ratio=decrease/);
assert.match(contain, /pad=1280:720/);

const serverSource = await readFile(
  new URL("../export-service/src/server.js", import.meta.url),
  "utf8",
);

assert.match(serverSource, /resolveCreatorVisualFitMode/);
assert.match(
  serverSource,
  /visualFitMode:\s*creatorVisualFitMode/g,
);

const propagatedAuthorityCount =
  serverSource.match(/visualFitMode:\s*creatorVisualFitMode/g)?.length || 0;

assert.equal(
  propagatedAuthorityCount,
  3,
  "coverage, video, and image render paths must all receive the same fit authority",
);

assert.match(
  serverSource,
  /createImageMotionFilter\(\s*tailDuration,\s*"soft_pan",\s*visualFitMode\s*\)/s,
  "reference-image filler tail must inherit visual fit authority",
);

assert.match(
  serverSource,
  /createNormalizedVideoFilter\(beat\.durationSec,\s*visualFitMode\)/s,
  "coverage video beats must inherit visual fit authority",
);

assert.match(
  serverSource,
  /createImageMotionFilter\(\s*beat\.durationSec,\s*beat\.motionPreset,\s*visualFitMode,?\s*\)/s,
  "coverage image beats must inherit visual fit authority",
);

assert.doesNotMatch(serverSource, /\batempo\b/);

const execFileAsync = promisify(execFile);
const probePath = "ffprobe";
assert.ok(ffmpegPath, "ffmpeg-static is required");

const fixtureDir = await mkdtemp(join(tmpdir(), "velto-stage-0-20c2-"));

async function renderCoverFixture(name, sourceSize) {
  const outputPath = join(fixtureDir, `${name}.mp4`);
  const filter = [
    ...buildCreatorVisualFitFilters({
      mode: "cover",
      outputWidth: 1280,
      outputHeight: 720,
    }),
    "setsar=1",
    "fps=25",
    "format=yuv420p",
  ].join(",");

  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=white:s=${sourceSize}:r=25:d=0.6`,
      "-vf",
      filter,
      "-t",
      "0.6",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  const { stdout: probeStdout } = await execFileAsync(probePath, [
    "-v",
    "error",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    outputPath,
  ]);

  const probe = JSON.parse(probeStdout);
  const video = probe.streams?.[0];
  assert.equal(video.width, 1280, `${name}: output width`);
  assert.equal(video.height, 720, `${name}: output height`);
  assert.ok(
    Number(probe.format?.duration) >= 0.55,
    `${name}: expected duration must survive`,
  );

  const { stdout: rawFrame } = await execFileAsync(
    ffmpegPath,
    [
      "-v",
      "error",
      "-i",
      outputPath,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
    },
  );

  const frame = Buffer.from(rawFrame);
  const pixelOffset = (x, y) => (y * 1280 + x) * 3;
  const luminanceAt = (x, y) => {
    const offset = pixelOffset(x, y);
    return (
      Number(frame[offset] || 0) +
      Number(frame[offset + 1] || 0) +
      Number(frame[offset + 2] || 0)
    ) / 3;
  };

  for (const [x, y] of [
    [1, 1],
    [1278, 1],
    [1, 718],
    [1278, 718],
    [640, 360],
  ]) {
    assert.ok(
      luminanceAt(x, y) > 100,
      `${name}: cover render must not introduce black bars at ${x},${y}`,
    );
  }

  return {
    name,
    sourceSize,
    width: video.width,
    height: video.height,
    durationSec: Number(probe.format.duration),
  };
}

try {
  const results = [];
  results.push(await renderCoverFixture("four-three", "960x720"));
  results.push(await renderCoverFixture("three-two", "1080x720"));
  results.push(await renderCoverFixture("native-sixteen-nine", "1280x720"));
  results.push(await renderCoverFixture("manual-portrait", "720x1280"));

  console.log("Stage 0.20C2 native 16:9 render fill regression passed.");
  console.log(JSON.stringify(results, null, 2));
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
}
