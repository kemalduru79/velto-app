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

const DEFAULT_SCENE_DURATION_SECONDS = 7;
const MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS = 20;
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
    return DEFAULT_SCENE_DURATION_SECONDS;
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

function getSceneVisualBlocks(scene: StitchSceneInput) {
  return Array.isArray(scene?.timing?.visualBlocks)
    ? scene.timing.visualBlocks.filter(
        (block) =>
          Number(block?.durationSec) > 0 && block?.type !== "split_marker",
      )
    : [];
}

function shouldPreferImageMotionFallback({
  scene,
  sourceDurationSec,
  targetDurationSec,
}: {
  scene: StitchSceneInput;
  sourceDurationSec: number;
  targetDurationSec: number;
}) {
  if (
    !scene.imageUrl ||
    sourceDurationSec <= 0 ||
    targetDurationSec <= sourceDurationSec
  ) {
    return false;
  }

  const extensionSec = targetDurationSec - sourceDurationSec;
  const stretchFactor = targetDurationSec / sourceDurationSec;
  const visualAction = getSceneVisualAction(scene);
  const speechFit =
    scene?.timelineDecision?.speechFit || scene?.timing?.speechFit;

  return (
    visualAction === "image_motion_tail" ||
    visualAction === "split_scene" ||
    speechFit === "too_long" ||
    extensionSec > 2 ||
    stretchFactor > 1.35
  );
}

async function createImageMotionVideoBase({
  imageUrl,
  tempDir,
  index,
  durationSec,
  outputVideoPath,
}: {
  imageUrl: string;
  tempDir: string;
  index: number;
  durationSec: number;
  outputVideoPath: string;
}) {
  const sourceImagePath = path.join(
    tempDir,
    `scene_${index}_source_image_motion.png`,
  );
  await downloadToFile(imageUrl, sourceImagePath);

  const frameCount = Math.max(1, Math.round(durationSec * Number(OUTPUT_FPS)));
  const imageMotionFilter = [
    "scale=1100:1100:force_original_aspect_ratio=increase",
    "crop=960:960",
    `zoompan=z='min(zoom+0.0009,1.045)':d=${frameCount}:s=960x960:fps=${OUTPUT_FPS}`,
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

async function createTimelineVisualBlockVideoBase({
  scene,
  sourceVideoPath,
  sourceDurationSec,
  tempDir,
  index,
  durationSec,
  outputVideoPath,
}: {
  scene: StitchSceneInput;
  sourceVideoPath: string;
  sourceDurationSec: number;
  tempDir: string;
  index: number;
  durationSec: number;
  outputVideoPath: string;
}) {
  const visualBlocks = getSceneVisualBlocks(scene);

  if (!scene.imageUrl || visualBlocks.length < 2 || sourceDurationSec <= 0) {
    return false;
  }

  const firstVideoBlock = visualBlocks.find(
    (block) => block.type === "video_clip",
  );
  const primaryDurationSec = safeDuration(
    Math.min(
      durationSec,
      sourceDurationSec,
      Number(firstVideoBlock?.durationSec || sourceDurationSec),
    ),
  );
  const remainingDurationSec =
    Math.round((durationSec - primaryDurationSec) * 1000) / 1000;

  if (remainingDurationSec < 1) {
    return false;
  }

  const segmentPaths: string[] = [];
  const primarySegmentPath = path.join(
    tempDir,
    `scene_${index}_block_0_video.mp4`,
  );

  await createVideoClipSegmentFromSource({
    sourceVideoPath,
    outputVideoPath: primarySegmentPath,
    durationSec: primaryDurationSec,
  });

  segmentPaths.push(primarySegmentPath);

  const tailBlocks = visualBlocks.filter(
    (block) => block.type !== "video_clip",
  );
  const tailBlockTotal = tailBlocks.reduce(
    (sum, block) => sum + Number(block.durationSec || 0),
    0,
  );

  if (tailBlocks.length === 0 || tailBlockTotal <= 0) {
    const tailPath = path.join(
      tempDir,
      `scene_${index}_block_1_image_tail.mp4`,
    );
    await createImageMotionVideoBase({
      imageUrl: scene.imageUrl,
      tempDir,
      index: index * 100 + 1,
      durationSec: remainingDurationSec,
      outputVideoPath: tailPath,
    });
    segmentPaths.push(tailPath);
  } else {
    let allocatedTailSec = 0;

    for (let blockIndex = 0; blockIndex < tailBlocks.length; blockIndex += 1) {
      const block = tailBlocks[blockIndex];
      const isLast = blockIndex === tailBlocks.length - 1;
      const proportionalDuration =
        tailBlockTotal > 0
          ? (Number(block.durationSec || 0) / tailBlockTotal) *
            remainingDurationSec
          : remainingDurationSec / tailBlocks.length;
      const blockDurationSec = isLast
        ? Math.max(
            0.5,
            Math.round((remainingDurationSec - allocatedTailSec) * 1000) / 1000,
          )
        : Math.max(0.5, Math.round(proportionalDuration * 1000) / 1000);

      allocatedTailSec += blockDurationSec;

      const tailPath = path.join(
        tempDir,
        `scene_${index}_block_${blockIndex + 1}_${block.type}.mp4`,
      );

      await createImageMotionVideoBase({
        imageUrl: scene.imageUrl,
        tempDir,
        index: index * 100 + blockIndex + 1,
        durationSec: blockDurationSec,
        outputVideoPath: tailPath,
      });

      segmentPaths.push(tailPath);
    }
  }

  await concatVideoSegments(segmentPaths, tempDir, index, outputVideoPath);

  return true;
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
    await createSilentAudio(outputAudioPath, requestedDurationSec);
    return {
      audioPath: outputAudioPath,
      durationSec: requestedDurationSec,
      audioDurationSec: 0,
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
  const effectiveDuration = safeDuration(
    Math.max(
      requestedDurationSec,
      estimatedAudioDuration + SPEECH_TAIL_BUFFER_SECONDS,
    ),
  );

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

    const didCreateVisualBlockTimeline =
      await createTimelineVisualBlockVideoBase({
        scene,
        sourceVideoPath,
        sourceDurationSec,
        tempDir,
        index,
        durationSec,
        outputVideoPath,
      });

    if (didCreateVisualBlockTimeline) {
      return outputVideoPath;
    }

    if (
      shouldPreferImageMotionFallback({
        scene,
        sourceDurationSec,
        targetDurationSec: durationSec,
      })
    ) {
      await createImageMotionVideoBase({
        imageUrl: scene.imageUrl as string,
        tempDir,
        index,
        durationSec,
        outputVideoPath,
      });

      return outputVideoPath;
    }

    const stretchFactor =
      sourceDurationSec > 0 && durationSec > sourceDurationSec
        ? durationSec / sourceDurationSec
        : 1;
    const cappedStretchFactor = Math.min(stretchFactor, 1.35);
    const stretchedDurationSec = sourceDurationSec * cappedStretchFactor;
    const residualExtensionSec = Math.max(
      0,
      durationSec - stretchedDurationSec,
    );
    const audioSafeVideoFilter =
      stretchFactor > 1.05
        ? residualExtensionSec > 0.05
          ? `${normalizeVideoFilter},setpts=${cappedStretchFactor.toFixed(4)}*PTS,tpad=stop_mode=clone:stop_duration=${residualExtensionSec.toFixed(3)},trim=duration=${durationSec.toFixed(3)}`
          : `${normalizeVideoFilter},setpts=${cappedStretchFactor.toFixed(4)}*PTS,trim=duration=${durationSec.toFixed(3)}`
        : `${normalizeVideoFilter},trim=duration=${durationSec.toFixed(3)}`;

    await runFfmpeg([
      "-i",
      sourceVideoPath,
      "-vf",
      audioSafeVideoFilter,
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

    return outputVideoPath;
  }

  if (scene.imageUrl) {
    await createImageMotionVideoBase({
      imageUrl: scene.imageUrl,
      tempDir,
      index,
      durationSec,
      outputVideoPath,
    });

    return outputVideoPath;
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
        fallbackDuration: DEFAULT_SCENE_DURATION_SECONDS,
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

      const videoBasePath = await createSceneVideoBase(
        scene,
        tempDir,
        i,
        durationSec,
      );
      const finalScenePath = path.join(tempDir, `scene_${i}_final.mp4`);

      await muxSceneVideoAndAudio(
        videoBasePath,
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
        "X-Audio-Mismatch-Scenes": String(audioMismatchSceneCount),
        "X-Timeline-Visual-Actions": JSON.stringify(timelineVisualActionCount),
      },
    });
  } catch (err: any) {
    console.error("SCENE COMPOSER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Final video could not be composed.",
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
