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
};

type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
};

export async function POST(req: Request) {
  try {
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
Create a character reference sheet style portrait for a children's animated film.

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
Consistency rules: ${visualBible?.consistencyRules || "keep same face, same hair, same outfit, same age look"}

Instructions:
- show only this character as the clear main subject
- create a clean reference-style image
- keep the face, hair, outfit, and proportions very readable
- child-friendly animated movie design
- no crowded background
- no extra main characters
- polished lighting
- strong character clarity
`;

    const image = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
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
    return NextResponse.json(
      { error: "Karakter referans görseli oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}