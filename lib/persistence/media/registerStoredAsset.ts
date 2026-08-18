import type { MediaAssetRepository, MediaKind } from "./types";

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
  body: Uint8Array | ArrayBuffer | Blob;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await input.repository.recordStoredAsset({
      ownerUserId: input.ownerUserId,
      bucket: input.bucket,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl || null,
      mediaKind: input.mediaKind,
      mimeType: input.mimeType,
      sizeBytes: bodySizeBytes(input.body),
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("Stored object registration failed; object requires reconciliation.", {
      ownerUserId: input.ownerUserId,
      bucket: input.bucket,
      storagePath: input.storagePath,
      sizeBytes: bodySizeBytes(input.body),
      mediaKind: input.mediaKind,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("Stored media could not be registered for usage metering.", { cause: error });
  }
}
