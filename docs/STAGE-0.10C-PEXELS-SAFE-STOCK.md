# Stage 0.10C — Pexels safe stock

Set `PEXELS_API_KEY` only in the server runtime. Missing configuration disables stock cleanly; the key is never returned, logged, or included in browser bundles.

Authenticated CreatorLab clients call `/api/creator-stock/search`. Queries are trimmed, whitespace-collapsed, lower-cased for cache identity, and normalized behind `StockMediaProvider`. Pexels photos use `/v1/search`; videos use the current `/v1/videos/search` API. Successful normalized metadata is cached in `velto_stock_search_cache` for 24 hours. Errors and credentials are not cached. `velto_delete_expired_stock_search_cache()` provides bounded operational cleanup. Pexels quota headers are parsed, low remaining quota is logged, and 429 is returned as a controlled typed error without retries.

Import uses `/api/creator-stock/import`. The browser submits only the provider media ID, media type, rendition ID, and owned CreatorLab project ID. The server re-resolves metadata, permits only HTTPS `images.pexels.com` or `videos.pexels.com` renditions, applies existing DNS/redirect/content-signature/time/size checks and storage quota rules, then uploads through the existing media store and registers the owned asset. Photo selection targets roughly 1920-class input; video targets HD through roughly 1080p. Same-owner, same-project provider/rendition imports reuse the active registered asset; reuse never crosses a user boundary.

Each import snapshots Pexels identity, source page, creator/profile, attribution, license URL, `2026-08-22` license snapshot date, original and rendition dimensions, duration, bytes, import time, and reuse identity. UI attribution links to the creator/source. The disclosure is informational: source licensing does not guarantee personality, trademark, brand, or property clearance.

Search and import are `not_billable` Pexels operations and do not charge user credits. Request/cache/result and import-byte/rendition/reuse quantities enter the Stage 0.10B ledger. Supabase bandwidth/storage cost remains unknown in the existing storage operation because approved infrastructure rates do not exist.

Stage 0.10D may consume `StockMediaCandidate` for manual-query candidate ranking and concrete production selection. It must retain the explicit import boundary; 0.10C performs no automatic tier routing, semantic ranking, query expansion, or bulk ingestion.
