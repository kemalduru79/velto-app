"use client";

import { useMemo, useState } from "react";
import {
  getCreatorScriptMetrics,
  getCreatorScriptStatus,
  type CreatorScript,
} from "@/lib/creator/creatorScript";

type Props = {
  script: CreatorScript;
  currentStrategyFingerprint: string;
  language: "tr" | "en";
  busySectionId: string | null;
  buildingScenes: boolean;
  onSaveSection: (sectionId: string, text: string) => void;
  onRegenerateSection: (sectionId: string) => void;
  onApproveAndBuildScenes: () => void;
};

const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const remaining = Math.round(Math.abs(seconds) % 60);
  return `${seconds < 0 ? "−" : ""}${minutes}:${String(remaining).padStart(2, "0")}`;
};

export default function CreatorScriptReview({
  script,
  currentStrategyFingerprint,
  language,
  busySectionId,
  buildingScenes,
  onSaveSection,
  onRegenerateSection,
  onApproveAndBuildScenes,
}: Props) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const metrics = useMemo(() => getCreatorScriptMetrics(script, language), [script, language]);
  const status = getCreatorScriptStatus(script, currentStrategyFingerprint);
  const claims = new Map(script.grounding.context.claims.map((claim) => [claim.claimId, claim]));

  return (
    <section className="creatorlab-strategy-panel creatorlabs-script-review" data-creator-script-review="true">
      <div className="creatorlab-strategy-panel-heading">
        <div>
          <span>{language === "en" ? "Full Script Review" : "Tam Metin İncelemesi"}</span>
          <h3>{script.title}</h3>
          <p>{language === "en" ? "Review the complete editorial narrative before any scene breakdown." : "Sahne ayrımından önce editoryal anlatının tamamını incele."}</p>
        </div>
        <strong data-script-status={status}>
          {status === "approved" ? (language === "en" ? "Approved" : "Onaylandı") : status === "stale" ? (language === "en" ? "Stale · Action required" : "Güncel değil · İşlem gerekli") : (language === "en" ? "Draft" : "Taslak")}
        </strong>
      </div>

      <div className="creatorlab-strategy-evidence-summary">
        <span>{metrics.wordCount} {language === "en" ? "words" : "kelime"}</span>
        <span>{language === "en" ? "Estimated" : "Tahmini"}: {formatSeconds(metrics.estimatedDurationSec)}</span>
        <span>{language === "en" ? "Target" : "Hedef"}: {formatSeconds(script.targetDurationSec)}</span>
        <span>{language === "en" ? "Variance" : "Fark"}: {formatSeconds(metrics.varianceSec)}</span>
        <span>{language === "en" ? "Evidence coverage" : "Kanıt kapsamı"}: {Math.round(metrics.evidenceCoverage * 100)}%</span>
      </div>

      <div className="creatorlab-strategy-production-list">
        {script.sections.map((section) => {
          const editing = editingSectionId === section.id;
          return (
            <article key={section.id} data-script-section={section.kind}>
              <header>
                <div>
                  <span>{section.kind === "opening" ? (language === "en" ? "Opening" : "Açılış") : section.kind === "conclusion" ? (language === "en" ? "Conclusion" : "Sonuç") : (language === "en" ? "Section" : "Bölüm")}</span>
                  <h4>{section.heading || section.id}</h4>
                </div>
                <div>
                  <button type="button" onClick={() => { setEditingSectionId(section.id); setDraft(section.text); }} disabled={Boolean(busySectionId)}>{language === "en" ? "Edit Section" : "Bölümü Düzenle"}</button>
                  <button type="button" onClick={() => onRegenerateSection(section.id)} disabled={Boolean(busySectionId)}>
                    {busySectionId === section.id ? (language === "en" ? "Regenerating…" : "Yenileniyor…") : section.kind === "opening" ? (language === "en" ? "Strengthen Opening" : "Açılışı Güçlendir") : (language === "en" ? "Regenerate Section" : "Bölümü Yenile")}
                  </button>
                </div>
              </header>
              {editing ? (
                <div>
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={10} />
                  <button type="button" onClick={() => { onSaveSection(section.id, draft); setEditingSectionId(null); setDraft(""); }}>{language === "en" ? "Apply Edit" : "Düzenlemeyi Uygula"}</button>
                  <button type="button" onClick={() => { setEditingSectionId(null); setDraft(""); }}>{language === "en" ? "Cancel" : "İptal"}</button>
                </div>
              ) : <p>{section.text}</p>}
              <details>
                <summary>{language === "en" ? `Review Evidence (${section.claimIds.length})` : `Kanıtları İncele (${section.claimIds.length})`}</summary>
                {section.evidenceReviewRequired && <p role="alert">{language === "en" ? "This edited grounded section requires evidence review before approval." : "Bu düzenlenmiş kaynaklı bölüm, onaydan önce kanıt incelemesi gerektiriyor."}</p>}
                {section.claimIds.length ? (
                  <ul>{section.claimIds.map((claimId) => <li key={claimId}><strong>{claimId}</strong> — {claims.get(claimId)?.text || (language === "en" ? "Unknown claim" : "Bilinmeyen iddia")}</li>)}</ul>
                ) : <p>{language === "en" ? "No factual claim references are required for this section." : "Bu bölüm için olgusal iddia referansı gerekmiyor."}</p>}
              </details>
            </article>
          );
        })}
      </div>

      <div className="creatorlab-strategy-action-bar">
        <div className="creatorlab-strategy-action-copy">
          <strong>{language === "en" ? "Approve the current script revision" : "Mevcut metin sürümünü onayla"}</strong>
          <p>{status === "stale" ? (language === "en" ? "Strategy changed. Rebuild the script before creating scenes." : "Strateji değişti. Sahneleri oluşturmadan önce metni yeniden oluştur.") : (language === "en" ? "Scenes will use this exact editorial script as their source of truth." : "Sahneler bu editoryal metni tek kaynak olarak kullanacak.")}</p>
        </div>
        <button type="button" className="creatorlab-strategy-primary-action" onClick={onApproveAndBuildScenes} disabled={buildingScenes || status === "stale" || script.sections.some((section) => section.evidenceReviewRequired) || script.grounding.context.readiness.status === "blocked"}>
          {buildingScenes ? (language === "en" ? "Building scenes…" : "Sahneler oluşturuluyor…") : (language === "en" ? "Approve Script & Build Scenes" : "Metni Onayla ve Sahneleri Oluştur")}
        </button>
      </div>
    </section>
  );
}
