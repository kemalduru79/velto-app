import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getCreatorEconomicUsageSnapshot, toCustomerCreatorUsage, type CreatorUsageWindow } from "@/lib/economics/usageService.server";
import { withObservedApiRoute } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
async function handler(request: NextRequest) {
  try {
    const principal = await authenticateRequest(request); const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || null; const requestedWindow = request.nextUrl.searchParams.get("window");
    const window: CreatorUsageWindow = projectId ? "project_lifetime" : requestedWindow === "rolling_30_days" ? "rolling_30_days" : "current_month";
    const snapshot = await getCreatorEconomicUsageSnapshot({ userId: principal.id, projectId, window });
    return NextResponse.json({ ok: true, usage: toCustomerCreatorUsage(snapshot) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401, headers: NO_STORE });
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") return NextResponse.json({ ok: false, error: "Project was not found." }, { status: 404, headers: NO_STORE });
    console.error("creator usage aggregation failed"); return NextResponse.json({ ok: false, error: "Usage is temporarily unavailable." }, { status: 503, headers: NO_STORE });
  }
}
export const GET = withObservedApiRoute("api.creator-usage.read", handler);
