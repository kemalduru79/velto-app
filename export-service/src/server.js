import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(
  /.*/,
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
const TARGET_SCENE_DURATION = 10;
const MAX_SCENE_DURATION = 12;
const MAX_SPEECH_RATIO = 0.82;
const MIN_SCENE_DURATION = 8;
const SCENE_TRANSITION_TRIM_SECONDS = 0.22;
const MIN_AUDIO_TAIL_BUFFER_SECONDS = 0.08;
const SPEECH_FREEZE_TAIL_BUFFER_SECONDS = 0.75;
const AMBIENT_ENGINE_ENABLED = true;
const AMBIENT_DEFAULT_VOLUME = 0.055;
const AMBIENT_MAX_VOLUME = 0.085;
// 3N-4 PRODUCTION STITCH CONTINUITY
const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const OUTPUT_FPS = 25;
const OUTPUT_AUDIO_SAMPLE_RATE = 44100;
const STITCH_DURATION_TOLERANCE_SECONDS = 0.25;
const STITCH_AV_DRIFT_TOLERANCE_SECONDS = 0.15;

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function safeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9-_]/g, "_");
}

function resolveFfmpegBinary() {
  return "ffmpeg";
}

function resolveFfprobeBinary() {
  return "ffprobe";
}

async function runFfmpeg(args) {
  const ffmpegBinary = resolveFfmpegBinary();

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary, args);

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg failed with exit code ${code}`));
    });
  });
}

function runFfprobe(args) {
  const ffprobeBinary = resolveFfprobeBinary();

  return new Promise((resolve, reject) => {
    const child = spawn(ffprobeBinary, args);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr || `ffprobe failed with exit code ${code}`));
    });
  });
}

async function downloadFile(url, filePath) {
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || `Dosya indirilemedi: ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(filePath, buffer);
}

async function getMediaDuration(filePath) {
  const output = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const parsed = Number(output);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

function roundDuration(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function alignDurationToFrameGrid(value) {
  const safeValue = Math.max(1 / OUTPUT_FPS, Number(value || 0));
  return Math.max(
    1 / OUTPUT_FPS,
    Math.round(safeValue * OUTPUT_FPS) / OUTPUT_FPS
  );
}

function finitePositiveDuration(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function probeMediaStreams(filePath) {
  const output = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,duration:format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(output || "{}");
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");

  return {
    formatDurationSec: finitePositiveDuration(parsed?.format?.duration),
    videoDurationSec: finitePositiveDuration(videoStream?.duration),
    audioDurationSec: finitePositiveDuration(audioStream?.duration),
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
  };
}

async function verifyRenderedContinuity(
  filePath,
  expectedDurationSec,
  label
) {
  const media = await probeMediaStreams(filePath);
  const actualDurationSec =
    media.formatDurationSec ||
    media.videoDurationSec ||
    media.audioDurationSec ||
    0;
  const videoDurationSec = media.videoDurationSec || actualDurationSec;
  const audioDurationSec = media.audioDurationSec || actualDurationSec;
  const durationDeltaSec = Math.abs(actualDurationSec - expectedDurationSec);
  const audioVideoDriftSec = Math.abs(videoDurationSec - audioDurationSec);

  const issues = [];

  if (!media.hasVideo) issues.push("video stream missing");
  if (!media.hasAudio) issues.push("audio stream missing");

  if (durationDeltaSec > STITCH_DURATION_TOLERANCE_SECONDS) {
    issues.push(
      `duration delta ${durationDeltaSec.toFixed(3)}s exceeds ` +
        `${STITCH_DURATION_TOLERANCE_SECONDS.toFixed(3)}s`
    );
  }

  if (audioVideoDriftSec > STITCH_AV_DRIFT_TOLERANCE_SECONDS) {
    issues.push(
      `audio/video drift ${audioVideoDriftSec.toFixed(3)}s exceeds ` +
        `${STITCH_AV_DRIFT_TOLERANCE_SECONDS.toFixed(3)}s`
    );
  }

  if (issues.length > 0) {
    throw new Error(
      `${label} failed 3N-4 continuity verification: ${issues.join(", ")}.`
    );
  }

  return {
    ok: true,
    expectedDurationSec: roundDuration(expectedDurationSec),
    actualDurationSec: roundDuration(actualDurationSec),
    videoDurationSec: roundDuration(videoDurationSec),
    audioDurationSec: roundDuration(audioDurationSec),
    durationDeltaSec: roundDuration(durationDeltaSec),
    audioVideoDriftSec: roundDuration(audioVideoDriftSec),
  };
}

function createNormalizedVideoFilter(durationSec) {
  return [
    `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
    "setsar=1",
    `fps=${OUTPUT_FPS}`,
    `trim=start=0:duration=${durationSec.toFixed(3)}`,
    "settb=AVTB",
    `setpts=N/(${OUTPUT_FPS}*TB)`,
    "format=yuv420p",
  ].join(",");
}

function createNormalizedAudioFilter(durationSec) {
  return [
    "asetpts=PTS-STARTPTS",
    `aresample=${OUTPUT_AUDIO_SAMPLE_RATE}:async=1:first_pts=0`,
    `aformat=sample_fmts=fltp:sample_rates=${OUTPUT_AUDIO_SAMPLE_RATE}:channel_layouts=stereo`,
    "apad",
    `atrim=start=0:duration=${durationSec.toFixed(3)}`,
    "asetpts=N/SR/TB",
  ].join(",");
}

function createImageMotionFilter(durationSec, motionPreset = "slow_push_in") {
  const frameCount = Math.max(1, Math.round(durationSec * OUTPUT_FPS));
  const motion =
    motionPreset === "soft_pan"
      ? `zoompan=z='1.045':x='min((iw-iw/zoom)*on/${frameCount},iw-iw/zoom)':y='(ih-ih/zoom)/2':d=${frameCount}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${OUTPUT_FPS}`
      : `zoompan=z='min(zoom+0.0008,1.055)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frameCount}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${OUTPUT_FPS}`;

  return [
    "scale=1400:788:force_original_aspect_ratio=increase",
    `crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}`,
    motion,
    `trim=start=0:duration=${durationSec.toFixed(3)}`,
    "settb=AVTB",
    `setpts=N/(${OUTPUT_FPS}*TB)`,
    "format=yuv420p",
  ].join(",");
}

function getSceneAudioMixProfile(scene) {
  const target = Number(scene?.timing?.targetSceneDuration || 0);
  const hasDialogue = !!scene?.dialogueAudioUrl;
  const custom = scene?.audioMixProfile || {};

  let pauseMs = 50;
  let sceneFadeInSec = 0.06;
  let sceneFadeOutSec = 0.1;

  if (hasDialogue) {
    pauseMs = 70;
    sceneFadeInSec = 0.06;
    sceneFadeOutSec = 0.12;
  }

  if (target >= 8) {
    pauseMs = hasDialogue ? 70 : 40;
    sceneFadeInSec = 0.08;
    sceneFadeOutSec = 0.12;
  }

  if (target >= 10) {
    pauseMs = hasDialogue ? 70 : 40;
    sceneFadeInSec = 0.08;
    sceneFadeOutSec = 0.14;
  }

  return {
    pauseMs:
      typeof custom.pauseMs === "number" && custom.pauseMs >= 0
        ? custom.pauseMs
        : pauseMs,
    sceneFadeInSec:
      typeof custom.sceneFadeInSec === "number" && custom.sceneFadeInSec >= 0
        ? custom.sceneFadeInSec
        : sceneFadeInSec,
    sceneFadeOutSec:
      typeof custom.sceneFadeOutSec === "number" && custom.sceneFadeOutSec >= 0
        ? custom.sceneFadeOutSec
        : sceneFadeOutSec,
  };
}

function getSceneTargetDuration(scene, fallbackAudioDuration, sourceType = "image", sourceDuration = 0) {
  const requestedTarget = Number(scene?.timing?.targetSceneDuration || 0);
  const safeAudioDuration = Number.isFinite(fallbackAudioDuration) ? fallbackAudioDuration : 0;
  const safeSourceDuration = Number.isFinite(sourceDuration) ? sourceDuration : 0;
  const audioDrivenDuration =
    safeAudioDuration > 0
      ? safeAudioDuration + SPEECH_FREEZE_TAIL_BUFFER_SECONDS
      : 0;

  if (sourceType === "video" && safeSourceDuration > 0) {
    if (audioDrivenDuration > 0) {
      return Math.max(safeSourceDuration, requestedTarget || 0, audioDrivenDuration);
    }

    return safeSourceDuration;
  }

  return Math.max(
    MIN_SCENE_DURATION,
    requestedTarget || TARGET_SCENE_DURATION,
    audioDrivenDuration || TARGET_SCENE_DURATION
  );
}

function getTransitionAwareDuration({ targetDuration, audioDuration = 0, sourceDuration = 0 }) {
  const safeTargetDuration =
    Number.isFinite(targetDuration) && targetDuration > 0
      ? targetDuration
      : TARGET_SCENE_DURATION;
  const safeAudioDuration =
    Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0;
  const safeSourceDuration =
    Number.isFinite(sourceDuration) && sourceDuration > 0 ? sourceDuration : 0;

  const trimmedDuration = Math.max(0.1, safeTargetDuration - SCENE_TRANSITION_TRIM_SECONDS);

  if (safeAudioDuration > 0) {
    const audioSafeDuration = safeAudioDuration + SPEECH_FREEZE_TAIL_BUFFER_SECONDS;
    return Math.max(trimmedDuration, audioSafeDuration, safeSourceDuration);
  }

  if (safeSourceDuration > 0) {
    return Math.min(safeSourceDuration, trimmedDuration);
  }

  return trimmedDuration;
}

function getSpeechDurationLimit(scene, targetDuration) {
  const explicitLimit = Number(scene?.timing?.maxSpeechDuration || 0);

  if (Number.isFinite(explicitLimit) && explicitLimit > 0) {
    return explicitLimit;
  }

  return Number((targetDuration * MAX_SPEECH_RATIO).toFixed(2));
}

async function concatAudioFiles(listFilePath, outputFilePath) {
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFilePath,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputFilePath,
  ]);
}

async function transcodeAudioInput(inputPath, outputPath) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-af",
    "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputPath,
  ]);
}

async function createSilentAudio(outputPath, durationSeconds) {
  const safeDuration = Math.max(0.01, durationSeconds);

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-t",
    safeDuration.toFixed(3),
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputPath,
  ]);
}

async function polishSceneAudio({
  inputPath,
  outputPath,
  fadeInSec,
  fadeOutSec,
}) {
  const duration = await getMediaDuration(inputPath);

  const filters = [
    "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo",
  ];

  if (fadeInSec > 0) {
    filters.push(`afade=t=in:st=0:d=${fadeInSec.toFixed(3)}`);
  }

  if (fadeOutSec > 0 && duration > fadeOutSec + 0.05) {
    const fadeOutStart = Math.max(0, duration - fadeOutSec);
    filters.push(
      `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOutSec.toFixed(3)}`
    );
  }

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-af",
    filters.join(","),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputPath,
  ]);
}

async function buildNarrationDialogueTrack({
  scene,
  narrationPath,
  dialoguePath,
  outputPath,
  tempDir,
  sceneIndex,
}) {
  const hasNarration = !!narrationPath;
  const hasDialogue = !!dialoguePath;

  if (!hasNarration && !hasDialogue) {
    return undefined;
  }

  const mixProfile = getSceneAudioMixProfile(scene);

  const narrationNormalizedPath = path.join(
    tempDir,
    `scene-${sceneIndex}-narration-normalized.m4a`
  );
  const dialogueNormalizedPath = path.join(
    tempDir,
    `scene-${sceneIndex}-dialogue-normalized.m4a`
  );
  const silencePath = path.join(tempDir, `scene-${sceneIndex}-pause.m4a`);
  const concatInputPath = path.join(
    tempDir,
    `scene-${sceneIndex}-concat-raw.m4a`
  );
  const concatListPath = path.join(
    tempDir,
    `scene-${sceneIndex}-audio-list.txt`
  );

  if (hasNarration && narrationPath) {
    await transcodeAudioInput(narrationPath, narrationNormalizedPath);
  }

  if (hasDialogue && dialoguePath) {
    await transcodeAudioInput(dialoguePath, dialogueNormalizedPath);
  }

  const listEntries = [];

  if (hasNarration) {
    listEntries.push(narrationNormalizedPath);
  }

  if (hasNarration && hasDialogue) {
    await createSilentAudio(silencePath, mixProfile.pauseMs / 1000);
    listEntries.push(silencePath);
  }

  if (hasDialogue) {
    listEntries.push(dialogueNormalizedPath);
  }

  const listFileContent = listEntries
    .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
    .join("\n");

  await fs.promises.writeFile(concatListPath, listFileContent, "utf8");
  await concatAudioFiles(concatListPath, concatInputPath);

  await polishSceneAudio({
    inputPath: concatInputPath,
    outputPath,
    fadeInSec: mixProfile.sceneFadeInSec,
    fadeOutSec: mixProfile.sceneFadeOutSec,
  });

  return outputPath;
}


async function createImageClipWithAudio({
  imagePath,
  audioPath,
  outputPath,
  targetDuration,
}) {
  const resolvedTargetDuration =
    typeof targetDuration === "number" &&
    Number.isFinite(targetDuration) &&
    targetDuration > 0
      ? targetDuration
      : TARGET_SCENE_DURATION;

  const audioDuration = audioPath
    ? await getMediaDuration(audioPath).catch(() => 0)
    : 0;
  const effectiveDuration = alignDurationToFrameGrid(
    getTransitionAwareDuration({
      targetDuration: resolvedTargetDuration,
      audioDuration,
    })
  );
  const inputs = [
    "-loop",
    "1",
    "-framerate",
    String(OUTPUT_FPS),
    "-i",
    imagePath,
  ];

  if (audioPath) {
    inputs.push("-i", audioPath);
  } else {
    inputs.push(
      "-f",
      "lavfi",
      "-i",
      `anullsrc=channel_layout=stereo:sample_rate=${OUTPUT_AUDIO_SAMPLE_RATE}`
    );
  }

  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    [
      `[0:v]${createImageMotionFilter(effectiveDuration)}[v]`,
      `[1:a]${createNormalizedAudioFilter(effectiveDuration)}[a]`,
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
    "22",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    String(OUTPUT_AUDIO_SAMPLE_RATE),
    "-ac",
    "2",
    "-video_track_timescale",
    "90000",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  return {
    durationSec: effectiveDuration,
    fillerStrategy: "animated_still",
    fillerDurationSec: effectiveDuration,
  };
}

async function createSceneClipWithAudio({
  videoPath,
  referenceImagePath,
  audioPath,
  outputPath,
  targetDuration,
}) {
  const requestedTargetDuration =
    typeof targetDuration === "number" &&
    Number.isFinite(targetDuration) &&
    targetDuration > 0
      ? targetDuration
      : TARGET_SCENE_DURATION;

  const videoDuration = await getMediaDuration(videoPath);
  const audioDuration = audioPath
    ? await getMediaDuration(audioPath).catch(() => 0)
    : 0;
  const effectiveDuration = alignDurationToFrameGrid(
    getTransitionAwareDuration({
      targetDuration: requestedTargetDuration,
      audioDuration,
      sourceDuration: videoDuration,
    })
  );
  const needsFiller =
    videoDuration <= 0 || effectiveDuration - videoDuration > 0.05;
  let inputs = [];
  let visualFilter = "";
  let audioInputIndex = 1;
  let fillerStrategy = "none";
  let fillerDurationSec = 0;

  if (!needsFiller) {
    inputs = ["-i", videoPath];
    visualFilter =
      `[0:v]${createNormalizedVideoFilter(effectiveDuration)}[v]`;
  } else if (referenceImagePath && videoDuration > 0) {
    const primaryDuration = alignDurationToFrameGrid(
      Math.min(videoDuration, effectiveDuration)
    );
    const tailDuration = alignDurationToFrameGrid(
      Math.max(1 / OUTPUT_FPS, effectiveDuration - primaryDuration)
    );

    inputs = [
      "-i",
      videoPath,
      "-loop",
      "1",
      "-framerate",
      String(OUTPUT_FPS),
      "-i",
      referenceImagePath,
    ];
    audioInputIndex = 2;
    fillerStrategy = "image_motion_tail";
    fillerDurationSec = tailDuration;
    visualFilter = [
      `[0:v]${createNormalizedVideoFilter(primaryDuration)}[v0]`,
      `[1:v]${createImageMotionFilter(tailDuration, "soft_pan")}[v1]`,
      `[v0][v1]concat=n=2:v=1:a=0[v]`,
    ].join(";");
  } else {
    inputs = ["-stream_loop", "-1", "-i", videoPath];
    fillerStrategy = "motion_loop";
    fillerDurationSec = Math.max(0, effectiveDuration - videoDuration);
    visualFilter =
      `[0:v]${createNormalizedVideoFilter(effectiveDuration)}[v]`;
  }

  if (audioPath) {
    inputs.push("-i", audioPath);
  } else {
    inputs.push(
      "-f",
      "lavfi",
      "-i",
      `anullsrc=channel_layout=stereo:sample_rate=${OUTPUT_AUDIO_SAMPLE_RATE}`
    );
  }

  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    [
      visualFilter,
      `[${audioInputIndex}:a]${createNormalizedAudioFilter(effectiveDuration)}[a]`,
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
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    String(OUTPUT_AUDIO_SAMPLE_RATE),
    "-ac",
    "2",
    "-video_track_timescale",
    "90000",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  return {
    durationSec: effectiveDuration,
    fillerStrategy,
    fillerDurationSec: roundDuration(fillerDurationSec),
  };
}

async function concatSceneClips(
  scenePaths,
  sceneDurationsSec,
  outputFilePath
) {
  if (scenePaths.length === 1) {
    await fs.promises.copyFile(scenePaths[0], outputFilePath);
    return;
  }

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
    "-y",
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
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    String(OUTPUT_AUDIO_SAMPLE_RATE),
    "-ac",
    "2",
    "-video_track_timescale",
    "90000",
    "-movflags",
    "+faststart",
    outputFilePath,
  ]);
}

function getSceneAmbienceText(scene) {
  return [
    scene?.text,
    scene?.narration,
    scene?.dialogue,
    scene?.cameraDirection,
    scene?.emotion,
    scene?.motionHint,
    scene?.visualPrompt,
    scene?.thumbnailIdea,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectAmbientProfile(scene) {
  if (!AMBIENT_ENGINE_ENABLED) {
    return undefined;
  }

  const text = getSceneAmbienceText(scene);

  if (!text.trim()) {
    return undefined;
  }

  const profiles = [
    {
      id: "underwater",
      label: "Subtle underwater ambience",
      volume: 0.065,
      keywords: [
        "underwater",
        "ocean",
        "sea",
        "water",
        "bubble",
        "bubbles",
        "octopus",
        "fish",
        "coral",
        "deniz",
        "okyanus",
        "su altı",
        "balık",
        "ahtapot",
      ],
    },
    {
      id: "rocket",
      label: "Low rocket rumble ambience",
      volume: 0.075,
      keywords: [
        "rocket",
        "launch",
        "blast",
        "engine",
        "flame",
        "smoke",
        "spacecraft",
        "roket",
        "fırlatma",
        "motor",
        "alev",
      ],
    },
    {
      id: "space",
      label: "Soft space hum ambience",
      volume: 0.055,
      keywords: [
        "space",
        "planet",
        "moon",
        "star",
        "galaxy",
        "gravity",
        "orbit",
        "space explorer",
        "uzay",
        "gezegen",
        "ay",
        "yıldız",
        "galaksi",
        "yerçekimi",
      ],
    },
    {
      id: "nature",
      label: "Light nature air ambience",
      volume: 0.052,
      keywords: [
        "forest",
        "jungle",
        "tree",
        "trees",
        "leaf",
        "leaves",
        "wind",
        "bird",
        "birds",
        "orman",
        "ağaç",
        "rüzgar",
        "kuş",
      ],
    },
    {
      id: "magic",
      label: "Soft sparkle ambience",
      volume: 0.05,
      keywords: [
        "magic",
        "sparkle",
        "glow",
        "glowing",
        "portal",
        "mystery",
        "magical",
        "büyü",
        "parıltı",
        "ışık",
        "gizem",
      ],
    },
    {
      id: "tech",
      label: "Soft tech ambience",
      volume: 0.045,
      keywords: [
        "robot",
        "computer",
        "lab",
        "machine",
        "screen",
        "technology",
        "future",
        "AI",
        "laboratory",
        "robot",
        "bilgisayar",
        "laboratuvar",
        "makine",
        "teknoloji",
      ],
    },
  ];

  return profiles.find((profile) =>
    profile.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  );
}

function getAmbientLavfiSource(profileId) {
  switch (profileId) {
    case "underwater":
      return "anoisesrc=color=pink:amplitude=0.045:sample_rate=44100";
    case "rocket":
      return "anoisesrc=color=brown:amplitude=0.055:sample_rate=44100";
    case "space":
      return "sine=frequency=92:sample_rate=44100";
    case "nature":
      return "anoisesrc=color=pink:amplitude=0.035:sample_rate=44100";
    case "magic":
      return "sine=frequency=620:sample_rate=44100";
    case "tech":
      return "sine=frequency=180:sample_rate=44100";
    default:
      return "anoisesrc=color=pink:amplitude=0.03:sample_rate=44100";
  }
}

function getAmbientFilter(profileId, volume, durationSeconds) {
  const safeVolume = Math.min(
    AMBIENT_MAX_VOLUME,
    Math.max(0.01, Number.isFinite(volume) ? volume : AMBIENT_DEFAULT_VOLUME)
  );
  const safeDuration = Math.max(0.2, durationSeconds || TARGET_SCENE_DURATION);
  const fadeOutStart = Math.max(0, safeDuration - 0.35);

  const baseFilters = [
    "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo",
  ];

  if (profileId === "underwater") {
    baseFilters.push("lowpass=f=900");
  } else if (profileId === "rocket") {
    baseFilters.push("lowpass=f=420");
  } else if (profileId === "space") {
    baseFilters.push("lowpass=f=320");
  } else if (profileId === "nature") {
    baseFilters.push("highpass=f=180", "lowpass=f=2800");
  } else if (profileId === "magic") {
    baseFilters.push("aecho=0.35:0.35:90:0.18", "lowpass=f=2400");
  } else if (profileId === "tech") {
    baseFilters.push("aecho=0.25:0.25:70:0.12", "lowpass=f=1800");
  }

  baseFilters.push(
    `volume=${safeVolume.toFixed(3)}`,
    "afade=t=in:st=0:d=0.180",
    `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.350`
  );

  return baseFilters.join(",");
}

async function createProceduralAmbientAudio({ outputPath, durationSeconds, profile }) {
  if (!profile || !durationSeconds || durationSeconds <= 0) {
    return undefined;
  }

  const source = getAmbientLavfiSource(profile.id);
  const filter = getAmbientFilter(profile.id, profile.volume, durationSeconds);

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-t",
    durationSeconds.toFixed(3),
    "-i",
    source,
    "-af",
    filter,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputPath,
  ]);

  return outputPath;
}

async function mixSceneAudioWithAmbient({
  speechAudioPath,
  ambientAudioPath,
  outputPath,
  targetDuration,
}) {
  const durationText = Math.max(0.2, targetDuration || TARGET_SCENE_DURATION).toFixed(3);

  if (!ambientAudioPath) {
    return speechAudioPath;
  }

  if (!speechAudioPath) {
    await runFfmpeg([
      "-y",
      "-i",
      ambientAudioPath,
      "-af",
      `apad,atrim=duration=${durationText},asetpts=PTS-STARTPTS`,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "44100",
      "-ac",
      "2",
      outputPath,
    ]);

    return outputPath;
  }

  await runFfmpeg([
    "-y",
    "-i",
    speechAudioPath,
    "-i",
    ambientAudioPath,
    "-filter_complex",
    `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,atrim=duration=${durationText},asetpts=PTS-STARTPTS[speech];` +
      `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,atrim=duration=${durationText},asetpts=PTS-STARTPTS[amb];` +
      `[speech][amb]amix=inputs=2:duration=first:dropout_transition=0,` +
      `alimiter=limit=0.95[a]`,
    "-map",
    "[a]",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputPath,
  ]);

  return outputPath;
}


async function createMicroSfxTrack({ outputPath, durationSeconds, profileId }) {
  const safeDuration = Math.max(0.4, durationSeconds || 1.5);

  let source = "sine=frequency=120:sample_rate=44100";
  let filter = "volume=0.10";

  if (profileId === "rocket") {
    source = "anoisesrc=color=white:amplitude=0.25:sample_rate=44100";
    filter =
      "highpass=f=120,lowpass=f=1800,volume=0.12,afade=t=out:st=1.2:d=0.4";
  } else if (profileId === "space") {
    source = "sine=frequency=240:sample_rate=44100";
    filter =
      "aecho=0.6:0.5:40:0.3,volume=0.08,afade=t=out:st=1.0:d=0.4";
  } else if (profileId === "underwater") {
    source = "anoisesrc=color=pink:amplitude=0.15:sample_rate=44100";
    filter =
      "lowpass=f=1200,volume=0.08,afade=t=out:st=1.0:d=0.5";
  }

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-t",
    Math.min(2.2, safeDuration).toFixed(3),
    "-i",
    source,
    "-af",
    filter,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);

  return outputPath;
}


async function mixFinalVideoWithBackgroundMusic({
  inputVideoPath,
  bgmPath,
  outputVideoPath,
  bgmVolume = 0.16,
}) {
  await runFfmpeg([
    "-y",
    "-i",
    inputVideoPath,
    "-stream_loop",
    "-1",
    "-i",
    bgmPath,
    "-filter_complex",
    `[1:a]volume=${bgmVolume.toFixed(3)}[bgm];` +
      `[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=0[a]`,
    "-map",
    "0:v",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-shortest",
    outputVideoPath,
  ]);
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "velto-export-service",
    stitchContinuityVersion: "3N-4",
    finalProductionGateCompatible: true,
    freezeFrameFallbackDisabled: true,
  });
});

app.post("/export-movie", async (req, res) => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "velto-export-")
  );

  try {
    const body = req.body || {};
    const exportFlowValidation = body?.exportFlowValidation;

    if (exportFlowValidation?.version === "3N-5") {
      if (!exportFlowValidation.canExport) {
        return res.status(409).json({
          ok: false,
          error:
            "Export blocked by continuity preflight for scene(s): " +
            (exportFlowValidation.blockingSceneIds || []).join(", "),
          exportFlowValidation,
        });
      }

      if (
        exportFlowValidation.requiresManualConfirmation &&
        body?.manualConfirmationGranted !== true
      ) {
        return res.status(409).json({
          ok: false,
          error: "Export requires manual confirmation before rendering.",
          exportFlowValidation,
        });
      }
    }

    const scenes = Array.isArray(body?.scenes) ? body.scenes : [];
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "temp-project";
    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : "velto-movie";

    const usableScenes = scenes.filter(
      (scene) =>
        scene &&
        ((typeof scene.videoUrl === "string" && scene.videoUrl.trim()) ||
          (typeof scene.image === "string" && scene.image.trim()))
    );

    if (usableScenes.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Export için en az bir video veya image gerekli.",
      });
    }

    const sceneClipPaths = [];
    const sceneDurationsSec = [];
    const sceneContinuityChecks = [];
    let visualFillerSceneCount = 0;
    let visualFillerDurationSec = 0;
    const visualFillerStrategyCount = {};

    for (let i = 0; i < usableScenes.length; i += 1) {
      const scene = usableScenes[i];

      const rawVideoPath = path.join(tempDir, `raw-scene-${i + 1}.mp4`);
      const rawImagePath = path.join(tempDir, `raw-scene-${i + 1}.image`);
      const narrationPath = path.join(tempDir, `narration-${i + 1}.mp3`);
      const dialoguePath = path.join(tempDir, `dialogue-${i + 1}.mp3`);
      const sceneAudioPath = path.join(tempDir, `scene-audio-${i + 1}.m4a`);
      const sceneAmbientPath = path.join(tempDir, `scene-ambient-${i + 1}.m4a`);
      const sceneAudioWithAmbientPath = path.join(tempDir, `scene-audio-ambient-${i + 1}.m4a`);
      const sceneMicroSfxPath = path.join(tempDir, `scene-micro-sfx-${i + 1}.m4a`);
      const sceneAudioWithSfxPath = path.join(tempDir, `scene-audio-sfx-${i + 1}.m4a`);
      const clipOutputPath = path.join(tempDir, `clip-scene-${i + 1}.mp4`);

      const hasVideoSource =
        typeof scene.videoUrl === "string" && scene.videoUrl.trim();
      const hasImageSource =
        typeof scene.image === "string" && scene.image.trim();

      let sourcePath = "";
      let sourceType = "";

      if (hasVideoSource) {
        await downloadFile(scene.videoUrl, rawVideoPath);
        sourcePath = rawVideoPath;
        sourceType = "video";
      } else if (hasImageSource) {
        await downloadFile(scene.image, rawImagePath);
        sourcePath = rawImagePath;
        sourceType = "image";
      } else {
        console.warn(`Scene ${scene.id || i + 1} skipped: no videoUrl or image`);
        continue;
      }

      let referenceImagePath = sourceType === "image" ? sourcePath : "";

      if (sourceType === "video" && hasImageSource) {
        try {
          await downloadFile(scene.image, rawImagePath);
          referenceImagePath = rawImagePath;
        } catch (referenceImageError) {
          console.warn(
            `Scene ${scene.id || i + 1} reference image skipped:`,
            referenceImageError
          );
        }
      }

      let hasNarration = false;
      let hasDialogue = false;

      if (typeof scene.audioUrl === "string" && scene.audioUrl.trim()) {
        try {
          await downloadFile(scene.audioUrl, narrationPath);
          hasNarration = true;
        } catch (error) {
          console.warn(`Scene ${scene.id} narration download skipped:`, error);
        }
      }

      if (
        typeof scene.dialogueAudioUrl === "string" &&
        scene.dialogueAudioUrl.trim()
      ) {
        try {
          await downloadFile(scene.dialogueAudioUrl, dialoguePath);
          hasDialogue = true;
        } catch (error) {
          console.warn(`Scene ${scene.id} dialogue download skipped:`, error);
        }
      }

      const finalAudioPath = await buildNarrationDialogueTrack({
        scene,
        narrationPath: hasNarration ? narrationPath : undefined,
        dialoguePath: hasDialogue ? dialoguePath : undefined,
        outputPath: sceneAudioPath,
        tempDir,
        sceneIndex: i + 1,
      });

      let fallbackAudioDuration = 0;

      if (finalAudioPath) {
        try {
          fallbackAudioDuration = await getMediaDuration(finalAudioPath);
        } catch (error) {
          console.warn(`Scene ${scene.id} audio duration probe skipped:`, error);
        }
      }

      let sourceDuration = 0;

      try {
        sourceDuration = await getMediaDuration(sourcePath);
      } catch (durationError) {
        console.warn(`Scene ${scene.id || i + 1} source duration probe skipped:`, durationError);
      }

      const targetDuration = getSceneTargetDuration(
        scene,
        fallbackAudioDuration,
        sourceType,
        sourceDuration
      );

      console.log(
        `Export scene ${i + 1}: source=${sourceType}, audio=${fallbackAudioDuration.toFixed(2)}s, target=${targetDuration.toFixed(2)}s`
      );

      const speechDurationLimit = getSpeechDurationLimit(
        scene,
        targetDuration
      );

      if (fallbackAudioDuration > speechDurationLimit) {
        console.warn(`Scene ${i + 1} audio longer than target, auto-extending scene.`);
      }

      const ambientProfile = detectAmbientProfile(scene);
      let audioForClip = finalAudioPath;

      if (ambientProfile) {
        try {
          await createProceduralAmbientAudio({
            outputPath: sceneAmbientPath,
            durationSeconds: targetDuration,
            profile: ambientProfile,
          });

          audioForClip = await mixSceneAudioWithAmbient({
            speechAudioPath: finalAudioPath,
            ambientAudioPath: sceneAmbientPath,
            outputPath: sceneAudioWithAmbientPath,
            targetDuration,
          });

          await createMicroSfxTrack({
            outputPath: sceneMicroSfxPath,
            durationSeconds: targetDuration,
            profileId: ambientProfile.id,
          });

          audioForClip = await mixSceneAudioWithAmbient({
            speechAudioPath: audioForClip,
            ambientAudioPath: sceneMicroSfxPath,
            outputPath: sceneAudioWithSfxPath,
            targetDuration,
          });

          console.log(
            `Scene ${i + 1} ambient+microSFX layer: ${ambientProfile.id}`
          );
        } catch (ambientError) {
          console.warn(`Scene ${i + 1} ambient layer skipped:`, ambientError);
          audioForClip = finalAudioPath;
        }
      }



      const clipResult =
        sourceType === "video"
          ? await createSceneClipWithAudio({
              videoPath: sourcePath,
              referenceImagePath,
              audioPath: audioForClip,
              outputPath: clipOutputPath,
              targetDuration,
            })
          : await createImageClipWithAudio({
              imagePath: sourcePath,
              audioPath: audioForClip,
              outputPath: clipOutputPath,
              targetDuration,
            });

      const sceneContinuityCheck = await verifyRenderedContinuity(
        clipOutputPath,
        clipResult.durationSec,
        `Scene ${scene.id || i + 1}`
      );

      sceneClipPaths.push(clipOutputPath);
      sceneDurationsSec.push(clipResult.durationSec);
      sceneContinuityChecks.push(sceneContinuityCheck);

      if (clipResult.fillerStrategy !== "none") {
        visualFillerSceneCount += 1;
        visualFillerDurationSec += clipResult.fillerDurationSec;
      }

      visualFillerStrategyCount[clipResult.fillerStrategy] =
        (visualFillerStrategyCount[clipResult.fillerStrategy] || 0) + 1;
    }

    const outputFilePath = path.join(tempDir, "output-with-audio.mp4");
    await concatSceneClips(
      sceneClipPaths,
      sceneDurationsSec,
      outputFilePath
    );

    const bgmPath = path.join(process.cwd(), "assets", "bgm.mp3");
    let finalOutputFilePath = outputFilePath;
    let backgroundMusicEmbedded = false;

    if (fs.existsSync(bgmPath)) {
      const outputWithBgmPath = path.join(tempDir, "output-with-continuous-bgm.mp4");

      try {
        await mixFinalVideoWithBackgroundMusic({
          inputVideoPath: outputFilePath,
          bgmPath,
          outputVideoPath: outputWithBgmPath,
          bgmVolume: 0.16,
        });

        finalOutputFilePath = outputWithBgmPath;
        backgroundMusicEmbedded = true;
        console.log("Continuous background music embedded:", bgmPath);
      } catch (bgmError) {
        console.warn("Background music mix skipped:", bgmError);
      }
    } else {
      console.log("No bgm.mp3 found under assets. Export continues without background music.");
    }

    const expectedFinalDurationSec = roundDuration(
      sceneDurationsSec.reduce((sum, duration) => sum + duration, 0)
    );
    const finalContinuityCheck = await verifyRenderedContinuity(
      finalOutputFilePath,
      expectedFinalDurationSec,
      "Final video"
    );
    const maxSceneAudioVideoDriftSec = Math.max(
      0,
      ...sceneContinuityChecks.map((check) => check.audioVideoDriftSec)
    );

    const outputBuffer = await fs.promises.readFile(finalOutputFilePath);

    const supabase = getSupabaseAdmin();

    const safeProjectId = safeName(projectId);
    const safeTitle = safeName(title);
    const moviePath = `${safeProjectId}/${safeTitle}-with-audio-${Date.now()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("movies")
      .upload(moviePath, outputBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("movies")
      .getPublicUrl(moviePath);

    const stats = await fs.promises.stat(finalOutputFilePath);
    const duration = await getMediaDuration(finalOutputFilePath);
    const fileName = `velto-${safeTitle}.mp4`;

    return res.json({
      ok: true,
      movieUrl: publicData.publicUrl,
      downloadUrl: publicData.publicUrl,
      fileName,
      sizeBytes: stats.size,
      durationSeconds: duration,
      sceneCount: sceneClipPaths.length,
      stitchContinuityVersion: "3N-4",
      stitchContinuityVerified: true,
      freezeFrameFallbackDisabled: true,
      exportPreflightStatus:
        exportFlowValidation?.status || "not-provided",
      expectedDurationSeconds: expectedFinalDurationSec,
      verifiedDurationSeconds: finalContinuityCheck.actualDurationSec,
      finalAudioVideoDriftSeconds:
        finalContinuityCheck.audioVideoDriftSec,
      maxSceneAudioVideoDriftSeconds:
        maxSceneAudioVideoDriftSec,
      visualFillerSceneCount,
      visualFillerDurationSeconds:
        roundDuration(visualFillerDurationSec),
      visualFillerStrategies: visualFillerStrategyCount,
      audioEmbedded: true,
      dialogueEmbedded: true,
      backgroundMusicEmbedded,
      continuousBackgroundMusicAware: true,
      timingAware: true,
      timelineAwareAudio: true,
      audioMixProfileAware: true,
      mixedExportAware: true,
      imageClipAware: true,
      deterministicSceneTimelineAware: true,
      transitionTrimAware: true,
      sceneTransitionTrimSeconds: SCENE_TRANSITION_TRIM_SECONDS,
      minAudioTailBufferSeconds: MIN_AUDIO_TAIL_BUFFER_SECONDS,
      speechFreezeTailBufferSeconds: SPEECH_FREEZE_TAIL_BUFFER_SECONDS,
      sceneAudioPaddedAware: true,
      simpleSpeechFreezeAware: false,
      cinematicMotionEngineAware: true,
      imageSceneMotionAware: true,
      cinematicMotionType: "subtle-zoom-pan",
      dynamicAmbientEngineAware: true,
      proceduralAmbientAware: true,
      ambientDefaultVolume: AMBIENT_DEFAULT_VOLUME,
      ambientMaxVolume: AMBIENT_MAX_VOLUME,
    });
  } catch (error) {
    console.error("export-movie error:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Film export işlemi başarısız oldu.",
    });
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`velto-export-service running on port ${port}`);
});
