import assert from "node:assert/strict";
import fs from "node:fs";

import {
  adaptCreatorScriptSectionPlanToApprovedThemes,
  createCreatorScriptNarrationControlPlan,
  extractCreatorScriptApprovedThemeSequence,
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
    minimumWords: kind === "body" ? 220 : 100,
    targetWords: kind === "body" ? 250 : 120,
    maximumWords: kind === "body" ? 280 : 140,
  };
}

const plan = [
  section("opening", "opening", ["human_stakes"]),
  section("section-1", "body", ["definition", "framing"]),
  section("section-2", "body", ["mechanism", "causal_process"]),
  section("section-3", "body", ["grounded_synthesis", "evidence_interpretation"]),
  section("section-4", "body", ["grounded_tension", "evidence_boundary"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const approvedStrategy = {
  mentorAnalysis: {
    productionPlan: [
      "Open with a personal thought experiment.",
      "Structure the video into four main themes: status, money, identity, and meaning.",
      "End with an unresolved question.",
    ],
  },
};

assert.deepEqual(
  extractCreatorScriptApprovedThemeSequence(approvedStrategy),
  ["status", "money", "identity", "meaning"],
);

const adapted = adaptCreatorScriptSectionPlanToApprovedThemes({
  plan,
  approvedStrategy,
});
assert.notEqual(adapted, plan);
assert.equal(adapted.length, plan.length);
assert.equal(adapted[0], plan[0]);
assert.equal(adapted.at(-1), plan.at(-1));

const body = adapted.filter((item) => item.kind === "body");
assert.equal(body.length, 4);
assert.match(body[0].role, /"status"/u);
assert.match(body[1].role, /"money"/u);
assert.match(body[2].role, /"identity"/u);
assert.match(body[3].role, /"meaning"/u);
assert.ok(body[0].ownershipBoundary.owns.includes("definition"));
assert.ok(body[2].ownershipBoundary.owns.includes("grounded_synthesis"));
assert.ok(body[2].ownershipBoundary.owns.includes("approved_theme:identity"));
assert.ok(body[0].ownershipBoundary.excludes.includes("reserved_approved_theme:money"));
assert.ok(body[1].ownershipBoundary.excludes.includes("reserved_approved_theme:status"));

for (let index = 0; index < plan.length; index += 1) {
  assert.equal(adapted[index].id, plan[index].id);
  assert.equal(adapted[index].kind, plan[index].kind);
  assert.equal(adapted[index].minimumWords, plan[index].minimumWords);
  assert.equal(adapted[index].targetWords, plan[index].targetWords);
  assert.equal(adapted[index].maximumWords, plan[index].maximumWords);
}

const controls = createCreatorScriptNarrationControlPlan(adapted);
assert.match(
  controls[1].narrationDirective,
  /creator-approved thematic territory/u,
);
assert.match(
  controls[3].narrationDirective,
  /Begin from the strongest supplied grounded observation/u,
  "thematic binding must preserve the evidence-specific narration contract",
);
assert.ok(controls[2].establishedPremises.includes("approved_theme:status"));

const mismatch = adaptCreatorScriptSectionPlanToApprovedThemes({
  plan,
  approvedStrategy: {
    themes: ["one", "two", "three"],
  },
});
assert.equal(
  mismatch,
  plan,
  "theme binding must fail closed when theme count does not match body sections",
);

const structured = extractCreatorScriptApprovedThemeSequence({
  nested: { mainThemes: ["scarcity", "identity", "purpose", "belonging"] },
});
assert.deepEqual(structured, ["scarcity", "identity", "purpose", "belonging"]);

const coordinator = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts", import.meta.url),
  "utf8",
);
assert.match(coordinator, /adaptCreatorScriptSectionPlanToApprovedThemes/u);
assert.match(
  coordinator,
  /plan: uncertaintyAdaptiveSectionPlan,\s*approvedStrategy: input\.snapshot\.strategy\.approvedStrategy/u,
);
assert.match(
  coordinator,
  /createCreatorLongFormEvidenceReadiness\(\{\s*context: editorialContext,\s*plan: sectionPlan/u,
);

console.log("stage-0-19f-f5-strategy-native-thematic-progression-test: PASS");
