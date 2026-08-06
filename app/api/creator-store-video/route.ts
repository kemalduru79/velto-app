import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";
import { MAX_CREATOR_VIDEO_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";
import { readBoundedVerifiedVideoResponse } from "@/lib/security/boundedVideoResponse";
import { SafeMediaError } from "@/lib/security/safeRemoteMediaFetch";
import {
  isValidQueueJobId,
  validatePersistedVideoJobBinding,
} from "@/lib/security/persistedVideoJobBinding";
import { getVideoProvider } from "@/lib/video/providers";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const boundary = await enforceCreatorApiBoundary<Record<string, unknown>>(
      req,
      "creator-store-video",
    );
    if (!boundary.ok) {
      boundary.response.headers.set("Cache-Control", PRIVATE_HEADERS["Cache-Control"]);
      return boundary.response;
    }
    const input = boundary.context.body;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return json({ ok: false, error: "Invalid storage request." }, 400);
    }
    if (
      Object.keys(input).some((key) => key !== "queueJobId") ||
      !isValidQueueJobId(input.queueJobId)
    ) {
      return json({ ok: false, error: "A valid queue job identifier is required." }, 400);
    }

    const services = getPersistenceServices();
    const job = await services.jobQueue.getForUser(
      input.queueJobId,
      boundary.context.user.id,
    );
    if (!job) return json({ ok: false, error: "Job was not found." }, 404);
    if (
      job.jobType !== "video_reconcile" ||
      job.status !== "succeeded" ||
      job.result?.outputReady !== true
    ) {
      return json({ ok: false, error: "Video output is not ready." }, 409);
    }
    const binding = validatePersistedVideoJobBinding(job);
    if (!binding) {
      return json({ ok: false, error: "Video output is not available." }, 409);
    }

    const provider = getVideoProvider(binding.provider);
    const task = await provider.retrieveTask(binding.nativeTaskId);
    if (task.status !== "SUCCEEDED" || !task.videoUrl) {
      return json({ ok: false, error: "Video output is not ready." }, 409);
    }
    const output = await provider.downloadOutput(task.videoUrl);
    if (!output.ok || !output.body) {
      return json({ ok: false, error: "Video output could not be stored." }, 502);
    }
    const media = await readBoundedVerifiedVideoResponse(
      output,
      MAX_CREATOR_VIDEO_BYTES,
    );
    const stored = await services.objectStorage.uploadPublic({
      bucket: "videos",
      path: `creator/${boundary.context.user.id}/video/queue-${input.queueJobId}.${media.extension}`,
      body: media.buffer,
      contentType: media.mimeType,
      upsert: true,
    });
    return json({ ok: true, videoUrl: stored.publicUrl, path: stored.path });
  } catch (error) {
    if (error instanceof SafeMediaError) {
      return json({ ok: false, error: "Video output could not be stored." }, error.status);
    }
    console.error("creator-store-video failed");
    return json({ ok: false, error: "Video output could not be stored." }, 500);
  }
}
