export type ProviderErrorCode =
  | "not_configured"
  | "authentication"
  | "quota"
  | "rate_limit"
  | "timeout"
  | "invalid_request"
  | "upstream"
  | "unknown";

export type ProviderErrorOptions = {
  code: ProviderErrorCode;
  retryable: boolean;
  status?: number;
  requestId?: string;
  cause?: unknown;
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly requestId?: string;
  override readonly cause?: unknown;

  constructor(message: string, options: ProviderErrorOptions) {
    super(message);
    this.name = "ProviderError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.status = options.status;
    this.requestId = options.requestId;
    this.cause = options.cause;
  }
}

function normalizeMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value || "");
}

export function classifyProviderError(
  error: unknown,
  fallbackMessage: string,
): ProviderError {
  if (error instanceof ProviderError) return error;

  const message = normalizeMessage(error);
  const normalized = message.toLowerCase();

  if (/abort|timeout|timed out/.test(normalized)) {
    return new ProviderError(fallbackMessage, {
      code: "timeout",
      retryable: true,
      cause: error,
    });
  }

  if (/429|rate limit|too many requests/.test(normalized)) {
    return new ProviderError(fallbackMessage, {
      code: "rate_limit",
      retryable: true,
      cause: error,
    });
  }

  if (/401|403|unauthorized|forbidden|api key|authentication/.test(normalized)) {
    return new ProviderError(fallbackMessage, {
      code: "authentication",
      retryable: false,
      cause: error,
    });
  }

  if (/402|billing|credit|quota|insufficient/.test(normalized)) {
    return new ProviderError(fallbackMessage, {
      code: "quota",
      retryable: false,
      cause: error,
    });
  }

  if (/400|invalid|unsupported|bad request/.test(normalized)) {
    return new ProviderError(fallbackMessage, {
      code: "invalid_request",
      retryable: false,
      cause: error,
    });
  }

  return new ProviderError(fallbackMessage, {
    code: "unknown",
    retryable: false,
    cause: error,
  });
}

export function getProviderPublicMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (!(error instanceof ProviderError)) return fallbackMessage;

  if (error.code === "timeout" || error.code === "rate_limit") {
    return "Üretim servisi şu anda yoğun veya geç yanıt veriyor. Lütfen işlemi tekrar deneyin.";
  }

  if (error.code === "quota") {
    return "Üretim servisi için kullanılabilir kapasite şu anda yetersiz.";
  }

  if (error.code === "not_configured" || error.code === "authentication") {
    return "Üretim servisi yapılandırması tamamlanamadı.";
  }

  if (error.code === "invalid_request") {
    return "Seçilen üretim ayarları aktif servis tarafından kabul edilmedi.";
  }

  return fallbackMessage;
}
