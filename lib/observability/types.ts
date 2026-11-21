export type ObservabilityLogLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityContext = {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  route?: string;
  method?: string;
  jobId?: string;
  operation?: string;
};

export type ObservabilityMetadata = Record<string, unknown>;

export type MetricLabels = Record<string, string | number | boolean | null | undefined>;

export type MetricSnapshot = {
  counters: Array<{
    name: string;
    labels: Record<string, string>;
    value: number;
  }>;
  gauges: Array<{
    name: string;
    labels: Record<string, string>;
    value: number;
  }>;
  histograms: Array<{
    name: string;
    labels: Record<string, string>;
    count: number;
    sum: number;
    min: number;
    max: number;
    average: number;
  }>;
};
