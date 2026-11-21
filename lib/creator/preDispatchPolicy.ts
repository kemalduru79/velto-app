export type CreatorDispatchCountdownState = {
  sceneIds: readonly number[];
  secondsRemaining: number;
  totalSeconds: number;
};

export function freezeCreatorSceneScope(requestedIds: readonly number[], availableIds: readonly number[]) {
  const available = new Set(availableIds);
  return Object.freeze(Array.from(new Set(requestedIds)).filter((id) => available.has(id)));
}

export function createCreatorDispatchCountdown(sceneIds: readonly number[], seconds: number): CreatorDispatchCountdownState {
  return {
    sceneIds: Object.freeze([...sceneIds]),
    secondsRemaining: Math.max(1, Math.floor(seconds)),
    totalSeconds: Math.max(1, Math.floor(seconds)),
  };
}

export function advanceCreatorDispatchCountdown(state: CreatorDispatchCountdownState) {
  return state.secondsRemaining <= 1
    ? { state: { ...state, secondsRemaining: 0 }, dispatch: true }
    : { state: { ...state, secondsRemaining: state.secondsRemaining - 1 }, dispatch: false };
}

export function getCreatorDispatchUiPhase(
  countdown: CreatorDispatchCountdownState | null,
  isGenerating: boolean,
) {
  if (countdown && countdown.secondsRemaining > 0) return "countdown" as const;
  return isGenerating ? "generating" as const : "idle" as const;
}
