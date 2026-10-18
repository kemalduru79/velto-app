import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyCreatorScriptRefinementFailure,
  creatorScriptRefinementModelOptions,
  resolveCreatorScriptRefinementModel,
} from "../lib/creator/creatorScriptRefinementRuntime.ts";

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

assert.match(route, /resolveCreatorScriptRefinementModel\(process\.env\)/);
assert.match(route, /creatorScriptRefinementModelOptions\(model, 0\.25\)/);
assert.match(route, /creatorScriptRefinementModelOptions\(model, 0\.1\)/);
assert.match(route, /classifyCreatorScriptRefinementFailure\(error\)/);
assert.match(route, /status: failure\.status/);
assert.doesNotMatch(route, /model: process\.env\.OPENAI_MODEL \|\| "gpt-4\.1-mini"/);
assert.match(route, /CREATOR_SCRIPT_FULL_REFINEMENT_DEFERRED/);
assert.match(policy, /CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED = false/);
assert.match(component, /data-creator-refinement-scope-notice="true"/);
assert.match(component, /without a selection, only the opening is edited/);
assert.match(component, /scope: "opening"/);
assert.doesNotMatch(component, /option value="whole_script"/);

console.log("CREATOR_SCRIPT_REFINEMENT_R1_FOUNDATION=PASS");
