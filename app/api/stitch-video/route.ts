import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

type StitchSceneInput = {
  id?: number;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  dialogueAudioUrl?: string;
  durationSec?: number;
};

const DEFAULT_SCENE_DURATION_SECONDS = 7;
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
              .join("\n")
          )
        );
        return;
      }

      resolve();
    });
  });
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

  return Math.min(12, Math.max(3, numberValue));
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
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
  durationSec: number
) {
  const audioInputs = [scene.audioUrl, scene.dialogueAudioUrl].filter(
    (url): url is string => Boolean(url)
  );

  const outputAudioPath = path.join(tempDir, `scene_${index}_audio.m4a`);

  if (audioInputs.length === 0) {
    await createSilentAudio(outputAudioPath, durationSec);
    return outputAudioPath;
  }

  const downloadedAudioPaths: string[] = [];

  for (let i = 0; i < audioInputs.length; i += 1) {
    const audioPath = path.join(tempDir, `scene_${index}_audio_input_${i}.mp3`);
    await downloadToFile(audioInputs[i], audioPath);
    downloadedAudioPaths.push(audioPath);
  }

  if (downloadedAudioPaths.length === 1) {
    await runFfmpeg([
      "-i",
      downloadedAudioPaths[0],
      "-filter_complex",
      `[0:a]apad,atrim=0:${durationSec}[a]`,
      "-map",
      "[a]",
      "-t",
      String(durationSec),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputAudioPath,
    ]);

    return outputAudioPath;
  }

  const concatInputs = downloadedAudioPaths.flatMap((audioPath) => ["-i", audioPath]);
  const concatLabels = downloadedAudioPaths.map((_, i) => `[${i}:a]`).join("");
  const filter = `${concatLabels}concat=n=${downloadedAudioPaths.length}:v=0:a=1,apad,atrim=0:${durationSec}[a]`;

  await runFfmpeg([
    ...concatInputs,
    "-filter_complex",
    filter,
    "-map",
    "[a]",
    "-t",
    String(durationSec),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputAudioPath,
  ]);

  return outputAudioPath;
}

async function createSceneVideoBase(
  scene: StitchSceneInput,
  tempDir: string,
  index: number,
  durationSec: number
) {
  const outputVideoPath = path.join(tempDir, `scene_${index}_video.mp4`);
  const normalizeVideoFilter = `scale=${OUTPUT_SIZE}:force_original_aspect_ratio=decrease,pad=${OUTPUT_SIZE}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS},format=yuv420p`;

  if (scene.videoUrl) {
    const sourceVideoPath = path.join(tempDir, `scene_${index}_source_video.mp4`);
    await downloadToFile(scene.videoUrl, sourceVideoPath);

    await runFfmpeg([
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

    return outputVideoPath;
  }

  if (scene.imageUrl) {
    const sourceImagePath = path.join(tempDir, `scene_${index}_source_image.png`);
    await downloadToFile(scene.imageUrl, sourceImagePath);

    await runFfmpeg([
      "-loop",
      "1",
      "-i",
      sourceImagePath,
      "-t",
      String(durationSec),
      "-vf",
      normalizeVideoFilter,
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

  throw new Error(`Scene ${scene.id ?? index + 1} has no videoUrl or imageUrl`);
}

async function muxSceneVideoAndAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  durationSec: number
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

    const scenes = rawScenes.filter(
      (scene) => Boolean(scene?.videoUrl) || Boolean(scene?.imageUrl)
    );

    if (scenes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No scenes with videoUrl or imageUrl provided" },
        { status: 400 }
      );
    }

    await fs.mkdir(tempDir, { recursive: true });

    const finalSceneClipPaths: string[] = [];

    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i];
      const durationSec = safeDuration(scene.durationSec);

      const videoBasePath = await createSceneVideoBase(scene, tempDir, i, durationSec);
      const audioPath = await createSceneAudioClip(scene, tempDir, i, durationSec);
      const finalScenePath = path.join(tempDir, `scene_${i}_final.mp4`);

      await muxSceneVideoAndAudio(videoBasePath, audioPath, finalScenePath, durationSec);

      finalSceneClipPaths.push(finalScenePath);
    }

    const fileListPath = path.join(tempDir, "files.txt");
    const outputPath = path.join(tempDir, "final-video.mp4");

    await fs.writeFile(
      fileListPath,
      finalSceneClipPaths
        .map((filePath) => `file '${escapeConcatPath(filePath)}'`)
        .join("\n")
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
      },
    });
  } catch (err: any) {
    console.error("SCENE COMPOSER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Final video could not be composed.",
      },
      { status: 500 }
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
