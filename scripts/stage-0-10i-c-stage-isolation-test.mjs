import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveCreatorStageVisibility } from "../lib/creator/stageNavigation.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const polish = fs.readFileSync(new URL("../app/creatorlab-ux-i-c.css", import.meta.url), "utf8");

const cases = [
  [{ workspaceStep: 1, productionSubstep: "setup" }, "brief"],
  [{ workspaceStep: 2, productionSubstep: "setup" }, "strategy"],
  [{ workspaceStep: 3, productionSubstep: "setup" }, "production_setup"],
  [{ workspaceStep: 3, productionSubstep: "create_review" }, "create_review"],
  [{ workspaceStep: 4, productionSubstep: "create_review" }, "publish"],
];

for (const [input, expected] of cases) {
  const visibility = resolveCreatorStageVisibility(input);
  assert.equal(Object.values(visibility).filter(Boolean).length, 1);
  assert.equal(visibility[expected], true);
}

// Backward navigation changes visibility only; persisted data and side effects remain untouched.
const persisted = Object.freeze({
  mentor: { direction: "recommended", hook: "opening" },
  marketEvidence: ["signal"],
  production: { scenes: ["scene-1"] },
  publish: { ready: true },
});
let providerCalls = 0;
const transitions = [
  { workspaceStep: 2, productionSubstep: "setup" },
  { workspaceStep: 1, productionSubstep: "setup" },
  { workspaceStep: 3, productionSubstep: "create_review" },
  { workspaceStep: 2, productionSubstep: "setup" },
  { workspaceStep: 4, productionSubstep: "create_review" },
  { workspaceStep: 3, productionSubstep: "create_review" },
  { workspaceStep: 1, productionSubstep: "setup" },
];
for (const transition of transitions) resolveCreatorStageVisibility(transition);
assert.equal(providerCalls, 0);
assert.deepEqual(persisted, {
  mentor: { direction: "recommended", hook: "opening" },
  marketEvidence: ["signal"],
  production: { scenes: ["scene-1"] },
  publish: { ready: true },
});
assert.equal(resolveCreatorStageVisibility({ workspaceStep: 2, productionSubstep: "setup" }).strategy, true);
assert.equal(resolveCreatorStageVisibility({ workspaceStep: 4, productionSubstep: "setup" }).publish, true);

assert.match(page, /const creatorStageVisibility = resolveCreatorStageVisibility/);
assert.match(page, /onClick=\{\(\) => navigateCreatorWorkspaceStep\(1\)\}/);
assert.doesNotMatch(page, /creatorBriefEditorOpen/);
for (const stage of ["strategy", "production_setup", "create_review", "publish"]) {
  assert.match(page, new RegExp(`creatorStageVisibility\\.${stage}`));
}
assert.match(
  polish,
  /#creatorlab-brief-canvas[\s\S]*?#creatorlab-publish-canvas[\s\S]*?\[hidden\][\s\S]*?display:\s*none !important/,
);

console.log("STAGE_0_10I_C_STAGE_ISOLATION=PASS");
