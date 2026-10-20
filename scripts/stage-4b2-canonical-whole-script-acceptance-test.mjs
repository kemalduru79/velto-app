import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import { assessStage4B2CanonicalWholeScript, canonicalSnapshotPayloadSha256, missingStage4B2CanonicalSnapshotReport, STAGE4B2_CANONICAL_SNAPSHOT_VERSION } from "../lib/creator/creatorScriptCanonicalAcceptance.ts";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const sources = Array.from({ length: 7 }, (_, index) => ({ sourceId: `source-${index + 1}`, adapterId: "academic", mediaKind: "paper", externalId: `paper-${index + 1}`, title: `Source ${index + 1}`, url: `https://research.test/paper-${index + 1}`, publisher: "Research", author: "Author", publishedAt: "2026-01-01", language: "en", summary: null, thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {} }));
const claims = Array.from({ length: 7 }, (_, index) => ({ claimId: `claim-${index + 1}`, claimType: "RESEARCH_FINDING", text: `Finding ${index + 1} is bounded by its evidence.`, propositionKind: "original_research_result", origin: { attributedEntity: "Author", referencedWork: sources[index].url }, supportingEvidenceIds: index < 6 ? [`evidence-${index * 2 + 1}`, `evidence-${index * 2 + 2}`] : ["evidence-13"] }));
const evidence = Array.from({ length: 13 }, (_, index) => ({ evidenceId: `evidence-${index + 1}`, sourceId: `source-${Math.min(7, Math.floor(index / 2) + 1)}`, excerpt: `Verified bounded evidence passage number ${index + 1} supports only its recorded claim.`, contextNote: null, locator: { section: "results", page: index + 1, timecodeStartSec: null, timecodeEndSec: null } }));
const documents = sources.map((source) => { const content = evidence.filter((item) => item.sourceId === source.sourceId).map((item) => item.excerpt).join("\n"); return { sourceId: source.sourceId, url: source.url, content, acquisition: "trusted_fixture", authority: "original_research", expectedSha256: sha(content) }; });
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve authority.", readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] }, claims: claims.map((claim) => ({ claimId: claim.claimId, claimType: "FACT", text: claim.text, supportingEvidenceIds: claim.supportingEvidenceIds, counterEvidenceIds: [], contextualEvidenceIds: [] })), evidence, sources: sources.map((source) => ({ sourceId: source.sourceId, title: source.title, url: source.url, publisher: source.publisher, author: source.author, publishedAt: source.publishedAt, directness: "secondary", reviewStatus: "usable", searchLane: "supporting_evidence", sourceKind: "article" })) };
const script = createCreatorScript({ title: "Private canonical fixture", sections: [{ id: "opening", kind: "opening", text: words("opening", 120), claimIds: ["claim-1"], evidenceReviewRequired: false }, ...[1, 2, 3].map((number) => ({ id: `body-${number}`, kind: "body", text: words(`body-${number}-`, 285), claimIds: [`claim-${number + 1}`, `claim-${number + 4}`].filter((id) => Number(id.split("-")[1]) <= 7), evidenceReviewRequired: false })), { id: "conclusion", kind: "conclusion", text: words("conclusion", 120), claimIds: [], evidenceReviewRequired: false }], targetDurationSec: 480, strategyFingerprint: "fixture", grounding: { context }, generatedAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" });
const base = { version: STAGE4B2_CANONICAL_SNAPSHOT_VERSION, authorization: { kind: "owner_supplied_read_only", approvedAt: "2026-10-20T00:00:00.000Z" }, language: "en", script, sceneIds: Array.from({ length: 36 }, (_, index) => `scene-${index + 1}`), canonicalSceneIds: Array.from({ length: 36 }, (_, index) => `scene-${index + 1}`), sources, claims, evidence, originalDocuments: documents, semanticAssessments: claims.map((claim) => ({ claimId: claim.claimId, status: "supported", evidenceIds: claim.supportingEvidenceIds, authority: "independent_human_review" })), factualAssertions: claims.map((claim) => ({ assertionId: `assertion-${claim.claimId}`, sectionId: "opening", claimIds: [claim.claimId], textSha256: sha(claim.text) })), editorialReview: { authority: "independent_human_review", englishClarity: true, narrativeProgression: true, factualPrecision: true, repetitionAcceptable: true, wordBoundariesValid: true } };
const seal = (value) => ({ ...structuredClone(value), expectedSnapshotSha256: canonicalSnapshotPayloadSha256(value) });

assert.equal(missingStage4B2CanonicalSnapshotReport().status, "REVIEW_REQUIRED");
const admittedSnapshot = seal(base);
const accepted = assessStage4B2CanonicalWholeScript(admittedSnapshot);
assert.equal(accepted.status, "PASS"); assert.equal(accepted.zeroWrite, true); assert.equal(accepted.closeStage4B2, false); assert.equal(accepted.metrics.acceptedClaims, 7);
for (const mutate of [
  (item) => { item.evidence[0].excerpt = "Fabricated evidence passage that never appeared in the original document."; },
  (item) => { item.semanticAssessments[0].status = "unsupported"; },
  (item) => { item.sceneIds.pop(); },
  (item) => { item.sources[0].url = "https://substitute.test/paper"; },
]) { const candidate = structuredClone(base); mutate(candidate); const report = assessStage4B2CanonicalWholeScript(seal(candidate)); assert.equal(report.status, "BLOCKED"); assert.equal(report.zeroWrite, true); }
const mutatedAfterAdmission = structuredClone(admittedSnapshot); mutatedAfterAdmission.script.sections[0].text += " Mutated.";
assert.equal(assessStage4B2CanonicalWholeScript(mutatedAfterAdmission).status, "BLOCKED", "post-admission script mutation invalidates the immutable snapshot hash");
const unreviewed = structuredClone(base); unreviewed.semanticAssessments = []; unreviewed.editorialReview = undefined;
assert.equal(assessStage4B2CanonicalWholeScript(seal(unreviewed)).status, "REVIEW_REQUIRED");
console.log("STAGE_4B2_CANONICAL_WHOLE_SCRIPT_ACCEPTANCE=PASS");
