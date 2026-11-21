import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const checks = [
  [
    "supabase/migrations/20260730120000_fin_p1c_credit_reconciliation.sql",
    [
      "velto_credit_expire_reservations",
      "velto_credit_mark_provider_dispatch",
      "velto_fin_reconcile",
      "IDEMPOTENCY_KEY_CONFLICT",
      "idempotency_replay",
    ],
  ],
  [
    "lib/credits/serverMetering.ts",
    [
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      "markMeteredOperationProviderDispatch",
    ],
  ],
  [
    "app/api/creator-video/route.ts",
    ["markMeteredOperationProviderDispatch", "providerTaskAcceptedAt"],
  ],
  [
    "lib/worker/runtime.mjs",
    ["velto_fin_reconcile"],
  ],
  [
    "lib/worker/runtimeConfig.mjs",
    ["VELTO_FIN_RECONCILE_INTERVAL_MS"],
  ],
  [
    "scripts/fin-p1c-reconcile.mjs",
    ["--apply", "NO_MUTATION", "velto_fin_reconcile", "admin_script"],
  ],
];

for (const [relativePath, markers] of checks) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing FIN-P1C file: ${relativePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");

  for (const marker of markers) {
    if (!content.includes(marker)) {
      throw new Error(`Missing FIN-P1C marker ${marker} in ${relativePath}`);
    }
  }
}

const preview = spawnSync(
  process.execPath,
  ["scripts/fin-p1c-reconcile.mjs", "--limit=9999", "--stale-minutes=0"],
  {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "" },
  },
);
if (preview.status !== 0) throw new Error(`FIN preview failed: ${preview.stderr}`);
const previewBody = JSON.parse(preview.stdout);
if (
  previewBody.mode !== "NO_MUTATION" ||
  previewBody.mutation !== "velto_fin_reconcile" ||
  previewBody.batchLimit !== 1000 ||
  previewBody.staleJobMinutes !== 1 ||
  previewBody.requiredFlag !== "--apply"
) throw new Error("FIN preview contract changed.");

console.log("FIN-P1C smoke verification passed.");
