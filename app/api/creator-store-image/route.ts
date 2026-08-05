import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";
import { MAX_CREATOR_IMAGE_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import { decodeImageDataUrl, safeRemoteMediaFetch, SafeMediaError } from "@/lib/security/safeRemoteMediaFetch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const boundary = await enforceCreatorApiBoundary<Record<string, unknown>>(req, "creator-store-image");
    if (!boundary.ok) return boundary.response;
    const image = typeof boundary.context.body.image === "string" ? boundary.context.body.image.trim() : "";
    if (!image) return NextResponse.json({ ok: false, error: "image is required" }, { status: 400 });
    const media = image.startsWith("data:")
      ? decodeImageDataUrl(image, MAX_CREATOR_IMAGE_BYTES)
      : await safeRemoteMediaFetch({ rawUrl: image, kind: "image", maxBytes: MAX_CREATOR_IMAGE_BYTES });
    const path = `creator/${boundary.context.user.id}/image/${randomUUID()}.${media.extension}`;
    const stored = await getPersistenceServices().objectStorage.uploadPublic({
      bucket: "images", path, body: media.buffer, contentType: media.mimeType, upsert: false,
    });
    return NextResponse.json({ ok: true, imageUrl: stored.publicUrl, path: stored.path });
  } catch (error) {
    if (error instanceof SafeMediaError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("creator-store-image failed");
    return NextResponse.json({ ok: false, error: "Image could not be stored" }, { status: 500 });
  }
}
