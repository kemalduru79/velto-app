import { NextResponse } from "next/server";
import OpenAI from "openai";
import { recordOpenAITextEconomics } from "@/lib/economics";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { attachCreatorProjectState, readCreatorProjectState } from "@/lib/creator/projectState";
import { getCreatorScriptSectionSourceReview } from "@/lib/creator/creatorScript";
import { applyCreatorScriptOpeningRefinement, applyCreatorScriptSelectionRefinement, applyCreatorScriptWholeRefinement, validateCreatorScriptSelection, type CreatorScriptRefinementScope } from "@/lib/creator/creatorScriptRefinement";
import { appendCreatorScriptHistory, applyCreatorScriptProposal, createCreatorScriptProposal, discardCreatorScriptProposal } from "@/lib/creator/creatorScriptRevisions";

export const runtime = "nodejs";

const text = (value: unknown, max = 4000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const exactText = (value: unknown, max = 100000) => typeof value === "string" ? value.slice(0, max) : "";

export async function POST(req: Request) {
  try {
    const principal = await authenticateRequest(req);
    const body = await req.json() as Record<string, unknown>;
    const projectId = text(body.projectId, 120);
    if (body.action !== undefined && body.action !== "generate" && body.action !== "apply" && body.action !== "discard") return NextResponse.json({ error: "Invalid refinement action." }, { status: 400 });
    const action = body.action === "apply" || body.action === "discard" ? body.action : "generate";
    const instruction = text(body.instruction, 2000); const revision = Number(body.revision); const scope = body.scope as CreatorScriptRefinementScope;
    if (!projectId || !Number.isInteger(revision) || (action === "generate" && (!instruction || !["selection", "opening", "whole_script"].includes(scope)))) return NextResponse.json({ error: "Invalid refinement request." }, { status: 400 });
    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const state = readCreatorProjectState(project); const script = state.strategy.script;
    if (!script || script.revision !== revision) return NextResponse.json({ error: "Script changed. Review the current revision.", code: "CREATOR_SCRIPT_REFINEMENT_STALE" }, { status: 409 });
    const saveState = async (nextState: typeof state) => services.projectRepository.saveForOwner({ projectId, ownerUserId: principal.id, childId: null, flowType: "creator_lab", exportedMovieResult: attachCreatorProjectState(project.exported_movie_result, nextState), expectedUpdatedAt: typeof project.updated_at === "string" ? project.updated_at : null });
    if (action === "discard") {
      const proposalId = text(body.proposalId, 120);
      if (!proposalId) return NextResponse.json({ error: "Invalid refinement action." }, { status: 400 });
      const nextState = { ...state, strategy: discardCreatorScriptProposal(state.strategy, proposalId) };
      const result = await saveState(nextState);
      return NextResponse.json({ success: true, action: "discard", creatorScript: script, pendingRefinement: null, revisionHistory: state.strategy.revisionHistory || [], project: result.project });
    }
    if (action === "apply") {
      const proposalId = text(body.proposalId, 120); const proposal = state.strategy.pendingRefinement;
      if (!proposal || proposal.proposalId !== proposalId || proposal.baseRevision !== script.revision) return NextResponse.json({ error: "Refinement preview is no longer current.", code: "CREATOR_SCRIPT_REFINEMENT_STALE" }, { status: 409 });
      const nextScript = applyCreatorScriptProposal(script, proposal, state.brief.language);
      const origin = proposal.scope === "selection" ? "ai_selection" : proposal.scope === "opening" ? "ai_opening" : "ai_whole_script";
      const revisionHistory = appendCreatorScriptHistory(state.strategy.revisionHistory || [], { fromRevision: script.revision, toRevision: nextScript.revision, origin, instruction: proposal.instruction, changes: proposal.changes });
      const nextState = { ...state, strategy: { ...state.strategy, script: nextScript, pendingRefinement: null, revisionHistory } };
      const result = await saveState(nextState);
      return NextResponse.json({ success: true, action: "apply", creatorScript: nextScript, pendingRefinement: null, revisionHistory, project: result.project });
    }
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Script refinement is unavailable." }, { status: 500 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const refine = async (source: string, context: unknown) => {
      const response = await client.responses.create({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", input: [{ role: "system", content: "Refine only the supplied creator script text. Return JSON with replacementText only. Preserve factual meaning, evidence uncertainty, continuity, and language. Do not add claims, citations, production scenes, or metadata." }, { role: "user", content: JSON.stringify({ instruction, source, context, requiredJsonShape: { replacementText: "string" } }) }], text: { format: { type: "json_object" } }, max_output_tokens: Math.max(800, Math.ceil(source.split(/\s+/).length * 2.5)), temperature: 0.25 });
      await recordOpenAITextEconomics({ route: "/api/creator-script/refine", operationType: "creator_script_refinement", model: process.env.OPENAI_MODEL || "gpt-4.1-mini", response });
      const parsed = JSON.parse(response.output_text || "{}"); const replacement = text(parsed.replacementText, 100000);
      if (!replacement) throw new Error("CREATOR_SCRIPT_REFINEMENT_OUTPUT_INVALID"); return replacement;
    };
    let nextScript; let replacementText: string | undefined;
    if (scope === "selection") {
      const selection = validateCreatorScriptSelection(script, Number(body.selectionStart), Number(body.selectionEnd), exactText(body.selectedText));
      const evidenceReviews = selection.affectedSectionIds.map((sectionId) => {
        const section = script.sections.find((item) => item.id === sectionId);
        if (!section?.claimIds.length) return null;
        return getCreatorScriptSectionSourceReview({ ...script, sections: script.sections.map((item) => item.id === sectionId ? { ...item, evidenceReviewRequired: true } : item) }, sectionId);
      });
      if (evidenceReviews.some((review, index) => script.sections.find((section) => section.id === selection.affectedSectionIds[index])?.claimIds.length && !review)) return NextResponse.json({ error: "The selection cannot be refined safely with its current sources." }, { status: 422 });
      replacementText = await refine(selection.selectedText, { before: selection.contextBefore, after: selection.contextAfter, evidence: evidenceReviews.filter(Boolean) });
      nextScript = applyCreatorScriptSelectionRefinement(script, { ...selection, replacementText });
    } else if (scope === "opening") {
      const section = script.sections[0]; const review = section.claimIds.length ? getCreatorScriptSectionSourceReview({ ...script, sections: script.sections.map((item) => item.id === section.id ? { ...item, evidenceReviewRequired: true } : item) }, section.id) : null;
      if (section.claimIds.length && !review) return NextResponse.json({ error: "This section cannot be refined safely with its current sources." }, { status: 422 });
      nextScript = applyCreatorScriptOpeningRefinement(script, await refine(section.text, review));
    } else {
      const replacements = [];
      for (const section of script.sections) {
        const review = section.claimIds.length ? getCreatorScriptSectionSourceReview({ ...script, sections: script.sections.map((item) => item.id === section.id ? { ...item, evidenceReviewRequired: true } : item) }, section.id) : null;
        if (section.claimIds.length && !review) return NextResponse.json({ error: "The script cannot be refined safely with its current sources." }, { status: 422 });
        replacements.push({ id: section.id, text: await refine(section.text, review) });
      }
      nextScript = applyCreatorScriptWholeRefinement(script, replacements, state.brief.language);
    }
    const pendingRefinement = createCreatorScriptProposal({ script, scope, instruction, nextScript, selectionStart: Number(body.selectionStart), selectionEnd: Number(body.selectionEnd), selectedText: exactText(body.selectedText), replacementText });
    const nextState = { ...state, strategy: { ...state.strategy, pendingRefinement } };
    const result = await saveState(nextState);
    return NextResponse.json({ success: true, pendingRefinement, creatorScript: script, revisionHistory: state.strategy.revisionHistory || [], project: result.project });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const code = error instanceof Error ? error.message : "";
    if (code === "PROJECT_SAVE_CONFLICT" || code.includes("SELECTION_STALE") || code.includes("REFINEMENT_STALE")) return NextResponse.json({ error: "Script changed. Review the current revision.", code: "CREATOR_SCRIPT_REFINEMENT_STALE" }, { status: 409 });
    return NextResponse.json({ error: "Script refinement could not be completed safely." }, { status: 422 });
  }
}
