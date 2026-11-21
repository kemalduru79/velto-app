import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { persistEconomicOperationBestEffort } from "@/lib/economics";
import { normalizeCreatorQualityMode } from "@/lib/creator/mediaRouting";
import { planCreatorProjectProduction } from "@/lib/creator/productionIntelligence";
import { normalizeCreatorProductionIntelligenceScenes } from "@/lib/creator/productionIntelligenceRequest";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

    if (projectId) {
      const project = await getPersistenceServices().projectRepository.getForOwner(
        projectId,
        principal.id,
      );
      if (!project || project.flow_type !== "creator_lab") {
        return NextResponse.json(
          { ok: false, error: "CreatorLab project was not found." },
          { status: 404 },
        );
      }
    }

    const scenes = normalizeCreatorProductionIntelligenceScenes(body.scenes);
    const qualityTier = normalizeCreatorQualityMode(body.qualityTier);
    const decisions = planCreatorProjectProduction(scenes, qualityTier);
    const planIdentity = crypto.randomUUID();

    await Promise.all(
      decisions.map((decision) => persistEconomicOperationBestEffort({
        attemptKey: `production-intelligence:${planIdentity}:${decision.sceneId}`,
        logicalOperationId: `production-intelligence:${planIdentity}`,
        userId: principal.id,
        projectId: projectId || null,
        sceneId: decision.sceneId,
        route: "creator-production-intelligence",
        operationType: "production_intelligence",
        productTier: qualityTier,
        provider: "velto",
        providerTier: "internal",
        model: "deterministic-scene-policy-v1",
        state: "settled",
        billingMoment: "not_billable",
        generated: false,
        quantities: {
          selectedTreatment: decision.selectedTreatment,
          candidateScores: JSON.stringify(decision.scores),
          reasonCodes: decision.reasonCodes.join(","),
          overrideSource: decision.overrideState,
          stockSearchPlanned: Boolean(decision.stockIntent),
          assetReused: decision.selectedTreatment === "reuse_existing",
          paidGenerationRequired: decision.expectedPaidGeneration,
          recommendedVideoSeconds: decision.videoIntent?.recommendedSeconds || null,
          fallbackUsed: false,
          finalRealizedTreatment: decision.selectedTreatment,
        },
        cost: {
          costStatus: "not_billable",
          providerCostUsd: 0,
          reason: "Deterministic internal production planning has no provider charge.",
          components: {},
          pricingVersion: "production-intelligence-v1",
          pricingAsOf: "2026-08-22",
          currency: "USD",
        },
        completedAt: new Date().toISOString(),
      })),
    );

    return NextResponse.json({ ok: true, planIdentity, decisions });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "A valid session is required." },
        { status: 401 },
      );
    }
    console.error("CREATOR_PRODUCTION_INTELLIGENCE_FAILED", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Production planning is temporarily unavailable." },
      { status: 503 },
    );
  }
}
