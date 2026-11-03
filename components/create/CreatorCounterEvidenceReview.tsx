"use client";

import { useEffect, useRef, useState } from "react";
import type { CounterEvidenceScopeDecision, createCounterEvidenceReview } from "@/lib/research/scriptPlannerEditorialContext";

type Review = ReturnType<typeof createCounterEvidenceReview>;

/** No default approval, requests, state installation or project persistence. */
export function CreatorCounterEvidenceReview({ review, onDecision }: {
  review: Review;
  onDecision: (decision: CounterEvidenceScopeDecision | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [rationale, setRationale] = useState("");
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { element?.close(); };
  }, []);
  const canContinue = review.unresolvedClaimIds.every((id) => excluded.includes(id))
    && rationale.trim().length >= 12;
  return (
    <dialog ref={dialog} aria-labelledby="counter-review-title" aria-describedby="counter-review-explanation"
      onCancel={() => onDecision(null)} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/40">
      <h2 id="counter-review-title" className="text-xl font-semibold">Review evidence before writing</h2>
      <p id="counter-review-explanation" className="my-3">These assertions need material counter-evidence. Read the exact passages below. A limitation or alternative explanation is context, not proof of a contradiction. Imagined 2055/2075 scenarios remain hypothetical; this review never changes a prediction into a thought experiment.</p>
      <p className="my-3">Conceptual uncertainty and rhetorical disagreement are not empirical counter-findings. A scoped limitation bounds a result; a material counter-finding challenges the same assertion under relevant conditions. Stop if a passage does not justify its editorial stance label.</p>
      <p className="my-3">No qualifying opposing passage was linked for the unresolved claims in this research snapshot. You can explicitly omit those assertions from this script, or stop and obtain qualifying sources. The original research, classifications, passages and stances are preserved. This is a script-scope decision, not scientific approval.</p>
      {review.claims.map((claim) => (
        <fieldset key={claim.claimId} className="my-4 rounded border border-slate-300 p-4">
          <legend className="px-1 font-semibold">{claim.claimId} · {claim.claimType}</legend>
          <p>{claim.text}</p>
          <p className="my-2 font-medium">{claim.outcome === "counterevidence_present" ? "An opposing passage is linked. Inspect its relevance and preserve support and opposition." : claim.outcome === "context_only_not_counterevidence" ? "Documented context is present; the counter-evidence requirement remains unresolved." : "No counter-evidence in this snapshot. This does not establish that none exists."}</p>
          {([ ["Supporting passages", claim.support], ["Opposing passages", claim.counter], ["Context and limitations (not contradictions)", claim.contextual] ] as const).map(([label, passages]) => (
            <section key={label} className="my-2">
              <h3 className="font-medium">{label}</h3>
              {passages.length ? passages.map((passage) => (
                <div key={passage.evidenceId} className="my-2 border-l-2 border-slate-200 pl-3">
                  <blockquote>{passage.excerpt}</blockquote>
                  <p className="text-sm">{passage.evidenceId} · {passage.source.title} · {passage.source.directness}</p>
                  <a className="text-sm underline" href={/^https?:\/\//i.test(passage.source.url) ? passage.source.url : undefined} target="_blank" rel="noopener noreferrer">Inspect source in a new tab</a>
                </div>
              )) : <p className="text-sm">No linked passage.</p>}
            </section>
          ))}
          {review.unresolvedClaimIds.includes(claim.claimId) && (
            claim.canExclude ? <label className="mt-3 flex gap-2">
              <input type="checkbox" checked={excluded.includes(claim.claimId)} onChange={(event) => setExcluded((values) => event.target.checked ? [...values, claim.claimId] : values.filter((id) => id !== claim.claimId))} />
              Omit this unresolved assertion from this script; preserve it in the research snapshot.
            </label> : <p role="alert">This claim has a mandatory primary-source obligation. It cannot be excluded through counter-evidence review. Stop and resolve its primary/counter-evidence requirements.</p>
          )}
        </fieldset>
      ))}
      <label className="block">Reason for changing this script&apos;s scope
        <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded border border-slate-300 p-2" />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => onDecision(null)} className="rounded border px-4 py-2">Stop — research unresolved claims</button>
        <button type="button" disabled={!canContinue} onClick={() => onDecision({ snapshotFingerprint: review.snapshotFingerprint, excludedClaimIds: excluded, rationale: rationale.trim(), confirmed: true })} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40">Continue without selected unresolved assertions</button>
      </div>
      <p className="mt-3 text-sm">Continuing reruns the evidence and section gates. It may remain blocked if the retained evidence cannot support the requested script. No passages, primary qualifications or scientific checks are waived.</p>
    </dialog>
  );
}
