import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const reconcile = read("scripts/fin-p1c-reconcile.mjs");
const runbook = read("docs/STAGE-0.8F-RECOVERY-OPERATOR.md");
const packageJson = JSON.parse(read("package.json"));

const applyGate = reconcile.indexOf("if (!apply)");
const clientImport = reconcile.indexOf('await import("@supabase/supabase-js")');
const clientCreation = reconcile.indexOf("createClient(supabaseUrl");
const rpcCall = reconcile.indexOf('supabase.rpc("velto_fin_reconcile"');
assert.ok(applyGate >= 0 && clientImport > applyGate && clientCreation > clientImport && rpcCall > clientCreation);
assert.match(reconcile, /mode: "NO_MUTATION"/);
assert.match(reconcile, /requiredFlag: "--apply"/);
assert.match(reconcile, /p_source: "admin_script"/);

const preview = spawnSync(process.execPath, ["scripts/fin-p1c-reconcile.mjs"], {
  encoding: "utf8",
  env: { PATH: process.env.PATH || "" },
});
assert.equal(preview.status, 0, preview.stderr);
assert.deepEqual(JSON.parse(preview.stdout), {
  mode: "NO_MUTATION",
  mutation: "velto_fin_reconcile",
  batchLimit: 200,
  staleJobMinutes: 10,
  requiredFlag: "--apply",
});

assert.equal(packageJson.scripts["fin:reconcile"], "node scripts/fin-p1c-reconcile.mjs");
assert.equal(packageJson.scripts["fin:reconcile:apply"], "node --env-file=.env.local scripts/fin-p1c-reconcile.mjs --apply");

for (const marker of [
  "/api/runtime-health?mode=live", "/api/runtime-health?mode=ready",
  "/api/observability/health", "/api/creator-health", "Export service: `/health`",
  "VELTO_RELEASE", "durable in Postgres", "lease expiry", "must not manually edit queue rows",
  "npm run fin:reconcile", "npm run fin:reconcile:apply", "performs no database operation",
  "stage-0-7a-reconcile-media.mjs", "stage-0-7a-reconcile-media.mjs --apply",
  "stage-0-7d-1-purge-recovery.mjs", "stage-0-7d-1-purge-recovery.mjs --apply",
  "OBJECT_MISSING", "OBJECT_PRESENT", "UNKNOWN_ERROR", "synthetic disposable test only",
  "disabled by default", "application rollback never implies database rollback", "Fail closed; do not guess",
]) assert.ok(runbook.includes(marker), `runbook missing: ${marker}`);

assert.equal(hash("package-lock.json"), "1d3ce079c07be440669c3ec43b5bcaa9a068a448355d4cf6ec9eb2ea4974c989");
assert.equal(hash("lib/worker/runtime.mjs"), "e213b71c819e6cc26572dc0cb1d5be37c912d6b20b5d9e6318c05d07b1cbfaf6");
assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
  "@runwayml/sdk", "@supabase/supabase-js", "ffmpeg-static", "ffprobe-static",
  "hls.js", "next", "openai", "react", "react-dom",
].sort());
assert.deepEqual(Object.keys(packageJson.devDependencies).sort(), [
  "@tailwindcss/postcss", "@types/node", "@types/react", "@types/react-dom",
  "eslint", "eslint-config-next", "tailwindcss", "typescript",
].sort());

const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(Boolean);
const inventoryHash = (files) => createHash("sha256").update(`${files.sort().join("\n")}\n`).digest("hex");
assert.equal(inventoryHash(trackedFiles.filter((file) => /^app\/api\/.+\/route\.ts$/.test(file))), "afc35d9b11e92063f10d8d810e1fbbbf81d3bed9b7abf5e9ac3068b32c2b615f");
assert.equal(inventoryHash(trackedFiles.filter((file) => /^supabase\/migrations\//.test(file))), "e4d898403ac4a9ca64a3e6c5dfb6527a9afa8fbaeb333160cbaebb4d1b96aa09");
assert.equal(trackedFiles.some((file) => /\.(?:tf|tfvars|bicep)$/i.test(file) || /(?:^|\/)(?:azuredeploy|mainTemplate)\.json$/i.test(file)), false);

console.log("Stage 0.8F-B recovery and operator regression passed.");
