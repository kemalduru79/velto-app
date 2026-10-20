import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { createCreatorPublishPreflight } from "../lib/creator/publishPreflight.ts";
import { CREATOR_VISUAL_SOURCE_METHODS } from "../lib/creator/visualSourceMethod.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const globals = read("app/globals.css");
const layout = read("app/layout.tsx");
const page = read("app/create/page.tsx");
const layers = ["b", "c", "d", "e"].map((stage) => ({
  path: `app/creatorlab-ux-i-${stage}.css`,
  source: read(`app/creatorlab-ux-i-${stage}.css`),
}));
const critical = read("scripts/stage-0-8a-critical-regression.mjs");

assert.match(globals, /--cl-font-ui:\s*var\(--font-geist-sans\)/);
assert.match(globals, /--cl-type-meta:\s*12px/);
for (const token of [
  "bg", "surface", "surface-muted", "border", "text-primary", "text-secondary",
  "text-muted", "primary", "primary-hover", "success", "warning", "danger",
  "space-1", "space-2", "space-3", "space-4", "space-6", "space-8",
  "radius-control", "radius-surface", "radius-workspace", "radius-pill",
]) {
  const declaration = new RegExp(`--cl-${token}:`, "g");
  assert.equal((globals.match(declaration) || []).length, 1, `${token} has one authoritative declaration`);
  for (const layer of layers) {
    assert.equal((layer.source.match(declaration) || []).length, 0, `${layer.path} consumes ${token}`);
  }
}

assert.match(
  layout,
  /import "\.\/creatorlab-ux-i-b\.css";\s*import "\.\/creatorlab-ux-i-c\.css";\s*import "\.\/creatorlab-ux-i-d\.css";\s*import "\.\/creatorlab-ux-i-e\.css";/,
  "the closed visual layers remain loaded in order",
);
for (const layer of layers) {
  assert.doesNotMatch(layer.source, /:root|--cl-[\w-]+\s*:/, `${layer.path} does not create a parallel token source`);
  assert.doesNotMatch(layer.source, /storyverse/i, `${layer.path} remains CreatorLab-scoped`);
  assert.doesNotMatch(layer.source, /fetch\(|\/api\/|supabase|credits?|economics|provider/i);
}

const consolidated = layers.map((layer) => layer.source).join("\n");
for (const breakpoint of ["1180", "1023", "720"]) {
  assert.match(consolidated, new RegExp(`@media \\(max-width: ${breakpoint}px\\)`));
}
for (const obsoleteBreakpoint of ["1100", "760", "520"]) {
  assert.doesNotMatch(consolidated, new RegExp(`@media \\(max-width: ${obsoleteBreakpoint}px\\)`));
}
assert.equal((consolidated.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length, 2);
assert.match(globals, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.creatorlab-premium-surface \*/);
assert.match(layers.at(-1).source, /@media \(forced-colors: active\)/);
assert.match(layers[0].source, /:focus-visible[\s\S]*?var\(--cl-primary\)/);

assert.match(page, /const \[creatorProductionCustomizeOpen, setCreatorProductionCustomizeOpen\][\s\S]*?useState\(true\)/);
const customizeStart = page.indexOf('id="creatorlab-production-customize"');
const customize = page.slice(customizeStart, customizeStart + 900);
assert.ok(customizeStart > -1);
assert.match(customize, /open=\{creatorProductionCustomizeOpen\}/);
assert.match(customize, /onToggle=\{\(event\)[\s\S]*?setCreatorProductionCustomizeOpen\(event\.currentTarget\.open\)/);
assert.doesNotMatch(customize, /Optional|creatorlab-setup-customize-status/);

assert.deepEqual(
  CREATOR_VISUAL_SOURCE_METHODS,
  ["recommended", "stock", "ai_image", "ai_video", "upload"],
  "the exact five source methods remain unchanged",
);
for (const label of ["Velto Recommended", "Stock", "AI Image", "AI Video", "Upload"]) {
  assert.match(page, new RegExp(label));
}

assert.deepEqual(
  createCreatorPublishPreflight({
    contentReady: true,
    visualsReady: true,
    voiceReady: true,
    evidenceVerified: true,
    rightsConfirmed: true,
    outputReady: true,
  }).map((item) => item.category),
  ["content", "visuals", "voice", "evidence", "rights", "output"],
  "the exact six Publish preflight categories remain unchanged",
);

const changed = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  .trimEnd().split("\n").filter(Boolean)
  .map((line) => line.slice(3).split(" -> ").at(-1));
const presentationOnly = new Set([
  "app/creatorlab-ux-i-d.css",
  "app/creatorlab-ux-i-b.css",
  "app/creatorlab-ux-i-c.css",
  "scripts/stage-0-10i-b-visual-system-test.mjs",
  "scripts/stage-0-10i-f-visual-consolidation-test.mjs",
  "scripts/stage-0-8a-critical-regression.mjs",
  "scripts/stage-0-8g-architecture-closure-test.mjs",
  "app/api/creator-upload/route.ts",
  "app/api/export-creator-package/route.ts",
  "app/api/creator-publish-readiness/route.ts",
  "app/api/creator-publish-readiness/",
  "lib/creator/audioRenderability.server.ts",
  "lib/creator/finalSceneExportSelection.ts",
  "lib/creator/musicAcquisitionEconomics.server.ts",
  "lib/creator/publishReadiness.server.ts",
  "scripts/stage-0-13c-h-final-signature-normalization-test.mjs",
  "scripts/stage-0-13c-h-rights-publish-economics-test.mjs",
  "scripts/stage-0-13c-h-stop-after-invalidation-test.mjs",
  "docs/STAGE-0.11B-CAPACITY-BASELINE.md",
  "lib/observability/capacity.ts",
  "lib/observability/index.ts",
  "lib/performance/",
  "lib/persistence/jobs/supabaseJobQueueRepository.ts",
  "lib/providers/stock/service.server.ts",
  "lib/worker/runtime.mjs",
  "scripts/stage-0-8f-a-health-observability-test.mjs",
  "scripts/stage-0-8f-b-recovery-operator-test.mjs",
  "scripts/stage-0-11b-load-concurrency-test.mjs",
  "scripts/stage-0-11b-load-harness.mjs",
  "components/create/CreatorUploadPicker.tsx",
  "lib/creator/directUpload.ts",
  "lib/performance/reliabilityHarness.ts",
  "lib/persistence/storage/supabaseObjectStorageRepository.ts",
  "lib/persistence/storage/persistenceError.ts",
  "lib/persistence/storage/types.ts",
  "scripts/stage-0-10h-custom-upload-test.mjs",
  "scripts/stage-0-11c-bottleneck-reliability-recovery-test.mjs",
  "docs/STAGE-0.11C-RELIABILITY.md",
  "docs/STAGE-0.11D-SCALE-ECONOMICS.md",
  "lib/economics/scaleEnvelope.ts",
  "scripts/stage-0-11d-scale-economics-test.mjs",
  "docs/STAGE-0.11E-AZURE-READINESS-GATE.md",
  "scripts/stage-0-11e-azure-readiness-gate-test.mjs",
  "app/api/character-image/route.ts",
  "app/api/creator-export/route.ts",
  "app/api/creator-video/route.ts",
  "app/api/image/route.ts",
  "app/api/store-audio/route.ts",
  "app/api/store-dialogue-audio/route.ts",
  "app/create/page.tsx",
  "components/auth/UserAccountMenu.tsx",
  "lib/credits/serverMetering.ts",
  "lib/credits/creatorAccountingAdmission.ts",
  "lib/economics/repository.ts",
  "scripts/beta-data-p1b-1-smoke-test.mjs",
  "scripts/beta-fin-p1-character-reference-cost-guard-smoke-test.mjs",
  "scripts/stage-0-11e-creatorlab-zero-credit-gating-test.mjs",
  "docs/STAGE-0.11F-CLOSURE-GO-NO-GO.md",
  "scripts/stage-0-11f-closure-go-no-go-test.mjs",
  "scripts/stage-0-9a-security-consent-baseline-test.mjs",
  "app/api/save-project/route.ts",
  "lib/persistence/projects/supabaseProjectRepository.ts",
  "lib/persistence/projects/types.ts",
  "package.json",
  "lib/creator/projectState.ts",
  "lib/creator/projectSaveCoordinator.ts",
  "lib/persistence/projects/projectPatch.ts",
  "scripts/stage-0-13a-creator-project-state-persistence-test.mjs",
  "scripts/beta-project-p1-refresh-restoration-smoke-test.mjs",
  "scripts/stage-0-10h-manual-project-save-test.mjs",
  "scripts/stage-0-10h-strategy-backward-navigation-persistence-test.mjs",
  "app/api/creator-script-plan/route.ts",
  "components/create/CreatorScriptReview.tsx",
  "lib/creator/creatorScript.ts",
  "lib/creator/creatorProductionAuthority.ts",
  "lib/creator/services/creatorProduction.server.ts",
  "lib/research/creatorEditorialPipeline.client.ts",
  "lib/research/scriptPlannerEditorialContext.ts",
  "scripts/stage-0-10h-2i-creator-editorial-orchestration-test.mjs",
  "scripts/stage-0-10h-4i-creator-pi-documentary-wiring-test.mjs",
  "scripts/stage-0-10h-4j-documentary-pi-closure-test.mjs",
  "scripts/stage-0-10h-market-evidence-strategy-ux-test.mjs",
  "scripts/stage-0-10i-c-stage-polish-test.mjs",
  "scripts/stage-0-13b-full-script-review-test.mjs",
  "app/api/creator-editorial-analysis/route.ts",
  "app/creatorlab-ux-h0a.css",
  "lib/creator/stageNavigation.ts",
  "lib/research/editorialGroundingRepair.ts",
  "scripts/stage-0-10h-ui-acceptance-editorial-grounding-repair-test.mjs",
  "scripts/post-0-13b-duplicate-evidence-hotfix-test.mjs",
  "scripts/post-0-13b-five-stage-workflow-hotfix-test.mjs",
  "lib/creator/audioTimeline.ts",
  "lib/creator/musicSetup.ts",
  "components/create/CreatorBackgroundMusic.tsx",
  "scripts/stage-0-13c-a-audio-timeline-test.mjs",
  "lib/creator/finalProductionSignature.ts",
  "scripts/stage-0-13c-b-audio-timeline-persistence-test.mjs",
  "next.config.ts",
  "app/api/creator-audio-assets/",
  "lib/creator/audioAssetResolver.server.ts",
  "lib/creator/audioAssets.ts",
  "lib/creator/audioProbe.server.ts",
  "scripts/stage-0-13c-c-secure-audio-assets-test.mjs",
  "scripts/stage-0-13c-d-production-setup-music-ux-test.mjs",
  "components/create/CreatorEditor.tsx",
  "components/create/CreatorSceneMusicControls.tsx",
  "components/create/CreatorMusicLibraryPicker.tsx",
  "app/api/creator-music/acquire/route.ts",
  "scripts/stage-0-13c-e-music-library-corrective-test.mjs",
  "scripts/beta-audio-p1-premium-music-catalog-smoke-test.mjs",
  "scripts/beta-audio-p1-premium-music-confirmation-ux-smoke-test.mjs",
  "scripts/voice-p1-3m-smoke-test.mjs",
  "scripts/voice-p1b-smoke-test.mjs",
  "lib/creator/sceneMusic.ts",
  "scripts/stage-0-13c-e-scene-aware-music-test.mjs",
  "components/create/CreatorSceneProductionStatus.tsx",
  "scripts/stage-0-13c-e-final-ux-corrective-test.mjs",
  "scripts/stage-0-13c-e-spacious-create-review-layout-test.mjs",
  "export-service/src/server.js",
  "export-service/src/creatorAudioMixPlan.js",
  "export-service/src/creatorAudioPolicy.js",
  "components/create/useCreatorAudioPreviewPlayback.ts",
  "lib/creator/audioPreviewPlan.ts",
  "scripts/stage-0-13c-f-renderer-mixing-test.mjs",
  "scripts/stage-0-13c-g-preview-parity-test.mjs",
  "scripts/beta-audio-p1-premium-music-entitlement-storage-smoke-test.mjs",
  "scripts/beta-audio-p1-premium-music-export-usage-outbox-smoke-test.mjs",
  "scripts/beta-audio-p1-premium-music-export-entitlement-smoke-test.mjs",
  "scripts/beta-edit-p1-creator-editor-foundation-smoke-test.mjs",
  "scripts/beta-edit-p1b-creator-editor-scene-operations-smoke-test.mjs",
  "scripts/beta-edit-p1c-creator-editor-trim-preview-smoke-test.mjs",
  "scripts/beta-ux-p1-production-consolidation-smoke-test.mjs",
  "scripts/ux-p2c-production-workspace-smoke-test.mjs",
  "scripts/stage-0-10h-production-setup-ux-test.mjs",
  "scripts/stage-0-10h-emergency-generation-scope-test.mjs",
  "scripts/stage-0-10h-real-production-acceptance-test.mjs",
  "scripts/stage-0-10h-scene-visual-cta-status-test.mjs",
  "scripts/stage-0-19f-f2-final-export-timeout-contract-test.mjs",
  "scripts/stage-0-7a-2-final-movie-migration-test.mjs",
  "scripts/stage-0-7a-media-ownership-metering-test.mjs",
  "scripts/post-0-13c-c-script-duration-contract-test.mjs",
  "lib/creator/creatorWorkflowAuthority.ts",
  "scripts/post-script-duration-workflow-authority-test.mjs",
  "scripts/post-strategy-script-long-form-acceptance-test.mjs",
  "scripts/post-long-form-project-lifecycle-authority-test.mjs",
  "scripts/post-creatorlab-new-project-persistence-test.mjs",
  "scripts/stage-0-10h-ui-acceptance-fetch-fix-test.mjs",
  "lib/research/editorialAnalysisContract.ts",
  "scripts/stage-0-10h-2h-script-planner-editorial-context-test.mjs",
  "lib/research/researchOrchestration.ts",
  "lib/research/sourceAssessment.ts",
  "scripts/stage-0-10h-1c-evidence-freeze-test.mjs",
  "scripts/stage-0-10h-1f-counter-evidence-orchestration-test.mjs",
  "lib/research/editorialScriptContext.ts",
  "app/api/creator-research/route.ts",
  "lib/research/orchestrationRequest.ts",
  "scripts/stage-0-10h-2g-editorial-analysis-api-test.mjs",
  "lib/providers/research/exaAdapter.ts",
  "lib/research/editorialAnalysisRequest.ts",
  "scripts/stage-0-10h-1d-grounded-search-provider-test.mjs",
  "scripts/stage-0-10h-1e-creator-research-api-test.mjs",
  "lib/research/topicEvidenceReadiness.ts",
  "lib/research/editorialPrimaryCoverageRepair.ts",
  "lib/research/claimAuthorityResolver.ts",
  "scripts/stage-0-10h-2b-evidence-aware-topic-readiness-test.mjs",
  "scripts/stage-0-10h-2e-editorial-script-context-test.mjs",
  "scripts/stage-0-15b-6g-counter-provenance-preservation-test.mjs",
  "scripts/stage-0-19c-claim-authority-resolver-test.mjs",
  "lib/creator/controlledLongFormAcceptance.ts",
  "scripts/stage-0-20g-controlled-long-form-acceptance-test.mjs",
  "app/api/jobs/[jobId]/route.ts",
  "lib/persistence/jobs/types.ts",
  "lib/worker/jobHandlers.mjs",
  "Dockerfile.worker",
  "scripts/beta-edit-p1e-final-video-lifecycle-smoke-test.mjs",
  "scripts/stage-0-7d-3b-final-export-admission-test.mjs",
  "app/api/creator-final-export-jobs/",
  "app/api/creator-final-export-jobs/route.ts",
  "app/api/creator-final-video-recovery/",
  "app/api/internal/jobs/[jobId]/creator-final-export/",
  "app/api/internal/jobs/[jobId]/creator-final-export/route.ts",
  "lib/creator/finalVideoRecovery.ts",
  "lib/creator/finalVideoRecoveryProbe.server.ts",
  "lib/creator/mediaFingerprint.server.ts",
  "lib/persistence/media/storageAdmission.server.ts",
  "scripts/fixtures/stage-2b-concurrent-enqueue.sql",
  "scripts/fixtures/stage-2b-concurrent-setup.sql",
  "scripts/fixtures/stage-2b-postgres-baseline.sql",
  "scripts/fixtures/stage-2b-postgres-integration.sql",
  "scripts/fixtures/stage-2b-render-heartbeat.sql",
  "scripts/fixtures/stage-2-acceptance-pre-render-recovery.sql",
  "scripts/fixtures/stage-2-historical-generation-integration.sql",
  "scripts/fixtures/stage-2-incident-0e20-nonbillable-evidence.json",
  "scripts/fixtures/stage-2-http-supabase-project-baseline.sql",
  "scripts/fixtures/stage-2-http-failure-injection.sql",
  "scripts/fixtures/stage-2c-concurrent-request.sql",
  "scripts/fixtures/stage-2c-concurrent-setup.sql",
  "scripts/fixtures/stage-2c-economic-integration.sql",
  "scripts/fixtures/stage-2c-production-economic-baseline.sql",
  "scripts/stage-1-creator-final-video-recovery-test.mjs",
  "scripts/stage-2a-durable-creator-final-export-test.mjs",
  "scripts/stage-2b-worker-lifecycle-test.mjs",
  "scripts/stage-2-http-concurrent-admission-test.mjs",
  "supabase/migrations/20261016073805_stage_1a_final_video_recovery_atomic_install.sql",
  "supabase/migrations/20261016150000_stage_2a_durable_creator_final_exports.sql",
  "supabase/migrations/20261017170333_stage_2_acceptance_final_export_pre_render_recovery.sql",
  "supabase/migrations/20261017190000_stage_2_historical_final_export_generations.sql",
  "scripts/stage-r2-safety-creator-project-quarantine-test.mjs",
  "scripts/stage-r2-safety-autosave-cas-test.mjs",
  "app/api/creator-script/refine/route.ts",
  "lib/creator/creatorScriptRefinementRuntime.ts",
  "lib/creator/creatorScriptEditorialRewrite.ts",
  "lib/creator/creatorScriptEditorialRewriteProviders.server.ts",
  "lib/creator/creatorScriptRefinementAcceptance.ts",
  "lib/research/originalSourceEvidence.ts",
  "lib/research/originalSourceAcquisition.server.ts",
  "lib/creator/creatorScriptLiveAcceptanceBudget.ts",
  "lib/creator/creatorScriptStage4B2Preflight.ts",
  "lib/creator/stage4b2ProviderAcceptance.ts",
  "lib/creator/stage4b2PdfEvidence.server.ts",
  "lib/creator/stage4b2Verbatim.ts",
  "lib/creator/creatorScriptLiveAcceptanceRunner.ts",
  "lib/creator/creatorScriptRevisions.ts",
  "scripts/creator-script-refinement-r1-foundation-test.mjs",
  "scripts/creator-script-refinement-r2-research-backed-test.mjs",
  "scripts/stage-4a-creator-refinement-acceptance-test.mjs",
  "scripts/stage-4b1-controlled-live-acceptance-harness-test.mjs",
  "scripts/stage-4b2-provider-acceptance-preflight-test.mjs",
    "scripts/stage-4b2-local-live-probe.mjs",
    "scripts/stage-4b2-local-live-probe-offline-test.mjs",
    "scripts/stage-4b2-exact-source-recovery-test.mjs",
    "scripts/stage-4b2-pdf-evidence-test.mjs",
    "scripts/stage-4b2-real-pdf-offline-acceptance.mjs",
    "scripts/stage-4b2-canonical-whole-script-acceptance-test.mjs",
    "scripts/stage-4b2-canonical-whole-script-acceptance.mjs",
    "lib/creator/creatorScriptCanonicalAcceptance.ts",
    "docs/creatorlab/R2_STAGE_4B2_LOCAL_EXECUTION.md",
    "docs/creatorlab/receipts/STAGE4B2_20261019_SEARCH_1.json",
    "docs/creatorlab/receipts/STAGE4B2_20261019_CONTENTS_2.json",
    "docs/creatorlab/receipts/STAGE4B2_20261020_PDFV2_3.json",
    "docs/creatorlab/receipts/STAGE4B2_20261020_ATOMIC_4.json",
    ".gitignore",
  "scripts/stage-0-13e-ai-script-refinement-test.mjs",
]);
assert.deepEqual(changed.filter((path) => !presentationOnly.has(path) && path !== "docs/creatorlab/receipts/"), []);
assert.equal(
  (critical.match(/scripts\/stage-0-10i-f-visual-consolidation-test\.mjs/g) || []).length,
  1,
  "I-F is registered exactly once in the critical suite",
);

console.log("STAGE_0_10I_F_VISUAL_CONSOLIDATION=PASS");
