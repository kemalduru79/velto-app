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
