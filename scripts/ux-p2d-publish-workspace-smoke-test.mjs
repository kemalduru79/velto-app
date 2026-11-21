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
  '"Step 5 · Publish"',
  'title: "Brief"',
  '"Production Setup"',
  '"Create & Review"',
  '"Publish"',
  "creatorVisibleWorkflowStep",
  "creatorPublishSystemChecks",
  "creatorReleaseConfirmationItems",
  'attentionLabel: uiLanguage === "en" ? "Review final video"',
  'attentionLabel: uiLanguage === "en" ? "Verify claims and facts"',
  'attentionLabel: uiLanguage === "en" ? "Confirm usage rights"',
  'attentionLabel: uiLanguage === "en" ? "Prepare publishing copy"',
  ".map((item) => ({ key: `confirmation-${item.key}`, label: item.attentionLabel }))",
  "creatorReleaseConfirmations[item.key]",
  "creatorPublishIsOutdated",
  'creatorProjectLifecycle?.status === "export_outdated"',
  "creatorFinalVideoNeedsRebuild",
  "creatorPublishAttentionItems",
  "creatorPublishReadinessState",
  'data-publish-readiness={creatorPublishReadinessState}',
  'className="creatorlab-p2d-package-heading"',
  "handleDownloadCreatorPackage",
  "handleExportMovie",
  "handleGenerateYoutubeMetadata",
  "handleGenerateYoutubeThumbnail",
  "handleGeneratePremiumYoutubeThumbnail",
  "handleSelectSceneAsYoutubeThumbnail",
  "setCreatorThumbnailChooserOpen((prev) => !prev)",
  'className="creatorlab-publish-thumbnail-card creatorlabs-thumbnail-studio creatorlab-thumbnail-studio-details"',
  'className="creatorlab-p2d-thumbnail-edit-action"',
  '"Edit thumbnail"',
  "creatorThumbnailStudio.focalX",
  "creatorThumbnailStudio.textPosition",
  "creatorThumbnailStudio.headline",
  "handleSaveCreatorThumbnail",
  "requestCreatorCostGuardConfirmation",
  "disabled={isDownloadingCreatorPackage || !creatorPackageReady}",
  "<CreatorCostGuard",
]);

if (page.includes("<CreatorProductionSubnav")) {
  failures.push("UX-P2D: nested production navigation was reintroduced");
}

const publishStart = page.indexOf('id="creatorlab-publish-canvas"');
const storyverseStart = page.indexOf("{!isCreatorLabFlow && (", publishStart);
const publishPresentation =
  publishStart >= 0 && storyverseStart > publishStart
    ? page.slice(publishStart, storyverseStart)
    : "";

if (!publishPresentation) {
  failures.push("UX-P2D: Publish presentation section could not be isolated");
}

if (/openai|replicate|fal\.ai|provider|generation signature|asset id|routing/i.test(publishPresentation)) {
  failures.push("UX-P2D: technical provider or routing language is visible in Publish");
}

const p2dCss = requireNeedles("app/creatorlab-ux-p2d.css", [
  ".creatorlab-p2d-readiness",
  ".creatorlab-p2d-package-heading",
  ".creatorlab-p2d-thumbnail-edit-action",
  ".creatorlab-publish-action-bar",
  "position: sticky",
  "prefers-reduced-motion",
]);

requireNeedles("app/layout.tsx", ['import "./creatorlab-ux-p2d.css";']);

if (/storyverse/i.test(p2dCss)) {
  failures.push("UX-P2D: scoped Publish stylesheet references Storyverse");
}

if (failures.length > 0) {
  console.error(`UX-P2D Publish Workspace smoke test failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("UX-P2D Publish Workspace smoke test passed.");
