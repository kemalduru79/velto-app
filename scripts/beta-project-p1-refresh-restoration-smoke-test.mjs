import assert from "node:assert/strict";
import fs from "node:fs";

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
assert.match(page, /new URLSearchParams\(window\.location\.search\)[\s\S]*\.get\(PROJECT_URL_PARAM\)/);
assert.match(page, /void loadProject\(projectId\)/);
assert.match(page, /setSelectedFlowKey\(isCreatorProject \? "creator_lab" : "storyverse"\)/);
assert.match(page, /fetch\(`\/api\/load-project\/\$\{encodeURIComponent\(projectIdToLoad\)\}`/);
assert.match(loadRoute, /authenticateRequest\(req\)/);
assert.match(loadRoute, /getForOwner\([\s\S]*projectId,[\s\S]*principal\.id/);
assert.match(repository, /\.eq\("id", projectId\)[\s\S]*\.eq\("owner_user_id", ownerUserId\)/);

assert.match(page, /const isHydratingRef = useRef\(true\)/);
assert.match(page, /if \(isHydratingRef\.current\) \{\s*return;\s*\}/);
assert.match(page, /finally \{\s*isHydratingRef\.current = false;\s*skipAutosaveRef\.current = false;/);
assert.match(page, /await persistProject\(false\)/);

assert.match(page, /if \(data\?\.project\?\.id\) \{[\s\S]*replaceProjectUrlIdentity\(data\.project\.id\)/);
assert.match(page, /window\.history\.replaceState\(null, "",/);
assert.doesNotMatch(page, /window\.location\.(?:assign|replace)\([^)]*PROJECT_URL_PARAM/);
assert.match(page, /projectId: currentProjectId \|\| undefined/);

assert.match(page, /const PROJECT_ID_PATTERN = \/\^\[A-Za-z0-9_-\]/);
assert.match(page, /Project could not be opened\./);
assert.match(page, /if \(currentProjectId && currentProjectId !== projectId\) \{\s*resetStoryFlow\(\)/);
assert.match(page, /const resetStoryFlow = \(\) => \{[\s\S]*setCurrentProjectId\(""\)[\s\S]*replaceProjectUrlIdentity\(""\)/);

assert.match(page, /const loadedCharacters = isCreatorProject[\s\S]*normalizeCreatorLabCharacters\(project\.characters\)/);
assert.match(page, /dialogueSpeakerCharacterId: isCreatorProject[\s\S]*normalizeCreatorDialogueSpeakerCharacterId/);
assert.match(page, /savedVoicePreferences[\s\S]*voiceSelection: normalizeVoiceLibrarySelection/);
assert.match(page, /normalizeCreatorBackgroundMusicConfig\([\s\S]*savedCreatorPackage\?\.backgroundMusic/);
assert.match(page, /setCreatorProjectContinuityMode\(loadedContinuitySettings\.projectMode\)/);
assert.match(page, /isCreatorProject[\s\S]*: withDefaultGuideCharacter\(project\.characters\)/);

console.log("CreatorLab project refresh restoration smoke test passed.");
