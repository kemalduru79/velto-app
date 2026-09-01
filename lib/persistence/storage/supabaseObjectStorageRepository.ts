import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PersistenceError } from "./persistenceError";
import type {
  ObjectStorageRepository,
  PrivateObjectUploadInput,
  PrivateObjectUploadResult,
  PublicObjectUploadInput,
  PublicObjectUploadResult,
  ObjectStorageStat,
  ObjectStorageRemoveInput,
  SignedPublicUploadResult,
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
  async createSignedPublicUpload(input: {
    bucket: string;
    path: string;
  }): Promise<SignedPublicUploadResult> {
    const bucket = requireStorageName(input.bucket, "bucket");
    const path = requireStorageName(input.path, "path");
    const { data, error } = await createServerSupabaseClient().storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) {
      throw new PersistenceError("A secure upload target could not be created.", "STORAGE_SIGNED_UPLOAD_FAILED", error);
    }
    return { bucket, path, token: data.token };
  }

  async downloadPublic(input: { bucket: string; path: string }) {
    const bucket = requireStorageName(input.bucket, "bucket");
    const path = requireStorageName(input.path, "path");
    const { data, error } = await createServerSupabaseClient().storage.from(bucket).download(path);
    if (error || !data) {
      throw new PersistenceError("Uploaded media could not be verified.", "STORAGE_DOWNLOAD_FAILED", error);
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  getPublicUrl(input: { bucket: string; path: string }) {
    const bucket = requireStorageName(input.bucket, "bucket");
    const path = requireStorageName(input.path, "path");
    const { data } = createServerSupabaseClient().storage.from(bucket).getPublicUrl(path);
    const publicUrl = data?.publicUrl?.trim();
    if (!publicUrl) throw new PersistenceError("Stored media asset does not have a public URL.", "STORAGE_PUBLIC_URL_FAILED");
    return publicUrl;
  }

  async removeObject(input: ObjectStorageRemoveInput): Promise<void> {
    const bucket = requireStorageName(input.bucket, "bucket");
    const path = requireStorageName(input.path, "path");
    const { error } = await createServerSupabaseClient().storage.from(bucket).remove([path]);
    if (error) throw new PersistenceError("Media object could not be permanently removed.", "STORAGE_REMOVE_FAILED", error);
  }

  async stat(input: { bucket: string; path: string }): Promise<ObjectStorageStat> {
    const bucket = requireStorageName(input.bucket, "bucket");
    const storagePath = requireStorageName(input.path, "path");
    const slash = storagePath.lastIndexOf("/");
    const directory = slash >= 0 ? storagePath.slice(0, slash) : "";
    const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
    const { data, error } = await createServerSupabaseClient().storage.from(bucket).list(directory, {
      limit: 2,
      search: name,
    });
    if (error) throw new PersistenceError("Media metadata could not be read.", "STORAGE_STAT_FAILED", error);
    const found = (data || []).find((item) => item.name === name);
    const metadata = found?.metadata as Record<string, unknown> | undefined;
    return {
      bucket,
      path: storagePath,
      exists: Boolean(found),
      sizeBytes: typeof metadata?.size === "number" ? metadata.size : null,
      contentType: typeof metadata?.mimetype === "string" ? metadata.mimetype : null,
    };
  }

  async uploadPrivate(
    input: PrivateObjectUploadInput,
  ): Promise<PrivateObjectUploadResult> {
    const bucket = requireStorageName(input.bucket, "bucket");
    const path = requireStorageName(input.path, "path");
    if (input.contentType !== "audio/mpeg") {
      throw new PersistenceError("Private media content type is invalid.", "INVALID_STORAGE_INPUT");
    }
    const { data, error } = await createServerSupabaseClient().storage.from(bucket).upload(path, input.body, {
      contentType: input.contentType,
      cacheControl: input.cacheControl,
      upsert: input.upsert ?? false,
    });
    if (error) {
      throw new PersistenceError("Licensed media asset could not be stored.", "STORAGE_UPLOAD_FAILED", error);
    }
    return { bucket, path: data?.path || path };
  }

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
