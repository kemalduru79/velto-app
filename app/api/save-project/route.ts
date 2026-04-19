import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();

    const body = await req.json();
    const {
      projectId,
      title,
      inputPrompt,
      storyPremise,
      characters,
      visualBible,
      scenes,
    } = body;

    if (!title || !scenes) {
      return NextResponse.json(
        { error: "title ve scenes zorunlu" },
        { status: 400 }
      );
    }

    if (projectId) {
      const { data, error } = await supabase
        .from("velto_projects")
        .update({
          title,
          input_prompt: inputPrompt || "",
          story_premise: storyPremise || "",
          visual_bible: visualBible || {},
          characters: characters || [],
          scenes: scenes || [],
        })
        .eq("id", projectId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "updated",
        project: data,
      });
    }

    const { data, error } = await supabase
      .from("velto_projects")
      .insert([
        {
          title,
          input_prompt: inputPrompt || "",
          story_premise: storyPremise || "",
          visual_bible: visualBible || {},
          characters: characters || [],
          scenes: scenes || [],
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "created",
      project: data,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Kayıt sırasında hata oluştu" },
      { status: 500 }
    );
  }
}