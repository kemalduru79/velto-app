# Stage 0.7 — Storage Governance, Recovery & Isolation

## 0.7A — Media Ownership, Metering & Isolation Foundation

Status: implemented as an additive foundation. No delete, Trash UI, quota enforcement, billing, checkout, or CreatorLab workflow change is included. New infrastructure cost is €0.

### Storage-route audit

| Writer | Bucket and path | Authority | Kind / MIME / bytes | Project / scene known | URL | 0.7A coverage |
| --- | --- | --- | --- | --- | --- | --- |
| `creator-store-image` | `images`, `creator/{authUserId}/image/{uuid}.{ext}` | Creator API boundary | image; verified MIME; buffer length | no / no | public | registered |
| `creator-store-video` | `videos`, `creator/{authUserId}/video/queue-{jobId}-{hash}.{ext}` | Creator API boundary plus owner-scoped queue job | video; verified MIME; buffer length | job only / no | public | registered |
| legacy `store-image` | `images`, `storyverse/{authUserId}/image/{uuid}.{ext}` | legacy authenticated media boundary | image; verified MIME; buffer length | no / no | public | registered |
| legacy `store-video` | `videos`, `storyverse/{authUserId}/video/{uuid}.{ext}` | legacy authenticated media boundary | video; verified MIME; buffer length | no / no | public | registered |
| narration `store-audio` | `audio`, `{clientProjectKey}/scene-{clientSceneId}-narration-{time}.mp3` | `authenticateRequest`; never inferred from key | narration audio; provider MIME; buffer length | untrusted logical keys only | public | registered to authenticated owner |
| dialogue `store-dialogue-audio` | `dialogue-audio`, `{clientProjectKey}/scene-{clientSceneId}-dialogue-{time}.mp3` | `authenticateRequest`; never inferred from key | dialogue audio; provider MIME; buffer length | untrusted logical keys only | public | registered to authenticated owner |
| premium music acquisition | configured private bucket, `creator/{authUserId}/music/{entitlementId}/{sha256}.mp3` | authenticated route and owner-scoped project/entitlement | music; `audio/mpeg`; verified download length | yes / no | private, no public URL | registered in production dependency path |
| export service final movie | `movies`, `{clientProjectId}/{safeTitle}-with-audio-{time}.mp4` | **no authenticated owner reaches this process** | final video; `video/mp4`; output buffer/stat known | client project ID / no | public | unresolved; deliberately not guessed |

The audit found no other durable Supabase/object repository upload. `creator-thumbnail` produces a data URL; it is durable only if subsequently sent through `creator-store-image`. Captions and metadata are project JSON, not separately stored objects. Creator export/package endpoints download or package existing assets but do not upload a durable storage object. Storyverse public pages only read project media. The premium music object can be referenced by an entitlement and exports, but is one physical object.

Historical conventions are therefore mixed. In particular, narration/dialogue and movies do not encode an authenticated user, while current image/video and premium music paths do. A path is never used as ownership proof outside the exact route that constructs it from the authenticated principal.

### Registry and physical identity

`velto_media_assets` records the authenticated owner, bucket, storage path, optional public URL, kind, MIME type, byte length, lifecycle timestamps/state, and non-authoritative metadata. `(bucket, storage_path)` is globally unique: storage consumption is a property of the physical object, not its scene appearances. Stage 0.7A writes only `active` rows. `trashed` and `purged` exist solely to make later lifecycle migrations additive.

After a successful owned upload, registration is mandatory. If registration fails, the request fails and logs owner, bucket, path, size, and kind as an orphan-reconciliation record. It does not return an unmetered success and does not delete the uploaded object. This can leave a recoverable orphan, which the admin reconciliation command reports.

### Logical reference graph

`velto_media_asset_references` separates project usage from physical storage. Project deletion may cascade its logical references, but asset foreign keys use `RESTRICT`: losing one project/reference cannot delete an asset row or storage object.

The pure extractor reads only real saved fields: scene `image`/`imageUrl`, `videoUrl`, `audioUrl`, `dialogueAudioUrl`, `assetHistory[].url`, project `exported_movie_url`, and YouTube thumbnail `imageUrl`/`sourceImageUrl`. It normalizes HTTP(S) URLs, rejects data/malformed values, and deterministically deduplicates identical logical slots. A shared Stage 0.6 image produces several logical rows but one asset and one byte charge.

After an owner-authenticated save succeeds, only URLs resolving to that same owner's registered assets are sent to the transactional replacement function. The function independently verifies the project and every asset belong to that owner before replacing references. External, malformed, unknown, and unregistered URLs do not become references. Conceptually these are `EXTERNAL`/`UNKNOWN`/`LEGACY_FIRST_PARTY_UNTRACKED`; only resolved rows are `TRACKED_VELTO_ASSET`.

### Metering and quota foundation

Authoritative usage is:

`SUM(size_bytes), COUNT(*) FROM velto_media_assets WHERE owner_user_id = authenticated principal AND lifecycle_state <> 'purged'`.

Both active and trashed objects remain physical and count toward the commercial/quota-relevant total. Images/thumbnails, videos/final videos, audio/music, and other kinds have truthful optional byte breakdowns. References and repeated project JSON URLs never add bytes.

The pure quota helper returns remaining bytes, ratio, and `NORMAL` below 80%, `APPROACHING` from 80% through below 95%, `CRITICAL` from 95% through below 100%, and `FULL` at or above 100%. Its future `canCreateStorageIncreasingMedia` answer is not wired to any generation route. No final GB capacity, plan, pricing, or persisted quota state exists.

### Isolation, service role, and RLS

The service-role adapter bypasses RLS, so application owner predicates are authoritative. Routes take owners only from `authenticateRequest`, `enforceCreatorApiBoundary`, or the legacy authenticated boundary. Repository inventory, lookup, usage, and reference queries always filter `owner_user_id`. Guessed asset/project IDs are insufficient. The transactional function rejects a project or asset not owned by the supplied authenticated owner.

RLS is defense in depth: authenticated clients receive read-only grants and `SELECT` policies using `auth.uid() = owner_user_id`. They receive no insert/update/delete grants. Mutation and the reconciliation RPC are service-role-only. No legacy security function is changed.

### Legacy reconciliation and current counts

Run a dry audit with:

`node --env-file=.env.local scripts/stage-0-7a-reconcile-media.mjs`

Add `--apply` only after reviewing unresolved output. The command uses exact first-party public URLs present in owner-scoped projects plus Storage metadata. It assigns an object only when exactly one project owner proves ownership. Multiple owners, missing objects, private/unknown conventions, and final movies without an authenticated binding remain unresolved. It is idempotent by physical identity and never deletes.

The live Stage 0.7A migration was manually applied because the linked project's remote migration history was discovered to be empty/drifted. Schema execution and migration-history normalization are deliberately separate; no remote repair or database push was performed by this pass.

The reconciliation command was then run successfully and repeated as a dry-run with identical results:

- Tracked physical assets: **49**
- Tracked bytes: **87,296,537**
- Provable project-referenced candidates: **49**
- Provable candidate bytes: **87,296,537**
- Unresolved candidates: **0**
- Unresolved bytes: **0**

These metrics cover the reconciliation script's project-referenced first-party public-media scope. They do **not** claim that every historical object in every Supabase Storage bucket has been attributed. No storage object was deleted, quota enforcement remained inactive, and no paid infrastructure was added.

### Backup and restore relationship

The registry is the physical media inventory; references describe which saved project logically depends on each object. A later backup can validate that referenced media exists and belongs to the restoring owner. Project JSON export alone is not a complete media backup, and arbitrary JSON restore is not implemented here.

### Remaining internal passes

- 0.7B — Asset Cleanup + Trash + Restore, after final-movie authentication and a reviewed reconciliation run.
- 0.7C — Storage Quota UX + Generation Gate.
- 0.7D — Paid Storage Entitlement + Permanent Cleanup + Recovery Test.
- 0.7E — Independent Security/Recovery Review, if warranted after implementation.

Stage 0.7A-2 routes both final-movie flows through authenticated Next.js boundaries, resolves the project with `getForOwner`, requires an internal export-service token, stores new movies under `creator/{authenticatedUserId}/final/{projectId}/{uuid}.mp4`, and registers the physical object as `final_video` before success. Project save accepts a final URL only when the active registry asset belongs to the authenticated principal. Historical movie objects are not moved or rewritten.

With the scoped reconciliation at zero unresolved candidates and future final movies owner-bound, Stage 0.7A can close and 0.7B design/implementation can start. Permanent physical deletion must still require reference checks, lifecycle safeguards, and a broader bucket inventory before operating beyond the reconciled scope.

## 0.7B-0 — Existing Project Reference Backfill Gate

Stage 0.7A reconciled historical physical objects into `velto_media_assets`, but that operation did not populate `velto_media_asset_references` for projects last saved before deployment. Consequently, an empty reference graph cannot yet be interpreted as proof that an active asset is unused.

The Stage 0.7B-0 admin command reuses the exact `inspectProjectMediaReferences`/`extractProjectMediaReferences` runtime source, loads all saved projects and registered assets with pagination, resolves only exact public URLs owned by each project's `owner_user_id`, and classifies external, unknown, unregistered first-party, and cross-owner candidates. Apply mode calls only `velto_replace_project_media_references`; it does not mutate physical assets or lifecycle state. Any owner conflict blocks all apply RPCs before the first project is changed.

Dry-run first:

```sh
node --env-file=.env.local scripts/stage-0-7b-backfill-media-references.mjs
```

After reviewing zero owner conflicts and expected counts, apply once:

```sh
node --env-file=.env.local scripts/stage-0-7b-backfill-media-references.mjs --apply
```

Then run the default dry-run again. Stable project/resolved counts, populated stored-reference counts, and identical before/after physical asset counts and bytes provide the gate evidence.

No Delete action, Trash action, storage removal, lifecycle mutation, quota enforcement, or billing behavior is enabled by 0.7B-0. Cleanup UI must remain disabled until the live dry-run, apply, and second dry-run prove the historical graph is populated without owner conflicts. Active assets without references may be genuinely unused; they are candidates for later policy review, not automatic deletion.

The pure cleanup-state helper classifies active assets with references as `IN_USE`, active assets without references as `UNREFERENCED`, and trashed assets as `TRASHED`. The repository also provides owner-filtered reference summaries (`projectId`, type, logical key, timestamp) so later UI can explain usage without exposing another user's project information.

## 0.7B-1 — Safe Asset Cleanup, Trash & Restore

Cleanup classification is intentionally fail-closed. Scene image/video, narration/dialogue, thumbnail, final-video, `other`, and every future unknown reference type are blocking and produce `IN_USE`. An active asset referenced only by `asset_history` is `HISTORY_ONLY`; an active asset with no reference is `UNREFERENCED`; a trashed asset is `TRASHED`; purged assets are unavailable. Blocking references always win when mixed with history.

The authenticated media inventory returns only owner-scoped image/video/final-video registry rows and owner-scoped reference summaries. `UNREFERENCED` images and videos appear as compact Available media inside Project Assets; images retain the existing no-credit reuse flow, while cross-scene video reuse remains deferred. `IN_USE` media explains its usage and cannot be trashed. Trash is a secondary disclosure with preview, kind, size, and Restore. There is no top-level storage navigation or permanent-delete action.

For `HISTORY_ONLY`, cleanup is restricted to one exact owner-owned project. If references span multiple projects, the operation stops. The project repository removes only history entries whose normalized URL exactly matches the registered asset URL, preserving current images/videos, narration, dialogue, scene identity, production state, and unrelated history. The server then persists the project, re-extracts/replaces authoritative references, verifies zero remaining references, and only then requests Trash. If the final lifecycle transition fails, the project history remains cleaned but the asset remains active; this is recoverable and cannot lose physical data.

The service-role-only Trash function serializes against reference replacement, re-checks references while holding the asset lock, and permits only `active → trashed` with `trashed_at = now()`. Reference replacement now locks requested assets and accepts only active owner-owned rows, so a concurrent save and Trash cannot produce a saved reference to trashed media. Restore is the narrow owner-scoped optimistic transition `trashed → active`; it clears `trashed_at` but does not recreate former scene or history placements. Restored unreferenced media remains discoverable in Available media.

Trash is reversible logical lifecycle management, not physical deletion. No Storage remove/delete call exists, no API can transition to `purged`, and bucket, path, URL, size, and owner remain unchanged. Physical usage counts both active and trashed objects and excludes only the future physically-removed `purged` state, so moving to Trash never creates fake capacity and restoring never double-counts bytes.

Stage 0.7B-1 adds no quota generation gate, automatic cleanup, billing, paid storage, checkout, or paid infrastructure. Stage 0.7C owns quota UX and generation gating; Stage 0.7D owns permanent cleanup and recovery. No current live asset is transitioned during implementation.

The controlled live lifecycle smoke passed after deployment: owner-scoped inventory, unreferenced Trash, retained physical bytes, Restore without recreated references, in-use rejection, and baseline reference/physical metrics behaved as designed. Stage 0.7B-1 is CLOSED.

## 0.7C — Storage Quota UX & Generation Gate

Physical quota usage is the owner-scoped sum of all retained registry objects: active plus trashed. Only the reserved future `purged` lifecycle is excluded. Quota states are `NORMAL` below 80%, `APPROACHING` from 80% to below 95%, `CRITICAL` from 95% to below 100%, and `FULL` at or above 100%.

No commercial GB allowance has been chosen. `VELTO_STORAGE_LIMIT_BYTES` is a server-only positive safe integer; missing or invalid configuration produces an explicit unconfigured state with real used bytes but no fake limit, percentage, or quota state. `VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED` enables the hard gate only when its exact value is `true` and defaults to false. The authenticated no-store `/api/storage-usage` response derives ownership from the session and exposes only safe usage totals and normalized quota status.

The complete hard gate is installed before credit reservation, provider selection/dispatch, reference-image downloads, and job creation on the active image/video generation entries: image, character image, Creator thumbnail image, Creator video, and Storyverse video POST. A configured enforced `FULL` request returns HTTP 409 with `STORAGE_QUOTA_FULL`, reserves zero credits, calls zero media providers, and enqueues zero generation jobs. `FULL_BUT_NOT_ENFORCED` remains allowed while still powering warning UX.

Storage completion is deliberately not gated. A request admitted below FULL may finish and persist even if another in-flight request crosses the threshold; blocking the completed output would orphan paid provider work. Two concurrent requests immediately below FULL may therefore cause a bounded overshoot during Controlled Alpha. Future requests observe registered physical usage and are blocked. No distributed reservation or paid infrastructure is introduced.

Reuse, Smart Match, project open/edit/save, playback, polling, download, reports, Strategy, Brief, Director/Copilot text actions, metadata/planning, storage inventory, Trash, Restore, narration, dialogue, TTS, and premium music remain available. Trash still does not free capacity. The Project Assets disclosure shows real used storage, a configured progress state when available, retained Trash bytes, and—only for enforced FULL—a clear message and real Manage storage action.

Hard enforcement remains OFF by default until Stage 0.7D supplies at least one recovery path: additional owner entitlement or safe physical purge. Stage 0.7C adds no billing, checkout, plans, subscriptions, permanent deletion, `purged` API, or paid infrastructure.

The Stage 0.7C route audit, quota-state tests, disabled-enforcement behavior, Cost Guard ordering, authenticated usage API, UI warnings, regressions, and production build passed. Stage 0.7C is CLOSED / PASS; hard enforcement remains OFF.

## 0.7D-1 — Safe Permanent Cleanup & Purge Recovery

Permanent cleanup is manual, per item, and disabled by default. Active, referenced, history-only, retention-pending, wrong-owner, already-pending, and purged assets cannot begin purge. `VELTO_TRASH_RETENTION_DAYS` is a server-only non-negative integer with a conservative safety default of 30 days; zero exists only for controlled tests. `VELTO_PERMANENT_MEDIA_DELETE_ENABLED` must equal `true` before the API or UI exposes deletion. No production flag is enabled by this pass.

The additive migration introduces `purge_started_at` plus a unique `purge_token` and service-role-only BEGIN, COMPLETE, ABORT, and locked Restore RPCs. BEGIN locks the owner asset, requires Trash with `trashed_at`, enforces retention, rechecks zero authoritative references, prevents parallel operations, and returns the exact registered bucket/path only to the server adapter. Restore and BEGIN serialize on the same asset row, so exactly one wins. Existing reference replacement still locks assets and accepts only active lifecycle rows.

The initial rollback-only live database smoke exposed a PL/pgSQL name ambiguity in BEGIN's reference check because the unqualified `asset_id` column conflicted with its `RETURNS TABLE` output variable. The additive corrective migration qualifies the reference table as `r.asset_id` and `r.owner_user_id` without changing the applied baseline migration or any other function behavior. The corrected function passed the rollback-only database smoke.

The purge orchestrator performs BEGIN → exact one-object Storage API removal → COMPLETE. Storage failure invokes ABORT, leaves the asset trashed, and keeps its bytes in quota. Once Storage removal succeeds, a COMPLETE failure is never aborted: the durable pending marker and structured recovery event preserve the crash window. The registry row is retained as a purged audit record with owner, original bucket/path, kind, and size; only lifecycle and purge timestamps change. Physical usage falls only after COMPLETE transitions the registry to `purged`.

`stage-0-7d-1-purge-recovery.mjs` is dry-run by default. It classifies pending exact objects as `OBJECT_PRESENT`, `OBJECT_MISSING`, or `UNKNOWN_ERROR`; `--apply` can finalize only `OBJECT_MISSING`. It never deletes present objects, aborts ambiguous operations, performs prefix/bulk cleanup, or guesses. There is no cron, automatic retention cleanup, Empty Trash, or background purger.

The authenticated purge API accepts only `{ "confirmPermanentDeletion": true }`, derives the owner from the session, never accepts bucket/path/owner, and never exposes the purge token. Trash shows the retained date and remaining retention; eligible deletion uses a two-step irreversible confirmation. Successful purge refreshes both media inventory and storage usage, and purged rows disappear from reusable/restorable inventory.

Hard quota enforcement remains OFF. Completion-route activation audit: `creator-store-video` is bound to an owner-scoped succeeded reconciliation job created by the admitted Creator video flow, but `creator-store-image`, legacy `store-image`, and legacy `store-video` accept authenticated bounded media without cryptographic generation-admission proof. Those three routes are a quota bypass if hard enforcement is activated. A future generation-admission/job binding must close this gap before activation; 0.7D-1 does not introduce that broader state machine.

No paid storage, entitlement, checkout, subscription, pricing, automatic payment, plan upgrade, or paid infrastructure is added. The migration file is review-only and no live database or Storage mutation is performed during implementation.

The Stage 0.7D-1 live validation is CLOSED / PASS. The baseline and corrective migrations were applied through the controlled process; rollback-only lifecycle smoke passed; and a newly created disposable PNG completed the physical Storage purge chain. The exact synthetic object was removed, its registry row finalized as `purged`, owner physical usage returned exactly to baseline, and no user media was touched.

## 0.7D-2 — Owner Storage Entitlement + Quota Admission Hardening

The additive provider-neutral entitlement foundation records positive owner grants from `manual`, `payment_provider`, `promotion`, or `migration` sources without selecting a payment vendor. Effective quota is the configured `VELTO_STORAGE_LIMIT_BYTES` base plus all currently active, started, unexpired, unrevoked owner grants. If the base is unconfigured, quota remains `UNCONFIGURED`; additional entitlement bytes remain observable but do not invent a commercial base plan.

Storage-increasing generation completions now use short-lived, opaque, owner-bound admissions. `/api/image` issues image admissions for CreatorLab or Storyverse only after the existing quota gate; Storyverse `POST /api/video` issues a video admission before provider dispatch. BEGIN locks and validates owner, expiry, kind, purpose, unused state, and pending state; upload failure ABORTs; registered completion COMPLETEs and cannot replay. A request admitted below FULL may finish after the owner becomes FULL because completion consumes the prior admission rather than rerunning quota admission.

Caller audit found no legitimate direct user-upload/import use of `creator-store-image`, `store-image`, or `store-video`: all active callers persist provider-generated results. These routes therefore require their exact admission purpose and no longer accept unbound generated media. Character-reference and standalone thumbnail generation currently return data URIs without creating registered physical objects, so no completion admission is issued there. `creator-store-video` remains safe through its existing authenticated, owner-scoped succeeded queue-job and persisted provider-task binding; adding a redundant admission would not strengthen that flow.

If physical upload fails before durable storage, admission coordination is aborted and remains reusable until expiry. Once upload succeeds, registry or admission-finalization failure never aborts; the pending admission plus existing orphan-registration log preserves recovery evidence and prevents replay or invisible success.

Hard quota enforcement remains OFF. No live entitlement or admission rows are created, no paid storage amount is selected, and no checkout, pricing, subscription, payment webhook, vendor coupling, scheduled cleanup, or paid infrastructure is introduced. Live migration and activation smoke remain separate operational gates.

## 0.7D-3A — Final Export Admission Schema Enablement

The Stage 0.7D-3 durable-writer audit found one remaining unsafe image/video writer: both authenticated final movie/export entry paths ultimately create a new physical `movies/creator/{owner}/final/{project}/{uuid}.mp4` object without storage admission. Final export must not reuse an image or Storyverse video purpose because completion must retain exact-purpose validation.

This enablement pass added the dedicated `final_movie_export` value to the `velto_storage_admissions` purpose constraint and the server-only `StorageAdmissionPurpose` union. The original three purposes remain unchanged. Stage 0.7D-3A passed CODE validation, and its schema migration was subsequently applied live with migration history repaired.

Stage 0.7D-3A CODE can close after validation. Stage 0.7D-3, Stage 0.7D, and Stage 0.7 remain open until final export is quota-gated and admission-bound and the broader activation-readiness pass succeeds. Production quota enforcement and permanent deletion remain OFF.

## 0.7D-3B — Final Movie / Export Quota Admission Wiring

The final remaining durable image/video writer bypass is closed in code. Both authenticated export entry routes now resolve the owned project, complete their existing business/service validation, check owner physical quota, and issue an owner/project-bound `video` admission with exact purpose `final_movie_export` before Creator credit reservation or export dispatch. Enforced FULL returns `STORAGE_QUOTA_FULL` before credits, rendering, or physical writes; Storyverse remains non-billable.

The opaque admission identifier travels only through the authenticated server-to-server `x-velto-storage-admission-id` header. Browser-supplied ownership, admission, token, bucket, and path fields are removed from export payloads. The export service requires a valid internal token plus UUID owner, project, and admission identities; verifies the admission's exact owner, video kind, purpose, and `project_reference`; and calls BEGIN before remote media preparation or rendering.

Render and Storage failures before successful upload ABORT the exact admission. The durable boundary is only the successful `movies` upload. After that boundary, the service never aborts: it COMPLETEs the admission, and a completion failure preserves the object and pending coordination while logging `FINAL_MOVIE_STORAGE_ADMISSION_RECOVERY_REQUIRED` without secrets. A later application registry failure cannot reverse the consumed admission or delete the object; the existing orphan-registration recovery evidence remains authoritative.

An export admitted below FULL does not rerun quota during completion and may finish after concurrent work makes the owner FULL. Stage 0.7D-3B closes the final known image/video durable-write bypass in code, but the broader Stage 0.7D-3 activation configuration, diagnostics, and no-cost readiness validation still remain. Production quota enforcement and permanent deletion remain OFF.

Stage 0.7D-3B CODE is CLOSED / PASS.

## 0.7D-3C — Storage Activation Readiness & Operational Closure

Hard-quota activation now fails closed. With enforcement OFF, a missing or malformed `VELTO_STORAGE_LIMIT_BYTES` preserves the Stage 0.7C `UNCONFIGURED`/allowed behavior. With enforcement explicitly ON, a missing, malformed, zero, negative, or unsafe base limit returns HTTP 503 with `STORAGE_QUOTA_CONFIGURATION_ERROR`, `Cache-Control: no-store`, and no raw configuration. Every active quota-gated image, video, thumbnail, and final-export route handles this operational error before admission, credits, provider work, or render dispatch. Reliable usage or entitlement resolution failure is separately classified as `STORAGE_QUOTA_INFRASTRUCTURE_ERROR` and also fails closed with 503 rather than fabricating usage.

Admission TTL remains 60 minutes when unset. An explicit positive safe integer overrides it. An explicit invalid TTL retains the conservative default while enforcement is OFF, but makes activation `NOT_READY_CONFIG` and blocks admission/provider work when enforcement is ON. Effective quota is evaluated with safe-integer arithmetic: base plus active entitlement may reach `Number.MAX_SAFE_INTEGER`, but any overflow is rejected deterministically under either flag state and can never wrap into a smaller usable allowance.

The final durable-writer re-audit classifies generated/admitted image and video writers as A, Creator queue-job completion as C, audio/dialogue/premium music as D, and controlled scripts as E. Unsafe/unclassified category F is 0. `creator-store-video` remains authenticated, owner-scoped, bound to a succeeded persisted queue/provider job, deterministic by queue job and content identity, and `upsert: false`, so replay cannot multiply physical objects. Both final-export routes retain quota-before-Creator-credit ordering, exact owner/project `final_movie_export` admission, service-side BEGIN before render, ABORT only before durable upload, and COMPLETE afterward with no completion-time quota rerun. Creator thumbnail still returns a data URI and is non-durable until it passes through an admitted image storage route.

`stage-0-7d-3-storage-activation-readiness.mjs` is strictly read-only: it selects coordination state and uses service-role OpenAPI discovery without invoking any RPC. Live execution passed table and required RPC discovery with zero malformed media, entitlement, or admission rows, zero pending purges, and zero pending admission consumptions. Its overall activation result is intentionally `NOT_READY_CONFIG` / `NOT_READY` because no commercial base limit has been selected; this is an honest operator gate, not a technical implementation failure. Future pending admissions are never mutated automatically: operators must correlate admission age/purpose with structured recovery logs, the media registry, and exact object identity. Existing recovery/orphan logs preserve the necessary evidence; ambiguity must remain unresolved rather than guessed. The dedicated purge recovery tool remains separate.

`stage-0-7d-3-full-gate-smoke.mjs` performs no provider, credit, Storage, or database mutation. It verified a real owner's read-only physical usage, then passed enforced FULL, non-enforced FULL, missing config, malformed config, overflow, and disabled-unconfigured scenarios through the shared pure quota evaluator. Live result: PASS, six scenarios, zero writes.

Storage entitlements are payment-provider-ready, while no checkout, billing webhook, subscription, pricing, package, currency, or payment provider is integrated. Manual or promotional grants are technically sufficient for Controlled Alpha. The commercial base allowance remains intentionally undecided and is not a Stage 0.7 technical blocker.

Permanent deletion remains OFF. Its code, rollback-only DB lifecycle, disposable live physical purge, exact-byte baseline restoration, and recovery path have passed, so activation may remain a later operator/UI decision. Hard quota also remains OFF. Later activation requires no code change: configure an approved positive `VELTO_STORAGE_LIMIT_BYTES`, retain a valid admission TTL, verify readiness, and explicitly set `VELTO_STORAGE_QUOTA_ENFORCEMENT_ENABLED=true`.

With activation safety, diagnostics, recovery evidence, no-cost gate validation, and writer isolation passing, Stage 0.7D is CLOSED / PASS. No remaining technical or security blocker exists under the canonical Stage 0.7 scope, so full Stage 0.7 is CLOSED / PASS. Commercial allowance selection, quota activation, permanent-delete activation, and payment integration remain deliberate post-Stage operational/product decisions.
