import { withCreatorMediaOriginMetadata } from "./mediaOrigin.ts";

export const CREATOR_UPLOAD_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const CREATOR_UPLOAD_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export type CreatorUploadedMediaKind = "image" | "video";

export type CreatorUploadedMedia = {
  assetId: string;
  publicUrl: string;
  mediaKind: CreatorUploadedMediaKind;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  durationSeconds: number | null;
  uploadedAt: string;
};

export class CreatorUploadValidationError extends Error {
  readonly code: "empty_file" | "unsupported_type" | "file_too_large" | "content_mismatch";

  constructor(
    code: "empty_file" | "unsupported_type" | "file_too_large" | "content_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "CreatorUploadValidationError";
    this.code = code;
  }
}

const FORMATS = {
  "image/jpeg": { kind: "image", extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { kind: "image", extension: "png", signature: (bytes: Uint8Array) => bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]) },
  "image/webp": { kind: "image", extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
  "video/mp4": { kind: "video", extension: "mp4", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" },
} as const;

export function validateCreatorUploadedMedia(input: {
  bytes: Uint8Array;
  mimeType: string;
  declaredKind: unknown;
}) {
  if (input.bytes.byteLength === 0) {
    throw new CreatorUploadValidationError("empty_file", "The selected file is empty.");
  }
  const format = FORMATS[input.mimeType as keyof typeof FORMATS];
  if (!format || (input.declaredKind !== "image" && input.declaredKind !== "video")) {
    throw new CreatorUploadValidationError("unsupported_type", "Choose a JPEG, PNG, WebP, or MP4 file.");
  }
  if (format.kind !== input.declaredKind || !format.signature(input.bytes)) {
    throw new CreatorUploadValidationError("content_mismatch", "The file contents do not match the selected media type.");
  }
  const maxBytes = format.kind === "image" ? CREATOR_UPLOAD_IMAGE_MAX_BYTES : CREATOR_UPLOAD_VIDEO_MAX_BYTES;
  if (input.bytes.byteLength > maxBytes) {
    throw new CreatorUploadValidationError("file_too_large", `The selected ${format.kind} is too large.`);
  }
  return { mediaKind: format.kind, mimeType: input.mimeType, extension: format.extension, maxBytes };
}

export function createCreatorUploadedMediaMetadata(input: {
  projectId: string;
  originalFilename: string;
  mediaKind: CreatorUploadedMediaKind;
  mimeType: string;
  uploadedAt: string;
  rightsConfirmed: boolean;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}) {
  return withCreatorMediaOriginMetadata({
    source: "creator_upload",
    projectId: input.projectId,
    originalFilename: input.originalFilename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180),
    mediaKind: input.mediaKind,
    mimeType: input.mimeType,
    uploadedAt: input.uploadedAt,
    creatorRightsConfirmation: {
      confirmed: input.rightsConfirmed,
      confirmedAt: input.rightsConfirmed ? input.uploadedAt : null,
      statement: "creator_has_right_to_use_media",
    },
    ...(Number.isFinite(input.width) ? { width: Math.max(1, Math.round(input.width!)) } : {}),
    ...(Number.isFinite(input.height) ? { height: Math.max(1, Math.round(input.height!)) } : {}),
    ...(Number.isFinite(input.durationSeconds) ? { durationSeconds: Math.max(0, input.durationSeconds!) } : {}),
  }, "uploaded");
}

type UploadBindableScene = {
  id: number;
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
  videoJobId?: string;
  videoQueueJobId?: string;
  videoDurationSeconds?: number;
  videoGenerationSignature?: string;
  videoPendingGenerationSignature?: string;
  renderMode?: "image" | "video";
  visualSourceMethod?: string;
  clipInSec?: number;
  clipOutSec?: number;
  assetHistory?: Array<Record<string, unknown>>;
};

export function bindCreatorUploadedMedia<T extends UploadBindableScene>(input: {
  scenes: T[];
  sceneId: number;
  asset: CreatorUploadedMedia;
}) {
  let changed = false;
  const scenes = input.scenes.map((scene) => {
    if (scene.id !== input.sceneId) return scene;
    changed = true;
    const history = [...(scene.assetHistory || []), {
      id: input.asset.assetId,
      kind: input.asset.mediaKind,
      url: input.asset.publicUrl,
      createdAt: input.asset.uploadedAt,
      source: "uploaded",
      ...(input.asset.durationSeconds ? { durationSec: input.asset.durationSeconds } : {}),
    }];
    return input.asset.mediaKind === "image" ? {
      ...scene,
      image: input.asset.publicUrl,
      renderMode: "image" as const,
      visualSourceMethod: "upload",
      videoUrl: "",
      videoStatus: "idle",
      videoJobId: "",
      videoQueueJobId: "",
      videoDurationSeconds: 0,
      videoGenerationSignature: undefined,
      videoPendingGenerationSignature: undefined,
      clipInSec: undefined,
      clipOutSec: undefined,
      assetHistory: history,
    } : {
      ...scene,
      renderMode: "video" as const,
      visualSourceMethod: "upload",
      videoUrl: input.asset.publicUrl,
      videoStatus: "done",
      videoJobId: "",
      videoQueueJobId: "",
      videoDurationSeconds: input.asset.durationSeconds || 0,
      videoGenerationSignature: undefined,
      videoPendingGenerationSignature: undefined,
      clipInSec: undefined,
      clipOutSec: undefined,
      assetHistory: history,
    };
  });
  return { scenes, changed };
}

export function detachCreatorUploadedMedia<T extends UploadBindableScene>(scenes: T[], sceneId: number) {
  return scenes.map((scene) => scene.id !== sceneId ? scene : {
    ...scene,
    image: "",
    videoUrl: "",
    videoStatus: "idle",
    videoJobId: "",
    videoQueueJobId: "",
    videoDurationSeconds: 0,
    videoGenerationSignature: undefined,
    videoPendingGenerationSignature: undefined,
    clipInSec: undefined,
    clipOutSec: undefined,
  });
}
