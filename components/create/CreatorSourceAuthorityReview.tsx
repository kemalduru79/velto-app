"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ParentSourceReview } from "@/lib/research/creatorEditorialPipeline.client";

type Pending = ParentSourceReview & { ownerId: string };
type Inspection = { documentDigest: string; sourceUrl: string; documentContent: string; passage: string; claimText: string };

async function authenticatedRequest(url: string, body: object) {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Authentication required.");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.status === "STALE_RESEARCH" ? "Research Changed — Restart Required" : "Request rejected. Authorized reviewer verification may be required.");
  return result;
}

export function useCreatorSourceAuthorityReview() {
  const [pending, setPending] = useState<Pending | null>(null);
  const resolver = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const generation = useRef(0);
  const cancel = useCallback(() => { generation.current++; const active = resolver.current; resolver.current = null; setPending(null); active?.reject(new Error("Source review canceled.")); }, []);
  useEffect(() => () => { generation.current++; const active = resolver.current; resolver.current = null; active?.reject(new Error("Source review canceled.")); }, []);
  const begin = useCallback(() => { cancel(); }, [cancel]);
  const request = useCallback(async (review: ParentSourceReview) => {
    const current = generation.current;
    const { data, error } = await supabase.auth.getUser();
    if (current !== generation.current) throw new Error("Source review canceled.");
    if (error || !data.user) throw new Error("Authentication required.");
    return new Promise<void>((resolve, reject) => { resolver.current = { resolve, reject }; setPending({ ...review, ownerId: data.user.id }); });
  }, []);
  const complete = useCallback(() => { const active = resolver.current; resolver.current = null; setPending(null); active?.resolve(); }, []);
  return { pending, begin, request, cancel, complete };
}

export function CreatorSourceAuthorityReview({ pending, onCancel, onContinue }: { pending: Pending; onCancel: () => void; onContinue: () => void }) {
  const [status, setStatus] = useState("Review Required");
  const [selected, setSelected] = useState(0);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [classification, setClassification] = useState("unknown");
  const [authorship, setAuthorship] = useState(false);
  const [basis, setBasis] = useState("");
  const [disposition, setDisposition] = useState("insufficient_or_ambiguous_support");
  const [confirmed, setConfirmed] = useState(false);
  const inspectionGeneration = useRef(0);
  const pair = pending.requirements[selected];
  const recheck = async () => {
    try {
      const result = await authenticatedRequest("/api/creator-evidence-evaluation", { operation: "review_status", projectId: pending.projectId, snapshotDigest: pending.snapshotDigest });
      if (result.projectId !== pending.projectId || result.snapshotDigest !== pending.snapshotDigest || result.researchRevision !== pending.researchRevision || result.status === "STALE_RESEARCH") { setStatus("Research Changed — Restart Required"); return; }
      if (result.status === "AUTHORITY_INVALID") { setStatus("Invalid Authority — Blocked"); return; }
      if (result.status === "REVIEW_COMPLETE") { setStatus("Review Complete — Continue"); return; }
      setStatus(result.status === "REVIEW_REQUIRED" ? "Awaiting Authorized Reviewer" : "Invalid Authority — Blocked");
    } catch (error) { setStatus(error instanceof Error && error.message.startsWith("Research Changed") ? error.message : "Invalid Authority — Blocked"); }
  };
  const inspect = async () => {
    setInspection(null); setConfirmed(false);
    const generation = ++inspectionGeneration.current;
    try { const result = await authenticatedRequest("/api/creator-source-authority", { operation: "inspect", ownerId: pending.ownerId, projectId: pending.projectId, snapshotDigest: pending.snapshotDigest, claimId: pair.claimId, evidenceId: pair.evidenceId }); if (generation !== inspectionGeneration.current) return; setInspection(result); setStatus("Awaiting Authorized Reviewer"); }
    catch { if (generation === inspectionGeneration.current) setStatus("Reviewer authorization or source inspection failed."); }
  };
  const issue = async () => {
    if (!inspection || !confirmed || basis.trim().length < 12) return;
    try {
      await authenticatedRequest("/api/creator-source-authority", { operation: "issue", ownerId: pending.ownerId, projectId: pending.projectId, snapshotDigest: pending.snapshotDigest, claimId: pair.claimId, evidenceId: pair.evidenceId, expiresAt: new Date(Date.now() + 86400000).toISOString(), decision: { publisherAuthoredDocument: authorship, classification, basis: basis.trim(), documentDigest: inspection.documentDigest, disposition, dispositionRationale: basis.trim() } });
      setInspection(null); setConfirmed(false); setStatus("Awaiting Authorized Reviewer");
    } catch { setStatus("Reviewer decision was rejected; authority remains blocked."); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="source-review-title" className="fixed inset-0 z-50 overflow-auto bg-black/50 p-6"><section className="mx-auto max-w-3xl rounded bg-white p-6 text-slate-900">
    <h2 id="source-review-title">{pending.stage} source authority review</h2><p role="status">{status}</p>
    <p>Review is required before generation can continue. Project ownership does not grant reviewer privileges.</p>
    <p>Project: {pending.projectId} · Revision: {pending.researchRevision}</p><p>Snapshot: {pending.snapshotDigest}</p><p>Owner: {pending.ownerId}</p>
    {pair && <><label>Claim and evidence <select value={selected} onChange={event=>{inspectionGeneration.current++;setSelected(Number(event.target.value));setInspection(null);setConfirmed(false);}}>{pending.requirements.map((item,index)=><option key={`${item.claimId}:${item.evidenceId}`} value={index}>{item.claimId} / {item.evidenceId} / {item.sourceId}</option>)}</select></label>
      <button type="button" onClick={inspect}>Inspect as authorized reviewer</button></>}
    {inspection && <section><p>Source: {inspection.sourceUrl}</p><p>Claim: {inspection.claimText}</p><p>Passage: {inspection.passage}</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap">{inspection.documentContent}</pre>
      <label>Classification <select value={classification} onChange={event=>setClassification(event.target.value)}><option value="unknown">Unknown</option><option value="secondary">Secondary</option><option value="primary_document">Primary document for this claim</option><option value="original_research">Original research for this claim</option></select></label>
      <label>Claim disposition <select value={disposition} onChange={event=>setDisposition(event.target.value)}><option value="insufficient_or_ambiguous_support">Insufficient or ambiguous support</option><option value="documented_methodological_limitation">Source-documented methodological limitation</option><option value="independent_editorial_inference">Independent editorial inference</option></select></label>
      <label><input type="checkbox" checked={authorship} onChange={event=>setAuthorship(event.target.checked)} /> Publisher or researcher authored this document</label>
      <label>Review basis <textarea value={basis} onChange={event=>setBasis(event.target.value)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} /> I reviewed the document and this claim-specific passage.</label>
      <button type="button" disabled={!confirmed || basis.trim().length < 12} onClick={issue}>Issue explicit reviewer decision</button></section>}
    <div><button type="button" onClick={recheck}>Recheck verification</button><button type="button" disabled={status !== "Review Complete — Continue"} onClick={onContinue}>Continue</button><button type="button" onClick={onCancel}>Cancel Review</button></div>
  </section></div>;
}
