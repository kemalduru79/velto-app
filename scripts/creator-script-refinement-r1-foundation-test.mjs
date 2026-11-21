import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyCreatorScriptRefinementFailure,
  creatorScriptRefinementModelOptions,
  resolveCreatorScriptRefinementModel,
} from "../lib/creator/creatorScriptRefinementRuntime.ts";
import {
  resolveCreatorScriptNaturalRefinementIntent,
  inferCreatorScriptFocusedSectionSelection,
} from "../lib/creator/creatorScriptNaturalRefinementIntent.ts";

assert.equal(resolveCreatorScriptRefinementModel({}), "gpt-6.1-sol");
assert.equal(resolveCreatorScriptRefinementModel({ OPENAI_SCRIPT_MODEL: "gpt-6.1-sol" }), "gpt-6.1-sol");
assert.equal(resolveCreatorScriptRefinementModel({ OPENAI_MODEL: "gpt-4.1-mini", OPENAI_SCRIPT_MODEL: "gpt-6.1-sol", OPENAI_REFINEMENT_MODEL: "gpt-5.6" }), "gpt-5.6");
assert.equal(resolveCreatorScriptRefinementModel({ OPENAI_MODEL: "gpt-4.1-mini" }), "gpt-6.1-sol");
assert.equal(resolveCreatorScriptRefinementModel({ OPENAI_REFINEMENT_MODEL: "  ", OPENAI_SCRIPT_MODEL: "gpt-6.1-sol" }), "gpt-6.1-sol");
assert.deepEqual(creatorScriptRefinementModelOptions("gpt-6.1-sol", 0.25), { reasoning: { effort: "medium" } });
assert.deepEqual(creatorScriptRefinementModelOptions("gpt-5.6", 0.1), { reasoning: { effort: "medium" } });
assert.deepEqual(creatorScriptRefinementModelOptions("gpt-4.1-mini", 0.25), { temperature: 0.25 });

assert.deepEqual(classifyCreatorScriptRefinementFailure(new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED")), {
  code: "CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED",
  error: "The proposed edit would violate the script duration limits. The original script was preserved.",
  status: 422,
});
assert.equal(classifyCreatorScriptRefinementFailure(new Error("CREATOR_SCRIPT_REFINEMENT_NO_CHANGE")).code, "CREATOR_SCRIPT_REFINEMENT_NO_CHANGE");
assert.equal(classifyCreatorScriptRefinementFailure(new Error("PROJECT_SAVE_CONFLICT")).status, 409);
assert.equal(classifyCreatorScriptRefinementFailure(new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_STALE")).code, "CREATOR_SCRIPT_REFINEMENT_STALE");
assert.equal(classifyCreatorScriptRefinementFailure({ status: 429 }).status, 429);
assert.equal(classifyCreatorScriptRefinementFailure({ status: 503 }).status, 503);
assert.equal(classifyCreatorScriptRefinementFailure(new Error("sensitive underlying error")).code, "CREATOR_SCRIPT_REFINEMENT_FAILED");
assert.equal(classifyCreatorScriptRefinementFailure(new Error("sensitive underlying error")).error.includes("sensitive"), false);

const route = await readFile(new URL("../app/api/creator-script/refine/route.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const policy = await readFile(new URL("../lib/creator/creatorScriptRefinement.ts", import.meta.url), "utf8");

assert.match(route, /resolveCreatorScriptRefinementModel\(\{/);
assert.match(route, /creatorScriptRefinementModelOptions\(model, 0\.25\)/);
assert.match(route, /creatorScriptRefinementModelOptions\(model, 0\.1\)/);
assert.match(route, /classifyCreatorScriptRefinementFailure\(error\)/);
assert.match(route, /status: failure\.status/);
assert.doesNotMatch(route, /model: process\.env\.OPENAI_MODEL \|\| "gpt-4\.1-mini"/);
assert.match(route, /CREATOR_SCRIPT_FULL_REFINEMENT_DEFERRED/);
assert.match(policy, /CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED = false/);
// Current CreatorLab has one instruction field, not the former scope/mode selects.
// Verify actual routing and safety gates instead of retired UI copy.
assert.match(component, /data-creator-refinement-scope-notice="true"/);
assert.match(component, /resolveCreatorScriptNaturalRefinementIntent\(refineInstruction, Boolean\(lockedSelection\)\)/);
assert.match(component, /refinementIntent\.scope === "opening"/);
assert.match(component, /scope: "opening" as const, mode: "focused_edit" as const/);
assert.match(component, /scope: "selection" as const, mode: "focused_edit" as const/);
assert.match(component, /inferredSectionSelection\.start/);
assert.match(component, /process\.env\.NEXT_PUBLIC_VERCEL_ENV === "preview"/);
assert.match(component, /if \(!canPreviewRefinement && !inferredSectionSelection\)/);
assert.match(component, /refinementIntent\.scope === "whole_script" && !wholeScriptPreviewEnabled/);
assert.match(component, /Nothing will be sent or silently applied to the opening/);
assert.match(component, /data-creator-refinement-action="preview"/);

assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Strengthen the opening without changing verified facts", false),
  { status: "ready", scope: "opening", mode: "focused_edit" });
assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Reduce repetition throughout the whole script", false),
  { status: "ready", scope: "whole_script", mode: "editorial_rewrite" });
assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Improve the conclusion", false),
  { status: "ready", scope: "whole_script", mode: "editorial_rewrite" });
assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Improve the opening and the conclusion", false),
  { status: "clarify", reason: "conflicting_targets" });
assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Edit the selected passage", false),
  { status: "clarify", reason: "selection_required" });
assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Improve this passage", true),
  { status: "ready", scope: "selection", mode: "focused_edit" });
assert.deepEqual(resolveCreatorScriptNaturalRefinementIntent("Find new evidence for the conclusion", false),
  { status: "ready", scope: "whole_script", mode: "research_backed_rewrite" });

const sectionFixture = [
  { kind: "opening", text: "Opening fact." },
  { kind: "body", text: "Middle fact." },
  { kind: "conclusion", text: "Conclusion fact." },
];
const canonicalFixture = sectionFixture.map((section) => section.text).join("\n\n");
const focus = inferCreatorScriptFocusedSectionSelection("Improve the conclusion", sectionFixture, canonicalFixture);
assert.equal(focus?.text, "Conclusion fact.");
assert.equal(focus?.sectionIndex, 2);
assert.equal(canonicalFixture.slice(focus.start, focus.end), sectionFixture[2].text);
assert.equal(inferCreatorScriptFocusedSectionSelection("Improve the conclusion across the whole script", sectionFixture, canonicalFixture), null);
assert.equal(inferCreatorScriptFocusedSectionSelection("Improve the conclusion and opening", sectionFixture, canonicalFixture), null);
assert.equal(inferCreatorScriptFocusedSectionSelection("Add new sources to the conclusion", sectionFixture, canonicalFixture), null);
assert.equal(inferCreatorScriptFocusedSectionSelection("Improve the conclusion", sectionFixture, "stale document"), null);

console.log("CREATOR_SCRIPT_REFINEMENT_R1_FOUNDATION=PASS");
