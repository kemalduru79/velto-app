import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const MAX_SCENE_DURATION = 10;
const TARGET_SCENE_DURATION = 8;
const MAX_SPEECH_RATIO = 0.82;

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";

    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err));
    });
  });
}

async function duration(file) {
  const { execSync } = await import("child_process");
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`
    );
    return Number(out.toString().trim());
  } catch {
    return 0;
  }
}

async function download(url, file) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(file, buf);
}

function capSceneDuration(target, audioDuration) {
  const base = target || audioDuration || TARGET_SCENE_DURATION;
  return Math.min(base, MAX_SCENE_DURATION);
}

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/export-movie", async (req, res) => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "velto-")
  );

  try {
    const scenes = req.body.scenes || [];

    const clips = [];

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];

      const video = `${tempDir}/v${i}.mp4`;
      const audio = `${tempDir}/a${i}.mp3`;
      const out = `${tempDir}/c${i}.mp4`;

      await download(s.videoUrl, video);

      let audioDuration = 0;

      if (s.audioUrl) {
        await download(s.audioUrl, audio);
        audioDuration = await duration(audio);
      }

      const target = capSceneDuration(
        s?.timing?.targetSceneDuration,
        audioDuration
      );

      if (audioDuration > target * MAX_SPEECH_RATIO) {
        return res.status(400).json({
          ok: false,
          error: `Scene ${i + 1} konuşması çok uzun`,
        });
      }

      await run("ffmpeg", [
        "-y",
        "-i",
        video,
        ...(s.audioUrl ? ["-i", audio] : []),
        "-t",
        target.toFixed(2),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        out,
      ]);

      clips.push(out);
    }

    const list = `${tempDir}/list.txt`;
    await fs.promises.writeFile(
      list,
      clips.map((c) => `file '${c}'`).join("\n")
    );

    const final = `${tempDir}/final.mp4`;

    await run("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c",
      "copy",
      final,
    ]);

    const buffer = await fs.promises.readFile(final);

    const supabase = getSupabaseAdmin();

    const filePath = `movies/${Date.now()}.mp4`;

    await supabase.storage.from("movies").upload(filePath, buffer);

    const { data } = supabase.storage
      .from("movies")
      .getPublicUrl(filePath);

    res.json({
      ok: true,
      movieUrl: data.publicUrl,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.listen(process.env.PORT || 3001);