import { sourceAuthoritySnapshotDigest, validateOwnedSourceSnapshot, validatedDocumentedLimitations, type SourceAuthorityRecord } from './sourceAuthorityBoundary.ts';
import { createCounterEvidenceReview, normalizeScriptPlannerEditorialContext, type CounterEvidenceScopeDecision, type ScriptPlannerEditorialContext } from './scriptPlannerEditorialContext.ts';
import { createResearchClaimEvidenceGraph, type ResearchClaimEvidenceGraph } from './claimEvidenceGraph.ts';
import { createEditorialScriptContext } from './editorialScriptContext.ts';
import { parseCreatorProfile } from '../creator/creatorProfile.ts';
import { classifyResearchSourceDirectness } from './sourceAssessment.ts';

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

/** Trusted server callers supply the original graph independently of persisted
 * review metadata. Existing readiness remains conservative and unchanged. */
export function createTrustedScopeReviewedContext(input: {
  ownerUserId: string; projectId: string; originalSnapshot: OwnedSnapshot; records: SourceAuthorityRecord[];
  decision: CounterEvidenceScopeDecision; originalResearchSnapshot: ResearchClaimEvidenceGraph;
  initialResearchSnapshot: ResearchClaimEvidenceGraph; now?: number;
}): ScriptPlannerEditorialContext {
  const { original, graph, initial } = validateResearchGraphsForSnapshot(input);
  const verified = resolveTrustedDisposition({ ...input, scopeDecision: input.decision });
  const excluded = new Set(input.decision.excludedClaimIds);
  const unresolved = createCounterEvidenceReview(original).unresolvedClaimIds.filter(id => !excluded.has(id));
  if (unresolved.some(id => !verified.has(id))) throw new Error('DISPOSITION_UNRESOLVED_RETAINED');
  const result: ScriptPlannerEditorialContext = {
    ...original,
    claims: original.claims.filter(claim => !excluded.has(claim.claimId)),
    counterEvidenceReview: { originalContext: structuredClone(original), originalResearchSnapshot: structuredClone(graph), initialResearchSnapshot: structuredClone(initial), decision: structuredClone(input.decision) },
  };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 2_000_000) throw new Error('COUNTER_REVIEW_SNAPSHOT_TOO_LARGE');
  return result;
}

export function validateResearchGraphsForSnapshot(input: {
  ownerUserId: string; projectId: string; originalSnapshot: OwnedSnapshot;
  originalResearchSnapshot: ResearchClaimEvidenceGraph; initialResearchSnapshot: ResearchClaimEvidenceGraph;
}) {
  const original = normalizeScriptPlannerEditorialContext(input.originalSnapshot.editorial_context, false);
  if (!original || !validateOwnedSourceSnapshot({ ownerUserId: input.ownerUserId, projectId: input.projectId, context: original, snapshot: input.originalSnapshot })) throw new Error('DISPOSITION_SNAPSHOT_INVALID');
  const graph = createResearchClaimEvidenceGraph(input.originalResearchSnapshot);
  const initial = createResearchClaimEvidenceGraph(input.initialResearchSnapshot);
  for (const claim of graph.claims) {
    const first = initial.claims.find(item => item.claimId === claim.claimId);
    if (!first || JSON.stringify(first) !== JSON.stringify(claim)) throw new Error('COUNTER_REVIEW_INITIAL_CLAIM_CHANGED');
  }
  const assessments = graph.sources.map(source => {
    const sourceContext = original.sources.find(item => item.sourceId === source.sourceId);
    if (!sourceContext || classifyResearchSourceDirectness(source).directness !== sourceContext.directness) throw new Error('COUNTER_REVIEW_SOURCE_PROVENANCE_MISMATCH');
    return { ...sourceContext, provenanceStatus: 'unknown' as const, reviewReasons: [] };
  });
  const restored = normalizeScriptPlannerEditorialContext(createEditorialScriptContext({ profile: parseCreatorProfile(null), graph, sourceAssessments: assessments }), false);
  if (!restored) throw new Error('COUNTER_REVIEW_RESEARCH_SNAPSHOT_MISMATCH');
  restored.editorialConstitution = original.editorialConstitution;
  if (sourceAuthoritySnapshotDigest(restored) !== sourceAuthoritySnapshotDigest(original)) throw new Error('COUNTER_REVIEW_RESEARCH_SNAPSHOT_MISMATCH');
  for (const evidence of graph.evidence) {
    const passage = evidence.excerpt?.replace(/\s+/g, ' ').trim();
    const material = graph.sources.find(source => source.sourceId === evidence.sourceId)?.summary?.replace(/\s+/g, ' ').trim();
    if (passage && !material?.includes(passage)) throw new Error('COUNTER_REVIEW_EXCERPT_OWNERSHIP_UNVERIFIED');
  }
  return { original, graph, initial };
}

/** Parse the stored projection using the ordinary normalizer without its audit
 * envelope, then rederive and compare the entire envelope from trusted inputs. */
export function rehydrateTrustedScopeReviewedContext(input: Parameters<typeof createTrustedScopeReviewedContext>[0] & { persistedContext: unknown }) {
  if (!input.persistedContext || typeof input.persistedContext !== 'object' || Array.isArray(input.persistedContext)) throw new Error('DISPOSITION_PROJECTION_MISMATCH');
  const raw = input.persistedContext as Record<string, unknown>;
  if (!raw.counterEvidenceReview) throw new Error('DISPOSITION_PROJECTION_MISMATCH');
  const withoutAudit = { ...raw };
  delete withoutAudit.counterEvidenceReview;
  const normalized = normalizeScriptPlannerEditorialContext(withoutAudit, false);
  const expected = createTrustedScopeReviewedContext(input);
  const expectedProjection = { ...expected };
  delete expectedProjection.counterEvidenceReview;
  if (!normalized || sourceAuthoritySnapshotDigest(normalized) !== sourceAuthoritySnapshotDigest(expectedProjection) || sourceAuthoritySnapshotDigest(raw as ScriptPlannerEditorialContext) !== sourceAuthoritySnapshotDigest(expected)) throw new Error('DISPOSITION_PROJECTION_MISMATCH');
  return expected;
}
