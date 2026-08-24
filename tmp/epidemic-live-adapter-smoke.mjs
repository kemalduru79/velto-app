import { readFile } from "node:fs/promises";
import ts from "typescript";

const providerError = `class ProviderError extends Error {
  constructor(message, options) { super(message); this.name = "ProviderError"; Object.assign(this, options); }
}`;
const securitySource = await readFile(new URL("../lib/providers/music/downloadSecurity.ts", import.meta.url), "utf8");
const executableSecurity = securitySource
  .replace(/import \{ ProviderError \} from "@\/lib\/providers\/core\/providerError";/, providerError)
  .replace(/import \{ isUnsafeNetworkAddress \} from "@\/lib\/security\/safeRemoteMediaFetch";/, `const isUnsafeNetworkAddress = (value) => {
    if (/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(value)) return true;
    const parts = value.split(".").map(Number);
    return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
  };`)
  .replace(/import \{ resolveProviderEnvironmentValue \} from "@\/lib\/runtime\/providerEnvironment\.mjs";/, `const resolveProviderEnvironmentValue = (_provider, key, env = process.env) => key === "acquisitionEnabled" ? (env.CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED || "").trim() : "";`);
const compiledSecurity = ts.transpile(executableSecurity, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const securityUrl = `data:text/javascript;base64,${Buffer.from(compiledSecurity).toString("base64")}`;

const adapterSource = await readFile(new URL("../lib/providers/music/epidemic.ts", import.meta.url), "utf8");
const executableAdapter = adapterSource
  .replace(/import \{ ProviderError, classifyProviderError \} from "@\/lib\/providers\/core\/providerError";/, `${providerError}\nconst classifyProviderError = (error, message) => error instanceof ProviderError ? error : new ProviderError(message, { code: /abort|timeout/i.test(String(error)) ? "timeout" : "unknown", retryable: /abort|timeout/i.test(String(error)), cause: error });`)
  .replace(/import \{ normalizeCreatorPremiumMusicTrackId \} from "@\/lib\/creator\/musicLibrary";/, `const normalizeCreatorPremiumMusicTrackId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/.test(value) ? value : undefined;`)
  .replace(/import type \{[\s\S]*?\} from "\.\/types";/, "")
  .replace(/from "\.\/downloadSecurity";/, `from "${securityUrl}";`)
  .replace(/import \{\s*isProviderConfigured,[\s\S]*?\} from "@\/lib\/runtime\/providerEnvironment\.mjs";/, `const resolveProviderEnvironmentValue = (_provider, key) => key === "apiKey" ? (process.env.EPIDEMIC_SOUND_API_KEY || "").trim() : ""; const isProviderConfigured = () => Boolean(resolveProviderEnvironmentValue("epidemic", "apiKey"));`);
const compiledAdapter = ts.transpile(executableAdapter, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const adapterModule = await import(`data:text/javascript;base64,${Buffer.from(compiledAdapter).toString("base64")}`);

process.env.CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED = "true";
const result = await new adapterModule.EpidemicMusicAdapter().downloadTrack({
  trackId: "91bb2450-8bbe-42d7-a86f-4dd2ad5135af",
  partnerUserId: "velto-internal-entitlement-probe",
  acquisitionContext: { projectId: "epidemic-live-adapter-smoke", licensePolicyVersion: "creator-premium-music-license-v1" },
});
console.log("EPIDEMIC_LIVE_ADAPTER_SMOKE=PASS");
console.log("MEDIA_HOSTNAME=pdn.epidemicsound.com");
console.log(`CONTENT_TYPE=${result.contentType}`);
console.log(`BYTE_SIZE=${result.contentLength}`);
console.log(`CHECKSUM_PREFIX=${result.checksum.slice(0, 12)}`);
