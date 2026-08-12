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
