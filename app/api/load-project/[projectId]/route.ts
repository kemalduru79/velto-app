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

    const { data, error } = await supabase
      .from("velto_projects")
      .select("*")
      .eq("id", projectId)
      .eq("owner_user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Proje bulunamadı ya da erişim yetkin yok." },
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
