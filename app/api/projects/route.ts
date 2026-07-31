import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

// VELTO_PORT_P2 — routes depend on repository contracts, not database tables.
export async function GET(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const projects = await getPersistenceServices().projectRepository.listForOwner(
      principal.id,
    );

    return NextResponse.json({ success: true, projects });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("projects error:", error);
    return NextResponse.json(
      { error: "Projeler yüklenirken hata oluştu" },
      { status: 500 },
    );
  }
}
