import { CLAIM_PROPOSITION_AUTHORITY_VERSION } from "../research/claimPropositionAuthority.ts";
import { createHash } from "node:crypto";
import {
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildOperationId,
  createCreatorScriptBuildFailure,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildRecord,
} from "./creatorScriptBuild.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import type { CreatorScriptBuildRepository } from "../persistence/creatorScriptBuilds/types.ts";

export const CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION =
  "creator-script-build-editorial-adjudication-recovery-v2" as const;

type Step = {
  kind: "proposal" | "adjudication";
  ordinal: 1 | 2;
  authority: CreatorScriptBuildJson;
  priorRejection: CreatorScriptBuildJson | null;
};
export type CreatorScriptBuildEditorialRecoveryContext = {
  buildId: string;
  runStep: (step: Step, execute: (operationId: string) => Promise<CreatorScriptBuildJson>) => Promise<CreatorScriptBuildJson>;
};

export function createCreatorScriptBuildEditorialRecoveryContext(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  parentOperationId: string;
  assertAuthority: () => Promise<void>;
}) {
  const identity = (step: Step) => {
    const semanticFingerprint = createHash("sha256").update(canonicalCreatorScriptBuildJson(JSON.parse(JSON.stringify({
      policyVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION,
      reconciliationVersion: CLAIM_PROPOSITION_AUTHORITY_VERSION,
      buildId: input.build.buildId, parentOperationId: input.parentOperationId, ...step,
    })))).digest("hex");
    return {
      ownerId: input.build.ownerId, buildId: input.build.buildId, stage: "editorial" as const,
      operationType: `creator_editorial_${step.kind}_attempt`, semanticFingerprint,
      contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION,
    };
  };
  const context: CreatorScriptBuildEditorialRecoveryContext = {
    buildId: input.build.buildId,
    runStep: async (step, execute) => {
      await input.assertAuthority();
      const request = identity(step);
      const { operation, created } = await input.repository.requestOperation(request);
      const operationId = createCreatorScriptBuildOperationId(request);
      if (operation.operationId !== operationId || operation.semanticFingerprint !== request.semanticFingerprint ||
          operation.contractVersion !== request.contractVersion || operation.operationType !== request.operationType ||
          operation.buildId !== request.buildId || operation.ownerId !== request.ownerId || operation.stage !== request.stage) {
        throw new CreatorScriptBuildStageExecutionError({ category: "MODEL_CONTRACT",
          code: "CREATOR_SCRIPT_BUILD_EDITORIAL_CHILD_IDENTITY_INVALID", retryability: "NON_RETRYABLE" });
      }
      if (operation.state === "COMPLETED") {
        const stored = operation.resultReference as { policyVersion?: string; fingerprint?: string; outcome?: CreatorScriptBuildJson } | null;
        if (stored?.policyVersion !== request.contractVersion || stored.fingerprint !== request.semanticFingerprint || stored.outcome == null) {
          throw new CreatorScriptBuildStageExecutionError({ category: "MODEL_CONTRACT",
            code: "CREATOR_SCRIPT_BUILD_EDITORIAL_CHILD_RESULT_INVALID", retryability: "NON_RETRYABLE" });
        }
        return stored.outcome;
      }
      if (operation.state === "FAILED") {
        throw new CreatorScriptBuildStageExecutionError({ category: operation.failure?.category || "MODEL_CONTRACT",
          code: operation.failure?.code || "CREATOR_SCRIPT_BUILD_EDITORIAL_CHILD_FAILED",
          retryability: "NON_RETRYABLE", diagnostics: operation.failure?.diagnostics });
      }
      if (!created || operation.state === "OUTCOME_UNCERTAIN") {
        throw new CreatorScriptBuildCoordinatorBlockedError({ code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
          buildId: input.build.buildId, operationId });
      }
      let outcome: CreatorScriptBuildJson;
      try {
        outcome = await execute(operationId);
      } catch (error) {
        if (error instanceof CreatorScriptBuildCoordinatorBlockedError) throw error;
        const classified = error instanceof CreatorScriptBuildStageExecutionError ? error :
          new CreatorScriptBuildStageExecutionError({ category: "PROVIDER",
            code: "CREATOR_SCRIPT_BUILD_EDITORIAL_CHILD_OUTCOME_UNCLASSIFIED", retryability: "UNKNOWN_OUTCOME" });
        const uncertain = classified.retryability === "UNKNOWN_OUTCOME";
        await input.repository.transitionOperation({ ...request, operationId, expectedState: "PENDING",
          nextState: uncertain ? "OUTCOME_UNCERTAIN" : "FAILED",
          failure: createCreatorScriptBuildFailure({ category: classified.category, code: classified.code,
            stage: "editorial", operationId, retryability: classified.retryability, diagnostics: { ...classified.diagnostics } }),
        });
        if (uncertain) throw new CreatorScriptBuildCoordinatorBlockedError({
          code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED", buildId: input.build.buildId, operationId });
        throw classified;
      }
      await input.repository.transitionOperation({ ...request, operationId, expectedState: "PENDING", nextState: "COMPLETED",
        resultReference: { policyVersion: request.contractVersion, fingerprint: request.semanticFingerprint, outcome },
      });
      await input.assertAuthority();
      return outcome;
    },
  };
  return {
    context,
    canResume: async (authority: CreatorScriptBuildJson) => {
      const request = identity({ kind: "proposal", ordinal: 1, authority, priorRejection: null });
      const operation = await input.repository.getOperationForOwner(createCreatorScriptBuildOperationId(request), input.build.buildId, input.build.ownerId);
      return operation?.state === "COMPLETED";
    },
  };
}
