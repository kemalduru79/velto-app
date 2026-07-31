import { constants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";

export type RuntimeHealthMode = "live" | "ready";

type EnvironmentGroup = {
  key: string;
  alternatives: readonly string[];
};

const CORE_ENVIRONMENT_GROUPS: readonly EnvironmentGroup[] = [
  {
    key: "supabaseUrl",
    alternatives: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  },
  {
    key: "supabaseAnonKey",
    alternatives: ["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    key: "supabaseServiceRole",
    alternatives: ["SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    key: "openAi",
    alternatives: ["OPENAI_API_KEY"],
  },
];

function hasConfiguredValue(names: readonly string[]) {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

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

export async function getRuntimeHealth(mode: RuntimeHealthMode) {
  const environmentChecks = Object.fromEntries(
    CORE_ENVIRONMENT_GROUPS.map((group) => [
      group.key,
      hasConfiguredValue(group.alternatives),
    ]),
  ) as Record<string, boolean>;
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
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
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
