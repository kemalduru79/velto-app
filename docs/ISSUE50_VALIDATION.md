# Candidate validation on private base bc30a72440cfbeaafa5c3aac283bdaa5efd70656

The seven-file local patch was applied onto this newer validated base rather than overwriting its historical/counterevidence protections. Five new files retain exact checkpoint hashes; existing files retain all base changes plus the minimal editorial patch. package.json/package-lock, original CI and scientific manifests/gates are unchanged.

Local macOS/Node24.14.1 observations, 2026-11-15:
- PASS: node --experimental-strip-types scripts/issue50-editorial-offline-test.mjs (67 assertions, three in-memory fixture revisions)
- PASS: node --experimental-strip-types scripts/issue50-provider-contract-test.mjs (23 assertions, closed stub transport, zero network attempts)
- PASS: node --experimental-strip-types scripts/creator-script-refinement-r2-research-backed-test.mjs
- FAIL: node --experimental-strip-types scripts/post-script-duration-workflow-authority-test.mjs
- PASS: node --experimental-strip-types scripts/stage-5d2c-v2-section-evidence-test.mjs
- PASS: node --experimental-strip-types scripts/stage-0-19e6j-section-native-generation-test.mjs
- PASS: node --experimental-strip-types scripts/stage-0-10h-2i-creator-editorial-orchestration-test.mjs
- FAIL: node --experimental-strip-types scripts/post-strategy-script-long-form-acceptance-test.mjs
- PASS: node node_modules/typescript/bin/tsc --noEmit --incremental false
- PASS: node node_modules/eslint/bin/eslint.js lib/creator/creatorEditorialNarrativeReview.ts lib/creator/creatorScript.ts lib/creator/creatorScriptEditorialRewriteProviders.server.ts
- PASS: git diff --check

## Unchanged legacy-test failures, no waiver
The unchanged base reproduces duration-test failure: it searches app/create/page.tsx for buildingScenes JSX already extracted into components/create/CreatorStrategyPanel.tsx. The long-form baseline first fails line210 on structural directive wording; the candidate corrects that and proceeds to a later source assertion expecting creatorScriptIsCurrent JSX in app/create/page.tsx, also extracted. No UI source, fixture or acceptance test was altered merely to satisfy these legacy source-location assertions. Full eight-program acceptance is therefore NOT claimed on this base: six PASS, two FAIL. The earlier local-base8/8 result is not transferred to this different commit.

The new additive workflow observes only the two new tests on native Ubuntu24.04/Node22. It neither replaces nor suppresses existing full Velto CI. Hosted outcomes must be read from exact-SHA runs; workflow definition is not proof of success.

No real generation/evidence authentication/owner editing-effort or audience acceptance is established by these fixtures. Draft review only; no merge or beta release recommendation. Scientific runtime/G0/production remain NO-GO.

## Corrective revision under owner comment6893527494

Both source-location failures are corrected without changing fixtures/UI behavior. The duration program retains the identical buildingScenes/generatingScript regexes and exact one-click count, now checking CreatorStrategyPanel.tsx; it additionally proves page import/render and state/handler prop forwarding. The long-form program retains the identical current-script condition and page strategy calculation, adding import/render and exact script/current-state wiring checks. No broad concatenated source or fallback lookup is accepted.

All eight requested programs now PASS locally; TypeScript/scoped ESLint/diff-check PASS. Baseline failures and initial-hosted evidence above remain historical facts, not deleted. The full candidate job now runs all8 plus typecheck, changed-line lint, full critical regressions, build and CI contract independently for evidence; original main CI and scientific gates remain unchanged. Native results must be read for the new exact SHA; no success inferred here.

The inactive docs/admission/issue50-editorial-v1.proposal.json pins exact original policy and proposed subject hashes. It grants no authority and is not read by existing gates. Main CI must still reject changed creatorScript.ts until a separately reviewed/accepted activation is authorized. No automatic pin refresh, wildcard or scientific waiver.

The one480-second run card is PREPARED_NOT_AUTHORIZED: five requests/$1.65, no retries/repair/search/media/DB writes. Existing offline transport/readiness tests pass, but explicitly report LIVE_PROVIDER_ACCESS=DENIED, token calibration UNVERIFIED and zero external calls. No real transport/accounting/source corpus assurance or owner funding approval is invented.

Full critical-suite correction: preserve the legacy “do not spend the conclusion” instruction while keeping the new plain closing-question wording. The existing semantic-progression test is unchanged. Admission v1 remains immutable historical proposal; v2 supersedes it with a new explicit source digest, still PROPOSED_NOT_ADMITTED. Full-history checkout is required for unchanged historical Git fixtures, matching original CI; no test is skipped.
