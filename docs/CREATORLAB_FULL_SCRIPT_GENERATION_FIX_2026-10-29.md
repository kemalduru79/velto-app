# Full Script Generation investigation and fix — 2026-10-29

## Root cause and evidence

The running CreatorLab is `next dev --port 3000` (Next server PID 3746), with working directory `/Users/duruhome/velto-app`. Its branch is `agent/creatorlab-stage5e1f-scientific-review-mvp`, HEAD `2ffcf729841d71ce54ed9009c60d197fab01cd40`. Process command lines and `lsof` confirmed this; GitHub main was not used as a substitute. The Scientific Review worktree was neither modified nor used for implementation.

At entry, `lib/creator/scientificReview/index.ts` and `scripts/stage-0-8a-critical-regression.mjs` were modified, with untracked R4/SciPy files under `docs`, `lib/creator/scientificReview`, and `scripts/scientific-review`. Those changes were preserved. This fix adds three suite entries to the existing critical runner while retaining its R4 additions. No reset, clean, stash, commit, push, merge, deployment, or database mutation was performed.

Read-only queries against the Supabase project configured by this checkout found the exact failed build: `a5328e79-3737-443d-bc66-80c4f6c09b2f`, created 2026-10-28 20:33:21 UTC, failed 20:33:55 UTC (23:33 in Istanbul).

- Last completed checkpoint: `research`.
- First failed checkpoint: `editorial`.
- Failed logical operation: first `creator_script_build_claim_origin_adjudication`, represented durably by `creator_editorial_adjudication_attempt`.
- Failure category: `MODEL_CONTRACT`.
- Failure code: `CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID`.
- Retryability: `NON_RETRYABLE` under the old policy.
- Rejection: `EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:proposal-item-2:initialKind=original_research_result:adjudicatedKind=original_research_result:kindMatches=true:originMatches=false`.

Sanitized SQL comparisons of all six claims established that items 2 and 3 retained their original proposition kind and exact referenced work, but changed a non-null attributed entity to null. The other four claims matched. No private claim text, research passages, entity names, credentials, or script content was needed in diagnostic output.

This was a legitimate rejection of changed attribution, not a false positive on valid matching authority. `reconcileClaimPropositionAuthorities` correctly rejects the deattribution. The reliability gap was in `recoverCreatorScriptBuildEditorialAdjudication`: only world-state ambiguity qualified for the existing one-time corrective attempt. The provider prompt asked for origin adjudication without explaining the same-kind research attribution preservation rule. The omitted entity therefore caused an immediate terminal failure.

The proposal and adjudication child operations settled as `COMPLETED`; the latter contains a rejected domain outcome, not accepted authority. No evidence points to a provider transport failure, model unavailability, token truncation, section budget, concurrency failure, or persistence failure for this attempt. Script generation was never reached, so changing OPENAI_SCRIPT_MODEL would not address this incident.

## HTTP status and execution path

The initiating execution path is `app/create/page.tsx` → `creatorScriptBuildClient.ts` → POST `/api/creator-script-build` with `action: start`, then `action: advance`. Start validates the owner/project revision and creates an immutable, versioned snapshot; advance runs the research/editorial coordinator. Runtime catches a stage exception after durable failure and projects the terminal build state. `terminalStatus` in `creatorScriptBuildApi.server.ts` maps `FAILED` to HTTP 422 with `BUILD_FAILED`. The frontend previously collapsed its available bounded failure code into that generic message.

The 422 mapping is confirmed by active code and passing runtime/API tests. The original historical HTTP exchange was not retained in the available local log, so its wire status was not independently observed. No new generation was launched to recreate it.

Downstream stages remain: authority resolution → five-section generation → repair → acceptance → atomic persistence. Existing tests exercise missing sections, rejected output, partial recovery, checkpoints, stale revisions, and saved-script protection. None of these downstream operations existed for the failed real build. No duration cap, model setting, token limit, output parser, repair rule, acceptance rule, or persistence guard was changed.

## Fix

- `lib/creator/creatorScriptBuildProviders.server.ts`: explain that a same-kind research result retaining its work must preserve the supplied entity; unsupported attribution must remain ambiguous and fail closed. Give a precise correction instruction on the existing second attempt.
- `lib/creator/creatorScriptBuildProviderContract.ts`: permit the existing single corrective attempt only when every rejected claim matches the observed same-kind, same-work entity omission. Validate original authority, preserve primary-source obligations, reject substitutions/changed works/malformed structures, and recheck eligibility on replay. The omitted-entity answer is never accepted. The second answer still passes the unchanged reconciler; repeated failure terminates the build.
- `lib/creator/creatorScriptBuildEditorialAdjudicationRecovery.ts`: policy v3 identifies new operation semantics.
- `lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts` and `creatorScriptBuildSnapshot.server.ts`: coordinator contract A3 gives new requests a new snapshot/idempotency identity. Historical A1/A2 failures are not revived or reinterpreted.
- `app/create/page.tsx` and `lib/creator/creatorScriptBuildClient.ts`: map only the known attribution failure to safe English/Turkish recovery text, without exposing raw diagnostics.
- Regression suites: editorial recovery, proposition refinement, client cutover, and version fixtures in coordinator/authority/generation/acceptance/persistence test support. Fix the existing editorial test harness to supply imported narration contracts. Add the focused suites to the critical runner.

The correction may incur one additional editorial model call during a future authorized build only when this narrow recoverable omission occurs. It adds no third attempt and no automatic retry of an uncertain provider outcome.

## Data safety

Read-only database checks established:

- The current saved script is JSON-equal to the script in the last successfully persisted build (`530038b8-821b-4456-b7cc-7a6373cbfb8c`, October 21).
- The current project `updated_at` equals the failed build's expected project revision: `2026-10-28 20:33:19.775847+00`.
- Saved project state and script are present. The saved revision-history array contains zero entries; no deletion or backfill was attempted.
- The failed build has zero downstream generation/repair/acceptance/persistence operations and no persistence checkpoint.
- The current project has zero scenes. No scene or other project record was written or deleted during this investigation.

These checks demonstrate that the failed attempt did not overwrite the saved script or change the project revision. They do not claim recovery of history that was not present.

## Validation

All provider executions in regression tests were synthetic/offline. No paid OpenAI, search, media, voice, or video calls were initiated.

Passed commands:

- `node --experimental-strip-types scripts/stage-0-19-editorial-adjudication-recovery-test.mjs` — 27 tests, including exact omission shape, repeated omission, substitutions, changed/missing work, resumed correction, uncertainty, and existing abstention recovery. Also passed under plain `node`, as invoked by the critical runner.
- `node --experimental-strip-types scripts/stage-0-19-proposition-kind-refinement-test.mjs` — 23 tests, including two omitted entities in one batch, unchanged prose/evidence, unrelated disagreement refusal, primary authority safeguards, and old-contract rejection.
- `node --experimental-strip-types scripts/stage-0-19e5b-creator-script-build-client-cutover-test.mjs` — passed, including safe localized attribution failure messages.
- `node --experimental-strip-types scripts/stage-0-19e1-creator-script-build-foundation-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e2a-research-editorial-coordinator-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e2b-authority-coordinator-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e3a-script-generation-coordinator-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e3b-script-repair-coordinator-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e3c-acceptance-coordinator-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e4-creator-script-build-persistence-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19e5a-creator-script-build-runtime-api-test.mjs`.
- `npm run test:r2-safety-autosave-cas` equivalent direct Node command.
- `npm run test:r2-safety-script-loss` equivalent direct Node command.
- `npm run test:creator-refinement-r2` equivalent direct Node command.
- `npm run typecheck` (including a final rerun).
- `git diff --check`.
- Production webpack build in `/private/tmp/velto-script-build-validation`, with the source checkout's `node_modules` linked and only NEXT_PUBLIC configuration passed to the build process. Compilation, TypeScript, prerendering, and build completion passed. The first attempt without public Supabase configuration stopped at prerendering `/create`; the configured rerun exited 0. Native SWC was unavailable, so Next used its installed WASM fallback. The running app's `.next` directory was not used for this build.

`npm run test:ci-critical` stopped at `stage-0-8g-architecture-closure-test.mjs` because it requires a clean Git tree. All subsequent entries were then executed individually with the same offline intent: of the 107 original entries, 103 passed and four failed their clean-tree assertions. The other three were `stage-0-10i-b-visual-system-test.mjs`, `stage-0-10i-f-visual-consolidation-test.mjs`, and `stage-0-11e-azure-readiness-gate-test.mjs`. Their diffs include the pre-existing R4 files as well as this fix. The three focused suites subsequently added to the runner passed independently. The clean-tree assertions were not weakened or bypassed in source.

Lint: `NODE_OPTIONS=--max-old-space-size=8192 npm run lint:changed` passed with `NO_NEW_LINT_DEBT=PASS`. Full `npm run lint` and the initial focused ESLint invocation exhausted the default approximately 2 GB Node heap. A full-lint retry with an 8 GB heap traversed unrelated `.velto-*` backup trees and was explicitly terminated after several minutes; it did not produce a passing full-lint result. No lint rules or ignore settings were changed. The repository's changed-line check completed successfully.

## Production readiness

The confirmed failure path is corrected locally and covered by offline regressions. Historical failed records remain unchanged. A successful fresh live Thynel generation is still unverified and must not be represented as provider acceptance.

Shortest safe next step: refresh the existing local CreatorLab, review the preserved script/research, and explicitly request a fresh full-script build. The A3 contract gives that request a fresh identity rather than resuming the A2 failure. The same existing authority/acceptance/CAS boundary must pass before replacement of the saved script. If correction cannot verify attribution, the build will stop with the specific safe attribution explanation.

No commit, push, merge, or deployment has been made. No live paid acceptance call has been executed; a separately requested agent-run live test requires cost scope and approval first.
