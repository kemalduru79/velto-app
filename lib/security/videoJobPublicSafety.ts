const CANONICAL_FAILURES = {
  VIDEO_GENERATION_FAILED: "Video production could not be completed.",
  VIDEO_OUTPUT_MISSING: "Video production completed without a usable output.",
  VIDEO_STATUS_TIMEOUT: "Video production did not complete in time.",
  VIDEO_STATUS_TEMPORARY_FAILURE: "Video production status is temporarily unavailable.",
  VIDEO_STATUS_REJECTED: "Video production status could not be retrieved.",
  INVALID_PAYLOAD: "Video production could not be completed.",
} as const;

export type CanonicalVideoFailureCode = keyof typeof CANONICAL_FAILURES;

export function canonicalVideoFailure(
  value: unknown,
): { failureCode: CanonicalVideoFailureCode; failureMessage: string } {
  const code =
    typeof value === "string" && value in CANONICAL_FAILURES
      ? (value as CanonicalVideoFailureCode)
      : "VIDEO_GENERATION_FAILED";
  return { failureCode: code, failureMessage: CANONICAL_FAILURES[code] };
}

export function canonicalProviderFailure() {
  return canonicalVideoFailure("VIDEO_GENERATION_FAILED");
}
