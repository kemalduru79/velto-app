"use client";

import { useState } from "react";
import { CreatorSourceAuthorityReview } from "@/components/create/CreatorSourceAuthorityReview";
import type { ParentSourceReview } from "@/lib/research/creatorEditorialPipeline.client";

/** Reviewer signs in independently; the server enforces the reviewer allowlist. */
export default function SourceAuthorityReviewerPage() {
  const [ownerId, setOwnerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [snapshotDigest, setSnapshotDigest] = useState("");
  const [revision, setRevision] = useState("");
  const [claimId, setClaimId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [stage, setStage] = useState<'parent'|'child'>('parent');
  const [pending, setPending] = useState<(ParentSourceReview & {ownerId:string}) | null>(null);
  return <main className="p-6"><h1>Authorized source reviewer</h1><p>Sign in as an authorized reviewer and enter the exact review identity supplied by the project owner. The server checks authorization and active snapshot ownership.</p>
    <label>Owner ID <input value={ownerId} onChange={e=>setOwnerId(e.target.value)} /></label>
    <label>Project ID <input value={projectId} onChange={e=>setProjectId(e.target.value)} /></label>
    <label>Snapshot digest <input value={snapshotDigest} onChange={e=>setSnapshotDigest(e.target.value)} /></label>
    <label>Research revision <input value={revision} onChange={e=>setRevision(e.target.value)} /></label>
    <label>Claim ID <input value={claimId} onChange={e=>setClaimId(e.target.value)} /></label>
    <label>Evidence ID <input value={evidenceId} onChange={e=>setEvidenceId(e.target.value)} /></label>
    <label>Source ID <input value={sourceId} onChange={e=>setSourceId(e.target.value)} /></label>
    <label>Stage <select value={stage} onChange={e=>setStage(e.target.value === 'child' ? 'child' : 'parent')}><option value="parent">Parent</option><option value="child">Child</option></select></label>
    <button type="button" disabled={!ownerId || !projectId || !/^[0-9a-f]{64}$/.test(snapshotDigest) || !Number.isSafeInteger(Number(revision)) || Number(revision)<1 || !claimId || !evidenceId || !sourceId} onClick={()=>setPending({stage,ownerId,projectId,snapshotDigest,researchRevision:Number(revision),requirements:[{claimId,evidenceId,sourceId}]})}>Open reviewer inspection</button>
    {pending && <CreatorSourceAuthorityReview pending={pending} onCancel={()=>setPending(null)} onContinue={()=>setPending(null)} />}
  </main>;
}
