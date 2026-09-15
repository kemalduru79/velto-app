export type CreatorScriptEditorialState = "no_script" | "current" | "stale";

export function resolveCreatorScriptEditorialState(input: {
  hasScript: boolean;
  isCurrent: boolean;
}): CreatorScriptEditorialState {
  if (!input.hasScript) return "no_script";
  return input.isCurrent ? "current" : "stale";
}

export function creatorSceneBuildRecoveryMessage(input: {
  code?: string | null;
  language: "tr" | "en";
}): string {
  const code = input.code || "";
  const english = input.language === "en";

  if (code === "PROJECT_SAVE_CONFLICT") {
    return english
      ? "This project changed while you were working. Reload and try again."
      : "Sen çalışırken bu proje değişti. Yeniden yükleyip tekrar dene.";
  }
  if (code.includes("pending_refinement")) {
    return english
      ? "Apply or discard the current refinement before continuing."
      : "Devam etmeden önce mevcut iyileştirmeyi uygula veya vazgeç.";
  }
  if (code === "CREATOR_SCRIPT_APPROVAL_STALE") {
    return english
      ? "The script changed after approval. Approve the current version to rebuild scenes."
      : "Metin onaydan sonra değişti. Sahneleri yeniden oluşturmak için güncel sürümü onayla.";
  }
  if (code.startsWith("CREATOR_SCRIPT_APPROVAL")) {
    return english
      ? "Review and approve the current script before building scenes."
      : "Sahneleri oluşturmadan önce güncel metni inceleyip onayla.";
  }
  return english
    ? "Scenes couldn’t be built. Try again, or reload the project if the issue continues."
    : "Sahneler oluşturulamadı. Tekrar dene; sorun sürerse projeyi yeniden yükle.";
}
