import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");

const persistProject = page.slice(
  page.indexOf("const persistProject = async"),
  page.indexOf("const saveProject = async"),
);
const productionHandler = page.slice(
  page.indexOf("const handleCreatorProductionPackage = async"),
  page.indexOf("const handleOptimizeScenes = async"),
);
const autosaveEffect = page.slice(
  page.indexOf("if (skipAutosaveRef.current)"),
  page.indexOf("useEffect(() => {\n    return () =>", page.indexOf("if (skipAutosaveRef.current)")),
);
const navigation = page.slice(
  page.indexOf("const creatorCanOpenWorkspaceStep"),
  page.indexOf("const creatorWorkflowSteps"),
);
const hydration = page.slice(
  page.indexOf("const loadedMentorResult = project.creator_mentor_result"),
  page.indexOf("const savedVisualContinuity", page.indexOf("const loadedMentorResult")),
);

assert.match(persistProject, /creatorMentorResult:\s*persistedMentorResult/);
assert.match(persistProject, /projectId:\s*currentProjectId \|\| undefined/);
assert.match(persistProject, /strategySelection:\s*\{\s*directionId: creatorSelectedStrategyDirectionId,\s*hook: creatorSelectedHookPattern/);

assert.match(productionHandler, /const persistedStrategyResult:[\s\S]*strategySelection:/);
assert.match(productionHandler, /setCreatorProductionPackage\(nextPackage\);\s*setCreatorMentorResult\(persistedStrategyResult\);/);
assert.doesNotMatch(productionHandler, /setCreatorMentorResult\(null\)/);

assert.match(autosaveEffect, /isCreatorLabFlow[\s\S]*!creatorMentorResult/);
assert.match(autosaveEffect, /await persistProject\(false\)/);
assert.match(autosaveEffect, /}, 2000\)/);

assert.match(hydration, /setCreatorMentorResult\(loadedMentorResult \|\| null\)/);
assert.match(hydration, /loadedMentorResult\?\.strategySelection\?\.directionId/);
assert.match(hydration, /loadedMentorResult\?\.strategySelection\?\.hook/);
assert.match(hydration, /loadedMentorResult\?\.marketEvidence\?\.videos/);
assert.match(hydration, /loadedMentorResult\?\.marketEvidence\?\.patternSummary/);

assert.match(navigation, /setCreatorSelectedWorkspaceStep\(step\)/);
assert.doesNotMatch(navigation, /fetch\(|setCreatorMentorResult|setCreatorProductionPackage|setScenes/);

const strategy = {
  recommendedIdea: { title: "Canonical direction", reason: "Grounded reason" },
  audienceInsight: ["Audience signal"],
  hookPatterns: ["Opening hook"],
  videoIdeas: [],
  productionPlan: ["Production scope"],
  strategySelection: { directionId: "alternative-1", hook: "Opening hook" },
  marketEvidence: { videos: [{ id: "market-1" }], patternSummary: { opportunityScore: 82 } },
};
const project = { id: "project-1", creator_mentor_result: structuredClone(strategy) };
const restored = structuredClone(project.creator_mentor_result);
assert.deepEqual(restored, strategy);
assert.equal(restored.strategySelection.directionId, "alternative-1");
assert.equal(restored.strategySelection.hook, "Opening hook");
assert.equal(restored.marketEvidence.videos.length, 1);

console.log("Stage 0.10H Strategy backward-navigation persistence test passed.");
