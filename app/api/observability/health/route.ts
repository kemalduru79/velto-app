import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import {
  createLogger,
  getMetricSnapshot,
  setGauge,
  withObservedApiRoute,
} from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchesOperationalToken(request: NextRequest) {
  const configured = process.env.VELTO_OBSERVABILITY_TOKEN?.trim();
  if (!configured) return false;
  const supplied = request.headers.get("x-velto-observability-token")?.trim() || "";
  const configuredBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    configuredBytes.length === suppliedBytes.length &&
    timingSafeEqual(configuredBytes, suppliedBytes)
  );
}

async function authorize(request: NextRequest) {
  if (matchesOperationalToken(request)) return;
  await authenticateRequest(request);
}

async function getHandler(request: NextRequest) {
  const logger = createLogger({ operation: "observability.health" });

  try {
    await authorize(request);
    const workerStaleSeconds = 90;
    const queue = await getPersistenceServices().jobQueue.getHealth(
      workerStaleSeconds,
    );

    setGauge("velto_queue_backlog", queue.queued, { state: "queued" });
    setGauge("velto_queue_backlog", queue.running, { state: "running" });
    setGauge("velto_workers_active", queue.activeWorkers);

    const body = {
      ok: queue.healthy,
      service: process.env.VELTO_SERVICE_NAME || "velto-web",
      release:
        process.env.VELTO_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "local",
      generatedAt: new Date().toISOString(),
      runtime: {
        node: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      queue: {
        healthy: queue.healthy,
        queued: queue.queued,
        running: queue.running,
        succeededLastHour: queue.succeededLastHour,
        failedLastHour: queue.failedLastHour,
        cancelledLastHour: queue.cancelledLastHour,
        oldestQueuedSeconds: queue.oldestQueuedSeconds,
        expiredLeases: queue.expiredLeases,
        activeWorkers: queue.activeWorkers,
        staleWorkers: queue.staleWorkers,
      },
      metrics: getMetricSnapshot(),
      notes: {
        scope: "Process-local web metrics plus durable queue health.",
        exporter:
          process.env.VELTO_OBSERVABILITY_EXPORTER === "none"
            ? "none"
            : "console-json",
      },
    };

    return NextResponse.json(body, {
      status: queue.healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 401 },
      );
    }

    logger.error("Observability health could not be read.", error);
    return NextResponse.json(
      { ok: false, error: "Observability health could not be read." },
      { status: 500 },
    );
  }
}

export const GET = withObservedApiRoute(
  "api.observability.health",
  getHandler,
);
