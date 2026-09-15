import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { extractProjectMediaReferences, getPersistenceServices } from "@/lib/persistence";
import {
  attachCreatorProjectState,
  isValidCreatorProjectState,
  type CreatorProjectStateSnapshot,
  readCreatorProjectState,
} from "@/lib/creator/projectState";
import { assertCreatorScriptVerificationAuthority } from "@/lib/creator/creatorScript";
import { appendCreatorScriptHistory, createCreatorScriptChanges, creatorScriptTextChanged } from "@/lib/creator/creatorScriptRevisions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const body = (await req.json()) as Record<string, unknown>;

    const projectId = typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : null;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
    const hasScenes = Object.prototype.hasOwnProperty.call(body, "scenes");
    const scenes = Array.isArray(body.scenes) ? body.scenes : body.scenes === null ? null : undefined;

    if ((!projectId && (!title || !Array.isArray(scenes))) || (hasTitle && !title) || (hasScenes && scenes === undefined)) {
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
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const exportedMovieUrl = typeof body.exportedMovieUrl === "string" && body.exportedMovieUrl.trim()
      ? body.exportedMovieUrl.trim()
      : body.exportedMovieUrl === null ? null : undefined;
    if (exportedMovieUrl) {
      const finalMovieAsset = await services.mediaAssetRepository.findByPublicUrl(principal.id, exportedMovieUrl);
      if (!finalMovieAsset || finalMovieAsset.mediaKind !== "final_video" || finalMovieAsset.lifecycleState !== "active") {
        return NextResponse.json({ error: "Final video is not available for this project owner." }, { status: 400 });
      }
    }
    const hasCreatorProjectState = flowType === "creator_lab" && has("creatorProjectState");
    let authoritativeCreatorState: CreatorProjectStateSnapshot | null = hasCreatorProjectState ? body.creatorProjectState as CreatorProjectStateSnapshot : null;
    if (hasCreatorProjectState && !isValidCreatorProjectState(body.creatorProjectState)) {
      return NextResponse.json(
        { error: "Creator project authority snapshot is invalid.", code: "CREATOR_PROJECT_STATE_INVALID" },
        { status: 400 },
      );
    }
    if (hasCreatorProjectState && !projectId && authoritativeCreatorState) {
      authoritativeCreatorState = { ...authoritativeCreatorState, strategy: { ...authoritativeCreatorState.strategy, pendingRefinement: null, revisionHistory: [] } };
    }
    if (hasCreatorProjectState && projectId) {
      const persistedProject = await services.projectRepository.getForOwner(projectId, principal.id);
      if (!persistedProject) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      const persistedScript = readCreatorProjectState(persistedProject).strategy.script;
      const persistedState = readCreatorProjectState(persistedProject);
      const candidateState = body.creatorProjectState as CreatorProjectStateSnapshot;
      if (persistedScript && candidateState.strategy.script) {
        try {
          assertCreatorScriptVerificationAuthority(persistedScript, candidateState.strategy.script);
        } catch {
          return NextResponse.json({ error: "Script verification state must be updated through source review.", code: "CREATOR_SCRIPT_VERIFICATION_FORGED" }, { status: 409 });
        }
      }
      const textChanged = creatorScriptTextChanged(persistedScript, candidateState.strategy.script);
      const scriptRevisionChanged = Boolean(persistedScript && candidateState.strategy.script && persistedScript.revision !== candidateState.strategy.script.revision);
      const revisionHistory = textChanged && persistedScript && candidateState.strategy.script
        ? appendCreatorScriptHistory(persistedState.strategy.revisionHistory || [], {
            fromRevision: persistedScript.revision,
            toRevision: candidateState.strategy.script.revision,
            origin: "manual",
            changes: createCreatorScriptChanges(persistedScript, candidateState.strategy.script),
          })
        : persistedState.strategy.revisionHistory || [];
      authoritativeCreatorState = {
        ...candidateState,
        strategy: {
          ...candidateState.strategy,
          pendingRefinement: textChanged || scriptRevisionChanged ? null : persistedState.strategy.pendingRefinement || null,
          revisionHistory,
        },
      };
    }
    const exportedMovieResult = hasCreatorProjectState && has("exportedMovieResult")
      ? attachCreatorProjectState(
          body.exportedMovieResult,
          authoritativeCreatorState as CreatorProjectStateSnapshot,
        )
      : body.exportedMovieResult;
    const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt.trim()
      ? body.expectedUpdatedAt.trim()
      : null;
    const result =
      await services.projectRepository.saveForOwner({
        projectId,
        ownerUserId: principal.id,
        childId,
        ...(hasTitle ? { title } : {}),
        flowType,
        ...(has("inputPrompt") ? { inputPrompt: typeof body.inputPrompt === "string" ? body.inputPrompt : "" } : {}),
        ...(has("storyPremise") ? { storyPremise: typeof body.storyPremise === "string" ? body.storyPremise : "" } : {}),
        ...(has("language") ? { language: body.language === "en" ? "en" as const : "tr" as const } : {}),
        ...(has("visualBible") ? { visualBible: body.visualBible } : {}),
        ...(has("characters") ? { characters: body.characters as unknown[] | null } : {}),
        ...(hasScenes ? { scenes } : {}),
        ...(has("exportedMovieUrl") ? { exportedMovieUrl } : {}),
        ...(has("exportedMovieResult") ? { exportedMovieResult } : {}),
        ...(has("exportSignature") ? { exportSignature: typeof body.exportSignature === "string" && body.exportSignature ? body.exportSignature : null } : {}),
        ...(has("creatorMentorResult") ? { creatorMentorResult: body.creatorMentorResult } : {}),
        ...(has("creatorProductionPackage") ? { creatorProductionPackage: body.creatorProductionPackage } : {}),
        ...(has("youtubeMetadataResult") ? { youtubeMetadataResult: body.youtubeMetadataResult } : {}),
        ...(has("youtubeThumbnailResult") ? { youtubeThumbnailResult: body.youtubeThumbnailResult } : {}),
        ...(has("sceneOptimizationResult") ? { sceneOptimizationResult: body.sceneOptimizationResult } : {}),
        ...(has("sceneOptimizationSummary") ? { sceneOptimizationSummary: body.sceneOptimizationSummary } : {}),
        ...(has("refinedCreatorScenes")
          ? { refinedCreatorScenes: body.refinedCreatorScenes }
          : {}),
        expectedUpdatedAt,
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

    if (error instanceof Error && error.message === "PROJECT_SAVE_CONFLICT") {
      return NextResponse.json(
        { error: "Project changed after this editor snapshot was loaded.", code: "PROJECT_SAVE_CONFLICT" },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "PROJECT_FLOW_TYPE_MISMATCH") {
      return NextResponse.json(
        { error: "Existing project flow type cannot be changed.", code: "PROJECT_FLOW_TYPE_MISMATCH" },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "PROJECT_REVISION_REQUIRED") {
      return NextResponse.json(
        { error: "A current project revision is required.", code: "PROJECT_REVISION_REQUIRED" },
        { status: 409 },
      );
    }

    console.error("save-project error:", error);
    return NextResponse.json(
      { error: "Kayıt sırasında hata oluştu" },
      { status: 500 },
    );
  }
}
