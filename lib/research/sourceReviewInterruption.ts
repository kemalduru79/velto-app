/** Non-authoritative interruption marker; contains no continuation or reviewer decision. */
export type SourceReviewInterruptionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function markerKey(ownerId: string, projectId: string): string {
  if (!ownerId || !projectId || ownerId.length > 200 || projectId.length > 200) throw new Error('REVIEW_INTERRUPTION_IDENTITY_INVALID');
  return `velto:source-review-interrupted:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(projectId)}`;
}

export function markSourceReviewInterrupted(store: SourceReviewInterruptionStore, ownerId: string, projectId: string): void {
  store.setItem(markerKey(ownerId, projectId), 'pending');
}

export function hasSourceReviewInterruption(store: SourceReviewInterruptionStore, ownerId: string, projectId: string): boolean {
  return store.getItem(markerKey(ownerId, projectId)) === 'pending';
}

export function clearSourceReviewInterruption(store: SourceReviewInterruptionStore, ownerId: string, projectId: string): void {
  store.removeItem(markerKey(ownerId, projectId));
}
