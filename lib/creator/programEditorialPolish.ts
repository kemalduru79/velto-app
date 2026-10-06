export type CreatorProgramEditorialRole =
  | "opening"
  | "body"
  | "midpoint"
  | "closing";

export type CreatorProgramVisualRhythm = {
  sceneIndex: number;
  sceneCount: number;
  role: CreatorProgramEditorialRole;
  repeatedSelectedMedia: boolean;
  motionPresetOffset: 0 | 1 | 2;
};

const normalizedMedia = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const safeInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

export function resolveCreatorProgramVisualRhythm({
  sceneIndex,
  sceneCount,
  selectedMediaUrl,
  previousSelectedMediaUrl,
}: {
  sceneIndex: unknown;
  sceneCount: unknown;
  selectedMediaUrl?: unknown;
  previousSelectedMediaUrl?: unknown;
}): CreatorProgramVisualRhythm {
  const count = Math.max(1, safeInteger(sceneCount, 1));
  const index = Math.min(
    count - 1,
    Math.max(0, safeInteger(sceneIndex, 0)),
  );

  let role: CreatorProgramEditorialRole = "body";

  if (index === 0) {
    role = "opening";
  } else if (index === count - 1) {
    role = "closing";
  } else if (
    count >= 5 &&
    index === Math.floor((count - 1) / 2)
  ) {
    role = "midpoint";
  }

  const selected = normalizedMedia(selectedMediaUrl);
  const previous = normalizedMedia(previousSelectedMediaUrl);
  const repeatedSelectedMedia =
    Boolean(selected) &&
    Boolean(previous) &&
    selected === previous;

  let motionPresetOffset = index % 3;

  // Give the program midpoint and closing a deliberately different opening
  // motion language without changing media authority.
  if (role === "midpoint") {
    motionPresetOffset = (motionPresetOffset + 1) % 3;
  } else if (role === "closing") {
    motionPresetOffset = (motionPresetOffset + 2) % 3;
  }

  // When the same selected visual is intentionally reused across adjacent
  // scenes, use a run-safe phase derived from the absolute scene index.
  // This remains different across every adjacent repeated scene, including
  // midpoint and closing boundaries.
  if (repeatedSelectedMedia) {
    motionPresetOffset = (index + 1) % 3;
  }

  return {
    sceneIndex: index,
    sceneCount: count,
    role,
    repeatedSelectedMedia,
    motionPresetOffset: motionPresetOffset as 0 | 1 | 2,
  };
}

export type CreatorProgramEditorialIssueCode =
  | "adjacent_selected_media_repeat"
  | "long_same_media_run"
  | "long_image_only_run"
  | "single_media_program"
  | "image_only_program"
  | "anchor_media_repeat";

export type CreatorProgramEditorialAuditScene = {
  creatorSceneId?: unknown;
  selectedMediaUrl?: unknown;
  selectedSource?: unknown;
};

export type CreatorProgramEditorialIssue = {
  code: CreatorProgramEditorialIssueCode;
  sceneIds: string[];
};

export type CreatorProgramEditorialAudit = {
  version: "0.20E2";
  status: "balanced" | "review";
  requiresManualReview: boolean;
  metrics: {
    sceneCount: number;
    selectedMediaSceneCount: number;
    imageSceneCount: number;
    videoSceneCount: number;
    uniqueSelectedMediaCount: number;
    adjacentRepeatedMediaPairs: number;
    longestSameMediaRun: number;
    longestImageOnlyRun: number;
  };
  issues: CreatorProgramEditorialIssue[];
};

const normalizeAuditMediaIdentity = (value: unknown) => {
  const media = normalizedMedia(value);
  if (!media) return "";

  try {
    const url = new URL(media);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return media;
  }
};

const normalizeAuditSource = (value: unknown) => {
  if (value === "video") return "video";
  if (value === "image") return "image";
  return "";
};

export function auditCreatorProgramEditorialBalance(
  scenes: readonly CreatorProgramEditorialAuditScene[],
): CreatorProgramEditorialAudit {
  const normalizedScenes = scenes.map((scene, index) => ({
    sceneId:
      typeof scene.creatorSceneId === "string" &&
      scene.creatorSceneId.trim()
        ? scene.creatorSceneId.trim()
        : `scene-${index + 1}`,
    mediaIdentity: normalizeAuditMediaIdentity(scene.selectedMediaUrl),
    source: normalizeAuditSource(scene.selectedSource),
  }));

  const sceneCount = normalizedScenes.length;
  const issues: CreatorProgramEditorialIssue[] = [];
  const issueKeys = new Set<string>();

  const addIssue = (
    code: CreatorProgramEditorialIssueCode,
    sceneIds: string[],
  ) => {
    const key = `${code}:${sceneIds.join("|")}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push({ code, sceneIds });
  };

  let adjacentRepeatedMediaPairs = 0;

  for (let index = 1; index < sceneCount; index += 1) {
    const previous = normalizedScenes[index - 1];
    const current = normalizedScenes[index];

    if (
      current.mediaIdentity &&
      previous.mediaIdentity &&
      current.mediaIdentity === previous.mediaIdentity
    ) {
      adjacentRepeatedMediaPairs += 1;
      addIssue(
        "adjacent_selected_media_repeat",
        [previous.sceneId, current.sceneId],
      );
    }
  }

  let longestSameMediaRun = 0;
  let mediaRunStart = 0;

  while (mediaRunStart < sceneCount) {
    const identity = normalizedScenes[mediaRunStart].mediaIdentity;

    if (!identity) {
      mediaRunStart += 1;
      continue;
    }

    let mediaRunEnd = mediaRunStart + 1;
    while (
      mediaRunEnd < sceneCount &&
      normalizedScenes[mediaRunEnd].mediaIdentity === identity
    ) {
      mediaRunEnd += 1;
    }

    const runLength = mediaRunEnd - mediaRunStart;
    longestSameMediaRun = Math.max(longestSameMediaRun, runLength);

    if (runLength >= 3) {
      addIssue(
        "long_same_media_run",
        normalizedScenes
          .slice(mediaRunStart, mediaRunEnd)
          .map((scene) => scene.sceneId),
      );
    }

    mediaRunStart = mediaRunEnd;
  }

  let longestImageOnlyRun = 0;
  let imageRunStart = 0;

  while (imageRunStart < sceneCount) {
    const scene = normalizedScenes[imageRunStart];

    if (!scene.mediaIdentity || scene.source !== "image") {
      imageRunStart += 1;
      continue;
    }

    let imageRunEnd = imageRunStart + 1;
    while (
      imageRunEnd < sceneCount &&
      normalizedScenes[imageRunEnd].mediaIdentity &&
      normalizedScenes[imageRunEnd].source === "image"
    ) {
      imageRunEnd += 1;
    }

    const runLength = imageRunEnd - imageRunStart;
    longestImageOnlyRun = Math.max(longestImageOnlyRun, runLength);

    if (runLength >= 4) {
      addIssue(
        "long_image_only_run",
        normalizedScenes
          .slice(imageRunStart, imageRunEnd)
          .map((item) => item.sceneId),
      );
    }

    imageRunStart = imageRunEnd;
  }

  const selectedMediaScenes = normalizedScenes.filter(
    (scene) => Boolean(scene.mediaIdentity),
  );
  const selectedMediaSceneCount = selectedMediaScenes.length;

  const imageSceneCount = normalizedScenes.filter(
    (scene) => Boolean(scene.mediaIdentity) && scene.source === "image",
  ).length;

  const videoSceneCount = normalizedScenes.filter(
    (scene) => Boolean(scene.mediaIdentity) && scene.source === "video",
  ).length;

  const uniqueSelectedMediaCount = new Set(
    selectedMediaScenes.map((scene) => scene.mediaIdentity),
  ).size;

  if (
    sceneCount >= 5 &&
    selectedMediaSceneCount === sceneCount &&
    uniqueSelectedMediaCount === 1
  ) {
    addIssue(
      "single_media_program",
      normalizedScenes.map((scene) => scene.sceneId),
    );
  }

  if (
    sceneCount >= 6 &&
    selectedMediaSceneCount === sceneCount &&
    imageSceneCount === sceneCount
  ) {
    addIssue(
      "image_only_program",
      normalizedScenes.map((scene) => scene.sceneId),
    );
  }

  if (sceneCount >= 5) {
    const anchorIndexes = Array.from(
      new Set([
        0,
        Math.floor((sceneCount - 1) / 2),
        sceneCount - 1,
      ]),
    );

    const anchorsByMedia = new Map<string, number[]>();

    for (const index of anchorIndexes) {
      const identity = normalizedScenes[index]?.mediaIdentity;
      if (!identity) continue;

      const indexes = anchorsByMedia.get(identity) || [];
      indexes.push(index);
      anchorsByMedia.set(identity, indexes);
    }

    for (const indexes of anchorsByMedia.values()) {
      if (indexes.length < 2) continue;

      addIssue(
        "anchor_media_repeat",
        indexes.map((index) => normalizedScenes[index].sceneId),
      );
    }
  }

  const requiresManualReview = issues.length > 0;

  return {
    version: "0.20E2",
    status: requiresManualReview ? "review" : "balanced",
    requiresManualReview,
    metrics: {
      sceneCount,
      selectedMediaSceneCount,
      imageSceneCount,
      videoSceneCount,
      uniqueSelectedMediaCount,
      adjacentRepeatedMediaPairs,
      longestSameMediaRun,
      longestImageOnlyRun,
    },
    issues,
  };
}
