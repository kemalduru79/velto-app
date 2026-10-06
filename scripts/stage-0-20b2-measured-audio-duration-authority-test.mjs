import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { matchAudioDurationToScene } from "../lib/video/audioDurationMatching.ts";
import {
  reconcileVisualCoveragePlan,
  resolveAudioFirstSceneTargetDuration,
} from "../export-service/src/visualCoverage.js";

const editorial = (input) => matchAudioDurationToScene({
  minDurationSec: 3,
  maxDurationSec: 30,
  preferredMaxSceneDurationSec: 20,
  tailBufferSec: 0.75,
  durationAuthority: "editorial_floor",
  ...input,
});

const plannedFloor = editorial({ plannedDurationSec: 18, audioDurationSec: 12 });
assert.equal(plannedFloor.targetDurationSec, 18);
assert.equal(plannedFloor.status, "matched");
assert.equal(plannedFloor.unnecessaryExtensionRemovedSec, 0);

const extended = editorial({ plannedDurationSec: 10, audioDurationSec: 12 });
assert.equal(extended.targetDurationSec, 12.75);
assert.equal(extended.status, "extended");

const preferredSplit = editorial({ plannedDurationSec: 10, audioDurationSec: 21 });
assert.equal(preferredSplit.targetDurationSec, 21.75);
assert.equal(preferredSplit.status, "split_recommended");
assert.equal(preferredSplit.splitRecommended, true);

const hardUnsafe = editorial({ plannedDurationSec: 10, audioDurationSec: 31 });
assert.equal(hardUnsafe.targetDurationSec, 31.75, "unsafe audio must not be clamped or truncated");
assert.equal(hardUnsafe.status, "unsafe");
assert.equal(hardUnsafe.fitsWithinHardLimit, false);
assert.equal(hardUnsafe.splitRecommended, true);

const compact = matchAudioDurationToScene({
  plannedDurationSec: 10,
  audioDurationSec: 6,
  tailBufferSec: 0.75,
  durationAuthority: "audio_compact",
});
assert.equal(compact.targetDurationSec, 6.75);
assert.equal(compact.status, "shortened");

const unmeasured = editorial({ plannedDurationSec: 18, audioDurationSec: 0 });
assert.equal(unmeasured.targetDurationSec, 18);
assert.equal(unmeasured.status, "unmeasured");

const creatorSceneId = "11111111-1111-4111-8111-111111111111";
const imageCoverage = [{
  id: `${creatorSceneId}.coverage.1`, creatorSceneId,
  startSec: 0, endSec: 10, durationSec: 10,
  kind: "image", sourceUrl: "https://assets.test/image.jpg",
  sourceType: "scene_image", motionPreset: "slow_push_in", renderer: "native_zoompan_v1",
}];
const longFormShortAudioTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 10, coverageBackedTarget: Number.NaN, audioDuration: 6,
  sourceType: "image", sourceDuration: 0, durationAuthority: "editorial_floor",
  minimumDuration: 8, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(longFormShortAudioTarget, 10);
const shortFormShortAudioTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 10, coverageBackedTarget: Number.NaN, audioDuration: 6,
  sourceType: "image", sourceDuration: 0, durationAuthority: "audio_compact",
  minimumDuration: 8, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(shortFormShortAudioTarget, 8, "the renderer's existing 8-second minimum bounds compact timing");
const rendererTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 10,
  coverageBackedTarget: 10,
  audioDuration: 14,
  sourceType: "image",
  sourceDuration: 0,
  durationAuthority: "editorial_floor",
  minimumDuration: 8,
  defaultDuration: 10,
  tailBuffer: 0.75,
});
assert.equal(rendererTarget, 14.75);
const shortFormLongAudioTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 10, coverageBackedTarget: 10, audioDuration: 14,
  sourceType: "image", sourceDuration: 0, durationAuthority: "audio_compact",
  minimumDuration: 8, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(shortFormLongAudioTarget, 14.75, "compact timing must never truncate audio");
const storyverseTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 10, coverageBackedTarget: Number.NaN, audioDuration: 6,
  sourceType: "image", sourceDuration: 0, durationAuthority: undefined,
  minimumDuration: 8, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(storyverseTarget, 10, "Storyverse retains legacy requested-duration behavior");
const reconciled = reconcileVisualCoveragePlan({ creatorSceneId, visualCoveragePlan: imageCoverage }, rendererTarget);
assert.equal(reconciled.at(-1)?.endSec, 14.75, "image coverage must extend to audio authority");
const videoOnly = [{ ...imageCoverage[0], kind: "video", renderer: "native_video" }];
assert.deepEqual(
  reconcileVisualCoveragePlan({ creatorSceneId, visualCoveragePlan: videoOnly }, rendererTarget),
  [],
  "coverage that cannot extend safely must fail closed",
);

const execFileAsync = promisify(execFile);
const fixtureDir = await mkdtemp(join(tmpdir(), "velto-stage-0-20b2-"));
try {
  assert.ok(ffmpegPath, "ffmpeg-static is required");
  const audioPath = join(fixtureDir, "authoritative-audio.wav");
  const outputPath = join(fixtureDir, "coverage-output.mp4");
  await execFileAsync(ffmpegPath, [
    "-y", "-f", "lavfi", "-t", "14", "-i", "sine=frequency=440:sample_rate=44100",
    "-c:a", "pcm_s16le", audioPath,
  ]);
  await execFileAsync(ffmpegPath, [
    "-y", "-f", "lavfi", "-t", String(rendererTarget), "-i", "color=c=black:s=320x180:r=25",
    "-i", audioPath,
    "-filter_complex", `[1:a]asetpts=PTS-STARTPTS,aresample=44100:async=1:first_pts=0,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,atrim=start=0:duration=${rendererTarget.toFixed(3)},asetpts=N/SR/TB[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast",
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", outputPath,
  ], { maxBuffer: 10 * 1024 * 1024 });
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,duration:format=duration", "-of", "json", outputPath,
  ]);
  const probe = JSON.parse(stdout);
  const audioStream = probe.streams.find((stream) => stream.codec_type === "audio");
  assert.ok(Number(audioStream.duration) >= 14, "complete authoritative audio must survive coverage extension");
  assert.ok(Number(probe.format.duration) >= 14.7, "rendered scene must retain the audio-safe tail");
  console.log("Stage 0.20B2 measured audio duration authority passed.");
  console.log(JSON.stringify({ plannedFloor, extended, preferredSplit, hardUnsafe, compact, renderer: { longFormShortAudioTarget, shortFormShortAudioTarget, longFormCoverageTarget: rendererTarget, shortFormLongAudioTarget, storyverseTarget, outputDurationSec: Number(probe.format.duration), outputAudioDurationSec: Number(audioStream.duration) } }, null, 2));
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
}

const rendererSource = await readFile(new URL("../export-service/src/server.js", import.meta.url), "utf8");
assert.match(rendererSource, /resolveAudioFirstSceneTargetDuration/);
assert.match(rendererSource, /body\.creatorFormat === "youtube_video"[\s\S]*?"editorial_floor"[\s\S]*?"audio_compact"/);
assert.match(rendererSource, /effectiveVisualSourceDuration,\s*creatorDurationAuthority/);
assert.doesNotMatch(rendererSource, /\batempo\b/);
