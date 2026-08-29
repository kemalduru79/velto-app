import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  persistEconomicOperationBestEffort,
  type EconomicCostResult,
} from "@/lib/economics";
import { ExaResearchSearchProvider } from "@/lib/providers/research/exa.server";
import {
  ResearchProviderError,
  type ResearchSearchResult,
} from "@/lib/providers/research/types";
import {
  executeResearchOrchestration,
  ResearchOrchestrationError,
  type OrchestratedResearchResult,
  type ResearchLaneExecution,
} from "@/lib/research/orchestratedResearch";
import {
  normalizeCreatorResearchMode,
  normalizeCreatorResearchOrchestrationRequest,
} from "@/lib/research/orchestrationRequest";
import { createResearchOrchestrationPlan } from "@/lib/research/researchOrchestration";
import { normalizeCreatorResearchSearchRequest } from "@/lib/research/searchRequest";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function providerNeutralLanes(lanes: ResearchLaneExecution[]) {
  return lanes.map((lane) => ({
    laneId: lane.laneId,
    purpose: lane.purpose,
    required: lane.required,
    status: lane.status,
    sourceIds: lane.sourceIds,
  }));
}

function researchCost(providerCostUsd: number | null): EconomicCostResult {
  const pricingAsOf = new Date().toISOString().slice(0, 10);

  if (providerCostUsd === null) {
    return {
      costStatus: "unknown",
      providerCostUsd: null,
      reason: "Provider response did not include a request cost.",
      components: {},
      pricingVersion: "exa-response-cost-v1",
      pricingAsOf,
      currency: "USD",
    };
  }

  return {
    costStatus: "exact",
    providerCostUsd,
    reason: "Provider-reported request cost.",
    components: { search: providerCostUsd },
    pricingVersion: "exa-response-cost-v1",
    pricingAsOf,
    currency: "USD",
  };
}

function orchestratedResearchCost(
  economics: OrchestratedResearchResult["economics"],
): EconomicCostResult {
  const pricingAsOf = new Date().toISOString().slice(0, 10);

  if (!economics.costComplete) {
    return {
      costStatus: "unknown",
      providerCostUsd: null,
      reason: "At least one research lane did not report an exact provider cost.",
      components: economics.knownProviderCostUsd > 0
        ? { knownSearchCost: economics.knownProviderCostUsd }
        : {},
      pricingVersion: "exa-orchestrated-response-cost-v1",
      pricingAsOf,
      currency: "USD",
    };
  }

  return {
    costStatus: "exact",
    providerCostUsd: economics.knownProviderCostUsd,
    reason: "Provider-reported costs aggregated across research lanes.",
    components: { search: economics.knownProviderCostUsd },
    pricingVersion: "exa-orchestrated-response-cost-v1",
    pricingAsOf,
    currency: "USD",
  };
}

export async function POST(request: Request) {
  try {
    const secured = await enforceCreatorApiBoundary<Record<string, unknown>>(
      request,
      "creator-research",
    );
    if (!secured.ok) return secured.response;

    let mode;
    try {
      mode = normalizeCreatorResearchMode(secured.context.body.mode);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          code: "RESEARCH_MODE_INVALID",
          error: error instanceof Error ? error.message : "Research mode is invalid.",
        },
        { status: 400 },
      );
    }

    const provider = new ExaResearchSearchProvider();

    if (mode === "orchestrated") {
      let orchestrationInput;
      try {
        orchestrationInput = normalizeCreatorResearchOrchestrationRequest(
          secured.context.body,
        );
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            code: "RESEARCH_ORCHESTRATION_INVALID",
            error: error instanceof Error ? error.message : "Research orchestration input is invalid.",
          },
          { status: 400 },
        );
      }

      const plan = createResearchOrchestrationPlan(orchestrationInput);
      const result = await executeResearchOrchestration({ plan, provider });
      const completedAt = new Date().toISOString();
      const operationId = randomUUID();

      await persistEconomicOperationBestEffort({
        attemptKey: `research-orchestration:${secured.context.user.id}:${operationId}`,
        logicalOperationId: `research-orchestration:${operationId}`,
        userId: secured.context.user.id,
        route: "creator-research",
        operationType: "grounded_research_orchestration",
        provider: "exa",
        providerTier: "research",
        model: "multi_lane",
        state: "settled",
        billingMoment: "provider_response",
        generated: false,
        quantities: {
          requestCount: result.economics.providerRequestCount,
          laneCount: result.lanes.length,
          returnedSourceCount: result.sources.length,
          claimType: plan.claimType || "UNCLASSIFIED",
          costComplete: result.economics.costComplete,
        },
        cost: orchestratedResearchCost(result.economics),
        completedAt,
      });

      const sources = providerNeutralSources(result.sources);
      return NextResponse.json({
        success: true,
        mode: "orchestrated",
        subject: plan.subject,
        claimType: plan.claimType,
        laneCount: result.lanes.length,
        sourceCount: sources.length,
        lanes: providerNeutralLanes(result.lanes),
        sources,
      });
    }

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
      mode: "single",
      category: searchInput.category,
      sourceCount: sources.length,
      sources,
    });
  } catch (error) {
    if (error instanceof ResearchOrchestrationError) {
      return NextResponse.json(
        {
          success: false,
          code: "RESEARCH_ORCHESTRATION_FAILED",
          laneId: error.laneId,
          error: "A required research lane failed.",
        },
        { status: 502 },
      );
    }

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
