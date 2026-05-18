"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";
import { useLanguage } from "@/lib/useLanguage";

export default function StoryverseCinematicIntro() {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <ExperienceIntroCard
      eyebrow={isEnglish ? "Cinematic Storyverse" : "Sinematik Storyverse"}
      title={isEnglish ? "Enter Your Own Story World" : "Kendi Hikâye Dünyana Gir"}
      description={
        isEnglish
          ? "Create magical characters, emotional scenes and a cartoon-style adventure."
          : "Sihirli karakterler, duygulu sahneler ve çizgi film tarzında bir macera oluştur."
      }
      tone="storyverse"
      stage="Active Product"
      duration="~40 min"
      ageRange="8–14"
      nextAction={
        isEnglish
          ? "Start with one idea, then build characters, scenes and your final movie."
          : "Bir fikirle başla; sonra karakterleri, sahneleri ve final filmini oluştur."
      }
      primaryCta={isEnglish ? "Start Storyverse" : "Storyverse’e Başla"}
      secondaryCta={isEnglish ? "Explore Story Worlds" : "Hikâye Dünyalarını Keşfet"}
      primaryWorld="storyverse"
    />
  );
}
