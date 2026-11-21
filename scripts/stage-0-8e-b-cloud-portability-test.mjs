import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getRuntimeHealth } from "../lib/runtime/runtimeHealth.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const envExample = read(".env.container.example");
const portability = read("docs/STAGE-0.8E-CLOUD-PORTABILITY.md");
const packageJson = JSON.parse(read("package.json"));

async function releaseFor(environment) {
  return (await getRuntimeHealth("live", environment)).release;
}

assert.equal(await releaseFor({
  VELTO_RELEASE: "portable-release",
  VERCEL_GIT_COMMIT_SHA: "vercel-commit-sha",
  GIT_COMMIT_SHA: "git-commit-sha",
  NEXT_PUBLIC_APP_VERSION: "app-version",
}), "portable-release");
assert.equal(await releaseFor({ VERCEL_GIT_COMMIT_SHA: "1234567890abcdef" }), "1234567890ab");
assert.equal(await releaseFor({ GIT_COMMIT_SHA: "abcdef1234567890" }), "abcdef123456");
assert.equal(await releaseFor({ NEXT_PUBLIC_APP_VERSION: "app-version" }), "app-version");
assert.equal(await releaseFor({}), "local");

assert.match(envExample, /^EXPORT_API_URL=$/m);
assert.match(envExample, /^NEXT_PUBLIC_EXPORT_API_URL=$/m);
assert.match(envExample, /NEXT_PUBLIC_EXPORT_API_URL is a\n# compatibility fallback/);
assert.match(envExample, /^VELTO_INTERNAL_EXPORT_TOKEN=$/m);
assert.doesNotMatch(envExample, /^NEXT_PUBLIC_.*(?:INTERNAL.*EXPORT|EXPORT.*TOKEN).*=/m);
assert.match(envExample, /^CREATOR_PREMIUM_MUSIC_BUCKET=$/m);
assert.match(envExample, /VELTO_RELEASE is canonical across cloud/);

for (const marker of [
  "### Web", "### Worker", "### Export", "`3000`", "`3001`",
  "/api/runtime-health?mode=live", "/api/runtime-health?mode=ready", "/health",
  "`/tmp`", "Supabase Postgres", "Supabase Auth", "Supabase Storage",
  "Azure Readiness — Deferred Deployment", "No Azure resources are created",
]) assert.match(portability, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
).trim().split(/\r?\n/).filter(Boolean);
const azureResourceFile = repositoryFiles.find((file) =>
  /(?:^|\/)(?:azuredeploy\.json|mainTemplate\.json|azure\.ya?ml)$/i.test(file) ||
  /\.(?:tf|tfvars|bicep)$/i.test(file),
);
assert.equal(azureResourceFile, undefined, `unexpected Azure resource file: ${azureResourceFile}`);
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
assert.equal(Object.keys(dependencies).some((name) => name.startsWith("@azure/")), false);

console.log("Stage 0.8E-B cloud portability regression passed.");
