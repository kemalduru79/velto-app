import CreatorEditorTimeline, {
  type CreatorEditorTimelineScene,
} from "@/components/create/CreatorEditorTimeline";

type CreatorEditorProps = {
  scenes: readonly CreatorEditorTimelineScene[];
  selectedCreatorSceneId: string | null;
  onSelectScene: (creatorSceneId: string) => void;
  onMoveScene: (direction: "earlier" | "later") => void;
  onDuplicateScene: () => void;
  onDeleteScene: () => void;
  onUndo: () => void;
  canUndo: boolean;
  language: "en" | "tr";
};

export default function CreatorEditor({
  scenes,
  selectedCreatorSceneId,
  onSelectScene,
  onMoveScene,
  onDuplicateScene,
  onDeleteScene,
  onUndo,
  canUndo,
  language,
}: CreatorEditorProps) {
  const selectedScene =
    scenes.find((scene) => scene.creatorSceneId === selectedCreatorSceneId) ||
    scenes[0];
  const selectedIndex = selectedScene ? scenes.indexOf(selectedScene) : -1;

  if (!selectedScene) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5" data-creator-editor="foundation">
      <div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {language === "en" ? "Draft Preview" : "Taslak Önizleme"}
          </span>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            {language === "en" ? "Creator Editor" : "Creator Editor"}
          </h2>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.55fr)]">
        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
          {selectedScene.videoUrl ? (
            <video src={selectedScene.videoUrl} controls preload="metadata" className="max-h-80 w-full object-contain" />
          ) : selectedScene.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedScene.image} alt="" className="max-h-80 w-full object-contain" />
          ) : (
            <div className="px-6 text-center text-sm text-slate-300">
              {language === "en" ? "Media preview will appear here." : "Medya önizlemesi burada görünecek."}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {language === "en" ? "Selected scene" : "Seçili sahne"} {selectedIndex + 1}
          </span>
          <h3 className="mt-2 text-sm font-bold text-slate-950">
            {selectedScene.text || (language === "en" ? "Untitled scene" : "Başlıksız sahne")}
          </h3>
          <p className="mt-2 line-clamp-6 text-xs leading-5 text-slate-600">
            {selectedScene.narration || (language === "en" ? "No narration yet." : "Henüz anlatım yok.")}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <CreatorEditorTimeline
          scenes={scenes}
          selectedCreatorSceneId={selectedCreatorSceneId}
          onSelectScene={onSelectScene}
          language={language}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3" aria-label={language === "en" ? "Selected scene actions" : "Seçili sahne işlemleri"}>
        <span className="mr-auto text-xs font-semibold text-slate-700">
          {language === "en" ? "Scene Actions" : "Sahne İşlemleri"}
        </span>
        <button
          type="button"
          aria-label={language === "en" ? "Move selected scene earlier" : "Seçili sahneyi önceye taşı"}
          onClick={() => onMoveScene("earlier")}
          disabled={selectedIndex <= 0}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {language === "en" ? "Move Earlier" : "Önceye Taşı"}
        </button>
        <button
          type="button"
          aria-label={language === "en" ? "Move selected scene later" : "Seçili sahneyi sonraya taşı"}
          onClick={() => onMoveScene("later")}
          disabled={selectedIndex < 0 || selectedIndex >= scenes.length - 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {language === "en" ? "Move Later" : "Sonraya Taşı"}
        </button>
        <button
          type="button"
          aria-label={language === "en" ? "Duplicate selected scene" : "Seçili sahneyi çoğalt"}
          onClick={onDuplicateScene}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800"
        >
          {language === "en" ? "Duplicate" : "Çoğalt"}
        </button>
        <button
          type="button"
          aria-label={language === "en" ? "Delete selected scene" : "Seçili sahneyi sil"}
          onClick={onDeleteScene}
          disabled={scenes.length <= 1}
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {language === "en" ? "Delete" : "Sil"}
        </button>
        {canUndo && (
          <button
            type="button"
            aria-label={language === "en" ? "Undo latest scene change" : "Son sahne değişikliğini geri al"}
            onClick={onUndo}
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800"
          >
            {language === "en" ? "Undo" : "Geri Al"}
          </button>
        )}
      </div>
    </section>
  );
}
