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
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
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
      exportedMovieUrl,
      exportedMovieResult,
      exportSignature,
      flowType,
      flowKey,
      creatorMentorResult,
      creatorProductionPackage,
      youtubeMetadataResult,
      youtubeThumbnailResult,
      sceneOptimizationResult,
      sceneOptimizationSummary,
      refinedCreatorScenes,
    } = body;

    if (!title || !scenes) {
      return NextResponse.json({ error: "title ve scenes zorunlu" }, { status: 400 });
    }

    if (!childId) {
      return NextResponse.json({ error: "childId zorunlu" }, { status: 400 });
    }

    const requestedFlowType =
      typeof flowType === "string" && flowType.trim()
        ? flowType.trim()
        : typeof flowKey === "string" && flowKey.trim()
          ? flowKey.trim()
          : "storyverse";

    const normalizedFlowType =
      requestedFlowType === "creator_lab" ? "creator_lab" : "storyverse";

    if (projectId) {
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
          exported_movie_url: exportedMovieUrl || null,
          exported_movie_result: exportedMovieResult || null,
          export_signature: exportSignature || null,
          flow_type: normalizedFlowType,
          creator_mentor_result: creatorMentorResult || null,
          creator_production_package: creatorProductionPackage || null,
          youtube_metadata: youtubeMetadataResult || null,
          youtube_thumbnail: youtubeThumbnailResult || null,
          scene_optimization: sceneOptimizationResult || null,
          scene_optimization_summary: sceneOptimizationSummary || null,
          refined_creator_scenes: refinedCreatorScenes || null,
        })
        .eq("id", projectId)
        .eq("owner_user_id", user.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, mode: "updated", project: data });
    }

    const { data, error } = await supabase
      .from("velto_projects")
      .insert([{
        owner_user_id: user.id,
        child_id: childId,
        title,
        input_prompt: inputPrompt || "",
        story_premise: storyPremise || "",
        language: language === "en" ? "en" : "tr",
        visual_bible: visualBible || {},
        characters: characters || [],
        scenes: scenes || [],
        exported_movie_url: exportedMovieUrl || null,
        exported_movie_result: exportedMovieResult || null,
        export_signature: exportSignature || null,
        flow_type: normalizedFlowType,
        creator_mentor_result: creatorMentorResult || null,
        creator_production_package: creatorProductionPackage || null,
        youtube_metadata: youtubeMetadataResult || null,
        youtube_thumbnail: youtubeThumbnailResult || null,
        scene_optimization: sceneOptimizationResult || null,
        scene_optimization_summary: sceneOptimizationSummary || null,
        refined_creator_scenes: refinedCreatorScenes || null,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, mode: "created", project: data });

  } catch {
    return NextResponse.json({ error: "Kayıt sırasında hata oluştu" }, { status: 500 });
  }
}
