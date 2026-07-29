import { NextResponse } from "next/server";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";

export const runtime = "nodejs";
export const maxDuration = 60;

function getExportApiBase() {
  const value =
    process.env.EXPORT_API_URL || process.env.NEXT_PUBLIC_EXPORT_API_URL || "";

  if (!value.trim()) {
    throw new Error("Export servisi URL'i tanımlı değil.");
  }

  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Export servisi URL'i geçersiz.");
  }

  return parsed.toString().replace(/\/$/, "");
}

export async function POST(request: Request) {
  let creditReservation: MeteredOperationReservation | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productProfile =
      body.productProfile === "creatorlab" ? "creatorlab" : "storyverse";
    const qualityMode = body.qualityMode;
    const exportPayload = { ...body };
    delete exportPayload.productProfile;
    delete exportPayload.qualityMode;

    creditReservation = await reserveMeteredOperation(request, {
        operationType: "creator_export",
        qualityMode,
        provider: "velto-export",
        referenceId:
          typeof body.projectId === "string" ? body.projectId : undefined,
        metadata: {
          sceneCount: Array.isArray(body.scenes) ? body.scenes.length : 0,
        },
        billable: productProfile === "creatorlab",
      });

    const response = await fetch(`${getExportApiBase()}/export-movie`, {
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
          },
        })
      : null;

    return NextResponse.json({
      ...data,
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
