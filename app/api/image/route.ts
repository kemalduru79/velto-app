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
    "short slightly messy brown hair, large green eyes, expressive friendly face",
  outfit: "yellow hoodie and blue jeans",
  accessory: "",
  personality:
    "curious, energetic, slightly playful, brave, problem solver, asks simple questions that help children understand the topic",
  referenceImage: "",
};

function normalizeNameForCharacter(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureDefaultGuideCharacter(characters?: Character[]) {
  const safeCharacters = Array.isArray(characters) ? characters : [];
  const hasJoe = safeCharacters.some(
    (character) => normalizeNameForCharacter(character?.name) === "joe",
  );

  if (hasJoe) {
    return safeCharacters.map((character) =>
      normalizeNameForCharacter(character?.name) === "joe"
        ? {
            ...DEFAULT_GUIDE_CHARACTER,
            ...character,
            name: "Joe",
            age: character.age || DEFAULT_GUIDE_CHARACTER.age,
            appearance:
              character.appearance || DEFAULT_GUIDE_CHARACTER.appearance,
            outfit: character.outfit || DEFAULT_GUIDE_CHARACTER.outfit,
            accessory: character.accessory ?? DEFAULT_GUIDE_CHARACTER.accessory,
            personality:
              character.personality || DEFAULT_GUIDE_CHARACTER.personality,
          }
        : character,
    );
  }

  return [DEFAULT_GUIDE_CHARACTER, ...safeCharacters];
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

function buildCharacterBlock(characters?: Character[]) {
  const effectiveCharacters = ensureDefaultGuideCharacter(characters);

  return effectiveCharacters
    .map((character, index) => {
      const hasReference = Boolean(character.referenceImage);

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
- Joe is the primary recurring guide character and must remain visually identical whenever he appears.
- This character MUST look IDENTICAL across all scenes.
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
  if (!visualBible) {
    return `
Style: warm child-friendly animated film
Palette: soft vibrant colors
Camera: cinematic family animation framing
Consistency rules: same character face, same hair, same outfit, same age appearance, same proportions across scenes
`;
  }

  return `
Style: ${visualBible.style}
Palette: ${visualBible.palette}
Camera: ${visualBible.camera}
Consistency rules: ${visualBible.consistencyRules}
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
    } = await req.json();

    if (!sceneText || !sceneText.trim()) {
      return NextResponse.json(
        { error: "sceneText zorunludur." },
        { status: 400 },
      );
    }

    const characterBlock = buildCharacterBlock(characters);
    const visualBlock = buildVisualBlock(visualBible);
    const normalizedImageUseCase =
      imageUseCase ||
      (isThumbnail ? "thumbnail" : isHookScene ? "hook" : "scene");
    const shouldUsePremiumVisuals = Boolean(
      premiumVisualMode ||
      isThumbnail ||
      isHookScene ||
      normalizedImageUseCase === "thumbnail" ||
      normalizedImageUseCase === "hook",
    );

    const premiumVisualInstructions = shouldUsePremiumVisuals
      ? `
PREMIUM VISUAL LAYER:
- This is a high-impact ${normalizedImageUseCase === "thumbnail" ? "YouTube thumbnail / hero marketing image" : "hook scene / opening hero frame"}.
- Use premium animated movie quality, strong emotional readability, and high visual impact.
- Make Joe's facial expression highly readable and engaging.
- Prioritize a clean, bold composition with one dominant visual idea.
- Use cinematic lighting, stronger contrast, and clear subject separation.
- Avoid clutter, small unreadable details, and overly wide compositions.
- Keep the image child-friendly but visually exciting and clickable.
- For thumbnails, compose with a wide 16:9 crop in mind, with the main subject large and centered.
`
      : `
STANDARD VISUAL LAYER:
- Use consistent, polished scene quality while preserving cost-aware production.
- Prioritize continuity, clarity, and readability over excessive detail.
`;

    const imagePrompt = `
Create a polished still frame from the SAME children's animated film universe.

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
- Joe must stay visually consistent as the recurring guide character
- Joe should not be redesigned, renamed, removed, aged up, aged down, or replaced
- if a reference image exists, treat it as the ONLY valid design
- do not generate alternative versions of the same character
- do not create visual variations
- this is NOT a new interpretation of the characters
- this is the SAME cast from the same film
- preserve the exact same hero design across scenes
- preserve the same face structure, eye shape, nose proportions, hair design, age feeling, outfit, and accessory
- if multiple siblings or multiple children exist, preserve their count and do not merge or remove them
- do not swap genders
- do not change ethnicity cues unless explicitly required by the story
- do not generate a new costume unless the scene explicitly describes a costume change
- do not make the characters look older, younger, taller, or shorter than before
- do not replace the main characters with visually different alternatives
- avoid random extra main characters
- keep all characters readable and child-friendly
- keep the same animation universe, same design language, same art direction

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
- no new lead character invention

Output style:
${
  shouldUsePremiumVisuals
    ? "premium high-impact animated movie frame, strong YouTube visual appeal, consistent characters, polished cinematic lighting, bold readable composition, child-friendly, same film continuity"
    : "high-quality animated movie frame, consistent characters, polished lighting, cinematic composition, child-friendly, storybook warmth, same film continuity"
}
`;

    const imageRequest: any = {
      model: "gpt-image-1",
      prompt: imagePrompt,
      size:
        shouldUsePremiumVisuals && normalizedImageUseCase === "thumbnail"
          ? "1536x1024"
          : "1024x1024",
      quality: shouldUsePremiumVisuals ? "high" : "medium",
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
