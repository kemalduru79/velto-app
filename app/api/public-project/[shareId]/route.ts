import { NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";
import { mapPublicStoryverseEpisode } from "@/lib/security/publicStoryverseProjection";

export const runtime = "nodejs";

const PUBLIC_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function publicNotFound() {
  return NextResponse.json(
    { error: "Public episode bulunamadı ya da paylaşım kapalı." },
    { status: 404, headers: PUBLIC_RESPONSE_HEADERS },
  );
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  try {
    const { shareId } = await context.params;

    if (!/^[0-9a-fA-F]{16}$/.test(shareId)) return publicNotFound();
    const normalizedShareId = shareId.toLowerCase();

    const source =
      await getPersistenceServices().projectRepository.getPublicByShareId(
        normalizedShareId,
      );

    if (!source) return publicNotFound();
    const project = mapPublicStoryverseEpisode(source);
    if (!project) return publicNotFound();

    return NextResponse.json(
      { success: true, project },
      { headers: PUBLIC_RESPONSE_HEADERS },
    );
  } catch (error) {
    console.error("public-project error:", error);
    return NextResponse.json(
      { error: "Public episode yüklenirken hata oluştu." },
      { status: 500, headers: PUBLIC_RESPONSE_HEADERS },
    );
  }
}
