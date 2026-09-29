import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorAutosaveSemanticKey,
  resolveCreatorAddedSceneScriptRevision,
  shouldPersistCreatorAutosaveIntent,
} from "../lib/creator/creatorHydrationPersistence.ts";
import { creatorSceneOutputIsCurrent } from "../lib/creator/creatorScriptApproval.ts";
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
assert.match(page, /creatorAutosaveSemanticBaselineRef\.current = canonicalCreatorState[\s\S]*createCreatorAutosaveSemanticKey\(canonicalCreatorState\)/);
assert.doesNotMatch(page, /requestAnimationFrame\([\s\S]{0,300}creatorAutosaveSemanticBaselineRef\.current/);
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

console.log("Stage 0.18A6G.1 reload hydration/autosave regression passed.");
