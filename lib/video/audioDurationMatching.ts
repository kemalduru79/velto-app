export type AudioDurationMatchStatus =
  | "unmeasured"
  | "matched"
  | "shortened"
  | "extended"
  | "split_recommended"
  | "unsafe";

export type AudioDurationMatch = {
  status: AudioDurationMatchStatus;
  audioDurationSec: number;
  plannedDurationSec: number;
  targetDurationSec: number;
  tailBufferSec: number;
  durationDeltaSec: number;
  unnecessaryExtensionRemovedSec: number;
  splitRecommended: boolean;
  recommendedSplitCount: number;
  recommendedSegmentDurationSec: number;
  fitsWithinHardLimit: boolean;
  reason: string;
};

export type AudioDurationMatchInput = {
  audioDurationSec?: unknown;
  plannedDurationSec?: unknown;
  fallbackDurationSec?: unknown;
  minDurationSec?: unknown;
  maxDurationSec?: unknown;
  preferredMaxSceneDurationSec?: unknown;
  tailBufferSec?: unknown;
  toleranceSec?: unknown;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function finiteNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function matchAudioDurationToScene(
  input: AudioDurationMatchInput,
): AudioDurationMatch {
  const minDurationSec = Math.max(
    1,
    finiteNumber(input.minDurationSec, 3),
  );
  const maxDurationSec = Math.max(
    minDurationSec,
    finiteNumber(input.maxDurationSec, 30),
  );
  const preferredMaxSceneDurationSec = clamp(
    finiteNumber(input.preferredMaxSceneDurationSec, 20),
    minDurationSec,
    maxDurationSec,
  );
  const tailBufferSec = clamp(
    finiteNumber(input.tailBufferSec, 0.75),
    0,
    3,
  );
  const toleranceSec = clamp(
    finiteNumber(input.toleranceSec, 0.35),
    0.05,
    2,
  );
  const fallbackDurationSec = clamp(
    finiteNumber(input.fallbackDurationSec, 5),
    minDurationSec,
    maxDurationSec,
  );
  const plannedDurationSec = round(
    clamp(
      finiteNumber(input.plannedDurationSec, fallbackDurationSec),
      minDurationSec,
      maxDurationSec,
    ),
  );
  const audioDurationSec = round(
    Math.max(0, finiteNumber(input.audioDurationSec, 0)),
  );

  if (audioDurationSec <= 0) {
    return {
      status: "unmeasured",
      audioDurationSec: 0,
      plannedDurationSec,
      targetDurationSec: plannedDurationSec,
      tailBufferSec,
      durationDeltaSec: 0,
      unnecessaryExtensionRemovedSec: 0,
      splitRecommended: false,
      recommendedSplitCount: 1,
      recommendedSegmentDurationSec: plannedDurationSec,
      fitsWithinHardLimit: true,
      reason:
        "Audio duration is not measured yet; keep the current planned duration until narration is available.",
    };
  }

  const audioSafeDurationSec = round(audioDurationSec + tailBufferSec);
  const fitsWithinHardLimit = audioSafeDurationSec <= maxDurationSec;
  const targetDurationSec = round(
    clamp(audioSafeDurationSec, minDurationSec, maxDurationSec),
  );
  const splitRecommended =
    audioSafeDurationSec > preferredMaxSceneDurationSec;
  const safeSpeechPerSegment = Math.max(
    1,
    preferredMaxSceneDurationSec - tailBufferSec,
  );
  const recommendedSplitCount = splitRecommended
    ? Math.max(2, Math.ceil(audioDurationSec / safeSpeechPerSegment))
    : 1;
  const recommendedSegmentDurationSec = round(
    clamp(
      audioDurationSec / recommendedSplitCount + tailBufferSec,
      minDurationSec,
      preferredMaxSceneDurationSec,
    ),
  );
  const durationDeltaSec = round(targetDurationSec - plannedDurationSec);
  const unnecessaryExtensionRemovedSec = round(
    Math.max(0, plannedDurationSec - targetDurationSec),
  );
  let status: AudioDurationMatchStatus;
  let reason: string;

  if (!fitsWithinHardLimit) {
    status = "unsafe";
    reason = `Audio needs ${audioSafeDurationSec.toFixed(2)} seconds, above the ${maxDurationSec.toFixed(2)}-second hard scene limit. Split into at least ${recommendedSplitCount} scenes.`;
  } else if (splitRecommended) {
    status = "split_recommended";
    reason = `Audio fits without cutting, but ${recommendedSplitCount} shorter scenes are recommended for visual continuity.`;
  } else if (durationDeltaSec > toleranceSec) {
    status = "extended";
    reason =
      "Scene duration was extended to finish narration and preserve a short speech tail buffer.";
  } else if (durationDeltaSec < -toleranceSec) {
    status = "shortened";
    reason =
      "Scene duration was shortened to remove unnecessary waiting after the audio finishes.";
  } else {
    status = "matched";
    reason = "Planned scene duration already matches the measured audio.";
  }

  return {
    status,
    audioDurationSec,
    plannedDurationSec,
    targetDurationSec,
    tailBufferSec,
    durationDeltaSec,
    unnecessaryExtensionRemovedSec,
    splitRecommended,
    recommendedSplitCount,
    recommendedSegmentDurationSec,
    fitsWithinHardLimit,
    reason,
  };
}
