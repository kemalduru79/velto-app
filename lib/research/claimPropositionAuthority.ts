import {
  isResearchClaimType,
  isResearchPropositionKind,
  researchClaimRequiresPrimarySource,
  validateResearchClaimPropositionAuthority,
  type ResearchClaimOrigin,
  type ResearchPropositionKind,
} from "./claimEvidenceGraph.ts";
import { canonicalResearchReference } from "./orchestratedResearch.ts";

export const CLAIM_PROPOSITION_AUTHORITY_VERSION = "claim-proposition-authority-v2" as const;

export type ClaimPropositionAuthority = {
  claimId: string;
  propositionKind: ResearchPropositionKind;
  origin: ResearchClaimOrigin;
};

export type ClaimPropositionAuthorityDisagreement = {
  claimId: string;
  claimType: string;
  claimText: string;
  initialKind: ResearchPropositionKind;
  initialOrigin: ResearchClaimOrigin;
  adjudicatedKind: ResearchPropositionKind;
  adjudicatedOrigin: ResearchClaimOrigin;
  kindMatches: boolean;
  originMatches: boolean;
  initialRequiresPrimary: boolean;
  adjudicatedRequiresPrimary: boolean;
};

export class ClaimPropositionAuthorityDisagreementError extends Error {
  readonly disagreement: ClaimPropositionAuthorityDisagreement;

  constructor(disagreement: ClaimPropositionAuthorityDisagreement) {
    super([
      disagreement.adjudicatedKind === "ambiguous"
        ? "EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS"
        : "EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT",
      disagreement.claimId,
      `initialKind=${disagreement.initialKind}`,
      `adjudicatedKind=${disagreement.adjudicatedKind}`,
      `kindMatches=${disagreement.kindMatches}`,
      `originMatches=${disagreement.originMatches}`,
    ].join(":"));
    this.name = "ClaimPropositionAuthorityDisagreementError";
    this.disagreement = {
      ...disagreement,
      initialOrigin: { ...disagreement.initialOrigin },
      adjudicatedOrigin: { ...disagreement.adjudicatedOrigin },
    };
  }
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function nullableText(value: unknown, maxLength: number) {
  if (value === null) return null;
  const normalized = clean(value, maxLength);
  return normalized || null;
}

function normalizeAuthority(
  value: unknown,
  options: { requireClaimType: boolean },
): ClaimPropositionAuthority & { claimType?: string; claimText?: string } {
  const raw = record(value);
  const claimId = clean(raw?.claimId, 120);
  const claimType = clean(raw?.claimType, 80);
  const propositionKind = raw?.propositionKind;
  const rawOrigin = record(raw?.origin);
  if (
    !raw ||
    !claimId ||
    !isResearchPropositionKind(propositionKind) ||
    !rawOrigin ||
    Object.keys(rawOrigin).sort().join(",") !== "attributedEntity,referencedWork" ||
    (rawOrigin.attributedEntity !== null && typeof rawOrigin.attributedEntity !== "string") ||
    (rawOrigin.referencedWork !== null && typeof rawOrigin.referencedWork !== "string") ||
    (options.requireClaimType && !isResearchClaimType(claimType))
  ) {
    throw new Error(`EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID:${claimId || "unknown"}`);
  }
  const origin = {
    attributedEntity: nullableText(rawOrigin.attributedEntity, 500),
    referencedWork: nullableText(rawOrigin.referencedWork, 500),
  };
  return {
    claimId,
    ...(options.requireClaimType
      ? { claimType, claimText: clean(raw.text, 600) }
      : {}),
    propositionKind,
    origin,
  };
}

function sameReferencedWork(left: string | null, right: string | null) {
  if (left === right) return true;
  if (left === null || right === null) return false;
  return canonicalResearchReference(left) === canonicalResearchReference(right);
}

export function claimPropositionOriginsEqual(
  left: ResearchClaimOrigin,
  right: ResearchClaimOrigin,
) {
  return left.attributedEntity === right.attributedEntity &&
    sameReferencedWork(left.referencedWork, right.referencedWork);
}

function isOriginDeattribution(
  initial: ResearchClaimOrigin,
  adjudicated: ResearchClaimOrigin,
) {
  const fields = ["attributedEntity", "referencedWork"] as const;
  let changed = false;

  for (const field of fields) {
    if (initial[field] === adjudicated[field]) continue;
    if (adjudicated[field] !== null) return false;
    changed = true;
  }

  return changed;
}

/**
 * Reconciles exactly one provider adjudication against the initial proposal.
 * The adjudicator has authority only over proposition classification; all other
 * claim, evidence, source and link fields remain byte-for-byte provider output.
 */
export function reconcileClaimPropositionAuthorities(input: {
  initialClaims: unknown;
  adjudication: unknown;
}) {
  const initialClaims = Array.isArray(input.initialClaims)
    ? input.initialClaims
    : [];
  const adjudication = record(input.adjudication);
  if (
    !adjudication ||
    Object.keys(adjudication).join(",") !== "claims" ||
    !Array.isArray(adjudication.claims)
  ) {
    throw new Error("EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  }

  const initialAuthorities = initialClaims.map((claim) =>
    normalizeAuthority(claim, { requireClaimType: true })
  );
  const adjudicatedAuthorities = adjudication.claims.map((claim) => {
    const authority = normalizeAuthority(claim, { requireClaimType: false });
    return authority.propositionKind === "world_state"
      ? {
          ...authority,
          origin: {
            attributedEntity: null,
            referencedWork: null,
          },
        }
      : authority;
  });
  const initialIds = initialAuthorities.map((claim) => claim.claimId);
  const adjudicatedIds = adjudicatedAuthorities.map((claim) => claim.claimId);
  if (
    new Set(initialIds).size !== initialIds.length ||
    new Set(adjudicatedIds).size !== adjudicatedIds.length ||
    initialIds.length !== adjudicatedIds.length ||
    initialIds.some((claimId) => !adjudicatedIds.includes(claimId))
  ) {
    throw new Error("EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  }

  const adjudicatedByClaimId = new Map(
    adjudicatedAuthorities.map((claim) => [claim.claimId, claim]),
  );
  const acceptedAuthorityByClaimId = new Map<string, ClaimPropositionAuthority>();
  for (const initial of initialAuthorities) {
    const adjudicated = adjudicatedByClaimId.get(initial.claimId)!;
    const claimType = initial.claimType;

    if (!claimType || !isResearchClaimType(claimType)) {
      throw new Error(
        `EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID:${initial.claimId}`,
      );
    }

    let initialSemanticallyValid = true;
    try {
      validateResearchClaimPropositionAuthority(
        {
          claimId: initial.claimId,
          claimType,
          propositionKind: initial.propositionKind,
          origin: initial.origin,
        },
        { required: true, allowAmbiguous: true },
      );
    } catch {
      initialSemanticallyValid = false;
    }

    const kindMatches =
      initial.propositionKind === adjudicated.propositionKind;
    const originMatches =
      claimPropositionOriginsEqual(initial.origin, adjudicated.origin);
    const initialRequiresPrimary = researchClaimRequiresPrimarySource({
      claimType,
      propositionKind: initial.propositionKind,
      origin: initial.origin,
    });
    const adjudicatedRequiresPrimary = researchClaimRequiresPrimarySource({
      claimType,
      propositionKind: adjudicated.propositionKind,
      origin: adjudicated.origin,
    });
    const disagreement = () => new ClaimPropositionAuthorityDisagreementError({
      claimId: initial.claimId,
      claimType,
      claimText: initial.claimText || "",
      initialKind: initial.propositionKind,
      initialOrigin: initial.origin,
      adjudicatedKind: adjudicated.propositionKind,
      adjudicatedOrigin: adjudicated.origin,
      kindMatches,
      originMatches,
      initialRequiresPrimary,
      adjudicatedRequiresPrimary,
    });

    if (adjudicated.propositionKind === "ambiguous") {
      throw disagreement();
    }

    validateResearchClaimPropositionAuthority(
      {
        claimId: initial.claimId,
        claimType,
        propositionKind: adjudicated.propositionKind,
        origin: adjudicated.origin,
      },
      { required: true, allowAmbiguous: false },
    );

    const agrees = kindMatches && originMatches;
    const isMonotonicPrimaryObligationUpgrade =
      initialSemanticallyValid &&
      initial.propositionKind !== "ambiguous" &&
      !initialRequiresPrimary &&
      adjudicatedRequiresPrimary;

    const sameWorkPrimarySemanticKinds = new Set<ResearchPropositionKind>([
      "document_assertion",
      "original_research_result",
    ]);
    const isSameWorkPrimarySemanticRefinement =
      initialSemanticallyValid &&
      originMatches &&
      initialRequiresPrimary &&
      adjudicatedRequiresPrimary &&
      sameWorkPrimarySemanticKinds.has(initial.propositionKind) &&
      sameWorkPrimarySemanticKinds.has(adjudicated.propositionKind);

    // One directed refinement only. Raw equality prevents normalization from
    // concealing an entity/work substitution; adjudication cannot rewrite prose
    // or evidence, which are retained from the initial proposal below.
    const initialRaw = record(initialClaims[initialIds.indexOf(initial.claimId)])!;
    const adjudicatedRaw = record(adjudication.claims[adjudicatedIds.indexOf(initial.claimId)])!;
    const initialRawOrigin = record(initialRaw.origin)!;
    const adjudicatedRawOrigin = record(adjudicatedRaw.origin)!;
    const isSameOriginResearchAttributionRefinement =
      initialSemanticallyValid &&
      initial.propositionKind === "original_research_result" &&
      adjudicated.propositionKind === "attributed_statement" &&
      initialRequiresPrimary && adjudicatedRequiresPrimary &&
      originMatches && Boolean(adjudicated.origin.attributedEntity) &&
      initialRawOrigin.attributedEntity === adjudicatedRawOrigin.attributedEntity &&
      initialRawOrigin.referencedWork === adjudicatedRawOrigin.referencedWork &&
      typeof initialRaw.text === "string" && Boolean(initialRaw.text.trim()) &&
      Object.keys(adjudicatedRaw).sort().join(",") === "claimId,origin,propositionKind";
    if (initial.propositionKind === "original_research_result" &&
        adjudicated.propositionKind === "attributed_statement" &&
        !isSameOriginResearchAttributionRefinement) throw disagreement();

    const sameOriginNonPrimarySemanticKinds =
      new Set<ResearchPropositionKind>([
        "expert_synthesis",
        "editorial_inference",
      ]);
    const isSameOriginNonPrimarySemanticRefinement =
      initialSemanticallyValid &&
      originMatches &&
      !initialRequiresPrimary &&
      !adjudicatedRequiresPrimary &&
      sameOriginNonPrimarySemanticKinds.has(initial.propositionKind) &&
      sameOriginNonPrimarySemanticKinds.has(adjudicated.propositionKind);

    const isSameKindEditorialDeattributionRefinement =
      initialSemanticallyValid &&
      claimType === "EDITORIAL_INFERENCE" &&
      kindMatches &&
      !originMatches &&
      !initialRequiresPrimary &&
      !adjudicatedRequiresPrimary &&
      sameOriginNonPrimarySemanticKinds.has(initial.propositionKind) &&
      isOriginDeattribution(initial.origin, adjudicated.origin);

    if (
      initialSemanticallyValid &&
      !agrees &&
      !isMonotonicPrimaryObligationUpgrade &&
      !isSameWorkPrimarySemanticRefinement &&
      !isSameOriginResearchAttributionRefinement &&
      !isSameOriginNonPrimarySemanticRefinement &&
      !isSameKindEditorialDeattributionRefinement
    ) {
      throw disagreement();
    }

    const accepted = agrees
      ? initial
      : !initialSemanticallyValid ||
          isMonotonicPrimaryObligationUpgrade ||
          isSameWorkPrimarySemanticRefinement ||
          isSameOriginResearchAttributionRefinement ||
          isSameOriginNonPrimarySemanticRefinement ||
          isSameKindEditorialDeattributionRefinement
        ? adjudicated
        : initial;

    validateResearchClaimPropositionAuthority(
      {
        claimId: initial.claimId,
        claimType,
        propositionKind: accepted.propositionKind,
        origin: accepted.origin,
      },
      { required: true, allowAmbiguous: false },
    );

    acceptedAuthorityByClaimId.set(initial.claimId, {
      claimId: initial.claimId,
      propositionKind: accepted.propositionKind,
      origin: accepted.origin,
    });
  }

  return initialClaims.map((value) => {
    const raw = record(value)!;
    const claimId = clean(raw.claimId, 120);
    const authority = acceptedAuthorityByClaimId.get(claimId)!;
    return {
      ...raw,
      propositionKind: authority.propositionKind,
      origin: { ...authority.origin },
    };
  });
}
