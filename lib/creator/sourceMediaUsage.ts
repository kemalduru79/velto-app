import {
  normalizeCreatorSceneTrim,
  type CreatorSceneTrim,
} from "./editorState.ts";
import {
  normalizeCreatorSourceMediaMetadata,
  type CreatorSourceMediaMetadata,
} from "./sourceMedia.ts";

export type CreatorSourceMediaUsage = {
  sourceMedia: CreatorSourceMediaMetadata;
  visualDurationSec: number | null;
  isTrimmed: boolean;
};

/**
 * Projects the existing CreatorLab clip trim onto Source Media timecodes.
 * `sceneSourceDurationSec` is the duration of the stored/editable video asset;
 * Source Media `sourceDurationSec` remains the duration of the original source.
 *
 * If the stored asset is already an excerpt with original-source timecodes,
 * further scene trimming is offset from that excerpt rather than losing
 * provenance. No second clip editor or trim algorithm is introduced here.
 */
export function createCreatorSourceMediaUsage(input: {
  sourceMedia: CreatorSourceMediaMetadata;
  sceneTrim?: CreatorSceneTrim;
  sceneSourceDurationSec: number;
}): CreatorSourceMediaUsage {
  const sourceMedia = normalizeCreatorSourceMediaMetadata(input.sourceMedia);
  const sceneSourceDurationSec = Number.isFinite(input.sceneSourceDurationSec)
    ? Math.max(0, input.sceneSourceDurationSec)
    : 0;

  if (sourceMedia.sourceMediaKind !== "video" || sceneSourceDurationSec <= 0) {
    return {
      sourceMedia,
      visualDurationSec: sceneSourceDurationSec > 0 ? sceneSourceDurationSec : null,
      isTrimmed: false,
    };
  }

  const trim = normalizeCreatorSceneTrim({
    clipInSec: input.sceneTrim?.clipInSec,
    clipOutSec: input.sceneTrim?.clipOutSec,
    sourceDurationSec: sceneSourceDurationSec,
    sourceType: "video",
  });

  if (!trim.isTrimmed) {
    return {
      sourceMedia,
      visualDurationSec: trim.visualDurationSec,
      isTrimmed: false,
    };
  }

  const baseStartSec = sourceMedia.timecodeStartSec ?? 0;
  const timecodeStartSec = baseStartSec + (trim.clipInSec ?? 0);
  const timecodeEndSec = baseStartSec + (trim.clipOutSec ?? trim.sourceDurationSec);

  return {
    sourceMedia: normalizeCreatorSourceMediaMetadata({
      ...sourceMedia,
      timecodeStartSec,
      timecodeEndSec,
    }),
    visualDurationSec: trim.visualDurationSec,
    isTrimmed: true,
  };
}
