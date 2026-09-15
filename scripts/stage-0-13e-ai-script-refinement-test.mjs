import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCreatorScript, getCreatorScriptDocumentText, isCreatorScriptCurrentForStrategy, verifyCreatorScriptSectionSources } from "../lib/creator/creatorScript.ts";
import { applyCreatorScriptOpeningRefinement, applyCreatorScriptSelectionRefinement, applyCreatorScriptWholeRefinement, getCreatorScriptRefinementChangedRanges, getCreatorScriptRefinementReplacementRange, validateCreatorScriptSelection } from "../lib/creator/creatorScriptRefinement.ts";
import { canOpenCreatorPublish, resolveCreatorRestoredNavigation } from "../lib/creator/stageNavigation.ts";

const words = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}${i}`).join(" ");
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve evidence.", readiness: { status: "ready", editorialReadinessScore: 90, reviewReasons: [] }, claims: [{ claimId: "c1", claimType: "FACT", text: "Supported statement", supportingEvidenceIds: ["e1"], counterEvidenceIds: [], contextualEvidenceIds: [] }], evidence: [{ evidenceId: "e1", sourceId: "s1", excerpt: "Supporting excerpt", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }], sources: [{ sourceId: "s1", title: "Source", url: "https://example.test", publisher: "Publisher", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }] };
const script = createCreatorScript({ title: "Script", sections: [{ id: "opening", kind: "opening", text: words("open", 55), claimIds: [], evidenceReviewRequired: false }, { id: "body", kind: "body", text: words("body", 575), claimIds: ["c1"], evidenceReviewRequired: false }, { id: "conclusion", kind: "conclusion", text: words("end", 75), claimIds: [], evidenceReviewRequired: false }], targetDurationSec: 300, strategyFingerprint: "fp", grounding: { context }, generatedAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z" });

const document = getCreatorScriptDocumentText(script); const start = document.indexOf("open10"); const selectedText = "open10 open11";
assert.equal(validateCreatorScriptSelection(script, start, start + selectedText.length, selectedText).selectedText, selectedText);
assert.throws(() => validateCreatorScriptSelection(script, start, start + selectedText.length, "stale"), /SELECTION_STALE/);
const selected = applyCreatorScriptSelectionRefinement(script, { start, end: start + selectedText.length, selectedText, replacementText: "sharper opening" });
assert.equal(getCreatorScriptDocumentText(selected).slice(0, start), document.slice(0, start));
assert.equal(selected.sections[1].text, script.sections[1].text);
assert.equal(selected.sections[0].evidenceReviewRequired, false);
assert.deepEqual(getCreatorScriptRefinementReplacementRange({ previousDocument: document, nextDocument: getCreatorScriptDocumentText(selected), start, end: start + selectedText.length }), { start, end: start + "sharper opening".length });
assert.equal(getCreatorScriptRefinementReplacementRange({ previousDocument: document, nextDocument: `changed ${getCreatorScriptDocumentText(selected)}`, start, end: start + selectedText.length }), null);
assert.equal(getCreatorScriptRefinementChangedRanges(script, selected).length, 1);

const opening = applyCreatorScriptOpeningRefinement(script, words("revised", 55));
assert.deepEqual(opening.sections[1], script.sections[1]); assert.deepEqual(opening.sections[2], script.sections[2]);
const whole = applyCreatorScriptWholeRefinement(script, script.sections.map((section) => ({ id: section.id, text: section.id === "body" ? words("grounded", 575) : section.text })), "en");
assert.deepEqual(whole.sections.map((section) => section.id), script.sections.map((section) => section.id));
assert.equal(whole.sections[1].evidenceReviewRequired, true);
const verified = verifyCreatorScriptSectionSources(whole, "body");
const refinedVerified = applyCreatorScriptOpeningRefinement(verified, words("again", 55));
assert.equal(refinedVerified.sections[1].humanVerification?.scriptRevision, refinedVerified.revision);
assert.equal(isCreatorScriptCurrentForStrategy({ script: whole, strategyFingerprint: "fp", targetDurationSec: 300, language: "en" }), true);
assert.equal(getCreatorScriptRefinementChangedRanges(script, opening)[0].start, 0);
assert.equal(getCreatorScriptRefinementChangedRanges(script, whole).length, 1);

for (const [workspaceStep, productionSubstep, prerequisites] of [
  [1, "setup", {}], [2, "setup", { hasStrategy: true }], [3, "setup", { hasStrategy: true, hasProductionPackage: true }],
  [3, "create_review", { hasStrategy: true, hasProductionPackage: true, hasScenes: true }], [4, "setup", { hasStrategy: true, hasProductionPackage: true, hasScenes: true, canOpenPublish: true }],
]) assert.deepEqual(resolveCreatorRestoredNavigation({ persisted: { workspaceStep, productionSubstep }, hasStrategy: false, hasProductionPackage: false, hasScenes: false, canOpenPublish: false, ...prerequisites }), { workspaceStep, productionSubstep });
assert.deepEqual(resolveCreatorRestoredNavigation({ persisted: null, hasStrategy: true, hasProductionPackage: true, hasScenes: true, canOpenPublish: false }), { workspaceStep: 3, productionSubstep: "create_review" });
assert.deepEqual(resolveCreatorRestoredNavigation({ persisted: null, hasStrategy: true, hasProductionPackage: true, hasScenes: false, canOpenPublish: false }), { workspaceStep: 3, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorRestoredNavigation({ persisted: { workspaceStep: 4, productionSubstep: "setup" }, hasStrategy: true, hasProductionPackage: true, hasScenes: true, canOpenPublish: true }), { workspaceStep: 4, productionSubstep: "setup" });
assert.equal(canOpenCreatorPublish({ productionComplete: false, publishComplete: true }), true);
assert.equal(canOpenCreatorPublish({ productionComplete: true, publishComplete: false }), true);
assert.deepEqual(resolveCreatorRestoredNavigation({ persisted: { workspaceStep: 4, productionSubstep: "create_review" }, hasStrategy: true, hasProductionPackage: false, hasScenes: false, canOpenPublish: false }), { workspaceStep: 2, productionSubstep: "setup" });

const route = await readFile(new URL("../app/api/creator-script/refine/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
assert.match(route, /getForOwner\(projectId, principal\.id\)/); assert.match(route, /script\.revision !== revision/); assert.match(route, /expectedUpdatedAt/);
assert.match(route, /for \(const section of script\.sections\)/); assert.doesNotMatch(route, /creator-refine-scenes/); assert.doesNotMatch(route, /createCreatorScriptSceneSegments/);
assert.ok(route.indexOf("client.responses.create") < route.indexOf("projectRepository.saveForOwner"));
assert.match(component, /Refine with AI/); assert.match(component, /Selected text/); assert.match(component, /Full script/);
assert.match(component, /aria-hidden="true"/); assert.match(component, /visibleHighlights/); assert.match(component, /setEditorScroll/);
assert.match(component, /data-script-highlight=\{range\.kind\}/); assert.match(component, /creatorlab-script-highlight-selection/); assert.match(component, /creatorlab-script-highlight-refinement/);
assert.match(component, /const start = textarea\.selectionStart;[\s\S]*const end = textarea\.selectionEnd;[\s\S]*textarea\.value\.slice\(start, end\)/);
assert.match(component, /scrollTop[\s\S]*scrollLeft/);
assert.match(component, /offsetWidth - textarea\.clientWidth - borderLeft - borderRight/);
assert.match(component, /paddingRight: `calc\(\$\{computed\.paddingRight\} \+ \$\{scrollbarGutter\}px\)`/);
assert.match(component, /new ResizeObserver\(measureMirror\)/);
assert.match(component, /captureLockedSelection/); assert.match(component, /onMouseUp=/); assert.match(component, /onKeyUp=/);
assert.match(component, /data-locked-selection-visible=\{lockedSelection/); assert.match(component, /absolute left-0 top-0 z-20/);
assert.match(globals, /\.creatorlab-script-document-layer\s*\{[\s\S]*box-sizing:\s*border-box;[\s\S]*font-family:[\s\S]*line-height:\s*2rem[\s\S]*white-space:\s*pre-wrap/);
assert.match(globals, /textarea\.creatorlabs-script-document-textarea\s*\{[\s\S]*background:\s*#ffffff !important;/);
assert.match(globals, /\.creatorlabs-script-document-mirror \*[\s\S]*color:\s*transparent !important;[\s\S]*-webkit-text-fill-color:\s*transparent !important/);
assert.match(globals, /creatorlab-script-highlight-selection[\s\S]*background:\s*rgba\(250, 204, 21, 0\.28\) !important/);
assert.match(globals, /creatorlab-script-highlight-refinement[\s\S]*background:\s*rgba\(245, 158, 11, 0\.20\) !important/);
assert.match(globals, /textarea\.creatorlabs-script-document-textarea::selection[\s\S]*background:\s*#fde68a/);
assert.match(component, /setLockedSelection\(null\); setShowRefinementHighlights\(false\)/); assert.match(component, /selectionExcerpt/);
assert.match(page, /getCreatorScriptRefinementReplacementRange/); assert.match(page, /setCreatorScriptRefinementHighlights/);
assert.match(page, /navigation: creatorNavigationRef\.current/); assert.match(page, /resolveCreatorRestoredNavigation/);
assert.match(page, /fetch\("\/api\/creator-script\/refine"/); assert.doesNotMatch(page.slice(page.indexOf("const handleRefineCreatorScript"), page.indexOf("const handleOptimizeScenes")), /setCreatorSelectedWorkspaceStep|setCreatorProductionSubstep/);
console.log("STAGE_0_13E_AI_SCRIPT_REFINEMENT=PASS");
