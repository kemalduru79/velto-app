import {
  editCreatorScriptDocument,
  normalizeCreatorScript,
  regenerateCreatorScriptSection,
  type CreatorScript,
} from "./creatorScript.ts";

export type CreatorScriptMutationCommand =
  | { type: "manual_document_edit"; expectedRevision: number; documentText: string }
  | { type: "section_regeneration"; expectedRevision: number; targetSectionId: string; script: CreatorScript }
  | { type: "generated_script_replacement"; expectedRevision: number | null; script: CreatorScript };

const record = (value: unknown) => value && typeof value === "object"
  ? value as Record<string, unknown>
  : null;

export function parseCreatorScriptMutationCommand(value: unknown): CreatorScriptMutationCommand | null {
  if (value === undefined) return null;
  const input = record(value);
  if (!input || typeof input.type !== "string") throw new Error("CREATOR_SCRIPT_MUTATION_INVALID");
  if (input.type === "manual_document_edit") {
    if (!Number.isInteger(input.expectedRevision) || typeof input.documentText !== "string" || !input.documentText.trim()) {
      throw new Error("CREATOR_SCRIPT_MUTATION_INVALID");
    }
    return { type: input.type, expectedRevision: Number(input.expectedRevision), documentText: input.documentText };
  }
  if (input.type === "section_regeneration") {
    if (!Number.isInteger(input.expectedRevision) || typeof input.targetSectionId !== "string" || !input.targetSectionId.trim()) {
      throw new Error("CREATOR_SCRIPT_MUTATION_INVALID");
    }
    return {
      type: input.type,
      expectedRevision: Number(input.expectedRevision),
      targetSectionId: input.targetSectionId.trim(),
      script: normalizeCreatorScript(input.script),
    };
  }
  if (input.type === "generated_script_replacement") {
    if (input.expectedRevision !== null && !Number.isInteger(input.expectedRevision)) {
      throw new Error("CREATOR_SCRIPT_MUTATION_INVALID");
    }
    return {
      type: input.type,
      expectedRevision: input.expectedRevision === null ? null : Number(input.expectedRevision),
      script: normalizeCreatorScript(input.script),
    };
  }
  throw new Error("CREATOR_SCRIPT_MUTATION_INVALID");
}

export function applyCreatorScriptMutationCommand(input: {
  persistedScript: CreatorScript | null;
  command: CreatorScriptMutationCommand;
  updatedAt?: string;
}) {
  const { persistedScript, command } = input;
  const persistedRevision = persistedScript?.revision ?? null;
  if (command.expectedRevision !== persistedRevision) throw new Error("CREATOR_SCRIPT_MUTATION_STALE");

  if (command.type === "manual_document_edit") {
    if (!persistedScript) throw new Error("CREATOR_SCRIPT_MUTATION_STALE");
    const script = editCreatorScriptDocument(persistedScript, command.documentText, input.updatedAt);
    if (script === persistedScript || script.revision !== persistedScript.revision + 1) {
      throw new Error("CREATOR_SCRIPT_MUTATION_INVALID_TRANSITION");
    }
    return script;
  }

  if (command.type === "section_regeneration") {
    if (!persistedScript) throw new Error("CREATOR_SCRIPT_MUTATION_STALE");
    const replacement = command.script.sections.find((section) => section.id === command.targetSectionId);
    if (!replacement) throw new Error("CREATOR_SCRIPT_MUTATION_INVALID_TRANSITION");
    const script = regenerateCreatorScriptSection(
      persistedScript,
      command.targetSectionId,
      replacement,
      input.updatedAt,
    );
    if (script.revision !== persistedScript.revision + 1) throw new Error("CREATOR_SCRIPT_MUTATION_INVALID_TRANSITION");
    return script;
  }

  return normalizeCreatorScript({
    ...command.script,
    revision: (persistedScript?.revision ?? 0) + 1,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    approval: null,
  });
}

export function resolveCreatorScriptMutationAuthority(input: {
  persistedScript: CreatorScript | null;
  candidateScript: CreatorScript | null;
  commandValue: unknown;
  updatedAt?: string;
}) {
  const command = parseCreatorScriptMutationCommand(input.commandValue);
  const candidateDiffers = JSON.stringify(input.persistedScript) !== JSON.stringify(input.candidateScript);
  if (candidateDiffers && !command) throw new Error("CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED");
  if (!command) return input.candidateScript;
  return applyCreatorScriptMutationCommand({
    persistedScript: input.persistedScript,
    command,
    updatedAt: input.updatedAt,
  });
}
