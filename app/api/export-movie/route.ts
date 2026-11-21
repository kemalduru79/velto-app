import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import {
  FinalMovieOwnershipError,
  FinalMovieStorageAdmissionError,
  getFinalMovieExportApiBase,
  getFinalMovieInternalToken,
  ownedFinalMovieHeaders,
  registerOwnedFinalMovieResponse,
} from "@/lib/creator/finalMovieOwnership.server";
import { checkStorageGenerationAllowance, StorageQuotaOperationalError, storageQuotaFullResponse, storageQuotaOperationalErrorResponse } from "@/lib/persistence/media/storageQuota.server";
import { issueStorageAdmissionForOwner } from "@/lib/persistence/media/storageAdmission.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const principal = await authenticateRequest(req);
    const body = await req.json() as Record<string, unknown>;
    const requestedProjectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!requestedProjectId) return NextResponse.json({ ok: false, error: "Project was not found." }, { status: 404 });
    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(requestedProjectId, principal.id);
    if (!project) return NextResponse.json({ ok: false, error: "Project was not found." }, { status: 404 });

    const exportPayload: Record<string, unknown> = { ...body, productProfile: "storyverse", projectId: project.id };
    delete exportPayload.ownerUserId;
    delete exportPayload.userId;
    delete exportPayload.storageAdmissionId;
    delete exportPayload.consumptionToken;
    delete exportPayload.storageBucket;
    delete exportPayload.storagePath;
    const exportApiBase = getFinalMovieExportApiBase();
    const internalExportToken = getFinalMovieInternalToken();
    const storageAllowance = await checkStorageGenerationAllowance(principal.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);
    let storageAdmissionId: string;
    try {
      ({ storageAdmissionId } = await issueStorageAdmissionForOwner({
        ownerUserId: principal.id,
        mediaKind: "video",
        purpose: "final_movie_export",
        projectReference: project.id,
        metadata: { productProfile: "storyverse", operation: "final_movie_export" },
      }));
    } catch {
      throw new FinalMovieStorageAdmissionError();
    }
    const response = await fetch(`${exportApiBase}/export-movie`, {
      method: "POST",
      headers: ownedFinalMovieHeaders(principal.id, project.id, internalExportToken, storageAdmissionId),
      body: JSON.stringify(exportPayload),
      signal: AbortSignal.timeout(55_000),
    });
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || data?.ok !== true || typeof data.movieUrl !== "string") {
      return NextResponse.json({ ok: false, error: "Final video could not be created." }, { status: response.status || 502 });
    }
    await registerOwnedFinalMovieResponse({ data, ownerUserId: principal.id, projectId: project.id });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (error instanceof FinalMovieStorageAdmissionError) {
      return NextResponse.json(
        { ok: false, code: "STORAGE_ADMISSION_UNAVAILABLE", error: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof StorageQuotaOperationalError) return storageQuotaOperationalErrorResponse(error);
    const status = error instanceof FinalMovieOwnershipError ? 503 : 500;
    console.error("export-movie proxy failed", error);
    return NextResponse.json({ ok: false, error: "Final video could not be created." }, { status });
  }
}
