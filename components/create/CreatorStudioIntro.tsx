"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";
import { useLanguage } from "@/lib/useLanguage";

export default function CreatorStudioIntro() {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <ExperienceIntroCard
      eyebrow="CreatorLab"
      title={isEnglish ? "Professional creator production engine." : "Profesyonel creator üretim motoru."}
      description={
        isEnglish
          ? "Turn one topic into a publish-ready content system: hook, script, scenes, thumbnail, voice direction, metadata and multi-format export planning."
          : "Tek bir konuyu yayına hazır içerik sistemine dönüştür: hook, script, sahneler, thumbnail, voice yönü, metadata ve çok formatlı export planı."
      }
      tone="creator"
      stage="Active Product"
      duration="~45 min"
      ageRange="18+"
      nextAction={
        isEnglish
          ? "Start with a topic, define the creative angle, build the production package, then move into assets and platform-ready publishing outputs."
          : "Bir konu ile başla, kreatif açıyı netleştir, üretim paketini oluştur; ardından asset ve platforma hazır yayın çıktısına ilerle."
      }
      primaryCta={isEnglish ? "Build Production Package" : "Üretim Paketi Oluştur"}
      secondaryCta={isEnglish ? "Review Pipeline" : "Üretim Hattını İncele"}
      primaryWorld="creatorlab"
    />
  );
}
