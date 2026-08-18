import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";

export class FinalMovieOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinalMovieOwnershipError";
  }
}

export function getFinalMovieInternalToken() {
  const token = process.env.VELTO_INTERNAL_EXPORT_TOKEN?.trim();
  if (!token) throw new FinalMovieOwnershipError("Final video service authentication is not configured.");
  return token;
}

export function getFinalMovieExportApiBase() {
  const value = process.env.EXPORT_API_URL || process.env.NEXT_PUBLIC_EXPORT_API_URL || "";
  if (!value.trim()) throw new FinalMovieOwnershipError("Final video service URL is not configured.");
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new FinalMovieOwnershipError("Final video service URL is invalid.");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function ownedFinalMovieHeaders(ownerUserId: string, projectId: string, token: string) {
  return {
    "Content-Type": "application/json",
    "x-velto-internal-export-token": token,
    "x-velto-owner-user-id": ownerUserId,
    "x-velto-project-id": projectId,
  };
}

export async function registerOwnedFinalMovieResponse(input: {
  data: Record<string, unknown>;
  ownerUserId: string;
  projectId: string;
}) {
  const bucket = input.data.storageBucket;
  const storagePath = input.data.storagePath;
  const publicUrl = input.data.movieUrl;
  const sizeBytes = input.data.sizeBytes;
  const expectedPrefix = `creator/${input.ownerUserId}/final/${input.projectId}/`;
  if (
    bucket !== "movies" || typeof storagePath !== "string" || !storagePath.startsWith(expectedPrefix) ||
    typeof publicUrl !== "string" || !publicUrl.trim() ||
    !Number.isSafeInteger(sizeBytes) || Number(sizeBytes) < 1
  ) {
    throw new FinalMovieOwnershipError("Final video storage identity is invalid.");
  }
  await registerStoredAssetOrThrow({
    repository: getPersistenceServices().mediaAssetRepository,
    ownerUserId: input.ownerUserId,
    bucket,
    storagePath,
    publicUrl,
    mediaKind: "final_video",
    mimeType: "video/mp4",
    sizeBytes: Number(sizeBytes),
    metadata: { projectId: input.projectId },
  });
}
