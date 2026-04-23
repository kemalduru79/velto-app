import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Yetkisiz istek." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Geçersiz oturum." },
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
      language,
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

    const { data: childRecord, error: childError } = await supabase
      .from("children")
      .select("id, parent_id")
      .eq("id", childId)
      .eq("parent_id", user.id)
      .single();

    if (childError || !childRecord) {
      return NextResponse.json(
        { error: "Bu çocuk profiline erişim yetkin yok." },
        { status: 403 }
      );
    }

    if (projectId) {
      const { data: existingProject, error: existingProjectError } = await supabase
        .from("velto_projects")
        .select("id, owner_user_id")
        .eq("id", projectId)
        .single();

      if (existingProjectError || !existingProject) {
        return NextResponse.json(
          { error: "Proje bulunamadı." },
          { status: 404 }
        );
      }

      if (existingProject.owner_user_id !== user.id) {
        return NextResponse.json(
          { error: "Bu projeyi güncelleme yetkin yok." },
          { status: 403 }
        );
      }

      const { data, error } = await supabase
        .from("velto_projects")
        .update({
          owner_user_id: user.id,
          child_id: childId,
          title,
          input_prompt: inputPrompt || "",
          story_premise: storyPremise || "",
          language: language === "en" ? "en" : "tr",
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
          owner_user_id: user.id,
          child_id: childId,
          title,
          input_prompt: inputPrompt || "",
          story_premise: storyPremise || "",
          language: language === "en" ? "en" : "tr",
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
