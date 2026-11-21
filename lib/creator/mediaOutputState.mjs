/**
 * @typedef {"image" | "video"} CreatorMediaOutputMode
 */

/**
 * Keeps the automatic recommendation distinct from the persisted explicit
 * override. The effective output is what production uses right now.
 *
 * @param {{
 *   recommendedOutput: CreatorMediaOutputMode;
 *   explicitOutput?: CreatorMediaOutputMode | null;
 * }} input
 */
export function resolveCreatorMediaOutputState({
  recommendedOutput,
  explicitOutput,
}) {
  const normalizedOverride =
    explicitOutput === "image" || explicitOutput === "video"
      ? explicitOutput
      : null;
  const effectiveOutput = normalizedOverride || recommendedOutput;

  return {
    recommendedOutput,
    effectiveOutput,
    explicitOutput: normalizedOverride,
    isUserOverride:
      normalizedOverride !== null && normalizedOverride !== recommendedOutput,
  };
}
