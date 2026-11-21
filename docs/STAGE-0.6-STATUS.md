# Stage 0.6 — Stock Media / Smart Asset Reuse

## 0.6A — Smart Asset Reuse Foundation

### Audit findings

- CreatorLab initializes new scenes with an empty `assetHistory`. `normalizeCreatorAssetHistory` validates existing entries and adds current images and completed videos, without duplicating an identical kind/URL pair.
- `save-project` sends the complete scene array to the existing project repository. The repository stores that array in the existing project `scenes` field, so `image`, `videoUrl`, `videoGenerationSignature`, and `assetHistory` already share one persistence boundary.
- Loading a project restores the saved scene objects, normalizes stable Creator scene IDs, and retains scene media/history before the existing history normalizer runs.
- Creator Editor Asset History resolves `onRestoreMedia(creatorSceneId, assetId)` against the same stable scene and passes the historical entry to `restoreCreatorSceneAsset`.
- Same-scene image restore replaces the image and removes the current video URL/status, so motion is no longer presented as current. Same-scene video restore retains its stored generation signature and duration. Narration/dialogue fields and stable scene identity are not rewritten.
- Video currentness is derived from the stored signature against the current scene inputs. Narration and dialogue currentness are independently derived from spoken text and voice settings.
- Creator media is stored at durable public object-storage URLs. Those URLs are persisted in the scene JSON and can be reused after save/load without a storage copy.

### Reuse-first architecture

Project Assets is a view derived from the already-loaded scenes in the current CreatorLab project. It is not a second library and has no persistence, fetch, download, similarity hash, or database layer. The derived shape contains a stable derived ID, media kind and URL, source scene identity/number/summary, current-or-history status, and optional creation time/duration. This leaves room for a later local ranking layer without exposing provider, model, routing, hash, or bucket details.

Only assets from the same project scene array are eligible. Current scene media is considered before historical media. Deduplication uses media kind plus a conservative canonical URL: URL fragments are removed and query parameters are sorted, but query values are retained. Current media therefore wins when it duplicates a history URL.

### Image reuse behavior

Project Assets applies one image to one focused Creator Editor scene. It never reads or changes the bulk-selected scene set. The target's existing image is first retained through the existing history normalizer, identical URLs are no-ops, and the target keeps its stable `creatorSceneId` and narration/dialogue state. Any target video, pending signature/job, duration, and trim are cleared so dependent motion cannot appear current. Existing autosave observes the scene-state update; no generation or storage endpoint is called.

Asset History remains the same-scene version restoration tool. Project Assets is the cross-scene, same-project reuse tool.

### Cross-scene video decision

Cross-scene video reuse is intentionally deferred. A stored video signature binds scene text, source image, cinematic continuity inputs, quality, format, and duration. Assigning only its URL to a different scene cannot truthfully represent currentness, trim, narration/dialogue alignment, or scene provenance. Project videos are shown as lightweight, non-autoplay references and remain actionable through Asset History in their original scene.

### Cost and platform safeguards

- Reusing a project image uses no generation credits and does not enter `CreatorCostGuard`.
- No external stock provider, licensing flow, paid API, new database table/schema, new storage service, provider-routing change, generation change, queue/job change, export change, or dependency was added.
- Storyverse is unchanged.

## 0.6B — Local Smart Match

Local Smart Match is a synchronous, deterministic recommendation layer over the existing derived Project Assets collection. It uses only already-loaded scene text, narration, and dialogue. Text is Unicode-normalized and lowercased, punctuation and common English/Turkish stop words are removed, and meaningful target/source terms are compared for overlap. Longer shared terms contribute more relevance. Scene proximity and current-over-history status are deliberately tiny tie-breakers and cannot overcome topical relevance.

The conservative threshold requires meaningful shared context. Unrelated images are not used to fill the two-to-three recommendation target; the UI instead says that no strong project match was found. Recommendations are image-only, exclude the focused scene (including its history), remain inside the same-project scene boundary, and never recommend cross-scene video.

Recommendations are an optional shortcut above All Project Assets. They reuse the existing 0.6A image callback and do not block, replace, or alter media generation. Scores remain internal; visible reasons use creator-friendly language such as Shared topic or Related scene context.

No external API, AI/LLM call, embedding, vector database, media analysis, network request, new persistence, or database change is involved. Incremental operating cost is €0. Storyverse remains unchanged.

## 0.6C — External Stock Source (conditional)

Evaluate an external stock source only if practical testing shows that Project Assets plus Local Smart Match frequently fail to supply suitable media for real CreatorLab projects. Stage 0.6C remains conditional and is not implemented.
