import assert from "node:assert/strict";
import fs from "node:fs";
import { shouldRestoreHydratedCreatorScenes } from "../lib/creator/creatorScenePersistence.ts";

assert.equal(shouldRestoreHydratedCreatorScenes({
  authority: "hydrated_populated",
  currentSceneCount: 0,
  lastPopulatedSceneCount: 3,
  isHydrating: false,
}), true, "an unexplained post-hydration empty scene state must restore the last populated projection");

assert.equal(shouldRestoreHydratedCreatorScenes({
  authority: "hydrated_populated",
  currentSceneCount: 0,
  lastPopulatedSceneCount: 3,
  isHydrating: true,
}), false, "hydration itself may project intermediate state without triggering restoration");

assert.equal(shouldRestoreHydratedCreatorScenes({
  authority: "hydrated_empty",
  currentSceneCount: 0,
  lastPopulatedSceneCount: 3,
  isHydrating: false,
}), false, "an authoritative empty state must remain empty");

assert.equal(shouldRestoreHydratedCreatorScenes({
  authority: "hydrated_populated",
  currentSceneCount: 0,
  lastPopulatedSceneCount: 0,
  isHydrating: false,
}), false, "restoration requires a real populated backup");

assert.equal(shouldRestoreHydratedCreatorScenes({
  authority: "hydrated_populated",
  currentSceneCount: 3,
  lastPopulatedSceneCount: 3,
  isHydrating: false,
}), false, "populated state must not be rewritten");

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");

assert.match(page, /const creatorHydrationSemanticBaselineGenerationRef = useRef<number \| null>\(null\)/);
assert.match(page, /creatorHydrationSemanticBaselineGenerationRef\.current = loadGeneration/);
assert.doesNotMatch(page, /creatorAutosaveSemanticBaselineRef\.current = canonicalCreatorState/, "hydration baseline must be derived from rendered normalized state, not raw persisted state");
assert.match(page, /creatorAutosaveSemanticBaselineRef\.current = creatorAutosaveSemanticIntent;[\s\S]{0,180}creatorHydrationSemanticBaselineGenerationRef\.current = null/);
assert.match(page, /creatorLastPopulatedScenesRef\.current = hydratedProjectScenes;[\s\S]{0,80}setScenes\(hydratedProjectScenes\)/);
assert.match(page, /shouldRestoreHydratedCreatorScenes\(\{[\s\S]{0,320}lastPopulatedSceneCount: creatorLastPopulatedScenesRef\.current\.length/);
assert.match(page, /const clearCreatorScenesForAuthoritativeInvalidation = \(\) => \{[\s\S]{0,260}setScenes\(\[\]\);/);

const buildStoryStart = page.indexOf("const buildStory = async () =>");
const storyverseBranchStart = page.indexOf("if (!title.trim())", buildStoryStart);
assert.ok(buildStoryStart >= 0 && storyverseBranchStart > buildStoryStart, "CreatorLab Prepare Scenes branch must be locatable");
const creatorBuildBranch = page.slice(buildStoryStart, storyverseBranchStart);
assert.doesNotMatch(creatorBuildBranch, /setScenes\(\[\]\)/, "CreatorLab Prepare Scenes must keep the current scene projection until replacement succeeds");
assert.match(creatorBuildBranch, /setScenes\(packageScenes\)/, "CreatorLab Prepare Scenes must install the successful replacement topology");

const directEmptyCalls = page.match(/setScenes\(\[\]\);/g) || [];
assert.equal(directEmptyCalls.length, 2, "only the authoritative-clear helper and Storyverse build may directly clear scenes");
const authoritativeCalls = page.match(/clearCreatorScenesForAuthoritativeInvalidation\(\);/g) || [];
assert.ok(authoritativeCalls.length >= 6, "CreatorLab script/package invalidations must clear scenes through explicit authority");

console.log("Stage 0.18A6G.2 post-hydration scene-state regression passed.");
