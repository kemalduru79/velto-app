const COVERAGE_TOLERANCE_SECONDS = 0.05;

const finiteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const roundDuration = (value) => Math.round(value * 100) / 100;

export function resolveCoverageBackedSceneTargetDuration(scene) {
  const beats = Array.isArray(scene?.visualCoveragePlan) ? scene.visualCoveragePlan : [];
  if (beats.length === 0) return Number.NaN;
  const requestedTarget = finiteNumber(scene?.timing?.targetSceneDuration);
  if (Number.isFinite(requestedTarget) && requestedTarget > 0) {
    return requestedTarget;
  }
  const coverageTarget = finiteNumber(beats.at(-1)?.endSec);
  return Number.isFinite(coverageTarget) && coverageTarget > 0
    ? coverageTarget
    : Number.NaN;
}

export function validateVisualCoveragePlan(scene, targetDuration) {
  const beats = Array.isArray(scene?.visualCoveragePlan) ? scene.visualCoveragePlan : [];
  const safeTargetDuration = finiteNumber(targetDuration);
  let cursor = 0;
  const valid = Number.isFinite(safeTargetDuration) && safeTargetDuration > 0 && beats.length > 0 && beats.every((beat) => {
    const start = finiteNumber(beat?.startSec);
    const end = finiteNumber(beat?.endSec);
    const duration = finiteNumber(beat?.durationSec);
    const renderable = beat?.kind === "video" ||
      (beat?.kind === "image" && beat?.renderer === "native_zoompan_v1");
    const beatValid = typeof beat?.sourceUrl === "string" && beat.sourceUrl.trim() &&
      Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(duration) &&
      start >= 0 && end > start && Math.abs(start - cursor) <= 0.02 &&
      Math.abs(duration - (end - start)) <= 0.02 && renderable;
    cursor = end;
    return beatValid;
  });
  return valid && Math.abs(cursor - safeTargetDuration) <= COVERAGE_TOLERANCE_SECONDS ? beats : [];
}

export function reconcileVisualCoveragePlan(scene, targetDuration) {
  const beats = Array.isArray(scene?.visualCoveragePlan) ? scene.visualCoveragePlan : [];
  const safeTargetDuration = finiteNumber(targetDuration);
  if (!Number.isFinite(safeTargetDuration) || safeTargetDuration <= 0 || beats.length === 0) return [];

  const incomingTarget = finiteNumber(beats.at(-1)?.endSec);
  if (!Number.isFinite(incomingTarget) || incomingTarget <= 0) return [];
  if (validateVisualCoveragePlan(scene, incomingTarget).length === 0) return [];

  if (Math.abs(incomingTarget - safeTargetDuration) <= COVERAGE_TOLERANCE_SECONDS) {
    return validateVisualCoveragePlan(scene, safeTargetDuration);
  }

  // A shorter renderer target would require truncating canonical composition.
  if (safeTargetDuration < incomingTarget) return [];

  const lastBeat = beats.at(-1);
  if (lastBeat?.kind !== "image" || lastBeat?.renderer !== "native_zoompan_v1") return [];

  const reconciled = beats.map((beat, index) => index === beats.length - 1
    ? {
        ...beat,
        endSec: roundDuration(safeTargetDuration),
        durationSec: roundDuration(safeTargetDuration - Number(beat.startSec)),
      }
    : beat);

  return validateVisualCoveragePlan({ ...scene, visualCoveragePlan: reconciled }, safeTargetDuration);
}
