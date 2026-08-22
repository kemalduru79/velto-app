type PexelsPreviewFile = { file_type?: unknown; link?: unknown; width?: unknown; height?: unknown };
type PexelsPreviewPicture = { picture?: unknown };

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const dimension = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

function trustedPexelsUrl(raw: unknown, hostname: "videos.pexels.com" | "images.pexels.com", extension?: string) {
  const value = text(raw); if (!value) return "";
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname.toLowerCase() === hostname && (!extension || url.pathname.toLowerCase().endsWith(extension)) ? url.toString() : ""; }
  catch { return ""; }
}

export function selectPexelsVideoPreview(files: PexelsPreviewFile[], pictures: PexelsPreviewPicture[]) {
  const playable = files.flatMap((file) => {
    const width = dimension(file.width); const height = dimension(file.height); const url = text(file.file_type).toLowerCase() === "video/mp4" ? trustedPexelsUrl(file.link, "videos.pexels.com", ".mp4") : "";
    return url && width && height ? [{ url, width, height, shortEdge: Math.min(width, height), area: width * height }] : [];
  });
  const preferred = playable.filter((file) => file.shortEdge >= 360 && file.shortEdge <= 720).sort((a, b) => Math.abs(a.shortEdge - 540) - Math.abs(b.shortEdge - 540) || a.area - b.area);
  const fallback = playable.sort((a, b) => a.area - b.area);
  const posterUrl = pictures.map((picture) => trustedPexelsUrl(picture.picture, "images.pexels.com")).find(Boolean) || null;
  return { previewUrl: preferred[0]?.url || fallback[0]?.url || null, previewPosterUrl: posterUrl };
}
