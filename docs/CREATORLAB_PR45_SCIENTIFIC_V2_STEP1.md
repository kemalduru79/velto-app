# Scientific Runtime v2 — completed disabled Offline Step 1

Reviewed base: `ba55a5bdc65d9016f88f65b6411de35c9acbff97`. This change is a separate dependent draft PR targeting PR #45's head branch, `codex/issue-44-counter-evidence-review`. It does not update or merge PR #45. The associated remediation plan is retained as historical design/provenance, not artifact or execution authorization.

**Offline scaffold: COMPLETE within the explicitly disabled scope. Durable admission: BLOCKED. Real v2 execution: DISABLED / qualification BLOCKED. PR #45 and this dependent PR remain Draft; production NO-GO.**

## Review history and final correction

The first implementation review demonstrated four failures: timer-only success under event-loop starvation, path-based receipt redirection, unsafe-integer semantic equivalence through JS rounding, and unbounded empty-chunk metadata. Those were corrected. A fresh read-only review then accepted committing the disabled scaffold with one nonblocking LOW finding: shadowable TypedArray metadata could undercount actual output bytes. That final finding is now corrected and regression-tested.

This final implementation is self-validated after that review. Its synthetic results do not establish real Linux, SciPy, artifact authentication, OS isolation or durable storage acceptance.

| Failure | Before | Completed offline behavior |
| --- | --- | --- |
| Monotonic deadlines | 60 ms synchronous completion could succeed under a 5 ms timer | Captured monotonic clock checked after execution, validation and abort teardown; separately checked cleanup completion/validation/teardown. Overdue success cannot produce a receipt. Timers assist cancellation, not success decisions. |
| Filesystem identity | Mutable options or ancestor replacement redirected reconciliation/receipt files | No filesystem provider is installed. `runOfflineScientificV2` unconditionally rejects DIRECTORY_RELATIVE_PERSISTENCE_UNAVAILABLE before reading arguments, admission, dispatch or writes. No path-revalidation substitute is credited. |
| Numeric integrity | 9007199254740993 producer bytes and outer 9007199254740992 compared equal after rounding | Unsafe-range values and nonzero underflow reject; separately retained decimal lexemes compare without numeric rounding. Supported producer resultJson bytes and SHA-256 remain unchanged. |
| Empty/chunk metadata | 100,000 empty chunks could be retained without consuming a byte budget | Empty chunks ignored; each stream independently retains at most 4,096 nonempty chunks and 1,000,000 actual bytes. |
| Shadowed TypedArray metadata | A 1,000,001-byte stderr view reporting byteLength=1 produced a volatile receipt | Captured intrinsic TypedArray metadata determines actual type, buffer, offset and byte length. The remaining stream budget is checked before payload allocation/copy. Copying uses a native bounded view and intrinsic TypedArray-to-TypedArray set, ignoring instance length, buffer, offset and iterator overrides. Actual overflow rejects before copy and produces no receipt. |

## Boundaries preserved

- `executeScientificContainerV2` always throws REAL_EXECUTION_DISABLED. No environment variable, profile object, callback or enablement flag can change that boundary. There is no real container/process/network transport or provisioning implementation.
- Explicit profile selection preserves Darwin v1 behavior and all original identity checks. Unknown, unavailable and unqualified profiles reject without fallback. Both Linux profile IDs remain unqualified and unselectable.
- Profile shape/hash validation is content consistency, not authenticated artifact/issuer/security authority. No qualified OCI artifact or Linux/SciPy profile has been registered.
- The non-re-exported `modelOfflineScientificV2` uses explicitly volatile synthetic storage. It snapshots options, validated request/profile and callbacks before awaits, models exclusive admission and consumed-before-dispatch ordering, reconciles terminal failures without retries, and compares receipts against independently retained expected evidence.
- Every accepted model receipt declares OFFLINE_SYNTHETIC, VOLATILE_SYNTHETIC_ONLY, NOT_ESTABLISHED, liveAuthorization:false, and false source-authenticity, scientific-interpretation and human-approval flags. Hashes are not signatures. The model and callback mode strings are not an arbitrary-JavaScript sandbox.
- No production CreatorLab route imports the adapter/model. The scientific barrel exports profiles/contracts but not the synthetic adapter. Editorial, generation, autosave, authorization and project state behavior are unchanged.
- Chunk representations must have genuine Uint8Array internal slots and fixed, nonshared ArrayBuffer backing. Buffer and bounded genuine Uint8Array views are supported. Proxies, fakes, DataView, non-byte typed arrays, shared, detached and resizable backing stores reject OUTPUT_INVALID. Caller metadata/iterator overrides are not consulted. Output remains copied rather than retained by mutable alias.
- Result numbers use the restricted finite binary64 domain with magnitude at most 9007199254740991. Tokens are bounded to 128 characters and exponent magnitude 1,000; nonzero underflow and unsafe integral decimal lexemes reject. Equivalent decimal/exponent forms compare by exact normalized decimal identity; distinct decimals rounding to one double do not. Signed zero is equivalent. This does not alter v1 mathematical definitions or tolerances.

## Durable admission remains intentionally unavailable

Portable Node fs has no openat/mkdirat directory capability. A Darwin `/dev/fd/<directory-fd>/file` probe failed ENOENT; leaf O_NOFOLLOW or path rechecks cannot prove safety against ancestor replacement. The implementation therefore fails closed rather than adding a native helper, provisioning dependency or unsafe fallback.

Volatile tests do **not** qualify v2 exclusive/fsynced persistence, 0700/0600 permissions, immutable directory identity or crash-durable replay. Those remain mandatory requirements of a future separately reviewed directory-relative provider. Existing v1 persistence and its original tests are unchanged.

## Exact publication scope (14 files)

Runtime and serialization:
1. `lib/creator/scientificReview/runtimeProfiles.ts`
2. `lib/creator/scientificReview/runtimeV2Contracts.ts`
3. `lib/creator/scientificReview/runtimeV2Adapter.ts`
4. `lib/creator/scientificReview/index.ts`
5. `scripts/scientific-review/scientific_result_v2.py`

Offline tests and fixtures:
6. `scripts/scientific-runtime-v2-test.mjs`
7. `scripts/scientific-runtime-v2-contracts-test.mjs`
8. `scripts/scientific-runtime-v2-adapter-test.mjs`
9. `scripts/fixtures/scientific-runtime-v2.mjs`
10. `scripts/fixtures/scientific-runtime-v2-protocol-probe.py`

Registration/documentation:
11. `package.json` — one offline command, no dependency changes.
12. `scripts/stage-0-8a-critical-regression.mjs` — add aggregate without removing existing gates.
13. `docs/CREATORLAB_PR45_SCIENTIFIC_V2_STEP1.md` — this report.
14. `docs/CREATORLAB_PR45_SCIENTIFIC_REMEDIATION_PLAN.md` — unchanged reviewed preparation plan, published as associated documentation.

The final LOW correction changes only the adapter, lifecycle tests and this report relative to the freshly reviewed implementation. No source or uncommitted work in other checkouts is included.

## Final local validation

Executed on Darwin arm64 with Node 24.14.1; hosted Linux CI uses Node 22 and is not represented as qualified by these local results.

| Check | Result |
| --- | --- |
| Complete offline v2 aggregate | PASS: profile/protocol contracts, all six synthetic output schemas and **48 lifecycle checks** |
| Shadowed actual byteLength regression | PASS on both streams: actual 1,000,001 bytes reporting 1 reject OUTPUT_LIMIT_EXCEEDED, no receipt |
| Byte/chunk exact boundaries | PASS: 1,000,000 bytes and 4,096 nonempty chunks accepted; next byte/chunk rejected independently per stream; cumulative actual bytes enforced |
| Representation/copy safety | PASS: poisoned instance metadata/iterators ignored, nonzero offsets copied accurately, later source mutation cannot alter retained bytes; seven unsafe representation types reject |
| Earlier starvation/cleanup/interrupt/replay/tamper/privacy regressions | PASS, retained in the complete aggregate |
| Fresh-review standalone probes rerun | PASS: all 52 scenarios rerun; the formerly successful shadowed-byte diagnostic now rejects. A fresh scratch directory was used after the initial reused-directory run encountered EEXIST; no implementation assertion failed. |
| TypeScript `--noEmit --incremental false` | PASS |
| `npm run lint:changed` | PASS, includes untracked source |
| `npm run test:ci-contract` | PASS |
| CreatorLab scientific import boundary | PASS, 8 routes / 139 modules |
| Supplemental scientific runtime identity rejection | PASS, not numerical runtime qualification |
| Original Darwin scientific acceptance | PASS **14/14** with original pins and assertions; genuine SciPy BLOCKED_CONTAINER_UNPROVISIONED, actual isolation NOT RUN |
| Original source/identity preservation | v1 runner/contracts/container/authority, manifests, worker, scientific acceptance test and both CI workflows byte-identical to reviewed base |

The original fresh independent review permitted committing the disabled scaffold; this final correction closes its LOW finding. No mathematical/security assertion, manifest, interpreter/image/worker pin, workflow or branch protection was relaxed. No real container, acquisition/provisioning, production/database/project/media access, service restart, deployment or merge is included.

## Remaining gates / release recommendation

1. Independently review any future directory-relative persistence implementation and prove exclusive creation, fsync, private permissions, race resistance and durable crash/replay handling before enabling durable admission.
2. Obtain separately reviewed platform-specific OCI/dependency/issuer/security/engine/supervisor authority and explicit acquisition/execution authorization. No qualified artifacts exist in this change.
3. Implement and independently qualify real numerical/SciPy, OS isolation, resource, interruption, parent-loss and scoped cleanup behavior before enabling any Linux profile or replacing any scientific pin.
4. Rerun both hosted CI lanes under qualified authority. The unchanged Ubuntu Darwin-interpreter identity failure remains expected; this commit does not fix or waive it. Full hosted CI/build is not claimed here.
5. Maintain PR #45 and the dependent PR as Draft / production NO-GO. Committing this disabled scaffold is not merge, deployment or real runtime authorization.
