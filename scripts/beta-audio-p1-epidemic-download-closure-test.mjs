import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const providerErrorClass = `class ProviderError extends Error {
  constructor(message, options) { super(message); this.name = "ProviderError"; Object.assign(this, options); }
}`;

const securitySource = await read("lib/providers/music/downloadSecurity.ts");
const executableSecurity = securitySource
  .replace(/import \{ ProviderError \} from "@\/lib\/providers\/core\/providerError";/, providerErrorClass)
  .replace(/import \{ isUnsafeNetworkAddress \} from "@\/lib\/security\/safeRemoteMediaFetch";/, "const isUnsafeNetworkAddress = () => true;")
  .replace(/import \{ resolveProviderEnvironmentValue \} from "@\/lib\/runtime\/providerEnvironment\.mjs";/, `const resolveProviderEnvironmentValue = (_provider, _key, env) => env.CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED || "";`);
const compiledSecurity = ts.transpile(executableSecurity, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const security = await import(`data:text/javascript;base64,${Buffer.from(compiledSecurity).toString("base64")}`);

const mp3 = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0]);
const mediaResponse = (body, init = {}) => new Response(body, {
  status: init.status || 200,
  headers: { "content-type": "audio/mpeg", ...(init.headers || {}) },
});
const rejects = (promise, code, status) => assert.rejects(
  promise,
  (error) => error?.code === code && (status === undefined || error?.status === status),
);

assert.equal(security.validateProviderApiUrl("https://partner-content-api.epidemicsound.com/v0/tracks/x/download").hostname, "partner-content-api.epidemicsound.com");
assert.equal(security.validateProviderMusicUrl("https://pdn.epidemicsound.com/music.mp3?token=secret").hostname, "pdn.epidemicsound.com");
for (const unsafe of [
  "https://evil.example/music.mp3",
  "https://localhost/music.mp3",
  "https://127.0.0.1/music.mp3",
  "http://pdn.epidemicsound.com/music.mp3",
]) assert.throws(() => security.validateProviderMusicUrl(unsafe), (error) => error.code === "invalid_request");

await rejects(security.readBoundedPremiumMusicResponse(mediaResponse(mp3, { headers: { "content-length": "99" } })), "upstream");
await rejects(security.readBoundedPremiumMusicResponse(mediaResponse(mp3, { headers: { "content-length": String(mp3.length) } }), 4), "invalid_request", 413);
await rejects(security.readBoundedPremiumMusicResponse(mediaResponse(new TextEncoder().encode("not mp3"))), "invalid_request", 415);
const bounded = await security.readBoundedPremiumMusicResponse(mediaResponse(mp3));
assert.equal(bounded.contentType, "audio/mpeg");
assert.equal(bounded.contentLength, mp3.length);
assert.deepEqual(bounded.body, mp3);
assert.match(bounded.checksum, /^[a-f0-9]{64}$/);

let fetchCalls = [];
const redirectingFetch = async (url, init) => {
  fetchCalls.push({ url: url.toString(), init });
  if (fetchCalls.length === 1) return mediaResponse(null, { status: 302, headers: { location: "/redirected.mp3" } });
  return mediaResponse(mp3);
};
const redirected = await security.fetchBoundedPremiumMusic("https://pdn.epidemicsound.com/start.mp3", redirectingFetch);
assert.equal(redirected.contentLength, mp3.length);
assert.equal(fetchCalls.length, 2);
assert.ok(fetchCalls.every((call) => call.init.redirect === "manual"));
await rejects(security.fetchBoundedPremiumMusic("https://pdn.epidemicsound.com/start.mp3", async () => mediaResponse(null, { status: 302, headers: { location: "https://evil.example/music.mp3" } })), "invalid_request");
let redirects = 0;
await rejects(security.fetchBoundedPremiumMusic("https://pdn.epidemicsound.com/start.mp3", async () => {
  redirects += 1;
  return mediaResponse(null, { status: 302, headers: { location: `/redirect-${redirects}.mp3` } });
}), "upstream", 302);
assert.equal(redirects, 3);

const adapterSource = await read("lib/providers/music/epidemic.ts");
const executableAdapter = adapterSource
  .replace(/import \{ ProviderError, classifyProviderError \} from "@\/lib\/providers\/core\/providerError";/, `${providerErrorClass}\nconst classifyProviderError = (error) => error instanceof ProviderError ? error : new ProviderError("failed", { code: "unknown", retryable: false, cause: error });`)
  .replace(/import \{ normalizeCreatorPremiumMusicTrackId \} from "@\/lib\/creator\/musicLibrary";/, `const normalizeCreatorPremiumMusicTrackId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/.test(value) ? value : undefined;`)
  .replace(/import type \{[\s\S]*?\} from "\.\/types";/, "")
  .replace(/import \{\s*fetchBoundedPremiumMusic,[\s\S]*?\} from "\.\/downloadSecurity";/, `const isPremiumMusicAcquisitionEnabled = () => true;
    const validateProviderApiUrl = (value) => new URL(value);
    let capturedSignedUrl = "";
    const validateProviderMusicUrl = (value) => { const url = new URL(value); if (url.hostname !== "pdn.epidemicsound.com") throw new ProviderError("blocked", { code: "invalid_request", retryable: false }); return url; };
    const fetchBoundedPremiumMusic = async (value) => { capturedSignedUrl = value; return { body: Uint8Array.from([73,68,51,4]), contentType: "audio/mpeg", contentLength: 4, checksum: "a".repeat(64) }; };`)
  .replace(/import \{\s*isProviderConfigured,[\s\S]*?\} from "@\/lib\/runtime\/providerEnvironment\.mjs";/, `const isProviderConfigured = () => true; const resolveProviderEnvironmentValue = () => "server-key";`);
const compiledAdapter = ts.transpile(executableAdapter, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const adapterModule = await import(`data:text/javascript;base64,${Buffer.from(compiledAdapter).toString("base64")}`);
const adapter = new adapterModule.EpidemicMusicAdapter();
const input = { trackId: "track-1", partnerUserId: "velto-test", acquisitionContext: { projectId: "project-1", licensePolicyVersion: "v1" } };
const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    assert.match(url.toString(), /\/v0\/tracks\/track-1\/download\?format=mp3&quality=normal$/);
    assert.equal(init.headers.Authorization, "Bearer server-key");
    assert.equal(init.headers["x-partner-user-id"], "velto-test");
    return Response.json({ url: "https://pdn.epidemicsound.com/signed.mp3?token=hidden", expires: "2026-08-25T00:00:00Z" });
  };
  const downloaded = await adapter.downloadTrack(input);
  assert.equal(calls, 1);
  assert.equal(downloaded.contentLength, 4);

  for (const [status, code, retryable] of [[401, "authentication", false], [403, "authentication", false], [404, "upstream", false], [429, "rate_limit", true]]) {
    globalThis.fetch = async () => new Response(null, { status });
    await assert.rejects(adapter.downloadTrack(input), (error) => error.code === code && error.status === status && error.retryable === retryable);
  }
  globalThis.fetch = async () => Response.json({ url: "https://evil.example/music.mp3" });
  await assert.rejects(adapter.downloadTrack(input), (error) => error.code === "invalid_request");
  globalThis.fetch = async () => Response.json({ url: "https://pdn.epidemicsound.com/music.mp3", expires: "not-a-date" });
  await assert.rejects(adapter.downloadTrack(input), (error) => error.code === "upstream");
  await assert.rejects(adapter.downloadTrack({ ...input, trackId: "https://evil.example/music.mp3" }), (error) => error.code === "invalid_request");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Epidemic licensed music download closure test passed.");
