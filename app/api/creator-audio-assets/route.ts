import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { CreatorAudioAssetError, createCreatorAudioFinalizeResponse, createCreatorAudioUploadIntent, finalizeCreatorAudioUpload, resolveCreatorAudioAssetBucket } from "@/lib/creator/audioAssets";
import { probeCreatorAudioBytes } from "@/lib/creator/audioProbe.server";
import { authorizeCreatorAudioAssetRequest } from "@/lib/creator/audioAssetResolver.server";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { resolveServerSupabaseEnvironment } from "@/lib/supabase/server";

export const runtime = "nodejs";
const PRIVATE = { "Cache-Control": "private, no-store, max-age=0" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE });

export async function POST(request: Request) {
  try {
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return json({ ok: false, code: "unsupported_content_type", error: "Audio upload requests must use JSON." }, 415);
    }
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).some((key) => !["action", "projectId", "originalFilename", "mediaKind", "mimeType", "sizeBytes", "creatorAttested", "intentToken"].includes(key))) {
      return json({ ok: false, code: "invalid_upload", error: "Audio upload request is invalid." }, 400);
    }
    const secret = resolveServerSupabaseEnvironment().serviceRoleKey;
    if (!secret) return json({ ok: false, code: "upload_unavailable", error: "Secure audio upload is unavailable." }, 503);
    const services = getPersistenceServices();
    const authority = await authorizeCreatorAudioAssetRequest({ action: body.action, projectId: body.projectId, intentToken: body.intentToken, secret }, {
      authenticate: () => authenticateRequest(request), projectRepository: services.projectRepository,
    });
    const principalId = authority.ownerUserId;
    const projectId = authority.projectId;

    if (body.action === "initiate") {
      const intent = createCreatorAudioUploadIntent({
        ownerUserId: principalId, projectId, privateBucket: resolveCreatorAudioAssetBucket(),
        originalFilename: body.originalFilename, mediaKind: body.mediaKind, mimeType: body.mimeType,
        sizeBytes: body.sizeBytes, creatorAttested: body.creatorAttested,
      }, secret);
      const target = await services.objectStorage.createSignedPublicUpload({ bucket: intent.payload.bucket, path: intent.payload.path });
      return json({ ok: true, upload: { bucket: target.bucket, path: target.path, token: target.token, intentToken: intent.intentToken } });
    }

    if (body.action === "finalize" && typeof body.intentToken === "string") {
      const result = await finalizeCreatorAudioUpload({ intentToken: body.intentToken, ownerUserId: principalId, secret }, {
        stat: (location) => services.objectStorage.stat(location),
        download: (location) => services.objectStorage.downloadPublic(location),
        remove: (location) => services.objectStorage.removeObject(location),
        reportCleanupFailure: (context) => console.error("CREATOR_AUDIO_ASSET_CLEANUP_RECOVERY_REQUIRED", context),
        probe: probeCreatorAudioBytes,
        findExisting: (ownerUserId, bucket, path) => services.mediaAssetRepository.findByStorageObject(ownerUserId, bucket, path),
        register: (input) => registerStoredAssetOrThrow({
          repository: services.mediaAssetRepository, ownerUserId: input.ownerUserId, bucket: input.bucket,
          storagePath: input.path, publicUrl: null, mediaKind: "music", mimeType: input.mimeType,
          sizeBytes: input.sizeBytes, metadata: input.metadata, generated: false,
        }),
      });
      return json(createCreatorAudioFinalizeResponse(result));
    }
    return json({ ok: false, code: "invalid_upload", error: "Audio upload request is invalid." }, 400);
  } catch (error) {
    if (error instanceof AuthenticationError) return json({ ok: false, code: "authentication_required", error: "A valid session is required." }, 401);
    if (error instanceof CreatorAudioAssetError) {
      const status = error.code === "intent_expired" ? 410 : error.code === "upload_missing" ? 409 : error.code === "registration_failed" ? 500 : 400;
      return json({ ok: false, code: error.code, error: error.message }, status);
    }
    console.error("CREATOR_AUDIO_ASSET_UPLOAD_FAILED", { error: error instanceof Error ? error.message : "unknown" });
    return json({ ok: false, code: "upload_failed", error: "The audio asset could not be uploaded." }, 500);
  }
}
