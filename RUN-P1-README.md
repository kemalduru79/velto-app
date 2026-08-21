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

Production dependency kurulumu committed `package-lock.json` dosyasını zorunlu
tutar ve yalnızca `npm ci` kullanır.

Normal build:

```bash
rm -rf .next
npm run build
```

## Container doğrulama

Docker Desktop açıkken:

```bash
node scripts/stage-0-8b-container-validation.mjs
```

Bu doğrulama Compose konfigürasyonunu ve iki image build'ini kontrol eder; web
runtime'ını non-root/read-only olarak çalıştırır; `/tmp`, live/ready endpoint'leri,
worker readiness sıralaması ve idle `SIGTERM` kapanışını doğrular. Runner içindeki
`ffmpeg-static` ve `ffprobe-static` executable'ları ile `/tmp` altında küçük,
deterministik bir medya üretme/probe işlemi de yapar. Docker daemon çalışmıyorsa
komut başarısız olur; bu durum runtime doğrulamasının beklemede olduğu anlamına gelir.
Validator boş bir lokal host portu seçer; normal Compose kullanımı varsayılan olarak
`3000` portunu kullanır ve gerekirse `VELTO_HOST_PORT` ile değiştirilebilir.

Manuel endpoint kontrolü gereken durumda:

```bash
npm run container:up
npm run test:run-p1:runtime
npm run container:down
```

## Environment

`.env.container.example` dosyasını referans al. Gerçek secret değerlerini repository'ye commit etme. Mevcut lokal kullanımda Docker Compose `.env.local` dosyasını okur.

## Health endpoint'leri

- `GET /api/runtime-health?mode=live`: process liveness
- `GET /api/runtime-health?mode=ready`: core environment ve writable temporary filesystem kontrolü

Image-level healthcheck liveness kullanır. Compose worker başlangıç bağımlılığı
ise web'in environment ve `/tmp` kontrollerinden geçen readiness sonucunu kullanır.

Health response secret değerlerini döndürmez.

## Stateless runtime sözleşmesi

- Kalıcı proje, kredi, job ve medya verisi repository/storage adapter'larında tutulur.
- Geçici işleme dosyaları yalnızca `/tmp` altında oluşturulur.
- Stitch runtime'ı image içinde trace edilen `ffmpeg-static` ve `ffprobe-static`
  executable'larını kullanır. `ffprobe-static` paketinin binary sağlamadığı Linux
  mimarilerinde image build'i Debian ffprobe fallback'ini koşullu olarak kurar;
  runtime belirsiz bir sistem `PATH` değerine bağlı değildir.
- Container root filesystem read-only çalışabilir.
- Web container yeniden oluşturulduğunda kullanıcı verisi kaybolmaz.

## Sınırlar

- Queue iş modelinin genişletilmesi SCALE-P1 kapsamındadır.
- Azure deploy tanımı AZR-P1 kapsamındadır.
- Provider secret'ları yalnızca ilgili yetenek etkinleştirildiğinde zorunludur.
