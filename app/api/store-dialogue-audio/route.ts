import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ffmpegStatic from "ffmpeg-static";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const runtime = "nodejs";

type DialogueLine = {
  speaker: string;
  text: string;
  voiceId?: string;
};

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

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function resolveFfmpegBinary() {
  const envPath =
    typeof process.env.FFMPEG_PATH === "string" && process.env.FFMPEG_PATH.trim()
      ? process.env.FFMPEG_PATH.trim()
      : "";

  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const staticPath =
    typeof ffmpegStatic === "string" && ffmpegStatic.trim()
      ? ffmpegStatic.trim()
      : "";

  if (staticPath && fs.existsSync(staticPath)) {
    return staticPath;
  }

  const whichResult = spawnSync("which", ["ffmpeg"], { encoding: "utf8" });
  const systemPath = whichResult.stdout?.trim();

  if (systemPath && fs.existsSync(systemPath)) {
    return systemPath;
  }

  throw new Error(
    "FFmpeg binary bulunamadı. Gerekirse .env.local içine FFMPEG_PATH ekle."
  );
}

async function runFfmpeg(args: string[]) {
  const ffmpegBinary = resolveFfmpegBinary();

  return new Promise<void>((resolve, reject) => {
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

async function synthesizeLineToFile({
  text,
  voiceId,
  modelId,
  stability,
  similarityBoost,
  outputPath,
}: {
  text: string;
  voiceId?: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  outputPath: string;
}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const fallbackVoiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is missing");
  }

  const finalVoiceId = voiceId?.trim() || fallbackVoiceId?.trim();

  if (!finalVoiceId) {
    throw new Error("No voiceId provided for dialogue synthesis");
  }

  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!elevenRes.ok) {
    const errorText = await elevenRes.text().catch(() => "");
    throw new Error(errorText || "ElevenLabs dialogue synthesis failed");
  }

  const arrayBuffer = await elevenRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(outputPath, buffer);
}

async function concatAudioFiles(listFilePath: string, outputFilePath: string) {
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFilePath,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outputFilePath,
  ]);
}

export async function POST(req: NextRequest) {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "velto-dialogue-")
  );

  try {
    const body = await req.json();

    const lines: DialogueLine[] = Array.isArray(body?.lines) ? body.lines : [];
    const projectKey =
      typeof body?.projectKey === "string" && body.projectKey.trim()
        ? body.projectKey.trim()
        : "temp-project";
    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";
    const sourceText =
      typeof body?.sourceText === "string" ? body.sourceText : "";

    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim()
        ? body.modelId.trim()
        : "eleven_multilingual_v2";

    const stability =
      typeof body?.stability === "number" ? body.stability : 0.5;

    const similarityBoost =
      typeof body?.similarityBoost === "number" ? body.similarityBoost : 0.8;

    if (!lines.length) {
      return NextResponse.json(
        { ok: false, error: "Dialogue lines are required" },
        { status: 400 }
      );
    }

    const audioLinePaths: string[] = [];

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (!line?.text?.trim()) {
        continue;
      }

      const outputPath = path.join(tempDir, `line-${i + 1}.mp3`);

      await synthesizeLineToFile({
        text: line.text.trim(),
        voiceId: line.voiceId,
        modelId,
        stability,
        similarityBoost,
        outputPath,
      });

      audioLinePaths.push(outputPath);
    }

    if (!audioLinePaths.length) {
      return NextResponse.json(
        { ok: false, error: "No dialogue audio could be generated" },
        { status: 400 }
      );
    }

    const listFilePath = path.join(tempDir, "dialogue-list.txt");
    const listFileContent = audioLinePaths
      .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
      .join("\n");

    await fs.promises.writeFile(listFilePath, listFileContent, "utf8");

    const outputFilePath = path.join(tempDir, "scene-dialogue.mp3");
    await concatAudioFiles(listFilePath, outputFilePath);

    const outputBuffer = await fs.promises.readFile(outputFilePath);

    const supabase = getSupabaseAdmin();

    const safeProjectKey = safeName(projectKey);
    const safeSceneId = safeName(sceneId);
    const filePath = `${safeProjectKey}/scene-${safeSceneId}-dialogue-${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("dialogue-audio")
      .upload(filePath, outputBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("dialogue-audio")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      audioUrl: publicData.publicUrl,
      audioPath: filePath,
      sourceText,
      settingsKey: `${modelId}-${stability}-${similarityBoost}`,
    });
  } catch (error: any) {
    console.error("store-dialogue-audio error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Dialogue audio could not be stored",
      },
      { status: 500 }
    );
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}