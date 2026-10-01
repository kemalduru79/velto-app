import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseCreatorProfile } from "@/lib/creator/creatorProfile";
import { recordOpenAITextEconomics } from "@/lib/economics";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
  MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
  selectEditorialGroundingCandidateSpansForRequest,
  type EditorialGroundingRepairInput,
} from "@/lib/research/editorialGroundingRepair";
import { normalizeEditorialAnalysisRequest } from "@/lib/research/editorialAnalysisRequest";
import { createEditorialScriptContext } from "@/lib/research/editorialScriptContext";
import { canonicalResearchUrl } from "@/lib/research/orchestratedResearch";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "@/lib/research/sourceAssessment";
import { createResearchTopicReadiness } from "@/lib/research/topicEvidenceReadiness";
import { createCreatorEditorialCandidateCapabilityDiagnostics } from "@/lib/research/creatorLongFormEvidenceReadiness";
import { repairCollapsedCanonicalEditorialSelection } from "@/lib/research/editorialCanonicalSelectionRepair";
import {
  RESEARCH_PROPOSITION_KINDS,
  createResearchClaimEvidenceGraph,
  type ResearchClaim,
  type ResearchClaimEvidenceGraph,
} from "@/lib/research/claimEvidenceGraph";
import {
  ClaimPropositionAuthorityDisagreementError,
  reconcileClaimPropositionAuthorities,
} from "@/lib/research/claimPropositionAuthority";
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

function createEditorialRequestRejectionDiagnostic(
  body: unknown,
  error: unknown,
) {
  const rawBody = diagnosticRecord(body);
  const sources = Array.isArray(rawBody?.sources) ? rawBody.sources : [];
  const rawPurposes = diagnosticRecord(rawBody?.sourceResearchPurposes);
  const normalizedSourceIds: string[] = [];
  const canonicalUrls: string[] = [];

  for (const value of sources) {
    const source = diagnosticRecord(value);
    const sourceId = diagnosticText(source?.sourceId, 300);
    const url = diagnosticText(source?.url, 2_000);
    if (sourceId) normalizedSourceIds.push(sourceId);
    const canonicalUrl = canonicalResearchUrl(url);
    if (canonicalUrl) canonicalUrls.push(canonicalUrl);
  }

  const message = error instanceof Error
    ? error.message
    : "Editorial analysis input is invalid.";
  return {
    reasonCode: message.split(":", 1)[0],
    sourceCount: sources.length,
    sourceResearchPurposeKeyCount: rawPurposes
      ? Object.keys(rawPurposes).length
      : 0,
    duplicateCanonicalUrlCount: duplicateValueCount(canonicalUrls),
    duplicateSourceIdCount: duplicateValueCount(normalizedSourceIds),
  };
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
      const errorMessage = error instanceof Error
        ? error.message
        : "Editorial analysis input is invalid.";
      console.warn(
        "CREATOR_EDITORIAL_REQUEST_REJECTED",
        createEditorialRequestRejectionDiagnostic(secured.context.body, error),
      );
      return NextResponse.json(
        {
          success: false,
          code: "EDITORIAL_ANALYSIS_INVALID",
          error: errorMessage,
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
        researchPurposes: normalized.sourceResearchPurposes[source.sourceId] || [],
      };
    });
    const allCandidateSpans = createEditorialGroundingCandidateSpans(normalized.sources);
    const candidateSpans = selectEditorialGroundingCandidateSpansForRequest(
      allCandidateSpans,
      MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
    );
    const eligibleSourceIds = new Set(candidateSpans.map((span) => span.sourceId));
    const systemPrompt = [
      "You are the evidence-aware editorial analyst for CreatorLab, an adult 18+ documentary and creator workflow.",
      "Use only the supplied research material. Never invent facts, evidence, quotes, dates, statistics, source ids, or source text.",
      "Classify every claim using exactly one allowed epistemic claim type.",
      "Independently classify every claim's propositionKind as world_state, attributed_statement, document_assertion, original_research_result, expert_synthesis, editorial_inference, or ambiguous.",
      "propositionKind is claim-origin authority, not an alternate epistemic claim type: attributed_statement identifies a proposition about what a named person or organization said; document_assertion identifies what a specific document states; original_research_result identifies a result attributed to its originating study or work.",
      "For attributed_statement provide attributedEntity. For document_assertion and original_research_result provide referencedWork. Use null for origin fields that do not apply. A world_state must have both origin fields null.",
      "Use ambiguous when the supplied material cannot safely distinguish claim-origin semantics. Never hide ambiguity by choosing world_state.",
      "A metaphysical proposition remains METAPHYSICAL_CLAIM unless the supplied material supports a different explicit classification; do not silently convert belief into fact.",
      "FORECAST, HYPOTHESIS, THEORY, EXPERT_OPINION and EDITORIAL_INFERENCE must retain their uncertainty.",
      "Evidence must select an exact supplied candidate spanId owned by its sourceId. Never write evidence excerpt text.",
      "For FACT, PRIMARY_SOURCE_CLAIM, and RESEARCH_FINDING claims, prefer a claim-relevant candidate marked concrete_observation over an abstract_or_conceptual thesis summary when the supplied source contains one.",
      "Concrete preference means extraction only: never infer or manufacture a researcher, participant, sample, procedure, comparison, number, result, case, or limitation absent from the selected span.",
      "THEORY, EDITORIAL_INFERENCE, METAPHYSICAL_CLAIM, and other legitimately conceptual claims may remain supported by abstract_or_conceptual spans; never force fake empirical structure.",
      "Inspect the supplied candidate spans for material scope conditions, factual or methodological boundaries, alternative explanations, counter-findings, and uncertainty-bearing context. Preserve such material when it exists; never invent it when it does not.",
      "Research purpose describes why a source was retrieved; it does not classify any individual candidate span.",
      "A counter_evidence source purpose means the source was retrieved to test or qualify the baseline explanation; it does not mean any span from that source contradicts or contextualizes a claim.",
      "Inspect spans from counter-purpose sources for genuine opposing findings, alternative explanations, boundaries, limitations, scope qualifications, and uncertainty-bearing context, but choose stance only from what the exact span supports.",
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
          {
            claimId: "claim-1",
            claimType: "FACT",
            text: "atomic claim",
            propositionKind: "world_state",
            origin: { attributedEntity: null, referencedWork: null },
          },
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
        "Every claim must include propositionKind and the complete origin object. claimType remains epistemic/editorial metadata and must not be used as a substitute for propositionKind.",
        "Set contextNote only when the selected source span explicitly supplies a condition, scope, procedure-specific boundary, or limitation; otherwise return null.",
        "Use PRIMARY_SOURCE_CLAIM only as an epistemic/editorial treatment for a claim presented through direct-source authority. Primary-source obligation is derived independently from propositionKind and must not be added or removed by changing claimType.",
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
    console.info("CREATOR_EDITORIAL_CANDIDATE_CAPABILITY_DIAGNOSTICS", JSON.stringify({
      sourceCount: normalized.sources.length,
      candidateDistinctSourceCount: new Set(
        allCandidateSpans.map((span) => span.sourceId),
      ).size,
      eligibleCandidateSourceCount: eligibleSourceIds.size,
      eligibleCandidateSourceIds: [...eligibleSourceIds],
      ...createCreatorEditorialCandidateCapabilityDiagnostics(candidateSpans),
      counterPurposeSourceCount: new Set(sourceMaterial.filter((source) =>
        source.researchPurposes.includes("counter_evidence")
      ).map((source) => source.sourceId)).size,
      candidateFromCounterPurposeSourceCount: candidateSpans.filter((span) =>
        normalized.sourceResearchPurposes[span.sourceId]?.includes("counter_evidence")
      ).length,
    }));
    const editorialGraphSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        claims: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, properties: { claimId: { type: "string" }, claimType: { type: "string", enum: userPrompt.allowedClaimTypes }, text: { type: "string" }, propositionKind: { type: "string", enum: [...RESEARCH_PROPOSITION_KINDS] }, origin: { type: "object", additionalProperties: false, properties: { attributedEntity: { type: ["string", "null"] }, referencedWork: { type: ["string", "null"] } }, required: ["attributedEntity", "referencedWork"] } }, required: ["claimId", "claimType", "text", "propositionKind", "origin"] } },
        evidence: { type: "array", maxItems: 90, items: { type: "object", additionalProperties: false, properties: { evidenceId: { type: "string" }, sourceId: { type: "string", enum: [...eligibleSourceIds].length ? [...eligibleSourceIds] : ["__NO_CANONICAL_SOURCE__"] }, spanId: { type: "string", enum: candidateSpans.length ? candidateSpans.map((span) => span.spanId) : ["__NO_CANONICAL_SPAN__"] }, contextNote: { type: ["string", "null"] } }, required: ["evidenceId", "sourceId", "spanId", "contextNote"] } },
        links: { type: "array", maxItems: 180, items: { type: "object", additionalProperties: false, properties: { claimId: { type: "string" }, evidenceId: { type: "string" }, stance: { type: "string", enum: ["supports", "contradicts", "contextualizes"] } }, required: ["claimId", "evidenceId", "stance"] } },
      },
      required: ["claims", "evidence", "links"],
    };
    const editorialResponseText = {
      format: {
        type: "json_schema" as const,
        name: "creator_editorial_analysis",
        strict: true,
        schema: editorialGraphSchema,
      },
    };
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt) },
      ],
      text: editorialResponseText,
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
    let graph: ResearchClaimEvidenceGraph;
    let groundingRepairAttempted = false;
    const runGroundingRepair = async ({
      diagnosticCategory,
      invalidEvidence,
      candidateSpans: repairCandidateSpans,
      failingSourceId,
    }: EditorialGroundingRepairInput) => {
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
              candidateSpans: repairCandidateSpans,
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
                repairs: { type: "array", minItems: 1, maxItems: invalidEvidence.length, items: { type: "object", additionalProperties: false, properties: { evidenceId: { type: "string", enum: invalidEvidence.map((item) => item.evidenceId) }, spanId: { type: "string", enum: repairCandidateSpans.map((span) => span.spanId) } }, required: ["evidenceId", "spanId"] } },
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
    };
    try {
      graph = await createValidatedEditorialAnalysisWithOneRepair({
        sources: normalized.sources,
        proposal,
        repair: runGroundingRepair,
        requirePropositionAuthority: true,
        allowAmbiguousPropositionAuthority: true,
        provisionalPropositionAuthority: true,
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

    const selectionRepair = await repairCollapsedCanonicalEditorialSelection({
      candidateSpans,
      graph,
      sourceResearchPurposes: normalized.sourceResearchPurposes,
      requestRepair: async ({
        discoveryCandidateSpans,
        missingCapabilities,
        repairTriggerReasons,
      }) => {
        const discoverySourceIds = new Set(
          discoveryCandidateSpans.map((span) => span.sourceId),
        );
        const repairResponse = await client.responses.create({
          model,
          input: [
            {
              role: "system",
              content: [
                systemPrompt,
                "The existing valid base graph is fixed authority. Preserve every base claim, evidence item, and link exactly, including its identifiers, claimType, text, propositionKind, origin, source, context, and stance.",
                "The first pass collapsed to one canonical authority despite grounded discovery candidates from multiple uncovered sources.",
                "Inspect only the supplied discovery candidate spans for materially distinct supported claims, concrete demonstration evidence, material limits or boundaries, contextual evidence, and genuine contradictory or alternative findings that the first pass missed.",
                "The supplied missingCapabilities list identifies long-form roles that the valid base graph cannot currently serve; it is permission to inspect, not evidence that qualifying authority exists.",
                "When uncertainty is listed in missingCapabilities, resolving that capability is the primary repair objective; generic supporting diversity is secondary.",
                "A FACT, PRIMARY_SOURCE_CLAIM, or RESEARCH_FINDING connected only by supports does not resolve uncertainty merely because it offers a different perspective.",
                "When an exact supplied span materially narrows, qualifies, scopes, or limits an existing factual claim, add the grounded evidence and link it directly to that existing claim with contextualizes. A new claim is not required for a genuine qualification.",
                "Alternatively, an exact supplied span may support a legitimately uncertainty-bearing claim type under the existing claim taxonomy.",
                "Do not mark ordinary support as contextualizes and do not declare a capability resolved unless the returned graph structurally resolves it.",
                "Capability resolution must reference the exact claimId/evidenceId pair of an actual returned link; never point a resolution at evidence linked to a different claim.",
                "For demonstration, resolved is valid only when that exact link has stance supports, the claim type is FACT, PRIMARY_SOURCE_CLAIM, or RESEARCH_FINDING, and the selected evidence span is a concrete observation. EXPERT_OPINION does not satisfy demonstration capability.",
                "For uncertainty, resolved is valid only when that exact link is contextualizes, or when stance is supports and the claim type is THEORY, FORECAST, HYPOTHESIS, METAPHYSICAL_CLAIM, or EDITORIAL_INFERENCE. EXPERT_OPINION plus supports does not satisfy uncertainty capability.",
                "When demonstration is missing, look for an exact supplied concrete empirical observation, procedure, case, or result linked to a FACT, PRIMARY_SOURCE_CLAIM, or RESEARCH_FINDING.",
                "When uncertainty is missing, look for exact supplied scope limits, boundary conditions, alternative explanations, qualifications, opposing findings, or uncertainty-bearing context.",
                "You are performing a targeted completion analysis. You MUST choose exactly one repairOutcome: additions_found or no_qualifying_addition.",
                "Return exactly one capabilityResolutions item for every requested missingCapabilities item and no others. Use resolved with the exact claimId/evidenceId only when the graph structurally supplies that capability; otherwise use not_found with null ids.",
                "Use additions_found only when exact supplied spans support one or more materially distinct additional authorities needed by the requested capabilities. Then return the complete canonicalGraph containing the unchanged base graph plus all valid additions.",
                "Use no_qualifying_addition only after inspecting the supplied discovery spans and concluding that none supports a valid additional authority for the requested capabilities. Then return the unchanged base graph as canonicalGraph.",
                "Do not return the unchanged base graph under additions_found. Do not add filler merely to avoid no_qualifying_addition.",
                "Preserve exact sourceId/spanId selections and the semantic distinction between supports, contextualizes, and contradicts.",
                "Prefer supplied concrete procedure, result, or case evidence and supplied real limitations when relevant.",
                "Research purpose describes why the SOURCE was retrieved. It does not classify any individual span.",
                "Inspect spans from counter-purpose sources for genuine limits, boundaries, alternative explanations, qualifications, or opposing findings.",
                "For every discovery span, select supports, contextualizes, or contradicts only according to the exact grounded text; source provenance never establishes stance.",
                "Do not replace or drop the base graph. Do not create quota filler, redundant paraphrased claims, token counterarguments, unsupported uncertainty, invented study metadata, or invented source facts.",
                "Return only the repairOutcome and canonicalGraph wrapper required by the strict response schema.",
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify({
                topic: userPrompt.topic,
                allowedClaimTypes: userPrompt.allowedClaimTypes,
                editorialConstitution: userPrompt.editorialConstitution,
                existingValidBaseGraph: {
                  claims: graph.claims,
                  evidence: graph.evidence.map((item) => ({
                    evidenceId: item.evidenceId,
                    sourceId: item.sourceId,
                    spanId: candidateSpans.find((span) =>
                      span.sourceId === item.sourceId && span.text === item.excerpt
                    )?.spanId,
                    contextNote: item.contextNote,
                  })),
                  links: graph.links,
                },
                discoverySources: sourceMaterial.filter((source) =>
                  discoverySourceIds.has(source.sourceId)
                ),
                discoveryCandidateSpans,
                missingCapabilities,
                repairTriggerReasons,
                requiredJsonShape: {
                  repairOutcome: "additions_found | no_qualifying_addition",
                  capabilityResolutions: [{
                    capability: "demonstration | uncertainty",
                    outcome: "resolved | not_found",
                    claimId: "resolved claim id or null",
                    evidenceId: "resolved evidence id or null",
                  }],
                  canonicalGraph: userPrompt.requiredJsonShape,
                },
                rules: userPrompt.rules,
              }),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "creator_editorial_canonical_selection_repair",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  repairOutcome: {
                    type: "string",
                    enum: ["additions_found", "no_qualifying_addition"],
                  },
                  capabilityResolutions: {
                    type: "array",
                    maxItems: 2,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        capability: {
                          type: "string",
                          enum: ["demonstration", "uncertainty"],
                        },
                        outcome: {
                          type: "string",
                          enum: ["resolved", "not_found"],
                        },
                        claimId: { type: ["string", "null"] },
                        evidenceId: { type: ["string", "null"] },
                      },
                      required: ["capability", "outcome", "claimId", "evidenceId"],
                    },
                  },
                  canonicalGraph: editorialGraphSchema,
                },
                required: ["repairOutcome", "capabilityResolutions", "canonicalGraph"],
              },
            },
          },
          temperature: 0.1,
        });
        await recordOpenAITextEconomics({
          route: "/api/creator-editorial-analysis",
          operationType: "creator_editorial_canonical_selection_repair",
          model,
          response: repairResponse,
          userId: secured.context.user.id,
        });
        return parseModelJson(repairResponse.output_text || "");
      },
      validateRepair: async (repairProposal) => createValidatedEditorialAnalysisWithOneRepair({
        sources: normalized.sources,
        proposal: repairProposal as Parameters<typeof createValidatedEditorialAnalysisWithOneRepair>[0]["proposal"],
        repair: runGroundingRepair,
        requirePropositionAuthority: true,
        allowAmbiguousPropositionAuthority: true,
        provisionalPropositionAuthority: true,
      }),
    });
    graph = selectionRepair.graph;
    console.info(
      "CREATOR_EDITORIAL_CANONICAL_SELECTION_REPAIR",
      JSON.stringify(selectionRepair.diagnostic),
    );

    try {
      const claimIds = graph.claims.map((claim) => claim.claimId);
      if (
        claimIds.length === 0 ||
        new Set(claimIds).size !== claimIds.length
      ) {
        throw new Error("EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID");
      }
      const adjudicationResponse = await client.responses.create({
        model,
        input: [
          {
            role: "system",
            content: [
              "Adjudicate only the proposition-origin classification of each supplied canonical claim using its exact text, selected evidence, source metadata, and links.",
              "Return exactly one item for every supplied claimId and no other claimId.",
              "Do not rewrite, reinterpret, add, or remove claim ids, claim text, claimType, evidence, links, sources, or stance.",
              "Use attributed_statement only for a proposition about what a named person or organization said; include attributedEntity.",
              "Use document_assertion only for a proposition about what a specific document states; include referencedWork.",
              "Use original_research_result only for a result attributed to its originating study or work; include referencedWork.",
              "Use world_state only for a proposition that does not depend on attribution to a speaker, document, or originating research work; both origin fields must be null.",
              "Use expert_synthesis or editorial_inference only when those are the proposition's actual origin semantics.",
              "Use ambiguous instead of silently choosing world_state when the supplied authority does not safely determine the origin semantics.",
              "Return strict JSON only.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              claims: graph.claims,
              evidence: graph.evidence,
              links: graph.links,
              sources: sourceMaterial.filter((source) => eligibleSourceIds.has(source.sourceId)),
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "creator_editorial_claim_origin_adjudication",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                claims: {
                  type: "array",
                  minItems: claimIds.length,
                  maxItems: claimIds.length,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      claimId: { type: "string", enum: claimIds },
                      propositionKind: {
                        type: "string",
                        enum: [...RESEARCH_PROPOSITION_KINDS],
                      },
                      origin: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          attributedEntity: { type: ["string", "null"] },
                          referencedWork: { type: ["string", "null"] },
                        },
                        required: ["attributedEntity", "referencedWork"],
                      },
                    },
                    required: ["claimId", "propositionKind", "origin"],
                  },
                },
              },
              required: ["claims"],
            },
          },
        },
        temperature: 0,
      });
      await recordOpenAITextEconomics({
        route: "/api/creator-editorial-analysis",
        operationType: "creator_editorial_claim_origin_adjudication",
        model,
        response: adjudicationResponse,
        userId: secured.context.user.id,
      });
      const reconciledClaims = reconcileClaimPropositionAuthorities({
        initialClaims: graph.claims,
        adjudication: parseModelJson(adjudicationResponse.output_text || ""),
      }) as ResearchClaim[];
      graph = createResearchClaimEvidenceGraph({
        sources: graph.sources,
        claims: reconciledClaims,
        evidence: graph.evidence,
        links: graph.links,
      });
    } catch (error) {
      const diagnostic = error instanceof Error
        ? error.message
        : "EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID";
      const ambiguous = diagnostic.startsWith("EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS");
      if (error instanceof ClaimPropositionAuthorityDisagreementError) {
        console.error(
          "CREATOR_EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT",
          error.disagreement,
        );
      }
      console.error("CREATOR_EDITORIAL_CLAIM_ORIGIN_FAILED", {
        category: ambiguous ? "ambiguous" : "invalid",
        diagnostic,
      });
      return NextResponse.json(
        {
          success: false,
          code: ambiguous
            ? "EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS"
            : "EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID",
          error: ambiguous
            ? "Claim origin could not be resolved safely. Please retry."
            : "Claim origin validation could not be completed. Please retry.",
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
