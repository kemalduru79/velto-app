import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCreatorScript,
  getCreatorScriptDocumentText,
  regenerateCreatorScriptSection,
} from "../lib/creator/creatorScript.ts";
import {
  applyCreatorScriptMutationCommand,
  parseCreatorScriptMutationCommand,
  resolveCreatorScriptMutationAuthority,
} from "../lib/creator/creatorScriptMutationAuthority.ts";

const timestamp = "2026-09-28T10:00:00.000Z";
const script = createCreatorScript({
  title: "Authority fixture",
  revision: 2,
  targetDurationSec: 30,
  strategyFingerprint: "strategy-a",
  generatedAt: timestamp,
  updatedAt: timestamp,
  grounding: {
    context: {
      version: "0.10H-2H",
      sourceVersion: "0.10H-2E",
      editorialConstitution: "Preserve grounded authority.",
      claims: [], evidence: [], sources: [],
      readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [] },
    },
  },
  sections: [
    { id: "opening", kind: "opening", heading: "Opening", text: "Canonical opening text remains stable for this authority test.", claimIds: [], evidenceReviewRequired: false },
    { id: "body", kind: "body", heading: "Body", text: "Canonical body text remains stable for this authority test.", claimIds: [], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", heading: "Conclusion", text: "Canonical conclusion text remains stable for this authority test.", claimIds: [], evidenceReviewRequired: false },
  ],
});

const document = getCreatorScriptDocumentText(script);
const persistedAuthorityFixture = {
  script,
  scenes: Array.from({ length: 31 }, (_, index) => ({ creatorSceneId: `scene-${index + 1}` })),
  refinedScenes: [{ creatorSceneId: "refined-scene" }],
  finalVideoUrl: "https://example.test/final.mp4",
  mediaReferenceCount: 31,
};
const authorityBeforeRejectedSave = structuredClone(persistedAuthorityFixture);
let mediaReferenceReplacementCalls = 0;
assert.throws(() => resolveCreatorScriptMutationAuthority({
  persistedScript: script,
  candidateScript: { ...script, title: "Stale client title" },
  commandValue: undefined,
}), /CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED/);
assert.deepEqual(persistedAuthorityFixture, authorityBeforeRejectedSave);
assert.equal(persistedAuthorityFixture.scenes.length, 31);
assert.equal(mediaReferenceReplacementCalls, 0);
assert.throws(() => resolveCreatorScriptMutationAuthority({
  persistedScript: null,
  candidateScript: script,
  commandValue: undefined,
}), /CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED/);
assert.equal(resolveCreatorScriptMutationAuthority({
  persistedScript: script,
  candidateScript: script,
  commandValue: undefined,
}), script);
const firstGenerated = resolveCreatorScriptMutationAuthority({
  persistedScript: null,
  candidateScript: script,
  commandValue: { type: "generated_script_replacement", expectedRevision: null, script },
  updatedAt: "2026-09-28T10:01:00.000Z",
});
assert.equal(firstGenerated.revision, 1);
const rebuilt = resolveCreatorScriptMutationAuthority({
  persistedScript: script,
  candidateScript: script,
  commandValue: { type: "generated_script_replacement", expectedRevision: 2, script },
  updatedAt: "2026-09-28T10:02:00.000Z",
});
assert.equal(rebuilt.revision, 3);
assert.equal(rebuilt.updatedAt, "2026-09-28T10:02:00.000Z");
const manual = applyCreatorScriptMutationCommand({
  persistedScript: script,
  command: parseCreatorScriptMutationCommand({
    type: "manual_document_edit",
    expectedRevision: 2,
    documentText: document.replace("Canonical body", "Creator-edited body"),
  }),
  updatedAt: "2026-09-28T10:05:00.000Z",
});
assert.equal(manual.revision, 3);
assert.match(manual.sections[1].text, /Creator-edited/);
assert.equal(manual.sections[0].text, script.sections[0].text);
assert.equal(manual.approval, null);
mediaReferenceReplacementCalls += 1;
assert.equal(mediaReferenceReplacementCalls, 1);

assert.throws(() => applyCreatorScriptMutationCommand({
  persistedScript: script,
  command: parseCreatorScriptMutationCommand({
    type: "manual_document_edit",
    expectedRevision: 1,
    documentText: document.replace("Canonical body", "Stale body"),
  }),
}), /CREATOR_SCRIPT_MUTATION_STALE/);

const regenerated = regenerateCreatorScriptSection(script, "body", {
  ...script.sections[1],
  text: "Regenerated body text remains grounded and section-local.",
});
const serverDerivedRegeneration = applyCreatorScriptMutationCommand({
  persistedScript: script,
  command: parseCreatorScriptMutationCommand({
    type: "section_regeneration",
    expectedRevision: 2,
    targetSectionId: "body",
    script: regenerated,
  }),
  updatedAt: "2026-09-28T10:06:00.000Z",
});
assert.equal(serverDerivedRegeneration.revision, 3);
assert.equal(serverDerivedRegeneration.updatedAt, "2026-09-28T10:06:00.000Z");
assert.notEqual(serverDerivedRegeneration.updatedAt, regenerated.updatedAt);
assert.equal(serverDerivedRegeneration.sections[1].text, regenerated.sections[1].text);
assert.equal(serverDerivedRegeneration.sections[0].text, script.sections[0].text);

assert.throws(() => parseCreatorScriptMutationCommand({ type: "reset_scenes", expectedRevision: 2 }), /CREATOR_SCRIPT_MUTATION_INVALID/);

const route = await readFile(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const review = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const regenerationHandler = page.slice(
  page.indexOf("const handleRegenerateCreatorScriptSection"),
  page.indexOf("const handleReviewCreatorScriptSources"),
);

const authorityRejection = route.indexOf("CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED");
const repositorySave = route.indexOf("projectRepository.saveForOwner");
const referenceReplacement = route.indexOf("replaceProjectReferences");
assert.ok(authorityRejection > 0 && authorityRejection < repositorySave && repositorySave < referenceReplacement);
assert.match(route, /resolveCreatorScriptMutationAuthority/);
assert.match(route, /expectedUpdatedAt/);
assert.match(route, /if \(textChanged\) \{[\s\S]*invalidateCreatorSceneAuthorityForScriptChange/);
assert.match(page, /type: "manual_document_edit"[\s\S]*expectedRevision: sourceScript\.revision[\s\S]*documentText: text/);
assert.match(page, /type: "section_regeneration"[\s\S]*expectedRevision: sourceRevision[\s\S]*targetSectionId: sectionId/);
const regenerationPersist = regenerationHandler.indexOf("const saved = await persistProject");
const installSavedRef = regenerationHandler.indexOf("creatorScriptRef.current = savedScript");
const installSavedState = regenerationHandler.indexOf("setCreatorScript(savedScript)");
const clearScenes = regenerationHandler.indexOf("setScenes([])");
const clearRefinedScenes = regenerationHandler.indexOf("setRefinedCreatorScenes([])");
const invalidateFinal = regenerationHandler.indexOf("invalidateFinalVideoForProductionChange()");
assert.ok(regenerationPersist > 0);
assert.ok(installSavedRef > regenerationPersist && installSavedState > regenerationPersist);
assert.ok(clearScenes > installSavedState && clearRefinedScenes > installSavedState && invalidateFinal > installSavedState);
assert.doesNotMatch(regenerationHandler.slice(0, regenerationPersist), /creatorScriptRef\.current = nextScript|setCreatorScript\(nextScript\)|setScenes\(\[\]\)|setRefinedCreatorScenes\(\[\]\)|invalidateFinalVideoForProductionChange\(\)/);
assert.match(regenerationHandler, /if \(!operationIsActive\(\) \|\| !sourceRevisionIsActive\(\)\) return;[\s\S]*const saved = await persistProject[\s\S]*if \(!operationIsActive\(\) \|\| !sourceRevisionIsActive\(\)\) return;/);
assert.match(regenerationHandler, /const savedScript = savedState\.strategy\.script[\s\S]*creatorScriptRef\.current = savedScript[\s\S]*setCreatorScript\(savedScript\)/);
assert.match(page, /type: "generated_script_replacement"/);
assert.match(page, /key=\{`\$\{currentProjectId \|\| "unsaved"\}:\$\{creatorScript\.revision\}`\}/);
assert.match(page, /useState<CreatorSceneHydrationAuthority>\("unknown"\)/);
assert.match(page, /useRef<CreatorSceneHydrationAuthority>\("unknown"\)/);
assert.doesNotMatch(review, /useEffect\([\s\S]{0,300}setDraft\(canonicalDocument\)/);

console.log("STAGE_0_18A6F1_SCRIPT_MUTATION_AUTHORITY=PASS");
