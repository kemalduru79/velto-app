import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import {
  applyTimelineSyncPlanToScenes,
  type TimelineScenePlan,
  type TimelineSyncPlan,
} from "../../../lib/video/timelineSync";
import {
  matchAudioDurationToScene,
  type AudioDurationMatch,
} from "../../../lib/video/audioDurationMatching";
import {
  createVisualFillerPlan,
  type VisualFillerMotionPreset,
  type VisualFillerPlan,
} from "../../../lib/video/visualFiller";

type StitchSceneInput = {
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

const DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS = 5;
const MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS = 30;
const PREFERRED_MAX_SCENE_DURATION_SECONDS = 20;
const SPEECH_TAIL_BUFFER_SECONDS = 0.75;
const OUTPUT_SIZE = "960:960";
const OUTPUT_FPS = "30";

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile("ffmpeg", ["-y", ...args], (error, stdout, stderr) => {
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
    execFile("ffprobe", args, (error, stdout, stderr) => {
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
  } catch {
    return 0;
  }
}

function roundDuration(value: number) {
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

function safeDuration(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS;
  }

  return Math.min(
    MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
    Math.max(3, numberValue),
  );
}

function getSceneRequestedDuration(scene: StitchSceneInput) {
  return safeDuration(scene?.durationSec || scene?.timing?.targetSceneDuration);
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
}

function getSceneVisualAction(scene: StitchSceneInput) {
  return scene?.timelineDecision?.visualAction || scene?.timing?.visualAction;
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
    `trim=duration=${durationSec.toFixed(3)}`,
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
  const normalizeVideoFilter = `scale=${OUTPUT_SIZE}:force_original_aspect_ratio=decrease,pad=${OUTPUT_SIZE}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS},format=yuv420p`;

  await runFfmpeg([
    "-i",
    sourceVideoPath,
    "-vf",
    `${normalizeVideoFilter},trim=duration=${durationSec.toFixed(3)}`,
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
  const normalizeVideoFilter = `scale=${OUTPUT_SIZE}:force_original_aspect_ratio=decrease,pad=${OUTPUT_SIZE}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS},trim=duration=${durationSec.toFixed(3)},format=yuv420p`;

  await runFfmpeg([
    "-stream_loop",
    "-1",
    "-i",
    sourceVideoPath,
    "-t",
    String(durationSec),
    "-vf",
    normalizeVideoFilter,
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
  tempDir: string,
  index: number,
  outputVideoPath: string,
) {
  const fileListPath = path.join(tempDir, `scene_${index}_visual_blocks.txt`);

  await fs.writeFile(
    fileListPath,
    segmentPaths
      .map((filePath) => `file '${escapeConcatPath(filePath)}'`)
      .join("\n"),
  );

  await runFfmpeg([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    fileListPath,
    "-c",
    "copy",
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
    await concatVideoSegments(segmentPaths, tempDir, index, outputVideoPath);
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
    outputPath,
  ]);
}

async function createSceneAudioClip(
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
      `[0:a]apad,atrim=0:${effectiveDuration}[a]`,
      "-map",
      "[a]",
      "-t",
      String(effectiveDuration),
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
  const concatLabels = downloadedAudioPaths.map((_, i) => `[${i}:a]`).join("");
  const filter = `${concatLabels}concat=n=${downloadedAudioPaths.length}:v=0:a=1,apad,atrim=0:${effectiveDuration}[a]`;

  await runFfmpeg([
    ...concatInputs,
    "-filter_complex",
    filter,
    "-map",
    "[a]",
    "-t",
    String(effectiveDuration),
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

async function createSceneVideoBase(
  scene: StitchSceneInput,
  tempDir: string,
  index: number,
  durationSec: number,
) {
  const outputVideoPath = path.join(tempDir, `scene_${index}_video.mp4`);
  const normalizeVideoFilter = `scale=${OUTPUT_SIZE}:force_original_aspect_ratio=decrease,pad=${OUTPUT_SIZE}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS},format=yuv420p`;

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
      `${normalizeVideoFilter},trim=duration=${durationSec.toFixed(3)}`,
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

async function muxSceneVideoAndAudio(
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
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-t",
    String(durationSec),
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
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function POST(req: NextRequest) {
  const tempDir = path.join(os.tmpdir(), `velto-stitch-${crypto.randomUUID()}`);

  try {
    const body = await req.json();

    const rawScenes: StitchSceneInput[] = Array.isArray(body?.scenes)
      ? body.scenes
      : Array.isArray(body?.videoUrls)
        ? body.videoUrls.map((videoUrl: string, index: number) => ({
            id: index + 1,
            videoUrl,
          }))
        : [];

    const filteredScenes = rawScenes.filter(
      (scene) => Boolean(scene?.videoUrl) || Boolean(scene?.imageUrl),
    );
    const timelineSyncPlan = body?.timelineSyncPlan as
      TimelineSyncPlan | undefined;
    const scenes = applyTimelineSyncPlanToScenes(
      filteredScenes,
      timelineSyncPlan,
      {
        fallbackDuration: DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS,
        minDuration: 3,
        maxDuration: MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
        tailBufferSeconds: SPEECH_TAIL_BUFFER_SECONDS,
      },
    );

    const timelineVisualActionCount = scenes.reduce<Record<string, number>>(
      (acc, scene) => {
        const action = getSceneVisualAction(scene) || "none";
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      },
      {},
    );
    const audioMismatchSceneCount = scenes.filter((scene) =>
      ["long", "critical"].includes(
        String(
          scene?.timelineDecision?.audioMismatch ||
            scene?.timing?.audioMismatch ||
            "",
        ),
      ),
    ).length;

    if (scenes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No scenes with videoUrl or imageUrl provided" },
        { status: 400 },
      );
    }

    await fs.mkdir(tempDir, { recursive: true });

    const finalSceneClipPaths: string[] = [];
    let matchedDurationSceneCount = 0;
    let splitRecommendedSceneCount = 0;
    let unnecessaryExtensionRemovedSec = 0;
    let visualFillerSceneCount = 0;
    let visualFillerDurationSec = 0;
    const visualFillerStrategyCount: Record<string, number> = {};

    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i];
      const requestedDurationSec = getSceneRequestedDuration(scene);
      const audioResult = await createSceneAudioClip(
        scene,
        tempDir,
        i,
        requestedDurationSec,
      );
      const durationSec = safeDuration(audioResult.durationSec);

      if (audioResult.durationMatch.status !== "unmeasured") {
        matchedDurationSceneCount += 1;
      }
      if (audioResult.durationMatch.splitRecommended) {
        splitRecommendedSceneCount += 1;
      }
      unnecessaryExtensionRemovedSec +=
        audioResult.durationMatch.unnecessaryExtensionRemovedSec;

      const videoResult = await createSceneVideoBase(
        scene,
        tempDir,
        i,
        durationSec,
      );
      const fillerStrategy = videoResult.fillerPlan.strategy;

      if (videoResult.fillerPlan.requiresFiller) {
        visualFillerSceneCount += 1;
        visualFillerDurationSec += videoResult.fillerPlan.fillerDurationSec;
      }
      visualFillerStrategyCount[fillerStrategy] =
        (visualFillerStrategyCount[fillerStrategy] || 0) + 1;
      const finalScenePath = path.join(tempDir, `scene_${i}_final.mp4`);

      await muxSceneVideoAndAudio(
        videoResult.videoPath,
        audioResult.audioPath,
        finalScenePath,
        durationSec,
      );

      finalSceneClipPaths.push(finalScenePath);
    }

    const fileListPath = path.join(tempDir, "files.txt");
    const outputPath = path.join(tempDir, "final-video.mp4");

    await fs.writeFile(
      fileListPath,
      finalSceneClipPaths
        .map((filePath) => `file '${escapeConcatPath(filePath)}'`)
        .join("\n"),
    );

    await runFfmpeg([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      fileListPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const videoBuffer = await fs.readFile(outputPath);

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="velto-final-video.mp4"`,
        "X-Scene-Count": String(scenes.length),
        "X-Timeline-Aware": timelineSyncPlan ? "true" : "false",
        "X-Audio-Safe-Stitch": "true",
        "X-Audio-Duration-Matched": String(matchedDurationSceneCount),
        "X-Audio-Mismatch-Scenes": String(audioMismatchSceneCount),
        "X-Split-Recommended-Scenes": String(splitRecommendedSceneCount),
        "X-Unnecessary-Extension-Removed": String(
          roundDuration(unnecessaryExtensionRemovedSec),
        ),
        "X-Visual-Filler-Scenes": String(visualFillerSceneCount),
        "X-Visual-Filler-Duration": String(
          roundDuration(visualFillerDurationSec),
        ),
        "X-Visual-Filler-Strategies": JSON.stringify(
          visualFillerStrategyCount,
        ),
        "X-Freeze-Frame-Fallback": "disabled",
        "X-Timeline-Visual-Actions": JSON.stringify(timelineVisualActionCount),
      },
    });
  } catch (err: unknown) {
    console.error("SCENE COMPOSER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Final video could not be composed.",
      },
      { status: 500 },
    );
  } finally {
    try {
      if (fsSync.existsSync(tempDir)) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error("SCENE COMPOSER CLEANUP ERROR:", cleanupError);
    }
  }
}
