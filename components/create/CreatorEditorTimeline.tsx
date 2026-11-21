"use client";

import { useEffect, useRef } from "react";
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
  visualSourceMethod?: "recommended" | "stock" | "ai_image" | "ai_video" | "upload";
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
  const timelineRef = useRef<HTMLUListElement | null>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const selectedItem = selectedItemRef.current;
    const timeline = timelineRef.current;
    if (!selectedItem || !timeline) return;
    const frame = window.requestAnimationFrame(() => {
      selectedItem.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCreatorSceneId]);

  return (
    <section className="creatorlab-p2c-editor-timeline" aria-labelledby="creator-editor-timeline-title">
      <div className="creatorlab-p2c-editor-timeline-heading">
        <div>
          <span>{language === "en" ? "Timeline" : "Zaman Çizelgesi"}</span>
          <h3 id="creator-editor-timeline-title">{language === "en" ? "Video sequence" : "Video sıralaması"}</h3>
        </div>
        <small>{scenes.length} {language === "en" ? "scenes" : "sahne"}</small>
      </div>
      <ul
        ref={timelineRef}
        className="creatorlab-p2c-editor-timeline-track"
        aria-label={language === "en" ? "Creator Editor scene timeline" : "Creator Editor sahne zaman çizelgesi"}
      >
      {scenes.map((scene, index) => {
        if (!isCreatorSceneId(scene.creatorSceneId)) return null;

        const selected = scene.creatorSceneId === selectedCreatorSceneId;
        const summary = scene.text || scene.narration || (language === "en" ? "Untitled scene" : "Başlıksız sahne");
        const durationSec =
          typeof scene.clipInSec === "number" && typeof scene.clipOutSec === "number"
            ? Math.max(0, scene.clipOutSec - scene.clipInSec)
            : Number(scene.timing?.targetSceneDuration || 0);
        const mediaLabel = scene.videoUrl
          ? "Video"
          : scene.image
            ? language === "en" ? "Image" : "Görsel"
            : language === "en" ? "No media" : "Medya yok";

        return (
          <li key={scene.creatorSceneId}>
          <button
            ref={selected ? selectedItemRef : undefined}
            type="button"
            aria-pressed={selected}
            aria-current={selected ? "true" : undefined}
            aria-label={`${language === "en" ? "Select scene" : "Sahneyi seç"} ${index + 1}: ${summary}`}
            onClick={() => onSelectScene(scene.creatorSceneId!)}
            data-selected={selected ? "true" : "false"}
            className="creatorlab-p2c-editor-timeline-item"
          >
            <span className="creatorlab-p2c-editor-timeline-thumbnail">
              {scene.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scene.image} alt="" />
              ) : (
                <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
              )}
              <em>{mediaLabel}</em>
            </span>
            <span className="creatorlab-p2c-editor-timeline-copy">
              <small>{language === "en" ? "Scene" : "Sahne"} {String(index + 1).padStart(2, "0")}</small>
              <strong>{summary}</strong>
              <span>{durationSec > 0 ? `${durationSec.toFixed(1)}s` : "—"} · {mediaLabel}</span>
            </span>
          </button>
          </li>
        );
      })}
      </ul>
    </section>
  );
}
