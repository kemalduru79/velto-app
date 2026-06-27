"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";
import { useLanguage } from "@/lib/useLanguage";

export default function StoryverseCinematicIntro() {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <ExperienceIntroCard
      eyebrow={isEnglish ? "Storyverse Safety Studio" : "Storyverse Güvenli Stüdyo"}
      title={isEnglish ? "A premium story studio for young creators." : "Genç yaratıcılar için premium hikâye stüdyosu."}
      description={
        isEnglish
          ? "Storyverse helps children and teenagers turn one safe idea into characters, scenes, narration and exportable story outputs with calm guidance and strict content boundaries."
          : "Storyverse çocukların ve gençlerin güvenli bir fikri karakterlere, sahnelere, anlatıma ve export edilebilir hikâye çıktılarına dönüştürmesini; sakin yönlendirme ve güçlü içerik sınırlarıyla sağlar."
      }
      tone="storyverse"
      stage="Active Product"
      duration="~40 min"
      ageRange="8–18"
      nextAction={
        isEnglish
          ? "Start with a safe premise, define the visual world, shape characters and move toward a controlled story package without exposing young users to unsafe prompts."
          : "Güvenli bir fikirle başla, görsel dünyayı tanımla, karakterleri oluştur ve genç kullanıcıları riskli prompt alanlarına maruz bırakmadan kontrollü hikâye paketine ilerle."
      }
      primaryCta={isEnglish ? "Open Storyverse Studio" : "Storyverse Stüdyoyu Aç"}
      secondaryCta={isEnglish ? "View Safe Story Path" : "Güvenli Hikâye Yolunu Gör"}
      primaryWorld="storyverse"
    />
  );
}
