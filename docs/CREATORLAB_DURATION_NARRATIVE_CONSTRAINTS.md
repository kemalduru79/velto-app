# Duration and narrative boundaries

The persisted project configuration supplies duration and language. An explicit
review choice supplies the supported narrative structure. Neither the Thynel
8–10-minute brief nor its five chapters is a platform rule. Existing strategy
fingerprints, historical scripts and research are not rewritten by this patch.

| Existing condition | Classification | Treatment |
| --- | --- | --- |
| Thynel 8–10-minute brief | A: editorial preference | No duration eligibility check derives from it. |
| Stored 600 seconds, English; explicitly reviewed five-chapter fiction | B: user configuration | Preserve duration, budgets and reviewed roles through generation and acceptance. |
| Generic duration-derived count; at most ten body roles | E: planner heuristic/finite role inventory | Retain the default; it cannot replace the explicit supported five-chapter choice. Arbitrary new role schemas are outside this patch. |
| `science_documentary_v1`: 480 seconds, five sections | B: specialized policy configuration | Retain unchanged; it applies only when explicitly selected, not globally. |
| New script generation: 5–3600 seconds | E: existing execution eligibility boundary | Retain and reject unsupported requests before provider dispatch. No evidence establishes this as a vendor or product maximum. Expansion requires owner review and resource/provider qualification. |
| Legacy source-scene adapter: 1–36 scenes, 7–30 seconds each for long form (3–30 otherwise) | E: existing adapter/pacing envelope | Reject incompatible combinations explicitly. Never truncate sources or clamp requested duration. Not a platform limit or a qualified vendor limit. Expansion requires owner review of the adapter contract. |
| Persisted script: 3–24 sections, positive finite duration; build snapshot representation up to 86400 seconds | D/E: corruption/serialization boundaries distinct from execution eligibility | Preserve historical loading; representability alone does not authorize new generation or qualify support for that length. |
| Authentication, project CAS, reviewed evidence, primary-source/stance checks, section capabilities, duration-compliant output, bounded generation/repair attempts | D: authority/integrity/resource safeguards | Preserve. No provider limit was independently qualified in this offline task. |

## Regressions and evidence

`creator-duration-scene-contract-test.mjs` exercises the actual source-scene API
handler with synthetic authentication and deterministic provider responses.
Optional `VELTO_VERIFY_SCENE_BASELINE=1` reproduces the reviewed base's truncation
using local Git history: 37 scenes / 4000 seconds reached the provider as 36
scenes / 1080 seconds of budget. The patched route refuses this before dispatch.
Supported scene combinations preserve their complete sequence and requested
total; rounding reconciliation cannot silently shorten coverage.

The integrated API/controller/runtime/coordinator and fresh Chromium UI tests
use synthetic projects, authentication, persistence and provider stubs. They
exercise explicit review, five chapters at 600 and 720 seconds, unchanged
approved plans, evidence rejection, stale authority and draft-only acceptance.
They do not establish real-provider support or grant the owner's read-only
scope acknowledgement permission to install research or generate a live script.

The review and generation consume the same validated section plan. Generation
rechecks its capabilities against the scoped evidence; it cannot silently
substitute different roles after review. Historical normalization remains
independent of present-day new-generation eligibility.

Any expansion of the retained execution, adapter or representation boundaries
requires a separate owner decision supported by relevant technical evidence.
This patch makes no claim of 40- or 400-minute generation support.

## Patch scope

This focused release candidate excludes the local audit/recovery application,
its scripts and its CI registrations. The original workspace remains intact.
The draft-only review does not authorize production installation or writes.
