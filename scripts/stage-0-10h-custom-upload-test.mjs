import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bindCreatorUploadedMedia,
  createCreatorUploadedMediaMetadata,
  CreatorUploadValidationError,
  detachCreatorUploadedMedia,
  validateCreatorUploadedMedia,
} from "../lib/creator/uploadedMedia.ts";
import { createCreatorMediaGovernanceProjection, inferCreatorMediaOrigin } from "../lib/creator/mediaOrigin.ts";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const mp4 = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

assert.equal(validateCreatorUploadedMedia({ bytes: jpeg, mimeType: "image/jpeg", declaredKind: "image" }).extension, "jpg");
assert.equal(validateCreatorUploadedMedia({ bytes: png, mimeType: "image/png", declaredKind: "image" }).extension, "png");
assert.equal(validateCreatorUploadedMedia({ bytes: webp, mimeType: "image/webp", declaredKind: "image" }).extension, "webp");
assert.equal(validateCreatorUploadedMedia({ bytes: mp4, mimeType: "video/mp4", declaredKind: "video" }).extension, "mp4");
for (const invalid of [
  { bytes: jpeg, mimeType: "image/gif", declaredKind: "image" },
  { bytes: jpeg, mimeType: "image/jpeg", declaredKind: "video" },
  { bytes: new Uint8Array(), mimeType: "image/png", declaredKind: "image" },
]) assert.throws(() => validateCreatorUploadedMedia(invalid), CreatorUploadValidationError);
assert.throws(
  () => validateCreatorUploadedMedia({ bytes: new Uint8Array(50 * 1024 * 1024 + 1), mimeType: "video/mp4", declaredKind: "video" }),
  CreatorUploadValidationError,
);

const uploadedAt = "2026-08-31T12:00:00.000Z";
const photo = { assetId: "photo-asset", publicUrl: "https://assets.test/photo.jpg", mediaKind: "image", mimeType: "image/jpeg", originalFilename: "photo.jpg", sizeBytes: 4, durationSeconds: null, uploadedAt };
const video = { assetId: "video-asset", publicUrl: "https://assets.test/video.mp4", mediaKind: "video", mimeType: "video/mp4", originalFilename: "video.mp4", sizeBytes: 12, durationSeconds: 8, uploadedAt };
const scenes = [
  { id: 1, image: "old.jpg", videoUrl: "", videoStatus: "idle", assetHistory: [{ id: "old", kind: "image", url: "old.jpg", createdAt: uploadedAt, source: "generated" }] },
  { id: 2, image: "other.jpg", videoUrl: "", videoStatus: "idle", assetHistory: [] },
];
const photoResult = bindCreatorUploadedMedia({ scenes, sceneId: 1, asset: photo });
assert.equal(photoResult.changed, true);
assert.equal(photoResult.scenes[0].image, photo.publicUrl);
assert.equal(photoResult.scenes[0].renderMode, "image");
assert.equal(photoResult.scenes[0].visualSourceMethod, "upload");
assert.deepEqual(photoResult.scenes[0].assetHistory.map((item) => item.source), ["generated", "uploaded"]);
assert.deepEqual(photoResult.scenes[1], scenes[1]);
assert.equal(scenes[0].image, "old.jpg", "preview/binding helpers never mutate the original scene");

const videoResult = bindCreatorUploadedMedia({ scenes: photoResult.scenes, sceneId: 1, asset: video });
assert.equal(videoResult.scenes[0].videoUrl, video.publicUrl);
assert.equal(videoResult.scenes[0].videoStatus, "done");
assert.equal(videoResult.scenes[0].renderMode, "video");
assert.equal(videoResult.scenes[0].videoDurationSeconds, 8);
assert.equal(videoResult.scenes[0].assetHistory.length, 3);
const detached = detachCreatorUploadedMedia(videoResult.scenes, 1);
assert.equal(detached[0].videoUrl, "");
assert.equal(detached[0].assetHistory.length, 3, "detach retains version history");

const metadata = createCreatorUploadedMediaMetadata({ projectId: "project", originalFilename: "mine.jpg", mediaKind: "image", mimeType: "image/jpeg", uploadedAt, rightsConfirmed: true });
assert.equal(inferCreatorMediaOrigin(metadata), "uploaded");
assert.equal(metadata.creatorRightsConfirmation.confirmed, true);
assert.equal(createCreatorMediaGovernanceProjection({ assetId: "asset", metadata }).originReviewRequired, false);
const unconfirmed = createCreatorUploadedMediaMetadata({ projectId: "project", originalFilename: "mine.jpg", mediaKind: "image", mimeType: "image/jpeg", uploadedAt, rightsConfirmed: false });
assert.equal(createCreatorMediaGovernanceProjection({ assetId: "asset", metadata: unconfirmed }).originReviewRequired, true);

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/create/CreatorUploadPicker.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/creator-upload/route.ts", import.meta.url), "utf8");
const activeSelector = page.slice(page.indexOf('data-creator-visual-source-selector="true"'), page.indexOf("sceneVisualCountdownActive &&", page.indexOf('data-creator-visual-source-selector="true"')));
const bulkSelector = page.slice(page.indexOf("creatorlab-p2c-batch-mode"), page.indexOf("creatorlab-p2c-batch-actions"));
assert.match(activeSelector, /\["upload"/);
assert.doesNotMatch(bulkSelector, /\["upload"/);
assert.match(component, /data-upload-preview="unbound"/);
assert.ok(component.indexOf("URL.createObjectURL") < component.indexOf('fetch("\/api\/creator-upload"'));
assert.ok(component.indexOf('fetch("/api/creator-upload"') < component.indexOf("onUse(result.asset"));
assert.match(component, /I have the right to use this media/);
assert.match(component, /Use in this scene/);
assert.match(component, /Remove from scene/);
assert.match(route, /authenticateRequest\(request\)/);
assert.ok(route.indexOf("getForOwner(projectId, principalId)") < route.indexOf("createSignedPublicUpload"));
assert.match(route, /multipart\/form-data/);
assert.match(component, /uploadToSignedUrl/);
assert.match(route, /finalizeCreatorDirectUpload/);
assert.match(route, /registerStoredAssetOrThrow/);
assert.doesNotMatch(route, /safeRemoteMediaFetch|downloadUrl|OPENAI|CostGuard|reserveMeteredOperation|creator-stock/);
assert.doesNotMatch(component, /creator-stock|creator-video|creator-store-image|countdown|credit/i);

console.log("Stage 0.10H CreatorLab custom upload tests passed.");
