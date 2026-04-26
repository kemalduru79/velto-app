import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function GET(
  req: Request,
  context: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await context.params;

    if (!shareId) {
      return NextResponse.json({ error: "shareId zorunlu." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("velto_projects")
      .select(
        "id, title, input_prompt, story_premise, language, visual_bible, characters, scenes, share_id, is_public, published_at, created_at, updated_at"
      )
      .eq("share_id", shareId)
      .eq("is_public", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Public episode bulunamadı ya da paylaşım kapalı." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project: data,
    });
  } catch (e: any) {
    console.error("public-project error:", e);

    return NextResponse.json(
      { error: e?.message || "Public episode yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}
