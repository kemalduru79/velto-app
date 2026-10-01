import {
  isResearchClaimType,
  isResearchPropositionKind,
  researchClaimRequiresPrimarySource,
  validateResearchClaimPropositionAuthority,
  type ResearchClaimOrigin,
  type ResearchPropositionKind,
} from "./claimEvidenceGraph.ts";

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
      "EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS",
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

function sameOrigin(left: ResearchClaimOrigin, right: ResearchClaimOrigin) {
  return left.attributedEntity === right.attributedEntity &&
    left.referencedWork === right.referencedWork;
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
  const adjudicatedAuthorities = adjudication.claims.map((claim) =>
    normalizeAuthority(claim, { requireClaimType: false })
  );
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
      sameOrigin(initial.origin, adjudicated.origin);
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

    if (
      initialSemanticallyValid &&
      !agrees &&
      !isMonotonicPrimaryObligationUpgrade
    ) {
      throw disagreement();
    }

    const accepted = initialSemanticallyValid && !isMonotonicPrimaryObligationUpgrade
      ? initial
      : adjudicated;

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
