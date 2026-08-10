#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const operationPolicy = await import("../lib/credits/operationPolicy.ts");
const [policy, metering, page, component, image, voice, dialogue, video, creatorExport] =
  await Promise.all([
    read("lib/credits/operationPolicy.ts"),
    read("lib/credits/serverMetering.ts"),
    read("app/create/page.tsx"),
    read("components/create/CreatorCostGuard.tsx"),
    read("app/api/image/route.ts"),
    read("app/api/store-audio/route.ts"),
    read("app/api/store-dialogue-audio/route.ts"),
    read("app/api/creator-video/route.ts"),
    read("app/api/creator-export/route.ts"),
  ]);

const checks = [];
const section = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source section: ${start}`);
  return source.slice(startIndex, endIndex);
};
const check = (name, operation) => {
  operation();
  checks.push(name);
  console.log(`✓ ${name}`);
};

check("authoritative credit values remain unchanged", () => {
  for (const marker of [
    "creator_image: { draft: 0, standard: 1, pro: 2, cinematic: 4 }",
    "creator_voice: { draft: 0, standard: 1, pro: 2, cinematic: 3 }",
    "creator_dialogue_voice: { draft: 0, standard: 1, pro: 2, cinematic: 3 }",
    "creator_video: { draft: 0, standard: 0, pro: 6, cinematic: 10 }",
    "creator_export: { draft: 0, standard: 1, pro: 2, cinematic: 3 }",
  ]) assert.match(policy, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

check("manifest estimator delegates every price to getOperationCreditCost", () => {
  assert.match(policy, /export function estimateCreatorOperationManifest/);
  for (const operation of ["creator_image", "creator_voice", "creator_dialogue_voice", "creator_video", "creator_export"]) {
    assert.match(policy, new RegExp(`getOperationCreditCost\\(\"${operation}\"`));
  }
  assert.match(policy, /Math\.max\(0, Math\.trunc/);
  assert.equal(
    operationPolicy.estimateCreatorOperationManifest(
      { images: 2, voices: 1, dialogueVoices: 1, videos: 1, exports: 1 },
      "pro",
    ).totalCredits,
    16,
  );
  assert.equal(
    operationPolicy.estimateCreatorOperationManifest(
      { images: 3, voices: 2, dialogueVoices: 2, videos: 1, exports: 1 },
      "draft",
    ).totalCredits,
    0,
  );
});

check("Cost Guard requires explicit positive confirmation and has no provider copy", () => {
  assert.match(component, /Confirm & Start/);
  assert.match(component, /onConfirm/);
  assert.match(component, /onCancel/);
  assert.doesNotMatch(component, /OpenAI|ElevenLabs|Runway|provider/i);
  assert.doesNotMatch(page, /finishVideoDispatchCountdown\(true\)/);
  assert.doesNotMatch(page, /finishImageDispatchCountdown\(true\)/);
});

check("all five billable routes opt into the server protocol guard", () => {
  for (const source of [image, voice, dialogue, video, creatorExport]) {
    assert.match(source, /requireCostGuardConfirmation:/);
  }
  assert.match(metering, /if \(credits <= 0\) return null;/);
  assert.match(metering, /if \(input\.requireCostGuardConfirmation\)/);
  assert.match(metering, /x-creator-cost-guard/);
  assert.match(metering, /x-idempotency-key/);
  assert.ok(
    metering.indexOf("if (input.requireCostGuardConfirmation)") <
      metering.indexOf("const idempotencyKey"),
  );
});

check("client never supplies an authoritative credit amount", () => {
  assert.doesNotMatch(page, /(?:credits|creditAmount)\s*:/);
  assert.match(metering, /getOperationCreditCost\(input\.operationType, input\.qualityMode\)/);
});

check("individual operations capture and pass immutable identities", () => {
  assert.match(page, /window\.crypto\.randomUUID\(\)/);
  assert.doesNotMatch(page, /activeCreatorOperationIdRef/);
  const imageFunction = section(page, "const generateSceneImage", "const updateSceneAudioData");
  const voiceFunction = section(page, "const getSceneAudioUrl", "const parseDialogueLines");
  const dialogueFunction = section(page, "const getSceneDialogueUrl", "const playAudioFromUrl");
  const videoFunction = section(page, "const handleGenerateVideo", "const waitForRunwayVideoAndStore");
  for (const source of [imageFunction, voiceFunction, dialogueFunction, videoFunction]) {
    assert.match(source, /creatorOperationId/);
    assert.match(source, /creatorCostGuardHeaders/);
  }
  for (const suffix of [":image:${scene.id}", ":voice:${scene.id}", ":dialogue-voice:${scene.id}", ":video:${scene.id}", ":export`"]) {
    assert.ok(page.includes(suffix), `missing stable identity marker ${suffix}`);
  }
  assert.doesNotMatch(page, /creator-(?:image|voice|dialogue-voice|video|export)[^\n]*Date\.now/);
  assert.match(component, /if \(submitting\) return;/);
});

check("premium thumbnail uses its confirmed identity and Cost Guard headers", () => {
  const premiumThumbnail = section(
    page,
    "const generatePremiumYoutubeThumbnailImage",
    "const handleGenerateYoutubeThumbnail",
  );
  assert.doesNotMatch(premiumThumbnail, /Date\.now\(\)/);
  assert.match(premiumThumbnail, /creatorOperationId: string/);
  assert.match(premiumThumbnail, /creatorCostGuardHeaders\(imageRequestKey\)/);
  assert.match(premiumThumbnail, /productProfile: "creatorlab"/);
  assert.match(page, /generatePremiumYoutubeThumbnailImage\(\s*creatorOperationId,\s*creatorOperationKey,/);
  assert.match(page, /generatePremiumYoutubeThumbnailImage\(\s*creatorOperationId,\s*creatorOperationKey\s*,?\s*\)/);
});

check("every CreatorLab /api/image call carries Cost Guard headers", () => {
  const imageCalls = [...page.matchAll(/fetch\("\/api\/image"/g)];
  assert.equal(imageCalls.length, 2);
  for (const match of imageCalls) {
    const requestWindow = page.slice(match.index, match.index + 900);
    assert.match(requestWindow, /creatorCostGuardHeaders/);
  }
});

check("batch and retry children use locally captured parent identities", () => {
  const fullBatch = section(page, "const startBatchRender", "const retryFailedScenes");
  assert.match(fullBatch, /let batchOperationId/);
  assert.match(fullBatch, /creatorOperationId: batchOperationId/);
  assert.match(fullBatch, /generateSceneVideoAndWait\(\s*scene,\s*batchOperationId/);

  const retryBatch = section(page, "const retryFailedScenes", "const handleExportMovie");
  assert.match(retryBatch, /const retryManifest =/);
  assert.match(retryBatch, /images:/);
  assert.match(retryBatch, /voices:/);
  assert.match(retryBatch, /dialogueVoices:/);
  assert.match(retryBatch, /videos:/);
  assert.match(retryBatch, /estimateCreatorOperationManifest\(\s*retryManifest/);
  assert.match(retryBatch, /creatorOperationId: retryBatchOperationId/);
  assert.doesNotMatch(retryBatch, /retryVideoSceneCount|retryImageSceneCount/);
  assert.doesNotMatch(retryBatch, /else if \(isCreatorLabFlow/);
});

check("ambiguous batch children reuse only their exact keyed identities", () => {
  const batchKeyHelper = section(
    page,
    "const getCreatorBatchChildOperationKey",
    "const getCreatorTelemetrySessionId",
  );
  assert.match(batchKeyHelper, /"batch-child"/);
  assert.match(batchKeyHelper, /operation/);
  assert.match(batchKeyHelper, /getProjectKey\(\)/);
  assert.match(batchKeyHelper, /sceneId/);
  assert.match(batchKeyHelper, /imageUseCase \|\| "scene"/);
  assert.match(
    batchKeyHelper,
    /ambiguousCreatorOperationIdsRef\.current\.get\(operationKey\) \|\| derivedOperationId/,
  );

  const childKeys = {
    imageScene1: "batch-child:image:project-a:1:hook",
    imageScene2: "batch-child:image:project-a:2:scene",
    videoScene1: "batch-child:video:project-a:1",
  };
  assert.equal(new Set(Object.values(childKeys)).size, 3);
  const ambiguousChildren = new Map();
  ambiguousChildren.set(childKeys.imageScene1, "parent-a:image:1:hook");
  ambiguousChildren.set(childKeys.imageScene2, "parent-a:image:2:scene");
  ambiguousChildren.set(childKeys.videoScene1, "parent-a:video:1");
  assert.equal(
    ambiguousChildren.get(childKeys.imageScene1) || "parent-b:image:1:hook",
    "parent-a:image:1:hook",
  );
  assert.equal(
    ambiguousChildren.get(childKeys.imageScene2) || "parent-b:image:2:scene",
    "parent-a:image:2:scene",
  );
  assert.equal(
    ambiguousChildren.get(childKeys.videoScene1) || "parent-b:video:1",
    "parent-a:video:1",
  );
  ambiguousChildren.delete(childKeys.imageScene1);
  assert.equal(
    ambiguousChildren.get(childKeys.imageScene1) || "parent-c:image:1:hook",
    "parent-c:image:1:hook",
  );

  for (const functionSource of [
    section(page, "const generateSceneImage", "const updateSceneAudioData"),
    section(page, "const getSceneAudioUrl", "const parseDialogueLines"),
    section(page, "const getSceneDialogueUrl", "const playAudioFromUrl"),
    section(page, "const handleGenerateVideo", "const waitForRunwayVideoAndStore"),
    section(page, "const generateSceneVideoAndWait", "const generateAllSceneVisuals"),
  ]) {
    assert.match(functionSource, /batchChildOperationKey/);
    assert.match(functionSource, /resolveCreatorBatchChildOperationId/);
    assert.match(functionSource, /catch \(transportError\)[\s\S]*retainAmbiguousCreatorOperationId/);
    assert.match(functionSource, /retireAmbiguousCreatorOperationId/);
  }

  const fullBatch = section(page, "const startBatchRender", "const retryFailedScenes");
  const retryBatch = section(page, "const retryFailedScenes", "const handleExportMovie");
  for (const operation of ["image", "voice", "dialogue", "video"]) {
    const marker = new RegExp(
      `getCreatorBatchChildOperationKey\\(\\s*"${operation}",\\s*scene\\.id`,
    );
    assert.match(fullBatch, marker, `first batch missing ${operation} child key`);
    assert.match(retryBatch, marker, `retry batch missing ${operation} child key`);
  }
  assert.doesNotMatch(page, /activeCreatorOperationIdRef/);
  assert.doesNotMatch(page, /creator-(?:image|voice|dialogue-voice|video|export)[^\n]*Date\.now/);
});

check("HTTP ambiguity keeps the same identity until a terminal outcome", () => {
  const ambiguityHelper = section(
    page,
    "const isCreatorOperationHttpOutcomeAmbiguous",
    "const getCreatorBatchChildOperationKey",
  );
  assert.match(ambiguityHelper, /response\.status === 408/);
  assert.match(ambiguityHelper, /response\.status >= 500/);
  assert.match(ambiguityHelper, /response\.clone\(\)\.json\(\)/);
  assert.match(ambiguityHelper, /payload\?\.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS"/);
  assert.doesNotMatch(ambiguityHelper, /IDEMPOTENCY_REQUEST_REPLAYED/);

  const isAmbiguous = ({ status, code }) =>
    status === 408 || status >= 500 || code === "IDEMPOTENCY_REQUEST_IN_PROGRESS";
  const operationKey = "image:project-a:1:hook";
  const retained = new Map([[operationKey, "operation-a"]]);
  const reconcile = (outcome, operationId = "operation-a") => {
    if (isAmbiguous(outcome)) retained.set(operationKey, operationId);
    else if (retained.get(operationKey) === operationId) retained.delete(operationKey);
  };

  reconcile({ status: 409, code: "IDEMPOTENCY_REQUEST_IN_PROGRESS" });
  assert.equal(retained.get(operationKey), "operation-a");
  assert.equal(retained.get(operationKey) || "operation-b", "operation-a");
  reconcile({ status: 503 });
  assert.equal(retained.get(operationKey), "operation-a");
  reconcile({ status: 408 });
  assert.equal(retained.get(operationKey), "operation-a");
  reconcile({ status: 409, code: "IDEMPOTENCY_REQUEST_REPLAYED" });
  assert.equal(retained.has(operationKey), false);

  retained.set(operationKey, "operation-c");
  reconcile({ status: 200 }, "operation-c");
  assert.equal(retained.has(operationKey), false);
  retained.set(operationKey, "operation-d");
  reconcile({ status: 401, code: "AUTHENTICATION_REQUIRED" }, "operation-d");
  assert.equal(retained.has(operationKey), false);

  for (const functionSource of [
    section(page, "const generateSceneImage", "const updateSceneAudioData"),
    section(page, "const getSceneAudioUrl", "const parseDialogueLines"),
    section(page, "const getSceneDialogueUrl", "const playAudioFromUrl"),
    section(page, "const handleGenerateVideo", "const waitForRunwayVideoAndStore"),
    section(page, "const generateSceneVideoAndWait", "const generateAllSceneVisuals"),
    section(page, "const handleExportMovie", "const prepareAllAudio"),
    section(page, "const generatePremiumYoutubeThumbnailImage", "const handleGenerateYoutubeThumbnail"),
  ]) {
    assert.match(functionSource, /isCreatorOperationHttpOutcomeAmbiguous/);
    assert.match(functionSource, /retainAmbiguousCreatorOperationId/);
    assert.match(functionSource, /retireAmbiguousCreatorOperationId/);
  }
});

check("ambiguous retry identities are narrowly keyed and terminally retired", () => {
  assert.doesNotMatch(page, /activeCreatorOperationIdRef/);
  assert.match(
    page,
    /ambiguousCreatorOperationIdsRef = useRef\(new Map<string, string>\(\)\)/,
  );
  assert.match(
    page,
    /ambiguousCreatorOperationIdsRef\.current\.get\(operationKey\) \|\|\s*window\.crypto\.randomUUID\(\)/,
  );
  assert.match(page, /retainAmbiguousCreatorOperationId/);
  assert.match(page, /ambiguousCreatorOperationIdsRef\.current\.set\(operationKey, operationId\)/);
  assert.match(page, /retireAmbiguousCreatorOperationId/);
  assert.match(page, /ambiguousCreatorOperationIdsRef\.current\.delete\(operationKey\)/);
  for (const operationKey of [
    "image:${getProjectKey()}:${scene.id}",
    "voice:${getProjectKey()}:${scene.id}",
    "dialogue:${getProjectKey()}:${scene.id}",
    "video:${getProjectKey()}:${sceneId}",
    "export:${getProjectKey()}",
    "premium-thumbnail:generate:${getProjectKey()}",
    "premium-thumbnail:refine:${getProjectKey()}:${preset}",
  ]) {
    assert.ok(page.includes(operationKey), `missing narrow ambiguity key ${operationKey}`);
  }
  assert.match(page, /catch \(transportError\)[\s\S]{0,240}retainAmbiguousCreatorOperationId/);
  assert.match(page, /retireAmbiguousCreatorOperationId\([\s\S]{0,160}creatorOperationId/);
  assert.match(page, /\? ambiguousCreatorOperationIdsRef\.current\.get\(operationKey\)/);
  assert.match(page, /: window\.crypto\.randomUUID\(\)/);
});

check("failure and reconciliation boundaries remain intact", () => {
  for (const source of [image, voice, dialogue, creatorExport]) assert.match(source, /releaseMeteredOperation/);
  assert.match(video, /markMeteredOperationProviderDispatch/);
  assert.match(video, /video_reconcile/);
  assert.match(video, /if \(providerTaskAccepted\)/);
  assert.ok(creatorExport.indexOf("await assertExportServiceReady") < creatorExport.indexOf("creditReservation = await reserveMeteredOperation"));
});

check("Stage 0.4 product behavior markers remain present", () => {
  assert.match(page, /CreatorOutcomeStart/);
  assert.match(page, /Brand Memory is optional/);
  assert.match(page, /CREATOR_PLATFORM_PRESETS/);
  assert.match(page, /creatorFormat/);
  assert.match(page, /creatorTargetPlatforms/);
  assert.doesNotMatch(page, /setCreatorFormat\([^)]*creatorTargetPlatforms/);
});

console.log(`\nCreatorLab Cost Guard smoke result: ${checks.length}/${checks.length} checks passed.`);
