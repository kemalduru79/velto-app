export const MEBIBYTE = 1024 * 1024;

export const MAX_CREATOR_IMAGE_BYTES = 15 * MEBIBYTE;
export const MAX_CREATOR_VIDEO_BYTES = 100 * MEBIBYTE;

// A 15 MiB payload expands to exactly 20 MiB of base64. The additional
// 1 MiB bounds the data-URL prefix, JSON syntax, and compatibility fields.
export const CREATOR_IMAGE_REQUEST_BODY_BYTES =
  Math.ceil(MAX_CREATOR_IMAGE_BYTES / 3) * 4 + MEBIBYTE;
export const CREATOR_VIDEO_REQUEST_BODY_BYTES = 64 * 1024;

export const CREATOR_MEDIA_TOTAL_TIMEOUT_MS = 30_000;
export const CREATOR_MEDIA_CONNECTION_TIMEOUT_MS = 10_000;
