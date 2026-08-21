import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireText(file, values) {
  const content = read(file);
  for (const value of values) {
    if (!content.includes(value)) {
      throw new Error(`${file} is missing required marker: ${value}`);
    }
  }
}

requireText("next.config.ts", ['output: "standalone"']);
requireText("next.config.ts", [
  '"/api/stitch-video"',
  '"./node_modules/ffmpeg-static/**/*"',
  '"./node_modules/ffprobe-static/**/*"',
]);
requireText("app/api/stitch-video/route.ts", [
  'import ffmpegPath from "ffmpeg-static"',
  'import ffprobeStatic from "ffprobe-static"',
  "execFile(ffmpegExecutable",
  "execFile(ffprobeExecutable",
]);
requireText("Dockerfile", [
  "AS builder",
  "AS runner",
  "AS worker",
  "USER nextjs",
  "USER node",
  "HEALTHCHECK",
  "STOPSIGNAL SIGTERM",
  "validate-runtime-env.mjs web",
  "validate-runtime-env.mjs worker",
  "/tmp/velto-next-cache",
  "COPY package.json package-lock.json ./",
  "RUN npm ci",
  "require('ffprobe-static').path",
]);
requireText("compose.yaml", [
  "read_only: true",
  "tmpfs:",
  "no-new-privileges:true",
  "stop_grace_period:",
  "/api/runtime-health?mode=ready",
]);
requireText("app/api/runtime-health/route.ts", [
  "await getRuntimeHealth(mode)",
  '"Cache-Control": "no-store, max-age=0"',
]);
requireText("lib/runtime/runtimeHealth.ts", [
  "tempWritable",
  "stateless: true",
]);
requireText(".gitignore", ["!.env.container.example"]);
requireText(".env.container.example", [
  "NEXT_PUBLIC_SUPABASE_URL=",
  "SUPABASE_SERVICE_ROLE_KEY=",
  "OPENAI_API_KEY=",
  "VELTO_DATABASE_DRIVER=supabase",
  "VELTO_STORAGE_DRIVER=supabase",
  "VELTO_INTERNAL_WORKER_TOKEN=",
]);

const baseEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  OPENAI_API_KEY: "test-openai-key",
  VELTO_INTERNAL_WORKER_TOKEN: "test-worker-token",
};

for (const mode of ["web", "worker"]) {
  const result = spawnSync(
    process.execPath,
    ["scripts/validate-runtime-env.mjs", mode],
    { cwd: root, env: baseEnv, encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Runtime environment validation failed for ${mode}: ${result.stderr}`,
    );
  }
}

const invalid = spawnSync(
  process.execPath,
  ["scripts/validate-runtime-env.mjs", "web"],
  {
    cwd: root,
    env: {
      ...baseEnv,
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    encoding: "utf8",
  },
);

if (invalid.status === 0) {
  throw new Error("Runtime validation accepted a missing service-role key.");
}

const invalidWorker = spawnSync(
  process.execPath,
  ["scripts/validate-runtime-env.mjs", "worker"],
  {
    cwd: root,
    env: {
      ...baseEnv,
      VELTO_INTERNAL_WORKER_TOKEN: "",
    },
    encoding: "utf8",
  },
);

if (invalidWorker.status === 0) {
  throw new Error("Runtime validation accepted a missing internal worker token.");
}

if (invalidWorker.stderr.includes("test-worker-token")) {
  throw new Error("Runtime validation exposed the internal worker token.");
}

console.log("RUN-P1 static verification passed.");
