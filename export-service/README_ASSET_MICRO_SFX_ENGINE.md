VELTO Asset-Based Micro SFX Engine v1

Bu paket, procedural ambience yerine gerçek kısa SFX assetlerini kullanır.

Ne değişti?
- assets/sfx klasörü eklendi.
- server.js sahne metni/narration/dialogue içeriğine göre otomatik SFX seçer.
- Manuel her video/senaryo için mp3 eklemen gerekmez.
- Dockerfile assets klasörünü container içine kopyalayacak şekilde güncellendi.

Önerilen Railway env:
ENABLE_MICRO_SFX=true
ENABLE_AMBIENCE=false
MICRO_SFX_MAX_SCENES=8

Önemli:
- Eğer daha kaliteli profesyonel SFX bulursan, aynı isimlerle assets/sfx içindeki dosyaları değiştirmen yeterli.
- Kod değiştirmene gerek yok.

Test için iyi konu:
How do rockets fly in space?

Beklenen:
- Rocket sahnelerinde rocket_launch efekti
- Question/hook sahnelerinde curiosity_pop efekti
- Underwater/octopus sahnelerinde bubbles efekti
