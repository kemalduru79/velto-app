import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { importStock } from "@/lib/providers/stock/service.server";
import { StockProviderError } from "@/lib/providers/stock";
import { SafeMediaError } from "@/lib/security/safeRemoteMediaFetch";
import { getCreditErrorResponse } from "@/lib/credits/serverMetering";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request); const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""; const providerMediaId = typeof body.providerMediaId === "string" ? body.providerMediaId.trim() : ""; const renditionId = typeof body.renditionId === "string" ? body.renditionId.trim() : "";
    const forbiddenEconomicFields = ["creditCost", "credits", "free", "reused", "providerCost"];
    if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^\d{1,20}$/.test(providerMediaId) || !renditionId || renditionId.length > 80 || (body.mediaType !== "photo" && body.mediaType !== "video") || "downloadUrl" in body || "url" in body || forbiddenEconomicFields.some((field) => field in body)) return NextResponse.json({ ok: false, code: "STOCK_IMPORT_INVALID", error: "Stock import request is invalid." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await importStock({ request, userId: principal.id, projectId, mediaType: body.mediaType, providerMediaId, renditionId })) });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", error: "A valid session is required." }, { status: 401 });
    const creditError = getCreditErrorResponse(error); if (creditError) return creditError;
    if (error instanceof StockProviderError) return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    if (error instanceof SafeMediaError) return NextResponse.json({ ok: false, code: "STOCK_DOWNLOAD_FAILED", error: error.message }, { status: error.status });
    console.error("CREATOR_STOCK_IMPORT_FAILED", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "STOCK_IMPORT_FAILED", error: "Stock media could not be imported." }, { status: 500 });
  }
}
