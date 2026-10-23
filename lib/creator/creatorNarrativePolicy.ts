export const CREATOR_NARRATIVE_POLICY_VALUES = [
  "science_documentary_v1",
] as const;

export type CreatorNarrativePolicy =
  (typeof CREATOR_NARRATIVE_POLICY_VALUES)[number];

const POLICY_SET = new Set<string>(CREATOR_NARRATIVE_POLICY_VALUES);

export function isCreatorNarrativePolicy(
  value: unknown,
): value is CreatorNarrativePolicy {
  return typeof value === "string" && POLICY_SET.has(value);
}

export function normalizeCreatorNarrativePolicy(
  value: unknown,
): CreatorNarrativePolicy | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isCreatorNarrativePolicy(value)) {
    throw new Error("CREATOR_NARRATIVE_POLICY_INVALID");
  }
  return value;
}

export function assertCreatorNarrativePolicyConfiguration(input: {
  narrativePolicy?: CreatorNarrativePolicy;
  targetDurationSec: number;
  sectionCount?: number;
  format?: string;
}) {
  if (!input.narrativePolicy) return;
  if (
    input.narrativePolicy !== "science_documentary_v1" ||
    input.targetDurationSec !== 480 ||
    (input.format !== undefined && input.format !== "youtube_video") ||
    (input.sectionCount !== undefined && input.sectionCount !== 5)
  ) {
    throw new Error("CREATOR_NARRATIVE_POLICY_CONFIGURATION_UNSUPPORTED");
  }
}
