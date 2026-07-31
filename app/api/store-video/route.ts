import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const videoUrl =
      typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "temp";
    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    if (!videoUrl) {
      return NextResponse.json(
        { ok: false, error: "videoUrl gerekli" },
        { status: 400 },
      );
    }

    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: errorText || "Video indirilemedi" },
        { status: 500 },
      );
    }

    const contentType =
      videoResponse.headers.get("content-type") || "video/mp4";
    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    const filePath = `${safeName(projectId)}/scene-${safeName(sceneId)}-${Date.now()}.mp4`;
    const storedVideo =
      await getPersistenceServices().objectStorage.uploadPublic({
        bucket: "videos",
        path: filePath,
        body: buffer,
        contentType,
        upsert: false,
      });

    return NextResponse.json({
      ok: true,
      videoUrl: storedVideo.publicUrl,
      path: storedVideo.path,
    });
  } catch (error) {
    console.error("store-video error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Video kaydedilemedi",
      },
      { status: 500 },
    );
  }
}
