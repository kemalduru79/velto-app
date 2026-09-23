import type { CreatorScriptSectionBudget } from "../creator/creatorScript.ts";
import {
  classifyEditorialGroundingSpanSpecificity,
  type EditorialGroundingCandidateSpan,
} from "./editorialGroundingRepair.ts";
import type { ScriptPlannerEditorialContext } from "./scriptPlannerEditorialContext.ts";

export type CreatorScriptSectionClaimRouting = {
  sectionId: string;
  sectionKind: CreatorScriptSectionBudget["kind"];
  claimIds: string[];
  usedFallback: boolean;
};

export type CreatorLongFormEvidenceReadinessReason =
  | "missing_grounded_demonstration_capability"
  | "missing_counterview_capability"
  | "missing_uncertainty_capability"
  | "collapsed_body_authority";

export type CreatorLongFormEvidenceReadiness = {
  applicable: boolean;
  eligible: boolean;
  reasonCodes: CreatorLongFormEvidenceReadinessReason[];
  fallbackBodySectionIds: string[];
  collapsedBodySectionIds: string[];
  evidenceDependentBodySectionIds: string[];
};

export type CreatorLongFormEvidenceCapabilityItem = {
  claimId: string;
  claimType: ScriptPlannerEditorialContext["claims"][number]["claimType"];
  evidenceId: string;
  stance: "supports" | "contextualizes" | "contradicts";
  sourceId: string;
  specificityClassification: "concrete_observation" | "abstract_or_conceptual";
  hasConcreteDemonstrationCapability: boolean;
  hasUncertaintyCapability: boolean;
  routedSectionIds: string[];
  usedViaFallback: boolean;
};

export type CreatorLongFormEvidenceCapabilityEvaluation = {
  routing: CreatorScriptSectionClaimRouting[];
  inventory: CreatorLongFormEvidenceCapabilityItem[];
  demonstrationSectionId: string | null;
  limitsSectionId: string | null;
  counterviewSectionId: string | null;
  hasGroundedDemonstrationCapability: boolean;
  hasUncertaintyCapability: boolean;
  hasCounterviewCapability: boolean;
};

const MAX_DIAGNOSTIC_CANDIDATES = 10;

export function createCreatorEditorialCandidateCapabilityDiagnostics(
  candidateSpans: EditorialGroundingCandidateSpan[],
) {
  const concreteCandidates = candidateSpans.filter(
    (span) => span.evidenceSpecificity === "concrete_observation",
  );
  return {
    candidateSpanCount: candidateSpans.length,
    concreteCandidateSpanCount: concreteCandidates.length,
    concreteCandidates: concreteCandidates.slice(0, MAX_DIAGNOSTIC_CANDIDATES).map((span) => ({
      sourceId: span.sourceId,
      spanId: span.spanId,
      specificityClassification: span.evidenceSpecificity,
    })),
    truncatedConcreteCandidateCount: Math.max(
      0,
      concreteCandidates.length - MAX_DIAGNOSTIC_CANDIDATES,
    ),
  };
}

const EMPIRICAL_CLAIM_TYPES = new Set([
  "FACT",
  "PRIMARY_SOURCE_CLAIM",
  "RESEARCH_FINDING",
]);

const UNCERTAINTY_BEARING_CLAIM_TYPES = new Set([
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
]);

function unique(values: string[]) {
  return [...new Set(values)];
}

/**
 * Returns the exact claim routing used by section-native generation. Keeping
 * this in one pure helper prevents readiness and provider context from drifting.
 */
export function createCreatorScriptSectionClaimRouting(input: {
  context: ScriptPlannerEditorialContext;
  plan: CreatorScriptSectionBudget[];
}): CreatorScriptSectionClaimRouting[] {
  const bodySections = input.plan.filter((section) => section.kind === "body");
  return input.plan.map((section) => {
    const bodyIndex = section.kind === "body"
      ? bodySections.findIndex((item) => item.id === section.id)
      : -1;
    const relevantClaims = section.kind === "conclusion"
      ? input.context.claims
      : section.kind === "opening"
        ? input.context.claims.slice(0, Math.min(4, input.context.claims.length))
        : input.context.claims.filter((_, claimIndex) =>
            bodySections.length === 0 || claimIndex % bodySections.length === bodyIndex
          );
    const usedFallback = section.kind === "body" && relevantClaims.length === 0;
    const claims = relevantClaims.length > 0
      ? relevantClaims
      : input.context.claims.slice(0, Math.min(2, input.context.claims.length));
    return {
      sectionId: section.id,
      sectionKind: section.kind,
      claimIds: claims.map((claim) => claim.claimId),
      usedFallback,
    };
  });
}

function roleOwns(section: CreatorScriptSectionBudget, capability: string) {
  return section.ownershipBoundary.owns.includes(capability);
}

function isEvidenceDependentBodyRole(section: CreatorScriptSectionBudget) {
  if (section.kind !== "body") return false;
  return section.ownershipBoundary.owns.some((capability) => [
    "definition",
    "framing",
    "mechanism",
    "causal_process",
    "grounded_demonstration",
    "concrete_case",
    "counterview",
    "thesis_stress_test",
    "limits",
    "uncertainty",
    "scope_conditions",
    "social_formation",
    "relational_influence",
    "systemic_interaction",
    "material_consequence",
    "downstream_effect",
    "second_order_impact",
  ].includes(capability));
}

export function createCreatorLongFormEvidenceCapabilityEvaluation(input: {
  context: ScriptPlannerEditorialContext;
  plan: CreatorScriptSectionBudget[];
}): CreatorLongFormEvidenceCapabilityEvaluation {
  const claimById = new Map(input.context.claims.map((claim) => [claim.claimId, claim]));
  const evidenceById = new Map(input.context.evidence.map((evidence) => [evidence.evidenceId, evidence]));
  const routing = createCreatorScriptSectionClaimRouting(input);
  const routingBySectionId = new Map(routing.map((route) => [route.sectionId, route]));
  const routedSectionsByClaimId = new Map<string, CreatorScriptSectionClaimRouting[]>();
  routing.forEach((route) => route.claimIds.forEach((claimId) => {
    routedSectionsByClaimId.set(
      claimId,
      [...(routedSectionsByClaimId.get(claimId) || []), route],
    );
  }));

  const evidenceDependentBodySections = input.plan.filter(isEvidenceDependentBodyRole);
  const demonstrationSection = evidenceDependentBodySections.find((section) =>
    roleOwns(section, "grounded_demonstration") || roleOwns(section, "concrete_case")
  );
  const limitsSection = evidenceDependentBodySections.find((section) =>
    roleOwns(section, "limits") || roleOwns(section, "uncertainty") || roleOwns(section, "scope_conditions")
  );
  const counterviewSection = evidenceDependentBodySections.find((section) =>
    roleOwns(section, "counterview") || roleOwns(section, "thesis_stress_test")
  );

  const demonstrationClaimIds = demonstrationSection
    ? routingBySectionId.get(demonstrationSection.id)?.claimIds || []
    : [];
  const demonstrationClaims = demonstrationClaimIds
    .map((claimId) => claimById.get(claimId))
    .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim));
  const demonstrationRouteHasEmpiricalClaim = demonstrationClaims.some((claim) =>
    EMPIRICAL_CLAIM_TYPES.has(claim.claimType)
  );
  const limitsClaimIds = new Set(
    limitsSection ? routingBySectionId.get(limitsSection.id)?.claimIds || [] : [],
  );

  const inventory = input.context.claims.flatMap((claim) => {
    const routedSections = routedSectionsByClaimId.get(claim.claimId) || [];
    const routedSectionIds = routedSections.map((route) => route.sectionId);
    const usedViaFallback = routedSections.some((route) => route.usedFallback);
    const relations = [
      ...claim.supportingEvidenceIds.map((evidenceId) => ({ evidenceId, stance: "supports" as const })),
      ...claim.contextualEvidenceIds.map((evidenceId) => ({ evidenceId, stance: "contextualizes" as const })),
      ...claim.counterEvidenceIds.map((evidenceId) => ({ evidenceId, stance: "contradicts" as const })),
    ];
    return relations.flatMap(({ evidenceId, stance }) => {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) return [];
      const specificityClassification = classifyEditorialGroundingSpanSpecificity(
        evidence.excerpt || "",
      );
      const isDemonstrationAuthority = Boolean(demonstrationSection) &&
        routedSectionIds.includes(demonstrationSection!.id) &&
        stance === "supports" &&
        Boolean(evidence.excerpt) &&
        (!demonstrationRouteHasEmpiricalClaim || specificityClassification === "concrete_observation");
      const isUncertaintyAuthority = limitsClaimIds.has(claim.claimId) && (
        stance === "contextualizes" ||
        (stance === "supports" && UNCERTAINTY_BEARING_CLAIM_TYPES.has(claim.claimType))
      );
      return [{
        claimId: claim.claimId,
        claimType: claim.claimType,
        evidenceId,
        stance,
        sourceId: evidence.sourceId,
        specificityClassification,
        hasConcreteDemonstrationCapability: isDemonstrationAuthority,
        hasUncertaintyCapability: isUncertaintyAuthority,
        routedSectionIds,
        usedViaFallback,
      }];
    });
  });

  const hasGroundedDemonstrationCapability = demonstrationSection
    ? demonstrationClaims.flatMap((claim) => claim.supportingEvidenceIds)
        .map((evidenceId) => evidenceById.get(evidenceId))
        .filter((evidence): evidence is NonNullable<typeof evidence> => Boolean(evidence))
        .some((evidence) => Boolean(evidence.excerpt) && (
          !demonstrationRouteHasEmpiricalClaim ||
          classifyEditorialGroundingSpanSpecificity(evidence.excerpt || "") === "concrete_observation"
        ))
    : false;
  const hasUncertaintyCapability = limitsSection
    ? [...limitsClaimIds].some((claimId) => {
        const claim = claimById.get(claimId);
        if (!claim) return false;
        return claim.contextualEvidenceIds.length > 0 ||
          (UNCERTAINTY_BEARING_CLAIM_TYPES.has(claim.claimType) && claim.supportingEvidenceIds.length > 0);
      })
    : false;
  const hasCounterviewCapability = counterviewSection
    ? (routingBySectionId.get(counterviewSection.id)?.claimIds || []).some((claimId) =>
        (claimById.get(claimId)?.counterEvidenceIds.length || 0) > 0
      )
    : false;

  return {
    routing,
    inventory,
    demonstrationSectionId: demonstrationSection?.id || null,
    limitsSectionId: limitsSection?.id || null,
    counterviewSectionId: counterviewSection?.id || null,
    hasGroundedDemonstrationCapability,
    hasUncertaintyCapability,
    hasCounterviewCapability,
  };
}

/**
 * Answers whether a valid canonical graph can responsibly serve the actual
 * section-native long-form plan. It does not score research or promote sources.
 */
export function createCreatorLongFormEvidenceReadiness(input: {
  context: ScriptPlannerEditorialContext;
  plan: CreatorScriptSectionBudget[];
  sectionNative: boolean;
}): CreatorLongFormEvidenceReadiness {
  const evidenceDependentBodySections = input.plan.filter(isEvidenceDependentBodyRole);
  const applicable = input.sectionNative && evidenceDependentBodySections.length > 0;
  if (!applicable) {
    return {
      applicable: false,
      eligible: true,
      reasonCodes: [],
      fallbackBodySectionIds: [],
      collapsedBodySectionIds: [],
      evidenceDependentBodySectionIds: evidenceDependentBodySections.map((section) => section.id),
    };
  }

  const reasonCodes = new Set<CreatorLongFormEvidenceReadinessReason>();
  const claimById = new Map(input.context.claims.map((claim) => [claim.claimId, claim]));
  const capabilityEvaluation = createCreatorLongFormEvidenceCapabilityEvaluation(input);
  const routing = capabilityEvaluation.routing;
  const routingBySectionId = new Map(routing.map((route) => [route.sectionId, route]));
  const bodyRouting = evidenceDependentBodySections
    .map((section) => routingBySectionId.get(section.id))
    .filter((route): route is CreatorScriptSectionClaimRouting => Boolean(route));

  const linkedEvidenceIdsForClaims = (claimIds: string[]) => unique(claimIds.flatMap((claimId) => {
    const claim = claimById.get(claimId);
    return claim ? [
      ...claim.supportingEvidenceIds,
      ...claim.counterEvidenceIds,
      ...claim.contextualEvidenceIds,
    ] : [];
  }));

  if (capabilityEvaluation.demonstrationSectionId &&
      !capabilityEvaluation.hasGroundedDemonstrationCapability) {
    reasonCodes.add("missing_grounded_demonstration_capability");
  }
  if (capabilityEvaluation.counterviewSectionId && !capabilityEvaluation.hasCounterviewCapability) {
    reasonCodes.add("missing_counterview_capability");
  }
  if (capabilityEvaluation.limitsSectionId && !capabilityEvaluation.hasUncertaintyCapability) {
    reasonCodes.add("missing_uncertainty_capability");
  }

  const authorityFingerprints = bodyRouting.map((route) => {
    const claimIds = unique(route.claimIds).toSorted();
    const evidenceIds = linkedEvidenceIdsForClaims(claimIds).toSorted();
    return `${claimIds.join(",")}|${evidenceIds.join(",")}`;
  });
  const collapsed = bodyRouting.length > 1 && new Set(authorityFingerprints).size === 1;
  const soleAuthorityEvidenceCount = collapsed
    ? linkedEvidenceIdsForClaims(bodyRouting[0]?.claimIds || []).length
    : 0;
  const collapsedBodySectionIds = collapsed && soleAuthorityEvidenceCount <= 1
    ? bodyRouting.map((route) => route.sectionId)
    : [];
  if (collapsedBodySectionIds.length > 0) reasonCodes.add("collapsed_body_authority");

  return {
    applicable: true,
    eligible: reasonCodes.size === 0,
    reasonCodes: [...reasonCodes],
    fallbackBodySectionIds: bodyRouting.filter((route) => route.usedFallback).map((route) => route.sectionId),
    collapsedBodySectionIds,
    evidenceDependentBodySectionIds: evidenceDependentBodySections.map((section) => section.id),
  };
}
