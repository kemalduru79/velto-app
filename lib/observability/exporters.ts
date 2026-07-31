import type { ObservabilityMetadata } from "./types";

export interface ObservabilityExporter {
  export(record: ObservabilityMetadata): void | Promise<void>;
}

class ConsoleJsonExporter implements ObservabilityExporter {
  export(record: ObservabilityMetadata) {
    const serialized = JSON.stringify(record);
    const level = String(record.level || "info");

    if (level === "error") console.error(serialized);
    else if (level === "warn") console.warn(serialized);
    else console.log(serialized);
  }
}

class NoopExporter implements ObservabilityExporter {
  export() {}
}

let customExporter: ObservabilityExporter | null = null;

export function setObservabilityExporter(exporter: ObservabilityExporter | null) {
  customExporter = exporter;
}

export function getObservabilityExporter(): ObservabilityExporter {
  if (customExporter) return customExporter;
  return process.env.VELTO_OBSERVABILITY_EXPORTER === "none"
    ? new NoopExporter()
    : new ConsoleJsonExporter();
}
