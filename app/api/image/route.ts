import { NextResponse } from "next/server";
import { getImageProvider, getProviderPublicMessage } from "@/lib/providers";
import type { ImageProviderReferenceInput } from "@/lib/providers/image";
import {
  getCreatorVisualRoute,
  type CreatorImageUseCase,
} from "../../../lib/creator/visualRouting";

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
  const defaultConsistencyRules = isCreatorLab
    ? "preserve the same cast identity, brand language, lighting logic, palette, realism level, lens language, and editorial universe across every scene"
    : "same character face, same hair, same outfit, same age appearance, same proportions, and same family-animation universe across scenes";

  return `
Style: ${visualBible?.style || defaultStyle}
Palette: ${visualBible?.palette || defaultPalette}
Camera: ${visualBible?.camera || defaultCamera}
Consistency rules: ${visualBible?.consistencyRules || defaultConsistencyRules}
`;
}

function buildContinuityBlock(context?: SceneContinuityContext | null) {
  if (!context) {
    return "No adjacent-scene context supplied. Follow the visual bible and cast lock as the canonical continuity source.";
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

  return [
    `Timeline position: scene ${context.sceneId || "?"} of ${context.sceneCount || "?"}`,
    describeScene("Previous scene", context.previousScene),
    describeScene("Next scene", context.nextScene),
    "Keep a deliberate visual handoff from the previous beat and leave a natural composition/motion handoff into the next beat.",
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

export async function POST(req: Request) {
  try {
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
      continuityContext,
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
      continuityContext?: SceneContinuityContext | null;
    } = await req.json();

    if (!sceneText || !sceneText.trim()) {
      return NextResponse.json(
        { error: "sceneText zorunludur." },
        { status: 400 },
      );
    }

    const normalizedProductProfile: ImageProductProfile =
      productProfile === "creatorlab" ? "creatorlab" : "storyverse";
    const isCreatorLab = normalizedProductProfile === "creatorlab";
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
      characters,
      Boolean(useDefaultGuideCharacter),
      normalizedProductProfile,
    );
    const visualBlock = buildVisualBlock(
      visualBible,
      normalizedProductProfile,
    );
    const continuityBlock = buildContinuityBlock(continuityContext);
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
- no style, realism-level, palette, lighting, wardrobe, product, or brand drift
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

    const imagePrompt = `
Create one polished still frame from the SAME coherent production universe.

Production title:
${title || (isCreatorLab ? "Untitled Creator Production" : "Untitled Story")}

Product context:
${productInstructions}

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
- preserve the visual bible as the single art-direction source across all scenes
- preserve every user-defined cast member's identity, face, age impression, outfit, accessory, visual role, and behavior
- if a character reference image is attached, treat it as canonical and do not reinterpret that identity
- preserve palette, lighting logic, lens/camera language, texture level, realism level, brand cues, and editorial rhythm
- keep the number and role of recurring people, products, props, and key objects stable
- prioritize continuity over novelty while making this scene advance the visual story
- strongly follow the requested camera direction and express motion as a frame that can transition naturally into animation
${shouldUsePremiumVisuals ? "- use premium production detail and stronger depth without adding clutter" : "- keep the frame controlled, readable, consistent, and credit-efficient"}
${negativeGuidance}

Output target:
${isCreatorLab ? "professional publish-ready creator asset" : "premium child-safe Storyverse frame"}, ${creatorVisualRoute?.targetAspectRatio || "Storyverse scene composition"}, coherent cast or faceless visual universe, clear focal idea, polished lighting, stable continuity.
`;

    const imageProvider = getImageProvider();
    const model = creatorVisualRoute?.imageModel || "gpt-image-1";
    const size =
      creatorVisualRoute?.imageSize ||
      (normalizedImageUseCase === "thumbnail" ? "1536x1024" : "1024x1024");
    const quality = creatorVisualRoute?.imageQuality || "high";
    const { files: referenceFiles, warnings: referenceWarnings } =
      isCreatorLab && creatorVisualRoute
        ? await loadReferenceImageFiles(
            characters,
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

    return NextResponse.json({
      image: `data:image/png;base64,${image.base64}`,
      usage: image.usage || null,
      visualRoute: creatorVisualRoute
        ? {
            qualityMode: creatorVisualRoute.qualityMode,
            format: creatorVisualRoute.format,
            targetAspectRatio: creatorVisualRoute.targetAspectRatio,
            frameRole: creatorVisualRoute.frameRole,
            continuityStrength: creatorVisualRoute.continuityStrength,
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
