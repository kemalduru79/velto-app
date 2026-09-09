import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CREATOR_AUDIO_ASSET_MAX_BYTES,
  createCreatorAudioFinalizeResponse,
  createCreatorAudioUploadIntent,
  descriptorFromRegisteredAudio,
  finalizeCreatorAudioUpload,
  toCreatorAudioTimelineAssetReference,
  validateCreatorAudioProbe,
  validateCreatorAudioSignature,
  verifyCreatorAudioUploadIntent,
} from "../lib/creator/audioAssets.ts";
import {
  authorizeCreatorAudioAssetRequest,
  resolveOwnedCreatorAudioAsset,
} from "../lib/creator/audioAssetResolver.server.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const project = "22222222-2222-4222-8222-222222222222";
const secret = "test-secret";
const now = Date.parse("2026-09-09T00:00:00.000Z");
const mp3 = Uint8Array.from([0x49, 0x44, 0x33, 4, 0, 0]);
const wav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
const m4a = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
validateCreatorAudioSignature(mp3, "audio/mpeg");
validateCreatorAudioSignature(wav, "audio/wav");
validateCreatorAudioSignature(m4a, "audio/mp4");
assert.throws(() => validateCreatorAudioSignature(mp3, "audio/wav"), /contents/);
assert.throws(() => validateCreatorAudioProbe({ formatNames: ["mp3"], durationMs: 10, codec: "mp3", sampleRateHz: 44100, channels: 2, audioStreamCount: 0, videoStreamCount: 0 }, "audio/mpeg"), /unsupported/);
assert.throws(() => validateCreatorAudioProbe({ formatNames: ["mp3"], durationMs: 10, codec: "aac", sampleRateHz: 44100, channels: 2, audioStreamCount: 1, videoStreamCount: 0 }, "audio/mpeg"), /unsupported/);

const makeIntent = (overrides = {}) => createCreatorAudioUploadIntent({ ownerUserId: owner, projectId: project, privateBucket: "private-media", originalFilename: "track.mp3", mediaKind: "music", mimeType: "audio/mpeg", sizeBytes: mp3.byteLength, ...overrides }, secret, { now, nonce: "fixed" });
const intent = makeIntent();
assert.equal(intent.payload.path, `creator/${owner}/audio/${project}/fixed.mp3`);
assert.equal(verifyCreatorAudioUploadIntent(intent.intentToken, { ownerUserId: owner, secret, now }).projectId, project);
assert.throws(() => verifyCreatorAudioUploadIntent(intent.intentToken, { ownerUserId: "other", secret, now }), /invalid/);
assert.throws(() => verifyCreatorAudioUploadIntent(intent.intentToken, { ownerUserId: owner, secret, now: now + 16 * 60_000 }), /expired/);
for (const sizeBytes of [0, -1, CREATOR_AUDIO_ASSET_MAX_BYTES + 1, "6", NaN, Infinity]) assert.throws(() => makeIntent({ sizeBytes }), /invalid/);
for (const bad of [{ mimeType: "audio/ogg" }, { mediaKind: "video" }, { originalFilename: "" }]) assert.throws(() => makeIntent(bad), /invalid/);

const probe = { formatNames: ["mp3"], durationMs: 1234, codec: "mp3", sampleRateHz: 44100, channels: 2, audioStreamCount: 1, videoStreamCount: 0 };
const registered = [];
const removed = [];
const cleanupReports = [];
const deps = (changes = {}) => ({
  stat: async () => ({ exists: true, sizeBytes: mp3.byteLength, contentType: "audio/mpeg" }),
  download: async () => mp3,
  remove: async (location) => { removed.push(location); },
  reportCleanupFailure: (context) => { cleanupReports.push(context); },
  probe: async () => probe,
  findExisting: async () => null,
  register: async (input) => {
    registered.push(input);
    return { id: "asset-1", ownerUserId: owner, bucket: input.bucket, storagePath: input.path, publicUrl: null, mediaKind: "music", mimeType: input.mimeType, sizeBytes: input.sizeBytes, lifecycleState: "active", metadata: input.metadata };
  },
  ...changes,
});
const finalized = await finalizeCreatorAudioUpload({ intentToken: intent.intentToken, ownerUserId: owner, secret, now }, deps());
assert.equal(finalized.asset.assetId, "asset-1");
assert.equal(finalized.asset.origin, "uploaded");
assert.equal(finalized.asset.rights.status, "unknown", "upload never auto-verifies rights");
assert.equal(finalized.asset.durationMs, 1234);
assert.deepEqual(toCreatorAudioTimelineAssetReference(finalized.asset), {
  assetId: "asset-1", origin: "uploaded", mediaKind: "music", durationMs: 1234, rights: { status: "unknown" },
});
assert.match(finalized.asset.checksumSha256, /^[a-f0-9]{64}$/);
assert.equal(registered[0].metadata.projectId, project);
assert.equal(removed.length, 0);
assert.deepEqual(Object.keys(toCreatorAudioTimelineAssetReference(finalized.asset)).sort(), ["assetId", "durationMs", "mediaKind", "origin", "rights"]);
const clientResponse = createCreatorAudioFinalizeResponse(finalized);
assert.deepEqual(clientResponse, {
  ok: true,
  asset: { assetId: "asset-1", origin: "uploaded", mediaKind: "music", durationMs: 1234, rights: { status: "unknown" } },
  reused: false,
});
for (const backstage of ["bucket", "storagePath", "checksumSha256", "ownerUserId", "projectId", "codec", "sampleRateHz", "channels", "mimeType", "sizeBytes"]) {
  assert.equal(backstage in clientResponse.asset, false, `client response must omit ${backstage}`);
}

const existing = { id: "asset-1", ownerUserId: owner, bucket: intent.payload.bucket, storagePath: intent.payload.path, publicUrl: null, mediaKind: "music", mimeType: "audio/mpeg", sizeBytes: mp3.byteLength, lifecycleState: "active", metadata: registered[0].metadata };
let statCalls = 0;
const replay = await finalizeCreatorAudioUpload({ intentToken: intent.intentToken, ownerUserId: owner, secret, now }, deps({ findExisting: async () => existing, stat: async () => { statCalls++; throw new Error(); } }));
assert.equal(replay.reused, true);
assert.equal(statCalls, 0, "idempotent finalize performs no repeat object work");
for (const conflict of [
  { mimeType: "audio/wav" },
  { sizeBytes: mp3.byteLength + 1 },
  { ownerUserId: "other" },
  { metadata: { ...existing.metadata, projectId: "other-project" } },
  { mediaKind: "other" },
]) await assert.rejects(
  () => finalizeCreatorAudioUpload({ intentToken: intent.intentToken, ownerUserId: owner, secret, now }, deps({ findExisting: async () => ({ ...existing, ...conflict }) })),
  /conflicts/,
);
assert.throws(() => descriptorFromRegisteredAudio(existing, owner, "wrong-project"), /not found/);
assert.throws(() => descriptorFromRegisteredAudio({ ...existing, ownerUserId: "other" }, owner, project), /not found/);
assert.throws(() => descriptorFromRegisteredAudio({ ...existing, publicUrl: "https://untrusted.test" }, owner, project), /not found/);

for (const failure of [
  { stat: async () => ({ exists: false, sizeBytes: null, contentType: null }) },
  { stat: async () => ({ exists: true, sizeBytes: 99, contentType: "audio/mpeg" }) },
  { probe: async () => ({ ...probe, audioStreamCount: 0 }) },
  { probe: async () => ({ ...probe, codec: "aac" }) },
  { probe: async () => { throw new Error("malformed"); } },
  { register: async () => { throw new Error("registry unavailable"); } },
]) await assert.rejects(() => finalizeCreatorAudioUpload({ intentToken: intent.intentToken, ownerUserId: owner, secret, now }, deps(failure)));
assert.ok(removed.length >= 5, "post-upload verification and registration failures attempt object cleanup");

let originalFailure;
await assert.rejects(
  () => finalizeCreatorAudioUpload({ intentToken: intent.intentToken, ownerUserId: owner, secret, now }, deps({
    probe: async () => { throw new Error("malformed"); },
    remove: async () => { throw new TypeError("private detail must not escape"); },
    reportCleanupFailure: (context) => { cleanupReports.push(context); },
  })),
  (error) => { originalFailure = error; return error.code === "verification_failed" && !error.message.includes("private detail"); },
);
assert.equal(originalFailure.code, "verification_failed");
assert.deepEqual(cleanupReports.at(-1), { operation: "creator_audio_finalize_cleanup", projectId: project, errorClass: "TypeError" });

const ownedProjectRepository = { getForOwner: async (projectId, userId) => projectId === project && userId === owner ? { flow_type: "creator_lab" } : null };
await assert.rejects(() => authorizeCreatorAudioAssetRequest({ action: "initiate", projectId: project, secret }, {
  authenticate: async () => { throw new Error("unauthenticated"); }, projectRepository: ownedProjectRepository,
}), /unauthenticated/);
await assert.rejects(() => authorizeCreatorAudioAssetRequest({ action: "initiate", projectId: project, secret }, {
  authenticate: async () => ({ id: "other" }), projectRepository: ownedProjectRepository,
}), /not found/);
const authorized = await authorizeCreatorAudioAssetRequest({ action: "initiate", projectId: project, secret, bucket: "attacker", storagePath: "attacker" }, {
  authenticate: async () => ({ id: owner }), projectRepository: ownedProjectRepository,
});
assert.deepEqual(authorized, { ownerUserId: owner, projectId: project }, "client storage identity cannot enter authority result");
await assert.rejects(() => authorizeCreatorAudioAssetRequest({ action: "finalize", projectId: "33333333-3333-4333-8333-333333333333", intentToken: intent.intentToken, secret, now }, {
  authenticate: async () => ({ id: owner }), projectRepository: ownedProjectRepository,
}), /invalid/);

const resolverRepositories = {
  projectRepository: ownedProjectRepository,
  mediaAssetRepository: { getForOwner: async (assetId, userId) => assetId === existing.id && userId === owner ? existing : null },
};
await assert.rejects(() => resolveOwnedCreatorAudioAsset({ ownerUserId: "other", projectId: project, assetId: existing.id }, resolverRepositories), /not found/);
await assert.rejects(() => resolveOwnedCreatorAudioAsset({ ownerUserId: owner, projectId: "33333333-3333-4333-8333-333333333333", assetId: existing.id }, resolverRepositories), /not found/);
const resolved = await resolveOwnedCreatorAudioAsset({ ownerUserId: owner, projectId: project, assetId: existing.id }, resolverRepositories);
assert.equal(resolved.storagePath, intent.payload.path, "trusted resolver retains backstage descriptor");

const route = readFileSync(new URL("../app/api/creator-audio-assets/route.ts", import.meta.url), "utf8");
const resolver = readFileSync(new URL("../lib/creator/audioAssetResolver.server.ts", import.meta.url), "utf8");
assert.ok(route.indexOf("authenticateRequest(request)") < route.indexOf("createSignedPublicUpload"));
assert.match(route, /publicUrl: null/);
assert.match(route, /createCreatorAudioFinalizeResponse\(result\)/);
assert.doesNotMatch(route, /request\.formData|arrayBuffer\(|getPublicUrl|safeRemoteMediaFetch|Epidemic|provider|credit|Railway|Azure/i);
assert.match(resolver, /projectRepository\.getForOwner\(input\.projectId, input\.ownerUserId\)/);
assert.match(resolver, /mediaAssetRepository\.getForOwner\(input\.assetId, input\.ownerUserId\)/);
console.log("Stage 0.13C-C secure audio asset foundation: PASS");
