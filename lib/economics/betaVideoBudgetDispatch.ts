import type { BetaBudgetRpc } from "./betaBudgetReservationAdapter.ts";
import {
  prepareBetaVideoBudgetReservation,
  type BetaVideoBudgetContext,
} from "./betaVideoBudgetGate.ts";

export async function executeBetaVideoBudgetedStart<
  T extends { nativeTaskId: string }
>(
  input: BetaVideoBudgetContext,
  _rpc: BetaBudgetRpc,
  _startProvider: () => Promise<T>,
): Promise<{ state: "BLOCKED"; reason: string }> {
  const prepared = prepareBetaVideoBudgetReservation(input);

  if (!prepared.ok) {
    return { state: "BLOCKED", reason: prepared.reason };
  }

  // The current reservation adapter is REVIEW ONLY.
  // Do not create a durable hold or invoke a paid provider.
  // Activation requires verified billing ceilings, an authorized
  // reservation protocol, and durable settlement/reconciliation.
  return {
    state: "BLOCKED",
    reason: "DISPATCH_PROTOCOL_NOT_ACTIVE",
  };
}
