import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  CREATOR_UPLOAD_IMAGE_MAX_BYTES,
  CREATOR_UPLOAD_VIDEO_MAX_BYTES,
  createCreatorUploadedMediaMetadata,
  validateCreatorUploadedMedia,
  type CreatorUploadedMedia,
  type CreatorUploadedMediaKind,
} from "./uploadedMedia.ts";

const INTENT_TTL_MS = 15 * 60_000;
const MIME_FORMATS = {
  "image/jpeg": { mediaKind: "image", extension: "jpg", bucket: "images" },
  "image/png": { mediaKind: "image", extension: "png", bucket: "images" },
  "image/webp": { mediaKind: "image", extension: "webp", bucket: "images" },
  "video/mp4": { mediaKind: "video", extension: "mp4", bucket: "videos" },
} as const;

export class CreatorDirectUploadError extends Error {
  readonly code:
    | "invalid_intent"
    | "intent_expired"
    | "upload_missing"
    | "upload_mismatch"
    | "verification_failed"
    | "registration_failed";

  constructor(
    code:
      | "invalid_intent"
      | "intent_expired"
      | "upload_missing"
      | "upload_mismatch"
      | "verification_failed"
      | "registration_failed",
    message: string,
  ) {
    super(message);
    this.name = "CreatorDirectUploadError";
    this.code = code;
  }
}

type IntentPayload = {
  version: 1;
  ownerUserId: string;
  projectId: string;
  bucket: string;
  path: string;
  originalFilename: string;
  mediaKind: CreatorUploadedMediaKind;
  mimeType: keyof typeof MIME_FORMATS;
  sizeBytes: number;
  rightsConfirmed: true;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  issuedAt: number;
  expiresAt: number;
};

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sign(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createCreatorDirectUploadIntent(input: {
  ownerUserId: string;
  projectId: string;
  originalFilename: unknown;
  mediaKind: unknown;
  mimeType: unknown;
  sizeBytes: unknown;
  rightsConfirmed: unknown;
  width?: unknown;
  height?: unknown;
  durationSeconds?: unknown;
}, secret: string, options: { now?: number; nonce?: string } = {}) {
  const format = typeof input.mimeType === "string"
    ? MIME_FORMATS[input.mimeType as keyof typeof MIME_FORMATS]
    : null;
  const sizeBytes = Number(input.sizeBytes);
  const filename = typeof input.originalFilename === "string" ? input.originalFilename.trim() : "";
  if (!secret || !input.ownerUserId || !input.projectId || !format || format.mediaKind !== input.mediaKind ||
      !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || !filename || input.rightsConfirmed !== true) {
    throw new CreatorDirectUploadError("invalid_intent", "Upload details are invalid.");
  }
  const maxBytes = format.mediaKind === "image" ? CREATOR_UPLOAD_IMAGE_MAX_BYTES : CREATOR_UPLOAD_VIDEO_MAX_BYTES;
  if (sizeBytes > maxBytes) throw new CreatorDirectUploadError("invalid_intent", `The selected ${format.mediaKind} is too large.`);
  const now = options.now ?? Date.now();
  const payload: IntentPayload = {
    version: 1,
    ownerUserId: input.ownerUserId,
    projectId: input.projectId,
    bucket: format.bucket,
    path: `creator/${input.ownerUserId}/${input.projectId}/upload/${options.nonce || randomUUID()}.${format.extension}`,
    originalFilename: filename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180),
    mediaKind: format.mediaKind,
    mimeType: input.mimeType as keyof typeof MIME_FORMATS,
    sizeBytes,
    rightsConfirmed: true,
    width: optionalNumber(input.width),
    height: optionalNumber(input.height),
    durationSeconds: optionalNumber(input.durationSeconds),
    issuedAt: now,
    expiresAt: now + INTENT_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { payload, intentToken: `${encoded}.${sign(encoded, secret)}` };
}

export function verifyCreatorDirectUploadIntent(
  token: string,
  input: { ownerUserId: string; secret: string; now?: number },
) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || !safeEqual(sign(encoded, input.secret), signature)) {
    throw new CreatorDirectUploadError("invalid_intent", "Upload authorization is invalid.");
  }
  let payload: IntentPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as IntentPayload;
  } catch {
    throw new CreatorDirectUploadError("invalid_intent", "Upload authorization is invalid.");
  }
  if (payload.version !== 1 || payload.ownerUserId !== input.ownerUserId || payload.rightsConfirmed !== true) {
    throw new CreatorDirectUploadError("invalid_intent", "Upload authorization is invalid.");
  }
  if (payload.expiresAt < (input.now ?? Date.now())) {
    throw new CreatorDirectUploadError("intent_expired", "The secure upload session expired. Choose the file again.");
  }
  return payload;
}

type StoredAsset = {
  id: string;
  publicUrl: string | null;
  mediaKind: string;
  mimeType: string | null;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
};

function uploadedMedia(asset: StoredAsset, payload: IntentPayload): CreatorUploadedMedia {
  return {
    assetId: asset.id,
    publicUrl: asset.publicUrl || "",
    mediaKind: payload.mediaKind,
    mimeType: payload.mimeType,
    originalFilename: payload.originalFilename,
    sizeBytes: payload.sizeBytes,
    durationSeconds: payload.durationSeconds,
    uploadedAt: typeof asset.metadata?.uploadedAt === "string" ? asset.metadata.uploadedAt : new Date(payload.issuedAt).toISOString(),
  };
}

export async function finalizeCreatorDirectUpload(input: {
  intentToken: string;
  ownerUserId: string;
  secret: string;
  now?: number;
}, dependencies: {
  stat: (location: { bucket: string; path: string }) => Promise<{ exists: boolean; sizeBytes: number | null; contentType: string | null }>;
  download: (location: { bucket: string; path: string }) => Promise<Uint8Array>;
  remove: (location: { bucket: string; path: string }) => Promise<void>;
  publicUrl: (location: { bucket: string; path: string }) => string;
  findExisting: (ownerUserId: string, bucket: string, path: string) => Promise<StoredAsset | null>;
  register: (input: {
    ownerUserId: string;
    bucket: string;
    path: string;
    publicUrl: string;
    mediaKind: CreatorUploadedMediaKind;
    mimeType: string;
    sizeBytes: number;
    metadata: Record<string, unknown>;
  }) => Promise<StoredAsset>;
}) {
  const payload = verifyCreatorDirectUploadIntent(input.intentToken, input);
  const location = { bucket: payload.bucket, path: payload.path };
  const existing = await dependencies.findExisting(input.ownerUserId, payload.bucket, payload.path);
  if (existing) return { asset: uploadedMedia(existing, payload), reused: true, payload };
  let shouldCleanup = false;
  try {
    const stat = await dependencies.stat(location);
    if (!stat.exists) throw new CreatorDirectUploadError("upload_missing", "The uploaded file was not found. Upload it again.");
    shouldCleanup = true;
    if (stat.sizeBytes !== payload.sizeBytes || stat.contentType?.toLowerCase() !== payload.mimeType) {
      throw new CreatorDirectUploadError("upload_mismatch", "The uploaded file does not match the approved upload details.");
    }
    const bytes = await dependencies.download(location);
    if (bytes.byteLength !== payload.sizeBytes) {
      throw new CreatorDirectUploadError("upload_mismatch", "The uploaded file size could not be verified.");
    }
    validateCreatorUploadedMedia({ bytes, mimeType: payload.mimeType, declaredKind: payload.mediaKind });
    const uploadedAt = new Date(input.now ?? Date.now()).toISOString();
    const metadata = createCreatorUploadedMediaMetadata({
      projectId: payload.projectId,
      originalFilename: payload.originalFilename,
      mediaKind: payload.mediaKind,
      mimeType: payload.mimeType,
      uploadedAt,
      rightsConfirmed: true,
      width: payload.width,
      height: payload.height,
      durationSeconds: payload.durationSeconds,
    });
    let registered: StoredAsset;
    try {
      registered = await dependencies.register({
        ownerUserId: input.ownerUserId,
        bucket: payload.bucket,
        path: payload.path,
        publicUrl: dependencies.publicUrl(location),
        mediaKind: payload.mediaKind,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        metadata,
      });
    } catch {
      throw new CreatorDirectUploadError("registration_failed", "The uploaded file could not be registered. Try again.");
    }
    shouldCleanup = false;
    return { asset: uploadedMedia(registered, payload), reused: false, payload };
  } catch (error) {
    if (shouldCleanup) await dependencies.remove(location).catch(() => undefined);
    if (error instanceof CreatorDirectUploadError) throw error;
    throw new CreatorDirectUploadError("verification_failed", "The uploaded file could not be verified safely.");
  }
}
