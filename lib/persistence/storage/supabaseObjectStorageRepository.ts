import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PersistenceError } from "./persistenceError";
import type {
  ObjectStorageRepository,
  PublicObjectUploadInput,
  PublicObjectUploadResult,
} from "./types";

function requireStorageName(value: string, field: "bucket" | "path") {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.startsWith("/") ||
    normalized.includes("\\")
  ) {
    throw new PersistenceError(
      `${field} is invalid.`,
      "INVALID_STORAGE_INPUT",
    );
  }

  return normalized;
}

export class SupabaseObjectStorageRepository
  implements ObjectStorageRepository
{
  async uploadPublic(
    input: PublicObjectUploadInput,
  ): Promise<PublicObjectUploadResult> {
    const bucket = requireStorageName(input.bucket, "bucket");
    const path = requireStorageName(input.path, "path");
    const client = createServerSupabaseClient();
    const storage = client.storage.from(bucket);
    const { data, error } = await storage.upload(path, input.body, {
      contentType: input.contentType,
      cacheControl: input.cacheControl,
      upsert: input.upsert ?? false,
    });

    if (error) {
      throw new PersistenceError(
        "Media asset could not be stored.",
        "STORAGE_UPLOAD_FAILED",
        error,
      );
    }

    const storedPath = data?.path || path;
    const { data: publicData } = storage.getPublicUrl(storedPath);
    const publicUrl = publicData?.publicUrl?.trim();

    if (!publicUrl) {
      throw new PersistenceError(
        "Stored media asset does not have a public URL.",
        "STORAGE_PUBLIC_URL_FAILED",
      );
    }

    return {
      bucket,
      path: storedPath,
      publicUrl,
    };
  }
}
