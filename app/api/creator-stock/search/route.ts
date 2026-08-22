import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { searchStock, validateStockSearch } from "@/lib/providers/stock/service.server";
import { StockProviderError } from "@/lib/providers/stock";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request); const url = new URL(request.url);
    if (!process.env.PEXELS_API_KEY?.trim()) throw new StockProviderError("STOCK_UNAVAILABLE", 503, "Stock search is not configured.");
    const input = validateStockSearch({ query: url.searchParams.get("query"), mediaType: url.searchParams.get("mediaType"), orientation: url.searchParams.get("orientation"), page: url.searchParams.get("page"), perPage: url.searchParams.get("perPage") });
    return NextResponse.json({ ok: true, ...(await searchStock(input, principal.id)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", error: "A valid session is required." }, { status: 401 });
    if (error instanceof StockProviderError) return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("CREATOR_STOCK_SEARCH_FAILED", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "STOCK_UNAVAILABLE", error: "Stock search is temporarily unavailable." }, { status: 503 });
  }
}
