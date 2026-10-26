# Stage 5E1G — Cost and Security Model

Status: `DESIGN_ONLY` / `NO_SPEND_AUTHORIZED` / `LIVE_NO_GO`

## Security objectives

1. Private evidence never enters Git, ordinary telemetry, application project persistence, or an unauthorized provider request.
2. A consumed attempt is never automatically repeated when completion is unknown.
3. Model output cannot grant source authority, human approval, or publication authority.
4. Each calculation, reviewer judgment, and adjudication decision is reproducibly bound to immutable inputs.
5. A single compromised reviewer or worker cannot alter another review, broaden evidence, or authorize publication.

## Threat model

| Threat | Required mitigation |
| --- | --- |
| Malicious archive/path traversal | Owner-selected root, canonical-path containment, no symlinks, allowlisted filenames/schema, private permissions |
| Replaced source or paper version | Original-byte hash, publisher/version identity, receipt hash, immutable manifest |
| Fabricated or shifted passage | Format-specific locator map, exact passage hash, unique occurrence policy, independent locator reproduction |
| Prompt injection in papers | Treat documents as quoted data, no document-provided instructions, no tools, strict output schema |
| Cross-review contamination | Separate processes/contexts, no prior judgment, immutable request fingerprint, separate receipts |
| Model/provider retry duplication | Pre-dispatch durable consumption, SDK retries disabled, no automatic application retry, reconciliation on ambiguity |
| Arbitrary scientific code | Declarative calculation allowlist, pinned sandbox image, no network, bounded resources |
| Ledger race or multi-host replay | Transactional shared unique constraints and leases; filesystem ledger limited to offline single-host runs |
| Secret or private-text leakage | Workload-scoped credentials, redacted logs, encrypted storage, outbound allowlist, payload-size/content policy |
| False cost certainty | Separate modeled reservation, admitted maximum, provider usage receipt, and actual invoiced/reconciled cost |
| Forged human approval | Human-only authentication/signature authority, reviewed hash set, immutable audit event, owner countersignature |

## Execution isolation

### Computation sandbox

- No credentials and no network namespace access.
- Read-only pinned image; tmpfs/private scratch with size and inode limits.
- Non-root user, dropped capabilities, seccomp/runtime profile, process/CPU/memory/time limits.
- Input mounted read-only; only structured result directory writable.
- Python dependency and image digests recorded in every calculation receipt.

### Reviewer sandbox

- One task per ephemeral process or sandbox.
- Only the exact claim and authorized evidence projection is mounted/sent.
- No source documents unless specifically necessary and rights-approved; passages are preferred.
- No previous response IDs, shared conversations, provider tools, web, retrieval, or arbitrary code.
- Separate primary/adversarial operation identities, request fingerprints, and receipt records.

Execution separation does not equal scientific independence. Reports must say `EXECUTION_CONTEXT_SEPARATED` rather than `INDEPENDENT_SCIENTIFIC_VALIDATION`.

## Network policy

Offline import and computation require deny-all egress. A future reviewer worker receives a default-deny policy with only explicitly approved provider endpoints, DNS controls, TLS verification, and proxy-level destination logging. Redirects, arbitrary URLs, provider tools, and source acquisition remain disabled.

An application-level observation such as “no fetch calls seen” is insufficient. Acceptance requires OS/container/firewall evidence and a negative egress test.

## Credential policy

- No credential is available to import, extraction, computation, or report-generation workers.
- Reviewer credentials are short-lived and workload-scoped where supported.
- Credentials never appear in request manifests, receipts, logs, reports, crash dumps, or source bundles.
- Provider/project permissions and spend controls are defense in depth, not substitutes for local admission.

## Cost authority

Four different values must remain separate:

1. `modeledMaximumUsd`: conservative calculation from a versioned pricing snapshot.
2. `admittedMaximumUsd`: locally authorized maximum for the complete run.
3. `providerReportedUsage`: token/request usage returned in authenticated receipts.
4. `reconciledActualUsd`: cost reconciled from provider billing/export data when available.

Only the first can be computed before provider execution. It must never be described as a guaranteed billing cap. Provider-side project spend limits are additional safeguards and may have timing or enforcement characteristics that require independent verification.

Before the first dispatch, reserve the entire approved run envelope in the scientific-run authority. A generic formula is:

```text
modeledMaximumUsd = safetyMultiplier * sum_over_attempts(
  admittedInputTokens * currentInputRate
  + maxOutputTokens * currentOutputRate
  + explicitly authorized tool/provider charges
)
```

The pricing snapshot records provider, exact model, service tier, region if applicable, currency, effective date, official evidence URL, checker identity, and SHA-256. Cached-input discounts or optimistic completion lengths must not reduce the admission ceiling unless independently guaranteed.

Official OpenAI documentation confirms that Responses usage reports input/output token counts, `max_output_tokens` includes visible and reasoning tokens, an input-token count endpoint exists, request IDs are exposed for debugging/reconciliation, and SDK retries are enabled by default unless explicitly disabled. The future adapter must therefore bind an exact serialized request to token-count evidence, set `maxRetries: 0`, and preserve request IDs and usage receipts.

Official references checked 2026-10-27:

- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/token-counting
- https://developers.openai.com/api/reference/typescript
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/spend-limits

## Dispatch state machine

```text
DRAFT
 -> PREFLIGHT_BLOCKED | ADMITTED
ADMITTED
 -> ATTEMPT_CONSUMED
ATTEMPT_CONSUMED
 -> COMPLETED | REJECTED_RECEIPT | AMBIGUOUS
AMBIGUOUS
 -> RECONCILED_COMPLETED | RECONCILED_NOT_ACCEPTED | HUMAN_INCIDENT_REVIEW
```

`AMBIGUOUS` never transitions automatically to another dispatch. A new attempt requires evidence that the provider did not accept the prior request, a new explicit authorization, and remaining call/cost authority.

## Accounting and audit records

Each run stores immutable manifest hash, evidence-bundle hash, calculation set hash, exact request fingerprints, consumed-attempt records, provider request/response IDs, reported usage, modeled reservation, reconciliation events, reviewer outputs, and human decision references. Audit events are append-only. Corrections supersede records; they do not overwrite them.

No production credit or economic-operation schema should be reused until an explicit accounting design shows how scientific-review reservations differ from CreatorLab generation charges.

## Retention and privacy decisions required

- Whether private passages may be sent to a provider at all.
- Provider data retention and training policy acceptable to the owner.
- Encryption keys and access roles for evidence, requests, outputs, and receipts.
- Redaction rules and maximum retention for provider payloads.
- Deletion procedure that preserves minimum audit identity without retaining content.
- Incident response for leaked credentials, evidence, or ambiguous paid calls.

No live adapter is acceptable until these decisions and all operational gates are approved.
