import {
  editCreatorScriptDocument,
  editCreatorScriptSection,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDocumentText,
  getCreatorScriptDurationContractForScript,
  mergeCreatorScriptReplacementSections,
  type CreatorScript,
} from "./creatorScript.ts";

export type CreatorScriptRefinementScope = "selection" | "opening" | "whole_script";

// Intentionally disabled in the production creator path until real-provider reliability reaches the acceptance bar.
export const CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED = false;

export type CreatorScriptWholeRefinementSectionPlan = {
  id: string;
  kind: CreatorScript["sections"][number]["kind"];
  heading: string;
  editorialRole: string;
  centralQuestion: string;
  progression: string;
};

export type CreatorScriptHolisticQaFinding = {
  code: "creator_constraint" | "unsupported_factual_material" | "progression" | "repetition" | "role_separation" | "social_consequence" | "conclusion" | "tone";
  sectionIds: string[];
  violatedImmutableConstraintIds: string[];
  summary: string;
};

export type CreatorScriptHolisticQa = {
  hardComplianceFindings: CreatorScriptHolisticQaFinding[];
  advisoryFindings: CreatorScriptHolisticQaFinding[];
};

export type CreatorScriptEditableUnit = {
  unitId: string;
  sectionId: string;
  sectionUnitIndex: number;
  start: number;
  end: number;
  rawText: string;
  text: string;
};

export type CreatorScriptHolisticUnitEdit = { unitIds: string[]; replacementText: string };
export const CREATOR_SCRIPT_SELECTION_INTENTS = ["remove_meta_reference", "remove_repetition", "clarify", "improve_transition", "role_separation", "strengthen_conclusion", "replace_academic_filler"] as const;
export type CreatorScriptSelectionIntent = typeof CREATOR_SCRIPT_SELECTION_INTENTS[number];
export const CREATOR_SCRIPT_CANDIDATE_PRIORITIES = ["hard_compliance", "substantive", "polish"] as const;
export type CreatorScriptCandidatePriority = typeof CREATOR_SCRIPT_CANDIDATE_PRIORITIES[number];
export type CreatorScriptHolisticSelection = { unitIds: string[]; intent: CreatorScriptSelectionIntent; operation: "replace" | "delete" };
export type CreatorScriptHolisticCandidate = CreatorScriptHolisticSelection & { priority: CreatorScriptCandidatePriority; reason: string; mandatory?: boolean };
export type CreatorScriptHolisticCorrection = { selectionId: string; replacementText: string };
export type CreatorScriptApprovedExecutionSelection = { selectionId: string; selection: CreatorScriptHolisticSelection; mandatory: boolean; oldText: string; sectionId?: string; priority?: CreatorScriptCandidatePriority };
export const CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT = 32;
export const CREATOR_SCRIPT_HOLISTIC_SELECTION_LIMIT = 16;
export const CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT = 2;

export function getCreatorScriptHolisticDurationCorrection(input: {
  status: "too_short" | "compliant" | "too_long";
  actualWordCount: number;
  minimumAcceptableWordCount: number;
  targetWordCount: number;
  maximumAcceptableWordCount: number;
}) {
  const requiredWordChange = input.status === "too_short"
    ? input.minimumAcceptableWordCount - input.actualWordCount
    : input.status === "too_long"
      ? input.actualWordCount - input.maximumAcceptableWordCount
      : 0;
  const maximumBoundedWordChange = Math.ceil(input.targetWordCount * 0.05);
  return { requiredWordChange, maximumBoundedWordChange, correctable: requiredWordChange <= maximumBoundedWordChange };
}

const stableRefinementHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function getCreatorScriptImmutableCreatorConstraints(instruction: string) {
  const explicit = instruction.split(/\n+|(?<=[.!?])\s+/u)
    .map((value) => value.replace(/^\s*[-*•]\s*/u, "").trim())
    .filter((value) => /\b(?:do not|don't|never|must not|may not|cannot|can't|no new|avoid|remove\s+(?:every|all)|eliminate|without\s+(?:adding|inventing|introducing)|keep every factual|remain\s+(?:inside|within)|preserve\s+(?:duration|structure|grounding|evidence))\b/iu.test(value));
  return [...new Set([
    "Do not add new studies, statistics, hypothetical people, scenarios, anecdotes, situations, examples, factual claims, citations, or evidence.",
    "Keep every factual statement within the existing grounded evidence and source authority.",
    "Preserve canonical section identity, structure, and the safe whole-script duration envelope.",
    ...explicit,
  ])];
}

export function createCreatorScriptImmutableConstraintCatalog(constraints: string[]) {
  return constraints.map((constraint) => ({ id: `constraint-${stableRefinementHash(constraint)}`, text: constraint }));
}

export function createCreatorScriptWholeRefinementPlan(script: CreatorScript, language: "tr" | "en") {
  const duration = getCreatorScriptDurationContractForScript(script, language);
  if (duration.status !== "compliant") throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_DURATION_UNSATISFIED");
  const canonicalPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: script.targetDurationSec, language, hasMaterialCounterview: script.grounding.context.claims.some((claim) => claim.counterEvidenceIds.length > 0) });
  const canonicalById = new Map(canonicalPlan.map((section) => [section.id, section]));
  return script.sections.map((section): CreatorScriptWholeRefinementSectionPlan => {
    const canonical = canonicalById.get(section.id);
    return {
      id: section.id,
      kind: section.kind,
      heading: section.heading || section.kind,
      editorialRole: canonical?.role || (section.kind === "opening" ? "Open the inquiry and establish its stakes" : section.kind === "conclusion" ? "Synthesize the argument and preserve its unresolved question" : "Advance this section's existing distinct documentary argument"),
      centralQuestion: canonical?.centralQuestion || `What distinct editorial work belongs only in ${section.heading || section.id}?`,
      progression: canonical?.progression || "Advance from the previous section without summarizing the whole documentary.",
    };
  });
}

const fallbackSentenceSegments = (source: string) => {
  const values = source.match(/[\s\S]*?(?:[.!?](?=\s|$)|\n{2,}|$)/gu)?.filter(Boolean) || [];
  return values.length && values.join("") === source ? values : [source];
}

const mergeSentenceSegmentationEdgeCases = (segments: string[]) => segments.reduce<string[]>((merged, segment) => {
  if (!segment.trim() && merged.length) { merged[merged.length - 1] += segment; return merged; }
  if (merged.length && /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)|\b[A-Z])\.\s*$/u.test(merged[merged.length - 1])) { merged[merged.length - 1] += segment; return merged; }
  merged.push(segment); return merged;
}, []);

export function createCreatorScriptEditableUnits(script: CreatorScript, language: "tr" | "en") {
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(language, { granularity: "sentence" }) : null;
  return script.sections.flatMap((section) => {
    const rawSegments = mergeSentenceSegmentationEdgeCases(segmenter ? [...segmenter.segment(section.text)].map((item) => item.segment) : fallbackSentenceSegments(section.text));
    let cursor = 0;
    return rawSegments.map((rawText, index): CreatorScriptEditableUnit => {
      const unit = { unitId: `${section.id}:u${index + 1}`, sectionId: section.id, sectionUnitIndex: index, start: cursor, end: cursor + rawText.length, rawText, text: rawText.trim() };
      cursor = unit.end; return unit;
    });
  });
}

export function createCreatorScriptHolisticEditSchema(allowedUnitIds: string[]) {
  return { type: "object", additionalProperties: false, properties: { edits: { type: "array", minItems: 1, maxItems: CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT, items: { type: "object", additionalProperties: false, properties: { unitIds: { type: "array", minItems: 1, maxItems: CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT, items: { type: "string", enum: allowedUnitIds } }, replacementText: { type: "string" } }, required: ["unitIds", "replacementText"] } } }, required: ["edits"] };
}

export function createCreatorScriptHolisticSelectionSchema(allowedUnitIds: string[]) {
  return { type: "object", additionalProperties: false, properties: { selections: { type: "array", minItems: 1, maxItems: CREATOR_SCRIPT_HOLISTIC_SELECTION_LIMIT, items: { type: "object", additionalProperties: false, properties: { unitIds: { type: "array", minItems: 1, maxItems: CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT, items: { type: "string", enum: allowedUnitIds } }, intent: { type: "string", enum: [...CREATOR_SCRIPT_SELECTION_INTENTS] }, operation: { type: "string", enum: ["replace", "delete"] } }, required: ["unitIds", "intent", "operation"] } } }, required: ["selections"] };
}

export function createCreatorScriptHolisticCandidateSchema(allowedUnitIds: string[]) {
  return { type: "object", additionalProperties: false, properties: { candidates: { type: "array", minItems: 1, maxItems: CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT, items: { type: "object", additionalProperties: false, properties: { unitIds: { type: "array", minItems: 1, maxItems: CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT, items: { type: "string", enum: allowedUnitIds } }, intent: { type: "string", enum: [...CREATOR_SCRIPT_SELECTION_INTENTS] }, operation: { type: "string", enum: ["replace", "delete"] }, priority: { type: "string", enum: [...CREATOR_SCRIPT_CANDIDATE_PRIORITIES] }, reason: { type: "string" } }, required: ["unitIds", "intent", "operation", "priority", "reason"] } } }, required: ["candidates"] };
}

export function createCreatorScriptHolisticCorrectionSchema(allowedSelectionIds: string[]) {
  return { type: "object", additionalProperties: false, properties: { corrections: { type: "array", minItems: 1, maxItems: allowedSelectionIds.length, items: { type: "object", additionalProperties: false, properties: { selectionId: { type: "string", enum: allowedSelectionIds }, replacementText: { type: "string", minLength: 1 } }, required: ["selectionId", "replacementText"] } } }, required: ["corrections"] };
}

export function createCreatorScriptHolisticExecutionSchema(allowedSelectionIds: string[]) {
  return { type: "object", additionalProperties: false, properties: { results: { type: "array", maxItems: allowedSelectionIds.length, items: { type: "object", additionalProperties: false, properties: { selectionId: { type: "string", enum: allowedSelectionIds }, replacementText: { type: "string", minLength: 1 } }, required: ["selectionId", "replacementText"] } } }, required: ["results"] };
}

const isCreatorScriptReplacementMaterial = (value: string, selection: CreatorScriptHolisticSelection) => {
  const normalized = value.trim();
  if (!/[\p{L}\p{N}]/u.test(normalized)) return false;
  return selection.intent !== "remove_meta_reference" || /[.!?…][\p{Pe}\p{Pf}"']*$/u.test(normalized);
};

const buildCreatorScriptEffectiveEdits = (input: { approved: CreatorScriptApprovedExecutionSelection[]; replacementById: Map<string, string> }) => {
  const edits: CreatorScriptHolisticUnitEdit[] = []; const effectiveSelections: CreatorScriptHolisticSelection[] = []; const effectiveSelectionIds: string[] = [];
  input.approved.forEach((item) => {
    const replacementText = item.selection.operation === "delete" ? "" : input.replacementById.get(item.selectionId);
    if (replacementText === undefined) return;
    edits.push({ unitIds: item.selection.unitIds, replacementText }); effectiveSelections.push(item.selection); effectiveSelectionIds.push(item.selectionId);
  });
  return { edits, effectiveSelections, effectiveSelectionIds };
};

export function getCreatorScriptHolisticExecutionDiagnostics(input: { output: unknown; approved: CreatorScriptApprovedExecutionSelection[] }) {
  const output = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : null; const values = output && Array.isArray(output.results) ? output.results : null;
  const replaceSelections = input.approved.filter((item) => item.selection.operation === "replace");
  const requiredExecutableSelections = replaceSelections.filter((item) => item.mandatory || item.priority !== "polish");
  const optionalExecutableSelections = replaceSelections.filter((item) => !item.mandatory && item.priority === "polish");
  const approvedById = new Map(replaceSelections.map((item) => [item.selectionId, item])); const approvedOrderById = new Map(replaceSelections.map((item, index) => [item.selectionId, index])); const seen = new Set<string>();
  let validationReason: string | null = !output || Object.keys(output).some((key) => key !== "results") || !values ? "malformed_result" : values.length > replaceSelections.length ? "result_count_mismatch" : null; let mismatchIndex: number | null = null;
  const returnedSelectionIds: string[] = []; const replacementById = new Map<string, string>(); const skippedOptionalSelectionIds: string[] = []; const mandatoryNoOpSelectionIds: string[] = [];
  let previousApprovedIndex = -1;
  if (values) values.forEach((value, index) => {
    const result = value && typeof value === "object" ? value as Record<string, unknown> : null; const selectionId = typeof result?.selectionId === "string" ? result.selectionId : ""; returnedSelectionIds.push(selectionId);
    if (validationReason) return;
    if (!result || Object.keys(result).some((key) => !["selectionId", "replacementText"].includes(key)) || typeof result.replacementText !== "string") { validationReason = "malformed_result"; mismatchIndex = index; return; }
    const approved = approvedById.get(selectionId); if (!approved) { validationReason = "foreign_selection"; mismatchIndex = index; return; }
    if (seen.has(selectionId)) { validationReason = "duplicate_selection"; mismatchIndex = index; return; }
    const approvedIndex = approvedOrderById.get(selectionId)!;
    if (approvedIndex <= previousApprovedIndex) { validationReason = "order_mismatch"; mismatchIndex = index; return; }
    previousApprovedIndex = approvedIndex;
    if (!isCreatorScriptReplacementMaterial(result.replacementText, approved.selection)) { validationReason = "replacement_not_material"; mismatchIndex = index; return; }
    if (result.replacementText.trim() === approved.oldText.trim()) { seen.add(selectionId); if (approved.mandatory) mandatoryNoOpSelectionIds.push(selectionId); else skippedOptionalSelectionIds.push(selectionId); return; }
    seen.add(selectionId); replacementById.set(selectionId, result.replacementText);
  });
  const missingRequiredSelectionIds = requiredExecutableSelections.filter((item) => !seen.has(item.selectionId)).map((item) => item.selectionId);
  const omittedOptionalSelectionIds = optionalExecutableSelections.filter((item) => !seen.has(item.selectionId)).map((item) => item.selectionId);
  if (!validationReason) {
    const missing = requiredExecutableSelections.find((item) => !seen.has(item.selectionId));
    if (missing) { validationReason = "missing_required_selection"; mismatchIndex = input.approved.indexOf(missing); }
    else if (mandatoryNoOpSelectionIds.length) { validationReason = "mandatory_no_op_replacement"; mismatchIndex = input.approved.findIndex((item) => item.selectionId === mandatoryNoOpSelectionIds[0]); }
  }
  const { edits, effectiveSelections, effectiveSelectionIds } = validationReason ? { edits: [], effectiveSelections: [], effectiveSelectionIds: [] } : buildCreatorScriptEffectiveEdits({ approved: input.approved, replacementById });
  const deterministicDeleteCount = input.approved.filter((item) => item.selection.operation === "delete").length;
  return { approvedSelectionCount: input.approved.length, modelExecutableSelectionCount: replaceSelections.length, requiredExecutableSelectionCount: requiredExecutableSelections.length, optionalExecutableSelectionCount: optionalExecutableSelections.length, requiredExecutableSelectionIds: requiredExecutableSelections.map((item) => item.selectionId), optionalExecutableSelectionIds: optionalExecutableSelections.map((item) => item.selectionId), omittedOptionalSelectionIds, missingRequiredSelectionIds, deterministicDeleteCount, executionResultCount: values?.length ?? 0, materialReplacementCount: replacementById.size, optionalNoOpCount: skippedOptionalSelectionIds.length, mandatoryNoOpCount: mandatoryNoOpSelectionIds.length, skippedOptionalSelectionIds, mandatoryNoOpSelectionIds, effectiveEditCount: edits.length, executionStatus: !validationReason && (omittedOptionalSelectionIds.length || skippedOptionalSelectionIds.length) ? "accepted_with_optional_skips" : !validationReason ? "accepted" : "rejected", expectedSelectionIds: replaceSelections.map((item) => item.selectionId), returnedSelectionIds, selectionMetadata: input.approved.map((item) => ({ selectionId: item.selectionId, sectionId: item.sectionId || null, unitIds: item.selection.unitIds, intent: item.selection.intent, priority: item.priority || null, operation: item.selection.operation, mandatory: item.mandatory, canonicalWordCount: countWords(item.oldText) })), mismatchCategory: validationReason, mismatchIndex, edits, effectiveSelections, effectiveSelectionIds };
}

export function getCreatorScriptHolisticCorrectionDiagnostics(input: { output: unknown; approved: CreatorScriptApprovedExecutionSelection[]; priorEdits: CreatorScriptHolisticUnitEdit[] }) {
  const output = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : null;
  const values = output && Array.isArray(output.corrections) ? output.corrections : null;
  const replaceApproved = input.approved.filter((item) => item.selection.operation === "replace"); const approvedById = new Map(replaceApproved.map((item) => [item.selectionId, item])); const approvedOrderById = new Map(replaceApproved.map((item, index) => [item.selectionId, index]));
  const priorEditByUnitSpan = new Map(input.priorEdits.map((edit) => [edit.unitIds.join("\0"), edit]));
  const currentReplacementById = new Map<string, string>(); input.approved.forEach((item) => { const prior = priorEditByUnitSpan.get(item.selection.unitIds.join("\0")); if (item.selection.operation === "replace" && prior) currentReplacementById.set(item.selectionId, prior.replacementText); });
  let validationReason: string | null = !output || Object.keys(output).some((key) => key !== "corrections") || !values ? "malformed_result" : values.length > replaceApproved.length ? "result_count_mismatch" : null;
  let mismatchIndex: number | null = null; let previousApprovedIndex = -1; const returnedSelectionIds: string[] = []; const seen = new Set<string>(); const corrections: CreatorScriptHolisticCorrection[] = []; const ignoredNoOpSelectionIds: string[] = [];
  if (values) values.forEach((value, index) => {
    const correction = value && typeof value === "object" ? value as Record<string, unknown> : null; const selectionId = typeof correction?.selectionId === "string" ? correction.selectionId : ""; returnedSelectionIds.push(selectionId);
    if (validationReason) return;
    if (!correction || Object.keys(correction).some((key) => !["selectionId", "replacementText"].includes(key)) || typeof correction.replacementText !== "string") { validationReason = "malformed_result"; mismatchIndex = index; return; }
    if (!approvedById.has(selectionId)) { validationReason = "unapproved_selection"; mismatchIndex = index; return; }
    if (seen.has(selectionId)) { validationReason = "duplicate_group"; mismatchIndex = index; return; }
    const approvedIndex = approvedOrderById.get(selectionId)!; if (approvedIndex <= previousApprovedIndex) { validationReason = "order_mismatch"; mismatchIndex = index; return; } previousApprovedIndex = approvedIndex;
    const approved = approvedById.get(selectionId)!;
    if (!isCreatorScriptReplacementMaterial(correction.replacementText, approved.selection)) { validationReason = "replacement_not_material"; mismatchIndex = index; return; }
    const priorReplacement = currentReplacementById.get(selectionId);
    if (priorReplacement === undefined) { validationReason = "unapproved_selection"; mismatchIndex = index; return; }
    seen.add(selectionId);
    if (correction.replacementText.trim() === priorReplacement.trim()) { ignoredNoOpSelectionIds.push(selectionId); return; }
    corrections.push({ selectionId, replacementText: correction.replacementText });
  });
  const finalReplacementById = new Map(currentReplacementById); corrections.forEach((correction) => finalReplacementById.set(correction.selectionId, correction.replacementText));
  const effective = validationReason ? { edits: [], effectiveSelections: [], effectiveSelectionIds: [] } : buildCreatorScriptEffectiveEdits({ approved: input.approved, replacementById: finalReplacementById });
  const correctionOverrideSelectionIds = corrections.map((correction) => correction.selectionId); const unchangedEffectiveSelectionIds = input.approved.map((item) => item.selectionId).filter((selectionId) => !correctionOverrideSelectionIds.includes(selectionId));
  return { frozenSelectionCount: input.approved.length, currentEffectiveEditCount: input.priorEdits.length, correctionOverrideCount: corrections.length, correctionOverrideSelectionIds, unchangedEffectiveSelectionIds, ignoredNoOpSelectionIds, correctionResultCount: values?.length ?? 0, returnedSelectionIds, rejectedOverrideReason: validationReason, mismatchCategory: validationReason, mismatchIndex, corrections, ...effective };
}

export function parseCreatorScriptHolisticSelections(input: { output: unknown; allowedUnitIds: string[] }) {
  const output = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : null;
  const selections = output && Array.isArray(output.selections) ? output.selections : [];
  if (!output || Object.keys(output).some((key) => key !== "selections") || selections.length < 1 || selections.length > CREATOR_SCRIPT_HOLISTIC_SELECTION_LIMIT) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_PLAN_INVALID");
  return selections.map((value): CreatorScriptHolisticSelection => {
    const selection = value && typeof value === "object" ? value as Record<string, unknown> : null;
    if (!selection || Object.keys(selection).some((key) => !["unitIds", "intent", "operation"].includes(key)) || !Array.isArray(selection.unitIds) || selection.unitIds.length < 1 || selection.unitIds.length > CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT || selection.unitIds.some((id) => !input.allowedUnitIds.includes(String(id))) || !CREATOR_SCRIPT_SELECTION_INTENTS.includes(selection.intent as CreatorScriptSelectionIntent) || !["replace", "delete"].includes(String(selection.operation))) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_PLAN_INVALID");
    return { unitIds: selection.unitIds.map(String), intent: selection.intent as CreatorScriptSelectionIntent, operation: selection.operation as "replace" | "delete" };
  });
}

export function parseCreatorScriptHolisticCandidates(input: { output: unknown; allowedUnitIds: string[] }) {
  const output = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : null;
  const candidates = output && Array.isArray(output.candidates) ? output.candidates : [];
  if (!output || Object.keys(output).some((key) => key !== "candidates") || candidates.length < 1 || candidates.length > CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT) throw new Error("CREATOR_SCRIPT_REFINEMENT_CANDIDATE_PLAN_INVALID");
  return candidates.map((value): CreatorScriptHolisticCandidate => {
    const candidate = value && typeof value === "object" ? value as Record<string, unknown> : null;
    if (!candidate || Object.keys(candidate).some((key) => !["unitIds", "intent", "operation", "priority", "reason"].includes(key)) || !Array.isArray(candidate.unitIds) || candidate.unitIds.length < 1 || candidate.unitIds.length > CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT || candidate.unitIds.some((id) => !input.allowedUnitIds.includes(String(id))) || !CREATOR_SCRIPT_SELECTION_INTENTS.includes(candidate.intent as CreatorScriptSelectionIntent) || !["replace", "delete"].includes(String(candidate.operation)) || !CREATOR_SCRIPT_CANDIDATE_PRIORITIES.includes(candidate.priority as CreatorScriptCandidatePriority) || typeof candidate.reason !== "string" || !candidate.reason.trim()) throw new Error("CREATOR_SCRIPT_REFINEMENT_CANDIDATE_PLAN_INVALID");
    return { unitIds: candidate.unitIds.map(String), intent: candidate.intent as CreatorScriptSelectionIntent, operation: candidate.operation as "replace" | "delete", priority: candidate.priority as CreatorScriptCandidatePriority, reason: candidate.reason.trim().slice(0, 300) };
  });
}

export function parseCreatorScriptHolisticEdits(input: { output: unknown; allowedUnitIds: string[] }) {
  const output = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : null;
  const edits = output && Array.isArray(output.edits) ? output.edits : [];
  if (!output || Object.keys(output).some((key) => key !== "edits") || edits.length < 1 || edits.length > CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
  return edits.map((value): CreatorScriptHolisticUnitEdit => {
    const edit = value && typeof value === "object" ? value as Record<string, unknown> : null;
    if (!edit || Object.keys(edit).some((key) => !["unitIds", "replacementText"].includes(key)) || !Array.isArray(edit.unitIds) || edit.unitIds.length < 1 || edit.unitIds.length > CREATOR_SCRIPT_HOLISTIC_MAX_UNITS_PER_EDIT || edit.unitIds.some((id) => !input.allowedUnitIds.includes(String(id))) || typeof edit.replacementText !== "string") throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
    return { unitIds: edit.unitIds.map(String), replacementText: edit.replacementText };
  });
}

const countWords = (value: string) => value.trim() ? value.trim().split(/\s+/u).length : 0;

const resolveCreatorScriptSelections = (script: CreatorScript, selections: CreatorScriptHolisticSelection[], language: "tr" | "en") => {
  const units = createCreatorScriptEditableUnits(script, language); const unitById = new Map(units.map((unit) => [unit.unitId, unit])); const usedUnitIds = new Set<string>();
  const resolved = selections.map((selection) => {
    const selected = selection.unitIds.map((unitId) => unitById.get(unitId));
    if (selected.some((unit) => !unit)) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_PLAN_INVALID");
    const selectedUnits = selected as CreatorScriptEditableUnit[]; const first = selectedUnits[0];
    if (selectedUnits.some((unit, index) => unit.sectionId !== first.sectionId || unit.sectionUnitIndex !== first.sectionUnitIndex + index || usedUnitIds.has(unit.unitId))) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_SPAN_INVALID");
    selectedUnits.forEach((unit) => usedUnitIds.add(unit.unitId));
    const last = selectedUnits[selectedUnits.length - 1]; const section = script.sections.find((item) => item.id === first.sectionId)!;
    return { ...selection, sectionId: first.sectionId, start: first.start, end: last.end, oldText: section.text.slice(first.start, last.end), units: selectedUnits };
  });
  return { units, resolved };
};

export function getCreatorScriptHolisticSelectionDiagnostics(script: CreatorScript, selections: CreatorScriptHolisticSelection[], language: "tr" | "en", limits: { maximumCanonicalFootprintFraction: number; maximumSectionFootprintFraction: number; maximumSafeDeletionWords: number }) {
  const { units, resolved } = resolveCreatorScriptSelections(script, selections, language);
  const canonicalCharacters = script.sections.reduce((total, section) => total + section.text.length, 0); const canonicalWords = script.sections.reduce((total, section) => total + countWords(section.text), 0);
  const perSection = script.sections.map((section) => {
    const sectionSelections = resolved.filter((selection) => selection.sectionId === section.id); const selectedCharacters = sectionSelections.reduce((total, selection) => total + selection.oldText.length, 0); const selectedWords = sectionSelections.reduce((total, selection) => total + countWords(selection.oldText), 0); const selectedUnitCount = sectionSelections.reduce((total, selection) => total + selection.units.length, 0); const totalUnitCount = units.filter((unit) => unit.sectionId === section.id).length;
    return { sectionId: section.id, selectedCharacters, selectedWords, selectedUnitCount, totalUnitCount, sectionCharacters: section.text.length, footprintPercent: section.text.length ? Number((selectedCharacters / section.text.length * 100).toFixed(2)) : 100 };
  }).filter((item) => item.selectedUnitCount > 0);
  const selectedCharacters = resolved.reduce((total, selection) => total + selection.oldText.length, 0); const selectedWords = resolved.reduce((total, selection) => total + countWords(selection.oldText), 0);
  const intendedDeletionWords = resolved.filter((selection) => selection.operation === "delete").reduce((total, selection) => total + countWords(selection.oldText), 0);
  const rejectionReason = selections.length > CREATOR_SCRIPT_HOLISTIC_SELECTION_LIMIT ? "selection_count"
    : perSection.some((item) => item.selectedUnitCount === item.totalUnitCount) ? "complete_section_selection"
      : perSection.some((item) => item.footprintPercent / 100 > limits.maximumSectionFootprintFraction) ? "section_footprint"
        : selectedCharacters / canonicalCharacters > limits.maximumCanonicalFootprintFraction ? "canonical_footprint"
          : intendedDeletionWords > limits.maximumSafeDeletionWords ? "deletion_intent_budget"
            : null;
  return { selectionCount: selections.length, canonicalWords, canonicalCharacters, selectedWords, selectedCharacters, canonicalFootprintPercent: Number((selectedCharacters / canonicalCharacters * 100).toFixed(2)), intendedDeletionWords, sectionIds: perSection.map((item) => item.sectionId), perSection, limits, rejectionReason };
}

export function assertCreatorScriptHolisticSelectionAllowed(script: CreatorScript, selections: CreatorScriptHolisticSelection[], language: "tr" | "en", limits: { maximumCanonicalFootprintFraction: number; maximumSectionFootprintFraction: number; maximumSafeDeletionWords: number }) {
  const diagnostics = getCreatorScriptHolisticSelectionDiagnostics(script, selections, language, limits);
  if (diagnostics.rejectionReason) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_TOO_LARGE");
  return diagnostics;
}

export function createCreatorScriptMandatoryCandidates(script: CreatorScript, language: "tr" | "en", forbiddenLiteralTerms: string[]) {
  const normalizedTerms = forbiddenLiteralTerms.map((term) => term.toLocaleLowerCase(language)).filter(Boolean);
  return createCreatorScriptEditableUnits(script, language)
    .filter((unit) => normalizedTerms.some((term) => unit.text.toLocaleLowerCase(language).includes(term)))
    .map((unit): CreatorScriptHolisticCandidate => {
      const pureMeta = /^(?:this|the)\s+(?:inquiry|documentary|episode|story|project|work)\b[\s\S]*\b(?:mission|editorial (?:approach|method|commitment)|intends?\s+to)\b[\s\S]*[.!?]?$/iu.test(unit.text.trim());
      return { unitIds: [unit.unitId], intent: "remove_meta_reference", operation: pureMeta ? "delete" : "replace", priority: "hard_compliance", reason: pureMeta ? "Server-detected pure editorial meta sentence" : "Server-detected forbidden meta-language mixed with useful narration", mandatory: true };
    });
}

export function normalizeCreatorScriptHolisticCandidates(input: {
  script: CreatorScript;
  language: "tr" | "en";
  mandatoryCandidates: CreatorScriptHolisticCandidate[];
  modelCandidates: CreatorScriptHolisticCandidate[];
}) {
  const units = createCreatorScriptEditableUnits(input.script, input.language); const unitById = new Map(units.map((unit) => [unit.unitId, unit]));
  const validate = (candidate: CreatorScriptHolisticCandidate, source: "mandatory" | "model", index: number) => {
    const resolved = candidate.unitIds.map((unitId) => unitById.get(unitId)); let failureReason: string | null = null;
    if (resolved.some((unit) => !unit)) failureReason = "invalid_unit_id";
    else if (new Set(candidate.unitIds).size !== candidate.unitIds.length) failureReason = "duplicate_unit_within_candidate";
    else if (resolved.some((unit) => unit!.sectionId !== resolved[0]!.sectionId)) failureReason = "cross_section_group";
    else if (resolved.some((unit, unitIndex) => unit!.sectionUnitIndex !== resolved[0]!.sectionUnitIndex + unitIndex)) failureReason = "non_adjacent_units";
    return { source, index, candidate, sectionId: resolved[0]?.sectionId || null, failureReason };
  };
  const priorityRank: Record<CreatorScriptCandidatePriority, number> = { hard_compliance: 0, substantive: 1, polish: 2 };
  const mandatoryValidated = input.mandatoryCandidates.map((candidate, index) => validate({ ...candidate, mandatory: true }, "mandatory", index));
  const modelValidated = input.modelCandidates.map((candidate, index) => validate({ ...candidate, mandatory: false }, "model", index)).sort((left, right) => priorityRank[left.candidate.priority] - priorityRank[right.candidate.priority] || left.index - right.index);
  const invalidCandidates = [...mandatoryValidated, ...modelValidated].filter((item) => item.failureReason).map((item) => ({ candidateIndex: item.index, source: item.source, unitIds: item.candidate.unitIds, sectionId: item.sectionId, intent: item.candidate.intent, priority: item.candidate.priority, operation: item.candidate.operation, validationFailureReason: item.failureReason }));
  const accepted: CreatorScriptHolisticCandidate[] = []; const occupiedUnits = new Set<string>(); const exactSpans = new Set<string>();
  let deduplicatedCount = 0; let overlapDroppedCount = 0;
  for (const item of [...mandatoryValidated, ...modelValidated]) {
    if (item.failureReason) continue;
    const spanKey = item.candidate.unitIds.join("\0");
    if (exactSpans.has(spanKey)) { deduplicatedCount += 1; continue; }
    if (item.candidate.unitIds.some((unitId) => occupiedUnits.has(unitId))) { overlapDroppedCount += 1; continue; }
    accepted.push(item.candidate); exactSpans.add(spanKey); item.candidate.unitIds.forEach((unitId) => occupiedUnits.add(unitId));
  }
  return {
    mergedCandidates: accepted,
    invalidCandidates,
    diagnostics: {
      rawModelCandidateCount: input.modelCandidates.length,
      mandatoryCandidateCount: input.mandatoryCandidates.length,
      mergedCandidateCount: accepted.length,
      deduplicatedCount,
      overlapDroppedCount,
      invalidCandidateCount: invalidCandidates.length,
      mandatoryRetainedCount: accepted.filter((candidate) => candidate.mandatory).length,
    },
  };
}

export function projectCreatorScriptHolisticCandidates(input: {
  script: CreatorScript;
  language: "tr" | "en";
  mandatoryCandidates: CreatorScriptHolisticCandidate[];
  modelCandidates: CreatorScriptHolisticCandidate[];
  limits: { maximumCanonicalFootprintFraction: number; maximumSectionFootprintFraction: number; maximumSafeDeletionWords: number; maximumSelectionCount: number };
}) {
  const rank: Record<CreatorScriptCandidatePriority, number> = { hard_compliance: 0, substantive: 1, polish: 2 };
  const ordered = [...input.mandatoryCandidates, ...input.modelCandidates.map((candidate, index) => ({ ...candidate, _index: index }))]
    .sort((left, right) => Number(!left.mandatory) - Number(!right.mandatory) || rank[left.priority] - rank[right.priority] || ("_index" in left ? Number(left._index) : -1) - ("_index" in right ? Number(right._index) : -1));
  const approved: CreatorScriptHolisticSelection[] = []; const approvedUnitIds = new Set<string>();
  const dropped: Array<{ unitIds: string[]; priority: CreatorScriptCandidatePriority; mandatory: boolean; reason: string }> = [];
  for (const candidate of ordered) {
    const selection = { unitIds: candidate.unitIds, intent: candidate.intent, operation: candidate.operation };
    try { resolveCreatorScriptSelections(input.script, [selection], input.language); } catch { throw new Error("CREATOR_SCRIPT_REFINEMENT_CANDIDATE_PLAN_INVALID"); }
    if (candidate.unitIds.some((unitId) => approvedUnitIds.has(unitId))) throw new Error("CREATOR_SCRIPT_REFINEMENT_CANDIDATE_NORMALIZATION_REQUIRED");
    let reason: string | null = null;
    if (!reason && approved.length >= input.limits.maximumSelectionCount) reason = "selection_count";
    if (!reason) reason = getCreatorScriptHolisticSelectionDiagnostics(input.script, [...approved, selection], input.language, input.limits).rejectionReason;
    if (reason) {
      if (candidate.mandatory) throw new Error("CREATOR_SCRIPT_REFINEMENT_MANDATORY_SELECTION_UNSATISFIED");
      dropped.push({ unitIds: candidate.unitIds, priority: candidate.priority, mandatory: false, reason });
      continue;
    }
    approved.push(selection); candidate.unitIds.forEach((unitId) => approvedUnitIds.add(unitId));
  }
  if (!approved.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_EMPTY");
  const diagnostics = getCreatorScriptHolisticSelectionDiagnostics(input.script, approved, input.language, input.limits);
  return { approved, dropped, diagnostics, mandatoryCandidateCount: input.mandatoryCandidates.length, mandatoryRetained: input.mandatoryCandidates.every((candidate) => candidate.unitIds.every((unitId) => approvedUnitIds.has(unitId))) };
}

export function assertCreatorScriptExecutionMatchesSelection(selections: CreatorScriptHolisticSelection[], edits: CreatorScriptHolisticUnitEdit[]) {
  if (edits.length !== selections.length || edits.some((edit, index) => edit.unitIds.join("\0") !== selections[index].unitIds.join("\0"))) throw new Error("CREATOR_SCRIPT_REFINEMENT_EXECUTION_SCOPE_INVALID");
}

const resolveCreatorScriptUnitEdits = (script: CreatorScript, edits: CreatorScriptHolisticUnitEdit[], language: "tr" | "en") => {
  const units = createCreatorScriptEditableUnits(script, language); const unitById = new Map(units.map((unit) => [unit.unitId, unit])); const usedUnitIds = new Set<string>();
  return edits.map((edit) => {
    const selected = edit.unitIds.map((unitId) => unitById.get(unitId));
    if (selected.some((unit) => !unit)) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
    const resolved = selected as CreatorScriptEditableUnit[]; const first = resolved[0];
    if (resolved.some((unit, index) => unit.sectionId !== first.sectionId || unit.sectionUnitIndex !== first.sectionUnitIndex + index || usedUnitIds.has(unit.unitId)) || resolved.length === units.filter((unit) => unit.sectionId === first.sectionId).length) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_SPAN_INVALID");
    resolved.forEach((unit) => usedUnitIds.add(unit.unitId));
    const last = resolved[resolved.length - 1]; const oldText = script.sections.find((section) => section.id === first.sectionId)!.text.slice(first.start, last.end);
    if (edit.replacementText === oldText || edit.replacementText === oldText.trim()) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
    return { ...edit, sectionId: first.sectionId, start: first.start, end: last.end, oldText, newText: edit.replacementText };
  });
};

export function getCreatorScriptHolisticEditDiagnostics(script: CreatorScript, edits: CreatorScriptHolisticUnitEdit[], language: "tr" | "en", limits = { maximumCanonicalFootprintFraction: 0.35, maximumIndividualFootprintFraction: 0.12, maximumReplacementExpansionFraction: 0.15 }) {
  const resolvedEdits = resolveCreatorScriptUnitEdits(script, edits, language);
  const canonicalCharacters = script.sections.reduce((total, section) => total + section.text.length, 0);
  const canonicalWords = script.sections.reduce((total, section) => total + countWords(section.text), 0);
  const perSection = new Map<string, { oldTextCharacters: number; oldTextWords: number; newTextCharacters: number; newTextWords: number }>();
  let oldTextCharacters = 0; let oldTextWords = 0; let newTextCharacters = 0; let newTextWords = 0;
  let largestEdit = { sectionId: "", oldTextCharacters: 0, oldTextWords: 0, newTextCharacters: 0, newTextWords: 0 };
  for (const edit of resolvedEdits) {
    const oldWords = countWords(edit.oldText); const newWords = countWords(edit.newText);
    oldTextCharacters += edit.oldText.length; oldTextWords += oldWords; newTextCharacters += edit.newText.length; newTextWords += newWords;
    const current = perSection.get(edit.sectionId) || { oldTextCharacters: 0, oldTextWords: 0, newTextCharacters: 0, newTextWords: 0 };
    current.oldTextCharacters += edit.oldText.length; current.oldTextWords += oldWords; current.newTextCharacters += edit.newText.length; current.newTextWords += newWords; perSection.set(edit.sectionId, current);
    if (edit.oldText.length > largestEdit.oldTextCharacters) largestEdit = { sectionId: edit.sectionId, oldTextCharacters: edit.oldText.length, oldTextWords: oldWords, newTextCharacters: edit.newText.length, newTextWords: newWords };
  }
  const canonicalFootprintFraction = canonicalCharacters ? oldTextCharacters / canonicalCharacters : 1;
  const largestIndividualFootprintFraction = canonicalCharacters ? largestEdit.oldTextCharacters / canonicalCharacters : 1;
  const maximumNewTextCharacters = oldTextCharacters + Math.ceil(canonicalCharacters * limits.maximumReplacementExpansionFraction);
  const rejectionReason = edits.length < 1 || edits.length > CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT
    ? "edit_count"
    : canonicalFootprintFraction > limits.maximumCanonicalFootprintFraction
      ? "canonical_footprint"
      : largestIndividualFootprintFraction > limits.maximumIndividualFootprintFraction
        ? "individual_edit_footprint"
        : newTextCharacters > maximumNewTextCharacters
          ? "replacement_expansion"
          : null;
  return {
    editCount: edits.length,
    canonicalWords,
    canonicalCharacters,
    oldTextWords,
    oldTextCharacters,
    newTextWords,
    newTextCharacters,
    canonicalFootprintPercent: Number((canonicalFootprintFraction * 100).toFixed(2)),
    netWordDelta: newTextWords - oldTextWords,
    largestEdit,
    sectionIds: [...perSection.keys()],
    perSection: [...perSection].map(([sectionId, metrics]) => ({ sectionId, ...metrics, canonicalSectionCharacters: script.sections.find((section) => section.id === sectionId)?.text.length || 0 })),
    limits,
    rejectionReason,
  };
}

export function applyCreatorScriptHolisticEdits(script: CreatorScript, edits: CreatorScriptHolisticUnitEdit[], language: "tr" | "en", limits = { maximumCanonicalFootprintFraction: 0.35, maximumIndividualFootprintFraction: 0.12, maximumReplacementExpansionFraction: 0.15 }) {
  if (!edits.length || edits.length > CREATOR_SCRIPT_HOLISTIC_EDIT_LIMIT) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_INVALID");
  const resolvedEdits = resolveCreatorScriptUnitEdits(script, edits, language);
  const diagnostics = getCreatorScriptHolisticEditDiagnostics(script, edits, language, limits);
  if (diagnostics.rejectionReason) throw new Error("CREATOR_SCRIPT_REFINEMENT_PATCH_TOO_LARGE");
  const bySection = new Map<string, typeof resolvedEdits>();
  for (const edit of resolvedEdits) { const sectionEdits = bySection.get(edit.sectionId) || []; sectionEdits.push(edit); bySection.set(edit.sectionId, sectionEdits); }
  const replacements = script.sections.map((section) => {
    const sectionEdits = [...(bySection.get(section.id) || [])].sort((a, b) => b.start - a.start);
    const nextText = sectionEdits.reduce((value, edit) => {
      const leadingWhitespace = edit.oldText.match(/^\s*/u)?.[0] || ""; const trailingWhitespace = edit.oldText.match(/\s*$/u)?.[0] || ""; const replacement = edit.newText.trim();
      return `${value.slice(0, edit.start)}${replacement ? `${leadingWhitespace}${replacement}${trailingWhitespace}` : trailingWhitespace}${value.slice(edit.end)}`;
    }, section.text);
    return { ...section, text: nextText, ...(nextText !== section.text && section.claimIds.length ? { evidenceReviewRequired: true, humanVerification: undefined } : {}) };
  });
  return mergeCreatorScriptReplacementSections({ script, replacements });
}

const FORBIDDEN_LITERAL_STOP_WORDS = new Set(["DO", "NOT", "NEVER", "MUST", "REMOVE", "EVERY", "ALL", "KEEP", "PRESERVE"]);

export function getCreatorScriptForbiddenLiteralTerms(constraints: string[]) {
  const constraintText = constraints.join("\n");
  const terms = constraints.flatMap((constraint) => constraint.match(/\b[A-Z][A-Z0-9.-]{2,}\b/g) || []).filter((term) => !FORBIDDEN_LITERAL_STOP_WORDS.has(term));
  if (/\bTHYNEL\b/u.test(constraintText) && /\b(?:remove|eliminate|meta-reference)\b/iu.test(constraintText)) terms.push("THNK");
  if (/\b(?:meta-reference|editorial (?:approach|method|commitment)|what the documentary intends)\b/iu.test(constraintText)) terms.push("this documentary", "editorial approach", "editorial method", "editorial commitment");
  return [...new Set(terms)];
}

export function getCreatorScriptRemainingForbiddenTerms(script: CreatorScript, forbiddenTerms: string[]) {
  const document = getCreatorScriptDocumentText(script);
  return forbiddenTerms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu").test(document));
}

export function assertCreatorScriptForbiddenTermsRemoved(script: CreatorScript, forbiddenTerms: string[]) {
  if (getCreatorScriptRemainingForbiddenTerms(script, forbiddenTerms).length) throw new Error("CREATOR_SCRIPT_REFINEMENT_CREATOR_CONSTRAINT_UNSATISFIED");
}

const findingSchema = (allowedSectionIds: string[], allowedConstraintIds: string[], codes: string[]) => ({ type: "object", additionalProperties: false, properties: { code: { type: "string", enum: codes }, sectionIds: { type: "array", items: { type: "string", enum: allowedSectionIds } }, violatedImmutableConstraintIds: { type: "array", items: { type: "string", enum: allowedConstraintIds.length ? allowedConstraintIds : ["__NO_IMMUTABLE_CONSTRAINT__"] } }, summary: { type: "string" } }, required: ["code", "sectionIds", "violatedImmutableConstraintIds", "summary"] });

export function createCreatorScriptHolisticQaSchema(allowedSectionIds: string[], allowedConstraintIds: string[]) {
  return { type: "object", additionalProperties: false, properties: { hardComplianceFindings: { type: "array", items: findingSchema(allowedSectionIds, allowedConstraintIds, ["creator_constraint", "unsupported_factual_material"]) }, advisoryFindings: { type: "array", items: findingSchema(allowedSectionIds, allowedConstraintIds, ["progression", "repetition", "role_separation", "social_consequence", "conclusion", "tone"]) } }, required: ["hardComplianceFindings", "advisoryFindings"] };
}

export function parseCreatorScriptHolisticQa(input: { output: unknown; allowedSectionIds: string[]; allowedConstraintIds: string[] }): CreatorScriptHolisticQa {
  const output = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : null;
  if (!output || Object.keys(output).some((key) => !["hardComplianceFindings", "advisoryFindings"].includes(key)) || !Array.isArray(output.hardComplianceFindings) || !Array.isArray(output.advisoryFindings)) throw new Error("CREATOR_SCRIPT_REFINEMENT_QA_INVALID");
  const parseFindings = (values: unknown[], allowedCodes: string[]) => values.map((value) => {
    const finding = value && typeof value === "object" ? value as Record<string, unknown> : null;
    if (!finding || Object.keys(finding).some((key) => !["code", "sectionIds", "violatedImmutableConstraintIds", "summary"].includes(key)) || !allowedCodes.includes(String(finding.code)) || !Array.isArray(finding.sectionIds) || finding.sectionIds.some((id) => !input.allowedSectionIds.includes(String(id))) || !Array.isArray(finding.violatedImmutableConstraintIds) || finding.violatedImmutableConstraintIds.some((id) => !input.allowedConstraintIds.includes(String(id))) || typeof finding.summary !== "string" || !finding.summary.trim()) throw new Error("CREATOR_SCRIPT_REFINEMENT_QA_INVALID");
    const code = String(finding.code) as CreatorScriptHolisticQaFinding["code"];
    return {
      code,
      sectionIds: [...new Set(finding.sectionIds.map(String))],
      violatedImmutableConstraintIds: [...new Set(finding.violatedImmutableConstraintIds.map(String))],
      summary: finding.summary.trim().slice(0, 1000),
    };
  });
  return { hardComplianceFindings: parseFindings(output.hardComplianceFindings, ["creator_constraint", "unsupported_factual_material"]), advisoryFindings: parseFindings(output.advisoryFindings, ["progression", "repetition", "role_separation", "social_consequence", "conclusion", "tone"]) };
}

export function reconcileCreatorScriptHolisticQaConstraints(input: { qa: CreatorScriptHolisticQa; remainingForbiddenTerms: string[] }) {
  const literalPattern = /\b(?:THYNEL|THNK|meta-reference|editorial (?:approach|method|commitment)|documentary (?:mission|intent))\b/iu;
  const constraintPattern = /\b(?:violat(?:e|es|ed|ion)|forbidden|prohibited|immutable creator constraint)\b/iu;
  const retainedAdvisories: CreatorScriptHolisticQaFinding[] = []; const promoted: CreatorScriptHolisticQaFinding[] = []; const droppedFalseLiteralClaims: CreatorScriptHolisticQaFinding[] = [];
  const retainedHardFindings = input.qa.hardComplianceFindings.filter((finding) => {
    const falseLiteralClaim = finding.code === "creator_constraint" && literalPattern.test(finding.summary) && input.remainingForbiddenTerms.length === 0;
    if (falseLiteralClaim) droppedFalseLiteralClaims.push(finding);
    return !falseLiteralClaim;
  });
  for (const finding of input.qa.advisoryFindings) {
    const assertsConstraintViolation = finding.violatedImmutableConstraintIds.length > 0 || constraintPattern.test(finding.summary);
    const assertsLiteralResidual = literalPattern.test(finding.summary);
    if (assertsLiteralResidual && input.remainingForbiddenTerms.length === 0) { droppedFalseLiteralClaims.push(finding); continue; }
    if (assertsConstraintViolation) { promoted.push({ ...finding, code: "creator_constraint" }); continue; }
    retainedAdvisories.push(finding);
  }
  return { qa: { hardComplianceFindings: [...retainedHardFindings, ...promoted], advisoryFindings: retainedAdvisories }, droppedFalseLiteralClaims };
}

export function getCreatorScriptRefinementReplacementRange(input: { previousDocument: string; nextDocument: string; start: number; end: number }) {
  const { previousDocument, nextDocument, start, end } = input;
  const suffixLength = previousDocument.length - end;
  if (start < 0 || end <= start || end > previousDocument.length || previousDocument.slice(0, start) !== nextDocument.slice(0, start) || previousDocument.slice(end) !== nextDocument.slice(nextDocument.length - suffixLength)) return null;
  return { start, end: nextDocument.length - suffixLength };
}

export function getCreatorScriptRefinementChangedRanges(previous: CreatorScript, next: CreatorScript) {
  let cursor = 0;
  return next.sections.flatMap((section, index) => {
    const start = cursor; cursor += section.text.length + (index < next.sections.length - 1 ? 2 : 0);
    return previous.sections[index]?.id === section.id && previous.sections[index]?.text === section.text ? [] : [{ start, end: start + section.text.length }];
  });
}

export function validateCreatorScriptSelection(script: CreatorScript, start: number, end: number, selectedText: string) {
  const document = getCreatorScriptDocumentText(script);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > document.length || document.slice(start, end) !== selectedText) throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_STALE");
  let cursor = 0;
  const affectedSectionIds = script.sections.filter((section) => { const sectionStart = cursor; const sectionEnd = cursor + section.text.length; cursor = sectionEnd + 2; return start < sectionEnd && end > sectionStart; }).map((section) => section.id);
  return { document, start, end, selectedText, affectedSectionIds, contextBefore: document.slice(Math.max(0, start - 800), start), contextAfter: document.slice(end, end + 800) };
}

export function applyCreatorScriptSelectionRefinement(script: CreatorScript, input: { start: number; end: number; selectedText: string; replacementText: string }) {
  const selection = validateCreatorScriptSelection(script, input.start, input.end, input.selectedText);
  return editCreatorScriptDocument(script, `${selection.document.slice(0, selection.start)}${input.replacementText}${selection.document.slice(selection.end)}`);
}

export function applyCreatorScriptOpeningRefinement(script: CreatorScript, replacementText: string) { return editCreatorScriptSection(script, script.sections[0].id, replacementText); }

export function createCreatorScriptWholeRefinementCandidate(script: CreatorScript, replacements: Array<{ id: string; text: string }>) {
  if (replacements.length !== script.sections.length || replacements.some((item, index) => item.id !== script.sections[index].id || !item.text.trim())) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTIONS_INCOMPLETE");
  return mergeCreatorScriptReplacementSections({ script, replacements: script.sections.map((section, index) => ({ ...section, text: replacements[index].text, evidenceReviewRequired: section.claimIds.length > 0, humanVerification: undefined })) });
}

export function applyCreatorScriptWholeRefinement(script: CreatorScript, replacements: Array<{ id: string; text: string }>, language: "tr" | "en") {
  const next = createCreatorScriptWholeRefinementCandidate(script, replacements);
  if (getCreatorScriptDurationContractForScript(next, language).status !== "compliant") throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
  return next;
}
