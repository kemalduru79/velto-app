import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CREATOR_VISIBLE_WORKFLOW_STAGES,
  creatorStageAfterSuccess,
  resolveCreatorStageVisibility,
  resolveCreatorVisibleWorkflowProgress,
  resolveCreatorVisibleWorkflowStep,
  resolveCreatorWorkspaceTarget,
} from "../lib/creator/stageNavigation.ts";

assert.equal(CREATOR_VISIBLE_WORKFLOW_STAGES.length, 5);
assert.deepEqual(CREATOR_VISIBLE_WORKFLOW_STAGES.map((stage) => stage.title), [
  "Brief", "Strategy", "Production Setup", "Create & Review", "Publish",
]);
assert.equal(CREATOR_VISIBLE_WORKFLOW_STAGES.some((stage) => stage.title === "Script Review"), false);
assert.equal(resolveCreatorVisibleWorkflowStep({ workspaceStep: 2, productionSubstep: "setup" }), 2);
assert.equal(creatorStageAfterSuccess(2, "strategy_approved"), 3);
assert.equal(resolveCreatorVisibleWorkflowStep({ workspaceStep: 3, productionSubstep: "setup" }), 3);
assert.equal(resolveCreatorVisibleWorkflowStep({ workspaceStep: 3, productionSubstep: "create_review" }), 4);
assert.equal(resolveCreatorVisibleWorkflowStep({ workspaceStep: 4, productionSubstep: "create_review" }), 5);
assert.deepEqual(resolveCreatorWorkspaceTarget(3), { workspaceStep: 3, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorWorkspaceTarget(4), { workspaceStep: 3, productionSubstep: "create_review" });
assert.deepEqual(resolveCreatorWorkspaceTarget(5), { workspaceStep: 4 });
assert.equal(resolveCreatorVisibleWorkflowProgress(2, 10), 20);
assert.equal(resolveCreatorVisibleWorkflowProgress(3, 35), 40);
assert.equal(resolveCreatorVisibleWorkflowProgress(4, 72), 72);
assert.equal(resolveCreatorVisibleWorkflowProgress(5, 78), 80);
assert.equal(resolveCreatorVisibleWorkflowProgress(5, 100), 100);
assert.equal(resolveCreatorStageVisibility({ workspaceStep: 3, productionSubstep: "setup" }).production_setup, true);
assert.equal(resolveCreatorStageVisibility({ workspaceStep: 3, productionSubstep: "create_review" }).create_review, true);

const css = await readFile(new URL("../app/creatorlab-ux-h0a.css", import.meta.url), "utf8");
assert.doesNotMatch(css, /workflow-step:nth-of-type\(4\)[^{]*\{\s*display:\s*none/);
assert.doesNotMatch(css, /content:\s*["']Production["']/);
const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(page, /CreatorScriptReview/);
assert.match(page, /resolveCreatorVisibleWorkflowStep/);

console.log("POST_0_13B_FIVE_STAGE_WORKFLOW_HOTFIX=PASS");
