export const CORE_ENVIRONMENT_GROUPS = Object.freeze({
  web: Object.freeze([
    Object.freeze({
      key: "supabaseUrl",
      alternatives: Object.freeze(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    }),
    Object.freeze({
      key: "supabaseAnonKey",
      alternatives: Object.freeze([
        "SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ]),
    }),
    Object.freeze({
      key: "supabaseServiceRole",
      alternatives: Object.freeze(["SUPABASE_SERVICE_ROLE_KEY"]),
    }),
    Object.freeze({
      key: "openAi",
      alternatives: Object.freeze(["OPENAI_API_KEY"]),
    }),
  ]),
  worker: Object.freeze([
    Object.freeze({
      key: "supabaseUrl",
      alternatives: Object.freeze(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    }),
    Object.freeze({
      key: "supabaseServiceRole",
      alternatives: Object.freeze(["SUPABASE_SERVICE_ROLE_KEY"]),
    }),
    Object.freeze({
      key: "internalWorkerToken",
      alternatives: Object.freeze(["VELTO_INTERNAL_WORKER_TOKEN"]),
    }),
  ]),
});

export const SUPABASE_SERVER_ENVIRONMENT = Object.freeze({
  url: Object.freeze(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
  anonKey: Object.freeze([
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]),
  serviceRole: Object.freeze(["SUPABASE_SERVICE_ROLE_KEY"]),
});

export function resolveConfiguredValue(environment, names) {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) return value;
  }

  return "";
}

export function hasConfiguredValue(environment, names) {
  return Boolean(resolveConfiguredValue(environment, names));
}

export function isValidRuntimeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getCoreEnvironmentChecks(mode, environment = process.env) {
  return Object.fromEntries(
    CORE_ENVIRONMENT_GROUPS[mode].map((group) => [
      group.key,
      hasConfiguredValue(environment, group.alternatives),
    ]),
  );
}
