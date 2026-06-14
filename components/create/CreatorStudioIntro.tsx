"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";
import { useLanguage } from "@/lib/useLanguage";

export default function CreatorStudioIntro() {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <ExperienceIntroCard
      eyebrow="CreatorLab"
      title={isEnglish ? "Build Content Like a Professional Creator" : "Profesyonel Creator Gibi İçerik Üret"}
      description={
        isEnglish
          ? "Shape social media ideas, scripts, thumbnails, voice-over and AI-assisted image/video packages."
          : "Sosyal medya fikirleri, script, thumbnail, voice-over ve AI destekli imaj/video paketleri oluştur."
      }
      tone="creator"
      stage="Active Product"
      duration="~45 min"
      ageRange="18+"
      nextAction={
        isEnglish
          ? "Pick a topic, research patterns, create idea cards and prepare a publish-ready creator package."
          : "Bir konu seç, pattern araştır, fikir kartları oluştur ve publish-ready creator paketi hazırla."
      }
      primaryCta={isEnglish ? "Open CreatorLab" : "CreatorLab’i Aç"}
      secondaryCta={isEnglish ? "Browse Formats" : "Formatları İncele"}
      primaryWorld="creatorlab"
    />
  );
}
