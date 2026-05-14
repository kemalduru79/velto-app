import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type CareerSessionPayload = {
  id?: string;
  child_id?: string | null;
  profession_key?: string;
  profession_title?: string;
  mission_title?: string;
  language?: "tr" | "en";
  status?: "draft" | "completed";
  decision_answers?: Record<string, unknown>;
  trait_profile?: Record<string, unknown>;
  session_snapshot?: Record<string, unknown>;
  final_report_markdown?: string | null;
  ai_narrative_report?: string | null;
  cinematic_recap_blueprint?: Record<string, unknown> | null;
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authHeader.slice("bearer ".length).trim();
}

async function getAuthenticatedUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing");
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await userClient.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

function normalizeLanguage(value: unknown): "tr" | "en" {
  return value === "en" ? "en" : "tr";
}

function safeObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizePayload(body: CareerSessionPayload, userId: string) {
  return {
    user_id: userId,
    child_id: body.child_id || null,
    profession_key: asText(body.profession_key, "unknown"),
    profession_title: asText(body.profession_title, "Career Lab"),
    mission_title: asText(body.mission_title, "Interactive Profession Simulation"),
    language: normalizeLanguage(body.language),
    status: body.status === "completed" ? "completed" : "draft",
    decision_answers: safeObject(body.decision_answers),
    trait_profile: safeObject(body.trait_profile),
    session_snapshot: safeObject(body.session_snapshot),
    final_report_markdown:
      typeof body.final_report_markdown === "string" ? body.final_report_markdown : null,
    ai_narrative_report:
      typeof body.ai_narrative_report === "string" ? body.ai_narrative_report : null,
    cinematic_recap_blueprint: body.cinematic_recap_blueprint
      ? safeObject(body.cinematic_recap_blueprint)
      : null,
  };
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status }
  );
}

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("id");
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

    const supabase = getSupabaseAdminClient();

    if (sessionId) {
      const { data, error } = await supabase
        .from("career_lab_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        return errorResponse(error.message, 404);
      }

      return NextResponse.json({
        ok: true,
        session: data,
      });
    }

    const { data, error } = await supabase
      .from("career_lab_sessions")
      .select(
        "id, child_id, profession_key, profession_title, mission_title, language, status, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      ok: true,
      sessions: data || [],
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Career session list failed.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = (await req.json()) as CareerSessionPayload;
    const payload = normalizePayload(body, user.id);
    const supabase = getSupabaseAdminClient();

    if (body.id) {
      const { data, error } = await supabase
        .from("career_lab_sessions")
        .update(payload)
        .eq("id", body.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return NextResponse.json({
        ok: true,
        session: data,
        mode: "updated",
      });
    }

    const { data, error } = await supabase
      .from("career_lab_sessions")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      ok: true,
      session: data,
      mode: "created",
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Career session save failed.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("id");

    if (!sessionId) {
      return errorResponse("Missing session id", 400);
    }

    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("career_lab_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      ok: true,
      deleted: sessionId,
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Career session delete failed.", 500);
  }
}
