import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { approveCreatorScriptForProduction } from "../lib/creator/creatorScriptApproval.ts";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import { creatorSceneBuildRecoveryMessage, resolveCreatorScriptEditorialState } from "../lib/creator/creatorEditorialQa.ts";

assert.equal(resolveCreatorScriptEditorialState({ hasScript: false, isCurrent: false }), "no_script");
assert.equal(resolveCreatorScriptEditorialState({ hasScript: true, isCurrent: true }), "current");
assert.equal(resolveCreatorScriptEditorialState({ hasScript: true, isCurrent: false }), "stale");

assert.equal(creatorSceneBuildRecoveryMessage({ code: "CREATOR_SCRIPT_APPROVAL_REQUIRED", language: "en" }), "Review and approve the current script before building scenes.");
assert.equal(creatorSceneBuildRecoveryMessage({ code: "CREATOR_SCRIPT_APPROVAL_STALE", language: "en" }), "The script changed after approval. Approve the current version to rebuild scenes.");
assert.equal(creatorSceneBuildRecoveryMessage({ code: "CREATOR_SCRIPT_APPROVAL_BLOCKED:pending_refinement", language: "en" }), "Apply or discard the current refinement before continuing.");
assert.equal(creatorSceneBuildRecoveryMessage({ code: "PROJECT_SAVE_CONFLICT", language: "en" }), "This project changed while you were working. Reload and try again.");
assert.doesNotMatch(creatorSceneBuildRecoveryMessage({ code: "CREATOR_SCRIPT_SNAPSHOT_INVALID", language: "en" }), /CREATOR_SCRIPT|persisted|authority/i);

const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve evidence.", readiness: { status: "ready", editorialReadinessScore: 90, reviewReasons: [] }, claims: [], evidence: [], sources: [] };
const staleScript = createCreatorScript({ title: "Preserved script", sections: [
  { id: "opening", kind: "opening", text: Array.from({ length: 55 }, (_, index) => `open${index}`).join(" "), claimIds: [], evidenceReviewRequired: false },
  { id: "body", kind: "body", text: Array.from({ length: 575 }, (_, index) => `body${index}`).join(" "), claimIds: [], evidenceReviewRequired: false },
  { id: "conclusion", kind: "conclusion", text: Array.from({ length: 75 }, (_, index) => `close${index}`).join(" "), claimIds: [], evidenceReviewRequired: false },
], targetDurationSec: 300, strategyFingerprint: "old-strategy", grounding: { context }, generatedAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z" });
assert.throws(() => approveCreatorScriptForProduction({ script: staleScript, strategyFingerprint: "current-strategy", language: "en", hasPendingRefinement: false }), /strategy_stale/);

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const review = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const refineRoute = await readFile(new URL("../app/api/creator-script/refine/route.ts", import.meta.url), "utf8");
const production = await readFile(new URL("../lib/creator/services/creatorProduction.server.ts", import.meta.url), "utf8");

assert.match(review, /Review sources/);
assert.match(review, /Confirm this edit is supported/);
assert.match(review, /Rewrite section with AI/);
assert.doesNotMatch(review, /Regenerate to verify/);
assert.match(review, /This edit cannot be confirmed from the available sources/);
assert.match(review, /manuallyReviewableSectionIds\.has\(section\.id\)/, "human confirmation remains limited to server-reviewable sections");

const strategyPanel = await (await import("node:fs/promises")).readFile(new URL("../components/create/CreatorStrategyPanel.tsx", import.meta.url), "utf8");
assert.match(page, /creatorScriptEditorialState=\{creatorScriptEditorialState\}/);
assert.match(strategyPanel, /creatorScriptEditorialState !== "current"/);
assert.match(strategyPanel, /Your previous script is preserved, but it no longer matches the current direction/);
assert.match(strategyPanel, /Rebuild script/);
assert.match(strategyPanel, /creatorScriptEditorialState === "stale"/);
assert.match(strategyPanel, /creatorScriptIsCurrent && creatorScript/);
assert.match(page, /creatorSceneBuildRecoveryMessage\(\{ code: approvalData\?\.code/);
assert.match(page, /creatorSceneBuildRecoveryMessage\(\{ code: data\?\.code/);
assert.doesNotMatch(page, /One quality decision controls the whole project\. Provider routing remains internal\./);
const productionQualityUi = await (await import("node:fs/promises")).readFile(new URL("../components/create/CreateBriefPanel.tsx", import.meta.url), "utf8");
assert.match(productionQualityUi, /Choose the finish and production quality that best fit this project\./);

assert.match(refineRoute, /script\.strategyFingerprint !== state\.strategy\.strategyFingerprint/);
assert.match(refineRoute, /CREATOR_SCRIPT_REFINEMENT_STALE/);
assert.match(production, /CREATOR_SCRIPT_APPROVAL_REQUIRED/, "server scene-build authority remains fail closed");
assert.match(production, /requestedRevision: body\.approvedScriptRevision/);
assert.doesNotMatch(production, /body\.approvedScript[,)]/);

console.log("STAGE_0_13H_EDITORIAL_QA_CORRECTIONS=PASS");
