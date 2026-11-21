# Stage 5E1G — Acceptance Gates

Status: `ALL_LIVE_GATES_UNSATISFIED` / `LIVE_NO_GO`

Each gate is separately testable. Passing an earlier gate does not imply permission to start a later one. Evidence marked simulated or self-attested cannot satisfy an independent gate.

## Gate matrix

| Gate | Capability | Required evidence | Pass condition | Current state |
| --- | --- | --- | --- | --- |
| B0 | Stage 5E1F compatibility | Existing focused and critical suites | Stage 5E1F 26/26 and critical suite 105/105 remain passing; no production V2 change | PASS at baseline only |
| C1 | Calculation contract | Schema/adversarial fixtures | Unknown operation, units, nonfinite values, arbitrary code, or missing evidence hashes rejected | NOT_IMPLEMENTED |
| C2 | Sandbox isolation | Runtime policy and negative tests | No network, path escape, privilege escalation, fork bomb, unbounded memory/CPU/file output | NOT_IMPLEMENTED |
| C3 | Reproducibility | Cross-run records | Identical input/image/config reproduces required result/tolerance and receipt hash policy | NOT_IMPLEMENTED |
| E1 | Private import safety | Owner-run synthetic archive tests | Explicit root only; no symlinks/path escape; 0700/0600; no private text in logs/Git | NOT_IMPLEMENTED |
| E2 | Source authority | Real owner-approved metadata | Every source has version, byte hash, receipt/right status, extractor identity, and no substitution | BLOCKED |
| E3 | Passage locator authority | Independent HTML/PDF reproduction | Every required passage has exact unique mapping to original locator and derived offsets | BLOCKED |
| E4 | Claim binding | Referential-integrity and mutation tests | All claim/evidence/source/stance/routing links resolve; any mutation changes root hash and blocks | NOT_IMPLEMENTED |
| A1 | Reviewer task isolation | Process/sandbox integration test | Primary/adversarial requests share no judgment/context/state and expose only authorized evidence | NOT_IMPLEMENTED |
| A2 | Durable dispatch | Real transactional concurrency test | One consumed attempt per identity; duplicate processes cannot dispatch twice | NOT_IMPLEMENTED |
| A3 | Ambiguous completion | Timeout/crash/receipt-loss injection | No automatic retry; reconciliation required; usage/request IDs retained when available | NOT_IMPLEMENTED |
| A4 | Output authority | Schema and citation adversarial tests | Unsupported IDs, missing citations, overclaiming, or malformed outputs block | PARTIAL: Stage 5E1F mock only |
| J1 | Conflict classification | Deterministic fixtures | Material disagreements map to explicit categories without automatic scientific resolution | NOT_IMPLEMENTED |
| J2 | Human escalation | Workflow tests | Required cases enter queue; AI cannot populate human identity/signoff fields | NOT_IMPLEMENTED |
| J3 | Human signoff integrity | Auth/signature and stale-input tests | Qualified reviewer signs exact artifact hashes; input change invalidates signoff | BLOCKED on process decision |
| O1 | Egress isolation | OS/container policy plus negative probes | Offline workers deny all egress; reviewer worker reaches only approved endpoint | NOT_IMPLEMENTED |
| O2 | Credential isolation | Runtime inspection | Only reviewer worker receives scoped credential; no secret in artifacts/logs | NOT_IMPLEMENTED |
| O3 | Token admission | Exact-request token evidence | Exact serialized request and dynamic context are bounded by trusted count/calibration receipt | BLOCKED |
| O4 | Cost admission | Pricing and concurrency tests | Full envelope reserved once; estimates labeled; duplicates do not reserve twice | NOT_IMPLEMENTED |
| O5 | Usage reconciliation | Controlled fake-provider then authorized pilot | Request ID, usage, receipt, and billing evidence reconcile or remain ambiguous/blocked | NOT_IMPLEMENTED |
| O6 | Retention and incident controls | Policy and restore/delete drill | Retention, redaction, deletion, audit preservation, and kill switch verified | NOT_IMPLEMENTED |
| P1 | Controlled private pilot | Separate explicit authorization | Exact calls, model, evidence set, maximum modeled spend, reviewers, and stop conditions approved | NOT_AUTHORIZED |
| P2 | Publication authority | Independent human review | Every production-intended claim approved or qualified by authorized human; owner accepts | BLOCKED |

## Layer-specific acceptance suites

### Reproducible computing

- Known synthetic datasets with independently calculated expected outputs.
- Invalid units, NaN/Infinity, overflow, singular fits, underdetermined models, and tolerance-boundary cases.
- Same-data/different-model tests that prevent labeling fitted curves as independent experiments.
- Sandbox timeout, resource exhaustion, filesystem escape, environment mutation, and network probes.
- Receipt tampering and dependency/image mismatch rejection.

### Evidence authority

- Correct private bundle, wrong root, symlink, traversal, extra file, missing file, duplicate ID, and stale version.
- Replaced PDF/HTML bytes, unpinned revision, extractor mismatch, ambiguous columns, page-boundary join, OCR uncertainty, repeated passage, and locator substitution.
- Claim/evidence link, stance, section routing, and manifest-root hash mutations.
- Privacy scan proving no raw private text, credential, or unrelated project field enters repository artifacts or logs.

### Independent AI evaluation

- Two actual concurrent isolated worker contexts using a fake provider.
- Primary output unavailable to adversarial worker before its terminal receipt.
- No shared conversation, previous-response identity, scratch directory, or mutable prompt state.
- Duplicate dispatch, timeout before acceptance, timeout after acceptance, worker crash, malformed receipt, and request-fingerprint mismatch.
- Cross-claim/cross-source evidence injection rejected.

### Scientific adjudication

- Agreement, wording-only disagreement, quantitative mismatch, method conflict, causal overreach, forecast overreach, and missing limitation fixtures.
- `BLOCK` and insufficient authority dominate preliminary passes.
- No genuine counterview is invented when sources contain only alternative fits or limitations.
- Human-required cases cannot transition to accepted without signed exact-hash review.

### Operational safeguards

- Multi-process and multi-host admission against an isolated transactional store.
- Provider request count and modeled reservation remain exact under eight-way concurrency.
- Egress allowlist negative tests, DNS rebinding/redirect rejection, credential absence checks, and redacted logs.
- Provider usage mismatch and missing billing receipt remain `REVIEW_REQUIRED` or `BLOCKED`, never silently accepted.
- Kill-switch activation prevents new dispatch without corrupting existing receipts.

## Live execution GO criteria

One controlled live scientific-review pilot may be proposed only when C1–C3, E1–E4, A1–A4, J1–J2, and O1–O6 pass; J3 has an approved real workflow; processing rights are confirmed; and the owner separately authorizes P1 with exact request count and maximum modeled cost.

Even then, pilot output remains non-production. Publication requires P2 for every material claim.

## Immediate decision

`LIVE_NO_GO`. The correct next engineering gate is G1 contract extension plus metadata-only evidence-import validation. Provider transport is not the next step.
