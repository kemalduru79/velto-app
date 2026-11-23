import { sourceAuthoritySnapshotDigest, validateOwnedSourceSnapshot, validatedDocumentedLimitations, type SourceAuthorityRecord } from './sourceAuthorityBoundary.ts';
import { createCounterEvidenceReview, normalizeScriptPlannerEditorialContext, type CounterEvidenceScopeDecision, type ScriptPlannerEditorialContext } from './scriptPlannerEditorialContext.ts';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph.ts';

// Object.freeze(new Set()) does not freeze its entries. This wrapper exposes no
// mutator and keeps the backing set inaccessible to callers.
type ImmutableSet = Pick<ReadonlySet<string>, 'size' | 'has' | 'entries' | 'keys' | 'values' | typeof Symbol.iterator>;
class ImmutableClaimIds implements ImmutableSet {
  readonly #values: Set<string>;
  constructor(ids: string[]) { this.#values = new Set(ids); Object.freeze(this); }
  get size() { return this.#values.size; }
  has(id: string) { return this.#values.has(id); }
  entries() { return this.#values.entries(); }
  keys() { return this.#values.keys(); }
  values() { return this.#values.values(); }
  [Symbol.iterator]() { return this.values(); }
  get [Symbol.toStringTag]() { return 'ImmutableClaimIds'; }
}

type OwnedSnapshot = { owner_user_id: string; project_id: string; snapshot_digest: string; editorial_context: unknown };

/** Server-only trust contract: snapshot and records must come from the server
 * repository after project authorization; never pass client-submitted rows. */
export function resolveTrustedDisposition(input: {
  ownerUserId: string;
  projectId: string;
  originalSnapshot: OwnedSnapshot;
  records: SourceAuthorityRecord[];
  scopeDecision?: CounterEvidenceScopeDecision | null;
  projectedContext?: ScriptPlannerEditorialContext | null;
  originalResearchSnapshot?: ResearchClaimEvidenceGraph;
  initialResearchSnapshot?: ResearchClaimEvidenceGraph;
  now?: number;
}): ImmutableSet {
  const original = normalizeScriptPlannerEditorialContext(input.originalSnapshot.editorial_context, false);
  if (!original || !validateOwnedSourceSnapshot({ ownerUserId: input.ownerUserId, projectId: input.projectId, context: original, snapshot: input.originalSnapshot })) throw new Error('DISPOSITION_SNAPSHOT_INVALID');
  const verified = validatedDocumentedLimitations({ ownerUserId: input.ownerUserId, projectId: input.projectId, context: original, records: input.records, now: input.now });
  let claims = original.claims;
  if (input.scopeDecision) {
    const decision = input.scopeDecision;
    const review = createCounterEvidenceReview(original);
    if (decision.confirmed !== true || decision.snapshotFingerprint !== review.snapshotFingerprint || !Array.isArray(decision.excludedClaimIds) || decision.excludedClaimIds.length === 0 || new Set(decision.excludedClaimIds).size !== decision.excludedClaimIds.length || typeof decision.rationale !== 'string' || decision.rationale.trim().length < 12 || decision.rationale.length > 1000) throw new Error('DISPOSITION_SCOPE_INVALID');
    for (const id of decision.excludedClaimIds) {
      const claim = review.claims.find((item) => item.claimId === id);
      if (!claim || !claim.canExclude || !review.unresolvedClaimIds.includes(id) || verified.includes(id)) throw new Error('DISPOSITION_SCOPE_UNAUTHORIZED');
    }
    const excluded = new Set(decision.excludedClaimIds);
    claims = original.claims.filter((claim) => !excluded.has(claim.claimId));
    if (!claims.some((claim) => claim.claimType !== 'THOUGHT_EXPERIMENT')) throw new Error('DISPOSITION_SCOPE_EMPTY');
  }
  if (input.projectedContext) {
    const projection = input.projectedContext;
    const expected = { ...original, claims, readiness: original.readiness };
    const actual = { ...projection, readiness: original.readiness };
    delete actual.counterEvidenceReview;
    if (sourceAuthoritySnapshotDigest(expected) !== sourceAuthoritySnapshotDigest(actual)) throw new Error('DISPOSITION_PROJECTION_MISMATCH');
    if (projection.counterEvidenceReview && (!input.originalResearchSnapshot || !input.initialResearchSnapshot || sourceAuthoritySnapshotDigest(projection.counterEvidenceReview.originalContext) !== sourceAuthoritySnapshotDigest(original) || JSON.stringify(projection.counterEvidenceReview.decision) !== JSON.stringify(input.scopeDecision) || JSON.stringify(projection.counterEvidenceReview.originalResearchSnapshot) !== JSON.stringify(input.originalResearchSnapshot) || JSON.stringify(projection.counterEvidenceReview.initialResearchSnapshot) !== JSON.stringify(input.initialResearchSnapshot))) throw new Error('DISPOSITION_PROJECTION_MISMATCH');
  }
  const retained = new Set(claims.map((claim) => claim.claimId));
  return new ImmutableClaimIds(verified.filter((id) => retained.has(id)));
}
