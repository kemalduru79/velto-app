import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const importFunctions = async (source, exports) => {
  const executable = ts.transpileModule(
    `${source}\nexport { ${exports.join(", ")} };`,
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`);
};

const directorSource = read("lib/creator/services/creatorDirector.server.ts");
const directorHelpers = directorSource
  .slice(directorSource.indexOf("const MAX_MESSAGE_LENGTH"), directorSource.indexOf("const DIRECTOR_RESPONSE_SCHEMA"))
  .replace("export function sanitizeGeneratedActions", "function sanitizeGeneratedActions");
const { sanitizeGeneratedActions } = await importFunctions(
  directorHelpers,
  ["sanitizeGeneratedActions"],
);

const refineSource = read("lib/creator/services/creatorRefineScenes.server.ts");
const refineHelpers = refineSource
  .slice(refineSource.indexOf("type CreatorProductionScene"), refineSource.indexOf("function extractJsonObject"))
  .replace("export function getSceneWordBudget", "function getSceneWordBudget")
  .replace("export function normalizeRefinedScenes", "function normalizeRefinedScenes");
const { normalizeRefinedScenes } = await importFunctions(
  refineHelpers,
  ["normalizeRefinedScenes"],
);

for (const [route, service] of [
  ["app/api/creator-production/route.ts", "handleCreatorProductionRequest"],
  ["app/api/creator-director/route.ts", "handleCreatorDirectorRequest"],
  ["app/api/creator-refine-scenes/route.ts", "handleCreatorRefineScenesRequest"],
]) {
  const source = read(route);
  assert.ok(source.split("\n").length <= 10, `${route} must remain a thin controller`);
  assert.match(source, new RegExp(service));
}

const directorContext = {
  activeStage: 3,
  project: { qualityLevel: "pro" },
  production: {
    selectedSceneIds: [1],
    scenes: [
      { id: 1, renderMode: "video", imageReady: true },
      { id: 2, renderMode: "image", imageReady: false },
    ],
  },
  workflow: { visibleCurrentStep: 4, visibleAvailableSteps: [3, 4, 5] },
};
const actions = sanitizeGeneratedActions([
  {
    type: "generate_selected_videos",
    title: "Generate",
    description: "Generate selected video",
    payload: { sceneIds: [1, 2, 999] },
  },
  {
    type: "set_scene_output",
    title: "Set output",
    description: "Set output",
    payload: { sceneIds: [1, 999], renderMode: "video" },
  },
  {
    type: "export_creator_package",
    title: "Export",
    description: "Export",
    payload: {},
  },
], directorContext, "project");
assert.equal(actions.length, 1, "invalid paid action and out-of-stage export stay filtered");
assert.equal(actions[0].type, "set_scene_output");
assert.deepEqual(actions[0].payload.sceneIds, [1]);

const fallbackScenes = [
  { id: 1, narration: "First fallback", dialogue: "" },
  { id: 2, narration: "Second fallback", dialogue: "" },
];
const budget = {
  targetSceneDuration: 8,
  maxTotalWordsPerScene: 18,
  maxNarrationWords: 14,
  maxDialogueWords: 8,
};
const longSpeech = Array.from({ length: 100 }, (_, index) => `word${index}`).join(" ");
const refined = normalizeRefinedScenes(
  fallbackScenes.map((scene) => ({
    ...scene,
    narration: `[excited] ${longSpeech}`,
    dialogue: `(SFX) ${longSpeech}`,
  })),
  fallbackScenes,
  budget,
  "en",
);
assert.equal(refined.length, fallbackScenes.length);
assert.ok(refined.every((scene) => scene.speechWordCount <= budget.maxTotalWordsPerScene));
assert.ok(refined.every((scene) => !/excited|SFX/i.test(`${scene.narration} ${scene.dialogue}`)));
assert.equal(
  normalizeRefinedScenes([fallbackScenes[0]], fallbackScenes, budget, "en").length,
  1,
  "a model scene-count mismatch remains visible for the request service to reject",
);

const productionService = read("lib/creator/services/creatorProduction.server.ts");
assert.match(productionService, /Create exactly \$\{sceneCount\} scenes/);
assert.match(productionService, /success: true,[\s\S]*productionPackage/);
assert.match(productionService, /responses\.create\(/);
assert.equal((productionService.match(/responses\.create\(/g) || []).length, 1);

const workerEntrypoint = read("scripts/scale-worker.mjs");
assert.match(workerEntrypoint, /runWorker/);
assert.doesNotMatch(workerEntrypoint, /velto_job_claim|velto_credit_settle|fetch\(/);

console.log("Stage 0.8C Slice A modularization regression passed.");
