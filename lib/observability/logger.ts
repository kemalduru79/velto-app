import { randomUUID } from "node:crypto";
import { getObservabilityContext } from "./context";
import { getObservabilityExporter } from "./exporters";
import {
  redactObservabilityValue,
  serializeObservabilityError,
} from "./redaction";
import type {
  ObservabilityContext,
  ObservabilityLogLevel,
  ObservabilityMetadata,
} from "./types";
import { resolveRuntimeRelease } from "../runtime/releaseIdentity";

const RELEASE = resolveRuntimeRelease();
const SERVICE = process.env.VELTO_SERVICE_NAME || "velto-web";

export type StructuredLogger = ReturnType<typeof createLogger>;

export function createLogger(baseContext: ObservabilityContext = {}) {
  const emit = (
    level: ObservabilityLogLevel,
    message: string,
    metadata: ObservabilityMetadata = {},
  ) => {
    const record = redactObservabilityValue({
      type: "velto_log",
      version: 1,
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE,
      release: RELEASE,
      message,
      ...getObservabilityContext(),
      ...baseContext,
      ...metadata,
    }) as ObservabilityMetadata;

    void getObservabilityExporter().export(record);
  };

  return {
    debug: (message: string, metadata?: ObservabilityMetadata) =>
      emit("debug", message, metadata),
    info: (message: string, metadata?: ObservabilityMetadata) =>
      emit("info", message, metadata),
    warn: (message: string, metadata?: ObservabilityMetadata) =>
      emit("warn", message, metadata),
    error: (
      message: string,
      error?: unknown,
      metadata: ObservabilityMetadata = {},
    ) =>
      emit("error", message, {
        ...metadata,
        ...(error === undefined ? {} : { error: serializeObservabilityError(error) }),
      }),
    child: (context: ObservabilityContext) =>
      createLogger({ ...baseContext, ...context }),
  };
}

export function createTraceIdentifiers() {
  return {
    traceId: randomUUID(),
    spanId: randomUUID().replaceAll("-", "").slice(0, 16),
  };
}
