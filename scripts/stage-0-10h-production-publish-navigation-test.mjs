import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canOpenCreatorPublish,
  creatorStageAfterSuccess,
  resolveCreatorRestoredNavigation,
} from "../lib/creator/stageNavigation.ts";

const page = fs.readFileSync(
  new URL("../app/create/page.tsx", import.meta.url),
  "utf8",
);

const exportStart = page.indexOf("const handleExportMovie");
const exportEnd = page.indexOf("const handleCreateShareLink", exportStart);
const exportHandler = page.slice(exportStart, exportEnd);

assert.equal(
  creatorStageAfterSuccess(3, "production_setup_continued"),
  4,
);
assert.equal(
  creatorStageAfterSuccess(4, "strategy_approved"),
  4,
  "older success never moves backward",
);

assert.equal(
  canOpenCreatorPublish({
    productionComplete: true,
    publishComplete: false,
  }),
  true,
);
assert.equal(
  canOpenCreatorPublish({
    productionComplete: false,
    publishComplete: false,
  }),
  false,
);

assert.deepEqual(
  resolveCreatorRestoredNavigation({
    persisted: {
      workspaceStep: 4,
      productionSubstep: "setup",
    },
    hasStrategy: true,
    hasProductionPackage: true,
    hasScenes: true,
    canOpenPublish: true,
  }),
  {
    workspaceStep: 4,
    productionSubstep: "setup",
  },
  "persisted Publish navigation restores when publish is currently accessible",
);

assert.deepEqual(
  resolveCreatorRestoredNavigation({
    persisted: {
      workspaceStep: 4,
      productionSubstep: "setup",
    },
    hasStrategy: true,
    hasProductionPackage: true,
    hasScenes: true,
    canOpenPublish: false,
  }),
  {
    workspaceStep: 3,
    productionSubstep: "setup",
  },
  "persisted Publish navigation is clamped when publish is no longer accessible",
);

const priorNavigationIndex = exportHandler.indexOf(
  "const priorNavigation = creatorNavigationRef.current",
);
const advanceIndex = exportHandler.indexOf(
  'creatorStageAfterSuccess(priorNavigation.workspaceStep, "production_setup_continued")',
);
const installNavigationIndex = exportHandler.indexOf(
  "creatorNavigationRef.current = finalNavigation",
);
const persistIndex = exportHandler.indexOf(
  "await persistProject(false",
  installNavigationIndex,
);
const persistedIndex = exportHandler.indexOf(
  "finalProductionPersisted = true",
  persistIndex,
);
const rollbackIndex = exportHandler.indexOf(
  "creatorNavigationRef.current = priorNavigation",
  persistIndex,
);
const visibleAdvanceGuardIndex = exportHandler.indexOf(
  "if (isCreatorLabFlow && finalProductionPersisted)",
  persistedIndex,
);
const visibleAdvanceIndex = exportHandler.indexOf(
  "setCreatorSelectedWorkspaceStep(finalNavigation.workspaceStep)",
  visibleAdvanceGuardIndex,
);

assert.ok(
  priorNavigationIndex >= 0 &&
    advanceIndex > priorNavigationIndex,
  "final Publish navigation is derived from the prior canonical navigation",
);

assert.ok(
  installNavigationIndex > advanceIndex &&
    persistIndex > installNavigationIndex,
  "advanced navigation authority is installed before persistence so the saved snapshot contains it",
);

assert.ok(
  persistedIndex > persistIndex,
  "successful final-production persistence is recorded only after persistProject resolves",
);

assert.ok(
  rollbackIndex > persistIndex &&
    rollbackIndex < visibleAdvanceGuardIndex,
  "failed final-production persistence rolls navigation authority back",
);

assert.ok(
  visibleAdvanceGuardIndex > persistedIndex &&
    visibleAdvanceIndex > visibleAdvanceGuardIndex,
  "visible Publish navigation follows successful persistence",
);

assert.doesNotMatch(
  exportHandler.slice(0, persistedIndex),
  /setCreatorSelectedWorkspaceStep\(finalNavigation\.workspaceStep\)/,
  "Publish UI must not advance before persistence succeeds",
);

assert.match(
  page,
  /const restoredNavigation = isCreatorProject[\s\S]*resolveCreatorRestoredNavigation\(\{/,
);

assert.match(
  page,
  /canOpenPublish: canOpenCreatorPublish\(\{[\s\S]*productionComplete: Boolean\(savedExportedMovieUrl && project\.export_signature\)[\s\S]*publishComplete: savedLifecycle\?\.status === "exported"/,
  "reload derives Publish accessibility from persisted final-production authority",
);

assert.match(
  page,
  /setCreatorSelectedWorkspaceStep\(restoredNavigation\.workspaceStep\)/,
);

assert.match(
  page,
  /setCreatorProductionSubstep\(restoredNavigation\.productionSubstep\)/,
);

assert.match(
  page,
  /if \(creatorProgressStep < previousProgressStep\) \{[\s\S]*Math\.min\(creatorNavigationRef\.current\.workspaceStep, creatorProgressStep\)[\s\S]*setCreatorSelectedWorkspaceStep\(workspaceStep\)/,
  "automatic navigation may clamp backward when lifecycle progress regresses",
);

assert.match(
  page,
  /setCreatorSelectedWorkspaceStep\(step\)/,
  "manual stage navigation remains available",
);

console.log("STAGE_0_10H_PRODUCTION_PUBLISH_NAVIGATION=PASS");
