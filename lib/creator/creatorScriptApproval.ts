import { approveCreatorScript, creatorScriptHasGroundingBlocker, getCreatorScriptDurationContractForScript, type CreatorScript } from "./creatorScript.ts";
import type { CreatorProjectStateSnapshot } from "./projectState.ts";

export type CreatorScriptApprovalBlocker = "script_missing" | "strategy_stale" | "pending_refinement" | "duration" | "grounding";

export function getCreatorScriptApprovalBlockers(input: { script: CreatorScript | null; strategyFingerprint: string; language: "tr" | "en"; hasPendingRefinement: boolean }): CreatorScriptApprovalBlocker[] {
  if (!input.script) return ["script_missing"];
  const blockers: CreatorScriptApprovalBlocker[] = [];
  if (input.script.strategyFingerprint !== input.strategyFingerprint) blockers.push("strategy_stale");
  if (input.hasPendingRefinement) blockers.push("pending_refinement");
  if (getCreatorScriptDurationContractForScript(input.script, input.language).status !== "compliant") blockers.push("duration");
  if (creatorScriptHasGroundingBlocker(input.script)) blockers.push("grounding");
  return blockers;
}

export function approveCreatorScriptForProduction(input: { script: CreatorScript | null; strategyFingerprint: string; language: "tr" | "en"; hasPendingRefinement: boolean; approvedAt?: string }) {
  const blockers = getCreatorScriptApprovalBlockers(input);
  if (blockers.length) throw new Error(`CREATOR_SCRIPT_APPROVAL_BLOCKED:${blockers.join(",")}`);
  return approveCreatorScript(input.script as CreatorScript, input.strategyFingerprint, input.approvedAt);
}

export function assertCreatorScriptApprovalAuthority(persisted: CreatorScript, candidate: CreatorScript) {
  const textOrRevisionChanged = persisted.revision !== candidate.revision || persisted.sections.some((section, index) => section.text !== candidate.sections[index]?.text);
  if (textOrRevisionChanged) {
    if (candidate.approval !== null) throw new Error("CREATOR_SCRIPT_APPROVAL_FORGED");
    return candidate;
  }
  if (JSON.stringify(candidate.approval) !== JSON.stringify(persisted.approval)) throw new Error("CREATOR_SCRIPT_APPROVAL_FORGED");
  return candidate;
}

export function invalidateCreatorSceneAuthorityForScriptChange(state: CreatorProjectStateSnapshot): CreatorProjectStateSnapshot {
  return {
    ...state,
    production: { ...state.production, refinedScenes: [] },
    createReview: { ...state.createReview, scenes: [] },
    publish: { ...state.publish, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
  };
}

export function creatorSceneOutputIsCurrent(input: { script: CreatorScript | null; productionPackage: unknown; scenes: unknown[] }) {
  if (!input.script?.approval || input.script.approval.approvedRevision !== input.script.revision) return false;
  const packageRecord = input.productionPackage && typeof input.productionPackage === "object" && !Array.isArray(input.productionPackage) ? input.productionPackage as Record<string, unknown> : {};
  if (packageRecord.sourceScriptRevision !== input.script.revision || input.scenes.length === 0) return false;
  return input.scenes.every((scene) => scene && typeof scene === "object" && !Array.isArray(scene) && (scene as Record<string, unknown>).scriptRevision === input.script?.revision);
}
