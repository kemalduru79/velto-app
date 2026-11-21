import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffprobeStatic from "ffprobe-static";
import {
  CREATOR_FINAL_VIDEO_RECOVERY_TARGET,
  type CreatorFinalVideoRecoveryProbe,
} from "./finalVideoRecovery.ts";

export class CreatorFinalVideoRecoveryInspectionError extends Error {
  readonly code: "RECOVERY_STORAGE_SIZE_INVALID" | "RECOVERY_DOWNLOAD_INVALID" | "RECOVERY_MEDIA_INVALID";

  constructor(code: "RECOVERY_STORAGE_SIZE_INVALID" | "RECOVERY_DOWNLOAD_INVALID" | "RECOVERY_MEDIA_INVALID") {
    super(code);
    this.name = "CreatorFinalVideoRecoveryInspectionError";
    this.code = code;
  }
}

function runProbe(path: string) {
  const executable = ffprobeStatic.path && existsSync(ffprobeStatic.path)
    ? ffprobeStatic.path
    : "ffprobe";
  return new Promise<string>((resolve, reject) => {
    execFile(executable, [
      "-v", "error", "-count_frames", "-show_entries",
      "format=format_name,duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,nb_read_frames",
      "-of", "json", path,
    ], { timeout: 120_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message)));
      else resolve(String(stdout));
    });
  });
}

function frameRate(value: unknown) {
  const [numerator, denominator] = String(value || "0/1").split("/").map(Number);
  return denominator > 0 ? numerator / denominator : 0;
}

export async function writeVerifiedCreatorFinalVideoRecoveryStream(input: {
  stream: ReadableStream<Uint8Array>;
  path: string;
  expectedSizeBytes: number;
  expectedSha256: string;
}) {
  const output = await open(input.path, "wx");
  const hash = createHash("sha256");
  const reader = input.stream.getReader();
  let sizeBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_DOWNLOAD_INVALID");
      }
      sizeBytes += value.byteLength;
      if (sizeBytes > input.expectedSizeBytes) {
        throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_STORAGE_SIZE_INVALID");
      }
      hash.update(value);
      await output.write(value);
    }
    if (sizeBytes !== input.expectedSizeBytes || hash.digest("hex") !== input.expectedSha256) {
      throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_DOWNLOAD_INVALID");
    }
  } finally {
    await output.close().catch(() => undefined);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function assertCreatorFinalVideoRecoveryStorageMetadata(metadataSize: unknown) {
  if (!Number.isSafeInteger(metadataSize) || Number(metadataSize) !== CREATOR_FINAL_VIDEO_RECOVERY_TARGET.sizeBytes) {
    throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_STORAGE_SIZE_INVALID");
  }
}

export async function probeCreatorFinalVideoRecoveryStream(input: {
  metadataSize: unknown;
  stream: ReadableStream<Uint8Array>;
}): Promise<CreatorFinalVideoRecoveryProbe> {
  assertCreatorFinalVideoRecoveryStorageMetadata(input.metadataSize);
  const directory = await mkdtemp(join(tmpdir(), "velto-final-recovery-probe-"));
  const path = join(directory, "candidate.mp4");
  try {
    await writeVerifiedCreatorFinalVideoRecoveryStream({
      stream: input.stream,
      path,
      expectedSizeBytes: CREATOR_FINAL_VIDEO_RECOVERY_TARGET.sizeBytes,
      expectedSha256: CREATOR_FINAL_VIDEO_RECOVERY_TARGET.contentSha256,
    });
    let parsed: {
      format?: { format_name?: string; duration?: string; size?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string; sample_rate?: string; channels?: number; nb_read_frames?: string }>;
    };
    try {
      parsed = JSON.parse(await runProbe(path));
    } catch {
      throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_MEDIA_INVALID");
    }
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const video = streams.filter((stream) => stream.codec_type === "video");
    const audio = streams.filter((stream) => stream.codec_type === "audio");
    if (!String(parsed.format?.format_name || "").split(",").includes("mp4")) {
      throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_MEDIA_INVALID");
    }
    return {
      contentSha256: CREATOR_FINAL_VIDEO_RECOVERY_TARGET.contentSha256,
      sizeBytes: CREATOR_FINAL_VIDEO_RECOVERY_TARGET.sizeBytes,
      durationMs: Math.round(Number(parsed.format?.duration) * 1000),
      videoStreamCount: video.length,
      audioStreamCount: audio.length,
      videoCodec: String(video[0]?.codec_name || ""), audioCodec: String(audio[0]?.codec_name || ""),
      width: Number(video[0]?.width || 0), height: Number(video[0]?.height || 0),
      framesPerSecond: frameRate(video[0]?.r_frame_rate), videoFrameCount: Number(video[0]?.nb_read_frames || 0),
      audioSampleRateHz: Number(audio[0]?.sample_rate || 0), audioChannels: Number(audio[0]?.channels || 0),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
