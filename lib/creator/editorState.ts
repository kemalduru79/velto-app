export type CreatorSceneIdentity = {
  id: number;
  creatorSceneId?: string;
};

export type CreatorAudioCurrentness = "current" | "stale" | "missing" | "not_required";

export function deriveCreatorAudioCurrentness({
  spokenText,
  audioUrl,
  sourceText,
  settingsKey,
  currentSettingsKey,
}: {
  spokenText?: string;
  audioUrl?: string;
  sourceText?: string;
  settingsKey?: string;
  currentSettingsKey?: string;
}): CreatorAudioCurrentness {
  if (!String(spokenText || "").trim()) return "not_required";
  if (!String(audioUrl || "").trim()) return "missing";
  return sourceText === spokenText && settingsKey === currentSettingsKey
    ? "current"
    : "stale";
}

export function applyCreatorSceneTextEdit<
  TScene extends CreatorSceneIdentity & { text: string; narration: string; dialogue: string },
>(
  scenes: readonly TScene[],
  creatorSceneId: string,
  edit: { text: string; narration: string; dialogue: string },
): { scenes: TScene[]; changed: boolean } {
  let changed = false;
  const nextScenes = scenes.map((scene) => {
    if (scene.creatorSceneId !== creatorSceneId) return scene;
    if (
      scene.text === edit.text &&
      scene.narration === edit.narration &&
      scene.dialogue === edit.dialogue
    ) return scene;
    changed = true;
    return { ...scene, ...edit };
  });
  return { scenes: nextScenes, changed };
}

export const CREATOR_MIN_VIDEO_CLIP_SECONDS = 0.25;
export type CreatorTrimHandle = "start" | "end";
export type CreatorTrimValues = { start: number; end: number };

export type CreatorSceneTrim = {
  clipInSec?: number;
  clipOutSec?: number;
};

export type NormalizedCreatorSceneTrim = CreatorSceneTrim & {
  sourceDurationSec: number;
  visualDurationSec: number;
  isTrimmed: boolean;
};

const roundCreatorClipSeconds = (value: number) =>
  Number(value.toFixed(3));

export function constrainCreatorTrimProposal(
  handle: CreatorTrimHandle,
  seconds: number,
  current: CreatorTrimValues,
  sourceDurationSec: number,
): CreatorTrimValues {
  const duration = Math.max(0, sourceDurationSec);
  if (!Number.isFinite(seconds) || duration <= 0) return current;
  if (handle === "start") {
    return {
      ...current,
      start: roundCreatorClipSeconds(
        Math.max(0, Math.min(seconds, current.end - CREATOR_MIN_VIDEO_CLIP_SECONDS)),
      ),
    };
  }
  return {
    ...current,
    end: roundCreatorClipSeconds(
      Math.min(duration, Math.max(seconds, current.start + CREATOR_MIN_VIDEO_CLIP_SECONDS)),
    ),
  };
}

export function normalizeCreatorSceneTrim({
  clipInSec,
  clipOutSec,
  sourceDurationSec,
  sourceType = "video",
}: CreatorSceneTrim & {
  sourceDurationSec: number;
  sourceType?: "video" | "image";
}): NormalizedCreatorSceneTrim {
  const safeSourceDuration =
    Number.isFinite(sourceDurationSec) && sourceDurationSec > 0
      ? sourceDurationSec
      : 0;
  const fullSource: NormalizedCreatorSceneTrim = {
    sourceDurationSec: roundCreatorClipSeconds(safeSourceDuration),
    visualDurationSec: roundCreatorClipSeconds(safeSourceDuration),
    isTrimmed: false,
  };

  if (sourceType !== "video" || safeSourceDuration <= 0) return fullSource;
  if (clipInSec === undefined && clipOutSec === undefined) return fullSource;
  if (!Number.isFinite(clipInSec) || !Number.isFinite(clipOutSec)) return fullSource;

  const start = Math.max(0, Math.min(clipInSec as number, safeSourceDuration));
  const end = Math.max(0, Math.min(clipOutSec as number, safeSourceDuration));
  if (end - start < CREATOR_MIN_VIDEO_CLIP_SECONDS) return fullSource;

  if (start <= 0 && Math.abs(end - safeSourceDuration) < 0.001) {
    return fullSource;
  }

  return {
    clipInSec: roundCreatorClipSeconds(start),
    clipOutSec: roundCreatorClipSeconds(end),
    sourceDurationSec: roundCreatorClipSeconds(safeSourceDuration),
    visualDurationSec: roundCreatorClipSeconds(end - start),
    isTrimmed: true,
  };
}

export function getCreatorSceneEffectiveDuration({
  visualDurationSec,
  targetDurationSec = 0,
  speechDurationSec = 0,
  speechTailBufferSec = 0.75,
}: {
  visualDurationSec: number;
  targetDurationSec?: number;
  speechDurationSec?: number;
  speechTailBufferSec?: number;
}): number {
  const visual = Number.isFinite(visualDurationSec) ? Math.max(0, visualDurationSec) : 0;
  const target = Number.isFinite(targetDurationSec) ? Math.max(0, targetDurationSec) : 0;
  const speech = Number.isFinite(speechDurationSec) ? Math.max(0, speechDurationSec) : 0;
  const tail = Number.isFinite(speechTailBufferSec) ? Math.max(0, speechTailBufferSec) : 0;
  return roundCreatorClipSeconds(Math.max(visual, target, speech > 0 ? speech + tail : 0));
}

type CreatorSceneWithDispatchState = CreatorSceneIdentity & {
  videoJobId?: string;
  videoQueueJobId?: string;
  videoStatus?: "idle" | "processing" | "delayed" | "done" | "error";
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
    videoStatus: source.videoStatus === "processing" || source.videoStatus === "delayed" || source.videoStatus === "error"
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

export function addCreatorScene<TScene extends CreatorSceneIdentity>(
  scenes: readonly TScene[],
  selectedCreatorSceneId: string | null,
  createBlankScene: (creatorSceneId: string) => TScene,
  createId: () => string = createCreatorSceneId,
): { scenes: TScene[]; selectedCreatorSceneId: string; added: true } {
  const usedIds = new Set(scenes.map((scene) => scene.creatorSceneId));
  let creatorSceneId = createId();
  while (!isCreatorSceneId(creatorSceneId) || usedIds.has(creatorSceneId)) {
    creatorSceneId = createId();
  }
  const selectedIndex = selectedCreatorSceneId
    ? scenes.findIndex((scene) => scene.creatorSceneId === selectedCreatorSceneId)
    : -1;
  const insertionIndex = selectedIndex >= 0 ? selectedIndex + 1 : scenes.length;
  const blankScene = { ...createBlankScene(creatorSceneId), creatorSceneId };
  return {
    scenes: reordinalizeCreatorScenes([
      ...scenes.slice(0, insertionIndex),
      blankScene,
      ...scenes.slice(insertionIndex),
    ]),
    selectedCreatorSceneId: creatorSceneId,
    added: true,
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
