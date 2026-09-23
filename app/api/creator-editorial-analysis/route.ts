import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseCreatorProfile } from "@/lib/creator/creatorProfile";
import { recordOpenAITextEconomics } from "@/lib/economics";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
  MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
} from "@/lib/research/editorialGroundingRepair";
import { normalizeEditorialAnalysisRequest } from "@/lib/research/editorialAnalysisRequest";
import { createEditorialScriptContext } from "@/lib/research/editorialScriptContext";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "@/lib/research/sourceAssessment";
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
    const sourceMaterial = normalized.sources.map((source) => {
      const classification = classifyResearchSourceDirectness(source);
      return {
        sourceId: source.sourceId,
        searchLane: source.adapterId,
        sourceKind: source.mediaKind,
        directness: classification.directness,
        classificationReason: classification.reason,
        title: source.title,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        summary: source.summary,
      };
    });
    const candidateSpans = createEditorialGroundingCandidateSpans(normalized.sources)
      .slice(0, MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST);
    const eligibleSourceIds = new Set(candidateSpans.map((span) => span.sourceId));
    const systemPrompt = [
      "You are the evidence-aware editorial analyst for CreatorLab, an adult 18+ documentary and creator workflow.",
      "Use only the supplied research material. Never invent facts, evidence, quotes, dates, statistics, source ids, or source text.",
      "Classify every claim using exactly one allowed epistemic claim type.",
      "A metaphysical proposition remains METAPHYSICAL_CLAIM unless the supplied material supports a different explicit classification; do not silently convert belief into fact.",
      "FORECAST, HYPOTHESIS, THEORY, EXPERT_OPINION and EDITORIAL_INFERENCE must retain their uncertainty.",
      "Evidence must select an exact supplied candidate spanId owned by its sourceId. Never write evidence excerpt text.",
      "For FACT, PRIMARY_SOURCE_CLAIM, and RESEARCH_FINDING claims, prefer a claim-relevant candidate marked concrete_observation over an abstract_or_conceptual thesis summary when the supplied source contains one.",
      "Concrete preference means extraction only: never infer or manufacture a researcher, participant, sample, procedure, comparison, number, result, case, or limitation absent from the selected span.",
      "THEORY, EDITORIAL_INFERENCE, METAPHYSICAL_CLAIM, and other legitimately conceptual claims may remain supported by abstract_or_conceptual spans; never force fake empirical structure.",
      "Inspect the supplied candidate spans for material scope conditions, factual or methodological boundaries, alternative explanations, counter-findings, and uncertainty-bearing context. Preserve such material when it exists; never invent it when it does not.",
      "If a source has no supplied candidate span, do not create evidence from that source.",
      "Use supports only when evidence directly supports a claim. Use contextualizes only when evidence materially narrows, conditions, qualifies, scopes, or supplies a relevant boundary without contradicting the core claim. Use contradicts only when evidence materially conflicts with a claim, supplies a genuine alternative finding, or supports an opposing proposition.",
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
      sources: sourceMaterial.filter((source) => eligibleSourceIds.has(source.sourceId)),
      candidateSpans,
      requiredJsonShape: {
        claims: [
          { claimId: "claim-1", claimType: "FACT", text: "atomic claim" },
        ],
        evidence: [
          {
            evidenceId: "evidence-1",
            sourceId: "exact supplied sourceId",
            spanId: "exact supplied spanId owned by sourceId",
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
        "Do not create evidence without an exact supplied sourceId and its exact candidate spanId.",
        "Keep claim text concise and distinct from evidence: the claim states the proposition, while the selected evidence span should preserve the strongest available grounded observation, procedure, comparison, case, or result that supports it.",
        "Set contextNote only when the selected source span explicitly supplies a condition, scope, procedure-specific boundary, or limitation; otherwise return null.",
        "Use PRIMARY_SOURCE_CLAIM for a claim where original or first-party evidence is preferred or required for full evidence readiness; secondary traceable evidence may support it while leaving primary-source coverage for human review.",
        "When primary sources are available for distinct claims, prefer coverage across those claims instead of repeatedly supporting only one claim.",
        "A primary searchLane is retrieval intent only; it does not override the supplied directness classification.",
        "Include material counter-evidence when the supplied sources contain it.",
        "When an exact supplied span materially limits, qualifies, contextualizes, or contradicts a FACT or RESEARCH_FINDING, preserve that span through a contextualizes or contradicts link as appropriate; the claim may retain its existing epistemic type.",
        "Do not use contextualizes as a generic secondary-support bucket, relabel ordinary support as uncertainty, create token counterarguments for balance, or create a claim or evidence object merely to satisfy a coverage quota.",
        "If no supplied candidate span contains a material limitation, boundary, alternative explanation, counter-finding, or uncertainty-bearing context, return no invented contextual or contradictory authority.",
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
      text: {
        format: {
          type: "json_schema",
          name: "creator_editorial_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              claims: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, properties: { claimId: { type: "string" }, claimType: { type: "string", enum: userPrompt.allowedClaimTypes }, text: { type: "string" } }, required: ["claimId", "claimType", "text"] } },
              evidence: { type: "array", maxItems: 90, items: { type: "object", additionalProperties: false, properties: { evidenceId: { type: "string" }, sourceId: { type: "string", enum: [...eligibleSourceIds].length ? [...eligibleSourceIds] : ["__NO_CANONICAL_SOURCE__"] }, spanId: { type: "string", enum: candidateSpans.length ? candidateSpans.map((span) => span.spanId) : ["__NO_CANONICAL_SPAN__"] }, contextNote: { type: ["string", "null"] } }, required: ["evidenceId", "sourceId", "spanId", "contextNote"] } },
              links: { type: "array", maxItems: 180, items: { type: "object", additionalProperties: false, properties: { claimId: { type: "string" }, evidenceId: { type: "string" }, stance: { type: "string", enum: ["supports", "contradicts", "contextualizes"] } }, required: ["claimId", "evidenceId", "stance"] } },
            },
            required: ["claims", "evidence", "links"],
          },
        },
      },
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
    let groundingRepairAttempted = false;
    try {
      graph = await createValidatedEditorialAnalysisWithOneRepair({
        sources: normalized.sources,
        proposal,
        repair: async ({
          diagnosticCategory,
          invalidEvidence,
          candidateSpans,
          failingSourceId,
        }) => {
          groundingRepairAttempted = true;
          const repairResponse = await client.responses.create({
            model,
            input: [
              {
                role: "system",
                content: [
                  "Select only canonical grounding spans for the supplied invalid evidence.",
                  "Use only the supplied candidate spans and evidence context. Do not add research or source material.",
                  "Each repair must contain exactly evidenceId and spanId.",
                  "Never write or return excerpt text. Select the span that actually supports the intended evidence or claim.",
                  "Include all grounding-invalid evidence you can identify in this one response.",
                  "Do not return source ids, claims, links, context notes, or proposal structures.",
                  'Return strict JSON only in the shape {"repairs":[{"evidenceId":"...","spanId":"..."}]}.',
                ].join(" "),
              },
              {
                role: "user",
                content: JSON.stringify({
                  diagnosticCategory,
                  failingSourceId,
                  invalidEvidence,
                  candidateSpans,
                }),
              },
            ],
            text: {
              format: {
                type: "json_schema",
                name: "creator_editorial_grounding_repair",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    repairs: { type: "array", minItems: 1, maxItems: invalidEvidence.length, items: { type: "object", additionalProperties: false, properties: { evidenceId: { type: "string", enum: invalidEvidence.map((item) => item.evidenceId) }, spanId: { type: "string", enum: candidateSpans.map((span) => span.spanId) } }, required: ["evidenceId", "spanId"] } },
                  },
                  required: ["repairs"],
                },
              },
            },
            temperature: 0,
          });
          await recordOpenAITextEconomics({
            route: "/api/creator-editorial-analysis",
            operationType: "creator_editorial_grounding_repair",
            model,
            response: repairResponse,
            userId: secured.context.user.id,
          });
          return parseModelJson(repairResponse.output_text || "");
        },
      });
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "Editorial analysis grounding failed.";
      console.error("CREATOR_EDITORIAL_GROUNDING_FAILED", {
        diagnostic,
        repairAttempted: groundingRepairAttempted,
        invalidEvidenceType: diagnostic.split(":", 1)[0],
      });
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_ANALYSIS_GROUNDING_FAILED",
          error: "Evidence validation could not be completed. Please retry.",
          detailCode: diagnostic,
        },
        { status: 422 },
      );
    }

    const sourceAssessments = graph.sources.map((source) =>
      assessResearchSource(
        source,
        classifyResearchSourceDirectness(source).directness,
      ),
    );
    const readiness = createResearchTopicReadiness({ graph, sourceAssessments });
    const assessmentBySourceId = new Map(
      sourceAssessments.map((assessment) => [assessment.sourceId, assessment]),
    );
    const primaryEvidenceCount = graph.evidence.filter((evidence) =>
      assessmentBySourceId.get(evidence.sourceId)?.directness === "primary"
    ).length;
    const primaryCoveredClaimIdSet = new Set(readiness.primarySourceCoveredClaimIds);
    console.info("CREATOR_EDITORIAL_PRIMARY_SOURCE_COVERAGE", {
      evidenceCount: graph.evidence.length,
      primaryEvidenceCount,
      nonPrimaryEvidenceCount: graph.evidence.length - primaryEvidenceCount,
      primaryCoverageRatio: readiness.primarySourceRequiredClaimIds.length === 0
        ? 1
        : readiness.primarySourceCoveredClaimIds.length /
          readiness.primarySourceRequiredClaimIds.length,
      primaryRequiredClaimIds: readiness.primarySourceRequiredClaimIds,
      primaryCoveredClaimIds: readiness.primarySourceCoveredClaimIds,
      primaryMissingClaimIds: readiness.primarySourceRequiredClaimIds.filter(
        (claimId) => !primaryCoveredClaimIdSet.has(claimId),
      ),
      sourceClassifications: graph.sources.map((source) => ({
        sourceId: source.sourceId,
        searchLane: source.adapterId,
        sourceKind: source.mediaKind,
        directness: classifyResearchSourceDirectness(source).directness,
        classificationReason: classifyResearchSourceDirectness(source).reason,
      })),
      threshold: "all_primary_source_claims_require_primary_support",
      result: readiness.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED")
        ? "review_required"
        : "satisfied",
    });
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
      groundingRepairAttempted,
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
