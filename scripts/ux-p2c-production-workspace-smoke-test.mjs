import fs from "node:fs";

const failures = [];

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

requireNeedles("components/create/CreatorSceneProductionStatus.tsx", [
  '"ready"',
  '"needs_action"',
  '"generating"',
  '"review"',
  "deriveCreatorSceneTriageStatus",
  "data-scene-production-overview",
  "aria-current={focused ? \"true\" : undefined}",
]);

const page = requireNeedles("app/create/page.tsx", [
  "<CreatorProductionSubnav",
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
  "creatorEditorWasOpenRef",
  "setSelectedCreatorEditorSceneId(focusedScene.creatorSceneId)",
  'className="scene-production-navigator sticky top-4 z-20 mb-5"',
  'className="scene-production-navigator__tabs"',
  'data-production-step="script"',
  'data-production-step="visual"',
  'data-production-step="audio"',
  "sceneProductionReadyCount}/3",
]);

requireNeedles("app/layout.tsx", ['import "./creatorlab-ux-p2c.css";']);

const p2cCss = requireNeedles("app/creatorlab-ux-p2c.css", [
  ".creatorlab-uxp2a-shell .creatorlab-production-experience",
  ".creatorlab-p2c-production-header-meta",
  ".creatorlab-p2c-production-status",
  ".creatorlab-p2c-editor-surface",
  ".creatorlab-p2c-scene-operations",
  ".creatorlab-p2c-focused-scene",
  ".creatorlab-p2c-scene-next-action",
  ".creatorlab-p2c-editor-layout",
  ".creatorlab-p2c-editor-preview-canvas",
  ".creatorlab-p2c-editor-inspector",
  ".creatorlab-p2c-editor-timeline-track",
  ".creatorlab-p2c-editor-disclosure",
  ".scene-production-navigator",
  "prefers-reduced-motion",
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
