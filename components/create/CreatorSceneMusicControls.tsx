"use client";

import { useState } from "react";
import type { CreatorAudioTimeline } from "@/lib/creator/audioTimeline";
import { continueCreatorSceneMusicAfter, getCreatorSceneMusicState, startOrChangeCreatorSceneMusic, stopCreatorSceneMusicAfter } from "@/lib/creator/sceneMusic";
import { creatorAcquiredCatalogTrackAsset } from "@/lib/creator/musicSetup";
import CreatorMusicLibraryPicker from "@/components/create/CreatorMusicLibraryPicker";

export default function CreatorSceneMusicControls({ timeline, sceneIds, sceneId, projectId, disabled, onChange, getAccessToken, language }: {
  timeline: CreatorAudioTimeline; sceneIds: string[]; sceneId: string; disabled?: boolean;
  projectId: string;
  onChange: (timeline: CreatorAudioTimeline) => void; language: "en" | "tr";
  getAccessToken: () => Promise<string>;
}) {
  const [choosing, setChoosing] = useState(false);
  const english = language === "en";
  const state = getCreatorSceneMusicState(timeline, sceneIds, sceneId);
  const musicActiveHere = state.activeBefore || state.starts || state.changes;
  const action = musicActiveHere ? "change" : "start";
  const effectiveName = state.effective?.asset?.displayName?.trim();
  const effectiveLabel = effectiveName || (state.effective?.musicSelection?.mode === "auto" ? (english ? "Auto Match" : "Otomatik Eşleştir") : "");
  const status = state.changes ? `${english ? "Music changes here" : "Müzik burada değişir"}${effectiveLabel ? ` · ${effectiveLabel}` : ""}`
    : state.starts ? `${english ? "Music starts here" : "Müzik burada başlar"}${effectiveLabel ? ` · ${effectiveLabel}` : ""}`
      : state.stops ? (english ? "Music stops after this scene" : "Müzik bu sahneden sonra durur")
        : effectiveLabel ? `${english ? "Using" : "Kullanılan"}: ${effectiveLabel}`
          : (english ? "No music is active here" : "Burada aktif müzik yok");
  const choose = (choice: Parameters<typeof startOrChangeCreatorSceneMusic>[0]["choice"]) => {
    onChange(startOrChangeCreatorSceneMusic({ timeline, sceneIds, sceneId, choice })); setChoosing(false);
  };
  return <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" data-scene-music-control="true">
      <p className="text-sm font-semibold text-blue-800" data-scene-music-status="true">{status}</p>
      {!choosing ? <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => setChoosing(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">{action === "change" ? (english ? "Change music here" : "Müziği burada değiştir") : (english ? "Start music here" : "Müziği burada başlat")}</button>
        {musicActiveHere && <button type="button" aria-pressed={state.stops} disabled={disabled} onClick={() => onChange(state.stops ? continueCreatorSceneMusicAfter({ timeline, sceneIds, sceneId }) : stopCreatorSceneMusicAfter({ timeline, sceneIds, sceneId }))} className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${state.stops ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-800"}`}>{state.stops ? (english ? "✓ Music stops after this scene" : "✓ Müzik bu sahneden sonra durur") : (english ? "Stop music after this scene" : "Müziği bu sahneden sonra durdur")}</button>}
      </div> : <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-600">{english ? "Choose music to play from this scene." : "Bu sahneden itibaren çalacak müziği seç."}</p>
        <div className="mt-4"><CreatorMusicLibraryPicker getAccessToken={getAccessToken} projectId={projectId} language={language} onSelect={(track) => choose({ mode: "asset", asset: creatorAcquiredCatalogTrackAsset(track) })} /></div>
        <button type="button" onClick={() => setChoosing(false)} className="mt-3 text-xs font-semibold text-slate-600">{english ? "Cancel" : "İptal"}</button>
      </div>}
      {(state.starts || state.changes) && <p className="text-xs text-slate-500">{state.stops ? (english ? "Music plays through this scene, then stops." : "Müzik bu sahne boyunca çalar, ardından durur.") : (english ? "Music continues naturally until you change or stop it." : "Müzik, değiştirene veya durdurana kadar doğal biçimde devam eder.")}</p>}
  </div>;
}
