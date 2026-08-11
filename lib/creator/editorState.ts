export type CreatorSceneIdentity = {
  id: number;
  creatorSceneId?: string;
};

const CREATOR_SCENE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCreatorSceneId(value: unknown): value is string {
  return typeof value === "string" && CREATOR_SCENE_ID_PATTERN.test(value);
}

export function createCreatorSceneId(): string {
  return crypto.randomUUID();
}

export function normalizeCreatorSceneIds<TScene extends CreatorSceneIdentity>(
  scenes: readonly TScene[],
  createId: () => string = createCreatorSceneId,
): TScene[] {
  const usedIds = new Set<string>();

  return scenes.map((scene) => {
    const existingId = isCreatorSceneId(scene.creatorSceneId)
      ? scene.creatorSceneId
      : null;

    if (existingId && !usedIds.has(existingId)) {
      usedIds.add(existingId);
      return { ...scene, creatorSceneId: existingId };
    }

    let nextId = createId();
    while (!isCreatorSceneId(nextId) || usedIds.has(nextId)) {
      nextId = createId();
    }
    usedIds.add(nextId);
    return { ...scene, creatorSceneId: nextId };
  });
}

export function selectCreatorSceneId<TScene extends CreatorSceneIdentity>(
  scenes: readonly TScene[],
  selectedCreatorSceneId: string | null,
): string | null {
  if (
    selectedCreatorSceneId &&
    scenes.some((scene) => scene.creatorSceneId === selectedCreatorSceneId)
  ) {
    return selectedCreatorSceneId;
  }

  return scenes.find((scene) => isCreatorSceneId(scene.creatorSceneId))
    ?.creatorSceneId || null;
}

export function projectCanonicalCreatorScenes<
  TScene extends CreatorSceneIdentity,
  TProjection extends object,
>(
  scenes: readonly TScene[],
  project: (scene: TScene) => TProjection,
): Array<TProjection & Required<CreatorSceneIdentity>> {
  return scenes.map((scene) => {
    if (!isCreatorSceneId(scene.creatorSceneId)) {
      throw new Error("CreatorLab canonical scene is missing a stable identity.");
    }

    return {
      ...project(scene),
      id: scene.id,
      creatorSceneId: scene.creatorSceneId,
    };
  });
}

export function synchronizeCreatorSceneProjectionIds<
  TCanonical extends CreatorSceneIdentity,
  TProjection extends CreatorSceneIdentity,
>(
  canonicalScenes: readonly TCanonical[],
  projectionScenes: readonly TProjection[],
): TProjection[] {
  const canonicalByNumericId = new Map(
    canonicalScenes
      .filter((scene) => isCreatorSceneId(scene.creatorSceneId))
      .map((scene) => [scene.id, scene.creatorSceneId!] as const),
  );

  return projectionScenes.map((scene) => {
    const canonicalId = canonicalByNumericId.get(scene.id);
    return canonicalId ? { ...scene, creatorSceneId: canonicalId } : { ...scene };
  });
}
