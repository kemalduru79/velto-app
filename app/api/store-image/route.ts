import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { enforceLegacyMediaBoundary } from "@/lib/security/legacyMediaStorageBoundary";
import { MAX_CREATOR_IMAGE_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import {
  decodeImageDataUrl,
  safeRemoteMediaFetch,
  SafeMediaError,
} from "@/lib/security/safeRemoteMediaFetch";
import { consumeStorageAdmissionForMedia, StorageAdmissionError, storageAdmissionErrorResponse } from "@/lib/persistence/media/storageAdmission.server";

export const runtime = "nodejs";

// VELTO_PORT_P2 — media routes use ObjectStorageRepository only.
export async function POST(req: NextRequest) {
  try {
    const boundary = await enforceLegacyMediaBoundary<Record<string, unknown>>(req, "store-image");
    if (!boundary.ok) return boundary.response;
    const body = boundary.body;
    const image = typeof body?.image === "string" ? body.image.trim() : "";
    const storageAdmissionId = typeof body?.storageAdmissionId === "string" ? body.storageAdmissionId.trim() : "";

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "image is required" },
        { status: 400 },
      );
    }

    const storedImage = await consumeStorageAdmissionForMedia({
      ownerUserId: boundary.user.id,
      storageAdmissionId,
      mediaKind: "image",
      purpose: "storyverse_generated_image",
      operation: async (markDurableStorageStarted) => {
        const fileData = image.startsWith("data:")
          ? decodeImageDataUrl(image, MAX_CREATOR_IMAGE_BYTES)
          : image.startsWith("https://")
            ? await safeRemoteMediaFetch({ rawUrl: image, kind: "image", maxBytes: MAX_CREATOR_IMAGE_BYTES })
            : null;
        if (!fileData) throw new SafeMediaError(400, "image must be a data URI or a public HTTPS URL");
        const filePath = `storyverse/${boundary.user.id}/image/${randomUUID()}.${fileData.extension}`;
        const services = getPersistenceServices();
        const uploaded = await services.objectStorage.uploadPublic({
          bucket: "images", path: filePath, body: fileData.buffer, contentType: fileData.mimeType, upsert: false,
        });
        markDurableStorageStarted();
        await registerStoredAssetOrThrow({ repository: services.mediaAssetRepository, ownerUserId: boundary.user.id,
          bucket: uploaded.bucket, storagePath: uploaded.path, publicUrl: uploaded.publicUrl, mediaKind: "image",
          mimeType: fileData.mimeType, body: fileData.buffer, metadata: { product: "storyverse" } });
        return uploaded;
      },
    });

    return NextResponse.json({
      ok: true,
      imageUrl: storedImage.publicUrl,
      path: storedImage.path,
    });
  } catch (error) {
    if (error instanceof StorageAdmissionError) return storageAdmissionErrorResponse(error);
    if (error instanceof SafeMediaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("store-image failed");
    return NextResponse.json(
      {
        ok: false,
        error: "Image could not be stored",
      },
      { status: 500 },
    );
  }
}
