export type CreatorMusicEntitlementStatus =
  | "pending"
  | "acquired"
  | "failed"
  | "revoked";

export type CreatorMusicEntitlementKey = {
  userId: string;
  projectId: string;
  providerKey: string;
  trackId: string;
  licensePolicyVersion: string;
};

export type CreatorMusicEntitlement = CreatorMusicEntitlementKey & {
  id: string;
  status: CreatorMusicEntitlementStatus;
  storageBucket?: string;
  storagePath?: string;
  contentType?: "audio/mpeg";
  sizeBytes?: number;
  checksum?: string;
  providerAcquisitionId?: string;
  providerLicenseMetadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  acquiredAt?: string;
};

export type CreatorMusicStoredAsset = {
  storageBucket: string;
  storagePath: string;
  contentType: "audio/mpeg";
  sizeBytes: number;
  checksum: string;
  providerAcquisitionId?: string;
  providerLicenseMetadata: Record<string, string>;
};

export interface CreatorMusicEntitlementRepository {
  getByIdForOwner(id: string, userId: string, projectId: string): Promise<CreatorMusicEntitlement | null>;
  getByKeyForOwner(key: CreatorMusicEntitlementKey): Promise<CreatorMusicEntitlement | null>;
  createOrGetPending(key: CreatorMusicEntitlementKey): Promise<{ entitlement: CreatorMusicEntitlement; created: boolean }>;
  stageStoredAsset(id: string, userId: string, asset: CreatorMusicStoredAsset): Promise<CreatorMusicEntitlement>;
  markAcquired(id: string, userId: string): Promise<CreatorMusicEntitlement>;
  markFailed(id: string, userId: string): Promise<CreatorMusicEntitlement>;
  markRevoked(id: string, userId: string): Promise<CreatorMusicEntitlement>;
}

export type CreatorMusicUsageEventStatus = "pending" | "reported" | "failed";
export type CreatorMusicUsageErrorCode =
  | "provider_unavailable"
  | "provider_rate_limited"
  | "provider_rejected"
  | "reporting_unavailable"
  | "unknown";

export type CreatorMusicUsageEventIdentity = {
  entitlementId: string;
  userId: string;
  projectId: string;
  providerKey: string;
  trackId: string;
  licensePolicyVersion: string;
  exportUsageKey: string;
};

export type CreatorMusicUsageEvent = CreatorMusicUsageEventIdentity & {
  id: string;
  status: CreatorMusicUsageEventStatus;
  attemptCount: number;
  lastErrorCode?: CreatorMusicUsageErrorCode;
  providerUsageEventId?: string;
  createdAt: string;
  updatedAt: string;
  reportedAt?: string;
};

export interface CreatorMusicUsageEventRepository {
  getByUsageKey(entitlementId: string, exportUsageKey: string): Promise<CreatorMusicUsageEvent | null>;
  createOrGetPending(identity: CreatorMusicUsageEventIdentity): Promise<{ event: CreatorMusicUsageEvent; created: boolean }>;
  listPending(limit?: number): Promise<CreatorMusicUsageEvent[]>;
  markReported(id: string, providerUsageEventId?: string): Promise<CreatorMusicUsageEvent>;
  markFailed(id: string, errorCode: CreatorMusicUsageErrorCode): Promise<CreatorMusicUsageEvent>;
}
