import { constants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import {
  CORE_ENVIRONMENT_GROUPS,
  getCoreEnvironmentChecks,
} from "./coreEnvironment.mjs";

export type RuntimeHealthMode = "live" | "ready";

async function isTempDirectoryWritable() {
  try {
    await access(os.tmpdir(), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function normalizeRuntimeHealthMode(
  value: string | null,
): RuntimeHealthMode {
  return value === "ready" ? "ready" : "live";
}

export async function getRuntimeHealth(
  mode: RuntimeHealthMode,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const environmentChecks = getCoreEnvironmentChecks(
    "web",
    environment,
  ) as Record<
    (typeof CORE_ENVIRONMENT_GROUPS.web)[number]["key"],
    boolean
  >;
  const tempWritable = await isTempDirectoryWritable();
  const checks = {
    ...environmentChecks,
    tempWritable,
  };
  const missing = Object.entries(checks)
    .filter(([, configured]) => !configured)
    .map(([key]) => key);
  const ready = missing.length === 0;
  const release =
    environment.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    environment.GIT_COMMIT_SHA?.slice(0, 12) ||
    environment.NEXT_PUBLIC_APP_VERSION ||
    "local";

  return {
    ok: mode === "live" ? true : ready,
    mode,
    status: mode === "live" ? "alive" : ready ? "ready" : "not_ready",
    checkedAt: new Date().toISOString(),
    release,
    runtime: {
      node: process.version,
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      stateless: true,
      tempDirectory: os.tmpdir(),
      tempWritable,
    },
    checks,
    missing,
  };
}
