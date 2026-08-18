import type { MediaLifecycleState } from "./types";

export type MediaReferenceSafety = "IN_USE" | "UNREFERENCED" | "TRASHED";

export function classifyMediaReferenceSafety(
  lifecycleState: MediaLifecycleState,
  referenceCount: number,
): MediaReferenceSafety {
  if (!Number.isSafeInteger(referenceCount) || referenceCount < 0) {
    throw new Error("Reference count must be a non-negative safe integer.");
  }
  if (lifecycleState === "trashed") return "TRASHED";
  if (lifecycleState !== "active") {
    throw new Error("Purged assets are not available for cleanup classification.");
  }
  return referenceCount > 0 ? "IN_USE" : "UNREFERENCED";
}
