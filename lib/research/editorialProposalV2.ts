import {
  isResearchClaimType,
  isResearchPropositionKind,
  validateResearchClaimPropositionAuthority,
  type ClaimEvidenceStance,
  type ResearchClaimOrigin,
  type ResearchClaimType,
  type ResearchPropositionKind,
} from "./claimEvidenceGraph.ts";

export const MAX_EDITORIAL_PROPOSAL_V2_ITEMS = 30;
export const MAX_EDITORIAL_PROPOSAL_V2_SELECTIONS_PER_ITEM = 12;
export const MAX_EDITORIAL_PROPOSAL_V2_SELECTIONS = 90;

const VALID_STANCES = new Set<ClaimEvidenceStance>([
  "supports",
  "contradicts",
  "contextualizes",
]);

export type EditorialProposalV2EvidenceSelection = {
  sourceId: string;
  spanId: string;
  stance: ClaimEvidenceStance;
  contextNote: string | null;
};

export type EditorialProposalV2Claim = {
  text: string;
  claimType: ResearchClaimType;
  propositionKind: ResearchPropositionKind;
  origin: ResearchClaimOrigin;
};

export type EditorialProposalV2Item = {
  claim: EditorialProposalV2Claim;
  evidenceSelections: EditorialProposalV2EvidenceSelection[];
};

export type EditorialProposalV2 = {
  items: EditorialProposalV2Item[];
};

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
) {
  const allowed = new Set(allowedKeys);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) {
    throw new Error(
      `EDITORIAL_PROPOSAL_V2_FIELD_UNSUPPORTED:${path}.${unsupported}`,
    );
  }
}

function normalizedText(
  value: unknown,
  options: { path: string; maxLength: number; nullable?: boolean },
) {
  if (value === null && options.nullable) return null;
  if (typeof value !== "string") {
    throw new Error(`EDITORIAL_PROPOSAL_V2_TEXT_INVALID:${options.path}`);
  }
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized && !options.nullable) {
    throw new Error(`EDITORIAL_PROPOSAL_V2_TEXT_REQUIRED:${options.path}`);
  }
  if (normalized.length > options.maxLength) {
    throw new Error(`EDITORIAL_PROPOSAL_V2_TEXT_LIMIT_EXCEEDED:${options.path}`);
  }
  return normalized || null;
}

function normalizeOrigin(value: unknown, path: string): ResearchClaimOrigin {
  const origin = record(value);
  if (!origin) {
    throw new Error(`EDITORIAL_PROPOSAL_V2_ORIGIN_INVALID:${path}`);
  }
  assertExactKeys(origin, ["attributedEntity", "referencedWork"], path);
  if (
    !Object.hasOwn(origin, "attributedEntity") ||
    !Object.hasOwn(origin, "referencedWork")
  ) {
    throw new Error(`EDITORIAL_PROPOSAL_V2_ORIGIN_INVALID:${path}`);
  }
  return {
    attributedEntity: normalizedText(origin.attributedEntity, {
      path: `${path}.attributedEntity`,
      maxLength: 500,
      nullable: true,
    }),
    referencedWork: normalizedText(origin.referencedWork, {
      path: `${path}.referencedWork`,
      maxLength: 500,
      nullable: true,
    }),
  };
}

/**
 * Normalizes semantic provider output without accepting provider-authored
 * canonical IDs or relationships. Exact object-key allowlists make relational
 * fields such as claimId, evidenceId, and links invalid at this boundary.
 */
export function normalizeEditorialProposalV2(
  value: unknown,
): EditorialProposalV2 {
  const proposal = record(value);
  if (!proposal) throw new Error("EDITORIAL_PROPOSAL_V2_INVALID");
  assertExactKeys(proposal, ["items"], "proposal");
  if (!Array.isArray(proposal.items)) {
    throw new Error("EDITORIAL_PROPOSAL_V2_ITEMS_INVALID");
  }
  if (proposal.items.length > MAX_EDITORIAL_PROPOSAL_V2_ITEMS) {
    throw new Error("EDITORIAL_PROPOSAL_V2_ITEM_LIMIT_EXCEEDED");
  }

  let selectionCount = 0;
  const items = proposal.items.map((value, itemIndex) => {
    const itemPath = `items[${itemIndex}]`;
    const item = record(value);
    if (!item) throw new Error(`EDITORIAL_PROPOSAL_V2_ITEM_INVALID:${itemPath}`);
    assertExactKeys(item, ["claim", "evidenceSelections"], itemPath);

    const rawClaim = record(item.claim);
    if (!rawClaim) {
      throw new Error(`EDITORIAL_PROPOSAL_V2_CLAIM_INVALID:${itemPath}`);
    }
    assertExactKeys(
      rawClaim,
      ["text", "claimType", "propositionKind", "origin"],
      `${itemPath}.claim`,
    );
    const claimType = rawClaim.claimType;
    if (!isResearchClaimType(claimType)) {
      throw new Error(`EDITORIAL_PROPOSAL_V2_CLAIM_TYPE_INVALID:${itemPath}`);
    }
    const propositionKind = rawClaim.propositionKind;
    if (!isResearchPropositionKind(propositionKind)) {
      throw new Error(
        `EDITORIAL_PROPOSAL_V2_PROPOSITION_KIND_INVALID:${itemPath}`,
      );
    }
    const claim: EditorialProposalV2Claim = {
      text: normalizedText(rawClaim.text, {
        path: `${itemPath}.claim.text`,
        maxLength: 1_200,
      })!,
      claimType,
      propositionKind,
      origin: normalizeOrigin(rawClaim.origin, `${itemPath}.claim.origin`),
    };
    validateResearchClaimPropositionAuthority(
      { claimId: `proposal-item-${itemIndex + 1}`, ...claim },
      { required: true, allowAmbiguous: false },
    );

    if (!Array.isArray(item.evidenceSelections)) {
      throw new Error(
        `EDITORIAL_PROPOSAL_V2_EVIDENCE_SELECTIONS_INVALID:${itemPath}`,
      );
    }
    if (
      item.evidenceSelections.length >
      MAX_EDITORIAL_PROPOSAL_V2_SELECTIONS_PER_ITEM
    ) {
      throw new Error(
        `EDITORIAL_PROPOSAL_V2_ITEM_SELECTION_LIMIT_EXCEEDED:${itemPath}`,
      );
    }
    selectionCount += item.evidenceSelections.length;
    if (selectionCount > MAX_EDITORIAL_PROPOSAL_V2_SELECTIONS) {
      throw new Error("EDITORIAL_PROPOSAL_V2_SELECTION_LIMIT_EXCEEDED");
    }

    const evidenceSelections = item.evidenceSelections.map(
      (value, selectionIndex) => {
        const selectionPath =
          `${itemPath}.evidenceSelections[${selectionIndex}]`;
        const selection = record(value);
        if (!selection) {
          throw new Error(
            `EDITORIAL_PROPOSAL_V2_EVIDENCE_SELECTION_INVALID:${selectionPath}`,
          );
        }
        assertExactKeys(
          selection,
          ["sourceId", "spanId", "stance", "contextNote"],
          selectionPath,
        );
        const stance = selection.stance;
        if (typeof stance !== "string" || !VALID_STANCES.has(stance as ClaimEvidenceStance)) {
          throw new Error(
            `EDITORIAL_PROPOSAL_V2_STANCE_INVALID:${selectionPath}`,
          );
        }
        return {
          sourceId: normalizedText(selection.sourceId, {
            path: `${selectionPath}.sourceId`,
            maxLength: 300,
          })!,
          spanId: normalizedText(selection.spanId, {
            path: `${selectionPath}.spanId`,
            maxLength: 300,
          })!,
          stance: stance as ClaimEvidenceStance,
          contextNote: Object.hasOwn(selection, "contextNote")
            ? normalizedText(selection.contextNote, {
                path: `${selectionPath}.contextNote`,
                maxLength: 1_000,
                nullable: true,
              })
            : null,
        } satisfies EditorialProposalV2EvidenceSelection;
      },
    );

    return { claim, evidenceSelections };
  });

  return { items };
}
