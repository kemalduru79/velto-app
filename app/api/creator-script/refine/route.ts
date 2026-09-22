import { NextResponse } from "next/server";
import OpenAI from "openai";
import { recordOpenAITextEconomics } from "@/lib/economics";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { attachCreatorProjectState, readCreatorProjectState } from "@/lib/creator/projectState";
import { getCreatorScriptDurationContractForScript, getCreatorScriptSectionSourceReview, type CreatorScript } from "@/lib/creator/creatorScript";
import { applyCreatorScriptHolisticEdits, applyCreatorScriptOpeningRefinement, applyCreatorScriptSelectionRefinement, applyCreatorScriptWholeRefinement, assertCreatorScriptForbiddenTermsRemoved, createCreatorScriptEditableUnits, createCreatorScriptHolisticCandidateSchema, createCreatorScriptHolisticCorrectionSchema, createCreatorScriptHolisticExecutionSchema, createCreatorScriptHolisticQaSchema, createCreatorScriptImmutableConstraintCatalog, createCreatorScriptMandatoryCandidates, createCreatorScriptWholeRefinementPlan, CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED, getCreatorScriptForbiddenLiteralTerms, getCreatorScriptHolisticCorrectionDiagnostics, getCreatorScriptHolisticDurationCorrection, getCreatorScriptHolisticEditDiagnostics, getCreatorScriptHolisticExecutionDiagnostics, getCreatorScriptImmutableCreatorConstraints, getCreatorScriptRemainingForbiddenTerms, normalizeCreatorScriptHolisticCandidates, parseCreatorScriptHolisticCandidates, parseCreatorScriptHolisticQa, projectCreatorScriptHolisticCandidates, reconcileCreatorScriptHolisticQaConstraints, validateCreatorScriptSelection, type CreatorScriptHolisticQa, type CreatorScriptHolisticSelection, type CreatorScriptHolisticUnitEdit, type CreatorScriptRefinementScope } from "@/lib/creator/creatorScriptRefinement";
import { appendCreatorScriptHistory, applyCreatorScriptProposal, createCreatorScriptProposal, discardCreatorScriptProposal } from "@/lib/creator/creatorScriptRevisions";
import { invalidateCreatorSceneAuthorityForScriptChange } from "@/lib/creator/creatorScriptApproval";

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
    if (action === "generate" && scope === "whole_script" && !CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED) return NextResponse.json({ error: "Full script refinement is currently unavailable.", code: "CREATOR_SCRIPT_FULL_REFINEMENT_DEFERRED" }, { status: 409 });
    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(projectId, principal.id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const state = readCreatorProjectState(project); const script = state.strategy.script;
    if (!script || script.revision !== revision) return NextResponse.json({ error: "Script changed. Review the current revision.", code: "CREATOR_SCRIPT_REFINEMENT_STALE" }, { status: 409 });
    if (!state.strategy.strategyFingerprint || script.strategyFingerprint !== state.strategy.strategyFingerprint) return NextResponse.json({ error: "Strategy changed. Rebuild the script before refining it.", code: "CREATOR_SCRIPT_REFINEMENT_STALE" }, { status: 409 });
    const saveState = async (nextState: typeof state, invalidateProduction = false) => services.projectRepository.saveForOwner({ projectId, ownerUserId: principal.id, childId: null, flowType: "creator_lab", ...(invalidateProduction ? { scenes: [], refinedCreatorScenes: [], exportedMovieUrl: null, exportSignature: null } : {}), exportedMovieResult: attachCreatorProjectState(project.exported_movie_result, nextState), expectedUpdatedAt: typeof project.updated_at === "string" ? project.updated_at : null });
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
      if (proposal.scope === "whole_script" && !CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED) return NextResponse.json({ error: "Full script refinement is currently unavailable. Discard this preview to continue.", code: "CREATOR_SCRIPT_FULL_REFINEMENT_DEFERRED" }, { status: 409 });
      const nextScript = applyCreatorScriptProposal(script, proposal, state.brief.language);
      const origin = proposal.scope === "selection" ? "ai_selection" : proposal.scope === "opening" ? "ai_opening" : "ai_whole_script";
      const revisionHistory = appendCreatorScriptHistory(state.strategy.revisionHistory || [], { fromRevision: script.revision, toRevision: nextScript.revision, origin, instruction: proposal.instruction, changes: proposal.changes });
      const nextState = invalidateCreatorSceneAuthorityForScriptChange({ ...state, strategy: { ...state.strategy, script: nextScript, pendingRefinement: null, revisionHistory } });
      const result = await saveState(nextState, true);
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
    let nextScript: CreatorScript; let replacementText: string | undefined; let editorialAdvisories: CreatorScriptHolisticQa["advisoryFindings"] = [];
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
      const architecture = createCreatorScriptWholeRefinementPlan(script, state.brief.language);
      const sectionIds = script.sections.map((section) => section.id);
      const immutableConstraints = getCreatorScriptImmutableCreatorConstraints(instruction);
      const constraintCatalog = createCreatorScriptImmutableConstraintCatalog(immutableConstraints);
      const canonicalDuration = getCreatorScriptDurationContractForScript(script, state.brief.language);
      const evidenceAuthority = script.sections.map((section) => ({
        sectionId: section.id,
        review: section.claimIds.length ? getCreatorScriptSectionSourceReview({ ...script, sections: script.sections.map((item) => item.id === section.id ? { ...item, evidenceReviewRequired: true } : item) }, section.id) : null,
      }));
      if (evidenceAuthority.some((item) => script.sections.find((section) => section.id === item.sectionId)!.claimIds.length > 0 && !item.review)) throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_REVIEW_UNAVAILABLE");
      const canonicalWordCount = script.sections.reduce((total, section) => total + section.text.split(/\s+/).filter(Boolean).length, 0);
      const forbiddenLiteralTerms = getCreatorScriptForbiddenLiteralTerms(immutableConstraints);
      const initialEditLimits = { maximumCanonicalFootprintFraction: 0.35, maximumIndividualFootprintFraction: 0.12, maximumReplacementExpansionFraction: 0.15 };
      const correctionEditLimits = { maximumCanonicalFootprintFraction: 0.35, maximumIndividualFootprintFraction: 0.12, maximumReplacementExpansionFraction: 0.08 };
      const selectionLimits = { maximumCanonicalFootprintFraction: 0.35, maximumSectionFootprintFraction: 0.45, maximumSafeDeletionWords: Math.max(0, canonicalWordCount - canonicalDuration.minimumAcceptableWordCount), maximumSelectionCount: 16 };
      const canonicalEditableUnits = createCreatorScriptEditableUnits(script, state.brief.language);
      const applyHolisticEditPlan = (sourceScript: CreatorScript, edits: CreatorScriptHolisticUnitEdit[], phase: "initial" | "correction") => {
        const limits = phase === "initial" ? initialEditLimits : correctionEditLimits;
        const diagnostics = getCreatorScriptHolisticEditDiagnostics(sourceScript, edits, state.brief.language, limits);
        console.info("CREATOR_SCRIPT_HOLISTIC_EDIT_PLAN_DIAGNOSTICS", { phase, ...diagnostics });
        return applyCreatorScriptHolisticEdits(sourceScript, edits, state.brief.language, limits);
      };
      const callHolisticCandidatePlan = async () => {
        const response = await client.responses.create({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: [
            { role: "system", content: "Act as a senior documentary editor. Read the complete manuscript and return a ranked pool of sentence-unit edit candidates; the server alone decides final scope. This is candidate selection only: do not write replacement prose. Each candidate must include one or two adjacent same-section unitIds, an allowlisted intent, replace or delete operation, priority, and a concise reason traceable to an explicit creator request or hard compliance need. Rank hard compliance first, substantive requested changes next, and polish last. For section-role requests, identify only sentences that violate the requested role; do not nominate every sentence merely to make the section comprehensive. Preserve already-useful canonical prose. Mark delete only when the complete selected unit should disappear; otherwise use replace. Do not propose broad stylistic normalization." },
            { role: "user", content: JSON.stringify({ creatorInstruction: instruction, immutableCreatorConstraints: constraintCatalog, forbiddenLiteralTerms, candidateGuidance: { maximumUnitsPerCandidate: 2, modelIsAdvisory: true }, canonicalDocumentWordCount: canonicalWordCount, globalDuration: { targetWords: canonicalDuration.targetWordCount, minimumWords: canonicalDuration.minimumAcceptableWordCount, maximumWords: canonicalDuration.maximumAcceptableWordCount, maximumSafeNetDeletionWords: selectionLimits.maximumSafeDeletionWords }, canonicalArchitecture: architecture, canonicalEvidenceAuthority: evidenceAuthority, canonicalSections: script.sections.map((section) => ({ sectionId: section.id, heading: section.heading || section.kind, kind: section.kind, text: section.text })), editableUnitMap: canonicalEditableUnits.map(({ unitId, sectionId, text }) => ({ unitId, sectionId, text })) }) },
          ],
          text: { format: { type: "json_schema", name: "creator_script_holistic_candidate_plan", strict: true, schema: createCreatorScriptHolisticCandidateSchema(canonicalEditableUnits.map((unit) => unit.unitId)) } },
          max_output_tokens: 3_000,
          temperature: 0.1,
        });
        await recordOpenAITextEconomics({ route: "/api/creator-script/refine", operationType: "creator_script_holistic_candidate_plan", model: process.env.OPENAI_MODEL || "gpt-4.1-mini", response });
        return parseCreatorScriptHolisticCandidates({ output: JSON.parse(response.output_text || "{}"), allowedUnitIds: canonicalEditableUnits.map((unit) => unit.unitId) });
      };
      const callFocusedEditExecution = async (selections: CreatorScriptHolisticSelection[], mandatorySelectionKeys: Set<string>, selectionPriorityByKey: Map<string, "hard_compliance" | "substantive" | "polish">, priorEdits: CreatorScriptHolisticUnitEdit[] | null, correction: {
        hardComplianceFindings: CreatorScriptHolisticQa["hardComplianceFindings"];
        durationStatus: string;
        actualWordCount: number;
        minimumAcceptableWordCount: number;
        targetWordCount: number;
        maximumAcceptableWordCount: number;
        requiredAdditionalWords: number;
        maximumBoundedWordChange: number;
      } | null) => {
        const unitById = new Map(canonicalEditableUnits.map((unit) => [unit.unitId, unit]));
        const selectionIds = selections.map((_, index) => `selection-${index + 1}`);
        const approvedSelections = selections.map((selection, index) => ({
          ...selection,
          selectionId: selectionIds[index],
          mandatory: mandatorySelectionKeys.has(selection.unitIds.join("\0")),
          priority: selectionPriorityByKey.get(selection.unitIds.join("\0")),
          sectionId: unitById.get(selection.unitIds[0])!.sectionId,
          sourceText: selection.unitIds.map((unitId) => unitById.get(unitId)!.rawText).join(""),
          contextBefore: (() => { const first = unitById.get(selection.unitIds[0])!; return canonicalEditableUnits.find((unit) => unit.sectionId === first.sectionId && unit.sectionUnitIndex === first.sectionUnitIndex - 1)?.text || ""; })(),
          contextAfter: (() => { const last = unitById.get(selection.unitIds[selection.unitIds.length - 1])!; return canonicalEditableUnits.find((unit) => unit.sectionId === last.sectionId && unit.sectionUnitIndex === last.sectionUnitIndex + 1)?.text || ""; })(),
          previousReplacementText: priorEdits?.find((edit) => edit.unitIds.join("\0") === selection.unitIds.join("\0"))?.replacementText,
        }));
        const response = await client.responses.create({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: [
            { role: "system", content: correction ? "Perform the one bounded correction within the frozen server-approved edit scope. Return only changed replacements keyed by the supplied selectionId; never return or reconstruct unitIds. Preserve every successful initial edit unless its approved selection needs correction. Do not add selections, respond to advisory findings, restore forbidden meta-language, or introduce facts, studies, examples, claims, citations, or evidence. For a duration deficit, deepen grounded material only within the selected section's canonical role and aim modestly above the minimum, not necessarily at the target." : "Act as a senior documentary line editor. The server has already frozen the complete editable scope. Return material replacements keyed only by selectionId; never return or reconstruct unitIds. Server-approved delete operations are applied deterministically and require no result. Every mandatory, hard-compliance, and substantive replace selection must be returned; mandatory replacements must materially change the prose and remove their forbidden literal. Only a non-mandatory polish replacement may be omitted when no safe material improvement is warranted. Do not add, combine, split, reorder, or broaden selections. Preserve every omitted or otherwise unselected unit exactly. Never add studies, statistics, examples, scenarios, anecdotes, claims, citations, evidence, or source authority." },
            { role: "user", content: JSON.stringify({ creatorInstruction: instruction, immutableCreatorConstraints: constraintCatalog, forbiddenLiteralTerms, approvedSelections, canonicalDocumentWordCount: canonicalWordCount, globalDuration: { targetWords: canonicalDuration.targetWordCount, minimumWords: canonicalDuration.minimumAcceptableWordCount, maximumWords: canonicalDuration.maximumAcceptableWordCount }, canonicalArchitecture: architecture, canonicalEvidenceAuthority: evidenceAuthority, canonicalSections: script.sections.map((section) => ({ sectionId: section.id, heading: section.heading || section.kind, kind: section.kind, claimIds: section.claimIds, text: section.text })), correction }) },
          ],
          text: { format: { type: "json_schema", name: correction ? "creator_script_holistic_edit_correction" : "creator_script_holistic_edit_execution", strict: true, schema: correction ? createCreatorScriptHolisticCorrectionSchema(approvedSelections.filter((selection) => selection.operation === "replace").map((selection) => selection.selectionId)) : createCreatorScriptHolisticExecutionSchema(approvedSelections.filter((selection) => selection.operation === "replace").map((selection) => selection.selectionId)) } },
          max_output_tokens: Math.ceil(canonicalDuration.maximumAcceptableWordCount * 2 + 500),
          temperature: correction ? 0.1 : 0.25,
        });
        await recordOpenAITextEconomics({ route: "/api/creator-script/refine", operationType: correction ? "creator_script_holistic_edit_correction" : "creator_script_holistic_edit_execution", model: process.env.OPENAI_MODEL || "gpt-4.1-mini", response });
        const output = JSON.parse(response.output_text || "{}");
        if (correction) {
          const diagnostics = getCreatorScriptHolisticCorrectionDiagnostics({ output, approved: approvedSelections.map((selection) => ({ selectionId: selection.selectionId, selection, mandatory: selection.mandatory, oldText: selection.sourceText, sectionId: selection.sectionId, priority: selection.priority })), priorEdits: priorEdits || [] });
          console.info("CREATOR_SCRIPT_HOLISTIC_CORRECTION_PATCH_DIAGNOSTICS", { ...diagnostics, corrections: undefined, edits: undefined });
          if (diagnostics.mismatchCategory) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
          return { edits: diagnostics.edits, effectiveSelections: diagnostics.effectiveSelections, diagnostics };
        }
        const diagnostics = getCreatorScriptHolisticExecutionDiagnostics({ output, approved: approvedSelections.map((selection) => ({ selectionId: selection.selectionId, selection, mandatory: selection.mandatory, oldText: selection.sourceText, sectionId: selection.sectionId, priority: selection.priority })) });
        console.info("CREATOR_SCRIPT_HOLISTIC_EXECUTION_PATCH_DIAGNOSTICS", { ...diagnostics, edits: undefined });
        if (diagnostics.mismatchCategory || !diagnostics.edits.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
        return { edits: diagnostics.edits, effectiveSelections: diagnostics.effectiveSelections };
      };
      const assessHolistically = async (candidate: CreatorScript, pass: "initial" | "final") => {
        const response = await client.responses.create({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: [
            { role: "system", content: "Assess the complete proposed script once as a documentary. Do not rewrite it. Hard compliance findings are limited to violated immutable creator constraints or unsupported/new factual material. Compare no-new constraints against canonical text: unchanged pre-existing material is not new. Explicit removal constraints remain violated if forbidden canonical material remains. Immutable creator constraints override canonical wording and canonical progression: never criticize, penalize, or mark as a progression loss the removal of material that a creator constraint explicitly requires removing. violatedImmutableConstraintIds are diagnostic overlap metadata, not a discriminator: use only allowlisted IDs that materially apply, and an unsupported_factual_material finding may also reference a relevant immutable constraint. Editorial imperfections such as modest overlap, tone, transitions, role separation, or conclusion strength are advisory only. Evaluate progression, major repetition, section roles, Social versus Consequence, Conclusion synthesis, and tone holistically. Return only allowlisted IDs and codes." },
            { role: "user", content: JSON.stringify({ canonicalArchitecture: architecture, immutableCreatorConstraints: constraintCatalog, canonicalSectionsBeforeRefinement: script.sections.map((section) => ({ sectionId: section.id, text: section.text })), proposedSections: candidate.sections.map((section) => ({ sectionId: section.id, text: section.text })), canonicalEvidenceAuthority: evidenceAuthority }) },
          ],
          text: { format: { type: "json_schema", name: `creator_script_holistic_qa_${pass}`, strict: true, schema: createCreatorScriptHolisticQaSchema(sectionIds, constraintCatalog.map((constraint) => constraint.id)) } },
          max_output_tokens: 2_000,
          temperature: 0,
        });
        await recordOpenAITextEconomics({ route: "/api/creator-script/refine", operationType: pass === "initial" ? "creator_script_holistic_qa" : "creator_script_holistic_final_compliance", model: process.env.OPENAI_MODEL || "gpt-4.1-mini", response });
        const qa = parseCreatorScriptHolisticQa({ output: JSON.parse(response.output_text || "{}"), allowedSectionIds: sectionIds, allowedConstraintIds: constraintCatalog.map((constraint) => constraint.id) });
        console.info("CREATOR_SCRIPT_HOLISTIC_QA_DIAGNOSTICS", { pass, hardComplianceFindings: qa.hardComplianceFindings, advisoryFindings: qa.advisoryFindings });
        return qa;
      };
      const modelCandidates = await callHolisticCandidatePlan();
      const mandatoryCandidates = createCreatorScriptMandatoryCandidates(script, state.brief.language, forbiddenLiteralTerms);
      const candidateUnitIds = new Set(modelCandidates.flatMap((candidate) => candidate.unitIds));
      const candidateCoverage = script.sections.map((section) => { const units = canonicalEditableUnits.filter((unit) => unit.sectionId === section.id); const selected = units.filter((unit) => candidateUnitIds.has(unit.unitId)); const selectedCharacters = selected.reduce((total, unit) => total + unit.rawText.length, 0); return { sectionId: section.id, selectedUnitCount: selected.length, totalUnitCount: units.length, footprintPercent: section.text.length ? Number((selectedCharacters / section.text.length * 100).toFixed(2)) : 100 }; }).filter((item) => item.selectedUnitCount > 0);
      console.info("CREATOR_SCRIPT_HOLISTIC_CANDIDATE_PLAN_DIAGNOSTICS", { candidateCount: modelCandidates.length, mandatoryCandidateCount: mandatoryCandidates.length, candidateUnitCount: candidateUnitIds.size, perSection: candidateCoverage, priorityDistribution: Object.fromEntries(["hard_compliance", "substantive", "polish"].map((priority) => [priority, modelCandidates.filter((candidate) => candidate.priority === priority).length])), intentDistribution: Object.fromEntries([...new Set(modelCandidates.map((candidate) => candidate.intent))].map((intent) => [intent, modelCandidates.filter((candidate) => candidate.intent === intent).length])) });
      const normalization = normalizeCreatorScriptHolisticCandidates({ script, language: state.brief.language, mandatoryCandidates, modelCandidates });
      console.info("CREATOR_SCRIPT_HOLISTIC_CANDIDATE_NORMALIZATION_DIAGNOSTICS", { ...normalization.diagnostics, invalidCandidates: normalization.invalidCandidates });
      if (normalization.invalidCandidates.some((candidate) => candidate.source === "mandatory")) throw new Error("CREATOR_SCRIPT_REFINEMENT_MANDATORY_CANDIDATE_INVALID");
      if (normalization.invalidCandidates.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_CANDIDATE_PLAN_INVALID");
      const projection = projectCreatorScriptHolisticCandidates({ script, language: state.brief.language, mandatoryCandidates: normalization.mergedCandidates.filter((candidate) => candidate.mandatory), modelCandidates: normalization.mergedCandidates.filter((candidate) => !candidate.mandatory), limits: selectionLimits });
      const approvedSelections = projection.approved;
      const mandatorySelectionKeys = new Set(normalization.mergedCandidates.filter((candidate) => candidate.mandatory).map((candidate) => candidate.unitIds.join("\0")));
      const selectionPriorityByKey = new Map(normalization.mergedCandidates.map((candidate) => [candidate.unitIds.join("\0"), candidate.priority]));
      console.info("CREATOR_SCRIPT_HOLISTIC_APPROVED_SELECTION_DIAGNOSTICS", { approvedCount: approvedSelections.length, droppedCount: projection.dropped.length, dropped: projection.dropped, mandatoryCandidateCount: projection.mandatoryCandidateCount, mandatoryRetained: projection.mandatoryRetained, ...projection.diagnostics });
      const initialExecution = await callFocusedEditExecution(approvedSelections, mandatorySelectionKeys, selectionPriorityByKey, null, null); const initialEdits = initialExecution.edits; const effectiveSelections = initialExecution.effectiveSelections;
      let candidate = applyHolisticEditPlan(script, initialEdits, "initial");
      let duration = getCreatorScriptDurationContractForScript(candidate, state.brief.language);
      const remainingForbiddenTerms = getCreatorScriptRemainingForbiddenTerms(candidate, forbiddenLiteralTerms);
      const initialQaResult = reconcileCreatorScriptHolisticQaConstraints({ qa: await assessHolistically(candidate, "initial"), remainingForbiddenTerms });
      console.info("CREATOR_SCRIPT_HOLISTIC_QA_CONSTRAINT_RECONCILIATION", { pass: "initial", remainingForbiddenTerms, droppedFalseLiteralClaimCount: initialQaResult.droppedFalseLiteralClaims.length });
      const initialQa = initialQaResult.qa; editorialAdvisories = initialQa.advisoryFindings;
      const deterministicConstraintFinding: CreatorScriptHolisticQa["hardComplianceFindings"] = remainingForbiddenTerms.length ? [{ code: "creator_constraint", sectionIds: candidate.sections.filter((section) => remainingForbiddenTerms.some((term) => section.text.toLocaleLowerCase().includes(term.toLocaleLowerCase()))).map((section) => section.id), violatedImmutableConstraintIds: constraintCatalog.filter((constraint) => remainingForbiddenTerms.some((term) => constraint.text.includes(term))).map((constraint) => constraint.id), summary: `Forbidden literal terms remain: ${remainingForbiddenTerms.join(", ")}` }] : [];
      const hardComplianceFindings = [...initialQa.hardComplianceFindings, ...deterministicConstraintFinding];
      const requiresCorrection = duration.status !== "compliant" || hardComplianceFindings.length > 0;
      const requiredAdditionalWords = Math.max(0, duration.minimumAcceptableWordCount - duration.actualWordCount);
      const durationCorrection = getCreatorScriptHolisticDurationCorrection(duration);
      console.info("CREATOR_SCRIPT_HOLISTIC_CORRECTION_DECISION", {
        requiresCorrection,
        durationStatus: duration.status,
        actualWordCount: duration.actualWordCount,
        minimumAcceptableWordCount: duration.minimumAcceptableWordCount,
        targetWordCount: duration.targetWordCount,
        requiredAdditionalWords,
        hardComplianceFindingCount: hardComplianceFindings.length,
        advisoryFindingCount: initialQa.advisoryFindings.length,
        maximumBoundedWordChange: durationCorrection.maximumBoundedWordChange,
        durationCorrectable: durationCorrection.correctable,
      });
      if (requiresCorrection) {
        if (duration.status !== "compliant" && !durationCorrection.correctable) throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
        const preCorrectionWordCount = duration.actualWordCount;
        const correctionExecution = await callFocusedEditExecution(effectiveSelections, mandatorySelectionKeys, selectionPriorityByKey, initialEdits, {
          hardComplianceFindings,
          durationStatus: duration.status,
          actualWordCount: duration.actualWordCount,
          minimumAcceptableWordCount: duration.minimumAcceptableWordCount,
          targetWordCount: duration.targetWordCount,
          maximumAcceptableWordCount: duration.maximumAcceptableWordCount,
          requiredAdditionalWords,
          maximumBoundedWordChange: durationCorrection.maximumBoundedWordChange,
        });
        const correctionDiagnostics = correctionExecution.diagnostics;
        if (!correctionDiagnostics) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
        candidate = applyHolisticEditPlan(script, correctionExecution.edits, "correction");
        duration = getCreatorScriptDurationContractForScript(candidate, state.brief.language);
        if (requiredAdditionalWords > 0 && duration.actualWordCount <= preCorrectionWordCount) throw new Error("CREATOR_SCRIPT_REFINEMENT_CORRECTION_DIRECTION_INVALID");
        console.info("CREATOR_SCRIPT_HOLISTIC_CORRECTION_RESULT", {
          durationStatus: duration.status,
          actualWordCount: duration.actualWordCount,
          minimumAcceptableWordCount: duration.minimumAcceptableWordCount,
          targetWordCount: duration.targetWordCount,
          maximumAcceptableWordCount: duration.maximumAcceptableWordCount,
        });
        if (duration.status !== "compliant") throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
        assertCreatorScriptForbiddenTermsRemoved(candidate, forbiddenLiteralTerms);
        const finalRemainingForbiddenTerms = getCreatorScriptRemainingForbiddenTerms(candidate, forbiddenLiteralTerms);
        const finalQaResult = reconcileCreatorScriptHolisticQaConstraints({ qa: await assessHolistically(candidate, "final"), remainingForbiddenTerms: finalRemainingForbiddenTerms });
        console.info("CREATOR_SCRIPT_HOLISTIC_QA_CONSTRAINT_RECONCILIATION", { pass: "final", remainingForbiddenTerms: finalRemainingForbiddenTerms, droppedFalseLiteralClaimCount: finalQaResult.droppedFalseLiteralClaims.length });
        const finalQa = finalQaResult.qa;
        editorialAdvisories = finalQa.advisoryFindings;
        if (finalQa.hardComplianceFindings.some((finding) => finding.code === "creator_constraint")) throw new Error("CREATOR_SCRIPT_REFINEMENT_CREATOR_CONSTRAINT_UNSATISFIED");
        if (finalQa.hardComplianceFindings.length > 0) throw new Error("CREATOR_SCRIPT_REFINEMENT_GROUNDING_UNSATISFIED");
        console.info("CREATOR_SCRIPT_HOLISTIC_CORRECTION_FINAL_DIAGNOSTICS", {
          frozenSelectionCount: correctionDiagnostics.frozenSelectionCount,
          currentEffectiveEditCount: correctionDiagnostics.currentEffectiveEditCount,
          correctionOverrideCount: correctionDiagnostics.correctionOverrideCount,
          correctionOverrideSelectionIds: correctionDiagnostics.correctionOverrideSelectionIds,
          unchangedEffectiveSelectionIds: correctionDiagnostics.unchangedEffectiveSelectionIds,
          rejectedOverrideReason: correctionDiagnostics.rejectedOverrideReason,
          preCorrectionWordCount,
          postCorrectionWordCount: duration.actualWordCount,
          requiredAdditionalWords,
          finalForbiddenTerms: finalRemainingForbiddenTerms,
          finalStatus: "accepted",
        });
      }
      assertCreatorScriptForbiddenTermsRemoved(candidate, forbiddenLiteralTerms);
      nextScript = applyCreatorScriptWholeRefinement(script, candidate.sections.map((section) => ({ id: section.id, text: section.text })), state.brief.language);
    }
    const pendingRefinement = createCreatorScriptProposal({ script, scope, instruction, nextScript, selectionStart: Number(body.selectionStart), selectionEnd: Number(body.selectionEnd), selectedText: exactText(body.selectedText), replacementText, editorialAdvisories: scope === "whole_script" ? editorialAdvisories.map(({ code, sectionIds, summary }) => ({ code, sectionIds, summary })) : undefined });
    const nextState = { ...state, strategy: { ...state.strategy, pendingRefinement } };
    const result = await saveState(nextState);
    return NextResponse.json({ success: true, pendingRefinement, creatorScript: script, revisionHistory: state.strategy.revisionHistory || [], project: result.project });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const code = error instanceof Error ? error.message : "";
    if (code === "PROJECT_SAVE_CONFLICT" || code.includes("SELECTION_STALE") || code.includes("REFINEMENT_STALE")) return NextResponse.json({ error: "Script changed. Review the current revision.", code: "CREATOR_SCRIPT_REFINEMENT_STALE" }, { status: 409 });
    console.error("CREATOR_SCRIPT_REFINEMENT_FAILED", { code: code || "UNKNOWN", scope: "full_script_or_scoped_generation" });
    return NextResponse.json({ error: "Script refinement could not be completed safely." }, { status: 422 });
  }
}
