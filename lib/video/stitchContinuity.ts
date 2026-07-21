export const STITCH_OUTPUT_FPS = 30;
export const STITCH_AV_SYNC_TOLERANCE_SECONDS = 0.08;
export const STITCH_DURATION_TOLERANCE_SECONDS = 0.12;

export type MediaStreamDurations = {
  formatDurationSec?: number;
  videoDurationSec?: number;
  audioDurationSec?: number;
  hasVideo: boolean;
  hasAudio: boolean;
};

export type StitchContinuityIssue =
  | "missing_video"
  | "missing_audio"
  | "audio_video_drift"
  | "duration_drift";

export type StitchContinuityCheck = {
  ok: boolean;
  expectedDurationSec: number;
  actualDurationSec: number;
  audioVideoDriftSec: number;
  durationDriftSec: number;
  issues: StitchContinuityIssue[];
};

function finitePositive(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : undefined;
}

function roundDuration(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function alignDurationToFrameGrid(
  durationSec: number,
  fps = STITCH_OUTPUT_FPS,
) {
  const safeFps = finitePositive(fps) || STITCH_OUTPUT_FPS;
  const safeDuration = finitePositive(durationSec) || 1 / safeFps;
  const frameCount = Math.max(
    1,
    Math.ceil(safeDuration * safeFps - Number.EPSILON),
  );

  return roundDuration(frameCount / safeFps);
}

export function createStitchContinuityCheck({
  expectedDurationSec,
  media,
  audioVideoToleranceSec = STITCH_AV_SYNC_TOLERANCE_SECONDS,
  durationToleranceSec = STITCH_DURATION_TOLERANCE_SECONDS,
}: {
  expectedDurationSec: number;
  media: MediaStreamDurations;
  audioVideoToleranceSec?: number;
  durationToleranceSec?: number;
}): StitchContinuityCheck {
  const expected = finitePositive(expectedDurationSec) || 0;
  const videoDuration = finitePositive(media.videoDurationSec);
  const audioDuration = finitePositive(media.audioDurationSec);
  const formatDuration = finitePositive(media.formatDurationSec);
  const actualDuration = videoDuration || formatDuration || audioDuration || 0;
  const audioVideoDrift =
    videoDuration && audioDuration
      ? Math.abs(videoDuration - audioDuration)
      : 0;
  const durationDrift =
    expected && actualDuration ? Math.abs(actualDuration - expected) : expected;
  const issues: StitchContinuityIssue[] = [];

  if (!media.hasVideo || !videoDuration) {
    issues.push("missing_video");
  }
  if (!media.hasAudio || !audioDuration) {
    issues.push("missing_audio");
  }
  if (audioVideoDrift > audioVideoToleranceSec) {
    issues.push("audio_video_drift");
  }
  if (durationDrift > durationToleranceSec) {
    issues.push("duration_drift");
  }

  return {
    ok: issues.length === 0,
    expectedDurationSec: roundDuration(expected),
    actualDurationSec: roundDuration(actualDuration),
    audioVideoDriftSec: roundDuration(audioVideoDrift),
    durationDriftSec: roundDuration(durationDrift),
    issues,
  };
}

export function describeStitchContinuityIssues(
  check: StitchContinuityCheck,
) {
  return check.issues
    .map((issue) => {
      if (issue === "missing_video") return "video stream is missing";
      if (issue === "missing_audio") return "audio stream is missing";
      if (issue === "audio_video_drift") {
        return `audio/video drift is ${check.audioVideoDriftSec}s`;
      }

      return `rendered duration differs by ${check.durationDriftSec}s`;
    })
    .join(", ");
}
