"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getCreatorProductionSnapshotProject,
  getCreatorProductionSnapshotScenes,
  type CreatorProductionSnapshot,
  type CreatorProductionSnapshotSummary,
} from "@/lib/creator/creatorProductionHistory";

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const safeMediaUrl = (value: unknown) => {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
};

export default function CreatorProductionHistory({ projectId, language }: { projectId: string; language: "en" | "tr" }) {
  const [summaries, setSummaries] = useState<CreatorProductionSnapshotSummary[]>([]);
  const [selected, setSelected] = useState<CreatorProductionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const request = async (suffix = "") => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("AUTH_REQUIRED");
    const response = await fetch(`/api/creator-production-history/${encodeURIComponent(projectId)}${suffix}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "HISTORY_UNAVAILABLE");
    return payload;
  };

  useEffect(() => {
    let active = true;
    if (!projectId) return;
    void request().then((payload) => {
      if (active) setSummaries(Array.isArray(payload?.snapshots) ? payload.snapshots : []);
    }).catch(() => {
      if (active) setSummaries([]);
    });
    return () => { active = false; };
  }, [projectId]);

  const scenes = useMemo(() => selected ? getCreatorProductionSnapshotScenes(selected.snapshot) : [], [selected]);
  const snapshotProject = useMemo(() => selected ? getCreatorProductionSnapshotProject(selected.snapshot) : {}, [selected]);
  const finalVideoUrl = safeMediaUrl(snapshotProject.exported_movie_url);

  if (summaries.length === 0 && !selected) return null;

  const openSnapshot = async (summary: CreatorProductionSnapshotSummary) => {
    setLoading(true);
    try {
      const payload = await request(`?snapshotId=${encodeURIComponent(summary.id)}`);
      setSelected(payload.snapshot as CreatorProductionSnapshot);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="creatorlab-production-history" aria-label={language === "en" ? "Previous Production" : "Önceki Üretim"}>
      <div>
        <strong>{language === "en" ? "Previous Production" : "Önceki Üretim"}</strong>
        <span>{language === "en" ? " Historical, read-only, and no longer current." : " Geçmiş, salt okunur ve artık güncel değil."}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {summaries.map((summary) => (
          <button key={summary.id} type="button" disabled={loading} onClick={() => void openSnapshot(summary)}>
            {language === "en" ? `View Revision ${summary.sourceScriptRevision}` : `Revizyon ${summary.sourceScriptRevision} Görüntüle`}
          </button>
        ))}
      </div>
      {selected && (
        <div className="creatorlab-production-history-view" role="region" aria-label={language === "en" ? "Historical Production" : "Geçmiş Üretim"}>
          <header>
            <div>
              <strong>{language === "en" ? `Historical Production · Revision ${selected.sourceScriptRevision}` : `Geçmiş Üretim · Revizyon ${selected.sourceScriptRevision}`}</strong>
              <p>{language === "en" ? "No longer current. Viewing does not restore or change this project." : "Artık güncel değil. Görüntüleme bu projeyi geri yüklemez veya değiştirmez."}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)}>{language === "en" ? "Return to current production" : "Güncel üretime dön"}</button>
          </header>
          <ol>
            {scenes.map((value, index) => {
              const scene = record(value);
              const imageUrl = safeMediaUrl(scene.image ?? scene.imageUrl);
              const videoUrl = safeMediaUrl(scene.videoUrl);
              const narrationUrl = safeMediaUrl(scene.audioUrl);
              return (
                <li key={text(scene.creatorSceneId) || text(scene.id) || String(index)}>
                  <strong>{language === "en" ? `Scene ${index + 1}` : `Sahne ${index + 1}`}</strong>
                  <p>{text(scene.narration) || text(scene.text) || text(scene.dialogue)}</p>
                  {videoUrl && <video src={videoUrl} controls preload="metadata" />}
                  {!videoUrl && imageUrl && <a href={imageUrl} target="_blank" rel="noreferrer">{language === "en" ? "Open historical image" : "Geçmiş görseli aç"}</a>}
                  {narrationUrl && <audio src={narrationUrl} controls preload="none" />}
                </li>
              );
            })}
          </ol>
          {finalVideoUrl && <a href={finalVideoUrl} target="_blank" rel="noreferrer">{language === "en" ? "Open historical final video" : "Geçmiş final videoyu aç"}</a>}
        </div>
      )}
    </section>
  );
}
