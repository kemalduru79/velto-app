import { createHash } from "node:crypto";
import {
  createResearchClaimEvidenceGraph,
  validateResearchClaimPropositionAuthority,
  type ResearchClaim,
  type ResearchClaimEvidenceGraph,
  type ResearchClaimEvidenceLink,
  type ResearchEvidence,
  type ResearchEvidenceLocator,
} from "./claimEvidenceGraph.ts";
import {
  normalizeEditorialProposalV2,
  type EditorialProposalV2,
  type EditorialProposalV2Claim,
  type EditorialProposalV2EvidenceSelection,
} from "./editorialProposalV2.ts";
import type { ResearchSource } from "./sourceContract.ts";

export type CanonicalEditorialEvidenceSpan = {
  spanId: string;
  sourceId: string;
  text: string;
  locator?: ResearchEvidenceLocator;
};

const EMPTY_LOCATOR: ResearchEvidenceLocator = {
  section: null,
  page: null,
  timecodeStartSec: null,
  timecodeEndSec: null,
};

function canonicalClaimIdentity(claim: EditorialProposalV2Claim) {
  return JSON.stringify({
    version: "editorial-claim-v2",
    text: claim.text,
    claimType: claim.claimType,
    propositionKind: claim.propositionKind,
    origin: {
      attributedEntity: claim.origin.attributedEntity,
      referencedWork: claim.origin.referencedWork,
    },
  });
}

function canonicalEvidenceIdentity(input: {
  sourceId: string;
  spanId: string;
  contextNote: string | null;
}) {
  // Context is intentionally evidence semantics, while claim and stance are
  // relational semantics. The same span/context can therefore be shared by
  // claims with different stances; a different context is a distinct evidence
  // identity and cannot be silently coalesced with the original interpretation.
  return JSON.stringify({
    version: "editorial-evidence-v2",
    sourceId: input.sourceId,
    spanId: input.spanId,
    contextNote: input.contextNote,
  });
}

function deterministicId(prefix: "claim" | "evidence", identity: string) {
  return `${prefix}:v2:${createHash("sha256").update(identity).digest("hex")}`;
}

function registerIdentity(input: {
  id: string;
  identity: string;
  identitiesById: Map<string, string>;
  kind: "CLAIM" | "EVIDENCE";
}) {
  const existing = input.identitiesById.get(input.id);
  if (existing !== undefined && existing !== input.identity) {
    throw new Error(`CANONICAL_EDITORIAL_${input.kind}_IDENTITY_COLLISION:${input.id}`);
  }
  input.identitiesById.set(input.id, input.identity);
}

function normalizeCatalogId(value: unknown, kind: "SOURCE" | "SPAN") {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`CANONICAL_EDITORIAL_${kind}_ID_REQUIRED`);
  }
  const normalized = value.trim();
  if (normalized.length > 300) {
    throw new Error(`CANONICAL_EDITORIAL_${kind}_ID_LIMIT_EXCEEDED`);
  }
  return normalized;
}

function sameSelection(
  left: EditorialProposalV2EvidenceSelection,
  right: EditorialProposalV2EvidenceSelection,
) {
  return left.sourceId === right.sourceId &&
    left.spanId === right.spanId &&
    left.stance === right.stance &&
    left.contextNote === right.contextNote;
}

/**
 * Compiles semantic proposal material into the existing canonical graph shape.
 * Canonical IDs and relationships are server-owned: proposal order, random
 * state, timestamps, and provider-authored relational references do not
 * participate in identity.
 */
export function compileCanonicalEditorialGraph(input: {
  proposal: unknown | EditorialProposalV2;
  sources: readonly ResearchSource[];
  spanCatalog: readonly CanonicalEditorialEvidenceSpan[];
}): ResearchClaimEvidenceGraph {
  const proposal = normalizeEditorialProposalV2(input.proposal);
  const sources = input.sources.map((source) => ({ ...source }));
  const sourceById = new Map<string, ResearchSource>();
  for (const source of sources) {
    if (!source.sourceId.trim()) {
      throw new Error("CANONICAL_EDITORIAL_SOURCE_ID_REQUIRED");
    }
    if (sourceById.has(source.sourceId)) {
      throw new Error(`CANONICAL_EDITORIAL_SOURCE_ID_DUPLICATE:${source.sourceId}`);
    }
    sourceById.set(source.sourceId, source);
  }

  const spanById = new Map<string, CanonicalEditorialEvidenceSpan>();
  const spanBySourceAndId = new Map<string, CanonicalEditorialEvidenceSpan>();
  for (const value of input.spanCatalog) {
    const spanId = normalizeCatalogId(value.spanId, "SPAN");
    const sourceId = normalizeCatalogId(value.sourceId, "SOURCE");
    if (!sourceById.has(sourceId)) {
      throw new Error(`CANONICAL_EDITORIAL_SPAN_SOURCE_MISSING:${spanId}`);
    }
    if (typeof value.text !== "string" || !value.text.trim()) {
      throw new Error(`CANONICAL_EDITORIAL_SPAN_TEXT_REQUIRED:${spanId}`);
    }
    if (spanById.has(spanId)) {
      throw new Error(`CANONICAL_EDITORIAL_SPAN_ID_DUPLICATE:${spanId}`);
    }
    const span = {
      spanId,
      sourceId,
      text: value.text,
      ...(value.locator ? { locator: { ...value.locator } } : {}),
    };
    spanById.set(spanId, span);
    spanBySourceAndId.set(`${sourceId}\0${spanId}`, span);
  }

  const claimIdentitiesById = new Map<string, string>();
  const evidenceIdentitiesById = new Map<string, string>();
  const claimsById = new Map<string, ResearchClaim>();
  const evidenceById = new Map<string, ResearchEvidence>();
  const linksByKey = new Map<string, ResearchClaimEvidenceLink>();
  const claimIdentityByNormalizedText = new Map<string, string>();

  for (const item of proposal.items) {
    const claimIdentity = canonicalClaimIdentity(item.claim);
    const claimId = deterministicId("claim", claimIdentity);
    registerIdentity({
      id: claimId,
      identity: claimIdentity,
      identitiesById: claimIdentitiesById,
      kind: "CLAIM",
    });
    const normalizedClaimText = item.claim.text.toLocaleLowerCase("en-US");
    const existingTextIdentity = claimIdentityByNormalizedText.get(
      normalizedClaimText,
    );
    if (existingTextIdentity !== undefined) {
      if (existingTextIdentity === claimIdentity) {
        throw new Error(`CANONICAL_EDITORIAL_CLAIM_DUPLICATE:${claimId}`);
      }
      throw new Error(`CANONICAL_EDITORIAL_CLAIM_CONFLICT:${claimId}`);
    }
    claimIdentityByNormalizedText.set(normalizedClaimText, claimIdentity);

    const claim: ResearchClaim = { claimId, ...item.claim };
    validateResearchClaimPropositionAuthority(claim, {
      required: true,
      allowAmbiguous: false,
    });
    claimsById.set(claimId, claim);

    const selectionBySpan = new Map<string, EditorialProposalV2EvidenceSelection>();
    for (const selection of item.evidenceSelections) {
      if (!sourceById.has(selection.sourceId)) {
        throw new Error(
          `CANONICAL_EDITORIAL_SOURCE_NOT_FOUND:${selection.sourceId}`,
        );
      }
      const span = spanBySourceAndId.get(
        `${selection.sourceId}\0${selection.spanId}`,
      );
      if (!span && spanById.has(selection.spanId)) {
        throw new Error(
          `CANONICAL_EDITORIAL_SPAN_SOURCE_MISMATCH:${selection.sourceId}:${selection.spanId}`,
        );
      }
      if (!span) {
        throw new Error(
          `CANONICAL_EDITORIAL_SPAN_NOT_FOUND:${selection.sourceId}:${selection.spanId}`,
        );
      }

      const selectionRoot = `${selection.sourceId}\0${selection.spanId}`;
      const existingSelection = selectionBySpan.get(selectionRoot);
      if (existingSelection) {
        if (sameSelection(existingSelection, selection)) continue;
        throw new Error(
          `CANONICAL_EDITORIAL_EVIDENCE_SELECTION_CONFLICT:${claimId}:${selection.sourceId}:${selection.spanId}`,
        );
      }
      selectionBySpan.set(selectionRoot, selection);

      const evidenceIdentity = canonicalEvidenceIdentity(selection);
      const evidenceId = deterministicId("evidence", evidenceIdentity);
      registerIdentity({
        id: evidenceId,
        identity: evidenceIdentity,
        identitiesById: evidenceIdentitiesById,
        kind: "EVIDENCE",
      });
      if (!evidenceById.has(evidenceId)) {
        evidenceById.set(evidenceId, {
          evidenceId,
          sourceId: selection.sourceId,
          excerpt: span.text,
          contextNote: selection.contextNote,
          locator: span.locator ? { ...span.locator } : { ...EMPTY_LOCATOR },
        });
      }

      const link: ResearchClaimEvidenceLink = {
        claimId,
        evidenceId,
        stance: selection.stance,
      };
      linksByKey.set(`${claimId}\0${evidenceId}\0${selection.stance}`, link);
    }
  }

  return createResearchClaimEvidenceGraph({
    sources,
    claims: [...claimsById.values()].toSorted((left, right) =>
      left.claimId.localeCompare(right.claimId)
    ),
    evidence: [...evidenceById.values()].toSorted((left, right) =>
      left.evidenceId.localeCompare(right.evidenceId)
    ),
    links: [...linksByKey.values()].toSorted((left, right) =>
      `${left.claimId}\0${left.evidenceId}\0${left.stance}`.localeCompare(
        `${right.claimId}\0${right.evidenceId}\0${right.stance}`,
      )
    ),
  });
}
