import { ProviderError, classifyProviderError } from "@/lib/providers/core/providerError";
import { isIP } from "node:net";
import { normalizeCreatorPremiumMusicTrackId } from "@/lib/creator/musicLibrary";
import type {
  CreatorPremiumMusicTrack,
  MusicDownloadInput,
  MusicDownloadResult,
  MusicPreviewResult,
  MusicProvider,
  MusicSearchInput,
  MusicSearchResult,
} from "./types";
import { isPremiumMusicAcquisitionEnabled } from "./downloadSecurity";
import {
  isProviderConfigured,
  resolveProviderEnvironmentValue,
} from "@/lib/runtime/providerEnvironment.mjs";

const API_BASE = "https://partner-content-api.epidemicsound.com";
const REQUEST_TIMEOUT_MS = 8_000;

function text(value: unknown, maximum = 160) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function labels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(typeof item === "string" ? item : (item as Record<string, unknown>)?.name, 48)).filter(Boolean).slice(0, 6);
}

export function normalizePremiumMusicTrack(value: unknown): CreatorPremiumMusicTrack | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const id = normalizeCreatorPremiumMusicTrackId(source.id);
  const title = text(source.title, 160);
  if (!id || !title) return undefined;
  const artistValue = source.mainArtist ?? (Array.isArray(source.mainArtists) ? source.mainArtists[0] : undefined) ?? source.artist;
  const artist = text(typeof artistValue === "string" ? artistValue : (artistValue as Record<string, unknown>)?.name, 120);
  const bpm = number(source.bpm);
  const durationSec = number(source.length ?? source.durationSec);
  const artworkUrl = text(source.imageUrl, 500);
  return {
    id,
    title,
    ...(artist ? { artist } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    ...(bpm !== undefined ? { bpm } : {}),
    moods: labels(source.moods),
    genres: labels(source.genres),
    energy: bpm === undefined ? undefined : bpm >= 125 ? "high" : bpm <= 85 ? "low" : "medium",
    ...(typeof source.hasVocals === "boolean" ? { hasVocals: source.hasVocals } : {}),
    ...(artworkUrl && /^https:\/\//.test(artworkUrl) ? { artworkUrl } : {}),
    previewAvailable: source.previewAvailable !== false,
  };
}

export class EpidemicMusicAdapter implements MusicProvider {
  isAvailable() {
    return isProviderConfigured("epidemic");
  }

  private headers(partnerUserId: string) {
    const apiKey = resolveProviderEnvironmentValue("epidemic", "apiKey");
    if (!apiKey) throw new ProviderError("Music provider is not configured.", { code: "not_configured", retryable: false });
    return { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "x-partner-user-id": partnerUserId };
  }

  private async request(pathname: string, partnerUserId: string) {
    try {
      const response = await fetch(`${API_BASE}${pathname}`, {
        headers: this.headers(partnerUserId),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new ProviderError("Music service request failed.", {
          code: response.status === 429 ? "rate_limit" : response.status === 401 || response.status === 403 ? "authentication" : response.status === 400 ? "invalid_request" : "upstream",
          retryable: response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }
      return await response.json() as unknown;
    } catch (error) {
      throw classifyProviderError(error, "Music library could not be loaded.");
    }
  }

  async searchTracks(input: MusicSearchInput): Promise<MusicSearchResult> {
    const limit = Math.min(20, Math.max(1, Math.round(input.limit || 16)));
    const offset = Math.min(600, Math.max(0, Math.round(input.offset || 0)));
    const params = new URLSearchParams({ term: text(input.term, 120) || "inspiring", limit: String(limit), offset: String(offset) });
    if (input.mood) params.set("mood", text(input.mood, 48));
    if (input.genre) params.set("genre", text(input.genre, 48));
    if (input.vocalType) params.set("vocalType", input.vocalType);
    const raw = await this.request(`/v0/tracks/search?${params}`, input.partnerUserId) as Record<string, unknown>;
    const tracks = (Array.isArray(raw.tracks) ? raw.tracks : []).map(normalizePremiumMusicTrack).filter((track): track is CreatorPremiumMusicTrack => Boolean(track));
    const next = raw.links && typeof raw.links === "object" ? (raw.links as Record<string, unknown>).next : undefined;
    return { tracks, limit, offset, hasMore: typeof next === "string" && Boolean(next) };
  }

  async getTrackPreview(trackId: string, partnerUserId: string): Promise<MusicPreviewResult> {
    const raw = await this.request(`/v0/tracks/${encodeURIComponent(trackId)}/stream`, partnerUserId) as Record<string, unknown>;
    const streamUrl = text(raw.url, 1000);
    if (!/^https:\/\//.test(streamUrl)) throw new ProviderError("Music preview is unavailable.", { code: "upstream", retryable: true });
    return { streamUrl, ...(text(raw.expires, 80) ? { expiresAt: text(raw.expires, 80) } : {}) };
  }

  async downloadTrack(input: MusicDownloadInput): Promise<MusicDownloadResult> {
    const trackId = normalizeCreatorPremiumMusicTrackId(input.trackId);
    const networkLikeTrackId = trackId
      ? trackId.toLowerCase().replace(/^\[|\]$/g, "")
      : "";
    if (
      !trackId ||
      networkLikeTrackId === "localhost" ||
      networkLikeTrackId.endsWith(".localhost") ||
      networkLikeTrackId.endsWith(".local") ||
      isIP(networkLikeTrackId) !== 0
    ) {
      throw new ProviderError("Premium music acquisition is unavailable.", {
        code: "invalid_request",
        retryable: false,
      });
    }
    if (!isPremiumMusicAcquisitionEnabled()) {
      throw new ProviderError("Premium music acquisition is unavailable.", {
        code: "not_configured",
        retryable: false,
      });
    }

    // The production acquisition endpoint and response contract have not been
    // approved in this repository. Keep this method fail-closed rather than
    // guessing a download URL or exposing a commercial provider operation.
    throw new ProviderError("Premium music acquisition is unavailable.", {
      code: "not_configured",
      retryable: false,
    });
  }
}
