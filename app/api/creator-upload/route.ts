import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import {
  createCreatorUploadedMediaMetadata,
  CreatorUploadValidationError,
  validateCreatorUploadedMedia,
} from "@/lib/creator/uploadedMedia";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { observePersistenceOperation, recordMediaTransfer } from "@/lib/observability";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const MAX_MULTIPART_BYTES = 51 * 1024 * 1024;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
      return json({ ok: false, code: "unsupported_content_type", error: "Upload request must use multipart form data." }, 415);
    }
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      return json({ ok: false, code: "file_too_large", error: "The selected file is too large." }, 413);
    }

    const form = await request.formData();
    const allowedFields = new Set(["file", "projectId", "mediaKind", "rightsConfirmed", "width", "height", "durationSeconds"]);
    if ([...form.keys()].some((key) => !allowedFields.has(key)) || form.getAll("file").length !== 1) {
      return json({ ok: false, code: "invalid_upload", error: "Upload request is invalid." }, 400);
    }
    const file = form.get("file");
    const projectId = typeof form.get("projectId") === "string" ? String(form.get("projectId")).trim() : "";
    const mediaKind = form.get("mediaKind");
    const rightsConfirmed = form.get("rightsConfirmed") === "true";
    if (!(file instanceof File) || !PROJECT_ID.test(projectId) || !rightsConfirmed) {
      return json({ ok: false, code: "invalid_upload", error: rightsConfirmed ? "Upload request is invalid." : "Confirm that you have the right to use this media." }, 400);
    }

    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project || project.flow_type !== "creator_lab") {
      return json({ ok: false, code: "project_not_found", error: "Project was not found." }, 404);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateCreatorUploadedMedia({ bytes, mimeType: file.type.toLowerCase(), declaredKind: mediaKind });
    const uploadedAt = new Date().toISOString();
    const metadata = createCreatorUploadedMediaMetadata({
      projectId,
      originalFilename: file.name,
      mediaKind: validated.mediaKind,
      mimeType: validated.mimeType,
      uploadedAt,
      rightsConfirmed,
      width: optionalNumber(form.get("width")),
      height: optionalNumber(form.get("height")),
      durationSeconds: optionalNumber(form.get("durationSeconds")),
    });
    const path = `creator/${principal.id}/${projectId}/upload/${randomUUID()}.${validated.extension}`;
    const uploadStartedAt = performance.now();
    const stored = await observePersistenceOperation("storage", "creator_upload", () => services.objectStorage.uploadPublic({
      bucket: validated.mediaKind === "image" ? "images" : "videos",
      path,
      body: bytes,
      contentType: validated.mimeType,
      upsert: false,
    }));
    recordMediaTransfer({
      operation: "creator_upload",
      direction: "upload",
      bytes: bytes.byteLength,
      durationMs: performance.now() - uploadStartedAt,
      outcome: "success",
    });
    const asset = await registerStoredAssetOrThrow({
      repository: services.mediaAssetRepository,
      ownerUserId: principal.id,
      bucket: stored.bucket,
      storagePath: stored.path,
      publicUrl: stored.publicUrl,
      mediaKind: validated.mediaKind,
      mimeType: validated.mimeType,
      body: bytes,
      metadata,
      generated: false,
    });
    return json({
      ok: true,
      asset: {
        assetId: asset.id,
        publicUrl: stored.publicUrl,
        mediaKind: validated.mediaKind,
        mimeType: validated.mimeType,
        originalFilename: file.name.slice(0, 180),
        sizeBytes: bytes.byteLength,
        durationSeconds: optionalNumber(form.get("durationSeconds")),
        uploadedAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return json({ ok: false, code: "authentication_required", error: "A valid session is required." }, 401);
    }
    if (error instanceof CreatorUploadValidationError) {
      return json({ ok: false, code: error.code, error: error.message }, error.code === "file_too_large" ? 413 : 400);
    }
    console.error("CREATOR_UPLOAD_FAILED", { error: error instanceof Error ? error.message : "unknown" });
    return json({ ok: false, code: "upload_failed", error: "The media could not be uploaded. Try again." }, 500);
  }
}
