import type { CreatorScript } from "./creatorScript.ts";

type UnknownRecord = Record<string, unknown>;

export type CreatorProductionSnapshotSummary = {
  id: string;
  projectId: string;
  sourceScriptRevision: number;
  invalidationReason: string;
  invalidatedAt: string;
  createdAt: string;
  sceneCount: number;
  hasFinalVideo: boolean;
};

export type CreatorProductionSnapshot = CreatorProductionSnapshotSummary & {
  mutationId: string;
  scriptFingerprint: string;
  approvalFingerprint: string;
  snapshot: UnknownRecord;
  mediaReferenceCount: number;
};

const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value)
  ? value as UnknownRecord
  : {};

const array = (value: unknown) => Array.isArray(value) ? value : [];

export function creatorProjectHasMeaningfulProduction(project: UnknownRecord): boolean {
  const exported = record(project.exported_movie_result ?? project.exportedMovieResult);
  const state = record(exported.creatorProjectState);
  const createReview = record(state.createReview);
  const production = record(state.production);
  const productionPackage = record(project.creator_production_package ?? project.creatorProductionPackage ?? production.package);
  const audioTimeline = record(production.audioTimeline);

  return array(project.scenes).length > 0
    || array(project.refined_creator_scenes ?? project.refinedCreatorScenes).length > 0
    || array(createReview.scenes).length > 0
    || array(production.refinedScenes).length > 0
    || array(productionPackage.scenes).length > 0
    || array(audioTimeline.placements).length > 0
    || Boolean(String(project.exported_movie_url ?? project.exportedMovieUrl ?? "").trim())
    || Boolean(String(project.export_signature ?? project.exportSignature ?? "").trim());
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createCreatorProductionInvalidationIdentity(input: {
  projectId: string;
  reason: string;
  fromRevision: number;
  toRevision: number;
  nextScript: CreatorScript;
}) {
  const contentIdentity = input.nextScript.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
    text: section.text,
  }));
  return [
    "creator-production-invalidation-v1",
    input.projectId,
    input.reason,
    input.fromRevision,
    input.toRevision,
    stableHash(JSON.stringify(contentIdentity)),
  ].join(":");
}

export function getCreatorProductionSnapshotProject(snapshot: unknown): UnknownRecord {
  return record(record(snapshot).project);
}

export function getCreatorProductionSnapshotScenes(snapshot: unknown): unknown[] {
  const project = getCreatorProductionSnapshotProject(snapshot);
  const exported = record(project.exported_movie_result);
  const state = record(exported.creatorProjectState);
  const canonicalScenes = array(record(state.createReview).scenes);
  return canonicalScenes.length > 0 ? canonicalScenes : array(project.scenes);
}

export async function requireCreatorProductionSnapshotBeforeInvalidation<T>(input: {
  capture: () => Promise<unknown>;
  invalidate: () => T;
}): Promise<T> {
  await input.capture();
  return input.invalidate();
}
