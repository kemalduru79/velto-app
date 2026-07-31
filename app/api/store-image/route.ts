import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function parseDataUri(dataUri: string) {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) throw new Error("Invalid image data URI");

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  let extension = "png";

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
  if (mimeType.includes("webp")) extension = "webp";

  return { mimeType, extension, buffer };
}

async function downloadRemoteFile(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Remote image download failed");
  }

  const mimeType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  let extension = "png";

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
  if (mimeType.includes("webp")) extension = "webp";

  return { mimeType, extension, buffer };
}

// VELTO_PORT_P2 — media routes use ObjectStorageRepository only.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const image = typeof body?.image === "string" ? body.image.trim() : "";
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
        { status: 400 },
      );
    }

    const fileData = image.startsWith("data:image/")
      ? parseDataUri(image)
      : image.startsWith("https://")
        ? await downloadRemoteFile(image)
        : null;

    if (!fileData) {
      return NextResponse.json(
        {
          ok: false,
          error: "image must be a data URI or a public HTTPS URL",
        },
        { status: 400 },
      );
    }

    const filePath = `${safeName(projectId)}/scene-${safeName(sceneId)}-${Date.now()}.${fileData.extension}`;
    const storedImage =
      await getPersistenceServices().objectStorage.uploadPublic({
        bucket: "images",
        path: filePath,
        body: fileData.buffer,
        contentType: fileData.mimeType,
        upsert: false,
      });

    return NextResponse.json({
      ok: true,
      imageUrl: storedImage.publicUrl,
      path: storedImage.path,
    });
  } catch (error) {
    console.error("store-image error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Image could not be stored",
      },
      { status: 500 },
    );
  }
}
