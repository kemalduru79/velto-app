# FOUNDATION-P1 — İlk Teslim Paketi

## Bu pakette tamamlananlar

### AUTH-P1 foundation

- Mevcut Supabase sign-in ve sign-up akışları `AuthService` adapter arkasına alındı.
- Sign-up ekranına görünen isim, şifre doğrulama ve koşul onayı eklendi.
- E-posta doğrulama davranışı açık hale getirildi.
- Şifremi unuttum ve parola yenileme ekranları eklendi.
- Server API'leri için ortak bearer-token doğrulama yardımcı katmanı eklendi.
- Azure/Entra veya başka bir OIDC sağlayıcısına geçişte UI'nin yeniden yazılmaması için provider bağımlılığı izole edildi.

### FIN-P1 foundation

- Kullanıcı bazlı kredi hesabı veri modeli eklendi.
- Atomik reserve / settle / release RPC fonksiyonları eklendi.
- Idempotency key desteği eklendi.
- Kullanılabilir, rezerve ve tüketilmiş kredi ayrıştırıldı.
- Provider gerçek maliyeti ve provider request ID kaydı için alanlar eklendi.
- Değiştirilemez kredi ledger tablosu eklendi.
- Provider-independent `CreditEngine` ve `CreditRepository` arayüzü eklendi.
- Güvenli `/api/credits` balance/reserve/settle/release endpoint'i eklendi.

## Bilinçli olarak bir sonraki mikro-sprinte bırakılanlar

- Image, voice, video ve export endpoint'lerinin kredi rezervasyon akışına bağlanması.
- Süresi dolan rezervasyonları otomatik release eden scheduled job.
- Gerçek provider kullanımının final krediye dönüştürülmesi.
- Kullanıcı kredi bakiyesi bileşeni ve ledger ekranı.
- Ticari paket ve ödeme entegrasyonu.

Bu nedenle bu paket kredi motorunun güvenli temelidir; henüz medya üretimini kredi yetersizliğinde otomatik durdurmaz.
