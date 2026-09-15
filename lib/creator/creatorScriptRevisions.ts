import { getCreatorScriptDocumentText, type CreatorScript } from "./creatorScript.ts";
import { applyCreatorScriptOpeningRefinement, applyCreatorScriptSelectionRefinement, applyCreatorScriptWholeRefinement, type CreatorScriptRefinementScope } from "./creatorScriptRefinement.ts";

export const CREATOR_SCRIPT_HISTORY_LIMIT = 12;
export const CREATOR_SCRIPT_HISTORY_TEXT_LIMIT = 240_000;

export type CreatorScriptChange = {
  sectionId: string;
  sectionHeading: string;
  beforeText: string;
  afterText: string;
  selectionStart?: number;
  selectionEnd?: number;
};

export type CreatorScriptPendingRefinement = {
  proposalId: string;
  baseRevision: number;
  scope: CreatorScriptRefinementScope;
  instruction: string;
  createdAt: string;
  changes: CreatorScriptChange[];
};

export type CreatorScriptRevisionHistoryEntry = {
  id: string;
  fromRevision: number;
  toRevision: number;
  createdAt: string;
  origin: "manual" | "ai_selection" | "ai_opening" | "ai_whole_script";
  instruction?: string;
  changes: CreatorScriptChange[];
};

export function discardCreatorScriptProposal<T extends { script: CreatorScript | null; pendingRefinement?: CreatorScriptPendingRefinement | null; revisionHistory?: CreatorScriptRevisionHistoryEntry[] }>(state: T, proposalId: string): T {
  if (!state.pendingRefinement || state.pendingRefinement.proposalId !== proposalId) throw new Error("CREATOR_SCRIPT_REFINEMENT_STALE");
  return { ...state, pendingRefinement: null };
}

export function isValidCreatorScriptChange(value: unknown): value is CreatorScriptChange {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return typeof item.sectionId === "string" && item.sectionId.length > 0 && item.sectionId.length <= 200 &&
    typeof item.sectionHeading === "string" && item.sectionHeading.length <= 500 &&
    typeof item.beforeText === "string" && item.beforeText.length <= 100_000 &&
    typeof item.afterText === "string" && item.afterText.length <= 100_000 &&
    (!Object.prototype.hasOwnProperty.call(item, "selectionStart") || Number.isInteger(item.selectionStart)) &&
    (!Object.prototype.hasOwnProperty.call(item, "selectionEnd") || Number.isInteger(item.selectionEnd));
}

export function isValidCreatorScriptPendingRefinement(value: unknown): value is CreatorScriptPendingRefinement {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return typeof item.proposalId === "string" && item.proposalId.length > 0 && item.proposalId.length <= 120 && Number.isInteger(item.baseRevision) &&
    ["selection", "opening", "whole_script"].includes(String(item.scope)) &&
    typeof item.instruction === "string" && item.instruction.length > 0 && item.instruction.length <= 2000 && typeof item.createdAt === "string" &&
    Array.isArray(item.changes) && item.changes.length > 0 && item.changes.every(isValidCreatorScriptChange);
}

export function isValidCreatorScriptHistory(value: unknown): value is CreatorScriptRevisionHistoryEntry[] {
  return Array.isArray(value) && value.length <= CREATOR_SCRIPT_HISTORY_LIMIT && value.reduce((total, entry) => total + ((entry as CreatorScriptRevisionHistoryEntry)?.changes || []).reduce((changeTotal, change) => changeTotal + (change?.beforeText?.length || 0) + (change?.afterText?.length || 0), 0), 0) <= CREATOR_SCRIPT_HISTORY_TEXT_LIMIT && value.every((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return typeof item.id === "string" && Number.isInteger(item.fromRevision) && Number.isInteger(item.toRevision) &&
      typeof item.createdAt === "string" && ["manual", "ai_selection", "ai_opening", "ai_whole_script"].includes(String(item.origin)) &&
      (!Object.prototype.hasOwnProperty.call(item, "instruction") || typeof item.instruction === "string") &&
      Array.isArray(item.changes) && item.changes.every(isValidCreatorScriptChange);
  });
}

export function createCreatorScriptChanges(before: CreatorScript, after: CreatorScript): CreatorScriptChange[] {
  return after.sections.flatMap((section, index) => {
    const prior = before.sections[index];
    return prior?.id === section.id && prior.text !== section.text
      ? [{ sectionId: section.id, sectionHeading: section.heading || section.kind, beforeText: prior.text, afterText: section.text }]
      : [];
  });
}

export function createCreatorScriptProposal(input: { script: CreatorScript; scope: CreatorScriptRefinementScope; instruction: string; nextScript: CreatorScript; selectionStart?: number; selectionEnd?: number; selectedText?: string; replacementText?: string }) {
  let changes = createCreatorScriptChanges(input.script, input.nextScript);
  if (input.scope === "selection" && input.selectionStart !== undefined && input.selectionEnd !== undefined && input.selectedText !== undefined && input.replacementText !== undefined) {
    if (input.selectedText === input.replacementText) throw new Error("CREATOR_SCRIPT_REFINEMENT_NO_CHANGE");
    const section = input.script.sections.find((item) => changes.some((change) => change.sectionId === item.id));
    changes = [{ sectionId: section?.id || "selection", sectionHeading: section?.heading || "Selected text", beforeText: input.selectedText, afterText: input.replacementText, selectionStart: input.selectionStart, selectionEnd: input.selectionEnd }];
  }
  if (!changes.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_NO_CHANGE");
  return { proposalId: crypto.randomUUID(), baseRevision: input.script.revision, scope: input.scope, instruction: input.instruction, createdAt: new Date().toISOString(), changes } satisfies CreatorScriptPendingRefinement;
}

export function applyCreatorScriptProposal(script: CreatorScript, proposal: CreatorScriptPendingRefinement, language: "tr" | "en") {
  if (script.revision !== proposal.baseRevision) throw new Error("CREATOR_SCRIPT_REFINEMENT_STALE");
  if (proposal.scope === "selection") {
    if (proposal.changes.length !== 1) throw new Error("CREATOR_SCRIPT_REFINEMENT_PROPOSAL_INVALID");
    const change = proposal.changes[0];
    if (change.selectionStart === undefined || change.selectionEnd === undefined) throw new Error("CREATOR_SCRIPT_REFINEMENT_PROPOSAL_INVALID");
    return applyCreatorScriptSelectionRefinement(script, { start: change.selectionStart, end: change.selectionEnd, selectedText: change.beforeText, replacementText: change.afterText });
  }
  if (proposal.scope === "opening") {
    if (proposal.changes.length !== 1) throw new Error("CREATOR_SCRIPT_REFINEMENT_PROPOSAL_INVALID");
    const change = proposal.changes[0];
    if (script.sections[0]?.id !== change.sectionId || script.sections[0].text !== change.beforeText) throw new Error("CREATOR_SCRIPT_REFINEMENT_STALE");
    return applyCreatorScriptOpeningRefinement(script, change.afterText);
  }
  const changes = new Map(proposal.changes.map((change) => [change.sectionId, change]));
  if (changes.size !== proposal.changes.length || proposal.changes.some((change) => !script.sections.some((section) => section.id === change.sectionId))) throw new Error("CREATOR_SCRIPT_REFINEMENT_PROPOSAL_INVALID");
  for (const section of script.sections) {
    const change = changes.get(section.id);
    if (change && change.beforeText !== section.text) throw new Error("CREATOR_SCRIPT_REFINEMENT_STALE");
  }
  return applyCreatorScriptWholeRefinement(script, script.sections.map((section) => ({ id: section.id, text: changes.get(section.id)?.afterText || section.text })), language);
}

export function appendCreatorScriptHistory(history: CreatorScriptRevisionHistoryEntry[], input: Omit<CreatorScriptRevisionHistoryEntry, "id" | "createdAt">) {
  if (!input.changes.length) return history;
  const candidates = [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input }, ...history];
  const bounded: CreatorScriptRevisionHistoryEntry[] = [];
  let textLength = 0;
  for (const entry of candidates) {
    const entryTextLength = entry.changes.reduce((total, change) => total + change.beforeText.length + change.afterText.length, 0);
    if (bounded.length >= CREATOR_SCRIPT_HISTORY_LIMIT || textLength + entryTextLength > CREATOR_SCRIPT_HISTORY_TEXT_LIMIT) break;
    bounded.push(entry);
    textLength += entryTextLength;
  }
  return bounded;
}

export function creatorScriptTextChanged(before: CreatorScript | null, after: CreatorScript | null) {
  return Boolean(before && after && getCreatorScriptDocumentText(before) !== getCreatorScriptDocumentText(after));
}

export const normalizeCreatorScriptRevisionState = (input: { pending?: unknown; history?: unknown }) => ({
  pending: isValidCreatorScriptPendingRefinement(input.pending) ? input.pending : null,
  history: isValidCreatorScriptHistory(input.history) ? input.history : [],
});
