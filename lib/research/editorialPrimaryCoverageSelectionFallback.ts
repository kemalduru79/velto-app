const RECOVERABLE_PRIMARY_COVERAGE_SELECTION_PREFIXES = [
  "EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID",
  "EDITORIAL_PRIMARY_COVERAGE_SELECTION_LIMIT_EXCEEDED",
  "EDITORIAL_PRIMARY_COVERAGE_TARGET_NOT_ALLOWED:",
  "EDITORIAL_PRIMARY_COVERAGE_SPAN_NOT_ALLOWED:",
  "EDITORIAL_PRIMARY_COVERAGE_TARGET_DUPLICATE:",
  "EDITORIAL_PRIMARY_COVERAGE_SOURCE_NOT_PRIMARY:",
] as const;

export function editorialPrimaryCoverageSelectionDiagnostic(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : "EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID";
}

export function isRecoverableEditorialPrimaryCoverageSelectionError(
  error: unknown,
) {
  const diagnostic = editorialPrimaryCoverageSelectionDiagnostic(error);
  return RECOVERABLE_PRIMARY_COVERAGE_SELECTION_PREFIXES.some((prefix) =>
    diagnostic.startsWith(prefix)
  );
}
