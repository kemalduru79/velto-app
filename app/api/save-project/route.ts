import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { extractProjectMediaReferences, getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const body = (await req.json()) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const scenes = Array.isArray(body.scenes) ? body.scenes : null;

    if (!title || !scenes) {
      return NextResponse.json(
        { error: "title ve scenes zorunlu" },
        { status: 400 },
      );
    }

    const requestedFlowType =
      typeof body.flowType === "string" && body.flowType.trim()
        ? body.flowType.trim()
        : typeof body.flowKey === "string" && body.flowKey.trim()
          ? body.flowKey.trim()
          : "storyverse";
    const flowType =
      requestedFlowType === "creator_lab" ? "creator_lab" : "storyverse";
    const childId =
      flowType === "creator_lab"
        ? null
        : typeof body.childId === "string" && body.childId.trim()
          ? body.childId.trim()
          : null;

    if (flowType === "storyverse" && !childId) {
      return NextResponse.json({ error: "childId zorunlu" }, { status: 400 });
    }

    const services = getPersistenceServices();
    const result =
      await services.projectRepository.saveForOwner({
        projectId:
          typeof body.projectId === "string" && body.projectId.trim()
            ? body.projectId.trim()
            : null,
        ownerUserId: principal.id,
        childId,
        title,
        inputPrompt:
          typeof body.inputPrompt === "string" ? body.inputPrompt : "",
        storyPremise:
          typeof body.storyPremise === "string" ? body.storyPremise : "",
        language: body.language === "en" ? "en" : "tr",
        visualBible: body.visualBible || {},
        characters: Array.isArray(body.characters) ? body.characters : [],
        scenes,
        exportedMovieUrl:
          typeof body.exportedMovieUrl === "string" && body.exportedMovieUrl
            ? body.exportedMovieUrl
            : null,
        exportedMovieResult: body.exportedMovieResult || null,
        exportSignature:
          typeof body.exportSignature === "string" && body.exportSignature
            ? body.exportSignature
            : null,
        flowType,
        creatorMentorResult: body.creatorMentorResult || null,
        creatorProductionPackage: body.creatorProductionPackage || null,
        youtubeMetadataResult: body.youtubeMetadataResult || null,
        youtubeThumbnailResult: body.youtubeThumbnailResult || null,
        sceneOptimizationResult: body.sceneOptimizationResult || null,
        sceneOptimizationSummary: body.sceneOptimizationSummary || null,
        refinedCreatorScenes: body.refinedCreatorScenes || null,
      });

    await services.mediaAssetRepository.replaceProjectReferences(
      principal.id,
      result.project.id,
      extractProjectMediaReferences(result.project),
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    console.error("save-project error:", error);
    return NextResponse.json(
      { error: "Kayıt sırasında hata oluştu" },
      { status: 500 },
    );
  }
}
