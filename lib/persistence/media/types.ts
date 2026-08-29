export type MediaKind =
  | "image"
  | "video"
  | "narration_audio"
  | "dialogue_audio"
  | "final_video"
  | "thumbnail"
  | "music"
  | "other";

export type MediaLifecycleState = "active" | "trashed" | "purged";

export type MediaReferenceType =
  | "scene_image"
  | "scene_video"
  | "asset_history"
  | "narration_audio"
  | "dialogue_audio"
  | "thumbnail"
  | "final_video"
  | "other";

export type StoredMediaAsset = {
  id: string;
  ownerUserId: string;
  bucket: string;
  storagePath: string;
  publicUrl: string | null;
  mediaKind: MediaKind;
  mimeType: string | null;
  sizeBytes: number;
  lifecycleState: MediaLifecycleState;
  trashedAt: string | null;
  purgeStartedAt: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordStoredAssetInput = Omit<StoredMediaAsset, "id" | "lifecycleState" | "trashedAt" | "purgeStartedAt"> & {
  metadata?: Record<string, unknown>;
};

export type ProjectMediaReference = {
  url: string;
  referenceType: MediaReferenceType;
  referenceKey: string;
};

export type MediaUsage = {
  totalBytes: number;
  totalPhysicalBytes: number;
  activeBytes: number;
  trashedBytes: number;
  assetCount: number;
  activeAssetCount: number;
  trashedAssetCount: number;
  imageBytes: number;
  videoBytes: number;
  audioBytes: number;
  otherBytes: number;
};

export type MediaReferenceSummary = {
  projectId: string;
  referenceType: MediaReferenceType;
  referenceKey: string;
  createdAt: string;
};

export type BeginMediaPurgeResult =
  | { status: "ready"; assetId: string; bucket: string; storagePath: string; purgeToken: string; sizeBytes: number; mediaKind: MediaKind }
  | { status: "not_found" | "not_trashed" | "retention_not_met" | "in_use" | "purge_already_pending" };

export interface MediaAssetRepository {
  recordStoredAsset(input: RecordStoredAssetInput): Promise<StoredMediaAsset>;
  findByStorageObject(ownerUserId: string, bucket: string, storagePath: string): Promise<StoredMediaAsset | null>;
  findByPublicUrl(ownerUserId: string, publicUrl: string): Promise<StoredMediaAsset | null>;
  getForOwner(assetId: string, ownerUserId: string): Promise<StoredMediaAsset | null>;
  listForOwner(ownerUserId: string): Promise<StoredMediaAsset[]>;
  getUsageForOwner(ownerUserId: string): Promise<MediaUsage>;
  replaceProjectReferences(ownerUserId: string, projectId: string, references: ProjectMediaReference[]): Promise<void>;
  listReferencesForAsset(assetId: string, ownerUserId: string): Promise<ProjectMediaReference[]>;
  getReferenceSummaryForOwner(assetId: string, ownerUserId: string): Promise<MediaReferenceSummary[]>;
  trashForOwner(assetId: string, ownerUserId: string): Promise<"trashed" | "not_found" | "state_changed" | "in_use">;
  restoreForOwner(assetId: string, ownerUserId: string): Promise<"restored" | "not_found" | "state_changed" | "purge_pending">;
  beginPurgeForOwner(assetId: string, ownerUserId: string, retentionDays: number): Promise<BeginMediaPurgeResult>;
  completePurgeForOwner(assetId: string, ownerUserId: string, purgeToken: string): Promise<"purged" | "not_found" | "not_trashed" | "token_mismatch" | "in_use">;
  abortPurgeForOwner(assetId: string, ownerUserId: string, purgeToken: string): Promise<"aborted" | "not_found" | "not_trashed" | "token_mismatch">;
}
