# Issue #50 — Iterative script refinement inside CreatorLab

## Product requirement and minimum acceptance

**Goal:** A creator must be able to improve the **existing canonical script** by typing a natural-language instruction beside that script, without returning to the original creative brief, opening a new project, or generating a replacement script from zero. This is iterative editorial refinement, **not** a new standalone chat application.

### User journey

1. Open the existing CreatorLab project's **Complete script / Tam metin** editor.
2. Type one or multiple sentences into the **Refine with AI / Yapay zekâ ile iyileştir** multiline prompt.
3. Choose a target: selected passage, opening, or **whole script**. Whole-script submodes: editorial refinement using existing verified evidence, or research-backed refinement with explicit source/claim deltas.
4. Generate a preview; **original text must not be overwritten**. Show the before/after changes, evidence and duration diagnostics where available, and the precise instruction.
5. Choose **Apply** or **Discard**. On Apply, advance the same project's canonical revision and retain the prior revision's history. On Discard, retain the original unchanged.
6. Repeat the operation on the **latest accepted script revision** with another prompt, without re-entering the original creative-direction prompt. Previous accepted changes must remain unless the next explicit instruction changes them.
7. The author must be able to review the revision history and the prompt that led to each accepted change. Stale previews must fail closed, not overwrite newer work.

### Safety and production requirements

- Scope is enforced server-side: selected passage/opening stays scoped; full-script changes require the separate whole-script capability admission. Never silently downgrade a full-script request to the opening or expand a selected-text request into a new script.
- Preserve source and claim authority, evidence qualifiers, target duration, defined subject and user immutable constraints. New unsupported sources/claims and invented anecdotes are prohibited.
- Research-backed refinements expose which verified evidence/claims were introduced; editorial-only refinements may not invent new sources, facts or claims.
- Apply/Discard may only act for the authenticated owner and matching project/revision. No automatic overwrite on preview.
- If scenes/media already exist, follow the existing production-snapshot-before-invalidation and scene-authority invalidation lifecycle. Never silently mutate existing video/media history.
- No extra model retry or background generation is authorized by this specification. Real provider costs need explicit approved test/release scope and the existing billing policies.
- Automated grammar/heuristic review does not substitute for factual verification or an owner acceptance decision.

### Implementation inventory (verified 2026-11-17)

- Existing UI: `components/create/CreatorScriptReview.tsx` already has selected-text and opening prompt refinement, preview, Apply/Discard and revision history.
- Existing route: `app/api/creator-script/refine/route.ts` validates owner, revision, scope and mode; uses pending proposals and preserves snapshots prior to invalidation.
- Existing engine: `lib/creator/creatorScriptEditorialRewrite.ts` contains editorial and research-backed full-script paths, currently **gated**.
- Existing constant: `CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED = false` in `lib/creator/creatorScriptRefinement.ts`. The UI also marks whole-script modes disabled. **Do not change this or bypass either gate in this isolated UX change.**
- This branch adds a multiline instruction box and explicit iterative-edit guidance to the existing script editor, not a replacement script workflow. It is a **partial isolated candidate**, not a live feature.
- **Additional candidate preview gating (off by default):** `VERCEL_ENV=preview`, `NODE_ENV=production`, and private server flag `CREATOR_SCRIPT_FULL_REFINEMENT_PREVIEW_ENABLED=true` must all hold for the backend full-script endpoint to permit the request. The client exposes the dropdown only when `NEXT_PUBLIC_VERCEL_ENV=preview` and `NEXT_PUBLIC_CREATOR_SCRIPT_FULL_REFINEMENT_PREVIEW_ENABLED=true`. These are configuration design requirements, **not** claims that flags have been installed or a preview deployment made. The two sets of flags are independently checked; a client flag cannot grant server authority. `CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED` remains hardcoded `false`.
- Existing `CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED` remains restricted to nonproduction local/test execution. No environment variable is modified by the code itself.

### Evidence required to declare the feature DONE

1. UI and offline API/contract tests pass without real provider or production changes.
2. Source admission for the exact candidate hashes and independent review are complete.
3. In a separately approved, isolated runtime, whole-script option is enabled intentionally for real test users and produces an actionable preview against the **current** canonical revision.
4. An owner performs **at least two successive applied prompts** on the *same* full-length script, confirms the second starts from the first applied revision, checks changes/duration/grounding and sees unchanged earlier content where not targeted.
5. Discard and stale request behavior demonstrably preserve the canonical script and historical versions. The owner approves the final behavior and billing envelope.
6. Only after above, production enablement is a separate release authorization. No production/Beta release is implied by code or CI PASS.

**Current status:** UI candidate and two successive actual-route, closed-stub full-script refinement iterations have passed isolated CI; the source-only Preview gate is prepared and defaults off. Independent source acceptance, actual Preview activation, real-model editorial quality, and live two-turn owner acceptance remain **NOT VERIFIED / NOT RELEASED**. No change to original 104 protected pins, Scientific Runtime, production or live inference is authorized.
