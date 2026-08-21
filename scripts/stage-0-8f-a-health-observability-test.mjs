import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

import { resolveRuntimeRelease } from "../lib/runtime/releaseIdentity.mjs";
import { resolveRuntimeRelease as resolveExportRelease } from "../export-service/src/runtimeIdentity.js";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const fullEnvironment = {
  VELTO_RELEASE: "  portable-release  ",
  VERCEL_GIT_COMMIT_SHA: "1234567890abcdef",
  GIT_COMMIT_SHA: "abcdef1234567890",
  NEXT_PUBLIC_APP_VERSION: "app-version",
};
assert.equal(resolveRuntimeRelease(fullEnvironment), "portable-release");
assert.equal(resolveRuntimeRelease({ ...fullEnvironment, VELTO_RELEASE: "  " }), "1234567890ab");
assert.equal(resolveRuntimeRelease({ ...fullEnvironment, VELTO_RELEASE: "", VERCEL_GIT_COMMIT_SHA: " \t" }), "abcdef123456");
assert.equal(resolveRuntimeRelease({ GIT_COMMIT_SHA: "  ", NEXT_PUBLIC_APP_VERSION: " version " }), "version");
assert.equal(resolveRuntimeRelease({ NEXT_PUBLIC_APP_VERSION: "  " }), "local");
assert.equal(resolveExportRelease(fullEnvironment), "portable-release");
assert.equal(resolveExportRelease({ ...fullEnvironment, VELTO_RELEASE: " " }), "1234567890ab");

for (const [file, importPattern] of [
  ["lib/runtime/runtimeHealth.ts", /resolveRuntimeRelease\(environment\)/],
  ["app/api/creator-health/route.ts", /resolveRuntimeRelease\(\)/],
  ["app/api/observability/health/route.ts", /resolveRuntimeRelease\(\)/],
  ["lib/observability/logger.ts", /resolveRuntimeRelease\(\)/],
]) {
  const source = read(file);
  assert.match(source, /(?:import|resolveRuntimeRelease)/);
  assert.match(source, importPattern);
}

const exportService = read("export-service/src/server.js");
const healthBlock = exportService.match(/app\.get\("\/health",[\s\S]*?\n\}\);/)?.[0] || "";
for (const field of [
  "ok", "service", "stitchContinuityVersion", "finalProductionGateCompatible",
  "freezeFrameFallbackDisabled", "release", "checkedAt", "runtime", "node",
  "uptimeSeconds", "stateless", "tempDirectory",
]) assert.match(healthBlock, new RegExp(`\\b${field}\\b`));
assert.doesNotMatch(healthBlock, /(?:fetch|createClient|spawn|ffmpeg|ffprobe|SUPABASE|API_KEY|TOKEN|authorization)/i);

const envExample = read(".env.container.example");
assert.match(envExample, /^VELTO_OBSERVABILITY_TOKEN=$/m);
assert.match(envExample, /^VELTO_OBSERVABILITY_EXPORTER=console-json$/m);
assert.doesNotMatch(envExample, /^NEXT_PUBLIC_.*OBSERVABILITY.*TOKEN=/m);
assert.match(envExample, /console-json \(the\n# current\/default structured console output\) and none \(disables output\)/);

const packageJson = JSON.parse(read("package.json"));
const directDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
for (const forbidden of ["@sentry/", "@opentelemetry/", "datadog", "applicationinsights", "@azure/monitor"]) {
  assert.equal(Object.keys(directDependencies).some((name) => new RegExp(forbidden, "i").test(name)), false);
}
assert.equal(hash("package.json"), "f222bf7fb9f4db6766ed3dbe5060348518aea870c8d36658c4b8f58518c4eca0");
assert.equal(hash("package-lock.json"), "1d3ce079c07be440669c3ec43b5bcaa9a068a448355d4cf6ec9eb2ea4974c989");
assert.equal(hash("lib/worker/runtime.mjs"), "e213b71c819e6cc26572dc0cb1d5be37c912d6b20b5d9e6318c05d07b1cbfaf6");

const runtimeHealth = read("lib/runtime/runtimeHealth.ts");
const creatorHealth = read("app/api/creator-health/route.ts");
const observabilityHealth = read("app/api/observability/health/route.ts");
const observabilityPayload = observabilityHealth.match(/const body = \{[\s\S]*?\n    \};/)?.[0] || "";
assert.ok(observabilityPayload);
for (const source of [runtimeHealth, creatorHealth, observabilityPayload, healthBlock]) {
  assert.doesNotMatch(source, /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|VELTO_INTERNAL_EXPORT_TOKEN|VELTO_OBSERVABILITY_TOKEN|OPENAI_API_KEY)/);
}
assert.match(observabilityHealth, /timingSafeEqual\(configuredBytes, suppliedBytes\)/);

console.log("Stage 0.8F-A health and observability regression passed.");
