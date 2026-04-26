# 🚀 AI Experience Lab & Video Platform (VELTO)

Bu proje, AI destekli içerik üretimi ve çocuklar için deneyim odaklı bir **AI Experience Lab platformudur**.

Platform, tek bir üretim aracı olmaktan çıkarılarak:

* çoklu deneyim akışları (flows)
* modüler yapı
* içerik üretim pipeline’ı

üzerine kurgulanmıştır.

---

# 🎯 Ana Amaç

Tek bir platform üzerinden:

* 🎬 AI destekli video üretimi (hikâye, sahne, görsel, ses, video)
* 🧠 çocuklar için deneyimsel öğrenme (AI Experience Lab)
* 📺 YouTube / Shorts içerik üretimi
* 🧩 modüler ve genişletilebilir SaaS altyapı

---

# 🧩 Platform Mimarisi

## Core Engine

Platformun çekirdeği:

* Story generation
* Scene breakdown
* Image generation
* Voice generation
* Video generation (Runway)
* Export pipeline

Bu engine tüm deneyim akışları tarafından ortak kullanılır.

---

## 🔥 Experience Flows (7 Ürün)

Platform 7 farklı deneyim akışı üzerine kuruludur:

### 1. Storyverse Lab

AI destekli çizgi film ve hikâye üretimi
→ Çizgi film + karakter kartı

### 2. AI Career Simulation

Meslek deneyimi ve görev simülasyonu
→ Deneyim raporu

### 3. Interactive Quest

Dallanan hikâye ve seçimli görev
→ Kişisel hikâye

### 4. Build Your AI Character

Kişisel AI karakter tasarımı
→ AI karakter profili

### 5. AI Thinking Lab

Problem çözme ve düşünme becerisi
→ Düşünme raporu

### 6. Content Creator Lab

YouTube / Shorts içerik üretimi
→ Publish-ready video

### 7. AI + Maker Hybrid

AI → fiziksel üretim → VR deneyimi
→ Hibrit proje çıktısı

---

# 🖥️ UI Yapısı

```text
/dashboard        → 7 flow ürün ekranı
/create           → üretim stüdyosu (core engine)
/create?flow=x    → seçilen flow ile üretim
```

---

# ⚙️ Teknoloji Stack

* Next.js (App Router)
* Node.js
* OpenAI (text + logic)
* OpenAI Image
* ElevenLabs (voice)
* Runway (video)
* Supabase (auth + data)
* Vercel (deployment)
* Railway (backend)

---

# 📁 Proje Yapısı

```text
app/
  dashboard/
    page.tsx          → Flow dashboard

  create/
    page.tsx          → Core production engine

components/
  FlowCard.tsx        → Flow kart component

lib/
  flows.ts            → Flow registry (ürün tanımı)
```

---

# 🧠 Geliştirme Prensipleri

* ❗ Mevcut çalışan sistemi bozma
* 🔹 Küçük ve test edilebilir adımlar
* 🔹 Over-engineering yapma
* 🔹 Copy-paste ile ilerlenebilir kod
* 🔹 Modüler yapı (flow bazlı genişleme)

---

# 🚀 Getting Started

```bash
npm run dev
```

Tarayıcıda aç:

```text
http://localhost:3000/dashboard
```

---

# 🔄 Yol Haritası

## Faz 1

* Dashboard + Flow registry
* Create page flow awareness

## Faz 2

* Storyverse tam entegrasyon
* Scenario Engine başlangıcı

## Faz 3

* Diğer flow’ların aktif hale gelmesi
* Video pipeline stabilizasyonu

## Faz 4

* YouTube automation
* Experience Lab fiziksel entegrasyon

---

# ⚠️ Not

Bu proje klasik bir eğitim platformu değildir.

👉 Bu bir **AI deneyim ve üretim platformudur**

---

# 👤 Kullanım Modları

* 👨‍👩‍👧 Parent Mode → Experience Lab
* 🛠 Admin Mode → Content Engine

---

# 📌 Gelecek Vizyon

* AI + VR + Maker birleşimi
* Çocuklar için üretim odaklı eğitim
* AI içerik üretim pipeline’ı
* global YouTube içerik ağı

---

# 🧩 Katkı

Bu proje aktif olarak geliştirme aşamasındadır.
Tüm geliştirmeler **ürünleşme ve deneyim odaklı** ilerlemektedir.

---
## 🎧 TTS Not

ElevenLabs kullanılırken, sahne veya anlatım yönlendirmeleri
(ör: "sakin, doğal anlatım tonu") otomatik olarak temizlenir.

Bu sayede seslendirme sadece konuşma metni üzerinden yapılır.