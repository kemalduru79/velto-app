/**
 * Script refinement is a separate workflow from script generation, but it must
 * use the creator's script-model configuration unless explicitly overridden.
 * Keep this logic offline-testable and side-effect free.
 */
export function resolveCreatorScriptRefinementModel(env: {
  OPENAI_REFINEMENT_MODEL?: string;
  OPENAI_SCRIPT_MODEL?: string;
  OPENAI_MODEL?: string;
}): string {
  return [env.OPENAI_REFINEMENT_MODEL, env.OPENAI_SCRIPT_MODEL, env.OPENAI_MODEL, "gpt-4.1-mini"]
    .find((value) => typeof value === "string" && value.trim())!.trim();
}

export function creatorScriptRefinementModelOptions(
  model: string,
  legacyTemperature: number,
): { reasoning: { effort: "medium" } } | { temperature: number } {
  // Reasoning models must not receive an unsupported temperature value.
  return /^gpt-(?:5|6)(?:[.-]|$)/iu.test(model)
    ? { reasoning: { effort: "medium" } }
    : { temperature: legacyTemperature };
}

type RefinementFailure = {
  code: string;
  error: string;
  status: 409 | 422 | 429 | 503;
};

const KNOWN_FAILURES: Record<string, RefinementFailure> = {
  CREATOR_SCRIPT_REFINEMENT_NO_CHANGE: {
    code: "CREATOR_SCRIPT_REFINEMENT_NO_CHANGE",
    error: "AI did not propose a meaningful change. Try a more specific editing instruction.",
    status: 422,
  },
  CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED: {
    code: "CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED",
    error: "The proposed edit would violate the script duration limits. The original script was preserved.",
    status: 422,
  },
  CREATOR_SCRIPT_REFINEMENT_SOURCE_REVIEW_UNAVAILABLE: {
    code: "CREATOR_SCRIPT_REFINEMENT_SOURCE_REVIEW_UNAVAILABLE",
    error: "The source evidence needed for this edit is unavailable. The original script was preserved.",
    status: 422,
  },
  CREATOR_SCRIPT_REFINEMENT_GROUNDING_UNSATISFIED: {
    code: "CREATOR_SCRIPT_REFINEMENT_GROUNDING_UNSATISFIED",
    error: "The proposed edit could not be supported by the current evidence.",
    status: 422,
  },
  CREATOR_SCRIPT_REFINEMENT_CREATOR_CONSTRAINT_UNSATISFIED: {
    code: "CREATOR_SCRIPT_REFINEMENT_CREATOR_CONSTRAINT_UNSATISFIED",
    error: "The proposed edit conflicts with an explicit creator constraint.",
    status: 422,
  },
  CREATOR_SCRIPT_REFINEMENT_SELECTION_TOO_LARGE: {
    code: "CREATOR_SCRIPT_REFINEMENT_SELECTION_TOO_LARGE",
    error: "This request is broader than the current limited-edit mode can safely change.",
    status: 422,
  },
  CREATOR_SCRIPT_REFINEMENT_PATCH_TOO_LARGE: {
    code: "CREATOR_SCRIPT_REFINEMENT_PATCH_TOO_LARGE",
    error: "The proposed changes exceed the allowed limited-edit scope.",
    status: 422,
  },
};

export function classifyCreatorScriptRefinementFailure(error: unknown): RefinementFailure {
  const raw = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const message = error instanceof Error ? error.message : "";
  if (message === "PROJECT_SAVE_CONFLICT" || /SELECTION_STALE|REFINEMENT_STALE/u.test(message)) {
    return {
      code: "CREATOR_SCRIPT_REFINEMENT_STALE",
      error: "The script changed during refinement. Review the current revision before trying again.",
      status: 409,
    };
  }
  if (KNOWN_FAILURES[message]) return KNOWN_FAILURES[message];
  if (message.startsWith("CREATOR_SCRIPT_REFINEMENT_")) {
    return {
      code: message,
      error: "The proposed edit did not pass the script safety checks. The original script was preserved.",
      status: 422,
    };
  }
  const providerStatus = Number(raw?.status);
  if (providerStatus === 429) {
    return {
      code: "CREATOR_SCRIPT_REFINEMENT_PROVIDER_RATE_LIMITED",
      error: "The AI provider is temporarily rate limited. No changes were saved.",
      status: 429,
    };
  }
  if ([500, 502, 503, 504].includes(providerStatus)) {
    return {
      code: "CREATOR_SCRIPT_REFINEMENT_PROVIDER_UNAVAILABLE",
      error: "The AI provider is temporarily unavailable. No changes were saved.",
      status: 503,
    };
  }
  return {
    code: "CREATOR_SCRIPT_REFINEMENT_FAILED",
    error: "Script refinement could not be completed safely. The original script was preserved.",
    status: 422,
  };
}
