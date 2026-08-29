import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { persistEconomicOperationBestEffort } from "@/lib/economics";
import { ExaResearchSearchProvider } from "@/lib/providers/research/exa.server";
import {
  ResearchProviderError,
  type ResearchSearchResult,
} from "@/lib/providers/research/types";
import { normalizeCreatorResearchSearchRequest } from "@/lib/research/searchRequest";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";

export const runtime = "nodejs";
export const maxDuration = 30;

function providerNeutralSources(sources: ResearchSearchResult["sources"]) {
  return sources.map((source) => ({
    ...source,
    sourceMetadata: Object.fromEntries(
      Object.entries(source.sourceMetadata).filter(
        ([key]) => key !== "provider" && key !== "resultId",
      ),
    ),
  }));
}

function researchCost(providerCostUsd: number | null) {
  const pricingAsOf = new Date().toISOString().slice(0, 10);

  if (providerCostUsd === null) {
    return {
      costStatus: "unknown" as const,
      providerCostUsd: null,
      reason: "Provider response did not include a request cost.",
      components: {},
      pricingVersion: "exa-response-cost-v1",
      pricingAsOf,
      currency: "USD" as const,
    };
  }

  return {
    costStatus: "exact" as const,
    providerCostUsd,
    reason: "Provider-reported request cost.",
    components: { search: providerCostUsd },
    pricingVersion: "exa-response-cost-v1",
    pricingAsOf,
    currency: "USD" as const,
  };
}

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
    const completedAt = new Date().toISOString();
    const operationId = result.providerRequestId || randomUUID();

    await persistEconomicOperationBestEffort({
      attemptKey: `research-search:${secured.context.user.id}:${operationId}`,
      logicalOperationId: `research-search:${operationId}`,
      userId: secured.context.user.id,
      route: "creator-research",
      operationType: "grounded_research_search",
      provider: "exa",
      providerTier: "research",
      model: searchInput.category,
      providerRequestId: result.providerRequestId,
      state: "settled",
      billingMoment: "provider_response",
      generated: false,
      quantities: {
        requestCount: 1,
        returnedSourceCount: result.sources.length,
        requestedResultCount: searchInput.maxResults || 8,
        category: searchInput.category,
      },
      cost: researchCost(result.providerCostUsd),
      completedAt,
    });

    const sources = providerNeutralSources(result.sources);
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
