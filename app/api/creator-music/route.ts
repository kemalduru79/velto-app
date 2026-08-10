import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { ProviderError } from "@/lib/providers/core/providerError";
import { getMusicProvider } from "@/lib/providers/music";
import { buildCreatorPremiumMusicQuery, isCreatorPremiumMusicTrackId } from "@/lib/creator/musicLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function anonymizeUserId(userId: string) {
  return `velto-${createHash("sha256").update(`velto:premium-music:v1:${userId}`).digest("hex").slice(0, 32)}`;
}

function bounded(value: string | null, maximum: number) {
  return (value || "").trim().slice(0, maximum);
}

function publicError(error: unknown) {
  if (error instanceof ProviderError && error.code === "not_configured") return { status: 503, error: "Premium music is currently unavailable." };
  if (error instanceof ProviderError && error.code === "rate_limit") return { status: 429, error: "Music library is busy. Please try again shortly." };
  return { status: 502, error: "Music library could not be loaded. Try again." };
}

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const provider = getMusicProvider();
    if (!provider.isAvailable()) return NextResponse.json({ ok: false, error: "Premium music is currently unavailable." }, { status: 503 });
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "search";
    const partnerUserId = anonymizeUserId(principal.id);

    if (action === "preview") {
      const trackId = bounded(url.searchParams.get("trackId"), 128);
      if (!isCreatorPremiumMusicTrackId(trackId)) return NextResponse.json({ ok: false, error: "Music preview is unavailable." }, { status: 400 });
      const preview = await provider.getTrackPreview(trackId, partnerUserId);
      return NextResponse.json({ ok: true, ...preview });
    }

    const limitValue = Number.parseInt(url.searchParams.get("limit") || (action === "auto" ? "3" : "16"), 10);
    const offsetValue = Number.parseInt(url.searchParams.get("offset") || "0", 10);
    const term = action === "auto"
      ? buildCreatorPremiumMusicQuery({
          contentType: bounded(url.searchParams.get("contentType"), 64),
          outcome: bounded(url.searchParams.get("outcome"), 64),
          format: bounded(url.searchParams.get("format"), 64),
          topic: bounded(url.searchParams.get("topic"), 120),
          visualStyle: bounded(url.searchParams.get("visualStyle"), 80),
        })
      : bounded(url.searchParams.get("term"), 120) || "inspiring";
    const result = await provider.searchTracks({
      term,
      limit: action === "auto" ? 3 : limitValue,
      offset: action === "auto" ? 0 : offsetValue,
      mood: bounded(url.searchParams.get("mood"), 48) || undefined,
      genre: bounded(url.searchParams.get("genre"), 48) || undefined,
      vocalType: url.searchParams.get("vocalType") === "instrumental" ? "instrumental" : url.searchParams.get("vocalType") === "vocals" ? "vocals" : undefined,
      partnerUserId,
    });
    return NextResponse.json({ ok: true, action, ...result });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    const normalized = publicError(error);
    console.error("creator-music request failed", error instanceof ProviderError ? { code: error.code, status: error.status } : { type: "unknown" });
    return NextResponse.json({ ok: false, error: normalized.error }, { status: normalized.status });
  }
}
