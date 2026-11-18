import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const ui = read("components/create/CreatorScriptReview.tsx");
const route = read("app/api/creator-script/refine/route.ts");
const engine = read("lib/creator/creatorScriptRefinement.ts");
const revisions = read("lib/creator/creatorScriptRevisions.ts");
let checks = 0;
const check = (description, callback) => {
  try { callback(); checks++; }
  catch (error) { throw new Error("ISSUE50_ITERATIVE_REFINEMENT_REGRESSION:" + description, { cause: error }); }
};

// Real canonical script workspace, not the initial project prompt.
check("same workspace contains canonical script and the refinement prompt", () => {
  assert.match(ui, /data-creator-script-document="continuous"/);
  assert.match(ui, /data-creator-script-ai-refinement="true"/);
  assert.match(ui, /<textarea data-creator-refinement-prompt="iterative"/);
});
check("natural-language multiline prompt and bounded input", () => {
  assert.match(ui, /rows=\{3\} maxLength=\{2000\}/);
  assert.match(ui, /value=\{refineInstruction\} onChange=\{\(event\) => \{ setRefineInstruction\(event\.target\.value\); setRefinementActionNotice\(null\); \}\}/);
});
check("explicit next-turn iteration guidance", () => {
  assert.match(ui, /Each prompt uses the current saved script revision/);
  assert.match(ui, /then enter another instruction here/);
  assert.match(ui, /without returning to the original creative brief/);
});
check("selected passage and explicit opening remain focused edits", () => {
  assert.match(ui, /scope: "selection" as const, mode: "focused_edit" as const/);
  assert.match(ui, /scope: "opening" as const, mode: "focused_edit" as const/);
});
check("whole script remains a separately checked scope with no opening fallback", () => {
  assert.match(ui, /scope: "whole_script" as const, mode: refinementIntent.mode/);
  assert.match(ui, /resolveCreatorScriptNaturalRefinementIntent/);
  assert.match(route, /CREATOR_SCRIPT_REFINEMENT_MODE_SCOPE_MISMATCH/);
});
check("whole-script UI remains fail-closed until admission", () => {
  assert.match(ui, /refinementIntent.scope !== "whole_script" \|\| wholeScriptPreviewEnabled/);
  assert.match(ui, /!canPreviewRefinement/);
  assert.match(engine, /CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED = false/);
  assert.match(route, /CREATOR_SCRIPT_FULL_REFINEMENT_DEFERRED/);
});
check("Preview UI requires both preview identity and an explicit public flag", () => {
  assert.match(ui, /NEXT_PUBLIC_VERCEL_ENV === "preview"/);
  assert.match(ui, /NEXT_PUBLIC_CREATOR_SCRIPT_FULL_REFINEMENT_PREVIEW_ENABLED === "true"/);
  assert.match(ui, /refinementIntent.scope === "whole_script" && !wholeScriptPreviewEnabled/);
});
check("Server release gate requires separate private preview identity and flag", () => {
  assert.match(engine, /VERCEL_ENV === "preview"/);
  assert.match(engine, /NODE_ENV === "production"/);
  assert.match(engine, /CREATOR_SCRIPT_FULL_REFINEMENT_PREVIEW_ENABLED === "true"/);
  assert.match(route, /isCreatorScriptFullRefinementPreviewEnabled\(process\.env\)/);
});
check("single prompt has no manual scope dropdown", () => {
  assert.doesNotMatch(ui, /Refinement target/);
  assert.doesNotMatch(ui, /<select aria-label/);
  assert.match(ui, /data-creator-refinement-prompt="iterative"/);
});
check("unselected explicit section uses existing focused-selection API, with a prominent CTA", () => {
  assert.match(ui, /inferCreatorScriptFocusedSectionSelection/);
  assert.match(ui, /inferredSectionSelection/);
  assert.match(ui, /data-creator-refinement-action="preview"/);
  assert.match(ui, /data-creator-refinement-action-feedback="true"/);
  assert.match(ui, /bg-blue-600/);
  assert.match(ui, /!canPreviewRefinement && !inferredSectionSelection/);
});
check("refinement is a proposal and never auto-overwrites", () => {
  assert.match(route, /pendingRefinement = createCreatorScriptProposal\(/);
  assert.match(ui, /data-creator-script-refinement-preview="true"/);
  assert.match(ui, /onApplyRefinement\(\)/);
  assert.match(ui, /onDiscardRefinement\(\)/);
});
check("revision history contains the editorial instructions", () => {
  assert.match(ui, /data-creator-script-revision-history="true"/);
  assert.match(ui, /entry\.instruction/);
  assert.match(route, /appendCreatorScriptHistory\(/);
});
check("stale generation and apply requests fail closed", () => {
  assert.match(route, /script\.revision !== revision/);
  assert.match(route, /proposal\.baseRevision !== script\.revision/);
  assert.match(ui, /pendingRefinementStale/);
});
check("owner-scoped persistence and safe scene lifecycle", () => {
  assert.match(route, /getForOwner\(projectId, principal\.id\)/);
  assert.match(route, /saveForOwner\(\{ projectId, ownerUserId: principal\.id/);
  assert.match(route, /requireCreatorProductionSnapshotBeforeInvalidation\(/);
  assert.match(route, /invalidateCreatorSceneAuthorityForScriptChange\(/);
});
check("accepted revision is the new base, no new strategy requested", () => {
  assert.match(route, /const nextScript = applyCreatorScriptProposal\(script, proposal, state\.brief\.language\)/);
  assert.match(route, /creatorScript: nextScript/);
  assert.match(revisions, /createCreatorScriptProposal|applyCreatorScriptProposal/);
});
console.log(JSON.stringify({
  status: "ISSUE50_ITERATIVE_UX_OFFLINE_CONTRACT_PASS_NOT_FULL_SCRIPT_ACCEPTANCE",
  checks,
  providerCalls: 0,
  wholeScriptProductionEnabled: false,
  realMultiTurnRun: "NOT_RUN",
}));
