type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

export function normalizeRegisteredMediaUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function removeExactAssetHistoryUrl(scenes: unknown, registeredPublicUrl: string) {
  const target = normalizeRegisteredMediaUrl(registeredPublicUrl);
  if (!target || !Array.isArray(scenes)) return { scenes, removedCount: 0 };
  let removedCount = 0;
  const nextScenes = scenes.map((value) => {
    const scene = record(value);
    if (!Array.isArray(scene.assetHistory)) return value;
    const assetHistory = scene.assetHistory.filter((entry) => {
      const matches = normalizeRegisteredMediaUrl(record(entry).url) === target;
      if (matches) removedCount += 1;
      return !matches;
    });
    return assetHistory.length === scene.assetHistory.length ? value : { ...scene, assetHistory };
  });
  return { scenes: removedCount > 0 ? nextScenes : scenes, removedCount };
}
