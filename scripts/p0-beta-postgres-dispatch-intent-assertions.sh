# Sourced by the existing isolated PostgreSQL test harness.
# pg(), tmp, and stage are provided by that harness.

stage="DISPATCH_INTENT_FIXTURE"

pg <<'SQL'
insert into auth.users(id)
values ('00000000-0000-4000-8000-0000000000d0');

insert into public.velto_beta_provider_budget_limits
  (owner_user_id, cap_micro_usd)
values ('00000000-0000-4000-8000-0000000000d0', 3000000);
SQL

OWNER="'00000000-0000-4000-8000-0000000000d0'"
SHA="repeat('a',64)"
EVIDENCE="repeat('b',64)"

stage="DISPATCH_INTENT_RESERVE"

result=$(pg -c "
  select public.velto_beta_budget_reserve_v1(
    $OWNER, 'p0.dispatch.1', $SHA, 1000000
  );
")
test "$result" = RESERVED

stage="DISPATCH_WRONG_HASH"

result=$(pg -c "
  select public.velto_beta_budget_begin_dispatch_v1(
    $OWNER, 'p0.dispatch.1', repeat('c',64), 'runway'
  );
")
test "$result" = DENIED_REQUEST_IDENTITY_MISMATCH
echo "PASS: DISPATCH_IDENTITY_MISMATCH_DENIED"

stage="DISPATCH_BEGIN"

result=$(pg -c "
  select public.velto_beta_budget_begin_dispatch_v1(
    $OWNER, 'p0.dispatch.1', $SHA, 'runway'
  );
")
test "$result" = DISPATCH_STARTED
echo "PASS: DURABLE_DISPATCH_INTENT_STARTED"

stage="DISPATCH_DUPLICATE"

result=$(pg -c "
  select public.velto_beta_budget_begin_dispatch_v1(
    $OWNER, 'p0.dispatch.1', $SHA, 'runway'
  );
")
test "$result" = DENIED_DUPLICATE_DISPATCH
echo "PASS: DUPLICATE_DISPATCH_DENIED"

stage="DISPATCH_FALSE_RELEASE"

if pg -c "
  select public.velto_beta_budget_finalize_v1(
    $OWNER, 'p0.dispatch.1', $SHA,
    'RELEASE', 0, $EVIDENCE, 'NO_DISPATCH_CONFIRMED'
  );
" > "$tmp/p0-false-release.out" \
  2> "$tmp/p0-false-release.err"; then
  echo "FAIL: False no-dispatch release unexpectedly succeeded"
  exit 1
fi

grep -q "P0_DISPATCH_STARTED_CANNOT_CONFIRM_NO_DISPATCH" \
  "$tmp/p0-false-release.err"

state=$(pg -c "
  select state
    from public.velto_beta_provider_budget_reservations
   where attempt_key = 'p0.dispatch.1';
")
test "$state" = HELD
echo "PASS: FALSE_NO_DISPATCH_RELEASE_FENCED"

stage="DISPATCH_ACCEPTANCE"

result=$(pg -c "
  select public.velto_beta_budget_accept_dispatch_v1(
    $OWNER, 'p0.dispatch.1', $SHA, 'test-runway-task-1'
  );
")
test "$result" = PROVIDER_ACCEPTED

result=$(pg -c "
  select public.velto_beta_budget_accept_dispatch_v1(
    $OWNER, 'p0.dispatch.1', $SHA, 'test-runway-task-1'
  );
")
test "$result" = DENIED_DUPLICATE_ACCEPT

state=$(pg -c "
  select state || ':' || native_task_id
    from public.velto_beta_provider_dispatch_intents
   where attempt_key = 'p0.dispatch.1';
")
test "$state" = "PROVIDER_ACCEPTED:test-runway-task-1"
echo "PASS: PROVIDER_TASK_PERSISTED_ONCE"

stage="DISPATCH_CONCURRENT_FIXTURE"

result=$(pg -c "
  select public.velto_beta_budget_reserve_v1(
    $OWNER, 'p0.dispatch.race', $SHA, 1000000
  );
")
test "$result" = RESERVED

stage="DISPATCH_CONCURRENT_BEGIN"

pg -c "
  select public.velto_beta_budget_begin_dispatch_v1(
    $OWNER, 'p0.dispatch.race', $SHA, 'runway'
  );
" > "$tmp/p0-dispatch-race-a" &
pid_a=$!

pg -c "
  select public.velto_beta_budget_begin_dispatch_v1(
    $OWNER, 'p0.dispatch.race', $SHA, 'runway'
  );
" > "$tmp/p0-dispatch-race-b" &
pid_b=$!

wait "$pid_a"
wait "$pid_b"

combined=$(cat "$tmp/p0-dispatch-race-a" "$tmp/p0-dispatch-race-b")

test "$(printf '%s\n' "$combined" |
  grep -c '^DISPATCH_STARTED$')" = 1

test "$(printf '%s\n' "$combined" |
  grep -c '^DENIED_DUPLICATE_DISPATCH$')" = 1

count=$(pg -c "
  select count(*)
    from public.velto_beta_provider_dispatch_intents
   where attempt_key = 'p0.dispatch.race';
")
test "$count" = 1
echo "PASS: CONCURRENT_DISPATCH_SINGLE_WINNER"

stage="DISPATCH_PUBLIC_ROLE_DENIED"

if pg -c "
  set role anon;
  select public.velto_beta_budget_begin_dispatch_v1(
    $OWNER, 'p0.dispatch.race', $SHA, 'runway'
  );
" > "$tmp/p0-dispatch-anon.out" \
  2> "$tmp/p0-dispatch-anon.err"; then
  echo "FAIL: anon role unexpectedly called dispatch RPC"
  exit 1
fi
echo "PASS: PUBLIC_ROLE_DISPATCH_DENIED"

echo "P0_REAL_POSTGRES_DISPATCH_INTENT=PASS"
