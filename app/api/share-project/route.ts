import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

function createShareId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "";

    if (!projectId) {
      return NextResponse.json({ error: "projectId zorunlu." }, { status: 400 });
    }

    const { data: existingProject, error: existingProjectError } = await supabase
      .from("velto_projects")
      .select("id, owner_user_id, share_id")
      .eq("id", projectId)
      .single();

    if (existingProjectError || !existingProject) {
      return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
    }

    if (existingProject.owner_user_id !== user.id) {
      return NextResponse.json(
        { error: "Bu proje için paylaşım linki oluşturma yetkin yok." },
        { status: 403 }
      );
    }

    let shareId = existingProject.share_id || "";

    if (!shareId) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = createShareId();

        const { data: collision } = await supabase
          .from("velto_projects")
          .select("id")
          .eq("share_id", candidate)
          .maybeSingle();

        if (!collision) {
          shareId = candidate;
          break;
        }
      }
    }

    if (!shareId) {
      return NextResponse.json(
        { error: "Benzersiz paylaşım ID'si üretilemedi." },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("velto_projects")
      .update({
        share_id: shareId,
        is_public: true,
        published_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("owner_user_id", user.id)
      .select("id, share_id, is_public, published_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Paylaşım linki oluşturulamadı." },
        { status: 500 }
      );
    }

    const origin = req.headers.get("origin") || "";
    const shareUrl = origin ? `${origin}/episode/public/${shareId}` : "";

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl,
      project: data,
    });
  } catch (e: any) {
    console.error("share-project error:", e);

    return NextResponse.json(
      { error: e?.message || "Paylaşım linki oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}
