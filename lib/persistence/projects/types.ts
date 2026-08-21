import type { PublicStoryverseProjectSourceRecord } from "@/lib/security/publicStoryverseProjection";

export type VeltoProjectFlowType = "storyverse" | "creator_lab";

/**
 * Public API contract returned by the existing project endpoints.
 * Snake-case keys are intentionally preserved so PORT-P2 does not break
 * current clients while database-specific access remains inside adapters.
 */
export type VeltoProjectApiRecord = Record<string, unknown> & {
  id: string;
};

export type SaveVeltoProjectInput = {
  projectId?: string | null;
  ownerUserId: string;
  childId: string | null;
  title: string;
  inputPrompt: string;
  storyPremise: string;
  language: "tr" | "en";
  visualBible: unknown;
  characters: unknown[];
  scenes: unknown[];
  exportedMovieUrl: string | null;
  exportedMovieResult: unknown;
  exportSignature: string | null;
  flowType: VeltoProjectFlowType;
  creatorMentorResult: unknown;
  creatorProductionPackage: unknown;
  youtubeMetadataResult: unknown;
  youtubeThumbnailResult: unknown;
  sceneOptimizationResult: unknown;
  sceneOptimizationSummary: unknown;
  refinedCreatorScenes: unknown;
};

export type SaveVeltoProjectResult = {
  mode: "created" | "updated";
  project: VeltoProjectApiRecord;
};

export type PublishVeltoProjectResult =
  | {
      status: "published";
      shareId: string;
      project: VeltoProjectApiRecord;
    }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unsupported_flow" }
  | { status: "share_id_exhausted" };

export type UnpublishVeltoProjectResult =
  | { status: "unpublished"; project: VeltoProjectApiRecord }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unsupported_flow" };

export interface ProjectRepository {
  listForOwner(ownerUserId: string): Promise<VeltoProjectApiRecord[]>;
  getForOwner(
    projectId: string,
    ownerUserId: string,
  ): Promise<VeltoProjectApiRecord | null>;
  getPublicByShareId(
    shareId: string,
  ): Promise<PublicStoryverseProjectSourceRecord | null>;
  saveForOwner(input: SaveVeltoProjectInput): Promise<SaveVeltoProjectResult>;
  publishForOwner(
    projectId: string,
    ownerUserId: string,
  ): Promise<PublishVeltoProjectResult>;
  unpublishForOwner(
    projectId: string,
    ownerUserId: string,
  ): Promise<UnpublishVeltoProjectResult>;
  removeAssetHistoryUrlForOwner(
    projectId: string,
    ownerUserId: string,
    registeredPublicUrl: string,
  ): Promise<
    | { status: "updated"; project: VeltoProjectApiRecord; removedCount: number }
    | { status: "not_found" | "changed" }
  >;
}
