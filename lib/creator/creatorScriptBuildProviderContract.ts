import { validateResearchClaimPropositionAuthority } from "../research/claimEvidenceGraph.ts";
import type { CreatorScriptBuildJson } from "./creatorScriptBuild.ts";
import { CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION, type CreatorScriptBuildEditorialRecoveryContext } from "./creatorScriptBuildEditorialAdjudicationRecovery.ts";
import {
  reconcileClaimPropositionAuthorities,
  ClaimPropositionAuthorityDisagreementError,
} from "../research/claimPropositionAuthority.ts";
import {
  CreatorScriptBuildStageExecutionError,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";

function modelContractFailure(code: string) {
  return new CreatorScriptBuildStageExecutionError({
    category: "MODEL_CONTRACT",
    code,
    retryability: "NON_RETRYABLE",
  });
}

export function parseCreatorScriptBuildModelJson(raw: string) {
  try {
    const cleaned = raw.replace(/```json/giu, "").replace(/```/gu, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const extracted = firstBrace >= 0 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
    return JSON.parse(extracted) as Record<string, unknown>;
  } catch {
    throw modelContractFailure(
      "CREATOR_SCRIPT_BUILD_PROVIDER_STRUCTURED_RESPONSE_INVALID",
    );
  }
}

export function reconcileCreatorScriptBuildEditorialProposal(input: {
  proposal: Record<string, unknown>;
  items: unknown[];
  initialClaims: Array<Record<string, unknown>>;
  adjudication: Record<string, unknown>;
}) {
  try {
    const reconciled = reconcileClaimPropositionAuthorities({
      initialClaims: input.initialClaims,
      adjudication: input.adjudication,
    }) as Array<Record<string, unknown>>;
    return {
      proposal: {
        ...input.proposal,
        items: input.items.map((item, index) => ({
          ...(item as Record<string, unknown>),
          claim: {
            ...((item as Record<string, unknown>).claim as Record<string, unknown>),
            propositionKind: reconciled[index].propositionKind,
            origin: reconciled[index].origin,
          },
        })),
      },
    };
  } catch (error) {
    if (error instanceof CreatorScriptBuildStageExecutionError) throw error;
    throw modelContractFailure(
      "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID",
    );
  }
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function safeOrigin(value: unknown) {
  const origin = safeRecord(value);
  return { attributedEntity: typeof origin.attributedEntity === "string" ? origin.attributedEntity : null,
    referencedWork: typeof origin.referencedWork === "string" ? origin.referencedWork : null };
}
function safeAdjudication(value: unknown) {
  const claims = safeRecord(value).claims;
  return { claims: Array.isArray(claims) ? claims.map((value) => {
    const claim = safeRecord(value);
    return { claimId: typeof claim.claimId === "string" ? claim.claimId : null,
      propositionKind: typeof claim.propositionKind === "string" ? claim.propositionKind : null,
      origin: safeOrigin(claim.origin) };
  }) : [] };
}

export function createCreatorScriptBuildAdjudicationRejectionDiagnostic(input: {
  initialClaims: Array<Record<string, unknown>>;
  items: unknown[];
  adjudication: unknown;
  ordinal: 1 | 2;
  reason: string;
}) {
  const adjudicated = safeAdjudication(input.adjudication).claims;
  return {
    policyVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION,
    adjudicationOrdinal: input.ordinal, rejectionReason: input.reason,
    comparisons: input.initialClaims.map((claim, index) => {
      const found = adjudicated.find((candidate) => candidate.claimId === claim.claimId);
      const initialOrigin = safeOrigin(claim.origin);
      const adjudicatedOrigin = found?.origin ?? null;
      const selections = safeRecord(input.items[index]).evidenceSelections;
      return {
        proposalItemId: typeof claim.claimId === "string" ? claim.claimId : null,
        claimText: typeof claim.text === "string" ? claim.text : null,
        claimType: typeof claim.claimType === "string" ? claim.claimType : null,
        initialKind: typeof claim.propositionKind === "string" ? claim.propositionKind : null,
        initialOrigin, adjudicatedKind: found?.propositionKind ?? null, adjudicatedOrigin,
        kindMatches: found ? claim.propositionKind === found.propositionKind : false,
        originMatches: adjudicatedOrigin !== null && initialOrigin.attributedEntity === adjudicatedOrigin.attributedEntity &&
          initialOrigin.referencedWork === adjudicatedOrigin.referencedWork,
        evidenceSelections: Array.isArray(selections) ? selections.map((value) => {
          const selection = safeRecord(value);
          return { sourceId: typeof selection.sourceId === "string" ? selection.sourceId : null,
            spanId: typeof selection.spanId === "string" ? selection.spanId : null };
        }) : [],
      };
    }),
  };
}

function isRecoverableWorldStateAbstention(initialClaims: Array<Record<string, unknown>>, adjudication: Record<string, unknown>) {
  if (!Array.isArray(adjudication.claims)) return false;
  let abstained = false;
  for (const initial of initialClaims) {
    const adjudicated = adjudication.claims.find((value) => safeRecord(value).claimId === initial.claimId);
    try {
      reconcileClaimPropositionAuthorities({ initialClaims: [initial], adjudication: { claims: [adjudicated] } });
    } catch (error) {
      if (!(error instanceof ClaimPropositionAuthorityDisagreementError)) return false;
      const d = error.disagreement;
      if (d.initialKind !== "world_state" || d.adjudicatedKind !== "ambiguous" || d.kindMatches || !d.originMatches ||
          d.initialOrigin.attributedEntity !== null || d.initialOrigin.referencedWork !== null) return false;
      try {
        validateResearchClaimPropositionAuthority({ claimId: d.claimId,
          claimType: d.claimType as Parameters<typeof validateResearchClaimPropositionAuthority>[0]["claimType"],
          propositionKind: d.initialKind, origin: d.initialOrigin }, { required: true, allowAmbiguous: false });
      } catch { return false; }
      abstained = true;
    }
  }
  return abstained;
}

/** Rejected adjudications are durable outcomes, never accepted claim authority. */
export async function recoverCreatorScriptBuildEditorialAdjudication(input: {
  proposal: Record<string, unknown>;
  items: unknown[];
  initialClaims: Array<Record<string, unknown>>;
  authority: CreatorScriptBuildJson;
  recovery: CreatorScriptBuildEditorialRecoveryContext;
  adjudicate: (ordinal: 1 | 2, priorRejection: CreatorScriptBuildJson | null, operationId: string) => Promise<Record<string, unknown>>;
}) {
  let priorRejection: CreatorScriptBuildJson | null = null;
  for (const ordinal of [1, 2] as const) {
    const outcome = safeRecord(await input.recovery.runStep({ kind: "adjudication", ordinal,
      authority: input.authority, priorRejection }, async (operationId): Promise<CreatorScriptBuildJson> => {
      let adjudication: Record<string, unknown> | null = null;
      let reason = "";
      let recoverable = false;
      try {
        adjudication = await input.adjudicate(ordinal, priorRejection, operationId);
        reconcileClaimPropositionAuthorities({ initialClaims: input.initialClaims, adjudication });
        return { accepted: true, operationId, adjudication: safeAdjudication(adjudication) };
      } catch (error) {
        if (error instanceof CreatorScriptBuildStageExecutionError && (error.category !== "MODEL_CONTRACT" || error.retryability === "UNKNOWN_OUTCOME")) throw error;
        if (!(error instanceof CreatorScriptBuildStageExecutionError) &&
            !(error instanceof ClaimPropositionAuthorityDisagreementError) && adjudication === null) throw error;
        reason = error instanceof CreatorScriptBuildStageExecutionError ? error.code :
          error instanceof Error ? error.message : "EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID";
        recoverable = error instanceof ClaimPropositionAuthorityDisagreementError && adjudication !== null &&
          isRecoverableWorldStateAbstention(input.initialClaims, adjudication);
      }
      return { accepted: false, operationId, recoverable, adjudication: safeAdjudication(adjudication),
        rejection: createCreatorScriptBuildAdjudicationRejectionDiagnostic({ ...input, adjudication, ordinal, reason }) };
    }));
    if (outcome.accepted === true) {
      return reconcileCreatorScriptBuildEditorialProposal({ ...input, adjudication: safeRecord(outcome.adjudication) });
    }
    priorRejection = outcome.rejection as CreatorScriptBuildJson;
    // Reconstruct eligibility from settled authority rather than trusting a replayed flag.
    let confirmedAbstention = false;
    if (ordinal === 1 && outcome.recoverable === true) {
      try {
        reconcileClaimPropositionAuthorities({ initialClaims: input.initialClaims, adjudication: outcome.adjudication });
      } catch (error) {
        confirmedAbstention = error instanceof ClaimPropositionAuthorityDisagreementError &&
          isRecoverableWorldStateAbstention(input.initialClaims, safeRecord(outcome.adjudication));
      }
    }
    if (confirmedAbstention) continue;
    throw new CreatorScriptBuildStageExecutionError({ category: "MODEL_CONTRACT",
      code: "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID", retryability: "NON_RETRYABLE",
      diagnostics: { adjudicationOrdinal: ordinal, adjudicationOperationId: String(outcome.operationId),
        rejectionReason: String(safeRecord(priorRejection).rejectionReason) },
    });
  }
  throw modelContractFailure("CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
}
