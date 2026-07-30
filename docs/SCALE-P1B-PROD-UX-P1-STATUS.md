# SCALE-P1B + PROD-UX-P1 Status

## Kapsam

- [x] Velto Studio video provider task'larını durable queue'ya bağlama
- [x] Worker sonucunu authenticated job-status API üzerinden takip etme
- [x] Queue job ID'sini sahne snapshot'ında saklama
- [x] Sayfa yenilenmesi sonrasında queue polling'e devam etme
- [x] Queue erişilemezse mevcut doğrudan polling akışına güvenli geri dönüş
- [x] Storyverse video akışını değiştirmeme
- [x] Script / Visual / Audio alanını belirgin Scene Production Navigator'a dönüştürme
- [x] Aktif, hazır ve bekleyen durumlarını ilk bakışta ayırma
- [x] Sahne başına 3 adımlı tamamlanma sayacı

## Bu adımda hariç tutulanlar

- Export render işinin worker'a taşınması
- Görsel ve ses üretiminin worker'a taşınması
- Provider maliyet raporu

Export queue entegrasyonu SCALE-P1C olarak ele alınacaktır.
