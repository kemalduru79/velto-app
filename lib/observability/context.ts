import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { ObservabilityContext } from "./types";

const storage = new AsyncLocalStorage<ObservabilityContext>();

function safeCorrelationId(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(trimmed) ? trimmed : null;
}

export function createRequestObservabilityContext(
  request: Request,
  route: string,
): ObservabilityContext {
  return {
    requestId: safeCorrelationId(request.headers.get("x-request-id")) || randomUUID(),
    traceId: safeCorrelationId(request.headers.get("x-trace-id")) || randomUUID(),
    route,
    method: request.method,
  };
}

export function getObservabilityContext() {
  return storage.getStore() || {};
}

export function runWithObservabilityContext<T>(
  context: ObservabilityContext,
  callback: () => T,
) {
  return storage.run(context, callback);
}

export function childObservabilityContext(
  additional: ObservabilityContext,
): ObservabilityContext {
  return {
    ...getObservabilityContext(),
    ...additional,
  };
}
