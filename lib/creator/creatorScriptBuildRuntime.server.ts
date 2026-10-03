import {
  creatorScriptBuildIsTerminal,
  type CreatorScriptBuildRecord,
  type CreatorScriptBuildSnapshot,
} from "./creatorScriptBuild.ts";
import {
  runCreatorScriptBuildResearchEditorialCoordinator,
  type CreatorScriptBuildEditorialProposalExecutor,
  type CreatorScriptBuildResearchExecutor,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  runCreatorScriptBuildAuthorityCoordinator,
  type CreatorScriptBuildPrimaryAcquisitionExecutor,
  type CreatorScriptBuildPrimarySelectionExecutor,
} from "./creatorScriptBuildAuthorityCoordinator.ts";
import {
  runCreatorScriptBuildScriptGenerationCoordinator,
  type CreatorScriptBuildScriptGenerationExecutor,
} from "./creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  runCreatorScriptBuildScriptRepairCoordinator,
  type CreatorScriptBuildScriptRepairExecutor,
} from "./creatorScriptBuildScriptRepairCoordinator.ts";
import {
  normalizeCreatorScriptBuildAcceptedResultAuthority,
  runCreatorScriptBuildAcceptanceCoordinator,
} from "./creatorScriptBuildAcceptanceCoordinator.ts";
import {
  normalizeCreatorScriptBuildPersistenceCheckpoint,
  runCreatorScriptBuildPersistenceCoordinator,
} from "./creatorScriptBuildPersistenceCoordinator.ts";
import {
  getCurrentCreatorProjectRevision,
} from "./creatorScriptBuildSnapshot.server.ts";
import type {
  CreatorScriptBuildRepository,
  RequestCreatorScriptBuildResult,
} from "../persistence/creatorScriptBuilds/types.ts";
import type {
  ProjectRepository,
} from "../persistence/projects/types.ts";

export type CreatorScriptBuildProviderExecutors = Readonly<{
  executeResearch: CreatorScriptBuildResearchExecutor;
  executeEditorialProposal: CreatorScriptBuildEditorialProposalExecutor;
  executePrimaryAcquisition: CreatorScriptBuildPrimaryAcquisitionExecutor;
  executePrimaryCoverageSelection: CreatorScriptBuildPrimarySelectionExecutor;
  executeScriptGeneration: CreatorScriptBuildScriptGenerationExecutor;
  executeScriptRepair: CreatorScriptBuildScriptRepairExecutor;
}>;

export type CreatorScriptBuildRuntimeCoordinatorRunners = Readonly<{
  researchEditorial: typeof runCreatorScriptBuildResearchEditorialCoordinator;
  authority: typeof runCreatorScriptBuildAuthorityCoordinator;
  generation: typeof runCreatorScriptBuildScriptGenerationCoordinator;
  repair: typeof runCreatorScriptBuildScriptRepairCoordinator;
  acceptance: typeof runCreatorScriptBuildAcceptanceCoordinator;
  persistence: typeof runCreatorScriptBuildPersistenceCoordinator;
}>;

export type CreatorScriptBuildRuntimeDependencies = Readonly<{
  buildRepository: CreatorScriptBuildRepository;
  projectRepository: Pick<ProjectRepository, "getForOwner">;
  providers: CreatorScriptBuildProviderExecutors;
  runners?: Partial<CreatorScriptBuildRuntimeCoordinatorRunners>;
  now?: () => string;
}>;

export type CreatorScriptBuildStatusProjection = Readonly<{
  success: true;
  version: "0.19E5A";
  buildId: string;
  state: CreatorScriptBuildRecord["state"];
  terminal: boolean;
  disposition: string | null;
  failure: Readonly<{
    category: string;
    code: string;
    retryability: string;
  }> | null;
  projectUpdatedAt?: string;
  creatorScript?: unknown;
  persistence?: Readonly<{ installedProjectRevision: string }>;
}>;

const defaultRunners: CreatorScriptBuildRuntimeCoordinatorRunners = {
  researchEditorial: runCreatorScriptBuildResearchEditorialCoordinator,
  authority: runCreatorScriptBuildAuthorityCoordinator,
  generation: runCreatorScriptBuildScriptGenerationCoordinator,
  repair: runCreatorScriptBuildScriptRepairCoordinator,
  acceptance: runCreatorScriptBuildAcceptanceCoordinator,
  persistence: runCreatorScriptBuildPersistenceCoordinator,
};

function boundedFailure(build: CreatorScriptBuildRecord) {
  return build.failure
    ? {
        category: build.failure.category,
        code: build.failure.code,
        retryability: build.failure.retryability,
      }
    : null;
}

export function createCreatorScriptBuildRuntime(
  dependencies: CreatorScriptBuildRuntimeDependencies,
) {
  const runners = { ...defaultRunners, ...(dependencies.runners || {}) };
  const getCurrentProjectRevision = (input: {
    ownerId: string;
    projectId: string;
  }) => getCurrentCreatorProjectRevision({
    ...input,
    projectRepository: dependencies.projectRepository,
  });
  const common = {
    repository: dependencies.buildRepository,
    getCurrentProjectRevision,
    ...(dependencies.now ? { now: dependencies.now } : {}),
  };

  const getForOwner = async (ownerId: string, buildId: string) => {
    const build = await dependencies.buildRepository.getForOwner(buildId, ownerId);
    if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
    return build;
  };

  const status = async (input: {
    ownerId: string;
    buildId: string;
    disposition?: string | null;
  }): Promise<CreatorScriptBuildStatusProjection> => {
    const build = await getForOwner(input.ownerId, input.buildId);
    const projection: CreatorScriptBuildStatusProjection = {
      success: true,
      version: "0.19E5A",
      buildId: build.buildId,
      state: build.state,
      terminal: creatorScriptBuildIsTerminal(build.state),
      disposition: input.disposition || null,
      failure: boundedFailure(build),
    };
    if (build.state !== "PERSISTED") return projection;

    const authority = normalizeCreatorScriptBuildAcceptedResultAuthority({
      value: build.resultAuthority,
      snapshot: build.snapshot,
    });
    const persistence = normalizeCreatorScriptBuildPersistenceCheckpoint({
      build,
      authority,
    });
    return {
      ...projection,
      creatorScript: authority.acceptance.script,
      persistence: {
        installedProjectRevision: persistence.installedProjectRevision,
      },
    };
  };

  const request = async (input: {
    ownerId: string;
    snapshot: CreatorScriptBuildSnapshot;
  }): Promise<RequestCreatorScriptBuildResult> =>
    dependencies.buildRepository.request(input);

  const advance = async (input: { ownerId: string; buildId: string }) => {
    const initial = await getForOwner(input.ownerId, input.buildId);
    if (creatorScriptBuildIsTerminal(initial.state)) {
      return status({
        ...input,
        disposition: "TERMINAL_NOOP",
      });
    }

    let result: { build: CreatorScriptBuildRecord };
    try {
      switch (initial.state) {
      case "REQUESTED":
      case "SNAPSHOTTED":
      case "RESEARCH_READY":
        result = await runners.researchEditorial({
          ...input,
          dependencies: {
            ...common,
            executeResearch: dependencies.providers.executeResearch,
            executeEditorialProposal: dependencies.providers.executeEditorialProposal,
          },
        });
        break;
      case "EDITORIAL_COMPILED":
        result = await runners.authority({
          ...input,
          dependencies: {
            ...common,
            executePrimaryAcquisition:
              dependencies.providers.executePrimaryAcquisition,
            executePrimaryCoverageSelection:
              dependencies.providers.executePrimaryCoverageSelection,
          },
        });
        break;
      case "AUTHORITY_RESOLVED":
        result = await runners.generation({
          ...input,
          dependencies: {
            ...common,
            executeScriptGeneration:
              dependencies.providers.executeScriptGeneration,
          },
        });
        break;
      case "SCRIPT_GENERATED":
      case "REPAIRING": {
        result = await runners.repair({
          ...input,
          dependencies: {
            ...common,
            executeScriptRepair: dependencies.providers.executeScriptRepair,
          },
        });
        const repaired = await getForOwner(input.ownerId, input.buildId);
        if (repaired.state === "SCRIPT_GENERATED" || repaired.state === "REPAIRING") {
          result = await runners.acceptance({
            ...input,
            dependencies: common,
          });
        }
        break;
      }
      case "ACCEPTED":
        result = await runners.persistence({
          ...input,
          dependencies: {
            buildRepository: dependencies.buildRepository,
            projectRepository: dependencies.projectRepository,
            ...(dependencies.now ? { now: dependencies.now } : {}),
          },
        });
        break;
        default:
          return status({ ...input, disposition: "TERMINAL_NOOP" });
      }
    } catch (error) {
      const current = await dependencies.buildRepository.getForOwner(
        input.buildId,
        input.ownerId,
      );
      if (current && creatorScriptBuildIsTerminal(current.state)) {
        return status({ ...input, disposition: "TERMINAL_AFTER_ADVANCE" });
      }
      throw error;
    }
    return status({
      ...input,
      disposition: result.build.state === initial.state
        ? "REUSED_DURABLE_RESULT"
        : "ADVANCED",
    });
  };

  return Object.freeze({ request, advance, status, getForOwner });
}

export type CreatorScriptBuildRuntime = ReturnType<
  typeof createCreatorScriptBuildRuntime
>;
