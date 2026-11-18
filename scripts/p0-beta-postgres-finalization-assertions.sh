# Sourced by p0-beta-postgres-race-test.sh inside its isolated DB.
stage="SETTLEMENT"

settle=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000002',
'p0:race:a',repeat('a',64),
'SETTLE',1500000,repeat('f',64),
'PROVIDER_BILLING_CONFIRMED');")

test "$settle" = SETTLED

budget=$(pg -c "
SELECT held_micro_usd || ':' || settled_micro_usd
FROM public.velto_beta_provider_budget_limits
WHERE owner_user_id =
'00000000-0000-4000-8000-000000000002';")

test "$budget" = "0:1500000"
echo "PASS: VERIFIED_SETTLEMENT_ACCOUNTED"

stage="FINALIZATION_NEGATIVES"

repeat_result=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000002',
'p0:race:a',repeat('a',64),
'SETTLE',1500000,repeat('f',64),
'PROVIDER_BILLING_CONFIRMED');")

test "$repeat_result" = DENIED_ALREADY_FINALIZED

wrong_owner=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:race:a',repeat('a',64),
'SETTLE',1500000,repeat('f',64),
'PROVIDER_BILLING_CONFIRMED');")

test "$wrong_owner" = DENIED_NOT_FOUND_OR_OWNERSHIP
echo "PASS: REPEAT_AND_CROSS_OWNER_DENIED"

stage="RELEASE"

invalid_release=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:smoke',repeat('c',64),
'RELEASE',0,repeat('d',64),
'AMBIGUOUS');")

test "$invalid_release" = DENIED_INVALID_REQUEST

released=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:smoke',repeat('c',64),
'RELEASE',0,repeat('d',64),
'NO_DISPATCH_CONFIRMED');")

test "$released" = RELEASED
echo "PASS: VERIFIED_ZERO_COST_RELEASE"

stage="OVERCOST_AND_AMBIGUITY"

reserved=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000003',
'p0:pending',repeat('b',64),1500000);")

test "$reserved" = RESERVED

overcost=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:pending',repeat('b',64),
'SETTLE',2000000,repeat('e',64),
'PROVIDER_BILLING_CONFIRMED');")

test "$overcost" = DENIED_COST_EXCEEDS_HOLD

ambiguous=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:pending',repeat('b',64),
'RELEASE',0,repeat('e',64),
'AMBIGUOUS');")

test "$ambiguous" = DENIED_INVALID_REQUEST

state=$(pg -c "
SELECT state || ':' || upper_bound_micro_usd
FROM public.velto_beta_provider_budget_reservations
WHERE attempt_key = 'p0:pending';")

test "$state" = "HELD:1500000"
echo "PASS: OVERCOST_AND_AMBIGUITY_REMAIN_HELD"

stage="FINALIZATION_RACE_SETUP"

reserved=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000003',
'p0:finalrace',repeat('9',64),1000000);")

test "$reserved" = RESERVED

stage="FINALIZATION_RACE_A"

pg >"$tmp/final_a.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:finalrace',repeat('9',64),
'SETTLE',700000,repeat('8',64),
'PROVIDER_BILLING_CONFIRMED');
SELECT pg_sleep(5);
COMMIT;
SQL
final_a_pid=$!

stage="FINALIZATION_A_WAIT"

active=0
for i in {1..40}; do
  n=$(pg -c "
SELECT count(*) FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND state = 'active'
AND query LIKE 'SELECT pg_sleep(5)%';")

  if [ "$n" -ge 1 ]; then
    active=1
    break
  fi
  sleep 0.1
done

test "$active" = 1

stage="FINALIZATION_RACE_B"

pg >"$tmp/final_b.log" 2>&1 -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:finalrace',repeat('9',64),
'RELEASE',0,repeat('7',64),
'PROVIDER_ZERO_CHARGE_CONFIRMED');" &
final_b_pid=$!

stage="FINALIZATION_LOCK"

locked=0
for i in {1..40}; do
  n=$(pg -c "
SELECT count(*) FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND wait_event_type = 'Lock'
AND query LIKE '%p0:finalrace%';")

  if [ "$n" -ge 1 ]; then
    locked=1
    break
  fi
  sleep 0.1
done

test "$locked" = 1

wait "$final_a_pid"
wait "$final_b_pid"

grep -qxF SETTLED "$tmp/final_a.log"
grep -qxF DENIED_ALREADY_FINALIZED "$tmp/final_b.log"

final_state=$(pg -c "
SELECT state || ':' || final_cost_micro_usd
FROM public.velto_beta_provider_budget_reservations
WHERE attempt_key = 'p0:finalrace';")

test "$final_state" = "SETTLED:700000"
echo "PASS: CONCURRENT_FINALIZATION_SINGLE_WINNER"

stage="FINALIZATION_ROLE_SECURITY"

for role in anon authenticated; do
  if pg -c "
SET ROLE $role;
SELECT public.velto_beta_budget_finalize_v1(
'00000000-0000-4000-8000-000000000003',
'p0:pending',repeat('b',64),
'RELEASE',0,repeat('e',64),
'NO_DISPATCH_CONFIRMED');" \
    >"$tmp/final_${role}.log" 2>&1; then
    echo "FAIL: Unauthorized finalization by $role"
    exit 1
  fi

  grep -qi "permission denied" "$tmp/final_${role}.log"
done

echo "PASS: FINALIZATION_PUBLIC_ROLES_DENIED"
echo "P0_REAL_POSTGRES_FINALIZATION=PASS"
