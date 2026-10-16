import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFinalMovieExportApiBase, getFinalMovieInternalToken, ownedFinalMovieHeaders } from "@/lib/creator/finalMovieOwnership.server";
import { extractProjectMediaReferences } from "@/lib/persistence/media/projectReferences";
import { registerCreatorMusicExportUsage } from "@/lib/creator/musicUsage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function tokenMatches(req: NextRequest) {
  const expected = process.env.VELTO_INTERNAL_WORKER_TOKEN || "";
  const supplied = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  return timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(supplied).digest());
}

export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  if (!tokenMatches(req)) return json({ ok: false, error: "Internal worker authentication failed." }, 401);
  const { jobId } = await context.params;
  const job = await getPersistenceServices().jobQueue.getInternal(jobId);
  if (!job || job.jobType !== "creator_final_export" || !job.userId || !job.projectId) return json({ ok: false, error: "Final export job was not found." }, 404);
  const payload = record(job.payload);
  const renderPayload = record(payload.renderPayload);
  const admissionId = typeof payload.storageAdmissionId === "string" ? payload.storageAdmissionId : "";
  const manifestSha256 = typeof renderPayload.finalProductionManifestSha256 === "string" ? renderPayload.finalProductionManifestSha256 : "";
  const signatureSha256 = typeof renderPayload.finalProductionSignatureSha256 === "string" ? renderPayload.finalProductionSignatureSha256 : "";
  const renderPayloadSha256 = typeof payload.renderPayloadSha256 === "string" ? payload.renderPayloadSha256 : "";
  if (!admissionId || !/^[0-9a-f]{64}$/.test(manifestSha256) || !/^[0-9a-f]{64}$/.test(signatureSha256) || !/^[0-9a-f]{64}$/.test(renderPayloadSha256)) {
    return json({ ok: false, error: "Persisted final export provenance is invalid." }, 409);
  }
  const supabase = createServerSupabaseClient();
  const { data: run, error: runError } = await supabase.from("velto_creator_final_export_runs").select("state,public_url,storage_path,size_bytes,output_sha256,output,production_signature,production_signature_sha256,manifest_sha256,render_payload_sha256").eq("job_id", jobId).single();
  if (runError || run.production_signature_sha256 !== signatureSha256 || run.manifest_sha256 !== manifestSha256 || run.render_payload_sha256 !== renderPayloadSha256) {
    return json({ ok: false, error: "Final export run provenance is invalid." }, 409);
  }
  let output = run.state === "uploaded" || run.state === "installed" ? record(run.output) : record(run);
  if (run.state !== "uploaded" && run.state !== "installed") {
    const response = await fetch(`${getFinalMovieExportApiBase()}/export-movie`, {
      method: "POST",
      headers: {
        ...ownedFinalMovieHeaders(job.userId, job.projectId, getFinalMovieInternalToken(), admissionId),
        "x-velto-final-export-job-id": jobId,
        "x-velto-manifest-sha256": manifestSha256,
        "x-velto-render-payload-sha256": renderPayloadSha256,
      },
      body: JSON.stringify(renderPayload),
    });
    const data = record(await response.json().catch(() => ({})));
    if (response.status === 202) return json({ ok: true, status: "rendering" }, 202);
    if (!response.ok || data.ok !== true || data.finalExportJobId !== jobId || data.manifestSha256 !== manifestSha256 || data.renderPayloadSha256 !== renderPayloadSha256) {
      return json({ ok: false, error: "Final export service did not return bound output provenance." }, response.status >= 500 ? 503 : 409);
    }
    output = data;
  }
  const project = await getPersistenceServices().projectRepository.getForOwner(job.projectId, job.userId);
  if (!project) return json({ ok: false, error: "Project was not found." }, 409);
  const movieUrl = String(output.movieUrl || output.public_url || "");
  const exportedMovieResult = {
    movieUrl, downloadUrl: String(output.downloadUrl || movieUrl), fileName: String(output.fileName || ""),
    sizeBytes: Number(output.sizeBytes || output.size_bytes || 0), durationSeconds: Number(output.durationSeconds || 0),
    sceneCount: Number(output.sceneCount || 0), finalExportJobId: jobId, outputSha256: String(output.outputSha256 || output.output_sha256 || ""),
    productionSignature: String(run.production_signature || ""),
  };
  const references = extractProjectMediaReferences({ ...project, exported_movie_url: movieUrl });
  const { data: installed, error: installError } = await supabase.rpc("velto_install_creator_final_export", {
    p_job_id: jobId, p_exported_movie_result: exportedMovieResult, p_references: references,
  });
  if (installError) return json({ ok: false, error: "Final export installation failed safely." }, 409);
  const installation = record(installed);
  const newlyInstalled = installation.status === "installed";
  if (newlyInstalled && Array.isArray(payload.musicUsageIdentities)) {
    for (const identity of payload.musicUsageIdentities) {
      if (identity && typeof identity === "object" && !Array.isArray(identity)) {
        await registerCreatorMusicExportUsage(identity as Parameters<typeof registerCreatorMusicExportUsage>[0]);
      }
    }
  }
  if (typeof payload.economicAttemptKey === "string") {
    const { error: economicError } = await supabase.rpc("velto_settle_creator_final_export_economics", {
      p_attempt_key: payload.economicAttemptKey, p_job_id: job.id,
      p_asset_identity: String(output.storagePath || output.storage_path || ""),
      p_scene_count: exportedMovieResult.sceneCount, p_output_bytes: exportedMovieResult.sizeBytes,
    });
    if (economicError) return json({ ok: false, error: "Final export economics could not be settled safely." }, 409);
  }
  return json({ ok: true, status: installation.status === "stale" ? "stale" : "completed", outputReady: installation.status === "installed" || installation.status === "already_installed", movie: exportedMovieResult, installation });
}
