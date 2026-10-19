# CreatorLab R2 — Stage 4B Controlled Live Acceptance Protocol

**Status:** PREPARATION ONLY / NO LIVE APPROVAL
**Parent:** Stage 4A draft PR #14, commit `5a60f378ac67339edaf4a3e5312867c36ecb4f47`
**Branch:** `agent/creatorlab-r2-stage4b-live-acceptance-prep`
**Scope:** A dedicated, isolated acceptance harness for original-source fidelity, Research-backed Rewrite provider behavior and synchronous runtime.
**Exclusions:** No production enablement, real project mutation, full-script Apply, scene regeneration, media exports, automatic retries, or branch merges.

## 1. Two separate authorization gates

**Gate 4B-Prep (this PR):** Implement, validate and review the isolated test runner and its safety gates with synthetic fixtures only. All provider invocations must be disabled by default. No Supabase production rows may be changed.

**Gate 4B-Live (later, explicit authorization):** Only after separate user approval defining approved provider(s), a nonzero USD budget, maximum request count, explicit test scenario and evidence acquisition scope may the runner execute real requests. Approval to prepare this protocol is not authorization to call providers.

A live run must not silently activate by attaching `OPENAI_API_KEY` or `EXA_API_KEY`; require an explicit per-run opt-in and validated configuration, fail closed otherwise. Do not store approval as a long-lived production environment flag.

## 2. Isolation and nonmutation

- Use synthetic, isolated test scripts and a synthetic project identifier; never pass the recovered real CreatorLab project ID to the runner.
- Prefer in-memory persistence fixtures. No network-connected production database.
- Default mode is `DRY_RUN`: zero external requests and zero provider spend.
- Generate/validate/preview are allowed only against the synthetic acceptance context. The runner does not expose or invoke Apply on production.
- Even when an acceptance fixture simulates Apply/Discard, those actions must be offline and test-local.
- Before and after any later authorized live run, use read-only integrity checks for the recovered project. Guard exact five-section / 36-scene invariants; if any discrepancy arises, stop, do not repair or retry automatically.
- Keep PR #13/#14 draft, whole-script production gate disabled and production deployment unchanged.

## 3. Trusted original-source acquisition boundary

- Independently retrieve the actual source document from its canonical source URL; do not accept provider summaries, Exa highlights, model-generated text, or provider-controlled metadata as document content or acquisition authority.
- Build a dedicated trusted-fetch adapter with HTTP(S) transport security, SSRF protection, redirect validation (including final resolved host), content-type/size limits, timeouts, and safe parsing. Explicitly reject internal, local, link-local and private-network destinations. Avoid fetching arbitrary URLs without policy enforcement.
- Attribute a document to a canonical source ID and final normalized URL; record acquisition timestamp, content SHA-256 and exact evidence text offset (or a source-specific immutable locator). Preserve provenance and link original passage to claims.
- Treat unsupported document formats, absent full text, extraction uncertainty, dynamic rendering and non-exact passage matches as `requires_review`, never `source_verified` by inference.
- `documentAuthority` and `trusted_fetch` must be assigned only by trusted server-side acquisition/validation code; never accept these fields from the provider/model.
- SHA-256 seals demonstrate integrity, not third-party document authenticity. Avoid claiming otherwise.
- The Stage 4A original-source fidelity and claim authority checks must be invoked on the actual live candidate *before* it can be accepted, or the controlled live runner must be strictly observation-only and nonpersisting. Do not rely on standalone fixture PASS as enforcement in production.

## 4. Cost and call guardrails

- Initial permitted live budget: **USD 0.00**. This must be changed by explicit user approval in a later turn. Do not pick a positive budget unilaterally.
- Require configuration for `approvedMaxCostUsd`, `approvedMaxExaRequests`, `approvedMaxOpenAiRequests`, `approvedMaxOutputTokensPerRequest`, and `allowLiveProviders`.
- Reject missing, zero or exhausted limits before the first live request. Prevent automatic retries, fan-out or fallback to a different paid provider.
- Record estimated and reported spend (USD), request counts and token usage after each call. Stop issuing subsequent calls as soon as the remaining budget cannot cover a conservative estimate. Cap output tokens per request.
- An absolute dollar cap cannot be assured during a request if the provider does not support in-flight billing enforcement; state this limitation, prevent additional requests and require conservative per-call limits.
- Never write API keys, full private scripts, session tokens or sensitive source payloads into PR comments or acceptance logs.

## 5. Runtime and stage traces

Record start/end, monotonic elapsed milliseconds, outcome and diagnostic category for:
1. research_acquisition
2. source_passage_verification
3. script_rewriting
4. claim_evidence_assessment
5. editorial_goal_assessment
6. proposal_validation
7. persistence (dry-run only)

- Distinguish actual timings from the Stage 4A simulated 187s/301s envelopes.
- The production HTTP route currently declares `maxDuration=300`. Do not assume that elapsed-time reporting enforces cancellation.
- Require a conservative pre-call remaining-time check and explicit abort/timeout policy where genuinely supported.
- Document provider and transport interruption behavior; if route execution cannot be made safe within the budget, report `BLOCKED` and propose an isolated, stage-persisted architecture for later review. Do not silently introduce a queue or resumable workflow.

## 6. Required pre-live scenarios (offline)

- Provider highlight differs from independently retrieved document.
- Exact same-source second passage is unverified; cannot inherit the first passage's source_verified status.
- Missing/misleading primary source classification and source URL redirect mismatch.
- Semantic assessor returns unsupported/contradicted/empty evidence list.
- Exa returns only discovery summaries or no retrievable original text.
- Malformed provider JSON, timeout, client cancellation, overbudget preflight, stale project revision and CAS conflict.
- A simulated candidate can reach a nonpersistent preview only after full authority validation.
- The synthetic five-section / 36-scene project remains unchanged after any failed, interrupted or rejected step.
- A valid 15-minute configured script remains acceptable; no fixed 10-minute cap.

## 7. Readiness decision and report

Return one status: `READY_FOR_CONTROLLED_LIVE_ACCEPTANCE`, `REVIEW_REQUIRED`, `BLOCKED`.
Include stage traces, verified passage/source IDs, semantic authority statuses, missing source coverage, request and cost budget telemetry, warnings, trace IDs, zero-write proof, and explicit actual-vs-simulated label.

Preparation completion means the harness is safe to consider for an explicitly authorized minimal paid/live test. It does not imply permission to execute that test or production release approval.

### Acceptance checklist
- [ ] Isolated harness implemented; no production route/feature flag enabled
- [ ] Trusted acquisition boundary and SSRF/redirect policy covered by offline fixtures
- [ ] Evidence-level validation wired fail-closed into acceptance candidate
- [ ] Budget/call guards tested (default USD 0)
- [ ] No Apply and zero production DB writes
- [ ] Time/abort/failure reporting validated
- [ ] Existing critical, CAS, quarantine and source-authority tests pass
- [ ] TypeScript, CI, lint, diff-check and production build pass
- [ ] Draft PR reviewed
- [ ] Separate user authorization obtained before any real paid or network calls
