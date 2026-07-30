# SCALE-P1 Status

## Tamamlanan teknik temel

- [x] Durable Postgres job table
- [x] Atomic multi-worker claim with `SKIP LOCKED`
- [x] Lease ownership and expired-lease recovery
- [x] Idempotent enqueue
- [x] Retry and delayed rescheduling
- [x] Permanent failure state
- [x] User-scoped job status API
- [x] Separate Docker worker process
- [x] Horizontal worker scale-out
- [x] Runtime queue smoke test
- [x] Video-status reconciliation handler

## Kabul kriterleri

1. `npm run build` başarılıdır.
2. Migration Supabase SQL Editor'da başarılı tamamlanır.
3. `docker compose --env-file .env.local up --build --scale worker=2` çalışır.
4. Her worker farklı worker ID ile log üretir.
5. Smoke job yalnızca bir worker tarafından claim edilir.
6. `node --env-file=.env.local scripts/scale-p1-smoke-test.mjs` başarılıdır.
7. Container restart sonrasında queued job kaybolmaz.

## Kontrollü sınır

Image, voice ve export job'larının otomatik queue entegrasyonu bu ilk altyapı kabulünde etkin değildir. Bu karar mevcut çalışan medya ve kredi akışlarını tek büyük değişiklikle riske atmamak içindir.
