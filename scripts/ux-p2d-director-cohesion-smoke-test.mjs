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

const page = requireNeedles("app/create/page.tsx", [
  "Velto Copilot",
  ">VS</b>",
  "creatorlab-copilot-launcher",
  "creatorlab-copilot-floating-layer",
  'aria-modal="false"',
  "Creative Director",
  "Studio Help",
  "CREATOR_COPILOT_STORAGE_PREFIX",
  "window.localStorage.setItem",
  "message.followUps",
  'fetch("/api/creator-director"',
  "normalizeCreatorDirectorActions",
  "creatorDirectorPendingAction",
  "creatorDirectorActionConfirmed",
  "requiresExplicitConfirmation",
  "creatorVisibleWorkflowStep",
  "creatorVisibleWorkflowTitle",
  'creatorDirectorOpen ? "is-open" : ""',
  'creatorDirectorMessages.length === 0 ? "is-empty" : ""',
  "creatorDirectorComposerPlaceholder",
  '"Ask about your brief or what to improve next…"',
  '"Ask about the strategy or creative direction…"',
  '"Ask about your production setup…"',
  '"Ask about scenes, media or what needs attention…"',
  '"Ask about readiness, metadata or export…"',
  '"Changes require approval. Paid media and export require confirmation."',
  "visibleCurrentStep: creatorVisibleWorkflowStep",
  "visibleCurrentLabel: creatorVisibleWorkflowTitle",
  "visibleAvailableSteps: ([1, 2, 3, 4, 5] as const)",
  'title: uiLanguage === "en" ? "Production Setup"',
  'title: uiLanguage === "en" ? "Create & Review"',
  'title: uiLanguage === "en" ? "Publish"',
  'creatorVisibleWorkflowStep === 3',
  'creatorVisibleWorkflowStep === 4',
  'creatorVisibleWorkflowStep === 5',
  'selectCreatorProductionSubstep(step === 3 ? "setup" : "create_review")',
  "navigateCreatorVisibleWorkflowStep(targetStage)",
  "creatorProjectPerformanceReport?.performanceScore",
  "creatorProjectPerformanceReport?.findings?.warnings",
  "creatorProjectPerformanceReport?.nextActions",
  "creatorProjectLifecycle?.status",
  "creatorFinalVideoNeedsRebuild",
  "handleGenerateYoutubeThumbnail",
  "handleDownloadCreatorPackage",
]);

const route = requireNeedles("lib/creator/services/creatorDirector.server.ts", [
  "navigate_workspace_stage",
  "const PAID_ACTION_TYPES",
  "visibleCurrentStep",
  "visibleCurrentLabel",
  "visibleAvailableSteps",
  '3: "Production Setup"',
  '4: "Create & Review"',
  '5: "Publish"',
  "availableVisibleSteps.has(action.payload.workspaceStage)",
  "enum: [1, 2, 3, 4, 5]",
  "requiresExplicitConfirmation: isPaid || isRelease",
  "Reply in the language used in the CURRENT USER MESSAGE",
]);

if (/Publish & Export/.test(route)) {
  failures.push('Director route still exposes legacy "Publish & Export" navigation copy');
}

const panelStart = page.indexOf('id="creatorlab-director-dialog"');
const panelEnd = page.indexOf("{isCreatorLabFlow && (", panelStart + 1);
const panel = panelStart >= 0 && panelEnd > panelStart
  ? page.slice(panelStart, panelEnd)
  : "";

if (!panel) failures.push("Copilot panel could not be isolated");
if (/openai|replicate|fal\.ai|provider|model name|asset hash|routing/i.test(panel)) {
  failures.push("Copilot panel exposes provider, model, asset hash, or routing language");
}
if (/Workspace status and next action|Çalışma alanı durumu ve sonraki aksiyon/.test(panel)) {
  failures.push("Removed workspace-status dashboard was reintroduced in Copilot");
}

const paidStart = route.indexOf("const PAID_ACTION_TYPES");
const paidEnd = route.indexOf("]);", paidStart);
if (paidStart < 0 || paidEnd <= paidStart) {
  failures.push("Paid Director action set could not be isolated");
} else if (/navigate_workspace_stage/.test(route.slice(paidStart, paidEnd + 3))) {
  failures.push("Navigation was incorrectly classified as a paid action");
}

const p2dCss = requireNeedles("app/creatorlab-ux-p2d.css", [
  "UX-P2D-3 — Velto Copilot cohesion",
  ".creatorlab-copilot-launcher.is-publish-context",
  ".creatorlab-copilot-floating-layer.is-publish-context",
  ".creatorlab-director-mode-tabs",
  ".creatorlab-director-action-card",
  "UX-P2D-4 — Copilot final visual polish",
  ".creatorlab-copilot-launcher.is-open",
  "visibility: hidden",
  ".creatorlab-director-chat.is-empty",
  ".creatorlab-director-prompt-chips",
  "grid-template-columns: repeat(2, minmax(0, 1fr))",
  "overflow: visible",
  "white-space: normal",
]);

if (/storyverse/i.test(p2dCss)) {
  failures.push("UX-P2D stylesheet references Storyverse");
}

if (failures.length > 0) {
  console.error(`UX-P2D Director Cohesion smoke test failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("UX-P2D Director Cohesion smoke test passed.");
