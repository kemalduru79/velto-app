import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateStorageQuota, resolveStorageQuotaConfiguration, StorageQuotaConfigurationValidationError } from "../lib/persistence/media/quota.ts";

const read = (file) => fs.readFileSync(file, "utf8");
const expectConfigError = (used, additional, env) => assert.throws(
  () => evaluateStorageQuota(used, additional, env),
  StorageQuotaConfigurationValidationError,
);

assert.deepEqual(evaluateStorageQuota(10, 0, { VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "false" }).decision, "UNCONFIGURED");
expectConfigError(10, 0, { VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" });
expectConfigError(10, 0, { VELTO_STORAGE_LIMIT_BYTES: "bad", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" });
expectConfigError(10, 0, { VELTO_STORAGE_LIMIT_BYTES: "0", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" });
assert.equal(evaluateStorageQuota(10, 0, { VELTO_STORAGE_LIMIT_BYTES: "100", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" }).decision, "ALLOWED");
assert.equal(evaluateStorageQuota(100, 0, { VELTO_STORAGE_LIMIT_BYTES: "100", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" }).decision, "BLOCKED_FULL");
assert.equal(evaluateStorageQuota(100, 0, { VELTO_STORAGE_LIMIT_BYTES: "100", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "false" }).decision, "FULL_BUT_NOT_ENFORCED");
assert.equal(evaluateStorageQuota(80, 20, { VELTO_STORAGE_LIMIT_BYTES: "100", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" }).effectiveLimitBytes, 120);
assert.equal(evaluateStorageQuota(1, 0, { VELTO_STORAGE_LIMIT_BYTES: String(Number.MAX_SAFE_INTEGER), VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" }).effectiveLimitBytes, Number.MAX_SAFE_INTEGER);
expectConfigError(1, 1, { VELTO_STORAGE_LIMIT_BYTES: String(Number.MAX_SAFE_INTEGER), VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" });
expectConfigError(1, 1, { VELTO_STORAGE_LIMIT_BYTES: String(Number.MAX_SAFE_INTEGER), VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "false" });
assert.equal(resolveStorageQuotaConfiguration({}).admissionTtlMinutes, 60);
assert.equal(resolveStorageQuotaConfiguration({ VELTO_STORAGE_ADMISSION_TTL_MINUTES: "15" }).admissionTtlMinutes, 15);
assert.equal(resolveStorageQuotaConfiguration({ VELTO_STORAGE_LIMIT_BYTES: "100", VELTO_STORAGE_ADMISSION_TTL_MINUTES: "bad", VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED: "true" }).configurationIssue, "INVALID_ADMISSION_TTL");

const quotaServer = read("lib/persistence/media/storageQuota.server.ts");
const admission = read("lib/persistence/media/storageAdmission.server.ts");
assert.match(quotaServer, /STORAGE_QUOTA_CONFIGURATION_ERROR/);
assert.match(quotaServer, /STORAGE_QUOTA_INFRASTRUCTURE_ERROR/);
assert.match(quotaServer, /status: 503[\s\S]*Cache-Control.*no-store/);
assert.match(admission, /config\.enforcementEnabled && !config\.admissionTtlValid[\s\S]*STORAGE_QUOTA_CONFIGURATION_ERROR/);

const routeFiles = [
  "app/api/image/route.ts",
  "app/api/character-image/route.ts",
  "app/api/creator-thumbnail/route.ts",
  "app/api/video/route.ts",
  "app/api/creator-video/route.ts",
  "app/api/creator-export/route.ts",
  "app/api/export-movie/route.ts",
];
for (const file of routeFiles) {
  const route = read(file);
  assert.match(route, /checkStorageGenerationAllowance/);
  assert.match(route, /StorageQuotaOperationalError/);
  assert.match(route, /storageQuotaOperationalErrorResponse/);
  const quota = route.indexOf("checkStorageGenerationAllowance(");
  for (const marker of ["issueStorageAdmissionForOwner({", "reserveMeteredOperation(", ".generate({", ".createTask({"]) {
    const index = route.indexOf(marker, quota);
    if (index >= 0) assert.ok(quota < index, `${file}: quota must precede ${marker}`);
  }
}

const creatorExport = read("app/api/creator-export/route.ts");
const storyExport = read("app/api/export-movie/route.ts");
const exportService = read("export-service/src/server.js");
assert.match(creatorExport + storyExport, /purpose: "final_movie_export"/);
assert.ok(creatorExport.indexOf("checkStorageGenerationAllowance(") < creatorExport.indexOf("reserveMeteredOperation(request"));
assert.match(exportService, /beginFinalMovieStorageAdmission[\s\S]*velto_begin_storage_admission_consumption/);
assert.match(exportService, /durableStorageStarted = true[\s\S]*completeFinalMovieStorageAdmission/);
assert.match(exportService, /!durableStorageStarted[\s\S]*abortFinalMovieStorageAdmission/);
assert.doesNotMatch(exportService.slice(exportService.indexOf("durableStorageStarted = true")), /checkStorageGenerationAllowance/);

const creatorStoreVideo = read("app/api/creator-store-video/route.ts");
assert.match(creatorStoreVideo, /enforceCreatorApiBoundary/);
assert.match(creatorStoreVideo, /jobQueue\.getForUser/);
assert.match(creatorStoreVideo, /job\.status !== "succeeded"/);
assert.match(creatorStoreVideo, /queue-\$\{input\.queueJobId\}-\$\{contentIdentity\}/);
assert.match(creatorStoreVideo, /upsert: false/);
assert.ok(creatorStoreVideo.indexOf("validatePersistedVideoJobBinding") < creatorStoreVideo.indexOf("downloadOutput"));

const thumbnail = read("app/api/creator-thumbnail/route.ts");
assert.match(thumbnail, /data:image\/png;base64/);
assert.doesNotMatch(thumbnail, /uploadPublic|storage\.from|registerStoredAssetOrThrow/);

const durableWriters = {
  "app/api/creator-store-image/route.ts": "A",
  "app/api/store-image/route.ts": "A",
  "app/api/store-video/route.ts": "A",
  "app/api/creator-store-video/route.ts": "C",
  "app/api/store-audio/route.ts": "D",
  "app/api/store-dialogue-audio/route.ts": "D",
  "lib/creator/musicEntitlement.ts": "D",
  "export-service/src/server.js": "A",
};
for (const [file, category] of Object.entries(durableWriters)) {
  assert.match(read(file), /uploadPublic|uploadPrivate|\.upload\(/, `${file} writer missing`);
  assert.notEqual(category, "F");
}
assert.equal(Object.values(durableWriters).filter((category) => category === "F").length, 0);

const readiness = read("scripts/stage-0-7d-3-storage-activation-readiness.mjs");
assert.doesNotMatch(readiness, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.upload\(|\.remove\(|\.rpc\(/);
assert.match(readiness, /STAGE_0_7D_3_STORAGE_ACTIVATION_READINESS=\$\{result\}/);
assert.doesNotMatch(readiness, /console\.(?:log|error)\([^\n]*(?:serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY)/);
const fullSmoke = read("scripts/stage-0-7d-3-full-gate-smoke.mjs");
assert.doesNotMatch(fullSmoke, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.upload\(|\.remove\(|reserveMeteredOperation|generate\(|createTask\(/);
assert.match(fullSmoke, /STAGE_0_7D_3_FULL_GATE_SMOKE=PASS/);

const examples = read(".env.container.example");
assert.match(examples, /VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED=false/);
assert.match(examples, /VELTO_PERMANENT_MEDIA_DELETE_ENABLED=false/);
const changed = [quotaServer, admission, readiness, fullSmoke].join("\n");
assert.doesNotMatch(changed, /stripe|paddle|lemon squeeze|iyzico|checkout session|billing webhook/i);

console.log("stage-0.7d-3 storage activation readiness: all checks passed");
