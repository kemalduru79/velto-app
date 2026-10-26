# Stage 5E1G — Implementation Plan

Status: `PLAN_ONLY` / `NO_IMPLEMENTATION_AUTHORIZED` / `LIVE_NO_GO`

## Guiding approach

Extend Stage 5E1F by adapters and stronger authorities. Do not replace its contracts, weaken its fail-closed decisions, or connect the scientific review path to CreatorScriptBuild V2. Every phase is independently shippable as offline code and remains disabled by default.

## Recommended sequence

### G1 — Contract extension and compatibility fixtures

Complexity: Small, approximately 3–5 engineering days.

- Add versioned extension types for evidence-authority identity, calculation records, execution receipts, disagreement categories, and human-review references.
- Retain a compatibility adapter from the new authority bundle to the Stage 5E1F input.
- Keep `MockReviewer` and the existing 26 tests unchanged; add new tests rather than rewriting the baseline.
- Define stable canonical JSON and hash rules once.

Exit: Existing 105-test critical suite passes unchanged, plus contract compatibility and downgrade-rejection tests.

### G2 — Owner-run evidence importer and locator verifier

Complexity: Large, approximately 2–3 engineering weeks because PDF/HTML locator reproducibility is the dominant uncertainty.

- Implement a local-only importer with explicit path selection and no discovery outside the owner-approved root.
- Validate the redacted manifest before reading source bytes.
- Verify permissions, file identity, source version, hashes, acquisition/rights receipts, extractor identity, locators, links, stance, and routing.
- Produce a private immutable bundle and redacted verification report.
- Keep private documents, passages, and claim text outside Git and ordinary logs.

Exit: All 23 claims and their required evidence either verify exactly or receive explicit blocker codes. Partial success cannot authorize live review.

### G3 — Reproducible calculation runner

Complexity: Medium–large, approximately 1–2 engineering weeks.

- Select a sandbox technology and pin its image/dependencies by digest.
- Implement a declarative allowlist of calculations; no arbitrary model-generated code.
- Add deterministic fixtures for published statistics and adversarial numerical inputs.
- Emit immutable calculation records bound to evidence hashes.

Exit: Same inputs reproduce bit-identical structured records where feasible, or tolerance-bounded results with an explicit numerical portability policy. Network, resource-exhaustion, filesystem-escape, and arbitrary-code tests fail closed.

### G4 — Isolated reviewer execution and durable admission

Complexity: Large, approximately 2–3 engineering weeks excluding provider approval.

- Define a provider-neutral reviewer adapter and a disabled-by-default live implementation boundary.
- Use separate primary/adversarial processes or sandboxes with distinct request envelopes and no shared conversation state.
- Replace live use of the single-host ledger with transactional shared admission and reconciliation while preserving Stage 5E1F attempt semantics.
- Bind exact token-count receipts, request IDs, usage receipts, response hashes, and operation identities.
- Disable SDK retries and automatic application retries. Ambiguous outcomes require reconciliation.

Exit: Mock and local fake-server tests prove isolation and exact-once admission; no real provider call is needed for this gate.

### G5 — Adjudication and human review workflow

Complexity: Medium, approximately 1–2 engineering weeks plus reviewer process design.

- Implement deterministic conflict categories and an exception-first review packet.
- Add human identity, expertise, conflict disclosure, reviewed-hash set, corrections, signoff, and owner-acceptance contracts.
- Ensure AI output cannot populate human-only fields.
- Invalidate decisions after any input, calculation, model judgment, or evidence change.

Exit: Synthetic workflows demonstrate that unresolved scientific disagreement and unsigned decisions cannot become publication-authoritative.

### G6 — Operational security acceptance

Complexity: Large and infrastructure-dependent, approximately 1–3 engineering weeks.

- Deploy only to an isolated non-production environment after separate authorization.
- Enforce outbound allowlists, credential isolation, storage encryption, audit retention, kill switch, rate/cost admission, and monitoring.
- Run failure injection for timeout, ambiguous completion, process crash, duplicate dispatch, receipt loss, and ledger contention.

Exit: Security and cost gates pass with externally inspectable evidence. This still does not authorize production publication.

### G7 — One controlled scientific pilot

Not authorized in this plan.

Requires all gates, explicit owner authorization for exact calls and maximum modeled spend, approved evidence-processing rights, and named human reviewers. Pilot output remains private and cannot update CreatorLab projects.

## Smallest practical first implementation slice

Implement G1 plus the metadata-only half of G2. This creates a versioned authority manifest validator and redacted report without reading source text by default. Next, add one format-specific locator verifier for a single approved document type. Do not build live model transport before evidence and calculation authority are accepted; otherwise model throughput would only scale unverified inputs.

## Reuse map

| Existing component | Reuse | Required change |
| --- | --- | --- |
| Stage 5E1F contracts | IDs, exact schemas, decision vocabulary | Add versioned authority/calculation/receipt types; no in-place semantic widening |
| Stage 5E1F evidence validation | Hash and exact-byte checks | Precede with publisher/version/locator authority |
| Stage 5E1F orchestrator | Task immutability, two-sided review, aggregation precedence | Replace mechanical role selection with validated role assignment; isolate executions |
| Stage 5E1F ledger | Pre-dispatch consumption and immutable files | Keep for offline mode; use transactional shared authority for live multi-host mode |
| Stage 5E1F reports | Exception-first and no-human-approval language | Add calculation, provenance, disagreement, and human-queue sections |
| Stage 5E1A transport contracts | Fingerprints, no retries, receipts, ambiguous blocking | Adapt only after live authorization; do not import its mock dispatcher as live authority |
| Stage 5E1B readiness | Reason codes and `NO_GO` composition | Extend with evidence, compute, independence, adjudication, and operational gates |

## Decisions required before implementation beyond G1

1. Owner-private evidence root, schema, retention period, and deletion procedure.
2. Approved source versions, acquisition/right receipts, and third-party processing rights.
3. HTML/PDF extractor choices and what constitutes independent locator verification.
4. Calculation allowlist, numerical tolerances, and sandbox/container runtime.
5. Shared durable store and transaction authority for live attempts.
6. Exact provider/model/version and whether primary/adversarial reviewers may share a provider.
7. Token-count authority, per-attempt timeout, call count, and separately approved cost envelope.
8. Network-egress enforcement platform and evidence required to attest it.
9. Provider data retention/privacy configuration and credential owner.
10. Human reviewer qualifications, conflict policy, signature mechanism, and owner acceptance flow.

## Overall estimate

Offline production-readiness implementation is approximately 7–13 engineering weeks, dominated by locator fidelity, sandbox hardening, and durable multi-host operations. Human review process establishment and legal/privacy approval are separate calendar dependencies. These ranges are planning estimates, not delivery commitments.
