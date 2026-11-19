# Additional PostgreSQL evidence-boundary assertions.
# Runs only inside the isolated P0 Docker test database.

pg <<'SQL'
BEGIN;

-- Create the synthetic owner in the isolated database.
-- Resolve the actual FK target rather than assuming its schema.
-- This fixture is rolled back with the test transaction.
DO $fixture$
DECLARE
  v_target regclass;
  v_column text;
BEGIN
  SELECT c.confrelid::regclass, a.attname
    INTO v_target, v_column
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.confrelid
     AND a.attnum = c.confkey[1]
   WHERE c.conrelid =
         'public.velto_beta_provider_budget_limits'::regclass
     AND c.conname =
         'velto_beta_provider_budget_limits_owner_user_id_fkey'
     AND c.contype = 'f'
     AND array_length(c.confkey, 1) = 1;

  IF v_target IS NULL OR v_column IS NULL THEN
    RAISE EXCEPTION 'P0_OWNER_FK_TARGET_NOT_FOUND';
  END IF;

  EXECUTE format(
    'INSERT INTO %s (%I) VALUES ($1) ON CONFLICT DO NOTHING',
    v_target, v_column
  )
  USING 'bf1c19e1-75cb-4cd9-8430-100000000007'::uuid;
END;
$fixture$;

SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_owner uuid :=
    'bf1c19e1-75cb-4cd9-8430-100000000007';
  v_attempt text := 'video:' || repeat('e', 64);
  v_request_sha text := repeat('a', 64);
  v_evidence_sha text := repeat('b', 64);

  v_result text;
  v_reservation_state text;
  v_held bigint;
BEGIN
  INSERT INTO public.velto_beta_provider_budget_limits (
    owner_user_id,
    cap_micro_usd
  )
  VALUES (
    v_owner,
    1000000
  );

  v_result := public.velto_beta_budget_reserve_v1(
    v_owner,
    v_attempt,
    v_request_sha,
    100000
  );

  IF v_result <> 'RESERVED' THEN
    RAISE EXCEPTION
      'P0_EVIDENCE_RESERVATION_FAILED: %',
      v_result;
  END IF;

  -- A valid-looking billing hash without a provider task is insufficient.
  v_result := public.velto_beta_budget_finalize_v1(
    v_owner,
    v_attempt,
    v_request_sha,
    'SETTLE',
    50000,
    v_evidence_sha,
    'PROVIDER_BILLING_CONFIRMED'
  );

  IF v_result <> 'DENIED_PROVIDER_ACCEPTANCE_REQUIRED' THEN
    RAISE EXCEPTION
      'P0_SETTLEMENT_WITHOUT_DISPATCH_NOT_FENCED: %',
      v_result;
  END IF;

  RAISE NOTICE
    'PASS: SETTLEMENT_WITHOUT_DISPATCH_DENIED';

  v_result := public.velto_beta_budget_begin_dispatch_v1(
    v_owner,
    v_attempt,
    v_request_sha,
    'runway'
  );

  IF v_result <> 'DISPATCH_STARTED' THEN
    RAISE EXCEPTION
      'P0_EVIDENCE_DISPATCH_SETUP_FAILED: %',
      v_result;
  END IF;

  -- Attempt to release budget with a plausible-looking hash
  -- while the dispatch is unresolved.
  v_result := public.velto_beta_budget_finalize_v1(
    v_owner,
    v_attempt,
    v_request_sha,
    'RELEASE',
    0,
    v_evidence_sha,
    'PROVIDER_ZERO_CHARGE_CONFIRMED'
  );

  IF v_result <> 'DENIED_PROVIDER_ACCEPTANCE_REQUIRED' THEN
    RAISE EXCEPTION
      'P0_UNCERTAIN_DISPATCH_RELEASE_NOT_FENCED: %',
      v_result;
  END IF;

  RAISE NOTICE
    'PASS: UNCERTAIN_DISPATCH_ZERO_CHARGE_RELEASE_DENIED';

  -- A fabricated evidence hash must not settle a dispatch
  -- whose native task has not been recorded.
  v_result := public.velto_beta_budget_finalize_v1(
    v_owner,
    v_attempt,
    v_request_sha,
    'SETTLE',
    50000,
    v_evidence_sha,
    'PROVIDER_BILLING_CONFIRMED'
  );

  IF v_result <> 'DENIED_PROVIDER_TASK_UNCONFIRMED' THEN
    RAISE EXCEPTION
      'P0_UNACCEPTED_TASK_SETTLEMENT_NOT_FENCED: %',
      v_result;
  END IF;

  RAISE NOTICE
    'PASS: UNACCEPTED_PROVIDER_TASK_SETTLEMENT_DENIED';

  -- service_role cannot manufacture billing approval.
  BEGIN
    INSERT INTO public.velto_beta_provider_billing_approvals (
      attempt_key, owner_user_id, request_sha256,
      provider_key, native_task_id, action,
      actual_micro_usd, evidence_sha256, basis, approved_by
    ) VALUES (
      v_attempt, v_owner, v_request_sha,
      'runway', 'fixture-task-7e', 'SETTLE',
      50000, v_evidence_sha,
      'PROVIDER_BILLING_CONFIRMED', 'UNAUTHORIZED'
    );

    RAISE EXCEPTION 'P0_UNAUTHORIZED_APPROVAL_WRITE_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: SERVICE_ROLE_CANNOT_APPROVE_BILLING';
  END;

  -- Provider task acceptance alone is insufficient for settlement.
  v_result := public.velto_beta_budget_accept_dispatch_v1(
    v_owner, v_attempt, v_request_sha, 'fixture-task-7e'
  );

  IF v_result <> 'PROVIDER_ACCEPTED' THEN
    RAISE EXCEPTION
      'P0_7E_PROVIDER_ACCEPT_FIXTURE_FAILED: %', v_result;
  END IF;

  v_result := public.velto_beta_budget_finalize_v1(
    v_owner, v_attempt, v_request_sha,
    'SETTLE', 50000, v_evidence_sha,
    'PROVIDER_BILLING_CONFIRMED'
  );

  IF v_result <> 'DENIED_UNAPPROVED_BILLING_EVIDENCE' THEN
    RAISE EXCEPTION
      'P0_7E_UNAPPROVED_SETTLEMENT_NOT_FENCED: %', v_result;
  END IF;

  RAISE NOTICE 'PASS: UNAPPROVED_BILLING_EVIDENCE_DENIED';


  SELECT state
    INTO v_reservation_state
    FROM public.velto_beta_provider_budget_reservations
   WHERE attempt_key = v_attempt
     AND owner_user_id = v_owner;

  SELECT held_micro_usd
    INTO v_held
    FROM public.velto_beta_provider_budget_limits
   WHERE owner_user_id = v_owner;

  IF v_reservation_state <> 'HELD'
     OR v_held <> 100000 THEN
    RAISE EXCEPTION
      'P0_UNCERTAIN_DISPATCH_HOLD_NOT_PRESERVED';
  END IF;

  RAISE NOTICE
    'PASS: DENIED_FINALIZATION_PRESERVES_HELD_BUDGET';
END;
$$;

ROLLBACK;
SQL

echo "P0_REAL_POSTGRES_EVIDENCE_BOUNDARY=PASS"
