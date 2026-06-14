"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";
import { useLanguage } from "@/lib/useLanguage";

export default function StoryverseCinematicIntro() {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <ExperienceIntroCard
      eyebrow={isEnglish ? "Child-safe Storyverse" : "Çocuk güvenli Storyverse"}
      title={isEnglish ? "Enter Your Own Story World" : "Kendi Hikâye Dünyana Gir"}
      description={
        isEnglish
          ? "Create safe characters, emotional scenes and exportable story outputs."
          : "Güvenli karakterler, duygulu sahneler ve export edilebilir hikâye çıktıları oluştur."
      }
      tone="storyverse"
      stage="Active Product"
      duration="~40 min"
      ageRange="8–18"
      nextAction={
        isEnglish
          ? "Start with one idea, then build characters, scenes and your final content package."
          : "Bir fikirle başla; sonra karakterleri, sahneleri ve final içerik paketini oluştur."
      }
      primaryCta={isEnglish ? "Start Storyverse" : "Storyverse’e Başla"}
      secondaryCta={isEnglish ? "Explore Story Worlds" : "Hikâye Dünyalarını Keşfet"}
      primaryWorld="storyverse"
    />
  );
}
