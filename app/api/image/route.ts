import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

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

const DEFAULT_GUIDE_CHARACTER: Character = {
  name: "Joe",
  age: "10",
  appearance:
    "10-year-old boy with short slightly messy brown hair, large green eyes, soft rounded face, expressive friendly face, childlike proportions, consistent face shape and eye shape",
  outfit: "red baseball cap, blue t-shirt with a clear rocket logo, simple blue jeans, simple white sneakers; the cap, rocket t-shirt, jeans, and sneakers must stay the same across episodes unless explicitly changed",
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
) {
  const safeCharacters = Array.isArray(characters) ? characters : [];
  const hasJoe = safeCharacters.some(
    (character) => normalizeNameForCharacter(character?.name) === "joe",
  );

  const normalizedCharacters = safeCharacters.map((character) =>
    normalizeNameForCharacter(character?.name) === "joe"
      ? {
          ...DEFAULT_GUIDE_CHARACTER,
          ...character,
          name: "Joe",
          age: character.age || DEFAULT_GUIDE_CHARACTER.age,
          appearance: character.appearance || DEFAULT_GUIDE_CHARACTER.appearance,
          outfit: character.outfit || DEFAULT_GUIDE_CHARACTER.outfit,
          accessory: character.accessory ?? DEFAULT_GUIDE_CHARACTER.accessory,
          personality: character.personality || DEFAULT_GUIDE_CHARACTER.personality,
        }
      : character,
  );

  if (!hasJoe && useDefaultGuideCharacter) {
    return [DEFAULT_GUIDE_CHARACTER, ...normalizedCharacters];
  }

  return normalizedCharacters;
}


function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({
    apiKey,
  });
}

function buildCharacterBlock(
  characters?: Character[],
  useDefaultGuideCharacter = false,
) {
  const effectiveCharacters = normalizeCharactersForPrompt(
    characters,
    useDefaultGuideCharacter,
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
      const hasReference = Boolean(character.referenceImage);
      const isJoe = normalizeNameForCharacter(character?.name) === "joe";

      return `
Character ${index + 1}
Name: ${character.name || "Unnamed"}
Age: ${character.age || "Unknown"}
Appearance: ${character.appearance || "Not specified"}
Outfit: ${character.outfit || "Not specified"}
Accessory: ${character.accessory || "No accessory"}
Personality: ${character.personality || "Not specified"}

REFERENCE IMAGE STATUS:
${
  hasReference
    ? "A reference design image exists for this character. Treat that design as the canonical master look."
    : "No reference image exists yet. Use the written character bible as the canonical look."
}

REFERENCE IMAGE VALUE:
${character.referenceImage || "No reference image yet"}

CRITICAL CHARACTER LOCK:
- This character MUST look IDENTICAL whenever the same character appears across scenes.
${isJoe ? "- Joe was explicitly provided, so preserve Joe's established identity exactly." : "- This is a user-defined character, not a default Joe mascot."}
- If a reference image exists, it OVERRIDES all text description.
- NEVER redesign this character.
- NEVER change face shape.
- NEVER change eye shape.
- NEVER change nose proportions.
- NEVER change hairstyle or hair color.
- NEVER change outfit unless the scene explicitly requires it.
- NEVER change accessory unless the scene explicitly requires it.
- NEVER change body proportions.
- NEVER change apparent age.
- NEVER swap gender.
- NEVER merge this character with another character.
- NEVER invent a visually different replacement.

STRICT VISUAL LOCK:
- Treat the reference image as the FINAL DESIGN when available.
- Do not reinterpret the character.
- Do not stylize the character differently.
- Do not drift from the established animation universe.
- Same character means same exact visual identity.
`;
    })
    .join("\n");
}

function buildVisualBlock(visualBible?: VisualBible | null) {
  const defaultStyle =
    "premium 3D animated feature film look, cinematic but child-friendly, expressive characters, detailed environments, polished lighting, not flat 2D";
  const defaultPalette =
    "rich vibrant colors, warm highlights, clean contrast, soft cinematic shadows, premium family animation color grading";
  const defaultCamera =
    "cinematic family animation framing, clear subject separation, readable facial expression, strong depth, professional composition";
  const defaultConsistencyRules =
    "same character face, same hair, same red baseball cap, same blue rocket-logo t-shirt, same outfit, same age appearance, same proportions across scenes";

  return `
Style: ${visualBible?.style || defaultStyle}
Palette: ${visualBible?.palette || defaultPalette}
Camera: ${visualBible?.camera || defaultCamera}
Consistency rules: ${visualBible?.consistencyRules || defaultConsistencyRules}
`;
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();

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
      imageUseCase?: "scene" | "thumbnail" | "hook";
      premiumVisualMode?: boolean;
      useDefaultGuideCharacter?: boolean;
    } = await req.json();

    if (!sceneText || !sceneText.trim()) {
      return NextResponse.json(
        { error: "sceneText zorunludur." },
        { status: 400 },
      );
    }

    const characterBlock = buildCharacterBlock(characters, Boolean(useDefaultGuideCharacter));
    const visualBlock = buildVisualBlock(visualBible);
    const normalizedImageUseCase =
      imageUseCase ||
      (isThumbnail ? "thumbnail" : isHookScene ? "hook" : "scene");
    const shouldUsePremiumVisuals = true;

    const premiumVisualInstructions = shouldUsePremiumVisuals
      ? `
PREMIUM VISUAL LAYER:
- This is a high-impact ${normalizedImageUseCase === "thumbnail" ? "YouTube thumbnail / hero marketing image" : normalizedImageUseCase === "hook" ? "hook scene / opening hero frame" : "premium story scene frame"}.
- Use premium 3D animated feature film quality with strong emotional readability and high visual impact.
- Make the primary subject or key visual idea highly readable and engaging.
- Prioritize a clean, bold composition with one dominant visual idea.
- Use cinematic lighting, professional color grading, stronger contrast, and clear subject separation.
- Use detailed but controlled environments: rich enough to feel premium, never cluttered.
- Keep the image child-friendly but visually exciting, polished, and production-ready.
- For thumbnails, compose with a wide 16:9 crop in mind, with the main subject large and centered.
- Avoid the look of a generic AI slideshow; every frame must feel like a still from the same premium animated film universe.
`
      : `
STANDARD VISUAL LAYER:
- Use premium scene quality as the default baseline.
- Prioritize continuity, clarity, and readability while keeping the frame cinematic and detailed.
`;

    const imagePrompt = `
Create a polished still frame from the SAME coherent visual universe.

Story title:
${title || "Untitled Story"}

This image must preserve character continuity with previously generated scenes from the same story.

Visual bible:
${visualBlock}
${premiumVisualInstructions}
Canonical character bible:
${characterBlock}

Scene to illustrate:
${sceneText.trim()}

Camera direction:
${cameraDirection || "cinematic medium-wide shot"}

Emotion of the scene:
${emotion || "wonder"}

Motion feeling:
${motionHint || "gentle cinematic movement"}

High-priority continuity instructions:
- do not inject Joe or any default mascot unless it is explicitly present in the character bible or scene request
- if a reference image exists, treat it as the ONLY valid design
- do not generate alternative versions of the same character
- do not create visual variations for established characters
- this is NOT a new interpretation of the characters or visual universe
- preserve the exact same hero design when a hero character is provided
- preserve face structure, eye shape, nose proportions, hair design, age feeling, outfit, and accessory for all locked characters
- if multiple siblings, multiple children, presenters, or objects exist, preserve their count and do not merge or remove them
- do not swap genders
- do not change ethnicity cues unless explicitly required by the story
- do not generate a new costume unless the scene explicitly describes a costume change
- do not make characters look older, younger, taller, or shorter than before
- do not replace main characters with visually different alternatives
- avoid random extra main characters
- keep all characters readable and appropriate for the requested product context
- keep the same visual universe, same design language, same art direction

Cinematic direction:
- strongly follow the requested camera direction
- make the emotional tone visible in facial expression, posture, lighting, and composition
- reflect the motion feeling as a frozen cinematic moment
- prioritize character clarity over busy backgrounds
- use expressive but stable character acting
- preserve continuity more than novelty

Negative guidance:
- no alternate character design
- no redesigned character identity
- no inconsistent face
- no inconsistent hair
- no inconsistent outfit
- no inconsistent age appearance
- no redesign
- no different haircut
- no different face proportions
- no different outfit
- no random accessory change
- no style drift
- no realism shift
- no anime shift unless explicitly requested in the visual bible
- no flat 2D look
- no cheap vector art
- no low-detail cartoon look
- no generic AI slideshow look
- no plastic toy look
- no muddy lighting
- no blurry character face
- no distorted hands, distorted eyes, or broken anatomy
- no new lead character invention

Output style:
${
  shouldUsePremiumVisuals
    ? "premium high-impact production frame, strong platform visual appeal, consistent characters or visual universe, polished cinematic lighting, bold readable composition, same timeline continuity"
    : "high-quality production frame, consistent characters or visual universe, polished lighting, cinematic composition, same timeline continuity"
}
`;

    const imageRequest: any = {
      model: "gpt-image-1",
      prompt: imagePrompt,
      size:
        normalizedImageUseCase === "thumbnail" ? "1536x1024" : "1024x1024",
      quality: "high",
    };

    const image = await client.images.generate(imageRequest);

    const base64 = image.data?.[0]?.b64_json;

    if (!base64) {
      return NextResponse.json(
        { error: "Görsel üretilemedi." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
    });
  } catch (error) {
    console.error("image error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Görsel oluşturulurken hata oluştu.";

    return NextResponse.json(
      { error: message || "Görsel oluşturulurken hata oluştu." },
      { status: 500 },
    );
  }
}
