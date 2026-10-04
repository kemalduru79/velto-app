import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT,
  createCreatorScriptNarrationControlPlan,
} from "../lib/creator/creatorScript.ts";

function section(id, kind, owns, excludes = []) {
  return {
    id,
    kind,
    role: `role-${id}`,
    centralQuestion: `question-${id}`,
    progression: `progression-${id}`,
    ownershipBoundary: {
      usage: "control_only_never_narrate",
      owns,
      excludes,
    },
    minimumWords: 100,
    targetWords: 120,
    maximumWords: 140,
  };
}

const plan = [
  section("opening", "opening", ["human_stakes", "master_question"]),
  section("section-1", "body", ["definition", "framing"], ["mechanism"]),
  section("section-2", "body", ["mechanism", "causal_process"], ["evidence_catalog"]),
  section("section-3", "body", ["grounded_demonstration", "concrete_case"], ["mechanism_reteaching"]),
  section("section-4", "body", ["counterview", "thesis_stress_test"], ["conclusion_synthesis"]),
  section("conclusion", "conclusion", ["highest_order_implication", "unresolved_question"]),
];

const controls = createCreatorScriptNarrationControlPlan(plan);
assert.equal(controls.length, plan.length);

assert.match(controls[1].narrationDirective, /boundary.*once/u);
assert.match(controls[1].narrationDirective, /Do not repeat the opening stakes/u);

assert.match(controls[2].narrationDirective, /Assume the definition is already known/u);
assert.match(controls[2].narrationDirective, /Explain only the causal chain/u);

assert.match(controls[3].narrationDirective, /Begin from the strongest supplied grounded observation/u);
assert.match(controls[3].narrationDirective, /do not substitute generic evidence-summary language/u);

assert.match(controls[4].narrationDirective, /strongest grounded challenge/u);
assert.match(controls[4].narrationDirective, /do not spend the conclusion/u);

assert.match(controls[5].narrationDirective, /Advance one level beyond the strongest completed body insight/u);
assert.match(controls[5].narrationDirective, /Do not recap or repeat any earlier thesis, analogy, paradox, closing sentence, or rhetorical question/u);
assert.match(controls[5].narrationDirective, /newly earned open question/u);

assert.ok(
  CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT.some((rule) =>
    /one primary intellectual job/u.test(rule)
  ),
);
assert.ok(
  CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT.some((rule) =>
    /Reserve highest-order synthesis and the final unresolved question for the conclusion/u.test(rule)
  ),
);
assert.ok(
  CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT.some((rule) =>
    /experts point out/u.test(rule)
  ),
);

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);

assert.match(
  provider,
  /CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT/u,
);
assert.ok(
  (provider.match(/\.\.\.CREATOR_SCRIPT_SEMANTIC_PROGRESSION_CONTRACT/g) || []).length >= 2,
  "semantic progression contract must reach both generation paths",
);
assert.match(
  provider,
  /const narrationControlPlan = createCreatorScriptNarrationControlPlan/u,
);
assert.match(
  provider,
  /sectionControl: narrationControlPlan\[index\]/u,
);
assert.match(
  provider,
  /futureSectionOwnership: narrationControlPlan[\s\S]*?\.slice\(index \+ 1\)/u,
);
assert.match(
  provider,
  /Treat completedSections as established audience knowledge/u,
);
assert.match(
  provider,
  /do not re-explain their thesis, mechanism, evidence, examples, paradoxes, or closing questions/u,
);

const schema = provider.slice(
  provider.indexOf("function generationSectionSchema"),
  provider.indexOf("const GENERATION_SYSTEM"),
);
assert.match(schema, /heading: \{ type: \["string", "null"\] \}/u);
assert.doesNotMatch(schema, /sectionControl|futureSectionOwnership/u);

console.log("stage-0-19f-f2-semantic-progression-binding-test: PASS");
