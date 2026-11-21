# CreatorLab autosave incident — 2026-10-30

## Result

The failure mechanism is understood and reproduced with synthetic data. The code correction prevents future final-video installations from dropping canonical project state, passes a validated revision handoff back to the editor, and gives actionable, sanitized save errors. The already-affected live project has NOT been repaired or written. Keep its existing editor tab open; a refresh is not yet safe for retaining its current script/timeline state.

## Root cause

The durable final-export worker constructed a movie-only object in `app/api/internal/jobs/[jobId]/creator-final-export/route.ts` and passed it as `p_exported_movie_result` to `velto_install_creator_final_export`. The deployed RPC replaces the entire `velto_projects.exported_movie_result` JSON object. That object also holds `creatorProjectState`, including the finalized script, revisions, timeline and editor state.

The completed live run `6aa36ab9-33cd-4063-a6d6-e79d5e9c3417` has installed output. The current project's envelope contains only the worker's nine movie fields and no `creatorProjectState`. A read-only inspection of the deployed function confirmed the direct replacement assignment; this is not inferred solely from the local migration file.

After installation, the still-open editor retains its non-null script. The pre-fix `/api/save-project` reads the now-absent canonical script as null, then calls `resolveCreatorScriptMutationAuthority`. Without an explicit script mutation command, that guard rejects the editor's script with `CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED`, HTTP 409, before reaching the project CAS write. This guard is correct and remains enabled. It prevents treating a local snapshot as replacement authority after canonical state loss.

The client previously threw `new Error(data.error)` and discarded HTTP status and structured code. The message `Script changes require an explicit mutation operation.` does not match its old classifiers, so it logged `persistence_failure`, with the DevTools overlay also presenting an opaque `{}`.

There is a second demonstrated defect in the same completion path: final installation advances the project revision, but neither active export polling nor resumed polling advances the editor's CAS token. Simply retaining the canonical state would therefore leave the next legitimate autosave vulnerable to a stale-revision conflict. The run's recorded installation timestamp (`20:43:36.445134 UTC`) also differs from the actual stored project's timestamp (`20:43:36.412234 UTC`), so the RPC's clock timestamp cannot be blindly used as the next CAS token.

This is a persistence/installation problem, not a rendering failure. No provider generation, rendering or export was triggered by this investigation.

## Evidence and limits

Read-only queries for project `71af9d00-fe61-4eb8-b705-575f6330560d` found:

- Canonical Creator state absent from the current movie envelope.
- 36 saved scenes, each with an image and narration-audio reference.
- Media-reference rows: 36 scene images, 36 narration audio, 37 asset-history references, one scene video and one final video.
- The final-video asset is active, belongs to the same owner, and has matching project metadata.
- The current project revision is `2026-10-29 20:43:36.412234+00`, unchanged between the first and final investigation checks.
- The export manifest retains an audio timeline.
- The saved scenes use script revision 2. Four historical persisted build records retain revision 1; these are not safe substitutes for the finalized revision 2 script.
- No production-history snapshot exists for this project.

The original historical HTTP response body/status was not available in the local browser log. Chrome inspection was not approved and was not retried. The exact rejection mechanism and HTTP 409 response path were instead reproduced using the actual script-authority validator and actual save handler with synthetic fixtures. Live Supabase logs show project reads around the incident; this investigation made only SELECT/log queries, never production POST/PATCH/RPC mutations.

No automatic restoration from old build metadata was attempted.

## Files changed in this task

1. `app/api/internal/jobs/[jobId]/creator-final-export/route.ts`: retain the current canonical export envelope; use the merged object for atomic installation; read back the canonical project after installation to issue a validated revision binding.
2. `lib/creator/creatorFinalExportPersistence.ts` (new): preserve all canonical state except the two final-video publish fields; reject missing/malformed authority; validate post-install envelope equality and create a job/project/base-revision binding using the actual stored revision; reject out-of-order, unrelated-job and changed-generation handoffs.
3. `app/api/jobs/[jobId]/route.ts`: expose only the normalized, bounded revision binding alongside movie output.
4. `app/create/page.tsx`: adopt the bound revision in active and resumed final-export polling; stop terminal pollers; retain local content and fence autosave on unverified handoffs; parse structured save failures; display actionable localized messages and bounded diagnostics; avoid regressing an already-newer successful-save revision. The save queue and CAS dispatch gates remain in place.
5. `lib/creator/projectSaveErrors.ts` (new): typed status/code errors, safe response validation, authentication/network/size/server/identity/conflict/repair classification, and diagnostics with no raw messages, bodies, signed URLs, tokens or payloads.
6. `lib/creator/creatorWorkflowAuthority.ts`: delegate save classification to the typed classifier, retaining legacy Error-message compatibility.
7. `app/api/save-project/route.ts`: explicitly reject an installed final-export envelope whose canonical state is missing with `CREATOR_PROJECT_STATE_REPAIR_REQUIRED`; never recreate it from a local snapshot.
8. `scripts/stage-r2-safety-autosave-cas-test.mjs`: synthetic integrity, response classification, asset-preservation and actual-worker-handler coverage.
9. `scripts/stage-0-18a6g1-reload-hydration-autosave-test.mjs`: update source assertions for the typed response parser while retaining the late-successful-save revision guarantee.
10. `scripts/post-long-form-project-lifecycle-authority-test.mjs`: update the static assertion for the typed async persistence callback.
11. This report.

Previous script-generation and R4/SciPy changes were present at entry and preserved. No separate Scientific Review worktree was touched. No SQL migration, database function, live project row, asset, job, or revision was modified.

## Safety properties

The existing atomic installer still checks the project's original expected revision. No CAS guard was removed or relaxed. The fix supplies the complete canonical envelope to that existing boundary; it does not install local editor content.

The client accepts a revision handoff only for the matching job, project and editor generation, when its current token is the installation's original base revision or the same already-adopted revision. The server issues that handoff only if the read-back envelope is equal to the expected installed envelope. A newer unrelated write, changed identity or missing binding is refused. No refresh or snapshot reconciliation occurs automatically.

Historical jobs without the new binding fail closed in the editor rather than granting a fresh revision token to stale local content. Missing canonical state fences further automatic attempts and tells the owner to keep the tab open. Existing saved-scene and asset references remain unchanged.

## Validation

All new regressions use synthetic fixtures and in-memory dependencies. The worker regression starts from uploaded output and supplies no usable rendering/network implementation, so it cannot trigger an export.

Passed:

- `node --experimental-strip-types scripts/stage-r2-safety-autosave-cas-test.mjs`: normal/consecutive autosaves, delayed queued saves, stale revisions, generation changes, synthetic 36-image/36-audio/reference preservation, exact lost-envelope reproduction, new repair refusal, post-final-video autosave, actual uploaded-output worker handler, actual stored timestamp handoff, duplicate/old/wrong-job handoffs, HTTP auth/identity/size/server errors, network errors, invalid responses and diagnostic redaction.
- `node --experimental-strip-types scripts/stage-r2-safety-creator-project-quarantine-test.mjs`.
- `node --experimental-strip-types scripts/post-long-form-project-lifecycle-authority-test.mjs` (after updating its callback-shape assertion).
- `node --experimental-strip-types scripts/stage-0-18a6g1-reload-hydration-autosave-test.mjs` (after updating its parser-shape assertion).
- `node --experimental-strip-types scripts/stage-0-18a6g2-post-hydration-scene-state-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-18a6h-audio-topology-guard-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-13a-creator-project-state-persistence-test.mjs`.
- `node --experimental-strip-types scripts/stage-0-19f-f2-2-final-asset-supersession-test.mjs`.
- `node --experimental-strip-types scripts/stage-2a-durable-creator-final-export-test.mjs`.
- `node --experimental-strip-types scripts/stage-2b-worker-lifecycle-test.mjs`.
- `node --experimental-strip-types scripts/stage-1-creator-final-video-recovery-test.mjs`.
- `node --experimental-strip-types scripts/creator-script-refinement-r2-research-backed-test.mjs`.
- `npm run typecheck` after resolving the newly typed save-result callback/queue signatures.
- Focused ESLint for the changed server/helper/test files.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run lint:changed` reported `NO_NEW_LINT_DEBT=PASS`.
- Production webpack build in an isolated `/private/tmp/velto-autosave-build-validation` source copy with only NEXT_PUBLIC configuration passed to the build. The active app's `.next` directory was not used. Next used its installed WASM fallback because native SWC was unavailable.
- `git diff --check`.

Remaining test failure:

`node --experimental-strip-types scripts/stage-0-13c-b-audio-timeline-persistence-test.mjs` stops at its source assertion expecting exactly `await persistProject(true)` (and subsequently exactly `await persistProject(false)`). The existing implementation passes lifecycle/autosave options; the non-matching manual-save call is already present in HEAD. This stale static assertion was not changed as part of this fix. Behavioral timeline/asset preservation is covered by the new autosave/worker regression and the audio-topology suite. The entire critical runner was not rerun for this task; relevant suites are listed individually above.

The pre-fix diagnostic loss and return typing briefly produced failing source assertions/TypeScript errors during development; those affected assertions/signatures were corrected and their reruns passed. No real production save or paid acceptance test was run.

## Refresh and recovery

Do NOT refresh the affected CreatorLab tab yet. The code prevents recurrence and unsafe saves, but it does not restore canonical state already removed by the prior installation.

Recovery needs the exact current revision-2 editor snapshot preserved through an approved read-only capture, then compared against the latest project ID/revision, 36 image/audio references, retained timeline manifest and final-video metadata. A proposed repair must preserve the current movie envelope and all existing asset references, and use the exact current CAS revision. It requires explicit authorization before any production database write. Restoring an older revision-1 build is unsafe and is not proposed as an automatic fallback.

No commit, push, deployment, export, generation, database repair or content replacement was performed. Implementation and offline validation stop here; live recovery remains a separate authorized step.
