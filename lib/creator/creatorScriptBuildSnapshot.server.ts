import {
  createCreatorScriptBuildSnapshot,
  type CreatorScriptBuildSnapshot,
} from "./creatorScriptBuild.ts";
import { parseCreatorProfile } from "./creatorProfile.ts";
import { resolveCreatorMarketEvidenceSubject } from "./marketEvidenceSubject.ts";
import {
  isValidCreatorProjectState,
  readCreatorProjectState,
} from "./projectState.ts";
import type {
  ProjectRepository,
  VeltoProjectApiRecord,
} from "../persistence/projects/types.ts";

export const CREATOR_SCRIPT_BUILD_RUNTIME_VERSION = "0.19E5A" as const;

export const CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS = Object.freeze({
  canonicalEditorialGraph: "0.19A",
  editorialEvidenceSpanCatalog: "0.19B",
  claimAuthorityResolver: "0.19C",
  creatorScriptAcceptance: "0.19D",
  creatorScriptBuild: "0.19E1",
  creatorScriptResearchEditorialCoordinator: "0.19E2A",
  creatorScriptBuildAuthorityCoordinator: "0.19E2B",
  creatorScriptBuildScriptGenerationCoordinator: "0.19E3A",
  creatorScriptBuildScriptRepairCoordinator: "0.19E3B",
  creatorScriptBuildAcceptanceCoordinator: "0.19E3C",
  creatorScriptBuildPersistenceCoordinator: "0.19E4",
  creatorScriptBuildRuntime: CREATOR_SCRIPT_BUILD_RUNTIME_VERSION,
});

export class CreatorScriptBuildSnapshotError extends Error {
  readonly code: string;
  readonly status: 404 | 409 | 422;

  constructor(code: string, status: 404 | 409 | 422) {
    super(code);
    this.name = "CreatorScriptBuildSnapshotError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown, code: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new CreatorScriptBuildSnapshotError(code, 422);
  }
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maxLength) {
    throw new CreatorScriptBuildSnapshotError(code, 422);
  }
  return normalized;
}

function canonicalStateFromProject(project: VeltoProjectApiRecord) {
  const exportedMovieResult = record(project.exported_movie_result);
  const rawState = exportedMovieResult?.creatorProjectState;
  if (!isValidCreatorProjectState(rawState)) {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_PROJECT_STATE_INVALID",
      422,
    );
  }
  return readCreatorProjectState(project);
}

function assertMentorAuthority(value: Record<string, unknown>) {
  for (const field of [
    "audienceInsight",
    "hookPatterns",
    "videoIdeas",
    "productionPlan",
  ]) {
    if (!Array.isArray(value[field])) {
      throw new CreatorScriptBuildSnapshotError(
        "CREATOR_SCRIPT_BUILD_APPROVED_STRATEGY_INVALID",
        422,
      );
    }
  }
}

function assertProfileAuthority(value: Record<string, unknown>) {
  const requiredTextFields = [
    "brandName",
    "brandVoice",
    "defaultAudience",
    "defaultVisualStyle",
    "defaultCountry",
    "defaultFormat",
    "defaultQualityMode",
    "defaultCreditPreference",
  ];
  if (
    requiredTextFields.some((field) => typeof value[field] !== "string") ||
    !record(value.editorialConstitution)
  ) {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_PROFILE_SNAPSHOT_INVALID",
      422,
    );
  }
}

function requestedDurationSeconds(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 5 || Number(value) > 3_600) {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_DURATION_INVALID",
      422,
    );
  }
  return Number(value);
}

function mentorDirection(input: {
  mentorResult: Record<string, unknown>;
  selectedDirectionId: string;
}) {
  const recommendedIdea = record(input.mentorResult.recommendedIdea);
  const recommendedTitle = requiredText(
    recommendedIdea?.title,
    "CREATOR_SCRIPT_BUILD_RECOMMENDED_DIRECTION_REQUIRED",
    1_000,
  );
  const recommendedReason = requiredText(
    recommendedIdea?.reason,
    "CREATOR_SCRIPT_BUILD_RECOMMENDED_DIRECTION_REQUIRED",
    2_000,
  );
  const alternatives = (Array.isArray(input.mentorResult.videoIdeas)
    ? input.mentorResult.videoIdeas
    : [])
    .flatMap((value) => {
      const idea = record(value);
      if (!idea) return [];
      const title = typeof idea.title === "string"
        ? idea.title.replace(/\s+/gu, " ").trim().slice(0, 1_000)
        : "";
      const concept = typeof idea.concept === "string"
        ? idea.concept.replace(/\s+/gu, " ").trim().slice(0, 2_000)
        : "";
      return title && title.toLocaleLowerCase() !== recommendedTitle.toLocaleLowerCase()
        ? [{ title, concept }]
        : [];
    })
    .slice(0, 2)
    .map((idea, index) => ({
      id: `alternative-${index + 1}`,
      title: idea.title,
      concept: idea.concept,
      source: "alternative" as const,
    }));
  const directions = [{
    id: "recommended",
    title: recommendedTitle,
    concept: recommendedReason,
    source: "recommended" as const,
  }, ...alternatives];
  const selected = directions.find((direction) =>
    direction.id === input.selectedDirectionId
  );
  if (!selected) {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_SELECTED_DIRECTION_INVALID",
      422,
    );
  }
  return { selected, recommendedIdea: { title: recommendedTitle }, alternatives };
}

export async function createCreatorScriptBuildSnapshotFromProject(input: {
  ownerId: string;
  projectId: string;
  expectedProjectUpdatedAt: string;
  projectRepository: Pick<ProjectRepository, "getForOwner">;
}): Promise<{
  project: VeltoProjectApiRecord;
  snapshot: CreatorScriptBuildSnapshot;
}> {
  const projectId = requiredText(
    input.projectId,
    "CREATOR_SCRIPT_BUILD_PROJECT_ID_REQUIRED",
    120,
  );
  const expectedProjectUpdatedAt = requiredText(
    input.expectedProjectUpdatedAt,
    "CREATOR_SCRIPT_BUILD_PROJECT_REVISION_REQUIRED",
    120,
  );
  const project = await input.projectRepository.getForOwner(projectId, input.ownerId);
  if (!project) {
    throw new CreatorScriptBuildSnapshotError(
      "PROJECT_OR_BUILD_NOT_FOUND",
      404,
    );
  }
  if (project.flow_type !== "creator_lab") {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_PROJECT_FLOW_INVALID",
      422,
    );
  }
  const projectRevision = requiredText(
    project.updated_at,
    "CREATOR_SCRIPT_BUILD_PROJECT_REVISION_MISSING",
    120,
  );
  if (projectRevision !== expectedProjectUpdatedAt) {
    throw new CreatorScriptBuildSnapshotError("PROJECT_STALE", 409);
  }

  const state = canonicalStateFromProject(project);
  const mentorResult = record(state.strategy.mentorResult);
  if (!mentorResult) {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_APPROVED_STRATEGY_REQUIRED",
      422,
    );
  }
  assertMentorAuthority(mentorResult);
  const strategyFingerprint = requiredText(
    state.strategy.strategyFingerprint,
    "CREATOR_SCRIPT_BUILD_STRATEGY_FINGERPRINT_REQUIRED",
    256,
  );
  const selectedDirectionId = requiredText(
    state.strategy.selectedDirectionId,
    "CREATOR_SCRIPT_BUILD_SELECTED_DIRECTION_REQUIRED",
    240,
  );
  const selectedHook = requiredText(
    state.strategy.selectedHook,
    "CREATOR_SCRIPT_BUILD_SELECTED_HOOK_REQUIRED",
    2_000,
  );
  const profileSnapshot = record(state.strategy.profileSnapshot);
  if (!profileSnapshot) {
    throw new CreatorScriptBuildSnapshotError(
      "CREATOR_SCRIPT_BUILD_PROFILE_SNAPSHOT_REQUIRED",
      422,
    );
  }
  assertProfileAuthority(profileSnapshot);
  const direction = mentorDirection({ mentorResult, selectedDirectionId });
  const researchSubject = resolveCreatorMarketEvidenceSubject({
    briefTopic: state.brief.topic,
    selectedDirectionId,
    recommendedIdea: direction.recommendedIdea,
    videoIdeas: direction.alternatives,
  });
  const creatorProfile = parseCreatorProfile(profileSnapshot);
  const snapshot = createCreatorScriptBuildSnapshot({
    projectId,
    expectedProjectRevision: projectRevision,
    strategyFingerprint,
    language: state.brief.language,
    requestedDurationSeconds: requestedDurationSeconds(state.brief.durationSec),
    strategy: {
      topic: requiredText(
        state.brief.topic,
        "CREATOR_SCRIPT_BUILD_TOPIC_REQUIRED",
        4_000,
      ),
      researchSubject: researchSubject || null,
      title: direction.selected.title,
      contentType: requiredText(
        state.brief.contentType,
        "CREATOR_SCRIPT_BUILD_CONTENT_TYPE_REQUIRED",
        160,
      ),
      format: requiredText(
        state.brief.format,
        "CREATOR_SCRIPT_BUILD_FORMAT_REQUIRED",
        160,
      ),
      selectedDirectionId,
      selectedHook,
      approvedStrategy: {
        selectedDirection: direction.selected,
        selectedHook,
        mentorAnalysis: mentorResult,
      },
    },
    creatorProfile: creatorProfile as unknown as Record<string, unknown>,
    contractVersions: CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS,
  });
  return { project, snapshot };
}

export async function getCurrentCreatorProjectRevision(input: {
  ownerId: string;
  projectId: string;
  projectRepository: Pick<ProjectRepository, "getForOwner">;
}) {
  const project = await input.projectRepository.getForOwner(
    input.projectId,
    input.ownerId,
  );
  return typeof project?.updated_at === "string" && project.updated_at.trim()
    ? project.updated_at.trim()
    : null;
}
