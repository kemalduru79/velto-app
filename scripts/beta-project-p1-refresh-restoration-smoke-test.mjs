import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseCreatorProductionSubstepParam,
  resolveCreatorRestoredNavigation,
  resolveCreatorWorkspaceTarget,
  serializeCreatorProductionSubstepParam,
} from "../lib/creator/stageNavigation.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const loadRoute = fs.readFileSync(
  new URL("../app/api/load-project/[projectId]/route.ts", import.meta.url),
  "utf8",
);
const repository = fs.readFileSync(
  new URL("../lib/persistence/projects/supabaseProjectRepository.ts", import.meta.url),
  "utf8",
);

assert.match(page, /const PROJECT_URL_PARAM = "project"/);
assert.match(page, /const PRODUCTION_URL_PARAM = "production"/);
assert.match(page, /new URLSearchParams\(window\.location\.search\)[\s\S]*\.get\(PROJECT_URL_PARAM\)/);
assert.match(page, /void loadProject\(projectId\)/);
assert.match(page, /setSelectedFlowKey\(isCreatorProject \? "creator_lab" : "storyverse"\)/);
assert.match(page, /fetch\(`\/api\/load-project\/\$\{encodeURIComponent\(projectIdToLoad\)\}`/);
assert.match(loadRoute, /authenticateRequest\(req\)/);
assert.match(loadRoute, /getForOwner\([\s\S]*projectId,[\s\S]*principal\.id/);
assert.match(repository, /\.eq\("id", projectId\)[\s\S]*\.eq\("owner_user_id", ownerUserId\)/);

assert.match(page, /const isHydratingRef = useRef\(true\)/);
assert.match(page, /if \(isHydratingRef\.current\) \{\s*return;\s*\}/);
assert.match(page, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*window\.requestAnimationFrame\(\(\) => \{[\s\S]*isHydratingRef\.current = false;[\s\S]*skipAutosaveRef\.current = false;/);
assert.match(page, /await persistProject\(false\)/);

assert.match(page, /if \(data\?\.project\?\.id && !lifecycleOverrides\.forceNewProject\) \{[\s\S]*replaceProjectUrlIdentity\(data\.project\.id\)/);
assert.match(page, /window\.history\.replaceState\(null, "",/);
assert.doesNotMatch(page, /window\.location\.(?:assign|replace)\([^)]*PROJECT_URL_PARAM/);
assert.match(page, /projectId: lifecycleOverrides\.forceNewProject \? undefined : effectiveProjectId \|\| undefined/);
assert.match(page, /projectGenerationRef\.current !== loadGeneration/);

assert.match(page, /const PROJECT_ID_PATTERN = \/\^\[A-Za-z0-9_-\]/);
assert.match(page, /Project could not be opened\./);
assert.match(page, /if \(currentProjectId && currentProjectId !== projectId\) \{\s*resetStoryFlow\(\)/);
assert.match(page, /const resetStoryFlow = \(\) => \{[\s\S]*setCurrentProjectId\(""\)[\s\S]*replaceProjectUrlIdentity\(""\)/);

assert.equal(parseCreatorProductionSubstepParam("setup"), "setup");
assert.equal(parseCreatorProductionSubstepParam("review"), "create_review");
assert.equal(parseCreatorProductionSubstepParam("invalid"), null);
assert.equal(parseCreatorProductionSubstepParam(null), null);
assert.equal(parseCreatorProductionSubstepParam(undefined), null);
assert.equal(serializeCreatorProductionSubstepParam("create_review"), "review");
assert.equal(serializeCreatorProductionSubstepParam("setup"), "setup");
const restorableProject = {
  hasStrategy: true,
  hasProductionPackage: true,
  canOpenPublish: false,
};
assert.deepEqual(resolveCreatorRestoredNavigation({
  ...restorableProject,
  persisted: { workspaceStep: 3, productionSubstep: "create_review" },
  productionSubstepIntent: "setup",
  hasScenes: true,
}), { workspaceStep: 3, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorRestoredNavigation({
  ...restorableProject,
  persisted: { workspaceStep: 3, productionSubstep: "setup" },
  productionSubstepIntent: "create_review",
  hasScenes: true,
}), { workspaceStep: 3, productionSubstep: "create_review" });
assert.deepEqual(resolveCreatorRestoredNavigation({
  ...restorableProject,
  persisted: { workspaceStep: 3, productionSubstep: "create_review" },
  productionSubstepIntent: "create_review",
  hasScenes: false,
}), { workspaceStep: 3, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorRestoredNavigation({
  persisted: { workspaceStep: 2, productionSubstep: "setup" },
  productionSubstepIntent: "create_review",
  hasStrategy: true,
  hasProductionPackage: false,
  hasScenes: true,
  canOpenPublish: false,
}), { workspaceStep: 2, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorRestoredNavigation({
  ...restorableProject,
  persisted: { workspaceStep: 3, productionSubstep: "setup" },
  productionSubstepIntent: null,
  hasScenes: true,
}), { workspaceStep: 3, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorRestoredNavigation({
  ...restorableProject,
  persisted: { workspaceStep: 3, productionSubstep: "create_review" },
  hasScenes: true,
}), { workspaceStep: 3, productionSubstep: "create_review" });
assert.deepEqual(resolveCreatorRestoredNavigation({
  ...restorableProject,
  persisted: { workspaceStep: 3, productionSubstep: "create_review" },
  hasScenes: false,
}), { workspaceStep: 3, productionSubstep: "setup" });
assert.match(page, /parseCreatorProductionSubstepParam\([\s\S]*new URLSearchParams\(window\.location\.search\)\.get\(PRODUCTION_URL_PARAM\)/);
assert.match(page, /url\.searchParams\.set\([\s\S]*PRODUCTION_URL_PARAM/);
assert.match(page, /serializeCreatorProductionSubstepParam\(substep\)/);
assert.match(page, /const selectCreatorProductionSubstep = \(substep: CreatorProductionSubstep, persist = true\) => \{[\s\S]*setCreatorProductionSubstep\(substep\)[\s\S]*replaceProductionSubstepUrl\(substep\)/);
assert.match(page, /onClick=\{\(\) => selectCreatorProductionSubstep\("create_review"\)\}/);
assert.match(page, /const target = resolveCreatorWorkspaceTarget\(step\)/);
assert.deepEqual(resolveCreatorWorkspaceTarget(3), { workspaceStep: 3, productionSubstep: "setup" });
assert.deepEqual(resolveCreatorWorkspaceTarget(4), { workspaceStep: 3, productionSubstep: "create_review" });
assert.deepEqual(resolveCreatorWorkspaceTarget(5), { workspaceStep: 4 });
assert.match(page, /onEdit=\{\(\) => selectCreatorProductionSubstep\("setup"\)\}/);
assert.match(page, /resolveCreatorRestoredNavigation\(\{[\s\S]*persisted: canonicalCreatorState\?\.navigation,[\s\S]*productionSubstepIntent: parseCreatorProductionSubstepParam[\s\S]*hasScenes: loadedProjectScenes\.length > 0/);
assert.match(page, /const url = new URL\(window\.location\.href\);[\s\S]*url\.searchParams\.set\([\s\S]*PRODUCTION_URL_PARAM/);
assert.match(page, /onStartNewProject=\{\(\) => \{[\s\S]*window\.history\.replaceState\(null, "", "\/create\?flow=creator_lab"\)/);

assert.match(page, /const loadedCharacters = isCreatorProject[\s\S]*normalizeCreatorLabCharacters\(project\.characters\)/);
assert.match(page, /dialogueSpeakerCharacterId: isCreatorProject[\s\S]*normalizeCreatorDialogueSpeakerCharacterId/);
assert.match(page, /savedVoicePreferences[\s\S]*voiceSelection: normalizeVoiceLibrarySelection/);
assert.match(page, /normalizeCreatorBackgroundMusicConfig\([\s\S]*savedCreatorPackage\?\.backgroundMusic/);
assert.match(page, /setCreatorProjectContinuityMode\(loadedContinuitySettings\.projectMode\)/);
assert.match(page, /isCreatorProject[\s\S]*: withDefaultGuideCharacter\(project\.characters\)/);

console.log("CreatorLab project refresh restoration smoke test passed.");
