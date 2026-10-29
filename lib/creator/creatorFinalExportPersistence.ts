import { inspectCreatorProjectStatePersistenceAuthority } from "./projectState.ts";
import { createCreatorAutosaveSemanticKey } from "./creatorHydrationPersistence.ts";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Only the final-video fields change; script, revisions, scenes and audio stay canonical. */
export function createCreatorFinalExportProjectEnvelope(project: Record<string, unknown>, movie: Record<string, unknown>) {
  const authority = inspectCreatorProjectStatePersistenceAuthority(project);
  if (authority.status !== "valid") throw new Error("CREATOR_PROJECT_STATE_REPAIR_REQUIRED");
  const state = authority.snapshot;
  return {
    ...authority.envelope,
    ...movie,
    creatorProjectState: {
      ...state,
      publish: {
        ...state.publish,
        finalVideoUrl: String(movie.movieUrl || ""),
        finalVideoSignature: String(movie.productionSignature || ""),
      },
    },
  };
}

export type CreatorFinalExportRevisionBinding = Readonly<{
  projectId: string;
  jobId: string;
  previousProjectUpdatedAt: string;
  projectUpdatedAt: string;
}>;

export function normalizeCreatorFinalExportRevisionBinding(value: unknown): CreatorFinalExportRevisionBinding | null {
  const raw = record(value);
  const fields = ["projectId", "jobId", "previousProjectUpdatedAt", "projectUpdatedAt"] as const;
  if (fields.some(key => typeof raw[key] !== "string" || !(raw[key] as string).trim() || (raw[key] as string).length > 160)) return null;
  if (!Number.isFinite(Date.parse(raw.previousProjectUpdatedAt as string)) ||
      !Number.isFinite(Date.parse(raw.projectUpdatedAt as string)) ||
      Date.parse(raw.projectUpdatedAt as string) < Date.parse(raw.previousProjectUpdatedAt as string)) return null;
  return Object.fromEntries(fields.map(key => [key, raw[key]])) as CreatorFinalExportRevisionBinding;
}

/** Read after the atomic CAS install: triggers may choose a different timestamp than the RPC clock. */
export function createCreatorFinalExportRevisionBinding(input: {
  projectId: string;
  jobId: string;
  previousProjectUpdatedAt: string;
  project: Record<string, unknown>;
  exportedMovieResult: Record<string, unknown>;
}) {
  if (input.project.id !== input.projectId ||
      createCreatorAutosaveSemanticKey(input.project.exported_movie_result) !== createCreatorAutosaveSemanticKey(input.exportedMovieResult)) return null;
  return normalizeCreatorFinalExportRevisionBinding({
    projectId: input.projectId, jobId: input.jobId,
    previousProjectUpdatedAt: input.previousProjectUpdatedAt,
    projectUpdatedAt: input.project.updated_at,
  });
}

/** A known final-video-only write may advance CAS; unrelated saves and project generations may not. */
export function resolveCreatorFinalExportRevisionAdvance(input: {
  binding: unknown;
  jobId: string;
  origin: { projectId: string; generation: number };
  active: { projectId: string; generation: number; expectedUpdatedAt: string };
}) {
  const binding = normalizeCreatorFinalExportRevisionBinding(input.binding);
  if (!binding || binding.jobId !== input.jobId || binding.projectId !== input.origin.projectId ||
      binding.projectId !== input.active.projectId || input.origin.generation !== input.active.generation ||
      (input.active.expectedUpdatedAt !== binding.previousProjectUpdatedAt && input.active.expectedUpdatedAt !== binding.projectUpdatedAt)) return null;
  return binding.projectUpdatedAt;
}
