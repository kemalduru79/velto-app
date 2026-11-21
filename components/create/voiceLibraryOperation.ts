import type { CreatorVoicePickerTarget } from "./createWorkspacePanelTypes";
import { advanceCreatorProjectOperationOrigin, type CreatorProjectOperationOrigin } from "@/lib/creator/projectSaveCoordinator";

// Display identity only; possession never authorizes a parent command.
export type CreatorVoiceLibraryTarget = CreatorVoicePickerTarget & Readonly<{ creatorSceneId?: string }>;

type VoiceSceneIdentity = { id: number; creatorSceneId?: string };
type VoiceCharacterIdentity = { id?: string };
export type CreatorVoiceOperationBinding = Readonly<{
  origin: CreatorProjectOperationOrigin;
  target: CreatorVoiceLibraryTarget;
  scene?: Readonly<{ stableId: string; original: VoiceSceneIdentity }>;
}>;

// Legacy scenes have no durable ID: only the exact admitted object is safe.
// Never synthesize a canonical ID or treat a reused ordinal as scene identity.
export function captureCreatorVoiceOperation(
  target: CreatorVoicePickerTarget,
  origin: CreatorProjectOperationOrigin,
  scenes: readonly VoiceSceneIdentity[],
  characters: readonly VoiceCharacterIdentity[],
): CreatorVoiceOperationBinding | null {
  let scene: CreatorVoiceOperationBinding["scene"];
  if (target.scope === "scene_narrator" || target.scope === "scene_dialogue") {
    const matches = scenes.filter(candidate => candidate.id === target.sceneId);
    if (matches.length !== 1) return null;
    const original = matches[0];
    const stableId = original.creatorSceneId?.trim() || "";
    if (stableId && scenes.filter(candidate => candidate.creatorSceneId === stableId).length !== 1) return null;
    scene = Object.freeze({ stableId, original });
  } else if (target.scope === "character" && (!target.characterId || characters.filter(character => character.id === target.characterId).length !== 1)) {
    return null;
  }
  return Object.freeze({ origin: Object.freeze({ ...origin }), target: Object.freeze({ ...target, ...(scene?.stableId ? { creatorSceneId: scene.stableId } : {}) }), scene });
}

export function matchesCreatorVoiceOperationScene(binding: CreatorVoiceOperationBinding, scene: VoiceSceneIdentity) {
  return Boolean(binding.scene && (binding.scene.stableId
    ? scene.creatorSceneId === binding.scene.stableId
    : scene === binding.scene.original));
}

export function isCreatorVoiceOperationActive(
  binding: CreatorVoiceOperationBinding,
  active: CreatorProjectOperationOrigin,
  scenes: readonly VoiceSceneIdentity[],
  characters: readonly VoiceCharacterIdentity[],
) {
  if (!advanceCreatorProjectOperationOrigin(binding.origin, active)) return false;
  if (binding.scene) return scenes.filter(scene => matchesCreatorVoiceOperationScene(binding, scene)).length === 1;
  const target = binding.target;
  return target.scope !== "character" || characters.filter(character => character.id === target.characterId).length === 1;
}
