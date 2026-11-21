import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CreatorCounterEvidenceReview } from "../../components/create/CreatorCounterEvidenceReview";
import { CreatorScriptDraftPreview } from "../../components/create/CreatorScriptDraftPreview";
import { runCreatorScriptBuildV2 } from "../../lib/creator/creatorScriptBuildClient";
import type { CreatorBuildEditorialReview, CreatorEditorialReviewDecision } from "../../lib/creator/creatorScriptBuildEditorialReview";
import { getCreatorScriptDocumentText, type CreatorScript } from "../../lib/creator/creatorScript";
import type { CreatorScriptPendingRefinement, CreatorScriptRevisionHistoryEntry } from "../../lib/creator/creatorScriptRevisions";
import CreatorScriptReview from "../../components/create/CreatorScriptReview";

// Test-only host for the REAL CreatorScriptReview component. Storage and handlers
// are synthetic; no claim is made about real Supabase persistence.
type BrowserRecord = {
  script: CreatorScript;
  revisionHistory: CreatorScriptRevisionHistoryEntry[];
};
const STORAGE_KEY = "velto:8h:synthetic-record";
const now = () => new Date().toISOString();

function ScriptQualityBrowserFixture({ initialScript }: { initialScript: CreatorScript }) {
  const [record, setRecord] = useState<BrowserRecord>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as BrowserRecord;
    } catch { /* isolated fixture only */ }
    return { script: initialScript, revisionHistory: [] };
  });
  const recordRef = useRef(record);
  const [pendingRefinement, setPendingRefinement] = useState<CreatorScriptPendingRefinement | null>(null);
  const pendingRef = useRef<CreatorScriptPendingRefinement | null>(null);
  const failNextSaveRef = useRef(false);
  const [message, setMessage] = useState("SYNTHETIC_SCRIPT_READY");
  const requestsRef = useRef<Array<{ scope: string; mode: string; instruction: string }>>([]);

  const commit = (next: BrowserRecord) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    recordRef.current = next;
    setRecord(next);
  };
  const proposal = (next: CreatorScriptPendingRefinement | null) => {
    pendingRef.current = next;
    setPendingRefinement(next);
  };
  useEffect(() => {
    (window as unknown as { __sq8h: unknown }).__sq8h = {
      current: () => recordRef.current,
      pending: () => pendingRef.current,
      requests: () => requestsRef.current,
      failNextSave: () => { failNextSaveRef.current = true; },
    };
    return () => { delete (window as unknown as { __sq8h?: unknown }).__sq8h; };
  }, []);

  const onSaveDocument = async (documentText: string): Promise<void> => {
    const prior = recordRef.current;
    const original = getCreatorScriptDocumentText(prior.script);
    const first = prior.script.sections[0];
    if (!first) { setMessage("NO_SECTION"); return; }
    const start = original.indexOf(first.text);
    if (start < 0) { setMessage("DOCUMENT_LAYOUT_MISMATCH"); return; }
    const prefix = original.slice(0, start);
    const suffix = original.slice(start + first.text.length);
    if (!documentText.startsWith(prefix) || !documentText.endsWith(suffix)) {
      setMessage("DOCUMENT_LAYOUT_MISMATCH"); return;
    }
    const editedText = documentText.slice(prefix.length, documentText.length - suffix.length);
    if (!editedText.trim()) { setMessage("EMPTY_SECTION_REJECTED"); return; }
    if (failNextSaveRef.current) {
      failNextSaveRef.current = false;
      setMessage("SIMULATED_SAVE_FAILURE");
      return;
    }
    const changed = { ...first, text: editedText };
    const updatedScript: CreatorScript = {
      ...prior.script,
      sections: [changed, ...prior.script.sections.slice(1)],
      revision: prior.script.revision + 1,
      updatedAt: now(),
      approval: null,
    };
    if (getCreatorScriptDocumentText(updatedScript) !== documentText) {
      setMessage("DOCUMENT_CANONICALIZATION_REJECTED"); return;
    }
    const history: CreatorScriptRevisionHistoryEntry = {
      id: `manual-${updatedScript.revision}`,
      fromRevision: prior.script.revision,
      toRevision: updatedScript.revision,
      createdAt: now(),
      origin: "manual",
      changes: [{ sectionId: first.id, sectionHeading: first.heading || first.kind, beforeText: first.text, afterText: editedText }],
    };
    commit({ script: updatedScript, revisionHistory: [...prior.revisionHistory, history] });
    setMessage("SYNTHETIC_MANUAL_SAVE_CONFIRMED");
  };

  const onRefine = async (request: { scope: "selection" | "opening" | "whole_script"; mode: "focused_edit" | "editorial_rewrite" | "research_backed_rewrite"; instruction: string; selectionStart?: number; selectionEnd?: number; selectedText?: string }): Promise<boolean> => {
    const nextRequests = [...requestsRef.current, request];
    requestsRef.current = nextRequests;
    if (request.scope === "whole_script" || request.mode !== "focused_edit") {
      setMessage("UNSUPPORTED_REFINEMENT_ROUTE_REJECTED");
      return false;
    }
    const base = recordRef.current.script;
    const first = base.sections[0];
    const nextText = first.text + " Synthetic opening refinement verified in Chrome.";
    const nextScript: CreatorScript = {
      ...base,
      sections: [{ ...first, text: nextText }, ...base.sections.slice(1)],
      revision: base.revision + 1,
      updatedAt: now(),
      approval: null,
    };
    const nextProposal: CreatorScriptPendingRefinement = {
      proposalId: `sq-8h-${base.revision}-${nextRequests.length}`,
      baseRevision: base.revision,
      scope: request.scope,
      mode: request.mode,
      instruction: request.instruction,
      createdAt: now(),
      changes: [{ sectionId: first.id, sectionHeading: first.heading || first.kind,
        beforeText: first.text, afterText: nextText,
        ...(request.scope === "selection" ? {
          selectionStart: request.selectionStart,
          selectionEnd: request.selectionEnd,
        } : {}) }],
      proposedScript: nextScript,
    };
    proposal(nextProposal);
    setMessage("SYNTHETIC_REFINEMENT_PREVIEW_READY");
    return true;
  };
  const onDiscardRefinement = async (): Promise<boolean> => {
    if (!pendingRef.current) return false;
    proposal(null);
    setMessage("SYNTHETIC_REFINEMENT_DISCARDED");
    return true;
  };
  const onApplyRefinement = async (): Promise<boolean> => {
    const current = recordRef.current;
    const active = pendingRef.current;
    if (!active || active.baseRevision !== current.script.revision || !active.proposedScript) {
      setMessage("STALE_REFINEMENT_REJECTED");
      return false;
    }
    const history: CreatorScriptRevisionHistoryEntry = {
      id: `refine-${active.proposalId}`,
      fromRevision: current.script.revision,
      toRevision: active.proposedScript.revision,
      createdAt: now(),
      origin: active.scope === "selection" ? "ai_selection" : "ai_opening",
      instruction: active.instruction,
      changes: active.changes,
    };
    commit({ script: active.proposedScript, revisionHistory: [...current.revisionHistory, history] });
    proposal(null);
    setMessage("SYNTHETIC_REFINEMENT_APPLIED");
    return true;
  };
  return <section data-sq8h-real-component="true">
    <p data-sq8h-status="true" role="status">{message}</p>
    <CreatorScriptReview
      script={record.script}
      currentStrategyFingerprint={record.script.strategyFingerprint}
      language="en"
      busySectionId={null}
      buildingScenes={false}
      generatingScript={false}
      onSaveDocument={onSaveDocument}
      onRegenerateSection={() => {}}
      onReviewSources={async () => []}
      onRefine={onRefine}
      pendingRefinement={pendingRefinement}
      revisionHistory={record.revisionHistory}
      onApplyRefinement={onApplyRefinement}
      onDiscardRefinement={onDiscardRefinement}
      refinementHighlights={[]}
      onApproveAndBuildScenes={() => {}}
    />
  </section>;
}

/** Test host only. Real components/client/controller; synthetic auth/DB/providers. */
function WorkflowFixture() {
    const [review, setReview] = useState<CreatorBuildEditorialReview | null>(null);
    const [draft, setDraft] = useState<CreatorScript | null>(() => {
      try { return JSON.parse(localStorage.getItem("velto:8h:original-script") || "null") as CreatorScript | null; }
      catch { return null; }
    });
    const [status, setStatus] = useState("Synthetic nonproduction fixture. No live authentication or project access.");
    const [pending, setPending] = useState(false);
    const [resolve, setResolve] = useState<((d: CreatorEditorialReviewDecision | null) => void) | null>(null);
    const run = async () => {
        setPending(true);
        try {
            const config = await fetch('/fixture.json').then(r => r.json());
            const result = await runCreatorScriptBuildV2({ ...config, accessToken: 'synthetic', draftOnly: true, onEditorialReview: view => {
                    setReview(view);
                    return new Promise<CreatorEditorialReviewDecision | null>(res => setResolve(() => res));
                } });
            if (result.disposition !== "DRAFT_READY")
                throw Error("TEST_DRAFT_NOT_READY");
            localStorage.setItem("velto:8h:original-script", JSON.stringify(result.creatorScript));
            setDraft(result.creatorScript as CreatorScript);
            setStatus("DRAFT_READY — synthetic provider, no project installation");
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : "TEST_FAILED");
        }
        finally {
            setPending(false);
        }
    };
    return <main><h1>CreatorLab integrated workflow test</h1><p role="status">{status}</p>
  <button disabled={pending} onClick={run}>Review research and build test draft</button>
  {review && <CreatorCounterEvidenceReview key={review.reviewId} review={review.counterReview} editorialReview={review} onDecision={() => { resolve?.(null); setReview(null); }} onEditorialDecision={d => { resolve?.(d); setReview(null); }}/>}
  {draft && <CreatorScriptDraftPreview script={draft} onClose={() => setDraft(null)}/>}
  {draft && <ScriptQualityBrowserFixture initialScript={draft} />}
 </main>;
}
createRoot(document.getElementById('root')!).render(<WorkflowFixture />);
