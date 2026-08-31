"use client";

import { useEffect, useRef, useState } from "react";
import type { CreatorUploadedMedia } from "@/lib/creator/uploadedMedia";

type PreviewMetadata = { width: number | null; height: number | null; durationSeconds: number | null };

export default function CreatorUploadPicker({
  projectId,
  sceneId,
  disabled,
  language,
  hasBoundUpload,
  getAccessToken,
  onUse,
  onRemove,
}: {
  projectId: string;
  sceneId: number;
  disabled?: boolean;
  language: "en" | "tr";
  hasBoundUpload: boolean;
  getAccessToken: () => Promise<string>;
  onUse: (asset: CreatorUploadedMedia) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [metadata, setMetadata] = useState<PreviewMetadata>({ width: null, height: null, durationSeconds: null });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const choose = (selected: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : "");
    setMetadata({ width: null, height: null, durationSeconds: null });
    setRightsConfirmed(false);
    setError("");
  };

  const upload = async () => {
    if (!file || !rightsConfirmed) return;
    setUploading(true);
    setError("");
    try {
      const token = await getAccessToken();
      const body = new FormData();
      body.set("projectId", projectId);
      body.set("mediaKind", file.type.startsWith("video/") ? "video" : "image");
      body.set("rightsConfirmed", "true");
      body.set("file", file);
      if (metadata.width) body.set("width", String(metadata.width));
      if (metadata.height) body.set("height", String(metadata.height));
      if (metadata.durationSeconds) body.set("durationSeconds", String(metadata.durationSeconds));
      const response = await fetch("/api/creator-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.asset) throw new Error(result?.error || "Upload failed.");
      onUse(result.asset as CreatorUploadedMedia);
      choose(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="creatorlab-p2c-editor-disclosure" data-creator-upload-picker="true" data-scene-id={sceneId}>
      <div className="creatorlab-p2c-editor-disclosure-body space-y-3">
        <div>
          <strong className="text-sm text-slate-900">{hasBoundUpload ? (language === "en" ? "Uploaded media" : "Yüklenen medya") : (language === "en" ? "Upload media" : "Medya yükle")}</strong>
          <p className="mt-1 text-xs text-slate-500">{language === "en" ? "JPEG, PNG, WebP, or MP4 · one file for this scene" : "JPEG, PNG, WebP veya MP4 · bu sahne için tek dosya"}</p>
        </div>
        <input ref={inputRef} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={(event) => choose(event.target.files?.[0] || null)} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">
            {file ? (language === "en" ? "Choose another" : "Başka dosya seç") : hasBoundUpload ? (language === "en" ? "Replace" : "Değiştir") : (language === "en" ? "Choose file" : "Dosya seç")}
          </button>
          {hasBoundUpload && <button type="button" disabled={disabled || uploading} onClick={onRemove} className="min-h-10 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 disabled:opacity-50">{language === "en" ? "Remove from scene" : "Sahneden kaldır"}</button>}
        </div>
        {file && previewUrl && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" data-upload-preview="unbound">
            {file.type === "video/mp4" ? (
              <video src={previewUrl} controls playsInline preload="metadata" onLoadedMetadata={(event) => setMetadata({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight, durationSeconds: event.currentTarget.duration })} className="aspect-video w-full bg-slate-950 object-contain" />
            ) : (
              <img src={previewUrl} alt={language === "en" ? "Selected upload preview" : "Seçilen yükleme önizlemesi"} onLoad={(event) => setMetadata({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight, durationSeconds: null })} className="aspect-video w-full bg-slate-950 object-contain" />
            )}
            <p className="break-all text-xs text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-700">
              <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-1" />
              <span>{language === "en" ? "I have the right to use this media." : "Bu medyayı kullanma hakkına sahibim."}</span>
            </label>
            <button type="button" disabled={disabled || uploading || !rightsConfirmed} onClick={() => void upload()} className="min-h-10 w-full rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white disabled:opacity-50">
              {uploading ? (language === "en" ? "Uploading…" : "Yükleniyor…") : (language === "en" ? "Use in this scene" : "Bu sahnede kullan")}
            </button>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
      </div>
    </section>
  );
}
