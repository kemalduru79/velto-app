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

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function parseDataUri(dataUri: string) {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid image data URI");
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  let extension = "png";
  if (mimeType.includes("jpeg")) extension = "jpg";
  if (mimeType.includes("jpg")) extension = "jpg";
  if (mimeType.includes("webp")) extension = "webp";

  return {
    mimeType,
    extension,
    buffer,
  };
}

async function downloadRemoteFile(url: string) {
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || "Remote image download failed");
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extension = "png";
  if (contentType.includes("jpeg")) extension = "jpg";
  if (contentType.includes("jpg")) extension = "jpg";
  if (contentType.includes("webp")) extension = "webp";

  return {
    mimeType: contentType,
    extension,
    buffer,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const image =
      typeof body?.image === "string" ? body.image.trim() : "";
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "temp-project";
    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "image is required" },
        { status: 400 }
      );
    }

    let fileData:
      | { mimeType: string; extension: string; buffer: Buffer }
      | undefined;

    if (image.startsWith("data:image/")) {
      fileData = parseDataUri(image);
    } else if (image.startsWith("https://")) {
      fileData = await downloadRemoteFile(image);
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "image must be a data URI or a public HTTPS URL",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const safeProjectId = safeName(projectId);
    const safeSceneId = safeName(sceneId);
    const filePath = `${safeProjectId}/scene-${safeSceneId}-${Date.now()}.${fileData.extension}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, fileData.buffer, {
        contentType: fileData.mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      imageUrl: publicData.publicUrl,
      path: filePath,
    });
  } catch (error: any) {
    console.error("store-image error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Image could not be stored",
      },
      { status: 500 }
    );
  }
}