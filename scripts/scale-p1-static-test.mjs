import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "scripts/scale-worker.mjs",
  "scripts/scale-p1-smoke-test.mjs",
  "scripts/scale-p1-multi-worker-test.mjs",
  "supabase/migrations/20260730_scale_p1_job_queue.sql",
  "supabase/migrations/20260731_scale_p1_worker_hardening.sql",
  "app/api/jobs/health/route.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`SCALE-P1 required file is missing: ${file}`);
  }
}

const worker = fs.readFileSync(path.join(root, "scripts/scale-worker.mjs"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260731_scale_p1_worker_hardening.sql"),
  "utf8",
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

const workerMarkers = [
  "VELTO_SCALE_P1",
  "velto_job_heartbeat",
  "velto_worker_heartbeat",
  "retryDelayForAttempt",
  "no new jobs will be claimed",
];

for (const marker of workerMarkers) {
  if (!worker.includes(marker)) {
    throw new Error(`SCALE-P1 worker marker is missing: ${marker}`);
  }
}

const migrationMarkers = [
  "create table if not exists public.velto_workers",
  "velto_worker_heartbeat",
  "velto_worker_stop",
  "velto_job_queue_health",
];

for (const marker of migrationMarkers) {
  if (!migration.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`SCALE-P1 migration marker is missing: ${marker}`);
  }
}

for (const scriptName of [
  "worker:scale",
  "test:scale-p1",
  "test:scale-p1:multi",
  "test:scale-p1:static",
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`SCALE-P1 package script is missing: ${scriptName}`);
  }
}

console.log("SCALE-P1 static verification passed.");
