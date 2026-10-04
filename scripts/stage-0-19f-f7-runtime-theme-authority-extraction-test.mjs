import assert from "node:assert/strict";

import {
  adaptCreatorScriptSectionPlanToApprovedThemes,
  extractCreatorScriptApprovedThemeSequence,
} from "../lib/creator/creatorScript.ts";

function section(id, kind, owns) {
  return {
    id,
    kind,
    role: `role-${id}`,
    centralQuestion: `question-${id}`,
    progression: `progression-${id}`,
    ownershipBoundary: {
      usage: "control_only_never_narrate",
      owns,
      excludes: [],
    },
    minimumWords: kind === "body" ? 220 : 100,
    targetWords: kind === "body" ? 250 : 120,
    maximumWords: kind === "body" ? 280 : 140,
  };
}

const plan = [
  section("opening", "opening", ["human_stakes"]),
  section("section-1", "body", ["definition", "framing"]),
  section("section-2", "body", ["mechanism", "causal_process"]),
  section("section-3", "body", ["grounded_demonstration", "concrete_case"]),
  section("section-4", "body", ["limits", "uncertainty", "scope_conditions"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const runtimeApprovedStrategy = {
  mentorAnalysis: {
    productionPlan: [
      "Open with a personal thought experiment to immediately engage curiosity and set the narrative tone.",
      "Use clear, natural narration with relatable examples to explain complex ideas simply and accessibly.",
      "Structure the script into four thematic sections: Status, Money, Identity, Meaning, with smooth transitions.",
      "End with an open-ended question about the nature of work and purpose to encourage reflection and discussion.",
    ],
  },
};

assert.deepEqual(
  extractCreatorScriptApprovedThemeSequence(runtimeApprovedStrategy),
  ["Status", "Money", "Identity", "Meaning"],
);

const adapted = adaptCreatorScriptSectionPlanToApprovedThemes({
  plan,
  approvedStrategy: runtimeApprovedStrategy,
});
const body = adapted.filter((item) => item.kind === "body");

assert.equal(body.length, 4);
assert.match(body[0].role, /"Status"/u);
assert.match(body[1].role, /"Money"/u);
assert.match(body[2].role, /"Identity"/u);
assert.match(body[3].role, /"Meaning"/u);
assert.ok(body[0].ownershipBoundary.owns.includes("approved_theme:status"));
assert.ok(body[1].ownershipBoundary.owns.includes("approved_theme:money"));
assert.ok(body[2].ownershipBoundary.owns.includes("approved_theme:identity"));
assert.ok(body[3].ownershipBoundary.owns.includes("approved_theme:meaning"));

console.log("stage-0-19f-f7-runtime-theme-authority-extraction-test: PASS");
