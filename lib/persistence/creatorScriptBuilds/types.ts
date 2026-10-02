import type {
  CreatorScriptBuildCheckpoint,
  CreatorScriptBuildCheckpointStage,
  CreatorScriptBuildDuplicateResolution,
  CreatorScriptBuildFailure,
  CreatorScriptBuildJson,
  CreatorScriptBuildOperation,
  CreatorScriptBuildOperationState,
  CreatorScriptBuildRecord,
  CreatorScriptBuildSnapshot,
  CreatorScriptBuildState,
} from "@/lib/creator/creatorScriptBuild";

export type RequestCreatorScriptBuildInput = {
  ownerId: string;
  snapshot: CreatorScriptBuildSnapshot;
};

export type RequestCreatorScriptBuildResult = {
  build: CreatorScriptBuildRecord;
  created: boolean;
  resolution: "CREATED" | CreatorScriptBuildDuplicateResolution;
};

export type TransitionCreatorScriptBuildInput = {
  ownerId: string;
  buildId: string;
  expectedState: CreatorScriptBuildState;
  // PERSISTED is reserved for the future atomic project-installation boundary.
  // E1 must not let a generic state transition claim persistence.
  nextState: Exclude<CreatorScriptBuildState, "PERSISTED">;
  failure?: CreatorScriptBuildFailure | null;
  resultAuthority?: CreatorScriptBuildJson | null;
};

export type SaveCreatorScriptBuildCheckpointInput = {
  ownerId: string;
  buildId: string;
  expectedBuildState: CreatorScriptBuildState;
  checkpoint: CreatorScriptBuildCheckpoint;
};

export type RequestCreatorScriptBuildOperationInput = {
  ownerId: string;
  buildId: string;
  stage: CreatorScriptBuildCheckpointStage;
  operationType: string;
  semanticFingerprint: string;
  contractVersion: string;
};

export type TransitionCreatorScriptBuildOperationInput = {
  ownerId: string;
  buildId: string;
  operationId: string;
  expectedState: CreatorScriptBuildOperationState;
  nextState: Exclude<CreatorScriptBuildOperationState, "PENDING">;
  resultReference?: CreatorScriptBuildJson | null;
  failure?: CreatorScriptBuildFailure | null;
};

export interface CreatorScriptBuildRepository {
  request(input: RequestCreatorScriptBuildInput): Promise<RequestCreatorScriptBuildResult>;
  getForOwner(buildId: string, ownerId: string): Promise<CreatorScriptBuildRecord | null>;
  getByIdempotencyForOwner(
    idempotencyKey: string,
    ownerId: string,
  ): Promise<CreatorScriptBuildRecord | null>;
  transition(input: TransitionCreatorScriptBuildInput): Promise<CreatorScriptBuildRecord>;
  saveCheckpoint(input: SaveCreatorScriptBuildCheckpointInput): Promise<CreatorScriptBuildRecord>;
  requestOperation(
    input: RequestCreatorScriptBuildOperationInput,
  ): Promise<{ operation: CreatorScriptBuildOperation; created: boolean }>;
  getOperationForOwner(
    operationId: string,
    buildId: string,
    ownerId: string,
  ): Promise<CreatorScriptBuildOperation | null>;
  transitionOperation(
    input: TransitionCreatorScriptBuildOperationInput,
  ): Promise<CreatorScriptBuildOperation>;
}
