import { normalizeScriptPlannerEditorialContext } from './scriptPlannerEditorialContext.ts';
import { sourceAuthoritySnapshotDigest, validateOwnedSourceSnapshot } from './sourceAuthorityBoundary.ts';
import { prepareReviewedSourceAuthorityRecord } from './sourceAuthorityIssuance.ts';
import type { OriginalSourceDocument } from './originalSourceEvidence.ts';
import type { ResearchSource } from './sourceContract.ts';

type Snapshot = { owner_user_id: string; project_id: string; snapshot_digest: string; editorial_context: unknown };
type Decision = { publisherAuthoredDocument: boolean; classification: 'original_research' | 'primary_document' | 'secondary' | 'unknown'; basis: string; documentDigest: string; disposition?: import('./sourceAuthorityIssuance.ts').ClaimEvidenceDisposition; dispositionRationale?: string };
type Dependencies = {
  enabled: boolean;
  authenticateReviewer: (token: string) => Promise<string | null>;
  ownsProject: (ownerId: string, projectId: string) => Promise<boolean>;
  insertSnapshot: (snapshot: Snapshot) => Promise<void>;
  loadSnapshot: (ownerId: string, projectId: string, digest: string) => Promise<Snapshot | null>;
  acquire: (source: ResearchSource) => Promise<OriginalSourceDocument>;
  insertRecord: (record: Awaited<ReturnType<typeof prepareReviewedSourceAuthorityRecord>>) => Promise<void>;
  now: () => string;
};

// All dependencies are selected on the server; never accept callbacks from a request.
export function createSourceAuthorityWorkflow(deps: Dependencies) {
  async function authorize(token: string, ownerId: string, projectId: string) {
    if (!deps.enabled) throw new Error('SOURCE_AUTHORITY_DISABLED');
    const reviewerId = await deps.authenticateReviewer(token);
    if (!reviewerId) throw new Error('SOURCE_AUTHORITY_REVIEWER_UNAUTHORIZED');
    if (!ownerId || !projectId || !(await deps.ownsProject(ownerId, projectId))) throw new Error('SOURCE_AUTHORITY_PROJECT_UNAUTHORIZED');
    return reviewerId;
  }
  async function load(ownerId: string, projectId: string, digest: string) {
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('SOURCE_AUTHORITY_SNAPSHOT_INVALID');
    const row = await deps.loadSnapshot(ownerId, projectId, digest);
    const context = row ? normalizeScriptPlannerEditorialContext(row.editorial_context) : null;
    if (!context || !validateOwnedSourceSnapshot({ ownerUserId: ownerId, projectId, context, snapshot: row }) || sourceAuthoritySnapshotDigest(context) !== digest) throw new Error('SOURCE_AUTHORITY_SNAPSHOT_INVALID');
    return context;
  }
  async function freeze(input: { token: string; ownerId: string; projectId: string; context: unknown }) {
    await authorize(input.token, input.ownerId, input.projectId);
    const context = normalizeScriptPlannerEditorialContext(input.context);
    if (!context) throw new Error('SOURCE_AUTHORITY_SNAPSHOT_INVALID');
    const snapshot_digest = sourceAuthoritySnapshotDigest(context);
    await deps.insertSnapshot({ owner_user_id: input.ownerId, project_id: input.projectId, snapshot_digest, editorial_context: context });
    return { snapshotDigest: snapshot_digest };
  }
  async function inspect(input: { token: string; ownerId: string; projectId: string; snapshotDigest: string; claimId: string; evidenceId: string }) {
    const reviewerId = await authorize(input.token, input.ownerId, input.projectId);
    const context = await load(input.ownerId, input.projectId, input.snapshotDigest);
    const now = deps.now();
    let inspected: { documentDigest: string; sourceUrl: string; documentContent: string; passage: string; claimText: string } | null = null;
    await prepareReviewedSourceAuthorityRecord({ ownerUserId: input.ownerId, projectId: input.projectId, reviewerUserId: reviewerId, context, claimId: input.claimId, evidenceId: input.evidenceId, now, expiresAt: new Date(Date.parse(now) + 86400_000).toISOString(), dependencies: {
      authorizeReview: async () => ({ authorized: true, basis: 'server_verified_reviewer_allowlist' }), acquire: deps.acquire,
      review: async (details) => { inspected = details; return { publisherAuthoredDocument: false, classification: 'unknown', basis: 'inspection only; no authority issued' }; },
    } });
    if (!inspected) throw new Error('SOURCE_AUTHORITY_INSPECTION_FAILED');
    return inspected;
  }
  async function issue(input: { token: string; ownerId: string; projectId: string; snapshotDigest: string; claimId: string; evidenceId: string; expiresAt: string; decision: Decision }) {
    const reviewerId = await authorize(input.token, input.ownerId, input.projectId);
    const context = await load(input.ownerId, input.projectId, input.snapshotDigest);
    const record = await prepareReviewedSourceAuthorityRecord({ ownerUserId: input.ownerId, projectId: input.projectId, reviewerUserId: reviewerId, context, claimId: input.claimId, evidenceId: input.evidenceId, expiresAt: input.expiresAt, now: deps.now(), dependencies: {
      authorizeReview: async () => ({ authorized: true, basis: 'server_verified_reviewer_allowlist' }),
      acquire: deps.acquire,
      review: async (details) => {
        if (!input.decision || details.documentDigest !== input.decision.documentDigest) throw new Error('SOURCE_AUTHORITY_REVIEW_DOCUMENT_CHANGED');
        return input.decision;
      },
    } });
    await deps.insertRecord(record);
    return { snapshotDigest: record.snapshot_digest, claimId: record.claim_id, evidenceId: record.evidence_id };
  }
  return { freeze, inspect, issue };
}
