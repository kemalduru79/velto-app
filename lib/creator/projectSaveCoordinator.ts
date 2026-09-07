import type { CreatorProjectStateSnapshot } from "./projectState";

export type CreatorProjectSaveBinding = Readonly<{
  originProjectId: string;
  projectId: string;
  expectedUpdatedAt: string;
  generation: number;
  creatorProjectState: CreatorProjectStateSnapshot | null;
}>;

export function createCreatorProjectSaveBinding(
  binding: CreatorProjectSaveBinding,
): CreatorProjectSaveBinding {
  return Object.freeze({ ...binding });
}

export function isCreatorProjectSaveBindingActive(
  binding: CreatorProjectSaveBinding,
  active: { projectId: string; generation: number },
) {
  return binding.generation === active.generation && binding.originProjectId === active.projectId;
}

export function advanceCreatorProjectSaveBinding(
  binding: CreatorProjectSaveBinding,
  active: { projectId: string; expectedUpdatedAt: string; generation: number },
): CreatorProjectSaveBinding | null {
  if (binding.generation !== active.generation) return null;
  const advancesProjectIdentity = binding.projectId === binding.originProjectId;
  return createCreatorProjectSaveBinding({
    ...binding,
    originProjectId: advancesProjectIdentity ? active.projectId : binding.originProjectId,
    projectId: advancesProjectIdentity ? active.projectId : binding.projectId,
    expectedUpdatedAt: advancesProjectIdentity
      ? active.expectedUpdatedAt
      : binding.expectedUpdatedAt,
  });
}

export type CreatorProjectOperationOrigin = Readonly<{
  projectId: string;
  generation: number;
}>;

export function isCreatorProjectOperationActive(
  origin: CreatorProjectOperationOrigin,
  active: CreatorProjectOperationOrigin,
) {
  return origin.projectId === active.projectId && origin.generation === active.generation;
}

export function creatorProjectStateRequestFields(
  flowType: "creator_lab" | "storyverse",
  snapshot: CreatorProjectStateSnapshot | null,
) {
  return flowType === "creator_lab" ? { creatorProjectState: snapshot } : {};
}
