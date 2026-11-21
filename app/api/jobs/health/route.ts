import { withObservedApiRoute } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(req: NextRequest) {
  try {
    await authenticateRequest(req);
    const requestedStaleSeconds = Number(
      req.nextUrl.searchParams.get("workerStaleSeconds") || 90,
    );
    const workerStaleSeconds = Number.isFinite(requestedStaleSeconds)
      ? Math.max(15, Math.min(Math.round(requestedStaleSeconds), 3600))
      : 90;
    const queue = await getPersistenceServices().jobQueue.getHealth(
      workerStaleSeconds,
    );

    return NextResponse.json(
      {
        ok: queue.healthy,
        queue,
      },
      {
        status: queue.healthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
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

    console.error("queue health error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Queue health could not be read.",
      },
      { status: 500 },
    );
  }
}

export const GET = withObservedApiRoute("api.jobs.health", getHandler);
