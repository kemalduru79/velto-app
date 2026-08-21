import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { isProviderConfigured } from "../../../lib/runtime/providerEnvironment.mjs";
import { resolveRuntimeRelease } from "@/lib/runtime/releaseIdentity";

export const runtime = "nodejs";
export const maxDuration = 15;

// 3Q FINAL PRODUCTION GATE
const EXPORT_HEALTH_TIMEOUT_MS = 4_000;

function configured(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

function getExportApiBase() {
  const value =
    process.env.EXPORT_API_URL || process.env.NEXT_PUBLIC_EXPORT_API_URL || "";

  if (!value.trim()) return "";

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function checkExportService() {
  const baseUrl = getExportApiBase();
  const startedAt = Date.now();

  if (!baseUrl) {
    return {
      ready: false,
      status: "misconfigured" as const,
      latencyMs: 0,
      continuityVersion: "",
      message: "Final video service URL is not configured.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(EXPORT_HEALTH_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => null);
    const compatible =
      data?.stitchContinuityVersion === "3N-4" &&
      data?.finalProductionGateCompatible === true;
    const ready = response.ok && data?.ok === true && compatible;

    return {
      ready,
      status: ready ? ("ready" as const) : ("incompatible" as const),
      latencyMs: Date.now() - startedAt,
      continuityVersion:
        typeof data?.stitchContinuityVersion === "string"
          ? data.stitchContinuityVersion
          : "",
      message: ready
        ? "Final video service is reachable and production-gate compatible."
        : "Final video service is reachable but requires the current production continuity release.",
    };
  } catch {
    return {
      ready: false,
      status: "unavailable" as const,
      latencyMs: Date.now() - startedAt,
      continuityVersion: "",
      message: "Final video service is not reachable.",
    };
  }
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

    const exportService = await checkExportService();
    const services = {
      database:
        configured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") &&
        configured("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
      ai: isProviderConfigured("openai"),
      voice: isProviderConfigured("elevenlabs"),
      video: isProviderConfigured("runway"),
      export: exportService.ready,
    };

    const coreReady = services.database && services.ai;
    const optionalReady = services.voice && services.video;
    const status =
      !coreReady || !services.export
        ? "blocked"
        : optionalReady
          ? "ready"
          : "degraded";
    const checkedAt = new Date().toISOString();
    const release = resolveRuntimeRelease();

    return NextResponse.json(
      {
        ok: coreReady && services.export,
        status,
        checkedAt,
        requestId,
        release,
        services,
        exportService,
        message:
          status === "ready"
            ? "CreatorLab core, media and final video services are ready."
            : status === "degraded"
              ? "CreatorLab final production is ready; one or more optional media services require review."
              : exportService.message ||
                "CreatorLab final production configuration requires attention.",
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
