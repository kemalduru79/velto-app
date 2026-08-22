import { withObservedApiRoute } from "@/lib/observability";
import { NextResponse } from "next/server";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";
import { getMediaProviderFacade, getProviderPublicMessage } from "@/lib/providers";
import type { ImageProviderReferenceInput } from "@/lib/providers/image";
import {
  getCreatorVisualRoute,
  type CreatorImageUseCase,
} from "../../../lib/creator/visualRouting";
import {
  buildCreatorSmartVisualPlan,
  selectCreatorSceneCharacters,
} from "../../../lib/creator/smartVisuals";
import type { CreatorGenerationContinuityContext } from "../../../lib/creator/continuityContracts";
import type { CreatorResolvedContinuityMode } from "../../../lib/creator/visualContinuity";
import { buildCreatorGenerationContinuityContext } from "../../../lib/creator/sceneContinuity";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { checkStorageGenerationAllowance, StorageQuotaOperationalError, storageQuotaFullResponse, storageQuotaOperationalErrorResponse } from "@/lib/persistence/media/storageQuota.server";
import { issueStorageAdmissionForOwner } from "@/lib/persistence/media/storageAdmission.server";
import { calculateOpenAIImageCost, normalizeOpenAIImageUsage, persistEconomicOperationBestEffort, unknownCost, type EconomicCostResult, type EconomicOperationInput } from "@/lib/economics";

// 3L SMART VISUALS V2
// CONT-P1R SELECTIVE CONTINUITY

export const runtime = "nodejs";

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

type Character = {
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory?: string;
  personality: string;
  referenceImage?: string;
};

type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
};

type ImageProductProfile = "storyverse" | "creatorlab";

type SceneContinuityContext = {
  sceneId?: number;
  sceneCount?: number;
  previousScene?: {
    text?: string;
    cameraDirection?: string;
    emotion?: string;
    motionHint?: string;
  } | null;
  nextScene?: {
    text?: string;
    cameraDirection?: string;
    emotion?: string;
    motionHint?: string;
  } | null;
  structuredContext?: CreatorGenerationContinuityContext;
};

const DEFAULT_GUIDE_CHARACTER: Character = {
  name: "Joe",
  age: "10",
  appearance:
    "10-year-old boy with short slightly messy brown hair, large green eyes, soft rounded face, expressive friendly face, childlike proportions, consistent face shape and eye shape",
  outfit:
    "red baseball cap, blue t-shirt with a clear rocket logo, simple blue jeans, simple white sneakers; the cap, rocket t-shirt, jeans, and sneakers must stay the same across episodes unless explicitly changed",
  accessory: "red baseball cap and rocket logo t-shirt",
  personality:
    "curious, energetic, slightly playful, emotionally expressive, kind, brave, problem solver, asks simple questions that help children understand the topic",
  referenceImage: "",
};

function normalizeNameForCharacter(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCharactersForPrompt(
  characters?: Character[],
  useDefaultGuideCharacter = false,
  productProfile: ImageProductProfile = "storyverse",
) {
  const safeCharacters = Array.isArray(characters) ? characters : [];
  const shouldUseStoryverseJoe = productProfile === "storyverse";
  const hasJoe = safeCharacters.some(
    (character) => normalizeNameForCharacter(character?.name) === "joe",
  );

  const normalizedCharacters = safeCharacters.map((character) =>
    shouldUseStoryverseJoe &&
    normalizeNameForCharacter(character?.name) === "joe"
      ? {
          ...DEFAULT_GUIDE_CHARACTER,
          ...character,
          name: "Joe",
          age: character.age || DEFAULT_GUIDE_CHARACTER.age,
          appearance:
            character.appearance || DEFAULT_GUIDE_CHARACTER.appearance,
          outfit: character.outfit || DEFAULT_GUIDE_CHARACTER.outfit,
          accessory:
            character.accessory ?? DEFAULT_GUIDE_CHARACTER.accessory,
          personality:
            character.personality || DEFAULT_GUIDE_CHARACTER.personality,
        }
      : character,
  );

  if (shouldUseStoryverseJoe && !hasJoe && useDefaultGuideCharacter) {
    return [DEFAULT_GUIDE_CHARACTER, ...normalizedCharacters];
  }

  return normalizedCharacters;
}

function buildCharacterBlock(
  characters?: Character[],
  useDefaultGuideCharacter = false,
  productProfile: ImageProductProfile = "storyverse",
) {
  const effectiveCharacters = normalizeCharactersForPrompt(
    characters,
    useDefaultGuideCharacter,
    productProfile,
  );

  if (!effectiveCharacters.length) {
    return `
NO LOCKED CHARACTER PROVIDED:
- Do not inject Joe or any default mascot.
- Follow the scene description and visual bible.
- If the format is faceless, documentary, product-led, or abstract, keep the same visual universe rather than inventing a recurring character.
- If a character appears in the scene text, keep that character consistent inside this scene and avoid adding unrelated extra lead characters.
`;
  }

  return effectiveCharacters
    .map((character, index) => {
      const hasReference = Boolean(character.referenceImage?.trim());
      const isStoryverseJoe =
        productProfile === "storyverse" &&
        normalizeNameForCharacter(character?.name) === "joe";

      return `
Character ${index + 1}
Name: ${character.name || "Unnamed"}
Age: ${character.age || "Unknown"}
Appearance: ${character.appearance || "Not specified"}
Outfit: ${character.outfit || "Not specified"}
Accessory: ${character.accessory || "No accessory"}
Personality: ${character.personality || "Not specified"}
Reference image attached to request: ${hasReference ? "yes" : "no"}

CRITICAL CHARACTER LOCK:
- This character MUST look IDENTICAL whenever the same character appears across scenes.
${isStoryverseJoe ? "- Joe was explicitly provided for Storyverse, so preserve Joe's established identity exactly." : "- This is a user-defined character/persona, not a default mascot."}
- If a reference image is attached, it OVERRIDES conflicting written appearance details.
- NEVER redesign this character or change face shape, eye shape, nose proportions, hairstyle, hair color, apparent age, outfit, accessory, or body proportions unless the scene explicitly requires a temporary change.
- NEVER swap gender, merge this character with another person, or invent a visually different replacement.
- Preserve the same identity and production universe across scenes.
`;
    })
    .join("\n");
}

function buildVisualBlock(
  visualBible: VisualBible | null | undefined,
  productProfile: ImageProductProfile,
  continuityMode: CreatorResolvedContinuityMode = "consistent",
) {
  const isCreatorLab = productProfile === "creatorlab";
  const defaultStyle = isCreatorLab
    ? "professional creator-grade visual direction selected by the brief; realistic, cinematic, illustrative, product-led, documentary, graphic, or animated only when the concept requires it"
    : "premium 3D animated feature film look, cinematic but child-friendly, expressive characters, detailed environments, polished lighting, not flat 2D";
  const defaultPalette = isCreatorLab
    ? "platform-ready color system with clean contrast, controlled highlights, strong subject separation, and consistent brand energy"
    : "rich vibrant colors, warm highlights, clean contrast, soft cinematic shadows, premium family animation color grading";
  const defaultCamera = isCreatorLab
    ? "professional creator framing with a clear focal subject, editorial depth, mobile readability, and deliberate negative space"
    : "cinematic family animation framing, clear subject separation, readable facial expression, strong depth, professional composition";
  const defaultConsistencyRules =
    isCreatorLab && continuityMode === "independent"
      ? "preserve only the requested brand, style, palette and production quality inside this scene; do not inherit a person, location, prop, metaphor or world state from another scene"
      : isCreatorLab
        ? "preserve the same cast identity, brand language, lighting logic, palette, realism level, lens language, and editorial universe across linked scenes"
        : "same character face, same hair, same outfit, same age appearance, same proportions, and same family-animation universe across scenes";
  const consistencyRules =
    isCreatorLab && continuityMode === "independent"
      ? defaultConsistencyRules
      : visualBible?.consistencyRules || defaultConsistencyRules;

  return `
Style: ${visualBible?.style || defaultStyle}
Palette: ${visualBible?.palette || defaultPalette}
Camera: ${visualBible?.camera || defaultCamera}
Consistency rules: ${consistencyRules}
`;
}

function buildContinuityBlock(
  context: SceneContinuityContext | null | undefined,
  continuityMode: CreatorResolvedContinuityMode,
  characters?: Character[],
  visualBible?: VisualBible | null,
) {
  if (continuityMode === "independent") {
    return [
      "INDEPENDENT SCENE:",
      "- Do not inherit a person, location, prop, product state, metaphor, weather, time of day, or camera handoff from another scene.",
      "- Use only the people and world details explicitly required by this scene.",
      "- Preserve project-level brand, quality, format, palette and style only where they do not force narrative continuity.",
    ].join("\n");
  }

  if (!context) {
    return continuityMode === "previous"
      ? "Continue the immediately previous scene. No previous-scene context was supplied, so use only the explicit scene and cast references without inventing a new recurring world."
      : "Keep recurring characters and the shared visual world consistent. No adjacent-scene context was supplied; use the visual bible and selected cast as the canonical source.";
  }

  const describeScene = (
    label: string,
    scene: SceneContinuityContext["previousScene"],
  ) => {
    if (!scene) {
      return `${label}: none`;
    }

    return [
      `${label}:`,
      `- visual beat: ${scene.text || "not specified"}`,
      `- camera: ${scene.cameraDirection || "not specified"}`,
      `- emotion: ${scene.emotion || "not specified"}`,
      `- motion: ${scene.motionHint || "not specified"}`,
    ].join("\n");
  };

  const suppliedStructured = context.structuredContext;
  const structured = suppliedStructured
    ? buildCreatorGenerationContinuityContext({
        mode: continuityMode,
        characters,
        visualBible,
        previousState: suppliedStructured.previousState,
        currentState: suppliedStructured.currentState,
        nextState: suppliedStructured.nextState,
        isFirstScene: !context.previousScene,
      })
    : undefined;
  const structuredBlock = structured
    ? [
        "Structured production continuity (augments Character Cast and Visual Bible; explicit current-scene requirements remain highest priority):",
        `- production identity: ${[
          structured.productionIdentity.visualStyle,
          structured.productionIdentity.palette,
          structured.productionIdentity.cameraLanguage,
          structured.productionIdentity.productionUniverse,
        ].filter(Boolean).join("; ") || "use the authoritative Character Cast and Visual Bible above"}`,
        `- must preserve: ${structured.transition.mustPreserve.join(", ") || "none"}`,
        `- allowed changes: ${structured.transition.allowedChanges.join(", ") || "none specified"}`,
        `- previous state: ${structured.previousState ? JSON.stringify(structured.previousState) : "not supplied"}`,
        `- current state: ${structured.currentState ? JSON.stringify(structured.currentState) : "not supplied"}`,
        `- next state: ${continuityMode === "consistent" && structured.nextState ? JSON.stringify(structured.nextState) : "not used"}`,
        `- inherited handoff: ${Object.keys(structured.transition.inheritedState).length ? JSON.stringify(structured.transition.inheritedState) : "none"}`,
        `- continuity guard: ${structured.guard.status}${structured.guard.contradictions.length ? `; review ${structured.guard.contradictions.join(" | ")}` : ""}`,
        `- editorial fallback: ${structured.transition.fallbackRecommendation}`,
        ...structured.guard.contextAugmentations.map((instruction) => `- deterministic context repair: ${instruction}`),
        structured.transition.fallbackRecommendation !== "none"
          ? "- Treat fallback as editorial guidance only. Do not invent extra media or force a false literal match."
          : "",
      ].filter(Boolean).join("\n")
    : "Structured production continuity: not supplied; use the legacy adjacent-scene context below.";

  return [
    `Timeline position: scene ${context.sceneId || "?"} of ${context.sceneCount || "?"}`,
    describeScene("Previous scene", context.previousScene),
    continuityMode === "consistent"
      ? describeScene("Next scene", context.nextScene)
      : "Next scene: not used for direct continuation",
    continuityMode === "previous"
      ? "Continue directly from the previous scene. Preserve its active character, location, lighting, time, prop state, screen direction, and camera handoff unless this scene explicitly changes them."
      : "Keep recurring characters and the shared world recognizable, while allowing the shot, location or metaphor to change when the current scene explicitly requires it.",
    structuredBlock,
  ].join("\n");
}

function isPrivateOrLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "0.0.0.0" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return true;
  }

  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (!ipv4) {
    return false;
  }

  const [, aText, bText] = ipv4;
  const a = Number(aText);
  const b = Number(bText);

  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function referenceSourceToFile(source: string, index: number) {
  const trimmed = source.trim();
  const dataMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);

  if (dataMatch) {
    const mimeType = dataMatch[1];
    const buffer = Buffer.from(dataMatch[2], "base64");

    if (!buffer.length || buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
      throw new Error("Reference image is empty or exceeds the 10 MB limit.");
    }

    const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
    return {
      data: buffer,
      filename: `creator-reference-${index + 1}.${extension}`,
      contentType: mimeType,
    } satisfies ImageProviderReferenceInput;
  }

  const url = new URL(trimmed);

  if (url.protocol !== "https:" || isPrivateOrLocalHostname(url.hostname)) {
    throw new Error("Only public HTTPS reference-image URLs are accepted.");
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });

  const finalUrl = new URL(response.url || url.toString());

  if (
    finalUrl.protocol !== "https:" ||
    isPrivateOrLocalHostname(finalUrl.hostname)
  ) {
    throw new Error("Reference image redirected to an unsupported location.");
  }

  if (!response.ok) {
    throw new Error(`Reference image could not be downloaded (${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);

  if (contentLength > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("Reference image exceeds the 10 MB limit.");
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] || "";

  if (!mimeType.startsWith("image/")) {
    throw new Error("Reference URL did not return an image.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (!buffer.length || buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("Reference image is empty or exceeds the 10 MB limit.");
  }

  const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
  return {
    data: buffer,
    filename: `creator-reference-${index + 1}.${extension}`,
    contentType: mimeType,
  } satisfies ImageProviderReferenceInput;
}

async function loadReferenceImageFiles(
  characters: Character[] | undefined,
  limit: number,
) {
  if (!limit || !Array.isArray(characters)) {
    return { files: [] as ImageProviderReferenceInput[], warnings: [] as string[] };
  }

  const sources = Array.from(
    new Set(
      characters
        .map((character) => character.referenceImage?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, limit);
  const files: ImageProviderReferenceInput[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < sources.length; index += 1) {
    try {
      files.push(await referenceSourceToFile(sources[index], index));
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : "Reference image could not be prepared.",
      );
    }
  }

  return { files, warnings };
}

async function postHandler(req: Request) {
  let reservation: MeteredOperationReservation | null = null;
  let providerAccepted = false;
  let economicAttempt: EconomicOperationInput | null = null;
  let economicCost: EconomicCostResult | null = null;

  try {
    const principal = await authenticateRequest(req);
    const {
      title,
      sceneText,
      cameraDirection,
      emotion,
      motionHint,
      characters,
      visualBible,
      isThumbnail,
      isHookScene,
      imageUseCase,
      premiumVisualMode,
      useDefaultGuideCharacter,
      productProfile,
      qualityMode,
      creatorFormat,
      continuityMode,
      continuityContext,
      projectId,
      sceneId,
    }: {
      title?: string;
      sceneText?: string;
      cameraDirection?: string;
      emotion?: string;
      motionHint?: string;
      characters?: Character[];
      visualBible?: VisualBible | null;
      isThumbnail?: boolean;
      isHookScene?: boolean;
      imageUseCase?: CreatorImageUseCase;
      premiumVisualMode?: boolean;
      useDefaultGuideCharacter?: boolean;
      productProfile?: ImageProductProfile;
      qualityMode?: unknown;
      creatorFormat?: unknown;
      continuityMode?: CreatorResolvedContinuityMode;
      continuityContext?: SceneContinuityContext | null;
      projectId?: string;
      sceneId?: string | number;
    } = await req.json();

    if (!sceneText || !sceneText.trim()) {
      return NextResponse.json(
        { error: "sceneText zorunludur." },
        { status: 400 },
      );
    }

    const storageAllowance = await checkStorageGenerationAllowance(principal.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);

    const normalizedProductProfile: ImageProductProfile =
      productProfile === "creatorlab" ? "creatorlab" : "storyverse";
    const isCreatorLab = normalizedProductProfile === "creatorlab";
    const normalizedContinuityMode: CreatorResolvedContinuityMode =
      !isCreatorLab
        ? "consistent"
        : continuityMode === "consistent" || continuityMode === "previous"
          ? continuityMode
          : "independent";
    const normalizedImageUseCase: CreatorImageUseCase =
      imageUseCase ||
      (isThumbnail ? "thumbnail" : isHookScene ? "hook" : "scene");
    const creatorVisualRoute = isCreatorLab
      ? getCreatorVisualRoute({
          qualityMode,
          format: creatorFormat,
          imageUseCase: normalizedImageUseCase,
        })
      : null;

    const creatorSmartVisualPlan =
      isCreatorLab && creatorVisualRoute
        ? buildCreatorSmartVisualPlan({
            title,
            sceneText: sceneText.trim(),
            cameraDirection,
            emotion,
            motionHint,
            characters,
            visualBible,
            qualityMode: creatorVisualRoute.qualityMode,
            format: creatorVisualRoute.format,
            imageUseCase: normalizedImageUseCase,
            visualRoute: creatorVisualRoute,
            sceneIndex:
              typeof continuityContext?.sceneId === "number"
                ? Math.max(0, continuityContext.sceneId - 1)
                : undefined,
            sceneCount: continuityContext?.sceneCount,
            hasPreviousScene:
              normalizedContinuityMode !== "independent" &&
              Boolean(continuityContext?.previousScene),
            hasNextScene:
              normalizedContinuityMode === "consistent" &&
              Boolean(continuityContext?.nextScene),
          })
        : null;

    const smartSelectedCharacters = creatorSmartVisualPlan
      ? selectCreatorSceneCharacters(characters, creatorSmartVisualPlan)
      : characters;
    const effectiveCharacters =
      isCreatorLab &&
      normalizedContinuityMode !== "independent" &&
      (!smartSelectedCharacters || smartSelectedCharacters.length === 0) &&
      characters?.length
        ? [characters[0]]
        : smartSelectedCharacters;

    if (creatorVisualRoute && !creatorVisualRoute.generationAllowed) {
      return NextResponse.json(
        {
          error:
            "Draft mode is text-only. Select Standard, Pro or Cinematic before generating visuals.",
        },
        { status: 409 },
      );
    }

    const characterBlock = buildCharacterBlock(
      effectiveCharacters,
      Boolean(useDefaultGuideCharacter),
      normalizedProductProfile,
    );
    const visualBlock = buildVisualBlock(
      visualBible,
      normalizedProductProfile,
      normalizedContinuityMode,
    );
    const continuityBlock = buildContinuityBlock(
      continuityContext,
      normalizedContinuityMode,
      characters,
      visualBible,
    );
    const shouldUsePremiumVisuals = isCreatorLab
      ? creatorVisualRoute?.qualityMode === "pro" ||
        creatorVisualRoute?.qualityMode === "cinematic" ||
        Boolean(premiumVisualMode)
      : true;

    const formatInstructions = creatorVisualRoute
      ? creatorVisualRoute.composition === "vertical_mobile_safe"
        ? "Compose for a vertical 9:16 Shorts/Reels/TikTok frame. Keep the main subject, face, product, and essential action inside the central mobile-safe area. Use vertical depth and avoid wide-only staging."
        : creatorVisualRoute.composition === "wide_thumbnail_safe"
          ? "Compose for a wide 16:9 YouTube thumbnail. Use one dominant focal idea, strong curiosity, bold separation, and clean negative space for a short headline overlay."
          : "Compose for a wide 16:9 YouTube video frame. Use deliberate horizontal depth, clean editorial hierarchy, and safe framing for later crop/zoom decisions."
      : normalizedImageUseCase === "thumbnail"
        ? "Compose as a wide 16:9 child-safe Storyverse thumbnail with a large readable subject."
        : "Compose as a clear Storyverse scene frame with readable character action.";

    const qualityInstructions = creatorVisualRoute
      ? creatorVisualRoute.qualityMode === "cinematic"
        ? "Use maximum cinematic discipline and feature-film-grade photorealism when the brief requests real people: production lighting, physically believable materials, natural adult anatomy, realistic skin detail, deliberate lens behavior, atmosphere, depth, and fine texture. The frame must remain clean enough to anchor a premium motion block."
        : creatorVisualRoute.qualityMode === "pro"
          ? "Use strong professional art direction and high-end photorealism when the brief requests real people: natural adult facial structure, believable skin and hair, accurate hands and anatomy, refined lighting, clear subject hierarchy, and editorial depth suitable for a selective AI video block."
          : "Use a clean, consistent, credit-efficient creator frame with strong readability, natural anatomy, and enough visual depth for controlled image motion."
      : "Use premium 3D family-animation quality, child-safe visual storytelling, expressive acting, polished lighting, and a coherent Storyverse universe.";

    const productInstructions = isCreatorLab
      ? `
CREATORLAB VISUAL ROUTE:
- This is professional 18+ creator content, not a child-oriented Storyverse scene.
- Follow the brief and visual bible. Do not force cartoon, 3D animation, a child presenter, or a mascot.
- Support faceless, narrator-led, documentary, product-led, photorealistic, illustrative, motion-graphic, and character-led concepts.
- If a human subject is required, depict a clearly adult fictional person unless an authorized user-supplied reference image is attached. Do not imitate a public figure or unrelated real person.
- If Character Cast is empty, keep the production intentionally faceless unless the scene explicitly requires a person.
- Make the visual platform-native, mobile-readable, thumbnail-aware, and suitable for a publish-ready creator package.
- ${formatInstructions}
- ${qualityInstructions}
- Treat this generated asset as the canonical scene image${creatorVisualRoute?.frameRole === "scene_asset" ? " and image-motion source" : ", continuity reference, and first-frame candidate for later video blocks"}.
`
      : `
STORYVERSE VISUAL ROUTE:
- Keep the image child-safe, age-appropriate, emotionally clear, polished, and visually exciting.
- Preserve the established family-animation universe and any explicit Storyverse character design.
- ${formatInstructions}
- ${qualityInstructions}
`;

    const negativeGuidance = isCreatorLab
      ? `
Negative guidance:
- no default Joe, child guide, mascot, or cartoon treatment unless explicitly requested
- no unrequested style, realism-level, palette, lighting, wardrobe, product, or brand drift; validated explicit current-scene changes remain intentional
- no random presenter, celebrity lookalike, or extra lead-character invention
- no generic AI slideshow composition, cheap stock-photo look, waxy skin, plastic face, poster clutter, or unreadable micro-detail
- no inconsistent face, hair, age impression, outfit, accessory, or body proportions for locked cast
- no distorted hands, eyes, teeth, text, logos, products, or anatomy
- no forced text inside the image unless the brief explicitly requires it
`
      : `
Negative guidance:
- no alternate character design, inconsistent face, hair, outfit, age appearance, or proportions
- no random accessory, lead-character, realism, anime, or style shift
- no cheap vector art, low-detail cartoon look, generic AI slideshow look, or plastic toy look
- no muddy lighting, blurry face, distorted hands, distorted eyes, or broken anatomy
`;

    const continuityInstructions =
      normalizedContinuityMode === "independent"
        ? [
            "INDEPENDENT SCENE OVERRIDE:",
            "- Do not carry a recurring person, location, prop, product state, metaphor, background, weather, time of day, or screen direction from another scene unless this scene explicitly names it.",
            "- Do not force Character Cast members into this scene. Use only the effective cast selected from the current scene text.",
            "- Preserve format, production quality and broad brand/style direction, but allow deliberate visual variety.",
          ].join("\n")
        : normalizedContinuityMode === "previous"
          ? [
              "DIRECT CONTINUATION:",
              "- Continue the immediately previous scene as the next shot in the same sequence.",
              "- Preserve active character identity, wardrobe, location, time, lighting, prop state, screen direction, lens logic and motion handoff.",
              "- Change only what the current scene explicitly advances.",
            ].join("\n")
          : [
              "SHARED CHARACTER AND WORLD:",
              "- Preserve recurring character identity, face and world characteristics across linked scenes, except production facts explicitly marked as deliberate current-scene changes.",
              "- An explicit wardrobe change may change clothing only; it never permits face, age, hair, body-proportion or canonical identity drift.",
              "- Do not force the exact same shot or background when the current scene explicitly requests a new location, B-roll or metaphor.",
            ].join("\n");

    const imagePrompt = `
${normalizedContinuityMode === "independent"
  ? "Create one polished standalone still frame for this scene."
  : "Create one polished still frame from the SAME coherent production universe."}

Production title:
${title || (isCreatorLab ? "Untitled Creator Production" : "Untitled Story")}

Product context:
${productInstructions}

${
  creatorSmartVisualPlan
    ? `Smart Visuals direction:
${creatorSmartVisualPlan.promptBlock}
`
    : ""
}

Visual bible:
${visualBlock}

Canonical Character Cast / persona bible:
${characterBlock}

Scene to illustrate:
${sceneText.trim()}

Camera direction:
${cameraDirection || (isCreatorLab ? "professional creator framing with a clear focal subject" : "cinematic medium-wide shot")}

Emotion:
${emotion || (isCreatorLab ? "clear platform-appropriate emotional intent" : "wonder")}

Motion feeling:
${motionHint || (isCreatorLab ? "deliberate editorial movement with a clean motion handoff" : "gentle cinematic movement")}

Adjacent-scene continuity:
${continuityBlock}

High-priority continuity instructions:
${continuityInstructions}
- if a selected character reference image is attached, treat it as canonical for that selected character
- strongly follow the requested camera direction and express motion as a frame that can transition naturally into animation
${shouldUsePremiumVisuals ? "- use premium production detail and stronger depth without adding clutter" : "- keep the frame controlled, readable, consistent, and credit-efficient"}
${negativeGuidance}
${creatorSmartVisualPlan?.negativeGuidance || ""}

Output target:
${isCreatorLab ? "professional publish-ready creator asset" : "premium child-safe Storyverse frame"}, ${creatorVisualRoute?.targetAspectRatio || "Storyverse scene composition"}, clear focal idea, polished lighting, ${normalizedContinuityMode === "independent" ? "intentional scene-level variety" : "stable selected continuity"}.
`;

    const imageProvider = getMediaProviderFacade().image();
    const { storageAdmissionId } = await issueStorageAdmissionForOwner({
      ownerUserId: principal.id,
      mediaKind: "image",
      purpose: isCreatorLab ? "creator_generated_image" : "storyverse_generated_image",
      projectReference: typeof projectId === "string" ? projectId : null,
      metadata: { imageUseCase: normalizedImageUseCase },
    });

    reservation = await reserveMeteredOperation(req, {
      operationType: "creator_image",
      qualityMode,
      provider: imageProvider.key,
      referenceId: `${projectId || "draft"}:${normalizedImageUseCase}:${sceneId ?? "unknown"}`,
      metadata: {
        productProfile: normalizedProductProfile,
        projectId: projectId || null,
        sceneId: sceneId ?? null,
        imageUseCase: normalizedImageUseCase,
      },
      billable: isCreatorLab,
      requireCostGuardConfirmation: isCreatorLab,
    });

    const model = creatorVisualRoute?.imageModel || "gpt-image-1";
    const size =
      creatorVisualRoute?.imageSize ||
      (normalizedImageUseCase === "thumbnail" ? "1536x1024" : "1024x1024");
    const quality = creatorVisualRoute?.imageQuality || "high";
    const { files: referenceFiles, warnings: referenceWarnings } =
      isCreatorLab && creatorVisualRoute
        ? await loadReferenceImageFiles(
            effectiveCharacters,
            creatorVisualRoute.referenceImageLimit,
          )
        : { files: [], warnings: [] };

    const image = await imageProvider.generate({
      prompt: imagePrompt,
      model,
      size,
      quality,
      referenceImages: referenceFiles,
      referenceFidelity: "high",
    });
    providerAccepted = true;
    const logicalOperationId = req.headers.get("x-idempotency-key")?.trim() || reservation?.reservationId || `image:${image.requestId || crypto.randomUUID()}`;
    const normalizedUsage = normalizeOpenAIImageUsage(image.usage);
    economicCost = image.usage ? calculateOpenAIImageCost(model, normalizedUsage) : unknownCost("The image provider did not return usage; reference estimates are not actual cost.");
    economicAttempt = {
      attemptKey: `${logicalOperationId}:openai-image:1`, logicalOperationId, idempotencyKey: req.headers.get("x-idempotency-key"), creditReservationId: reservation?.reservationId,
      userId: principal.id, projectId: projectId || null, sceneId: sceneId ?? null, route: "/api/image", operationType: "creator_image", productTier: creatorVisualRoute?.qualityMode || null,
      provider: imageProvider.key, providerTier: imageProvider.tier, model, providerRequestId: image.requestId || null, state: "provider_billed", billingMoment: "provider_completed",
      quantities: { ...normalizedUsage, imageCount: 1, quality, dimensions: size, referenceCount: referenceFiles.length, requestCount: 1 }, cost: economicCost,
      dispatchedAt: new Date().toISOString(), providerAcceptedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    };
    await persistEconomicOperationBestEffort(economicAttempt);

    const chargedCredits = reservation?.reservedCredits || 0;
    const creditResult = reservation
      ? await settleMeteredOperation(reservation, {
          providerCostUsd: economicCost.providerCostUsd ?? undefined,
          providerRequestId: image.requestId,
          metadata: {
            model,
            size,
            quality,
            imageUseCase: normalizedImageUseCase,
            referenceInputApplied: image.referenceInputApplied,
          },
        })
      : null;
    reservation = null;

    return NextResponse.json({
      image: `data:image/png;base64,${image.base64}`,
      storageAdmissionId,
      usage: image.usage || null,
      credits: creditResult
        ? { chargedCredits, account: creditResult.account }
        : { chargedCredits: 0 },
      visualRoute: creatorVisualRoute
        ? {
            qualityMode: creatorVisualRoute.qualityMode,
            format: creatorVisualRoute.format,
            targetAspectRatio: creatorVisualRoute.targetAspectRatio,
            frameRole: creatorVisualRoute.frameRole,
            continuityStrength: creatorVisualRoute.continuityStrength,
            resolvedContinuityMode: normalizedContinuityMode,
            smartVisuals: creatorSmartVisualPlan
              ? {
                  version: creatorSmartVisualPlan.version,
                  archetype: creatorSmartVisualPlan.archetype,
                  castPolicy: creatorSmartVisualPlan.castPolicy,
                  selectedCharacterNames:
                    creatorSmartVisualPlan.selectedCharacterNames,
                  firstFrameRole: creatorSmartVisualPlan.firstFrameRole,
                  referenceFrameKey:
                    creatorSmartVisualPlan.referenceFrameKey,
                }
              : undefined,
            model: creatorVisualRoute.imageModel,
            quality: creatorVisualRoute.imageQuality,
            size: creatorVisualRoute.imageSize,
            referenceInputApplied: image.referenceInputApplied,
            referenceInputCount: referenceFiles.length,
            referenceWarnings,
          }
        : {
            productProfile: "storyverse",
            model: "gpt-image-1",
            quality: "high",
            size,
          },
    });
  } catch (error) {
    if (reservation) {
      if (providerAccepted) {
        await persistEconomicOperationBestEffort({ ...(economicAttempt || { attemptKey: `${reservation.reservationId}:openai-image:1`, logicalOperationId: reservation.reservationId, userId: reservation.userId, route: "/api/image", operationType: "creator_image", state: "application_failed_after_provider_cost" }), state: "application_failed_after_provider_cost", ambiguityReason: error instanceof Error ? error.message : "downstream_failure", failedAt: new Date().toISOString() });
        try { await settleMeteredOperation(reservation, { providerCostUsd: economicCost?.providerCostUsd ?? undefined, metadata: { applicationFailedAfterProviderCost: true } }); } catch {}
      } else await releaseMeteredOperation(reservation, "image_generation_failed", { route: "image" });
    }

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: "A valid session is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof StorageQuotaOperationalError) return storageQuotaOperationalErrorResponse(error);
    const creditErrorResponse = getCreditErrorResponse(error);
    if (creditErrorResponse) return creditErrorResponse;

    console.error("image error:", error);

    return NextResponse.json(
      {
        error: getProviderPublicMessage(
          error,
          "Görsel oluşturulurken hata oluştu.",
        ),
      },
      { status: 500 },
    );
  }
}

export const POST = withObservedApiRoute("api.image.generate", postHandler);
