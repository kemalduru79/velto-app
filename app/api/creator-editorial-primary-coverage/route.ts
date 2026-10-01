import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseCreatorProfile } from "@/lib/creator/creatorProfile";
import { recordOpenAITextEconomics } from "@/lib/economics";
import {
  applyEditorialPrimaryCoverageRepair,
  createEditorialPrimaryCoverageRepairContext,
  type EditorialPrimaryCoverageRepairContext,
} from "@/lib/research/editorialPrimaryCoverageRepair";
import { createEditorialScriptContext } from "@/lib/research/editorialScriptContext";
import { canonicalResearchUrl } from "@/lib/research/orchestratedResearch";
import { classifyResearchSourceDirectness } from "@/lib/research/sourceAssessment";
import type { ResearchSource } from "@/lib/research/sourceContract";
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

function diagnosticRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function diagnosticText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function duplicateValueCount(values: string[]) {
  return values.length - new Set(values).size;
}

function createPrimaryCoverageRejectionDiagnostic(
  body: unknown,
  error: unknown,
) {
  const requestBody = diagnosticRecord(body);
  const frozenGraph = diagnosticRecord(requestBody?.frozenGraph);
  const frozenClaims = Array.isArray(frozenGraph?.claims)
    ? frozenGraph.claims
    : [];
  const originalRequiredClaimIds = Array.isArray(
    requestBody?.originalPrimaryRequiredClaimIds,
  )
    ? requestBody.originalPrimaryRequiredClaimIds
    : [];
  const candidateSources = Array.isArray(requestBody?.candidateSources)
    ? requestBody.candidateSources
    : [];
  const normalizedSourceIds: string[] = [];
  const canonicalUrls: string[] = [];
  let verifiedPrimaryCandidateSourceCount = 0;

  for (const value of candidateSources) {
    const source = diagnosticRecord(value);
    if (!source) continue;
    const sourceId = diagnosticText(source.sourceId, 300);
    if (sourceId) normalizedSourceIds.push(sourceId);
    const canonicalUrl = canonicalResearchUrl(
      diagnosticText(source.url, 2_000),
    );
    if (canonicalUrl) canonicalUrls.push(canonicalUrl);
    const candidate = {
      ...source,
      sourceMetadata: diagnosticRecord(source.sourceMetadata) || {},
    } as unknown as ResearchSource;
    if (classifyResearchSourceDirectness(candidate).directness === "primary") {
      verifiedPrimaryCandidateSourceCount += 1;
    }
  }

  const diagnostic = error instanceof Error
    ? error.message
    : "EDITORIAL_PRIMARY_COVERAGE_REQUEST_INVALID";
  const reasonCode = diagnostic.split(":", 1)[0].slice(0, 160);
  return {
    reasonCode,
    frozenClaimCount: frozenClaims.length,
    originalRequiredClaimCount: originalRequiredClaimIds.length,
    candidateSourceCount: candidateSources.length,
    verifiedPrimaryCandidateSourceCount,
    candidateSpanCount: null,
    duplicateSourceIdCount: duplicateValueCount(normalizedSourceIds),
    duplicateCanonicalUrlCount: duplicateValueCount(canonicalUrls),
    recomputedRequiredClaimCount: null,
    requiredIdsMatch: reasonCode ===
        "EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_MISMATCH"
      ? false
      : null,
  };
}

function repairDiagnostic(input: {
  context: EditorialPrimaryCoverageRepairContext;
  repairedClaimIds: string[];
  unresolvedClaimIds: string[];
  finalPrimaryCoveredCount: number;
  result: "satisfied" | "unresolved" | "invalid";
}) {
  return {
    targetClaimIds: input.context.targetClaimIds,
    candidatePrimarySourceCount: input.context.candidatePrimarySources.length,
    candidateSpanCount: input.context.candidateSpans.length,
    repairedClaimIds: input.repairedClaimIds,
    unresolvedClaimIds: input.unresolvedClaimIds,
    initialPrimaryRequiredCount:
      input.context.originalPrimaryRequiredClaimIds.length,
    finalPrimaryCoveredCount: input.finalPrimaryCoveredCount,
    result: input.result,
  };
}

export async function POST(request: Request) {
  try {
    const secured = await enforceCreatorApiBoundary<Record<string, unknown>>(
      request,
      "creator-editorial-analysis",
    );
    if (!secured.ok) return secured.response;

    let context: EditorialPrimaryCoverageRepairContext;
    try {
      context = createEditorialPrimaryCoverageRepairContext(
        secured.context.body,
      );
    } catch (error) {
      const diagnostic = error instanceof Error
        ? error.message
        : "EDITORIAL_PRIMARY_COVERAGE_REQUEST_INVALID";
      console.warn(
        "CREATOR_EDITORIAL_PRIMARY_COVERAGE_REJECTED",
        createPrimaryCoverageRejectionDiagnostic(
          secured.context.body,
          error,
        ),
      );
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_PRIMARY_COVERAGE_INVALID",
          error: "Primary-source coverage input is invalid.",
          detailCode: diagnostic,
        },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_PRIMARY_COVERAGE_NOT_CONFIGURED",
          error: "Primary-source coverage repair is not configured.",
        },
        { status: 503 },
      );
    }

    const claimById = new Map(
      context.frozenGraph.claims.map((claim) => [claim.claimId, claim]),
    );
    const sourceById = new Map(
      context.candidatePrimarySources.map((source) => [source.sourceId, source]),
    );
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            "Select exact canonical evidence spans that directly support the supplied allowlisted claims.",
            "This is evidence-only primary-source coverage repair over a frozen canonical claim graph.",
            "Do not create, rewrite, reinterpret, add, or remove claims, claim types, proposition kinds, origins, sources, evidence prose, or links.",
            "Every selected span must directly support its target claim, not merely discuss a related topic.",
            "Use only the supplied claimId and spanId values. Do not infer source authority from query wording or acquisition lane.",
            "If no supplied span directly supports a target claim, omit that target rather than selecting irrelevant evidence.",
            "Return strict JSON only with exactly the repairs array. Each item contains exactly claimId and spanId.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            targetClaims: context.targetClaimIds.map((claimId) => {
              const claim = claimById.get(claimId)!;
              return {
                claimId: claim.claimId,
                claimType: claim.claimType,
                text: claim.text,
                propositionKind: claim.propositionKind,
                origin: claim.origin,
              };
            }),
            primarySources: context.candidatePrimarySources.map((source) => ({
              sourceId: source.sourceId,
              title: source.title,
              publisher: source.publisher,
              author: source.author,
              publishedAt: source.publishedAt,
              sourceKind: source.mediaKind,
              directness: classifyResearchSourceDirectness(source).directness,
            })),
            candidateSpans: context.candidateSpans.map((span) => ({
              spanId: span.spanId,
              sourceId: span.sourceId,
              text: span.text,
              evidenceSpecificity: span.evidenceSpecificity,
              sourceTitle: sourceById.get(span.sourceId)?.title || "",
            })),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "creator_editorial_primary_coverage_repair",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              repairs: {
                type: "array",
                minItems: 0,
                maxItems: context.targetClaimIds.length,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    claimId: {
                      type: "string",
                      enum: context.targetClaimIds,
                    },
                    spanId: {
                      type: "string",
                      enum: context.candidateSpans.map((span) => span.spanId),
                    },
                  },
                  required: ["claimId", "spanId"],
                },
              },
            },
            required: ["repairs"],
          },
        },
      },
      temperature: 0,
    });
    await recordOpenAITextEconomics({
      route: "/api/creator-editorial-primary-coverage",
      operationType: "creator_editorial_primary_coverage_repair",
      model,
      response,
      userId: secured.context.user.id,
    });

    try {
      const result = applyEditorialPrimaryCoverageRepair({
        context,
        selection: parseModelJson(response.output_text || ""),
      });
      const scriptContext = createEditorialScriptContext({
        profile: parseCreatorProfile(context.creatorProfile),
        graph: result.graph,
        sourceAssessments: result.sourceAssessments,
      });
      console.info(
        "CREATOR_EDITORIAL_PRIMARY_COVERAGE_REPAIR",
        repairDiagnostic({
          context,
          repairedClaimIds: result.repairedClaimIds,
          unresolvedClaimIds: result.unresolvedClaimIds,
          finalPrimaryCoveredCount:
            result.readiness.primarySourceCoveredClaimIds.length,
          result: "satisfied",
        }),
      );
      return NextResponse.json({
        success: true,
        graph: result.graph,
        sourceAssessments: result.sourceAssessments,
        readiness: result.readiness,
        scriptContext,
      });
    } catch (error) {
      const diagnostic = error instanceof Error
        ? error.message
        : "EDITORIAL_PRIMARY_COVERAGE_REPAIR_INVALID";
      const unresolvedClaimIds = diagnostic.startsWith(
        "EDITORIAL_PRIMARY_COVERAGE_UNRESOLVED:",
      )
        ? diagnostic.slice(
            "EDITORIAL_PRIMARY_COVERAGE_UNRESOLVED:".length,
          ).split(",").filter(Boolean)
        : context.targetClaimIds;
      console.warn(
        "CREATOR_EDITORIAL_PRIMARY_COVERAGE_REPAIR",
        repairDiagnostic({
          context,
          repairedClaimIds: [],
          unresolvedClaimIds,
          finalPrimaryCoveredCount:
            context.initialReadiness.primarySourceCoveredClaimIds.length,
          result: diagnostic.startsWith(
            "EDITORIAL_PRIMARY_COVERAGE_UNRESOLVED:",
          ) ? "unresolved" : "invalid",
        }),
      );
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_PRIMARY_COVERAGE_UNRESOLVED",
          error: "Required primary-source evidence could not be verified.",
          detailCode: diagnostic,
        },
        { status: 422 },
      );
    }
  } catch (error) {
    console.error("CREATOR_EDITORIAL_PRIMARY_COVERAGE_FAILED", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        success: false,
        code: "EDITORIAL_PRIMARY_COVERAGE_FAILED",
        error: "Primary-source coverage repair could not be completed.",
      },
      { status: 500 },
    );
  }
}
