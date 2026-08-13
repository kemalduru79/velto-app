"use client";

import { useEffect, useRef, useState } from "react";
import {
  CREATOR_MIN_VIDEO_CLIP_SECONDS,
  constrainCreatorTrimProposal,
  getCreatorSceneEffectiveDuration,
  normalizeCreatorSceneTrim,
  type CreatorTrimHandle,
  type CreatorTrimValues,
} from "@/lib/creator/editorState";

type CreatorVideoTrimControlProps = {
  sourceDurationSec: number;
  clipInSec?: number;
  clipOutSec?: number;
  targetDurationSec?: number;
  speechDurationSec?: number;
  speechTailBufferSec?: number;
  language: "en" | "tr";
  disabled?: boolean;
  onPreviewBoundary: (seconds: number) => void;
  onCommitTrim: (trim: { clipInSec?: number; clipOutSec?: number; sourceDurationSec?: number }) => void;
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${(safe % 60).toFixed(1).padStart(4, "0")}`;
};

export default function CreatorVideoTrimControl({
  sourceDurationSec,
  clipInSec,
  clipOutSec,
  targetDurationSec,
  speechDurationSec,
  speechTailBufferSec,
  language,
  disabled = false,
  onPreviewBoundary,
  onCommitTrim,
}: CreatorVideoTrimControlProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ handle: CreatorTrimHandle; pointerId: number } | null>(null);
  const animationRef = useRef<number | null>(null);
  const pendingRef = useRef<{ handle: CreatorTrimHandle; seconds: number } | null>(null);
  const canonical = normalizeCreatorSceneTrim({ clipInSec, clipOutSec, sourceDurationSec });
  const canonicalValues = {
    start: canonical.clipInSec ?? 0,
    end: canonical.clipOutSec ?? sourceDurationSec,
  };
  const [draft, setDraft] = useState<CreatorTrimValues>(canonicalValues);
  const draftRef = useRef<CreatorTrimValues>(canonicalValues);

  const updateDraft = (values: CreatorTrimValues) => {
    draftRef.current = values;
    setDraft(values);
  };

  useEffect(() => {
    if (!dragRef.current) updateDraft(canonicalValues);
  }, [clipInSec, clipOutSec, sourceDurationSec]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, []);

  const commit = (values: CreatorTrimValues) => {
    const normalized = normalizeCreatorSceneTrim({
      clipInSec: values.start,
      clipOutSec: values.end,
      sourceDurationSec,
    });
    if (!normalized.isTrimmed) {
      updateDraft({ start: 0, end: sourceDurationSec });
      onCommitTrim({});
      return;
    }
    const next = { start: normalized.clipInSec || 0, end: normalized.clipOutSec || sourceDurationSec };
    updateDraft(next);
    onCommitTrim({ clipInSec: next.start, clipOutSec: next.end, sourceDurationSec });
  };

  const secondsFromPointer = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect?.width) return 0;
    return Math.max(0, Math.min(sourceDurationSec, ((clientX - rect.left) / rect.width) * sourceDurationSec));
  };

  const flushPending = () => {
    animationRef.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    const next = constrainCreatorTrimProposal(pending.handle, pending.seconds, draftRef.current, sourceDurationSec);
    updateDraft(next);
    onPreviewBoundary(pending.handle === "start" ? next.start : next.end);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    pendingRef.current = { handle: active.handle, seconds: secondsFromPointer(event.clientX) };
    if (animationRef.current === null) animationRef.current = requestAnimationFrame(flushPending);
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    const finalDraft = !cancelled && pending
      ? constrainCreatorTrimProposal(pending.handle, pending.seconds, draftRef.current, sourceDurationSec)
      : draftRef.current;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (cancelled) {
      updateDraft(canonicalValues);
      return;
    }
    onPreviewBoundary(finalDraft[active.handle]);
    commit(finalDraft);
  };

  const adjustByKeyboard = (handle: CreatorTrimHandle, delta: number) => {
    const next = constrainCreatorTrimProposal(handle, draft[handle] + delta, draft, sourceDurationSec);
    updateDraft(next);
    onPreviewBoundary(next[handle]);
    commit(next);
  };

  const startPercent = sourceDurationSec > 0 ? (draft.start / sourceDurationSec) * 100 : 0;
  const endPercent = sourceDurationSec > 0 ? (draft.end / sourceDurationSec) * 100 : 100;
  const selectedDuration = Math.max(0, draft.end - draft.start);
  const effectiveDuration = getCreatorSceneEffectiveDuration({
    visualDurationSec: selectedDuration,
    targetDurationSec,
    speechDurationSec,
    speechTailBufferSec,
  });
  const handleKeyDown = (handle: CreatorTrimHandle, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    adjustByKeyboard(handle, direction * (event.shiftKey ? 1 : 0.1));
  };

  return (
    <div data-creator-drag-trim="true">
      <div className="flex justify-between text-[11px] font-medium text-slate-500"><span>{formatTime(0)}</span><span>{formatTime(sourceDurationSec)}</span></div>
      <div ref={railRef} className="relative mx-6 mt-2 h-14 touch-none select-none" aria-label={language === "en" ? "Video trim timeline" : "Video kırpma zaman çizelgesi"}>
        <div className="absolute inset-x-0 top-4 h-6 overflow-hidden rounded-lg bg-slate-200 shadow-inner">
          <div className="absolute inset-y-0 bg-blue-600" style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }} />
          <div className="absolute inset-y-0 left-0 bg-slate-900/20" style={{ width: `${startPercent}%` }} />
          <div className="absolute inset-y-0 right-0 bg-slate-900/20" style={{ width: `${100 - endPercent}%` }} />
        </div>
        {(["start", "end"] as const).map((handle) => {
          const value = draft[handle];
          return <button
            key={handle}
            type="button"
            role="slider"
            data-handle={handle}
            aria-label={language === "en" ? `${handle === "start" ? "Start" : "End"} trim handle` : `${handle === "start" ? "Başlangıç" : "Bitiş"} kırpma tutamacı`}
            aria-valuemin={handle === "start" ? 0 : draft.start + CREATOR_MIN_VIDEO_CLIP_SECONDS}
            aria-valuemax={handle === "start" ? draft.end - CREATOR_MIN_VIDEO_CLIP_SECONDS : sourceDurationSec}
            aria-valuenow={value}
            aria-valuetext={formatTime(value)}
            disabled={disabled || sourceDurationSec <= 0}
            onPointerDown={(event) => {
              dragRef.current = { handle, pointerId: event.pointerId };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => finishDrag(event, false)}
            onPointerCancel={(event) => finishDrag(event, true)}
            onKeyDown={(event) => handleKeyDown(handle, event)}
            className="absolute top-1 z-10 flex h-12 w-11 -translate-x-1/2 touch-none items-center justify-center rounded-lg border-2 border-white bg-slate-950 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40"
            style={{ left: `${handle === "start" ? startPercent : endPercent}%` }}
          ><span className="h-5 w-0.5 rounded bg-white/80" /></button>;
        })}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-center text-xs">
        <div><span className="block text-slate-500">{language === "en" ? "Start" : "Başlangıç"}</span><strong>{formatTime(draft.start)}</strong></div>
        <div><span className="block text-slate-500">{language === "en" ? "Selected" : "Seçili Süre"}</span><strong className="text-blue-700">{selectedDuration.toFixed(1)}s</strong></div>
        <div><span className="block text-slate-500">{language === "en" ? "End" : "Bitiş"}</span><strong>{formatTime(draft.end)}</strong></div>
      </div>
      <fieldset className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">{language === "en" ? "Precision" : "Hassas Ayar"}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["start", "end"] as const).map((handle) => <label key={handle} className="text-xs font-semibold text-slate-700">
            {handle === "start" ? (language === "en" ? "Start (seconds)" : "Başlangıç (saniye)") : (language === "en" ? "End (seconds)" : "Bitiş (saniye)")}
            <input type="number" step="0.1" min={handle === "start" ? 0 : draft.start + CREATOR_MIN_VIDEO_CLIP_SECONDS} max={handle === "start" ? draft.end - CREATOR_MIN_VIDEO_CLIP_SECONDS : sourceDurationSec} value={draft[handle]} disabled={disabled || sourceDurationSec <= 0} onChange={(event) => updateDraft(constrainCreatorTrimProposal(handle, Number(event.target.value), draftRef.current, sourceDurationSec))} onBlur={() => commit(draftRef.current)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
          </label>)}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-600">{language === "en" ? "Visual clip" : "Görsel klip"}: {selectedDuration.toFixed(1)}s · {language === "en" ? "Effective scene" : "Efektif sahne"}: {effectiveDuration.toFixed(1)}s</span>
        <button type="button" onClick={() => commit({ start: 0, end: sourceDurationSec })} disabled={disabled || sourceDurationSec <= 0 || (!canonical.isTrimmed && draft.start === 0 && draft.end === sourceDurationSec)} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40">{language === "en" ? "Reset Trim" : "Kırpmayı Sıfırla"}</button>
      </div>
    </div>
  );
}
