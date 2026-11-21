import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CreatorAudioAssetOrigin, CreatorAudioPlacementKind, CreatorAudioRightsMetadata } from "./audioTimeline.ts";

export const CREATOR_AUDIO_ASSET_MAX_BYTES = 50 * 1024 * 1024;
export const CREATOR_AUDIO_ASSET_MAX_DURATION_MS = 30 * 60 * 1000;
export const CREATOR_AUDIO_ASSET_INTENT_TTL_MS = 15 * 60 * 1000;

export const CREATOR_AUDIO_FORMATS = {
  "audio/mpeg": { extension: "mp3", container: "mp3", codecs: ["mp3"] },
  "audio/wav": { extension: "wav", container: "wav", codecs: ["pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le"] },
  "audio/mp4": { extension: "m4a", container: "m4a", codecs: ["aac"] },
  "audio/x-m4a": { extension: "m4a", container: "m4a", codecs: ["aac"] },
} as const;

export type CreatorAudioMimeType = keyof typeof CREATOR_AUDIO_FORMATS;
export type CreatorAudioContainer = (typeof CREATOR_AUDIO_FORMATS)[CreatorAudioMimeType]["container"];

export type CreatorAudioProbe = {
  formatNames: string[];
  durationMs: number;
  codec: string;
  sampleRateHz: number;
  channels: number;
  audioStreamCount: number;
  videoStreamCount: number;
};

export type CreatorAudioAssetDescriptor = {
  assetId: string;
  ownerUserId: string;
  projectId: string;
  bucket: string;
  storagePath: string;
  origin: CreatorAudioAssetOrigin;
  mediaKind: CreatorAudioPlacementKind;
  mimeType: CreatorAudioMimeType;
  sizeBytes: number;
  checksumSha256: string;
  durationMs: number;
  codec: string;
  sampleRateHz: number;
  channels: number;
  rights: CreatorAudioRightsMetadata;
};

export function toCreatorAudioTimelineAssetReference(asset: CreatorAudioAssetDescriptor) {
  return {
    assetId: asset.assetId,
    origin: asset.origin,
    mediaKind: asset.mediaKind,
    durationMs: asset.durationMs,
    rights: asset.rights,
  } as const;
}

export function createCreatorAudioFinalizeResponse(result: { asset: CreatorAudioAssetDescriptor; reused: boolean }) {
  return { ok: true, asset: toCreatorAudioTimelineAssetReference(result.asset), reused: result.reused } as const;
}

type AudioIntent = {
  version: 1;
  ownerUserId: string;
  projectId: string;
  bucket: string;
  path: string;
  originalFilename: string;
  mediaKind: CreatorAudioPlacementKind;
  mimeType: CreatorAudioMimeType;
  sizeBytes: number;
  creatorAttested: boolean;
  issuedAt: number;
  expiresAt: number;
};

export class CreatorAudioAssetError extends Error {
  readonly code: "invalid_intent" | "intent_expired" | "upload_missing" | "upload_mismatch" | "verification_failed" | "registration_failed" | "asset_not_found";

  constructor(code: "invalid_intent" | "intent_expired" | "upload_missing" | "upload_mismatch" | "verification_failed" | "registration_failed" | "asset_not_found", message: string) {
    super(message);
    this.name = "CreatorAudioAssetError";
    this.code = code;
  }
}

const cleanText = (value: unknown, maximum: number) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maximum)
  : "";

function signature(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function equalSignature(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveCreatorAudioAssetBucket(environment: NodeJS.ProcessEnv = process.env) {
  const bucket = cleanText(environment.CREATOR_AUDIO_ASSET_BUCKET || environment.CREATOR_PREMIUM_MUSIC_BUCKET, 120);
  if (!bucket || bucket.includes("..") || bucket.includes("/") || bucket.includes("\\")) {
    throw new CreatorAudioAssetError("invalid_intent", "Secure audio upload is not configured.");
  }
  return bucket;
}

export function createCreatorAudioUploadIntent(input: {
  ownerUserId: string;
  projectId: string;
  privateBucket: string;
  originalFilename: unknown;
  mediaKind: unknown;
  mimeType: unknown;
  sizeBytes: unknown;
  creatorAttested?: unknown;
}, secret: string, options: { now?: number; nonce?: string } = {}) {
  const mimeType = typeof input.mimeType === "string" ? input.mimeType.toLowerCase() as CreatorAudioMimeType : "" as CreatorAudioMimeType;
  const format = CREATOR_AUDIO_FORMATS[mimeType];
  const sizeBytes = input.sizeBytes;
  const filename = cleanText(input.originalFilename, 180);
  const kinds = new Set<CreatorAudioPlacementKind>(["music", "ambience", "sfx"]);
  if (!secret || !cleanText(input.ownerUserId, 128) || !cleanText(input.projectId, 128) || !format ||
      !kinds.has(input.mediaKind as CreatorAudioPlacementKind) || typeof sizeBytes !== "number" ||
      !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > CREATOR_AUDIO_ASSET_MAX_BYTES || !filename) {
    throw new CreatorAudioAssetError("invalid_intent", "Audio upload details are invalid.");
  }
  const bucket = cleanText(input.privateBucket, 120);
  if (!bucket || bucket.includes("..") || bucket.includes("/") || bucket.includes("\\")) {
    throw new CreatorAudioAssetError("invalid_intent", "Audio storage is invalid.");
  }
  const now = options.now ?? Date.now();
  const payload: AudioIntent = {
    version: 1,
    ownerUserId: input.ownerUserId,
    projectId: input.projectId,
    bucket,
    path: `creator/${input.ownerUserId}/audio/${input.projectId}/${options.nonce || randomUUID()}.${format.extension}`,
    originalFilename: filename,
    mediaKind: input.mediaKind as CreatorAudioPlacementKind,
    mimeType,
    sizeBytes,
    creatorAttested: input.creatorAttested === true,
    issuedAt: now,
    expiresAt: now + CREATOR_AUDIO_ASSET_INTENT_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { payload, intentToken: `${encoded}.${signature(encoded, secret)}` };
}

export function verifyCreatorAudioUploadIntent(token: string, input: { ownerUserId: string; secret: string; now?: number }) {
  const [encoded, signed, extra] = token.split(".");
  if (!encoded || !signed || extra || !input.secret || !equalSignature(signature(encoded, input.secret), signed)) {
    throw new CreatorAudioAssetError("invalid_intent", "Audio upload authorization is invalid.");
  }
  let payload: AudioIntent;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AudioIntent;
  } catch {
    throw new CreatorAudioAssetError("invalid_intent", "Audio upload authorization is invalid.");
  }
  const format = CREATOR_AUDIO_FORMATS[payload.mimeType];
  if (payload.version !== 1 || payload.ownerUserId !== input.ownerUserId || !format ||
      typeof payload.projectId !== "string" || !payload.projectId || typeof payload.bucket !== "string" || !payload.bucket ||
      typeof payload.path !== "string" || !payload.path ||
      !["music", "ambience", "sfx"].includes(payload.mediaKind) || !Number.isSafeInteger(payload.sizeBytes) ||
      payload.path !== `creator/${payload.ownerUserId}/audio/${payload.projectId}/${payload.path.split("/").at(-1)}` ||
      !payload.path.endsWith(`.${format.extension}`) || payload.sizeBytes <= 0 || payload.sizeBytes > CREATOR_AUDIO_ASSET_MAX_BYTES) {
    throw new CreatorAudioAssetError("invalid_intent", "Audio upload authorization is invalid.");
  }
  if (payload.expiresAt < (input.now ?? Date.now())) {
    throw new CreatorAudioAssetError("intent_expired", "The secure audio upload session expired.");
  }
  return payload;
}

export function validateCreatorAudioSignature(bytes: Uint8Array, mimeType: CreatorAudioMimeType) {
  if (!bytes.byteLength) throw new CreatorAudioAssetError("verification_failed", "The audio file is empty.");
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const mp3 = ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  const wav = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  const m4a = ascii(4, 8) === "ftyp";
  if ((mimeType === "audio/mpeg" && !mp3) || (mimeType === "audio/wav" && !wav) ||
      ((mimeType === "audio/mp4" || mimeType === "audio/x-m4a") && !m4a)) {
    throw new CreatorAudioAssetError("verification_failed", "The audio contents do not match the approved format.");
  }
}

export function validateCreatorAudioProbe(probe: CreatorAudioProbe, mimeType: CreatorAudioMimeType) {
  const format = CREATOR_AUDIO_FORMATS[mimeType];
  const containerMatches = format.container === "mp3" ? probe.formatNames.includes("mp3")
    : format.container === "wav" ? probe.formatNames.includes("wav")
      : probe.formatNames.some((name) => ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"].includes(name));
  if (probe.audioStreamCount !== 1 || probe.videoStreamCount !== 0 || !containerMatches ||
      !(format.codecs as readonly string[]).includes(probe.codec) || !Number.isFinite(probe.durationMs) ||
      probe.durationMs <= 0 || probe.durationMs > CREATOR_AUDIO_ASSET_MAX_DURATION_MS ||
      !Number.isSafeInteger(probe.sampleRateHz) || probe.sampleRateHz <= 0 ||
      !Number.isSafeInteger(probe.channels) || probe.channels <= 0 || probe.channels > 8) {
    throw new CreatorAudioAssetError("verification_failed", "The audio stream or container is unsupported.");
  }
  return probe;
}

export function creatorAudioChecksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createUploadedCreatorAudioMetadata(input: {
  payload: AudioIntent;
  probe: CreatorAudioProbe;
  checksumSha256: string;
  uploadedAt: string;
}) {
  return {
    source: "creator_audio_upload",
    origin: "uploaded",
    projectId: input.payload.projectId,
    audioKind: input.payload.mediaKind,
    originalFilename: input.payload.originalFilename,
    mimeType: input.payload.mimeType,
    uploadedAt: input.uploadedAt,
    durationMs: input.probe.durationMs,
    codec: input.probe.codec,
    sampleRateHz: input.probe.sampleRateHz,
    channels: input.probe.channels,
    checksumSha256: input.checksumSha256,
    rights: input.payload.creatorAttested
      ? { status: "creator_attested", creatorAttestedAt: input.uploadedAt }
      : { status: "unknown" },
  } satisfies Record<string, unknown>;
}

type RegisteredAudio = { id: string; ownerUserId?: string; bucket: string; storagePath: string; publicUrl: string | null; mediaKind: string; mimeType: string | null; sizeBytes: number; lifecycleState?: string; metadata?: Record<string, unknown> };

function assertRegisteredAudioMatchesIntent(asset: RegisteredAudio, payload: AudioIntent) {
  if (asset.ownerUserId !== payload.ownerUserId || asset.bucket !== payload.bucket || asset.storagePath !== payload.path ||
      asset.mediaKind !== "music" || asset.mimeType !== payload.mimeType || asset.sizeBytes !== payload.sizeBytes ||
      asset.metadata?.projectId !== payload.projectId || asset.metadata?.audioKind !== payload.mediaKind) {
    throw new CreatorAudioAssetError("upload_mismatch", "The finalized audio asset conflicts with the approved upload details.");
  }
}

export function descriptorFromRegisteredAudio(asset: RegisteredAudio, ownerUserId: string, projectId: string): CreatorAudioAssetDescriptor {
  const metadata = asset.metadata || {};
  const kind = metadata.audioKind;
  const rights = metadata.rights as CreatorAudioRightsMetadata | undefined;
  if ((asset.ownerUserId && asset.ownerUserId !== ownerUserId) || asset.mediaKind !== "music" || asset.publicUrl !== null ||
      (asset.lifecycleState && asset.lifecycleState !== "active") || metadata.projectId !== projectId || metadata.origin !== "uploaded" ||
      !["music", "ambience", "sfx"].includes(String(kind)) || !rights ||
      !["unknown", "creator_attested"].includes(rights.status) ||
      typeof metadata.checksumSha256 !== "string" || !/^[a-f0-9]{64}$/.test(metadata.checksumSha256) ||
      typeof metadata.durationMs !== "number" || metadata.durationMs <= 0 ||
      typeof metadata.codec !== "string" || typeof metadata.sampleRateHz !== "number" || typeof metadata.channels !== "number" ||
      !CREATOR_AUDIO_FORMATS[asset.mimeType as CreatorAudioMimeType]) {
    throw new CreatorAudioAssetError("asset_not_found", "Audio asset was not found.");
  }
  return {
    assetId: asset.id, ownerUserId, projectId, bucket: asset.bucket, storagePath: asset.storagePath,
    origin: "uploaded", mediaKind: kind as CreatorAudioPlacementKind, mimeType: asset.mimeType as CreatorAudioMimeType,
    sizeBytes: asset.sizeBytes, checksumSha256: metadata.checksumSha256, durationMs: metadata.durationMs,
    codec: metadata.codec, sampleRateHz: metadata.sampleRateHz, channels: metadata.channels, rights,
  };
}

export async function finalizeCreatorAudioUpload(input: { intentToken: string; ownerUserId: string; secret: string; now?: number }, dependencies: {
  stat: (location: { bucket: string; path: string }) => Promise<{ exists: boolean; sizeBytes: number | null; contentType: string | null }>;
  download: (location: { bucket: string; path: string }) => Promise<Uint8Array>;
  remove: (location: { bucket: string; path: string }) => Promise<void>;
  reportCleanupFailure: (context: { operation: "creator_audio_finalize_cleanup"; projectId: string; errorClass: string }) => void;
  probe: (bytes: Uint8Array, extension: string) => Promise<CreatorAudioProbe>;
  findExisting: (ownerUserId: string, bucket: string, path: string) => Promise<RegisteredAudio | null>;
  register: (input: { ownerUserId: string; bucket: string; path: string; mimeType: CreatorAudioMimeType; sizeBytes: number; metadata: Record<string, unknown> }) => Promise<RegisteredAudio>;
}) {
  const payload = verifyCreatorAudioUploadIntent(input.intentToken, input);
  const location = { bucket: payload.bucket, path: payload.path };
  const existing = await dependencies.findExisting(input.ownerUserId, payload.bucket, payload.path);
  if (existing) {
    assertRegisteredAudioMatchesIntent(existing, payload);
    return { asset: descriptorFromRegisteredAudio(existing, input.ownerUserId, payload.projectId), reused: true, payload };
  }
  let cleanup = false;
  try {
    const stat = await dependencies.stat(location);
    if (!stat.exists) throw new CreatorAudioAssetError("upload_missing", "The uploaded audio was not found.");
    cleanup = true;
    if (stat.sizeBytes !== payload.sizeBytes || stat.contentType?.toLowerCase() !== payload.mimeType) {
      throw new CreatorAudioAssetError("upload_mismatch", "The uploaded audio does not match the approved upload details.");
    }
    const bytes = await dependencies.download(location);
    if (bytes.byteLength !== payload.sizeBytes || bytes.byteLength > CREATOR_AUDIO_ASSET_MAX_BYTES) {
      throw new CreatorAudioAssetError("upload_mismatch", "The uploaded audio size could not be verified.");
    }
    validateCreatorAudioSignature(bytes, payload.mimeType);
    const probe = validateCreatorAudioProbe(await dependencies.probe(bytes, CREATOR_AUDIO_FORMATS[payload.mimeType].extension), payload.mimeType);
    const uploadedAt = new Date(input.now ?? Date.now()).toISOString();
    const metadata = createUploadedCreatorAudioMetadata({ payload, probe, checksumSha256: creatorAudioChecksum(bytes), uploadedAt });
    let registered: RegisteredAudio;
    try {
      registered = await dependencies.register({ ownerUserId: input.ownerUserId, bucket: payload.bucket, path: payload.path, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes, metadata });
    } catch {
      throw new CreatorAudioAssetError("registration_failed", "The uploaded audio could not be registered.");
    }
    cleanup = false;
    return { asset: descriptorFromRegisteredAudio(registered, input.ownerUserId, payload.projectId), reused: false, payload };
  } catch (error) {
    if (cleanup) {
      try {
        await dependencies.remove(location);
      } catch (cleanupError) {
        try {
          dependencies.reportCleanupFailure({
            operation: "creator_audio_finalize_cleanup",
            projectId: payload.projectId,
            errorClass: cleanupError instanceof Error ? cleanupError.name : "UnknownCleanupError",
          });
        } catch {
          // Reporting is best effort and must not replace the original finalize failure.
        }
      }
    }
    if (error instanceof CreatorAudioAssetError) throw error;
    throw new CreatorAudioAssetError("verification_failed", "The uploaded audio could not be verified safely.");
  }
}
