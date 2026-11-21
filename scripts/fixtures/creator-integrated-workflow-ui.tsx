import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CreatorCounterEvidenceReview } from "../../components/create/CreatorCounterEvidenceReview";
import { CreatorScriptDraftPreview } from "../../components/create/CreatorScriptDraftPreview";
import { runCreatorScriptBuildV2 } from "../../lib/creator/creatorScriptBuildClient";
import type { CreatorBuildEditorialReview, CreatorEditorialReviewDecision } from "../../lib/creator/creatorScriptBuildEditorialReview";
import type { CreatorScript } from "../../lib/creator/creatorScript";
/** Test host only. Real components/client/controller; synthetic auth/DB/providers. */
function WorkflowFixture() {
    const [review, setReview] = useState<CreatorBuildEditorialReview | null>(null);
    const [draft, setDraft] = useState<CreatorScript | null>(null);
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
 </main>;
}
createRoot(document.getElementById('root')!).render(<WorkflowFixture />);
