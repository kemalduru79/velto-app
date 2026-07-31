import { NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  try {
    const { shareId } = await context.params;

    if (!shareId) {
      return NextResponse.json({ error: "shareId zorunlu." }, { status: 400 });
    }

    const project =
      await getPersistenceServices().projectRepository.getPublicByShareId(
        shareId,
      );

    if (!project) {
      return NextResponse.json(
        { error: "Public episode bulunamadı ya da paylaşım kapalı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("public-project error:", error);
    return NextResponse.json(
      { error: "Public episode yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}
