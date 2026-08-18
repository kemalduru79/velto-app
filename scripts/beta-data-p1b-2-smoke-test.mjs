import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const imageRoute = read("app/api/store-image/route.ts");
const videoRoute = read("app/api/store-video/route.ts");
const boundary = read("lib/security/legacyMediaStorageBoundary.ts");
const policy = read("lib/security/creatorMediaStoragePolicy.ts");
const safeFetch = read("lib/security/safeRemoteMediaFetch.ts");
const createPage = read("app/create/page.tsx");

for (const [route, routeId, kind, bucket, limit] of [
  [imageRoute, "store-image", "image", 'bucket: "images"', "MAX_CREATOR_IMAGE_BYTES"],
  [videoRoute, "store-video", "video", 'bucket: "videos"', "MAX_CREATOR_VIDEO_BYTES"],
]) {
  const handler = route.indexOf("export async function POST");
  const authBoundary = route.indexOf("await enforceLegacyMediaBoundary", handler);
  assert.ok(authBoundary >= 0, `${routeId} must use the authenticated boundary`);
  assert.ok(authBoundary < route.indexOf("safeRemoteMediaFetch", handler), `${routeId} auth must precede network`);
  assert.ok(authBoundary < route.indexOf("uploadPublic", handler), `${routeId} auth must precede storage`);
  assert.ok(route.includes(`"${routeId}"`));
  assert.ok(route.includes(`storyverse/${"${boundary.user.id}"}/${kind}/`));
  assert.ok(route.includes("randomUUID()"));
  assert.ok(route.includes("media.extension") || route.includes("fileData.extension"));
  assert.ok(route.includes(bucket));
  assert.ok(route.includes(limit));
  assert.ok(route.includes("upsert: false"));
  assert.doesNotMatch(route, /body\?\.(?:userId|ownerId|accountId|bucket|path)/);
  assert.doesNotMatch(route, /safeName\((?:projectId|sceneId)/);
  assert.ok(route.includes("ok: true"));
  assert.ok(route.includes("path:"));
}
assert.ok(imageRoute.includes("imageUrl: storedImage.publicUrl"));
assert.ok(videoRoute.includes("videoUrl: storedVideo.publicUrl"));
assert.doesNotMatch(imageRoute + videoRoute, /error instanceof Error \? error\.message|response\.text\(/);

const authenticate = boundary.indexOf("user = await authenticateRequest(request)");
for (const laterWork of [
  "applyRateLimit(user.id, routeId)",
  'request.headers.get("content-type")',
  'request.headers.get("content-length")',
  "readBoundedBody(request, policy.maxBodyBytes)",
  "JSON.parse(rawBody)",
]) {
  assert.ok(authenticate >= 0 && authenticate < boundary.indexOf(laterWork), `authentication must precede ${laterWork}`);
}
assert.doesNotMatch(boundary.slice(0, authenticate), /request\.(?:json|text|arrayBuffer|formData)\s*\(/);
for (const status of [400, 401, 413, 415, 429]) assert.ok(boundary.includes(`errorResponse(${status},`));
assert.ok(boundary.includes('"Retry-After": String(retryAfter)'));
assert.ok(boundary.includes("request.body.getReader()"));
assert.ok(boundary.includes("total > maxBytes"));
assert.ok(boundary.includes("await reader.cancel()"));
assert.match(boundary.slice(boundary.indexOf('"store-image"')), /maxBodyBytes: CREATOR_IMAGE_REQUEST_BODY_BYTES[\s\S]*?rateLimit: 20/);
assert.match(boundary.slice(boundary.indexOf('"store-video"')), /maxBodyBytes: CREATOR_VIDEO_REQUEST_BODY_BYTES[\s\S]*?rateLimit: 6/);
assert.match(boundary, /const key = `\$\{userId\}:\$\{routeId\}`/);

assert.ok(policy.includes("MAX_CREATOR_IMAGE_BYTES = 15 * MEBIBYTE"));
assert.ok(policy.includes("MAX_CREATOR_VIDEO_BYTES = 100 * MEBIBYTE"));
assert.ok(policy.includes("Math.ceil(MAX_CREATOR_IMAGE_BYTES / 3) * 4 + MEBIBYTE"));
assert.ok(policy.includes("CREATOR_VIDEO_REQUEST_BODY_BYTES = 64 * 1024"));
assert.equal(Math.ceil((15 * 1024 * 1024) / 3) * 4 + 1024 * 1024, 21 * 1024 * 1024);

for (const marker of [
  'url.protocol !== "https:"', "url.username || url.password", 'hostname === "localhost"',
  "unsafeIpv4", "0x64400000", "unsafeIpv6", "groups[5] === 0xffff",
  "lookup(hostname, { all: true, verbatim: true })", "records.some", "lookup:", "servername:",
  "redirects >= 3", "deadline = Date.now() + CREATOR_MEDIA_TOTAL_TIMEOUT_MS",
  "redirects: redirects + 1, deadline", "agent: false", 'response.headers["content-length"]',
  "total > maxBytes", "Math.min(CREATOR_MEDIA_CONNECTION_TIMEOUT_MS, remainingMs)",
  '"image/jpeg"', '"image/png"', '"image/webp"', '"video/mp4"', '"video/webm"',
  "detectMediaType", "Declared media type does not match its content.",
]) assert.ok(safeFetch.includes(marker), `safe fetch helper is missing ${marker}`);
assert.ok(imageRoute.includes("decodeImageDataUrl(image, MAX_CREATOR_IMAGE_BYTES)"));
assert.ok(videoRoute.includes('kind: "video"'));

function sharedStorageBlocks(routeSelection) {
  const blocks = [];
  let cursor = 0;
  while (true) {
    const routeIndex = createPage.indexOf(routeSelection, cursor);
    if (routeIndex < 0) break;
    const tokenIndex = createPage.lastIndexOf("const storeAccessToken", routeIndex);
    const imageTokenIndex = createPage.lastIndexOf("const accessToken", routeIndex);
    const start = Math.max(tokenIndex, imageTokenIndex);
    const storeDataIndex = createPage.indexOf("const storeData", routeIndex);
    assert.ok(start >= 0 && storeDataIndex > routeIndex, `could not isolate ${routeSelection}`);
    blocks.push(createPage.slice(start, storeDataIndex));
    cursor = routeIndex + routeSelection.length;
  }
  return blocks;
}

const imageSelection = 'isCreatorLabFlow ? "/api/creator-store-image" : "/api/store-image"';
const videoSelection = '"/api/store-video"';
const creatorVideoSelection = '"/api/creator-store-video"';
const imageBlocks = sharedStorageBlocks(imageSelection);
const videoBlocks = sharedStorageBlocks(videoSelection);
const creatorVideoBlocks = sharedStorageBlocks(creatorVideoSelection);
assert.equal(imageBlocks.length, 1, "exactly one shared image storage caller is required");
assert.equal(videoBlocks.length, 2, "exactly two Storyverse video storage callers are required");
assert.equal(creatorVideoBlocks.length, 1, "exactly one queue-only CreatorLab video storage caller is required");

for (const [index, block] of [...imageBlocks, ...videoBlocks, ...creatorVideoBlocks].entries()) {
  assert.match(block, /Authorization: `Bearer \$\{(?:accessToken|storeAccessToken)\}`/,
    `shared storage caller ${index + 1} must send a Bearer token unconditionally`);
  assert.doesNotMatch(block, /\.\.\.\(isCreatorLabFlow\s*\?\s*\{\s*Authorization:/,
    `shared storage caller ${index + 1} must not conditionally add Authorization`);
  assert.doesNotMatch(block, /isCreatorLabFlow\s*\?\s*await getAccessTokenOrThrow\(\)\s*:\s*["']{2}/,
    `shared storage caller ${index + 1} must not use an empty Storyverse token`);
}
assert.match(imageBlocks[0], /const accessToken = await getAccessTokenOrThrow\(\)/,
  "the image caller must reuse its already-valid generation token");
for (const [index, block] of [...videoBlocks, ...creatorVideoBlocks].entries()) {
  assert.match(block, /const storeAccessToken = await getAccessTokenOrThrow\(\);/,
    `video storage caller ${index + 1} must retrieve a token immediately before storage`);
}
assert.ok(createPage.includes('fetch("/api/creator-store-image"'), "CreatorLab-only image caller must remain");

const videoTokenAfter = "const storeAccessToken = await getAccessTokenOrThrow();";
assert.equal(createPage.split(videoTokenAfter).length - 1, 3);
assert.equal((createPage.match(/Authorization: `Bearer \$\{storeAccessToken\}`/g) || []).length, 3);

const protectedHashes = {
  "app/api/store-audio/route.ts": "3df1841f7ecb64bae6b8dbbee6ff37245c5cdbfc157aa3191042068389901c86",
  "app/api/store-dialogue-audio/route.ts": "1f267242cd2a2b15357a6a2fd769c0d91840e183f74a8093e6e536bd0eeacbcc",
  "app/api/creator-store-image/route.ts": "41257a586db6ecac9d748dfc4466bd677d00a414723c5464c0b8acc038e3e30c",
  "lib/security/creatorApiBoundary.ts": "c6eed64a7408cad1d6cfc5ae5d39c670f0f76728b4f303487f003b99d8196217",
  "lib/security/creatorMediaStoragePolicy.ts": "ff7524414d45ae630a81fca7751d84226a11139916b3df40e34d0c0d800c16e9",
  "lib/security/safeRemoteMediaFetch.ts": "f85004c90e8d3fc24c1a18d017ba09e39b6327328171f9b3e6d251d7a84b417e",
  "lib/persistence/projects/supabaseProjectRepository.ts": "7f005548d4b61354fbf550cd5bef362c4586b3fd975fcf15cdba0b1ef6e478dc",
  "lib/persistence/storage/supabaseObjectStorageRepository.ts": "37a5ed1705fb7fa33e04f77c2c9e58e17c1d100915c570751dafbea7da56ffed",
  "components/create/StoryverseCinematicIntro.tsx": "6ea5cde80881cf3506969b7d49c74542185af045c58360863d637f243031f9f2",
  "components/experience/StoryverseShell.tsx": "40507b790161a08d50eeed0909b786ef54bf82250cb619635ebbeaa5d9b93ac4",
  "app/api/stitch-video/route.ts": "c9528eb59f580f2b1b5284fab6eb0f24a2503b2f6d083208502e54a97b12e945",
  "supabase/migrations/20260728090000_foundation_p1_auth_credit_ledger.sql": "459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9",
  "supabase/migrations/20260730120000_fin_p1c_credit_reconciliation.sql": "50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff",
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.equal(hash(file), expected, `${file} changed`);
assert.equal(fs.existsSync("prisma/migrations"), false);
assert.equal(JSON.parse(read("package.json")).scripts["test:beta-data-p1b-2"], "node scripts/beta-data-p1b-2-smoke-test.mjs");

console.log("BETA-DATA-P1B-2 legacy storage smoke test passed; protected Storyverse/shared hashes are unchanged.");
