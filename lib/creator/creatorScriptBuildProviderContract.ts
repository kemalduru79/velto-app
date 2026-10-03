import {
  reconcileClaimPropositionAuthorities,
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
