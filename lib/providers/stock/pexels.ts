import "server-only";
import type { StockMediaCandidate, StockMediaProvider, StockMediaType, StockOrientation, StockRateLimit, StockRendition, StockSearchInput, StockSearchResult } from "./types";
import { StockProviderError } from "./types";
import { selectPexelsVideoPreview } from "./pexelsPreview";

const API_BASE = "https://api.pexels.com/v1";
const LICENSE = { id: "pexels-license", url: "https://www.pexels.com/license/", snapshotDate: "2026-08-22" } as const;
type Json = Record<string, unknown>;

function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function orientation(width: number, height: number): StockOrientation { return width === height ? "square" : width > height ? "landscape" : "portrait"; }
function recordArray(value: unknown): Json[] { return Array.isArray(value) ? value.filter((item): item is Json => Boolean(item) && typeof item === "object") : []; }

function photoCandidate(raw: Json): StockMediaCandidate {
  const id = String(raw.id || ""); const width = number(raw.width); const height = number(raw.height);
  const src = (raw.src && typeof raw.src === "object" ? raw.src : {}) as Json;
  const candidates: Array<[string, unknown]> = [["large2x", src.large2x], ["large", src.large], ["original", src.original]];
  const renditions = candidates.flatMap(([id, url]) => text(url) ? [{ id, url: text(url), mimeType: "image/jpeg" as const, width: id === "large" ? Math.min(width, 940) : Math.min(width, 1880), height: id === "large" ? Math.round(height * Math.min(width, 940) / Math.max(width, 1)) : Math.round(height * Math.min(width, 1880) / Math.max(width, 1)), quality: "production" as const }] : []);
  const creatorName = text(raw.photographer) || "Pexels creator";
  return { sourceType: "stock", mediaType: "photo", provider: "pexels", providerMediaId: id,
    sourcePageUrl: text(raw.url), creatorName, creatorProfileUrl: text(raw.photographer_url) || null, license: LICENSE,
    width, height, orientation: orientation(width, height), durationSeconds: null,
    previewUrl: text(src.medium) || text(src.large) || renditions[0]?.url || "", renditions,
    averageColor: text(raw.avg_color) || null, attributionText: `Photo by ${creatorName} on Pexels`, metadataVersion: "2026-08-22" };
}

function videoCandidate(raw: Json): StockMediaCandidate {
  const id = String(raw.id || ""); const width = number(raw.width); const height = number(raw.height);
  const files = recordArray(raw.video_files).filter((file) => text(file.file_type) === "video/mp4" && text(file.link));
  const renditions = files.map((file) => ({ id: String(file.id || `${number(file.width)}x${number(file.height)}`), url: text(file.link), mimeType: "video/mp4" as const, width: number(file.width), height: number(file.height), quality: "production" as const }));
  const pictures = recordArray(raw.video_pictures);
  const preview = selectPexelsVideoPreview(files, pictures);
  const creator = (raw.user && typeof raw.user === "object" ? raw.user : {}) as Json;
  const creatorName = text(creator.name) || "Pexels creator";
  return { sourceType: "stock", mediaType: "video", provider: "pexels", providerMediaId: id,
    sourcePageUrl: text(raw.url), creatorName, creatorProfileUrl: text(creator.url) || null, license: LICENSE,
    width, height, orientation: orientation(width, height), durationSeconds: number(raw.duration) || null,
    previewUrl: preview.previewUrl || "", previewPosterUrl: preview.previewPosterUrl, renditions, averageColor: null,
    attributionText: `Video by ${creatorName} on Pexels`, metadataVersion: "2026-08-22" };
}

export function parsePexelsRateLimit(headers: Headers): StockRateLimit {
  const integer = (name: string) => { const value = headers.get(name); return value && /^\d+$/.test(value) ? Number(value) : null; };
  const reset = headers.get("x-ratelimit-reset");
  return { limit: integer("x-ratelimit-limit"), remaining: integer("x-ratelimit-remaining"), resetAt: reset ? (/^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : reset) : null };
}

export class PexelsStockProvider implements StockMediaProvider {
  constructor(private readonly apiKey = process.env.PEXELS_API_KEY, private readonly fetcher: typeof fetch = fetch) {}
  private async request(path: string, params?: URLSearchParams) {
    if (!this.apiKey?.trim()) throw new StockProviderError("STOCK_UNAVAILABLE", 503, "Stock search is not configured.");
    const url = `${API_BASE}${path}${params ? `?${params}` : ""}`;
    let response: Response;
    try { response = await this.fetcher(url, { headers: { Authorization: this.apiKey }, signal: AbortSignal.timeout(10_000), cache: "no-store" }); }
    catch { throw new StockProviderError("STOCK_TIMEOUT", 504, "Stock provider timed out."); }
    if (response.status === 401 || response.status === 403) throw new StockProviderError("STOCK_AUTH_FAILED", 503, "Stock search is temporarily unavailable.");
    if (response.status === 429) throw new StockProviderError("STOCK_RATE_LIMITED", 429, "Stock search limit reached. Please try again later.");
    if (!response.ok) throw new StockProviderError("STOCK_UPSTREAM_FAILED", 502, "Stock search is temporarily unavailable.");
    try { return { body: await response.json() as Json, rateLimit: parsePexelsRateLimit(response.headers) }; }
    catch { throw new StockProviderError("STOCK_MALFORMED_RESPONSE", 502, "Stock provider returned an invalid response."); }
  }
  async search(input: StockSearchInput): Promise<StockSearchResult> {
    const params = new URLSearchParams({ query: input.query, page: String(input.page), per_page: String(input.perPage) });
    if (input.orientation) params.set("orientation", input.orientation);
    const path = input.mediaType === "photo" ? "/search" : "/videos/search";
    const { body, rateLimit } = await this.request(path, params);
    const rows = recordArray(input.mediaType === "photo" ? body.photos : body.videos);
    return { candidates: rows.map(input.mediaType === "photo" ? photoCandidate : videoCandidate).filter((item) => item.providerMediaId && item.sourcePageUrl && item.previewUrl && item.renditions.length), page: number(body.page) || input.page, perPage: number(body.per_page) || input.perPage, totalResults: number(body.total_results), rateLimit };
  }
  async getMedia(mediaType: StockMediaType, providerMediaId: string) {
    if (!/^\d{1,20}$/.test(providerMediaId)) throw new StockProviderError("STOCK_MEDIA_INVALID", 400, "Stock media identifier is invalid.");
    const path = mediaType === "photo" ? `/photos/${providerMediaId}` : `/videos/videos/${providerMediaId}`;
    const { body } = await this.request(path);
    const candidate = mediaType === "photo" ? photoCandidate(body) : videoCandidate(body);
    if (!candidate.providerMediaId || !candidate.renditions.length) throw new StockProviderError("STOCK_MEDIA_UNAVAILABLE", 404, "Stock media is unavailable.");
    return candidate;
  }
  resolveImportRendition(candidate: StockMediaCandidate, renditionId: string): StockRendition {
    const selected = candidate.renditions.find((item) => item.id === renditionId);
    if (!selected) throw new StockProviderError("STOCK_RENDITION_UNSUPPORTED", 400, "Selected stock rendition is unsupported.");
    const production = candidate.renditions.filter((item) => item.quality === "production");
    if (candidate.mediaType === "photo") return production.filter((item) => item.width <= 2200).sort((a,b) => Math.abs(1920-a.width)-Math.abs(1920-b.width))[0] || selected;
    return production.filter((item) => Math.max(item.width, item.height) <= 1920 && Math.min(item.width, item.height) >= 720).sort((a,b) => Math.abs(1080-Math.min(a.width,a.height))-Math.abs(1080-Math.min(b.width,b.height)))[0] || selected;
  }
}
