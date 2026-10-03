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
  type CreatorScriptBuildResearchExecutionInput,
  type CreatorScriptBuildEditorialExecutionInput,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  parseCreatorScriptBuildModelJson,
  reconcileCreatorScriptBuildEditorialProposal,
} from "./creatorScriptBuildProviderContract.ts";
import type {
  CreatorScriptBuildPrimaryAcquisitionInput,
  CreatorScriptBuildPrimarySelectionInput,
} from "./creatorScriptBuildAuthorityCoordinator.ts";
import type {
  CreatorScriptBuildScriptGenerationInput,
} from "./creatorScriptBuildScriptGenerationCoordinator.ts";
import type {
  CreatorScriptBuildScriptRepairInput,
} from "./creatorScriptBuildScriptRepairCoordinator.ts";
import type { CreatorScriptBuildProviderExecutors } from "./creatorScriptBuildRuntime.server.ts";

const MODEL = () => process.env.OPENAI_MODEL || "gpt-4.1-mini";

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
  });
  await recordOpenAITextEconomics({
    route: "/api/creator-script-build",
    operationType: input.operationType,
    model,
    response,
    logicalOperationId: input.logicalOperationId,
    userId: input.ownerId,
    projectId: input.projectId,
  });
  return parseCreatorScriptBuildModelJson(response.output_text || "");
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

async function executeEditorialProposal(input: {
  ownerId: string;
  projectId: string;
  value: CreatorScriptBuildEditorialExecutionInput;
}) {
  const baseIdentity = operationIdentity(
    "editorial-proposal",
    input.value,
    input.ownerId,
    input.projectId,
  );
  const proposal = await runOpenAIJson({
    ownerId: input.ownerId,
    projectId: input.projectId,
    operationType: "creator_script_build_editorial_proposal",
    logicalOperationId: `${baseIdentity}:proposal`,
    system: [
      "Create a grounded editorial proposal from only the supplied canonical sources and candidate spans.",
      "Return content-only claims and evidence selections. Never invent source ids, span ids, facts, studies, statistics, examples, or authority.",
      "claimType is epistemic/editorial metadata. propositionKind and origin describe proposition origin semantics.",
      "Prefer atomic distinct claims, material counter-evidence, concrete demonstrations, and real uncertainty when grounded.",
      "Do not create canonical claim ids, evidence ids, or graph links.",
      "Return strict JSON only.",
    ].join(" "),
    user: input.value,
    schemaName: "creator_script_build_editorial_proposal",
    schema: editorialProposalSchema(input.value),
    temperature: 0.2,
  });
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
  const adjudication = await runOpenAIJson({
    ownerId: input.ownerId,
    projectId: input.projectId,
    operationType: "creator_script_build_claim_origin_adjudication",
    logicalOperationId: `${baseIdentity}:origin-adjudication`,
    system: [
      "Adjudicate only propositionKind and origin for every supplied claim.",
      "Do not rewrite claim text or claimType and do not add or remove claims.",
      "Use attributed_statement only for what a named entity said; document_assertion for what a named work states; original_research_result for a result from its originating work; world_state only without attribution-only origin metadata.",
      "Use ambiguous when origin cannot be resolved safely. Return strict JSON only.",
    ].join(" "),
    user: { claims: initialClaims, sources: input.value.sources, candidateSpans: input.value.candidateSpans },
    schemaName: "creator_script_build_claim_origin_adjudication",
    schema: claimOriginSchema(initialClaims.map((claim) => claim.claimId)),
    temperature: 0,
  });
  return reconcileCreatorScriptBuildEditorialProposal({
    proposal,
    items,
    initialClaims,
    adjudication,
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

function repairSchema(input: CreatorScriptBuildScriptRepairInput) {
  const common = {
    version: {
      type: "string",
      enum: ["0.19E3B-script-repair-proposal-v1"],
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
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ...common,
      sections: {
        type: "array",
        minItems: input.replacementTargets.length,
        maxItems: input.replacementTargets.length,
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
    required: ["version", "mode", "sections"],
  };
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
    executeEditorialProposal: (value: CreatorScriptBuildEditorialExecutionInput) =>
      executeEditorialProposal({ ...input, value }),
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
          "Return strict JSON only.",
        ].join(" "),
        user: value,
        schemaName: "creator_script_build_primary_selection",
        schema: primarySelectionSchema(value),
        temperature: 0,
      }),
    executeScriptGeneration: (value: CreatorScriptBuildScriptGenerationInput) =>
      runOpenAIJson({
        ownerId: input.ownerId,
        projectId: input.projectId,
        operationType: "creator_script_build_script_generation",
        logicalOperationId: operationIdentity("script-generation", value, input.ownerId, input.projectId),
        system: [
          "Write one audience-facing documentary narration proposal using only the supplied approved strategy and canonical editorial context.",
          "Return sections in the exact supplied sectionPlan order. Obey every section role, word envelope, claim allowlist, narration-safety rule, and evidence boundary.",
          "Do not narrate internal editorial methodology, production intent, prompts, section structure, source control, or brand process.",
          "Do not invent facts, studies, statistics, examples, anecdotes, authorities, or evidence.",
          "Return content-only section text, optional headings, and exact permitted claimIds. Do not author section IDs, kinds, script metadata, approval, revision, grounding, strategy fingerprint, or duration.",
          "Return strict JSON only.",
        ].join(" "),
        user: value,
        schemaName: "creator_script_build_script_generation",
        schema: generationSchema(value),
        temperature: 0.3,
      }),
    executeScriptRepair: (value: CreatorScriptBuildScriptRepairInput) =>
      runOpenAIJson({
        ownerId: input.ownerId,
        projectId: input.projectId,
        operationType: "creator_script_build_script_repair",
        logicalOperationId: operationIdentity(`script-repair-${value.attempt}`, value, input.ownerId, input.projectId),
        system: [
          "Repair only the supplied targeted sections and violations in the existing script authority.",
          "Preserve all untargeted text and all server-owned script metadata.",
          "Use only permitted grounded claim IDs. Do not invent evidence, facts, studies, examples, anecdotes, or authority.",
          "For additive mode, return only the requested additions at supplied placement anchors. For replacement mode, return only replacement section prose in target order.",
          "Return strict JSON only.",
        ].join(" "),
        user: value,
        schemaName: "creator_script_build_script_repair",
        schema: repairSchema(value),
        temperature: 0.1,
      }),
  });
}
