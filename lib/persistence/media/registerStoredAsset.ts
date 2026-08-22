import type { MediaAssetRepository, MediaKind } from "./types";
import { createHash } from "node:crypto";
import { persistEconomicOperationBestEffort, unknownCost } from "@/lib/economics";

export function bodySizeBytes(body: Uint8Array | ArrayBuffer | Blob) {
  if (body instanceof Uint8Array) return body.byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  return body.size;
}

export async function registerStoredAssetOrThrow(input: {
  repository: MediaAssetRepository;
  ownerUserId: string;
  bucket: string;
  storagePath: string;
  publicUrl?: string | null;
  mediaKind: MediaKind;
  mimeType: string;
  body?: Uint8Array | ArrayBuffer | Blob;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
  generated?: boolean;
}) {
  const sizeBytes = input.body ? bodySizeBytes(input.body) : input.sizeBytes;
  if (!Number.isSafeInteger(sizeBytes) || Number(sizeBytes) < 0) {
    throw new Error("A reliable stored media byte size is required.");
  }
  try {
    const recorded = await input.repository.recordStoredAsset({
      ownerUserId: input.ownerUserId,
      bucket: input.bucket,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl || null,
      mediaKind: input.mediaKind,
      mimeType: input.mimeType,
      sizeBytes: Number(sizeBytes),
      metadata: input.metadata,
    });
    const assetIdentity = createHash("sha256").update(`${input.bucket}:${input.storagePath}`).digest("hex");
    await persistEconomicOperationBestEffort({ attemptKey: `storage:${assetIdentity}`, logicalOperationId: `storage:${assetIdentity}`, userId: input.ownerUserId, projectId: typeof input.metadata?.projectId === "string" ? input.metadata.projectId : typeof input.metadata?.projectKey === "string" ? input.metadata.projectKey : null,
      route: "stored-asset-registration", operationType: "storage_asset", provider: "supabase", providerTier: "infrastructure", model: "object-storage", state: "provider_billed", billingMoment: "storage_upload", generated: input.generated !== false, assetIdentity,
      quantities: { storageBytes: Number(sizeBytes), uploadBytes: Number(sizeBytes), mediaKind: input.mediaKind, requestCount: 1 }, cost: unknownCost("Supabase storage and egress unit rates are not approved."), providerAcceptedAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    return recorded;
  } catch (error) {
    console.error("Stored object registration failed; object requires reconciliation.", {
      ownerUserId: input.ownerUserId,
      bucket: input.bucket,
      storagePath: input.storagePath,
      sizeBytes: Number(sizeBytes),
      mediaKind: input.mediaKind,
      error: error instanceof Error ? error.message : "unknown",
    });
    const orphanIdentity = createHash("sha256").update(`${input.bucket}:${input.storagePath}`).digest("hex");
    await persistEconomicOperationBestEffort({ attemptKey: `storage:${orphanIdentity}`, logicalOperationId: `storage:${orphanIdentity}`, userId: input.ownerUserId, route: "stored-asset-registration", operationType: "storage_asset", provider: "supabase", providerTier: "infrastructure", model: "object-storage", state: "application_failed_after_provider_cost", billingMoment: "storage_upload", generated: input.generated !== false, assetIdentity: orphanIdentity, ambiguityReason: "object_uploaded_registration_failed", quantities: { storageBytes: Number(sizeBytes), uploadBytes: Number(sizeBytes), orphanReconciliationRequired: true, mediaKind: input.mediaKind }, cost: unknownCost("Supabase storage and egress unit rates are not approved."), providerAcceptedAt: new Date().toISOString(), failedAt: new Date().toISOString() });
    throw new Error("Stored media could not be registered for usage metering.", { cause: error });
  }
}
