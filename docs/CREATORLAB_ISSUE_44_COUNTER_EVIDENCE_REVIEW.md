# Issue #44: completeable counter-evidence review

Base: `d44ab5d8b713d14e57408f026487a6dc13eec015` (owner-verified production). All implementation occurred in an isolated worktree. No production services, browser tabs, databases, projects or media were accessed or changed.

## Verified cause and evidence limits

The excerpt repair is intact. A synthetic reconstruction reproduces the supplied production signature: four claims, seven nonempty excerpts, no missing excerpt IDs, nine globally secondary sources, and only MATERIAL_COUNTER_EVIDENCE_REVIEW blocking generation. A document-relative primary obligation can also be covered with zero globally primary evidence records.

`topicEvidenceReadiness.ts` recommends counter-evidence for THEORY, FORECAST, HYPOTHESIS, METAPHYSICAL_CLAIM and EDITORIAL_INFERENCE. It requires a contradicts link; a contextualizes link does not establish opposition. This policy did not have a user-completable client branch. `creatorEditorialPipeline.client.ts` handled primary acquisition but passed counter-review directly into the deliberately closed script gate. A legacy page adapter also replaced the actionable error with a generic retry instruction. Repeating generation repeated research rather than resolving the editorial decision.

`npm run test:issue-44-counter-review -- --baseline` loads the exact production client and source-assessment functions using synthetic fixtures. The client never invokes a supplied review callback, posts the blocked graph, and dispatches no script provider. It also reproduces a separate qualification defect: a secondary report matching the referenced work's title/URL could qualify as an original research result.

The original private four-claim production graph was not supplied. The fixture is a diagnostic reconstruction, not a claim that the actual four texts/types or claim-4 provenance have been recovered. Whether that particular coverage was legitimate attribution or an original-study misqualification cannot be decided from counts alone.

## Scientific policy boundaries

| Material | Meaning | Outcome |
| --- | --- | --- |
| Genuine contradictory finding | Existing source-owned opposing passage with a contradicts link | Preserve the finding and stance, including its conflict with support; existing script/scientific gates still apply |
| Documented limitation / alternative context | Linked contextualizes passage | Display explicitly as context; it does not discharge a contradictory-evidence obligation |
| Unsupported forecast/theory | Missing qualifying opposition in this snapshot | Owner may explicitly omit the assertion from this script, or stop and acquire qualifying research |
| Imagined 2055/2075 scenario | Already classified THOUGHT_EXPERIMENT | No mandatory counter-research; preserve hypothetical wording and grounded factual premises |
| Actual prediction mislabeled to evade review | Classification or text changed while applying a decision | Reject the altered projection; do not convert a forecast automatically |
| Claim about an exact document/author statement | Claim-relative identity, not general study authority | Report qualifying evidence and basis without upgrading global source directness |
| Original research result reported secondhand | Matching secondary title/URL alone | Primary coverage remains missing; verified original-source qualification is required |

No new scientific approval or limitations waiver is introduced. This patch deliberately does not manufacture contradicts links or automatically classify newly retrieved passages as counter-findings. Existing research already attempts a counter-evidence lane. The new bounded reassessment inspects that unchanged corpus once per interactive review; no additional provider call or automatic retry is made. If the owner wishes to retain an unresolved assertion, the final blocked outcome names the claim and requires qualifying source acquisition/editorial analysis. Automatic targeted retrieval/adjudication remains outside this patch because new semantic opposition must not be inferred merely from a query or a limitation. This limitation is visible rather than hidden behind Generate again.

## Review and recovery lifecycle

1. Normal editorial analysis and existing primary acquisition run unchanged, except original-study qualification is stricter.
2. The client computes a claim-targeted review from the normalized context. It shows exact support, opposing and contextual passages, source identities, classification and unresolved claim IDs.
3. The native modal has no prechecked decisions. The owner must select each omitted unresolved assertion and enter a reason. Escape/Stop returns a precise final blocked outcome without installing a script. Mandatory-primary claims cannot be omitted through this counter-review path.
4. An accepted decision changes only script scope. The original normalized context **and complete canonical research graph**, plus the initial pre-primary-acquisition graph, remain in `counterEvidenceReview`, including source metadata, IDs, all claim texts/types/origins, excerpts, locators and link stances.
5. The server normalizer rederives the exact projection, compares full records, checks source classifications and exact excerpt ownership against the original summaries, and rejects altered or nested snapshots. A stale-view fingerprint is not an authorization token. Existing server session, owner lookup, strategy authority and expected-project-revision checks remain authoritative.
6. Readiness is recomputed over retained claims. Only the satisfied counter-review reason can disappear; every remaining review/primary/provenance/scientific requirement remains. Empty factual scope remains blocked. Preserved review payloads are capped at two million UTF-8 bytes.
7. The same narration-facing evidence and six-section plan flow into readiness and actual generation. Original/excluded research is retained backstage and removed from provider prompts and narration authority. Shared evidence still needed by a retained claim is preserved.
8. Project/strategy changes cancel pending UI review; generation changes are checked again before accepting a decision. Cancellation, stale/partial decisions and invalid ownership cause no model dispatch. No approved scientific truth is inferred from an owner's scope choice.

Round-trip testing exposed a normalization defect: Number(null) produced a fabricated zero-second locator on a second normalization. Null timecodes now remain null; real zero values remain valid. Existing persisted numeric locators remain unchanged.

## Changed files

Runtime:
- `lib/research/scriptPlannerEditorialContext.ts`: targeted review, protected scope derivation/provenance, truthful primary diagnostics and locator idempotence.
- `lib/research/creatorEditorialPipeline.client.ts`: one explicit review pause, actionable cancellation/failure, stale-operation guard and reviewed handoff.
- `lib/research/sourceAssessment.ts`: secondary report identity cannot establish original-study authority; document/statement-relative authority remains supported.
- `lib/creator/creatorScript.ts`: exclude scope provenance and unused omitted evidence from narration projection.
- `app/api/creator-script-plan/route.ts`: expose unresolved claim IDs with blocked next actions.
- `app/create/page.tsx`: wire both existing pipeline entry points, cancel stale dialogs, preserve actionable errors.
- `components/create/CreatorCounterEvidenceReview.tsx`: accessible native dialog, exact passages, explicit unchecked scope choices and Stop.

Tests/report:
- `scripts/creator-issue-44-counter-review-test.mjs`
- `scripts/fixtures/creator-issue-44-evidence.mjs`
- `scripts/fixtures/creator-script-plan-offline-harness.mjs` (real authority helper with synthetic read-only owner repository)
- `scripts/stage-0-10h-2h-script-planner-editorial-context-test.mjs` (additive diagnostics)
- `scripts/stage-0-10h-2i-creator-editorial-orchestration-test.mjs` (explicit review callback wiring)
- `scripts/stage-0-19-proposition-kind-refinement-test.mjs` (strengthen the formerly illustrated secondary-study loophole expectation)
- `scripts/stage-0-8a-critical-regression.mjs` and `package.json` (register regression)
- This report.

## Verification and limitations

The focused regression covers all-excerpts-present blocking, multiple unresolved claims, true counter-findings, limitations, no opposition in the corpus, explicit futures, false reclassification, primary/document-relative distinctions, missing original snapshots, excerpt ownership, stale/partial/unconfirmed decisions, unchanged original records, no factual basis, all six real section dispatches, dialog default/cancel controls, owner-scoped lookup and stale CAS rejection. The original Issue #42 regression remains registered and passing.

The route harness uses actual route operation/pure dependencies and actual client pipeline, with deterministic provider responses, synthetic auth/owner reads and no database/provider/media operations. It does not prove authenticated browser production, source truth, accepted final prose or a successful saved live project. The repeated synthetic prose intentionally remains subject to existing final acceptance. The dialog is rendered offline; native browser focus/keyboard interaction still requires a fresh-session release canary. Review copy is currently English. This targets the incident's deployed `/api/creator-script-plan` pipeline and both of its UI entry points; the separately feature-flagged durable build workflow is not migrated to the new dialog.

The critical runner has two independently verified production-baseline failures: stage-0-8g frozen export-service checksum and stage-0-10h-5g stale publish-route source regex. Neither renderer nor publish route is changed. Run the remaining critical scripts independently after the first stop; do not weaken either unrelated contract merely to make CI green. Final counts and actual CI status are recorded in the draft PR.

## Release plan

Review against the exact production SHA; retain draft status until the code and baseline CI failures are triaged. After separate owner authorization, deploy the complete reviewed Next.js app/API build together. There are no database migrations, new credentials, worker/export-service changes or media operations. Use a fresh session and a disposable synthetic project for an explicitly authorized canary: inspect passages, Stop, stale-project cancellation, explicit scope selection, retained hypothetical futures, six-section continuity and truthful primary diagnostics. Ensure final prose passes existing factual/semantic gates before any normal production acceptance claim.

Do not refresh stale historical tabs or install reconstructed claims in existing projects. Release and canary were not performed. On failure, halt new generation; restore the known deployment operationally while retaining review blocks, not a forced-ready fallback. Scope omissions are reversible by starting a fresh editorial workflow from the retained original snapshot and supplying qualifying research; do not reinterpret the stored scope decision as scientific approval.
