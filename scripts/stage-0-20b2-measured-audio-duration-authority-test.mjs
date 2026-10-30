import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import {
  matchAudioDurationToScene,
  resolveMeasuredAudioCurrentness,
} from "../lib/video/audioDurationMatching.ts";
import { auditFlowContinuityScene } from "../lib/video/flowContinuityAudit.ts";
import {
  getTransitionAwareDuration,
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

const adaptive = (input) => matchAudioDurationToScene({
  minDurationSec: 3,
  maxDurationSec: 30,
  preferredMaxSceneDurationSec: 20,
  tailBufferSec: 0.75,
  durationAuthority: "measured_adaptive",
  ...input,
});
const shortenedMeasured = adaptive({ plannedDurationSec: 13, audioDurationSec: 8, measuredAudioCurrent: true });
assert.equal(shortenedMeasured.targetDurationSec, 8.55, "current measured speech removes the obsolete editorial floor");
assert.equal(shortenedMeasured.tailBufferSec, 0.75, "speech safety authority remains unchanged");
assert.equal(shortenedMeasured.transitionTailSec, 0.55, "visible transition cadence has its own bounded natural tail");
assert.ok(shortenedMeasured.transitionTailSec >= 0.3 && shortenedMeasured.transitionTailSec <= 0.8);
assert.equal(shortenedMeasured.unnecessaryExtensionRemovedSec, 4.45);
assert.ok(shortenedMeasured.targetDurationSec - shortenedMeasured.audioDurationSec < 1, "old planning cannot create multi-second speech padding");
const staleMeasured = adaptive({ plannedDurationSec: 13, audioDurationSec: 8, measuredAudioCurrent: false });
assert.equal(staleMeasured.status, "unmeasured");
assert.equal(staleMeasured.targetDurationSec, 13, "stale audio cannot authorize shortening");
const missingMeasured = adaptive({ plannedDurationSec: 13, audioDurationSec: 0, measuredAudioCurrent: false });
assert.equal(missingMeasured.targetDurationSec, 13, "missing audio preserves editorial planning");
const longerMeasured = adaptive({ plannedDurationSec: 10, audioDurationSec: 14, measuredAudioCurrent: true });
assert.equal(longerMeasured.targetDurationSec, 14.55, "current measured speech safely extends the scene without truncation");
assert.ok(longerMeasured.targetDurationSec > longerMeasured.audioDurationSec);
const adaptiveUnsafe = adaptive({ plannedDurationSec: 13, audioDurationSec: 31, measuredAudioCurrent: true });
assert.equal(adaptiveUnsafe.status, "unsafe");
assert.equal(adaptiveUnsafe.fitsWithinHardLimit, false);
assert.equal(adaptiveUnsafe.targetDurationSec, 31.75, "unsafe speech is never truncated to the hard maximum");
assert.equal(adaptiveUnsafe.targetDurationSec, adaptiveUnsafe.audioDurationSec + adaptiveUnsafe.tailBufferSec, "hard-limit failure retains the 0.75-second speech safety authority");
assert.equal(resolveMeasuredAudioCurrentness({ narrationRequired: true, narrationCurrent: true, dialogueRequired: true, dialogueCurrent: false }), false, "one stale required track blocks measured authority");
assert.equal(resolveMeasuredAudioCurrentness({ narrationRequired: true, narrationCurrent: true, dialogueRequired: true }), false, "one missing currentness result blocks measured authority");
assert.equal(resolveMeasuredAudioCurrentness({ narrationRequired: true, narrationCurrent: true, dialogueRequired: true, dialogueCurrent: true }), true, "all required current tracks authorize measured timing");

const creatorSceneId = "11111111-1111-4111-8111-111111111111";
const imageCoverage = [{
  id: `${creatorSceneId}.coverage.1`, creatorSceneId,
  startSec: 0, endSec: 10, durationSec: 10,
  kind: "image", sourceUrl: "https://assets.test/image.jpg",
  sourceType: "scene_image", renderer: "static_image",
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
const adaptiveRendererTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 13, coverageBackedTarget: 13, audioDuration: 8,
  sourceType: "video", sourceDuration: 13, durationAuthority: "measured_adaptive",
  measuredAudioCurrent: true, minimumDuration: 3, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(adaptiveRendererTarget, shortenedMeasured.targetDurationSec, "Preview timing and renderer timing share the measured-adaptive target");
const shortMeasured = adaptive({ plannedDurationSec: 10, audioDurationSec: 4, measuredAudioCurrent: true });
const shortAdaptiveRendererTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 10, coverageBackedTarget: 10, audioDuration: 4,
  sourceType: "image", sourceDuration: 0, durationAuthority: "measured_adaptive",
  measuredAudioCurrent: true, minimumDuration: 8, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(shortAdaptiveRendererTarget, shortMeasured.targetDurationSec, "Renderer does not restore the legacy eight-second floor after current measured speech");
const staleUrlRendererTarget = resolveAudioFirstSceneTargetDuration({
  requestedTarget: 13, coverageBackedTarget: 13, audioDuration: 8,
  sourceType: "video", sourceDuration: 13, durationAuthority: "measured_adaptive",
  measuredAudioCurrent: false, minimumDuration: 3, defaultDuration: 10, tailBuffer: 0.75,
});
assert.equal(staleUrlRendererTarget, 13, "a measured stale URL cannot authorize renderer shortening");
assert.equal(resolveAudioFirstSceneTargetDuration({
  requestedTarget: Number.NaN, coverageBackedTarget: 13, audioDuration: 8,
  sourceType: "video", sourceDuration: 13, durationAuthority: "measured_adaptive",
  measuredAudioCurrent: false, minimumDuration: 3, defaultDuration: 10,
}), 13, "unknown currentness preserves coverage-backed editorial planning when no requested target exists");
const adaptiveVideoRenderDuration = getTransitionAwareDuration({
  targetDuration: adaptiveRendererTarget,
  audioDuration: 8,
  sourceDuration: 13,
  durationAuthority: "measured_adaptive",
  measuredAudioCurrent: true,
});
assert.equal(adaptiveVideoRenderDuration, 8.55, "a longer video source cannot re-expand the authoritative adaptive target");
const adaptiveImageRenderDuration = getTransitionAwareDuration({
  targetDuration: adaptiveRendererTarget,
  audioDuration: 8,
  durationAuthority: "measured_adaptive",
  measuredAudioCurrent: true,
});
assert.equal(adaptiveImageRenderDuration, 8.55, "image rendering cannot re-expand the visible target to the 0.75-second safety tail");
assert.equal(getTransitionAwareDuration({
  targetDuration: 13,
  audioDuration: 8,
  sourceDuration: 13,
  durationAuthority: "measured_adaptive",
  measuredAudioCurrent: false,
}), 13, "stale renderer timing preserves legacy planned/source duration");
assert.ok(Math.abs(Math.round(adaptiveVideoRenderDuration * 25) / 25 - adaptiveRendererTarget) <= 1 / 25, "final renderer remains within one 25fps frame of persisted and preview timing");
const longVideoCoverage = [{ ...imageCoverage[0], endSec: 13, durationSec: 13, kind: "video", renderer: "native_video" }];
const trimmedCoverage = reconcileVisualCoveragePlan({ creatorSceneId, visualCoveragePlan: longVideoCoverage }, adaptiveRendererTarget);
assert.equal(trimmedCoverage.at(-1)?.endSec, adaptiveRendererTarget, "longer video coverage trims to the shorter authoritative scene window");
assert.equal(longVideoCoverage[0].endSec, 13, "coverage reconciliation leaves the longer reusable source plan untouched");
const shortCoverageAudit = auditFlowContinuityScene({
  id: creatorSceneId, source: "video", targetDurationSec: adaptiveRendererTarget,
  narrationDurationSec: 8, videoDurationSec: 6, hasNarration: true,
});
assert.ok(shortCoverageAudit.risks.includes("visual_gap"), "short visual coverage retains genuine continuity risk");
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
const pageSource = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const nativeMediaSource = await readFile(new URL("../lib/video/stitching/nativeMedia.server.ts", import.meta.url), "utf8");
const stitchServiceSource = await readFile(new URL("../lib/video/stitching/stitchVideoService.server.ts", import.meta.url), "utf8");
assert.match(rendererSource, /resolveAudioFirstSceneTargetDuration/);
assert.match(rendererSource, /body\.creatorFormat === "youtube_video"[\s\S]*?"measured_adaptive"[\s\S]*?"audio_compact"/);
assert.match(rendererSource, /effectiveVisualSourceDuration,\s*creatorDurationAuthority/);
assert.match(rendererSource, /getTransitionAwareDuration\(\{[\s\S]*?durationAuthority,[\s\S]*?measuredAudioCurrent,/);
assert.doesNotMatch(rendererSource, /\batempo\b/);
assert.match(pageSource, /creatorFormat === "youtube_video"[\s\S]*?"measured_adaptive"[\s\S]*?measuredAudioCurrent/);
assert.match(pageSource, /scene\.timing\?\.targetSceneDuration \|\| getCreatorPlannedSceneDuration\(scene\)/, "Project Preview consumes the persisted adaptive target before the old plan");
assert.match(pageSource, /targetSceneDuration - durationMatch\.transitionTailSec/, "The speech ceiling uses the visible transition tail without relabeling it as speech safety");
assert.match(pageSource, /narrationCurrent[\s\S]*getCreatorNarrationAudioCurrentness[\s\S]*dialogueCurrent[\s\S]*getCreatorDialogueAudioCurrentness/, "stale tracks cannot install measured-adaptive timing");
assert.match(nativeMediaSource, /measuredAudioCurrent: hasAuthoritativeStitchAudioCurrentness\(scene\)/);
assert.match(nativeMediaSource, /return scene\.measuredAudioCurrent === true;/, "native stitching requires explicit currentness authority");
assert.doesNotMatch(nativeMediaSource, /measuredAudioCurrent:\s*Boolean\([^)]*(?:audioUrl|audioInputs)/, "native stitching cannot infer currentness from URL presence");
assert.match(stitchServiceSource, /creatorFormat === "youtube_video"[\s\S]*?"measured_adaptive"/);
