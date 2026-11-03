import { runScientificCalculation } from "./calculationRunner.ts";
import { SCIENTIFIC_V2_PROFILE_IDS, v2Fail } from "./runtimeV2Contracts.ts";

export const SCIENTIFIC_DARWIN_V1_PROFILE = "darwin-system-python-3.9.6-scipy-gated-v1" as const;
/** No environment variable, input flag or structurally valid manifest enables v2. */
export const SCIENTIFIC_V2_REAL_EXECUTION_ENABLED = false as const;

export function inspectScientificRuntimeProfile(profileId: unknown) {
  if (profileId === SCIENTIFIC_DARWIN_V1_PROFILE) return { profileId, kind: "darwin_v1", availability: "LEGACY_PIN_VERIFICATION_REQUIRED" } as const;
  if (typeof profileId === "string" && SCIENTIFIC_V2_PROFILE_IDS.includes(profileId as (typeof SCIENTIFIC_V2_PROFILE_IDS)[number])) {
    return { profileId, kind: "container_v2", availability: "UNQUALIFIED_EXECUTION_DISABLED" } as const;
  }
  return v2Fail("PROFILE_UNKNOWN");
}

export function selectScientificRuntimeProfile(profileId: unknown) {
  const profile = inspectScientificRuntimeProfile(profileId);
  if (profile.kind === "container_v2") v2Fail("PROFILE_UNQUALIFIED");
  if (process.platform !== "darwin" || !["arm64", "x64"].includes(process.arch)) v2Fail("PROFILE_HOST_UNAVAILABLE");
  return profile;
}

/** Explicit profile API. The old v1 entry point and every v1 pin remain unchanged. */
export async function runScientificCalculationForProfile(request: unknown, options: { profileId: unknown; runDirectory: string; timeoutMs?: number }) {
  selectScientificRuntimeProfile(options.profileId);
  return runScientificCalculation(request, { runDirectory: options.runDirectory, timeoutMs: options.timeoutMs });
}

/** Deliberately no transport implementation or bypass/injection parameter. */
export async function executeScientificContainerV2(): Promise<never> {
  return v2Fail("REAL_EXECUTION_DISABLED");
}
