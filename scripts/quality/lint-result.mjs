import path from "node:path";

// Fixed gate budgets, never product/provider duration limits. No retry or skip.
export const LINT_TIMEOUT_MS = 120_000;
export const LINT_HEAP_MIB = 1536;
export const LINT_MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export function validateLintProcessResult(result, file) {
  const fail = (code) => ({ ok: false, code });
  if (result.error || result.signal || result.killed || result.status !== 0) {
    const reason = result.error?.code === "ETIMEDOUT" ? "timeout"
      : /heap out of memory|allocation failed/i.test(result.stderr || "") ? "heap-exhausted"
      : result.signal ? "signal" : result.error ? "process-error" : "nonzero-exit";
    return { ...fail("ESLINT_PROCESS_FAILED"), reason };
  }
  let reports;
  try { reports = JSON.parse(result.stdout); }
  catch { return fail("ESLINT_REPORT_INVALID"); }
  if (!Array.isArray(reports) || reports.length !== 1) return fail("ESLINT_REPORT_MISSING");
  const report = reports[0];
  if (!report || typeof report !== "object" || report.filePath !== path.resolve(file) ||
      !Array.isArray(report.messages) || !Number.isInteger(report.errorCount) ||
      !Number.isInteger(report.warningCount) || report.errorCount < 0 || report.warningCount < 0 ||
      !Number.isInteger(report.fatalErrorCount) || report.fatalErrorCount !== 0) {
    return fail("ESLINT_REPORT_INVALID");
  }
  if (report.messages.some((message) => !message || typeof message !== "object" ||
      ![1, 2].includes(message.severity) || typeof message.message !== "string" ||
      message.fatal || (message.ruleId === null && /ignored|no matching configuration/i.test(message.message)))) {
    return fail("ESLINT_REPORT_UNCHECKED_OR_FATAL");
  }
  if (report.errorCount !== report.messages.filter((message) => message.severity === 2).length ||
      report.warningCount !== report.messages.filter((message) => message.severity === 1).length ||
      report.errorCount !== 0) return fail("ESLINT_REPORT_ERRORS");
  return { ok: true, reports };
}
