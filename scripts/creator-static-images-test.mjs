import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { createJiti } from 'jiti';
import { buildStaticImageFilter } from '../export-service/src/staticImage.js';
import { buildCreatorVisualFitFilters } from '../export-service/src/creatorVisualFit.js';
import { assertStaticImageCoveragePolicy, CreatorStaticImagePlanError, reconcileVisualCoveragePlan, validateVisualCoveragePlan, getTransitionAwareDuration } from '../export-service/src/visualCoverage.js';

const jiti = createJiti(import.meta.url, { fsCache: false });
const { createCreatorVisualCoveragePlan, validateCreatorVisualCoveragePlan } = await jiti.import('../lib/creator/visualCoverage.ts');
const { createVisualFillerPlan } = await jiti.import('../lib/video/visualFiller.ts');
const { buildCreatorFinalProductionSignature } = await jiti.import('../lib/creator/finalProductionSignature.ts');
const run = promisify(execFile);
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'creator-static-images-'));
const metrics = [];
const image = path.join(dir, 'synthetic-still.png');
const audio = path.join(dir, 'synthetic-narration.wav');
const video = path.join(dir, 'synthetic-video.mp4');
const imageUrl = 'https://synthetic.invalid/still.png';
const videoUrl = 'https://synthetic.invalid/video.mp4';
const scene = { creatorSceneId: 'synthetic-scene', image: imageUrl, selectedSource: 'image', targetDurationSec: 3.04 };
const plan = createCreatorVisualCoveragePlan(scene, { editorialCadence: true });
assert.equal(plan.length, 1);
assert.equal(plan[0].renderer, 'static_image');
assert.equal(plan[0].motionPreset, undefined);
assert.equal(plan[0].durationSec, 3.04);
assert.equal(validateCreatorVisualCoveragePlan({ creatorSceneId: scene.creatorSceneId, targetDurationSec: 3.04, beats: plan }).renderable, true);
for (const duration of [0.12, 6.2, 18, 41.37]) {
  const beats = createCreatorVisualCoveragePlan({ ...scene, targetDurationSec: duration }, { editorialCadence: true });
  assert.equal(beats.length, 1);
  assert.equal(beats[0].durationSec, duration);
  assert.equal(validateVisualCoveragePlan({ visualCoveragePlan: beats }, duration).length, 1);
  const extended = reconcileVisualCoveragePlan({ visualCoveragePlan: beats }, duration + 0.75);
  assert.equal(extended[0].endSec, Math.round((duration + 0.75) * 100) / 100);
}
const filler = createVisualFillerPlan({ targetDurationSec: 38, hasReferenceImage: true });
assert.equal(filler.segments.length, 1, 'same still is not subdivided into motion beats');
assert.equal(filler.segments[0].motionPreset, 'static');
const tail = createVisualFillerPlan({ targetDurationSec: 38, sourceDurationSec: 6, hasVideo: true, hasReferenceImage: true, preferCutaway: true });
assert.equal(tail.segments.length, 2);
assert.equal(tail.segments[1].motionPreset, 'static');
const legacy = [{ ...plan[0], renderer: 'native_zoompan_v1', motionPreset: 'slow_push_in' }];
const legacyBefore = structuredClone(legacy);
assert.throws(() => reconcileVisualCoveragePlan({ visualCoveragePlan: legacy }, 3.04), CreatorStaticImagePlanError);
assert.deepEqual(legacy, legacyBefore, 'legacy signed plans are rejected without mutation');
assert.equal(validateCreatorVisualCoveragePlan({ creatorSceneId: scene.creatorSceneId, targetDurationSec: 3.04, beats: legacy }).valid, false);
const signature = beats => buildCreatorFinalProductionSignature({ scenes: [{ ...scene, exportSource: 'image', visualCoveragePlan: beats }], backgroundMusic: { mode: 'none' } });
assert.notEqual(signature(plan), signature(legacy), 'static rendering requires a new production signature');

// Extract exact production function declarations; never import the HTTP server,
// load its environment, listen on a port, or connect to storage/providers.
async function rendererFunctions(file, names, dependencies) {
  const source = await fs.readFile(new URL(file, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.equal(functions.length, names.length);
  const text = functions.map(n => n.getText(ast)).join('\n');
  const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const context = vm.createContext({ ...dependencies, result: null });
  vm.runInContext(js + '\nresult={' + names.join(',') + '};', context);
  return context.result;
}
async function probe(file) {
  const { stdout } = await run(existsSync(ffprobe.path) ? ffprobe.path : 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  return JSON.parse(stdout);
}
const downloads = [];
async function downloadFile(url, destination) {
  assert.ok(url === imageUrl || url === videoUrl, 'no external requests allowed');
  downloads.push(url);
  await fs.copyFile(url === imageUrl ? image : video, destination);
}
const dependencies = {
  path, fs, OUTPUT_WIDTH: 1280, OUTPUT_HEIGHT: 720, OUTPUT_FPS: 25,
  OUTPUT_AUDIO_SAMPLE_RATE: 44100, TARGET_SCENE_DURATION: 10,
  SCENE_TRANSITION_TRIM_SECONDS: 0.22, SPEECH_FREEZE_TAIL_BUFFER_SECONDS: 0.75,
  buildStaticImageFilter, buildCreatorVisualFitFilters, getTransitionAwareDuration,
  reconcileVisualCoveragePlan, assertStaticImageCoveragePolicy,
  runFfmpeg: args => run(ffmpeg, args, { maxBuffer: 8 * 1024 * 1024 }),
  getMediaDuration: async file => Number((await probe(file)).format.duration),
  downloadFile,
};
const server = await rendererFunctions('../export-service/src/server.js', [
  'roundDuration', 'alignDurationToFrameGrid', 'createNormalizedVideoFilter',
  'createCreatorTrimmedVideoFilter', 'createNormalizedAudioFilter', 'createStaticImageFilter',
  'createImageClipWithAudio', 'createSceneClipWithAudio', 'createVisualCoverageClipWithAudio',
  'resolveCreatorExportSequence',
], dependencies);
const native = await rendererFunctions('../lib/video/stitching/nativeMedia.server.ts', [
  'createStaticImageVideoBase', 'createVideoClipSegmentFromSource', 'createNormalizedVideoFilter',
], { ...dependencies, OUTPUT_SIZE: '960:960', OUTPUT_FPS: '25', downloadToFile: downloadFile });

async function frame(file, index, filter = '') {
  const { stdout } = await run(ffmpeg, ['-v', 'error', '-i', file, '-vf', [filter, `select=eq(n\\,${index})`].filter(Boolean).join(','), '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
  assert.ok(stdout.length > 0);
  return stdout;
}
function difference(a, b) {
  assert.equal(a.length, b.length);
  let sum = 0, above3 = 0;
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; if (d > 3) above3++; }
  return { meanAbsoluteDifference: sum / a.length, fractionAbove3: above3 / a.length };
}
async function verifyAudioTiming(file) {
  const { stdout } = await run(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '44100', '-f', 'f32le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024 });
  const rms = (start, end) => {
    let sum = 0, count = 0;
    for (let n = Math.round(start * 44100); n < Math.round(end * 44100); n++) {
      const sample = stdout.readFloatLE(n * 4); sum += sample * sample; count++;
    }
    return Math.sqrt(sum / count);
  };
  assert.ok(rms(0.02, 0.12) > 0.02, 'narration starts without a new delay');
  assert.ok(rms(2.2, 2.35) > 0.02, 'narration ending is retained');
  assert.ok(rms(2.65, 2.95) < 0.001, 'post-narration tail remains silent');
}
async function verifyStatic(name, file, expectedDuration, indices, hasAudio = true) {
  const p = await probe(file), v = p.streams.find(s => s.codec_type === 'video'), a = p.streams.find(s => s.codec_type === 'audio');
  assert.ok(Math.abs(Number(v.duration) - expectedDuration) <= 0.041, name + ': full assigned duration');
  if (hasAudio) {
    assert.ok(a, 'audio preserved');
    assert.ok(Math.abs(Number(a.duration) - Number(v.duration)) <= 0.05, name + ': audio/video drift');
    await verifyAudioTiming(file);
  }
  const frames = await Promise.all(indices.map(i => frame(file, i)));
  const diffs = frames.slice(1).map(f => difference(frames[0], f));
  for (const d of diffs) {
    assert.ok(d.meanAbsoluteDifference < 0.6, name + ': no image motion, only encoding noise');
    assert.ok(d.fractionAbove3 < 0.025, name + ': no position shift/jitter');
  }
  metrics.push({ name, videoDuration: Number(v.duration), audioDuration: a ? Number(a.duration) : null, frameIndices: indices, differences: diffs });
}
try {
  await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=480x360:rate=25', '-frames:v', '1', image]);
  await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=2.4', audio]);
  await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=480x360:rate=25:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
  const direct = path.join(dir, 'direct.mp4');
  await server.createImageClipWithAudio({ imagePath: image, audioPath: audio, outputPath: direct, targetDuration: 3.04, visualFitMode: 'cover', durationAuthority: 'measured_adaptive', measuredAudioCurrent: true });
  await verifyStatic('direct-image', direct, 3.04, [0, 38, 75]);
  const coverage = path.join(dir, 'coverage.mp4');
  await server.createVisualCoverageClipWithAudio({ scene: { ...scene, visualCoveragePlan: plan }, audioPath: audio, outputPath: coverage, targetDuration: 3.04, tempDir: dir, sceneIndex: 1, visualFitMode: 'cover' });
  await verifyStatic('durable-coverage-image', coverage, 3.04, [0, 38, 75]);
  const fallback = path.join(dir, 'fallback.mp4');
  await server.createSceneClipWithAudio({ videoPath: video, referenceImagePath: image, audioPath: audio, outputPath: fallback, targetDuration: 3.04, creatorTrim: { isTrimmed: true, clipInSec: 1, visualDurationSec: 1 }, visualFitMode: 'cover', durationAuthority: 'measured_adaptive', measuredAudioCurrent: true });
  await verifyStatic('static-image-tail', fallback, 3.04, [26, 50, 75]);
  const nativeImage = path.join(dir, 'native-image.mp4');
  await native.createStaticImageVideoBase({ imageUrl, tempDir: dir, index: 1, durationSec: 3.04, outputVideoPath: nativeImage });
  await verifyStatic('native-stitch-image', nativeImage, 3.04, [0, 38, 75], false);
  const renderedVideo = path.join(dir, 'video-trim.mp4');
  const videoBeat = { ...plan[0], kind: 'video', renderer: 'native_video', sourceType: 'generated_video', sourceUrl: videoUrl, sourceStartSec: 1, endSec: 3, durationSec: 3 };
  await server.createVisualCoverageClipWithAudio({ scene: { creatorSceneId: scene.creatorSceneId, visualCoveragePlan: [videoBeat] }, audioPath: audio, outputPath: renderedVideo, targetDuration: 3, tempDir: dir, sceneIndex: 2, visualFitMode: 'cover' });
  const videoProbe = await probe(renderedVideo);
  assert.equal(Number(videoProbe.streams.find(s => s.codec_type === 'video').duration), 3);
  assert.equal(Number(videoProbe.streams.find(s => s.codec_type === 'audio').duration), 3);
  const v0 = await frame(renderedVideo, 0), v1 = await frame(renderedVideo, 24);
  assert.ok(difference(v0, v1).meanAbsoluteDifference > 3, 'genuine video still moves');
  const fit = buildCreatorVisualFitFilters({ mode: 'cover', outputWidth: 1280, outputHeight: 720 }).join(',');
  const expectedTrim = await frame(video, 25, fit), untrimmed = await frame(video, 0, fit);
  assert.ok(difference(v0, expectedTrim).meanAbsoluteDifference < difference(v0, untrimmed).meanAbsoluteDifference / 3, 'video source trim preserved');
  const beforeDownloads = downloads.length;
  await assert.rejects(() => server.createVisualCoverageClipWithAudio({ scene: { creatorSceneId: scene.creatorSceneId, visualCoveragePlan: legacy }, outputPath: path.join(dir, 'must-not-render.mp4'), targetDuration: 3.04, tempDir: dir, sceneIndex: 3 }), CreatorStaticImagePlanError);
  assert.equal(downloads.length, beforeDownloads, 'legacy rejection precedes media access');
  assert.throws(() => server.resolveCreatorExportSequence([{ ...scene, exportSource: 'image', visualCoveragePlan: legacy }]), CreatorStaticImagePlanError);
  const serverSource = await fs.readFile(new URL('../export-service/src/server.js', import.meta.url), 'utf8');
  const nativeSource = await fs.readFile(new URL('../lib/video/stitching/nativeMedia.server.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(serverSource + nativeSource, /zoompan=|createImageMotion/);
  console.log(JSON.stringify({ staticImageAcceptance: 'PASS', fixtures: 'synthetic-only', networkRequests: 0, applicationServicesStarted: 0, legacySignedPlans: 'REJECTED_WITHOUT_MUTATION', productionSignatureChangeRequired: true, genuineVideoPlaybackAndTrim: 'PASS', renders: metrics }, null, 2));
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
