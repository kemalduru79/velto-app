import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function GET(
  req: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId zorunlu" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("velto_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Proje bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project: data,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Yükleme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}