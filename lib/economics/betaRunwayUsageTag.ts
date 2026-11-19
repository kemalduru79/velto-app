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
