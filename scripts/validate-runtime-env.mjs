import {
  CORE_ENVIRONMENT_GROUPS,
  SUPABASE_SERVER_ENVIRONMENT,
  getCoreEnvironmentChecks,
  isValidRuntimeUrl,
  resolveConfiguredValue,
} from "../lib/runtime/coreEnvironment.mjs";

const mode = process.argv[2] === "worker" ? "worker" : "web";

const checks = getCoreEnvironmentChecks(mode, process.env);
const missing = CORE_ENVIRONMENT_GROUPS[mode]
  .filter((group) => !checks[group.key])
  .map(({ key }) => key);

const invalid = [];
const supabaseUrl = resolveConfiguredValue(
  process.env,
  SUPABASE_SERVER_ENVIRONMENT.url,
);

if (supabaseUrl && !isValidRuntimeUrl(supabaseUrl)) {
  invalid.push("supabaseUrl");
}

for (const [name, fallback] of [
  ["VELTO_DATABASE_DRIVER", "supabase"],
  ["VELTO_STORAGE_DRIVER", "supabase"],
]) {
  const value = (process.env[name] || fallback).trim().toLowerCase();
  if (value !== "supabase") invalid.push(name);
}

if (missing.length || invalid.length) {
  console.error(
    JSON.stringify({
      type: "velto_runtime_configuration_error",
      mode,
      missing,
      invalid,
    }),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    type: "velto_runtime_configuration_valid",
    mode,
    databaseDriver: (process.env.VELTO_DATABASE_DRIVER || "supabase")
      .trim()
      .toLowerCase(),
    storageDriver: (process.env.VELTO_STORAGE_DRIVER || "supabase")
      .trim()
      .toLowerCase(),
  }),
);
