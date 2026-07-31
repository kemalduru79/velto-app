import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requireText = (file, needles) => {
  const content = read(file);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${file} is missing OBS-P1 marker: ${needle}`);
    }
  }
};

requireText("lib/observability/index.ts", [
  "VELTO_OBS_P1",
  "./http",
  "./metrics",
  "./operations",
]);
requireText("lib/observability/redaction.ts", [
  "SENSITIVE_KEY",
  "Bearer [REDACTED]",
  "serializeObservabilityError",
]);
requireText("lib/observability/metrics.ts", [
  "veltoObservabilityMetricsV1",
  "incrementCounter",
  "observeHistogram",
  "getMetricSnapshot",
]);
requireText("app/api/observability/health/route.ts", [
  "VELTO_OBSERVABILITY_TOKEN",
  "getMetricSnapshot",
  "velto_queue_backlog",
  "withObservedApiRoute",
]);
requireText("lib/providers/image/index.ts", ["observeProviderCall", "mediaType: \"image\""]);
requireText("lib/providers/voice/index.ts", ["observeProviderCall", "mediaType: \"voice\""]);
requireText("lib/video/providers/providerRegistry.ts", ["createObservedVideoProvider", "mediaType: \"video\""]);
requireText("lib/credits/serverMetering.ts", ["observeCreditMutation", "credit.release"]);
requireText("scripts/scale-worker.mjs", [
  "velto_metric",
  "velto_worker_job_duration_ms",
  "activeTraceId",
  "Bearer [REDACTED]",
]);
requireText("app/api/creator-video/route.ts", [
  "getObservabilityContext",
  "traceId:",
  "api.creator-video.create",
]);
requireText("app/api/jobs/route.ts", [
  "api.jobs.enqueue",
  "getObservabilityContext",
]);

const packageJson = JSON.parse(read("package.json"));
if (!packageJson.scripts?.["test:obs-p1"]) {
  throw new Error("package.json is missing test:obs-p1.");
}

console.log("OBS-P1 static verification passed.");
