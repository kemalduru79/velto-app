import fs from "node:fs";
import assert from "node:assert/strict";
import { resolveCreatorMediaOutputState } from "../lib/creator/mediaOutputState.mjs";

const failures = [];

const recommendedVideo = resolveCreatorMediaOutputState({
  recommendedOutput: "video",
});
assert.deepEqual(recommendedVideo, {
  recommendedOutput: "video",
  effectiveOutput: "video",
  explicitOutput: null,
  isUserOverride: false,
});

const recommendedImage = resolveCreatorMediaOutputState({
  recommendedOutput: "image",
});
assert.equal(recommendedImage.effectiveOutput, "image");
assert.equal(recommendedImage.isUserOverride, false);

const imageOverride = resolveCreatorMediaOutputState({
  recommendedOutput: "video",
  explicitOutput: "image",
});
assert.equal(imageOverride.effectiveOutput, "image");
assert.equal(imageOverride.isUserOverride, true);

const videoOverride = resolveCreatorMediaOutputState({
  recommendedOutput: "image",
  explicitOutput: "video",
});
assert.equal(videoOverride.effectiveOutput, "video");
assert.equal(videoOverride.isUserOverride, true);

const returnedToRecommendation = resolveCreatorMediaOutputState({
  recommendedOutput: "video",
  explicitOutput: null,
});
assert.equal(returnedToRecommendation.effectiveOutput, "video");
assert.equal(returnedToRecommendation.isUserOverride, false);

const read = (file) => {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
};

const requireNeedles = (file, needles) => {
  const content = read(file);
  for (const needle of needles) {
    if (!content.includes(needle)) failures.push(`${file}: missing ${needle}`);
  }
  return content;
};

requireNeedles("components/create/CreatorProductionSubnav.tsx", [
  'export type CreatorProductionSubstep = "setup" | "create_review"',
  "onClick={() => onChange(item.value)}",
  'aria-current={active ? "step" : undefined}',
  'data-state={state}',
]);

requireNeedles("components/create/CreatorProductionSetupSummary.tsx", [
  "CreatorProductionSetupSummary",
  'onClick={onEdit}',
  '"Production Plan"',
  "sceneCount",
  'language === "en" ? "View plan" : "Planı görüntüle"',
]);

requireNeedles("components/create/CreatorEditor.tsx", [
  "CreatorEditorTimeline",
  'data-creator-editor="foundation"',
  "creatorlab-p2c-editor-surface",
  '"Edit & Assemble"',
  "focus({ preventScroll: true })",
  "onSaveText({ text: textDraft, narration: narrationDraft, dialogue: dialogueDraft })",
  "onUpdateTrim",
  "onRefreshVideo(selectedScene.creatorSceneId!)",
  "onRestoreMedia(selectedScene.creatorSceneId!, asset.id)",
  'data-creator-continuity-warning={continuityWarning.severity}',
  'hidden data-selected-media-fingerprint="true"',
  "onMoveScene(\"earlier\")",
  "onMoveScene(\"later\")",
  "onDuplicateScene",
  "onDeleteScene",
  "onAddScene",
  "onClick={onUndo}",
]);

const editor = read("components/create/CreatorEditor.tsx");
if (editor.includes("media:{selectedMediaFingerprint}")) {
  failures.push("CreatorEditor: media fingerprint remains visibly rendered");
}

requireNeedles("components/create/CreatorEditorTimeline.tsx", [
  "CreatorEditorTimeline",
  "onSelectScene(scene.creatorSceneId!)",
  'aria-current={selected ? "true" : undefined}',
  "selectedItem.scrollIntoView",
  'window.matchMedia("(prefers-reduced-motion: reduce)")',
  "scene.timing?.targetSceneDuration",
  "creatorlab-p2c-editor-timeline-thumbnail",
]);

const sceneProductionStatus = requireNeedles("components/create/CreatorSceneProductionStatus.tsx", [
  '"ready"',
  '"needs_action"',
  '"generating"',
  '"review"',
  "deriveCreatorSceneTriageStatus",
  "data-scene-production-overview",
  "aria-current={focused ? \"true\" : undefined}",
  "contextualAction?: ReactNode",
  "creatorlab-p2c-scene-operations-action",
  "creatorlab-p2c-scene-navigator-label",
  "selectedSceneIds.has(scene.id)",
  "onToggleSceneSelection(scene.id)",
  "scene.durationSec.toFixed(0)",
  "scene.outputType",
  'language === "en" ? "Scene Production" : "Sahne Üretimi"',
]);

const page = requireNeedles("app/create/page.tsx", [
  "<CreatorProductionSetupSummary",
  "<CreatorEditor",
  "<CreatorCostGuard",
  'creatorProductionSubstep === "setup"',
  'creatorProductionSubstep === "create_review"',
  "selectCreatorProductionSubstep",
  "onClick={buildStory}",
  "onClick={continueCreatorProduction}",
  "handleExportMovie",
  "handleGenerateVideo",
  "redrawSceneImage",
  "prepareSelectedSceneAudio",
  "prepareSelectedSceneAudio([scene.id])",
  "creatorFocusedSceneId",
  "setCreatorFocusedSceneId",
  "creatorSceneProductionSummaries",
  "deriveCreatorSceneTriageStatus",
  'data-focused-scene="true"',
  "<CreatorSceneProductionStatus",
  "selectedSceneIds={creatorSelectedSceneIdSet}",
  "onToggleSceneSelection={toggleCreatorSceneSelection}",
  'className="creatorlab-production-storyboard creatorlab-p2c-production-workspace"',
  'className="creatorlab-p2c-active-scene space-y-3"',
  "scenes.filter((scene) => scene.id === creatorFocusedSceneId)",
  "creatorEditorWasOpenRef",
  "setSelectedCreatorEditorSceneId(focusedScene.creatorSceneId)",
  'className="scene-production-navigator sticky top-4 z-20 mb-5"',
  'className="scene-production-navigator__tabs"',
  'data-production-step="script"',
  'data-production-step="visual"',
  'data-production-step="audio"',
  "sceneProductionReadyCount}/3",
  'className="creatorlab-workspace-topbar"',
  'className="creatorlab-readiness-block"',
  "<ProductTopNavigation",
  "<UserAccountMenu",
  'data-batch-selection-state={creatorSelectedSceneIds.length > 0 ? "selected" : "empty"}',
  'activeSceneInspectorTab === "script" && index === 0',
  '"Select scenes for batch actions"',
  'setCreatorScenesRenderMode(creatorSelectedSceneIds, "image")',
  'setCreatorScenesRenderMode(creatorSelectedSceneIds, "video")',
  "generateSelectedSceneVisuals()",
  "prepareSelectedSceneAudio()",
  'title: "Brief"',
  '"Production Setup"',
  '"Create & Review"',
  '"Publish"',
  "creatorVisibleWorkflowStep",
  "creatorCanOpenVisibleWorkflowStep",
  "navigateCreatorVisibleWorkflowStep",
  'selectCreatorProductionSubstep(step === 3 ? "setup" : "create_review")',
  'navigateCreatorWorkspaceStep(step === 5 ? 4 : step)',
  '"Step 5 · Publish"',
  "setSaveMessage(ui.autoSaved)",
  'data-autosave-status={isCreatorLabFlow && saveMessage === ui.autoSaved ? "saved" : undefined}',
  'data-creator-editor-entry="true"',
  "onClick={() => setCreatorEditorOpen(true)}",
  '"Open Editor"',
  "contextualAction={!creatorEditorOpen",
  'uiLanguage === "en" ? "Output" : "Çıktı"',
  'uiLanguage === "en" ? "Velto recommended" : "Velto önerisi"',
  'uiLanguage === "en" ? "Your choice" : "Senin seçimin"',
  'uiLanguage === "en" ? "Velto recommends" : "Velto öneriyor"',
  'uiLanguage === "en" ? "Change output" : "Çıktıyı değiştir"',
  'uiLanguage === "en" ? "Use recommendation" : "Öneriyi kullan"',
  "honorExplicitOverrides: false",
  "returnCreatorSceneToRecommendedOutput(scene.id)",
  "renderMode: undefined",
  'uiLanguage === "en" ? "Production brief" : "Üretim özeti"',
  'uiLanguage === "en" ? "Continuity" : "Devamlılık"',
  'uiLanguage === "en" ? "Review in editor" : "Editörde kontrol et"',
  'uiLanguage === "en" ? "Regenerate image" : "Görseli yeniden üret"',
  'uiLanguage === "en" ? "Regenerate video" : "Videoyu yeniden üret"',
  'uiLanguage === "en" ? "Used in scene" : "Sahnede kullanılıyor"',
  "!isCurrentAsset && (",
  '<CreatorVisualAssetCleanupAction',
]);

if (page.includes("<CreatorProductionSubnav")) {
  failures.push("UX-P2C: nested Production Setup/Create & Review navigation is still rendered");
}

if (page.includes('uiLanguage === "en" ? "Mini timeline"')) {
  failures.push("UX-P2C: duplicate mini timeline navigation remains rendered");
}

if (page.includes('"Generate visuals and voice"')) {
  failures.push("UX-P2C: old four-step Production rail copy remains visible");
}

if (page.includes('"Scene workspace"') || sceneProductionStatus.includes('"Operational overview"')) {
  failures.push("UX-P2C: redundant scene hierarchy copy remains visible");
}

if (page.includes("Selected → Image") || page.includes("Selected → Video")) {
  failures.push("UX-P2C: stale selected-to-output batch copy remains visible");
}

if (page.includes("Choose explicitly. Velto Studio will not decide") || page.includes("Use Image") || page.includes("Use Video")) {
  failures.push("UX-P2C: mandatory manual output-choice language remains visible");
}

requireNeedles("app/layout.tsx", ['import "./creatorlab-ux-p2c.css";']);

const p2cCss = requireNeedles("app/creatorlab-ux-p2c.css", [
  ".creatorlab-uxp2a-shell .creatorlab-production-experience",
  ".creatorlab-p2c-production-header-meta",
  ".creatorlab-p2c-production-status",
  ".creatorlab-p2c-editor-surface",
  ".creatorlab-p2c-scene-operations",
  ".creatorlab-p2c-production-workspace",
  ".creatorlab-p2c-active-scene",
  ".creatorlab-p2c-scene-operation-select",
  ".creatorlab-p2c-focused-scene",
  ".creatorlab-p2c-scene-next-action",
  ".creatorlab-p2c-editor-layout",
  ".creatorlab-p2c-editor-preview-canvas",
  ".creatorlab-p2c-editor-inspector",
  ".creatorlab-p2c-editor-timeline-track",
  ".creatorlab-p2c-editor-disclosure",
  ".scene-production-navigator",
  ".creatorlab-p2c-batch-toolbar",
  ".creatorlab-product-navigation",
  "prefers-reduced-motion",
]);

requireNeedles("components/navigation/ProductTopNavigation.tsx", [
  "creatorlab-product-navigation",
  "<UserAccountMenu",
]);

requireNeedles("components/auth/UserAccountMenu.tsx", [
  "availableCredits",
  "reservedCredits",
  "credits:",
]);

const p2cPresentationCopy = [
  read("components/create/CreatorProductionSubnav.tsx"),
  read("components/create/CreatorProductionSetupSummary.tsx"),
  read("components/create/CreatorSceneProductionStatus.tsx"),
  editor,
  read("components/create/CreatorEditorTimeline.tsx"),
  p2cCss,
].join("\n");

if (/choose\s+(?:an?\s+)?provider|provider\s+(?:choice|selection)|openai|replicate|fal\.ai/i.test(p2cPresentationCopy)) {
  failures.push("UX-P2C: provider choice or provider branding surfaced in presentation copy");
}

if (page && !page.includes("requestCreatorCostGuardConfirmation")) {
  failures.push("CreatorCostGuard confirmation path is missing");
}

if (/storyverse/i.test(p2cCss)) {
  failures.push("UX-P2C: presentation stylesheet references the Storyverse path");
}

if (failures.length > 0) {
  console.error(`UX-P2C Production Workspace smoke test failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("UX-P2C Production Workspace smoke test passed.");
