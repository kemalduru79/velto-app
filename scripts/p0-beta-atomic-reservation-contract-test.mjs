import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "docs/p0/BETA_ATOMIC_RESERVATION_REVIEW.sql",
  "utf8"
);

const required = [
  ["row lock", /for update\s*;/i],
  ["unique attempt", /attempt_key text primary key/i],
  ["one-time insert", /on conflict \(attempt_key\) do nothing/i],
  ["atomic hold", /set held_micro_usd = held_micro_usd \+ p_cost_upper_bound_micro_usd/i],
  ["hard cap", /cap_micro_usd -\s*v_budget\.settled_micro_usd -\s*v_budget\.held_micro_usd/i],
  ["private role", /grant execute on function public\.velto_beta_budget_reserve_v1\(\s*uuid, text, text, bigint\s*\)\s*to service_role/i],
  ["revocation", /revoke all on function public\.velto_beta_budget_reserve_v1\(\s*uuid, text, text, bigint\s*\)\s*from public, anon, authenticated/i],
  ["invoker", /security invoker\s+set search_path = ''/i],
  ["missing budget denial", /DENIED_NO_AUTHORIZED_BUDGET/],
  ["duplicate denial", /DENIED_DUPLICATE_ATTEMPT/],
  ["review only", /REVIEW ONLY\. Do not apply/],
];

const inspect = source =>
  required.filter(([_, pattern]) => !pattern.test(source))
    .map(([name]) => name);

assert.deepEqual(inspect(sql), []);
assert.doesNotMatch(sql, /security definer/i);

const mutations = [
  sql.replace("for update;", ";"),
  sql.replace("on conflict (attempt_key) do nothing", ""),
  sql.replace("security invoker", "security definer"),
  sql.replace(") to service_role;", ") to authenticated;"),
];

for (const candidate of mutations) {
  assert.ok(
    inspect(candidate).length > 0 ||
      /security definer/i.test(candidate),
    "Negative mutation escaped"
  );
}

console.log(
  `P0_BETA_ATOMIC_SQL_STATIC_CONTRACT=${required.length}/${required.length} PASS`
);
console.log(
  `NEGATIVE_MUTATIONS=${mutations.length}/${mutations.length} DETECTED`
);
console.log("POSTGRES_CONCURRENCY_TEST=NOT_RUN");
console.log("DATABASE_SCHEMA_APPLIED=NO");
console.log("PROVIDER_DISPATCH_WIRED=NO");
