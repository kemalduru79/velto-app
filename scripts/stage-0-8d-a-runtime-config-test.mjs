import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import {
  CORE_ENVIRONMENT_GROUPS,
  SUPABASE_SERVER_ENVIRONMENT,
  getCoreEnvironmentChecks,
  resolveConfiguredValue,
} from "../lib/runtime/coreEnvironment.mjs";
import { getRuntimeHealth } from "../lib/runtime/runtimeHealth.ts";
import { resolveServerSupabaseEnvironment } from "../lib/supabase/server.ts";
import {
  WORKER_RUNTIME_DEFAULTS,
  resolveWorkerRuntimeConfig,
} from "../lib/worker/runtimeConfig.mjs";

const root = process.cwd();
const secretSentinel = "stage-08d-a-secret-sentinel";
const baseEnvironment = {
  PATH: process.env.PATH,
  SUPABASE_URL: "https://canonical.supabase.co",
  SUPABASE_ANON_KEY: "canonical-anon",
  SUPABASE_SERVICE_ROLE_KEY: secretSentinel,
  OPENAI_API_KEY: secretSentinel,
  VELTO_INTERNAL_WORKER_TOKEN: secretSentinel,
};

assert.deepEqual(
  CORE_ENVIRONMENT_GROUPS.web.map(({ key }) => key),
  ["supabaseUrl", "supabaseAnonKey", "supabaseServiceRole", "openAi"],
);
assert.deepEqual(
  CORE_ENVIRONMENT_GROUPS.worker.map(({ key }) => key),
  ["supabaseUrl", "supabaseServiceRole", "internalWorkerToken"],
);
assert.deepEqual(SUPABASE_SERVER_ENVIRONMENT.url, [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);
assert.deepEqual(SUPABASE_SERVER_ENVIRONMENT.anonKey, [
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]);

assert.equal(
  resolveConfiguredValue(
    { SUPABASE_URL: "canonical", NEXT_PUBLIC_SUPABASE_URL: "fallback" },
    SUPABASE_SERVER_ENVIRONMENT.url,
  ),
  "canonical",
);
assert.equal(
  resolveConfiguredValue(
    { NEXT_PUBLIC_SUPABASE_URL: "fallback" },
    SUPABASE_SERVER_ENVIRONMENT.url,
  ),
  "fallback",
);
assert.deepEqual(
  resolveServerSupabaseEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: "https://fallback.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fallback-anon",
    SUPABASE_SERVICE_ROLE_KEY: secretSentinel,
  }),
  {
    url: "https://fallback.supabase.co",
    anonKey: "fallback-anon",
    serviceRoleKey: secretSentinel,
  },
);

function validate(mode, overrides = {}) {
  return spawnSync(process.execPath, ["scripts/validate-runtime-env.mjs", mode], {
    cwd: root,
    encoding: "utf8",
    env: { ...baseEnvironment, ...overrides },
  });
}

for (const mode of ["web", "worker"]) {
  const result = validate(mode);
  assert.equal(result.status, 0, `${mode} canonical environment must pass`);
}

const fallbackWeb = validate("web", {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  NEXT_PUBLIC_SUPABASE_URL: "https://fallback.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fallback-anon",
});
assert.equal(fallbackWeb.status, 0, "web compatibility aliases must pass");

for (const [mode, overrides, expectedCategory] of [
  ["web", { SUPABASE_SERVICE_ROLE_KEY: "" }, "supabaseServiceRole"],
  ["worker", { VELTO_INTERNAL_WORKER_TOKEN: "" }, "internalWorkerToken"],
  ["web", { SUPABASE_URL: "not-a-url" }, "supabaseUrl"],
]) {
  const result = validate(mode, overrides);
  const output = `${result.stdout}${result.stderr}`;
  assert.notEqual(result.status, 0, `${expectedCategory} failure must be rejected`);
  assert.match(output, new RegExp(expectedCategory));
  assert.doesNotMatch(output, new RegExp(secretSentinel));
}

assert.deepEqual(getCoreEnvironmentChecks("web", baseEnvironment), {
  supabaseUrl: true,
  supabaseAnonKey: true,
  supabaseServiceRole: true,
  openAi: true,
});
const readyHealth = await getRuntimeHealth("ready", baseEnvironment);
assert.equal(readyHealth.status, "ready");
const missingHealth = await getRuntimeHealth("ready", {
  ...baseEnvironment,
  OPENAI_API_KEY: "",
});
assert.equal(missingHealth.status, "not_ready");
assert.ok(missingHealth.missing.includes("openAi"));
assert.doesNotMatch(JSON.stringify(missingHealth), new RegExp(secretSentinel));

assert.deepEqual(WORKER_RUNTIME_DEFAULTS, {
  pollMs: 2000,
  leaseSeconds: 60,
  workerHeartbeatMs: 15000,
  retryBaseSeconds: 5,
  retryMaxSeconds: 300,
  finReconcileIntervalMs: 60000,
  finReconcileBatchLimit: 200,
  finStaleJobMinutes: 10,
});
assert.deepEqual(resolveWorkerRuntimeConfig({}), {
  pollMs: 2000,
  leaseSeconds: 60,
  jobHeartbeatMs: 20000,
  workerHeartbeatMs: 15000,
  retryBaseSeconds: 5,
  retryMaxSeconds: 300,
  finReconcileIntervalMs: 60000,
  finReconcileBatchLimit: 200,
  finStaleJobMinutes: 10,
});
assert.deepEqual(
  resolveWorkerRuntimeConfig({
    VELTO_QUEUE_POLL_MS: "1",
    VELTO_QUEUE_LEASE_SECONDS: "9999",
    VELTO_QUEUE_HEARTBEAT_MS: "1",
    VELTO_WORKER_HEARTBEAT_MS: "999999",
    VELTO_QUEUE_RETRY_BASE_SECONDS: "999",
    VELTO_QUEUE_RETRY_MAX_SECONDS: "1",
    VELTO_FIN_RECONCILE_INTERVAL_MS: "1",
    VELTO_FIN_RECONCILE_BATCH_LIMIT: "9999",
    VELTO_FIN_STALE_JOB_MINUTES: "0",
  }),
  {
    pollMs: 250,
    leaseSeconds: 900,
    jobHeartbeatMs: 3000,
    workerHeartbeatMs: 60000,
    retryBaseSeconds: 300,
    retryMaxSeconds: 300,
    finReconcileIntervalMs: 10000,
    finReconcileBatchLimit: 1000,
    finStaleJobMinutes: 1,
  },
);

const composeEnvironment = {
  ...process.env,
  ...baseEnvironment,
  NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon",
  OPENAI_API_KEY: secretSentinel,
  RUNWAY_API_KEY: secretSentinel,
  RUNWAYML_API_SECRET: secretSentinel,
  RUNWAYML_API_KEY: secretSentinel,
  VEO_API_KEY: secretSentinel,
  GEMINI_API_KEY: secretSentinel,
  ELEVENLABS_API_KEY: secretSentinel,
  EPIDEMIC_SOUND_API_KEY: secretSentinel,
  YOUTUBE_API_KEY: secretSentinel,
  CREATOR_ACCESS_TOKEN: secretSentinel,
};
const localEnvironmentPath = `${root}/.env.local`;
const createdLocalEnvironment = !fs.existsSync(localEnvironmentPath);
let compose;

try {
  if (createdLocalEnvironment) {
    fs.writeFileSync(localEnvironmentPath, "# CI-only Compose placeholder\n");
  }

  compose = spawnSync(
    "docker",
    ["compose", "--env-file", ".env.local", "config", "--format", "json"],
    { cwd: root, encoding: "utf8", env: composeEnvironment },
  );
} finally {
  if (createdLocalEnvironment) {
    fs.rmSync(localEnvironmentPath);
  }
}

assert.equal(compose.status, 0, "Compose config must resolve");
const workerEnvironment = JSON.parse(compose.stdout).services.worker.environment;
for (const required of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VELTO_INTERNAL_WORKER_TOKEN",
  "VELTO_INTERNAL_BASE_URL",
]) {
  assert.ok(required in workerEnvironment, `worker must receive ${required}`);
}
for (const forbidden of [
  "OPENAI_API_KEY",
  "RUNWAY_API_KEY",
  "RUNWAYML_API_SECRET",
  "RUNWAYML_API_KEY",
  "VEO_API_KEY",
  "GEMINI_API_KEY",
  "ELEVENLABS_API_KEY",
  "EPIDEMIC_SOUND_API_KEY",
  "YOUTUBE_API_KEY",
  "CREATOR_ACCESS_TOKEN",
]) {
  assert.ok(!(forbidden in workerEnvironment), `worker must not receive ${forbidden}`);
}

const composeSource = fs.readFileSync("compose.yaml", "utf8");
const workerSection = composeSource.slice(composeSource.indexOf("  worker:"));
assert.doesNotMatch(workerSection, /env_file:/);
const dockerfile = fs.readFileSync("Dockerfile", "utf8");
assert.doesNotMatch(dockerfile, /ENV VELTO_(?:QUEUE|WORKER|FIN)_/);

console.log("Stage 0.8D-A runtime configuration regression passed.");
