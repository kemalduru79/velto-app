import assert from "node:assert/strict";
import { auditFlowContinuityScene } from "../lib/video/flowContinuityAudit.ts";
import {
  deriveCreatorSceneReviewReasons,
  resolveCreatorMeasuredScriptHealthStatus,
} from "../lib/creator/sceneReviewReasons.ts";
import { createCreatorFinalVideoReadiness } from "../lib/creator/finalVideoReadiness.ts";

const current = { narrationState: "current", dialogueState: "not_required", videoState: "missing" };
const reasons = (overrides = {}) => deriveCreatorSceneReviewReasons({ failed: false, ...current, scriptHealthStatus: "ready", language: "en", ...overrides });
const status = (overrides = {}) => {
  const input = { generating: false, failed: false, stale: false, hasContinuityWarning: false, scriptNeedsReview: false, scriptReady: true, visualReady: true, voiceReady: true, motionRequired: false, motionReady: false, ...overrides };
  if (input.generating) return "generating";
  if (input.failed || input.stale || input.hasContinuityWarning || input.scriptNeedsReview) return "review";
  return input.scriptReady && input.visualReady && input.voiceReady && (!input.motionRequired || input.motionReady) ? "ready" : "needs_action";
};

assert.equal(status(), "ready");
assert.deepEqual(reasons(), { reasons: [], advisories: [] });

const staticAudit = auditFlowContinuityScene({ id: 1, source: "image", targetDurationSec: 22.2, narrationDurationSec: 21, hasNarration: true });
const staticResult = reasons({ continuityAudit: staticAudit });
assert.equal(status({ hasContinuityWarning: true }), "review");
assert.equal(staticResult.reasons[0].code, "STATIC_HOLD_UNVERIFIED");
assert.match(staticResult.reasons[0].message, /22\.2s/);
assert.match(staticResult.reasons[0].compactLabel, /Long static visual/);

assert.equal(reasons({ narrationState: "stale" }).reasons[0].code, "STALE_NARRATION");
assert.equal(reasons({ dialogueState: "stale" }).reasons[0].code, "STALE_DIALOGUE");
assert.equal(reasons({ videoState: "stale" }).reasons[0].code, "STALE_VIDEO");
assert.equal(reasons({ scriptHealthStatus: "too_long" }).reasons[0].code, "SCRIPT_TOO_LONG");
assert.equal(reasons({ scriptHealthStatus: "too_short" }).reasons[0].code, "SCRIPT_TOO_SHORT");

const measuredFitAudit = auditFlowContinuityScene({ id: 1, source: "video", videoDurationSec: 10, targetDurationSec: 10, hasNarration: true, narrationDurationSec: 9.5 });
const measuredOverflowAudit = auditFlowContinuityScene({ id: 1, source: "video", videoDurationSec: 10, targetDurationSec: 10, hasNarration: true, narrationDurationSec: 31 });
const measuredStatus = (overrides = {}) => resolveCreatorMeasuredScriptHealthStatus({
  scriptHealthStatus: "too_long",
  speechMatchesMeasuredSource: true,
  narrationState: "current",
  measuredNarrationDurationSec: 9.5,
  continuityAudit: measuredFitAudit,
  ...overrides,
});
assert.equal(measuredStatus(), "ready", "current measured narration that fits clears only the estimate-based too-long advisory");
assert.equal(measuredStatus({ speechMatchesMeasuredSource: false }), "too_long", "unsaved draft speech cannot reuse measured authority from persisted speech");
assert.equal(measuredStatus({ narrationState: "stale" }), "too_long", "stale audio cannot clear estimated timing review");
assert.equal(measuredStatus({ narrationState: "missing", measuredNarrationDurationSec: 0 }), "too_long", "missing audio cannot clear estimated timing review");
assert.equal(measuredStatus({ measuredNarrationDurationSec: 0 }), "too_long", "unmeasured audio cannot clear estimated timing review");
assert.equal(measuredStatus({ continuityAudit: auditFlowContinuityScene({ id: 1, source: "video", videoDurationSec: 10, targetDurationSec: 10, hasNarration: true }) }), "too_long", "incomplete measured speech authority remains fail-closed");
assert.equal(measuredStatus({ measuredNarrationDurationSec: 31, continuityAudit: measuredOverflowAudit }), "too_long", "genuine measured overflow remains review-blocking");
assert.equal(measuredStatus({ scriptHealthStatus: "too_short" }), "too_short", "other script-health reasons are unchanged");
assert.equal(measuredStatus({ scriptHealthStatus: "ready", narrationState: "stale" }), "ready", "the override does not invent unrelated blockers");
assert.equal(status({ scriptNeedsReview: measuredStatus() !== "ready" }), "ready", "measured fit removes the sole script-duration triage blocker");
assert.equal(status({ scriptNeedsReview: measuredStatus({ measuredNarrationDurationSec: 31, continuityAudit: measuredOverflowAudit }) !== "ready", hasContinuityWarning: true }), "review", "measured overflow still blocks readiness");
const finalScene = { id: 1, renderMode: "image", image: "https://assets.test/image.jpg", narration: "Narration", audioUrl: "https://assets.test/narration.mp3", narrationAudioCurrent: true };
assert.equal(measuredFitAudit.risks.includes("speech_overflow"), false, "canonical continuity authority accepts measured speech that fits");
assert.equal(measuredOverflowAudit.risks.includes("speech_overflow"), true, "canonical continuity authority records genuine measured overflow");
const fitExportValidation = { canExport: !measuredFitAudit.risks.includes("speech_overflow"), requiresManualConfirmation: false, blockingSceneIds: [] };
const overflowExportValidation = { canExport: !measuredOverflowAudit.risks.includes("speech_overflow"), requiresManualConfirmation: false, blockingSceneIds: [1] };
assert.equal(createCreatorFinalVideoReadiness({ scenes: [finalScene], timelineApproved: true, flowValidation: fitExportValidation }).canStartFinalVideo, true, "final readiness independently consumes the canonical fit result");
assert.equal(createCreatorFinalVideoReadiness({ scenes: [finalScene], timelineApproved: true, flowValidation: overflowExportValidation }).canStartFinalVideo, false, "final readiness independently consumes the canonical blocking result");

const multiple = reasons({ failed: true, narrationState: "stale", continuityAudit: staticAudit, scriptHealthStatus: "too_long" });
assert.deepEqual(multiple.reasons.map((reason) => reason.code), ["FAILED_MEDIA", "STALE_NARRATION", "SCRIPT_TOO_LONG", "STATIC_HOLD_UNVERIFIED"]);
assert.equal(multiple.reasons[0].compactLabel, "Media failed");

const advisoryOnly = reasons({ splitRecommended: true, recommendedSplitCount: 2 });
assert.equal(advisoryOnly.reasons.length, 0, "split recommendation is not a direct review cause");
assert.equal(advisoryOnly.advisories[0].code, "SPLIT_RECOMMENDED");
assert.equal(status(), "ready", "split advisory cannot change triage status");

for (const generating of [false, true]) for (const failed of [false, true]) for (const stale of [false, true]) for (const continuity of [false, true]) for (const scriptReview of [false, true]) {
  const actual = status({ generating, failed, stale, hasContinuityWarning: continuity, scriptNeedsReview: scriptReview });
  const expected = generating ? "generating" : failed || stale || continuity || scriptReview ? "review" : "ready";
  assert.equal(actual, expected, "triage classification must remain behaviorally identical");
}

const page = await import("node:fs").then(({ readFileSync }) => readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8"));
const component = await import("node:fs").then(({ readFileSync }) => readFileSync(new URL("../components/create/CreatorSceneProductionStatus.tsx", import.meta.url), "utf8"));
assert.match(component, /if \(generating\) return "generating";[\s\S]*if \(failed \|\| stale \|\| hasContinuityWarning \|\| scriptNeedsReview\) return "review";/, "existing triage classification remains exact");
assert.match(page, /data-scene-review-reasons="true"/);
assert.match(page, /sceneOperationalSummary\.reviewReasons\.map/);
assert.doesNotMatch(page.slice(page.indexOf("data-scene-review-reasons"), page.indexOf("data-scene-review-reasons") + 2_000), /fetch\(|provider|generateScene|handleGenerate/);
const focusedSceneStart = page.indexOf("const focusedSceneContinuityAudit");
const focusedSceneGuidanceStart = page.indexOf("const simpleGuidance", focusedSceneStart);
const focusedSceneAuthority = page.slice(focusedSceneStart, focusedSceneGuidanceStart);
const focusedSceneDecisions = page.slice(focusedSceneGuidanceStart, page.indexOf("return (", focusedSceneGuidanceStart));
assert.ok(focusedSceneStart >= 0, "focused scene derives measured timing authority");
assert.match(focusedSceneAuthority, /effectiveSceneDraftHealthStatus = resolveCreatorMeasuredScriptHealthStatus/);
assert.match(focusedSceneAuthority, /speechMatchesMeasuredSource:[\s\S]*normalizeCreatorScriptText\(sceneScriptDraft\.narration\)[\s\S]*normalizeCreatorScriptText\(scene\.narration \|\| ""\)[\s\S]*normalizeCreatorScriptText\(sceneScriptDraft\.dialogue\)[\s\S]*normalizeCreatorScriptText\(scene\.dialogue \|\| ""\)/);
assert.match(focusedSceneDecisions, /simpleGuidance =[\s\S]*effectiveSceneDraftHealthStatus === "too_long"[\s\S]*effectiveSceneDraftHealthStatus === "too_short"/);
assert.match(focusedSceneDecisions, /scenePrimaryTab[\s\S]*effectiveSceneDraftHealthStatus !== "ready"/);
assert.match(focusedSceneDecisions, /scenePrimaryActionLabel[\s\S]*effectiveSceneDraftHealthStatus !== "ready"/);
assert.match(focusedSceneDecisions, /scenePrimaryActionUsesCredits[\s\S]*effectiveSceneDraftHealthStatus === "ready"/);
assert.match(focusedSceneDecisions, /if \(effectiveSceneDraftHealthStatus !== "ready"\) return;/);
assert.doesNotMatch(focusedSceneDecisions, /sceneDraftHealth\.status/, "focused scene decisions no longer route on the pre-TTS estimate");
assert.equal((page.match(/speechMatchesMeasuredSource:/g) || []).length, 2, "summary and focused-scene overrides both bind measured timing to matching speech");

console.log("STAGE_0_17D_REVIEW_REASON_TRANSPARENCY=PASS");
