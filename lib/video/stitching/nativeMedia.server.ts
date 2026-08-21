import { execFile } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import type { TimelineScenePlan } from "../timelineSync";
import {
  matchAudioDurationToScene,
  type AudioDurationMatch,
} from "../audioDurationMatching";
import {
  createVisualFillerPlan,
  type VisualFillerMotionPreset,
  type VisualFillerPlan,
} from "../visualFiller";
import {
  alignDurationToFrameGrid,
  createStitchContinuityCheck,
  describeStitchContinuityIssues,
  STITCH_OUTPUT_FPS,
  type MediaStreamDurations,
  type StitchContinuityCheck,
} from "../stitchContinuity";

export type StitchSceneInput = {
  id?: number;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  dialogueAudioUrl?: string;
  durationSec?: number;
  timing?: {
    targetSceneDuration?: number;
    estimatedSpeechSeconds?: number;
    speechFit?: "safe" | "tight" | "too_long";
    productionRecommendation?:
      "image_motion" | "standard_clip" | "premium_clip" | "split_or_rewrite";
    audioMismatch?: "none" | "short" | "long" | "critical";
    visualAction?:
      | "keep_clip"
      | "slow_clip"
      | "image_motion_tail"
      | "split_scene"
      | "rewrite_voice";
    visualBlocks?: TimelineScenePlan["visualBlocks"];
    durationMatch?: AudioDurationMatch;
    fallbackVisualPlan?: VisualFillerPlan;
    timelineAware?: boolean;
  };
  timelineDecision?: {
    strategy: TimelineScenePlan["productionRecommendation"];
    speechFit: TimelineScenePlan["speechFit"];
    audioMismatch?: TimelineScenePlan["audioMismatch"];
    visualAction?: TimelineScenePlan["visualAction"];
    warning?: string;
  };
};

export const DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS = 5;
export const MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS = 30;
const PREFERRED_MAX_SCENE_DURATION_SECONDS = 20;
export const SPEECH_TAIL_BUFFER_SECONDS = 0.75;
const OUTPUT_SIZE = "960:960";
const OUTPUT_FPS = String(STITCH_OUTPUT_FPS);
const OUTPUT_AUDIO_SAMPLE_RATE = "44100";

if (!ffmpegPath) {
  throw new Error("ffmpeg-static does not provide a binary for this runtime.");
}
const ffmpegExecutable = ffmpegPath;
const ffprobeExecutable = fsSync.existsSync(ffprobeStatic.path)
  ? ffprobeStatic.path
  : "/usr/bin/ffprobe";

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(ffmpegExecutable, ["-y", ...args], (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            [
              "ffmpeg failed",
              error.message,
              stderr ? `stderr: ${stderr}` : "",
              stdout ? `stdout: ${stdout}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        );
        return;
      }

      resolve();
    });
  });
}

function runFfprobe(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(ffprobeExecutable, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      resolve(String(stdout || "").trim());
    });
  });
}

async function getMediaDuration(filePath: string) {
  try {
    const media = await probeMediaStreams(filePath);

    return (
      media.formatDurationSec ||
      media.videoDurationSec ||
      media.audioDurationSec ||
      0
    );
  } catch {
    return 0;
  }
}

function finiteDuration(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function probeMediaStreams(
  filePath: string,
): Promise<MediaStreamDurations> {
  const output = await runFfprobe([
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,duration:format=duration",
      "-of",
      "json",
      filePath,
    ]);
  const parsed = JSON.parse(output) as {
    streams?: Array<{ codec_type?: string; duration?: string }>;
    format?: { duration?: string };
  };
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");

  return {
    formatDurationSec: finiteDuration(parsed.format?.duration),
    videoDurationSec: finiteDuration(videoStream?.duration),
    audioDurationSec: finiteDuration(audioStream?.duration),
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
  };
}

export function roundDuration(value: number) {
  return Math.round(value * 1000) / 1000;
}

async function downloadToFile(url: string, filePath: string) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Asset download failed (${res.status}) for ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

export function safeDuration(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS;
  }

  return Math.min(
    MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
    Math.max(3, numberValue),
  );
}

export function getSceneRequestedDuration(scene: StitchSceneInput) {
  return safeDuration(scene?.durationSec || scene?.timing?.targetSceneDuration);
}

export async function verifyRenderedContinuity(
  filePath: string,
  expectedDurationSec: number,
  label: string,
) {
  const check = createStitchContinuityCheck({
    expectedDurationSec,
    media: await probeMediaStreams(filePath),
  });

  if (!check.ok) {
    throw new Error(
      `${label} failed continuity verification: ${describeStitchContinuityIssues(check)}.`,
    );
  }

  return check;
}

export function getSceneVisualAction(scene: StitchSceneInput) {
  return scene?.timelineDecision?.visualAction || scene?.timing?.visualAction;
}

function createNormalizedVideoFilter(durationSec: number) {
  return [
    `scale=${OUTPUT_SIZE}:force_original_aspect_ratio=decrease`,
    `pad=${OUTPUT_SIZE}:(ow-iw)/2:(oh-ih)/2`,
    "setsar=1",
    `fps=${OUTPUT_FPS}`,
    `trim=start=0:duration=${durationSec.toFixed(3)}`,
    "settb=AVTB",
    `setpts=N/(${OUTPUT_FPS}*TB)`,
    "format=yuv420p",
  ].join(",");
}

function createNormalizedAudioFilter(durationSec: number) {
  return [
    "asetpts=PTS-STARTPTS",
    `aresample=${OUTPUT_AUDIO_SAMPLE_RATE}:async=1:first_pts=0`,
    `aformat=sample_fmts=fltp:sample_rates=${OUTPUT_AUDIO_SAMPLE_RATE}:channel_layouts=stereo`,
    "apad",
    `atrim=start=0:duration=${durationSec.toFixed(3)}`,
    "asetpts=N/SR/TB",
  ].join(",");
}

function createNormalizedAudioInputFilter() {
  return [
    "asetpts=PTS-STARTPTS",
    `aresample=${OUTPUT_AUDIO_SAMPLE_RATE}:async=1:first_pts=0`,
    `aformat=sample_fmts=fltp:sample_rates=${OUTPUT_AUDIO_SAMPLE_RATE}:channel_layouts=stereo`,
  ].join(",");
}

async function createImageMotionVideoBase({
  imageUrl,
  tempDir,
  index,
  durationSec,
  outputVideoPath,
  motionPreset = "slow_push_in",
}: {
  imageUrl: string;
  tempDir: string;
  index: number;
  durationSec: number;
  outputVideoPath: string;
  motionPreset?: VisualFillerMotionPreset;
}) {
  const sourceImagePath = path.join(
    tempDir,
    `scene_${index}_source_image_motion.png`,
  );
  await downloadToFile(imageUrl, sourceImagePath);

  const frameCount = Math.max(1, Math.round(durationSec * Number(OUTPUT_FPS)));
  const zoomPanExpression =
    motionPreset === "soft_pan"
      ? `zoompan=z='1.04':x='min((iw-iw/zoom)*on/${frameCount},iw-iw/zoom)':y='(ih-ih/zoom)/2':d=${frameCount}:s=960x960:fps=${OUTPUT_FPS}`
      : motionPreset === "cutaway"
        ? `zoompan=z='max(1.02,1.08-on*0.0007)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frameCount}:s=960x960:fps=${OUTPUT_FPS}`
        : `zoompan=z='min(zoom+0.0009,1.045)':d=${frameCount}:s=960x960:fps=${OUTPUT_FPS}`;
  const imageMotionFilter = [
    "scale=1100:1100:force_original_aspect_ratio=increase",
    "crop=960:960",
    zoomPanExpression,
    `trim=start=0:duration=${durationSec.toFixed(3)}`,
    "settb=AVTB",
    `setpts=N/(${OUTPUT_FPS}*TB)`,
    "format=yuv420p",
  ].join(",");

  await runFfmpeg([
    "-loop",
    "1",
    "-i",
    sourceImagePath,
    "-t",
    String(durationSec),
    "-vf",
    imageMotionFilter,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputVideoPath,
  ]);
}
async function createVideoClipSegmentFromSource({
  sourceVideoPath,
  outputVideoPath,
  durationSec,
}: {
  sourceVideoPath: string;
  outputVideoPath: string;
  durationSec: number;
}) {
  await runFfmpeg([
    "-i",
    sourceVideoPath,
    "-vf",
    createNormalizedVideoFilter(durationSec),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputVideoPath,
  ]);
}
async function createMotionLoopSegmentFromSource({
  sourceVideoPath,
  outputVideoPath,
  durationSec,
}: {
  sourceVideoPath: string;
  outputVideoPath: string;
  durationSec: number;
}) {
  await runFfmpeg([
    "-stream_loop",
    "-1",
    "-i",
    sourceVideoPath,
    "-t",
    String(durationSec),
    "-vf",
    createNormalizedVideoFilter(durationSec),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputVideoPath,
  ]);
}

async function concatVideoSegments(
  segmentPaths: string[],
  segmentDurationsSec: number[],
  outputVideoPath: string,
) {
  const inputs = segmentPaths.flatMap((segmentPath) => ["-i", segmentPath]);
  const normalizedSegments = segmentPaths.map((_, segmentIndex) => {
    const durationSec = segmentDurationsSec[segmentIndex];

    return `[${segmentIndex}:v]${createNormalizedVideoFilter(durationSec)}[v${segmentIndex}]`;
  });
  const concatInputs = segmentPaths
    .map((_, segmentIndex) => `[v${segmentIndex}]`)
    .join("");
  const filter = [
    ...normalizedSegments,
    `${concatInputs}concat=n=${segmentPaths.length}:v=1:a=0[outv]`,
  ].join(";");

  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputVideoPath,
  ]);
}

async function createFallbackVisualFillerVideoBase({
  scene,
  sourceVideoPath,
  sourceDurationSec,
  tempDir,
  index,
  durationSec,
  outputVideoPath,
}: {
  scene: StitchSceneInput;
  sourceVideoPath?: string;
  sourceDurationSec: number;
  tempDir: string;
  index: number;
  durationSec: number;
  outputVideoPath: string;
}) {
  const visualAction = getSceneVisualAction(scene);
  const plannedStrategy = scene.timing?.fallbackVisualPlan?.strategy;
  const fillerPlan = createVisualFillerPlan({
    targetDurationSec: durationSec,
    sourceDurationSec,
    hasVideo: Boolean(sourceVideoPath),
    hasReferenceImage: Boolean(scene.imageUrl),
    preferCutaway:
      plannedStrategy === "cutaway_sequence" ||
      visualAction === "split_scene",
    gapToleranceSec: 0.05,
  });

  if (!fillerPlan.requiresFiller || !fillerPlan.preventsFreeze) {
    return {
      created: false,
      fillerPlan,
    };
  }

  const segmentPaths: string[] = [];

  for (
    let segmentIndex = 0;
    segmentIndex < fillerPlan.segments.length;
    segmentIndex += 1
  ) {
    const segment = fillerPlan.segments[segmentIndex];
    const segmentPath = path.join(
      tempDir,
      `scene_${index}_filler_${segmentIndex}_${segment.type}.mp4`,
    );

    if (segment.type === "primary_video") {
      if (!sourceVideoPath) {
        throw new Error("Visual filler primary segment is missing source video.");
      }

      await createVideoClipSegmentFromSource({
        sourceVideoPath,
        outputVideoPath: segmentPath,
        durationSec: segment.durationSec,
      });
    } else if (segment.type === "motion_loop") {
      if (!sourceVideoPath) {
        throw new Error("Visual filler motion loop is missing source video.");
      }

      await createMotionLoopSegmentFromSource({
        sourceVideoPath,
        outputVideoPath: segmentPath,
        durationSec: segment.durationSec,
      });
    } else {
      if (!scene.imageUrl) {
        throw new Error("Visual filler image segment is missing reference image.");
      }

      await createImageMotionVideoBase({
        imageUrl: scene.imageUrl,
        tempDir,
        index: index * 100 + segmentIndex + 1,
        durationSec: segment.durationSec,
        outputVideoPath: segmentPath,
        motionPreset: segment.motionPreset,
      });
    }

    segmentPaths.push(segmentPath);
  }

  if (segmentPaths.length === 1) {
    await fs.copyFile(segmentPaths[0], outputVideoPath);
  } else {
    await concatVideoSegments(
      segmentPaths,
      fillerPlan.segments.map((segment) => segment.durationSec),
      outputVideoPath,
    );
  }

  return {
    created: true,
    fillerPlan,
  };
}

async function createSilentAudio(outputPath: string, durationSec: number) {
  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    String(durationSec),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    OUTPUT_AUDIO_SAMPLE_RATE,
    "-ac",
    "2",
    outputPath,
  ]);
}

export async function createSceneAudioClip(
  scene: StitchSceneInput,
  tempDir: string,
  index: number,
  requestedDurationSec: number,
) {
  const audioInputs = [scene.audioUrl, scene.dialogueAudioUrl].filter(
    (url): url is string => Boolean(url),
  );

  const outputAudioPath = path.join(tempDir, `scene_${index}_audio.m4a`);

  if (audioInputs.length === 0) {
    const durationMatch = matchAudioDurationToScene({
      audioDurationSec: 0,
      plannedDurationSec: requestedDurationSec,
      fallbackDurationSec: DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS,
      minDurationSec: 3,
      maxDurationSec: MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
      preferredMaxSceneDurationSec: PREFERRED_MAX_SCENE_DURATION_SECONDS,
      tailBufferSec: SPEECH_TAIL_BUFFER_SECONDS,
    });
    await createSilentAudio(outputAudioPath, requestedDurationSec);
    return {
      audioPath: outputAudioPath,
      durationSec: requestedDurationSec,
      audioDurationSec: 0,
      durationMatch,
    };
  }

  const downloadedAudioPaths: string[] = [];

  for (let i = 0; i < audioInputs.length; i += 1) {
    const audioPath = path.join(tempDir, `scene_${index}_audio_input_${i}.mp3`);
    await downloadToFile(audioInputs[i], audioPath);
    downloadedAudioPaths.push(audioPath);
  }

  const audioDurations = await Promise.all(
    downloadedAudioPaths.map((audioPath) => getMediaDuration(audioPath)),
  );
  const estimatedAudioDuration = audioDurations.reduce(
    (sum, duration) => sum + duration,
    0,
  );
  const durationMatch = matchAudioDurationToScene({
    audioDurationSec: estimatedAudioDuration,
    plannedDurationSec: requestedDurationSec,
    fallbackDurationSec: DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS,
    minDurationSec: 3,
    maxDurationSec: MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
    preferredMaxSceneDurationSec: PREFERRED_MAX_SCENE_DURATION_SECONDS,
    tailBufferSec: SPEECH_TAIL_BUFFER_SECONDS,
  });

  if (!durationMatch.fitsWithinHardLimit) {
    throw new Error(
      `Scene ${scene.id ?? index + 1} narration is too long for one safe visual beat. Split it into at least ${durationMatch.recommendedSplitCount} scenes before export.`,
    );
  }

  const effectiveDuration = durationMatch.targetDurationSec;

  if (downloadedAudioPaths.length === 1) {
    await runFfmpeg([
      "-i",
      downloadedAudioPaths[0],
      "-filter_complex",
      `[0:a]${createNormalizedAudioFilter(effectiveDuration)}[a]`,
      "-map",
      "[a]",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputAudioPath,
    ]);

    return {
      audioPath: outputAudioPath,
      durationSec: effectiveDuration,
      audioDurationSec: roundDuration(estimatedAudioDuration),
      durationMatch,
    };
  }

  const concatInputs = downloadedAudioPaths.flatMap((audioPath) => [
    "-i",
    audioPath,
  ]);
  const normalizedAudioInputs = downloadedAudioPaths.map(
    (_, inputIndex) =>
      `[${inputIndex}:a]${createNormalizedAudioInputFilter()}[a${inputIndex}]`,
  );
  const concatLabels = downloadedAudioPaths
    .map((_, inputIndex) => `[a${inputIndex}]`)
    .join("");
  const filter = [
    ...normalizedAudioInputs,
    `${concatLabels}concat=n=${downloadedAudioPaths.length}:v=0:a=1,${createNormalizedAudioFilter(effectiveDuration)}[a]`,
  ].join(";");

  await runFfmpeg([
    ...concatInputs,
    "-filter_complex",
    filter,
    "-map",
    "[a]",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputAudioPath,
  ]);

  return {
    audioPath: outputAudioPath,
    durationSec: effectiveDuration,
    audioDurationSec: roundDuration(estimatedAudioDuration),
    durationMatch,
  };
}

export async function createSceneVideoBase(
  scene: StitchSceneInput,
  tempDir: string,
  index: number,
  durationSec: number,
) {
  const outputVideoPath = path.join(tempDir, `scene_${index}_video.mp4`);

  if (scene.videoUrl) {
    const sourceVideoPath = path.join(
      tempDir,
      `scene_${index}_source_video.mp4`,
    );
    await downloadToFile(scene.videoUrl, sourceVideoPath);

    const sourceDurationSec = await getMediaDuration(sourceVideoPath);

    const fillerResult = await createFallbackVisualFillerVideoBase({
      scene,
      sourceVideoPath,
      sourceDurationSec,
      tempDir,
      index,
      durationSec,
      outputVideoPath,
    });

    if (fillerResult.created) {
      return {
        videoPath: outputVideoPath,
        fillerPlan: fillerResult.fillerPlan,
      };
    }

    await runFfmpeg([
      "-i",
      sourceVideoPath,
      "-vf",
      createNormalizedVideoFilter(durationSec),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputVideoPath,
    ]);

    return {
      videoPath: outputVideoPath,
      fillerPlan: fillerResult.fillerPlan,
    };
  }

  if (scene.imageUrl) {
    const fillerResult = await createFallbackVisualFillerVideoBase({
      scene,
      sourceDurationSec: 0,
      tempDir,
      index,
      durationSec,
      outputVideoPath,
    });

    if (!fillerResult.created) {
      throw new Error(
        `Scene ${scene.id ?? index + 1} could not create an animated still fallback.`,
      );
    }

    return {
      videoPath: outputVideoPath,
      fillerPlan: fillerResult.fillerPlan,
    };
  }

  throw new Error(`Scene ${scene.id ?? index + 1} has no videoUrl or imageUrl`);
}

export async function muxSceneVideoAndAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  durationSec: number,
) {
  await runFfmpeg([
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-filter_complex",
    [
      `[0:v]${createNormalizedVideoFilter(durationSec)}[v]`,
      `[1:a]${createNormalizedAudioFilter(durationSec)}[a]`,
    ].join(";"),
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    OUTPUT_AUDIO_SAMPLE_RATE,
    "-ac",
    "2",
    "-pix_fmt",
    "yuv420p",
    "-video_track_timescale",
    "90000",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function stitchSceneClips(
  scenePaths: string[],
  sceneDurationsSec: number[],
  outputPath: string,
) {
  const inputs = scenePaths.flatMap((scenePath) => ["-i", scenePath]);
  const normalizedStreams = scenePaths.flatMap((_, sceneIndex) => {
    const durationSec = sceneDurationsSec[sceneIndex];

    return [
      `[${sceneIndex}:v]${createNormalizedVideoFilter(durationSec)}[v${sceneIndex}]`,
      `[${sceneIndex}:a]${createNormalizedAudioFilter(durationSec)}[a${sceneIndex}]`,
    ];
  });
  const concatInputs = scenePaths
    .map((_, sceneIndex) => `[v${sceneIndex}][a${sceneIndex}]`)
    .join("");
  const filter = [
    ...normalizedStreams,
    `${concatInputs}concat=n=${scenePaths.length}:v=1:a=1[outv][outa]`,
  ].join(";");

  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    OUTPUT_AUDIO_SAMPLE_RATE,
    "-ac",
    "2",
    "-pix_fmt",
    "yuv420p",
    "-video_track_timescale",
    "90000",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
