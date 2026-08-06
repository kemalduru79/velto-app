const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export const MAX_JOB_REQUEST_BODY_BYTES = 64 * 1024;
const CLIENT_IDENTITY_FIELDS = [
  "userId",
  "user_id",
  "ownerUserId",
  "owner_user_id",
] as const;

type BoundedRequest = {
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
};

export type BoundedJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 413; message: string };

export async function parseBoundedJobRequestJson(
  request: BoundedRequest,
): Promise<BoundedJsonResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_JOB_REQUEST_BODY_BYTES
    ) {
      return { ok: false, status: 413, message: "Request body is too large." };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, message: "Invalid JSON request body." };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_JOB_REQUEST_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, status: 413, message: "Request body is too large." };
    }
    chunks.push(value);
  }

  const acceptedBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    acceptedBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(acceptedBytes);
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, status: 400, message: "Invalid JSON request body." };
    }
    return { ok: true, body: value as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON request body." };
  }
}

export type JobProjectPolicyResult =
  | { ok: true; jobType: "video_reconcile"; projectId: string }
  | { ok: true; jobType: "runtime_probe"; projectId: null }
  | {
      ok: false;
      status: 400;
      code:
        | "unsupported_job_type"
        | "invalid_project_id"
        | "client_identity_not_allowed";
      message: string;
    };

export function validateJobProjectPolicy(
  input: Readonly<Record<string, unknown>> | null,
): JobProjectPolicyResult {
  const payload =
    input?.payload &&
    typeof input.payload === "object" &&
    !Array.isArray(input.payload)
      ? (input.payload as Readonly<Record<string, unknown>>)
      : null;
  if (
    CLIENT_IDENTITY_FIELDS.some(
      (field) =>
        (input !== null && Object.prototype.hasOwnProperty.call(input, field)) ||
        (payload !== null && Object.prototype.hasOwnProperty.call(payload, field)),
    )
  ) {
    return {
      ok: false,
      status: 400,
      code: "client_identity_not_allowed",
      message: "Client-supplied user identity is not allowed.",
    };
  }

  const jobType = typeof input?.jobType === "string" ? input.jobType.trim() : "";

  if (jobType !== "runtime_probe" && jobType !== "video_reconcile") {
    return {
      ok: false,
      status: 400,
      code: "unsupported_job_type",
      message: "Unsupported job type.",
    };
  }

  const suppliedProjectId = input?.projectId;
  const projectId =
    typeof suppliedProjectId === "string" ? suppliedProjectId.trim() : null;

  if (jobType === "runtime_probe") {
    if (projectId) {
      return {
        ok: false,
        status: 400,
        code: "invalid_project_id",
        message: "runtime_probe does not accept projectId.",
      };
    }
    return { ok: true, jobType, projectId: null };
  }

  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_project_id",
      message: "video_reconcile requires a valid projectId.",
    };
  }

  return { ok: true, jobType, projectId };
}
