import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const principal = await authenticateRequest(req);
    const { jobId } = await context.params;
    const job = await getPersistenceServices().jobQueue.getForUser(
      jobId,
      principal.id,
    );

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        job: {
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
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 401 },
      );
    }

    console.error("job status api error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Job status request failed.",
      },
      { status: 500 },
    );
  }
}
