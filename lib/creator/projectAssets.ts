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
  dialogue?: string;
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

export type RankedCreatorProjectAsset = CreatorProjectAsset & {
  matchScore: number;
  matchReason: "shared_topic" | "related_context";
};

const CREATOR_ASSET_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "her", "his", "in", "is", "it", "its", "of", "on",
  "or", "she", "that", "the", "their", "this", "to", "was", "were", "with",
  "ve", "veya", "ile", "bir", "bu", "şu", "o", "da", "de", "için", "gibi",
  "çok", "daha", "olan", "olarak", "ama", "fakat", "ise", "mi", "mı", "mu",
  "mü", "ne", "her", "hem", "sonra", "önce", "diye",
]);

export function normalizeCreatorMatchText(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{Mark}+/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeCreatorMatchText(value: string) {
  return normalizeCreatorMatchText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !CREATOR_ASSET_STOP_WORDS.has(token));
}

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
    const sourceSummary = [scene.text, scene.narration, scene.dialogue]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ");
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

export function rankCreatorProjectAssetsForScene({
  scenes,
  targetCreatorSceneId,
  maxResults = 3,
}: {
  scenes: readonly CreatorProjectAssetScene[];
  targetCreatorSceneId: string;
  maxResults?: number;
}): RankedCreatorProjectAsset[] {
  const targetSceneIndex = scenes.findIndex(
    (scene) => scene.creatorSceneId === targetCreatorSceneId,
  );
  const targetScene = scenes[targetSceneIndex];
  if (!targetScene || maxResults <= 0) return [];

  const targetTokens = new Set(tokenizeCreatorMatchText(
    [targetScene.text, targetScene.narration, targetScene.dialogue].join(" "),
  ));
  if (targetTokens.size === 0) return [];

  return deriveCreatorProjectAssets(scenes)
    .filter((asset) =>
      asset.kind === "image" &&
      asset.sourceCreatorSceneId !== targetCreatorSceneId,
    )
    .map((asset): RankedCreatorProjectAsset | null => {
      const sourceTokens = new Set(tokenizeCreatorMatchText(asset.sourceSummary));
      const sharedTokens = [...targetTokens].filter((token) => sourceTokens.has(token));
      const topicalScore = sharedTokens.reduce(
        (score, token) => score + (token.length >= 7 ? 3 : token.length >= 5 ? 2 : 1),
        0,
      );
      if (topicalScore < 2) return null;

      const sourceSceneIndex = scenes.findIndex(
        (scene) => scene.creatorSceneId === asset.sourceCreatorSceneId,
      );
      const proximity = sourceSceneIndex < 0
        ? 0
        : 1 / (Math.abs(sourceSceneIndex - targetSceneIndex) + 1);
      return {
        ...asset,
        matchScore: topicalScore + (asset.version === "current" ? 0.1 : 0) + proximity * 0.01,
        matchReason: topicalScore >= 4 ? "shared_topic" : "related_context",
      };
    })
    .filter((asset): asset is RankedCreatorProjectAsset => asset !== null)
    .sort((left, right) =>
      right.matchScore - left.matchScore ||
      left.sourceSceneNumber - right.sourceSceneNumber ||
      left.id.localeCompare(right.id),
    )
    .slice(0, Math.min(3, Math.max(0, Math.floor(maxResults))));
}
