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
assert.equal("motionPresetOffset" in repeated1, false);
assert.equal("motionPresetOffset" in repeated2, false);

const repeatedRun = Array.from({ length: 7 }, (_, index) =>
  resolveCreatorProgramVisualRhythm({
    sceneIndex: index,
    sceneCount: 7,
    selectedMediaUrl: "https://assets.test/same-throughout.jpg",
    previousSelectedMediaUrl:
      index > 0 ? "https://assets.test/same-throughout.jpg" : "",
  }),
);


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

assert.equal(defaultCoverage.length, 1);
assert.equal(defaultCoverage[0].renderer, "static_image");
assert.equal(defaultCoverage[0].durationSec, 18);
assert.equal(defaultCoverage[0].motionPreset, undefined);
assert.equal(defaultCoverage[0].sourceUrl, scene.image);
const exportRoute = fs.readFileSync(new URL("../app/api/creator-export/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(exportRoute, /motionPresetOffset|resolveCreatorProgramVisualRhythm/);
console.log("STAGE_0_20E1_PROGRAM_VISUAL_RHYTHM=PASS");
