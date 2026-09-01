import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const polish = fs.readFileSync(new URL("../app/creatorlab-ux-i-d.css", import.meta.url), "utf8");
const sceneNavigator = fs.readFileSync(
  new URL("../components/create/CreatorSceneProductionStatus.tsx", import.meta.url),
  "utf8",
);
const critical = fs.readFileSync(new URL("./stage-0-8a-critical-regression.mjs", import.meta.url), "utf8");

assert.match(
  layout,
  /import "\.\/creatorlab-ux-i-b\.css";\s*import "\.\/creatorlab-ux-i-c\.css";\s*import "\.\/creatorlab-ux-i-d\.css";/,
);
assert.match(polish, /\.creatorlab-premium-surface/);
assert.doesNotMatch(polish, /:root|--cl-[\w-]+\s*:/, "I-D reuses the canonical I-B tokens");
assert.doesNotMatch(polish, /#[0-9a-f]{3,8}/i, "I-D introduces no decorative palette");
assert.doesNotMatch(polish, /gradient|glassmorphism/i);
assert.doesNotMatch(polish, /(?:OpenAI|Exa|Pexels|Runway|Azure)/i, "provider names remain backstage");
assert.doesNotMatch(polish, /storyverse/i, "I-D remains scoped to CreatorLab");

// The navigator still renders every scene and keeps active navigation distinct from batch selection.
assert.match(sceneNavigator, /scenes\.map\(\(scene\) =>/);
assert.match(sceneNavigator, /data-focused=\{focused \? "true" : "false"\}/);
assert.match(sceneNavigator, /selectedSceneIds\.has\(scene\.id\)/);
assert.match(sceneNavigator, /onFocusScene\(scene\.id\)/);
for (const status of ["Ready", "Needs action", "Generating", "Review"]) {
  assert.match(sceneNavigator, new RegExp(status));
}
assert.match(polish, /data-focused="true"[\s\S]*?var\(--cl-primary\)/);
assert.match(polish, /creatorlab-p2c-scene-operation-select[\s\S]*?opacity/);

// Batch and scene-local controls remain separate and fully available.
for (const contract of [
  /data-creator-selected-scenes-toolbar="true"/,
  /Generate Visuals/,
  /Generate Voice/,
  /Clear selection/,
  /data-scene-primary-action=/,
  /runCreatorRecommendedVisualGeneration/,
]) assert.match(page, contract);
assert.match(polish, /creatorlab-p2c-batch-toolbar-sticky/);
assert.match(polish, /creatorlab-p2c-batch-action\.is-secondary/);

// Script, Visual and Voice retain their existing functional contracts.
for (const contract of [
  /data-production-step="script"/,
  /data-production-step="visual"/,
  /data-production-step="audio"/,
  /Edit script/,
  /Auto-fit with AI/,
  /Split scene/,
  /sceneScriptFitFeedback/,
  /Opening alternatives/,
]) assert.match(page, contract);
assert.match(polish, /scene-production-navigator/);
assert.match(polish, /\[id\$="-audio-panel"\]/);

// Visual source methods and acquisition surfaces remain exactly available.
const sceneSourceSelector = page.slice(
  page.indexOf('data-creator-visual-source-selector="true"'),
  page.indexOf('data-creator-visual-source-selector="true"') + 5200,
);
for (const method of ["recommended", "stock", "ai_image", "ai_video", "upload"]) {
  assert.match(sceneSourceSelector, new RegExp(`\\["${method}"`));
}
for (const label of ["Velto Recommended", "Stock", "AI Image", "AI Video", "Upload"]) {
  assert.match(sceneSourceSelector, new RegExp(label));
}
assert.match(sceneSourceSelector, /<CreatorStockPicker/);
assert.match(sceneSourceSelector, /<CreatorUploadPicker/);
assert.match(
  polish,
  /data-creator-visual-source-selector="true"[\s\S]*?button\[aria-pressed="true"\][\s\S]*?var\(--cl-primary\)[\s\S]*?var\(--cl-surface\)[\s\S]*?var\(--cl-accent-border\)/,
);

// Production Intelligence stays accessible through its quiet recommendation and explanation surfaces.
for (const contract of [/Velto recommends/, /Why this/, /Production brief/, /scene\.cameraDirection/, /scene\.emotion/, /scene\.motionHint/]) {
  assert.match(page, contract);
}
assert.match(polish, /\[role="tabpanel"\] aside/);

// Project status and final output remain visible without taking over the editor.
assert.match(page, /creatorlab-p2c-production-status/);
assert.match(page, /data-creator-final-video-lifecycle=/);
assert.match(polish, /data-creator-final-video-lifecycle[\s\S]*?var\(--cl-surface-muted\)/);

// Carry-forward: customization remains the same disclosure, but no Optional status badge is rendered.
const customizeStart = page.indexOf('id="creatorlab-production-customize"');
const customizeSummaryEnd = page.indexOf("</summary>", customizeStart);
const customizeSummary = page.slice(customizeStart, customizeSummaryEnd);
assert.ok(customizeStart > -1 && customizeSummaryEnd > customizeStart);
assert.match(customizeSummary, /Customize production/);
assert.doesNotMatch(customizeSummary, /creatorlab-setup-customize-status|customizeStatus|Optional/);
assert.match(page.slice(customizeSummaryEnd, customizeSummaryEnd + 1200), /creatorlab-setup-customize-body/);
assert.match(
  page,
  /\[creatorProductionCustomizeOpen, setCreatorProductionCustomizeOpen\][\s\S]*?useState\(true\)/,
  "Customize Production is expanded on the initial presentation",
);
assert.match(customizeSummary, /open=\{creatorProductionCustomizeOpen\}/);
assert.match(
  customizeSummary,
  /onToggle=\{\(event\) =>[\s\S]*?setCreatorProductionCustomizeOpen\(event\.currentTarget\.open\)/,
  "users can collapse the native disclosure without it being forced open again",
);
assert.doesNotMatch(
  customizeSummary,
  /fetch\(|\/api\/|generate|research|saveCreator|setCreatorProductionPackage/i,
  "initial disclosure expansion causes no production, provider, research, generation or save action",
);
assert.match(page, /creatorlab-setup-recommendation/);
assert.match(page, /Recommended setup/);
assert.ok(
  page.indexOf("creatorlab-setup-recommendation") < customizeStart,
  "Recommended Setup remains the first and dominant Production Setup surface",
);

assert.match(polish, /@media \(max-width: 1180px\)/);
assert.match(polish, /@media \(max-width: 1023px\)/);
assert.match(polish, /@media \(max-width: 720px\)/);
assert.doesNotMatch(polish, /fetch\(|\/api\/|credits?|economics|localStorage|supabase/i);
assert.match(critical, /scripts\/stage-0-10i-d-create-review-visual-test\.mjs/);

console.log("STAGE_0_10I_D_CREATE_REVIEW_VISUAL=PASS");
