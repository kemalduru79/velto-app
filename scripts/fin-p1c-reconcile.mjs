function integerArg(name, fallback, min, max) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix));
  const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.round(parsed), max));
}

const batchLimit = integerArg("limit", 200, 1, 1000);
const staleJobMinutes = integerArg("stale-minutes", 10, 1, 1440);
const apply = process.argv.includes("--apply");

if (!apply) {
  console.log(
    JSON.stringify(
      {
        mode: "NO_MUTATION",
        mutation: "velto_fin_reconcile",
        batchLimit,
        staleJobMinutes,
        requiredFlag: "--apply",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "FIN-P1C requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data, error } = await supabase.rpc("velto_fin_reconcile", {
  p_batch_limit: batchLimit,
  p_stale_job_minutes: staleJobMinutes,
  p_source: "admin_script",
});

if (error) {
  console.error(`FIN-P1C reconciliation failed: ${error.message}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      batchLimit,
      staleJobMinutes,
      result: data,
    },
    null,
    2,
  ),
);
