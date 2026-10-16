import { createHash } from "node:crypto";

export const CREATOR_FINAL_VIDEO_RECOVERY_TARGET = Object.freeze({
  bucket: "movies",
  fileName: "254ad9e4-213d-4f44-b8e5-4dddf7da4f7d.mp4",
  storageIdentitySha256: "6bae31d5650390caa499ea9a6795549de66bae8b73e4806419f70bb1090e42cf",
  contentSha256: "bb3826071350d374ab9ba18af8e6fd8d06cce78b2cdcd1bdf3785aeb3953e897",
  productionSignatureSha256: "fe9be3d7405b385348d2d38bc53758b573e143c2c81a177f62229bab2e3bfc89",
  sizeBytes: 78_826_528,
  durationMs: 462_000,
  sceneCount: 36,
  videoFrameCount: 11_536,
  width: 1280,
  height: 720,
  framesPerSecond: 25,
  audioSampleRateHz: 44_100,
  audioChannels: 2,
});

export type CreatorFinalVideoRecoveryProbe = {
  contentSha256: string;
  sizeBytes: number;
  durationMs: number;
  videoStreamCount: number;
  audioStreamCount: number;
  videoCodec: string;
  audioCodec: string;
  width: number;
  height: number;
  framesPerSecond: number;
  videoFrameCount: number;
  audioSampleRateHz: number;
  audioChannels: number;
};

export class CreatorFinalVideoRecoveryError extends Error {
  readonly code:
    | "RECOVERY_HUMAN_REVIEW_REQUIRED"
    | "RECOVERY_PROJECT_REVISION_REQUIRED"
    | "RECOVERY_PROJECT_STALE"
    | "RECOVERY_PRODUCTION_SIGNATURE_INVALID"
    | "RECOVERY_PRODUCTION_STATE_INVALID"
    | "RECOVERY_STORAGE_IDENTITY_INVALID"
    | "RECOVERY_MEDIA_INVALID"
    | "RECOVERY_ASSET_CONFLICT";
  readonly status: number;

  constructor(
    code:
      | "RECOVERY_HUMAN_REVIEW_REQUIRED"
      | "RECOVERY_PROJECT_REVISION_REQUIRED"
      | "RECOVERY_PROJECT_STALE"
      | "RECOVERY_PRODUCTION_SIGNATURE_INVALID"
      | "RECOVERY_PRODUCTION_STATE_INVALID"
      | "RECOVERY_STORAGE_IDENTITY_INVALID"
      | "RECOVERY_MEDIA_INVALID"
      | "RECOVERY_ASSET_CONFLICT",
    status = 409,
  ) {
    super(code);
    this.name = "CreatorFinalVideoRecoveryError";
    this.code = code;
    this.status = status;
  }
}

export function creatorFinalVideoRecoverySha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildCreatorFinalVideoRecoveryStoragePath(ownerUserId: string, projectId: string) {
  return `creator/${ownerUserId}/final/${projectId}/${CREATOR_FINAL_VIDEO_RECOVERY_TARGET.fileName}`;
}

export function assertCreatorFinalVideoRecoveryAuthority(input: {
  ownerUserId: string;
  projectId: string;
  projectUpdatedAt: string;
  expectedUpdatedAt: string;
  currentProductionSignature: string;
  sceneCount: number;
  musicIntentMode: unknown;
  musicPlacementCount: number;
  humanReviewConfirmed: boolean;
  storagePath: string;
  probe: CreatorFinalVideoRecoveryProbe;
  existingAsset: "none" | "matching" | "conflicting";
  alreadyInstalled?: boolean;
}, target = CREATOR_FINAL_VIDEO_RECOVERY_TARGET) {
  if (!input.humanReviewConfirmed) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_HUMAN_REVIEW_REQUIRED", 400);
  }
  if (!input.expectedUpdatedAt) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_PROJECT_REVISION_REQUIRED", 400);
  }
  if (input.expectedUpdatedAt !== input.projectUpdatedAt && !input.alreadyInstalled) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_PROJECT_STALE");
  }
  if (
    !input.currentProductionSignature ||
    creatorFinalVideoRecoverySha256(input.currentProductionSignature) !==
      target.productionSignatureSha256
  ) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_PRODUCTION_SIGNATURE_INVALID");
  }
  if (
    input.sceneCount !== target.sceneCount ||
    input.musicIntentMode !== "none" ||
    input.musicPlacementCount !== 0
  ) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_PRODUCTION_STATE_INVALID");
  }
  const expectedPath = buildCreatorFinalVideoRecoveryStoragePath(input.ownerUserId, input.projectId);
  if (
    input.storagePath !== expectedPath ||
    creatorFinalVideoRecoverySha256(`${target.bucket}:${input.storagePath}`) !==
      target.storageIdentitySha256
  ) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_STORAGE_IDENTITY_INVALID", 403);
  }
  const probe = input.probe;
  if (
    probe.contentSha256 !== target.contentSha256 ||
    probe.sizeBytes !== target.sizeBytes ||
    probe.durationMs !== target.durationMs ||
    probe.videoStreamCount !== 1 || probe.audioStreamCount !== 1 ||
    probe.videoCodec !== "h264" || probe.audioCodec !== "aac" ||
    probe.width !== target.width ||
    probe.height !== target.height ||
    probe.framesPerSecond !== target.framesPerSecond ||
    probe.videoFrameCount !== target.videoFrameCount ||
    probe.audioSampleRateHz !== target.audioSampleRateHz ||
    probe.audioChannels !== target.audioChannels
  ) {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_MEDIA_INVALID", 422);
  }
  if (input.existingAsset === "conflicting") {
    throw new CreatorFinalVideoRecoveryError("RECOVERY_ASSET_CONFLICT");
  }
  return {
    bucket: target.bucket,
    storagePath: expectedPath,
    sizeBytes: probe.sizeBytes,
    durationSeconds: probe.durationMs / 1000,
    sceneCount: input.sceneCount,
    productionSignature: input.currentProductionSignature,
    alreadyRegistered: input.existingAsset === "matching",
  } as const;
}
