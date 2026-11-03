# PR #45 pre-production compatibility assessment

Reviewed SHA: `4f48029f7c51c3c32ee365b210647dd02e54ea2c`.
Production comparison: `d44ab5d8b713d14e57408f026487a6dc13eec015`.
Decision: **NO-GO for production**, including after this bounded follow-up.

All diagnostics use synthetic fixtures and historical Git source. No database,
existing project, production service, browser tab or media was accessed or changed.
The number of affected live contexts is **UNVERIFIED**, not zero.

## 1. Original-study qualification: demonstrated loading incompatibility

`sourceAssessment.ts:researchSourceIsPrimaryForClaim` correctly stops qualifying
an original research result merely because a secondary report matches its work
URL/title. Document-own assertions and named-speaker attributions remain distinct.
The stricter rule is scientifically necessary; restoring the old match is unsafe.

However, this is also used during persisted script normalization:

1. `scriptPlannerEditorialContext.ts:assertScriptPlannerPrimaryAuthority` recomputes
   authority and rejects a stored covered-claim list under the new policy.
2. `creatorScript.ts:normalizeCreatorScript` converts the mismatch to
   `CREATOR_SCRIPT_INVALID`.
3. `projectState.ts:readCreatorProjectState` then throws
   `CREATOR_PROJECT_STATE_SCRIPT_INVALID`.

The regression loads exact production versions of all seven relevant pure modules,
creates an accepted, approved synthetic original-study script, and successfully
loads its synthetic project using that production code. The reviewed PR rejects
its context, script and project. The original input remains byte-identical.
This can prevent opening an existing project, not just require new research before
generation. Autosave/quarantine/CAS protections are deliberately unchanged.

| Context | Strict policy outcome |
| --- | --- |
| Ordinary source-backed FACT without a primary obligation | Existing path preserved |
| Exact document's own assertion | Accepted; remains globally secondary |
| Named author/publisher's attributed statement | Accepted claim-relative authority |
| Original study with qualifying global primary authority | Accepted |
| Already-primary-missing original-study context | Structurally accepted; generation remains blocked |
| Previously covered original study relying on secondary URL/title match | Stored authority mismatch; script/project loading blocked |

**Open blocker:** there is no reviewed legacy read/revalidation workflow separating
preservation of old script/approval history from eligibility under the stricter
current policy. This follow-up does not rewrite stored readiness, downgrade claims,
reapprove old scripts, install a reconstruction, or grandfather false authority.

Before release, establish the affected population through an authorized owner-scoped
read-only audit using the old/new predicates, returning counts and reason IDs only.
Include current scripts and any proposed scripts in pending refinements. Resolve
legacy loading/revalidation compatibility in a separately reviewed patch, or prove
that the intended deployment population contains no affected persisted contexts.
An audit alone does not repair an affected context. Existing projects must not be
used as write canaries.

## 2. Reduced scope: insufficient foundation reached six provider requests

At the reviewed SHA, the synthetic incident's explicit omission leaves two claims
and three linked passages for a six-section plan with four evidence-dependent body
sections. Different fallback claim combinations evade the all-identical-routing
check. Role adaptation then clears the remaining role capability reason. A direct
offline execution of the actual route dispatched all six initial section requests.
The repetitive synthetic response subsequently failed final prose acceptance;
there is **no claim that an insufficient documentary was successfully accepted**.

The follow-up adds one necessary pre-generation floor to the existing shared
long-form readiness helper: require at least one distinct source-backed passage
per evidence-dependent body section across the actual routed non-hypothetical
claims that have supporting evidence. Supporting, opposing and contextual passages
retain their original stance. Unused evidence and hypothetical-only links do not
count. Equal passages are deduplicated after Unicode, whitespace and case
normalization, independent of evidence IDs, source IDs or mirrored records.

The sparse case now returns 422, `insufficient_factual_foundation`, and sanitized
counts `{requiredPassageCount: 4, availablePassageCount: 3}`, with **zero provider
calls**. Adaptation cannot hide this reason. The API instructs the owner to obtain
qualifying passages or choose a shorter supported scope, preserving exclusions.
A separate richer synthetic corpus (four retained claims / five passages) reaches
all six aligned section requests. The exact sparse incident fixture remains
unchanged; it is no longer used to imply positive six-section readiness.

This floor is intentionally conservative and can block formerly eligible sparse
new-generation requests. It does not change persisted script normalization.
It is **necessary, not sufficient**: passage count cannot attest scientific truth,
semantic independence, source quality or adequacy for every possible duration.
Existing primary, counter-evidence, provenance, section-role, semantic, duration and
final prose acceptance remain independent gates. Readiness and provider generation
continue to consume the same narration evidence and the same prepared section plan.

## 3. Hypothetical futures and actual forecasts

The existing positive six-section fixture retains explicitly imaginary 2055/2075
THOUGHT_EXPERIMENT material and the hypothetical narration instruction. Such material
cannot fill a factual foundation deficit. The new regression also exercises all six
requests for an actual FORECAST with source-owned opposing evidence: every routed
instance preserves its original FORECAST type and text. No year-based retyping is
introduced. Existing regressions still reject forging a reviewed forecast into a
thought experiment, and leave unresolved forecasts blocked or explicitly omitted.
Documented limitations and rhetorical disagreement are never promoted to contradicts.

## 4. Follow-up files

Runtime (two files):
- `lib/research/creatorLongFormEvidenceReadiness.ts`: factual-foundation floor and counts.
- `app/api/creator-script-plan/route.ts`: actionable blocked response and sanitized counts.

Regressions and fixtures:
- `scripts/creator-pr-45-release-readiness-test.mjs`: exact-SHA before/after, compatibility matrix, zero-dispatch sparse scope, duplicates, hypothetical-only inflation and actual forecast handoff.
- `scripts/creator-issue-44-counter-review-test.mjs`: positive six-section paths use the separate adequately grounded fixture.
- `scripts/fixtures/creator-issue-44-evidence.mjs`: separate richer synthetic corpus; incident fixture unchanged.
- `scripts/creator-issue-42-evidence-lifecycle-test.mjs`: control-only-source test retains enough factual authority after filtering.
- `scripts/stage-0-15b-6b-long-form-evidence-readiness-test.mjs`: distinct synthetic passages replace repeated positive-fixture filler.
- `scripts/stage-0-15b-6d-evidence-readiness-observability-test.mjs`: distinct positive passages and additive blocked-floor reason.
- `scripts/stage-0-8a-critical-regression.mjs`, `package.json`: register the release regression.
- `docs/CREATORLAB_ISSUE_44_COUNTER_EVIDENCE_REVIEW.md`: link earlier implementation notes to this superseding NO-GO assessment.
- This assessment.

## 5. Validation and release conditions

The focused release regression passes while explicitly printing the reproduced
legacy incompatibility as **BLOCKED**; a passing characterization test is not a
backward-compatibility PASS. `--baseline` loads exact reviewed readiness code and
reproduces the insufficient-scope eligibility. The initial exact-SHA route probe
also confirmed six provider dispatches before the guard.

Focused Issue #42/#44, role adaptation, scientific routing, source authority,
project quarantine, script review, sanitized diagnostics and release regressions
pass. TypeScript, patch-wide lint and a production build with dummy localhost
configuration pass locally. No real auth, database or model was tested. Offline
provider responses deliberately do not establish accepted final prose.

The unchanged critical-suite failures remain release concerns:
- `stage-0-8g-architecture-closure-test.mjs`: frozen export-service checksum.
- `stage-0-10h-5g-publish-release-governance-test.mjs`: stale publish-route source assertion.
Both were independently reproduced on exact production d44 before this review.
No unrelated checksum, allowlist or scientific gate is weakened.

Release requires: (1) legacy compatibility disposition and read-only population
evidence; (2) explicit triage of the two existing CI failures; (3) reviewed final
commit and green focused gates; (4) separate deployment authorization followed by a
fresh-session disposable-project canary covering review/Stop, persisted reload,
primary acquisition, hypothetical/forecast distinction and accepted final prose.
Until then, keep PR #45 in draft. Do not merge or activate production.
