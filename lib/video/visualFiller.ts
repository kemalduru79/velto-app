export type VisualFillerStrategy =
  | "none"
  | "animated_still"
  | "image_motion_tail"
  | "cutaway_sequence"
  | "motion_loop"
  | "missing_visual";

export type VisualFillerMotionPreset =
  | "source_motion"
  | "slow_push_in"
  | "soft_pan"
  | "cutaway"
  | "motion_loop";

export type VisualFillerSegment = {
  type:
    | "primary_video"
    | "animated_still"
    | "image_motion"
    | "cutaway"
    | "motion_loop";
  source: "source_video" | "reference_image" | "b_roll";
  motionPreset: VisualFillerMotionPreset;
  startSec: number;
  endSec: number;
  durationSec: number;
  reason: string;
};

export type VisualFillerPlan = {
  version: "3N-3";
  strategy: VisualFillerStrategy;
  targetDurationSec: number;
  sourceDurationSec: number;
  uncoveredDurationSec: number;
  fillerDurationSec: number;
  requiresFiller: boolean;
  preventsFreeze: boolean;
  segments: VisualFillerSegment[];
  reason: string;
};

export type VisualFillerInput = {
  targetDurationSec?: unknown;
  sourceDurationSec?: unknown;
  hasVideo?: boolean;
  hasReferenceImage?: boolean;
  preferCutaway?: boolean;
  gapToleranceSec?: unknown;
  maxFillerBlockSec?: unknown;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function finiteNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function splitDuration(totalDurationSec: number, maxBlockSec: number) {
  if (totalDurationSec <= 0) {
    return [];
  }

  const blockCount = Math.max(1, Math.ceil(totalDurationSec / maxBlockSec));
  const durations: number[] = [];
  let allocated = 0;

  for (let index = 0; index < blockCount; index += 1) {
    const isLast = index === blockCount - 1;
    const durationSec = isLast
      ? round(totalDurationSec - allocated)
      : round(totalDurationSec / blockCount);

    durations.push(durationSec);
    allocated = round(allocated + durationSec);
  }

  return durations;
}

function withOffsets(
  segments: Array<Omit<VisualFillerSegment, "startSec" | "endSec">>,
) {
  let cursor = 0;

  return segments.map((segment) => {
    const startSec = round(cursor);
    const endSec = round(startSec + segment.durationSec);
    cursor = endSec;

    return {
      ...segment,
      startSec,
      endSec,
    };
  });
}

function createImageSegments({
  durationSec,
  type,
  maxBlockSec,
}: {
  durationSec: number;
  type: "animated_still" | "image_motion" | "cutaway";
  maxBlockSec: number;
}) {
  return splitDuration(durationSec, maxBlockSec).map((blockDuration, index) => ({
    type,
    source: type === "cutaway" ? ("b_roll" as const) : ("reference_image" as const),
    motionPreset:
      type === "cutaway"
        ? ("cutaway" as const)
        : index % 2 === 0
          ? ("slow_push_in" as const)
          : ("soft_pan" as const),
    durationSec: blockDuration,
    reason:
      type === "cutaway"
        ? "Use a separate cutaway beat to cover the remaining audio without holding the final frame."
        : "Keep the still image moving with alternating pan and zoom motion instead of a static hold.",
  }));
}

export function createVisualFillerPlan(
  input: VisualFillerInput,
): VisualFillerPlan {
  const targetDurationSec = round(
    Math.max(0, finiteNumber(input.targetDurationSec, 0)),
  );
  const sourceDurationSec = round(
    Math.max(0, finiteNumber(input.sourceDurationSec, 0)),
  );
  const gapToleranceSec = Math.min(
    1,
    Math.max(0.05, finiteNumber(input.gapToleranceSec, 0.35)),
  );
  const maxFillerBlockSec = Math.min(
    10,
    Math.max(2, finiteNumber(input.maxFillerBlockSec, 8)),
  );
  const hasVideo = Boolean(input.hasVideo);
  const hasReferenceImage = Boolean(input.hasReferenceImage);
  const primaryDurationSec = hasVideo
    ? round(Math.min(targetDurationSec, sourceDurationSec))
    : 0;
  const uncoveredDurationSec = round(
    Math.max(0, targetDurationSec - primaryDurationSec),
  );
  const primarySegments =
    primaryDurationSec > 0
      ? [
          {
            type: "primary_video" as const,
            source: "source_video" as const,
            motionPreset: "source_motion" as const,
            durationSec: primaryDurationSec,
            reason: "Use the available moving source for the primary visual beat.",
          },
        ]
      : [];

  if (targetDurationSec <= 0) {
    return {
      version: "3N-3",
      strategy: "missing_visual",
      targetDurationSec,
      sourceDurationSec,
      uncoveredDurationSec: 0,
      fillerDurationSec: 0,
      requiresFiller: false,
      preventsFreeze: false,
      segments: [],
      reason: "A positive target duration is required before visual filler can be planned.",
    };
  }

  if (!hasVideo && !hasReferenceImage) {
    return {
      version: "3N-3",
      strategy: "missing_visual",
      targetDurationSec,
      sourceDurationSec,
      uncoveredDurationSec: targetDurationSec,
      fillerDurationSec: 0,
      requiresFiller: true,
      preventsFreeze: false,
      segments: [],
      reason: "No video or reference image is available to cover this scene.",
    };
  }

  if (!hasVideo && hasReferenceImage) {
    const segments = withOffsets(
      createImageSegments({
        durationSec: targetDurationSec,
        type: "animated_still",
        maxBlockSec: maxFillerBlockSec,
      }),
    );

    return {
      version: "3N-3",
      strategy: "animated_still",
      targetDurationSec,
      sourceDurationSec: 0,
      uncoveredDurationSec: targetDurationSec,
      fillerDurationSec: targetDurationSec,
      requiresFiller: true,
      preventsFreeze: true,
      segments,
      reason: "Animate the available still across the complete audio duration with alternating pan and zoom beats.",
    };
  }

  if (uncoveredDurationSec <= gapToleranceSec) {
    const segments = withOffsets([
      {
        type: "primary_video",
        source: "source_video",
        motionPreset: "source_motion",
        durationSec: targetDurationSec,
        reason: "The moving source already covers the complete target duration.",
      },
    ]);

    return {
      version: "3N-3",
      strategy: "none",
      targetDurationSec,
      sourceDurationSec,
      uncoveredDurationSec,
      fillerDurationSec: 0,
      requiresFiller: false,
      preventsFreeze: true,
      segments,
      reason: "No meaningful visual gap remains.",
    };
  }

  if (hasReferenceImage) {
    const strategy = input.preferCutaway
      ? ("cutaway_sequence" as const)
      : ("image_motion_tail" as const);
    const tailType = input.preferCutaway
      ? ("cutaway" as const)
      : ("image_motion" as const);
    const segments = withOffsets([
      ...primarySegments,
      ...createImageSegments({
        durationSec: uncoveredDurationSec,
        type: tailType,
        maxBlockSec: maxFillerBlockSec,
      }),
    ]);

    return {
      version: "3N-3",
      strategy,
      targetDurationSec,
      sourceDurationSec,
      uncoveredDurationSec,
      fillerDurationSec: uncoveredDurationSec,
      requiresFiller: true,
      preventsFreeze: true,
      segments,
      reason: input.preferCutaway
        ? "Continue with one or more moving cutaway beats instead of cloning the final frame."
        : "Continue with motion over the reference image instead of cloning the final frame.",
    };
  }

  const loopSegments = splitDuration(
    uncoveredDurationSec,
    maxFillerBlockSec,
  ).map((durationSec) => ({
    type: "motion_loop" as const,
    source: "source_video" as const,
    motionPreset: "motion_loop" as const,
    durationSec,
    reason: "Reuse moving source frames as a last-resort loop; never freeze the final frame.",
  }));
  const segments = withOffsets([...primarySegments, ...loopSegments]);

  return {
    version: "3N-3",
    strategy: "motion_loop",
    targetDurationSec,
    sourceDurationSec,
    uncoveredDurationSec,
    fillerDurationSec: uncoveredDurationSec,
    requiresFiller: true,
    preventsFreeze: true,
    segments,
    reason: "No reference image is available, so preserve movement by looping source motion instead of holding the final frame.",
  };
}
