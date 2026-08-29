import { NextResponse } from "next/server";
import { ExaResearchSearchProvider } from "@/lib/providers/research/exa.server";
import { ResearchProviderError } from "@/lib/providers/research/types";
import { normalizeCreatorResearchSearchRequest } from "@/lib/research/searchRequest";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const secured = await enforceCreatorApiBoundary<Record<string, unknown>>(
      request,
      "creator-research",
    );
    if (!secured.ok) return secured.response;

    let searchInput;
    try {
      searchInput = normalizeCreatorResearchSearchRequest(secured.context.body);
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

    const provider = new ExaResearchSearchProvider();
    const result = await provider.search(searchInput);
    const sources = result.sources.map((source) => ({
      ...source,
      sourceMetadata: Object.fromEntries(
        Object.entries(source.sourceMetadata).filter(
          ([key]) => key !== "provider" && key !== "resultId",
        ),
      ),
    }));

    return NextResponse.json({
      success: true,
      category: searchInput.category,
      sourceCount: sources.length,
      sources,
    });
  } catch (error) {
    if (error instanceof ResearchProviderError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
        },
        { status: error.status },
      );
    }

    console.error("CREATOR_RESEARCH_SEARCH_FAILED", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        success: false,
        code: "RESEARCH_SEARCH_FAILED",
        error: "Grounded research search failed.",
      },
      { status: 500 },
    );
  }
}
