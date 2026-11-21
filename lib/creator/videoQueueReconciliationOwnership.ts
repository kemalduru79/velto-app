export type CreatorVideoQueueReconciliationOwners = Map<string, string | null>;

export function getCreatorVideoQueueOwnerKey(input: {
  sceneId: number;
  creatorSceneId?: string;
}) {
  const creatorSceneId = String(input.creatorSceneId || "").trim();
  return creatorSceneId || String(input.sceneId);
}

export function claimCreatorVideoQueueReconciliation(
  owners: CreatorVideoQueueReconciliationOwners,
  input: { sceneId: number; creatorSceneId?: string },
) {
  const ownerKey = getCreatorVideoQueueOwnerKey(input);
  if (owners.has(ownerKey)) return null;
  owners.set(ownerKey, null);
  return ownerKey;
}

export function bindCreatorVideoQueueReconciliationJob(
  owners: CreatorVideoQueueReconciliationOwners,
  ownerKey: string,
  queueJobId: string,
) {
  if (!owners.has(ownerKey)) return false;
  owners.set(ownerKey, queueJobId);
  return true;
}

export function releaseCreatorVideoQueueReconciliation(
  owners: CreatorVideoQueueReconciliationOwners,
  ownerKey: string,
) {
  owners.delete(ownerKey);
}

export function isCreatorVideoQueueReconciliationLocallyOwned(
  owners: CreatorVideoQueueReconciliationOwners,
  input: { sceneId: number; creatorSceneId?: string; queueJobId?: string },
) {
  const ownerKey = getCreatorVideoQueueOwnerKey(input);
  if (!owners.has(ownerKey)) return false;
  const ownedQueueJobId = owners.get(ownerKey);
  return !ownedQueueJobId || !input.queueJobId || ownedQueueJobId === input.queueJobId;
}

export function shouldResumeCreatorVideoQueueReconciliation(input: {
  resumable: boolean;
  pollActive: boolean;
  delayed: boolean;
  locallyOwned: boolean;
}) {
  return input.resumable && !input.pollActive && !input.delayed && !input.locallyOwned;
}
