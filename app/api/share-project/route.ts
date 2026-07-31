import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const body = (await req.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "";

    if (!projectId) {
      return NextResponse.json({ error: "projectId zorunlu." }, { status: 400 });
    }

    const result =
      await getPersistenceServices().projectRepository.publishForOwner(
        projectId,
        principal.id,
      );

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
    }

    if (result.status === "forbidden") {
      return NextResponse.json(
        { error: "Bu proje için paylaşım linki oluşturma yetkin yok." },
        { status: 403 },
      );
    }

    if (result.status === "share_id_exhausted") {
      return NextResponse.json(
        { error: "Benzersiz paylaşım ID'si üretilemedi." },
        { status: 500 },
      );
    }

    const origin = req.headers.get("origin") || "";
    const shareUrl = origin
      ? `${origin}/episode/public/${result.shareId}`
      : "";

    return NextResponse.json({
      success: true,
      shareId: result.shareId,
      shareUrl,
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    console.error("share-project error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Paylaşım linki oluşturulurken hata oluştu.",
      },
      { status: 500 },
    );
  }
}
