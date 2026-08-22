import type { CreditAccount } from "@/lib/credits";
import { getOperationCreditCost, type MeteredOperationType } from "@/lib/credits/operationPolicy";
import type { CreatorQualityMode } from "@/lib/creator/mediaRouting";

export function createCreatorEntitlementSnapshot(account: CreditAccount, operationType: MeteredOperationType, qualityMode: CreatorQualityMode) {
  const requestedOperationCredits = getOperationCreditCost(operationType, qualityMode);
  return { creditBalance: account.balanceCredits, reservedCredits: account.reservedCredits, availableCredits: account.availableCredits, requestedOperationCredits, sufficientCredits: account.availableCredits >= requestedOperationCredits, costGuardRequired: requestedOperationCredits > 0, qualityModeEligible: qualityMode !== "draft" || requestedOperationCredits === 0 };
}
