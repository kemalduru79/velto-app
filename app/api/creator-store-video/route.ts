import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";
import { MAX_CREATOR_VIDEO_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import { safeRemoteMediaFetch, SafeMediaError } from "@/lib/security/safeRemoteMediaFetch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const boundary = await enforceCreatorApiBoundary<Record<string, unknown>>(req, "creator-store-video");
    if (!boundary.ok) return boundary.response;
    const videoUrl = typeof boundary.context.body.videoUrl === "string" ? boundary.context.body.videoUrl.trim() : "";
    if (!videoUrl) return NextResponse.json({ ok: false, error: "videoUrl is required" }, { status: 400 });
    const media = await safeRemoteMediaFetch({ rawUrl: videoUrl, kind: "video", maxBytes: MAX_CREATOR_VIDEO_BYTES });
    const path = `creator/${boundary.context.user.id}/video/${randomUUID()}.${media.extension}`;
    const stored = await getPersistenceServices().objectStorage.uploadPublic({
      bucket: "videos", path, body: media.buffer, contentType: media.mimeType, upsert: false,
    });
    return NextResponse.json({ ok: true, videoUrl: stored.publicUrl, path: stored.path });
  } catch (error) {
    if (error instanceof SafeMediaError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("creator-store-video failed");
    return NextResponse.json({ ok: false, error: "Video could not be stored" }, { status: 500 });
  }
}
