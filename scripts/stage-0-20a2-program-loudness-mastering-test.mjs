import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import {
  buildCreatorProgramLoudnessAnalysisFilter,
  buildCreatorProgramLoudnessMasterFilter,
  CreatorProgramAudioMasterError,
  parseCreatorProgramLoudnessMeasurements,
} from "../export-service/src/creatorProgramAudioMaster.js";

const execFileAsync = promisify(execFile);
const fixtureDir = await mkdtemp(join(tmpdir(), "velto-stage-0-20a2-"));
const durationSeconds = 6;

async function ffmpeg(args) {
  try {
    return await execFileAsync(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`ffmpeg failed: ${error.stderr || error.message}`);
  }
}

async function analyze(inputPath) {
  const { stderr } = await ffmpeg([
    "-hide_banner", "-nostats", "-i", inputPath,
    "-map", "0:a:0", "-vn", "-af", buildCreatorProgramLoudnessAnalysisFilter(),
    "-f", "null", "-",
  ]);
  return parseCreatorProgramLoudnessMeasurements(stderr);
}

async function probe(inputPath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,duration:format=duration",
    "-of", "json", inputPath,
  ]);
  const parsed = JSON.parse(stdout);
  const video = parsed.streams.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams.find((stream) => stream.codec_type === "audio");
  return {
    duration: Number(parsed.format.duration),
    videoDuration: Number(video.duration),
    audioDuration: Number(audio.duration),
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
  };
}

async function createFixture(outputPath, volume) {
  await ffmpeg([
    "-y", "-f", "lavfi", "-t", String(durationSeconds),
    "-i", "testsrc2=size=320x180:rate=25",
    "-f", "lavfi", "-t", String(durationSeconds),
    "-i", `sine=frequency=440:sample_rate=44100,volume=${volume}`,
    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "ultrafast",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
    "-ac", "2", "-movflags", "+faststart", outputPath,
  ]);
}

async function masterFixture(inputPath, outputPath) {
  const inputMeasurements = await analyze(inputPath);
  const { stderr } = await ffmpeg([
    "-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
    "-af", buildCreatorProgramLoudnessMasterFilter(inputMeasurements),
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
    "-movflags", "+faststart", outputPath,
  ]);
  const outputMeasurements = await analyze(outputPath);
  const normalizationType = /Normalization Type:\s*(\w+)/.exec(stderr)?.[1] || "unknown";
  return {
    inputMeasurements,
    outputMeasurements,
    normalizationType,
    before: await probe(inputPath),
    after: await probe(outputPath),
  };
}

try {
  assert.ok(ffmpegPath, "local FFmpeg tooling is required");
  const quietInput = join(fixtureDir, "quiet-input.mp4");
  const quietOutput = join(fixtureDir, "quiet-output.mp4");
  const loudInput = join(fixtureDir, "loud-input.mp4");
  const loudOutput = join(fixtureDir, "loud-output.mp4");
  await createFixture(quietInput, 0.05);
  await createFixture(loudInput, 2.5);
  const quiet = await masterFixture(quietInput, quietOutput);
  const loud = await masterFixture(loudInput, loudOutput);

  for (const [name, result] of Object.entries({ quiet, loud })) {
    assert.ok(result.after.hasVideo && result.after.hasAudio, `${name} output must remain playable A/V`);
    assert.ok(result.outputMeasurements.measured_I >= -17 && result.outputMeasurements.measured_I <= -15, `${name} integrated loudness must converge`);
    assert.ok(result.outputMeasurements.measured_TP <= -1.2, `${name} true peak must respect -1.5 dBTP with <=0.3 dB AAC tolerance`);
    assert.ok(Math.abs(result.after.duration - result.before.duration) <= 0.25, `${name} duration must remain stable`);
    assert.ok(Math.abs(result.after.audioDuration - result.after.videoDuration) <= 0.15, `${name} A/V drift must remain bounded`);
  }
  assert.ok(quiet.inputMeasurements.measured_I < -17, "quiet input must start below target");
  assert.ok(loud.inputMeasurements.measured_I > -15, "loud input must start above target");
  assert.ok(Math.abs(quiet.outputMeasurements.measured_I - loud.outputMeasurements.measured_I) <= 0.5, "opposite inputs must converge");

  for (const invalid of [
    "no json",
    '{"input_i":"-inf","input_tp":"-2","input_lra":"0","input_thresh":"-30","target_offset":"0"}',
    '{"input_i":"NaN","input_tp":"-2","input_lra":"0","input_thresh":"-30","target_offset":"0"}',
    '{"input_i":"4","input_tp":"-2","input_lra":"0","input_thresh":"-30","target_offset":"0"}',
  ]) {
    assert.throws(() => parseCreatorProgramLoudnessMeasurements(invalid), CreatorProgramAudioMasterError);
  }

  const renderer = await readFile(new URL("../export-service/src/server.js", import.meta.url), "utf8");
  const concatIndex = renderer.indexOf("await concatSceneClips(");
  const musicIndex = renderer.indexOf("await mixFinalVideoWithCreatorAudioPlan", concatIndex);
  const masterIndex = renderer.indexOf("await masterCreatorProgramAudio", musicIndex);
  const continuityIndex = renderer.indexOf("const finalContinuityCheck = await verifyRenderedContinuity", masterIndex);
  const uploadIndex = renderer.indexOf('.upload(moviePath, outputBuffer', continuityIndex);
  assert.ok(concatIndex < musicIndex && musicIndex < masterIndex && masterIndex < continuityIndex && continuityIndex < uploadIndex, "mastering ordering must be canonical");
  assert.equal((renderer.match(/masterCreatorProgramAudio\(\{/g) || []).length, 2, "one definition and one invocation are required");
  assert.match(renderer.slice(masterIndex - 120, masterIndex), /if \(isCreatorLabExport\)/, "only CreatorLab enters program mastering");
  assert.doesNotMatch(renderer.slice(renderer.indexOf("if (!isCreatorLabExport && bgmPath"), masterIndex), /masterCreatorProgramAudio/, "Storyverse music path must not master");

  console.log("Stage 0.20A2 program loudness mastering passed.");
  console.log(JSON.stringify({ quiet, loud }, null, 2));
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
}
