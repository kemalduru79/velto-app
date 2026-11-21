// VELTO_VOICE_P1B — authenticated proxy for browsing and selecting provider voices.
import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getVoiceProvider } from "@/lib/providers/voice";
import { getProviderPublicMessage } from "@/lib/providers/core/providerError";
import type { CreatorVoiceLibrarySource } from "@/lib/creator/voiceLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function queryText(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value || undefined;
}

export async function GET(request: Request) {
  try {
    await authenticateRequest(request);
    const provider = getVoiceProvider();

    if (!provider.isAvailable()) {
      return NextResponse.json(
        { ok: false, error: "Voice library is not configured." },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    const source: CreatorVoiceLibrarySource =
      url.searchParams.get("source") === "shared" ? "shared" : "available";
    const pageSizeValue = Number.parseInt(url.searchParams.get("pageSize") || "24", 10);

    const result = await provider.listVoices({
      source,
      search: queryText(url, "search"),
      language: queryText(url, "language"),
      gender: queryText(url, "gender"),
      age: queryText(url, "age"),
      accent: queryText(url, "accent"),
      useCase: queryText(url, "useCase"),
      pageToken: queryText(url, "pageToken"),
      pageSize: Number.isFinite(pageSizeValue) ? pageSizeValue : 24,
    });

    return NextResponse.json({ ok: true, source, ...result });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    console.error("voice-library GET error:", error);
    return NextResponse.json(
      { ok: false, error: getProviderPublicMessage(error, "Voice library could not be loaded.") },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await authenticateRequest(request);
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action !== "add_shared") {
      return NextResponse.json(
        { ok: false, error: "Unsupported voice library action." },
        { status: 400 },
      );
    }

    const publicOwnerId =
      typeof body.publicOwnerId === "string" ? body.publicOwnerId.trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!publicOwnerId || !voiceId || !name) {
      return NextResponse.json(
        { ok: false, error: "Voice owner, voice ID and name are required." },
        { status: 400 },
      );
    }

    const result = await getVoiceProvider().addSharedVoice({
      publicOwnerId,
      voiceId,
      name,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    console.error("voice-library POST error:", error);
    return NextResponse.json(
      { ok: false, error: getProviderPublicMessage(error, "Voice could not be added.") },
      { status: 502 },
    );
  }
}
