import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const persistStart = page.indexOf("const executePersistProject = async");
const saveStart = page.indexOf("const saveProject = async", persistStart);
const loadStart = page.indexOf("const loadProject = async", saveStart);
const persistProject = page.slice(persistStart, saveStart);
const saveProject = page.slice(saveStart, loadStart);
const autosaveStart = page.indexOf("autosaveTimerRef.current = setTimeout");
const autosave = page.slice(autosaveStart, page.indexOf("useEffect(() => {", autosaveStart));

assert.match(page, /data-creator-manual-save="true"/);
assert.match(page, /onClick=\{\(\) => void saveProject\(\)\}/);
assert.match(page, /"Saving…"/);
assert.match(page, /"Saved"/);

assert.match(saveProject, /await persistProject\(true\)/);
assert.match(saveProject, /clearTimeout\(autosaveTimerRef\.current\)/);
assert.match(saveProject, /setIsSavingProject\(true\)/);
assert.match(saveProject, /setSaveMessage\(""\)[\s\S]*e\?\.message/);
assert.match(saveProject, /Reload before retrying; your local work is still here/);
assert.doesNotMatch(saveProject, /setCreatorSelectedWorkspaceStep|navigateCreator|fetch\(|generate|export/i);

assert.match(persistProject, /fetch\("\/api\/save-project"/);
assert.match(persistProject, /projectId: lifecycleOverrides\.forceNewProject \? undefined : effectiveProjectId \|\| undefined/);
assert.match(persistProject, /creatorMentorResult: persistedMentorResult/);
assert.match(persistProject, /strategySelection:/);
assert.match(persistProject, /!isCreatorLabFlow && sourceScenes\.length === 0/);
assert.equal((persistProject.match(/fetch\("\/api\/save-project"/g) || []).length, 1);
assert.match(persistProject, /projectSaveQueueRef\.current[\s\S]*executePersistProject/);

assert.match(autosave, /await persistProject\(false\)/);
assert.match(autosave, /setSaveMessage\(ui\.autoSaved\)/);
assert.doesNotMatch(autosave, /saveProject\(\)|setCreatorSelectedWorkspaceStep|navigateCreator/);

console.log("Stage 0.10H manual project Save test passed.");
