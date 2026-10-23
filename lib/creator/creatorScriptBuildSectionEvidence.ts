import type { CreatorScriptSectionBudget } from "./creatorScript.ts";
import {
  buildCreatorSectionEvidencePromptPack,
  type CreatorSectionEvidencePromptSelection,
} from "../research/creatorEvidencePack.ts";
import type { CreatorScriptSectionClaimRouting } from "../research/creatorLongFormEvidenceReadiness.ts";
import type { ScriptPlannerEditorialContext } from "../research/scriptPlannerEditorialContext.ts";

export type CreatorScriptBuildSectionEvidenceAuthority = Readonly<{
  sectionId: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  selection: CreatorSectionEvidencePromptSelection;
}>;

function unique(values: string[]) {
  return [...new Set(values)];
}

function createSectionBoundContext(input: {
  context: ScriptPlannerEditorialContext;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
}): ScriptPlannerEditorialContext {
  const allowedClaimIds = new Set(input.claimIds);
  const allowedEvidenceIds = new Set(input.evidenceIds);
  const evidence = input.context.evidence.filter((item) =>
    allowedEvidenceIds.has(item.evidenceId)
  );
  const allowedSourceIds = new Set(evidence.map((item) => item.sourceId));
  return {
    ...input.context,
    claims: input.context.claims
      .filter((claim) => allowedClaimIds.has(claim.claimId))
      .map((claim) => ({
        ...claim,
        supportingEvidenceIds: claim.supportingEvidenceIds.filter((id) => allowedEvidenceIds.has(id)),
        counterEvidenceIds: claim.counterEvidenceIds.filter((id) => allowedEvidenceIds.has(id)),
        contextualEvidenceIds: claim.contextualEvidenceIds.filter((id) => allowedEvidenceIds.has(id)),
      })),
    evidence,
    sources: input.context.sources.filter((source) => allowedSourceIds.has(source.sourceId)),
  };
}

export function createCreatorScriptBuildSectionEvidenceAuthorities(input: {
  context: ScriptPlannerEditorialContext;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  sectionClaimRouting: readonly CreatorScriptSectionClaimRouting[];
}): CreatorScriptBuildSectionEvidenceAuthority[] {
  const routeBySectionId = new Map(
    input.sectionClaimRouting.map((route) => [route.sectionId, route]),
  );
  return input.sectionPlan.map((section) => {
    const route = routeBySectionId.get(section.id);
    if (!route || !route.evidenceIds) {
      throw new Error(`CREATOR_SCRIPT_BUILD_SECTION_EVIDENCE_AUTHORITY_MISSING:${section.id}`);
    }
    const selection = buildCreatorSectionEvidencePromptPack({
      context: createSectionBoundContext({
        context: input.context,
        claimIds: route.claimIds,
        evidenceIds: route.evidenceIds,
      }),
      section,
      eligibleClaimIds: route.claimIds,
    });
    const claimIds = selection.units.map((unit) => unit.claimId);
    const evidenceIds = unique(selection.units.flatMap((unit) => [
      ...unit.supportingEvidence,
      ...unit.counterEvidence,
      ...unit.contextualEvidence,
    ].map((binding) => binding.evidenceId))).toSorted();
    const routedEvidenceIds = new Set(route.evidenceIds);
    if (evidenceIds.some((evidenceId) => !routedEvidenceIds.has(evidenceId))) {
      throw new Error(`CREATOR_SCRIPT_BUILD_SECTION_EVIDENCE_BOUNDARY_INVALID:${section.id}`);
    }
    return Object.freeze({
      sectionId: section.id,
      claimIds: Object.freeze(claimIds),
      evidenceIds: Object.freeze(evidenceIds),
      selection: Object.freeze(selection),
    });
  });
}

export function creatorScriptBuildSectionClaimsFitEvidenceAuthority(input: {
  authorities: readonly CreatorScriptBuildSectionEvidenceAuthority[] | undefined;
  sectionId: string;
  claimIds: readonly string[];
}) {
  if (!input.authorities) return true;
  const authority = input.authorities.find((item) => item.sectionId === input.sectionId);
  if (!authority) return false;
  const allowedClaimIds = new Set(authority.claimIds);
  return input.claimIds.every((claimId) => allowedClaimIds.has(claimId));
}
