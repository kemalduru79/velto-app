import { creatorSceneOutputIsCurrent } from "./creatorScriptApproval.ts";
import type { CreatorScript } from "./creatorScript.ts";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function createCreatorAutosaveSemanticKey(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function shouldPersistCreatorAutosaveIntent(input: {
  baselineKey: string | null;
  currentKey: string;
}) {
  return input.baselineKey !== null && input.baselineKey !== input.currentKey;
}

export function resolveCreatorAddedSceneScriptRevision(input: {
  script: CreatorScript | null;
  productionPackage: unknown;
  scenes: unknown[];
}) {
  return creatorSceneOutputIsCurrent(input) ? input.script?.revision ?? null : null;
}
