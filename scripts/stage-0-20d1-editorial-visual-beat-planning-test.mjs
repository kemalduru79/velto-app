import assert from "node:assert/strict";
import {
  CREATOR_EDITORIAL_VISUAL_BEAT_POLICY,
  createCreatorEditorialVisualBeatPlan,
} from "../lib/creator/visualCoverage.ts";

const sceneId = "11111111-1111-4111-8111-111111111111";

const compact = createCreatorEditorialVisualBeatPlan({
  creatorSceneId: sceneId,
  targetDurationSec: 8,
});
assert.deepEqual(
  compact.map(({ startSec, endSec, durationSec }) => ({
    startSec,
    endSec,
    durationSec,
  })),
  [{ startSec: 0, endSec: 8, durationSec: 8 }],
);

const ten = createCreatorEditorialVisualBeatPlan({
  creatorSceneId: sceneId,
  targetDurationSec: 10,
});
assert.deepEqual(
  ten.map((beat) => beat.durationSec),
  [5, 5],
  "10 seconds must not remain a single long visual beat",
);

const eighteen = createCreatorEditorialVisualBeatPlan({
  creatorSceneId: sceneId,
  targetDurationSec: 18,
});
assert.deepEqual(
  eighteen.map((beat) => beat.durationSec),
  [6, 6, 6],
);

const twentyFour = createCreatorEditorialVisualBeatPlan({
  creatorSceneId: sceneId,
  targetDurationSec: 24,
});
assert.deepEqual(
  twentyFour.map((beat) => beat.durationSec),
  [8, 8, 8],
);

const thirty = createCreatorEditorialVisualBeatPlan({
  creatorSceneId: sceneId,
  targetDurationSec: 30,
});
assert.deepEqual(
  thirty.map((beat) => beat.durationSec),
  [7.5, 7.5, 7.5, 7.5],
);

for (const targetDurationSec of [8, 10, 14.75, 18, 20.53, 24, 30]) {
  const plan = createCreatorEditorialVisualBeatPlan({
    creatorSceneId: sceneId,
    targetDurationSec,
  });

  assert.ok(plan.length > 0);

  let cursor = 0;
  for (const beat of plan) {
    assert.equal(beat.startSec, cursor);
    assert.ok(beat.endSec > beat.startSec);
    assert.ok(
      beat.durationSec <=
        CREATOR_EDITORIAL_VISUAL_BEAT_POLICY.maximumBeatDurationSec + 0.01,
      `beat ${beat.id} exceeds maximum editorial cadence`,
    );

    if (plan.length > 1) {
      assert.ok(
        beat.durationSec >=
          CREATOR_EDITORIAL_VISUAL_BEAT_POLICY.minimumBeatDurationSec - 0.01,
        `beat ${beat.id} is shorter than the minimum editorial cadence`,
      );
    }

    cursor = beat.endSec;
  }

  assert.ok(
    Math.abs(cursor - targetDurationSec) <= 0.01,
    `plan must fully cover ${targetDurationSec}s`,
  );
}

const hints = [
  { purpose: "Establish the real-world context" },
  { purpose: "Show the mechanism" },
  { purpose: "Resolve the consequence" },
];
const hintsBefore = JSON.stringify(hints);

const hinted = createCreatorEditorialVisualBeatPlan({
  creatorSceneId: sceneId,
  targetDurationSec: 18,
  purposeHints: hints,
});

assert.deepEqual(
  hinted.map((beat) => beat.purposeHint),
  [
    "Establish the real-world context",
    "Show the mechanism",
    "Resolve the consequence",
  ],
  "legacy purpose hints may annotate cadence slots but must not control timing",
);

assert.deepEqual(
  hinted.map((beat) => beat.cadenceRole),
  ["establish", "develop", "resolve"],
);

assert.equal(
  JSON.stringify(hints),
  hintsBefore,
  "beat planning must not mutate legacy visual block hints",
);

assert.deepEqual(
  createCreatorEditorialVisualBeatPlan({
    creatorSceneId: "",
    targetDurationSec: 18,
  }),
  [],
);

assert.deepEqual(
  createCreatorEditorialVisualBeatPlan({
    creatorSceneId: sceneId,
    targetDurationSec: 0,
  }),
  [],
);

console.log("STAGE_0_20D1_EDITORIAL_VISUAL_BEAT_PLANNING=PASS");
