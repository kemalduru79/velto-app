"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { CreatorPremiumMusicTrack } from "@/lib/providers/music/types";

type AutoMatchInput = { contentType?: string; outcome?: string; format?: string; topic?: string; visualStyle?: string };

export default function CreatorMusicLibraryPicker({ onSelect, getAccessToken, language, autoMatchInput, autoOnly = false }: {
  onSelect: (track: CreatorPremiumMusicTrack) => void;
  getAccessToken: () => Promise<string>;
  language: "en" | "tr";
  autoMatchInput?: AutoMatchInput;
  autoOnly?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [tracks, setTracks] = useState<CreatorPremiumMusicTrack[]>([]);
  const [term, setTerm] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const english = language === "en";
  const stopPreview = () => { hlsRef.current?.destroy(); hlsRef.current = null; audioRef.current?.pause(); audioRef.current = null; setPlayingId(""); };
  useEffect(() => stopPreview, []);

  const request = async (params: URLSearchParams) => {
    const token = await getAccessToken();
    const response = await fetch(`/api/creator-music?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.error || (english ? "Music library could not be loaded." : "Müzik kütüphanesi yüklenemedi."));
    return body;
  };
  const search = async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ action: autoOnly ? "auto" : "search", limit: autoOnly ? "3" : "16" });
      if (autoOnly) Object.entries(autoMatchInput || {}).forEach(([key, value]) => value && params.set(key, value));
      else params.set("term", term.trim() || "inspiring");
      const body = await request(params);
      setTracks(Array.isArray(body.tracks) ? body.tracks : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Music library could not be loaded."); }
    finally { setLoading(false); }
  };
  const preview = async (track: CreatorPremiumMusicTrack) => {
    if (playingId === track.id) return stopPreview();
    stopPreview(); setError("");
    try {
      const body = await request(new URLSearchParams({ action: "preview", trackId: track.id }));
      const audio = new Audio(); audioRef.current = audio; setPlayingId(track.id); audio.onended = stopPreview;
      if (Hls.isSupported()) { const hls = new Hls(); hlsRef.current = hls; hls.attachMedia(audio); hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(body.streamUrl)); hls.on(Hls.Events.MANIFEST_PARSED, () => void audio.play()); }
      else { audio.src = body.streamUrl; await audio.play(); }
    } catch { stopPreview(); setError(english ? "Preview is unavailable." : "Önizleme kullanılamıyor."); }
  };
  return <section className="space-y-3" data-creator-music-library="true">
    <strong className="block text-sm text-slate-900">{english ? "Music Library" : "Müzik Kütüphanesi"}</strong>
    {!autoOnly && <div className="flex gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder={english ? "Search music..." : "Müzik ara..."} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" /><button type="button" onClick={() => void search()} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{english ? "Search" : "Ara"}</button></div>}
    {autoOnly && <button type="button" onClick={() => void search()} disabled={loading} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{english ? "Find matches" : "Eşleşmeleri bul"}</button>}
    {loading && <p role="status" className="text-sm text-slate-500">{english ? "Loading music…" : "Müzik yükleniyor…"}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {tracks.map((track) => <article key={track.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {track.artworkUrl && <img src={track.artworkUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}
      <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{track.title}</strong><span className="block truncate text-xs text-slate-500">{[track.artist, track.durationSec ? `${Math.floor(track.durationSec / 60)}:${String(Math.round(track.durationSec % 60)).padStart(2, "0")}` : ""].filter(Boolean).join(" · ")}</span></div>
      <button type="button" disabled={!track.previewAvailable} onClick={() => void preview(track)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{playingId === track.id ? (english ? "Stop" : "Durdur") : (english ? "Preview" : "Önizle")}</button>
      <button type="button" onClick={() => { stopPreview(); onSelect(track); }} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">{english ? "Use track" : "Parçayı kullan"}</button>
    </article>)}
  </section>;
}
