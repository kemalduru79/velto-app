import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import {
  attachCreatorProjectState,
  type CreatorProjectStateSnapshot,
} from "@/lib/creator/projectState";
import {
  assertCreatorFinalVideoRecoveryAuthority,
  buildCreatorFinalVideoRecoveryStoragePath,
  creatorFinalVideoRecoverySha256,
  CreatorFinalVideoRecoveryError,
  CREATOR_FINAL_VIDEO_RECOVERY_TARGET,
} from "@/lib/creator/finalVideoRecovery";
import {
  CreatorFinalVideoRecoveryInspectionError,
  assertCreatorFinalVideoRecoveryStorageMetadata,
  probeCreatorFinalVideoRecoveryStream,
} from "@/lib/creator/finalVideoRecoveryProbe.server";
import { currentCreatorFinalProductionAuthority } from "@/lib/creator/publishReadiness.server";
import { extractProjectMediaReferences, getPersistenceServices } from "@/lib/persistence";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { VeltoProjectApiRecord } from "@/lib/persistence/projects";

export const runtime = "nodejs";
export const maxDuration = 180;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recoveryError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return json({ ok: false, code: "RECOVERY_AUTHENTICATION_REQUIRED", error: "Authentication required." }, 401);
  }
  if (error instanceof CreatorFinalVideoRecoveryError) {
    return json({ ok: false, code: error.code, error: "Final video recovery was rejected." }, error.status);
  }
  if (error instanceof CreatorFinalVideoRecoveryInspectionError) {
    const status = error.code === "RECOVERY_STORAGE_SIZE_INVALID" ? 413 : 422;
    return json({ ok: false, code: error.code, error: "Final video recovery artifact was rejected." }, status);
  }
  if (error instanceof Error && /RECOVERY_PROJECT_(STALE|CAS_FAILED)/.test(error.message)) {
    return json({ ok: false, code: "RECOVERY_PERSISTENCE_CONFLICT", error: "Project changed before recovery could be installed." }, 409);
  }
  console.error("creator final video recovery failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  return json({ ok: false, code: "RECOVERY_FAILED", error: "Final video recovery failed safely." }, 500);
}

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
    if (projectId !== "e572838e-98ab-42cd-92f4-bf56658cad77") {
      return json({ ok: false, ready: false, code: "RECOVERY_PROJECT_NOT_FOUND" }, 404);
    }
    const project = await getPersistenceServices().projectRepository.getForOwner(projectId, principal.id);
    if (!project || project.flow_type !== "creator_lab") {
      return json({ ok: false, ready: false, code: "RECOVERY_PROJECT_NOT_FOUND" }, 404);
    }
    const authority = currentCreatorFinalProductionAuthority(project);
    const timeline = authority.state.production.audioTimeline;
    const placements = Array.isArray(timeline?.placements) ? timeline.placements : [];
    const productionSignatureSha256 = creatorFinalVideoRecoverySha256(authority.signature);
    const storagePath = buildCreatorFinalVideoRecoveryStoragePath(principal.id, projectId);
    const { data: objectInfo, error: objectInfoError } = await createServerSupabaseClient()
      .storage.from(CREATOR_FINAL_VIDEO_RECOVERY_TARGET.bucket).info(storagePath);
    const checks = {
      sceneCount: authority.state.createReview.scenes.length === CREATOR_FINAL_VIDEO_RECOVERY_TARGET.sceneCount,
      musicFree: timeline?.musicIntent?.mode === "none" && placements.length === 0,
      productionSignature: productionSignatureSha256 === CREATOR_FINAL_VIDEO_RECOVERY_TARGET.productionSignatureSha256,
      storageIdentity: !objectInfoError && objectInfo?.size === CREATOR_FINAL_VIDEO_RECOVERY_TARGET.sizeBytes,
    };
    const ready = Object.values(checks).every(Boolean);
    return json({
      ok: true,
      ready,
      projectId,
      projectUpdatedAt: String(project.updated_at || ""),
      artifact: CREATOR_FINAL_VIDEO_RECOVERY_TARGET.fileName,
      checks,
      productionSignatureSha256,
    });
  } catch (error) {
    return recoveryError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const body = record(await request.json());
    const allowedKeys = new Set(["projectId", "expectedUpdatedAt", "humanReviewConfirmed"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return json({ ok: false, code: "RECOVERY_INPUT_INVALID", error: "Recovery input is invalid." }, 400);
    }
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt.trim() : "";
    if (!projectId) return json({ ok: false, code: "RECOVERY_PROJECT_REQUIRED", error: "Project is required." }, 400);

    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project || project.flow_type !== "creator_lab") {
      return json({ ok: false, code: "RECOVERY_PROJECT_NOT_FOUND", error: "Project was not found." }, 404);
    }

    const authority = currentCreatorFinalProductionAuthority(project);
    const timeline = authority.state.production.audioTimeline;
    const placements = Array.isArray(timeline?.placements) ? timeline.placements : [];
    const storagePath = buildCreatorFinalVideoRecoveryStoragePath(principal.id, projectId);
    const supabase = createServerSupabaseClient();
    const storage = supabase.storage.from(CREATOR_FINAL_VIDEO_RECOVERY_TARGET.bucket);
    const { data: objectInfo, error: objectInfoError } = await storage.info(storagePath);
    if (objectInfoError || !objectInfo) {
      throw new CreatorFinalVideoRecoveryError("RECOVERY_STORAGE_IDENTITY_INVALID", 404);
    }
    assertCreatorFinalVideoRecoveryStorageMetadata(objectInfo.size);
    const { data: downloadStream, error: downloadError } = await storage
      .download(storagePath, {}, { cache: "no-store" })
      .asStream();
    if (downloadError || !downloadStream) {
      throw new CreatorFinalVideoRecoveryInspectionError("RECOVERY_DOWNLOAD_INVALID");
    }
    const probe = await probeCreatorFinalVideoRecoveryStream({
      metadataSize: objectInfo.size,
      stream: downloadStream,
    });
    const { data: publicData } = storage.getPublicUrl(storagePath);
    const publicUrl = publicData.publicUrl;

    const existingAsset = await services.mediaAssetRepository.findByStorageObject(
      principal.id,
      CREATOR_FINAL_VIDEO_RECOVERY_TARGET.bucket,
      storagePath,
    );
    const matchingAsset = Boolean(
      existingAsset &&
      existingAsset.publicUrl === publicUrl &&
      existingAsset.mediaKind === "final_video" &&
      existingAsset.mimeType === "video/mp4" &&
      existingAsset.sizeBytes === CREATOR_FINAL_VIDEO_RECOVERY_TARGET.sizeBytes &&
      existingAsset.lifecycleState === "active" &&
      existingAsset.metadata?.projectId === projectId,
    );
    const alreadyInstalled =
      project.exported_movie_url === publicUrl &&
      project.export_signature === authority.signature &&
      authority.state.publish.finalVideoUrl === publicUrl &&
      authority.state.publish.finalVideoSignature === authority.signature;
    const decision = assertCreatorFinalVideoRecoveryAuthority({
      ownerUserId: principal.id,
      projectId,
      projectUpdatedAt: String(project.updated_at || ""),
      expectedUpdatedAt,
      currentProductionSignature: authority.signature,
      sceneCount: authority.state.createReview.scenes.length,
      musicIntentMode: timeline?.musicIntent?.mode,
      musicPlacementCount: placements.length,
      humanReviewConfirmed: body.humanReviewConfirmed === true,
      storagePath,
      probe,
      existingAsset: existingAsset ? matchingAsset ? "matching" : "conflicting" : "none",
      alreadyInstalled,
    });

    let savedProject = project;
    let recoveryStatus: "recovered" | "already_recovered" = alreadyInstalled ? "already_recovered" : "recovered";
    if (!alreadyInstalled) {
      const previousResult = record(project.exported_movie_result);
      const previousLifecycle = record(previousResult.projectLifecycle);
      const previousHistory = record(previousLifecycle.artifactHistory);
      const nextState: CreatorProjectStateSnapshot = {
        ...authority.state,
        publish: {
          ...authority.state.publish,
          finalVideoUrl: publicUrl,
          finalVideoSignature: decision.productionSignature,
          packageDownloaded: false,
          packageSignature: "",
        },
      };
      const recoveredResult = attachCreatorProjectState({
        ...previousResult,
        movieUrl: publicUrl,
        downloadUrl: publicUrl,
        fileName: `velto-recovered-${CREATOR_FINAL_VIDEO_RECOVERY_TARGET.fileName}`,
        sizeBytes: decision.sizeBytes,
        durationSeconds: decision.durationSeconds,
        sceneCount: decision.sceneCount,
        projectLifecycle: {
          ...previousLifecycle,
          status: "final_video_ready",
          artifactHistory: {
            ...previousHistory,
            hadFinalVideo: true,
            finalVideoSignature: decision.productionSignature,
            packageDownloaded: false,
            publishPackageSignature: "",
          },
        },
      }, nextState);
      const candidateProject = {
        ...project,
        exported_movie_url: publicUrl,
        exported_movie_result: recoveredResult,
        export_signature: decision.productionSignature,
      };
      const references = extractProjectMediaReferences(candidateProject).map((reference) => ({
        url: reference.url,
        reference_type: reference.referenceType,
        reference_key: reference.referenceKey,
      }));
      const { data: installed, error: installError } = await supabase.rpc(
        "velto_install_recovered_creator_final_video",
        {
          p_owner_user_id: principal.id,
          p_project_id: projectId,
          p_expected_updated_at: expectedUpdatedAt,
          p_public_url: publicUrl,
          p_exported_movie_result: recoveredResult,
          p_export_signature: decision.productionSignature,
          p_storage_bucket: decision.bucket,
          p_storage_path: decision.storagePath,
          p_size_bytes: decision.sizeBytes,
          p_references: references,
        },
      );
      if (installError) {
        throw new Error(installError.message || "RECOVERY_ATOMIC_INSTALL_FAILED");
      }
      const installedRecord = record(installed);
      if (installedRecord.status !== "recovered" && installedRecord.status !== "already_recovered") {
        throw new Error("RECOVERY_ATOMIC_INSTALL_FAILED");
      }
      recoveryStatus = installedRecord.status;
      savedProject = record(installedRecord.project) as VeltoProjectApiRecord;
      if (!savedProject.id || savedProject.id !== projectId) {
        throw new Error("RECOVERY_ATOMIC_INSTALL_FAILED");
      }
    }

    return json({
      ok: true,
      status: recoveryStatus,
      projectId,
      movieUrl: publicUrl,
      durationSeconds: decision.durationSeconds,
      sceneCount: decision.sceneCount,
      productionSignature: decision.productionSignature,
      projectUpdatedAt: savedProject.updated_at,
      humanReviewConfirmed: true,
    });
  } catch (error) {
    return recoveryError(error);
  }
}
