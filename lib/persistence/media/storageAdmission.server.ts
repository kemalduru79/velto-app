import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const DEFAULT_STORAGE_ADMISSION_TTL_MINUTES = 60;
export type StorageAdmissionMediaKind = "image" | "video";
export type StorageAdmissionPurpose =
  | "creator_generated_image"
  | "storyverse_generated_image"
  | "storyverse_generated_video"
  | "final_movie_export";

export class StorageAdmissionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StorageAdmissionError";
  }
}

export function resolveStorageAdmissionTtlMinutes(env: Record<string, string | undefined>) {
  const raw = env.VELTO_STORAGE_ADMISSION_TTL_MINUTES;
  const parsed = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_STORAGE_ADMISSION_TTL_MINUTES;
}

export async function issueStorageAdmissionForOwner(input: {
  ownerUserId: string;
  mediaKind: StorageAdmissionMediaKind;
  purpose: StorageAdmissionPurpose;
  projectReference?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const ttlMinutes = resolveStorageAdmissionTtlMinutes(process.env);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const { data, error } = await createServerSupabaseClient()
    .from("velto_storage_admissions")
    .insert({
      owner_user_id: input.ownerUserId,
      media_kind: input.mediaKind,
      purpose: input.purpose,
      project_reference: input.projectReference?.trim() || null,
      expires_at: expiresAt,
      metadata: input.metadata || {},
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`Storage admission issuance failed: ${error?.message || "missing id"}`);
  return { storageAdmissionId: String(data.id), expiresAt };
}

export async function beginStorageAdmissionConsumption(input: {
  ownerUserId: string;
  storageAdmissionId: string;
  mediaKind: StorageAdmissionMediaKind;
  purpose: StorageAdmissionPurpose;
}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.storageAdmissionId)) {
    throw new StorageAdmissionError("A valid storage admission is required.", "STORAGE_ADMISSION_REQUIRED", 400);
  }
  const { data, error } = await createServerSupabaseClient().rpc(
    "velto_begin_storage_admission_consumption",
    {
      p_owner_user_id: input.ownerUserId,
      p_admission_id: input.storageAdmissionId,
      p_media_kind: input.mediaKind,
      p_purpose: input.purpose,
    },
  );
  if (error) throw new Error(`Storage admission begin failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : null;
  if (result?.status !== "ready" || typeof result?.consumption_token !== "string") {
    const notFound = result?.status === "not_found";
    throw new StorageAdmissionError(
      notFound ? "Storage admission was not found." : "Storage admission cannot be consumed.",
      notFound ? "STORAGE_ADMISSION_NOT_FOUND" : "STORAGE_ADMISSION_INVALID",
      notFound ? 404 : 409,
    );
  }
  return { consumptionToken: result.consumption_token as string };
}

export async function completeStorageAdmissionConsumption(
  ownerUserId: string,
  storageAdmissionId: string,
  consumptionToken: string,
) {
  const { data, error } = await createServerSupabaseClient().rpc(
    "velto_complete_storage_admission_consumption",
    { p_owner_user_id: ownerUserId, p_admission_id: storageAdmissionId, p_consumption_token: consumptionToken },
  );
  if (error || data !== "consumed") throw new Error(`Storage admission completion failed: ${error?.message || data}`);
}

export async function abortStorageAdmissionConsumption(
  ownerUserId: string,
  storageAdmissionId: string,
  consumptionToken: string,
) {
  const { data, error } = await createServerSupabaseClient().rpc(
    "velto_abort_storage_admission_consumption",
    { p_owner_user_id: ownerUserId, p_admission_id: storageAdmissionId, p_consumption_token: consumptionToken },
  );
  if (error || data !== "aborted") throw new Error(`Storage admission abort failed: ${error?.message || data}`);
}

export function storageAdmissionErrorResponse(error: StorageAdmissionError) {
  return Response.json(
    { ok: false, code: error.code, error: error.message },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function consumeStorageAdmissionForMedia<T>(input: {
  ownerUserId: string;
  storageAdmissionId: string;
  mediaKind: StorageAdmissionMediaKind;
  purpose: StorageAdmissionPurpose;
  operation: (markDurableStorageStarted: () => void) => Promise<T>;
}) {
  const begun = await beginStorageAdmissionConsumption(input);
  let durableStorageStarted = false;
  try {
    const result = await input.operation(() => { durableStorageStarted = true; });
    await completeStorageAdmissionConsumption(
      input.ownerUserId,
      input.storageAdmissionId,
      begun.consumptionToken,
    );
    return result;
  } catch (error) {
    if (durableStorageStarted) {
      console.error("STORAGE_ADMISSION_RECOVERY_REQUIRED", {
        ownerUserId: input.ownerUserId,
        storageAdmissionId: input.storageAdmissionId,
        mediaKind: input.mediaKind,
        purpose: input.purpose,
        error,
      });
    } else {
      try {
        await abortStorageAdmissionConsumption(
          input.ownerUserId,
          input.storageAdmissionId,
          begun.consumptionToken,
        );
      } catch (abortError) {
        console.error("STORAGE_ADMISSION_ABORT_FAILED", {
          ownerUserId: input.ownerUserId,
          storageAdmissionId: input.storageAdmissionId,
          error: abortError,
        });
      }
    }
    throw error;
  }
}
