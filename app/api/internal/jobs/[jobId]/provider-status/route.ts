import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersistenceServices } from "@/lib/persistence";
import { getVideoProvider } from "@/lib/video/providers";
import {
  isValidQueueJobId,
  validatePersistedVideoJobBinding,
} from "@/lib/security/persistedVideoJobBinding";
import { canonicalProviderFailure } from "@/lib/security/videoJobPublicSafety";
import { calculateVeoCost, persistEconomicOperationBestEffort } from "@/lib/economics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function tokenMatches(req: NextRequest) {
  const expected = process.env.VELTO_INTERNAL_WORKER_TOKEN;
  const authorization = req.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!expected || !supplied) return false;
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

function canonicalProviderStatus(value: unknown) {
  const status = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (["SUCCEEDED", "COMPLETED", "READY"].includes(status)) return "SUCCEEDED";
  if (["FAILED", "ERROR"].includes(status)) return "FAILED";
  if (["CANCELLED", "CANCELED"].includes(status)) return "CANCELLED";
  if (["RUNNING", "PROCESSING", "IN_PROGRESS"].includes(status)) return "RUNNING";
  return "PENDING";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!tokenMatches(req)) {
    return json({ ok: false, error: "Internal worker authentication failed." }, 401);
  }

  const { jobId } = await context.params;
  if (!isValidQueueJobId(jobId)) {
    return json({ ok: false, error: "Job identifier is invalid." }, 400);
  }
  if (
    req.nextUrl.search ||
    Number(req.headers.get("content-length") || 0) > 0 ||
    ["x-task-id", "x-native-task-id", "x-provider", "x-provider-url"].some(
      (name) => req.headers.has(name),
    )
  ) {
    return json({ ok: false, error: "Provider task input is not accepted." }, 400);
  }

  try {
    const job = await getPersistenceServices().jobQueue.getInternal(jobId);
    if (!job) return json({ ok: false, error: "Job was not found." }, 404);
    const binding = validatePersistedVideoJobBinding(job);
    if (!binding) {
      return json({ ok: false, error: "The persisted video job binding is invalid." }, 409);
    }
    const task = await getVideoProvider(binding.provider).retrieveTask(
      binding.nativeTaskId,
    );
    const status = canonicalProviderStatus(task.status);
    const runtimeProfile = job.payload.runtimeProfile && typeof job.payload.runtimeProfile === "object" ? job.payload.runtimeProfile as Record<string, unknown> : {};
    if (status === "SUCCEEDED" && binding.provider === "veo" && typeof runtimeProfile.economicAttemptKey === "string" && typeof runtimeProfile.logicalOperationId === "string") {
      const model = String(runtimeProfile.model || "");
      const resolution = String(runtimeProfile.resolution || "1080p");
      const billedSeconds = Number(runtimeProfile.providerBilledDurationSec) || 8;
      await persistEconomicOperationBestEffort({
        attemptKey: runtimeProfile.economicAttemptKey,
        logicalOperationId: runtimeProfile.logicalOperationId,
        creditReservationId: typeof runtimeProfile.creditReservationId === "string" ? runtimeProfile.creditReservationId : null,
        userId: job.userId,
        projectId: job.projectId,
        sceneId: job.payload.sceneId == null ? null : String(job.payload.sceneId),
        route: "/api/creator-video",
        operationType: "creator_video",
        productTier: String(job.payload.qualityMode || "cinematic"),
        provider: "veo",
        providerTier: "premium",
        model,
        providerRequestId: binding.nativeTaskId,
        state: "provider_billed",
        billingMoment: "successful_generation",
        fallbackAttempt: runtimeProfile.fallbackAttempt === true,
        quantities: { profileKey: String(runtimeProfile.profileKey || "legacy"), requestedSeconds: Number(runtimeProfile.requestedDurationSec) || 0, providerBilledSeconds: billedSeconds, resolution, audioMode: String(runtimeProfile.audioMode || "generated_audio"), requestCount: 1 },
        cost: calculateVeoCost(model, resolution, billedSeconds),
        dispatchedAt: typeof runtimeProfile.dispatchedAt === "string" ? runtimeProfile.dispatchedAt : null,
        providerAcceptedAt: typeof runtimeProfile.providerAcceptedAt === "string" ? runtimeProfile.providerAcceptedAt : null,
        completedAt: new Date().toISOString(),
        reconciledAt: new Date().toISOString(),
      });
    }
    const failed = status === "FAILED" || status === "CANCELLED";
    const failure = failed ? canonicalProviderFailure() : null;
    return json({
      ok: true,
      status,
      outputReady: status === "SUCCEEDED" && Boolean(task.videoUrl),
      failureCode: failure?.failureCode || null,
      failureMessage: failure?.failureMessage || null,
    });
  } catch {
    console.error("internal provider status route failed");
    return json({ ok: false, error: "Internal provider status request failed." }, 500);
  }
}
