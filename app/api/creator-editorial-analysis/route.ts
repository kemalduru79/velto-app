import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseCreatorProfile } from "@/lib/creator/creatorProfile";
import { recordOpenAITextEconomics } from "@/lib/economics";
import { createValidatedEditorialAnalysis } from "@/lib/research/editorialAnalysisContract";
import { normalizeEditorialAnalysisRequest } from "@/lib/research/editorialAnalysisRequest";
import { createEditorialScriptContext } from "@/lib/research/editorialScriptContext";
import { assessResearchSource } from "@/lib/research/sourceAssessment";
import { createResearchTopicReadiness } from "@/lib/research/topicEvidenceReadiness";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned;
}

function parseModelJson(raw: string) {
  const extracted = extractJsonObject(raw);
  try {
    return JSON.parse(extracted) as Record<string, unknown>;
  } catch {
    const repaired = extracted
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired) as Record<string, unknown>;
  }
}

function directnessForSource(adapterId: string) {
  if (adapterId === "primary") return "primary" as const;
  if (adapterId === "web" || adapterId === "news" || adapterId === "academic") {
    return "secondary" as const;
  }
  return "unknown" as const;
}

export async function POST(request: Request) {
  try {
    const secured = await enforceCreatorApiBoundary<Record<string, unknown>>(
      request,
      "creator-editorial-analysis",
    );
    if (!secured.ok) return secured.response;

    let normalized;
    try {
      normalized = normalizeEditorialAnalysisRequest(secured.context.body);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_ANALYSIS_INVALID",
          error: error instanceof Error ? error.message : "Editorial analysis input is invalid.",
        },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_ANALYSIS_NOT_CONFIGURED",
          error: "Editorial analysis is not configured.",
        },
        { status: 503 },
      );
    }

    const profile = parseCreatorProfile(normalized.creatorProfile);
    const sourceMaterial = normalized.sources.map((source) => ({
      sourceId: source.sourceId,
      sourceType: source.adapterId,
      title: source.title,
      publisher: source.publisher,
      publishedAt: source.publishedAt,
      summary: source.summary,
    }));
    const systemPrompt = [
      "You are the evidence-aware editorial analyst for CreatorLab, an adult 18+ documentary and creator workflow.",
      "Use only the supplied research material. Never invent facts, evidence, quotes, dates, statistics, source ids, or source text.",
      "Classify every claim using exactly one allowed epistemic claim type.",
      "A metaphysical proposition remains METAPHYSICAL_CLAIM unless the supplied material supports a different explicit classification; do not silently convert belief into fact.",
      "FORECAST, HYPOTHESIS, THEORY, EXPERT_OPINION and EDITORIAL_INFERENCE must retain their uncertainty.",
      "Evidence excerpts must be exact contiguous text copied from the cited source summary. Do not paraphrase inside the excerpt field.",
      "If a source has no usable summary text, do not create evidence from that source.",
      "Use contradicts only for material counter-evidence or alternative findings, not for rhetorical disagreement.",
      "Return strict JSON only with no markdown or commentary.",
    ].join(" ");
    const userPrompt = {
      topic: normalized.topic,
      allowedClaimTypes: [
        "FACT",
        "PRIMARY_SOURCE_CLAIM",
        "RESEARCH_FINDING",
        "EXPERT_OPINION",
        "THEORY",
        "FORECAST",
        "HYPOTHESIS",
        "METAPHYSICAL_CLAIM",
        "EDITORIAL_INFERENCE",
        "THOUGHT_EXPERIMENT",
      ],
      editorialConstitution: profile.editorialConstitution,
      sources: sourceMaterial,
      requiredJsonShape: {
        claims: [
          { claimId: "claim-1", claimType: "FACT", text: "atomic claim" },
        ],
        evidence: [
          {
            evidenceId: "evidence-1",
            sourceId: "exact supplied sourceId",
            excerpt: "exact contiguous text copied from that source summary",
            contextNote: "brief context or limitation",
          },
        ],
        links: [
          { claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" },
        ],
      },
      rules: [
        "Prefer atomic claims that can be independently supported or reviewed.",
        "Do not create more than 30 claims.",
        "Do not create evidence without a real supplied sourceId and grounded excerpt.",
        "Include material counter-evidence when the supplied sources contain it.",
        "Do not use certainty language to upgrade a forecast, theory, hypothesis, opinion, inference, or metaphysical claim.",
      ],
    };

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt) },
      ],
      temperature: 0.2,
    });
    await recordOpenAITextEconomics({
      route: "/api/creator-editorial-analysis",
      operationType: "creator_editorial_analysis",
      model,
      response,
      userId: secured.context.user.id,
    });

    const proposal = parseModelJson(response.output_text || "");
    let graph;
    try {
      graph = createValidatedEditorialAnalysis({
        sources: normalized.sources,
        proposal,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_ANALYSIS_GROUNDING_FAILED",
          error: error instanceof Error ? error.message : "Editorial analysis grounding failed.",
        },
        { status: 422 },
      );
    }

    const sourceAssessments = graph.sources.map((source) =>
      assessResearchSource(source, directnessForSource(source.adapterId)),
    );
    const readiness = createResearchTopicReadiness({ graph, sourceAssessments });
    const scriptContext = createEditorialScriptContext({
      profile,
      graph,
      sourceAssessments,
    });

    return NextResponse.json({
      success: true,
      graph,
      sourceAssessments,
      readiness,
      scriptContext,
    });
  } catch (error) {
    console.error("CREATOR_EDITORIAL_ANALYSIS_FAILED", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        success: false,
        code: "EDITORIAL_ANALYSIS_FAILED",
        error: "Editorial analysis could not be completed.",
      },
      { status: 500 },
    );
  }
}
