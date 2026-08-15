export type CreatorProjectAssetKind = "image" | "video";

export type CreatorProjectAssetHistoryEntry = {
  id: string;
  kind: CreatorProjectAssetKind;
  url: string;
  createdAt?: string;
  durationSec?: number;
  generationSignature?: string;
};

export type CreatorProjectAssetScene = {
  id: number;
  creatorSceneId?: string;
  text?: string;
  narration?: string;
  image?: string;
  videoUrl?: string;
  videoStatus?: string;
  videoDurationSeconds?: number;
  videoGenerationSignature?: string;
  assetHistory?: CreatorProjectAssetHistoryEntry[];
};

export type CreatorProjectAsset = {
  id: string;
  kind: CreatorProjectAssetKind;
  url: string;
  sourceCreatorSceneId: string;
  sourceSceneId: number;
  sourceSceneNumber: number;
  sourceSummary: string;
  version: "current" | "history";
  createdAt?: string;
  durationSec?: number;
};

export function canonicalCreatorMediaUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return trimmed.replace(/#.*$/, "");
  }
}

export function deriveCreatorProjectAssets(
  scenes: readonly CreatorProjectAssetScene[],
): CreatorProjectAsset[] {
  const candidates: CreatorProjectAsset[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const sourceCreatorSceneId = scene.creatorSceneId || `legacy-${scene.id}`;
    const sourceSummary = String(scene.text || scene.narration || "").trim();
    const base = {
      sourceCreatorSceneId,
      sourceSceneId: scene.id,
      sourceSceneNumber: sceneIndex + 1,
      sourceSummary,
    };
    const add = (
      kind: CreatorProjectAssetKind,
      url: string | undefined,
      version: "current" | "history",
      createdAt?: string,
      durationSec?: number,
    ) => {
      const normalizedUrl = String(url || "").trim();
      if (!normalizedUrl) return;
      candidates.push({
        ...base,
        id: `${kind}:${sourceCreatorSceneId}:${version}:${canonicalCreatorMediaUrl(normalizedUrl)}`,
        kind,
        url: normalizedUrl,
        version,
        ...(createdAt ? { createdAt } : {}),
        ...(Number(durationSec) > 0 ? { durationSec: Number(durationSec) } : {}),
      });
    };

    add("image", scene.image, "current");
    if (scene.videoStatus === "done") {
      add("video", scene.videoUrl, "current", undefined, scene.videoDurationSeconds);
    }
    for (const asset of scene.assetHistory || []) {
      add(asset.kind, asset.url, "history", asset.createdAt, asset.durationSec);
    }
  });

  const seen = new Set<string>();
  return candidates.filter((asset) => {
    const key = `${asset.kind}:${canonicalCreatorMediaUrl(asset.url)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
