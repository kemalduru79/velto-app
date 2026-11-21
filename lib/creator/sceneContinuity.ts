import {
  CREATOR_CONTINUITY_CONTRACT_VERSION,
  type CreatorContinuityFallbackRecommendation,
  type CreatorContinuityGuardResult,
  type CreatorContinuityStateField,
  type CreatorGenerationContinuityContext,
  type CreatorProductionIdentity,
  type CreatorSceneContinuityState,
  type CreatorTransitionContract,
} from "./continuityContracts";
import type { CreatorResolvedContinuityMode } from "./visualContinuity";

const ARRAY_FIELDS = [
  "charactersPresent",
  "wardrobe",
  "props",
  "continuityNotes",
] as const;
const CONTINUITY_STATE_FIELDS = new Set<CreatorContinuityStateField>([
  "charactersPresent",
  "location",
  "timeOfDay",
  "lighting",
  "wardrobe",
  "props",
  "productState",
  "actionStart",
  "actionEnd",
  "screenDirection",
  "cameraIntent",
  "emotionalState",
]);
const ARRAY_LIMITS = {
  charactersPresent: { count: 8, length: 80 },
  wardrobe: { count: 8, length: 180 },
  props: { count: 12, length: 140 },
  continuityNotes: { count: 4, length: 240 },
} as const;
const STRING_FIELD_MAX_LENGTH = 320;
const STRING_FIELDS = [
  "location",
  "timeOfDay",
  "lighting",
  "productState",
  "actionStart",
  "actionEnd",
  "screenDirection",
  "cameraIntent",
  "emotionalState",
] as const;
const DIRECT_STABLE_FIELDS = [
  "charactersPresent",
  "location",
  "timeOfDay",
  "lighting",
  "wardrobe",
  "props",
  "productState",
  "screenDirection",
  "cameraIntent",
] as const;

function cleanString(value: unknown, maxLength = STRING_FIELD_MAX_LENGTH) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanStringArray(
  value: unknown,
  limits: { count: number; length: number },
) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.map((item) => cleanString(item, limits.length)).filter(Boolean)),
  ].slice(0, limits.count);
}

export function normalizeCreatorSceneContinuityState(
  value: unknown,
): CreatorSceneContinuityState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: CreatorSceneContinuityState = {};
  const sceneId = Number(source.sceneId);
  if (Number.isFinite(sceneId) && sceneId > 0) result.sceneId = Math.round(sceneId);
  for (const field of ARRAY_FIELDS) {
    const normalized = cleanStringArray(source[field], ARRAY_LIMITS[field]);
    if (normalized.length) result[field] = normalized;
  }
  for (const field of STRING_FIELDS) {
    const normalized = cleanString(source[field]);
    if (normalized) result[field] = normalized;
  }
  const explicitChanges = cleanStringArray(source.explicitChanges, {
    count: CONTINUITY_STATE_FIELDS.size,
    length: 32,
  }).filter((field): field is CreatorContinuityStateField =>
    CONTINUITY_STATE_FIELDS.has(field as CreatorContinuityStateField),
  );
  if (explicitChanges.length) result.explicitChanges = explicitChanges;
  return Object.keys(result).length ? result : undefined;
}

export function mergeCreatorSceneContinuityState(
  baseValue: unknown,
  revisedValue: unknown,
): CreatorSceneContinuityState | undefined {
  const base = normalizeCreatorSceneContinuityState(baseValue);
  if (!revisedValue || typeof revisedValue !== "object" || Array.isArray(revisedValue)) {
    return base;
  }
  const revised = revisedValue as Record<string, unknown>;
  return normalizeCreatorSceneContinuityState({
    ...(base || {}),
    ...revised,
  });
}

export function buildCreatorProductionIdentity(input: {
  characters?: unknown;
  visualBible?: unknown;
}): CreatorProductionIdentity {
  const characters = Array.isArray(input.characters) ? input.characters : [];
  const visualBible = input.visualBible && typeof input.visualBible === "object"
    ? input.visualBible as Record<string, unknown>
    : {};
  return {
    version: CREATOR_CONTINUITY_CONTRACT_VERSION,
    characterAnchors: characters.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const character = value as Record<string, unknown>;
      const name = cleanString(character.name);
      if (!name) return [];
      return [{
        name,
        ...(cleanString(character.appearance) ? { appearance: cleanString(character.appearance) } : {}),
        ...(cleanString(character.outfit) ? { wardrobe: cleanString(character.outfit) } : {}),
        ...(cleanString(character.accessory) ? { accessory: cleanString(character.accessory) } : {}),
        ...(cleanString(character.personality) ? { role: cleanString(character.personality) } : {}),
      }];
    }),
    ...(cleanString(visualBible.style) ? { visualStyle: cleanString(visualBible.style) } : {}),
    ...(cleanString(visualBible.palette) ? { palette: cleanString(visualBible.palette) } : {}),
    ...(cleanString(visualBible.camera) ? { cameraLanguage: cleanString(visualBible.camera) } : {}),
    ...(cleanString(visualBible.style) ? { productionUniverse: cleanString(visualBible.style) } : {}),
    ...(cleanString(visualBible.consistencyRules) ? { consistencyRules: cleanString(visualBible.consistencyRules) } : {}),
  };
}

function comparable(value: unknown) {
  return Array.isArray(value)
    ? [...value].map((item) => cleanString(item).toLocaleLowerCase("en-US")).sort().join("|")
    : cleanString(value).toLocaleLowerCase("en-US");
}

function isExplicit(field: string, explicitChanges: CreatorContinuityStateField[]) {
  return explicitChanges.some((value) => value.toLocaleLowerCase("en-US") === field.toLocaleLowerCase("en-US"));
}

function getCharacterWardrobe(
  wardrobe: string[] | undefined,
  characterName: string,
) {
  const normalizedName = comparable(characterName);
  const matches = (wardrobe || []).flatMap((entry) => {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) return [];
    const entryName = comparable(entry.slice(0, separatorIndex));
    const description = cleanString(entry.slice(separatorIndex + 1));
    return entryName === normalizedName && description ? [description] : [];
  });
  return matches.length ? comparable(matches) : undefined;
}

function hasRecurringWardrobeDrift(
  previous: CreatorSceneContinuityState,
  current: CreatorSceneContinuityState,
) {
  const currentCharacters = new Map(
    (current.charactersPresent || []).map((name) => [comparable(name), name]),
  );
  const recurringCharacters = (previous.charactersPresent || []).filter((name) =>
    currentCharacters.has(comparable(name)),
  );

  for (const previousName of recurringCharacters) {
    const currentName = currentCharacters.get(comparable(previousName)) || previousName;
    const previousWardrobe = getCharacterWardrobe(previous.wardrobe, previousName);
    const currentWardrobe = getCharacterWardrobe(current.wardrobe, currentName);
    if (
      previousWardrobe !== undefined &&
      currentWardrobe !== undefined &&
      previousWardrobe !== currentWardrobe
    ) {
      return true;
    }
  }

  if (
    recurringCharacters.length === 1 &&
    previous.charactersPresent?.length === 1 &&
    current.charactersPresent?.length === 1 &&
    previous.wardrobe?.length === 1 &&
    current.wardrobe?.length === 1
  ) {
    return comparable(previous.wardrobe) !== comparable(current.wardrobe);
  }

  return false;
}

function fallbackFor(
  mode: CreatorResolvedContinuityMode,
  changedFields: string[],
  current: CreatorSceneContinuityState | undefined,
): CreatorContinuityFallbackRecommendation {
  if (mode !== "previous") return "none";
  if (changedFields.includes("location")) return "establishing";
  if (changedFields.includes("timeOfDay")) return "bridge";
  const intent = (current?.cameraIntent || "").toLowerCase();
  if (/b[- ]?roll/.test(intent)) return "broll";
  if (/cutaway|insert/.test(intent)) return "cutaway";
  return "none";
}

export function createCreatorTransitionContract(input: {
  mode: CreatorResolvedContinuityMode;
  previousState?: unknown;
  currentState?: unknown;
  explicitChanges?: CreatorContinuityStateField[];
  isFirstScene?: boolean;
}): CreatorTransitionContract {
  const mode = input.isFirstScene && input.mode === "previous" ? "independent" : input.mode;
  const previous = normalizeCreatorSceneContinuityState(input.previousState);
  const current = normalizeCreatorSceneContinuityState(input.currentState);
  const explicitChanges = (input.explicitChanges || current?.explicitChanges || [])
    .filter((field): field is CreatorContinuityStateField =>
      CONTINUITY_STATE_FIELDS.has(field as CreatorContinuityStateField),
    );
  const inheritedState: CreatorSceneContinuityState = {};
  const changedFields: string[] = [];
  const warnings: string[] = [];

  if (
    mode === "consistent" &&
    previous?.charactersPresent?.length &&
    current?.charactersPresent?.length
  ) {
    if (
      previous.wardrobe?.length &&
      current.wardrobe?.length &&
      hasRecurringWardrobeDrift(previous, current) &&
      !isExplicit("wardrobe", explicitChanges)
    ) {
      warnings.push("Recurring character wardrobe changes without explicit transition intent.");
    }
  }

  if (mode === "previous" && previous) {
    for (const field of DIRECT_STABLE_FIELDS) {
      const priorValue = previous[field];
      const currentValue = current?.[field];
      if (priorValue !== undefined && currentValue === undefined) {
        Object.assign(inheritedState, { [field]: priorValue });
      } else if (priorValue !== undefined && currentValue !== undefined && comparable(priorValue) !== comparable(currentValue)) {
        changedFields.push(field);
        if (!isExplicit(field, explicitChanges)) warnings.push(`Direct continuation changes ${field} without explicit transition intent.`);
      }
    }
    if (previous.actionEnd && !current?.actionStart) inheritedState.actionStart = previous.actionEnd;
    if (previous.actionEnd && current?.actionStart && comparable(previous.actionEnd) !== comparable(current.actionStart)) {
      changedFields.push("actionStart");
      if (!isExplicit("actionStart", explicitChanges)) warnings.push("Current actionStart does not hand off from the previous actionEnd.");
    }
  }

  const mustPreserve = mode === "independent"
    ? ["project brand", "visual quality", "broad style"]
    : mode === "consistent"
      ? ["recurring character identity", "brand/product identity", "visual universe", "palette and lighting logic", "realism level", "camera/editorial language"]
      : ["active character identity", "wardrobe", "location", "time of day", "lighting", "prop/product state", "screen direction", "action handoff", "camera/lens logic"];
  const allowedChanges = mode === "independent"
    ? ["person", "location", "wardrobe", "props", "product state", "weather", "time", "action", "screen direction"]
    : mode === "consistent"
      ? [...new Set([
          "location",
          "B-roll",
          "metaphor",
          "shot",
          "subject",
          "scene-specific visual beat",
          ...explicitChanges,
        ])]
      : explicitChanges;

  return {
    version: CREATOR_CONTINUITY_CONTRACT_VERSION,
    mode,
    mustPreserve,
    allowedChanges,
    inheritedState,
    explicitChanges,
    continuityWarnings: warnings,
    fallbackRecommendation: fallbackFor(mode, changedFields, current),
  };
}

export function guardCreatorSceneContinuity(
  transition: CreatorTransitionContract,
): CreatorContinuityGuardResult {
  const contradictions = [...transition.continuityWarnings];
  const missingInformation = Object.keys(transition.inheritedState).map(
    (field) => `${field} is missing from the current scene and can be inherited.`,
  );
  const contextAugmentations = Object.entries(transition.inheritedState).map(
    ([field, value]) => `Use inherited ${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}.`,
  );
  return {
    version: CREATOR_CONTINUITY_CONTRACT_VERSION,
    status: contradictions.length
      ? "review_recommended"
      : contextAugmentations.length
        ? "repair_available"
        : "safe",
    contradictions,
    missingInformation,
    contextAugmentations,
  };
}

export function buildCreatorGenerationContinuityContext(input: {
  mode: CreatorResolvedContinuityMode;
  characters?: unknown;
  visualBible?: unknown;
  previousState?: unknown;
  currentState?: unknown;
  nextState?: unknown;
  explicitChanges?: CreatorContinuityStateField[];
  isFirstScene?: boolean;
}): CreatorGenerationContinuityContext {
  const previousState = normalizeCreatorSceneContinuityState(input.previousState);
  const currentState = normalizeCreatorSceneContinuityState(input.currentState);
  const nextState = normalizeCreatorSceneContinuityState(input.nextState);
  const transition = createCreatorTransitionContract({
    mode: input.mode,
    previousState,
    currentState,
    explicitChanges: input.explicitChanges ?? currentState?.explicitChanges,
    isFirstScene: input.isFirstScene,
  });
  return {
    version: CREATOR_CONTINUITY_CONTRACT_VERSION,
    productionIdentity: buildCreatorProductionIdentity(input),
    ...(previousState ? { previousState } : {}),
    ...(currentState ? { currentState } : {}),
    ...(nextState ? { nextState } : {}),
    transition,
    guard: guardCreatorSceneContinuity(transition),
  };
}
