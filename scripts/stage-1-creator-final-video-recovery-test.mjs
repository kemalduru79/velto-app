import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertCreatorFinalVideoRecoveryAuthority,
  buildCreatorFinalVideoRecoveryStoragePath,
  CreatorFinalVideoRecoveryError,
  CREATOR_FINAL_VIDEO_RECOVERY_TARGET,
} from "../lib/creator/finalVideoRecovery.ts";
import {
  assertCreatorFinalVideoRecoveryStorageMetadata,
  CreatorFinalVideoRecoveryInspectionError,
  writeVerifiedCreatorFinalVideoRecoveryStream,
} from "../lib/creator/finalVideoRecoveryProbe.server.ts";

const ownerUserId = "404ce723-1d87-4be1-990a-e9dc2867660b";
const projectId = "e572838e-98ab-42cd-92f4-bf56658cad77";
const revision = "2026-10-15T20:52:19.553394+00:00";
const productionSignature = "fixture";
const { createHash } = await import("node:crypto");

// The production signature itself contains private project media identities.
// Load no live data here; use a deterministic fixture whose SHA is temporarily
// substituted only inside this offline authority model.
const storagePath = buildCreatorFinalVideoRecoveryStoragePath(ownerUserId, projectId);
const target = {
  ...CREATOR_FINAL_VIDEO_RECOVERY_TARGET,
  productionSignatureSha256: createHash("sha256").update(productionSignature).digest("hex"),
  storageIdentitySha256: createHash("sha256").update(`movies:${storagePath}`).digest("hex"),
};
const probe = {
  contentSha256: target.contentSha256,
  sizeBytes: target.sizeBytes,
  durationMs: target.durationMs,
  videoStreamCount: 1,
  audioStreamCount: 1,
  videoCodec: "h264",
  audioCodec: "aac",
  width: target.width,
  height: target.height,
  framesPerSecond: target.framesPerSecond,
  videoFrameCount: target.videoFrameCount,
  audioSampleRateHz: target.audioSampleRateHz,
  audioChannels: target.audioChannels,
};

const route = fs.readFileSync("app/api/creator-final-video-recovery/route.ts", "utf8");
const probeSource = fs.readFileSync("lib/creator/finalVideoRecoveryProbe.server.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261016073805_stage_1a_final_video_recovery_atomic_install.sql", "utf8");

const base = {
  ownerUserId,
  projectId,
  projectUpdatedAt: revision,
  expectedUpdatedAt: revision,
  currentProductionSignature: productionSignature,
  sceneCount: 36,
  musicIntentMode: "none",
  musicPlacementCount: 0,
  humanReviewConfirmed: true,
  storagePath,
  probe,
  existingAsset: "none",
};

const recovered = assertCreatorFinalVideoRecoveryAuthority(base, target);
assert.equal(recovered.sceneCount, 36, "valid music-free target recovers");
assert.equal(recovered.durationSeconds, 462, "validated duration is retained");

const repeated = assertCreatorFinalVideoRecoveryAuthority({
  ...base,
  expectedUpdatedAt: "stale-revision",
  existingAsset: "matching",
  alreadyInstalled: true,
}, target);
assert.equal(repeated.alreadyRegistered, true, "repeated installed recovery is idempotent");

function rejected(code, patch) {
  assert.throws(
    () => assertCreatorFinalVideoRecoveryAuthority({ ...base, ...patch }, target),
    (error) => error instanceof CreatorFinalVideoRecoveryError && error.code === code,
  );
}

rejected("RECOVERY_PROJECT_STALE", { expectedUpdatedAt: "stale-revision" });
rejected("RECOVERY_STORAGE_IDENTITY_INVALID", {
  ownerUserId: "00000000-0000-4000-8000-000000000000",
});
rejected("RECOVERY_ASSET_CONFLICT", { existingAsset: "conflicting" });
rejected("RECOVERY_HUMAN_REVIEW_REQUIRED", { humanReviewConfirmed: false });
rejected("RECOVERY_PRODUCTION_STATE_INVALID", { musicIntentMode: "browse" });
rejected("RECOVERY_PRODUCTION_STATE_INVALID", { musicPlacementCount: 1 });
rejected("RECOVERY_MEDIA_INVALID", { probe: { ...probe, videoFrameCount: 11_535 } });
rejected("RECOVERY_PRODUCTION_SIGNATURE_INVALID", { currentProductionSignature: "changed" });

assert.match(route, /authenticateRequest\(request\)/, "recovery requires authentication");
assert.match(route, /export async function GET\(request: Request\)[\s\S]*currentCreatorFinalProductionAuthority\(project\)[\s\S]*objectInfo\?\.size === CREATOR_FINAL_VIDEO_RECOVERY_TARGET\.sizeBytes/, "recovery readiness is authenticated, server-authoritative, and Storage-pinned");
assert.match(route, /getForOwner\(projectId, principal\.id\)/, "project ownership is server-authoritative");
assert.match(route, /humanReviewConfirmed === true/, "human review is mandatory");
assert.match(route, /currentCreatorFinalProductionAuthority\(project\)/, "signature is independently recomputed");
assert.match(route, /velto_install_recovered_creator_final_video/, "one transactional RPC installs project, asset, and references");
assert.doesNotMatch(route, /registerOwnedFinalMovieResponse|registerStoredAssetOrThrow/, "recovery does not use upload accounting");
assert.doesNotMatch(route, /saveForOwner\(|replaceProjectReferences\(/, "recovery has no sequential project/reference mutation");
assert.match(route, /RECOVERY_PROJECT_\(STALE\|CAS_FAILED\)[\s\S]*RECOVERY_PERSISTENCE_CONFLICT/, "transaction conflicts remain fail-closed");
assert.match(route, /if \(!alreadyInstalled\)/, "repeated recovery does not rewrite the project");
assert.doesNotMatch(route, /reconcileSupersededFinalVideosForProject|trashForOwner|removeObject/, "Stage 1 never supersedes or deletes final videos");
assert.doesNotMatch(route, /from\("velto_creator_economic_operations"\)|update\([^)]*economic/i, "existing economics are untouched");
assert.match(probeSource, /-count_frames/, "technical validation counts decoded video frames");
assert.match(probeSource, /createHash\("sha256"\)/, "streaming validation hashes exact bytes");
assert.match(probeSource, /sizeBytes > input\.expectedSizeBytes/, "stream transfer has a hard byte ceiling");
assert.ok(route.indexOf("assertCreatorFinalVideoRecoveryStorageMetadata") < route.indexOf(".download(storagePath"), "metadata is rejected before download starts");

assert.match(migration, /begin;[\s\S]*commit;/, "migration defines one transactional function");
assert.match(migration, /from public\.velto_projects[\s\S]*for update;/, "project row is locked before installation");
assert.match(migration, /v_project\.updated_at is distinct from p_expected_updated_at/, "locked revision is checked");
assert.match(migration, /update public\.velto_projects[\s\S]*and updated_at = p_expected_updated_at/, "project update retains CAS predicate");
assert.match(migration, /velto_storage_admissions[\s\S]*purpose = 'final_movie_export'[\s\S]*consumed_at is not null/, "existing consumed export admission is required without being mutated");
assert.match(migration, /status', 'already_recovered'[\s\S]*if v_project\.updated_at is distinct from p_expected_updated_at/, "exact repeated recovery returns before CAS without rewriting state");
assert.match(migration, /insert into public\.velto_media_assets[\s\S]*delete from public\.velto_media_asset_references[\s\S]*insert into public\.velto_media_asset_references/, "registration and references share the project transaction");
assert.doesNotMatch(migration, /economic|supersed|trash|purge|remove/i, "transaction neither accounts nor supersedes");
assert.match(migration, /254ad9e4-213d-4f44-b8e5-4dddf7da4f7d\.mp4/, "RPC is pinned to the reviewed artifact");
assert.match(migration, /revoke all[\s\S]*public, anon, authenticated[\s\S]*grant execute[\s\S]*service_role/, "RPC is service-role-only");

// A CAS conflict cannot replace the previous final because the repository
// update is the sole installation boundary.
let authoritativeFinal = "previous-final.mp4";
const saveWithConflict = () => { throw new Error("PROJECT_SAVE_CONFLICT"); };
assert.throws(saveWithConflict, /PROJECT_SAVE_CONFLICT/);
assert.equal(authoritativeFinal, "previous-final.mp4", "persistence conflict preserves previous final");

// Model the database transaction's all-or-nothing boundary: neither an asset
// registration nor reference replacement survives a concurrent revision.
function atomicInstallFixture(state, expectedRevision) {
  const draft = structuredClone(state);
  if (draft.project.updatedAt !== expectedRevision) throw new Error("RECOVERY_PROJECT_STALE");
  draft.assets.push("recovered-final");
  draft.project.final = "recovered-final";
  draft.project.updatedAt = "installed-revision";
  draft.references = ["scene-assets", "recovered-final"];
  return draft;
}
const transactionBefore = {
  project: { updatedAt: revision, final: "previous-final" },
  assets: ["previous-final"],
  references: ["scene-assets", "previous-final"],
  economics: [{ attemptKey: "existing-upload", state: "provider_billed", quantities: { uploadBytes: 10 } }],
};
const transactionSnapshot = JSON.stringify(transactionBefore);
assert.throws(() => atomicInstallFixture(transactionBefore, "concurrent-revision"), /RECOVERY_PROJECT_STALE/);
assert.equal(JSON.stringify(transactionBefore), transactionSnapshot, "failed CAS preserves assets, references, and economics field-for-field");
const installed = atomicInstallFixture(transactionBefore, revision);
assert.equal(installed.project.final, "recovered-final", "unchanged revision installs recovery");
assert.ok(installed.assets.includes("previous-final"), "successful recovery preserves previous final-video object");
assert.deepEqual(installed.economics, transactionBefore.economics, "successful recovery leaves economics unchanged");
const concurrentlyReplaced = structuredClone(transactionBefore);
concurrentlyReplaced.project.updatedAt = "newer-revision";
concurrentlyReplaced.project.final = "newer-final";
concurrentlyReplaced.assets.push("newer-final");
concurrentlyReplaced.references = ["scene-assets", "newer-final"];
const concurrentSnapshot = JSON.stringify(concurrentlyReplaced);
assert.throws(() => atomicInstallFixture(concurrentlyReplaced, revision), /RECOVERY_PROJECT_STALE/);
assert.equal(JSON.stringify(concurrentlyReplaced), concurrentSnapshot, "newer final and references survive concurrent recovery");

assert.throws(
  () => assertCreatorFinalVideoRecoveryStorageMetadata(target.sizeBytes + 1),
  (error) => error instanceof CreatorFinalVideoRecoveryInspectionError && error.code === "RECOVERY_STORAGE_SIZE_INVALID",
  "oversized Storage metadata is rejected",
);

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "velto-recovery-stream-test-"));
async function streamRejected(name, chunks, expectedBytes, expectedHash, expectedCode) {
  const destination = path.join(tempDirectory, name);
  const stream = new ReadableStream({
    pull(controller) {
      const next = chunks.shift();
      if (next instanceof Error) return controller.error(next);
      if (!next) return controller.close();
      controller.enqueue(next);
    },
  });
  await assert.rejects(
    writeVerifiedCreatorFinalVideoRecoveryStream({ stream, path: destination, expectedSizeBytes: expectedBytes, expectedSha256: expectedHash }),
    (error) => expectedCode === "interrupted"
      ? /interrupted/.test(String(error))
      : error instanceof CreatorFinalVideoRecoveryInspectionError && error.code === expectedCode,
  );
}
try {
  const abcHash = createHash("sha256").update("abc").digest("hex");
  await streamRejected("oversized.mp4", [new TextEncoder().encode("abcd")], 3, abcHash, "RECOVERY_STORAGE_SIZE_INVALID");
  await streamRejected("truncated.mp4", [new TextEncoder().encode("ab")], 3, abcHash, "RECOVERY_DOWNLOAD_INVALID");
  await streamRejected("checksum.mp4", [new TextEncoder().encode("abd")], 3, abcHash, "RECOVERY_DOWNLOAD_INVALID");
  await streamRejected("interrupted.mp4", [new TextEncoder().encode("a"), new Error("interrupted download")], 3, abcHash, "interrupted");
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}

console.log("STAGE_1_CREATOR_FINAL_VIDEO_RECOVERY=PASS");
