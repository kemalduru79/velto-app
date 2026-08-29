import { NextResponse } from "next/server";
import { ExaResearchSearchProvider } from "@/lib/providers/research/exa.server";
import { normalizeCreatorResearchSearchRequest } from "@/lib/research/searchRequest";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const secured = await enforceCreatorApiBoundary<Record<string, unknown>>(
    request,
    "creator-research",
  );
  if (!secured.ok) return secured.response;

  try {
    const searchInput = normalizeCreatorResearchSearchRequest(secured.context.body);
    const providerAvailable = Boolean(ExaResearchSearchProvider);
    return NextResponse.json(
      {
        success: false,
        code: "RESEARCH_DIAGNOSTIC_ONLY",
        category: searchInput.category,
        providerAvailable,
      },
      { status: 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        code: "RESEARCH_SEARCH_INVALID",
        error: error instanceof Error ? error.message : "Research search input is invalid.",
      },
      { status: 400 },
    );
  }
}
