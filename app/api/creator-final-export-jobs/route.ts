import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentCreatorFinalProductionAuthority } from "@/lib/creator/publishReadiness.server";
import { resolveCreatorAudioRenderability } from "@/lib/creator/audioRenderability.server";
import { validateCreatorAudioTimelineTopology } from "@/lib/creator/audioTimeline";
import { issueStorageAdmissionForOwner, releaseUnusedStorageAdmissionForOwner } from "@/lib/persistence/media/storageAdmission.server";
import { reserveMeteredOperation, releaseMeteredOperation } from "@/lib/credits/serverMetering";
import { createHash } from "node:crypto";
import { createExportFlowValidation } from "@/lib/video/exportFlowValidation";
import { resolveCreatorProjectUsedMediaGovernance, creatorGovernanceExportBlockResponse } from "@/lib/creator/usedMediaGovernance.server";
import { checkStorageGenerationAllowance, storageQuotaFullResponse } from "@/lib/persistence/media/storageQuota.server";
import { buildCreatorMusicUsageEventIdentity } from "@/lib/creator/musicUsage";
import { claimEconomicOperation, releaseEconomicOperationClaim, unknownCost } from "@/lib/economics";
import { validateCreatorRenderSceneMediaIdentities } from "@/lib/creator/mediaFingerprint.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store, max-age=0" },
});

const row = (value: unknown) => Array.isArray(value) ? value[0] : value;

export async function POST(request: Request) {
  let reservation: Awaited<ReturnType<typeof reserveMeteredOperation>> = null;
  let economicAttemptKey = "";
  let economicClaimed = false;
  let enqueueOwnerUserId = "";
  let enqueueIdempotencyKey = "";
  let enqueueSignatureSha256 = "";
  let storageAdmissionId = "";
  try {
    const principal = await authenticateRequest(request);
    enqueueOwnerUserId = principal.id;
    const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) return json({ ok: false, code: "PROJECT_REQUIRED" }, 400);
    const project = await getPersistenceServices().projectRepository.getForOwner(projectId, principal.id);
    if (!project || project.flow_type !== "creator_lab") return json({ ok: false, code: "PROJECT_NOT_FOUND" }, 404);

    const authority = currentCreatorFinalProductionAuthority(project);
    if (!validateCreatorRenderSceneMediaIdentities(authority.manifestScenes)) {
      return json({ ok: false, code: "CREATOR_FINAL_EXPORT_MEDIA_IDENTITY_INVALID" }, 409);
    }
    const governance = (await resolveCreatorProjectUsedMediaGovernance({ ownerUserId: principal.id, project })).governance;
    if (governance.status === "blocked") return NextResponse.json(creatorGovernanceExportBlockResponse(governance), { status: 409 });
    const topology = validateCreatorAudioTimelineTopology({
      timeline: authority.state.production.audioTimeline,
      sceneIds: authority.manifestScenes.map((scene) => String(scene.creatorSceneId || "")),
    });
    if (topology.status !== "ready") return json({ ok: false, code: "CREATOR_AUDIO_TOPOLOGY_INVALID" }, 409);
    const audio = await resolveCreatorAudioRenderability({
      ownerUserId: principal.id,
      projectId,
      timeline: authority.state.production.audioTimeline,
    });
    const flowValidation = createExportFlowValidation({
      scenes: authority.manifestScenes.map((scene) => {
        const source = scene as Record<string, unknown>;
        const timing = source.timing && typeof source.timing === "object" && !Array.isArray(source.timing) ? source.timing as Record<string, unknown> : {};
        return {
          id: scene.creatorSceneId,
          source: scene.exportSource === "video" ? "video" as const : scene.exportSource === "image" ? "image" as const : "none" as const,
          hasNarration: Boolean(String(source.narration || "").trim()),
          hasDialogue: Boolean(String(source.dialogue || "").trim()),
          narrationDurationSec: Number(timing.narrationDuration || 0),
          dialogueDurationSec: Number(timing.dialogueDuration || 0),
          targetDurationSec: Number(timing.targetSceneDuration || 0),
          videoDurationSec: Number(source.videoDurationSeconds || 0),
          visualCoveragePlan: scene.visualCoveragePlan,
          hasReferenceImage: Boolean(source.image),
        };
      }),
    });
    if (!flowValidation.canExport || (flowValidation.requiresManualConfirmation && body.manualConfirmationGranted !== true)) {
      return json({ ok: false, code: "CREATOR_FINAL_EXPORT_FLOW_BLOCKED", flowValidation }, 409);
    }
    const client = createServerSupabaseClient();
    const { data: generationData, error: generationError } = await client.rpc("velto_resolve_creator_final_export_generation", {
      p_owner_user_id: principal.id, p_project_id: projectId, p_production_signature_sha256: authority.signatureSha256,
    });
    if (generationError) throw new Error(generationError.message);
    const generationAuthority = row(generationData) as Record<string, unknown>;
    const generation = Number(generationAuthority?.generation);
    if (!Number.isSafeInteger(generation) || generation < 0) throw new Error("Creator final export generation authority is invalid.");
    const idempotencyKey = `creator-final-export:${projectId}:${authority.signatureSha256}${generation === 0 ? "" : `:generation:${generation}`}`;
    enqueueIdempotencyKey = idempotencyKey;
    enqueueSignatureSha256 = authority.signatureSha256;
    economicAttemptKey = `${idempotencyKey}:velto-export:1`;
    const { data: existing } = await client.from("velto_jobs").select("id,status,created_at,updated_at")
      .eq("user_id", principal.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return json({ ok: true, reused: true, job: existing, productionSignatureSha256: authority.signatureSha256 }, 202);

    const allowance = await checkStorageGenerationAllowance(principal.id);
    if (!allowance.allowed) return storageQuotaFullResponse(allowance.storage);

    reservation = await reserveMeteredOperation(request, {
      operationType: "creator_export",
      qualityMode: authority.state.brief.qualityMode,
      provider: "velto-export",
      referenceId: projectId,
      requireCostGuardConfirmation: true,
      admissionMode: "balance_backed",
      metadata: { projectId, productionSignatureSha256: authority.signatureSha256, generation },
    });
    if (!reservation) throw new Error("Creator final export credit reservation was not created.");
    await claimEconomicOperation({
      attemptKey: economicAttemptKey, logicalOperationId: idempotencyKey, idempotencyKey,
      creditReservationId: reservation.reservationId, userId: principal.id, projectId,
      route: "/api/creator-final-export-jobs", operationType: "creator_export",
      productTier: String(authority.state.brief.qualityMode || "standard"), provider: "velto-export",
      providerTier: "infrastructure", model: "ffmpeg-1280x720-25fps", state: "reserved",
      quantities: { sceneCount: authority.manifestScenes.length, requestCount: 1 },
      cost: unknownCost("Railway runtime, Supabase storage, and egress rates are not approved."),
    });
    economicClaimed = true;
    ({ storageAdmissionId } = await issueStorageAdmissionForOwner({
      ownerUserId: principal.id, mediaKind: "video", purpose: "final_movie_export", projectReference: projectId,
      metadata: {
        productProfile: "creatorlab", operation: "creator_final_export_job",
        productionSignatureSha256: authority.signatureSha256,
        manifestSha256: authority.renderPayloadDigest,
      },
    }));
    const renderPayload = {
      productProfile: "creatorlab",
      projectId,
      creatorFormat: authority.state.brief.format,
      qualityMode: authority.state.brief.qualityMode,
      title: project.title,
      scenes: authority.manifestScenes,
      audioTimeline: audio.timeline,
      creatorAudioAssets: audio.assets,
      exportFlowValidation: flowValidation,
      manualConfirmationGranted: body.manualConfirmationGranted === true,
      finalProductionManifestSha256: authority.renderPayloadDigest,
      finalProductionSignatureSha256: authority.signatureSha256,
    };
    const musicUsageIdentities = audio.assets.flatMap((asset) => {
      if (asset.kind !== "licensed") return [];
      const identity = buildCreatorMusicUsageEventIdentity({
        entitlementId: asset.entitlementId, userId: principal.id, projectId,
        trackId: asset.trackId, exportIdempotencyKey: idempotencyKey,
      });
      return identity ? [identity] : [];
    });
    const renderPayloadSha256 = createHash("sha256").update(JSON.stringify(renderPayload)).digest("hex");
    const { data, error } = await client.rpc("velto_enqueue_creator_final_export_generation", {
      p_owner_user_id: principal.id,
      p_project_id: projectId,
      p_expected_updated_at: project.updated_at,
      p_production_signature: authority.signature,
      p_production_signature_sha256: authority.signatureSha256,
      p_manifest: JSON.parse(authority.manifest),
      p_manifest_sha256: authority.renderPayloadDigest,
      p_render_payload_sha256: renderPayloadSha256,
      p_generation: generation,
      p_payload: {
        renderPayload, renderPayloadSha256, storageAdmissionId, musicUsageIdentities,
        creditReservationId: reservation?.reservationId || null,
        reservedCredits: reservation?.reservedCredits || 0,
        economicAttemptKey,
        logicalOperationId: idempotencyKey,
      },
    });
    if (error) throw new Error(error.message);
    const job = row(data) as Record<string, unknown>;
    return json({ ok: true, reused: false, job: { id: job.id, status: job.status, created_at: job.created_at, updated_at: job.updated_at }, productionSignatureSha256: authority.signatureSha256 }, 202);
  } catch (error) {
    if (enqueueOwnerUserId && enqueueIdempotencyKey) {
      const { data: existing, error: reconciliationError } = await createServerSupabaseClient().from("velto_jobs")
        .select("id,status,created_at,updated_at").eq("user_id", enqueueOwnerUserId)
        .eq("idempotency_key", enqueueIdempotencyKey).maybeSingle();
      if (existing) return json({ ok: true, reused: true, job: existing, productionSignatureSha256: enqueueSignatureSha256 }, 202);
      if (reconciliationError) {
        return json({ ok: false, code: "CREATOR_FINAL_EXPORT_ENQUEUE_AMBIGUOUS", error: "Final export enqueue outcome is ambiguous; no automatic retry was started." }, 503);
      }
    }
    if (reservation) await releaseMeteredOperation(reservation, "creator final export enqueue failed").catch(() => undefined);
    if (economicClaimed) await releaseEconomicOperationClaim(economicAttemptKey, "creator final export enqueue failed").catch(() => undefined);
    if (storageAdmissionId && enqueueOwnerUserId) {
      await releaseUnusedStorageAdmissionForOwner({ ownerUserId: enqueueOwnerUserId, storageAdmissionId }).catch(() => undefined);
    }
    console.error("creator final export enqueue failed", error);
    return json({ ok: false, code: "CREATOR_FINAL_EXPORT_ENQUEUE_FAILED", error: "Final export could not be queued safely." }, 500);
  }
}
