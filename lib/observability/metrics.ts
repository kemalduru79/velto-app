import type { MetricLabels, MetricSnapshot } from "./types";

const STORE_KEY = "__veltoObservabilityMetricsV1";

type CounterState = { labels: Record<string, string>; value: number };
type GaugeState = { labels: Record<string, string>; value: number };
type HistogramState = {
  labels: Record<string, string>;
  count: number;
  sum: number;
  min: number;
  max: number;
};

type MetricStore = {
  counters: Map<string, CounterState>;
  gauges: Map<string, GaugeState>;
  histograms: Map<string, HistogramState>;
};

type GlobalWithMetricStore = typeof globalThis & {
  __veltoObservabilityMetricsV1?: MetricStore;
};

function store() {
  const target = globalThis as GlobalWithMetricStore;
  target[STORE_KEY] ||= {
    counters: new Map(),
    gauges: new Map(),
    histograms: new Map(),
  };
  return target[STORE_KEY];
}

function normalizeLabels(labels: MetricLabels = {}) {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value).slice(0, 80)])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function metricKey(name: string, labels: Record<string, string>) {
  return `${name}|${JSON.stringify(labels)}`;
}

export function incrementCounter(
  name: string,
  value = 1,
  labels: MetricLabels = {},
) {
  if (!Number.isFinite(value)) return;
  const normalized = normalizeLabels(labels);
  const key = metricKey(name, normalized);
  const current = store().counters.get(key) || { labels: normalized, value: 0 };
  current.value += value;
  store().counters.set(key, current);
}

export function setGauge(
  name: string,
  value: number,
  labels: MetricLabels = {},
) {
  if (!Number.isFinite(value)) return;
  const normalized = normalizeLabels(labels);
  store().gauges.set(metricKey(name, normalized), {
    labels: normalized,
    value,
  });
}

export function observeHistogram(
  name: string,
  value: number,
  labels: MetricLabels = {},
) {
  if (!Number.isFinite(value)) return;
  const normalized = normalizeLabels(labels);
  const key = metricKey(name, normalized);
  const current = store().histograms.get(key) || {
    labels: normalized,
    count: 0,
    sum: 0,
    min: value,
    max: value,
  };
  current.count += 1;
  current.sum += value;
  current.min = Math.min(current.min, value);
  current.max = Math.max(current.max, value);
  store().histograms.set(key, current);
}

export function getMetricSnapshot(): MetricSnapshot {
  const current = store();
  return {
    counters: Array.from(current.counters.entries()).map(([key, metric]) => ({
      name: key.split("|", 1)[0],
      labels: metric.labels,
      value: metric.value,
    })),
    gauges: Array.from(current.gauges.entries()).map(([key, metric]) => ({
      name: key.split("|", 1)[0],
      labels: metric.labels,
      value: metric.value,
    })),
    histograms: Array.from(current.histograms.entries()).map(
      ([key, metric]) => ({
        name: key.split("|", 1)[0],
        labels: metric.labels,
        count: metric.count,
        sum: metric.sum,
        min: metric.min,
        max: metric.max,
        average: metric.count > 0 ? metric.sum / metric.count : 0,
      }),
    ),
  };
}
