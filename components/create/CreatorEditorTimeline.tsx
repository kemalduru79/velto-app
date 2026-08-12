import { isCreatorSceneId } from "@/lib/creator/editorState";

export type CreatorEditorTimelineScene = {
  id: number;
  creatorSceneId?: string;
  text: string;
  narration: string;
  dialogue: string;
  image?: string;
  videoUrl?: string;
  videoStatus?: "idle" | "processing" | "delayed" | "done" | "error";
  videoGenerationSignature?: string;
  assetHistory?: Array<{
    id: string; kind: "image" | "video"; url: string; createdAt: string;
    durationSec?: number; generationSignature?: string;
  }>;
  renderMode?: "video" | "image";
  clipInSec?: number;
  clipOutSec?: number;
  timing?: {
    narrationDuration?: number;
    dialogueDuration?: number;
    totalAudioDuration?: number;
    targetSceneDuration?: number;
    speechTailBuffer?: number;
  };
};

type CreatorEditorTimelineProps = {
  scenes: readonly CreatorEditorTimelineScene[];
  selectedCreatorSceneId: string | null;
  onSelectScene: (creatorSceneId: string) => void;
  language: "en" | "tr";
};

export default function CreatorEditorTimeline({
  scenes,
  selectedCreatorSceneId,
  onSelectScene,
  language,
}: CreatorEditorTimelineProps) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2"
      role="list"
      aria-label={language === "en" ? "Creator Editor scene timeline" : "Creator Editor sahne zaman çizelgesi"}
    >
      {scenes.map((scene, index) => {
        if (!isCreatorSceneId(scene.creatorSceneId)) return null;

        const selected = scene.creatorSceneId === selectedCreatorSceneId;
        const summary = scene.text || scene.narration || (language === "en" ? "Untitled scene" : "Başlıksız sahne");

        return (
          <button
            key={scene.creatorSceneId}
            type="button"
            role="listitem"
            aria-pressed={selected}
            aria-label={`${language === "en" ? "Select scene" : "Sahneyi seç"} ${index + 1}: ${summary}`}
            onClick={() => onSelectScene(scene.creatorSceneId!)}
            className={`min-w-44 max-w-56 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              selected
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {language === "en" ? "Scene" : "Sahne"} {index + 1}
            </span>
            <strong className="mt-1 block truncate text-xs text-slate-950">{summary}</strong>
            <span className="mt-2 block text-[10px] text-slate-500">
              {scene.videoUrl
                ? "Video"
                : scene.image
                  ? language === "en" ? "Image" : "Görsel"
                  : language === "en" ? "Draft" : "Taslak"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
