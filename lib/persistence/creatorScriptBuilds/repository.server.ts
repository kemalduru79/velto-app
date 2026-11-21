import "server-only";

import {
  assertCreatorScriptBuildCheckpointIdentity,
  assertCreatorScriptBuildOperationTransition,
  assertCreatorScriptBuildTransition,
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildOperationId,
  resolveCreatorScriptBuildDuplicate,
  type CreatorScriptBuildFailure,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildOperation,
  type CreatorScriptBuildRecord,
  type CreatorScriptBuildSnapshot,
  type CreatorScriptBuildState,
} from "@/lib/creator/creatorScriptBuild";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { VeltoProjectApiRecord } from "@/lib/persistence/projects/types";
import type {
  CreatorScriptBuildRepository,
  PersistAcceptedCreatorScriptBuildInput,
  PersistAcceptedCreatorScriptBuildResult,
  RequestCreatorScriptBuildInput,
  RequestCreatorScriptBuildOperationInput,
  RequestCreatorScriptBuildResult,
  SaveCreatorScriptBuildCheckpointInput,
  TransitionCreatorScriptBuildInput,
  TransitionCreatorScriptBuildOperationInput,
} from "./types";

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Row
    : {};
}

function nullableRecord(value: unknown) {
  return value == null ? null : record(value);
}

function mapBuild(row: Row): CreatorScriptBuildRecord {
  return {
    buildId: String(row.id),
    ownerId: String(row.owner_user_id),
    projectId: String(row.project_id),
    idempotencyKey: String(row.idempotency_key),
    state: String(row.state) as CreatorScriptBuildState,
    snapshot: record(row.snapshot) as CreatorScriptBuildSnapshot,
    checkpoints: record(row.checkpoints) as CreatorScriptBuildRecord["checkpoints"],
    failure: nullableRecord(row.failure) as CreatorScriptBuildFailure | null,
    resultAuthority: row.result_authority == null
      ? null
      : row.result_authority as CreatorScriptBuildJson,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapOperation(row: Row): CreatorScriptBuildOperation {
  return {
    operationId: String(row.operation_identity),
    buildId: String(row.build_id),
    ownerId: String(row.owner_user_id),
    stage: String(row.stage) as CreatorScriptBuildOperation["stage"],
    operationType: String(row.operation_type),
    semanticFingerprint: String(row.semantic_fingerprint),
    contractVersion: String(row.contract_version),
    state: String(row.state) as CreatorScriptBuildOperation["state"],
    resultReference: row.result_reference == null
      ? null
      : row.result_reference as CreatorScriptBuildJson,
    failure: nullableRecord(row.failure) as CreatorScriptBuildFailure | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rpcEnvelope(value: unknown) {
  const envelope = record(value);
  return {
    created: envelope.created === true,
    value: record(envelope.record),
  };
}

function mutationFailure(
  prefix: string,
  error: { message?: string } | null,
  data: unknown,
): never {
  if (error) throw new Error(`${prefix}:${error.message || "UNKNOWN"}`);
  if (!data) throw new Error(`${prefix}:NOT_FOUND_OR_STALE`);
  throw new Error(prefix);
}

export class SupabaseCreatorScriptBuildRepository implements CreatorScriptBuildRepository {
  async request(
    input: RequestCreatorScriptBuildInput,
  ): Promise<RequestCreatorScriptBuildResult> {
    const idempotencyKey = createCreatorScriptBuildIdempotencyKey({
      ownerId: input.ownerId,
      snapshot: input.snapshot,
    });
    const { data, error } = await createServerSupabaseClient().rpc(
      "velto_creator_script_build_request",
      {
        p_owner_user_id: input.ownerId,
        p_project_id: input.snapshot.projectId,
        p_idempotency_key: idempotencyKey,
        p_expected_project_revision: input.snapshot.expectedProjectRevision,
        p_strategy_fingerprint: input.snapshot.strategyFingerprint,
        p_language: input.snapshot.language,
        p_requested_duration_seconds: input.snapshot.requestedDurationSeconds,
        p_snapshot_version: input.snapshot.snapshotVersion,
        p_contract_versions: input.snapshot.contractVersions,
        p_snapshot: input.snapshot,
      },
    );
    if (error) {
      throw new Error(`CREATOR_SCRIPT_BUILD_REQUEST_FAILED:${error.message}`);
    }
    const envelope = rpcEnvelope(data);
    const build = mapBuild(envelope.value);
    if (
      !envelope.created
      && (
        build.ownerId !== input.ownerId
        || canonicalCreatorScriptBuildJson(build.snapshot)
          !== canonicalCreatorScriptBuildJson(input.snapshot)
      )
    ) {
      throw new Error("CREATOR_SCRIPT_BUILD_IDEMPOTENCY_COLLISION");
    }
    return {
      build,
      created: envelope.created,
      resolution: envelope.created
        ? "CREATED"
        : resolveCreatorScriptBuildDuplicate(build),
    };
  }

  async getForOwner(buildId: string, ownerId: string) {
    const { data, error } = await createServerSupabaseClient()
      .from("velto_creator_script_builds")
      .select("*")
      .eq("id", buildId)
      .eq("owner_user_id", ownerId)
      .maybeSingle();
    if (error) {
      throw new Error(`CREATOR_SCRIPT_BUILD_READ_FAILED:${error.message}`);
    }
    return data ? mapBuild(data as Row) : null;
  }

  async getByIdempotencyForOwner(idempotencyKey: string, ownerId: string) {
    const { data, error } = await createServerSupabaseClient()
      .from("velto_creator_script_builds")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .eq("owner_user_id", ownerId)
      .maybeSingle();
    if (error) {
      throw new Error(`CREATOR_SCRIPT_BUILD_READ_FAILED:${error.message}`);
    }
    return data ? mapBuild(data as Row) : null;
  }

  async transition(input: TransitionCreatorScriptBuildInput) {
    assertCreatorScriptBuildTransition(input.expectedState, input.nextState);
    const terminalFailure =
      input.nextState === "FAILED" || input.nextState === "STALE";
    if (terminalFailure !== Boolean(input.failure)) {
      throw new Error("CREATOR_SCRIPT_BUILD_FAILURE_CONTRACT_INVALID");
    }
    const { data, error } = await createServerSupabaseClient()
      .from("velto_creator_script_builds")
      .update({
        state: input.nextState,
        failure: input.failure || null,
        result_authority: input.resultAuthority ?? null,
      })
      .eq("id", input.buildId)
      .eq("owner_user_id", input.ownerId)
      .eq("state", input.expectedState)
      .select("*")
      .maybeSingle();
    if (error || !data) {
      mutationFailure("CREATOR_SCRIPT_BUILD_TRANSITION_FAILED", error, data);
    }
    return mapBuild(data as Row);
  }

  async saveCheckpoint(input: SaveCreatorScriptBuildCheckpointInput) {
    assertCreatorScriptBuildCheckpointIdentity({
      buildId: input.buildId,
      checkpoint: input.checkpoint,
    });
    const { data, error } = await createServerSupabaseClient().rpc(
      "velto_creator_script_build_checkpoint",
      {
        p_owner_user_id: input.ownerId,
        p_build_id: input.buildId,
        p_expected_build_state: input.expectedBuildState,
        p_stage: input.checkpoint.stage,
        p_checkpoint: input.checkpoint,
      },
    );
    if (error || !data) {
      mutationFailure("CREATOR_SCRIPT_BUILD_CHECKPOINT_FAILED", error, data);
    }
    return mapBuild(record(data));
  }

  async requestOperation(input: RequestCreatorScriptBuildOperationInput) {
    const operationId = createCreatorScriptBuildOperationId(input);
    const { data, error } = await createServerSupabaseClient().rpc(
      "velto_creator_script_build_operation_request",
      {
        p_owner_user_id: input.ownerId,
        p_build_id: input.buildId,
        p_operation_identity: operationId,
        p_stage: input.stage,
        p_operation_type: input.operationType,
        p_semantic_fingerprint: input.semanticFingerprint,
        p_contract_version: input.contractVersion,
      },
    );
    if (error) {
      throw new Error(
        `CREATOR_SCRIPT_BUILD_OPERATION_REQUEST_FAILED:${error.message}`,
      );
    }
    const envelope = rpcEnvelope(data);
    const operation = mapOperation(envelope.value);
    if (
      !envelope.created
      && (
        operation.ownerId !== input.ownerId
        || operation.buildId !== input.buildId
        || operation.stage !== input.stage
        || operation.operationType !== input.operationType
        || operation.semanticFingerprint !== input.semanticFingerprint
        || operation.contractVersion !== input.contractVersion
      )
    ) {
      throw new Error("CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_COLLISION");
    }
    return { operation, created: envelope.created };
  }

  async getOperationForOwner(
    operationId: string,
    buildId: string,
    ownerId: string,
  ) {
    const { data, error } = await createServerSupabaseClient()
      .from("velto_creator_script_build_operations")
      .select("*")
      .eq("operation_identity", operationId)
      .eq("build_id", buildId)
      .eq("owner_user_id", ownerId)
      .maybeSingle();
    if (error) {
      throw new Error(`CREATOR_SCRIPT_BUILD_OPERATION_READ_FAILED:${error.message}`);
    }
    return data ? mapOperation(data as Row) : null;
  }

  async transitionOperation(input: TransitionCreatorScriptBuildOperationInput) {
    assertCreatorScriptBuildOperationTransition(
      input.expectedState,
      input.nextState,
    );
    const expectsResult = input.nextState === "COMPLETED";
    const expectsFailure =
      input.nextState === "FAILED" || input.nextState === "OUTCOME_UNCERTAIN";
    if (expectsResult !== (input.resultReference != null)) {
      throw new Error("CREATOR_SCRIPT_BUILD_OPERATION_RESULT_CONTRACT_INVALID");
    }
    if (expectsFailure !== Boolean(input.failure)) {
      throw new Error("CREATOR_SCRIPT_BUILD_OPERATION_FAILURE_CONTRACT_INVALID");
    }
    const { data, error } = await createServerSupabaseClient()
      .from("velto_creator_script_build_operations")
      .update({
        state: input.nextState,
        result_reference: input.resultReference ?? null,
        failure: input.failure || null,
      })
      .eq("operation_identity", input.operationId)
      .eq("build_id", input.buildId)
      .eq("owner_user_id", input.ownerId)
      .eq("state", input.expectedState)
      .select("*")
      .maybeSingle();
    if (error || !data) {
      mutationFailure(
        "CREATOR_SCRIPT_BUILD_OPERATION_TRANSITION_FAILED",
        error,
        data,
      );
    }
    return mapOperation(data as Row);
  }

  async persistAccepted(
    input: PersistAcceptedCreatorScriptBuildInput,
  ): Promise<PersistAcceptedCreatorScriptBuildResult> {
    assertCreatorScriptBuildCheckpointIdentity({
      buildId: input.buildId,
      checkpoint: input.checkpoint,
    });
    if (
      input.checkpoint.stage !== "persistence"
      || input.checkpoint.status !== "COMPLETED"
      || input.checkpoint.operationId !== null
    ) {
      throw new Error("CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_INVALID");
    }

    const { data, error } = await createServerSupabaseClient().rpc(
      "velto_creator_script_build_persist",
      {
        p_owner_user_id: input.ownerId,
        p_build_id: input.buildId,
        p_expected_project_revision: input.expectedProjectRevision,
        p_installed_project_revision: input.installedProjectRevision,
        p_creator_project_state: input.creatorProjectState,
        p_invalidate_production: input.invalidateProduction,
        p_persistence_checkpoint: input.checkpoint,
      },
    );
    if (error) {
      throw new Error(
        `CREATOR_SCRIPT_BUILD_PERSISTENCE_FAILED:${error.message}`,
      );
    }
    const envelope = record(data);
    const status = String(envelope.status || "");
    if (status !== "PERSISTED" && status !== "STALE") {
      throw new Error("CREATOR_SCRIPT_BUILD_PERSISTENCE_RESULT_INVALID");
    }
    const build = mapBuild(record(envelope.build));
    const project = record(envelope.project) as VeltoProjectApiRecord;
    if (
      build.ownerId !== input.ownerId
      || build.buildId !== input.buildId
      || project.id !== build.projectId
      || project.owner_user_id !== input.ownerId
      || (status === "PERSISTED" && build.state !== "PERSISTED")
      || (status === "STALE" && build.state !== "STALE")
    ) {
      throw new Error("CREATOR_SCRIPT_BUILD_PERSISTENCE_RESULT_INVALID");
    }
    return {
      status,
      build,
      project,
    };
  }
}
