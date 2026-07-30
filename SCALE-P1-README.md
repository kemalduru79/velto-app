# SCALE-P1 — Durable Queue, Worker and Scale-out Foundation

Bu sprint, Azure veya Redis maliyeti oluşturmadan mevcut Supabase/Postgres ortamını dayanıklı iş kuyruğu olarak kullanır.

## Eklenenler

- `velto_jobs` durable job tablosu
- Atomik `FOR UPDATE SKIP LOCKED` job claim
- Worker lease ve expired lease recovery
- Idempotent enqueue
- Retry, delayed retry ve permanent failure
- Kullanıcı bazlı job status API
- Ayrı Docker worker process
- Birden fazla worker ile scale-out
- İlk worker handler'ları:
  - `runtime_probe`
  - `video_reconcile`

Görsel, ses ve export işlemleri bu ilk kabul adımında otomatik olarak queue'ya taşınmaz. Önce queue ve worker altyapısı doğrulanır; pahalı üretim akışları daha sonra kontrollü olarak etkinleştirilir.

## 1. Dosyaları uygulama

Proje kökünde:

```bash
unzip -o velto-scale-p1-queue-worker.zip -d .

rm -rf .next
npm run build
```

## 2. Supabase migration

Supabase Dashboard → SQL Editor içinde şu dosyanın tamamını çalıştırın:

```text
supabase/migrations/20260730_scale_p1_job_queue.sql
```

SQL başarıyla tamamlanmadan worker başlatılmamalıdır.

## 3. Container ve worker başlatma

Önce varsa mevcut container'ları kapatın:

```bash
docker compose down
```

Web uygulaması ve tek worker:

```bash
docker compose --env-file .env.local up --build
```

Web uygulaması ve iki paralel worker:

```bash
docker compose --env-file .env.local up --build --scale worker=2
```

Worker servisinde `container_name` kullanılmadığı için yatay ölçekleme desteklenir.

## 4. Smoke test

Container'lar çalışırken ayrı terminalde:

```bash
node --env-file=.env.local scripts/scale-p1-smoke-test.mjs
```

Beklenen final mesajı:

```text
SCALE-P1 queue and worker smoke test passed.
```

## 5. Job API

Authenticated enqueue:

```text
POST /api/jobs
Authorization: Bearer <user-access-token>
Content-Type: application/json
```

Örnek body:

```json
{
  "jobType": "runtime_probe",
  "payload": {},
  "idempotencyKey": "runtime-probe-001"
}
```

Kullanıcının son job'ları:

```text
GET /api/jobs?limit=20
Authorization: Bearer <user-access-token>
```

Tek job:

```text
GET /api/jobs/<job-id>
Authorization: Bearer <user-access-token>
```

## Güvenlik ve maliyet

- Queue için yeni ücretli servis eklenmez.
- Service-role key yalnızca server ve worker runtime'ında kalır.
- Job claim RPC'leri anon/authenticated rollere kapalıdır.
- Kullanıcılar yalnızca kendi job kayıtlarını okuyabilir.
- Aynı job iki worker tarafından eş zamanlı alınamaz.
