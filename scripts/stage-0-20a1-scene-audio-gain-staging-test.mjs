import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { buildCreatorSceneAudioMixFilter } from "../export-service/src/creatorSceneAudioMix.js";
import { CREATOR_AUDIO_MIX_POLICY } from "../export-service/src/creatorAudioPolicy.js";

const execFileAsync = promisify(execFile);
const durationSeconds = 3;
const fixtureDir = await mkdtemp(join(tmpdir(), "velto-stage-0-20a1-"));

async function ffmpeg(args) {
  try {
    return await execFileAsync(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`ffmpeg failed: ${error.stderr || error.message}`);
  }
}

async function createTone(outputPath, frequency, volume) {
  await ffmpeg([
    "-y", "-f", "lavfi", "-t", String(durationSeconds),
    "-i", `sine=frequency=${frequency}:sample_rate=44100`,
    "-af", `volume=${volume},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`,
    "-c:a", "pcm_f32le", outputPath,
  ]);
}

async function mix(outputPath, inputs, flags) {
  await ffmpeg([
    "-y", ...inputs.flatMap((input) => ["-i", input]),
    "-filter_complex", buildCreatorSceneAudioMixFilter({ durationSeconds, ...flags }),
    "-map", "[creator_scene_audio]", "-c:a", "pcm_f32le", outputPath,
  ]);
}

async function measure(outputPath, filter = "volumedetect") {
  let stderr = "";
  try {
    ({ stderr } = await execFileAsync(ffmpegPath, ["-i", outputPath, "-af", filter, "-f", "null", "-"]));
  } catch (error) {
    stderr = error.stderr || "";
  }
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  assert.ok(mean && peak, `volume metrics missing for ${outputPath}`);
  return { meanDb: Number(mean[1]), peakDb: Number(peak[1]) };
}

try {
  assert.ok(ffmpegPath, "ffmpeg-static is required");
  const speech = join(fixtureDir, "speech.wav");
  const ambient = join(fixtureDir, "ambient.wav");
  const sfx = join(fixtureDir, "sfx.wav");
  const speechAmbient = join(fixtureDir, "speech-ambient.wav");
  const allLayers = join(fixtureDir, "speech-ambient-sfx.wav");
  const sequential = join(fixtureDir, "sequential.wav");

  await createTone(speech, 440, 0.5);
  await createTone(ambient, 997, 0.025);
  await createTone(sfx, 1783, 0.02);
  await mix(speechAmbient, [speech, ambient], {
    hasSpeech: true, hasAmbient: true, hasSfx: false,
  });
  await mix(allLayers, [speech, ambient, sfx], {
    hasSpeech: true, hasAmbient: true, hasSfx: true,
  });
  await ffmpeg([
    "-y", "-i", speech, "-i", allLayers,
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[sequential]",
    "-map", "[sequential]", "-c:a", "pcm_f32le", sequential,
  ]);

  const speechMetrics = await measure(speech);
  const ambientMetrics = await measure(speechAmbient);
  const allMetrics = await measure(allLayers);
  const sequentialFirst = await measure(sequential, `atrim=start=0:duration=${durationSeconds},volumedetect`);
  const sequentialSecond = await measure(sequential, `atrim=start=${durationSeconds}:duration=${durationSeconds},volumedetect`);
  const delta = (value) => Math.abs(value.meanDb - speechMetrics.meanDb);
  const limiterCeilingDb = 20 * Math.log10(CREATOR_AUDIO_MIX_POLICY.sceneLimiterCeiling);

  assert.ok(delta(ambientMetrics) <= 1, "ambient must not attenuate scene narration");
  assert.ok(delta(allMetrics) <= 1, "ambient and SFX must not attenuate scene narration");
  assert.ok(Math.abs(sequentialSecond.meanDb - sequentialFirst.meanDb) <= 2, "concatenated layered and unlayered scenes must stay within 2 dB");
  assert.ok(ambientMetrics.peakDb <= limiterCeilingDb + 0.11 && allMetrics.peakDb <= limiterCeilingDb + 0.11, "mixed output must stay below the safety ceiling");
  assert.ok((await stat(speechAmbient)).size > 0 && (await stat(allLayers)).size > 0);

  const graph = buildCreatorSceneAudioMixFilter({
    durationSeconds, hasSpeech: true, hasAmbient: true, hasSfx: true,
  });
  assert.match(graph, /volume=1\.000000\[creator_scene_speech\]/);
  assert.match(graph, /amix=inputs=3:duration=first:dropout_transition=0:normalize=0/);
  assert.match(graph, new RegExp(`alimiter=limit=${CREATOR_AUDIO_MIX_POLICY.sceneLimiterCeiling.toFixed(3)}`));
  const renderer = await readFile(new URL("../export-service/src/server.js", import.meta.url), "utf8");
  assert.equal((renderer.match(/mixCreatorSceneAudioLayers\(\{/g) || []).length, 2, "one definition and one scene invocation are expected");
  assert.doesNotMatch(renderer, /mixSceneAudioWithAmbient/);
  assert.match(renderer, /if \(inputs\.length === 1\) return inputs\[0\]/, "speech-only audio avoids re-encoding");

  console.log("Stage 0.20A1 scene audio gain staging passed.");
  console.log(JSON.stringify({
    speech: speechMetrics,
    speechAmbient: ambientMetrics,
    speechAmbientSfx: allMetrics,
    sequential: { first: sequentialFirst, second: sequentialSecond },
  }));
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
}
