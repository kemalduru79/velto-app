import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  approveCreatorScript,
  assertCreatorScriptVerificationAuthority,
  createCreatorScript,
  createCreatorStrategyFingerprint,
  editCreatorScriptDocument,
  editCreatorScriptSection,
  getCreatorScriptDocumentText,
  getCreatorScriptSectionSourceReview,
  isCreatorScriptCurrentForStrategy,
  normalizeCreatorScript,
  verifyCreatorScriptSectionSources,
} from "../lib/creator/creatorScript.ts";

const generatedAt = "2026-09-14T10:00:00.000Z";
const strategyFingerprint = "creator-strategy-v1-test";
const script = createCreatorScript({
  title: "Continuous script",
  targetDurationSec: 10,
  strategyFingerprint,
  generatedAt,
  updatedAt: generatedAt,
  grounding: {
    context: {
      version: "0.10H-2H",
      sourceVersion: "0.10H-2E",
      editorialConstitution: "Explain material claims accurately and preserve uncertainty.",
      claims: [{
        claimId: "claim-1",
        text: "The verified fact is explained carefully.",
        claimType: "FACT",
        supportingEvidenceIds: ["evidence-1"],
        counterEvidenceIds: [],
        contextualEvidenceIds: [],
      }],
      evidence: [{ evidenceId: "evidence-1", sourceId: "source-1", excerpt: "Verified fact", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }],
      sources: [{ sourceId: "source-1", title: "Source", url: "https://example.test/source", publisher: "Example", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }],
      readiness: { status: "ready", editorialReadinessScore: 92, reviewReasons: [] },
    },
  },
  sections: [
    { id: "opening", kind: "opening", heading: "Opening", text: "An opening with enough words to begin this complete editorial document.", claimIds: [], evidenceReviewRequired: false },
    { id: "body", kind: "body", heading: "Evidence", text: "The verified fact is explained carefully with context for the creator audience.", claimIds: ["claim-1"], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", heading: "Conclusion", text: "The conclusion resolves the narrative and gives the audience a useful takeaway.", claimIds: [], evidenceReviewRequired: false },
  ],
});
const canonicalStrategyInput = { topic: "Stable topic", selectedDirectionId: "direction-a", selectedHook: "hook-a", targetDurationSec: 10, creatorProfile: { brandName: "Project brand" } };
const stableFingerprint = createCreatorStrategyFingerprint(canonicalStrategyInput);
assert.equal(stableFingerprint, createCreatorStrategyFingerprint(JSON.parse(JSON.stringify(canonicalStrategyInput))));
assert.notEqual(stableFingerprint, createCreatorStrategyFingerprint({ ...canonicalStrategyInput, selectedDirectionId: "direction-b" }));
assert.notEqual(stableFingerprint, createCreatorStrategyFingerprint({ ...canonicalStrategyInput, selectedHook: "hook-b" }));
assert.notEqual(stableFingerprint, createCreatorStrategyFingerprint({ ...canonicalStrategyInput, targetDurationSec: 20 }));

const document = getCreatorScriptDocumentText(script);
assert.equal(document, script.sections.map((section) => section.text).join("\n\n"));

// A. A sentence edit is confined to its canonical section.
const editedOpening = editCreatorScriptDocument(
  script,
  document.replace("An opening", "A creator-written opening"),
  "2026-09-14T10:05:00.000Z",
);
assert.equal(editedOpening.revision, script.revision + 1);
assert.equal(editedOpening.approval, null);
assert.match(editedOpening.sections[0].text, /creator-written opening/);
assert.equal(editedOpening.sections[1].text, script.sections[1].text);
assert.deepEqual(editedOpening.sections[1].claimIds, script.sections[1].claimIds);
assert.deepEqual(editedOpening.grounding, script.grounding);
assert.deepEqual(editedOpening.sections[1], script.sections[1]);
assert.deepEqual(editedOpening.sections[2], script.sections[2]);
assert.equal(isCreatorScriptCurrentForStrategy({ script: editedOpening, strategyFingerprint, targetDurationSec: 10, language: "en" }), true);
assert.doesNotThrow(() => approveCreatorScript(editedOpening, strategyFingerprint));

// B. A long insertion cannot pull the following section across its stable boundary.
const longParagraph = " This is a long creator-written paragraph with substantial additional context, pacing, explanation, and narrative detail that remains wholly inside the opening section.";
const insertedOpening = editCreatorScriptDocument(
  script,
  document.replace("complete editorial document.", `complete editorial document.${longParagraph}`),
);
assert.match(insertedOpening.sections[0].text, /substantial additional context/);
assert.deepEqual(insertedOpening.sections[1], script.sections[1]);
assert.deepEqual(insertedOpening.sections[2], script.sections[2]);

// C. A deletion inside the middle section leaves both neighbors byte-for-byte exact.
const deletedMiddle = editCreatorScriptDocument(
  script,
  document.replace(" carefully with context", ""),
);
assert.deepEqual(deletedMiddle.sections[0], script.sections[0]);
assert.deepEqual(deletedMiddle.sections[2], script.sections[2]);
assert.equal(deletedMiddle.sections[1].evidenceReviewRequired, true);
assert.equal(isCreatorScriptCurrentForStrategy({ script: deletedMiddle, strategyFingerprint, targetDurationSec: 10, language: "en" }), true);
assert.throws(() => approveCreatorScript(deletedMiddle, strategyFingerprint), /CREATOR_SCRIPT_GROUNDING_BLOCKED/);
const sourceReview = getCreatorScriptSectionSourceReview(deletedMiddle, "body");
assert.equal(sourceReview?.items[0]?.statement, "The verified fact is explained carefully.");
assert.equal(sourceReview?.items[0]?.sources[0]?.sourceTitle, "Source");
const manuallyVerified = verifyCreatorScriptSectionSources(deletedMiddle, "body", "2026-09-14T10:10:00.000Z");
assert.equal(manuallyVerified.sections[1].text, deletedMiddle.sections[1].text);
assert.equal(manuallyVerified.sections[1].evidenceReviewRequired, false);
assert.equal(manuallyVerified.sections[1].humanVerification?.scriptRevision, deletedMiddle.revision);
assert.doesNotThrow(() => approveCreatorScript(manuallyVerified, strategyFingerprint));
assert.deepEqual(normalizeCreatorScript(JSON.parse(JSON.stringify(manuallyVerified))), manuallyVerified);
const editedAgain = editCreatorScriptDocument(manuallyVerified, getCreatorScriptDocumentText(manuallyVerified).replace("creator audience", "general audience"));
assert.equal(editedAgain.sections[1].evidenceReviewRequired, true);
assert.equal(editedAgain.sections[1].humanVerification, undefined);
const legacyEditedAgain = editCreatorScriptSection(manuallyVerified, "body", `${manuallyVerified.sections[1].text} changed`);
assert.equal(legacyEditedAgain.sections[1].evidenceReviewRequired, true);
assert.equal(legacyEditedAgain.sections[1].humanVerification, undefined);
const otherSectionEdited = editCreatorScriptDocument(manuallyVerified, getCreatorScriptDocumentText(manuallyVerified).replace("An opening", "A revised opening"));
assert.equal(otherSectionEdited.sections[1].evidenceReviewRequired, false);
assert.equal(otherSectionEdited.sections[1].humanVerification?.scriptRevision, otherSectionEdited.revision);
assert.throws(() => assertCreatorScriptVerificationAuthority(deletedMiddle, { ...deletedMiddle, sections: deletedMiddle.sections.map((section) => section.id === "body" ? { ...section, evidenceReviewRequired: false, humanVerification: { scriptRevision: deletedMiddle.revision, verifiedAt: generatedAt } } : section) }), /VERIFICATION_FORGED/);

// D. A boundary-spanning edit changes only the intersected contiguous range.
const crossStart = document.indexOf("complete editorial document.");
const crossEnd = document.indexOf("The verified fact") + "The verified fact".length;
const crossedBoundaryText = `${document.slice(0, crossStart)}a revised opening close.\n\nA revised factual lead${document.slice(crossEnd)}`;
const crossedBoundary = editCreatorScriptDocument(script, crossedBoundaryText);
assert.match(crossedBoundary.sections[0].text, /revised opening close/);
assert.match(crossedBoundary.sections[1].text, /revised factual lead/);
assert.deepEqual(crossedBoundary.sections[2], script.sections[2]);
assert.equal(crossedBoundary.sections[1].evidenceReviewRequired, true);

// E. A full rewrite retains stable identities and fails grounded edits closed.
const replaced = editCreatorScriptDocument(script, [
  "A completely rewritten opening remains one continuous document.",
  "A rewritten factual middle remains attached to its canonical section identity.",
  "A completely rewritten conclusion closes the document.",
].join("\n\n"));
assert.deepEqual(replaced.sections.map((section) => section.id), ["opening", "body", "conclusion"]);
assert.deepEqual(replaced.sections.map((section) => section.kind), ["opening", "body", "conclusion"]);
assert.equal(replaced.sections[1].evidenceReviewRequired, true);
assert.deepEqual(replaced.sections[1].claimIds, ["claim-1"]);
assert.throws(() => approveCreatorScript(replaced, strategyFingerprint), /CREATOR_SCRIPT_GROUNDING_BLOCKED/);
assert.throws(() => editCreatorScriptDocument(script, ""), /CREATOR_SCRIPT_DOCUMENT_TEXT_REQUIRED/);

// F. No-op documents preserve object/revision authority.
const noOp = editCreatorScriptDocument(script, document);
assert.equal(noOp, script);
assert.equal(noOp.revision, script.revision);
assert.equal(isCreatorScriptCurrentForStrategy({ script, strategyFingerprint: "changed-strategy", targetDurationSec: 10, language: "en" }), false);

assert.throws(
  () => editCreatorScriptDocument(script, document.replace(`${script.sections[0].text}\n\n${script.sections[1].text}`, `${script.sections[0].text}${script.sections[1].text}`)),
  /CREATOR_SCRIPT_DOCUMENT_BOUNDARY_AMBIGUOUS/,
);

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const production = await readFile(new URL("../lib/creator/services/creatorProduction.server.ts", import.meta.url), "utf8");
const verificationRoute = await readFile(new URL("../app/api/creator-script/verify-section/route.ts", import.meta.url), "utf8");
const saveRoute = await readFile(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
assert.match(component, /data-creator-script-document="continuous"/);
assert.match(component, /Editorial Review/);
assert.match(component, /data-editorial-review-checkpoint="production-setup-create-review"/);
assert.match(component, /open=\{evidenceReviewBlocked \|\| undefined\}/);
assert.match(component, /Regenerate to verify/);
assert.match(component, /Your saved text remains unchanged until you choose that action/);
assert.match(component, /section\.evidenceReviewRequired &&/);
assert.match(component, /Review sources/);
assert.match(component, /event\.preventDefault\(\); event\.stopPropagation\(\)/);
assert.match(component, /onReviewSources\(section\.id, false\)/);
assert.match(component, /Confirm this edit is supported/);
assert.match(verificationRoute, /getForOwner\(projectId, principal\.id\)/);
assert.match(verificationRoute, /script\.revision !== revision/);
assert.match(verificationRoute, /getCreatorScriptSectionSourceReview/);
assert.match(verificationRoute, /expectedUpdatedAt/);
assert.match(verificationRoute, /CREATOR_SCRIPT_VERIFICATION_STALE/);
assert.match(verificationRoute, /PROJECT_SAVE_CONFLICT/);
assert.match(saveRoute, /assertCreatorScriptVerificationAuthority/);
assert.match(saveRoute, /CREATOR_SCRIPT_VERIFICATION_FORGED/);
const reviewHandler = page.slice(
  page.indexOf("const handleReviewCreatorScriptSources"),
  page.indexOf("const handleOptimizeScenes"),
);
assert.match(reviewHandler, /if \(confirm && data\.creatorScript\)/);
assert.doesNotMatch(reviewHandler.slice(0, reviewHandler.indexOf("if (confirm && data.creatorScript)")), /setCreatorScript|setCreatorSelectedWorkspaceStep|setCreatorProductionSubstep|persistProject/);
assert.equal((component.match(/<textarea/g) || []).length, 1);
assert.match(component, /onApproveAndBuildScenes\(draft\)/);
assert.match(page, /documentText !== getCreatorScriptDocumentText\(creatorScript\)/);
assert.match(page, /fetch\("\/api\/creator-script\/approve"/);
const approvalHandler = page.slice(
  page.indexOf("const handleApproveCreatorScriptAndBuildScenes"),
  page.indexOf("const handleSaveCreatorScriptDocument"),
);
assert.ok(approvalHandler.indexOf('fetch("/api/creator-script/approve"') < approvalHandler.indexOf('fetch("/api/creator-production"'));
assert.match(production, /resolvePersistedCreatorScriptAuthority/);
assert.doesNotMatch(component, /createCreatorScriptSceneSegments|\/api\/creator-production/);
assert.match(page, /onSaveDocument=\{handleSaveCreatorScriptDocument\}/);
assert.match(page, /persistProject\(false, \{ creatorScript: nextScript \}\)/);
assert.match(page, /Your existing script is unchanged; please try again/);
assert.match(page, /profileSnapshot: creatorStrategyProfileSnapshot \|\| creatorProfile/);
assert.match(page, /creatorProfile: creatorStrategyProfileSnapshot \|\| creatorProfile/);
const generationHandler = page.slice(
  page.indexOf("const handleCreatorProductionPackage"),
  page.indexOf("const handleApproveCreatorScriptAndBuildScenes"),
);
assert.ok(generationHandler.indexOf("runCreatorEditorialScriptPipeline") < generationHandler.indexOf("setCreatorScript(replacement.script)"));
assert.ok(generationHandler.indexOf("persistCreatorScriptReplacement") < generationHandler.indexOf("setCreatorScript(replacement.script)"));
assert.doesNotMatch(component, /Brief[^]*Strategy[^]*Production Setup[^]*Full Script[^]*Create & Review[^]*Publish/);
assert.doesNotMatch(component, /<strong>\{claimId\}|section\.heading \|\| section\.id|provider/);

console.log("STAGE_0_13D_CONTINUOUS_FULL_SCRIPT_EDITOR=PASS");
