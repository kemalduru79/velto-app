export type CreatorSceneIdentity = {
  id: number;
  creatorSceneId?: string;
};

type CreatorSceneWithDispatchState = CreatorSceneIdentity & {
  videoJobId?: string;
  videoQueueJobId?: string;
  videoStatus?: "idle" | "processing" | "done" | "error";
  visualBlockPlan?: Array<{ id: string; [key: string]: unknown }>;
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

export function reordinalizeCreatorScenes<TScene extends CreatorSceneIdentity>(
  scenes: readonly TScene[],
): TScene[] {
  return scenes.map((scene, index) => ({ ...scene, id: index + 1 }));
}

export function moveCreatorScene<TScene extends CreatorSceneIdentity>(
  scenes: readonly TScene[],
  creatorSceneId: string,
  direction: "earlier" | "later",
): TScene[] {
  const sourceIndex = scenes.findIndex(
    (scene) => scene.creatorSceneId === creatorSceneId,
  );
  const targetIndex = direction === "earlier" ? sourceIndex - 1 : sourceIndex + 1;

  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= scenes.length
  ) {
    return reordinalizeCreatorScenes(scenes);
  }

  const nextScenes = scenes.map((scene) => ({ ...scene }));
  [nextScenes[sourceIndex], nextScenes[targetIndex]] = [
    nextScenes[targetIndex],
    nextScenes[sourceIndex],
  ];
  return reordinalizeCreatorScenes(nextScenes);
}

export function removeCreatorScene<TScene extends CreatorSceneIdentity>(
  scenes: readonly TScene[],
  creatorSceneId: string,
): { scenes: TScene[]; selectedCreatorSceneId: string | null; removed: boolean } {
  const sourceIndex = scenes.findIndex(
    (scene) => scene.creatorSceneId === creatorSceneId,
  );

  if (scenes.length <= 1 || sourceIndex < 0) {
    return {
      scenes: reordinalizeCreatorScenes(scenes),
      selectedCreatorSceneId: selectCreatorSceneId(scenes, creatorSceneId),
      removed: false,
    };
  }

  const nextScenes = reordinalizeCreatorScenes([
    ...scenes.slice(0, sourceIndex),
    ...scenes.slice(sourceIndex + 1),
  ]);

  return {
    scenes: nextScenes,
    selectedCreatorSceneId:
      nextScenes[sourceIndex]?.creatorSceneId ||
      nextScenes[sourceIndex - 1]?.creatorSceneId ||
      null,
    removed: true,
  };
}

export function duplicateCreatorScene<TScene extends CreatorSceneWithDispatchState>(
  scenes: readonly TScene[],
  creatorSceneId: string,
  createId: () => string = createCreatorSceneId,
): { scenes: TScene[]; selectedCreatorSceneId: string | null; duplicated: boolean } {
  const sourceIndex = scenes.findIndex(
    (scene) => scene.creatorSceneId === creatorSceneId,
  );
  if (sourceIndex < 0) {
    return {
      scenes: reordinalizeCreatorScenes(scenes),
      selectedCreatorSceneId: selectCreatorSceneId(scenes, creatorSceneId),
      duplicated: false,
    };
  }

  const usedIds = new Set(scenes.map((scene) => scene.creatorSceneId));
  let duplicateId = createId();
  while (!isCreatorSceneId(duplicateId) || usedIds.has(duplicateId)) {
    duplicateId = createId();
  }

  const source = scenes[sourceIndex];
  const duplicate = {
    ...source,
    creatorSceneId: duplicateId,
    videoJobId: "",
    videoQueueJobId: "",
    videoStatus: source.videoStatus === "processing" || source.videoStatus === "error"
      ? "idle"
      : source.videoStatus,
    visualBlockPlan: source.visualBlockPlan?.map((block, index) => ({
      ...block,
      id: `${duplicateId}.${index + 1}`,
    })),
  } as TScene;

  return {
    scenes: reordinalizeCreatorScenes([
      ...scenes.slice(0, sourceIndex + 1),
      duplicate,
      ...scenes.slice(sourceIndex + 1),
    ]),
    selectedCreatorSceneId: duplicateId,
    duplicated: true,
  };
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
