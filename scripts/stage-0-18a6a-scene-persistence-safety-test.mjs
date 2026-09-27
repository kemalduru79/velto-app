import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  resolveCreatorSceneHydrationAuthority,
  resolveCreatorSceneSaveAuthority,
  shouldPersistCreatorSceneProjection,
  shouldPreservePersistedCreatorScenes,
} from "../lib/creator/creatorScenePersistence.ts";
import { assertProjectUpdateMatched } from "../lib/persistence/projects/projectPatch.ts";

const persistedScenes = Array.from({ length: 31 }, (_, index) => ({
  id: index + 1,
  creatorSceneId: `creator-scene-${index + 1}`,
}));

assert.equal(shouldPreservePersistedCreatorScenes({
  persistedSceneCount: persistedScenes.length,
  incomingScenesPresent: true,
  incomingSceneCount: 0,
  serverAuthorizedInvalidation: false,
}), true);
assert.equal(shouldPreservePersistedCreatorScenes({
  persistedSceneCount: persistedScenes.length,
  incomingScenesPresent: true,
  incomingSceneCount: 0,
  serverAuthorizedInvalidation: true,
}), false);

const blockedEmptyWrite = resolveCreatorSceneSaveAuthority({
  persistedScenes,
  candidateScenes: [],
  incomingScenes: [],
  serverAuthorizedInvalidation: false,
});
assert.equal(blockedEmptyWrite.preserved, true);
assert.equal(blockedEmptyWrite.canonicalScenes.length, 31);
assert.equal(blockedEmptyWrite.persistedColumnScenes.length, 31);

const forgedResetWrite = resolveCreatorSceneSaveAuthority({
  persistedScenes,
  candidateScenes: [],
  incomingScenes: [],
  serverAuthorizedInvalidation: false,
  resetScenes: true,
});
assert.equal(forgedResetWrite.preserved, true);
assert.equal(forgedResetWrite.canonicalScenes.length, 31);

const navigationOnlySave = resolveCreatorSceneSaveAuthority({
  persistedScenes,
  candidateScenes: [],
  incomingScenes: undefined,
  serverAuthorizedInvalidation: false,
});
assert.equal(navigationOnlySave.preserved, true);
assert.equal(navigationOnlySave.canonicalScenes.length, 31);
assert.equal(navigationOnlySave.persistedColumnScenes, undefined);

const verifiedScriptInvalidation = resolveCreatorSceneSaveAuthority({
  persistedScenes,
  candidateScenes: [],
  incomingScenes: [],
  serverAuthorizedInvalidation: true,
});
assert.equal(verifiedScriptInvalidation.preserved, false);
assert.deepEqual(verifiedScriptInvalidation.canonicalScenes, []);
assert.equal(shouldPreservePersistedCreatorScenes({
  persistedSceneCount: persistedScenes.length,
  incomingScenesPresent: true,
  incomingSceneCount: 31,
  serverAuthorizedInvalidation: false,
}), false);

for (const authority of ["unknown", "hydrated_empty", "recovery_required"]) {
  assert.equal(shouldPersistCreatorSceneProjection({ authority, sceneCount: 0 }), false);
}
assert.equal(shouldPersistCreatorSceneProjection({
  authority: "hydrated_populated",
  sceneCount: 31,
}), true);
assert.equal(shouldPersistCreatorSceneProjection({
  authority: "hydrated_populated",
  sceneCount: 0,
}), false);

assert.equal(resolveCreatorSceneHydrationAuthority({
  canonicalSceneCount: 0,
  currentProductionPackageSceneCount: 31,
}), "recovery_required");
assert.equal(resolveCreatorSceneHydrationAuthority({
  canonicalSceneCount: 31,
  currentProductionPackageSceneCount: 31,
}), "hydrated_populated");
assert.equal(resolveCreatorSceneHydrationAuthority({
  canonicalSceneCount: 0,
  currentProductionPackageSceneCount: 0,
}), "hydrated_empty");

assert.throws(() => assertProjectUpdateMatched(null, "stale-revision"), /PROJECT_SAVE_CONFLICT/);

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const repository = await readFile(new URL("../lib/persistence/projects/supabaseProjectRepository.ts", import.meta.url), "utf8");

assert.match(page, /creatorSceneHydrationAuthorityRef\.current === "unknown"[\s\S]*creatorSceneHydrationAuthorityRef\.current === "recovery_required"/);
assert.match(page, /persistScenes: shouldPersistCreatorSceneProjection/);
assert.match(page, /const includeSceneProjection = lifecycleOverrides\.persistScenes === true \|\| !effectiveProjectId/);
assert.match(page, /includeSceneProjection \? \{ scenes: sourceScenes \} : \{\}/);
assert.match(page, /creatorSceneHydrationAuthority === "recovery_required"/);
assert.match(page, /currentProductionPackageSceneCount/);

assert.match(route, /resolveCreatorSceneSaveAuthority/);
assert.match(route, /serverAuthorizedInvalidation: false/);
assert.match(route, /if \(textChanged\) \{[\s\S]*invalidateCreatorSceneAuthorityForScriptChange/);
assert.match(route, /incomingScenes: hasScenes \? scenes : undefined/);
assert.match(route, /scenes: sceneSaveAuthority\.canonicalScenes/);
assert.match(route, /projectId && !hasCreatorProjectState/);
assert.match(route, /creatorStateForAttachment = authoritativeCreatorState \|\| persistedCreatorStateForPartialSave/);
assert.match(route, /replaceProjectReferences\([\s\S]*extractProjectMediaReferences\(result\.project\)/);
assert.doesNotMatch(route, /resetScenes/);
assert.match(route, /PROJECT_SAVE_CONFLICT[\s\S]*status: 409/);

assert.match(repository, /\.eq\("owner_user_id", input\.ownerUserId\)/);
assert.match(repository, /\.eq\("updated_at", input\.expectedUpdatedAt\)/);

console.log("STAGE_0_18A6A_SCENE_PERSISTENCE_SAFETY=PASS");
