import {
  editCreatorScriptDocument,
  editCreatorScriptSection,
  getCreatorScriptDocumentText,
  getCreatorScriptDurationContractForScript,
  mergeCreatorScriptReplacementSections,
  type CreatorScript,
} from "./creatorScript.ts";

export type CreatorScriptRefinementScope = "selection" | "opening" | "whole_script";

export function getCreatorScriptRefinementReplacementRange(input: { previousDocument: string; nextDocument: string; start: number; end: number }) {
  const { previousDocument, nextDocument, start, end } = input;
  const suffixLength = previousDocument.length - end;
  if (start < 0 || end <= start || end > previousDocument.length || previousDocument.slice(0, start) !== nextDocument.slice(0, start) || previousDocument.slice(end) !== nextDocument.slice(nextDocument.length - suffixLength)) {
    return null;
  }
  return { start, end: nextDocument.length - suffixLength };
}

export function getCreatorScriptRefinementChangedRanges(previous: CreatorScript, next: CreatorScript) {
  let cursor = 0;
  return next.sections.flatMap((section, index) => {
    const start = cursor;
    cursor += section.text.length + (index < next.sections.length - 1 ? 2 : 0);
    return previous.sections[index]?.id === section.id && previous.sections[index]?.text === section.text
      ? []
      : [{ start, end: start + section.text.length }];
  });
}

export function validateCreatorScriptSelection(script: CreatorScript, start: number, end: number, selectedText: string) {
  const document = getCreatorScriptDocumentText(script);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > document.length || document.slice(start, end) !== selectedText) {
    throw new Error("CREATOR_SCRIPT_REFINEMENT_SELECTION_STALE");
  }
  let cursor = 0;
  const affectedSectionIds = script.sections.filter((section) => {
    const sectionStart = cursor; const sectionEnd = cursor + section.text.length; cursor = sectionEnd + 2;
    return start < sectionEnd && end > sectionStart;
  }).map((section) => section.id);
  return { document, start, end, selectedText, affectedSectionIds, contextBefore: document.slice(Math.max(0, start - 800), start), contextAfter: document.slice(end, end + 800) };
}

export function applyCreatorScriptSelectionRefinement(script: CreatorScript, input: { start: number; end: number; selectedText: string; replacementText: string }) {
  const selection = validateCreatorScriptSelection(script, input.start, input.end, input.selectedText);
  return editCreatorScriptDocument(script, `${selection.document.slice(0, selection.start)}${input.replacementText}${selection.document.slice(selection.end)}`);
}

export function applyCreatorScriptOpeningRefinement(script: CreatorScript, replacementText: string) {
  return editCreatorScriptSection(script, script.sections[0].id, replacementText);
}

export function applyCreatorScriptWholeRefinement(script: CreatorScript, replacements: Array<{ id: string; text: string }>, language: "tr" | "en") {
  const byId = new Map(replacements.map((item) => [item.id, item.text]));
  if (byId.size !== script.sections.length || script.sections.some((section) => !byId.get(section.id)?.trim())) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTIONS_INCOMPLETE");
  const next = mergeCreatorScriptReplacementSections({ script, replacements: script.sections.map((section) => ({ ...section, text: byId.get(section.id), evidenceReviewRequired: section.claimIds.length > 0, humanVerification: undefined })) });
  if (getCreatorScriptDurationContractForScript(next, language).status !== "compliant") throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
  return next;
}
