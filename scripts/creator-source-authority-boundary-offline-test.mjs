import assert from 'node:assert/strict';
import { sourceAuthoritySnapshotDigest, sourceAuthoritySourceDigest, sourceAuthorityPassageDigest, validateOwnedSourceSnapshot, validateSourceAuthorityRecords } from '../lib/research/sourceAuthorityBoundary.ts';
import { normalizeScriptPlannerEditorialContext } from '../lib/research/scriptPlannerEditorialContext.ts';

const context = {
  version: '0.10H-2H', sourceVersion: '0.10H-2E', editorialConstitution: 'grounded',
  readiness: { status: 'ready', editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: ['c1'], primarySourceCoveredClaimIds: ['c1'] },
  claims: [{ claimId: 'c1', claimType: 'PRIMARY_SOURCE_CLAIM', text: 'A finding', supportingEvidenceIds: ['e1'], counterEvidenceIds: [], contextualEvidenceIds: [] }],
  evidence: [{ evidenceId: 'e1', sourceId: 's1', excerpt: 'A sufficiently long quoted source passage.', contextNote: '', locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }],
  sources: [{ sourceId: 's1', title: 'Study', url: 'https://example.org/study', publisher: 'Example', author: null, publishedAt: null, directness: 'primary', reviewStatus: 'usable', searchLane: 'academic', sourceKind: 'paper' }],
};
const record = { owner_user_id: 'user1', project_id: 'project1', snapshot_digest: sourceAuthoritySnapshotDigest(context), source_id: 's1', claim_id: 'c1', evidence_id: 'e1', source_digest: sourceAuthoritySourceDigest(context.sources[0]), passage_digest: sourceAuthorityPassageDigest(context.evidence[0]), passage_verification: 'exact_source_match', authority_classification: 'original_research', expires_at: '2030-01-01T00:00:00Z' };
const check = (ctx = context, records = [record], user = 'user1', project = 'project1') => validateSourceAuthorityRecords({ context: ctx, records, ownerUserId: user, projectId: project, now: Date.parse('2026-01-01T00:00:00Z') });
const snapshot = { owner_user_id: 'user1', project_id: 'project1', snapshot_digest: sourceAuthoritySnapshotDigest(context), editorial_context: context };
assert.equal(validateOwnedSourceSnapshot({ ownerUserId: 'user1', projectId: 'project1', context, snapshot }), true);
assert.equal(validateOwnedSourceSnapshot({ ownerUserId: 'user2', projectId: 'project1', context, snapshot }), false);
assert.equal(validateOwnedSourceSnapshot({ ownerUserId: 'user1', projectId: 'project2', context, snapshot }), false);
assert.equal(validateOwnedSourceSnapshot({ ownerUserId: 'user1', projectId: 'project1', context, snapshot: { ...snapshot, editorial_context: { ...context, editorialConstitution: 'tampered' } } }), false);
assert.equal(sourceAuthoritySnapshotDigest(context), sourceAuthoritySnapshotDigest(Object.fromEntries(Object.entries(context).reverse())));
assert.equal(check().ok, true);
assert.equal(check(context, []).ok, false); // spoofed provenance and primary/academic/paper without a server record
assert.equal(check({ ...context, sources: [{ ...context.sources[0], provenanceVerified: true, provenanceKind: 'original_academic_paper' }] }).ok, false);
assert.equal(check(context, [{ ...record, authority_classification: 'secondary' }]).ok, false);
assert.equal(check(context, [record], 'user2').ok, false);
assert.equal(check(context, [record], 'user1', 'project2').ok, false);
assert.equal(check({ ...context, readiness: { ...context.readiness, editorialReadinessScore: 99 } }).ok, false);
assert.equal(check({ ...context, sources: [{ ...context.sources[0], url: 'https://example.org/other' }] }).ok, false);
assert.equal(check({ ...context, evidence: [{ ...context.evidence[0], excerpt: 'Tampered excerpt' }] }).ok, false);
assert.equal(check(context, [{ ...record, expires_at: '2025-01-01T00:00:00Z' }]).ok, false);
const missingPrimary = { ...context, sources: [{ ...context.sources[0], directness: 'secondary', searchLane: 'web', sourceKind: 'article' }] };
const secondary = { ...record, snapshot_digest: sourceAuthoritySnapshotDigest(missingPrimary), source_digest: sourceAuthoritySourceDigest(missingPrimary.sources[0]), authority_classification: 'secondary' };
assert.equal(check(missingPrimary, [secondary]).ok, false);
console.log('SOURCE_AUTHORITY_BOUNDARY_OFFLINE=PASS');

// Exercise the real POST boundary with an authenticated owner and a synthetic
// database response. No database connection or provider is used.
const { createOfflineScriptPlanHarness } = await import('./fixtures/creator-script-plan-offline-harness.mjs');
const raw = { ...context, version: '0.10H-2E' };
const normalized = normalizeScriptPlannerEditorialContext(raw);
const query = { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: { owner_user_id: 'user1', project_id: 'project1', snapshot_digest: sourceAuthoritySnapshotDigest(normalized), editorial_context: normalized }, error: null }); }, then(resolve) { resolve({ data: [], error: null }); } };
const harness = await createOfflineScriptPlanHarness({ includePost: true, authenticatedUserId: 'user1', readProjectForOwner: async () => ({ flow_type: 'creator_lab' }), authorityQuery: () => query });
const response = await harness.post(new Request('http://localhost/api/creator-script-plan', { method: 'POST', headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'source_scenes', projectId: 'project1', scriptContext: raw, productionPackage: { scenes: [] } }) }));
assert.equal(response.status, 422);
assert.equal((await response.json()).code, 'CREATOR_SCRIPT_SOURCE_AUTHORITY_UNVERIFIED');
assert.equal(harness.calls.length, 0);
console.log('SOURCE_AUTHORITY_REAL_POST_BYPASS=PASS');

// Simulated human review: the callbacks below are mocks, not an authorization
// system and not evidence that the saved METR research was reviewed.
const { prepareReviewedSourceAuthorityRecord } = await import('../lib/research/sourceAuthorityIssuance.ts');
const deps = {
  authorizeReview: async () => ({ authorized: true, basis: 'synthetic reviewer allowlist' }),
  acquire: async (source) => ({ sourceId: source.sourceId, url: source.url, content: `Header ${context.evidence[0].excerpt} Footer`, acquisition: 'trusted_fetch', authority: 'unknown' }),
  review: async () => ({ publisherAuthoredDocument: true, classification: 'original_research', basis: 'synthetic claim-specific publisher review' }),
};
const issue = (overrides = {}) => prepareReviewedSourceAuthorityRecord({ ownerUserId: 'user1', projectId: 'project1', reviewerUserId: 'reviewer1', context, claimId: 'c1', evidenceId: 'e1', now: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z', dependencies: deps, ...overrides });
const issued = await issue();
assert.equal(issued.claim_id, 'c1');
assert.equal(issued.reviewer_user_id, 'reviewer1');
assert.equal(check(context, [issued]).ok, true);
await assert.rejects(() => issue({ dependencies: { ...deps, authorizeReview: async () => ({ authorized: false, basis: '' }) } }), /UNAUTHORIZED/);
await assert.rejects(() => issue({ dependencies: { ...deps, acquire: async source => ({ sourceId: source.sourceId, url: source.url, content: 'unrelated text', acquisition: 'trusted_fetch', authority: 'original_research' }) } }), /PASSAGE_NOT_IN_SERVER_ACQUIRED_DOCUMENT/);
await assert.rejects(() => issue({ dependencies: { ...deps, review: async () => ({ publisherAuthoredDocument: false, classification: 'original_research', basis: 'assertion' }) } }), /AUTHORSHIP_UNCONFIRMED/);
assert.equal(check(context, [{ ...issued, claim_id: 'other-claim' }]).ok, false);
console.log('SOURCE_AUTHORITY_MOCK_REVIEW_CHAIN=PASS');

const { createSourceAuthorityWorkflow } = await import('../lib/research/sourceAuthorityWorkflow.ts');
const rows = new Map(), written = [];
const workflowDeps = {
  enabled: true,
  authenticateReviewer: async token => token === 'verified-reviewer-token' ? 'reviewer1' : null,
  ownsProject: async (owner, project) => owner === 'user1' && project === 'project1',
  insertSnapshot: async row => { if (rows.has(row.snapshot_digest)) throw Error('duplicate'); rows.set(row.snapshot_digest, structuredClone(row)); },
  loadSnapshot: async (_owner, _project, hash) => rows.get(hash) ?? null,
  acquire: deps.acquire,
  insertRecord: async row => { written.push(structuredClone(row)); },
  now: () => '2026-01-01T00:00:00Z',
};
const wf = createSourceAuthorityWorkflow(workflowDeps);
const common = { token: 'verified-reviewer-token', ownerId: 'user1', projectId: 'project1' };
const frozen = await wf.freeze({ ...common, context: raw });
const selection = { ...common, snapshotDigest: frozen.snapshotDigest, claimId: 'c1', evidenceId: 'e1' };
const examined = await wf.inspect(selection);
const decision = { publisherAuthoredDocument: true, classification: 'original_research', basis: 'Human verified the original study for this claim.', documentDigest: examined.documentDigest };
await wf.issue({ ...selection, decision, expiresAt: '2026-01-02T00:00:00Z' });
assert.equal(written.length, 1);
assert.equal(validateSourceAuthorityRecords({ ownerUserId: 'user1', projectId: 'project1', context: normalized, records: written, now: Date.parse('2026-01-01T00:00:00Z') }).ok, true);
await assert.rejects(() => wf.issue({ ...selection, token: 'forged', decision, expiresAt: '2026-01-02T00:00:00Z' }), /UNAUTHORIZED/);
await assert.rejects(() => wf.issue({ ...selection, projectId: 'other', decision, expiresAt: '2026-01-02T00:00:00Z' }), /UNAUTHORIZED/);
await assert.rejects(() => wf.issue({ ...selection, decision: { ...decision, documentDigest: 'forged' }, expiresAt: '2026-01-02T00:00:00Z' }), /DOCUMENT_CHANGED/);
await assert.rejects(() => wf.issue({ ...selection, decision, expiresAt: '2025-01-01T00:00:00Z' }), /EXPIRY/);
await assert.rejects(() => createSourceAuthorityWorkflow({ ...workflowDeps, enabled: false }).freeze({ ...common, context: raw }), /DISABLED/);
rows.get(frozen.snapshotDigest).editorial_context.claims[0].text = 'altered';
await assert.rejects(() => wf.issue({ ...selection, decision, expiresAt: '2026-01-02T00:00:00Z' }), /SNAPSHOT_INVALID/);
assert.equal(written.length, 1);
console.log('SOURCE_AUTHORITY_MOCK_END_TO_END=PASS');
