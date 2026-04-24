// 🔥 VELTO EXPORT SERVICE — MIXED PIPELINE FINAL

import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "10mb" }));

const TARGET_SCENE_DURATION = 8;
const MAX_SCENE_DURATION = 10;
const MAX_SPEECH_RATIO = 0.82;
const MIN_SCENE_DURATION = 6.5;

const ffmpeg = "ffmpeg";
const ffprobe = "ffprobe";

const run = (cmd, args) =>
  new Promise((res, rej) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? res() : rej(err)));
  });

const probe = (file) =>
  new Promise((res, rej) => {
    const p = spawn(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => res(Number(out) || 0));
  });

const download = async (url, file) => {
  const r = await fetch(url);
  const b = Buffer.from(await r.arrayBuffer());
  await fs.promises.writeFile(file, b);
};

const supabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 🔥 IMAGE → VIDEO
async function createImageClip({ imagePath, audioPath, output, duration }) {
  await run(ffmpeg, [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    ...(audioPath ? ["-i", audioPath] : []),

    "-t",
    duration.toFixed(3),

    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.1)':d=125",

    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",

    ...(audioPath
      ? ["-map", "0:v:0", "-map", "1:a:0"]
      : ["-f", "lavfi", "-i", "anullsrc"]),

    "-c:a",
    "aac",
    "-b:a",
    "192k",

    output,
  ]);
}

// 🎬 VIDEO + AUDIO
async function createVideoClip({ videoPath, audioPath, output, duration }) {
  await run(ffmpeg, [
    "-y",
    "-i",
    videoPath,
    ...(audioPath ? ["-i", audioPath] : []),

    "-t",
    duration.toFixed(3),

    ...(audioPath
      ? ["-map", "0:v:0", "-map", "1:a:0"]
      : ["-f", "lavfi", "-i", "anullsrc"]),

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

    output,
  ]);
}

app.post("/export-movie", async (req, res) => {
  const temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "velto-"));

  try {
    const scenes = req.body.scenes || [];
    const usable = scenes.filter(
      (s) => (s.videoUrl && s.videoUrl.trim()) || (s.image && s.image.trim())
    );

    if (!usable.length)
      return res.status(400).json({
        ok: false,
        error: "Export için video veya image gerekli",
      });

    const clips = [];

    for (let i = 0; i < usable.length; i++) {
      const s = usable[i];

      const videoPath = path.join(temp, `v-${i}.mp4`);
      const imagePath = path.join(temp, `i-${i}.jpg`);
      const audioPath = path.join(temp, `a-${i}.mp3`);
      const clipPath = path.join(temp, `c-${i}.mp4`);

      let isVideo = false;
      let source;

      if (s.videoUrl) {
        await download(s.videoUrl, videoPath);
        source = videoPath;
        isVideo = true;
      } else {
        await download(s.image, imagePath);
        source = imagePath;
      }

      let hasAudio = false;

      if (s.audioUrl) {
        await download(s.audioUrl, audioPath);
        hasAudio = true;
      }

      const audioDur = hasAudio ? await probe(audioPath) : 0;
      const target = Math.min(
        Math.max(
          s.timing?.targetSceneDuration || audioDur || TARGET_SCENE_DURATION,
          MIN_SCENE_DURATION
        ),
        MAX_SCENE_DURATION
      );

      if (isVideo) {
        await createVideoClip({
          videoPath: source,
          audioPath: hasAudio ? audioPath : null,
          output: clipPath,
          duration: target,
        });
      } else {
        await createImageClip({
          imagePath: source,
          audioPath: hasAudio ? audioPath : null,
          output: clipPath,
          duration: target,
        });
      }

      clips.push(clipPath);
    }

    const list = path.join(temp, "list.txt");
    await fs.promises.writeFile(
      list,
      clips.map((c) => `file '${c}'`).join("\n")
    );

    const final = path.join(temp, "out.mp4");

    await run(ffmpeg, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
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
      final,
    ]);

    const buf = await fs.promises.readFile(final);

    const client = supabase();

    const filePath = `movies/${Date.now()}.mp4`;

    await client.storage.from("movies").upload(filePath, buf);

    const { data } = client.storage.from("movies").getPublicUrl(filePath);

    res.json({
      ok: true,
      movieUrl: data.publicUrl,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.toString() });
  } finally {
    fs.promises.rm(temp, { recursive: true, force: true });
  }
});

app.listen(process.env.PORT || 3001);