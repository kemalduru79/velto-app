import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";
import { MAX_CREATOR_IMAGE_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import { decodeImageDataUrl, safeRemoteMediaFetch, SafeMediaError } from "@/lib/security/safeRemoteMediaFetch";
import { consumeStorageAdmissionForMedia, StorageAdmissionError, storageAdmissionErrorResponse } from "@/lib/persistence/media/storageAdmission.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const boundary = await enforceCreatorApiBoundary<Record<string, unknown>>(req, "creator-store-image");
    if (!boundary.ok) return boundary.response;
    const image = typeof boundary.context.body.image === "string" ? boundary.context.body.image.trim() : "";
    if (!image) return NextResponse.json({ ok: false, error: "image is required" }, { status: 400 });
    const storageAdmissionId = typeof boundary.context.body.storageAdmissionId === "string"
      ? boundary.context.body.storageAdmissionId.trim() : "";
    const stored = await consumeStorageAdmissionForMedia({
      ownerUserId: boundary.context.user.id,
      storageAdmissionId,
      mediaKind: "image",
      purpose: "creator_generated_image",
      operation: async (markDurableStorageStarted) => {
        const media = image.startsWith("data:")
          ? decodeImageDataUrl(image, MAX_CREATOR_IMAGE_BYTES)
          : await safeRemoteMediaFetch({ rawUrl: image, kind: "image", maxBytes: MAX_CREATOR_IMAGE_BYTES });
        const path = `creator/${boundary.context.user.id}/image/${randomUUID()}.${media.extension}`;
        const services = getPersistenceServices();
        const uploaded = await services.objectStorage.uploadPublic({
          bucket: "images", path, body: media.buffer, contentType: media.mimeType, upsert: false,
        });
        markDurableStorageStarted();
        await registerStoredAssetOrThrow({ repository: services.mediaAssetRepository, ownerUserId: boundary.context.user.id,
          bucket: uploaded.bucket, storagePath: uploaded.path, publicUrl: uploaded.publicUrl, mediaKind: "image",
          mimeType: media.mimeType, body: media.buffer });
        return uploaded;
      },
    });
    return NextResponse.json({ ok: true, imageUrl: stored.publicUrl, path: stored.path });
  } catch (error) {
    if (error instanceof StorageAdmissionError) return storageAdmissionErrorResponse(error);
    if (error instanceof SafeMediaError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("creator-store-image failed");
    return NextResponse.json({ ok: false, error: "Image could not be stored" }, { status: 500 });
  }
}
