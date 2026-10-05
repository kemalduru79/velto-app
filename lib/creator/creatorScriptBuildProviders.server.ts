import {
  CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT,
  CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT,
  CREATOR_SCRIPT_FIRST_PASS_BUDGET_CONTRACT,
  CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT,
  createCreatorScriptNarrationControlPlan,
} from "./creatorScript.ts";
import type { CreatorScriptBuildJson } from "./creatorScriptBuild.ts";
import type { CreatorScriptBuildEditorialRecoveryContext } from "./creatorScriptBuildEditorialAdjudicationRecovery.ts";
import { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION } from "./creatorScriptBuildRepairProviderPolicy.ts";
import { createHash } from "node:crypto";
import OpenAI from "openai";

import {
  recordOpenAITextEconomics,
  persistEconomicOperationBestEffort,
  type EconomicCostResult,
} from "../economics/index.ts";
import { ExaResearchSearchProvider } from "../providers/research/exa.server.ts";
import type { ResearchSource } from "../research/sourceContract.ts";
import {
  canonicalResearchUrl,
  executeResearchOrchestration,
  type OrchestratedResearchResult,
} from "../research/orchestratedResearch.ts";
import { createResearchOrchestrationPlan } from "../research/researchOrchestration.ts";
import {
  RESEARCH_CLAIM_TYPES,
  RESEARCH_PROPOSITION_KINDS,
} from "../research/claimEvidenceGraph.ts";
import {
  CreatorScriptBuildStageExecutionError,
  type CreatorScriptBuildResearchExecutionInput,
  type CreatorScriptBuildEditorialExecutionInput,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  parseCreatorScriptBuildModelJson,
  recoverCreatorScriptBuildEditorialAdjudication,
} from "./creatorScriptBuildProviderContract.ts";
import type {
  CreatorScriptBuildPrimaryAcquisitionInput,
  CreatorScriptBuildPrimarySelectionInput,
} from "./creatorScriptBuildAuthorityCoordinator.ts";
import type {
  CreatorScriptBuildScriptGenerationInput,
} from "./creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  createCreatorScriptBuildSectionContinuationBand,
  createCreatorScriptBuildSectionLengthRecoveryBand,
  getCreatorScriptBuildSectionContinuationMaxOutputTokens,
  getCreatorScriptBuildSectionContinuationSegmentMaximumWords,
  runCreatorScriptBuildSectionGenerationWithBoundedRetry,
  selectCreatorScriptBuildSectionContinuationPrefix,
} from "./creatorScriptBuildSectionGenerationGuard.ts";
import type {
  CreatorScriptBuildScriptRepairInput,
} from "./creatorScriptBuildScriptRepairCoordinator.ts";
import {
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens,
} from "./creatorScriptBuildRepairOutputBudget.ts";
import type { CreatorScriptBuildProviderExecutors } from "./creatorScriptBuildRuntime.server.ts";

const MODEL = () => process.env.OPENAI_MODEL || "gpt-4.1-mini";
const PRIMARY_SELECTION_PROVIDER_CORRELATION = Symbol.for(
  "velto.creatorScriptBuild.primarySelectionProviderCorrelation",
);

function operationIdentity(kind: string, input: unknown, ownerId: string, projectId: string) {
  return `creator-script-build-v2:${kind}:${createHash("sha256")
    .update(JSON.stringify({ ownerId, projectId, input }), "utf8")
    .digest("hex")}`;
}

function providerNeutralSource(source: ResearchSource): ResearchSource {
  return {
    ...source,
    sourceMetadata: Object.fromEntries(
      Object.entries(source.sourceMetadata).filter(([key]) =>
        key !== "provider" && key !== "resultId"
      ),
    ),
  };
}

function researchCost(
  economics: OrchestratedResearchResult["economics"],
): EconomicCostResult {
  const pricingAsOf = new Date().toISOString().slice(0, 10);
  return economics.costComplete
    ? {
        costStatus: "exact" as const,
        providerCostUsd: economics.knownProviderCostUsd,
        reason: "Provider-reported costs aggregated across research lanes.",
        components: { search: economics.knownProviderCostUsd },
        pricingVersion: "exa-orchestrated-response-cost-v1",
        pricingAsOf,
        currency: "USD" as const,
      }
    : {
        costStatus: "unknown" as const,
        providerCostUsd: null,
        reason: "At least one research lane did not report an exact provider cost.",
        components: economics.knownProviderCostUsd > 0
          ? { knownSearchCost: economics.knownProviderCostUsd }
          : {},
        pricingVersion: "exa-orchestrated-response-cost-v1",
        pricingAsOf,
        currency: "USD" as const,
      };
}

async function recordResearchEconomics(input: {
  ownerId: string;
  projectId: string;
  kind: string;
  logicalOperationId: string;
  economics: OrchestratedResearchResult["economics"];
  sourceCount: number;
}) {
  await persistEconomicOperationBestEffort({
    attemptKey: `${input.logicalOperationId}:exa:1`,
    logicalOperationId: input.logicalOperationId,
    userId: input.ownerId,
    projectId: input.projectId,
    route: "creator-script-build",
    operationType: input.kind,
    provider: "exa",
    providerTier: "research",
    model: "multi_lane",
    state: "settled",
    billingMoment: "provider_response",
    generated: false,
    quantities: {
      requestCount: input.economics.providerRequestCount,
      returnedSourceCount: input.sourceCount,
      costComplete: input.economics.costComplete,
    },
    cost: researchCost(input.economics),
    completedAt: new Date().toISOString(),
  });
}

function openAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("CREATOR_SCRIPT_BUILD_PROVIDER_NOT_CONFIGURED");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function runOpenAIJson(input: {
  ownerId: string;
  projectId: string;
  operationType: string;
  logicalOperationId: string;
  system: string;
  user: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature: number;
  maxOutputTokens?: number;
}) {
  const model = MODEL();
  const response = await openAI().responses.create({
    model,
    input: [
      { role: "system", content: input.system },
      { role: "user", content: JSON.stringify(input.user) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
    temperature: input.temperature,
    ...(Number.isInteger(input.maxOutputTokens) && Number(input.maxOutputTokens) > 0
      ? { max_output_tokens: Number(input.maxOutputTokens) }
      : {}),
  }, input.operationType === "creator_script_build_editorial_proposal" ||
     input.operationType === "creator_script_build_claim_origin_adjudication" ? { maxRetries: 0 } : undefined);
  await recordOpenAITextEconomics({
    route: "/api/creator-script-build",
    operationType: input.operationType,
    model,
    response,
    logicalOperationId: input.logicalOperationId,
    userId: input.ownerId,
    projectId: input.projectId,
  });
  const parsed = parseCreatorScriptBuildModelJson(response.output_text || "");
  if (
    input.operationType === "creator_script_build_primary_coverage_selection" &&
    parsed && typeof parsed === "object"
  ) {
    Object.defineProperty(parsed, PRIMARY_SELECTION_PROVIDER_CORRELATION, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        requestId: typeof response._request_id === "string" ? response._request_id : null,
        responseId: typeof response.id === "string" ? response.id : null,
      }),
    });
  }
  return parsed;
}

function editorialProposalSchema(input: CreatorScriptBuildEditorialExecutionInput) {
  const sourceIds = [...new Set(input.sources.map((source) => source.sourceId))];
  const spanIds = [...new Set(input.candidateSpans.map((span) => span.spanId))];
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            claim: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                claimType: { type: "string", enum: [...RESEARCH_CLAIM_TYPES] },
                propositionKind: {
                  type: "string",
                  enum: [...RESEARCH_PROPOSITION_KINDS].filter((kind) => kind !== "ambiguous"),
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
              required: ["text", "claimType", "propositionKind", "origin"],
            },
            evidenceSelections: {
              type: "array",
              maxItems: 12,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  sourceId: { type: "string", enum: sourceIds },
                  spanId: { type: "string", enum: spanIds },
                  stance: {
                    type: "string",
                    enum: ["supports", "contradicts", "contextualizes"],
                  },
                  contextNote: { type: ["string", "null"] },
                },
                required: ["sourceId", "spanId", "stance", "contextNote"],
              },
            },
          },
          required: ["claim", "evidenceSelections"],
        },
      },
    },
    required: ["items"],
  };
}

function claimOriginSchema(claimIds: string[]) {
  return {
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
  };
}

export async function executeCreatorScriptBuildEditorialProposalProvider(input: {
  ownerId: string;
  projectId: string;
  value: CreatorScriptBuildEditorialExecutionInput;
  recovery: CreatorScriptBuildEditorialRecoveryContext;
  runJson?: typeof runOpenAIJson;
}) {
  const runJson = input.runJson || runOpenAIJson;
  // Isolate immutable authority from provider callbacks across both ordinals.
  const value = JSON.parse(JSON.stringify(input.value)) as CreatorScriptBuildEditorialExecutionInput;
  const freeze = (v: unknown): void => {
    if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); }
  };
  freeze(value);
  const proposal = await input.recovery.runStep({ kind: "proposal", ordinal: 1,
    authority: value as unknown as CreatorScriptBuildJson, priorRejection: null }, async (operationId) => {
    const response = await runJson({
      ownerId: input.ownerId,
      projectId: input.projectId,
      operationType: "creator_script_build_editorial_proposal",
      logicalOperationId: operationId,
      system: [
        "Create a grounded editorial proposal from only the supplied canonical sources and candidate spans.",
        "Return content-only claims and evidence selections. Never invent source ids, span ids, facts, studies, statistics, examples, or authority.",
        "claimType is epistemic/editorial metadata. propositionKind and origin describe proposition origin semantics.",
        "When origin.referencedWork identifies a supplied source, copy that sourceId exactly; never rewrite its URL, slug, query, or spelling.",
        "Prefer atomic distinct claims, material counter-evidence, concrete demonstrations, and real uncertainty when grounded.",
        "Do not create canonical claim ids, evidence ids, or graph links.",
        "Return strict JSON only.",
      ].join(" "),
      user: value,
      schemaName: "creator_script_build_editorial_proposal",
      schema: editorialProposalSchema(value),
      temperature: 0.2,
    });
    // Validate the provider's exact structural schema before persisting any content.
    // Semantic reconciliation still owns all kind/origin decisions, including E6L.
    const exact = (v: unknown, keys: string[]): v is Record<string, unknown> =>
      !!v && typeof v === "object" && !Array.isArray(v) &&
      Object.keys(v).sort().join(",") === [...keys].sort().join(",");
    const nullable = (v: unknown) => v === null || typeof v === "string";
    const structurallyValid = exact(response, ["items"]) && Array.isArray(response.items) && response.items.length <= 30 &&
      response.items.every((item) => {
        if (!exact(item, ["claim", "evidenceSelections"]) ||
            !exact(item.claim, ["text", "claimType", "propositionKind", "origin"])) return false;
        const c = item.claim;
        return typeof c.text === "string" && typeof c.claimType === "string" &&
          (RESEARCH_CLAIM_TYPES as readonly string[]).includes(c.claimType) &&
          typeof c.propositionKind === "string" && c.propositionKind !== "ambiguous" &&
          (RESEARCH_PROPOSITION_KINDS as readonly string[]).includes(c.propositionKind) &&
          exact(c.origin, ["attributedEntity", "referencedWork"]) &&
          nullable(c.origin.attributedEntity) && nullable(c.origin.referencedWork) &&
          Array.isArray(item.evidenceSelections) && item.evidenceSelections.length <= 12 &&
          item.evidenceSelections.every((selection) => exact(selection, ["sourceId", "spanId", "stance", "contextNote"]) &&
            typeof selection.sourceId === "string" && typeof selection.spanId === "string" &&
            typeof selection.stance === "string" && ["supports", "contradicts", "contextualizes"].includes(selection.stance) &&
            nullable(selection.contextNote));
      });
    if (!structurallyValid) throw new CreatorScriptBuildStageExecutionError({ category: "MODEL_CONTRACT",
      code: "CREATOR_SCRIPT_BUILD_EDITORIAL_PROPOSAL_INVALID", retryability: "NON_RETRYABLE" });
    const responseItems = response.items as Array<Record<string, unknown>>;
    return { items: responseItems.map((item) => {
      const raw = item as Record<string, unknown>;
      const claim = raw?.claim as Record<string, CreatorScriptBuildJson> | undefined;
      const selections = Array.isArray(raw?.evidenceSelections) ? raw.evidenceSelections : [];
      return { claim: { text: claim?.text ?? null, claimType: claim?.claimType ?? null,
        propositionKind: claim?.propositionKind ?? null, origin: claim?.origin ?? null },
        evidenceSelections: selections.map((selection) => {
          const v = selection as Record<string, CreatorScriptBuildJson>;
          return { sourceId: v?.sourceId ?? null, spanId: v?.spanId ?? null,
            stance: v?.stance ?? null, contextNote: v?.contextNote ?? null };
        }) };
    }) };
  }) as Record<string, unknown>;
  const items = Array.isArray(proposal.items) ? proposal.items : [];
  const initialClaims = items.map((item, index) => {
    const claim = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>).claim
      : null;
    return {
      ...(claim && typeof claim === "object" && !Array.isArray(claim)
        ? claim as Record<string, unknown>
        : {}),
      claimId: `proposal-item-${index + 1}`,
    };
  });
  if (initialClaims.length === 0) return { proposal };
  const authority = { claims: initialClaims, sources: value.sources, candidateSpans: value.candidateSpans };
  freeze(authority);
  return recoverCreatorScriptBuildEditorialAdjudication({
    proposal, items, initialClaims, authority: authority as unknown as CreatorScriptBuildJson,
    recovery: input.recovery,
    adjudicate: (ordinal, priorRejection, operationId) => runJson({
      ownerId: input.ownerId, projectId: input.projectId,
      operationType: "creator_script_build_claim_origin_adjudication",
      logicalOperationId: operationId,
      system: [
        "Adjudicate only propositionKind and origin for every supplied claim.",
        "Do not rewrite claim text or claimType and do not add or remove claims.",
        "When retaining the same referenced work, copy referencedWork byte-for-byte from the supplied claim; do not normalize or rewrite URLs or slugs.",
        "Use attributed_statement only for what a named entity said; document_assertion for what a named work states; original_research_result for a result from its originating work; world_state only without attribution-only origin metadata.",
        "Use ambiguous when origin cannot be resolved safely. Return strict JSON only.",
        ...(ordinal === 2 ? [
          "The previous answer was ambiguous. Ambiguity cannot be accepted.",
          "Classify only if supported by the unchanged claim and evidence. Do not invent attribution.",
          "Do not force world_state merely because the initial kind was world_state.",
          "If evidence genuinely cannot resolve origin or kind safely, ambiguity may remain and the build must fail closed.",
        ] : []),
      ].join(" "),
      user: ordinal === 1 ? authority : { ...authority, previousRejection: priorRejection, adjudicationOrdinal: ordinal },
      schemaName: "creator_script_build_claim_origin_adjudication",
      schema: claimOriginSchema(initialClaims.map((claim) => claim.claimId)), temperature: 0,
    }),
  });
}

function primarySelectionSchema(input: CreatorScriptBuildPrimarySelectionInput) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      repairs: {
        type: "array",
        minItems: 0,
        maxItems: input.targetClaims.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            claimId: {
              type: "string",
              enum: input.targetClaims.map((claim) => claim.claimId),
            },
            spanId: {
              type: "string",
              enum: input.candidateSpans.map((span) => span.spanId),
            },
          },
          required: ["claimId", "spanId"],
        },
      },
    },
    required: ["repairs"],
  };
}

function generationSchema(input: CreatorScriptBuildScriptGenerationInput) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      version: {
        type: "string",
        enum: ["0.19E3A-script-generation-proposal-v1"],
      },
      sections: {
        type: "array",
        minItems: input.sectionPlan.length,
        maxItems: input.sectionPlan.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            heading: { type: ["string", "null"] },
            text: { type: "string" },
            claimIds: {
              type: "array",
              items: { type: "string", enum: [...input.permittedClaimIds] },
            },
          },
          required: ["heading", "text", "claimIds"],
        },
      },
    },
    required: ["version", "sections"],
  };
}

function claimIdArraySchema(permittedClaimIds: readonly string[]) {
  return permittedClaimIds.length > 0
    ? {
        type: "array",
        items: { type: "string", enum: [...permittedClaimIds] },
      }
    : {
        type: "array",
        maxItems: 0,
        items: { type: "string" },
      };
}

function generationSectionSchema(
  input: CreatorScriptBuildScriptGenerationInput,
  sectionId: string,
) {
  const sectionAuthority = input.sectionClaimAuthority.find((item) =>
    item.sectionId === sectionId
  );
  const permittedClaimIds = sectionAuthority?.permittedClaimIds ||
    input.permittedClaimIds;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: { type: ["string", "null"] },
      text: { type: "string" },
      claimIds: claimIdArraySchema(permittedClaimIds),
    },
    required: ["heading", "text", "claimIds"],
  };
}

function generationSectionContinuationSchema(
  input: CreatorScriptBuildScriptGenerationInput,
  sectionId: string,
) {
  const sectionAuthority = input.sectionClaimAuthority.find((item) =>
    item.sectionId === sectionId
  );
  const permittedClaimIds = sectionAuthority?.permittedClaimIds ||
    input.permittedClaimIds;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      segments: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            claimIds: claimIdArraySchema(permittedClaimIds),
          },
          required: ["text", "claimIds"],
        },
      },
    },
    required: ["segments"],
  };
}

const GENERATION_SYSTEM = [
  "Never refer to the production itself in audience-facing narration: do not say 'this video', 'this documentary', 'this episode', 'this script', 'this section', 'this content', or similar self-references.",
  "Write one audience-facing documentary narration proposal using only the supplied approved strategy and canonical editorial context.",
  ...CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT,
  ...CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT,
  ...CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT,
  ...CREATOR_SCRIPT_FIRST_PASS_BUDGET_CONTRACT,
  "Return sections in the exact supplied sectionPlan order. Obey every section role, word envelope, claim allowlist, narration-safety rule, and evidence boundary.",
  "Do not narrate internal editorial methodology, production intent, prompts, section structure, source control, or brand process.",
  "Do not invent facts, studies, statistics, examples, anecdotes, authorities, or evidence.",
  "Return content-only section text, optional headings, and exact permitted claimIds. Do not author section IDs, kinds, script metadata, approval, revision, grounding, strategy fingerprint, or duration.",
  "Return strict JSON only.",
].join(" ");

const SECTION_NATIVE_GENERATION_SYSTEM = [
  "Never refer to the production itself in audience-facing narration: do not say 'this video', 'this documentary', 'this episode', 'this script', 'this section', 'this content', or similar self-references.",
  "Write only the single active documentary narration section supplied in activeSection.",
  "Use only the supplied approved strategy, canonical editorial context, permitted claim IDs, and evidence boundaries.",
  ...CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT,
  ...CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT,
  ...CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT,
  ...CREATOR_SCRIPT_FIRST_PASS_BUDGET_CONTRACT,
  "Treat sectionControl and futureSectionOwnership as non-narratable control metadata. sectionControl is binding for the active section; futureSectionOwnership identifies intellectual work that must be left for later sections.",
  "Treat completedSections as established audience knowledge. Reuse only the minimum words needed for continuity; do not re-explain their thesis, mechanism, evidence, examples, paradoxes, or closing questions.",
  "The active section text MUST contain at least activeSection.minimumWords words, should aim for activeSection.targetWords words, and MUST NOT exceed activeSection.maximumWords words.",
  "When sectionLengthRecovery is present, the previous candidate violated this exact word envelope. Correct that failure directly. The hard acceptance envelope remains minimumWords through maximumWords, but the corrective retry MUST land inside recoveryMinimumWords through recoveryMaximumWords. Do not aim at the failed boundary; aim near targetWords.",
  "Do not compress the section merely because the full documentary is long. Complete the substantive work owned by this section without repeating completedSections.",
  "Use completedSections only for continuity and to avoid repetition; do not rewrite or return them.",
  "sectionClaimAuthority is binding evidence authority for the active section. Use only its permittedClaimIds.",
  "If sectionClaimAuthority.mode is conceptual_only, return an empty claimIds array and reason only from creator-approved framing plus established completed-section premises. Do not imply empirical support with phrases such as 'research shows', 'studies show', 'experts argue', 'evidence suggests', or unsupported historical/psychological generalizations.",
  "If sectionClaimAuthority.mode is theme_grounded, use only claims that directly support the active approved theme; do not reuse a globally permitted claim merely because it was available to another section.",
  "Do not narrate internal editorial methodology, production intent, prompts, section structure, source control, or brand process.",
  "Do not invent facts, studies, statistics, examples, anecdotes, authorities, or evidence.",
  "Return only the active section's content-only text, optional heading, and exact permitted claimIds as strict JSON.",
].join(" ");

const SECTION_NATIVE_CONTINUATION_SYSTEM = [
  "Never refer to the production itself in audience-facing narration: do not say 'this video', 'this documentary', 'this episode', 'this script', 'this section', 'this content', or similar self-references.",
  "Write only a continuation for the single active documentary narration section supplied in activeSection.",
  "Use only the supplied approved strategy, canonical editorial context, permitted claim IDs, and evidence boundaries.",
  ...CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT,
  ...CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT,
  ...CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT,
  "Treat sectionControl and futureSectionOwnership as non-narratable control metadata. sectionControl is binding for the active section; futureSectionOwnership identifies intellectual work that must be left for later sections.",
  "Treat completedSections and previousCandidate as established audience knowledge. Reuse only the minimum words needed for continuity; do not re-explain their thesis, mechanism, evidence, examples, paradoxes, or closing questions.",
  "sectionClaimAuthority is binding evidence authority for the active section. Use only its permittedClaimIds.",
  "If sectionClaimAuthority.mode is conceptual_only, return an empty claimIds array and reason only from creator-approved framing plus established premises. Do not imply empirical support with phrases such as 'research shows', 'studies show', 'experts argue', 'evidence suggests', or unsupported historical/psychological generalizations.",
  "If sectionClaimAuthority.mode is theme_grounded, use only claims that directly support the active approved theme; do not reuse a globally permitted claim merely because it was available to another section.",
  "LENGTH RECOVERY MODE: preserve previousCandidate exactly and return only a new continuation to append to it; do not rewrite or quote any previousCandidate text.",
  "Return the continuation as a short ordered list of atomic segments. Every segment MUST be exactly one complete sentence ending in sentence-final punctuation and MUST carry only the permitted claim IDs used by that sentence.",
  "continuationSegmentMaximumWords is a hard per-segment spoken-word ceiling supplied by the server. Every segment MUST contain no more than that many whitespace-separated words; if more continuation is needed, use another short complete sentence.",
  "When continuationCorrection is present, the previous continuation yielded zero safe prefix because its first segment exceeded the remaining hard section capacity. Return a fresh shorter continuation; do not quote or recreate the rejected long sentence.",
  "Count spoken words as whitespace-separated narration words, not model tokens. The combined segment text SHOULD contain at least continuationLength.minimumWords words and SHOULD NOT exceed continuationLength.maximumWords words; the server will select only a safe ordered prefix inside the hard final-section envelope.",
  "Add only substantive, section-owned reasoning or grounded detail that advances the active section. Do not pad, summarize, restate, duplicate, or introduce a new topic.",
  "Make the ordered segments flow directly from the previousCandidate ending and remain compatible with its heading. Return only segments and their sentence-local permitted claim IDs.",
  "Do not narrate internal editorial methodology, production intent, prompts, section structure, source control, or brand process.",
  "Do not invent facts, studies, statistics, examples, anecdotes, authorities, or evidence.",
  "Return strict JSON only.",
].join(" ");

export async function executeCreatorScriptBuildScriptGenerationProvider(input: {
  ownerId: string;
  projectId: string;
  value: CreatorScriptBuildScriptGenerationInput;
  runJson?: typeof runOpenAIJson;
}) {
  const runJson = input.runJson || runOpenAIJson;
  const baseIdentity = operationIdentity(
    "script-generation",
    input.value,
    input.ownerId,
    input.projectId,
  );

  if (!input.value.sectionNative) {
    return await runJson({
      ownerId: input.ownerId,
      projectId: input.projectId,
      operationType: "creator_script_build_script_generation",
      logicalOperationId: baseIdentity,
      system: GENERATION_SYSTEM,
      user: input.value,
      schemaName: "creator_script_build_script_generation",
      schema: generationSchema(input.value),
      temperature: 0.3,
    });
  }

  const sections: Record<string, unknown>[] = [];
  const narrationControlPlan = createCreatorScriptNarrationControlPlan([
    ...input.value.sectionPlan,
  ]);
  for (const [index, activeSection] of input.value.sectionPlan.entries()) {
    const completedSections = sections.map((section, completedIndex) => ({
      id: input.value.sectionPlan[completedIndex]!.id,
      kind: input.value.sectionPlan[completedIndex]!.kind,
      heading: section.heading ?? null,
      text: section.text,
      claimIds: section.claimIds,
    }));
    let initialCandidate: unknown = null;
    const sectionResult =
      await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
        budget: activeSection,
        execute: async ({ ordinal, previousValidation }) => {
          const continuationBand = previousValidation
            ? createCreatorScriptBuildSectionContinuationBand(
                previousValidation,
              )
            : null;
          if (ordinal === 2 && continuationBand && initialCandidate) {
            const continuationSegmentMaximumWords =
              getCreatorScriptBuildSectionContinuationSegmentMaximumWords(
                continuationBand.maximumWords,
              ) || continuationBand.maximumWords;
            const runContinuation = async (request: {
              logicalSuffix: string;
              correction: boolean;
            }) =>
              await runJson({
                ownerId: input.ownerId,
                projectId: input.projectId,
                operationType: "creator_script_build_script_generation",
                logicalOperationId:
                  `${baseIdentity}:section:${index + 1}:${activeSection.id}:${request.logicalSuffix}`,
                system: SECTION_NATIVE_CONTINUATION_SYSTEM,
                user: {
                  generationAuthority: input.value,
                  activeSection,
                  activeSectionIndex: index,
                  sectionControl: narrationControlPlan[index],
                  sectionClaimAuthority: input.value.sectionClaimAuthority[index],
                  futureSectionOwnership: narrationControlPlan
                    .slice(index + 1)
                    .map((control) => ({
                      sectionId: control.sectionId,
                      kind: control.kind,
                      owns: control.owns,
                      excludes: control.excludes,
                    })),
                  completedSections,
                  previousCandidate: initialCandidate,
                  continuationLength: continuationBand,
                  continuationSegmentMaximumWords,
                  ...(request.correction
                    ? {
                        continuationCorrection: {
                          reason: "zero_retained_prefix_above_maximum",
                          maximumAdditionalWords: continuationBand.maximumWords,
                          segmentMaximumWords:
                            continuationSegmentMaximumWords,
                        },
                      }
                    : {}),
                },
                schemaName:
                  "creator_script_build_script_generation_section_continuation",
                schema: generationSectionContinuationSchema(
                  input.value,
                  activeSection.id,
                ),
                temperature: 0.1,
                maxOutputTokens:
                  getCreatorScriptBuildSectionContinuationMaxOutputTokens(
                    continuationBand.maximumWords,
                  ) || undefined,
              });
            let continuation = await runContinuation({
              logicalSuffix: "length-retry:2",
              correction: false,
            });
            let prefix =
              selectCreatorScriptBuildSectionContinuationPrefix({
                previous: initialCandidate,
                continuation,
                budget: activeSection,
              });
            let prefixRecoveryAttempts = 0;
            if (
              !prefix.accepted &&
              prefix.reason === "above_maximum" &&
              prefix.retainedSegmentCount === 0
            ) {
              prefixRecoveryAttempts = 1;
              continuation = await runContinuation({
                logicalSuffix: "length-retry:2:prefix-recovery:1",
                correction: true,
              });
              prefix = selectCreatorScriptBuildSectionContinuationPrefix({
                previous: initialCandidate,
                continuation,
                budget: activeSection,
              });
            }
            if (!prefix.accepted || !prefix.value) {
              const localRepetition = prefix.reason === "local_repetition";
              throw new CreatorScriptBuildStageExecutionError({
                category: localRepetition ? "SCRIPT_POLICY" : "MODEL_CONTRACT",
                code: localRepetition
                  ? "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_CONTINUATION_LOCAL_REPETITION"
                  : "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_CONTINUATION_PREFIX_INVALID",
                retryability: "NON_RETRYABLE",
                diagnostics: {
                  sectionId: activeSection.id,
                  ordinal,
                  reason: prefix.reason,
                  retainedSegmentCount: prefix.retainedSegmentCount,
                  prefixRecoveryAttempts,
                },
              });
            }
            return prefix.value;
          }
          const candidate = await runJson({
            ownerId: input.ownerId,
            projectId: input.projectId,
            operationType: "creator_script_build_script_generation",
            logicalOperationId:
              ordinal === 1
                ? `${baseIdentity}:section:${index + 1}:${activeSection.id}`
                : `${baseIdentity}:section:${index + 1}:${activeSection.id}:length-retry:2`,
            system: SECTION_NATIVE_GENERATION_SYSTEM,
            user: {
              generationAuthority: input.value,
              activeSection,
              activeSectionIndex: index,
              sectionControl: narrationControlPlan[index],
              sectionClaimAuthority: input.value.sectionClaimAuthority[index],
              futureSectionOwnership: narrationControlPlan
                .slice(index + 1)
                .map((control) => ({
                  sectionId: control.sectionId,
                  kind: control.kind,
                  owns: control.owns,
                  excludes: control.excludes,
                })),
              completedSections,
              ...(previousValidation
                ? (() => {
                    const recoveryBand =
                      createCreatorScriptBuildSectionLengthRecoveryBand(
                        previousValidation,
                      );
                    return {
                      sectionLengthRecovery: {
                        ordinal,
                        previousWordCount: previousValidation.wordCount,
                        previousReason: previousValidation.reason,
                        minimumWords: previousValidation.minimumWords,
                        targetWords: previousValidation.targetWords,
                        maximumWords: previousValidation.maximumWords,
                        recoveryMinimumWords: recoveryBand.minimumWords,
                        recoveryMaximumWords: recoveryBand.maximumWords,
                      },
                    };
                  })()
                : {}),
            },
            schemaName: "creator_script_build_script_generation_section",
            schema: generationSectionSchema(input.value, activeSection.id),
            temperature: ordinal === 1 ? 0.3 : 0.1,
          });
          if (ordinal === 1) initialCandidate = candidate;
          return candidate;
        },
      });
    if (!sectionResult.validation.accepted) {
      throw new CreatorScriptBuildStageExecutionError({
        category: "MODEL_CONTRACT",
        code: "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_WORD_BUDGET_INVALID",
        retryability: "NON_RETRYABLE",
        diagnostics: {
          sectionId: activeSection.id,
          attempts: sectionResult.attempts,
          wordCount: sectionResult.validation.wordCount,
          minimumWords: sectionResult.validation.minimumWords,
          targetWords: sectionResult.validation.targetWords,
          maximumWords: sectionResult.validation.maximumWords,
          reason: sectionResult.validation.reason,
        },
      });
    }
    sections.push(sectionResult.value as Record<string, unknown>);
  }

  return {
    version: "0.19E3A-script-generation-proposal-v1",
    sections,
  };
}

function repairClaimIdsForSection(
  input: CreatorScriptBuildScriptRepairInput,
  sectionId: string,
) {
  return input.sectionClaimAuthority.find((item) =>
    item.sectionId === sectionId
  )?.permittedClaimIds || input.permittedClaimIds;
}

function repairSchema(input: CreatorScriptBuildScriptRepairInput) {
  const common = {
    version: {
      type: "string",
      enum: ["0.19E3B-script-repair-proposal-v2"],
    },
    mode: { type: "string", enum: [input.mode] },
  };
  if (input.mode === "additive") {
    const anchors = input.expansionTargets.flatMap((target) =>
      target.availablePlacementAnchors.map((anchor) => anchor.id)
    );
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        ...common,
        additions: {
          type: "array",
          minItems: input.expansionTargets.length,
          maxItems: input.expansionTargets.length,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              placementAnchorId: { type: "string", enum: anchors },
              additionalText: { type: "string" },
              claimIds: {
                type: "array",
                items: { type: "string", enum: [...input.permittedClaimIds] },
              },
            },
            required: ["placementAnchorId", "additionalText", "claimIds"],
          },
        },
      },
      required: ["version", "mode", "additions"],
    };
  }
  if (!input.candidate || input.replacementTargets.length !== 1) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_SINGLE_TARGET_REQUIRED");
  }
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ...common,
      section: {
        type: "object", additionalProperties: false,
        properties: {
          sectionId: { type: "string", enum: [input.candidate.sectionId] },
          heading: { type: ["string", "null"] },
          text: { type: "string" },
          claimIds: claimIdArraySchema(
            repairClaimIdsForSection(input, input.candidate.sectionId),
          ),
        },
        required: ["sectionId", "heading", "text", "claimIds"],
      },
    },
    required: ["version", "mode", "section"],
  };
}

function replacementLengthInstructions(value: CreatorScriptBuildScriptRepairInput) {
  if (value.mode !== "replacement") return "";
  const target = value.replacementTargets[0];
  if (!value.candidate || value.replacementTargets.length !== 1 || !target ||
      value.candidate.sectionId !== target.sectionId) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_SINGLE_TARGET_REQUIRED");
  }
  const bounds = `You MUST return a complete replacement section with AT LEAST ${target.requiredFinalMinWords} words and NO MORE THAN ${target.requiredFinalMaxWords} words. Target approximately ${target.requiredFinalTargetWords} words. Returning fewer than ${target.requiredFinalMinWords} words or more than ${target.requiredFinalMaxWords} words will be rejected.`;
  const direction = target.direction === "expand"
    ? `EXPAND section ${target.sectionId}. direction=expand means the replacement must be longer than beforeWords. The replacement must be longer than the current ${target.beforeWords}-word section and gain at least ${target.minimumRequiredGain} words.`
    : target.direction === "compress"
      ? `COMPRESS section ${target.sectionId}. direction=compress means it must be shorter than beforeWords. The replacement must be shorter than the current ${target.beforeWords}-word section and reduce it by at least ${target.minimumRequiredReduction} words. Output above ${target.requiredFinalMaxWords} words will be rejected.`
      : `DIFFERENTIATE section ${target.sectionId} within its word envelope while materially differentiating its editorial role.`;
  const feedback = value.candidate.ordinal > 1 ? value.candidate.rejectionFeedback : null;
  const correction = feedback
    ? `The previous candidate contained ${feedback.candidateWords === null ? "an unknown number of" : feedback.candidateWords} words and was rejected with reason ${feedback.reason}. This target requires ${target.direction}. Produce a complete replacement of at least ${target.requiredFinalMinWords} words and no more than ${target.requiredFinalMaxWords} words. Aim for approximately ${target.requiredFinalTargetWords} words. ${target.direction === "expand" ? "Do not shorten the section again." : target.direction === "compress" ? "Do not lengthen the section again; meet the required reduction." : "Correct the rejected candidate without violating the active section envelope."}`
    : "";
  return [
    `The current section has ${target.beforeWords} words.`, direction, bounds,
    "Return the COMPLETE replacement section, not an addition, summary, or partial rewrite.", correction,
  ].filter(Boolean).join(" ");
}

export async function executeCreatorScriptBuildScriptRepairProvider(input: {
  ownerId: string;
  projectId: string;
  value: CreatorScriptBuildScriptRepairInput;
  runJson?: typeof runOpenAIJson;
}) {
  const value = input.value;
  const lengthInstructions = replacementLengthInstructions(value);
  // Round-level repairStrategies/repairableViolations stay in the durable request
  // and fingerprint, but are not competing directives in a single-target call.
  const user = value.mode === "replacement" ? {
    version: value.version,
    providerPolicyVersion: CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION,
    attempt: value.attempt,
    mode: value.mode,
    candidate: value.candidate,
    repairSectionIds: value.repairSectionIds,
    replacementTargets: value.replacementTargets,
    permittedClaimIds: value.permittedClaimIds,
    sectionClaimAuthority: value.sectionClaimAuthority,
    authorityContext: {
      usage: "context_only_not_active_repair_instructions",
      currentScriptAuthority: value.currentScriptAuthority,
      sectionPlan: value.sectionPlan,
      creatorAuthority: value.creatorAuthority,
    },
  } : value;
  return await (input.runJson || runOpenAIJson)({
    ownerId: input.ownerId,
    projectId: input.projectId,
    operationType: "creator_script_build_script_repair",
    logicalOperationId: operationIdentity(`script-repair-${CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION}-${value.attempt}`, value, input.ownerId, input.projectId),
    system: [
      "Never refer to the production itself in audience-facing narration: do not say 'this video', 'this documentary', 'this episode', 'this script', 'this section', 'this content', or similar self-references.",
      "ACTIVE REPAIR TARGET: for replacement mode, obey the sole replacementTargets item and candidate.sectionId. All authorityContext material is CONTEXT ONLY for grounding, safety, continuity and section ownership; it does not authorize repairing another section or overriding the active target bounds. Never apply one target's direction to another target.",
      "Preserve all untargeted text and all server-owned script metadata.",
      "Use only permitted grounded claim IDs. Do not invent evidence, facts, studies, examples, anecdotes, or authority.",
      "sectionClaimAuthority is binding per-section evidence authority. Never attach a globally permitted claim to a section unless that section's own permittedClaimIds includes it. For conceptual_only sections, add no claimIds and do not imply empirical support.",
      "For additive mode, return only genuinely new supporting material at supplied placement anchors. Do not restate, paraphrase, summarize, or reuse the same sentence opening as material already present in that section, especially its terminal sentence. For replacement mode, return only the single requested section with the exact server-supplied sectionId.",
      lengthInstructions,
      "Return strict JSON only.",
    ].join(" "),
    user,
    schemaName: "creator_script_build_script_repair",
    schema: repairSchema(value),
    temperature: 0.1,
    maxOutputTokens:
      getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
        mode: value.mode,
        candidateOrdinal: value.candidate?.ordinal ?? null,
        requiredFinalMaxWords:
          value.mode === "replacement"
            ? value.replacementTargets[0]?.requiredFinalMaxWords ?? null
            : null,
      }) || undefined,
  });
}

export function createCreatorScriptBuildProviderExecutors(input: {
  ownerId: string;
  projectId: string;
}): CreatorScriptBuildProviderExecutors {
  return Object.freeze({
    executeResearch: async (value: CreatorScriptBuildResearchExecutionInput) => {
      const plan = createResearchOrchestrationPlan({
        subject: value.subject,
        maxResultsPerLane: value.maxResultsPerLane,
        includeRecentContext: value.includeRecentContext,
      });
      const result = await executeResearchOrchestration({
        plan,
        provider: new ExaResearchSearchProvider(),
      });
      const sources = result.sources.map(providerNeutralSource);
      await recordResearchEconomics({
        ...input,
        kind: "creator_script_build_research",
        logicalOperationId: operationIdentity("research", value, input.ownerId, input.projectId),
        economics: result.economics,
        sourceCount: sources.length,
      });
      return {
        sources,
        lanes: result.lanes.map((lane) => ({
          laneId: lane.laneId,
          purpose: lane.purpose,
          required: lane.required,
          status: lane.status,
          sourceIds: lane.sourceIds,
        })),
      };
    },
    executeEditorialProposal: (value: CreatorScriptBuildEditorialExecutionInput, recovery?: CreatorScriptBuildEditorialRecoveryContext) => {
      if (!recovery) throw new Error("CREATOR_SCRIPT_BUILD_EDITORIAL_RECOVERY_CONTEXT_REQUIRED");
      return executeCreatorScriptBuildEditorialProposalProvider({ ...input, value, recovery });
    },
    executePrimaryAcquisition: async (value: CreatorScriptBuildPrimaryAcquisitionInput) => {
      const sourcesByIdentity = new Map<string, ResearchSource>();
      let requestCount = 0;
      let knownProviderCostUsd = 0;
      let costComplete = true;
      for (const target of value.targets) {
        const result = await executeResearchOrchestration({
          plan: createResearchOrchestrationPlan({
            subject: target.subject,
            claimType: target.acquisitionClaimType,
            maxResultsPerLane: value.maxResultsPerTarget,
            includeRecentContext: false,
          }),
          provider: new ExaResearchSearchProvider(),
        });
        requestCount += result.economics.providerRequestCount;
        knownProviderCostUsd += result.economics.knownProviderCostUsd;
        costComplete &&= result.economics.costComplete;
        for (const sourceValue of result.sources) {
          const source = providerNeutralSource(sourceValue);
          const identity = canonicalResearchUrl(source.url) || source.sourceId;
          if (!sourcesByIdentity.has(identity)) sourcesByIdentity.set(identity, source);
        }
      }
      const sources = [...sourcesByIdentity.values()]
        .toSorted((left, right) => left.sourceId.localeCompare(right.sourceId))
        .slice(0, 40);
      await recordResearchEconomics({
        ...input,
        kind: "creator_script_build_primary_acquisition",
        logicalOperationId: operationIdentity("primary-acquisition", value, input.ownerId, input.projectId),
        economics: { providerRequestCount: requestCount, knownProviderCostUsd, costComplete },
        sourceCount: sources.length,
      });
      return { version: "0.19E2B-primary-acquisition-result-v1", sources };
    },
    executePrimaryCoverageSelection: (value: CreatorScriptBuildPrimarySelectionInput) =>
      runOpenAIJson({
        ownerId: input.ownerId,
        projectId: input.projectId,
        operationType: "creator_script_build_primary_coverage_selection",
        logicalOperationId: operationIdentity("primary-selection", value, input.ownerId, input.projectId),
        system: [
          "Select exact supplied canonical spans that directly support the allowlisted target claims.",
          "Do not create, rewrite, reinterpret, add, or remove claims, sources, evidence prose, or links.",
          "Use only supplied claimId and spanId values. Omit a target when no span directly supports it.",
          "Return at most one repair per claimId. Never repeat a claimId; if multiple spans could support the same claim, select the single strongest direct span.",
          "Return strict JSON only.",
        ].join(" "),
        user: value,
        schemaName: "creator_script_build_primary_selection",
        schema: primarySelectionSchema(value),
        temperature: 0,
      }),
    executeScriptGeneration: (value: CreatorScriptBuildScriptGenerationInput) =>
      executeCreatorScriptBuildScriptGenerationProvider({
        ...input,
        value,
      }),
    executeScriptRepair: (value: CreatorScriptBuildScriptRepairInput) =>
      executeCreatorScriptBuildScriptRepairProvider({ ...input, value }),
  });
}
