import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  creatorProjectInsertPayload,
  creatorProjectUpdatePayload,
  projectPayload,
} from "../lib/persistence/projects/projectPatch.ts";
import {
  advanceCreatorProjectSaveBinding,
  createCreatorProjectSaveBinding,
} from "../lib/creator/projectSaveCoordinator.ts";
import {
  assessCreatorScriptGenerationAuthority,
  persistCreatorStrategyAuthority,
} from "../lib/creator/creatorWorkflowAuthority.ts";
import { getCreatorScriptDurationContract } from "../lib/creator/creatorScript.ts";

const freshInput = {
  ownerUserId: "owner-1",
  childId: null,
  flowType: "creator_lab",
  title: "Fresh five-minute project",
  inputPrompt: "A grounded new topic",
  storyPremise: "",
  language: "en",
  visualBible: null,
  characters: [],
  scenes: [],
};
const insert = creatorProjectInsertPayload(freshInput);
assert.deepEqual(insert.visual_bible, {});
assert.deepEqual(insert.characters, []);
assert.deepEqual(insert.scenes, []);
assert.equal(insert.story_premise, "");
assert.equal(insert.input_prompt, "A grounded new topic");
assert.equal(insert.child_id, null);
assert.equal(insert.flow_type, "creator_lab");

const omittedUpdate = projectPayload({ ownerUserId: "owner-1", childId: null, flowType: "creator_lab", projectId: "project-1" }, false);
assert.equal(Object.hasOwn(omittedUpdate, "visual_bible"), false);
const nullUpdate = projectPayload({ ownerUserId: "owner-1", childId: null, flowType: "creator_lab", projectId: "project-1", visualBible: null }, false);
assert.equal(nullUpdate.visual_bible, null);
const creatorCompatibleUpdate = creatorProjectUpdatePayload({
  ownerUserId: "owner-1",
  childId: null,
  flowType: "creator_lab",
  projectId: "project-1",
  visualBible: null,
  inputPrompt: "Updated prompt",
});
assert.equal(Object.hasOwn(creatorCompatibleUpdate, "visual_bible"), false);
assert.equal(creatorCompatibleUpdate.input_prompt, "Updated prompt");
assert.equal(projectPayload({ ownerUserId: "owner-1", childId: "child-1", flowType: "storyverse", projectId: "story-1", visualBible: null }, false).visual_bible, null);
assert.equal(creatorProjectUpdatePayload({ ownerUserId: "owner-1", childId: "child-1", flowType: "storyverse", projectId: "story-1", visualBible: null }).visual_bible, null);

const initialBinding = createCreatorProjectSaveBinding({ originProjectId: "", projectId: "", expectedUpdatedAt: "", generation: 7, creatorProjectState: null });
const createdProject = { id: "project-created", updated_at: "2026-09-09T12:00:00.000Z" };
const updateBinding = advanceCreatorProjectSaveBinding(initialBinding, {
  projectId: createdProject.id,
  expectedUpdatedAt: createdProject.updated_at,
  generation: 7,
});
assert.ok(updateBinding);
assert.equal(updateBinding.projectId, createdProject.id);
assert.equal(updateBinding.expectedUpdatedAt, createdProject.updated_at);
const secondRevision = "2026-09-09T12:01:00.000Z";
const secondUpdateBinding = advanceCreatorProjectSaveBinding(updateBinding, {
  projectId: createdProject.id,
  expectedUpdatedAt: secondRevision,
  generation: 7,
});
assert.equal(secondUpdateBinding?.projectId, createdProject.id);
assert.equal(secondUpdateBinding?.expectedUpdatedAt, secondRevision);

const duration = getCreatorScriptDurationContract({ targetDurationSec: 300, language: "en", actualWordCount: 0 });
assert.deepEqual([duration.targetWordCount, duration.minimumAcceptableWordCount, duration.maximumAcceptableWordCount], [705, 635, 775]);
const currentAuthority = {
  projectId: createdProject.id,
  expectedUpdatedAt: createdProject.updated_at,
  topic: freshInput.inputPrompt,
  language: "en",
  durationSec: 300,
  strategyFingerprint: "strategy-current",
  selectedDirectionId: "recommended",
  selectedHook: "hook-current",
};
assert.equal(assessCreatorScriptGenerationAuthority({
  submitted: currentAuthority,
  persisted: { ...currentAuthority, updatedAt: currentAuthority.expectedUpdatedAt },
}).current, true);

let exaCalls = 0;
let openAiCalls = 0;
const buildAfterPersistence = async () => {
  await persistCreatorStrategyAuthority({
    persist: async () => { throw new Error("Project could not be created"); },
    advanceAuthority: () => true,
    isActive: () => true,
  });
  exaCalls += 1;
  openAiCalls += 1;
};
await assert.rejects(buildAfterPersistence(), /could not be created/);
assert.equal(exaCalls, 0);
assert.equal(openAiCalls, 0);

const repository = await readFile(new URL("../lib/persistence/projects/supabaseProjectRepository.ts", import.meta.url), "utf8");
assert.match(repository, /let payload = creatorProjectInsertPayload\(input\)/);
assert.match(repository, /payload = creatorProjectUpdatePayload\(input\)/);

const createPage = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(createPage, /projectState: currentProjectId && creatorPersistenceCurrentRef\.current \? "saved" : "draft"/);
assert.match(createPage, /creatorPersistenceCurrentRef\.current = false;\s+const sourceScenes = lifecycleOverrides\.sourceScenes/);
assert.match(createPage, /await queuedSave;\s+if \(saveAttempt === projectSaveAttemptRef\.current && binding\.generation === projectGenerationRef\.current\) \{\s+creatorPersistenceCurrentRef\.current = true;/);
assert.match(createPage, /catch \(saveError\) \{\s+if \(saveAttempt === projectSaveAttemptRef\.current\) creatorPersistenceCurrentRef\.current = false;/);

console.log("CREATORLAB_NEW_PROJECT_PERSISTENCE=PASS");
