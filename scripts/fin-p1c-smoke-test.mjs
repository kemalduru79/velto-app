import fs from "node:fs";
import path from "node:path";

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
  ["scripts/fin-p1c-reconcile.mjs", ["admin_script"]],
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

console.log("FIN-P1C smoke verification passed.");
