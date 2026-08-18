import type { MediaLifecycleState, MediaReferenceType } from "./types";

export type MediaReferenceSafety = "IN_USE" | "HISTORY_ONLY" | "UNREFERENCED" | "TRASHED";

export type MediaReferenceClassification = {
  cleanupState: MediaReferenceSafety;
  referenceCount: number;
  blockingReferenceCount: number;
  historyReferenceCount: number;
};

const BLOCKING_REFERENCE_TYPES = new Set<MediaReferenceType>([
  "scene_image", "scene_video", "narration_audio", "dialogue_audio",
  "thumbnail", "final_video", "other",
]);

export function classifyMediaReferenceSafety(
  lifecycleState: MediaLifecycleState,
  references: readonly { referenceType: string }[],
): MediaReferenceClassification {
  const referenceCount = references.length;
  const historyReferenceCount = references.filter((reference) => reference.referenceType === "asset_history").length;
  // Unknown/future types deliberately fall into the blocking bucket.
  const blockingReferenceCount = references.filter((reference) =>
    reference.referenceType !== "asset_history" || BLOCKING_REFERENCE_TYPES.has(reference.referenceType as MediaReferenceType),
  ).length;
  if (lifecycleState === "trashed") {
    return { cleanupState: "TRASHED", referenceCount, blockingReferenceCount, historyReferenceCount };
  }
  if (lifecycleState !== "active") {
    throw new Error("Purged assets are not available for cleanup classification.");
  }
  const cleanupState = blockingReferenceCount > 0
    ? "IN_USE"
    : historyReferenceCount > 0
      ? "HISTORY_ONLY"
      : "UNREFERENCED";
  return { cleanupState, referenceCount, blockingReferenceCount, historyReferenceCount };
}
