import { performance } from "node:perf_hooks";
import { createTraceIdentifiers } from "./logger";
import { getObservabilityContext } from "./context";
import { createLogger } from "./logger";
import { incrementCounter, observeHistogram } from "./metrics";
import { serializeObservabilityError } from "./redaction";
import type { ObservabilityMetadata } from "./types";

function errorClass(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") {
      return String(code).slice(0, 80);
    }
  }
  return error instanceof Error ? error.name : "UnknownError";
}

export async function observeProviderCall<T>(
  input: {
    mediaType: "image" | "voice" | "video";
    providerTier: "primary" | "premium";
    operation: string;
    metadata?: ObservabilityMetadata;
  },
  callback: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const parent = getObservabilityContext();
  const identifiers = createTraceIdentifiers();
  const logger = createLogger({
    ...parent,
    traceId: parent.traceId || identifiers.traceId,
    spanId: identifiers.spanId,
    operation: `provider.${input.mediaType}.${input.operation}`,
  });
  const labels = {
    mediaType: input.mediaType,
    providerTier: input.providerTier,
    operation: input.operation,
  };

  incrementCounter("velto_provider_calls_total", 1, { ...labels, outcome: "started" });

  try {
    const result = await callback();
    const durationMs = performance.now() - started;
    incrementCounter("velto_provider_calls_total", 1, {
      ...labels,
      outcome: "success",
    });
    observeHistogram("velto_provider_duration_ms", durationMs, labels);
    logger.info("Provider call completed.", {
      durationMs: Math.round(durationMs),
      ...input.metadata,
    });
    return result;
  } catch (error) {
    const durationMs = performance.now() - started;
    incrementCounter("velto_provider_calls_total", 1, {
      ...labels,
      outcome: "error",
      errorClass: errorClass(error),
    });
    observeHistogram("velto_provider_duration_ms", durationMs, labels);
    logger.error("Provider call failed.", error, {
      durationMs: Math.round(durationMs),
      errorClass: errorClass(error),
      ...input.metadata,
    });
    throw error;
  }
}

export async function observeCreditMutation<T>(
  phase: "reserve" | "dispatch" | "settle" | "release",
  operationType: string,
  callback: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const labels = { phase, operationType: operationType.slice(0, 80) };
  const logger = createLogger({ operation: `credit.${phase}` });

  try {
    const result = await callback();
    const durationMs = performance.now() - started;
    incrementCounter("velto_credit_mutations_total", 1, {
      ...labels,
      outcome: "success",
    });
    observeHistogram("velto_credit_mutation_duration_ms", durationMs, labels);
    logger.info("Credit mutation completed.", {
      phase,
      operationType,
      durationMs: Math.round(durationMs),
    });
    return result;
  } catch (error) {
    const durationMs = performance.now() - started;
    incrementCounter("velto_credit_mutations_total", 1, {
      ...labels,
      outcome: "error",
      errorClass: errorClass(error),
    });
    observeHistogram("velto_credit_mutation_duration_ms", durationMs, labels);
    logger.error("Credit mutation failed.", error, {
      phase,
      operationType,
      durationMs: Math.round(durationMs),
      errorClass: errorClass(error),
      error: serializeObservabilityError(error),
    });
    throw error;
  }
}
