# PR #45 current-head follow-up — NO-GO

Base verified from GitHub: `18e5922308dde07cddd582cea4f5ec3a0121cb64`, draft PR #45, production baseline `d44ab5d8b713d14e57408f026487a6dc13eec015`. This report supersedes earlier readiness statements where they conflict. No production access or project/media changes were performed.

## Scientific CI root cause and disposition

[Full Ubuntu run 41675306212](https://github.com/kemalduru79/velto-app/actions/runs/41675306212) stops in `stage-5e1g-b-scientific-computing-test.mjs`, first numerical fixture, at `CALCULATION_PYTHON_IDENTITY_MISMATCH`.

`calculationRunner.ts` verifies the manifest digest, exact interpreter bytes and worker digest before admitting a calculation or creating output. The manifest qualifies `/usr/bin/python3` version **3.9.6**, SHA-256 `b8763cf250e607a778bb4603cecb5b90338814d0a3dfcba0d57b1de242f610e9`, profile `darwin-system-python-3.9.6-scipy-gated-v1`. Locally this is a Mach-O universal executable and matches exactly. Ubuntu CI cannot substitute its own interpreter under this authority. These scientific files and the Ubuntu CI configuration are unchanged from production d44; this is an exposed pre-existing environment limitation, not a new scientific regression.

The worker runs only allowlisted declarative methods under `-I -B`, explicit limits, versions, locale/timezone and numerical tolerances. Five stdlib methods execute in the qualified local runtime. They explicitly declare `NETWORK_ISOLATION_NOT_OS_ENFORCED`; a local PASS is **not** proof of hermetic or cross-platform reproducibility. Receipts do not confer source authenticity, scientific interpretation, human approval or live authorization.

The sixth method, Student-t CI, requires the **separate** container authority. `scientificComputeContainerRuntime.v1.json` is cryptographically pinned and explicitly `BLOCKED_UNPROVISIONED`; image/dependency identities are null. It records unresolved artifact/security/isolation blockers, with historical provisioning plans in `docs/STAGE_5E1G_B_R{1,2,3,4}_*.md`. Those dated vulnerability assessments have not been refreshed here and are not claims about current remediation availability. Its engine identity is also host-specific (Docker Desktop arm64). Even a future READY manifest reaches `CONTAINER_EXECUTION_NOT_IMPLEMENTED` in the runner: the production execution adapter remains unfinished. The existing tests verify blocked admission and static invocation policy, not a genuine SciPy execution or isolation probe.

**Disposition: scientific Ubuntu acceptance remains BLOCKED.** No interpreter/manifest/dependency hash, expected numerical result, workflow OS, acceptance criterion or existing test was changed. No image, wheels, runtime, registry credentials or infrastructure was provisioned. A supplemental test executes the actual private loader with denied OS dependencies to prove changed manifest bytes, an untrusted interpreter, symlinks and missing binaries fail before dispatch/writes. It verifies the real worker digest and blocked container policy. This test is additional negative coverage and does not replace the original scientific acceptance suite.

## Required runtime solution, before a green CI claim

The smallest immediate decision is to authorize a separately reviewed runtime-provisioning scope and its artifact/security acceptance requirements. It is not enough to approve a new hash sampled from a runner. A content-addressed Linux runtime can be a common reproducibility target for Linux CI and a macOS container host, but **none is attested and runnable under the current repository contract**.

That implementation must supply:

1. Independently reviewed publisher provenance, signed package metadata, exact OCI platform/image digests, reproducible build recipe, interpreter/stdlib/native libraries, NumPy/SciPy/BLAS versions and artifact hashes. The recorded arm64 candidate is not an amd64 CI authorization. Pin each supported platform or run the same explicitly qualified architecture; do not auto-select an unreviewed local interpreter or floating image.
2. Current exact-artifact SBOM/security disposition meeting existing gates. The dated blocked candidate cannot be declared safe from this inspection. Acquisition/build scope and external resources require separate authorization.
3. The missing bounded, digest-verified container execution/receipt adapter, retaining durable attempt consumption, no retry/replay, request/data/source hashes, worker identity and numerical checks. A READY label alone is insufficient. Review engine/platform qualification and dependencies as part of execution identity, not just Python's version string.
4. Genuine numerical fixtures (including SciPy), repeat/tolerance verification, native dependency identity, and executed negative egress, mount/filesystem, user/capability, resource/timeout probes under the recorded no-network/read-only/no-mount policy. Keep fail-closed rejection for absent, altered or unsupported runtime identities.
5. Only after independent acceptance, update the pinned manifests and their reviewed digest constants together and rerun the unchanged scientific suite in CI and each supported host profile. Preserve receipt compatibility or version the new authority explicitly.

No permissive fallback or runtime acquisition at application startup is proposed. Merely switching CI to macOS might satisfy today's interpreter on one runner, but would neither attest that runner nor implement the scientific container requirements.

## Newly demonstrated compatibility defects and minimal corrections

- **Current scope-review records were quarantined:** `normalizeHistoricalCreatorScript` unconditionally enabled the legacy-only context parser; that parser intentionally rejects `counterEvidenceReview`. A valid strictly normalized script therefore failed historical project loading (new regression before: `false !== true`). The reader now tries the strict parser first, falling back only when strict parsing fails. Approved current scripts and pending previews retain their review provenance; tampered confirmations remain quarantined, and old primary qualification remains ineligible for new operations.
- **Preservation saves still reconciled media:** the actual save handler replaced media references and entered final-video cleanup even when historical content was locked (new regression before: reference writes `1 !== 0`). Such saves now skip both operations. Existing owner/CAS checks and original envelope preservation remain. Normal saves retain existing reconciliation.
- **New project boundary:** project-state loading deliberately recognizes historical scripts; a new project must not use that reader as permission to install obsolete authority. New script installation now also requires strict script normalization; a synthetic legacy clone returns 409 with zero writes. This is a schema/authority gate, not an independent source-truth attestation.

The expanded actual-handler synthetic regression performs consecutive r1→r2→r3 saves/reloads and compares the complete original envelope, including an unknown metadata member, historical approval, pending preview, history, 36 scenes/image/audio references, adjusted narration, one video, nonempty anchored music timing and final URL/signature. Stale CAS, foreign owner, forged bindings/approval and attempted legacy mutations remain blocked. No live database/auth/provider or existing media was used.

## Offline audit correction and authorization boundary

The v3 utility remains **strictly offline**: no Supabase client, URL or credentials, no queries, no writes. Input is a separately owner-authorized complete export of full CreatorLab project rows, including `id`, `user_id`, `flow_type`, canonical envelope and legacy columns. The current task does **not** authorize acquiring that export. Live affected count remains **unknown**.

It now enforces the 20 MiB cap while reading, before accumulating an unlimited stream; rejects malformed/duplicate project IDs without partial output; and uses actual project-state authority validation so an invalid snapshot with null/missing script is not counted as a healthy no-script project. Pending previews are classified independently. Unexpected malformed-state validator failures become a fixed quarantine reason, not a raw exception. Output is counts and fixed reason codes only. Synthetic tests cover scope mismatch, invalid JSON, oversized input, duplicate rows, current/historical pending combinations, invalid snapshots and private-content sentinels.

`counts.current` means **strict script schema is valid**, not renewed research approval or eligibility for six-section generation. Current readiness, factual foundation, counter-review and final prose checks remain separate. Missing script/state is reported as absent, not reconstructed. A supplied file cannot prove population completeness or authenticated provenance by itself.

For a future authorized audit:

1. Obtain explicit authorization for the named owner's read-only metadata export. Use their existing authenticated owner/RLS access path, no new service key; include all pages at a consistent snapshot, unique project IDs, and required columns. Retain export/snapshot integrity privately with directory 0700/file 0600. Never log rows or media URLs.
2. Offline, run `VELTO_AUDIT_OWNER_ID=<authorized-owner-uuid> node --experimental-transform-types scripts/creator-pr45-legacy-audit.mjs < authorized-owner-projects.ndjson`. The owner UUID must come from the separately authorized principal. Do not split an oversized export and claim complete totals without a reviewed bounded aggregation procedure.
3. Verify exit 0 and reconcile `reviewed` with the independently verified owner export count. Retain only aggregate categories/reasons in shared reports. Any mismatch, truncated export or nonzero exit makes the result incomplete; do not report zero affected projects.
4. Quarantined or historical rows require separate review; the audit grants no migration, reapproval, recovery write or generation permission. Handle private export retention/disposal according to the owner's authorization, not automatically.

## Validation record

Before changes on clean exact `18e5922`, all **118/118 critical scripts passed locally** on the pinned Darwin interpreter, including the later long-form script skipped by Ubuntu. This establishes the OS difference without weakening the Linux gate. New current-review loading and no-media-reconciliation assertions then failed as described above and pass after the correction.

Final follow-up results are recorded below after execution. Release remains **NO-GO** until the scientific runtime is independently provisioned/accepted, owner-scoped compatibility population evidence is authorized and reviewed, and a separately authorized fresh-session disposable-project canary verifies real authentication, preservation/reload and current scientific blocking. Do not use historical user projects as write canaries.

No merge, production deployment, authenticated canary, Supabase access, browser interaction, service restart, media generation or export was performed. Existing dirty work on the older local checkout was preserved untouched; this follow-up starts from the fetched GitHub head in a separate worktree.

Executed locally on the follow-up source: TypeScript without incremental cache, no-new-lint-debt, expanded historical compatibility/actual save routes, audit privacy/scope, Issue #42/#44, six-section readiness/handoff, supplemental identity rejection, actual synthetic static-image/video-trim rendering, production build with dummy localhost configuration, and CI contract **PASS**. No services were started for the build. The clean-commit critical-suite result and any subsequent GitHub CI run are reported in the PR's current validation notes; a local Mac PASS cannot supersede the known Ubuntu runtime blocker.
