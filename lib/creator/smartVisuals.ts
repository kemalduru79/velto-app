import type {
  CreatorImageUseCase,
  CreatorVisualFormat,
  CreatorVisualRoute,
} from "./visualRouting";
import type { CreatorQualityMode } from "./mediaRouting";

export const CREATOR_SMART_VISUALS_VERSION = "3L-v2" as const;

export type CreatorVisualArchetype =
  | "character_led"
  | "faceless_editorial"
  | "product_led"
  | "documentary"
  | "data_graphic"
  | "environmental";

export type CreatorCastPolicy =
  | "explicit_only"
  | "primary_persona"
  | "none";

export type CreatorSmartVisualCharacter = {
  name?: string;
  appearance?: string;
  outfit?: string;
  accessory?: string;
  personality?: string;
  referenceImage?: string;
};

export type CreatorSmartVisualBible = {
  style?: string;
  palette?: string;
  camera?: string;
  consistencyRules?: string;
};

export type CreatorSmartVisualPlan = {
  version: typeof CREATOR_SMART_VISUALS_VERSION;
  archetype: CreatorVisualArchetype;
  castPolicy: CreatorCastPolicy;
  selectedCharacterNames: string[];
  formatStrategy: string;
  qualityStrategy: string;
  firstFrameRole: CreatorVisualRoute["frameRole"];
  continuityStrategy: string;
  referenceFrameKey: string;
  promptBlock: string;
  negativeGuidance: string;
};

type BuildCreatorSmartVisualPlanInput = {
  title?: string;
  sceneText: string;
  visualPrompt?: string;
  narration?: string;
  dialogue?: string;
  cameraDirection?: string;
  emotion?: string;
  motionHint?: string;
  characters?: CreatorSmartVisualCharacter[];
  visualBible?: CreatorSmartVisualBible | null;
  qualityMode: CreatorQualityMode;
  format: CreatorVisualFormat;
  imageUseCase: CreatorImageUseCase;
  visualRoute: CreatorVisualRoute;
  sceneIndex?: number;
  sceneCount?: number;
  hasPreviousScene?: boolean;
  hasNextScene?: boolean;
};

const normalize = (value: unknown) =>
  String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();

const cleanKeyPart = (value: unknown, fallback: string) => {
  const cleaned = normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return cleaned || fallback;
};

const includesAny = (value: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(value));

const FACELESS_SIGNALS = [
  /\bfaceless\b/i,
  /\bwithout (?:a )?(?:host|presenter|person|face)\b/i,
  /\bno (?:host|presenter|person|face)\b/i,
  /\bb[- ]?roll\b/i,
  /\boverhead\b/i,
  /\bhands[- ]only\b/i,
  /\bscreen recording\b/i,
  /\babstract\b/i,
  /\bsilhouette\b/i,
  /\bvoice[- ]?over led\b/i,
];

const PRODUCT_SIGNALS = [
  /\bproduct\b/i,
  /\bdevice\b/i,
  /\bpackaging\b/i,
  /\bprototype\b/i,
  /\bapp interface\b/i,
  /\bsoftware interface\b/i,
  /\bclose[- ]?up\b/i,
  /\bmacro\b/i,
  /\bhero shot\b/i,
];

const DATA_SIGNALS = [
  /\bchart\b/i,
  /\bgraph\b/i,
  /\bdata\b/i,
  /\binfographic\b/i,
  /\bdiagram\b/i,
  /\bmetrics?\b/i,
  /\bdashboard\b/i,
  /\bcomparison\b/i,
  /\bstatistics?\b/i,
];

const DOCUMENTARY_SIGNALS = [
  /\bdocumentary\b/i,
  /\barchive\b/i,
  /\bhistorical\b/i,
  /\breal[- ]world\b/i,
  /\breportage\b/i,
  /\bobservational\b/i,
  /\binterview\b/i,
  /\blocation footage\b/i,
];

const PERSONA_SIGNALS = [
  /\bhost\b/i,
  /\bpresenter\b/i,
  /\bcreator\b/i,
  /\bfounder\b/i,
  /\bexpert\b/i,
  /\bspokesperson\b/i,
  /\bpersona\b/i,
  /\bcharacter\b/i,
  /\bcustomer\b/i,
  /\bemployee\b/i,
  /\bperson\b/i,
  /\bwoman\b/i,
  /\bman\b/i,
];

function getExplicitCharacterNames(
  combinedText: string,
  characters: CreatorSmartVisualCharacter[],
) {
  const normalizedText = normalize(combinedText);

  return characters
    .map((character) => String(character.name || "").trim())
    .filter(Boolean)
    .filter((name) => normalizedText.includes(normalize(name)));
}

function getVisualArchetype({
  combinedText,
  characters,
  explicitCharacterNames,
}: {
  combinedText: string;
  characters: CreatorSmartVisualCharacter[];
  explicitCharacterNames: string[];
}): {
  archetype: CreatorVisualArchetype;
  castPolicy: CreatorCastPolicy;
} {
  if (explicitCharacterNames.length > 0) {
    return { archetype: "character_led", castPolicy: "explicit_only" };
  }

  if (includesAny(combinedText, DATA_SIGNALS)) {
    return { archetype: "data_graphic", castPolicy: "none" };
  }

  if (includesAny(combinedText, PRODUCT_SIGNALS)) {
    return { archetype: "product_led", castPolicy: "none" };
  }

  if (includesAny(combinedText, DOCUMENTARY_SIGNALS)) {
    return { archetype: "documentary", castPolicy: "none" };
  }

  if (includesAny(combinedText, FACELESS_SIGNALS)) {
    return { archetype: "faceless_editorial", castPolicy: "none" };
  }

  if (characters.length > 0 && includesAny(combinedText, PERSONA_SIGNALS)) {
    return { archetype: "character_led", castPolicy: "primary_persona" };
  }

  return { archetype: "faceless_editorial", castPolicy: "none" };
}

function getFormatStrategy(
  format: CreatorVisualFormat,
  imageUseCase: CreatorImageUseCase,
) {
  if (imageUseCase === "thumbnail") {
    return [
      "Wide 16:9 thumbnail-safe composition.",
      "Use one dominant focal idea and a clean curiosity gap.",
      "Reserve uncluttered negative space for a short optional headline.",
      "Keep the subject readable at small mobile size.",
    ].join(" ");
  }

  if (format === "short_form") {
    return [
      "Vertical 9:16 mobile-first composition.",
      "Keep the essential subject and action inside the central safe zone.",
      "Use foreground-to-background vertical depth and immediate visual clarity.",
      "Avoid wide staging that becomes weak after vertical crop.",
    ].join(" ");
  }

  return [
    "Wide 16:9 YouTube composition.",
    "Use deliberate horizontal depth and a clear editorial hierarchy.",
    "Keep important subjects inside a crop-safe central area for later reframing.",
    "Preserve negative space only where it supports captions or motion.",
  ].join(" ");
}

function getQualityStrategy(qualityMode: CreatorQualityMode) {
  if (qualityMode === "cinematic") {
    return [
      "Maximum art-direction discipline.",
      "Specify lens intent, production lighting, atmosphere, believable materials, controlled texture, and strong depth separation.",
      "Design the still as a canonical cinematic first frame for a premium motion block.",
      "Continuity is more important than novelty.",
    ].join(" ");
  }

  if (qualityMode === "pro") {
    return [
      "Professional art direction with refined lighting, clear subject hierarchy, editorial depth, and stable material detail.",
      "Design the still as a dependable reference/first frame for selective AI motion.",
      "Avoid generic stock-image composition.",
    ].join(" ");
  }

  return [
    "Clean, credit-efficient creator visual.",
    "Prioritize readability, stable style, strong subject separation, and controlled detail.",
    "The frame must remain suitable for subtle image motion.",
  ].join(" ");
}

function getArchetypeStrategy(archetype: CreatorVisualArchetype) {
  switch (archetype) {
    case "character_led":
      return [
        "Use only the selected Character Cast member(s).",
        "Preserve face, age impression, hair, wardrobe, accessories, body proportions, and visual role.",
        "Do not add a substitute presenter or extra lead person.",
      ].join(" ");
    case "product_led":
      return [
        "Make the product, interface, object, or material the hero subject.",
        "Preserve shape, color, branding cues, proportions, and functional details.",
        "Do not invent a presenter unless the scene explicitly requests one.",
      ].join(" ");
    case "data_graphic":
      return [
        "Translate the idea into a clean visual system with strong hierarchy, symbolic clarity, and editorial motion potential.",
        "Avoid unreadable text, fabricated labels, dense dashboards, and decorative clutter.",
        "Use shapes, scale, contrast, and spatial relationships rather than tiny copy.",
      ].join(" ");
    case "documentary":
      return [
        "Use grounded documentary realism, observational composition, believable environments, and restrained cinematic treatment.",
        "Avoid glossy advertising polish unless the visual bible explicitly requests it.",
        "Do not invent recurring cast members.",
      ].join(" ");
    case "environmental":
      return [
        "Let location, atmosphere, architecture, landscape, and spatial storytelling carry the scene.",
        "Preserve environment identity and lighting continuity.",
      ].join(" ");
    default:
      return [
        "Keep the production intentionally faceless and narrator-led.",
        "Use objects, environments, hands, screens, materials, symbolic action, or editorial b-roll.",
        "Do not invent a host, mascot, child guide, or random presenter.",
      ].join(" ");
  }
}

function getContinuityStrategy({
  sceneIndex,
  sceneCount,
  hasPreviousScene,
  hasNextScene,
}: {
  sceneIndex?: number;
  sceneCount?: number;
  hasPreviousScene?: boolean;
  hasNextScene?: boolean;
}) {
  const position =
    Number.isFinite(sceneIndex) && Number.isFinite(sceneCount)
      ? `Scene ${Number(sceneIndex) + 1} of ${Math.max(1, Number(sceneCount))}.`
      : "Scene position is not explicitly supplied.";

  const handoff =
    hasPreviousScene && hasNextScene
      ? "Preserve a clear visual handoff from the previous scene and leave a natural action, gaze, object, lighting, or camera handoff into the next scene."
      : hasPreviousScene
        ? "Preserve the previous scene's visual universe and use a resolved composition suitable for the end of a sequence."
        : hasNextScene
          ? "Establish the canonical visual universe and leave a deliberate handoff into the next scene."
          : "Treat this frame as a self-contained canonical scene asset.";

  return [
    position,
    handoff,
    "Keep recurring objects, products, cast identity, palette, realism level, lighting logic, lens language, and texture treatment stable.",
  ].join(" ");
}

export function buildCreatorSmartVisualPlan(
  input: BuildCreatorSmartVisualPlanInput,
): CreatorSmartVisualPlan {
  const characters = Array.isArray(input.characters)
    ? input.characters.filter(Boolean)
    : [];

  const combinedText = [
    input.title,
    input.sceneText,
    input.visualPrompt,
    input.narration,
    input.dialogue,
    input.cameraDirection,
    input.emotion,
    input.motionHint,
    input.visualBible?.style,
    input.visualBible?.camera,
  ]
    .filter(Boolean)
    .join(" ");

  const explicitCharacterNames = getExplicitCharacterNames(
    combinedText,
    characters,
  );

  const { archetype, castPolicy } = getVisualArchetype({
    combinedText,
    characters,
    explicitCharacterNames,
  });

  const selectedCharacterNames =
    castPolicy === "explicit_only"
      ? explicitCharacterNames
      : castPolicy === "primary_persona"
        ? characters
            .map((character) => String(character.name || "").trim())
            .filter(Boolean)
            .slice(0, 1)
        : [];

  const formatStrategy = getFormatStrategy(input.format, input.imageUseCase);
  const qualityStrategy = getQualityStrategy(input.qualityMode);
  const archetypeStrategy = getArchetypeStrategy(archetype);
  const continuityStrategy = getContinuityStrategy({
    sceneIndex: input.sceneIndex,
    sceneCount: input.sceneCount,
    hasPreviousScene: input.hasPreviousScene,
    hasNextScene: input.hasNextScene,
  });

  const referenceFrameKey = [
    CREATOR_SMART_VISUALS_VERSION,
    input.format,
    input.qualityMode,
    input.imageUseCase,
    archetype,
    cleanKeyPart(input.visualBible?.style, "default-style"),
    cleanKeyPart(input.visualBible?.palette, "default-palette"),
  ].join(":");

  const promptBlock = [
    `Smart Visuals version: ${CREATOR_SMART_VISUALS_VERSION}`,
    `Detected visual archetype: ${archetype}`,
    `Cast policy: ${castPolicy}`,
    selectedCharacterNames.length > 0
      ? `Allowed recurring cast in this scene: ${selectedCharacterNames.join(", ")}`
      : "Allowed recurring cast in this scene: none unless explicitly required by the scene text.",
    `Archetype direction: ${archetypeStrategy}`,
    `Format direction: ${formatStrategy}`,
    `Quality direction: ${qualityStrategy}`,
    `Continuity direction: ${continuityStrategy}`,
    `Reference/first-frame role: ${input.visualRoute.frameRole}`,
    `Reference-frame key: ${referenceFrameKey}`,
  ].join("\n");

  const negativeGuidance = [
    "3L smart negative guidance:",
    "- do not force Character Cast into faceless, product-led, documentary, environmental, or data-graphic scenes",
    "- do not invent an unrequested host, presenter, mascot, child guide, customer, employee, or crowd",
    "- do not change the selected cast identity, product geometry, brand cues, palette, realism level, lens language, or lighting logic",
    "- do not create generic stock imagery, slideshow filler, poster clutter, tiny unreadable text, or random decorative objects",
    "- do not ignore the requested format safe zone or first-frame role",
  ].join("\n");

  return {
    version: CREATOR_SMART_VISUALS_VERSION,
    archetype,
    castPolicy,
    selectedCharacterNames,
    formatStrategy,
    qualityStrategy,
    firstFrameRole: input.visualRoute.frameRole,
    continuityStrategy,
    referenceFrameKey,
    promptBlock,
    negativeGuidance,
  };
}

export function selectCreatorSceneCharacters<
  T extends CreatorSmartVisualCharacter,
>(
  characters: T[] | undefined,
  plan: CreatorSmartVisualPlan,
): T[] {
  const source = Array.isArray(characters) ? characters : [];

  if (plan.castPolicy === "none") {
    return [];
  }

  if (plan.castPolicy === "primary_persona") {
    return source.slice(0, 1);
  }

  const selected = new Set(
    plan.selectedCharacterNames.map((name) => normalize(name)),
  );

  return source.filter((character) =>
    selected.has(normalize(character.name)),
  );
}
