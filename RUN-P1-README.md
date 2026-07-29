# RUN-P1 — Containerization and Stateless Runtime

Bu paket Velto Studio'yu Next.js standalone container olarak çalıştırır.

## Kapsam

- Multi-stage production Docker image
- Non-root runtime user
- Next.js standalone output
- Public liveness and readiness endpoint
- Container health check
- Runtime secrets kept outside the image
- Local Docker Compose test
- Stateless runtime declaration

## Uygulama

Proje kökünde:

```bash
unzip -o velto-run-p1-container-runtime.zip -d .

rm -rf .next
npm run build
```

Normal local çalışma:

```bash
npm run dev -- --port 3000
```

Container testi için Docker Desktop açık olmalıdır:

```bash
docker compose --env-file .env.local up --build
```

Ayrı terminalde:

```bash
node scripts/run-p1-smoke-test.mjs
```

Container'ı durdurmak için:

```bash
docker compose down
```

## Health endpointleri

Liveness:

```text
GET /api/runtime-health?mode=live
```

Uygulama process'inin çalıştığını doğrular ve provider çağrısı yapmaz.

Readiness:

```text
GET /api/runtime-health?mode=ready
```

Aşağıdaki temel runtime ayarlarının varlığını doğrular:

- Supabase URL
- Supabase anon key
- Supabase service-role key
- OpenAI API key

Secret değerleri response içine yazılmaz.

## Sınırlar

- Bu sprint queue/worker kurmaz; bu SCALE-P1 kapsamıdır.
- Container içinde kalıcı veri tutulmaz. Kalıcı medya ve kayıtlar repository/storage adapter üzerinden dış sistemlerde kalmalıdır.
- Client-side `NEXT_PUBLIC_*` değerleri build sırasında Docker build arg olarak verilir. Diğer secret'lar yalnızca runtime environment olarak aktarılır.
