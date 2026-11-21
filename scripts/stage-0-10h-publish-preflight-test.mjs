import { readMountedWorkspacePanel, verifyWorkspacePanel, evaluatePanelAction } from "./fixtures/create-workspace-panel-authority.mjs";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorPublishPreflight } from "../lib/creator/publishPreflight.ts";

const production = readMountedWorkspacePanel("CreatorProductionPanel");
const publish = readMountedWorkspacePanel("CreatorPublishPanel");
const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const ready = createCreatorPublishPreflight({
  contentReady: true,
  visualsReady: true,
  voiceReady: true,
  evidenceVerified: true,
  rightsConfirmed: true,
  outputReady: true,
});

assert.deepEqual(ready.map((item) => item.category), [
  "content",
  "visuals",
  "voice",
  "evidence",
  "rights",
  "output",
]);
assert.ok(ready.every((item) => item.status === "ready"));

const pending = createCreatorPublishPreflight({
  contentReady: true,
  visualsReady: false,
  voiceReady: false,
  evidenceVerified: false,
  rightsConfirmed: false,
  outputReady: false,
});
const status = Object.fromEntries(pending.map((item) => [item.category, item.status]));
assert.equal(status.visuals, "action_required");
assert.equal(status.voice, "action_required");
assert.equal(status.evidence, "review");
assert.equal(status.rights, "review");
assert.equal(status.output, "blocked");

assert.match(page, /visualsReady: creatorProjectReadiness\?\.visuals === "ready"/);
assert.match(page, /voiceReady: creatorProjectReadiness\?\.voiceOver === "ready"/);
assert.match(page, /evidenceVerified: creatorReleaseConfirmations\.claimsVerified/);
assert.match(page, /rightsConfirmed: creatorReleaseConfirmations\.rightsConfirmed/);
assert.match(production, /!creatorProductionComplete && \(/, "Unfinished production retains its action; completed production hides it");
assert.match(publish, /data-creator-publish-preflight/);
assert.match(publish, /creatorPublishSystemChecks\.map/);
assert.match(publish, /creatorReleaseConfirmationItems\.map/);
assert.match(publish, /disabled=\{isDownloadingCreatorPackage \|\| !creatorPackageReady\}/);

const helperSource = fs.readFileSync(new URL("../lib/creator/publishPreflight.ts", import.meta.url), "utf8");
assert.doesNotMatch(helperSource, /fetch\(|OpenAI|Exa|provider|credits?/i);
assert.doesNotMatch(publish.slice(publish.indexOf("data-creator-publish-preflight"), publish.indexOf("data-creator-publish-preflight") + 1800), /credits?|provider|OpenAI|Exa/i);

console.log("STAGE_0_10H_PUBLISH_PREFLIGHT=PASS");

// The former /creatorProductionComplete &&/ regex also matched the negated
// condition. Execute the retained JSX so false/true readiness cannot alias.
const productionPorts = {
  creatorProductionComplete: false, creatorTimelineNeedsAttention: false,
  creatorMusicConfirmationRequired: false, creatorNextProductionAction: { title: "Synthetic action", description: "Synthetic", buttonLabel: "Continue" },
  creatorMediaPreflightLoading: false, isBatchRendering: false, isPreparingAudio: false,
  isExportingMovie: false, buildingStory: false, creatorVisualsComplete: false,
  creatorVoiceOverComplete: false, creatorMotionComplete: false, uiLanguage: "en", ui: {},
  continueCreatorProduction: () => {},
};
const unfinished = evaluatePanelAction(production, "production", productionPorts);
assert.match(renderToStaticMarkup(unfinished), /id="creatorlab-production-action"/);
assert.equal(evaluatePanelAction(production, "production", { ...productionPorts, creatorProductionComplete: true }), false);
for (const [ready, downloading, disabled] of [[false, false, true], [false, true, true], [true, true, true], [true, false, false]]) {
  const callback = () => {};
  const action = evaluatePanelAction(publish, "publish", {
    handleDownloadCreatorPackage: callback, isDownloadingCreatorPackage: downloading,
    creatorPackageReady: ready, creatorPublishIsOutdated: false, creatorPublishComplete: false, uiLanguage: "en",
  });
  assert.equal(action.props.disabled, disabled, "The actual package button must retain both readiness and duplicate-dispatch guards");
  assert.equal(action.props.onClick, callback);
  assert.equal(/disabled=""/.test(renderToStaticMarkup(action)), disabled);
}
// The ownership proof must reject disconnected JSX, wrong authority, changed
// stage visibility, missing typed props and independently owned panel state.
assert.throws(() => verifyWorkspacePanel("CreatorProductionPanel", page.replace("<CreatorProductionPanel", "<DisconnectedProductionPanel"), production));
assert.throws(() => verifyWorkspacePanel("CreatorProductionPanel", page.replace("restoreCreatorSceneAsset={restoreCreatorSceneAsset}", "restoreCreatorSceneAsset={wrongAuthority}"), production));
assert.throws(() => verifyWorkspacePanel("CreatorProductionPanel", page.replace("(creatorStageVisibility.production_setup || creatorStageVisibility.create_review) && creatorProductionPackage", "false && creatorProductionPackage"), production));
assert.throws(() => verifyWorkspacePanel("CreatorProductionPanel", page.replace("restoreCreatorSceneAsset={restoreCreatorSceneAsset}", ""), production));
assert.throws(() => verifyWorkspacePanel("CreatorProductionPanel", page, production.replace("  return (", "  useState(0);\n  return (")));
console.log("PUBLISH_PREFLIGHT_ACTUAL_JSX_AND_OWNERSHIP=PASS; synthetic ports; not complete app/backend acceptance");
