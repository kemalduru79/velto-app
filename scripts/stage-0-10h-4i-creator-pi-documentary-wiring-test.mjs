import assert from "node:assert/strict";
import fs from "node:fs";

const createPage = fs.readFileSync("app/create/page.tsx", "utf8");

const scriptPlanAdapter = createPage.match(
  /const applyCreatorProfessionalScriptPlan = async \([\s\S]*?\n  \};/,
)?.[0];
assert.ok(scriptPlanAdapter, "CreatorLab script-plan adapter must remain present");
assert.match(
  scriptPlanAdapter,
  /productionIntelligenceContexts[\s\S]*?runCreatorEditorialScriptPipeline\(\{/,
);
assert.match(
  scriptPlanAdapter,
  /creatorProductionIntelligenceContextsRef\.current\s*=\s*productionIntelligenceContexts/,
);
assert.doesNotMatch(scriptPlanAdapter, /fetch\(["']\/api\/creator-script-plan/);

const batchRender = createPage.match(
  /const startBatchRender = async \(\) => \{[\s\S]*?\n  \};/,
)?.[0];
assert.ok(batchRender, "Existing batch-production entry point must remain present");
assert.match(batchRender, /if \(isCreatorLabFlow\) \{/);
assert.match(
  batchRender,
  /creatorProductionIntelligenceContextsRef\.current\.map\(\(context\) => \[[\s\S]*?String\(context\.sceneId\)/,
);
assert.match(
  batchRender,
  /productionIntelligenceContextBySceneId\.get\(String\(scene\.id\)\)/,
);
assert.match(
  batchRender,
  /if \(!context\) return scene;/,
  "Scenes without grounded context must retain legacy PI behavior",
);
assert.match(
  batchRender,
  /documentarySourceContext:\s*context\.documentarySourceContext/,
);
assert.match(
  batchRender,
  /evidenceVisualContext:\s*context\.evidenceVisualContext/,
);
assert.match(batchRender, /fetch\("\/api\/creator-production-intelligence"/);
assert.match(batchRender, /scenes:\s*productionIntelligenceScenes/);
assert.doesNotMatch(
  batchRender,
  /sourceAssessments|sourceUrl|claimId|evidenceId|excerpt|providerMetadata|providerName|editorialGraph/,
  "Only sanitized scene-level contexts may enter the PI request",
);

assert.doesNotMatch(
  createPage,
  />\s*(?:Documentary source|Evidence visual|Source evidence|Provider)\s*</i,
  "Documentary, evidence, and provider internals must not be rendered",
);
assert.equal(
  (createPage.match(/applyCreatorProfessionalScriptPlan\(\{/g) || []).length,
  2,
  "Both existing normal CreatorLab grounded entry points must use the adapter",
);
assert.match(
  createPage,
  /const handleGenerateFullYoutubePackage[\s\S]*?if \(!isCreatorLabFlow\) \{\s*return;\s*\}/,
  "Storyverse must remain outside the CreatorLab grounded production path",
);
assert.equal(
  (createPage.match(/fetch\(["']\/api\/creator-script-plan/g) || []).length,
  0,
  "No direct ungrounded Script Planner fallback may appear in the page",
);

console.log("Stage 0.10H-4I CreatorLab PI documentary wiring test passed.");
