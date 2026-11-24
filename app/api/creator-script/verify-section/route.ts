import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { attachCreatorProjectState, readCreatorProjectState } from "@/lib/creator/projectState";
import { getCreatorScriptSectionSourceReview, normalizeCreatorScript, verifyCreatorScriptSectionSources } from "@/lib/creator/creatorScript";
import { normalizeScriptPlannerEditorialContext } from "@/lib/research/scriptPlannerEditorialContext";
import { sourceAuthoritySnapshotDigest } from "@/lib/research/sourceAuthorityBoundary";
import { loadServerAuthoritativeResearchGraph } from "@/lib/research/sourceAuthorityWorkflow.server";
import { evaluateTrustedEvidence } from "@/lib/research/trustedEvidenceEvaluation";

export const runtime = "nodejs";

async function handleVerifySection(req: Request, dependencies: { authenticate: typeof authenticateRequest; persistence: typeof getPersistenceServices; loadAuthority?: typeof loadServerAuthoritativeResearchGraph } = { authenticate: authenticateRequest, persistence: getPersistenceServices }) {
  try {
    const principal = await dependencies.authenticate(req);
    const body = await req.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const sectionId = typeof body.sectionId === "string" ? body.sectionId.trim() : "";
    const revision = Number(body.revision);
    const confirm = body.confirm === true;
    if (!projectId || !sectionId || !Number.isInteger(revision)) return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
    const services = dependencies.persistence();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const state = readCreatorProjectState(project);
    const script = state.strategy.script;
    if (!script || script.revision !== revision) return NextResponse.json({ error: "Script changed. Review the current revision.", code: "CREATOR_SCRIPT_VERIFICATION_STALE" }, { status: 409 });
    const review = getCreatorScriptSectionSourceReview(script, sectionId);
    if (!review) return NextResponse.json({ error: "Source verification is unavailable for this section." }, { status: 422 });
    if (!confirm) return NextResponse.json({ success: true, review });
    let trustedContext;
    let expectedResearchAuthority: { revision: number; digest: string } | undefined;
    try {
      const audit = script.grounding.context.counterEvidenceReview;
      if (audit) {
        if (typeof project.updated_at !== "string" || !project.updated_at.trim()) throw new Error("PROJECT_REVISION_REQUIRED");
        const original = normalizeScriptPlannerEditorialContext(audit.originalContext, false);
        if (!original) throw new Error("SOURCE_AUTHORITY_UNAVAILABLE");
        const authority = await (dependencies.loadAuthority ?? loadServerAuthoritativeResearchGraph)(principal.id, projectId, sourceAuthoritySnapshotDigest(original));
        const evaluated = evaluateTrustedEvidence({ authority, decision: audit.decision, persistedContext: script.grounding.context });
        if (!evaluated.generation.eligible || typeof authority.originalSnapshot.research_revision !== "number") throw new Error("SOURCE_AUTHORITY_UNAVAILABLE");
        trustedContext = evaluated.context;
        expectedResearchAuthority = { revision: authority.originalSnapshot.research_revision, digest: authority.snapshotDigest };
      } else normalizeCreatorScript(script);
    } catch {
      return NextResponse.json({ error: "Historical source authority requires revalidation before verification.", code: "CREATOR_LEGACY_RESEARCH_REVALIDATION_REQUIRED" }, { status: 409 });
    }
    const verifiedScript = verifyCreatorScriptSectionSources(script, sectionId, undefined, trustedContext);
    const nextState = { ...state, strategy: { ...state.strategy, script: verifiedScript, pendingRefinement: null } };
    const result = await services.projectRepository.saveForOwner({
      projectId,
      ownerUserId: principal.id,
      childId: null,
      flowType: "creator_lab",
      exportedMovieResult: attachCreatorProjectState(project.exported_movie_result, nextState),
      expectedUpdatedAt: typeof project.updated_at === "string" ? project.updated_at : null,
      ...(expectedResearchAuthority ? { expectedResearchAuthority } : {}),
    });
    return NextResponse.json({ success: true, creatorScript: verifiedScript, pendingRefinement: null, project: result.project });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    if (error instanceof Error && error.message === "PROJECT_SAVE_CONFLICT") return NextResponse.json({ error: "Project changed. Reload and review again." }, { status: 409 });
    return NextResponse.json({ error: "Source verification could not be completed." }, { status: 500 });
  }
}

export const POST = Object.assign((req: Request) => handleVerifySection(req), { handleForTest: handleVerifySection });
