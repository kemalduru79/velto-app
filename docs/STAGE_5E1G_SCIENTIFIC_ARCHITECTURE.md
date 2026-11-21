# Stage 5E1G — Scientific Capability Architecture

Status: `DESIGN_ONLY` / `LIVE_NO_GO` / `HUMAN_SIGNOFF_REQUIRED`

Baseline: Stage 5E1F commit `acf4689f964a62587cf0f9244c346aa2b2036e3e`.

## Purpose and non-goals

Stage 5E1G extends the Stage 5E1F offline scientific pre-review core into a production-grade architecture proposal. It does not activate providers, import private evidence, change CreatorScriptBuild V2, or grant publication authority. Stage 5E1F remains the compatibility boundary and its `offline_mock` path remains valid.

Publication authority always requires an identifiable, qualified human reviewer. AI judgments, calculations, source matching, and adjudication can prepare a decision but cannot create human signoff.

## What Stage 5E1F already provides

Reusable without semantic weakening:

- Strict, versioned claim/source/evidence/judgment contracts and unknown-key rejection.
- Immutable claim tasks with primary and adversarial assessment sides.
- Exact source byte SHA-256, derived-text SHA-256, and UTF-8 byte-range passage checks.
- Fail-closed PDF handling: unverified page locators cannot yield `PRELIMINARY_PASS`.
- Pre-dispatch attempt consumption, exclusive local run creation, fsync-backed records, private permissions, and replay rejection.
- Deterministic exception-first reporting that cannot express human approval or live authorization.

Important limits:

- The four reviewer roles are orchestration contracts, not isolated processes or independent scientific experts.
- The adversarial role is selected mechanically from the next role; it is not claim-domain adjudication.
- The filesystem ledger is single-host and in-memory counters are not a distributed admission authority.
- PDF display locators are metadata only; Stage 5E1F verifies extracted text, not source-page fidelity.
- Cost values are modeled estimates. They are neither account reservations nor guaranteed provider caps.
- An injected callback could perform network activity; `offline_mock` is not OS-level egress isolation.

Stage 5E1A and Stage 5E1B offer additional reusable patterns: immutable request fingerprints, `maxRetries: 0`, consumed ambiguous attempts, exact serialized-request token admission, source-document hashes, readiness reason codes, and explicit `NO_GO`. Their live transport is intentionally absent and their filesystem admission remains single-host.

## Target trust boundaries

```text
Owner-private evidence vault
  -> allowlisted offline importer
  -> immutable evidence authority manifest
  -> deterministic calculation sandbox
  -> claim review task builder
       -> isolated primary reviewer execution
       -> isolated adversarial reviewer execution
  -> deterministic conflict classifier
  -> human adjudication queue
  -> signed human decision record

Cross-cutting: durable admission, usage receipts, egress policy, audit log, retention policy
```

No component downstream of the evidence vault may silently widen the source set, alter a passage, replace a paper version, or infer a locator. Each derived artifact is hash-bound to its immediate inputs and to the root import manifest.

## Layer 1 — Reproducible scientific computing

### Boundary

Introduce a computation service that accepts only a declarative, versioned calculation specification. Do not accept arbitrary Python supplied by a model. A small allowlist should initially cover descriptive statistics, confidence intervals, effect-size reconstruction, curve-fit comparison, and unit conversion.

Each execution uses an ephemeral sandbox with:

- Network disabled at the OS/container boundary.
- Read-only root filesystem and a bounded private temporary directory.
- Pinned Python, NumPy, SciPy, BLAS, locale, timezone, and container-image digests.
- CPU, memory, process, file-size, and wall-clock limits.
- Deterministic random seed where stochastic routines are unavoidable; deterministic algorithms preferred.
- Single-thread numerical execution unless parallel determinism is demonstrated.

### Calculation record

Every result records specification version, input evidence IDs and hashes, units, source values, algorithm ID, executable/image digest, dependency versions, tolerances, stdout/stderr hashes, structured result, result SHA-256, and terminal state. Failed or timed-out calculations are immutable failures and are never interpreted as evidence.

### Authority

A calculation can verify arithmetic consistency. It cannot establish that source values were correctly extracted, that a statistical method is scientifically appropriate, or that a causal interpretation is justified. Those remain evidence and human-review questions.

## Layer 2 — Evidence authority

### Owner-controlled import

Add a local, explicit importer for the private 23-claim Stage 5E1D package. The importer runs outside application routes and requires an owner-selected absolute source directory. It reads an allowlisted manifest schema only, refuses symlinks and path escape, verifies 0700/0600 permissions, and never copies source documents into Git.

The importer produces an immutable private authority bundle containing:

- Package and schema version.
- Source ID, canonical publisher identity, exact publication version, media type, original byte SHA-256, acquisition/rights receipt identity, and receipt hash.
- Extractor ID/version/configuration, derived-text SHA-256, and original-to-derived locator map hash.
- Evidence ID, source ID, exact passage SHA-256, original locator, derived Unicode-scalar/byte locator, and locator-verification status.
- Claim ID, claim type, proposition kind, evidence links, stance, section routing if authoritative, and content hashes.
- Independent semantic-review status and reviewer identity reference, never a self-declared boolean.

### Locator authority

HTML and PDF need format-specific verification. A PDF passage is authoritative only when the page/block locator, extraction configuration, page identity, and passage hash are independently reproduced. Ambiguous reading order, multi-column joins, OCR uncertainty, wrong versions, or repeated indistinguishable passages remain blocked.

### Compatibility

Stage 5E1F input is derived from the authority bundle only after import validation. Existing `ScientificReviewInput` and exact-byte checks remain a second validation layer, not the root provenance authority.

## Layer 3 — Independent AI evaluation

### Separation contract

Primary and adversarial reviews must execute as separate durable operations with separate request IDs and no shared conversational state, `previous_response_id`, hidden transcript, prior judgment, or mutable scratch directory. Each receives the same immutable claim/evidence snapshot plus its role-specific instructions. The adversarial reviewer cannot see the primary response before submitting its own judgment.

Separation should be enforced by distinct worker processes or ephemeral sandboxes and independently hashed request envelopes. Separate contexts reduce contamination; they do not prove epistemic independence, scientific replication, or absence of correlated model error.

### Request and receipt authority

Future transport must pin provider, exact model/version, endpoint, service tier, schema, tool policy, token ceiling, timeout, and `maxRetries: 0`. Official OpenAI documentation states that SDK retries are enabled by default unless disabled, that `max_output_tokens` includes visible and reasoning tokens, and that usage/request IDs are available for reconciliation. Every attempt therefore consumes authorization before dispatch and stores the provider request ID, response ID, status, usage, and raw-response hash in a secure receipt. Missing or ambiguous receipts block automatic retry.

Model output remains `PRELIMINARY_*`. A schema-valid answer is not evidence-valid merely because it cites available IDs.

## Layer 4 — Scientific adjudication

Adjudication starts only after both judgments and all required calculation records are terminal. A deterministic classifier categorizes disagreement:

- `EVIDENCE_IDENTITY_CONFLICT`
- `QUANTITATIVE_REPRODUCTION_CONFLICT`
- `METHOD_SELECTION_CONFLICT`
- `CAUSAL_INTERPRETATION_CONFLICT`
- `FORECAST_OR_EXTRAPOLATION_CONFLICT`
- `LIMITATION_OR_SCOPE_CONFLICT`
- `EDITORIAL_WORDING_CONFLICT`

The classifier may merge identical outcomes, but it may not resolve substantive disagreement. Any `BLOCK`, insufficient provenance, calculation mismatch, material disagreement, unsupported claim, or publication-intended quantitative assertion enters a human review queue.

Human records require reviewer identity, affiliation/expertise, conflict disclosure, reviewed artifact hashes, decision, qualifications, corrections, timestamp, signature mechanism, and owner acceptance. Changing any reviewed input invalidates the signoff.

## Layer 5 — Operational safeguards

Production execution requires a transactional shared admission authority rather than extending the single-host filesystem ledger. Preserve Stage 5E1F semantics:

- Immutable run identity and input-manifest hash.
- Unique attempt identity and pre-dispatch consumption.
- One terminal receipt per consumed attempt.
- Ambiguous completion blocks retry pending reconciliation.
- No operation can transition directly from model output to publication authority.

Required controls include least-privilege credentials, workload identity where available, strict outbound destination allowlists, DNS/IP revalidation, no arbitrary tools, encrypted private storage, audit-log immutability, retention/deletion policy, redaction controls, per-run and account-level dispatch limits, and incident kill switches.

Application project persistence and the scientific review store remain separate. Stage 5E1G cannot update scripts, scenes, media, or production state.

## Principal gaps and blockers

1. No approved private-package import schema or owner-run importer.
2. No independently reproduced PDF locator authority for the full evidence set.
3. No allowlisted reproducible-computation specification or sandbox runtime selected.
4. No isolated live reviewer adapter, durable shared ledger, or receipt reconciliation.
5. No approved exact reviewer model/version, data-handling policy, or tokenizer receipt process.
6. No OS/container egress enforcement evidence.
7. No qualified-human reviewer workflow or signature authority.
8. No approved retention, deletion, rights, and third-party processing policy for private evidence.

Until every applicable gate in `STAGE_5E1G_ACCEPTANCE_GATES.md` passes, disposition remains `LIVE_NO_GO`.
