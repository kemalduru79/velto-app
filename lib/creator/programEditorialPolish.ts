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
