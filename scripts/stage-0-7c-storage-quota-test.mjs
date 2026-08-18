import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadTs(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const read = (file) => fs.readFileSync(file, "utf8");
const quota = await loadTs("lib/persistence/media/quota.ts");
const service = read("lib/persistence/media/storageQuota.server.ts");
const repository = read("lib/persistence/media/supabaseMediaAssetRepository.ts");
const api = read("app/api/storage-usage/route.ts");
const image = read("app/api/image/route.ts");
const creatorVideo = read("app/api/creator-video/route.ts");
const legacyVideo = read("app/api/video/route.ts");
const character = read("app/api/character-image/route.ts");
const thumbnail = read("app/api/creator-thumbnail/route.ts");
const page = read("app/create/page.tsx");
const ui = read("components/create/CreatorProjectAssets.tsx");
const envExample = read(".env.container.example");

for (const [used, expected] of [[0, "NORMAL"], [7999, "NORMAL"], [8000, "APPROACHING"], [9499, "APPROACHING"], [9500, "CRITICAL"], [9999, "CRITICAL"], [10000, "FULL"], [12000, "FULL"]]) {
  assert.equal(quota.getStorageQuota(used, 10000).state, expected, `${used / 100}% boundary`);
}
assert.equal(quota.getStorageQuota(10000, 10000).canCreateStorageIncreasingMedia, false);
assert.throws(() => quota.getStorageQuota(0, 0));

assert.deepEqual(
  (({ configured, limitBytes, enforcementEnabled }) => ({ configured, limitBytes, enforcementEnabled }))(quota.resolveStorageQuotaConfiguration({})),
  { configured: false, limitBytes: null, enforcementEnabled: false },
);
assert.equal(quota.resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: "invalid" }).configured, false);
assert.equal(quota.resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: "0" }).configured, false);
assert.equal(quota.resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: String(Number.MAX_SAFE_INTEGER + 1) }).configured, false);
assert.deepEqual(
  (({ configured, limitBytes, enforcementEnabled }) => ({ configured, limitBytes, enforcementEnabled }))(quota.resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: "1000", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "false" })),
  { configured: true, limitBytes: 1000, enforcementEnabled: false },
);
assert.equal(quota.resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: "1000", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "TRUE" }).enforcementEnabled, false);
assert.equal(quota.resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: "1000", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" }).enforcementEnabled, true);
assert.equal(quota.getStorageGenerationDecision(false, true, null), "UNCONFIGURED");
assert.equal(quota.getStorageGenerationDecision(true, true, "APPROACHING"), "ALLOWED");
assert.equal(quota.getStorageGenerationDecision(true, true, "CRITICAL"), "ALLOWED");
assert.equal(quota.getStorageGenerationDecision(true, false, "FULL"), "FULL_BUT_NOT_ENFORCED");
assert.equal(quota.getStorageGenerationDecision(true, true, "FULL"), "BLOCKED_FULL");

const physical = [{ state: "active", bytes: 10 }, { state: "trashed", bytes: 20 }, { state: "purged", bytes: 40 }];
assert.equal(physical.filter((asset) => asset.state !== "purged").reduce((sum, asset) => sum + asset.bytes, 0), 30);
assert.match(repository, /\.neq\("lifecycle_state", "purged"\)/);
assert.match(repository, /usage\.activeBytes \+= bytes/);
assert.match(repository, /usage\.trashedBytes \+= bytes/);

assert.match(service, /import "server-only"/);
assert.match(service, /getUsageForOwner\(ownerUserId\)/);
assert.match(service, /evaluateStorageQuota\(usage\.totalPhysicalBytes/);
assert.match(service, /"UNCONFIGURED"/);
assert.match(service, /"BLOCKED_FULL"/);
assert.match(service, /const \{ quota, decision, effectiveLimitBytes \} = evaluated/);
assert.match(service, /code: "STORAGE_QUOTA_FULL"/);
assert.match(service, /status: 409/);
assert.doesNotMatch(service + envExample, /NEXT_PUBLIC_.*STORAGE/);
assert.match(envExample, /VELTO_STORAGE_LIMIT_BYTES=\s*$/m);
assert.match(envExample, /VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED=false/);

assert.match(api, /authenticateRequest\(request\)/);
assert.match(api, /getOwnerStorageQuotaStatus\(principal\.id\)/);
assert.match(api, /Cache-Control": "no-store"/);
assert.doesNotMatch(api, /ownerUserId.*(?:request|body|searchParams)/);

function assertGuardBefore(source, route, markers) {
  const guard = source.indexOf("const storageAllowance = await checkStorageGenerationAllowance");
  assert.ok(guard >= 0, `${route} has storage guard`);
  for (const marker of markers) {
    const index = source.indexOf(marker, guard + 1);
    assert.ok(index > guard, `${route} guard precedes ${marker}`);
  }
}
assertGuardBefore(image, "image", ["reserveMeteredOperation(req", "loadReferenceImageFiles(", "imageProvider.generate("]);
assertGuardBefore(creatorVideo, "creator-video", ["selectCreatorVideo(mediaRoute)", "reserveMeteredOperation(req", "selection.provider.createTask(", "services.jobQueue.enqueue("]);
assertGuardBefore(legacyVideo, "video POST", ["selectPrimaryVideo()", "selection.provider.createTask("]);
assertGuardBefore(character, "character-image", ["reserveMeteredOperation(req", "getOpenAIClient()", "client.images.generate("]);
assertGuardBefore(thumbnail, "creator-thumbnail", ["getOpenAIClient()", "client.chat.completions.create(", "client.images.generate("]);
assert.match(legacyVideo, /POST[\s\S]*authenticateRequest\(req\)/);
assert.match(character, /authenticateRequest\(req\)/);
assert.match(page.slice(page.indexOf('fetch("/api/character-image"') - 500, page.indexOf('fetch("/api/character-image"') + 500), /Authorization: `Bearer \$\{accessToken\}`/);

for (const route of ["app/api/creator-store-image/route.ts", "app/api/creator-store-video/route.ts", "app/api/store-image/route.ts", "app/api/store-video/route.ts", "app/api/jobs/route.ts", "app/api/creator-production/route.ts", "app/api/store-audio/route.ts", "app/api/store-dialogue-audio/route.ts", "app/api/media-assets/route.ts", "app/api/media-assets/[assetId]/trash/route.ts", "app/api/media-assets/[assetId]/restore/route.ts"]) {
  assert.doesNotMatch(read(route), /checkStorageGenerationAllowance/, `${route} deliberately remains ungated`);
}
assert.match(read("lib/security/jobProjectOwnershipBoundary.ts"), /jobType !== "runtime_probe"/);
assert.match(read("components/create/CreatorProjectAssets.tsx"), /onUseImage/);
assert.match(ui, /data-storage-quota-state/);
assert.match(ui, /Storage is full\. New image and video generation is temporarily unavailable/);
assert.match(ui, /Manage storage/);
assert.match(ui, /Items in Trash still use storage/);
assert.doesNotMatch(ui + service, /Buy storage|checkout|Stripe|subscription|payment/i);
assert.doesNotMatch(service + image + creatorVideo + legacyVideo + character + thumbnail, /storage\.from\([^)]*\)\.(?:remove|delete)|lifecycle_state\s*[:=]\s*["']purged/i);

console.log("stage-0.7c storage quota: all checks passed");
