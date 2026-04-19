import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const videoUrl =
      typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
    const sceneId = body?.sceneId;
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "temp";

    if (!videoUrl) {
      return NextResponse.json(
        { ok: false, error: "videoUrl gerekli" },
        { status: 400 }
      );
    }

    const videoRes = await fetch(videoUrl);

    if (!videoRes.ok) {
      const errorText = await videoRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: errorText || "Runway videosu indirilemedi",
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = getSupabaseAdmin();

    const safeProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeSceneId =
      typeof sceneId === "number" || typeof sceneId === "string"
        ? String(sceneId).replace(/[^a-zA-Z0-9-_]/g, "_")
        : "unknown";

    const filePath = `${safeProjectId}/scene-${safeSceneId}-${Date.now()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(filePath, buffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("videos")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      videoUrl: publicData.publicUrl,
      path: filePath,
    });
  } catch (error: any) {
    console.error("store-video error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Video kaydedilemedi",
      },
      { status: 500 }
    );
  }
}