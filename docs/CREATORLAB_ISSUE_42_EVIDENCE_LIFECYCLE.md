# Issue #42: evidence lifecycle and long-form handoff

Base: `be0dda7eaf6debc2d996eaa5d90c7095b32cde2d` (verified production).
PR base: `fix/creatorlab-longform-grounding-plan-20261102`, which points to that exact commit. This is a focused follow-up to PR #41, not a bundle of the production branch against main.

## Verified mechanism

At the production base, `lib/research/editorialGroundingRepair.ts:434` sends the partially repaired original span-selection proposal directly to the legacy excerpt parser. The ordinary path first installs every source-owned span. The repair path only installs the invalid item; valid untouched items still contain spanId, not excerpt. The legacy parser accepts absent excerpts as null. A deterministic synthetic nine-source/six-claim/eight-evidence fixture reproduces **eight evidence records but one nonempty excerpt** after exactly one bounded repair.

That fixture matches the latest issue diagnostics: review, MATERIAL_COUNTER_EVIDENCE_REVIEW, zero primary/eight nonprimary evidence records, primary coverage ratio 1, six sections, missing_grounded_demonstration_capability. The ratio is vacuous because no claim requires primary coverage; it does not establish primary-source quality. The earlier ready/six-excerpt fixture separately reproduces missing_uncertainty_capability. These are different constraints, not interchangeable retry errors.

The excerpts survive graph creation, proposition handling, editorial context serialization, client pipeline request construction and planner normalization without additional loss. The repair boundary is the demonstrated loss point. The original production request/source passages were not supplied; matching its diagnostic signature does not establish its exact source contents or resolve its substantive research review.

Additional handoff defects: the route admitted review status while only blocking blocked; role planning inspected control-only evidence later removed from narration; compact prompts could omit concrete support that qualified a demonstration. Evidence IDs alone could count as uncertainty/counterview capability despite null excerpts.

## Focused correction

- `lib/research/editorialGroundingRepair.ts`: rematerialize every original and repaired selection from the stable source-bound catalog before validation. Reject duplicate span identities, unrelated repair targets and zero-material repair attempts; retain one attempt and source ownership.
- `app/api/creator-editorial-analysis/route.ts`: require span selection at actual API boundaries, return actionable validation errors and explicitly distinguish imagined scenarios from real forecasts.
- `lib/research/scriptPlannerEditorialContext.ts`: recompute grounding obligations, retain outstanding review reasons, block missing linked excerpts, report missing IDs and whether primary coverage applies. The historical canonicalSpanCount diagnostic remains a compatibility alias for nonempty excerpt count, not a span-identity attestation.
- `lib/research/creatorLongFormEvidenceReadiness.ts`: require nonempty excerpts for capabilities; never adapt around unresolved review.
- `app/api/creator-script-plan/route.ts`: block unresolved grounding before provider dispatch, then use the same narration-facing evidence projection and adapted section plan for readiness, routing, controls and generation.
- `lib/research/creatorEvidencePack.ts`: exclude empty excerpts and prioritize existing concrete bindings for demonstration prompts without adding evidence or changing budgets.
- `lib/creator/creatorScript.ts`: retain explicitly typed hypothetical thought experiments in the narration projection. Their factual premises still require sourced claims; no forecast is reclassified automatically.
- `scripts/creator-issue-42-evidence-lifecycle-test.mjs`, `scripts/fixtures/creator-issue-42-evidence.mjs`, `scripts/fixtures/creator-script-plan-offline-harness.mjs`: synthetic lifecycle and actual route/client handoff regression harness.
- `scripts/stage-0-10h-2h-script-planner-editorial-context-test.mjs`: additive diagnostics contract.
- `scripts/stage-0-8a-critical-regression.mjs`, `package.json`: register focused regression.
- This document records provenance, validation and release limits.

## Reproduction and validation

Run `npm run test:issue-42-evidence -- --baseline` to load the exact production repair function with only relative imports relocated. It demonstrates eight/one and the missing demonstration. Run without --baseline for eight/eight after repair. The substantive counter-evidence review remains blocked with zero provider dispatches, including attempts to clear client readiness reasons.

The offline harness transpiles the real script operation and its real pure dependencies. A separate test exercises the real client pipeline through editorial JSON handoff into that operation. Auth, economics, providers and persistence are synthetic/disabled. Six eligible section-generation requests are inspected for aligned plan, narrator controls and evidence payloads. Repetitive synthetic model prose is deliberately not claimed as a fully accepted production script. No authenticated browser/provider/database end-to-end acceptance is claimed.

Focused regressions include normal/no-op/one-item repair, strict missing selections, idempotence, cross-source and duplicate rejection, one-attempt cap, no-material/no-provider behavior, null/whitespace excerpts, counter-review preservation, primary downgrade rejection, hypothetical 2055/2075 labels, control-only projection, concrete prompt retention and unchanged inputs. Six existing readiness/uncertainty/counter-provenance/role/adaptive-plan suites pass.

TypeScript, production build with localhost dummy configuration, CI contract and affected-file ESLint pass (two existing unused-import warnings in script-plan route). Critical CI has two independently reproduced production-baseline failures: stage-0-8g architecture closure freezes an outdated export-service checksum; stage-0-10h-5g publish governance asserts an outdated source-code pattern in the unchanged publish route. Neither production renderer nor publish route is changed here. The runner stops at the first failure; remaining suites are additionally executed independently to expose failures hidden behind it. Historical presentation scope tests must be run with a clean committed tree, as they inspect git status.

## Limitations and release recommendation

Missing historical excerpts require editorial analysis from existing source material; this patch does not invent or backfill them in persisted projects. Genuine material counter-evidence, provenance and primary-source obligations must be resolved by legitimate research/editorial review. No global approval override is introduced. Topic readiness measures traceable authority, not factual truth. The patch cannot certify original source quality from the supplied issue log.

Review this draft against the exact production base. Triage the two existing CI failures separately; do not change their unrelated contracts merely to green this patch. After owner release authorization, deploy the reviewed Next.js application/API build together so editorial materialization and script gating use the same version. No export-worker or local export-service changes, database migration, project rewrite or media regeneration are required. In a separately authorized fresh-session canary, use owner-reviewed research and explicit hypothetical future labels; verify missing excerpts/review fail before model dispatch and eligible evidence reaches the same section plan. Provider prose still undergoes existing semantic/factual gates. Do not overwrite historical projects or refresh stale historical tabs.

Observe bounded diagnostics (counts/IDs/reason codes, never full passages/credentials). If deployment fails, stop new generation and restore the last known deployment operationally while keeping review-blocked projects blocked; do not treat old null-excerpt contexts as approved. Release, production canary and any rollback require separate owner authorization; none were executed during this investigation.
