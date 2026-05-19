export type CareerMissionLanguage = "en" | "tr";

export type CareerMissionPhase =
  | "briefing"
  | "first-response"
  | "pressure-rising"
  | "critical-choice"
  | "reflection-ready";

export interface CareerMissionStateInput {
  language: CareerMissionLanguage;
  childTurnCount: number;
  latestChildMessage?: string;
}

export interface CareerMissionState {
  phase: CareerMissionPhase;
  label: string;
  headline: string;
  description: string;
  intensity: number;
  atmosphere: string;
  mentorInstruction: string;
}

function detectAtmosphere(message: string | undefined, language: CareerMissionLanguage): string {
  const normalized = (message ?? "").toLowerCase();

  if (/team|crew|patient|people|ekip|mürettebat|hasta|insan/.test(normalized)) {
    return language === "en"
      ? "The mission atmosphere shifts toward team safety and trust."
      : "Görev atmosferi ekip güvenliği ve güven duygusuna doğru değişiyor.";
  }

  if (/check|verify|data|sensor|test|kontrol|doğrula|veri|sensör/.test(normalized)) {
    return language === "en"
      ? "The mission slows down as you verify evidence before acting."
      : "Harekete geçmeden önce kanıtı doğruladığın için görev ritmi yavaşlıyor.";
  }

  if (/risk|emergency|danger|manual|acil|tehlike|risk/.test(normalized)) {
    return language === "en"
      ? "Pressure rises. The mentor is watching how you handle uncertainty."
      : "Baskı artıyor. Mentorun belirsizliği nasıl yönettiğini izliyor.";
  }

  if (/new|different|creative|alternate|yeni|farklı|yaratıcı|alternatif/.test(normalized)) {
    return language === "en"
      ? "A creative path opens, but the mentor wants you to keep it safe."
      : "Yaratıcı bir yol açılıyor, ancak mentorun bunun güvenli kalmasını istiyor.";
  }

  return language === "en"
    ? "The mission channel is stable. Your mentor is reading your next signal."
    : "Görev kanalı stabil. Mentorun bir sonraki sinyalini okuyor.";
}

export function getCareerMissionState(input: CareerMissionStateInput): CareerMissionState {
  const { childTurnCount, language, latestChildMessage } = input;

  if (childTurnCount <= 0) {
    return {
      phase: "briefing",
      label: language === "en" ? "Mission waiting" : "Görev beklemede",
      headline: language === "en" ? "The mission is waiting for your first move" : "Görev ilk hamleni bekliyor",
      description:
        language === "en"
          ? "Write what you would do in your own words. Your mentor will react to your reasoning, not a fixed answer."
          : "Ne yapacağını kendi cümlelerinle yaz. Mentorun sabit bir cevaba değil, düşünme biçimine tepki verecek.",
      intensity: 12,
      atmosphere:
        language === "en"
          ? "Mission channel open. No decision has been made yet."
          : "Görev kanalı açık. Henüz karar verilmedi.",
      mentorInstruction:
        language === "en"
          ? "Start with what you would check, protect, or say first."
          : "Önce neyi kontrol edeceğini, kimi koruyacağını veya ne söyleyeceğini yaz.",
    };
  }

  if (childTurnCount === 1) {
    return {
      phase: "first-response",
      label: language === "en" ? "First signal detected" : "İlk sinyal algılandı",
      headline: language === "en" ? "Your first decision changed the mission tone" : "İlk kararın görev tonunu değiştirdi",
      description:
        language === "en"
          ? "The mentor is now watching how you connect safety, timing and people under pressure."
          : "Mentorun artık baskı altında güvenlik, zamanlama ve insanları nasıl bağladığını izliyor.",
      intensity: 32,
      atmosphere: detectAtmosphere(latestChildMessage, language),
      mentorInstruction:
        language === "en"
          ? "Explain the next move and name the risk you are trying to reduce."
          : "Bir sonraki hamleyi açıkla ve azaltmaya çalıştığın riski adlandır.",
    };
  }

  if (childTurnCount === 2) {
    return {
      phase: "pressure-rising",
      label: language === "en" ? "Pressure rising" : "Baskı artıyor",
      headline: language === "en" ? "The mission is becoming more personal" : "Görev daha kişisel hale geliyor",
      description:
        language === "en"
          ? "Your mentor is no longer only looking at the action; they are reading the kind of leader you are becoming."
          : "Mentorun artık yalnızca eyleme değil, nasıl bir lidere dönüştüğüne bakıyor.",
      intensity: 58,
      atmosphere: detectAtmosphere(latestChildMessage, language),
      mentorInstruction:
        language === "en"
          ? "Show how you would keep people calm while making the next decision."
          : "Bir sonraki kararı verirken insanları nasıl sakin tutacağını göster.",
    };
  }

  if (childTurnCount === 3) {
    return {
      phase: "critical-choice",
      label: language === "en" ? "Critical choice" : "Kritik seçim",
      headline: language === "en" ? "The mission has reached a turning point" : "Görev bir dönüm noktasına ulaştı",
      description:
        language === "en"
          ? "The next response should connect evidence, empathy and courage. Your mentor is preparing the final reflection."
          : "Sıradaki cevap kanıtı, empatiyi ve cesareti bağlamalı. Mentorun final yansımasını hazırlıyor.",
      intensity: 78,
      atmosphere: detectAtmosphere(latestChildMessage, language),
      mentorInstruction:
        language === "en"
          ? "Make the hard call and explain why it protects the mission."
          : "Zor kararı ver ve bunun görevi neden koruduğunu açıkla.",
    };
  }

  return {
    phase: "reflection-ready",
    label: language === "en" ? "Reflection ready" : "Yansıma hazır",
    headline: language === "en" ? "Your mentor has enough signals for a reflection" : "Mentorun yansıma için yeterli sinyale sahip",
    description:
      language === "en"
        ? "The mission can now become a mentor reflection and, later, a cinematic mission memory."
        : "Görev artık mentor yansımasına ve daha sonra sinematik görev anısına dönüşebilir.",
    intensity: 100,
    atmosphere: detectAtmosphere(latestChildMessage, language),
    mentorInstruction:
      language === "en"
        ? "Add one final sentence about what this mission taught you."
        : "Bu görevin sana ne öğrettiğine dair son bir cümle ekle.",
  };
}
