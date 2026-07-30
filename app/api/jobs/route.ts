import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import type {
  VeltoJobRecord,
  VeltoJobType,
} from "@/lib/persistence/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_JOB_TYPES = new Set<VeltoJobType>([
  "runtime_probe",
  "video_reconcile",
]);

function publicJob(job: VeltoJobRecord) {
  return {
    id: job.id,
    projectId: job.projectId,
    jobType: job.jobType,
    status: job.status,
    result: job.result,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 },
    );
  }

  console.error("jobs api error:", error);

  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Job request failed.",
    },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const principal = await authenticateRequest(req);
    const body = (await req.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const jobType = body?.jobType as VeltoJobType;

    if (!SUPPORTED_JOB_TYPES.has(jobType)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported job type." },
        { status: 400 },
      );
    }

    const payload =
      body?.payload &&
      typeof body.payload === "object" &&
      !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};

    if (
      jobType === "video_reconcile" &&
      (typeof payload.taskId !== "string" || !payload.taskId.trim())
    ) {
      return NextResponse.json(
        { ok: false, error: "video_reconcile requires payload.taskId." },
        { status: 400 },
      );
    }

    const idempotencyKey =
      req.headers.get("x-idempotency-key")?.trim() ||
      (typeof body?.idempotencyKey === "string"
        ? body.idempotencyKey.trim()
        : "") ||
      null;
    const priority = Math.max(
      0,
      Math.min(Number(body?.priority ?? 100) || 100, 1000),
    );
    const requestedMaxAttempts = Number(
      body?.maxAttempts ?? (jobType === "video_reconcile" ? 120 : 5),
    );
    const maxAttempts = Math.max(
      1,
      Math.min(
        Number.isFinite(requestedMaxAttempts)
          ? Math.round(requestedMaxAttempts)
          : 5,
        120,
      ),
    );

    const job = await getPersistenceServices().jobQueue.enqueue({
      userId: principal.id,
      projectId:
        typeof body?.projectId === "string" ? body.projectId.trim() : null,
      jobType,
      payload,
      priority,
      maxAttempts,
      idempotencyKey,
    });

    return NextResponse.json(
      { ok: true, job: publicJob(job) },
      {
        status: job.status === "succeeded" ? 200 : 202,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const principal = await authenticateRequest(req);
    const requestedLimit = Number(req.nextUrl.searchParams.get("limit") || 20);
    const jobs = await getPersistenceServices().jobQueue.listForUser(
      principal.id,
      requestedLimit,
    );

    return NextResponse.json(
      {
        ok: true,
        jobs: jobs.map(publicJob),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
