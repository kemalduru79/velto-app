import "server-only";
import { createHash } from "node:crypto";

export function normalizeCreatorMediaIdentity(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim().split(/[?#]/, 1)[0];
  }
}

export function fingerprintCreatorMedia(value: unknown) {
  const normalized = normalizeCreatorMediaIdentity(value);
  return normalized
    ? createHash("sha256").update(normalized).digest("hex").slice(0, 12)
    : "";
}

type CreatorRenderScene = Record<string, unknown>;

export function validateCreatorRenderSceneMediaIdentities(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((scene): scene is CreatorRenderScene => {
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) return false;
    const candidate = scene as CreatorRenderScene;
    const selectedMediaUrl = candidate.exportSource === "video" ? candidate.videoUrl : candidate.image;
    const expected = fingerprintCreatorMedia(selectedMediaUrl);
    return Boolean(expected) && candidate.mediaIdentity === expected;
  });
}
