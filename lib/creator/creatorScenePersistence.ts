export type CreatorSceneHydrationAuthority =
  | "unknown"
  | "hydrated_empty"
  | "hydrated_populated"
  | "recovery_required";

export function shouldPreservePersistedCreatorScenes(input: {
  persistedSceneCount: number;
  incomingScenesPresent: boolean;
  incomingSceneCount: number;
  serverAuthorizedInvalidation: boolean;
}) {
  return input.persistedSceneCount > 0
    && input.incomingScenesPresent
    && input.incomingSceneCount === 0
    && !input.serverAuthorizedInvalidation;
}

export function resolveCreatorSceneSaveAuthority<TScene>(input: {
  persistedScenes: readonly TScene[];
  candidateScenes: readonly TScene[];
  incomingScenes?: readonly TScene[] | null;
  serverAuthorizedInvalidation: boolean;
}) {
  const incomingScenesPresent = input.incomingScenes !== undefined;
  const incomingSceneCount = Array.isArray(input.incomingScenes)
    ? input.incomingScenes.length
    : 0;
  const preserveDestructiveEmpty = shouldPreservePersistedCreatorScenes({
    persistedSceneCount: input.persistedScenes.length,
    incomingScenesPresent,
    incomingSceneCount,
    serverAuthorizedInvalidation: input.serverAuthorizedInvalidation,
  });
  const partialSave = !incomingScenesPresent;

  if (partialSave || preserveDestructiveEmpty) {
    return {
      canonicalScenes: [...input.persistedScenes],
      persistedColumnScenes: partialSave ? undefined : [...input.persistedScenes],
      preserved: true,
    };
  }

  const replacementScenes = Array.isArray(input.incomingScenes)
    ? [...input.incomingScenes]
    : [...input.candidateScenes];
  return {
    canonicalScenes: replacementScenes,
    persistedColumnScenes: input.incomingScenes === null ? null : replacementScenes,
    preserved: false,
  };
}

export function resolveCreatorSceneHydrationAuthority(input: {
  canonicalSceneCount: number;
  currentProductionPackageSceneCount: number;
}): CreatorSceneHydrationAuthority {
  if (input.canonicalSceneCount > 0) return "hydrated_populated";
  if (input.currentProductionPackageSceneCount > 0) return "recovery_required";
  return "hydrated_empty";
}

export function shouldPersistCreatorSceneProjection(input: {
  authority: CreatorSceneHydrationAuthority;
  sceneCount: number;
}) {
  return input.authority === "hydrated_populated" && input.sceneCount > 0;
}
