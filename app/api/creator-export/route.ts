import { NextResponse } from "next/server";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";
import { normalizeCreatorBackgroundMusicConfig } from "@/lib/creator/backgroundMusic";
import {
  autoMatchCreatorMusic,
  CREATOR_MUSIC_TRACK_IDS,
} from "@/lib/creator/musicLibrary";

export const runtime = "nodejs";
export const maxDuration = 60;

// 3Q FINAL PRODUCTION GATE
const EXPORT_HEALTH_TIMEOUT_MS = 4_000;

class ExportServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportServiceUnavailableError";
  }
}

function getExportApiBase() {
  const value =
    process.env.EXPORT_API_URL || process.env.NEXT_PUBLIC_EXPORT_API_URL || "";

  if (!value.trim()) {
    throw new ExportServiceUnavailableError(
      "Final video service URL is not configured.",
    );
  }

  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ExportServiceUnavailableError(
      "Final video service URL is invalid.",
    );
  }

  return parsed.toString().replace(/\/$/, "");
}

async function assertExportServiceReady(baseUrl: string) {
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

    if (!response.ok || data?.ok !== true || !compatible) {
      throw new ExportServiceUnavailableError(
        "Final video service is not ready for the current production continuity release.",
      );
    }
  } catch (error) {
    if (error instanceof ExportServiceUnavailableError) throw error;
    throw new ExportServiceUnavailableError(
      "Final video service is currently unavailable. No export credit was reserved.",
    );
  }
}

export async function POST(request: Request) {
  let creditReservation: MeteredOperationReservation | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productProfile =
      body.productProfile === "creatorlab" ? "creatorlab" : "storyverse";
    const qualityMode = body.qualityMode;
    const exportPayload = { ...body };
    delete exportPayload.qualityMode;
    if (productProfile === "creatorlab") {
      let backgroundMusic = normalizeCreatorBackgroundMusicConfig(
        body.backgroundMusic,
        CREATOR_MUSIC_TRACK_IDS,
      );
      if (backgroundMusic.mode === "auto") {
        const matchedTrack = autoMatchCreatorMusic({
          contentType: typeof body.contentType === "string" ? body.contentType : "",
          outcome: typeof body.outcome === "string" ? body.outcome : "",
          topic: typeof body.title === "string" ? body.title : "",
          visualStyle: typeof body.visualStyle === "string" ? body.visualStyle : "",
          emotionalTone: typeof body.emotionalTone === "string" ? body.emotionalTone : "",
          format: typeof body.creatorFormat === "string" ? body.creatorFormat : "",
        });
        backgroundMusic = matchedTrack
          ? { ...backgroundMusic, mode: "selected", selectedTrackId: matchedTrack.id }
          : { ...backgroundMusic, mode: "none", selectedTrackId: undefined };
      }
      exportPayload.backgroundMusic = backgroundMusic;
    } else {
      delete exportPayload.backgroundMusic;
    }

    const exportApiBase = getExportApiBase();

    // The service check intentionally runs before credit reservation.
    await assertExportServiceReady(exportApiBase);

    creditReservation = await reserveMeteredOperation(request, {
      operationType: "creator_export",
      qualityMode,
      provider: "velto-export",
      referenceId:
        typeof body.projectId === "string" ? body.projectId : undefined,
      metadata: {
        sceneCount: Array.isArray(body.scenes) ? body.scenes.length : 0,
        finalProductionGate: "3Q",
      },
      billable: productProfile === "creatorlab",
      requireCostGuardConfirmation: productProfile === "creatorlab",
    });

    const response = await fetch(`${exportApiBase}/export-movie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportPayload),
      signal: AbortSignal.timeout(55_000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !data?.movieUrl) {
      throw new Error(data?.error || "Film export işlemi başarısız oldu.");
    }

    const creditResult = creditReservation
      ? await settleMeteredOperation(creditReservation, {
          providerRequestId:
            response.headers.get("x-request-id") ||
            response.headers.get("request-id") ||
            undefined,
          metadata: {
            movieUrlCreated: true,
            sceneCount: data.sceneCount,
            finalProductionGate: "3Q",
          },
        })
      : null;

    return NextResponse.json({
      ...data,
      finalProductionGate: { version: "3Q", status: "passed" },
      creditAccount: creditResult?.account || null,
      creditUsage: creditReservation
        ? {
            operationType: creditReservation.operationType,
            credits: creditReservation.reservedCredits,
          }
        : null,
    });
  } catch (error) {
    if (creditReservation) {
      await releaseMeteredOperation(
        creditReservation,
        error instanceof Error ? error.message : "creator export failed",
      );
    }

    if (error instanceof ExportServiceUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          code: "creator_export_service_unavailable",
          error: error.message,
          creditReserved: false,
          finalProductionGate: { version: "3Q", status: "blocked" },
        },
        { status: 503 },
      );
    }

    const creditResponse = getCreditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error("creator-export error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Film export işlemi tamamlanamadı.",
      },
      { status: 500 },
    );
  }
}
