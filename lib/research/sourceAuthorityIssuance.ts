import { verifyOriginalSourceEvidence, type OriginalSourceDocument } from "./originalSourceEvidence.ts";
import { sourceAuthorityPassageDigest, sourceAuthoritySnapshotDigest, sourceAuthoritySourceDigest } from "./sourceAuthorityBoundary.ts";
import type { ScriptPlannerEditorialContext } from "./scriptPlannerEditorialContext.ts";
import type { ResearchSource } from "./sourceContract.ts";

// The production workflow supplies trusted server-side dependencies. Never
// pass these callbacks through an HTTP boundary.
export async function prepareReviewedSourceAuthorityRecord(input: {
  ownerUserId: string;
  projectId: string;
  reviewerUserId: string;
  context: ScriptPlannerEditorialContext;
  claimId: string;
  evidenceId: string;
  expiresAt: string;
  now: string;
  dependencies: {
    authorizeReview: (scope: { ownerUserId: string; projectId: string; reviewerUserId: string; snapshotDigest: string }) => Promise<{ authorized: boolean; basis: string }>;
    acquire: (source: ResearchSource) => Promise<OriginalSourceDocument>;
    review: (details: { reviewerUserId: string; snapshotDigest: string; claimId: string; evidenceId: string; documentDigest: string; sourceUrl: string; documentContent: string; passage: string; claimText: string }) => Promise<{ publisherAuthoredDocument: boolean; classification: "original_research" | "primary_document" | "secondary" | "unknown"; basis: string }>;
  };
}) {
  const snapshot = sourceAuthoritySnapshotDigest(input.context);
  const authorization = await input.dependencies.authorizeReview({ ownerUserId: input.ownerUserId, projectId: input.projectId, reviewerUserId: input.reviewerUserId, snapshotDigest: snapshot });
  if (!authorization.authorized || !authorization.basis.trim()) throw new Error("REVIEWER_OR_SNAPSHOT_UNAUTHORIZED");
  const claim = input.context.claims.find((item) => item.claimId === input.claimId);
  const evidence = input.context.evidence.find((item) => item.evidenceId === input.evidenceId);
  if (!claim || !evidence || ![...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds].includes(evidence.evidenceId)) throw new Error("CLAIM_EVIDENCE_LINK_REQUIRED");
  const source = input.context.sources.find((item) => item.sourceId === evidence.sourceId);
  if (!source) throw new Error("SOURCE_MISSING");
  const researchSource: ResearchSource = { sourceId: source.sourceId, adapterId: "web", mediaKind: "other", externalId: null, title: source.title, url: source.url, publisher: source.publisher, author: source.author, publishedAt: source.publishedAt, language: null, summary: null, thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {} };
  const document = await input.dependencies.acquire(researchSource);
  // A caller-provided authority classification has no bearing on passage matching.
  const result = verifyOriginalSourceEvidence({ source: researchSource, evidence, document: { ...document, authority: "unknown" } });
  if (document.acquisition !== "trusted_fetch" || result.state !== "source_verified" || !result.sourceDocumentFingerprint) throw new Error("PASSAGE_NOT_IN_SERVER_ACQUIRED_DOCUMENT");
  const now = Date.parse(input.now), expires = Date.parse(input.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expires) || expires <= now || expires - now > 30 * 86400_000) throw new Error("REVIEW_EXPIRY_INVALID");
  const review = await input.dependencies.review({ reviewerUserId: input.reviewerUserId, snapshotDigest: snapshot, claimId: claim.claimId, evidenceId: evidence.evidenceId, documentDigest: result.sourceDocumentFingerprint, sourceUrl: source.url, documentContent: document.content, passage: result.passage, claimText: claim.text });
  if (!review.basis.trim() || !["original_research", "primary_document", "secondary", "unknown"].includes(review.classification)) throw new Error("REVIEW_DECISION_INVALID");
  if (typeof review.publisherAuthoredDocument !== "boolean" || (["original_research", "primary_document"].includes(review.classification) && review.publisherAuthoredDocument !== true)) throw new Error("PUBLISHER_AUTHORSHIP_UNCONFIRMED");
  return { owner_user_id: input.ownerUserId, project_id: input.projectId, reviewer_user_id: input.reviewerUserId, reviewer_authorization: authorization.basis, review_basis: review.basis, publisher_authorship_confirmed: review.publisherAuthoredDocument, snapshot_digest: snapshot, source_id: source.sourceId, claim_id: claim.claimId, evidence_id: evidence.evidenceId, source_digest: sourceAuthoritySourceDigest(source), passage_digest: sourceAuthorityPassageDigest(evidence), passage_verification: "exact_source_match", authority_classification: review.classification, document_digest: result.sourceDocumentFingerprint, qualification_method: "authorized_human_claim_review", qualified_at: input.now, expires_at: input.expiresAt };
}
