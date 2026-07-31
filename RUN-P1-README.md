# RUN-P1 — Containerization and Stateless Runtime

Velto Studio, Next.js standalone web container ve ayrı queue worker container'ı olarak çalışır.

## Kapsam

- Multi-stage production Docker image
- Web ve worker için ayrı runtime target'ları
- Non-root process
- Read-only application filesystem
- Ephemeral `/tmp` ve Next.js runtime cache
- Startup environment validation
- Public liveness ve readiness endpoint'leri
- Container health check
- Graceful `SIGTERM` shutdown
- Runtime secrets'in image dışında tutulması
- Scale-out'u engelleyen sabit container adı kullanılmaması

## Lokal doğrulama

Statik RUN-P1 kontrolü:

```bash
npm run test:run-p1
```

Normal build:

```bash
rm -rf .next
npm run build
```

## Container doğrulama

Docker Desktop açıkken:

```bash
npm run container:config
npm run container:up
```

Ayrı terminalde:

```bash
npm run test:run-p1:runtime
```

Kapatma:

```bash
npm run container:down
```

## Environment

`.env.container.example` dosyasını referans al. Gerçek secret değerlerini repository'ye commit etme. Mevcut lokal kullanımda Docker Compose `.env.local` dosyasını okur.

## Health endpoint'leri

- `GET /api/runtime-health?mode=live`: process liveness
- `GET /api/runtime-health?mode=ready`: core environment ve writable temporary filesystem kontrolü

Health response secret değerlerini döndürmez.

## Stateless runtime sözleşmesi

- Kalıcı proje, kredi, job ve medya verisi repository/storage adapter'larında tutulur.
- Geçici işleme dosyaları yalnızca `/tmp` altında oluşturulur.
- Container root filesystem read-only çalışabilir.
- Web container yeniden oluşturulduğunda kullanıcı verisi kaybolmaz.

## Sınırlar

- Queue iş modelinin genişletilmesi SCALE-P1 kapsamındadır.
- Azure deploy tanımı AZR-P1 kapsamındadır.
- Provider secret'ları yalnızca ilgili yetenek etkinleştirildiğinde zorunludur.
