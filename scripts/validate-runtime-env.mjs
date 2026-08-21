const mode = process.argv[2] === "worker" ? "worker" : "web";

const groups = {
  web: [
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
  ],
  worker: [
    {
      key: "supabaseUrl",
      alternatives: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    },
    {
      key: "supabaseServiceRole",
      alternatives: ["SUPABASE_SERVICE_ROLE_KEY"],
    },
    {
      key: "internalWorkerToken",
      alternatives: ["VELTO_INTERNAL_WORKER_TOKEN"],
    },
  ],
};

function configured(names) {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

function configuredValue(names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const requiredGroups = groups[mode];
const missing = requiredGroups
  .filter((group) => !configured(group.alternatives))
  .map((group) => group.key);

const invalid = [];
const supabaseUrl = configuredValue([
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);

if (supabaseUrl && !validateUrl(supabaseUrl)) {
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
