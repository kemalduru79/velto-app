"use client";

import { useMemo, useState } from "react";
import {
  countCreatorScriptWords,
  editCreatorScriptDocument,
  getCreatorScriptDocumentText,
  getCreatorScriptDurationContract,
  getCreatorScriptMetrics,
  getCreatorScriptSectionSourceReview,
  getCreatorScriptStatus,
  type CreatorScript,
} from "@/lib/creator/creatorScript";

type Props = {
  script: CreatorScript;
  currentStrategyFingerprint: string;
  language: "tr" | "en";
  busySectionId: string | null;
  buildingScenes: boolean;
  generatingScript: boolean;
  onSaveDocument: (text: string) => Promise<void>;
  onRegenerateSection: (sectionId: string) => void;
  onReviewSources: (sectionId: string, confirm?: boolean) => Promise<{ statement: string; sources: Array<{ sourceTitle: string; excerpt: string; context: string | null }> }[]>;
  onApproveAndBuildScenes: (text: string) => void;
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
  generatingScript,
  onSaveDocument,
  onRegenerateSection,
  onReviewSources,
  onApproveAndBuildScenes,
}: Props) {
  const canonicalDocument = useMemo(() => getCreatorScriptDocumentText(script), [script]);
  const [draft, setDraft] = useState(canonicalDocument);
  const [saving, setSaving] = useState(false);
  const [sourceReview, setSourceReview] = useState<{ sectionId: string; items: Awaited<ReturnType<Props["onReviewSources"]>> } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const metrics = useMemo(() => getCreatorScriptMetrics(script, language), [script, language]);
  const draftChanged = draft.trim() !== canonicalDocument;
  const durationContract = useMemo(() => getCreatorScriptDurationContract({
    targetDurationSec: script.targetDurationSec,
    language,
    actualWordCount: countCreatorScriptWords(draft),
  }), [draft, language, script.targetDurationSec]);
  const projectedScript = useMemo(() => {
    try { return editCreatorScriptDocument(script, draft, script.updatedAt); } catch { return null; }
  }, [draft, script]);
  const status = getCreatorScriptStatus(script, currentStrategyFingerprint);
  const durationCompliant = durationContract.status === "compliant";
  const evidenceReviewSections = projectedScript?.sections.filter((section) => section.evidenceReviewRequired) ?? [];
  const evidenceReviewBlocked = evidenceReviewSections.length > 0;
  const manuallyReviewableSectionIds = new Set(evidenceReviewSections.filter((section) =>
    projectedScript && getCreatorScriptSectionSourceReview(projectedScript, section.id)
  ).map((section) => section.id));

  return (
    <section className="creatorlab-strategy-panel creatorlabs-script-review" data-creator-script-review="true" data-editorial-review-checkpoint="production-setup-create-review">
      <div className="creatorlab-strategy-panel-heading">
        <div>
          <span>{language === "en" ? "Editorial Review" : "Editoryal İnceleme"}</span>
          <h3>{script.title}</h3>
          <p>{language === "en" ? "Review and approve the complete script before scene production." : "Sahne üretiminden önce tam metni incele ve onayla."}</p>
        </div>
        <strong data-script-status={status}>
          {status === "approved" ? (language === "en" ? "Approved" : "Onaylandı") : status === "stale" ? (language === "en" ? "Stale · Action required" : "Güncel değil · İşlem gerekli") : (language === "en" ? "Draft" : "Taslak")}
        </strong>
      </div>

      <div className="creatorlab-strategy-evidence-summary">
        <span>{durationContract.actualWordCount} {language === "en" ? "words" : "kelime"}</span>
        <span>{language === "en" ? "Estimated" : "Tahmini"}: {formatSeconds(durationContract.estimatedDurationSec)}</span>
        <span>{language === "en" ? "Target" : "Hedef"}: {formatSeconds(script.targetDurationSec)}</span>
        <span>{language === "en" ? "Variance" : "Fark"}: {formatSeconds(metrics.varianceSec)}</span>
        <span>{language === "en" ? "Evidence coverage" : "Kanıt kapsamı"}: {Math.round(metrics.evidenceCoverage * 100)}%</span>
      </div>

      {generatingScript && (
        <p role="status">
          {language === "en"
            ? "Rebuilding the full script. This is the previous script and will remain available unless the rebuild succeeds."
            : "Tam metin yeniden oluşturuluyor. Bu önceki metindir ve yeni metin başarıyla tamamlanana kadar korunacaktır."}
        </p>
      )}

      <div className="creatorlab-script-document-workspace mx-auto w-full max-w-4xl">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="creatorlab-full-script-document">{language === "en" ? "Complete script" : "Tam metin"}</label>
        <textarea
          id="creatorlab-full-script-document"
          data-creator-script-document="continuous"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={28}
          className="mt-3 min-h-[32rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-6 py-6 text-base leading-8 text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 md:px-8"
          disabled={generatingScript || buildingScenes || saving}
          spellCheck
        />
        <div className="creatorlab-script-document-actions mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-500">{draftChanged ? (language === "en" ? "Unsaved script changes" : "Kaydedilmemiş metin değişiklikleri") : (language === "en" ? "All script changes saved" : "Tüm metin değişiklikleri kaydedildi")}</span>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!draftChanged || !projectedScript || saving || Boolean(busySectionId)} onClick={async () => {
            setSaving(true);
            try { await onSaveDocument(draft); } finally { setSaving(false); }
          }}>{saving ? (language === "en" ? "Saving…" : "Kaydediliyor…") : (language === "en" ? "Save Script Changes" : "Metin Değişikliklerini Kaydet")}</button>
        </div>
      </div>

      <details className="group mx-auto mt-5 w-full max-w-4xl text-sm text-slate-600" open={evidenceReviewBlocked || undefined}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1.5 font-medium text-slate-600 outline-none transition hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none">
            <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
          {language === "en" ? "Section tools" : "Bölüm araçları"}
        </summary>
        <div className="mt-2 divide-y divide-slate-200/80 border-y border-slate-200/80">
          {script.sections.map((section) => <div key={section.id} data-script-section={section.kind} className="flex items-center justify-between gap-6 py-3">
            <div className="min-w-0">
              <strong className="block truncate text-sm font-medium text-slate-800">{section.heading || (section.kind === "opening" ? (language === "en" ? "Opening" : "Açılış") : section.kind === "conclusion" ? (language === "en" ? "Conclusion" : "Sonuç") : (language === "en" ? "Script section" : "Metin bölümü"))}</strong>
              <span className="mt-0.5 block text-xs text-slate-400">{section.kind === "opening" ? (language === "en" ? "Opening" : "Açılış") : section.kind === "conclusion" ? (language === "en" ? "Conclusion" : "Sonuç") : (language === "en" ? "Body" : "Gövde")}</span>
              {section.evidenceReviewRequired && <span className="mt-1 block text-xs font-medium text-amber-700">{language === "en" ? "Review required" : "İnceleme gerekli"}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
            {manuallyReviewableSectionIds.has(section.id) && <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" type="button" disabled={reviewing || draftChanged} onClick={async (event) => { event.preventDefault(); event.stopPropagation(); setReviewing(true); try { setSourceReview({ sectionId: section.id, items: await onReviewSources(section.id, false) }); } finally { setReviewing(false); } }}>{language === "en" ? "Review sources" : "Kaynakları incele"}</button>}
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45" type="button" onClick={() => onRegenerateSection(section.id)} disabled={Boolean(busySectionId) || draftChanged}>
              {busySectionId === section.id ? (language === "en" ? "Regenerating…" : "Yenileniyor…") : section.evidenceReviewRequired ? (language === "en" ? "Regenerate to verify" : "Doğrulamak için yenile") : section.kind === "opening" ? (language === "en" ? "Strengthen opening" : "Açılışı güçlendir") : (language === "en" ? "Regenerate" : "Yenile")}
            </button>
            </div>
          </div>)}
        </div>
        {sourceReview && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700" role="dialog" aria-label={language === "en" ? "Source review" : "Kaynak incelemesi"}>
          <strong className="text-slate-900">{language === "en" ? "Verification required before production" : "Üretimden önce doğrulama gerekli"}</strong>
          {sourceReview.items.map((item, index) => <div className="mt-3" key={index}><p>{item.statement}</p>{item.sources.map((source, sourceIndex) => <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-sm" key={sourceIndex}><strong>{source.sourceTitle}</strong><p>{source.excerpt}</p>{source.context && <p className="text-slate-500">{source.context}</p>}</blockquote>)}</div>)}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white" disabled={reviewing} onClick={async () => { setReviewing(true); try { await onReviewSources(sourceReview.sectionId, true); setSourceReview(null); } finally { setReviewing(false); } }}>{language === "en" ? "Confirm this edit is supported" : "Bu düzenlemenin desteklendiğini onayla"}</button><button type="button" className="rounded-lg px-3 py-2" onClick={() => setSourceReview(null)}>{language === "en" ? "Close" : "Kapat"}</button></div>
        </div>}
      </details>

      <div className="creatorlab-strategy-action-bar">
        <div className="creatorlab-strategy-action-copy">
          <strong>{language === "en" ? "Approve the current script revision" : "Mevcut metin sürümünü onayla"}</strong>
          <p>{generatingScript
            ? (language === "en" ? "A replacement script is being generated. Scene creation is unavailable until it succeeds." : "Yeni metin oluşturuluyor. Başarıyla tamamlanana kadar sahne oluşturma kullanılamaz.")
            : evidenceReviewBlocked
              ? (language === "en" ? `${evidenceReviewSections.length === 1 ? "One edited section contains" : `${evidenceReviewSections.length} edited sections contain`} sourced claims that need verification before scenes can be built. In Section tools, choose Regenerate to verify. Your saved text remains unchanged until you choose that action.` : `${evidenceReviewSections.length} düzenlenmiş bölümde sahneler oluşturulmadan önce doğrulanması gereken kaynaklı iddialar var. Bölüm araçlarında doğrulamak için Yenile'yi seç. Bu işlemi seçene kadar kaydedilmiş metnin değişmez.`)
            : !durationCompliant
              ? (language === "en" ? "This historic script does not satisfy its duration target. Rebuild the script before creating scenes." : "Bu eski metin süre hedefini karşılamıyor. Sahneleri oluşturmadan önce metni yeniden oluştur.")
              : status === "stale" ? (language === "en" ? "Strategy changed. Rebuild the script before creating scenes." : "Strateji değişti. Sahneleri oluşturmadan önce metni yeniden oluştur.") : (language === "en" ? "Scenes will use this exact editorial script as their source of truth." : "Sahneler bu editoryal metni tek kaynak olarak kullanacak.")}</p>
        </div>
        <button type="button" className="creatorlab-strategy-primary-action" onClick={() => onApproveAndBuildScenes(draft)} disabled={generatingScript || buildingScenes || saving || !projectedScript || !durationCompliant || status === "stale" || evidenceReviewBlocked || script.grounding.context.readiness.status === "blocked"}>
          {buildingScenes
            ? (language === "en" ? "Building scenes…" : "Sahneler oluşturuluyor…")
            : !durationCompliant
              ? (language === "en" ? "Rebuild Script Required" : "Metni Yeniden Oluştur")
              : (language === "en" ? "Approve Script & Build Scenes" : "Metni Onayla ve Sahneleri Oluştur")}
        </button>
      </div>
    </section>
  );
}
