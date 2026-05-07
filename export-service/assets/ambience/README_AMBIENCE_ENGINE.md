# VELTO Dynamic Ambient Engine v1

Bu paket gerçek ses dosyası gerektirmeyen, FFmpeg lavfi tabanlı prosedürel ambience katmanı ekler.

## Ne yapar?
- Sahne metninden keyword tespiti yapar.
- Rocket, underwater, space, nature, magic, tech gibi sahnelere çok düşük seviyeli atmosfer sesi ekler.
- Narration ve dialogue öncelikli kalır; ambience arka planda çok düşük volume ile çalışır.
- Sürekli background music yerine sahneye göre hafif atmosfer sağlar.

## Yeni asset gerekli mi?
Hayır. Bu v1 sürümünde ambience sesleri FFmpeg tarafından procedural üretilir.

## Değiştirilecek dosya
Railway export servisinde sadece:

server.js

replace edilmelidir.

## package.json / Dockerfile
Değişiklik gerektirmez.
