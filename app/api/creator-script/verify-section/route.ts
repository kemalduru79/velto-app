import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { attachCreatorProjectState, readCreatorProjectState } from "@/lib/creator/projectState";
import { getCreatorScriptSectionSourceReview, verifyCreatorScriptSectionSources } from "@/lib/creator/creatorScript";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const body = await req.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const sectionId = typeof body.sectionId === "string" ? body.sectionId.trim() : "";
    const revision = Number(body.revision);
    const confirm = body.confirm === true;
    if (!projectId || !sectionId || !Number.isInteger(revision)) return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const state = readCreatorProjectState(project);
    const script = state.strategy.script;
    if (!script || script.revision !== revision) return NextResponse.json({ error: "Script changed. Review the current revision.", code: "CREATOR_SCRIPT_VERIFICATION_STALE" }, { status: 409 });
    const review = getCreatorScriptSectionSourceReview(script, sectionId);
    if (!review) return NextResponse.json({ error: "Source verification is unavailable for this section." }, { status: 422 });
    if (!confirm) return NextResponse.json({ success: true, review });
    const verifiedScript = verifyCreatorScriptSectionSources(script, sectionId);
    const nextState = { ...state, strategy: { ...state.strategy, script: verifiedScript, pendingRefinement: null } };
    const result = await services.projectRepository.saveForOwner({
      projectId,
      ownerUserId: principal.id,
      childId: null,
      flowType: "creator_lab",
      exportedMovieResult: attachCreatorProjectState(project.exported_movie_result, nextState),
      expectedUpdatedAt: typeof project.updated_at === "string" ? project.updated_at : null,
    });
    return NextResponse.json({ success: true, creatorScript: verifiedScript, pendingRefinement: null, project: result.project });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    if (error instanceof Error && error.message === "PROJECT_SAVE_CONFLICT") return NextResponse.json({ error: "Project changed. Reload and review again." }, { status: 409 });
    return NextResponse.json({ error: "Source verification could not be completed." }, { status: 500 });
  }
}
