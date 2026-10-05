import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorAutosaveSemanticKey,
  resolveCreatorAddedSceneScriptRevision,
  shouldPersistCreatorAutosaveIntent,
} from "../lib/creator/creatorHydrationPersistence.ts";
import { creatorSceneOutputIsCurrent } from "../lib/creator/creatorScriptApproval.ts";
import { resolveCreatorProjectRevisionAdvance } from "../lib/creator/projectSaveCoordinator.ts";
import { resolveCreatorSceneHydrationAuthority } from "../lib/creator/creatorScenePersistence.ts";
import { resolveCreatorRestoredNavigation } from "../lib/creator/stageNavigation.ts";

const approved = { revision: 2, approval: { approvedRevision: 2 } };
const packageRecord = { sourceScriptRevision: 2 };
const currentScenes = [{ creatorSceneId: "one", scriptRevision: 2 }];
const staleScenes = [{ creatorSceneId: "one", scriptRevision: 1 }];

assert.equal(creatorSceneOutputIsCurrent({ script: approved, productionPackage: packageRecord, scenes: staleScenes }), false);
assert.equal(resolveCreatorSceneHydrationAuthority({ canonicalSceneCount: 3, currentProductionPackageSceneCount: 0 }), "hydrated_populated");
assert.deepEqual(resolveCreatorRestoredNavigation({ persisted: null, hasStrategy: true, hasProductionPackage: true, hasScenes: true, canOpenPublish: false }), { workspaceStep: 3, productionSubstep: "create_review" });
assert.equal(resolveCreatorAddedSceneScriptRevision({ script: approved, productionPackage: packageRecord, scenes: currentScenes }), 2);
assert.equal(resolveCreatorAddedSceneScriptRevision({ script: approved, productionPackage: packageRecord, scenes: staleScenes }), null);

const baseline = createCreatorAutosaveSemanticKey({ title: "Saved", scenes: staleScenes });
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: baseline, currentKey: createCreatorAutosaveSemanticKey({ scenes: staleScenes, title: "Saved" }) }), false);
const edited = createCreatorAutosaveSemanticKey({ title: "Edited", scenes: staleScenes });
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: baseline, currentKey: edited }), true);
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: edited, currentKey: edited }), false);

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.doesNotMatch(page, /!creatorSceneOutputIsCurrent\([\s\S]{0,300}\? \[\]/, "currentness must not erase persisted scenes during hydration");
assert.match(page, /const persistedCreatorScenes = canonicalCreatorState\?\.createReview\.scenes \?\? project\.scenes/);
assert.match(page, /hasScenes: loadedProjectScenes\.length > 0/);
assert.doesNotMatch(page, /creatorAutosaveSemanticBaselineRef\.current = canonicalCreatorState/, "raw persisted state must not become the post-normalization hydration baseline");
assert.match(page, /creatorHydrationSemanticBaselineGenerationRef\.current = loadGeneration/);
assert.match(page, /creatorAutosaveSemanticBaselineRef\.current = creatorAutosaveSemanticIntent;/);
assert.match(page, /creatorAutosaveSemanticBaselineRef\.current = persistedSemanticIntent/);
assert.match(page, /persistedSemanticIntent = capturedCreatorProjectState[\s\S]*createCreatorAutosaveSemanticKey\(capturedCreatorProjectState\)/);

const loadedA = createCreatorAutosaveSemanticKey({ title: "A" });
const earlyEditB = createCreatorAutosaveSemanticKey({ title: "B" });
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: loadedA, currentKey: earlyEditB }), true, "an edit before hydration release remains dirty against loaded authority");
const requestB = createCreatorAutosaveSemanticKey({ title: "B", scenes: [{ id: 1 }] });
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: requestB, currentKey: requestB }), false, "the exact successful request becomes the baseline");
const concurrentC = createCreatorAutosaveSemanticKey({ title: "C", scenes: [{ id: 1 }] });
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: requestB, currentKey: concurrentC }), true, "a concurrent post-request edit remains dirty");
assert.match(page, /scriptRevision,/);

assert.equal(
  resolveCreatorProjectRevisionAdvance({
    responseProjectId: "project-a",
    responseUpdatedAt: "2026-10-05T21:22:43.915411+00:00",
    activeProjectId: "project-a",
    activeUpdatedAt: "2026-10-05T21:21:49.156534+00:00",
  }),
  "2026-10-05T21:22:43.915411+00:00",
  "a late successful save for the still-active project must advance revision authority",
);
assert.equal(
  resolveCreatorProjectRevisionAdvance({
    responseProjectId: "project-b",
    responseUpdatedAt: "2026-10-05T21:22:43.915411+00:00",
    activeProjectId: "project-a",
    activeUpdatedAt: "2026-10-05T21:21:49.156534+00:00",
  }),
  null,
  "a response for another project must never advance revision authority",
);
assert.equal(
  resolveCreatorProjectRevisionAdvance({
    responseProjectId: "project-a",
    responseUpdatedAt: "2026-10-05T21:20:00.000000+00:00",
    activeProjectId: "project-a",
    activeUpdatedAt: "2026-10-05T21:21:49.156534+00:00",
  }),
  null,
  "an older response must never regress revision authority",
);

const saveResponseStart = page.indexOf("const data = await res.json();");
const saveResponseEnd = page.indexOf("await fetchProjects();", saveResponseStart);
const saveResponseBlock = page.slice(saveResponseStart, saveResponseEnd);
assert.ok(saveResponseStart >= 0 && saveResponseEnd > saveResponseStart, "save response block must exist");
assert.ok(
  saveResponseBlock.indexOf("if (!res.ok)") < saveResponseBlock.indexOf("isCreatorProjectSaveBindingActive"),
  "HTTP failure must be handled before active-binding discard",
);
assert.ok(
  saveResponseBlock.indexOf("resolveCreatorProjectRevisionAdvance") <
    saveResponseBlock.indexOf("isCreatorProjectSaveBindingActive"),
  "successful save revision must advance before an inactive binding can discard UI effects",
);

console.log("Stage 0.18A6G.1 reload hydration/autosave regression passed.");
