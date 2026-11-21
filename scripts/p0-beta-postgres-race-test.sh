#!/usr/bin/env bash
set -Eeuo pipefail

stage="INITIAL_CHECK"
cid=""
tmp=$(mktemp -d)

cleanup() {
  rc=$?
  trap - EXIT

  if [ "$rc" -ne 0 ]; then
    echo "P0_POSTGRES_TEST_FAILED_AT=$stage"
    for f in "$tmp"/*.log; do
      if [ -f "$f" ]; then
        echo "=== $(basename "$f") ==="
        tail -20 "$f"
      fi
    done
    if [ -n "$cid" ]; then
      docker logs --tail 15 "$cid" 2>&1 || true
    fi
  fi

  if [ -n "$cid" ]; then
    docker rm -f "$cid" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp"
  exit "$rc"
}
trap cleanup EXIT

echo "P0_POSTGRES_TEST_STARTED"

test "$(git branch --show-current)" = \
  "local/velto-p0-issue49-parallel-20261118"
git merge-base --is-ancestor 6622d59 HEAD
test -f docs/p0/BETA_ATOMIC_RESERVATION_REVIEW.sql
docker image inspect postgres:17-alpine >/dev/null

stage="CONTAINER_START"
cid=$(docker run -d --rm --pull=never \
  --network none --read-only \
  --memory 512m --cpus 1 --pids-limit 128 \
  --tmpfs /var/lib/postgresql/data:rw,size=256m \
  --tmpfs /var/run/postgresql:rw,size=16m \
  --tmpfs /tmp:rw,size=64m \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=velto_p0_lab \
  postgres:17-alpine)

pg() {
  docker exec -i "$cid" psql \
    -h 127.0.0.1 -U postgres -d velto_p0_lab \
    -X -qAt -v ON_ERROR_STOP=1 "$@"
}

stage="DATABASE_READY"
ready=0
for i in {1..100}; do
  if [ "$(pg -c 'SELECT 1;' 2>/dev/null || true)" = "1" ]; then
    ready=1
    break
  fi
  sleep 0.2
done
test "$ready" = 1
echo "PASS: FINAL_POSTGRES_READY"

stage="SCHEMA"
pg <<'SQL'
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

INSERT INTO auth.users(id) VALUES
('00000000-0000-4000-8000-000000000002'),
('00000000-0000-4000-8000-000000000003'),
('00000000-0000-4000-8000-000000000004');
SQL

pg < docs/p0/BETA_ATOMIC_RESERVATION_REVIEW.sql
pg < docs/p0/BETA_ATOMIC_FINALIZATION_REVIEW.sql
pg < docs/p0/BETA_ATOMIC_DISPATCH_INTENT_REVIEW.sql

pg <<'SQL'
INSERT INTO public.velto_beta_provider_budget_limits
(owner_user_id, cap_micro_usd)
VALUES
('00000000-0000-4000-8000-000000000002', 3000000),
('00000000-0000-4000-8000-000000000003', 3000000);
SQL

echo "PASS: SQL_SCHEMA_APPLIED"

stage="AUTHORIZED_RESERVATION"
result=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000003',
'p0:smoke',repeat('c',64),500000);")
test "$result" = RESERVED
echo "PASS: SERVICE_ROLE_RESERVATION"

stage="CONCURRENT_A"
pg >"$tmp/a.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000002',
'p0:race:a',repeat('a',64),2000000);
SELECT pg_sleep(10);
COMMIT;
SQL
pid_a=$!

stage="A_SYNCHRONIZATION"
active=0
for i in {1..70}; do
  count=$(pg -c "
SELECT count(*) FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND state = 'active'
AND query LIKE 'SELECT pg_sleep(10)%';")
  if [ "$count" -ge 1 ]; then
    active=1
    break
  fi
  sleep 0.1
done
test "$active" = 1
echo "PASS: TRANSACTION_A_HELD_OPEN"

stage="CONCURRENT_B"
pg >"$tmp/b.log" 2>&1 -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000002',
'p0:race:b',repeat('b',64),2000000);" &
pid_b=$!

stage="ROW_LOCK"
locked=0
for i in {1..70}; do
  count=$(pg -c "
SELECT count(*) FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND wait_event_type = 'Lock'
AND query LIKE '%p0:race:b%';")
  if [ "$count" -ge 1 ]; then
    locked=1
    break
  fi
  sleep 0.1
done
test "$locked" = 1
echo "PASS: POSTGRES_ROW_LOCK_OBSERVED"

stage="CONCURRENT_RESULTS"
wait "$pid_a"
wait "$pid_b"

grep -qxF RESERVED "$tmp/a.log"
grep -qxF DENIED_HARD_CAP "$tmp/b.log"

held=$(pg -c "
SELECT held_micro_usd
FROM public.velto_beta_provider_budget_limits
WHERE owner_user_id =
'00000000-0000-4000-8000-000000000002';")

rows=$(pg -c "
SELECT count(*)
FROM public.velto_beta_provider_budget_reservations
WHERE owner_user_id =
'00000000-0000-4000-8000-000000000002';")

test "$held" = 2000000
test "$rows" = 1
echo "PASS: CONCURRENT_BUDGET_OVERRUN_DENIED"
echo "PASS: SINGLE_RESERVATION"

stage="DUPLICATE"
duplicate=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000002',
'p0:race:a',repeat('a',64),500000);")
test "$duplicate" = DENIED_DUPLICATE_ATTEMPT
echo "PASS: DUPLICATE_ATTEMPT_DENIED"

stage="UNCONFIGURED_BUDGET"
missing=$(pg -c "
SET ROLE service_role;
SELECT public.velto_beta_budget_reserve_v1(
'00000000-0000-4000-8000-000000000004',
'p0:missing',repeat('d',64),1000000);")
test "$missing" = DENIED_NO_AUTHORIZED_BUDGET
echo "PASS: UNCONFIGURED_BUDGET_DENIED"

source scripts/p0-beta-postgres-finalization-assertions.sh
source scripts/p0-beta-postgres-dispatch-intent-assertions.sh
source scripts/p0-beta-postgres-video-e2e-assertions.sh
source scripts/p0-beta-postgres-evidence-boundary-assertions.sh
echo "P0_REAL_POSTGRES_ATOMIC_RESERVATION=PASS"
echo "LIVE_SUPABASE=NOT_ACCESSED"
echo "PROVIDER_CALLS=0"
echo "CONTAINER_CLEANUP=AUTOMATIC"
