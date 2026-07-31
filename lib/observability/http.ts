import { performance } from "node:perf_hooks";
import {
  createRequestObservabilityContext,
  runWithObservabilityContext,
} from "./context";
import { createLogger } from "./logger";
import { incrementCounter, observeHistogram } from "./metrics";

function statusClass(status: number) {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "other";
}

export function withObservedApiRoute<
  T extends (...args: any[]) => Promise<Response> | Response,
>(route: string, handler: T): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as Request;
    const context = createRequestObservabilityContext(request, route);

    return runWithObservabilityContext(context, async () => {
      const started = performance.now();
      const logger = createLogger();

      try {
        const response = await handler(...args);
        const durationMs = performance.now() - started;
        const labels = {
          route,
          method: request.method,
          statusClass: statusClass(response.status),
        };
        incrementCounter("velto_http_requests_total", 1, labels);
        observeHistogram("velto_http_request_duration_ms", durationMs, labels);
        response.headers.set("x-request-id", context.requestId || "");
        response.headers.set("x-trace-id", context.traceId || "");
        logger.info("API request completed.", {
          status: response.status,
          durationMs: Math.round(durationMs),
        });
        return response;
      } catch (error) {
        const durationMs = performance.now() - started;
        const labels = {
          route,
          method: request.method,
          statusClass: "5xx",
        };
        incrementCounter("velto_http_requests_total", 1, labels);
        observeHistogram("velto_http_request_duration_ms", durationMs, labels);
        logger.error("API request failed.", error, {
          status: 500,
          durationMs: Math.round(durationMs),
        });
        throw error;
      }
    });
  }) as T;
}
