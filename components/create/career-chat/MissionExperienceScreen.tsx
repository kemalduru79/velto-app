"use client";

import { useEffect, useMemo, useState } from "react";
import MissionHelmetOverlay from "./MissionHelmetOverlay";
import MissionCrewRelay from "./MissionCrewRelay";
import MissionCommandInput from "./MissionCommandInput";
import MissionTransmissionSurface from "./MissionTransmissionSurface";

type MissionCharacterView = {
  name: string;
  role: string;
  channel: string;
  openingLine: string;
};

type MissionStageView = {
  title: string;
  context?: string;
  mentorHint?: string;
  thinkingQuestion: string;
};

type MissionKnowledgeCardView = {
  title: string;
  explanation: string;
  whyItMatters: string;
  affectedSystems: string[];
  suggestedQuestion: string;
};

type MissionScenarioVariantView = {
  title: string;
  briefing: string;
  character: MissionCharacterView;
  stage: MissionStageView;
  knowledgeCards: MissionKnowledgeCardView[];
  signalLabel: string;
};

type MissionMessageView = {
  role: "child" | "mentor" | "character";
  text: string;
  speaker?: string;
};

type MissionExperienceScreenProps = {
  language: string;
  professionKey: string;
  professionTitle: string;
  missionTitle: string;
  missionBriefing: string;
  mentorName: string;
  missionCharacter: MissionCharacterView;
  activeMissionStage: MissionStageView;
  knowledgeCards: MissionKnowledgeCardView[];
  messages: MissionMessageView[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  streamingMentorText?: string;
};


function buildScenarioVariants({
  isTurkish,
  professionKey,
  missionTitle,
  missionBriefing,
  missionCharacter,
  activeMissionStage,
  knowledgeCards,
}: {
  isTurkish: boolean;
  professionKey: string;
  missionTitle: string;
  missionBriefing: string;
  missionCharacter: MissionCharacterView;
  activeMissionStage: MissionStageView;
  knowledgeCards: MissionKnowledgeCardView[];
}): MissionScenarioVariantView[] {
  const fallbackCards = knowledgeCards.length > 0 ? knowledgeCards : [];

  if (professionKey === "doctor") {
    return [
      {
        title: missionTitle,
        briefing: missionBriefing,
        character: missionCharacter,
        stage: activeMissionStage,
        knowledgeCards: fallbackCards,
        signalLabel: isTurkish ? "Hasta triyaj kanalı" : "Patient triage channel",
      },
      {
        title: isTurkish ? "Acil Servis Öncelik Görevi" : "Emergency Room Priority Mission",
        briefing: isTurkish
          ? "Acil servise aynı anda üç hasta geldi. Görevin panik yaratmadan ilk güvenli önceliği belirlemek."
          : "Three patients arrive at the emergency room at once. Your mission is to identify the first safe priority without creating panic.",
        character: {
          name: isTurkish ? "Dr. Lina Aras" : "Dr. Lina Aras",
          role: isTurkish ? "Acil Servis Uzmanı" : "Emergency Physician",
          channel: isTurkish ? "Acil Durum Kanalı" : "Emergency Channel",
          openingLine: isTurkish
            ? "Hastaların durumunu sakin şekilde aktarabilirim. İlk olarak hangi bilgiyi netleştirmemi istersin?"
            : "I can calmly report the patient conditions. What should I clarify first?",
        },
        stage: {
          title: isTurkish ? "İlk güvenli önceliği seç" : "Choose the first safe priority",
          context: isTurkish ? "Acil servis kalabalık ama kontrol edilebilir durumda." : "The emergency room is crowded but controllable.",
          mentorHint: isTurkish ? "Önce yaşamı tehdit eden riskleri ayır." : "Separate life-threatening risks first.",
          thinkingQuestion: isTurkish ? "Hangi bilgi hastanın güvenliği için önce netleşmeli?" : "Which information must be clarified first for patient safety?",
        },
        knowledgeCards: [
          {
            title: isTurkish ? "Triyaj" : "Triage",
            explanation: isTurkish ? "Triyaj, en acil yardıma ihtiyaç duyan hastayı belirleme yöntemidir." : "Triage identifies who needs help most urgently.",
            whyItMatters: isTurkish ? "Yanlış öncelik, kritik hastanın beklemesine yol açabilir." : "The wrong priority can delay care for a critical patient.",
            affectedSystems: isTurkish ? ["Hasta güvenliği", "Zaman yönetimi", "Ekip koordinasyonu"] : ["Patient safety", "Time management", "Team coordination"],
            suggestedQuestion: isTurkish ? "Önce hangi hastanın solunum ve bilinç durumunu kontrol etmeliyiz?" : "Which patient’s breathing and consciousness should we check first?",
          },
        ],
        signalLabel: isTurkish ? "Acil servis alternatifi" : "Emergency scenario variant",
      },
    ];
  }

  if (professionKey === "pilot") {
    return [
      { title: missionTitle, briefing: missionBriefing, character: missionCharacter, stage: activeMissionStage, knowledgeCards: fallbackCards, signalLabel: isTurkish ? "Uçuş kontrol kanalı" : "Flight control channel" },
      {
        title: isTurkish ? "Fırtına Rotası Kararı" : "Storm Route Decision",
        briefing: isTurkish ? "Uçak fırtına hattına yaklaşıyor. Görevin yolcu güvenliğini koruyarak en sakin rota kararını vermek." : "The aircraft is approaching a storm line. Your mission is to protect passenger safety while choosing the calmest route decision.",
        character: { name: "Ava Torres", role: isTurkish ? "Uçuş Kontrol Uzmanı" : "Flight Controller", channel: isTurkish ? "Kule Kanalı" : "Tower Channel", openingLine: isTurkish ? "Radar, rüzgâr ve yakıt durumunu takip ediyorum. Hangi veriyi önce kontrol edeyim?" : "I am tracking radar, wind and fuel. Which data should I check first?" },
        stage: { title: isTurkish ? "Rotayı sakin şekilde değerlendir" : "Evaluate the route calmly", context: isTurkish ? "Kokpit sakin kalmalı; karar aceleyle verilmemeli." : "The cockpit must stay calm; the decision should not be rushed.", mentorHint: isTurkish ? "Önce güvenliği etkileyen değişkenleri ayır." : "Start by separating the variables that affect safety.", thinkingQuestion: isTurkish ? "Rotaya karar vermeden önce hangi veri kesinleşmeli?" : "Which data must be confirmed before deciding the route?" },
        knowledgeCards: [{ title: isTurkish ? "Rüzgâr Kesmesi" : "Wind Shear", explanation: isTurkish ? "Rüzgâr kesmesi, uçağın kısa sürede farklı hava akımlarına girmesidir." : "Wind shear is a rapid change in wind conditions around the aircraft.", whyItMatters: isTurkish ? "Pilotun rota ve irtifa kararını doğrudan etkileyebilir." : "It can directly affect route and altitude decisions.", affectedSystems: isTurkish ? ["Uçuş güvenliği", "Rota", "Yakıt planı"] : ["Flight safety", "Route", "Fuel plan"], suggestedQuestion: isTurkish ? "Fırtına hattının etrafından dolaşmak için güvenli alternatif rota var mı?" : "Is there a safe alternate route around the storm line?" }],
        signalLabel: isTurkish ? "Fırtına alternatifi" : "Storm scenario variant",
      },
    ];
  }

  if (professionKey === "ai-engineer") {
    return [
      { title: missionTitle, briefing: missionBriefing, character: missionCharacter, stage: activeMissionStage, knowledgeCards: fallbackCards, signalLabel: isTurkish ? "Model güvenliği kanalı" : "Model safety channel" },
      {
        title: isTurkish ? "Model Sapması İncelemesi" : "Model Drift Investigation",
        briefing: isTurkish ? "Bir yapay zekâ modeli beklenmeyen sonuçlar üretmeye başladı. Görevin veriyi, etik riski ve güvenli çıkışı birlikte değerlendirmek." : "An AI model has started producing unexpected outputs. Your mission is to evaluate data, ethical risk and safe release together.",
        character: { name: "Nora Kim", role: isTurkish ? "Veri Güvenliği Uzmanı" : "Data Safety Specialist", channel: isTurkish ? "Model İzleme Kanalı" : "Model Monitoring Channel", openingLine: isTurkish ? "Veri değişimi, hata örnekleri ve kullanıcı etkisini izliyorum. İlk olarak neyi karşılaştıralım?" : "I am tracking data changes, error examples and user impact. What should we compare first?" },
        stage: { title: isTurkish ? "Model riskini sakin analiz et" : "Analyze model risk calmly", context: isTurkish ? "Modeli hemen kapatmak yerine önce riskin kaynağı anlaşılmalı." : "Before shutting the model down, the source of risk should be understood.", mentorHint: isTurkish ? "Veri, davranış ve kullanıcı etkisini ayrı ayrı düşün." : "Think separately about data, behavior and user impact.", thinkingQuestion: isTurkish ? "Beklenmeyen sonucu anlamak için önce hangi kanıtı istemelisin?" : "Which evidence should you request first to understand the unexpected output?" },
        knowledgeCards: [{ title: isTurkish ? "Veri Sapması" : "Data Drift", explanation: isTurkish ? "Veri sapması, modelin gördüğü yeni verilerin eğitim verisinden farklılaşmasıdır." : "Data drift occurs when new data becomes different from the training data.", whyItMatters: isTurkish ? "Model doğru çalışıyormuş gibi görünürken hatalı kararlar verebilir." : "The model can appear functional while making bad decisions.", affectedSystems: isTurkish ? ["Model kalitesi", "Etik risk", "Kullanıcı güvenliği"] : ["Model quality", "Ethical risk", "User safety"], suggestedQuestion: isTurkish ? "Son hatalar belirli bir veri grubunda mı yoğunlaşıyor?" : "Are the recent errors concentrated in a specific data group?" }],
        signalLabel: isTurkish ? "Model sapması alternatifi" : "Model drift variant",
      },
    ];
  }

  if (professionKey === "cyber-detective") {
    return [
      { title: missionTitle, briefing: missionBriefing, character: missionCharacter, stage: activeMissionStage, knowledgeCards: fallbackCards, signalLabel: isTurkish ? "Dijital ipucu kanalı" : "Digital evidence channel" },
      {
        title: isTurkish ? "Şüpheli Giriş Alarmı" : "Suspicious Login Alert",
        briefing: isTurkish ? "Bir hesapta olağan dışı giriş denemeleri tespit edildi. Görevin acele suçlamadan güvenli kanıt toplamaktır." : "Unusual login attempts were detected on an account. Your mission is to collect safe evidence without rushing to accuse anyone.",
        character: { name: "Leo Grant", role: isTurkish ? "Güvenlik Analisti" : "Security Analyst", channel: isTurkish ? "Olay Müdahale Kanalı" : "Incident Response Channel", openingLine: isTurkish ? "IP kayıtları, zaman çizgisi ve cihaz bilgilerini takip ediyorum. Önce neyi doğrulayalım?" : "I am tracking IP logs, timeline and device details. What should we verify first?" },
        stage: { title: isTurkish ? "Kanıtı güvenli şekilde doğrula" : "Verify evidence safely", context: isTurkish ? "Yanlış alarm olabilir; karar kanıta dayanmalı." : "It may be a false alarm; decisions must be evidence-based.", mentorHint: isTurkish ? "İlk işaret ile kesin kanıt aynı şey değildir." : "The first signal and confirmed evidence are not the same thing.", thinkingQuestion: isTurkish ? "Bu girişin gerçekten riskli olduğunu anlamak için hangi kaydı istersin?" : "Which log would help confirm whether this login is truly risky?" },
        knowledgeCards: [{ title: isTurkish ? "Olay Zaman Çizgisi" : "Incident Timeline", explanation: isTurkish ? "Zaman çizgisi, şüpheli olayların hangi sırayla gerçekleştiğini gösterir." : "An incident timeline shows the order in which suspicious events happened.", whyItMatters: isTurkish ? "Doğru sıra görülmeden yanlış sonuca varılabilir." : "Without the correct order, it is easy to reach the wrong conclusion.", affectedSystems: isTurkish ? ["Hesap güvenliği", "Kanıt", "Risk değerlendirme"] : ["Account security", "Evidence", "Risk assessment"], suggestedQuestion: isTurkish ? "Giriş denemeleri hangi saatlerde ve hangi cihazlardan gelmiş?" : "At what times and from which devices did the login attempts happen?" }],
        signalLabel: isTurkish ? "Şüpheli giriş alternatifi" : "Suspicious login variant",
      },
    ];
  }

  return [
    {
      title: missionTitle,
      briefing: missionBriefing,
      character: missionCharacter,
      stage: activeMissionStage,
      knowledgeCards: fallbackCards,
      signalLabel: isTurkish ? "Yaşam destek kanalı" : "Life support channel",
    },
    {
      title: isTurkish ? "Kabin Basıncı Uyarısı" : "Cabin Pressure Warning",
      briefing: isTurkish
        ? "Ay üssünde kabin basıncı dalgalanıyor. Görevin paniği büyütmeden gerçek riski ölçmek."
        : "Cabin pressure is fluctuating at the lunar station. Your mission is to measure the real risk without amplifying panic.",
      character: {
        name: "Maya Chen",
        role: isTurkish ? "Yaşam Destek Mühendisi" : "Life Support Engineer",
        channel: isTurkish ? "Basınç Kontrol Kanalı" : "Pressure Control Channel",
        openingLine: isTurkish
          ? "Kabin basıncı, kapı contaları ve yedek sistemleri izliyorum. Önce hangi değeri doğrulayayım?"
          : "I am monitoring cabin pressure, door seals and backup systems. Which value should I verify first?",
      },
      stage: {
        title: isTurkish ? "Basınç riskini sakin doğrula" : "Verify pressure risk calmly",
        context: isTurkish ? "Alarm gerçek olabilir, ama ölçüm hatası da olabilir." : "The alarm may be real, but it may also be a measurement error.",
        mentorHint: isTurkish ? "Tek bir alarm ile karar verme. Yedek okumayı iste." : "Do not decide from one alarm. Request a backup reading.",
        thinkingQuestion: isTurkish ? "Basıncın gerçekten tehlikeli olup olmadığını anlamak için neyi karşılaştırmalısın?" : "What should you compare to know whether pressure is truly dangerous?",
      },
      knowledgeCards: [
        {
          title: isTurkish ? "Kabin Basıncı" : "Cabin Pressure",
          explanation: isTurkish ? "Kabin basıncı, insanların güvenle nefes alabileceği ortamın korunmasını sağlar." : "Cabin pressure keeps the environment safe for breathing.",
          whyItMatters: isTurkish ? "Basınç düşerse ekip güvenliği hızla etkilenebilir." : "If pressure drops, crew safety can be affected quickly.",
          affectedSystems: isTurkish ? ["Mürettebat güvenliği", "Kapı contaları", "Acil durum protokolü"] : ["Crew safety", "Door seals", "Emergency protocol"],
          suggestedQuestion: isTurkish ? "Kabin basıncı ana ve yedek sensörlerde aynı mı görünüyor?" : "Do main and backup pressure sensors show the same reading?",
        },
      ],
      signalLabel: isTurkish ? "Basınç alternatifi" : "Pressure scenario variant",
    },
    {
      title: isTurkish ? "Güneş Fırtınası Riski" : "Solar Storm Risk",
      briefing: isTurkish
        ? "Ay üssüne doğru güçlü bir güneş fırtınası yaklaşıyor. Görevin enerji, iletişim ve ekip güvenliğini aynı anda düşünmek."
        : "A strong solar storm is approaching the lunar station. Your mission is to think about energy, communication and crew safety together.",
      character: {
        name: isTurkish ? "Noah Vale" : "Noah Vale",
        role: isTurkish ? "Uzay Havası Uzmanı" : "Space Weather Specialist",
        channel: isTurkish ? "Uzay Havası Kanalı" : "Space Weather Channel",
        openingLine: isTurkish
          ? "Radyasyon, enerji dalgalanması ve haberleşme riskini takip ediyorum. İlk olarak neyi kontrol edeyim?"
          : "I am tracking radiation, power fluctuation and communication risk. What should I check first?",
      },
      stage: {
        title: isTurkish ? "Dış tehdidi güvenli sıraya koy" : "Prioritize the external threat safely",
        context: isTurkish ? "Tehdit dışarıdan geliyor; karar sakin ama hızlı olmalı." : "The threat is external; the decision should be calm but timely.",
        mentorHint: isTurkish ? "Önce ekibi koruyan sistemleri düşün." : "Think first about the systems that protect the crew.",
        thinkingQuestion: isTurkish ? "Güneş fırtınası yaklaşırken önce hangi sistemi güvenceye almalısın?" : "As the solar storm approaches, which system should you secure first?",
      },
      knowledgeCards: [
        {
          title: isTurkish ? "Radyasyon Koruması" : "Radiation Shielding",
          explanation: isTurkish ? "Radyasyon koruması, uzay ortamında ekibin güvenli bölgede kalmasını sağlar." : "Radiation shielding helps keep the crew in a safe zone in space.",
          whyItMatters: isTurkish ? "Koruma zamanında yapılmazsa ekip gereksiz risk altında kalabilir." : "If protection is not activated in time, the crew may face unnecessary risk.",
          affectedSystems: isTurkish ? ["Ekip güvenliği", "Enerji sistemi", "İletişim"] : ["Crew safety", "Power system", "Communication"],
          suggestedQuestion: isTurkish ? "Ekibi radyasyon korumalı bölgeye almak için ne kadar zamanımız var?" : "How much time do we have to move the crew into the shielded zone?",
        },
      ],
      signalLabel: isTurkish ? "Güneş fırtınası alternatifi" : "Solar storm variant",
    },
  ];
}

function getLatestMentorMessage(messages: MissionMessageView[]) {
  return [...messages].reverse().find((message) => message.role === "mentor");
}

function getLatestCharacterMessage(messages: MissionMessageView[]) {
  return [...messages].reverse().find((message) => message.role === "character");
}

function getLatestChildMessage(messages: MissionMessageView[]) {
  return [...messages].reverse().find((message) => message.role === "child");
}

function getMissionPulse(childTurnCount: number, isTurkish: boolean) {
  if (childTurnCount <= 0) {
    return isTurkish
      ? "Komut kanalı açık. İlk sinyalini bekliyoruz."
      : "Command channel is open. We are waiting for your first signal.";
  }

  if (childTurnCount === 1) {
    return isTurkish
      ? "İlk sinyal alındı. Komut merkezi yeni aktarımı hazırlıyor."
      : "First signal received. Command Center is preparing the next transmission.";
  }

  if (childTurnCount === 2) {
    return isTurkish
      ? "Görev dünyası komutuna tepki vermeye başladı."
      : "The mission world is reacting to your command.";
  }

  return isTurkish
    ? "Kritik aktarım penceresine yaklaşıyorsun."
    : "You are approaching the critical transmission window.";
}


function getLivingWorldIntercept(childTurnCount: number, isTurkish: boolean) {
  if (childTurnCount <= 0) {
    return isTurkish
      ? {
          status: "Dünya beklemiyor",
          line: "Komut kanalı açıldığında görev zaten hareket halindeydi. Ekip ilk sakin sinyalini bekliyor.",
          pulse: "Canlı dünya akışı",
        }
      : {
          status: "The world is not waiting",
          line: "When the command channel opened, the mission was already moving. The crew is waiting for your first calm signal.",
          pulse: "Live world feed",
        };
  }

  if (childTurnCount === 1) {
    return isTurkish
      ? {
          status: "İlk komut yankılandı",
          line: "Görev merkezi sinyalini aldı. Ekip, sonraki yönlendirmene göre hareket edecek.",
          pulse: "Signal received",
        }
      : {
          status: "First command echoed",
          line: "Command Center received your signal. The crew will move according to your next direction.",
          pulse: "Signal received",
        };
  }

  if (childTurnCount === 2) {
    return isTurkish
      ? {
          status: "Görev dünyası tepki veriyor",
          line: "Kararların artık ortamın ritmini değiştiriyor. Komut merkezi daha net bir karar penceresi açıyor.",
          pulse: "World reacting",
        }
      : {
          status: "The mission world is reacting",
          line: "Your decisions are now changing the rhythm of the environment. Command Center is opening a clearer decision window.",
          pulse: "World reacting",
        };
  }

  return isTurkish
    ? {
        status: "Kritik aktarım yaklaşıyor",
        line: "Sinyaller yoğunlaşıyor. Bundan sonraki komutun görev arşivinde daha güçlü bir iz bırakacak.",
        pulse: "Critical window",
      }
    : {
        status: "Critical transmission approaching",
        line: "Signals are intensifying. Your next command will leave a stronger mark in the mission archive.",
        pulse: "Critical window",
      };
}

function getMemoryReveal(childTurnCount: number, isTurkish: boolean) {
  if (childTurnCount <= 0) return null;

  return {
    eyebrow: isTurkish ? "Görev anı kaydedildi" : "Mission memory recorded",
    title: isTurkish ? "Görev anı arşivlendi" : "Mission moment archived",
    body: isTurkish
      ? "Komut merkezi bu anı arşivledi. Çıktılar arka planda hazırlanır; görev akışı bölünmez."
      : "Command Center archived this moment. Outputs prepare in the background; the mission flow stays uninterrupted.",
  };
}

function getAmbientTransmission(childTurnCount: number, isTurkish: boolean) {
  if (childTurnCount <= 0) {
    return isTurkish
      ? {
          label: "Açık kanal",
          source: "Komut Merkezi",
          line: "Kanal açık. Ekip konuşmayı duyabiliyor; ilk sinyal sakin olmalı.",
        }
      : {
          label: "Open channel",
          source: "Mission Control",
          line: "Channel open. The crew can hear this; the first signal should be calm.",
        };
  }

  if (childTurnCount === 1) {
    return isTurkish
      ? {
          label: "Kısa kesinti",
          source: "İstasyon Rölesi",
          line: "Sinyal geri geldi. Maya beklemede; bir sonraki komutun ekibin ritmini belirleyecek.",
        }
      : {
          label: "Signal break",
          source: "Station Relay",
          line: "Signal recovered. Maya is standing by; your next command will set the crew rhythm.",
        };
  }

  if (childTurnCount === 2) {
    return isTurkish
      ? {
          label: "Ortam değişti",
          source: "Ekip Kanalı",
          line: "Ekip ses tonunu takip ediyor. Daha net bir yönlendirme güveni artıracak.",
        }
      : {
          label: "Environment shifted",
          source: "Crew Channel",
          line: "The crew is reading your tone. A clearer direction will raise confidence.",
        };
  }

  return isTurkish
    ? {
        label: "Kritik pencere",
        source: "Komut Rölesi",
        line: "Komut merkezi bekliyor. Bundan sonraki sinyal görev arşivinde kalacak.",
      }
    : {
        label: "Critical window",
        source: "Command Relay",
        line: "Command Center is waiting. The next signal will remain in the mission archive.",
      };
}

function splitLines(text?: string) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type ProfessionMissionSkin = {
  icon: string;
  viewportLabel: string;
  frameLabel: string;
  borderClass: string;
  shellClass: string;
  primaryPanelClass: string;
  streamPanelClass: string;
  commandPanelClass: string;
  accentTextClass: string;
  accentSoftTextClass: string;
  badgeClass: string;
  buttonClass: string;
  inputFocusClass: string;
  backgroundLayer: string;
  hudLayer: string;
  signalLine: string;
  visualAssetBaseUrl: string;
  visualAssetOverlayUrl: string;
  visualAssetGlassUrl: string;
  visualAssetPosition: string;
  visualAssetToneClass: string;
};

type ProfessionViewportDecor = {
  title: string;
  subtitle: string;
  leftLabel: string;
  rightLabel: string;
  vignetteClass: string;
  frameClass: string;
  cornerClass: string;
  consoleClass: string;
  instrumentClass: string;
  scanClass: string;
};



type ProfessionPOVOverlayProps = {
  professionKey: string;
  isTurkish: boolean;
  isImmersive?: boolean;
};

function getNormalizedProfessionKey(professionKey: string) {
  return professionKey.replace(/[-_\s]/g, "").toLowerCase();
}

function ProfessionPOVOverlay({ professionKey, isTurkish, isImmersive = false }: ProfessionPOVOverlayProps) {
  const normalizedKey = getNormalizedProfessionKey(professionKey);
  const overlayRadiusClass = isImmersive && normalizedKey === "astronaut" ? "rounded-[50%]" : isImmersive ? "rounded-[3.25rem]" : "rounded-[2rem]";
  const immersionOpacityClass = isImmersive ? "opacity-100" : "opacity-95";

  if (normalizedKey === "doctor") {
    return (
      <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${overlayRadiusClass} ${immersionOpacityClass}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_34%,rgba(2,44,34,0.38)_60%,rgba(0,0,0,0.92)_100%)]" />
        <div className="absolute left-5 right-5 top-5 h-16 rounded-2xl border border-emerald-100/18 bg-emerald-950/35 backdrop-blur-md">
          <div className="absolute left-6 top-1/2 h-px w-[38%] bg-gradient-to-r from-emerald-300/20 via-emerald-100/70 to-transparent" />
          <div className="absolute right-6 top-1/2 h-px w-[38%] bg-gradient-to-l from-emerald-300/20 via-emerald-100/70 to-transparent" />
          <div className="absolute left-8 top-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-100/65">
            {isTurkish ? "ER MONİTÖR" : "ER MONITOR"}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-28 rounded-t-[3rem] border-t border-emerald-100/15 bg-gradient-to-t from-emerald-950/75 via-emerald-950/35 to-transparent backdrop-blur-sm">
          <div className="mx-auto mt-5 h-10 w-[58%] rounded-full border border-emerald-100/16 bg-emerald-300/8" />
        </div>
        <div className="absolute left-7 top-28 h-40 w-20 rounded-2xl border border-emerald-100/12 bg-emerald-950/25" />
        <div className="absolute right-7 top-32 h-36 w-24 rounded-2xl border border-emerald-100/12 bg-emerald-950/25" />
      </div>
    );
  }

  if (normalizedKey === "pilot") {
    return (
      <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${overlayRadiusClass} ${immersionOpacityClass}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(12,74,110,0.46)_68%,rgba(0,0,0,0.88)_100%)]" />
        <div className="absolute left-1/2 top-0 h-[72%] w-[86%] -translate-x-1/2 rounded-b-[50%] border-x-2 border-b-2 border-sky-100/16" />
        <div className="absolute left-1/2 top-0 h-[66%] w-px -translate-x-1/2 bg-gradient-to-b from-sky-100/20 via-sky-100/10 to-transparent" />
        <div className="absolute left-[19%] top-3 h-[62%] w-px -rotate-12 bg-gradient-to-b from-sky-100/18 to-transparent" />
        <div className="absolute right-[19%] top-3 h-[62%] w-px rotate-12 bg-gradient-to-b from-sky-100/18 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 rounded-t-[3rem] border-t border-sky-100/15 bg-gradient-to-t from-sky-950/85 via-sky-950/45 to-transparent backdrop-blur-sm">
          <div className="mx-auto mt-6 grid w-[72%] grid-cols-3 gap-3">
            <div className="h-10 rounded-xl border border-sky-100/15 bg-sky-300/8" />
            <div className="h-12 rounded-xl border border-sky-100/15 bg-sky-300/8" />
            <div className="h-10 rounded-xl border border-sky-100/15 bg-sky-300/8" />
          </div>
        </div>
        <div className="absolute right-8 top-24 h-24 w-24 rounded-full border border-sky-100/18 bg-sky-950/25" />
        <div className="absolute right-14 top-30 h-12 w-12 rounded-full border border-sky-100/14" />
      </div>
    );
  }

  if (normalizedKey === "aiengineer") {
    return (
      <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${overlayRadiusClass} ${immersionOpacityClass}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(76,29,149,0.46)_70%,rgba(0,0,0,0.88)_100%)]" />
        <div className="absolute inset-x-8 top-8 h-16 rounded-2xl border border-violet-100/14 bg-violet-950/30 backdrop-blur-md">
          <div className="absolute inset-4 bg-[linear-gradient(90deg,transparent,rgba(216,180,254,0.22),transparent)]" />
          <p className="absolute left-5 top-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-100/65">
            {isTurkish ? "MODEL LAB GÖRÜŞÜ" : "MODEL LAB VIEW"}
          </p>
        </div>
        <div className="absolute left-8 top-32 h-36 w-36 rounded-full border border-violet-100/14 bg-violet-950/25" />
        <div className="absolute right-10 bottom-28 h-32 w-44 rounded-[1.75rem] border border-cyan-100/12 bg-cyan-950/20" />
        <div className="absolute bottom-0 left-0 right-0 h-28 border-t border-violet-100/12 bg-gradient-to-t from-violet-950/80 via-violet-950/35 to-transparent" />
      </div>
    );
  }

  if (normalizedKey === "cyberdetective") {
    return (
      <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${overlayRadiusClass} ${immersionOpacityClass}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_46%,rgba(112,26,117,0.48)_70%,rgba(0,0,0,0.9)_100%)]" />
        <div className="absolute left-6 top-7 h-28 w-44 rounded-2xl border border-fuchsia-100/14 bg-fuchsia-950/30 backdrop-blur-md" />
        <div className="absolute right-6 top-10 h-44 w-32 rounded-2xl border border-fuchsia-100/14 bg-fuchsia-950/25" />
        <div className="absolute inset-x-10 bottom-6 h-24 rounded-t-[2rem] border border-fuchsia-100/14 bg-fuchsia-950/50 backdrop-blur-sm">
          <div className="mx-auto mt-4 h-2 w-[72%] rounded-full bg-fuchsia-100/15" />
          <div className="mx-auto mt-3 h-2 w-[48%] rounded-full bg-cyan-100/12" />
        </div>
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(244,114,182,.18)_1px,transparent_1px)] [background-size:100%_18px]" />
      </div>
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${overlayRadiusClass} ${immersionOpacityClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(8,47,73,0.26)_49%,rgba(2,6,23,0.72)_72%,rgba(0,0,0,0.96)_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[94%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[16px] border-cyan-100/[0.085] shadow-[inset_0_0_110px_rgba(34,211,238,0.20),0_0_90px_rgba(34,211,238,0.10)]" />
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-100/22 shadow-[inset_0_0_42px_rgba(103,232,249,0.10)]" />
      <div className="absolute left-[5%] top-[15%] h-[70%] w-14 rounded-r-[2.4rem] border-r border-cyan-100/20 bg-cyan-950/34 shadow-[12px_0_40px_rgba(8,145,178,0.18)]" />
      <div className="absolute right-[5%] top-[15%] h-[70%] w-14 rounded-l-[2.4rem] border-l border-cyan-100/20 bg-cyan-950/34 shadow-[-12px_0_40px_rgba(8,145,178,0.18)]" />
      <div className="absolute left-1/2 top-8 h-10 w-[38%] -translate-x-1/2 rounded-b-[2rem] border-x border-b border-cyan-100/18 bg-cyan-950/45 backdrop-blur-sm" />
      <div className="absolute left-[12%] top-[22%] h-px w-[18%] bg-gradient-to-r from-cyan-200/40 to-transparent" />
      <div className="absolute right-[12%] top-[22%] h-px w-[18%] bg-gradient-to-l from-cyan-200/40 to-transparent" />
      <div className="absolute bottom-0 left-1/2 h-36 w-[78%] -translate-x-1/2 rounded-t-[3.2rem] border-x border-t border-cyan-100/20 bg-gradient-to-t from-cyan-950/90 via-cyan-950/50 to-transparent backdrop-blur-sm">
        <div className="mx-auto mt-5 flex w-[72%] items-center justify-between text-[9px] font-semibold uppercase tracking-[0.30em] text-cyan-100/58">
          <span>{isTurkish ? "OKSİJEN" : "OXYGEN"}</span>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-100/70 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
          <span>{isTurkish ? "KASK RÖLESİ" : "HELMET RELAY"}</span>
        </div>
        <div className="mx-auto mt-4 grid w-[58%] grid-cols-3 gap-2 opacity-60">
          <div className="h-2 rounded-full bg-cyan-100/18" />
          <div className="h-2 rounded-full bg-cyan-100/28" />
          <div className="h-2 rounded-full bg-cyan-100/18" />
        </div>
      </div>
      <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(103,232,249,.20)_1px,transparent_1px)] [background-size:100%_22px]" />
      <div className="absolute left-1/2 top-[17%] h-24 w-[68%] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-white/10 via-cyan-100/5 to-transparent blur-sm" />
    </div>
  );
}

function getProfessionViewportDecor(
  professionKey: string,
  isTurkish: boolean
): ProfessionViewportDecor {
  const normalizedKey = professionKey.toLowerCase();

  if (normalizedKey === "doctor") {
    return {
      title: isTurkish ? "ACİL GÖRÜŞ ALANI" : "ER VIEWPORT",
      subtitle: isTurkish ? "hasta monitörü aktif" : "patient monitor active",
      leftLabel: isTurkish ? "TRİYAJ" : "TRIAGE",
      rightLabel: isTurkish ? "VİTAL" : "VITALS",
      vignetteClass: "bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(6,78,59,0.36)_72%,rgba(2,6,23,0.72)_100%)]",
      frameClass: "border-emerald-200/15 shadow-[inset_0_0_70px_rgba(16,185,129,0.12)]",
      cornerClass: "border-emerald-200/25 bg-emerald-300/10 text-emerald-50",
      consoleClass: "border-emerald-200/20 bg-emerald-950/55 text-emerald-50",
      instrumentClass: "border-emerald-200/20 bg-emerald-950/45 text-emerald-100",
      scanClass: "from-transparent via-emerald-200/10 to-transparent",
    };
  }

  if (normalizedKey === "pilot") {
    return {
      title: isTurkish ? "UÇUŞ KOKPİTİ" : "FLIGHT DECK",
      subtitle: isTurkish ? "radar ve kule hattı" : "radar and tower relay",
      leftLabel: isTurkish ? "ROTA" : "ROUTE",
      rightLabel: isTurkish ? "RADAR" : "RADAR",
      vignetteClass: "bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(12,74,110,0.40)_72%,rgba(2,6,23,0.74)_100%)]",
      frameClass: "border-sky-200/15 shadow-[inset_0_0_70px_rgba(56,189,248,0.13)]",
      cornerClass: "border-sky-200/25 bg-sky-300/10 text-sky-50",
      consoleClass: "border-sky-200/20 bg-sky-950/55 text-sky-50",
      instrumentClass: "border-sky-200/20 bg-sky-950/45 text-sky-100",
      scanClass: "from-transparent via-sky-200/10 to-transparent",
    };
  }

  if (normalizedKey === "ai-engineer") {
    return {
      title: isTurkish ? "MODEL LAB" : "MODEL LAB",
      subtitle: isTurkish ? "veri akışı izleniyor" : "data stream observed",
      leftLabel: isTurkish ? "VERİ" : "DATA",
      rightLabel: isTurkish ? "RİSK" : "RISK",
      vignetteClass: "bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(76,29,149,0.38)_72%,rgba(2,6,23,0.74)_100%)]",
      frameClass: "border-violet-200/15 shadow-[inset_0_0_70px_rgba(139,92,246,0.13)]",
      cornerClass: "border-violet-200/25 bg-violet-300/10 text-violet-50",
      consoleClass: "border-violet-200/20 bg-violet-950/55 text-violet-50",
      instrumentClass: "border-violet-200/20 bg-violet-950/45 text-violet-100",
      scanClass: "from-transparent via-violet-200/10 to-transparent",
    };
  }

  if (normalizedKey === "cyber-detective") {
    return {
      title: isTurkish ? "GÜVENLİ AĞ GÖRÜŞÜ" : "SECURE NET VIEW",
      subtitle: isTurkish ? "kanıt panosu aktif" : "evidence board active",
      leftLabel: isTurkish ? "İPUCU" : "TRACE",
      rightLabel: isTurkish ? "AĞ" : "NET",
      vignetteClass: "bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(112,26,117,0.36)_72%,rgba(2,6,23,0.76)_100%)]",
      frameClass: "border-fuchsia-200/15 shadow-[inset_0_0_70px_rgba(217,70,239,0.12)]",
      cornerClass: "border-fuchsia-200/25 bg-fuchsia-300/10 text-fuchsia-50",
      consoleClass: "border-fuchsia-200/20 bg-fuchsia-950/55 text-fuchsia-50",
      instrumentClass: "border-fuchsia-200/20 bg-fuchsia-950/45 text-fuchsia-100",
      scanClass: "from-transparent via-fuchsia-200/10 to-transparent",
    };
  }

  return {
    title: isTurkish ? "KASK HUD" : "HELMET HUD",
    subtitle: isTurkish ? "yaşam destek hattı aktif" : "life support relay active",
    leftLabel: isTurkish ? "OKSİJEN" : "OXYGEN",
    rightLabel: isTurkish ? "RÖLE" : "RELAY",
    vignetteClass: "bg-[radial-gradient(ellipse_at_center,transparent_36%,rgba(8,145,178,0.36)_68%,rgba(2,6,23,0.78)_100%)]",
    frameClass: "border-cyan-200/20 shadow-[inset_0_0_90px_rgba(34,211,238,0.16)]",
    cornerClass: "border-cyan-200/30 bg-cyan-300/10 text-cyan-50",
    consoleClass: "border-cyan-200/25 bg-cyan-950/55 text-cyan-50",
    instrumentClass: "border-cyan-200/25 bg-cyan-950/45 text-cyan-100",
    scanClass: "from-transparent via-cyan-200/12 to-transparent",
  };
}


function getImmersionViewportFrameClass(professionKey: string) {
  const normalizedKey = getNormalizedProfessionKey(professionKey);

  if (normalizedKey === "doctor") {
    return "rounded-[2.75rem] border-emerald-100/22 shadow-[0_0_100px_rgba(16,185,129,0.24),inset_0_0_120px_rgba(0,0,0,0.70)]";
  }

  if (normalizedKey === "pilot") {
    return "rounded-[3.25rem] border-sky-100/22 shadow-[0_0_100px_rgba(56,189,248,0.22),inset_0_0_120px_rgba(0,0,0,0.72)]";
  }

  if (normalizedKey === "aiengineer") {
    return "rounded-[2.75rem] border-violet-100/22 shadow-[0_0_100px_rgba(139,92,246,0.22),inset_0_0_120px_rgba(0,0,0,0.72)]";
  }

  if (normalizedKey === "cyberdetective") {
    return "rounded-[2.75rem] border-fuchsia-100/22 shadow-[0_0_100px_rgba(217,70,239,0.20),inset_0_0_120px_rgba(0,0,0,0.74)]";
  }

  return "rounded-[50%] border-cyan-100/22 shadow-[0_0_120px_rgba(34,211,238,0.26),inset_0_0_150px_rgba(0,0,0,0.82)]";
}

function getImmersionContentInsetClass(professionKey: string) {
  const normalizedKey = getNormalizedProfessionKey(professionKey);
  return normalizedKey === "astronaut"
    ? "px-[clamp(1.25rem,8vw,7rem)] py-[clamp(1rem,7vh,4.5rem)]"
    : "px-[clamp(1rem,4vw,3.5rem)] py-[clamp(1rem,4vh,2.5rem)]";
}

function getImmersionCommandPlaceholder(professionKey: string, isTurkish: boolean) {
  const normalizedKey = getNormalizedProfessionKey(professionKey);

  if (normalizedKey === "doctor") {
    return isTurkish ? "ER görüş alanından ekibe sakin bir komut gönder..." : "Send a calm command from the ER view...";
  }

  if (normalizedKey === "pilot") {
    return isTurkish ? "Kokpitten kuleye ve ekibe sinyal gönder..." : "Send a signal from the flight deck to tower and crew...";
  }

  if (normalizedKey === "aiengineer") {
    return isTurkish ? "Model laboratuvarından güvenli karar sinyali gönder..." : "Send a safe decision signal from the model lab...";
  }

  if (normalizedKey === "cyberdetective") {
    return isTurkish ? "Güvenli ağ görüşünden kanıt doğrulama sinyali gönder..." : "Send an evidence verification signal from the secure network view...";
  }

  return isTurkish ? "Kask içinden Komut Merkezi'ne sinyal gönder..." : "Send a signal to Mission Control from inside the visor...";
}

function ProfessionVisualAssetLayer({ missionSkin }: { missionSkin: ProfessionMissionSkin }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[2rem]">
      <div
        className={`absolute inset-0 bg-cover bg-no-repeat opacity-48 ${missionSkin.visualAssetToneClass}`}
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.16), rgba(2,6,23,0.82)), url(${missionSkin.visualAssetBaseUrl})`,
          backgroundPosition: missionSkin.visualAssetPosition,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-no-repeat opacity-42 mix-blend-screen"
        style={{
          backgroundImage: `url(${missionSkin.visualAssetOverlayUrl})`,
          backgroundPosition: missionSkin.visualAssetPosition,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-no-repeat opacity-26 mix-blend-soft-light"
        style={{
          backgroundImage: `url(${missionSkin.visualAssetGlassUrl})`,
          backgroundPosition: missionSkin.visualAssetPosition,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgba(2,6,23,0.55)_78%,rgba(0,0,0,0.9)_100%)]" />
    </div>
  );
}

function getProfessionMissionSkin(
  professionKey: string,
  isTurkish: boolean
): ProfessionMissionSkin {
  const normalizedKey = professionKey.toLowerCase();

  if (normalizedKey === "doctor") {
    return {
      icon: "🩺",
      viewportLabel: isTurkish ? "Acil servis görüş alanı" : "Emergency room view",
      frameLabel: isTurkish ? "Hasta monitörü rölesi" : "Patient monitor relay",
      borderClass: "border-emerald-200/25",
      shellClass: "bg-slate-950 shadow-emerald-950/40",
      primaryPanelClass: "border-emerald-100/15 bg-white/[0.045]",
      streamPanelClass: "border-emerald-200/15 bg-emerald-950/35",
      commandPanelClass: "border-emerald-200/20 bg-emerald-950/45 shadow-emerald-950/20",
      accentTextClass: "text-emerald-100",
      accentSoftTextClass: "text-emerald-200/75",
      badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
      buttonClass: "border-emerald-200/25 bg-emerald-300/10 text-emerald-50 hover:border-emerald-200/45 hover:bg-emerald-300/18",
      inputFocusClass: "focus:border-emerald-200/60 focus:ring-emerald-300/10",
      backgroundLayer:
        "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_38%)]",
      hudLayer:
        "before:absolute before:content-[''] before:left-8 before:top-8 before:h-20 before:w-24 before:rounded-[1.5rem] before:border before:border-emerald-200/10 after:absolute after:content-[''] after:right-8 after:bottom-10 after:h-16 after:w-28 after:rounded-full after:border after:border-emerald-100/10",
      signalLine: isTurkish
        ? "Monitörler açık. Triyaj hattı sakin bir ilk komut bekliyor."
        : "Monitors are live. Triage is waiting for a calm first command.",
      visualAssetBaseUrl: "/careerlab/pov/doctor/base.webp",
      visualAssetOverlayUrl: "/careerlab/pov/doctor/monitor-overlay.webp",
      visualAssetGlassUrl: "/careerlab/pov/doctor/er-glass.webp",
      visualAssetPosition: "center 44%",
      visualAssetToneClass: "mix-blend-soft-light",
    };
  }

  if (normalizedKey === "pilot") {
    return {
      icon: "✈️",
      viewportLabel: isTurkish ? "Uçuş kokpiti görüşü" : "Flight deck view",
      frameLabel: isTurkish ? "Kokpit radar rölesi" : "Cockpit radar relay",
      borderClass: "border-sky-200/25",
      shellClass: "bg-slate-950 shadow-sky-950/40",
      primaryPanelClass: "border-sky-100/15 bg-white/[0.045]",
      streamPanelClass: "border-sky-200/15 bg-sky-950/35",
      commandPanelClass: "border-sky-200/20 bg-sky-950/45 shadow-sky-950/20",
      accentTextClass: "text-sky-100",
      accentSoftTextClass: "text-sky-200/75",
      badgeClass: "border-sky-300/20 bg-sky-300/10 text-sky-100",
      buttonClass: "border-sky-200/25 bg-sky-300/10 text-sky-50 hover:border-sky-200/45 hover:bg-sky-300/18",
      inputFocusClass: "focus:border-sky-200/60 focus:ring-sky-300/10",
      backgroundLayer:
        "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_38%)]",
      hudLayer:
        "before:absolute before:content-[''] before:left-10 before:bottom-10 before:h-24 before:w-24 before:rounded-full before:border before:border-sky-200/10 after:absolute after:content-[''] after:right-8 after:top-10 after:h-14 after:w-36 after:rounded-[1.25rem] after:border after:border-sky-100/10",
      signalLine: isTurkish
        ? "Kokpit hattı açık. Radar ve kule, sakin bir rota komutu bekliyor."
        : "Flight deck is live. Radar and tower are waiting for a calm route command.",
      visualAssetBaseUrl: "/careerlab/pov/pilot/base.webp",
      visualAssetOverlayUrl: "/careerlab/pov/pilot/radar-overlay.webp",
      visualAssetGlassUrl: "/careerlab/pov/pilot/canopy-glass.webp",
      visualAssetPosition: "center 38%",
      visualAssetToneClass: "mix-blend-soft-light",
    };
  }

  if (normalizedKey === "ai-engineer") {
    return {
      icon: "🤖",
      viewportLabel: isTurkish ? "Model laboratuvarı görünümü" : "Model lab view",
      frameLabel: isTurkish ? "Veri sinyali rölesi" : "Data signal relay",
      borderClass: "border-violet-200/25",
      shellClass: "bg-slate-950 shadow-violet-950/40",
      primaryPanelClass: "border-violet-100/15 bg-white/[0.045]",
      streamPanelClass: "border-violet-200/15 bg-violet-950/35",
      commandPanelClass: "border-violet-200/20 bg-violet-950/45 shadow-violet-950/20",
      accentTextClass: "text-violet-100",
      accentSoftTextClass: "text-violet-200/75",
      badgeClass: "border-violet-300/20 bg-violet-300/10 text-violet-100",
      buttonClass: "border-violet-200/25 bg-violet-300/10 text-violet-50 hover:border-violet-200/45 hover:bg-violet-300/18",
      inputFocusClass: "focus:border-violet-200/60 focus:ring-violet-300/10",
      backgroundLayer:
        "bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_38%)]",
      hudLayer:
        "before:absolute before:content-[''] before:left-8 before:top-10 before:h-24 before:w-32 before:rounded-[1.25rem] before:border before:border-violet-200/10 after:absolute after:content-[''] after:right-10 after:bottom-10 after:h-20 after:w-20 after:rounded-full after:border after:border-cyan-100/10",
      signalLine: isTurkish
        ? "Model laboratuvarı açık. Veri akışı ilk güvenli kararını bekliyor."
        : "Model lab is live. The data stream is waiting for your first safe decision.",
      visualAssetBaseUrl: "/careerlab/pov/ai-engineer/base.webp",
      visualAssetOverlayUrl: "/careerlab/pov/ai-engineer/data-grid.webp",
      visualAssetGlassUrl: "/careerlab/pov/ai-engineer/lab-glow.webp",
      visualAssetPosition: "center 42%",
      visualAssetToneClass: "mix-blend-soft-light",
    };
  }

  if (normalizedKey === "cyber-detective") {
    return {
      icon: "🕵️",
      viewportLabel: isTurkish ? "Dijital soruşturma masası" : "Digital investigation desk",
      frameLabel: isTurkish ? "Güvenli ağ rölesi" : "Secure network relay",
      borderClass: "border-fuchsia-200/25",
      shellClass: "bg-slate-950 shadow-fuchsia-950/40",
      primaryPanelClass: "border-fuchsia-100/15 bg-white/[0.045]",
      streamPanelClass: "border-fuchsia-200/15 bg-fuchsia-950/30",
      commandPanelClass: "border-fuchsia-200/20 bg-fuchsia-950/40 shadow-fuchsia-950/20",
      accentTextClass: "text-fuchsia-100",
      accentSoftTextClass: "text-fuchsia-200/75",
      badgeClass: "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100",
      buttonClass: "border-fuchsia-200/25 bg-fuchsia-300/10 text-fuchsia-50 hover:border-fuchsia-200/45 hover:bg-fuchsia-300/18",
      inputFocusClass: "focus:border-fuchsia-200/60 focus:ring-fuchsia-300/10",
      backgroundLayer:
        "bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_38%)]",
      hudLayer:
        "before:absolute before:content-[''] before:left-8 before:bottom-10 before:h-16 before:w-36 before:rounded-[1.25rem] before:border before:border-fuchsia-200/10 after:absolute after:content-[''] after:right-8 after:top-10 after:h-24 after:w-24 after:rounded-full after:border after:border-fuchsia-100/10",
      signalLine: isTurkish
        ? "Güvenli ağ hattı açık. Kanıt panosu ilk doğrulama sinyalini bekliyor."
        : "Secure network is live. The evidence board is waiting for the first verification signal.",
      visualAssetBaseUrl: "/careerlab/pov/cyber-detective/base.webp",
      visualAssetOverlayUrl: "/careerlab/pov/cyber-detective/secure-network.webp",
      visualAssetGlassUrl: "/careerlab/pov/cyber-detective/digital-noise.webp",
      visualAssetPosition: "center 45%",
      visualAssetToneClass: "mix-blend-soft-light",
    };
  }

  return {
    icon: "🚀",
    viewportLabel: isTurkish ? "Kask içi görev görüşü" : "Helmet mission view",
    frameLabel: isTurkish ? "Kokpit oksijen rölesi" : "Cockpit oxygen relay",
    borderClass: "border-cyan-200/25",
    shellClass: "bg-slate-950 shadow-cyan-950/40",
    primaryPanelClass: "border-cyan-100/15 bg-white/[0.045]",
    streamPanelClass: "border-cyan-200/15 bg-cyan-950/35",
    commandPanelClass: "border-cyan-200/20 bg-cyan-950/45 shadow-cyan-950/20",
    accentTextClass: "text-cyan-100",
    accentSoftTextClass: "text-cyan-200/75",
    badgeClass: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    buttonClass: "border-cyan-200/25 bg-cyan-300/10 text-cyan-50 hover:border-cyan-200/45 hover:bg-cyan-300/18",
    inputFocusClass: "focus:border-cyan-200/60 focus:ring-cyan-300/10",
    backgroundLayer:
      "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_38%)]",
    hudLayer:
      "before:absolute before:content-[''] before:left-8 before:top-8 before:h-28 before:w-28 before:rounded-full before:border before:border-cyan-200/10 after:absolute after:content-[''] after:right-8 after:bottom-10 after:h-24 after:w-36 after:rounded-[1.5rem] after:border after:border-cyan-100/10",
    signalLine: isTurkish
      ? "Kask HUD açık. Yaşam destek hattı ilk sakin komutu bekliyor."
      : "Helmet HUD is live. Life support is waiting for the first calm command.",
    visualAssetBaseUrl: "/careerlab/pov/astronaut/base.webp",
    visualAssetOverlayUrl: "/careerlab/pov/astronaut/visor-overlay.webp",
    visualAssetGlassUrl: "/careerlab/pov/astronaut/oxygen-reflection.webp",
    visualAssetPosition: "center 40%",
    visualAssetToneClass: "mix-blend-screen",
  };
}



export default function MissionExperienceScreen({
  language,
  professionKey,
  professionTitle,
  missionTitle,
  missionBriefing,
  mentorName,
  missionCharacter,
  activeMissionStage,
  knowledgeCards,
  messages,
  input,
  setInput,
  onSend,
  isSending,
  streamingMentorText = "",
}: MissionExperienceScreenProps) {
  const isTurkish = language !== "en";

  const currentProfessionKey =
    professionKey === "doctor" ||
    professionKey === "pilot" ||
    professionKey === "ai-engineer" ||
    professionKey === "cyber-detective" ||
    professionKey === "astronaut"
      ? professionKey
      : "astronaut";

  const professionSurfaceMap = {
    astronaut: {
      surfaceLabel: isTurkish ? "Kask İçi Görev Görüşü" : "Helmet Mission View",
      relayTone: isTurkish ? "Yaşam destek rölesi" : "Life-support relay",
      viewportShape: "helmet-oval",
    },
    doctor: {
      surfaceLabel: isTurkish ? "Acil Müdahale Görüşü" : "Emergency Response View",
      relayTone: isTurkish ? "Hasta monitörü rölesi" : "Patient-monitor relay",
      viewportShape: "er-glass",
    },
    pilot: {
      surfaceLabel: isTurkish ? "Kokpit Görev Görüşü" : "Flight Deck View",
      relayTone: isTurkish ? "Kule ve radar rölesi" : "Tower and radar relay",
      viewportShape: "canopy-arc",
    },
    "ai-engineer": {
      surfaceLabel: isTurkish ? "Model Laboratuvarı Görüşü" : "Model Lab View",
      relayTone: isTurkish ? "Veri sinyali rölesi" : "Data-signal relay",
      viewportShape: "lab-grid",
    },
    "cyber-detective": {
      surfaceLabel: isTurkish ? "Güvenli Ağ Görüşü" : "Secure Network View",
      relayTone: isTurkish ? "Kanıt ve ağ rölesi" : "Evidence and network relay",
      viewportShape: "secure-terminal",
    },
  } as const;

  const professionSurface = professionSurfaceMap[currentProfessionKey];

  const childTurnCount = messages.filter((message) => message.role === "child").length;
  const latestMentorMessage = getLatestMentorMessage(messages);
  const latestCharacterMessage = getLatestCharacterMessage(messages);
  const latestChildMessage = getLatestChildMessage(messages);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [showMissionIntel, setShowMissionIntel] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [isImmersionMode, setIsImmersionMode] = useState(false);

  const scenarioVariants = useMemo(
    () => buildScenarioVariants({
      isTurkish,
      professionKey,
      missionTitle,
      missionBriefing,
      missionCharacter,
      activeMissionStage,
      knowledgeCards,
    }),
    [isTurkish, professionKey, missionTitle, missionBriefing, missionCharacter, activeMissionStage, knowledgeCards]
  );

  useEffect(() => {
    setScenarioIndex(0);
    setShowMissionIntel(false);
    setShowMemory(false);
    setIsImmersionMode(false);
  }, [professionKey, missionTitle, language]);

  const safeScenarioIndex = scenarioVariants.length > 0 ? scenarioIndex % scenarioVariants.length : 0;
  const activeScenario = scenarioVariants[safeScenarioIndex] ?? scenarioVariants[0];
  const activeMissionTitle = activeScenario.title;
  const activeMissionBriefing = activeScenario.briefing;
  const activeMissionCharacter = activeScenario.character;
  const activeStage = activeScenario.stage;
  const activeCards = activeScenario.knowledgeCards.length > 0 ? activeScenario.knowledgeCards : knowledgeCards;
  const activeKnowledgeCard = activeCards[0];

  const missionPulse = useMemo(
    () => getMissionPulse(childTurnCount, isTurkish),
    [childTurnCount, isTurkish]
  );
  const livingWorldIntercept = useMemo(
    () => getLivingWorldIntercept(childTurnCount, isTurkish),
    [childTurnCount, isTurkish]
  );
  const memoryReveal = getMemoryReveal(childTurnCount, isTurkish);
  const ambientTransmission = getAmbientTransmission(childTurnCount, isTurkish);

  const roleLabels: Record<MissionMessageView["role"], string> = isTurkish
    ? { child: "Sen", mentor: "Mentor", character: "Görev kanalı" }
    : { child: "Child", mentor: "Mentor", character: "Mission channel" };
  const conversation = messages.slice(-6);
  const liveMentorText = streamingMentorText.trim();
  const mentorLines = splitLines(liveMentorText || latestMentorMessage?.text);
  const isLiveMentorStreaming = isSending && liveMentorText.length > 0;
  const missionSkin = useMemo(
    () => getProfessionMissionSkin(professionKey, isTurkish),
    [professionKey, isTurkish]
  );
  const viewportDecor = useMemo(
    () => getProfessionViewportDecor(professionKey, isTurkish),
    [professionKey, isTurkish]
  );
  const immersionViewportFrameClass = useMemo(
    () => getImmersionViewportFrameClass(professionKey),
    [professionKey]
  );
  const immersionContentInsetClass = useMemo(
    () => getImmersionContentInsetClass(professionKey),
    [professionKey]
  );
  const immersionCommandPlaceholder = useMemo(
    () => getImmersionCommandPlaceholder(professionKey, isTurkish),
    [professionKey, isTurkish]
  );

  function handleSubmit() {
    if (!input.trim() || isSending) return;
    onSend();
    setShowMemory(true);
  }

  function handleScenarioChange() {
    setScenarioIndex((current) => (current + 1) % scenarioVariants.length);
    setShowMissionIntel(false);
    setShowMemory(false);
    const nextScenario = scenarioVariants[(scenarioIndex + 1) % scenarioVariants.length];
    const suggestedQuestion = nextScenario?.knowledgeCards?.[0]?.suggestedQuestion;
    if (suggestedQuestion) {
      setInput(suggestedQuestion);
    }
  }

  return (
    <section className={`relative overflow-hidden rounded-[2rem] border text-white shadow-2xl ${missionSkin.borderClass} ${missionSkin.shellClass}`}>
      <div className={`absolute inset-0 ${missionSkin.backgroundLayer}`} />
      <ProfessionVisualAssetLayer missionSkin={missionSkin} />
      <div className={`pointer-events-none absolute inset-0 opacity-80 ${missionSkin.hudLayer}`} />
      <div className={`pointer-events-none absolute inset-0 ${viewportDecor.vignetteClass}`} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className={`pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[3rem] border ${viewportDecor.frameClass}`} />
      <div className="pointer-events-none absolute left-1/2 top-6 h-10 w-[42%] -translate-x-1/2 rounded-b-[2rem] border-x border-b border-white/10 bg-slate-950/55 backdrop-blur-md" />
      <div className={`pointer-events-none absolute inset-x-0 top-28 h-px bg-gradient-to-r ${viewportDecor.scanClass}`} />
      <div className={`pointer-events-none absolute bottom-5 left-1/2 z-0 hidden w-[58%] -translate-x-1/2 rounded-t-[2rem] border px-5 py-3 text-[10px] uppercase tracking-[0.28em] backdrop-blur-xl lg:block ${viewportDecor.consoleClass}`}>
        <div className="flex items-center justify-between gap-4">
          <span>{viewportDecor.leftLabel}</span>
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          <span>{viewportDecor.rightLabel}</span>
        </div>
      </div>
      <div className={`pointer-events-none absolute left-5 top-5 z-0 hidden rounded-2xl border px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] backdrop-blur-xl lg:block ${viewportDecor.cornerClass}`}>
        <p>{viewportDecor.title}</p>
        <p className="mt-1 text-[9px] font-normal tracking-[0.18em] opacity-65">{viewportDecor.subtitle}</p>
      </div>
      <div className={`pointer-events-none absolute right-5 top-24 z-0 hidden w-32 rounded-2xl border p-3 text-[9px] uppercase tracking-[0.2em] backdrop-blur-xl lg:block ${viewportDecor.instrumentClass}`}>
        <div className="mb-2 h-1 rounded-full bg-current opacity-50" />
        <div className="mb-2 h-1 w-2/3 rounded-full bg-current opacity-30" />
        <div className="h-12 rounded-xl border border-current/25" />
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <ProfessionPOVOverlay professionKey={professionKey} isTurkish={isTurkish} />

      {isImmersionMode ? (
        <div className={`fixed inset-0 z-[90] overflow-hidden text-white ${missionSkin.shellClass}`}>
          <div className={`absolute inset-0 ${missionSkin.backgroundLayer}`} />
          <ProfessionVisualAssetLayer missionSkin={missionSkin} />
          <div className={`pointer-events-none absolute inset-0 opacity-90 ${missionSkin.hudLayer}`} />
          <div className={`pointer-events-none absolute inset-0 ${viewportDecor.vignetteClass}`} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:38px_38px]" />
          <ProfessionPOVOverlay professionKey={professionKey} isTurkish={isTurkish} isImmersive />
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(15,23,42,0.10)_54%,rgba(0,0,0,0.84)_100%)]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[92vh] w-[88vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[18px] border-white/[0.055] shadow-[inset_0_0_120px_rgba(0,0,0,0.76),0_0_90px_rgba(34,211,238,0.12)] lg:border-[26px]" />
          <div className="pointer-events-none absolute left-1/2 top-[7%] z-10 h-24 w-[58vw] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-white/15 via-cyan-100/6 to-transparent blur-md motion-safe:animate-pulse" />
          <div className="pointer-events-none absolute inset-x-[10%] bottom-[6%] z-10 h-28 rounded-t-[50%] bg-gradient-to-t from-black/58 via-cyan-950/14 to-transparent blur-sm" />
          <div className="pointer-events-none absolute inset-0 z-10 opacity-[0.12] [background-image:linear-gradient(rgba(125,211,252,.30)_1px,transparent_1px)] [background-size:100%_26px]" />
          <div className="pointer-events-none absolute left-[8%] top-[18%] z-10 hidden h-2 w-28 rounded-full bg-cyan-100/22 shadow-[0_0_24px_rgba(103,232,249,0.45)] lg:block" />
          <div className="pointer-events-none absolute right-[8%] top-[24%] z-10 hidden h-2 w-20 rounded-full bg-cyan-100/18 shadow-[0_0_18px_rgba(103,232,249,0.35)] lg:block" />

          <div className="relative z-30 flex min-h-screen flex-col p-3 lg:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-100/70">
                  {isTurkish ? "Tam ekran görev görüşü" : "Full mission view"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white lg:text-2xl">{activeMissionTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsImmersionMode(false)}
                className="rounded-full border border-white/25 bg-slate-950/65 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-white/15"
              >
                {isTurkish ? "Görünümden çık" : "Exit view"}
              </button>
            </div>

            <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center">
              <div className={`relative flex h-[clamp(660px,calc(100vh-6rem),940px)] w-full overflow-hidden border border-cyan-100/18 bg-slate-950/72 shadow-[0_0_110px_rgba(8,145,178,0.34)] backdrop-blur-2xl ${immersionViewportFrameClass}`}>
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] border-[clamp(18px,2.9vw,38px)] border-slate-950/68 shadow-[inset_0_0_170px_rgba(0,0,0,0.9)]" />
                <div className="pointer-events-none absolute inset-[4.5%] rounded-[inherit] border border-cyan-100/16 shadow-[inset_0_0_86px_rgba(103,232,249,0.14)] motion-safe:animate-pulse" />
                <div className="pointer-events-none absolute left-1/2 top-[8%] h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-100/48 to-transparent" />
                <div className="pointer-events-none absolute left-1/2 bottom-[9%] h-px w-[66%] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-100/24 to-transparent" />
                <div className="pointer-events-none absolute left-[7%] top-[18%] h-[62%] w-px bg-gradient-to-b from-transparent via-cyan-100/20 to-transparent" />
                <div className="pointer-events-none absolute right-[7%] top-[18%] h-[62%] w-px bg-gradient-to-b from-transparent via-cyan-100/20 to-transparent" />

                <div className="relative z-30 grid min-h-0 flex-1 gap-4 px-[clamp(78px,10vw,168px)] py-[clamp(42px,6vh,72px)] lg:grid-cols-[190px_minmax(0,1fr)_220px] xl:grid-cols-[210px_minmax(0,1fr)_246px]">
                  <aside className="hidden min-h-0 flex-col justify-between overflow-hidden rounded-[2rem] border border-cyan-100/16 bg-cyan-950/22 p-3 shadow-[inset_0_0_42px_rgba(8,145,178,0.12)] backdrop-blur-xl lg:flex">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/62">
                          {isTurkish ? "Görev aktarımı" : "Mission relay"}
                        </p>
                        <span className="rounded-full border border-cyan-200/22 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
                          {isTurkish ? "Canlı" : "Live"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold leading-6 text-white/92">{activeMissionTitle}</h3>
                      <p className="mt-2 max-h-24 overflow-hidden text-xs leading-5 text-slate-300/70">{activeMissionBriefing}</p>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/62">
                        {isTurkish ? "Aktif operasyon" : "Active operation"}
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-white/90">{activeStage.title}</p>
                      <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
                        {isTurkish ? "Kanal açık" : "Channel open"}
                      </div>
                    </div>
                  </aside>

                  <main className="relative flex min-h-0 flex-col overflow-hidden rounded-[3.1rem] border border-cyan-100/68 bg-[linear-gradient(145deg,rgba(1,8,18,0.98),rgba(8,47,73,0.92)_30%,rgba(14,116,144,0.62)_58%,rgba(2,6,23,0.98))] shadow-[inset_0_0_260px_rgba(8,145,178,0.62),0_0_230px_rgba(14,165,233,0.52)] backdrop-blur-2xl">
                    <MissionHelmetOverlay viewportShape={professionSurface.viewportShape} />
                    <div className="pointer-events-none absolute inset-7 z-10 rounded-[2.65rem] opacity-90" data-velto-layer="cinematic-density-v1">
                    <div className="pointer-events-none absolute inset-0 z-[9] overflow-hidden rounded-[3rem]" data-velto-layer="cockpit-architecture-v2">
                      <div className="absolute left-[7%] top-[18%] h-[62%] w-px bg-gradient-to-b from-transparent via-cyan-200/22 to-transparent" />
                      <div className="absolute right-[7%] top-[18%] h-[62%] w-px bg-gradient-to-b from-transparent via-cyan-200/22 to-transparent" />
                      <div className="absolute left-[12%] right-[12%] top-[13%] h-px bg-gradient-to-r from-transparent via-cyan-200/28 to-transparent" />
                      <div className="absolute left-[12%] right-[12%] bottom-[13%] h-px bg-gradient-to-r from-transparent via-cyan-200/22 to-transparent" />
                      <div className="absolute left-1/2 top-[9%] h-9 w-[34%] -translate-x-1/2 rounded-b-[2rem] border-x border-b border-cyan-100/18 bg-cyan-200/6 shadow-[0_0_32px_rgba(34,211,238,0.14)]" />
                      <div className="absolute bottom-[6%] left-1/2 h-10 w-[40%] -translate-x-1/2 rounded-t-[2rem] border-x border-t border-cyan-100/16 bg-cyan-200/5 shadow-[0_0_30px_rgba(34,211,238,0.12)]" />
                    </div>
                      <div className="absolute left-10 top-28 h-28 w-px bg-gradient-to-b from-transparent via-cyan-200/50 to-transparent" />
                      <div className="absolute right-10 top-28 h-28 w-px bg-gradient-to-b from-transparent via-cyan-200/42 to-transparent" />
                      <div className="absolute left-[16%] top-[22%] h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
                      <div className="absolute right-[18%] top-[30%] h-1 w-10 rounded-full bg-cyan-100/18 shadow-[0_0_24px_rgba(103,232,249,0.35)]" />
                      <div className="absolute bottom-[18%] left-[24%] h-px w-[52%] bg-gradient-to-r from-transparent via-cyan-200/34 to-transparent" />
                      <div className="absolute bottom-[14%] right-[18%] h-1.5 w-1.5 animate-ping rounded-full bg-emerald-200/70 shadow-[0_0_18px_rgba(110,231,183,0.75)]" />
                    </div>
                    <div className="relative z-10 flex items-center justify-between gap-3 border-b border-cyan-100/14 px-5 py-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/68">
                          {isTurkish ? "Komut merkezi bağlantısı" : "Command center link"}
                        </p>
                        <p className="mt-1 text-xs text-slate-300/72">
                          {isLiveMentorStreaming
                            ? (isTurkish ? "Aktarım canlı akıyor" : "Transmission is streaming")
                            : (isTurkish ? "Sinyal temiz. Komut bekleniyor." : "Signal clear. Awaiting command.")}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.75)]" />
                        {isLiveMentorStreaming ? (isTurkish ? "Akıyor" : "Streaming") : (isTurkish ? "Hazır" : "Ready")}
                      </span>
                    </div>


                    <div className="relative z-10 mx-5 mt-3 grid grid-cols-3 gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/60" data-velto-layer="top-mission-telemetry-v1">
                      <div className="rounded-full border border-cyan-100/14 bg-cyan-300/6 px-3 py-1.5">O₂ 92%
                      <div className="pointer-events-none absolute inset-x-8 -bottom-2 h-px bg-gradient-to-r from-transparent via-cyan-200/38 to-transparent motion-safe:animate-pulse" data-velto-layer="signal-flicker-v1" /></div>
                      <div className="rounded-full border border-cyan-100/14 bg-cyan-300/6 px-3 py-1.5 text-center">{isTurkish ? "POV aktif" : "POV active"}</div>
                      <div className="rounded-full border border-cyan-100/14 bg-cyan-300/6 px-3 py-1.5 text-right">{isTurkish ? "Sinyal kilitli" : "Signal lock"}</div>
                    </div>

                    <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-5 py-5 lg:px-6">
                      <div className="relative overflow-hidden min-h-[250px] rounded-[2.35rem] border border-cyan-100/72 bg-[radial-gradient(circle_at_76%_56%,rgba(125,211,252,0.26),transparent_18%),radial-gradient(circle_at_66%_62%,rgba(59,130,246,0.20),transparent_24%),linear-gradient(135deg,rgba(4,18,33,0.96),rgba(8,47,73,0.82)_42%,rgba(2,6,23,0.96))] p-6 shadow-[inset_0_0_210px_rgba(103,232,249,0.34),0_0_175px_rgba(34,211,238,0.44)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_38%,rgba(125,211,252,0.18),transparent_26%),linear-gradient(115deg,transparent_0%,rgba(103,232,249,0.08)_48%,transparent_56%)]" />
                        
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.35rem]" data-velto-layer="mission-image-surface-v1">
                          <div className="absolute inset-6 rounded-[1.8rem] border border-cyan-100/10 opacity-75" data-velto-layer="mission-visual-runtime-v1">
                            <div className="absolute left-6 right-6 top-1/3 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent motion-safe:animate-pulse" />
                            <div className="absolute bottom-10 left-8 h-16 w-16 rounded-full border border-cyan-100/14 bg-cyan-200/[0.035] shadow-[0_0_28px_rgba(103,232,249,0.14)]" />
                            <div className="absolute right-10 top-12 h-10 w-28 rounded-full border border-cyan-100/12 bg-cyan-300/[0.035]" />
                            <div className="absolute left-[18%] top-[22%] h-1.5 w-1.5 animate-ping rounded-full bg-cyan-200/70 shadow-[0_0_16px_rgba(103,232,249,0.75)]" />
                            <div className="absolute right-[26%] bottom-[28%] h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200/70 shadow-[0_0_16px_rgba(110,231,183,0.70)]" />
                          </div>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_52%,rgba(56,189,248,0.30),transparent_18%),radial-gradient(circle_at_86%_48%,rgba(147,197,253,0.18),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.05),rgba(2,6,23,0.88))]" />
                          <div className="absolute bottom-14 right-10 h-28 w-44 rounded-t-[4rem] border-t border-cyan-100/18 bg-cyan-100/5 shadow-[0_0_38px_rgba(56,189,248,0.16)]" />
                          <div className="absolute bottom-16 right-36 h-16 w-24 rounded-t-[3rem] border-t border-cyan-100/16 bg-cyan-100/5" />
                          <div className="absolute bottom-14 left-14 right-10 h-px bg-gradient-to-r from-transparent via-cyan-100/44 to-transparent" />
                          <div className="absolute right-16 top-14 h-24 w-24 rounded-full border border-cyan-100/12 bg-cyan-200/6 shadow-[0_0_50px_rgba(125,211,252,0.20)]" />
                        </div>
<div className="pointer-events-none absolute inset-5 rounded-[2rem] bg-slate-950/18 backdrop-blur-[1px]" data-velto-layer="typography-readability-v1" />
                        <div className="pointer-events-none absolute left-5 right-5 top-4 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.45)]" />
                        <div className="pointer-events-none absolute left-5 top-4 h-8 w-px bg-gradient-to-b from-cyan-100/42 to-transparent" />
                        <div className="pointer-events-none absolute right-5 top-4 h-8 w-px bg-gradient-to-b from-cyan-100/42 to-transparent" />
                        
                        <div className="pointer-events-none absolute inset-x-8 bottom-8 top-28 opacity-48" data-velto-layer="transmission-backdrop-v2">
                          <div className="absolute left-1/2 top-[58%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/8 bg-cyan-200/[0.035] shadow-[0_0_42px_rgba(34,211,238,0.12)]" />
                          <div className="absolute left-[12%] right-[12%] top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-100/32 to-transparent" />
                          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-1">
                            <span className="h-3 w-1 rounded-full bg-cyan-200/45 motion-safe:animate-pulse" />
                            <span className="h-8 w-1 rounded-full bg-cyan-100/70 motion-safe:animate-pulse" />
                            <span className="h-5 w-1 rounded-full bg-sky-200/55 motion-safe:animate-pulse" />
                            <span className="h-10 w-1 rounded-full bg-cyan-200/80 motion-safe:animate-pulse" />
                            <span className="h-6 w-1 rounded-full bg-emerald-200/55 motion-safe:animate-pulse" />
                            <span className="h-9 w-1 rounded-full bg-cyan-100/65 motion-safe:animate-pulse" />
                            <span className="h-4 w-1 rounded-full bg-sky-200/55 motion-safe:animate-pulse" />
                            <span className="h-7 w-1 rounded-full bg-cyan-200/65 motion-safe:animate-pulse" />
                          </div>
                        </div>
<div className="pointer-events-none absolute bottom-5 left-1/2 h-9 w-[82%] -translate-x-1/2 opacity-75">
                          <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-200/30 shadow-[0_0_22px_rgba(34,211,238,0.45)]" />
                          <div className="mx-auto flex h-full w-2/3 items-center justify-center gap-1">
                            {Array.from({ length: 22 }).map((_, index) => (
                              <span
                                key={`immersive-wave-${index}`}
                                className="w-0.5 rounded-full bg-cyan-200/70 shadow-[0_0_10px_rgba(103,232,249,0.55)]"
                                style={{ height: `${8 + ((index * 7) % 24)}px` }}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-100/68">
                          {mentorName}
                        </p>
                        <div className="relative z-10 mt-5 min-h-[132px] space-y-2 pr-2 max-w-[62%] text-[1.02rem] font-semibold leading-7 tracking-[-0.01em] text-slate-50 lg:text-[1.18rem] lg:leading-8 xl:text-[1.32rem] xl:leading-[2.05rem]">
                          {mentorLines.length > 0 ? mentorLines.slice(-3).map((line, index) => (
                            <p key={`immersive-focus-${line}-${index}`}>
                              {line}
                              {isLiveMentorStreaming && index === Math.min(mentorLines.length, 3) - 1 ? (
                                <span className="ml-1 inline-block h-6 w-2 translate-y-1 animate-pulse rounded-sm bg-cyan-200/90 shadow-[0_0_18px_rgba(103,232,249,0.75)]" />
                              ) : null}
                            </p>
                          )) : (
                            <p>{isTurkish ? "Kanal açık. İlk sakin sinyalini bekliyorum." : "Channel open. I am waiting for your first calm signal."}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.9rem] border border-cyan-100/26 bg-cyan-950/34 p-4 shadow-[inset_0_0_58px_rgba(8,145,178,0.18),0_0_36px_rgba(14,165,233,0.10)]">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.75)]" />
                          <span className="h-px flex-1 bg-gradient-to-r from-cyan-100/35 to-transparent" />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/64">
                          {isTurkish ? "Şu anki karar penceresi" : "Current decision window"}
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white/94 lg:text-base lg:leading-7 xl:text-lg">{activeStage.thinkingQuestion}</p>
                      </div>
                    </div>

                    <div className="relative z-10 border-t border-cyan-100/18 bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(8,47,73,0.36))] p-4">
                      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
                      <div className="relative rounded-[2rem] border border-cyan-100/72 bg-slate-950/98 p-2 shadow-[inset_0_0_82px_rgba(8,145,178,0.36),0_0_92px_rgba(14,165,233,0.38)]">
                        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent" />
                        <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            handleSubmit();
                          }
                        }}
                        rows={1}
                        placeholder={immersionCommandPlaceholder}
                        className={`min-h-[58px] w-full resize-none rounded-[1.5rem] border border-cyan-100/18 bg-transparent px-4 py-3 pr-36 text-sm leading-6 text-white outline-none transition placeholder:text-slate-400 focus:ring-4 ${missionSkin.inputFocusClass}`}
                        />
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!input.trim() || isSending}
                          className={`absolute bottom-3 right-3 rounded-[1.35rem] border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] shadow-[0_0_28px_rgba(34,211,238,0.18)] transition ${
                            !input.trim() || isSending
                              ? "border-cyan-100/42 bg-cyan-200/28 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.22)]"
                              : "border-cyan-100/80 bg-cyan-200 text-slate-950 shadow-[0_0_42px_rgba(34,211,238,0.58)] hover:bg-white"
                          } disabled:cursor-not-allowed`}
                        >
                          {isSending ? (isTurkish ? "Aktarım" : "Relay") : (isTurkish ? "Sinyali gönder" : "Send")}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="hidden text-xs text-slate-400 sm:block">
                          {isTurkish ? "Sinyalin doğrudan canlı görev kanalına gider." : "Your signal goes directly to the live mission channel."}
                        </p>

                      </div>
                    </div>
                  </main>

                  <MissionCrewRelay
                    isTurkish={isTurkish}
                    characterChannel={activeMissionCharacter.channel}
                    characterName={activeMissionCharacter.name}
                    characterMessage={latestCharacterMessage?.text ?? activeMissionCharacter.openingLine}
                    latestChildMessage={latestChildMessage?.text}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative z-30 grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-7">
        <div className="space-y-5">
          <div className={`rounded-[1.75rem] border p-5 backdrop-blur-xl lg:p-6 ${missionSkin.primaryPanelClass}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.35em] ${missionSkin.accentSoftTextClass}`}>
                  {isTurkish ? "Canlı Komut Kanalı" : "Live Command Channel"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                  {activeMissionTitle}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50/65">
                  {isTurkish
                    ? "Görev sen gelmeden başlamıştı. Komut merkezi şimdi seni canlı kanala aldı."
                    : "The mission started before you arrived. Command Center has now pulled you into the live channel."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${missionSkin.badgeClass}`}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                  {mentorName} online
                </div>
                <button
                  type="button"
                  onClick={handleScenarioChange}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${missionSkin.buttonClass}`}
                >
                  {isTurkish ? "Senaryoyu değiştir" : "Change scenario"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsImmersionMode(true)}
                  className="rounded-full border border-white/30 bg-white/90 px-3 py-2 text-xs font-bold text-slate-950 shadow-[0_0_28px_rgba(255,255,255,0.2)] transition hover:bg-cyan-50"
                >
                  {isTurkish ? "Göreve gir" : "Enter mission"}
                </button>
              </div>
            </div>

            <div className="mb-5 rounded-[1.35rem] border border-emerald-200/15 bg-emerald-300/[0.07] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-100/70">
                    {livingWorldIntercept.pulse}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-emerald-50">
                    {livingWorldIntercept.status}
                  </h3>
                </div>
                <p className="max-w-xl text-sm leading-6 text-emerald-50/75">
                  {livingWorldIntercept.line}
                  {childTurnCount === 0 ? ` ${missionSkin.signalLine}` : ""}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-200/15 bg-emerald-300/10 p-4 shadow-inner shadow-emerald-950/20">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-300" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-100/70">
                    {ambientTransmission.label} · {ambientTransmission.source}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                    {ambientTransmission.line}
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-[1.5rem] border p-5 shadow-inner ${missionSkin.streamPanelClass}`}>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-lg">
                  {missionSkin.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                    {missionSkin.frameLabel}
                  </p>
                  <p className="mt-3 text-base leading-7 text-slate-100 lg:text-lg">
                    {activeMissionBriefing}
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-cyan-100">
                      {activeStage.title}
                    </p>
                    <p className="mt-2 text-base font-semibold leading-7 text-white lg:text-[1.05rem]">
                      {activeStage.thinkingQuestion}
                    </p>
                    {activeStage.mentorHint ? (
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {activeStage.mentorHint}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <MissionTransmissionSurface
            isTurkish={isTurkish}
            missionSkin={missionSkin}
            mentorName={mentorName}
            mentorLines={mentorLines}
            isLiveMentorStreaming={isLiveMentorStreaming}
            activeMissionCharacter={activeMissionCharacter}
            latestCharacterMessage={latestCharacterMessage}
            latestChildMessage={latestChildMessage}
            conversation={conversation}
            roleLabels={roleLabels}
            childTurnCount={childTurnCount}
          />

          <MissionCommandInput
            isTurkish={isTurkish}
            input={input}
            isSending={isSending}
            commandPanelClass={missionSkin.commandPanelClass}
            inputFocusClass={missionSkin.inputFocusClass}
            onInputChange={setInput}
            onSubmit={handleSubmit}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
              {isTurkish ? "Komut Merkezi" : "Command Center"}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">{professionTitle}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{missionPulse}</p>
            <p className={`mt-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 ${missionSkin.accentSoftTextClass}`}>
              {missionSkin.signalLine}
            </p>
            <div className="mt-4 rounded-2xl border border-fuchsia-200/15 bg-fuchsia-300/10 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100/70">
                {isTurkish ? "Aktif senaryo" : "Active scenario"}
              </p>
              <p className="mt-1 text-sm font-semibold text-fuchsia-50">{activeScenario.signalLabel}</p>
              <p className="mt-1 text-xs text-fuchsia-50/60">
                {safeScenarioIndex + 1}/{scenarioVariants.length}
              </p>
            </div>
          </div>

          {memoryReveal && showMemory ? (
            <div className="rounded-[1.5rem] border border-amber-200/20 bg-amber-300/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-100/80">
                {memoryReveal.eyebrow}
              </p>
              <h3 className="mt-2 font-semibold text-amber-50">{memoryReveal.title}</h3>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">{memoryReveal.body}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowMissionIntel((current) => !current)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 hover:bg-white/[0.06]"
          >
            {showMissionIntel
              ? isTurkish
                ? "Alan raporunu gizle"
                : "Hide field report"
              : isTurkish
                ? "Alan raporunu aç"
                : "Open field report"}
          </button>

          {showMissionIntel ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                {isTurkish ? "Alan Raporu" : "Field Report"}
              </p>
              <h3 className="mt-2 font-semibold text-white">{activeKnowledgeCard?.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeKnowledgeCard?.explanation}</p>
              {activeKnowledgeCard?.whyItMatters ? (
                <p className="mt-3 text-sm leading-6 text-cyan-100/80">
                  {activeKnowledgeCard.whyItMatters}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      
                  <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-5 rounded-full border border-cyan-100/12 bg-slate-950/64 px-7 py-2.5 shadow-[0_0_36px_rgba(14,165,233,0.16)] backdrop-blur-md" data-velto-layer="bottom-mission-indicators-v1">
                    <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-cyan-100/62">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
                      POV Active
                    </div>
                    <div className="h-4 w-px bg-cyan-100/12" />
                    <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-cyan-100/62">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                      Live Relay
                    </div>
                  </div>
</div>
    </section>
  );
}
