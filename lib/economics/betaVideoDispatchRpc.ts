/**
 * P0 review-only adapter for durable dispatch-intent RPCs.
 *
 * A successful RPC result is NOT authorization to call a provider.
 * The production video route remains fail-closed.
 */

type RpcName =
  | "velto_beta_budget_begin_dispatch_v1"
  | "velto_beta_budget_accept_dispatch_v1";

type RpcResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

export type BetaDispatchRpc = (
  name: RpcName,
  args: Record<string, string>,
) => Promise<RpcResult>;

type Identity = Readonly<{
  ownerUserId: string;
  attemptKey: string;
  requestSha256: string;
}>;

type BeginInput = Identity & {
  providerKey: string;
};

type AcceptInput = Identity & {
  nativeTaskId: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ATTEMPT =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

const SHA256 = /^[a-f0-9]{64}$/;
const TASK_ID = /^[A-Za-z0-9._:/-]{1,512}$/;

function validIdentity(input: Identity): boolean {
  return (
    UUID.test(input.ownerUserId) &&
    ATTEMPT.test(input.attemptKey) &&
    SHA256.test(input.requestSha256)
  );
}

function outcome(
  state: "RECORDED_REVIEW_ONLY" | "BLOCKED" | "UNCERTAIN",
  reason: string,
) {
  return {
    state,
    reason,
    dispatchAuthorized: false as const,
  };
}

export async function beginBetaVideoDispatch(
  rpc: BetaDispatchRpc,
  input: BeginInput,
) {
  if (
    !validIdentity(input) ||
    input.providerKey !== "runway"
  ) {
    return outcome("BLOCKED", "INVALID_DISPATCH_IDENTITY");
  }

  try {
    const result = await rpc(
      "velto_beta_budget_begin_dispatch_v1",
      {
        p_owner_user_id: input.ownerUserId,
        p_attempt_key: input.attemptKey,
        p_request_sha256: input.requestSha256,
        p_provider_key: input.providerKey,
      },
    );

    if (result.error) {
      return outcome("UNCERTAIN", "BEGIN_RPC_OUTCOME_UNKNOWN");
    }

    if (result.data === "DISPATCH_STARTED") {
      return outcome(
        "RECORDED_REVIEW_ONLY",
        "DISPATCH_INTENT_RECORDED",
      );
    }

    return outcome("BLOCKED", "BEGIN_RPC_DENIED");
  } catch {
    return outcome("UNCERTAIN", "BEGIN_RPC_OUTCOME_UNKNOWN");
  }
}

export async function acceptBetaVideoDispatch(
  rpc: BetaDispatchRpc,
  input: AcceptInput,
) {
  if (
    !validIdentity(input) ||
    !TASK_ID.test(input.nativeTaskId)
  ) {
    return outcome("BLOCKED", "INVALID_ACCEPTANCE_IDENTITY");
  }

  try {
    const result = await rpc(
      "velto_beta_budget_accept_dispatch_v1",
      {
        p_owner_user_id: input.ownerUserId,
        p_attempt_key: input.attemptKey,
        p_request_sha256: input.requestSha256,
        p_native_task_id: input.nativeTaskId,
      },
    );

    if (result.error) {
      return outcome("UNCERTAIN", "ACCEPT_RPC_OUTCOME_UNKNOWN");
    }

    if (result.data === "PROVIDER_ACCEPTED") {
      return outcome(
        "RECORDED_REVIEW_ONLY",
        "PROVIDER_TASK_RECORDED",
      );
    }

    return outcome("BLOCKED", "ACCEPT_RPC_DENIED");
  } catch {
    return outcome("UNCERTAIN", "ACCEPT_RPC_OUTCOME_UNKNOWN");
  }
}
