# Stage 0.15A script generation baseline

This is the known-good operational contract for the current CreatorLab **Generate** and **Rebuild script** actions. It is a regression reference, not a redesign proposal.

## Shared Generate/Rebuild path

Both actions use `handleCreatorProductionPackage` in `app/create/page.tsx`. The UI labels the action **Approve Strategy & Build Script** when no current script exists and **Rebuild script** when a preserved script is stale, but both send the same `operation: "generate_full_script"` request through `runCreatorEditorialScriptPipeline`.

Required client authority includes the authenticated access token, canonical normalized topic, project id and expected project update timestamp, selected strategy direction and hook, language, requested duration, and current strategy fingerprint. A trusted user click and the single-flight guard are required before dispatch.

The shared pipeline performs these calls in order:

1. `/api/creator-script-plan` with `validate_generation_authority`;
2. `/api/creator-research` in orchestrated mode;
3. `/api/creator-editorial-analysis` to create the grounded `scriptContext`;
4. `/api/creator-script-plan` with `generate_full_script` and that context.

Any failed step stops the pipeline. There is no client fallback, retry, second generation path, or automatic full-script rewrite.

## Server/provider boundary

`app/api/creator-script-plan/route.ts` authenticates the owner and reloads persisted project authority before generation. It rejects stale project revision, topic, duration, strategy fingerprint, direction, or hook authority with `CREATOR_SCRIPT_AUTHORITY_STALE`. A valid normalized editorial context is required; blocked grounding and unsafe duration/model output fail closed with the existing 4xx/422 codes.

Long-form generation remains section-native. The provider boundary is `OpenAI.responses.create` using the configured model (or `gpt-4.1-mini`), a system prompt plus one JSON-serialized user payload, `text.format.type: "json_object"`, the calculated output-token budget, and the existing temperature. Contract-sensitive payload fields include:

- topic, title, strategy, language, duration and global word envelope;
- requested section ids/order and local min/target/max word guidance;
- the complete control-only editorial section plan and continuity context;
- grounded editorial context and exact allowlisted claim ids;
- audience narrator, documentary-writing, generation-priority, and first-pass budget contracts;
- the declared JSON result shape.

Future work must preserve omission semantics such as section-native `completeSectionBudgetPlan`, the exact allowlisted section/claim identities, JSON-only structured output, model parameters, and token-budget calculation unless a separately accepted contract change explicitly replaces them.

The existing bounded Stage 0.14 reliability repair is part of this baseline. It does not authorize an unbounded retry loop or a second full-script generation architecture.

## Success and failure state

Provider output is parsed, normalized, checked for canonical section structure, grounding, narration safety, editorial distinctiveness, and the global duration contract before it can be returned.

The client accepts a result only for the active project generation. It then persists the new `CreatorScript` with CAS before installing it in UI state. A successful replacement preserves the new script and invalidates only the established downstream products: production package/scenes, timeline/edit plans, final movie/export signatures, creator package state, publish readiness, and release confirmations.

On research, editorial, provider, parsing, validation, stale-response, or persistence failure, the replacement state is never installed. An existing successful script and its existing downstream state therefore remain unchanged. This applies equally to first Generate and Rebuild; Rebuild does not erase the historic script before a successful replacement is persisted.

Section regeneration is a separate `regenerate_section` operation. It shares the authenticated route and grounded authority but is not the full-script Rebuild action described above.

## Regression ownership

- `stage-0-10h-2i-creator-editorial-orchestration-test.mjs`: shared call order, authority-first failure, request propagation, and fail-closed orchestration.
- `post-script-duration-workflow-authority-test.mjs`: trusted-click/single-flight behavior, Generate/Rebuild equivalence, persistence-before-install, failure preservation, and downstream invalidation.
- `post-strategy-script-long-form-acceptance-test.mjs`: Memory & Identity-style prompt invariants, grounded section-native generation, narration/control separation, Stage 0.14C writing contract, and Stage 0.14D bounded reliability behavior.
- `post-long-form-project-lifecycle-authority-test.mjs`: owner/project/CAS lifecycle and stale-operation isolation.
- Stage 0.13D/E/F and project-state tests: canonical script persistence and editorial-review authority after generation.

The current bounded diagnostics log identifiers, counts, word budgets, stage/status, and validation outcomes rather than full prompts or script prose. They are sufficient for locating 422 failures without changing request construction or exposing private content, so Stage 0.15A adds no production logging.
