"use client";

import { useEffect, useRef, useState } from "react";
import {
  CREATOR_MUSIC_LEVEL_VOLUME,
  getCreatorMusicLevel,
  type CreatorBackgroundMusicConfig,
} from "@/lib/creator/backgroundMusic";
import { CREATOR_MUSIC_LIBRARY } from "@/lib/creator/musicLibrary";

export default function CreatorBackgroundMusic({
  value,
  onChange,
  language,
}: {
  value: CreatorBackgroundMusicConfig;
  onChange: (value: CreatorBackgroundMusicConfig) => void;
  language: "en" | "tr";
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(value.mode === "selected");
  const english = language === "en";

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId("");
  };

  useEffect(() => stopPreview, []);

  const setMode = (mode: CreatorBackgroundMusicConfig["mode"]) => {
    stopPreview();
    if (mode === "selected") {
      setPickerOpen(true);
      return;
    }
    setPickerOpen(false);
    onChange({ ...value, mode, selectedTrackId: undefined });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700">
        {english ? "Background music" : "Arka plan müziği"}
      </span>
      <h3 className="mt-2 text-lg font-semibold text-slate-950">
        {english ? "Set one music bed for the whole video" : "Tüm video için tek bir müzik katmanı seç"}
      </h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {([
          ["none", english ? "No Music" : "Müzik Yok"],
          ["auto", english ? "Auto Match" : "Otomatik Eşleştir"],
          ["selected", english ? "Choose Music" : "Müzik Seç"],
        ] as const).map(([mode, label]) => (
          <button key={mode} type="button" onClick={() => setMode(mode)}
            aria-pressed={mode === "selected" ? pickerOpen : !pickerOpen && value.mode === mode}
            className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${(mode === "selected" ? pickerOpen : !pickerOpen && value.mode === mode) ? "border-blue-400 bg-blue-50 text-blue-950 ring-2 ring-blue-100" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {value.mode !== "none" && (
        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            {english ? "Music level" : "Müzik seviyesi"}
            <select value={getCreatorMusicLevel(value.volume)} onChange={(event) => onChange({ ...value, volume: CREATOR_MUSIC_LEVEL_VOLUME[event.target.value as keyof typeof CREATOR_MUSIC_LEVEL_VOLUME] })}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="low">{english ? "Low" : "Düşük"}</option>
              <option value="balanced">{english ? "Balanced" : "Dengeli"}</option>
              <option value="strong">{english ? "Strong" : "Güçlü"}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:mt-5">
            <input type="checkbox" checked={value.autoDucking} onChange={(event) => onChange({ ...value, autoDucking: event.target.checked })} />
            {english ? "Auto Ducking" : "Otomatik Kısma"}
          </label>
          <p className="text-xs leading-5 text-slate-500 sm:mt-5">{english ? "Fade: Auto" : "Geçiş: Otomatik"}</p>
        </div>
      )}

      {value.mode === "auto" && CREATOR_MUSIC_LIBRARY.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">{english ? "No approved local track is available yet. Export will continue without music." : "Henüz onaylı yerel parça yok. Dışa aktarma müziksiz devam edecek."}</p>
      )}
      {pickerOpen && (
        <div className="mt-3 space-y-2">
          {CREATOR_MUSIC_LIBRARY.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{english ? "The approved music library is currently empty." : "Onaylı müzik kütüphanesi şu anda boş."}</p>
          ) : CREATOR_MUSIC_LIBRARY.map((track) => (
            <div key={track.id} className={`flex items-center justify-between rounded-2xl border p-3 ${value.selectedTrackId === track.id ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
              <button type="button" className="min-w-0 text-left" onClick={() => {
                stopPreview();
                onChange({ ...value, mode: "selected", selectedTrackId: track.id });
              }}>
                <strong className="block text-sm text-slate-950">{track.title}</strong>
                <span className="text-xs text-slate-500">{[...(track.mood || []), ...(track.genre || []), track.energy].filter(Boolean).join(" · ")}</span>
              </button>
              {track.previewUrl && <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => {
                if (playingId === track.id) return stopPreview();
                stopPreview();
                const audio = new Audio(track.previewUrl);
                audio.onended = stopPreview;
                audioRef.current = audio;
                setPlayingId(track.id);
                void audio.play().catch(stopPreview);
              }}>{playingId === track.id ? (english ? "Stop" : "Durdur") : (english ? "Preview" : "Dinle")}</button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
