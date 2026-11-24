import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

async function handleLoadProject(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
  dependencies: { authenticate: typeof authenticateRequest; persistence: typeof getPersistenceServices } = { authenticate: authenticateRequest, persistence: getPersistenceServices },
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json({ error: "projectId zorunlu" }, { status: 400 });
    }

    const principal = await dependencies.authenticate(req);
    const project = await dependencies.persistence().projectRepository.getForOwner(
      projectId,
      principal.id,
    );

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı ya da erişim yetkin yok." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    console.error("load-project error:", error);
    return NextResponse.json(
      { error: "Yükleme sırasında hata oluştu" },
      { status: 500 },
    );
  }
}

export const GET = Object.assign((req: Request, context: { params: Promise<{ projectId: string }> }) => handleLoadProject(req, context), { handleForTest: handleLoadProject });
