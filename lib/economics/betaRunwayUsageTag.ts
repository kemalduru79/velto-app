/**
 * Runway usage attribution, not billing authorization.
 * Keep raw owner IDs and client-supplied IDs out of provider tags.
 */

export function betaRunwayUsageTagForAttempt(
  attemptKey: string | null | undefined,
): string | undefined {
  const match = /^video:([a-f0-9]{64})$/.exec(attemptKey ?? "");
  if (!match) return undefined;

  // Runway permits 64 characters per tag.
  // 56 hex characters retain 224 bits of the canonical digest.
  return `attempt:${match[1].slice(0, 56)}`;
}

export function runwayTaggedRequestOptions(
  usageTag: string | undefined,
) {
  if (usageTag === undefined) {
    return { maxRetries: 0 };
  }

  if (!/^attempt:[a-f0-9]{56}$/.test(usageTag)) {
    throw new Error("INVALID_RUNWAY_USAGE_TAG");
  }

  return {
    maxRetries: 0,
    headers: { "X-Runway-Tags": usageTag },
  };
}

/**
 * Read-only usage reconciliation.
 *
 * Runway tag totals are aggregated by day and may arrive late.
 * These functions must never authorize settlement, release,
 * reservation or paid dispatch.
 */

const DAY_MS = 86_400_000;

function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value
  ) return null;
  return parsed;
}

export function buildBetaRunwayUsageQuery(
  attemptKey: string,
  startDate: string,
  beforeDate: string,
) {
  const tag = betaRunwayUsageTagForAttempt(attemptKey);
  const start = utcDay(startDate);
  const end = utcDay(beforeDate);

  if (
    !tag ||
    start === null ||
    end === null ||
    end <= start ||
    end - start > 90 * DAY_MS
  ) {
    return {
      state: "BLOCKED" as const,
      reason: "INVALID_USAGE_QUERY",
      dispatchAuthorized: false as const,
    };
  }

  return {
    state: "READ_ONLY_QUERY" as const,
    endpoint: "/v1/organization/usage",
    method: "POST" as const,
    body: {
      startDate,
      beforeDate,
      tags: [tag],
      groupBy: "tag" as const,
    },
    dispatchAuthorized: false as const,
  };
}

type UsageAssessment = Readonly<{
  state: "HOLD" | "REVIEW_REQUIRED";
  reason: string;
  netCredits: number | null;
  dispatchAuthorized: false;
  settlementAuthorized: false;
  releaseAuthorized: false;
}>;

function usageAssessment(
  state: UsageAssessment["state"],
  reason: string,
  netCredits: number | null = null,
): UsageAssessment {
  return {
    state,
    reason,
    netCredits,
    dispatchAuthorized: false,
    settlementAuthorized: false,
    releaseAuthorized: false,
  };
}

export function assessBetaRunwayTaggedUsage(
  attemptKey: string,
  startDate: string,
  beforeDate: string,
  response: unknown,
): UsageAssessment {
  const query = buildBetaRunwayUsageQuery(
    attemptKey, startDate, beforeDate,
  );

  if (query.state !== "READ_ONLY_QUERY") {
    return usageAssessment("HOLD", "INVALID_USAGE_QUERY");
  }

  if (!response || typeof response !== "object" ||
      Array.isArray(response)) {
    return usageAssessment("HOLD", "MISSING_USAGE_RESPONSE");
  }

  const record = response as Record<string, unknown>;
  const rows = record.resultsByTag;

  if (!Array.isArray(rows) || rows.length > 100) {
    return usageAssessment("HOLD", "INVALID_USAGE_REPORT");
  }

  const tag = query.body.tags[0];
  const start = utcDay(startDate)!;
  const end = utcDay(beforeDate)!;
  let total = 0;
  let matched = 0;
  const seen = new Set<string>();

  for (const rawRow of rows) {
    if (!rawRow || typeof rawRow !== "object" ||
        Array.isArray(rawRow)) {
      return usageAssessment("HOLD", "INVALID_USAGE_REPORT");
    }

    const row = rawRow as Record<string, unknown>;
    const date = row.date;
    const entries = row.usedCredits;

    if (
      typeof date !== "string" ||
      !Array.isArray(entries) ||
      entries.length > 1000
    ) {
      return usageAssessment("HOLD", "INVALID_USAGE_REPORT");
    }

    const day = utcDay(date);
    if (day === null || day < start || day >= end) {
      return usageAssessment("HOLD", "USAGE_OUTSIDE_QUERY_WINDOW");
    }

    for (const rawEntry of entries) {
      if (
        !rawEntry || typeof rawEntry !== "object" ||
        Array.isArray(rawEntry)
      ) {
        return usageAssessment("HOLD", "INVALID_USAGE_REPORT");
      }

      const entry = rawEntry as Record<string, unknown>;

      if (entry.tag !== tag) continue;

      if (
        typeof entry.amount !== "number" ||
        !Number.isFinite(entry.amount) ||
        !Number.isSafeInteger(Math.round(entry.amount * 10000))
      ) {
        return usageAssessment("HOLD", "INVALID_CREDIT_AMOUNT");
      }

      if (seen.has(date)) {
        return usageAssessment("HOLD", "DUPLICATE_TAG_DAY");
      }

      seen.add(date);
      matched++;
      total += entry.amount;

      if (!Number.isFinite(total)) {
        return usageAssessment("HOLD", "INVALID_CREDIT_TOTAL");
      }
    }
  }

  if (matched === 0) {
    return usageAssessment("HOLD", "TAG_USAGE_NOT_YET_VISIBLE");
  }

  if (total === 0) {
    return usageAssessment("HOLD", "ZERO_NET_USAGE_NOT_PROOF");
  }

  // Positive or negative usage requires independent task/billing
  // verification. Aggregated tag totals cannot authorize finalization.
  return usageAssessment(
    "REVIEW_REQUIRED",
    total > 0
      ? "AGGREGATE_USAGE_NOT_TASK_BILLING_PROOF"
      : "REFUND_REQUIRES_BILLING_VERIFICATION",
    total,
  );
}
