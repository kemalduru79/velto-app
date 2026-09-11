"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { CREATOR_AUDIO_MIX_POLICY } from "../../export-service/src/creatorAudioPolicy.js";
import type { CreatorAudioPreviewMusic } from "@/lib/creator/audioPreviewPlan";

export function useCreatorAudioPreviewPlayback(getAccessToken: () => Promise<string>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const placementRef = useRef("");
  const musicRef = useRef<CreatorAudioPreviewMusic | null>(null);
  const rampRef = useRef<number | null>(null);

  const cancelRamp = () => {
    if (rampRef.current !== null) cancelAnimationFrame(rampRef.current);
    rampRef.current = null;
  };
  const rampTo = (target: number, durationMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelRamp();
    const initial = audio.volume;
    const started = performance.now();
    const step = (now: number) => {
      if (audio !== audioRef.current) return;
      const progress = Math.min(1, (now - started) / Math.max(1, durationMs));
      audio.volume = Math.min(1, Math.max(0, initial + (target - initial) * progress));
      if (progress < 1) rampRef.current = requestAnimationFrame(step);
      else rampRef.current = null;
    };
    rampRef.current = requestAnimationFrame(step);
  };
  const stop = () => {
    cancelRamp();
    hlsRef.current?.destroy();
    hlsRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    placementRef.current = "";
    musicRef.current = null;
  };
  const fadeOutAndStop = async () => {
    const audio = audioRef.current;
    const durationMs = musicRef.current?.fadeOutMs || 0;
    if (!audio || durationMs <= 0) { stop(); return; }
    rampTo(0, durationMs);
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    if (audio === audioRef.current) stop();
  };
  const sync = async (music?: CreatorAudioPreviewMusic) => {
    if (!music) { await fadeOutAndStop(); return; }
    if (placementRef.current === music.placementId && audioRef.current) {
      musicRef.current = music;
      rampTo(music.gain, CREATOR_AUDIO_MIX_POLICY.duckingReleaseMs);
      return;
    }
    await fadeOutAndStop();
    const token = await getAccessToken();
    const params = new URLSearchParams({ action: "preview", trackId: music.trackId });
    const response = await fetch(`/api/creator-music?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true || typeof body.streamUrl !== "string") throw new Error("CREATOR_AUDIO_PREVIEW_UNAVAILABLE");
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    placementRef.current = music.placementId;
    musicRef.current = music;
    if (Hls.isSupported()) {
      await new Promise<void>((resolve, reject) => {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.attachMedia(audio);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(body.streamUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, () => { void audio.play().then(resolve, reject); });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) reject(new Error("CREATOR_AUDIO_PREVIEW_UNAVAILABLE")); });
      });
    } else {
      audio.src = body.streamUrl;
      await audio.play();
    }
    rampTo(music.gain, music.fadeInMs);
  };
  const setSpeechActive = (active: boolean) => {
    const music = musicRef.current;
    if (!music || music.duckingMode !== "under_speech") return;
    rampTo(active ? music.duckedGain : music.gain, active
      ? CREATOR_AUDIO_MIX_POLICY.duckingAttackMs
      : CREATOR_AUDIO_MIX_POLICY.duckingReleaseMs);
  };
  useEffect(() => stop, []);
  return { sync, setSpeechActive, stop };
}
