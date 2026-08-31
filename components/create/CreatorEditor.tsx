"use client";

import { useEffect, useRef, useState } from "react";
import CreatorEditorTimeline, {
  type CreatorEditorTimelineScene,
} from "@/components/create/CreatorEditorTimeline";
import CreatorVideoTrimControl from "@/components/create/CreatorVideoTrimControl";
import CreatorProjectAssets from "@/components/create/CreatorProjectAssets";
import CreatorStockPicker from "@/components/create/CreatorStockPicker";
import type { StockMediaType } from "@/lib/providers/stock/types";
import {
  type CreatorAudioCurrentness,
  normalizeCreatorSceneTrim,
} from "@/lib/creator/editorState";
import type { CreatorVideoCurrentness } from "@/lib/creator/videoGeneration";
import type { CreatorContinuityWarning } from "@/lib/creator/continuityWarnings";

type CreatorEditorProps = {
  scenes: readonly CreatorEditorTimelineScene[];
  selectedCreatorSceneId: string | null;
  onSelectScene: (creatorSceneId: string) => void;
  onMoveScene: (direction: "earlier" | "later") => void;
  onAddScene: () => void;
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
  getVideoState: (creatorSceneId: string) => CreatorVideoCurrentness;
  getContinuityWarning: (creatorSceneId: string) => CreatorContinuityWarning | null;
  onRefreshVideo: (creatorSceneId: string) => void;
  onRestoreMedia: (creatorSceneId: string, assetId: string) => void;
  onUseProjectImage: (targetCreatorSceneId: string, url: string, sourceCreatorSceneId: string) => void;
  onUseStockMedia: (creatorSceneId: string, asset: { publicUrl: string; mediaType: StockMediaType; durationSeconds: number | null; attributionText: string }) => void;
  projectId: string;
  getAccessToken: () => Promise<string>;
  onProjectHistoryRemoved: (url: string) => void;
  sceneOperationsDisabled?: boolean;
  language: "en" | "tr";
};

export default function CreatorEditor({
  scenes,
  selectedCreatorSceneId,
  onSelectScene,
  onMoveScene,
  onAddScene,
  onDuplicateScene,
  onDeleteScene,
  onUndo,
  canUndo,
  onUpdateTrim,
  onSaveText,
  getNarrationAudioState,
  getDialogueAudioState,
  getVideoState,
  getContinuityWarning,
  onRefreshVideo,
  onRestoreMedia,
  onUseProjectImage,
  onUseStockMedia,
  projectId,
  getAccessToken,
  onProjectHistoryRemoved,
  sceneOperationsDisabled = false,
  language,
}: CreatorEditorProps) {
  const selectedScene =
    scenes.find((scene) => scene.creatorSceneId === selectedCreatorSceneId) ||
    scenes[0];
  const selectedIndex = selectedScene ? scenes.indexOf(selectedScene) : -1;
  const editorRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sourceDurationSec, setSourceDurationSec] = useState(0);
  const [textDraft, setTextDraft] = useState("");
  const [narrationDraft, setNarrationDraft] = useState("");
  const [dialogueDraft, setDialogueDraft] = useState("");
  const [selectedMediaFingerprint, setSelectedMediaFingerprint] = useState("");
  const canonicalTextRef = useRef("");
  const selectedMediaUrl = selectedScene?.renderMode === "image"
    ? selectedScene.image
    : selectedScene?.videoUrl;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      editorRef.current?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setSourceDurationSec(0);
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

  useEffect(() => {
    let active = true;
    const fingerprint = async () => {
      if (!selectedMediaUrl || !globalThis.crypto?.subtle) {
        if (active) setSelectedMediaFingerprint("");
        return;
      }
      let normalized = selectedMediaUrl;
      try {
        const url = new URL(selectedMediaUrl);
        url.search = "";
        url.hash = "";
        normalized = url.toString();
      } catch {
        normalized = selectedMediaUrl.split(/[?#]/, 1)[0];
      }
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(normalized),
      );
      const value = Array.from(
        new Uint8Array(digest),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("").slice(0, 12);
      if (active) setSelectedMediaFingerprint(value);
    };
    void fingerprint();
    return () => { active = false; };
  }, [selectedMediaUrl]);

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
  const videoState = getVideoState(selectedScene.creatorSceneId || "");
  const continuityWarning = getContinuityWarning(selectedScene.creatorSceneId || "");
  const voiceLabel = (state: CreatorAudioCurrentness) => {
    if (state === "current") return language === "en" ? "Voice ready" : "Ses hazır";
    if (state === "stale") return language === "en" ? "Voice needs refresh" : "Sesin yenilenmesi gerekiyor";
    if (state === "missing") return language === "en" ? "No voice generated" : "Ses üretilmedi";
    return language === "en" ? "No voice needed" : "Ses gerekmiyor";
  };
  const videoLabel = {
    current: language === "en" ? "Video ready" : "Video hazır",
    stale: language === "en" ? "Video needs refresh" : "Videonun yenilenmesi gerekiyor",
    processing: language === "en" ? "Refreshing video…" : "Video yenileniyor…",
    delayed: language === "en" ? "Generation delayed" : "Üretim gecikti",
    error: language === "en" ? "Generation failed" : "Üretim başarısız",
    missing: language === "en" ? "No video generated" : "Video üretilmedi",
  }[videoState];
  const sceneTitle =
    selectedScene.text ||
    selectedScene.narration ||
    (language === "en" ? "Untitled scene" : "Başlıksız sahne");
  const sceneStatusTone =
    continuityWarning || videoState === "stale" || videoState === "error"
      ? "attention"
      : videoState === "processing" || videoState === "delayed"
        ? "generating"
        : videoState === "current"
          ? "ready"
          : "pending";
  const handleVideoMetadata = () => {
    const duration = videoRef.current?.duration || 0;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const trim = normalizeCreatorSceneTrim({
      clipInSec: selectedScene.clipInSec,
      clipOutSec: selectedScene.clipOutSec,
      sourceDurationSec: duration,
    });
    setSourceDurationSec(duration);
    if (videoRef.current && trim.isTrimmed) {
      videoRef.current.currentTime = trim.clipInSec || 0;
    }
  };

  return (
    <section ref={editorRef} tabIndex={-1} aria-labelledby="creator-editor-title" className="creatorlab-p2c-editor-surface creatorlab-p2c-editor min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 focus:outline-none [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-blue-500 [&_button:focus-visible]:ring-offset-2 md:p-5" data-creator-editor="foundation">
      <div className="creatorlab-p2c-editor-heading">
        <div className="min-w-0">
          <span>{language === "en" ? "Edit & Assemble" : "Düzenle ve Birleştir"}</span>
          <h2 id="creator-editor-title">
            {language === "en" ? "Scene" : "Sahne"} {String(selectedIndex + 1).padStart(2, "0")} · {sceneTitle}
          </h2>
        </div>
        <div className="creatorlab-p2c-editor-heading-status" data-editor-status={sceneStatusTone}>
          <strong>{videoLabel}</strong>
          <small>{voiceLabel(narrationAudioState)}</small>
        </div>
      </div>

      <div className="creatorlab-p2c-editor-layout">
        <div className="creatorlab-p2c-editor-preview-column">
          <div className="creatorlab-p2c-editor-section-heading">
            <span>{language === "en" ? "Media Preview" : "Medya Önizleme"}</span>
            <small>{hasSelectedVideo ? "Video" : selectedScene.image ? (language === "en" ? "Image" : "Görsel") : (language === "en" ? "No media" : "Medya yok")}</small>
          </div>
          <div className="creatorlab-p2c-editor-preview-canvas">
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
              className="max-h-96 w-full object-contain"
            />
          ) : selectedScene.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedScene.image} alt="" className="max-h-96 w-full object-contain" />
          ) : (
            <div className="px-6 text-center text-sm text-slate-300">
              {language === "en" ? "Media preview will appear here." : "Medya önizlemesi burada görünecek."}
            </div>
          )}
          {selectedMediaFingerprint && (
            <span hidden data-selected-media-fingerprint="true">{selectedMediaFingerprint}</span>
          )}
          </div>
        </div>

        <aside className="creatorlab-p2c-editor-inspector" aria-label={language === "en" ? "Selected scene inspector" : "Seçili sahne denetçisi"}>
          <div className="creatorlab-p2c-editor-section-heading">
            <span>{language === "en" ? "Scene Inspector" : "Sahne Denetçisi"}</span>
            <small>{selectedIndex + 1}/{scenes.length}</small>
          </div>
          <div className="creatorlab-p2c-editor-status-stack">
            <div role="status" aria-live="polite" aria-atomic="true" className="creatorlab-p2c-editor-status" data-video-currentness={videoState} data-tone={sceneStatusTone}>
              <span className={videoState === "stale" ? "text-xs font-semibold text-amber-700" : "text-xs font-semibold text-slate-600"}>{videoLabel}</span>
              {(videoState === "stale" || videoState === "missing" || videoState === "error") && selectedScene.renderMode !== "image" && (
                <button type="button" onClick={() => onRefreshVideo(selectedScene.creatorSceneId!)} disabled={sceneOperationsDisabled}>
                  {language === "en" ? "Refresh Video" : "Videoyu Yenile"}
                </button>
              )}
            </div>
            {continuityWarning && (
              <div
                role="status"
                aria-live="polite"
                data-creator-continuity-warning={continuityWarning.severity}
                className="creatorlab-p2c-editor-attention"
              >
                <strong className="text-xs">
                  {language === "en" ? "Attention" : "Dikkat"}
                </strong>
                <ul className="mt-1 space-y-1 text-xs leading-5">
                  {continuityWarning.messages.map((message) => <li key={message}>{message}</li>)}
                </ul>
                {continuityWarning.action === "review_trim" && hasSelectedVideo ? (
                  <button type="button" onClick={() => document.getElementById("creator-selected-scene-trim")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" })} className="mt-2 min-h-11 rounded-lg border border-current px-3 py-2 text-xs font-semibold">
                    {language === "en" ? "Review Trim" : "Kırpmayı Kontrol Et"}
                  </button>
                ) : continuityWarning.action === "refresh_video" && selectedScene.renderMode !== "image" ? (
                  <button type="button" onClick={() => onRefreshVideo(selectedScene.creatorSceneId!)} disabled={sceneOperationsDisabled} className="mt-2 rounded-lg border border-current px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                    {language === "en" ? "Refresh Video" : "Videoyu Yenile"}
                  </button>
                ) : (
                  <p className="mt-2 text-xs font-semibold">
                    {continuityWarning.action === "generate_voice"
                      ? language === "en" ? "Generate or refresh Voice in Scene Production." : "Scene Production içinde sesi üret veya yenile."
                      : language === "en" ? "Review this scene's media and timing." : "Bu sahnenin medya ve zamanlamasını kontrol et."}
                  </p>
                )}
              </div>
            )}
          </div>

          <section className="creatorlab-p2c-editor-content" data-creator-text-editor="true" aria-labelledby="creator-editor-content-title">
            <div className="creatorlab-p2c-editor-content-heading">
              <div>
                <span>{language === "en" ? "Content" : "İçerik"}</span>
                <h3 id="creator-editor-content-title">{language === "en" ? "Scene copy and voice" : "Sahne metni ve ses"}</h3>
              </div>
              {textChanged && <small>{language === "en" ? "Unsaved changes" : "Kaydedilmemiş değişiklikler"}</small>}
            </div>
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
              className="creatorlab-p2c-editor-save"
            >
              {textChanged
                ? language === "en" ? "Save Changes" : "Değişiklikleri Kaydet"
                : language === "en" ? "Changes Saved" : "Değişiklikler Kaydedildi"}
            </button>
          </section>
        </aside>
      </div>

      <CreatorProjectAssets
        scenes={scenes}
        targetCreatorSceneId={selectedScene.creatorSceneId!}
        disabled={sceneOperationsDisabled}
        language={language}
        onUseImage={(url, sourceCreatorSceneId) =>
          onUseProjectImage(selectedScene.creatorSceneId!, url, sourceCreatorSceneId)
        }
        projectId={projectId}
        getAccessToken={getAccessToken}
        onHistoryRemoved={onProjectHistoryRemoved}
      />

      {selectedScene.visualSourceMethod === "stock" && (
        <CreatorStockPicker projectId={projectId} disabled={sceneOperationsDisabled} language={language} getAccessToken={getAccessToken} onUse={(asset) => onUseStockMedia(selectedScene.creatorSceneId!, asset)} />
      )}

      {(selectedScene.assetHistory || []).length > 0 && (
        <details className="creatorlab-p2c-editor-disclosure" data-creator-media-history="true">
          <summary>
            <span>{language === "en" ? "Advanced · Media History" : "Gelişmiş · Medya Geçmişi"}</span>
            <small>{selectedScene.assetHistory?.length || 0} {language === "en" ? "previous versions" : "önceki sürüm"}</small>
          </summary>
          <div className="creatorlab-p2c-editor-disclosure-body">
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{language === "en" ? "Current Version" : "Geçerli Sürüm"}</span>
            <strong className="mt-1 block text-xs text-emerald-950">
              {hasSelectedVideo ? (language === "en" ? "Selected video · used in Final Video" : "Seçili video · Final Videoda kullanılır") : (language === "en" ? "Selected image · used in Final Video" : "Seçili görsel · Final Videoda kullanılır")}
            </strong>
          </div>
          <strong className="text-sm text-slate-950">{language === "en" ? "Previous Versions" : "Önceki Sürümler"}</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {(selectedScene.assetHistory || []).slice().reverse().map((asset) => (
              <button key={asset.id} type="button" disabled={sceneOperationsDisabled} onClick={() => onRestoreMedia(selectedScene.creatorSceneId!, asset.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-left text-xs text-slate-700 disabled:opacity-40">
                <span className="block">{asset.kind === "video" ? "Video" : language === "en" ? "Image" : "Görsel"} · {new Date(asset.createdAt).toLocaleDateString(language)}</span>
                <strong className="mt-1 block text-blue-700">{language === "en" ? "Use This Version" : "Bu Sürümü Kullan"}</strong>
              </button>
            ))}
          </div>
          </div>
        </details>
      )}

      {hasSelectedVideo && (
        <details id="creator-selected-scene-trim" className="creatorlab-p2c-editor-disclosure creatorlab-p2c-editor-media-timing" data-creator-trim-controls="true" open>
          <summary>
            <span>{language === "en" ? "Media & Timing" : "Medya ve Zamanlama"}</span>
            <small>
              {sourceDurationSec > 0
                ? `${language === "en" ? "Source" : "Kaynak"}: ${sourceDurationSec.toFixed(1)}s`
                : language === "en" ? "Loading duration…" : "Süre yükleniyor…"}
            </small>
          </summary>
          <div className="creatorlab-p2c-editor-disclosure-body">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-slate-950">{language === "en" ? "Trim Video" : "Videoyu Kırp"}</strong>
            <span className="text-xs text-slate-500">
              {sourceDurationSec > 0
                ? `${language === "en" ? "Source" : "Kaynak"}: ${sourceDurationSec.toFixed(1)}s`
                : language === "en" ? "Loading video duration…" : "Video süresi yükleniyor…"}
            </span>
          </div>
          <div className="mt-3">
            <CreatorVideoTrimControl
              sourceDurationSec={sourceDurationSec}
              clipInSec={selectedScene.clipInSec}
              clipOutSec={selectedScene.clipOutSec}
              targetDurationSec={selectedScene.timing?.targetSceneDuration}
              speechDurationSec={(narrationAudioState === "current" ? selectedScene.timing?.narrationDuration || 0 : 0) + (dialogueAudioState === "current" ? selectedScene.timing?.dialogueDuration || 0 : 0)}
              speechTailBufferSec={selectedScene.timing?.speechTailBuffer ?? 0.75}
              language={language}
              disabled={sceneOperationsDisabled}
              onPreviewBoundary={(seconds) => {
                if (!videoRef.current) return;
                videoRef.current.pause();
                videoRef.current.currentTime = seconds;
              }}
              onCommitTrim={onUpdateTrim}
            />
          </div>
          </div>
        </details>
      )}

      <div className="creatorlab-p2c-editor-timeline-wrap">
        <CreatorEditorTimeline
          scenes={scenes}
          selectedCreatorSceneId={selectedCreatorSceneId}
          onSelectScene={onSelectScene}
          language={language}
        />
      </div>

      <details className="creatorlab-p2c-editor-disclosure creatorlab-p2c-editor-scene-actions" aria-label={language === "en" ? "Selected scene actions" : "Seçili sahne işlemleri"}>
        <summary>
          <span>{language === "en" ? "Advanced · Scene Actions" : "Gelişmiş · Sahne İşlemleri"}</span>
          <small>{language === "en" ? "Arrange, duplicate or remove" : "Sırala, çoğalt veya kaldır"}</small>
        </summary>
        <div className="creatorlab-p2c-editor-action-grid">
        <button
          type="button"
          aria-label={language === "en" ? "Add new scene" : "Yeni sahne ekle"}
          onClick={onAddScene}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
        >
          {language === "en" ? "+ Add Scene" : "+ Sahne Ekle"}
        </button>
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
      </details>
    </section>
  );
}
