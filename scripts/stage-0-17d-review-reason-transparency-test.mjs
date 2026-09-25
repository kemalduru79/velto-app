import assert from "node:assert/strict";
import { auditFlowContinuityScene } from "../lib/video/flowContinuityAudit.ts";
import { deriveCreatorSceneReviewReasons } from "../lib/creator/sceneReviewReasons.ts";

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

console.log("STAGE_0_17D_REVIEW_REASON_TRANSPARENCY=PASS");
