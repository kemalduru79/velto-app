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

`SUM(size_bytes), COUNT(*) FROM velto_media_assets WHERE owner_user_id = authenticated principal AND lifecycle_state = 'active'`.

Images/thumbnails, videos/final videos, audio/music, and other kinds have truthful optional byte breakdowns. References and repeated project JSON URLs never add bytes.

The pure quota helper returns remaining bytes, ratio, and `NORMAL` below 80%, `APPROACHING` from 80% through below 95%, `CRITICAL` from 95% through below 100%, and `FULL` at or above 100%. Its future `canCreateStorageIncreasingMedia` answer is not wired to any generation route. No final GB capacity, plan, pricing, or persisted quota state exists.

### Isolation, service role, and RLS

The service-role adapter bypasses RLS, so application owner predicates are authoritative. Routes take owners only from `authenticateRequest`, `enforceCreatorApiBoundary`, or the legacy authenticated boundary. Repository inventory, lookup, usage, and reference queries always filter `owner_user_id`. Guessed asset/project IDs are insufficient. The transactional function rejects a project or asset not owned by the supplied authenticated owner.

RLS is defense in depth: authenticated clients receive read-only grants and `SELECT` policies using `auth.uid() = owner_user_id`. They receive no insert/update/delete grants. Mutation and the reconciliation RPC are service-role-only. No legacy security function is changed.

### Legacy reconciliation and current counts

Run a dry audit with:

`node --env-file=.env.local scripts/stage-0-7a-reconcile-media.mjs`

Add `--apply` only after reviewing unresolved output. The command uses exact first-party public URLs present in owner-scoped projects plus Storage metadata. It assigns an object only when exactly one project owner proves ownership. Multiple owners, missing objects, private/unknown conventions, and final movies without an authenticated binding remain unresolved. It is idempotent by physical identity and never deletes.

This repository session did not have database credentials and did not run reconciliation, so actual tracked object count, unresolved object count, tracked bytes, and unresolved bytes are **not claimed**. The command prints all four measures when run. Its current scope is project-referenced public objects; a later privileged inventory pass is required to enumerate unreferenced objects and the private premium-music bucket.

### Backup and restore relationship

The registry is the physical media inventory; references describe which saved project logically depends on each object. A later backup can validate that referenced media exists and belongs to the restoring owner. Project JSON export alone is not a complete media backup, and arbitrary JSON restore is not implemented here.

### Remaining internal passes

- 0.7B — Asset Cleanup + Trash + Restore, after final-movie authentication and a reviewed reconciliation run.
- 0.7C — Storage Quota UX + Generation Gate.
- 0.7D — Paid Storage Entitlement + Permanent Cleanup + Recovery Test.
- 0.7E — Independent Security/Recovery Review, if warranted after implementation.

0.7B is not safe to start deleting objects until the export service receives a server-authenticated owner/project binding and unresolved legacy counts are reviewed. The registry/reference foundation itself is ready for continued non-destructive work.
