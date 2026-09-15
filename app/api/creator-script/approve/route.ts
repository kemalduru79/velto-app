import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { approveCreatorScriptForProduction } from "@/lib/creator/creatorScriptApproval";
import { attachCreatorProjectState, readCreatorProjectState } from "@/lib/creator/projectState";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const body = await req.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const revision = Number(body.revision);
    if (!projectId || !Number.isInteger(revision)) return NextResponse.json({ error: "Invalid script approval request." }, { status: 400 });
    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const state = readCreatorProjectState(project);
    const script = state.strategy.script;
    if (!script || script.revision !== revision) return NextResponse.json({ error: "Script changed. Review the current revision before approval.", code: "CREATOR_SCRIPT_APPROVAL_STALE" }, { status: 409 });
    const approvedScript = approveCreatorScriptForProduction({ script, strategyFingerprint: state.strategy.strategyFingerprint || script.strategyFingerprint, language: state.brief.language, hasPendingRefinement: Boolean(state.strategy.pendingRefinement) });
    const nextState = { ...state, strategy: { ...state.strategy, script: approvedScript } };
    const result = await services.projectRepository.saveForOwner({ projectId, ownerUserId: principal.id, childId: null, flowType: "creator_lab", exportedMovieResult: attachCreatorProjectState(project.exported_movie_result, nextState), expectedUpdatedAt: typeof project.updated_at === "string" ? project.updated_at : null });
    return NextResponse.json({ success: true, creatorScript: approvedScript, revisionHistory: state.strategy.revisionHistory || [], project: result.project });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    if (error instanceof Error && error.message === "PROJECT_SAVE_CONFLICT") return NextResponse.json({ error: "Project changed. Reload before approving the script.", code: "PROJECT_SAVE_CONFLICT" }, { status: 409 });
    if (error instanceof Error && error.message.startsWith("CREATOR_SCRIPT_APPROVAL_BLOCKED:")) return NextResponse.json({ error: "The script is not ready for approval.", code: error.message }, { status: 409 });
    return NextResponse.json({ error: "Script approval could not be completed safely." }, { status: 500 });
  }
}
