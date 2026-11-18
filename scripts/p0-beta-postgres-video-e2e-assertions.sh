# Sourced inside the existing isolated PostgreSQL harness.
# All task IDs and billing evidence below are synthetic fixtures.

stage="VIDEO_E2E_SETUP"

pg <<'SQL'
insert into auth.users(id)
values ('00000000-0000-4000-8000-0000000000e0');

insert into public.velto_beta_provider_budget_limits
  (owner_user_id, cap_micro_usd)
values ('00000000-0000-4000-8000-0000000000e0', 3000000);
SQL

OWNER="'00000000-0000-4000-8000-0000000000e0'"
SHA="repeat('a',64)"
EVIDENCE="repeat('c',64)"

stage="VIDEO_E2E_SUCCESS"

test "$(pg -c "
select public.velto_beta_budget_reserve_v1(
  $OWNER, 'p0.video.e2e.success', $SHA, 1200000
);")" = RESERVED

test "$(pg -c "
select public.velto_beta_budget_begin_dispatch_v1(
  $OWNER, 'p0.video.e2e.success', $SHA, 'runway'
);")" = DISPATCH_STARTED

# Synthetic provider acknowledgement; no network call.
test "$(pg -c "
select public.velto_beta_budget_accept_dispatch_v1(
  $OWNER, 'p0.video.e2e.success', $SHA,
  'fixture-runway-task-e0-1'
);")" = PROVIDER_ACCEPTED

test "$(pg -c "
select public.velto_beta_budget_finalize_v1(
  $OWNER, 'p0.video.e2e.success', $SHA,
  'SETTLE', 1200000, $EVIDENCE,
  'PROVIDER_BILLING_CONFIRMED'
);")" = SETTLED

state=$(pg -c "
select r.state || ':' || d.state || ':' || d.native_task_id
from public.velto_beta_provider_budget_reservations r
join public.velto_beta_provider_dispatch_intents d
  on d.attempt_key = r.attempt_key
where r.attempt_key = 'p0.video.e2e.success';
")

test "$state" = \
  "SETTLED:PROVIDER_ACCEPTED:fixture-runway-task-e0-1"

echo "PASS: E2E_RESERVE_DISPATCH_ACCEPT_SETTLE"

stage="VIDEO_E2E_NO_DISPATCH"

test "$(pg -c "
select public.velto_beta_budget_reserve_v1(
  $OWNER, 'p0.video.e2e.no_dispatch', $SHA, 300000
);")" = RESERVED

pg -c "
select public.velto_beta_budget_finalize_v1(
  $OWNER, 'p0.video.e2e.no_dispatch', $SHA,
  'RELEASE', 0, $EVIDENCE,
  'NO_DISPATCH_CONFIRMED'
);" > "$tmp/video-e2e-no-dispatch.out"

state=$(pg -c "
select state from public.velto_beta_provider_budget_reservations
where attempt_key = 'p0.video.e2e.no_dispatch';
")

test "$state" = RELEASED

count=$(pg -c "
select count(*) from public.velto_beta_provider_dispatch_intents
where attempt_key = 'p0.video.e2e.no_dispatch';
")

test "$count" = 0

echo "PASS: E2E_PRE_DISPATCH_ZERO_COST_RELEASE"

stage="VIDEO_E2E_UNCERTAIN"

test "$(pg -c "
select public.velto_beta_budget_reserve_v1(
  $OWNER, 'p0.video.e2e.uncertain', $SHA, 500000
);")" = RESERVED

test "$(pg -c "
select public.velto_beta_budget_begin_dispatch_v1(
  $OWNER, 'p0.video.e2e.uncertain', $SHA, 'runway'
);")" = DISPATCH_STARTED

if pg -c "
select public.velto_beta_budget_finalize_v1(
  $OWNER, 'p0.video.e2e.uncertain', $SHA,
  'RELEASE', 0, $EVIDENCE,
  'NO_DISPATCH_CONFIRMED'
);" > "$tmp/video-e2e-false-release.out" \
  2> "$tmp/video-e2e-false-release.err"; then
  echo "FAIL: uncertain dispatch was released"
  exit 1
fi

grep -q \
  "P0_DISPATCH_STARTED_CANNOT_CONFIRM_NO_DISPATCH" \
  "$tmp/video-e2e-false-release.err"

state=$(pg -c "
select r.state || ':' || d.state
from public.velto_beta_provider_budget_reservations r
join public.velto_beta_provider_dispatch_intents d
  on d.attempt_key = r.attempt_key
where r.attempt_key = 'p0.video.e2e.uncertain';
")

test "$state" = "HELD:DISPATCH_STARTED"

echo "PASS: E2E_UNCERTAIN_DISPATCH_RETAINS_HOLD"

stage="VIDEO_E2E_BUDGET_RECONCILIATION"

budget=$(pg -c "
select cap_micro_usd || ':' ||
       settled_micro_usd || ':' ||
       held_micro_usd
from public.velto_beta_provider_budget_limits
where owner_user_id = $OWNER;
")

test "$budget" = "3000000:1200000:500000"

echo "PASS: E2E_BUDGET_TOTALS_CONSISTENT"
echo "P0_REAL_POSTGRES_VIDEO_E2E=PASS"
echo "BILLING_EVIDENCE=SYNTHETIC_FIXTURE_ONLY"
echo "ACTUAL_PROVIDER_CALLS=0"
