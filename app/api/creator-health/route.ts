import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

function configured(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Yetkisiz istek.", requestId },
        { status: 401 },
      );
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Geçersiz oturum.", requestId },
        { status: 401 },
      );
    }

    const services = {
      database:
        configured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") &&
        configured("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
      ai: configured("OPENAI_API_KEY"),
      voice: configured("ELEVENLABS_API_KEY"),
      video: configured(
        "RUNWAYML_API_SECRET",
        "RUNWAY_API_KEY",
        "RUNWAYML_API_KEY",
      ),
    };

    const coreReady = services.database && services.ai;
    const optionalReady = services.voice && services.video;
    const status = !coreReady ? "blocked" : optionalReady ? "ready" : "degraded";
    const checkedAt = new Date().toISOString();
    const release =
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
      process.env.NEXT_PUBLIC_APP_VERSION ||
      "local";

    return NextResponse.json(
      {
        ok: coreReady,
        status,
        checkedAt,
        requestId,
        release,
        services,
        message:
          status === "ready"
            ? "CreatorLab core and media services are configured."
            : status === "degraded"
              ? "CreatorLab core is ready; one or more optional media services require review."
              : "CreatorLab core configuration requires attention.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("creator-health error:", error);

    return NextResponse.json(
      {
        ok: false,
        status: "blocked",
        requestId,
        checkedAt: new Date().toISOString(),
        error: "CreatorLab operational status could not be checked.",
      },
      { status: 500 },
    );
  }
}
