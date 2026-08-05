import assert from "node:assert/strict";
import fs from "node:fs";

const boundaryPath = "lib/security/creatorApiBoundary.ts";
const boundary = fs.readFileSync(boundaryPath, "utf8");
const routes = [
  ["app/api/creator-mentor/route.ts", "creator-mentor"],
  ["app/api/creator-youtube-metadata/route.ts", "creator-youtube-metadata"],
  ["app/api/creator-thumbnail/route.ts", "creator-thumbnail"],
];

for (const [file, routeId] of routes) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /from "@\/lib\/security\/creatorApiBoundary"/);
  assert.ok(source.includes(`"${routeId}"`), `${file} must select its route policy`);
  const boundaryIndex = source.indexOf("await enforceCreatorApiBoundary");
  const providerIndex = source.indexOf("getOpenAIClient()", source.indexOf("export async function POST"));
  assert.ok(boundaryIndex >= 0 && providerIndex > boundaryIndex, `${file} provider must follow boundary`);
  assert.ok(source.indexOf("req.json", source.indexOf("export async function POST")) < 0, `${file} must not parse separately`);
}

for (const status of [400, 401, 413, 415, 429]) assert.ok(boundary.includes(`${status},`));
assert.match(boundary, /request\.headers\.get\("content-type"\)/);
assert.match(boundary, /request\.headers\.get\("content-length"\)/);
assert.match(boundary, /await authenticateRequest\(request\)/);
assert.match(boundary, /await request\.text\(\)/);
assert.match(boundary, /new TextEncoder\(\)\.encode\(rawBody\)\.byteLength/);
assert.match(boundary, /JSON\.parse\(rawBody\)/);
assert.match(boundary, /const key = `\$\{userId\}:\$\{routeId\}`/);
assert.match(boundary, /"Retry-After"/);
assert.match(boundary, /MAX_RATE_LIMIT_KEYS/);
assert.match(boundary, /rateLimitEntries\.delete/);
assert.doesNotMatch(boundary, /rateLimitEntries\.set\([^\n]*(prompt|body|content)/i);

for (const [routeId, bytes, limit] of [
  ["creator-mentor", "256 * 1024", "20"],
  ["creator-youtube-metadata", "128 * 1024", "10"],
  ["creator-thumbnail", "128 * 1024", "4"],
]) {
  const start = boundary.indexOf(`"${routeId}"`);
  const policy = boundary.slice(start, boundary.indexOf("},", start) + 2);
  assert.ok(policy.includes(`maxBodyBytes: ${bytes}`));
  assert.ok(policy.includes(`rateLimit: ${limit}`));
}

assert.equal(fs.existsSync("prisma/migrations"), false, "sprint must not add migrations");
console.log("BETA-SEC-P1A-2 request and abuse boundary smoke test passed.");
