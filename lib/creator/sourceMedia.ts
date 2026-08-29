export const CREATOR_SOURCE_MEDIA_METADATA_VERSION = "0.10H-3A" as const;

export type CreatorSourceMediaKind =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "other";

export type CreatorSourceMediaRightsState =
  | "unknown"
  | "review_required"
  | "cleared"
  | "restricted";

export type CreatorSourceMediaMetadata = {
  metadataVersion: typeof CREATOR_SOURCE_MEDIA_METADATA_VERSION;
  sourceMediaKind: CreatorSourceMediaKind;
  sourceUrl: string;
  publisher: string;
  rightsholder: string;
  publishedAt: string | null;
  capturedAt: string | null;
  licenseId: string;
  licenseUrl: string | null;
  licenseSnapshotDate: string | null;
  attributionRequired: boolean | null;
  attributionText: string;
  rightsState: CreatorSourceMediaRightsState;
  rightsReviewNote: string;
  sourceDurationSec: number | null;
  timecodeStartSec: number | null;
  timecodeEndSec: number | null;
};

const RIGHTS_STATES = new Set<CreatorSourceMediaRightsState>([
  "unknown",
  "review_required",
  "cleared",
  "restricted",
]);

const SOURCE_MEDIA_KINDS = new Set<CreatorSourceMediaKind>([
  "image",
  "video",
  "audio",
  "document",
  "other",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function httpUrl(value: unknown, required = false): string | null {
  const raw = clean(value, 2_000);
  if (!raw) {
    if (required) throw new Error("SOURCE_MEDIA_URL_REQUIRED");
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("SOURCE_MEDIA_URL_INVALID");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SOURCE_MEDIA_URL_INVALID");
  }
  return parsed.toString();
}

function isoDate(value: unknown): string | null {
  const raw = clean(value, 80);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) throw new Error("SOURCE_MEDIA_DATE_INVALID");
  return new Date(timestamp).toISOString();
}

function seconds(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("SOURCE_MEDIA_TIMECODE_INVALID");
  }
  return Number(parsed.toFixed(3));
}

function normalizeTimecode(input: {
  sourceDurationSec: unknown;
  timecodeStartSec: unknown;
  timecodeEndSec: unknown;
}) {
  const sourceDurationSec = seconds(input.sourceDurationSec);
  const timecodeStartSec = seconds(input.timecodeStartSec);
  const timecodeEndSec = seconds(input.timecodeEndSec);

  const hasStart = timecodeStartSec !== null;
  const hasEnd = timecodeEndSec !== null;
  if (hasStart !== hasEnd) throw new Error("SOURCE_MEDIA_TIMECODE_INCOMPLETE");
  if (
    timecodeStartSec !== null &&
    timecodeEndSec !== null &&
    timecodeEndSec <= timecodeStartSec
  ) {
    throw new Error("SOURCE_MEDIA_TIMECODE_INVALID");
  }
  if (
    sourceDurationSec !== null &&
    timecodeEndSec !== null &&
    timecodeEndSec > sourceDurationSec
  ) {
    throw new Error("SOURCE_MEDIA_TIMECODE_OUT_OF_RANGE");
  }

  return { sourceDurationSec, timecodeStartSec, timecodeEndSec };
}

/**
 * Normalizes source-media provenance and review metadata without making a legal
 * clearance decision. A license or attribution field never upgrades rightsState;
 * `cleared` must be supplied explicitly by a later reviewed workflow.
 */
export function normalizeCreatorSourceMediaMetadata(
  value: unknown,
): CreatorSourceMediaMetadata {
  const source = record(value);
  const sourceMediaKind = SOURCE_MEDIA_KINDS.has(source.sourceMediaKind as CreatorSourceMediaKind)
    ? source.sourceMediaKind as CreatorSourceMediaKind
    : "other";
  const rightsState = RIGHTS_STATES.has(source.rightsState as CreatorSourceMediaRightsState)
    ? source.rightsState as CreatorSourceMediaRightsState
    : "unknown";
  const timecode = normalizeTimecode({
    sourceDurationSec: source.sourceDurationSec,
    timecodeStartSec: source.timecodeStartSec,
    timecodeEndSec: source.timecodeEndSec,
  });

  return {
    metadataVersion: CREATOR_SOURCE_MEDIA_METADATA_VERSION,
    sourceMediaKind,
    sourceUrl: httpUrl(source.sourceUrl, true)!,
    publisher: clean(source.publisher, 240),
    rightsholder: clean(source.rightsholder, 240),
    publishedAt: isoDate(source.publishedAt),
    capturedAt: isoDate(source.capturedAt),
    licenseId: clean(source.licenseId, 160),
    licenseUrl: httpUrl(source.licenseUrl),
    licenseSnapshotDate: isoDate(source.licenseSnapshotDate),
    attributionRequired:
      typeof source.attributionRequired === "boolean"
        ? source.attributionRequired
        : null,
    attributionText: clean(source.attributionText, 1_000),
    rightsState,
    rightsReviewNote: clean(source.rightsReviewNote, 1_000),
    ...timecode,
  };
}

/**
 * Stores source-media information inside the existing generic media-asset
 * metadata envelope. This deliberately avoids a second asset or rights store.
 */
export function withCreatorSourceMediaMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceMedia: unknown,
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    sourceMedia: normalizeCreatorSourceMediaMetadata(sourceMedia),
  };
}
