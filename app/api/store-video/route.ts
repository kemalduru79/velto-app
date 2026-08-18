import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { enforceLegacyMediaBoundary } from "@/lib/security/legacyMediaStorageBoundary";
import { MAX_CREATOR_VIDEO_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import { safeRemoteMediaFetch, SafeMediaError } from "@/lib/security/safeRemoteMediaFetch";
import { consumeStorageAdmissionForMedia, StorageAdmissionError, storageAdmissionErrorResponse } from "@/lib/persistence/media/storageAdmission.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const boundary = await enforceLegacyMediaBoundary<Record<string, unknown>>(req, "store-video");
    if (!boundary.ok) return boundary.response;
    const body = boundary.body;
    const videoUrl =
      typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
    const storageAdmissionId = typeof body?.storageAdmissionId === "string" ? body.storageAdmissionId.trim() : "";

    if (!videoUrl) {
      return NextResponse.json(
        { ok: false, error: "videoUrl gerekli" },
        { status: 400 },
      );
    }

    const storedVideo = await consumeStorageAdmissionForMedia({
      ownerUserId: boundary.user.id,
      storageAdmissionId,
      mediaKind: "video",
      purpose: "storyverse_generated_video",
      operation: async (markDurableStorageStarted) => {
        const media = await safeRemoteMediaFetch({
          rawUrl: videoUrl, kind: "video", maxBytes: MAX_CREATOR_VIDEO_BYTES,
        });
        const filePath = `storyverse/${boundary.user.id}/video/${randomUUID()}.${media.extension}`;
        const services = getPersistenceServices();
        const uploaded = await services.objectStorage.uploadPublic({
          bucket: "videos", path: filePath, body: media.buffer, contentType: media.mimeType, upsert: false,
        });
        markDurableStorageStarted();
        await registerStoredAssetOrThrow({ repository: services.mediaAssetRepository, ownerUserId: boundary.user.id,
          bucket: uploaded.bucket, storagePath: uploaded.path, publicUrl: uploaded.publicUrl, mediaKind: "video",
          mimeType: media.mimeType, body: media.buffer, metadata: { product: "storyverse" } });
        return uploaded;
      },
    });

    return NextResponse.json({
      ok: true,
      videoUrl: storedVideo.publicUrl,
      path: storedVideo.path,
    });
  } catch (error) {
    if (error instanceof StorageAdmissionError) return storageAdmissionErrorResponse(error);
    if (error instanceof SafeMediaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("store-video failed");
    return NextResponse.json(
      {
        ok: false,
        error: "Video could not be stored",
      },
      { status: 500 },
    );
  }
}
