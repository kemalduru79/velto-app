import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffprobeStatic from "ffprobe-static";
import type { CreatorAudioProbe } from "./audioAssets";

function runProbe(path: string) {
  return new Promise<string>((resolve, reject) => {
    execFile(ffprobeStatic.path, ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,sample_rate,channels", "-of", "json", path],
      { timeout: 15_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) reject(new Error(String(stderr || error.message)));
        else resolve(String(stdout));
      });
  });
}

export async function probeCreatorAudioBytes(bytes: Uint8Array, extension: string): Promise<CreatorAudioProbe> {
  const directory = await mkdtemp(join(tmpdir(), "velto-audio-probe-"));
  const path = join(directory, `asset.${extension.replace(/[^a-z0-9]/gi, "") || "bin"}`);
  try {
    await writeFile(path, bytes);
    const parsed = JSON.parse(await runProbe(path)) as {
      format?: { format_name?: string; duration?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; sample_rate?: string; channels?: number }>;
    };
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const audio = streams.filter((stream) => stream.codec_type === "audio");
    return {
      formatNames: String(parsed.format?.format_name || "").split(",").filter(Boolean),
      durationMs: Math.round(Number(parsed.format?.duration) * 1000),
      codec: String(audio[0]?.codec_name || ""),
      sampleRateHz: Number(audio[0]?.sample_rate),
      channels: Number(audio[0]?.channels),
      audioStreamCount: audio.length,
      videoStreamCount: streams.filter((stream) => stream.codec_type === "video").length,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
