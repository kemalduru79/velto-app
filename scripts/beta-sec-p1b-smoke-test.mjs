import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const imageRoute = read("app/api/creator-store-image/route.ts");
const videoRoute = read("app/api/creator-store-video/route.ts");
const helper = read("lib/security/safeRemoteMediaFetch.ts");
const boundary = read("lib/security/creatorApiBoundary.ts");
const policy = read("lib/security/creatorMediaStoragePolicy.ts");
const generatedImageRoute = read("app/api/image/route.ts");
const createPage = read("app/create/page.tsx");

for (const [route, id, bucket, limit] of [
  [imageRoute, "creator-store-image", 'bucket: "images"', "MAX_CREATOR_IMAGE_BYTES"],
  [videoRoute, "creator-store-video", 'bucket: "videos"', "MAX_CREATOR_VIDEO_BYTES"],
]) {
  const handler = route.indexOf("export async function POST");
  const auth = route.indexOf("await enforceCreatorApiBoundary");
  assert.ok(auth >= 0 && auth < route.indexOf("safeRemoteMediaFetch", handler), `${id}: auth must precede fetch`);
  assert.ok(auth < route.indexOf("uploadPublic", handler), `${id}: auth must precede upload`);
  assert.ok(route.includes(`"${id}"`));
  assert.ok(route.includes(bucket));
  assert.ok(route.includes(limit));
  assert.ok(route.includes("boundary.context.user.id"));
  assert.ok(route.includes("randomUUID()"));
  assert.ok(route.includes("upsert: false"));
  assert.ok(!route.includes("body.bucket") && !route.includes("body.path"));
}

for (const marker of [
  'url.protocol !== "https:"', "url.username || url.password", 'hostname === "localhost"',
  "unsafeIpv4", "0x7f000000", "0x0a000000", "0xac100000", "0xc0a80000",
  "0xa9fe0000", "0x64400000", "unsafeIpv6", "groups[5] === 0xffff",
  "lookup(hostname, { all: true, verbatim: true })", "records.some", "lookup:", "servername:",
  "redirects >= 3", "safeRemoteMediaFetch({ rawUrl: next.toString()", 'response.headers["content-length"]',
  "total > maxBytes", "request.setTimeout", "request.destroy", 'method: "GET"',
  '"image/jpeg"', '"image/png"', '"image/webp"', '"video/mp4"', '"video/webm"',
  "detectMediaType", "Declared media type does not match", "Buffer.concat(chunks, total)",
  "deadline = Date.now() + CREATOR_MEDIA_TOTAL_TIMEOUT_MS", "resolveSafeAddressBeforeDeadline",
  "deadline - Date.now()", "redirects: redirects + 1, deadline", "Math.min(CREATOR_MEDIA_CONNECTION_TIMEOUT_MS, remainingMs)",
  "agent: false",
]) assert.ok(helper.includes(marker), `safe fetch helper is missing ${marker}`);

assert.ok(boundary.includes('"creator-store-image"') && boundary.includes('"creator-store-video"'));
assert.match(boundary.slice(boundary.indexOf('"creator-store-image"')), /maxBodyBytes: CREATOR_IMAGE_REQUEST_BODY_BYTES[\s\S]*?rateLimit: 20/);
assert.match(boundary.slice(boundary.indexOf('"creator-store-video"')), /maxBodyBytes: CREATOR_VIDEO_REQUEST_BODY_BYTES[\s\S]*?rateLimit: 6/);
assert.ok(policy.includes("MAX_CREATOR_IMAGE_BYTES = 15 * MEBIBYTE"));
assert.ok(policy.includes("MAX_CREATOR_VIDEO_BYTES = 100 * MEBIBYTE"));
assert.ok(policy.includes("Math.ceil(MAX_CREATOR_IMAGE_BYTES / 3) * 4 + MEBIBYTE"));
assert.ok(policy.includes("CREATOR_VIDEO_REQUEST_BODY_BYTES = 64 * 1024"));
assert.ok(policy.includes("CREATOR_MEDIA_TOTAL_TIMEOUT_MS = 30_000"));

const decodedImageLimit = 15 * 1024 * 1024;
const imageRequestLimit = Math.ceil(decodedImageLimit / 3) * 4 + 1024 * 1024;
assert.equal(imageRequestLimit, 21 * 1024 * 1024, "image JSON limit must be 21 MiB");
const validPngOver64KiB = Buffer.alloc(96 * 1024);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(validPngOver64KiB);
const compatibleRequest = JSON.stringify({
  image: `data:image/png;base64,${validPngOver64KiB.toString("base64")}`,
  sceneId: 1,
  projectId: "compatibility-field",
});
assert.ok(Buffer.byteLength(compatibleRequest) > 64 * 1024);
assert.ok(Buffer.byteLength(compatibleRequest) < imageRequestLimit, "valid PNG request must fit route policy");
const maxImageRequest = JSON.stringify({
  image: `data:image/png;base64,${Buffer.alloc(decodedImageLimit).toString("base64")}`,
  sceneId: "thumbnail",
  projectId: "compatibility-field",
});
assert.ok(Buffer.byteLength(maxImageRequest) < imageRequestLimit, "15 MiB base64 image plus JSON must fit");
assert.ok(helper.includes("if (estimatedBytes > maxBytes) throw new SafeMediaError(413"));
assert.ok(helper.includes("buffer.length > maxBytes ? 413 : 400"));
assert.ok(generatedImageRoute.includes('image: `data:image/png;base64,${image.base64}`'));
assert.ok(createPage.includes("const rawImage = imageData.image as string"));
assert.match(createPage, /creator-store-image[\s\S]{0,450}image: rawImage/);
assert.ok(createPage.includes('isCreatorLabFlow ? "/api/creator-store-image" : "/api/store-image"'));
assert.ok(createPage.includes('isCreatorLabFlow ? "/api/creator-store-video" : "/api/store-video"'));
assert.ok(createPage.includes('fetch("/api/creator-store-image"'));
assert.ok(createPage.includes("Authorization: `Bearer ${accessToken}`"));

const protectedHashes = {
  "app/api/store-image/route.ts": "aed83acf0f12a48ce2ddcad5947ce71e9930987f9e55783c8ac1fd44f3e063e7",
  "app/api/store-video/route.ts": "04acfe7398554fafbb7f3e6bac0fa3b4d250e3f1440b624c53c8c72f0dfc1399",
  "components/create/StoryverseCinematicIntro.tsx": "6ea5cde80881cf3506969b7d49c74542185af045c58360863d637f243031f9f2",
  "components/experience/StoryverseShell.tsx": "40507b790161a08d50eeed0909b786ef54bf82250cb619635ebbeaa5d9b93ac4",
  "app/api/story/route.ts": "5559c4e40a9364865aa25353cfa1283f0e1a824e7513f125e75ec737ef97302f",
  "app/api/story-setup/route.ts": "f70bc3cec2238c9ad70e69ba17ce93e8a6b6d756c700eac4d705e4ec37db81b7",
  "app/api/build-story/route.ts": "6db70c4c7f739c1163f745fca32249b8daec28423e6bfb33d602ce456a7afb29",
  "app/api/continue-story/route.ts": "a4dcfc610b4a91c468e2d394926bbff197423839e4a16f36fbc2aebdc8f6494a",
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.equal(hash(file), expected, `${file} changed`);
assert.equal(fs.existsSync("prisma/migrations"), false);
assert.equal(JSON.parse(read("package.json")).scripts["test:beta-sec-p1b"], "node scripts/beta-sec-p1b-smoke-test.mjs");
console.log("BETA-SEC-P1B storage safety smoke test passed; protected Storyverse hashes are unchanged.");
