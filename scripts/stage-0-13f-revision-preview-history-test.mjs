import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCreatorScript, editCreatorScriptDocument, getCreatorScriptDocumentText, verifyCreatorScriptSectionSources } from "../lib/creator/creatorScript.ts";
import { applyCreatorScriptOpeningRefinement, applyCreatorScriptSelectionRefinement, applyCreatorScriptWholeRefinement } from "../lib/creator/creatorScriptRefinement.ts";
import { CREATOR_SCRIPT_HISTORY_LIMIT, appendCreatorScriptHistory, applyCreatorScriptProposal, createCreatorScriptChanges, createCreatorScriptProposal, discardCreatorScriptProposal, normalizeCreatorScriptRevisionState } from "../lib/creator/creatorScriptRevisions.ts";

const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve evidence.", readiness: { status: "ready", editorialReadinessScore: 90, reviewReasons: [] }, claims: [{ claimId: "c1", claimType: "FACT", text: "Supported", supportingEvidenceIds: ["e1"], counterEvidenceIds: [], contextualEvidenceIds: [] }], evidence: [{ evidenceId: "e1", sourceId: "s1", excerpt: "Evidence", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }], sources: [{ sourceId: "s1", title: "Source", url: "https://example.test", publisher: "Publisher", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }] };
const script = createCreatorScript({ title: "Revision test", sections: [{ id: "opening", kind: "opening", text: words("open", 55), claimIds: [], evidenceReviewRequired: false }, { id: "body", kind: "body", text: words("body", 575), claimIds: ["c1"], evidenceReviewRequired: false }, { id: "conclusion", kind: "conclusion", text: words("end", 75), claimIds: [], evidenceReviewRequired: false }], targetDurationSec: 300, strategyFingerprint: "fp", grounding: { context }, generatedAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z" });

const document = getCreatorScriptDocumentText(script);
const start = document.indexOf("open10");
const selectedText = "open10 open11";
const selectedNext = applyCreatorScriptSelectionRefinement(script, { start, end: start + selectedText.length, selectedText, replacementText: "strong precise opening" });
const selectionProposal = createCreatorScriptProposal({ script, scope: "selection", instruction: "Make this precise", nextScript: selectedNext, selectionStart: start, selectionEnd: start + selectedText.length, selectedText, replacementText: "strong precise opening" });
assert.equal(script.revision, 1, "proposal generation must not mutate canonical revision");
assert.equal(getCreatorScriptDocumentText(script), document, "proposal generation must not mutate canonical text");
const selectedApplied = applyCreatorScriptProposal(script, selectionProposal, "en");
assert.equal(selectedApplied.revision, script.revision + 1);
assert.match(getCreatorScriptDocumentText(selectedApplied), /strong precise opening/);
assert.throws(() => applyCreatorScriptProposal(editCreatorScriptDocument(script, `${document}!`, script.updatedAt), selectionProposal, "en"), /REFINEMENT_STALE/);
const approvedScript = { ...script, approval: { approvedAt: "2026-09-15T01:00:00Z", strategyFingerprint: "fp", scriptRevision: script.revision } };
const discardHistory = [{ id: "history-1", fromRevision: 0, toRevision: 1, createdAt: "2026-09-15T00:00:00Z", origin: "manual", changes: [{ sectionId: "opening", sectionHeading: "Opening", beforeText: "before", afterText: "after" }] }];
const discardedSelection = discardCreatorScriptProposal({ script: approvedScript, pendingRefinement: selectionProposal, revisionHistory: discardHistory }, selectionProposal.proposalId);
assert.strictEqual(discardedSelection.script, approvedScript, "discard preserves the exact canonical script object");
assert.strictEqual(discardedSelection.revisionHistory, discardHistory, "discard creates no history entry");
assert.equal(discardedSelection.pendingRefinement, null);
assert.equal(discardedSelection.script.revision, script.revision); assert.deepEqual(discardedSelection.script.approval, approvedScript.approval);
assert.throws(() => discardCreatorScriptProposal(discardedSelection, selectionProposal.proposalId), /REFINEMENT_STALE/, "repeated discard fails without mutation");

const openingNext = applyCreatorScriptOpeningRefinement(script, words("revised", 55));
const openingProposal = createCreatorScriptProposal({ script, scope: "opening", instruction: "Strengthen", nextScript: openingNext });
assert.equal(applyCreatorScriptProposal(script, openingProposal, "en").sections[1].text, script.sections[1].text);
assert.strictEqual(discardCreatorScriptProposal({ script, pendingRefinement: openingProposal, revisionHistory: [] }, openingProposal.proposalId).script, script, "opening discard is non-mutating");

const wholeNext = applyCreatorScriptWholeRefinement(script, script.sections.map((section) => ({ id: section.id, text: section.id === "body" ? words("grounded", 575) : section.text })), "en");
const wholeProposal = createCreatorScriptProposal({ script, scope: "whole_script", instruction: "Improve flow", nextScript: wholeNext });
assert.deepEqual(wholeProposal.changes.map((change) => change.sectionId), ["body"], "whole-script preview stores changed sections only");
assert.equal(applyCreatorScriptProposal(script, wholeProposal, "en").sections[1].evidenceReviewRequired, true);
assert.strictEqual(discardCreatorScriptProposal({ script, pendingRefinement: wholeProposal, revisionHistory: [] }, wholeProposal.proposalId).script, script, "full-script discard is non-mutating");

const longScript = createCreatorScript({ title: "Long revision", sections: [{ id: "long-opening", kind: "opening", text: words("lo", 200), claimIds: [], evidenceReviewRequired: false }, { id: "long-body", kind: "body", text: words("lb", 1850), claimIds: [], evidenceReviewRequired: false }, { id: "long-conclusion", kind: "conclusion", text: words("lc", 200), claimIds: [], evidenceReviewRequired: false }], targetDurationSec: 960, strategyFingerprint: "long-fp", grounding: { context: { ...context, claims: [], evidence: [], sources: [] } }, generatedAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z" });
const longNext = applyCreatorScriptWholeRefinement(longScript, longScript.sections.map((section) => ({ id: section.id, text: section.id === "long-body" ? section.text.replace("lb100", "revised100") : section.text })), "en");
const longProposal = createCreatorScriptProposal({ script: longScript, scope: "whole_script", instruction: "Improve one passage", nextScript: longNext });
assert.deepEqual(longProposal.changes.map((change) => change.sectionId), ["long-body"], "long-form proposal remains changed-section native");
assert.equal(applyCreatorScriptProposal(longScript, longProposal, "en").revision, longScript.revision + 1, "long-form apply remains one compliant revision");

const verified = verifyCreatorScriptSectionSources(wholeNext, "body");
const untouchedVerification = applyCreatorScriptOpeningRefinement(verified, words("newopen", 55));
assert.equal(untouchedVerification.sections[1].humanVerification?.scriptRevision, untouchedVerification.revision, "untouched verified section remains verified");
assert.equal(applyCreatorScriptWholeRefinement(verified, verified.sections.map((section) => ({ id: section.id, text: section.id === "body" ? `${section.text} changed` : section.text })), "en").sections[1].humanVerification, undefined, "changed grounded section invalidates verification");

const manualNext = editCreatorScriptDocument(script, document.replace("end10", "ending10"), script.updatedAt);
const manualChanges = createCreatorScriptChanges(script, manualNext);
assert.deepEqual(manualChanges.map((change) => change.sectionId), ["conclusion"]);
assert.deepEqual(createCreatorScriptChanges(script, script), [], "no-op and metadata-only persistence produces no text history");
let history = appendCreatorScriptHistory([], { fromRevision: script.revision, toRevision: manualNext.revision, origin: "manual", changes: manualChanges });
history = appendCreatorScriptHistory(history, { fromRevision: script.revision, toRevision: selectedApplied.revision, origin: "ai_selection", instruction: selectionProposal.instruction, changes: selectionProposal.changes });
assert.equal(history[0].origin, "ai_selection");
for (let index = 0; index < CREATOR_SCRIPT_HISTORY_LIMIT + 3; index += 1) history = appendCreatorScriptHistory(history, { fromRevision: index, toRevision: index + 1, origin: "manual", changes: manualChanges });
assert.equal(history.length, CREATOR_SCRIPT_HISTORY_LIMIT, "history remains bounded");
assert.equal(normalizeCreatorScriptRevisionState({ pending: selectionProposal, history }).pending?.proposalId, selectionProposal.proposalId, "pending proposal survives project hydration");

const route = await readFile(new URL("../app/api/creator-script/refine/route.ts", import.meta.url), "utf8");
const saveRoute = await readFile(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(route, /getForOwner\(projectId, principal\.id\)/);
assert.match(route, /action === "discard"/); assert.match(route, /action === "apply"/);
const discardRouteBlock = route.slice(route.indexOf('if (action === "discard")'), route.indexOf('if (action === "apply")'));
assert.match(discardRouteBlock, /discardCreatorScriptProposal/); assert.doesNotMatch(discardRouteBlock, /applyCreatorScriptProposal|appendCreatorScriptHistory/);
assert.match(route, /proposal\.baseRevision !== script\.revision/); assert.match(route, /expectedUpdatedAt/);
assert.ok(route.indexOf("client.responses.create") < route.indexOf("pendingRefinement = createCreatorScriptProposal"));
assert.match(saveRoute, /pendingRefinement: textChanged \|\| scriptRevisionChanged \? null/);
assert.match(saveRoute, /const revisionHistory = textChanged/);
assert.match(saveRoute, /persistedState\.strategy\.pendingRefinement/);
assert.match(component, /Review proposed changes/); assert.match(component, /Apply changes/); assert.match(component, /Discard/); assert.match(component, /History/);
assert.match(component, /data-creator-script-refinement-preview="true"/); assert.match(component, /data-creator-script-revision-history="true"/);
assert.match(component, /pendingRefinementStale/); assert.match(component, /Preview no longer current/);
assert.match(component, /setResolvingRefinement\("discard"\)/); assert.match(component, /onDiscardRefinement\(\)/); assert.match(component, /Discarding…/);
const discardButtonBlock = component.slice(component.indexOf('setResolvingRefinement("discard")'), component.indexOf('setResolvingRefinement("apply")'));
assert.doesNotMatch(discardButtonBlock, /onApplyRefinement|Applying…/);
assert.match(page, /action, projectId:[\s\S]*proposalId: proposal\.proposalId/);
assert.match(page, /setCreatorScriptPendingRefinement\(data\.pendingRefinement\)/);
assert.doesNotMatch(page.slice(page.indexOf("const handleRefineCreatorScript"), page.indexOf("const handleResolveCreatorScriptRefinement")), /setCreatorScript\(/, "preview generation must not install proposed script");

console.log("STAGE_0_13F_REVISION_PREVIEW_HISTORY=PASS");
