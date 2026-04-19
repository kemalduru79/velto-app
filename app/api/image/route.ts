import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

function buildCharacterBlock(characters?: Character[]) {
  if (!Array.isArray(characters) || characters.length === 0) {
    return "No character bible provided.";
  }

  return characters
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
Reference status: ${hasReference ? "A reference design image has already been generated for this character. Treat that prior design as the canonical look." : "No reference image generated yet. Use the written character bible as canonical."}

Canonical design rules for this character:
- keep the same face shape
- keep the same hair style and hair color
- keep the same apparent age
- keep the same outfit unless the scene explicitly requires a change
- keep the same accessory unless the scene explicitly requires a change
- keep the same body proportions
- do not redesign or reinterpret this character
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
    const {
      title,
      sceneText,
      cameraDirection,
      emotion,
      motionHint,
      characters,
      visualBible,
    }: {
      title?: string;
      sceneText?: string;
      cameraDirection?: string;
      emotion?: string;
      motionHint?: string;
      characters?: Character[];
      visualBible?: VisualBible | null;
    } = await req.json();

    if (!sceneText || !sceneText.trim()) {
      return NextResponse.json(
        { error: "sceneText zorunludur." },
        { status: 400 }
      );
    }

    const characterBlock = buildCharacterBlock(characters);
    const visualBlock = buildVisualBlock(visualBible);

    const imagePrompt = `
Create a polished still frame from the SAME children's animated film universe.

Story title:
${title || "Untitled Story"}

This image must preserve character continuity with previously generated scenes from the same story.

Visual bible:
${visualBlock}

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
high-quality animated movie frame, consistent characters, polished lighting, cinematic composition, child-friendly, storybook warmth, same film continuity
`;

    const image = await client.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024",
    });

    const base64 = image.data?.[0]?.b64_json;

    if (!base64) {
      return NextResponse.json(
        { error: "Görsel üretilemedi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
    });
  } catch (error) {
    console.error("image error:", error);
    return NextResponse.json(
      { error: "Görsel oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}