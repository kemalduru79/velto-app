export type CreatorAccountingClaim = {
  attemptKey: string;
  logicalOperationId: string;
  userId: string;
  route: string;
  operationType: string;
};

export async function createCreatorAccountingAdmission(
  claim: CreatorAccountingClaim,
  persist: (claim: CreatorAccountingClaim) => Promise<void>,
) {
  await persist(claim);
  return {
    mode: "creator_accounting" as const,
    userId: claim.userId,
    reservationId: "",
    reservedCredits: 0,
    accountAfterReserve: null,
    accountingAttemptKey: claim.attemptKey,
  };
}
