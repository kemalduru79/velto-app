import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolveCreatorProgramVisualRhythm,
} from "../lib/creator/programEditorialPolish.ts";
import {
  createCreatorVisualCoveragePlan,
} from "../lib/creator/visualCoverage.ts";

const unique = [
  "https://assets.test/1.jpg",
  "https://assets.test/2.jpg",
  "https://assets.test/3.jpg",
  "https://assets.test/4.jpg",
  "https://assets.test/5.jpg",
  "https://assets.test/6.jpg",
  "https://assets.test/7.jpg",
];

const roles = unique.map((url, index) =>
  resolveCreatorProgramVisualRhythm({
    sceneIndex: index,
    sceneCount: unique.length,
    selectedMediaUrl: url,
    previousSelectedMediaUrl: index > 0 ? unique[index - 1] : "",
  }).role
);

assert.deepEqual(
  roles,
  ["opening", "body", "body", "midpoint", "body", "body", "closing"],
  "program position authority must distinguish opening, midpoint and closing",
);

const repeated1 = resolveCreatorProgramVisualRhythm({
  sceneIndex: 1,
  sceneCount: 4,
  selectedMediaUrl: "https://assets.test/repeated.jpg",
  previousSelectedMediaUrl: "https://assets.test/repeated.jpg",
});

const repeated2 = resolveCreatorProgramVisualRhythm({
  sceneIndex: 2,
  sceneCount: 4,
  selectedMediaUrl: "https://assets.test/repeated.jpg",
  previousSelectedMediaUrl: "https://assets.test/repeated.jpg",
});

assert.equal(repeated1.repeatedSelectedMedia, true);
assert.equal(repeated2.repeatedSelectedMedia, true);
assert.notEqual(
  repeated1.motionPresetOffset,
  repeated2.motionPresetOffset,
  "adjacent repeated visuals must not begin with the same motion phase",
);

const repeatedRun = Array.from({ length: 7 }, (_, index) =>
  resolveCreatorProgramVisualRhythm({
    sceneIndex: index,
    sceneCount: 7,
    selectedMediaUrl: "https://assets.test/same-throughout.jpg",
    previousSelectedMediaUrl:
      index > 0 ? "https://assets.test/same-throughout.jpg" : "",
  }),
);

for (let index = 1; index < repeatedRun.length; index += 1) {
  assert.notEqual(
    repeatedRun[index].motionPresetOffset,
    repeatedRun[index - 1].motionPresetOffset,
    `adjacent repeated media must differ at scene boundary ${index}`,
  );
}

assert.equal(
  repeatedRun[3].role,
  "midpoint",
  "repeated-media protection must cover the midpoint boundary",
);
assert.equal(
  repeatedRun[6].role,
  "closing",
  "repeated-media protection must cover the closing boundary",
);

const scene = {
  creatorSceneId: "11111111-1111-4111-8111-111111111111",
  selectedSource: "image",
  image: "https://assets.test/current.jpg",
  targetDurationSec: 18,
};

const defaultCoverage = createCreatorVisualCoveragePlan(scene, {
  editorialCadence: true,
});

const phasedCoverage = createCreatorVisualCoveragePlan(scene, {
  editorialCadence: true,
  motionPresetOffset: 1,
});

assert.deepEqual(
  defaultCoverage.map((beat) => beat.motionPreset),
  ["slow_push_in", "soft_pan", "cutaway"],
  "existing D2 default motion order must remain stable",
);

assert.deepEqual(
  phasedCoverage.map((beat) => beat.motionPreset),
  ["soft_pan", "cutaway", "slow_push_in"],
  "program rhythm authority must rotate image motion without changing media",
);

assert.deepEqual(
  phasedCoverage.map((beat) => beat.durationSec),
  defaultCoverage.map((beat) => beat.durationSec),
  "program polish must not alter D1 timing authority",
);

assert.ok(
  phasedCoverage.every(
    (beat) => beat.sourceUrl === "https://assets.test/current.jpg",
  ),
  "program polish must not replace selected media",
);

const exportRoute = fs.readFileSync(
  new URL("../app/api/creator-export/route.ts", import.meta.url),
  "utf8",
);

assert.match(
  exportRoute,
  /resolveCreatorProgramVisualRhythm/,
);
assert.match(
  exportRoute,
  /sceneCount:\s*canonicalScenes\.length/,
);
assert.match(
  exportRoute,
  /previousSelectedMediaUrl/,
);
assert.match(
  exportRoute,
  /motionPresetOffset:\s*programRhythm\.motionPresetOffset/,
);

console.log("STAGE_0_20E1_PROGRAM_VISUAL_RHYTHM=PASS");
