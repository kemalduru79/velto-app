import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import { assessStage4B2CanonicalWholeScript, canonicalAcceptanceSha256, missingStage4B2CanonicalSnapshotReport, STAGE4B2_CANONICAL_MANIFEST_VERSION, STAGE4B2_CANONICAL_SNAPSHOT_VERSION } from "../lib/creator/creatorScriptCanonicalAcceptance.ts";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const sources = Array.from({ length: 7 }, (_, index) => ({ sourceId: `source-${index + 1}`, adapterId: "academic", mediaKind: "paper", externalId: `paper-${index + 1}`, title: `Source ${index + 1}`, url: `https://research.test/paper-${index + 1}`, publisher: "Research", author: "Author", publishedAt: "2026-01-01", language: "en", summary: null, thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {} }));
const evidence = Array.from({ length: 13 }, (_, index) => ({ evidenceId: `evidence-${index + 1}`, sourceId: `source-${Math.min(7, Math.floor(index / 2) + 1)}`, excerpt: `Verified bounded evidence passage number ${index + 1} supports only its recorded claim.`, contextNote: null, locator: { section: "results", page: index + 1, timecodeStartSec: null, timecodeEndSec: null } }));
const claims = Array.from({ length: 7 }, (_, index) => ({ claimId: `claim-${index + 1}`, claimType: "FACT", text: `Finding ${index + 1} is bounded by its evidence.`, supportingEvidenceIds: index < 6 ? [`evidence-${index * 2 + 1}`, `evidence-${index * 2 + 2}`] : ["evidence-13"], counterEvidenceIds: [], contextualEvidenceIds: [] }));
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve authority.", readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] }, claims, evidence, sources: sources.map((source) => ({ sourceId: source.sourceId, title: source.title, url: source.url, publisher: source.publisher, author: source.author, publishedAt: source.publishedAt, directness: "secondary", reviewStatus: "usable", searchLane: "supporting_evidence", sourceKind: "article" })) };
const script = createCreatorScript({ title: "Private canonical fixture", sections: [{ id: "opening", kind: "opening", text: words("opening", 120), claimIds: ["claim-1"], evidenceReviewRequired: false }, ...[1, 2, 3].map((number) => ({ id: `body-${number}`, kind: "body", text: words(`body-${number}-`, 285), claimIds: [`claim-${number + 1}`, `claim-${number + 4}`].filter((id) => Number(id.split("-")[1]) <= 7), evidenceReviewRequired: false })), { id: "conclusion", kind: "conclusion", text: words("conclusion", 120), claimIds: [], evidenceReviewRequired: false }], targetDurationSec: 480, strategyFingerprint: "fixture", grounding: { context }, generatedAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" });
const documents = sources.map((source) => { const content = evidence.filter((item) => item.sourceId === source.sourceId).map((item) => item.excerpt).join("\n"); return { sourceId: source.sourceId, url: source.url, content, acquisition: "trusted_fixture", authority: "original_research", expectedSha256: sha(content) }; });
const factualAssertions = claims.map((claim, index) => { const section = script.sections[index % 4]; const start = 0; const end = Math.min(24, section.text.length); return { assertionId: `assertion-${index + 1}`, sectionId: section.id, start, end, claimIds: [claim.claimId], textSha256: sha(section.text.slice(start, end)) }; });
const snapshot = { version: STAGE4B2_CANONICAL_SNAPSHOT_VERSION, language: "en", projectIdentitySha256: sha("synthetic-project"), projectRevision: "synthetic-revision-1", script, sceneIds: Array.from({ length: 36 }, (_, index) => `scene-${index + 1}`), canonicalSceneIds: Array.from({ length: 36 }, (_, index) => `scene-${index + 1}`), sources, claims: script.grounding.context.claims, evidence: script.grounding.context.evidence, originalDocuments: documents, factualAssertions };
const manifestFor = (value, trustClass = "synthetic_fixture") => ({ version: STAGE4B2_CANONICAL_MANIFEST_VERSION, trustClass, projectIdentitySha256: value.projectIdentitySha256, projectRevision: value.projectRevision, snapshotSha256: canonicalAcceptanceSha256(value), scriptSha256: canonicalAcceptanceSha256(value.script), groundingSha256: canonicalAcceptanceSha256(value.script.grounding.context), sceneIdentitySha256: canonicalAcceptanceSha256([value.sceneIds, value.canonicalSceneIds]), scriptRevision: 1, targetDurationSec: 480, sectionIds: value.script.sections.map((section) => section.id), sceneIds: value.sceneIds, canonicalSceneIds: value.canonicalSceneIds, sourceEvidenceAttestations: documents.map((document) => ({ sourceId: document.sourceId, documentSha256: sha(document.content), acquisitionReceiptSha256: sha(`receipt:${document.sourceId}`) })), semanticAssessments: claims.map((claim) => ({ claimId: claim.claimId, status: "supported", evidenceIds: claim.supportingEvidenceIds })), semanticReviewReceiptSha256: sha("semantic-review"), editorialReview: { englishClarity: true, narrativeProgression: true, factualPrecision: true, repetitionAcceptable: true, wordBoundariesValid: true, reviewReceiptSha256: sha("editorial-review") }, factualInventoryReview: { complete: true, inventorySha256: canonicalAcceptanceSha256(value.factualAssertions), reviewReceiptSha256: sha("inventory-review") } });
const admit = (value, trustClass) => { const manifest = manifestFor(value, trustClass); return { manifest, expectedManifestSha256: canonicalAcceptanceSha256(manifest), boundary: "detached_read_only_hash_pin" }; };

assert.equal(missingStage4B2CanonicalSnapshotReport().status, "REVIEW_REQUIRED");
const fixture = assessStage4B2CanonicalWholeScript(snapshot, admit(snapshot, "synthetic_fixture"));
assert.equal(fixture.componentStatus, "REVIEW_REQUIRED"); assert.equal(fixture.status, "REVIEW_REQUIRED"); assert.equal(fixture.actualCanonicalSnapshot, false); assert.equal(fixture.canonicalAdmissionVerified, false); assert.equal(fixture.syntheticFixture, true); assert.equal(fixture.closeStage4B2, false); assert.equal(fixture.zeroWrite, true); assert.equal(fixture.persistedProjectImmutabilityVerified, false);

const forged = structuredClone(snapshot); forged.script.sections[0].text += " forged";
assert.equal(assessStage4B2CanonicalWholeScript(forged, admit(snapshot, "authenticated_canonical")).status, "BLOCKED");
const substituteGraph = structuredClone(snapshot); substituteGraph.claims = substituteGraph.claims.map((claim, index) => index === 0 ? { ...claim, text: "Substituted claim" } : claim);
const substituteReport = assessStage4B2CanonicalWholeScript(substituteGraph, admit(substituteGraph, "synthetic_fixture"));
assert.equal(substituteReport.checks.find((item) => item.id === "CANONICAL_GROUNDING_GRAPH")?.status, "BLOCKED");
assert.equal(substituteReport.status, "BLOCKED");
const inventedReviews = admit(snapshot, "authenticated_canonical");
const inventedReviewReport = assessStage4B2CanonicalWholeScript(snapshot, inventedReviews);
assert.equal(inventedReviewReport.status, "REVIEW_REQUIRED", "trusted_fixture documents cannot cross canonical source authority");
assert.equal(inventedReviewReport.actualCanonicalSnapshot, false, "a claimed canonical label and self-pinned receipts do not prove provenance");
assert.ok(inventedReviewReport.missingRequirements.includes("INDEPENDENT_PERSISTED_BASELINE_AUTHORITY_REQUIRED"));
const incomplete = structuredClone(snapshot); incomplete.factualAssertions = [incomplete.factualAssertions[0]];
const incompleteAdmission = admit(incomplete, "synthetic_fixture"); incompleteAdmission.manifest.factualInventoryReview.complete = false; incompleteAdmission.expectedManifestSha256 = canonicalAcceptanceSha256(incompleteAdmission.manifest);
assert.equal(assessStage4B2CanonicalWholeScript(incomplete, incompleteAdmission).status, "REVIEW_REQUIRED");
const corruptedSpan = structuredClone(snapshot); corruptedSpan.factualAssertions[0].textSha256 = "0".repeat(64);
assert.equal(assessStage4B2CanonicalWholeScript(corruptedSpan, admit(corruptedSpan, "synthetic_fixture")).status, "BLOCKED");
for (const invalid of [null, {}, { ...snapshot, sceneIds: "36" }, { ...snapshot, claims: null }, { ...snapshot, sources: {} }, { ...snapshot, factualAssertions: "complete" }, { ...snapshot, sceneIds: [""], canonicalSceneIds: [""] }]) {
  const report = assessStage4B2CanonicalWholeScript(invalid, {}); assert.equal(report.status, "BLOCKED"); assert.equal(report.actualCanonicalSnapshot, false);
}
assert.equal(assessStage4B2CanonicalWholeScript(undefined, undefined).status, "BLOCKED");
assert.equal(assessStage4B2CanonicalWholeScript(1n, {}).status, "BLOCKED");
const circular = {}; circular.self = circular;
assert.equal(assessStage4B2CanonicalWholeScript(circular, {}).status, "BLOCKED");
const duplicateScenes = structuredClone(snapshot); duplicateScenes.sceneIds[1] = duplicateScenes.sceneIds[0];
assert.equal(assessStage4B2CanonicalWholeScript(duplicateScenes, admit(duplicateScenes, "synthetic_fixture")).status, "BLOCKED");
console.log("STAGE_4B2_CANONICAL_WHOLE_SCRIPT_ACCEPTANCE=PASS");
