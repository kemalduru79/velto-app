import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { persistEconomicOperationBestEffort } from "@/lib/economics";
import { safeRemoteMediaFetch } from "@/lib/security/safeRemoteMediaFetch";
import { MAX_CREATOR_IMAGE_BYTES, MAX_CREATOR_VIDEO_BYTES } from "@/lib/security/creatorMediaStoragePolicy";
import { checkStorageGenerationAllowance } from "@/lib/persistence/media/storageQuota.server";
import { PexelsStockProvider } from "./pexels";
import type { StockMediaCandidate, StockMediaType, StockOrientation, StockSearchInput, StockSearchResult } from "./types";
import { StockProviderError } from "./types";

export const STOCK_SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const STOCK_SEARCH_CACHE_SCHEMA_VERSION = "pexels-video-preview-v2";
const PEXELS_MEDIA_HOSTS = new Set(["images.pexels.com", "videos.pexels.com"]);
const nonBillableCost = { costStatus: "not_billable" as const, providerCostUsd: 0, reason: "Pexels API usage is confirmed non-billable.", components: {}, pricingVersion: "pexels-2026-08-22", pricingAsOf: "2026-08-22", currency: "USD" as const };

export function normalizeStockQuery(value: string) { return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US"); }
export function stockSearchCacheKey(input: StockSearchInput) {
  return createHash("sha256").update(JSON.stringify([STOCK_SEARCH_CACHE_SCHEMA_VERSION, normalizeStockQuery(input.query), input.mediaType, input.orientation || null, input.page, input.perPage])).digest("hex");
}
export function validateStockSearch(raw: { query?: string | null; mediaType?: string | null; orientation?: string | null; page?: string | null; perPage?: string | null }): StockSearchInput {
  const query = normalizeStockQuery(raw.query || "");
  if (!query || query.length > 120) throw new StockProviderError("STOCK_QUERY_INVALID", 400, "Enter a stock search of 120 characters or fewer.");
  if (raw.mediaType !== "photo" && raw.mediaType !== "video") throw new StockProviderError("STOCK_MEDIA_TYPE_INVALID", 400, "Choose photo or video.");
  const allowed = new Set(["landscape", "portrait", "square"]);
  if (raw.orientation && !allowed.has(raw.orientation)) throw new StockProviderError("STOCK_ORIENTATION_INVALID", 400, "Stock orientation is unsupported.");
  const page = Number(raw.page || 1); const perPage = Number(raw.perPage || 20);
  if (!Number.isInteger(page) || page < 1 || page > 1000 || !Number.isInteger(perPage) || perPage < 1 || perPage > 40) throw new StockProviderError("STOCK_PAGINATION_INVALID", 400, "Stock pagination is invalid.");
  return { query, mediaType: raw.mediaType, orientation: raw.orientation as StockOrientation | undefined, page, perPage };
}

export async function searchStock(input: StockSearchInput, userId: string, provider = new PexelsStockProvider()): Promise<StockSearchResult & { cacheStatus: "hit" | "miss" }> {
  const key = stockSearchCacheKey(input); const client = createServerSupabaseClient(); const now = new Date();
  const { data: cached } = await client.from("velto_stock_search_cache").select("payload,expires_at").eq("cache_key", key).gt("expires_at", now.toISOString()).maybeSingle();
  if (cached?.payload) {
    const result = cached.payload as StockSearchResult;
    await recordSearchEconomics(userId, key, result, true);
    return { ...result, cacheStatus: "hit" };
  }
  const result = await provider.search(input);
  await client.from("velto_stock_search_cache").upsert({ cache_key: key, provider: "pexels", media_type: input.mediaType, payload: result, expires_at: new Date(now.getTime() + STOCK_SEARCH_CACHE_TTL_MS).toISOString(), updated_at: now.toISOString() }, { onConflict: "cache_key" });
  if (result.rateLimit.remaining !== null && result.rateLimit.remaining <= 20) console.warn("PEXELS_RATE_LIMIT_LOW", { remaining: result.rateLimit.remaining, limit: result.rateLimit.limit, resetAt: result.rateLimit.resetAt });
  await recordSearchEconomics(userId, key, result, false);
  return { ...result, cacheStatus: "miss" };
}

async function recordSearchEconomics(userId: string, key: string, result: StockSearchResult, cacheHit: boolean) {
  await persistEconomicOperationBestEffort({ attemptKey: `stock-search:${key}:${userId}:${cacheHit ? "cache" : Date.now()}`, logicalOperationId: `stock-search:${key}`, userId, route: "creator-stock-search", operationType: "stock_search", provider: "pexels", providerTier: "stock", model: result.candidates[0]?.mediaType || null, state: "settled", billingMoment: "not_billable", generated: false, quantities: { requestCount: cacheHit ? 0 : 1, cacheHit, cacheMiss: !cacheHit, returnedResultCount: result.candidates.length, rateLimitLimit: result.rateLimit.limit, rateLimitRemaining: result.rateLimit.remaining }, cost: nonBillableCost, completedAt: new Date().toISOString() });
}

export function assertPexelsMediaUrl(rawUrl: string) {
  let url: URL; try { url = new URL(rawUrl); } catch { throw new StockProviderError("STOCK_DOWNLOAD_URL_INVALID", 400, "Stock download source is invalid."); }
  if (url.protocol !== "https:" || !PEXELS_MEDIA_HOSTS.has(url.hostname.toLowerCase())) throw new StockProviderError("STOCK_DOWNLOAD_HOST_UNSUPPORTED", 400, "Stock download source is unsupported.");
  return url.toString();
}

export async function importStock(input: { userId: string; projectId: string; mediaType: StockMediaType; providerMediaId: string; renditionId: string }, provider = new PexelsStockProvider()) {
  const services = getPersistenceServices();
  const project = await services.projectRepository.getForOwner(input.projectId, input.userId);
  if (!project || project.flow_type !== "creator_lab") throw new StockProviderError("STOCK_PROJECT_NOT_FOUND", 404, "CreatorLab project was not found.");
  const allowance = await checkStorageGenerationAllowance(input.userId);
  if (!allowance.allowed) throw new StockProviderError("STORAGE_QUOTA_FULL", 409, "Storage is full. Free space before importing stock media.");
  const reuseIdentity = createHash("sha256").update(`pexels:${input.mediaType}:${input.providerMediaId}:${input.renditionId}`).digest("hex");
  const client = createServerSupabaseClient();
  const { data: existing } = await client.from("velto_stock_imports").select("asset_id,public_url,source_metadata,status,created_at").eq("owner_user_id", input.userId).eq("project_id", input.projectId).eq("reuse_identity", reuseIdentity).maybeSingle();
  if (existing) {
    if (existing.status === "pending") {
      const stale = Date.now() - new Date(String(existing.created_at)).getTime() > 5 * 60_000;
      if (!stale) throw new StockProviderError("STOCK_IMPORT_IN_PROGRESS", 409, "This stock asset is already being imported. Please retry shortly.");
      await client.from("velto_stock_imports").delete().eq("owner_user_id", input.userId).eq("project_id", input.projectId).eq("reuse_identity", reuseIdentity).eq("status", "pending");
    }
    const owned = await services.mediaAssetRepository.getForOwner(String(existing.asset_id), input.userId);
    if (owned?.lifecycleState === "active" && owned.publicUrl === existing.public_url) {
      await recordImportEconomics(input, reuseIdentity, 0, true);
      return { assetId: owned.id, publicUrl: owned.publicUrl, reused: true, sourceMetadata: existing.source_metadata as Record<string, unknown> };
    }
  }
  const { error: claimError } = await client.from("velto_stock_imports").insert({ owner_user_id: input.userId, project_id: input.projectId, asset_id: null, provider: "pexels", provider_media_id: input.providerMediaId, rendition_id: input.renditionId, reuse_identity: reuseIdentity, public_url: null, source_metadata: {}, status: "pending" });
  if (claimError) {
    const { data: winner } = await client.from("velto_stock_imports").select("asset_id,public_url,source_metadata,status").eq("owner_user_id", input.userId).eq("project_id", input.projectId).eq("reuse_identity", reuseIdentity).maybeSingle();
    if (winner?.status === "ready" && winner.asset_id && winner.public_url) {
      const owned = await services.mediaAssetRepository.getForOwner(String(winner.asset_id), input.userId);
      if (owned?.lifecycleState === "active" && owned.publicUrl === winner.public_url) return { assetId: owned.id, publicUrl: owned.publicUrl, reused: true, sourceMetadata: winner.source_metadata as Record<string, unknown> };
    }
    throw new StockProviderError("STOCK_IMPORT_IN_PROGRESS", 409, "This stock asset is already being imported. Please retry shortly.");
  }
  try {
  const candidate = await provider.getMedia(input.mediaType, input.providerMediaId);
  const rendition = provider.resolveImportRendition(candidate, input.renditionId);
  const trustedUrl = assertPexelsMediaUrl(rendition.url);
  const media = await safeRemoteMediaFetch({ rawUrl: trustedUrl, kind: input.mediaType === "photo" ? "image" : "video", maxBytes: input.mediaType === "photo" ? MAX_CREATOR_IMAGE_BYTES : MAX_CREATOR_VIDEO_BYTES });
  const path = `creator/${input.userId}/stock/pexels/${input.projectId}/${input.providerMediaId}-${randomUUID()}.${media.extension}`;
  const uploaded = await services.objectStorage.uploadPublic({ bucket: input.mediaType === "photo" ? "images" : "videos", path, body: media.buffer, contentType: media.mimeType, cacheControl: "31536000", upsert: false });
  const metadata = sourceMetadata(candidate, rendition.id, rendition.width, rendition.height, media.buffer.byteLength, input.projectId, reuseIdentity);
  const asset = await registerStoredAssetOrThrow({ repository: services.mediaAssetRepository, ownerUserId: input.userId, bucket: uploaded.bucket, storagePath: uploaded.path, publicUrl: uploaded.publicUrl, mediaKind: input.mediaType === "photo" ? "image" : "video", mimeType: media.mimeType, body: media.buffer, metadata, generated: false });
  const { error } = await client.from("velto_stock_imports").update({ asset_id: asset.id, rendition_id: rendition.id, public_url: uploaded.publicUrl, source_metadata: metadata, status: "ready" }).eq("owner_user_id", input.userId).eq("project_id", input.projectId).eq("reuse_identity", reuseIdentity).eq("status", "pending");
  if (error) throw new StockProviderError("STOCK_REGISTRATION_FAILED", 500, "Stock media could not be registered.");
  await recordImportEconomics(input, reuseIdentity, media.buffer.byteLength, false, asset.id, rendition, candidate);
  return { assetId: asset.id, publicUrl: uploaded.publicUrl, reused: false, sourceMetadata: metadata };
  } catch (error) {
    await client.from("velto_stock_imports").delete().eq("owner_user_id", input.userId).eq("project_id", input.projectId).eq("reuse_identity", reuseIdentity).eq("status", "pending");
    throw error;
  }
}

function sourceMetadata(candidate: StockMediaCandidate, renditionId: string, renditionWidth: number, renditionHeight: number, bytes: number, projectId: string, reuseIdentity: string) {
  return { generated: false, source: "stock", provider: "Pexels", providerMediaId: candidate.providerMediaId, sourcePageUrl: candidate.sourcePageUrl, creatorName: candidate.creatorName, creatorProfileUrl: candidate.creatorProfileUrl, mediaType: candidate.mediaType, licenseId: candidate.license.id, licenseUrl: candidate.license.url, licenseSnapshotDate: candidate.license.snapshotDate, importedAt: new Date().toISOString(), attributionText: candidate.attributionText, originalWidth: candidate.width, originalHeight: candidate.height, durationSeconds: candidate.durationSeconds, renditionId, renditionWidth, renditionHeight, downloadedBytes: bytes, projectId, reuseIdentity, metadataVersion: candidate.metadataVersion };
}

async function recordImportEconomics(input: { userId: string; projectId: string; mediaType: StockMediaType }, reuseIdentity: string, bytes: number, reused: boolean, assetIdentity?: string, rendition?: { id: string; width: number; height: number }, candidate?: StockMediaCandidate) {
  await persistEconomicOperationBestEffort({ attemptKey: `stock-import:${input.userId}:${input.projectId}:${reuseIdentity}:${reused ? "reuse" : assetIdentity}`, logicalOperationId: `stock-import:${input.projectId}:${reuseIdentity}`, userId: input.userId, projectId: input.projectId, route: "creator-stock-import", operationType: "stock_import", provider: "pexels", providerTier: "stock", model: input.mediaType, state: "settled", billingMoment: "not_billable", generated: false, assetIdentity: assetIdentity || null, reuseIdentity, quantities: { requestCount: reused ? 0 : 1, downloadedBytes: bytes, uploadBytes: bytes, storageBytes: bytes, mediaType: input.mediaType, rendition: rendition?.id || null, renditionWidth: rendition?.width || null, renditionHeight: rendition?.height || null, sourceWidth: candidate?.width || null, sourceHeight: candidate?.height || null, durationSeconds: candidate?.durationSeconds || null, reused }, cost: nonBillableCost, completedAt: new Date().toISOString() });
}
