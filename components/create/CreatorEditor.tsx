"use client";

import { useEffect, useRef, useState } from "react";
import CreatorEditorTimeline, {
  type CreatorEditorTimelineScene,
} from "@/components/create/CreatorEditorTimeline";
import {
  type CreatorAudioCurrentness,
  getCreatorSceneEffectiveDuration,
  normalizeCreatorSceneTrim,
} from "@/lib/creator/editorState";

type CreatorEditorProps = {
  scenes: readonly CreatorEditorTimelineScene[];
  selectedCreatorSceneId: string | null;
  onSelectScene: (creatorSceneId: string) => void;
  onMoveScene: (direction: "earlier" | "later") => void;
  onDuplicateScene: () => void;
  onDeleteScene: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onUpdateTrim: (trim: {
    clipInSec?: number;
    clipOutSec?: number;
    sourceDurationSec?: number;
  }) => void;
  onSaveText: (edit: { text: string; narration: string; dialogue: string }) => void;
  getNarrationAudioState: (creatorSceneId: string) => CreatorAudioCurrentness;
  getDialogueAudioState: (creatorSceneId: string) => CreatorAudioCurrentness;
  sceneOperationsDisabled?: boolean;
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
  onUpdateTrim,
  onSaveText,
  getNarrationAudioState,
  getDialogueAudioState,
  sceneOperationsDisabled = false,
  language,
}: CreatorEditorProps) {
  const selectedScene =
    scenes.find((scene) => scene.creatorSceneId === selectedCreatorSceneId) ||
    scenes[0];
  const selectedIndex = selectedScene ? scenes.indexOf(selectedScene) : -1;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sourceDurationSec, setSourceDurationSec] = useState(0);
  const [trimStartDraft, setTrimStartDraft] = useState("0");
  const [trimEndDraft, setTrimEndDraft] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [narrationDraft, setNarrationDraft] = useState("");
  const [dialogueDraft, setDialogueDraft] = useState("");
  const canonicalTextRef = useRef("");

  useEffect(() => {
    setSourceDurationSec(0);
    setTrimStartDraft("0");
    setTrimEndDraft("");
  }, [selectedScene?.creatorSceneId, selectedScene?.videoUrl]);

  useEffect(() => {
    if (!selectedScene) return;
    const canonical = JSON.stringify([
      selectedScene.creatorSceneId,
      selectedScene.text || "",
      selectedScene.narration || "",
      selectedScene.dialogue || "",
    ]);
    if (canonical === canonicalTextRef.current) return;
    canonicalTextRef.current = canonical;
    setTextDraft(selectedScene.text || "");
    setNarrationDraft(selectedScene.narration || "");
    setDialogueDraft(selectedScene.dialogue || "");
  }, [selectedScene]);

  if (!selectedScene) return null;

  const hasSelectedVideo = Boolean(
    selectedScene.videoUrl && selectedScene.renderMode !== "image",
  );
  const normalizedTrim = normalizeCreatorSceneTrim({
    clipInSec: selectedScene.clipInSec,
    clipOutSec: selectedScene.clipOutSec,
    sourceDurationSec,
    sourceType: hasSelectedVideo ? "video" : "image",
  });
  const textChanged =
    textDraft !== (selectedScene.text || "") ||
    narrationDraft !== (selectedScene.narration || "") ||
    dialogueDraft !== (selectedScene.dialogue || "");
  const narrationAudioState = getNarrationAudioState(selectedScene.creatorSceneId || "");
  const dialogueAudioState = getDialogueAudioState(selectedScene.creatorSceneId || "");
  const effectiveDurationSec = getCreatorSceneEffectiveDuration({
    visualDurationSec: normalizedTrim.visualDurationSec,
    targetDurationSec: selectedScene.timing?.targetSceneDuration,
    speechDurationSec:
      (narrationAudioState === "current"
        ? selectedScene.timing?.narrationDuration || 0
        : 0) +
      (dialogueAudioState === "current"
        ? selectedScene.timing?.dialogueDuration || 0
        : 0),
    speechTailBufferSec: selectedScene.timing?.speechTailBuffer ?? 0.75,
  });
  const voiceLabel = (state: CreatorAudioCurrentness) => {
    if (state === "current") return language === "en" ? "Voice ready" : "Ses hazır";
    if (state === "stale") return language === "en" ? "Voice needs refresh" : "Sesin yenilenmesi gerekiyor";
    if (state === "missing") return language === "en" ? "No voice generated" : "Ses üretilmedi";
    return language === "en" ? "No voice needed" : "Ses gerekmiyor";
  };
  const handleVideoMetadata = () => {
    const duration = videoRef.current?.duration || 0;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const trim = normalizeCreatorSceneTrim({
      clipInSec: selectedScene.clipInSec,
      clipOutSec: selectedScene.clipOutSec,
      sourceDurationSec: duration,
    });
    setSourceDurationSec(duration);
    setTrimStartDraft(String(trim.clipInSec ?? 0));
    setTrimEndDraft(String(trim.clipOutSec ?? Number(duration.toFixed(3))));
    if (videoRef.current && trim.isTrimmed) {
      videoRef.current.currentTime = trim.clipInSec || 0;
    }
  };
  const commitTrimDraft = () => {
    const start = Number(trimStartDraft);
    const end = Number(trimEndDraft);
    if (!sourceDurationSec || !Number.isFinite(start) || !Number.isFinite(end)) return;
    const trim = normalizeCreatorSceneTrim({
      clipInSec: start,
      clipOutSec: end,
      sourceDurationSec,
    });
    if (trim.isTrimmed) {
      setTrimStartDraft(String(trim.clipInSec));
      setTrimEndDraft(String(trim.clipOutSec));
      onUpdateTrim({
        clipInSec: trim.clipInSec,
        clipOutSec: trim.clipOutSec,
        sourceDurationSec,
      });
    } else if (start <= 0 && end >= sourceDurationSec) {
      onUpdateTrim({});
    }
  };

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
          {hasSelectedVideo ? (
            <video
              ref={videoRef}
              src={selectedScene.videoUrl}
              controls
              preload="metadata"
              onLoadedMetadata={handleVideoMetadata}
              onPlay={(event) => {
                if (
                  normalizedTrim.isTrimmed &&
                  (event.currentTarget.currentTime < (normalizedTrim.clipInSec || 0) ||
                    event.currentTarget.currentTime >= (normalizedTrim.clipOutSec || sourceDurationSec) - 0.02)
                ) {
                  event.currentTarget.currentTime = normalizedTrim.clipInSec || 0;
                }
              }}
              onTimeUpdate={(event) => {
                if (
                  normalizedTrim.isTrimmed &&
                  event.currentTarget.currentTime >= (normalizedTrim.clipOutSec || sourceDurationSec) - 0.02
                ) {
                  event.currentTarget.currentTime = normalizedTrim.clipOutSec || sourceDurationSec;
                  event.currentTarget.pause();
                }
              }}
              onSeeking={(event) => {
                if (!normalizedTrim.isTrimmed) return;
                const start = normalizedTrim.clipInSec || 0;
                const end = normalizedTrim.clipOutSec || sourceDurationSec;
                if (event.currentTarget.currentTime < start) event.currentTarget.currentTime = start;
                if (event.currentTarget.currentTime > end) event.currentTarget.currentTime = end;
              }}
              className="max-h-80 w-full object-contain"
            />
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
          <div className="mt-3 space-y-3" data-creator-text-editor="true">
            <label className="block text-xs font-semibold text-slate-700">
              {language === "en" ? "Scene Text" : "Sahne Metni"}
              <textarea value={textDraft} onChange={(event) => setTextDraft(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {language === "en" ? "Narration" : "Anlatım"}
              <textarea value={narrationDraft} onChange={(event) => setNarrationDraft(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              <span data-narration-voice-state={narrationAudioState} className={narrationAudioState === "stale" ? "mt-1 block text-amber-700" : "mt-1 block text-slate-500"}>{voiceLabel(narrationAudioState)}</span>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {language === "en" ? "Dialogue" : "Diyalog"}
              <textarea value={dialogueDraft} onChange={(event) => setDialogueDraft(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              <span data-dialogue-voice-state={dialogueAudioState} className={dialogueAudioState === "stale" ? "mt-1 block text-amber-700" : "mt-1 block text-slate-500"}>{voiceLabel(dialogueAudioState)}</span>
            </label>
            <button
              type="button"
              onClick={() => onSaveText({ text: textDraft, narration: narrationDraft, dialogue: dialogueDraft })}
              disabled={!textChanged || sceneOperationsDisabled}
              className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {language === "en" ? "Save Changes" : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </div>
      </div>

      {hasSelectedVideo && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4" data-creator-trim-controls="true">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-slate-950">{language === "en" ? "Trim Video" : "Videoyu Kırp"}</strong>
            <span className="text-xs text-slate-500">
              {sourceDurationSec > 0
                ? `${language === "en" ? "Source" : "Kaynak"}: ${sourceDurationSec.toFixed(1)}s`
                : language === "en" ? "Loading video duration…" : "Video süresi yükleniyor…"}
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              {language === "en" ? "Start (seconds)" : "Başlangıç (saniye)"}
              <input
                type="number"
                step="0.1"
                min="0"
                max={Math.max(0, Number(trimEndDraft || sourceDurationSec) - 0.25)}
                value={trimStartDraft}
                disabled={!sourceDurationSec}
                onChange={(event) => setTrimStartDraft(event.target.value)}
                onBlur={commitTrimDraft}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              {language === "en" ? "End (seconds)" : "Bitiş (saniye)"}
              <input
                type="number"
                step="0.1"
                min={Number(trimStartDraft || 0) + 0.25}
                max={sourceDurationSec || undefined}
                value={trimEndDraft}
                disabled={!sourceDurationSec}
                onChange={(event) => setTrimEndDraft(event.target.value)}
                onBlur={commitTrimDraft}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">
              {language === "en" ? "Visual clip" : "Görsel klip"}: {normalizedTrim.visualDurationSec.toFixed(1)}s · {language === "en" ? "Effective scene" : "Efektif sahne"}: {effectiveDurationSec.toFixed(1)}s
            </span>
            <button
              type="button"
              onClick={() => {
                setTrimStartDraft("0");
                setTrimEndDraft(sourceDurationSec ? String(Number(sourceDurationSec.toFixed(3))) : "");
                onUpdateTrim({});
              }}
              disabled={!sourceDurationSec || !normalizedTrim.isTrimmed}
              className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40"
            >
              {language === "en" ? "Reset Trim" : "Kırpmayı Sıfırla"}
            </button>
          </div>
        </div>
      )}

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
          disabled={sceneOperationsDisabled || selectedIndex <= 0}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {language === "en" ? "Move Earlier" : "Önceye Taşı"}
        </button>
        <button
          type="button"
          aria-label={language === "en" ? "Move selected scene later" : "Seçili sahneyi sonraya taşı"}
          onClick={() => onMoveScene("later")}
          disabled={sceneOperationsDisabled || selectedIndex < 0 || selectedIndex >= scenes.length - 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {language === "en" ? "Move Later" : "Sonraya Taşı"}
        </button>
        <button
          type="button"
          aria-label={language === "en" ? "Duplicate selected scene" : "Seçili sahneyi çoğalt"}
          onClick={onDuplicateScene}
          disabled={sceneOperationsDisabled}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800"
        >
          {language === "en" ? "Duplicate" : "Çoğalt"}
        </button>
        <button
          type="button"
          aria-label={language === "en" ? "Delete selected scene" : "Seçili sahneyi sil"}
          onClick={onDeleteScene}
          disabled={sceneOperationsDisabled || scenes.length <= 1}
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
