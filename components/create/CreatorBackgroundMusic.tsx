"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CreatorAudioAssetReference, CreatorAudioTimeline } from "@/lib/creator/audioTimeline";
import { getCreatorMusicSetupMode, selectUploadedCreatorMusic, setCreatorMusicSetupMode, type CreatorMusicSetupMode } from "@/lib/creator/musicSetup";

const ACCEPTED_AUDIO = "audio/mpeg,audio/wav,audio/mp4,audio/x-m4a";

export default function CreatorBackgroundMusic({ timeline, projectId, sceneIds, onChange, getAccessToken, language }: {
  timeline: CreatorAudioTimeline | null | undefined;
  projectId: string;
  sceneIds: string[];
  onChange: (timeline: CreatorAudioTimeline) => void;
  getAccessToken: () => Promise<string>;
  language: "en" | "tr";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const english = language === "en";
  const mode = getCreatorMusicSetupMode(timeline);
  const selectedMusic = timeline?.placements.find((item) => item.kind === "music" && item.status === "active");

  const chooseMode = (nextMode: CreatorMusicSetupMode) => {
    setError(""); setFile(null); setRightsConfirmed(false);
    onChange(setCreatorMusicSetupMode(timeline, nextMode));
  };

  const upload = async () => {
    if (!file || !rightsConfirmed) return;
    if (!projectId || sceneIds.length === 0) {
      setError(!projectId
        ? (english ? "Save this project before uploading music." : "Müzik yüklemeden önce projeyi kaydet.")
        : (english ? "Create scenes before adding music." : "Müzik eklemeden önce sahneleri oluştur."));
      return;
    }
    setUploading(true); setError("");
    try {
      const token = await getAccessToken();
      const authorization = { Authorization: `Bearer ${token}` };
      const initiatedResponse = await fetch("/api/creator-audio-assets", {
        method: "POST", headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initiate", projectId, originalFilename: file.name, mediaKind: "music", mimeType: file.type, sizeBytes: file.size, creatorAttested: true }),
      });
      const initiated = await initiatedResponse.json().catch(() => null);
      if (!initiatedResponse.ok || !initiated?.upload) throw new Error(initiated?.error || "Music upload could not start.");
      const { error: storageError } = await supabase.storage.from(initiated.upload.bucket)
        .uploadToSignedUrl(initiated.upload.path, initiated.upload.token, file, { contentType: file.type, upsert: false });
      if (storageError) throw new Error(english ? "The upload was interrupted. Try again." : "Yükleme kesildi. Tekrar dene.");
      const finalizedResponse = await fetch("/api/creator-audio-assets", {
        method: "POST", headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", intentToken: initiated.upload.intentToken }),
      });
      const finalized = await finalizedResponse.json().catch(() => null);
      if (!finalizedResponse.ok || !finalized?.asset) throw new Error(finalized?.error || "Music upload could not finish.");
      onChange(selectUploadedCreatorMusic({
        timeline,
        asset: {
          ...(finalized.asset as CreatorAudioAssetReference),
          displayName: file.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180),
        },
        sceneIds,
      }));
      setFile(null); setRightsConfirmed(false);
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (english ? "Music upload failed." : "Müzik yüklenemedi."));
    } finally { setUploading(false); }
  };

  return <section id="creatorlab-background-music" className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
    <p className="text-sm text-slate-500">{english ? "Choose the role music should play in this project." : "Bu projede müziğin rolünü seç."}</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label={english ? "Music choice" : "Müzik seçimi"}>
      {(["auto", "none", "browse"] as const).map((choice) => <button key={choice} type="button" aria-pressed={mode === choice} onClick={() => chooseMode(choice)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${mode === choice ? "border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-100" : "border-slate-200 text-slate-700"}`}>
        {choice === "auto" ? (english ? "Auto Match" : "Otomatik Eşleştir") : choice === "none" ? (english ? "No Music" : "Müzik Yok") : (english ? "Browse Music" : "Müziğe Göz At")}
      </button>)}
    </div>
    {mode === "auto" && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{english ? "Velto will match music to your content." : "Velto içeriğine uygun müziği eşleştirecek."}</p>}
    {mode === "none" && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{english ? "Your video will use narration without background music." : "Videon arka plan müziği olmadan anlatımı kullanacak."}</p>}
    {mode === "browse" && <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
      {selectedMusic ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><strong>{english ? "Uploaded music selected" : "Yüklenen müzik seçildi"}</strong><p className="mt-1 text-xs">{english ? "Ready for this project." : "Bu proje için hazır."}</p></div> : <p className="text-sm text-slate-600">{english ? "Licensed music browsing will appear here when available. You can upload your own track now." : "Lisanslı müzik seçenekleri kullanılabilir olduğunda burada görünecek. Şimdi kendi parçanı yükleyebilirsin."}</p>}
      <input ref={inputRef} type="file" className="sr-only" accept={ACCEPTED_AUDIO} onChange={(event) => { setFile(event.target.files?.[0] || null); setRightsConfirmed(false); setError(""); }} />
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">{english ? "Upload Music" : "Müzik Yükle"}</button>
      {file && <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="break-all text-xs text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-1" /><span>{english ? "I have the right to use this audio." : "Bu sesi kullanma hakkına sahibim."}</span></label>
        <button type="button" disabled={uploading || !rightsConfirmed} onClick={() => void upload()} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{uploading ? (english ? "Uploading…" : "Yükleniyor…") : (english ? "Use This Music" : "Bu Müziği Kullan")}</button>
      </div>}
      {selectedMusic?.asset.rights.status === "unknown" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{english ? "Review required" : "İnceleme gerekli"}</p>}
    </div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  </section>;
}
