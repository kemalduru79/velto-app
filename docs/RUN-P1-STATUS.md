# RUN-P1 Status

## Tamamlananlar

- [x] Next.js standalone output
- [x] Multi-stage Dockerfile
- [x] Non-root production process
- [x] Container liveness probe
- [x] Core configuration readiness probe
- [x] Runtime secret isolation
- [x] Docker Compose local validation path
- [x] Stateless runtime contract

## Kabul kriterleri

1. `npm run build` başarılıdır.
2. `docker compose --env-file .env.local up --build` container'ı 3000 portunda başlatır.
3. `/api/runtime-health?mode=live` HTTP 200 döner.
4. `/api/runtime-health?mode=ready` temel environment değerleri mevcutken HTTP 200 döner.
5. `node scripts/run-p1-smoke-test.mjs` başarılı tamamlanır.
6. Container yeniden başlatıldığında kullanıcı/proje/medya verisi container filesystem'ine bağlı değildir.

## Sonraki ana faz

SCALE-P1 — Queue, worker ve scale-out altyapısı.
