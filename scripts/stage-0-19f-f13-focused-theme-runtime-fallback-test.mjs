import assert from "node:assert/strict";

import {
  adaptCreatorScriptSectionPlanToApprovedThemes,
  extractCreatorScriptApprovedThemeSequence,
} from "../lib/creator/creatorScript.ts";

const approvedStrategy = {
  selectedHook: "What if you never had to work again?",
  mentorAnalysis: {
    videoIdeas: [
      {
        title: "Elon Musk May Be Right: Life Without Work and What It Means",
        concept:
          "Explore the human impact of a future where AI and robotics reduce the need for paid work, focusing on status, money, identity, and meaning.",
      },
      {
        title: "If Work Disappears, What Defines Us?",
        concept:
          "Dive into how status, identity, and purpose might shift when earning a living is no longer central to adult life.",
      },
    ],
    productionPlan: [
      "Open with a personal thought experiment to immediately engage curiosity and empathy.",
      "Use clear, simple language with relatable examples to explain complex ideas.",
      "Structure the script with distinct sections: introduction, Musk’s prediction, status, money, identity, meaning, and conclusion.",
      "Incorporate smooth narrative transitions and thought experiments to maintain flow and retention.",
      "End with a provocative, unresolved question to encourage viewer reflection and comments.",
    ],
  },
};

assert.deepEqual(
  extractCreatorScriptApprovedThemeSequence(approvedStrategy),
  ["status", "money", "identity", "meaning"],
);

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
    minimumWords: kind === "body" ? 285 : 111,
    targetWords: kind === "body" ? 317 : 124,
    maximumWords: kind === "body" ? 349 : 137,
  };
}

const plan = [
  section("opening", "opening", ["human_stakes"]),
  section("section-1", "body", ["definition"]),
  section("section-2", "body", ["mechanism"]),
  section("section-3", "body", ["grounded_demonstration"]),
  section("section-4", "body", ["grounded_tension"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const adapted = adaptCreatorScriptSectionPlanToApprovedThemes({
  plan,
  approvedStrategy,
});

assert.deepEqual(
  adapted
    .filter((item) => item.kind === "body")
    .map((item) =>
      item.ownershipBoundary.owns.find((token) =>
        token.startsWith("approved_theme:")
      )
    ),
  [
    "approved_theme:status",
    "approved_theme:money",
    "approved_theme:identity",
    "approved_theme:meaning",
  ],
);

assert.strictEqual(adapted[0], plan[0]);
assert.strictEqual(adapted.at(-1), plan.at(-1));

console.log("stage-0-19f-f13-focused-theme-runtime-fallback-test: PASS");
