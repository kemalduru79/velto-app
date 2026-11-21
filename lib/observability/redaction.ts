const SENSITIVE_KEY = /(?:authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key|service[-_]?role|private[-_]?key|client[-_]?secret|access[-_]?key|refresh[-_]?token|base64|audio|image[-_]?data|prompt|script|transcript|content)/i;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const LIKELY_SECRET = /\b(?:sk|rk|pk|key)-[A-Za-z0-9_-]{16,}\b/g;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 5;

function redactString(value: string) {
  const cleaned = value
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(LIKELY_SECRET, "[REDACTED]");

  if (cleaned.length <= MAX_STRING_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_STRING_LENGTH)}…[truncated]`;
}

export function serializeObservabilityError(error: unknown) {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: unknown; status?: unknown };
    return {
      name: error.name,
      message: redactString(error.message || "Unknown error."),
      code:
        typeof withCode.code === "string" || typeof withCode.code === "number"
          ? String(withCode.code)
          : undefined,
      status:
        typeof withCode.status === "string" || typeof withCode.status === "number"
          ? String(withCode.status)
          : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: redactString(String(error || "Unknown error.")),
  };
}

export function redactObservabilityValue(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) return serializeObservabilityError(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => redactObservabilityValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : redactObservabilityValue(nested, depth + 1);
    }
    return output;
  }
  return redactString(String(value));
}
