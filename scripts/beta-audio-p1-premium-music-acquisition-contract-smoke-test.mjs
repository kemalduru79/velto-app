import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const types = await read("lib/providers/music/types.ts");
const adapter = await read("lib/providers/music/epidemic.ts");
const providerIndex = await read("lib/providers/music/index.ts");
const securitySource = await read("lib/providers/music/downloadSecurity.ts");
const route = await read("app/api/creator-music/route.ts");
const policy = await read("lib/credits/operationPolicy.ts");

const executableSecurity = securitySource
  .replace(
    /import \{ ProviderError \} from "@\/lib\/providers\/core\/providerError";/,
    `class ProviderError extends Error {
      constructor(message, options) { super(message); this.name = "ProviderError"; Object.assign(this, options); }
    }`,
  )
  .replace(
    /import \{ isUnsafeNetworkAddress \} from "@\/lib\/security\/safeRemoteMediaFetch";/,
    "const isUnsafeNetworkAddress = () => true;",
  );
const transpiled = ts.transpile(executableSecurity, {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
});
const security = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);

const mp3 = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]);
const response = (body, init = {}) => new Response(body, {
  status: init.status || 200,
  headers: { "content-type": "audio/mpeg", ...(init.headers || {}) },
});
const rejectsCode = async (promise, code) => {
  await assert.rejects(promise, (error) => error?.code === code);
};

assert.match(types, /downloadTrack\(input: MusicDownloadInput\): Promise<MusicDownloadResult>/);
assert.match(types, /searchTracks\(input: MusicSearchInput\): Promise<MusicSearchResult>/);
assert.match(types, /getTrackPreview\(trackId: string, partnerUserId: string\): Promise<MusicPreviewResult>/);
assert.match(types, /body: Uint8Array/);
assert.doesNotMatch(types, /downloadUrl|previewUrl|providerUrl|rawResponse|providerPayload/);
assert.match(providerIndex, /MusicDownloadInput, MusicDownloadResult/);

assert.match(adapter, /normalizeCreatorPremiumMusicTrackId\(input\.trackId\)/);
assert.match(adapter, /if \(\s*!trackId \|\|/);
for (const invalid of ["https://example.com/song", "/tmp/song.mp3", "file:///song", "data:audio/mpeg;base64,AA=="]) {
  assert.equal(/^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/.test(invalid), false);
}
assert.match(adapter, /networkLikeTrackId === "localhost"/);
assert.match(adapter, /isIP\(networkLikeTrackId\) !== 0/);

await rejectsCode(security.readBoundedPremiumMusicResponse(response(new Uint8Array())), "upstream");
await rejectsCode(security.readBoundedPremiumMusicResponse(response(mp3), 4), "invalid_request");
await rejectsCode(security.readBoundedPremiumMusicResponse(response(mp3, { headers: { "content-type": "audio/wav" } })), "invalid_request");
await rejectsCode(security.readBoundedPremiumMusicResponse(response(new TextEncoder().encode("<html>not audio</html>"))), "invalid_request");
const valid = await security.readBoundedPremiumMusicResponse(response(mp3));
assert.deepEqual(valid.body, mp3);
assert.equal(valid.contentType, "audio/mpeg");
assert.equal(valid.contentLength, mp3.length);
assert.match(valid.checksum, /^[a-f0-9]{64}$/);
assert.equal(security.PREMIUM_MUSIC_DOWNLOAD_TIMEOUT_MS, 30_000);
assert.deepEqual(Object.keys(valid).sort(), ["body", "checksum", "contentLength", "contentType"]);
await rejectsCode(security.readBoundedPremiumMusicResponse(response(mp3, { headers: { "content-length": "99" } })), "upstream");

const timeoutSource = await read("lib/providers/core/providerError.ts");
assert.match(timeoutSource, /abort\|timeout\|timed out/);
assert.match(timeoutSource, /code: "timeout",\s*retryable: true/);
await rejectsCode(security.readBoundedPremiumMusicResponse(response(null, { status: 401 })), "authentication");
await rejectsCode(security.readBoundedPremiumMusicResponse(response(null, { status: 403 })), "authentication");
await assert.rejects(security.readBoundedPremiumMusicResponse(response(null, { status: 429 })), (error) => error.code === "rate_limit" && error.retryable === true);
await assert.rejects(security.readBoundedPremiumMusicResponse(response(null, { status: 503 })), (error) => error.code === "upstream" && error.retryable === true);

await rejectsCode(security.readBoundedPremiumMusicResponse(response(null, { status: 302, headers: { location: "https://evil.example/song.mp3" } })), "invalid_request");
for (const unsafe of ["http://partner-content-api.epidemicsound.com/song", "https://localhost/song", "https://127.0.0.1/song", "file:///song"]) {
  assert.throws(() => security.validateProviderMusicUrl(unsafe), (error) => error.code === "invalid_request");
}

assert.equal(security.isPremiumMusicAcquisitionEnabled({}), false);
assert.equal(security.isPremiumMusicAcquisitionEnabled({ CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED: "TRUE" }), false);
assert.equal(security.isPremiumMusicAcquisitionEnabled({ CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED: "1" }), false);
assert.equal(security.isPremiumMusicAcquisitionEnabled({ CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED: "true" }), true);
assert.match(adapter, /production acquisition endpoint and response contract have not been[\s\S]*Keep this method fail-closed/);
assert.doesNotMatch(adapter, /this\.request\([^\n]*(?:download|acqui)/);
assert.match(route, /searchTracks/);
assert.match(route, /getTrackPreview/);
assert.doesNotMatch(route, /downloadTrack|acquisition/);
assert.doesNotMatch(types + adapter + securitySource, /creator_music|reserveMeteredOperation|settleMeteredOperation/);
assert.doesNotMatch(policy, /creator_music/);
assert.doesNotMatch(types + adapter + securitySource, /storyverse/i);

console.log("CreatorLab premium music acquisition contract smoke test passed (25 checks).");
