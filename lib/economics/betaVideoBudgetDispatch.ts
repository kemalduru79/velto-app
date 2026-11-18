import {
  requestBetaBudgetReservation,
  type BetaBudgetRpc,
} from "./betaBudgetReservationAdapter.ts";
import {
  prepareBetaVideoBudgetReservation,
  type BetaVideoBudgetContext,
} from "./betaVideoBudgetGate.ts";

export async function executeBetaVideoBudgetedStart<
  T extends { nativeTaskId: string }
>(
  input: BetaVideoBudgetContext,
  rpc: BetaBudgetRpc,
  startProvider: () => Promise<T>,
): Promise<
  | { state: "BLOCKED"; reason: string }
  | {
      state: "ACCEPTED_HELD";
      attemptKey: string;
      task: T;
    }
  | {
      state: "HELD_UNCERTAIN";
      attemptKey: string;
      reason: "PROVIDER_OUTCOME_UNCERTAIN";
    }
> {
  const prepared = prepareBetaVideoBudgetReservation(input);

  if (!prepared.ok) {
    return { state: "BLOCKED", reason: prepared.reason };
  }

  const reservation = await requestBetaBudgetReservation(
    rpc,
    prepared.request,
  );

  if (reservation.state !== "HELD_REVIEW_ONLY") {
    return {
      state: "BLOCKED",
      reason: reservation.reason,
    };
  }

  // From this boundary onward, any failed/unknown provider response
  // must retain the hold until trusted reconciliation.
  try {
    const task = await startProvider();

    if (
      !task ||
      typeof task.nativeTaskId !== "string" ||
      !task.nativeTaskId.trim()
    ) {
      return {
        state: "HELD_UNCERTAIN",
        attemptKey: reservation.attemptKey,
        reason: "PROVIDER_OUTCOME_UNCERTAIN",
      };
    }

    return {
      state: "ACCEPTED_HELD",
      attemptKey: reservation.attemptKey,
      task,
    };
  } catch {
    return {
      state: "HELD_UNCERTAIN",
      attemptKey: reservation.attemptKey,
      reason: "PROVIDER_OUTCOME_UNCERTAIN",
    };
  }
}
