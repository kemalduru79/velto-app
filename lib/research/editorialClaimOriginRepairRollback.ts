import {
  ClaimPropositionAuthorityDisagreementError,
  reconcileClaimPropositionAuthorities,
} from "./claimPropositionAuthority.ts";
import {
  createResearchClaimEvidenceGraph,
  type ResearchClaim,
  type ResearchClaimEvidenceGraph,
} from "./claimEvidenceGraph.ts";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unchangedBaseAuthorities(
  base: ResearchClaimEvidenceGraph,
  selected: ResearchClaimEvidenceGraph,
): boolean {
  const containsExact = <T>(
    original: T[], candidate: T[], key: (value: T) => string,
  ) => {
    const byKey = new Map(candidate.map((value) => [key(value), value]));
    return original.every((value) => {
      const match = byKey.get(key(value));
      return match !== undefined && JSON.stringify(match) === JSON.stringify(value);
    });
  };
  return containsExact(base.claims, selected.claims, (value) => value.claimId) &&
    containsExact(base.evidence, selected.evidence, (value) => value.evidenceId) &&
    containsExact(base.sources, selected.sources, (value) => value.sourceId) &&
    containsExact(base.links, selected.links,
      (value) => `${value.claimId}\0${value.evidenceId}\0${value.stance}`);
}

/**
 * Retains the strict claim-origin security gate. A secondary adjudication
 * cannot silently downgrade an original-research claim to non-primary status.
 *
 * If an optional canonical expansion introduced the ONLY disputed claim, the
 * entire expansion may instead be discarded. Reconcile the existing base
 * claims with the already-returned adjudicator output and return the validated
 * original graph. No provider retry, rewriting, fabricated source or claim
 * classification change is permitted. Any base-claim disagreement remains fatal.
 */
export function reconcileEditorialClaimOriginsWithAdditiveRepairRollback(input: {
  baseGraph: ResearchClaimEvidenceGraph;
  selectedGraph: ResearchClaimEvidenceGraph;
  repairAccepted: boolean;
  adjudication: unknown;
}): {
  graph: ResearchClaimEvidenceGraph;
  rolledBackAdditiveClaimId: string | null;
} {
  const reconcileGraph = (
    graph: ResearchClaimEvidenceGraph,
    adjudication: unknown,
  ) => createResearchClaimEvidenceGraph({
    sources: graph.sources,
    claims: reconcileClaimPropositionAuthorities({
      initialClaims: graph.claims,
      adjudication,
      sourceContext: {
        sources: graph.sources,
        evidence: graph.evidence,
        links: graph.links,
      },
    }) as ResearchClaim[],
    evidence: graph.evidence,
    links: graph.links,
  });

  try {
    return {
      graph: reconcileGraph(input.selectedGraph, input.adjudication),
      rolledBackAdditiveClaimId: null,
    };
  } catch (error) {
    if (!(error instanceof ClaimPropositionAuthorityDisagreementError)) {
      throw error;
    }
    const disputed = error.disagreement;
    const baseIds = new Set(input.baseGraph.claims.map((claim) => claim.claimId));
    const selectedIds = new Set(input.selectedGraph.claims.map((claim) => claim.claimId));
    if (
      !input.repairAccepted ||
      input.baseGraph.claims.length === 0 ||
      baseIds.has(disputed.claimId) ||
      !selectedIds.has(disputed.claimId) ||
      !disputed.initialRequiresPrimary ||
      disputed.adjudicatedRequiresPrimary ||
      !unchangedBaseAuthorities(input.baseGraph, input.selectedGraph)
    ) {
      throw error;
    }

    const raw = record(input.adjudication);
    const authorities = Array.isArray(raw?.claims) ? raw.claims : null;
    if (!authorities) throw error;
    const baseAdjudication = {
      claims: authorities.filter((value: unknown) => {
        const item = record(value);
        return typeof item?.claimId === "string" &&
          baseIds.has(item.claimId);
      }),
    };
    // Reconciliation can still reject an invalid base authority. That failure
    // is never suppressed or retried using the first model's classification.
    const graph = reconcileGraph(input.baseGraph, baseAdjudication);
    return { graph, rolledBackAdditiveClaimId: disputed.claimId };
  }
}
