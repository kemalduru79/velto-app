import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      projectId,
      childId,
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

    if (!childId) {
      return NextResponse.json(
        { error: "childId zorunlu" },
        { status: 400 }
      );
    }

    if (projectId) {
      const { data, error } = await supabase
        .from("velto_projects")
        .update({
          child_id: childId,
          title,
          input_prompt: inputPrompt || "",
          story_premise: storyPremise || "",
          visual_bible: visualBible || {},
          characters: characters || [],
          scenes: scenes || [],
        })
        .eq("id", projectId)
        .eq("owner_user_id", user.id)
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
          owner_user_id: user.id,
          child_id: childId,
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