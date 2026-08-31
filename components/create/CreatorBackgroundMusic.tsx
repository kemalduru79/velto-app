"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { supabase } from "@/lib/supabase/client";
import {
  CREATOR_MUSIC_LEVEL_VOLUME,
  getCreatorMusicLevel,
  type CreatorBackgroundMusicConfig,
} from "@/lib/creator/backgroundMusic";
import type { CreatorPremiumMusicTrack } from "@/lib/providers/music/types";

type AutoMatchInput = { contentType?: string; outcome?: string; format?: string; topic?: string; visualStyle?: string };
type MusicView = "none" | "auto" | "browse";

function getInitialMusicView(mode: CreatorBackgroundMusicConfig["mode"]): MusicView {
  if (mode === "auto") return "auto";
  if (mode === "selected") return "browse";
  return "none";
}

export default function CreatorBackgroundMusic({ value, onChange, onConfirmTrack, language, autoMatchInput = {} }: {
  value: CreatorBackgroundMusicConfig;
  onChange: (value: CreatorBackgroundMusicConfig) => void;
  onConfirmTrack?: (trackId: string) => Promise<boolean>;
  language: "en" | "tr";
  autoMatchInput?: AutoMatchInput;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playingId, setPlayingId] = useState("");
  const [musicView, setMusicView] = useState<MusicView>(() => getInitialMusicView(value.mode));
  const [tracks, setTracks] = useState<CreatorPremiumMusicTrack[]>([]);
  const [term, setTerm] = useState("");
  const [vocalType, setVocalType] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [confirmingTrackId, setConfirmingTrackId] = useState("");
  const english = language === "en";

  const stopPreview = () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    audioRef.current = null;
    setPlayingId("");
  };
  useEffect(() => stopPreview, []);

  const authenticatedGet = async (params: URLSearchParams) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(english ? "Sign in to browse premium music." : "Premium müziğe göz atmak için giriş yap.");
    const response = await fetch(`/api/creator-music?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.error || (english ? "Music library could not be loaded. Try again." : "Müzik kütüphanesi yüklenemedi. Tekrar dene."));
    return body;
  };

  const loadTracks = async ({ auto = false, more = false } = {}) => {
    setLoading(true);
    setCatalogError("");
    try {
      const nextOffset = more ? offset : 0;
      const params = new URLSearchParams({ action: auto ? "auto" : "search", limit: auto ? "3" : "16", offset: String(nextOffset) });
      if (auto) Object.entries(autoMatchInput).forEach(([key, item]) => item && params.set(key, item));
      else {
        params.set("term", term.trim() || "inspiring");
        if (vocalType) params.set("vocalType", vocalType);
      }
      const body = await authenticatedGet(params);
      const nextTracks = Array.isArray(body.tracks) ? body.tracks as CreatorPremiumMusicTrack[] : [];
      setTracks((current) => more ? [...current, ...nextTracks.filter((track) => !current.some((item) => item.id === track.id))] : nextTracks);
      setOffset(nextOffset + Number(body.limit || nextTracks.length));
      setHasMore(!auto && body.hasMore === true);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : (english ? "Music library could not be loaded. Try again." : "Müzik kütüphanesi yüklenemedi. Tekrar dene."));
    } finally {
      setLoading(false);
    }
  };

  const setView = (nextView: MusicView) => {
    stopPreview();
    setMusicView(nextView);
    if (nextView === "none") {
      onChange({ ...value, mode: "none", selectedTrackId: undefined });
      return;
    }
    if (nextView === "auto") {
      if (!value.selectedTrackId) onChange({ ...value, mode: "auto", selectedTrackId: undefined });
      void loadTracks({ auto: true });
      return;
    }
    void loadTracks();
  };

  const previewTrack = async (track: CreatorPremiumMusicTrack) => {
    if (playingId === track.id) return stopPreview();
    stopPreview();
    const audio = new Audio();
    try {
      const body = await authenticatedGet(new URLSearchParams({ action: "preview", trackId: track.id }));
      audio.onended = stopPreview;
      audio.onerror = () => { stopPreview(); setCatalogError(english ? "Preview is unavailable." : "Önizleme kullanılamıyor."); };
      audioRef.current = audio;
      setPlayingId(track.id);
      const nativeHlsAvailable = Boolean(
        audio.canPlayType("application/vnd.apple.mpegurl") ||
        audio.canPlayType("audio/mpegurl"),
      );
      const reliableNativeHls =
        nativeHlsAvailable &&
        /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

      if (reliableNativeHls) {
        audio.src = body.streamUrl;
        await audio.play();
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(body.streamUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void audio.play().catch(() => {
            stopPreview();
            setCatalogError(english ? "Preview could not be played. Try again." : "Önizleme oynatılamadı. Tekrar dene.");
          });
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          stopPreview();
          setCatalogError(english ? "Preview could not be played. Try again." : "Önizleme oynatılamadı. Tekrar dene.");
        });
        hls.attachMedia(audio);
        return;
      }

      if (nativeHlsAvailable) {
        audio.src = body.streamUrl;
        await audio.play();
        return;
      }

      stopPreview();
      setCatalogError(english ? "Preview could not be played. Try again." : "Önizleme oynatılamadı. Tekrar dene.");
    } catch (error) {
      stopPreview();
      setCatalogError(error instanceof Error ? error.message : (english ? "Preview is unavailable." : "Önizleme kullanılamıyor."));
    }
  };

  const selectTrack = (track: CreatorPremiumMusicTrack) => {
    stopPreview();
    onChange({ ...value, mode: "selected", selectedTrackId: track.id });
  };
  const selectedTrack = tracks.find((track) => track.id === value.selectedTrackId);
  const confirmationRequired =
    value.mode === "selected" &&
    value.confirmedTrackId !== value.selectedTrackId;

  return <section id="creatorlab-background-music" className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-blue-500 [&_button:focus-visible]:ring-offset-2 sm:p-5">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700">{english ? "Background music" : "Arka plan müziği"}</span>
    <h3 className="mt-2 text-lg font-semibold text-slate-950">{english ? "Velto Premium Music" : "Velto Premium Müzik"}</h3>
    <p className="mt-1 text-xs text-slate-500">{english ? "Browsing and previewing are free. Music is optional." : "Göz atma ve önizleme ücretsizdir. Müzik isteğe bağlıdır."}</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {([["none", english ? "No Music" : "Müzik Yok"], ["auto", english ? "Auto Match" : "Otomatik Eşleştir"], ["browse", english ? "Browse Music" : "Müziğe Göz At"]] as const).map(([view, label]) => <button key={view} type="button" onClick={() => setView(view)} aria-pressed={musicView === view} className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${musicView === view ? "border-blue-400 bg-blue-50 text-blue-950 ring-2 ring-blue-100" : "border-slate-200 text-slate-700"}`}>{label}</button>)}
    </div>
    {musicView !== "none" && <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
      <label className="text-xs font-semibold text-slate-600">{english ? "Music level" : "Müzik seviyesi"}<select value={getCreatorMusicLevel(value.volume)} onChange={(event) => onChange({ ...value, volume: CREATOR_MUSIC_LEVEL_VOLUME[event.target.value as keyof typeof CREATOR_MUSIC_LEVEL_VOLUME] })} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="low">{english ? "Low" : "Düşük"}</option><option value="balanced">{english ? "Balanced" : "Dengeli"}</option><option value="strong">{english ? "Strong" : "Güçlü"}</option></select></label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:mt-5"><input type="checkbox" checked={value.autoDucking} onChange={(event) => onChange({ ...value, autoDucking: event.target.checked })} />{english ? "Auto Ducking" : "Otomatik Kısma"}</label>
      <p className="text-xs text-slate-500 sm:mt-5">{english ? "Premium track · free to browse" : "Premium parça · göz atmak ücretsiz"}</p>
    </div>}
    {musicView !== "none" && <div className="mt-4 space-y-3">
      {musicView === "browse" && <div className="flex flex-wrap gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadTracks(); }} placeholder={english ? "Search music" : "Müzik ara"} className="min-w-48 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><select value={vocalType} onChange={(event) => setVocalType(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">{english ? "Any vocal style" : "Tüm vokal türleri"}</option><option value="instrumental">{english ? "Instrumental" : "Enstrümantal"}</option><option value="vocals">{english ? "Vocals" : "Vokalli"}</option></select><button type="button" onClick={() => void loadTracks()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{english ? "Search" : "Ara"}</button></div>}
      {catalogError && <p role="alert" className="break-words rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{catalogError}</p>}
      {loading && tracks.length === 0 ? <p role="status" aria-live="polite" className="text-sm text-slate-500">{english ? "Loading music…" : "Müzik yükleniyor…"}</p> : !loading && tracks.length === 0 && !catalogError ? <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{english ? "No matching tracks found." : "Eşleşen parça bulunamadı."}</p> : tracks.map((track) => <div key={track.id} className={`flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border p-3 sm:flex-nowrap ${value.selectedTrackId === track.id ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
        {track.artworkUrl && <img src={track.artworkUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />}
        <button type="button" aria-pressed={value.selectedTrackId === track.id} className="min-w-0 flex-[1_1_12rem] text-left" onClick={() => selectTrack(track)}><strong className="block break-words text-sm text-slate-950">{track.title}</strong><span className="block break-words text-xs text-slate-500">{[track.artist, track.moods[0], track.genres[0], track.durationSec ? `${Math.floor(track.durationSec / 60)}:${String(Math.round(track.durationSec % 60)).padStart(2, "0")}` : "", track.bpm ? `${track.bpm} BPM` : ""].filter(Boolean).join(" · ")}</span></button>
        <button type="button" aria-label={`${playingId === track.id ? (english ? "Stop preview" : "Önizlemeyi durdur") : (english ? "Play preview" : "Önizlemeyi oynat")}: ${track.title}`} disabled={!track.previewAvailable} onClick={() => void previewTrack(track)} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">{playingId === track.id ? (english ? "Stop" : "Durdur") : (english ? "Play" : "Oynat")}</button>
        <button type="button" aria-label={`${english ? "Select track" : "Parçayı seç"}: ${track.title}`} aria-pressed={value.selectedTrackId === track.id} onClick={() => selectTrack(track)} className="min-h-11 rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-semibold text-violet-700">{value.selectedTrackId === track.id ? (english ? "Selected" : "Seçildi") : (english ? "Select track" : "Parçayı seç")}</button>
      </div>)}
      {hasMore && <button type="button" disabled={loading} onClick={() => void loadTracks({ more: true })} className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold">{english ? "Load more" : "Daha fazla yükle"}</button>}
    </div>}
    {confirmationRequired && selectedTrack && <div data-selected-music-confirmation-card="true" className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{english ? "Selected Music" : "Seçili Müzik"}</span>
      <div className="mt-3 flex items-center gap-3">
        {selectedTrack.artworkUrl && <img src={selectedTrack.artworkUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm">{selectedTrack.title}</strong>
          <span className="mt-0.5 block truncate text-xs text-amber-800">{[
            selectedTrack.artist,
            selectedTrack.moods[0],
            selectedTrack.genres[0],
            selectedTrack.durationSec ? `${Math.floor(selectedTrack.durationSec / 60)}:${String(Math.round(selectedTrack.durationSec % 60)).padStart(2, "0")}` : "",
          ].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5">{english ? "Listen to the selected track before confirming it for final export." : "Final dışa aktarım için onaylamadan önce seçili parçayı dinle."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!selectedTrack.previewAvailable} onClick={() => void previewTrack(selectedTrack)} className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-semibold disabled:opacity-40">
          {playingId === selectedTrack.id ? (english ? "Pause Preview" : "Önizlemeyi Duraklat") : (english ? "Play Preview" : "Önizlemeyi Oynat")}
        </button>
        <button type="button" onClick={() => setView("browse")} className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-semibold">
          {english ? "Change Music" : "Müziği Değiştir"}
        </button>
        <button
          type="button"
          data-confirm-selected-music="true"
          disabled={confirmingTrackId === selectedTrack.id}
          onClick={async () => {
            if (!onConfirmTrack) return;
            setConfirmingTrackId(selectedTrack.id);
            await onConfirmTrack(selectedTrack.id);
            setConfirmingTrackId("");
          }}
          className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {confirmingTrackId === selectedTrack.id
            ? english ? "Confirming…" : "Onaylanıyor…"
            : english ? "Confirm This Music" : "Bu Müziği Onayla"}
        </button>
      </div>
    </div>}
  </section>;
}
