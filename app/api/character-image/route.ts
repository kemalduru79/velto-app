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
};

type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({
    apiKey,
  });
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();

    const {
      title,
      character,
      visualBible,
    }: {
      title?: string;
      character?: Character;
      visualBible?: VisualBible;
    } = await req.json();

    if (!character || !character.name?.trim()) {
      return NextResponse.json(
        { error: "Karakter bilgisi zorunludur." },
        { status: 400 }
      );
    }

    const prompt = `
Create a premium character reference sheet style portrait for a children's 3D animated feature film.

Story title:
${title || "Untitled Story"}

Character:
Name: ${character.name}
Age: ${character.age}
Appearance: ${character.appearance}
Outfit: ${character.outfit}
Accessory: ${character.accessory || "No accessory"}
Personality: ${character.personality}

Visual bible:
Style: ${visualBible?.style || "warm child-friendly animated film"}
Palette: ${visualBible?.palette || "soft vibrant colors"}
Camera: ${visualBible?.camera || "clean character presentation"}
Consistency rules: ${
      visualBible?.consistencyRules ||
      "keep same face, same hair, same outfit, same age look"
    }

CRITICAL:
This generated image will be used as the MASTER reference for all future scenes.

Requirements:
- extremely clear face
- extremely clear hairstyle and hair color
- extremely clear outfit
- extremely readable silhouette
- no ambiguity in design
- must be reusable across multiple scenes
- avoid temporary props that could confuse the canonical design
- avoid dramatic lighting that hides the character identity

Instructions:
- show only this character as the clear main subject
- create a clean reference-style image
- keep the face, hair, outfit, and proportions very readable
- premium 3D animated movie design, not flat 2D
- cinematic but clean studio lighting
- expressive face with strong emotional readability
- detailed but simple child-friendly design
- no crowded background
- no extra main characters
- polished lighting
- strong character clarity
- stable front-facing or three-quarter character presentation
- clean, reusable master character identity
- avoid cheap vector art, low-detail cartoon style, generic AI slideshow style, plastic toy look, distorted anatomy, unreadable face, and style drift
`;

    const image = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "high",
    });

    const base64 = image.data?.[0]?.b64_json;

    if (!base64) {
      return NextResponse.json(
        { error: "Karakter görseli üretilemedi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
    });
  } catch (error) {
    console.error("character-image error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Karakter referans görseli oluşturulurken hata oluştu.";

    return NextResponse.json(
      { error: message || "Karakter referans görseli oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}