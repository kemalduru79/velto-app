import CreatorEditorTimeline, {
  type CreatorEditorTimelineScene,
} from "@/components/create/CreatorEditorTimeline";

type CreatorEditorProps = {
  scenes: readonly CreatorEditorTimelineScene[];
  selectedCreatorSceneId: string | null;
  onSelectScene: (creatorSceneId: string) => void;
  language: "en" | "tr";
};

export default function CreatorEditor({
  scenes,
  selectedCreatorSceneId,
  onSelectScene,
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
    </section>
  );
}
