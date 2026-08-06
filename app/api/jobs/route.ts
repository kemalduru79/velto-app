import {
  createLogger,
  getObservabilityContext,
  withObservedApiRoute,
} from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import type {
  VeltoJobRecord,
} from "@/lib/persistence/jobs";
import {
  parseBoundedJobRequestJson,
  validateJobProjectPolicy,
} from "@/lib/security/jobProjectOwnershipBoundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

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

  createLogger({ operation: "jobs.api" }).error(
    "Jobs API request failed.",
    error,
  );

  return NextResponse.json(
    {
      ok: false,
      error: "Job request failed.",
    },
    { status: 500 },
  );
}

async function postHandler(req: NextRequest) {
  try {
    const principal = await authenticateRequest(req);
    const parsed = await parseBoundedJobRequestJson(req);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.message },
        { status: parsed.status, headers: NO_STORE_HEADERS },
      );
    }
    const { body } = parsed;
    const policy = validateJobProjectPolicy(body);
    if (!policy.ok) {
      return NextResponse.json(
        { ok: false, error: policy.message },
        { status: policy.status, headers: NO_STORE_HEADERS },
      );
    }
    const { jobType } = policy;

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
        { status: 400, headers: NO_STORE_HEADERS },
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

    const services = getPersistenceServices();
    let canonicalProjectId: string | null = null;
    if (jobType === "video_reconcile") {
      const ownedProject = await services.projectRepository.getForOwner(
        policy.projectId,
        principal.id,
      );
      if (!ownedProject) {
        return NextResponse.json(
          { ok: false, error: "Project was not found." },
          { status: 404, headers: NO_STORE_HEADERS },
        );
      }
      canonicalProjectId = ownedProject.id;
    }

    const job = await services.jobQueue.enqueue({
      userId: principal.id,
      projectId: canonicalProjectId,
      jobType,
      payload: {
        ...payload,
        traceId: getObservabilityContext().traceId || null,
      },
      priority,
      maxAttempts,
      idempotencyKey,
    });

    return NextResponse.json(
      { ok: true, job: publicJob(job) },
      {
        status: job.status === "succeeded" ? 200 : 202,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function getHandler(req: NextRequest) {
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

export const POST = withObservedApiRoute("api.jobs.enqueue", postHandler);
export const GET = withObservedApiRoute("api.jobs.list", getHandler);
