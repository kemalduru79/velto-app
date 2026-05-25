"use client";

import { useEffect, useRef, useState } from "react";
import MissionExperienceScreen from "./MissionExperienceScreen";
import {
  buildInitialMissionRuntimeState,
  evaluateMissionRuntime,
  getCrewRelayDelayFromRuntime,
  getMentorPresenceDelayFromRuntime,
  getMissionRuntimeLabel,
  getRuntimeSignalPrelude,
  getCrewRuntimePrefix,
  getMentorRuntimeDirective,
  type MissionRuntimeState,
} from "./missionStateEngine";

// Canonical Career Lab mission controller. This file replaces the old recovery layer as the production source of truth.

type CareerMissionExperienceProps = {
  language: string;
  professionKey: string;
  professionTitle: string;
  missionTitle: string;
  missionBriefing: string;
  missionObjective: string;
  mentorName: string;
};

type Message = {
  role: "child" | "mentor" | "character";
  text: string;
  speaker?: string;
};

type ConsequenceCard = {
  title: string;
  caption: string;
  tone: string;
  promptSlot: string;
};

type MissionMetrics = {
  crewTrust: number;
  systemClarity: number;
  missionPressure: number;
  riskLevel: number;
};

type BranchSignal = {
  label: string;
  description: string;
  nextStep: string;
  tone: "safe" | "uncertain" | "risky";
};

type MissionBranchState = "SAFE" | "UNCERTAIN" | "RISKY";

type DecisionIdentityProfile = {
  label: string;
  description: string;
  mentorNote: string;
  traits: string[];
};

type MissionStreamEvent = {
  time: string;
  label: string;
  title: string;
  body: string;
  tone: "system" | "mentor" | "character" | "alert" | "decision";
  pacing?: "calm" | "tense" | "pause" | "urgent";
  visualBeat?: {
    title: string;
    prompt: string;
    mood: string;
  };
};

type StoryverseScenePackage = {
  title: string;
  narration: string;
  visualPrompt: string;
  emotionalBeat: string;
  pacing: string;
};

type CreatorLabRecapPackage = {
  title: string;
  hook: string;
  caption: string;
  format: string;
  scenes: StoryverseScenePackage[];
};

type MissionKnowledgeCard = {
  title: string;
  explanation: string;
  whyItMatters: string;
  affectedSystems: string[];
  suggestedQuestion: string;
};

type MissionStage = {
  title: string;
  context: string;
  mentorHint: string;
  thinkingQuestion: string;
  thinkingStarters?: string[];
};

type MissionPath = {
  role: string;
  stages: MissionStage[];
};

type MissionCharacter = {
  name: string;
  role: string;
  channel: string;
  openingLine: string;
};

type InformationChannel = {
  label: string;
  prompt: string;
};

export default function CareerMissionExperience({
  language,
  professionKey,
  professionTitle,
  missionTitle,
  missionBriefing,
  mentorName,
}: CareerMissionExperienceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isMentorTyping, setIsMentorTyping] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [isMentorSpeaking, setIsMentorSpeaking] = useState(false);
  const [streamingMentorText, setStreamingMentorText] = useState("");
  const [worldReactions, setWorldReactions] = useState<string[]>([]);
  const [consequenceCards, setConsequenceCards] = useState<ConsequenceCard[]>([]);
  const [missionMetrics, setMissionMetrics] = useState<MissionMetrics>({
    crewTrust: 42,
    systemClarity: 36,
    missionPressure: 28,
    riskLevel: 22,
  });
  const [branchSignals, setBranchSignals] = useState<BranchSignal[]>([]);
  const [showMissionDetails, setShowMissionDetails] = useState(false);
  const [missionBranchState, setMissionBranchState] =
    useState<MissionBranchState>("UNCERTAIN");
  const [missionRuntime, setMissionRuntime] = useState<MissionRuntimeState>(() =>
    buildInitialMissionRuntimeState(),
  );

  const [typedAssignment, setTypedAssignment] = useState("");
  const [typedStreamBody, setTypedStreamBody] = useState("");

  const typingTimerRef = useRef<number | null>(null);
  const streamTypingTimerRef = useRef<number | null>(null);
  const lastSpokenStreamEventRef = useRef<string | null>(null);

  const childTurnCount = messages.filter((message) => message.role === "child").length;
  const isTurkish = language !== "en";
  const missionPhase = getMissionPhase(childTurnCount);
  const missionMemoryStatus = getMissionMemoryStatus(childTurnCount);
  const missionOutcome = buildMissionOutcome(missionBranchState);
  const missionPath = getMissionPath(professionKey, isTurkish);
  const missionCharacter = getMissionCharacter(professionKey, isTurkish);
  const informationChannels = getInformationChannels(professionKey);
  const activeMissionStage =
    missionPath.stages[
      Math.min(childTurnCount, missionPath.stages.length - 1)
    ];
  const latestBranchSignal = branchSignals[branchSignals.length - 1];
  const currentFocusText =
    latestBranchSignal?.nextStep ??
    activeMissionStage.thinkingQuestion;
  const branchCommandStarter = getBranchCommandStarter(missionBranchState);
  const branchConfidence = getBranchConfidence();
  const branchPatternLabel = getBranchPatternLabel();
  const decisionIdentityProfile = getDecisionIdentityProfile();
  const missionStreamEvents = buildMissionStreamEvents();
  const activeStreamEvent = missionStreamEvents[missionStreamEvents.length - 1];
  const activeVisualBeat = buildVisualBeatForEvent(activeStreamEvent);
  const storyverseScenePackages = buildStoryverseScenePackages();
  const creatorLabRecapPackage = buildCreatorLabRecapPackage();
  const missionKnowledgeCards = buildMissionKnowledgeCards();
  const streamHistoryEvents = missionStreamEvents.slice(0, -1).slice(-5);
  const missionIdentityKey = `${language}:${professionKey}:${professionTitle}:${missionTitle}:${mentorName}`;



  const assignmentText = isTurkish
    ? `
CANLI GÖREV AKIŞI

${mentorName} komut kanalına bağlandı.
${missionCharacter.name}, ${missionCharacter.channel} üzerinden yayında.

${missionTitle}

${missionBriefing}

İlk olarak hangi sinyali doğrulamak istediğini seç...
`
    : `
LIVE MISSION STREAM

${mentorName} connected to command channel.
${missionCharacter.name} connected to ${missionCharacter.channel}.

${missionTitle}

${missionBriefing}

Choose what you want to investigate first...
`;

  useEffect(() => {
    setTypedAssignment("");
    setMessages([]);
    setInput("");
    setIsMentorTyping(false);
    setStreamingMentorText("");
    setTypedStreamBody("");
    setWorldReactions([]);
    setConsequenceCards([]);
    setBranchSignals([]);
    setMissionMetrics({
      crewTrust: 42,
      systemClarity: 36,
      missionPressure: 28,
      riskLevel: 22,
    });
    setMissionRuntime(buildInitialMissionRuntimeState());
    stopMentorVoice();

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (streamTypingTimerRef.current) {
      window.clearTimeout(streamTypingTimerRef.current);
      streamTypingTimerRef.current = null;
    }

    lastSpokenStreamEventRef.current = null;
  }, [missionIdentityKey]);

  useEffect(() => {
    setTypedAssignment("");

    let index = 0;

    const interval = window.setInterval(() => {
      setTypedAssignment(assignmentText.slice(0, index));

      index += 1;

      if (index > assignmentText.length) {
        window.clearInterval(interval);
      }
    }, 22);

    return () => {
      window.clearInterval(interval);
    };
  }, [assignmentText]);

  useEffect(() => {
    setTypedStreamBody("");

    if (streamTypingTimerRef.current) {
      window.clearTimeout(streamTypingTimerRef.current);
      streamTypingTimerRef.current = null;
    }

    let index = 0;
    const body = activeStreamEvent.body;
    const streamEventKey = `${activeStreamEvent.time}:${activeStreamEvent.label}:${activeStreamEvent.title}`;

    const tick = () => {
      setTypedStreamBody(body.slice(0, index));
      index += 1;

      if (index <= body.length) {
        streamTypingTimerRef.current = window.setTimeout(tick, 14);
        return;
      }

      if (
        activeStreamEvent.tone !== "decision" &&
        lastSpokenStreamEventRef.current !== streamEventKey
      ) {
        lastSpokenStreamEventRef.current = streamEventKey;
        speakMentorText(body);
      }
    };

    streamTypingTimerRef.current = window.setTimeout(tick, 120);

    return () => {
      if (streamTypingTimerRef.current) {
        window.clearTimeout(streamTypingTimerRef.current);
        streamTypingTimerRef.current = null;
      }
    };
  }, [
    activeStreamEvent.body,
    activeStreamEvent.label,
    activeStreamEvent.time,
    activeStreamEvent.title,
    activeStreamEvent.tone,
  ]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }

      if (streamTypingTimerRef.current) {
        window.clearTimeout(streamTypingTimerRef.current);
      }

      stopMentorVoice();
    };
  }, []);

  function getInformationChannels(professionKey: string): InformationChannel[] {
    const normalizedProfessionKey = professionKey
      .replace(/[-_\s]/g, "")
      .toLowerCase();

    const channels: Record<string, InformationChannel[]> = {
      astronaut: [
        {
          label: isTurkish ? "Oksijen sensörü" : "Oxygen sensor data",
          prompt: isTurkish
            ? "Maya, ana oksijen sensörünü yedek sensörle karşılaştırabilir misin?"
            : "Maya, please compare the main oxygen sensor with the backup oxygen sensor.",
        },
        {
          label: isTurkish ? "Ekip durumu" : "Crew health status",
          prompt: isTurkish
            ? "Maya, ekibin sağlık ve stres durumunu aktarabilir misin?"
            : "Maya, what is the current crew health and stress status?",
        },
        {
          label: isTurkish ? "Güç sistemi" : "Power system logs",
          prompt: isTurkish
            ? "Maya, oksijen alarmı bir güç dalgalanmasından sonra mı başladı?"
            : "Maya, did the oxygen alarm start after a power fluctuation?",
        },
      ],
      doctor: [
        {
          label: isTurkish ? "Belirtiler" : "Symptoms",
          prompt: isTurkish
            ? "Alex, şu anda hangi belirtileri hissediyorsun?"
            : "Alex, what symptoms are you feeling right now?",
        },
        {
          label: isTurkish ? "Solunum" : "Breathing",
          prompt: isTurkish
            ? "Alex, normal nefes alabiliyor musun yoksa nefesin daralıyor mu?"
            : "Alex, are you breathing normally or feeling short of breath?",
        },
        {
          label: isTurkish ? "Ağrı seviyesi" : "Pain level",
          prompt: isTurkish
            ? "Alex, ağrı nerede ve ne kadar güçlü?"
            : "Alex, where is the pain and how strong is it?",
        },
      ],
      pilot: [
        {
          label: isTurkish ? "Hava hareketi" : "Weather movement",
          prompt: isTurkish
            ? "Kule, fırtınanın son hareketi ve rüzgâr durumu nedir?"
            : "Tower, what is the latest storm movement and wind condition?",
        },
        {
          label: isTurkish ? "Pist görüşü" : "Runway visibility",
          prompt: isTurkish
            ? "Kule, pistteki mevcut görüş durumu nedir?"
            : "Tower, what is the current runway visibility?",
        },
        {
          label: isTurkish ? "Yakıt zamanı" : "Fuel timing",
          prompt: isTurkish
            ? "Kule, mevcut yakıtla güvenli bekleme süremiz ne kadar?"
            : "Tower, how much safe holding time do we have with current fuel?",
        },
      ],
      aiengineer: [
        {
          label: isTurkish ? "Eğitim verisi" : "Training data",
          prompt: isTurkish
            ? "Mina, bu yapay zekâ davranışını hangi veri sorunu açıklayabilir?"
            : "Mina, what training data issue could explain this AI behavior?",
        },
        {
          label: isTurkish ? "Model davranışı" : "Model behavior",
          prompt: isTurkish
            ? "Mina, model hangi noktada beklenmeyen davranıyor?"
            : "Mina, where is the model behaving unexpectedly?",
        },
        {
          label: isTurkish ? "Kullanıcı etkisi" : "User safety impact",
          prompt: isTurkish
            ? "Mina, bu yapay zekâ yanılırsa hangi kullanıcılar zarar görebilir?"
            : "Mina, which users could be harmed if this AI is wrong?",
        },
      ],
      cyberdetective: [
        {
          label: isTurkish ? "Giriş kaynağı" : "Login source",
          prompt: isTurkish
            ? "Noah, şüpheli giriş nereden geldi?"
            : "Noah, where did the suspicious login come from?",
        },
        {
          label: isTurkish ? "Şüpheli cihaz" : "Suspicious device",
          prompt: isTurkish
            ? "Noah, yeni cihaz hakkında ne biliyoruz?"
            : "Noah, what do we know about the new device?",
        },
        {
          label: isTurkish ? "Etkilenen hesap" : "Affected account activity",
          prompt: isTurkish
            ? "Noah, şu anda hangi hesap hareketi riskli görünüyor?"
            : "Noah, which account activity looks risky right now?",
        },
      ],
    };

    return (
      channels[normalizedProfessionKey] ?? [
        {
          label: isTurkish ? "Durum verisi" : "Situation data",
          prompt: isTurkish
            ? "Görev uzmanı, önce hangi bilgiyi doğrulamalıyım?"
            : "Mission Specialist, what information should I verify first?",
        },
        {
          label: isTurkish ? "İnsan durumu" : "People status",
          prompt: isTurkish
            ? "Görev uzmanı, şu anda kim korunmalı ya da desteklenmeli?"
            : "Mission Specialist, who needs protection or support right now?",
        },
        {
          label: isTurkish ? "Risk sinyali" : "Risk signal",
          prompt: isTurkish
            ? "Görev uzmanı, en büyük risk sinyali hangisi?"
            : "Mission Specialist, what is the biggest risk signal?",
        },
      ]
    );
  }

  function getMissionCharacter(professionKey: string, isTurkish: boolean): MissionCharacter {
    const normalizedProfessionKey = professionKey
      .replace(/[-_\s]/g, "")
      .toLowerCase();

    if (isTurkish) {
      const turkishCharacters: Record<string, MissionCharacter> = {
        astronaut: {
          name: "Maya Chen",
          role: "Yaşam Destek Mühendisi",
          channel: "Yaşam Destek Kanalı",
          openingLine:
            "Oksijen sensörlerini, yedek okumaları ve kabin basıncını izliyorum. Doğrulamamı istediğin ilk sinyali söyle.",
        },
        doctor: {
          name: "Alex",
          role: "Hasta",
          channel: "Hasta Odası",
          openingLine:
            "Ne hissettiğimi, ne zaman başladığını ve neyin değiştiğini anlatabilirim. Sakin bir soruyla başla.",
        },
        pilot: {
          name: "Kule Kontrol",
          role: "Hava Trafik Kontrol",
          channel: "Kule Kanalı",
          openingLine:
            "Fırtına hareketi, pist görüşü ve bekleme talimatlarını paylaşabilirim. Önce hangi veriyi istiyorsun?",
        },
        aiengineer: {
          name: "Mina Park",
          role: "AI Güvenlik İnceleyicisi",
          channel: "Model İnceleme Kanalı",
          openingLine:
            "Model davranışı, veri endişeleri ve güvenlik risklerini paylaşabilirim. Yayına almadan önce neyi kontrol etmek istiyorsun?",
        },
        cyberdetective: {
          name: "Noah Reed",
          role: "Güvenlik Analisti",
          channel: "Güvenlik Operasyon Kanalı",
          openingLine:
            "Giriş ipuçları, cihaz sinyalleri ve şüpheli hareketleri paylaşabilirim. Önce neyi doğrulamak istiyorsun?",
        },
      };

      return (
        turkishCharacters[normalizedProfessionKey] ??
        turkishCharacters[professionKey] ??
        {
          name: "Görev Uzmanı",
          role: "Saha Uzmanı",
          channel: "Görev Destek Kanalı",
          openingLine:
            "Görev ayrıntılarını ve saha gözlemlerini paylaşabilirim. Önce neyi anlaman gerekiyor?",
        }
      );
    }

    const characters: Record<string, MissionCharacter> = {
      astronaut: {
        name: "Maya Chen",
        role: "Life Support Engineer",
        channel: "Life Support Channel",
        openingLine:
          "I am monitoring oxygen sensors, backup readings and crew cabin pressure. Ask me what you need to verify.",
      },
      doctor: {
        name: "Alex",
        role: "Patient",
        channel: "Patient Room",
        openingLine:
          "I can tell you what I feel, when it started and what has changed. Ask me calmly.",
      },
      pilot: {
        name: "Tower Control",
        role: "Air Traffic Control",
        channel: "Tower Channel",
        openingLine:
          "We can provide storm movement, runway visibility and holding instructions. Ask for the data you need.",
      },
      aiengineer: {
        name: "Mina Park",
        role: "AI Safety Reviewer",
        channel: "Model Review Channel",
        openingLine:
          "I can share model behavior, data concerns and safety risks. Ask what you need to check before launch.",
      },
      cyberdetective: {
        name: "Noah Reed",
        role: "Security Analyst",
        channel: "Security Operations Channel",
        openingLine:
          "I can provide login clues, device signals and suspicious activity details. Ask what you want to verify.",
      },
    };

    return (
      characters[normalizedProfessionKey] ??
      characters[professionKey] ??
      {
        name: "Mission Specialist",
        role: "Field Specialist",
        channel: "Mission Support Channel",
        openingLine:
          "I can provide mission details and field observations. Ask me what you need to understand first.",
      }
    );
  }

  function buildCharacterReply(userInput: string, character: MissionCharacter, branchState: MissionBranchState, isTurkish: boolean) {
    const normalized = userInput.toLowerCase();

    const branchContext = isTurkish
      ? branchState === "SAFE"
        ? " Mevcut hat dengeleniyor; bu yüzden en net doğrulanmış sinyali vereceğim."
        : branchState === "RISKY"
          ? " Mevcut hat baskı altında; bu yüzden önce en güvenli uyarıyı öne çıkaracağım."
          : " Mevcut hat belirsiz; bu yüzden hâlâ eksik olan sinyale odaklanacağım."
      : branchState === "SAFE"
        ? " Current branch is stabilizing, so I will give you the clearest confirmed signal."
        : branchState === "RISKY"
          ? " Current branch is under pressure, so I will highlight the safest warning first."
          : " Current branch is uncertain, so I will focus on what is still missing.";

    const wantsHelp =
      normalized.includes("help") ||
      normalized.includes("what should") ||
      normalized.includes("where should") ||
      normalized.includes("not sure") ||
      normalized.includes("yardım") ||
      normalized.includes("emin değilim") ||
      normalized.includes("neye bak");

    const roleKey = character.role.toLowerCase();
    const isLifeSupport = roleKey.includes("life support") || roleKey.includes("yaşam destek");
    const isPatient = roleKey.includes("patient") || roleKey.includes("hasta");
    const isFlightControl = roleKey.includes("air traffic") || roleKey.includes("hava trafik");
    const isAiSafety = roleKey.includes("ai safety") || roleKey.includes("güvenlik inceleyicisi");
    const isSecurity = roleKey.includes("security analyst") || roleKey.includes("güvenlik analisti");

    if (isTurkish) {
      if (isLifeSupport && wantsHelp) {
        return `${character.name}: Komutan, doğrudan cevap vermeden önce seçelim: oksijen sensör verisi mi, ekip sağlık durumu mu, güç sistemi kayıtları mı?${branchContext}`;
      }

      if (isPatient && wantsHelp) {
        return `${character.name}: Doktor, önce belirtilerimi, nefes durumumu ya da ağrı seviyemi sormak ister misin?${branchContext}`;
      }

      if (isFlightControl && wantsHelp) {
        return `${character.name}: Pilot, önce hangi bilgiye ihtiyacın var: hava hareketi, pist görüşü ya da yakıt zamanı?${branchContext}`;
      }

      if (isAiSafety && wantsHelp) {
        return `${character.name}: Önce hangi riski inceleyelim: eğitim verisi, model davranışı ya da kullanıcı güvenliği etkisi?${branchContext}`;
      }

      if (isSecurity && wantsHelp) {
        return `${character.name}: Önce hangi ipucunu istiyorsun: giriş kaynağı, şüpheli cihaz ya da hesap hareketi?${branchContext}`;
      }

      if (isLifeSupport) {
        if (normalized.includes("yedek") || normalized.includes("oksijen") || normalized.includes("sensör") || normalized.includes("sensor")) {
          return [
            `${character.name}: Ana oksijen sensörü %18,1 gösteriyor; yedek sensör ise %20,7 okuyor.`,
            "Kabin basıncı stabil ve ekipte düşük oksijen belirtisi görünmüyor.",
            "Bu daha çok tam oksijen kaybından ziyade sensör uyuşmazlığına işaret ediyor; yine de uyarıyı gevşetmeden önce güç kayıtlarını doğrulamalıyız.",
          ].join("\n");
        }

        if (normalized.includes("ekip") || normalized.includes("sağlık") || normalized.includes("mürettebat") || normalized.includes("crew")) {
          return [
            `${character.name}: Ekip sağlığı stabil. Nabızlar yüksek, ama bu daha çok stres kaynaklı.`,
            "Şu anda kimse düşük oksijen belirtisi göstermiyor.",
            "Komut kanalından sakin bir yönlendirme gelirse ekip kontrolleri daha net sürdürebilir.",
          ].join("\n");
        }

        if (normalized.includes("güç") || normalized.includes("enerji") || normalized.includes("kayıt") || normalized.includes("power") || normalized.includes("log")) {
          return [
            `${character.name}: Güç kayıtlarında oksijen uyarısından 42 saniye önce kısa bir dalgalanma var.`,
            "Bu, ana sensörün neden düştüğünü ve yedek okumaların neden normale yakın kaldığını açıklayabilir.",
            "En güvenli sonraki adım, yedek sensör verisini kabin basıncıyla karşılaştırmak.",
          ].join("\n");
        }

        return `${character.name}: Oksijen sensör verisini, ekip sağlık durumunu ya da güç sistemi kayıtlarını verebilirim. Bir sonraki komuttan önce hangi sinyali istiyorsun?${branchContext}`;
      }

      if (isPatient) {
        return `${character.name}: Belirti, nefes durumu ya da ağrı seviyesini anlatabilirim. Lütfen tek ve net bir soru sor.${branchContext}`;
      }

      if (isFlightControl) {
        return `${character.name}: Hava hareketi, pist görüşü ya da yakıt zamanı bilgisini verebilirim. Önce hangi veriyi istiyorsun?${branchContext}`;
      }

      if (isAiSafety) {
        return `${character.name}: Karar vermeden önce eğitim verisini, model davranışını ya da kullanıcı güvenliği etkisini incelemeliyiz.${branchContext}`;
      }

      if (isSecurity) {
        return `${character.name}: Giriş kaynağını, şüpheli cihazı ya da hesap hareketini kontrol edebilirim. Önce neyi doğrulamak istiyorsun?${branchContext}`;
      }

      return `${character.name}: Saha bilgisini paylaşabilirim. Bir sonraki karardan önce neyi doğrulamak istediğini sor.`;
    }

    if (character.role === "Life Support Engineer" && wantsHelp) {
      return `${character.name}: Commander, before I answer directly: do you want oxygen sensor data, crew health status or power system logs first?${branchContext}`;
    }

    if (character.role === "Patient" && wantsHelp) {
      return `${character.name}: Doctor, would you like to ask about symptoms, breathing or pain level first?${branchContext}`;
    }

    if (character.role === "Air Traffic Control" && wantsHelp) {
      return `${character.name}: Pilot, which information do you need first: weather movement, runway visibility or fuel timing?${branchContext}`;
    }

    if (character.role === "AI Safety Reviewer" && wantsHelp) {
      return `${character.name}: Which risk should we inspect first: training data, model behavior or user safety impact?${branchContext}`;
    }

    if (character.role === "Security Analyst" && wantsHelp) {
      return `${character.name}: Which clue do you want first: login source, suspicious device or affected account activity?${branchContext}`;
    }

    if (character.role === "Life Support Engineer") {
      if (normalized.includes("backup") || normalized.includes("main oxygen") || normalized.includes("oxygen sensor") || normalized.includes("oksijen") || normalized.includes("sensor")) {
        return [
          `${character.name}: Main oxygen sensor is reading 18.1%, but the backup sensor reads 20.7%.`,
          "Cabin pressure is stable and crew breathing indicators are normal.",
          "This points more toward a sensor mismatch than a full oxygen loss, but we should still verify power logs before relaxing the alert.",
        ].join("\n");
      }

      if (normalized.includes("crew") || normalized.includes("health") || normalized.includes("team") || normalized.includes("ekip")) {
        return [
          `${character.name}: Crew health is stable. Heart rates are elevated, mostly from stress.`,
          "No one is showing low-oxygen symptoms right now.",
          "A calm instruction from command would help the crew stay focused while we finish the system checks.",
        ].join("\n");
      }

      if (normalized.includes("power") || normalized.includes("log") || normalized.includes("fluctuation") || normalized.includes("energy")) {
        return [
          `${character.name}: Power logs show a short fluctuation 42 seconds before the oxygen warning.`,
          "That timing could explain why the main sensor dropped while backup readings stayed closer to normal.",
          "The safest next step is to compare backup sensor data with cabin pressure before deciding whether to continue the mission.",
        ].join("\n");
      }

      return `${character.name}: I can give you oxygen sensor data, crew health status or power system logs. Ask for the one you need before your next command.${branchContext}`;
    }

    if (character.role === "Patient") {
      if (normalized.includes("symptom") || normalized.includes("feel") || normalized.includes("feeling")) {
        return [
          `${character.name}: I feel dizzy and weak, and there is pressure in my chest.`,
          "It started about ten minutes ago while I was standing.",
          "I am scared, but I can answer one question at a time.",
        ].join("\n");
      }

      if (normalized.includes("breath") || normalized.includes("breathing") || normalized.includes("nefes")) {
        return [
          `${character.name}: My breathing feels a little fast, but I can still speak in full sentences.`,
          "I do not feel like I am choking.",
          "The dizziness is what worries me most right now.",
        ].join("\n");
      }

      if (normalized.includes("pain") || normalized.includes("level") || normalized.includes("ağrı")) {
        return [
          `${character.name}: The pressure is around 5 out of 10.`,
          "It is uncomfortable, not sharp.",
          "It has not spread to my arm, but I still feel nervous.",
        ].join("\n");
      }

      return `${character.name}: You can ask me about symptoms, breathing or pain level first. Please ask one clear question at a time.${branchContext}`;
    }

    if (character.role === "Air Traffic Control") {
      if (normalized.includes("weather") || normalized.includes("storm") || normalized.includes("wind")) {
        return [
          `${character.name}: Storm cells are moving east across your approach path.`,
          "Wind is unstable, but the strongest cell may pass in eight to ten minutes.",
          "Holding could improve your landing window if fuel allows it.",
        ].join("\n");
      }

      if (normalized.includes("runway") || normalized.includes("visibility")) {
        return [
          `${character.name}: Current runway visibility is below ideal level but not closed.`,
          "The runway lights are active, and ground crew reports wet surface conditions.",
          "A safer landing window may open if the storm shifts as predicted.",
        ].join("\n");
      }

      if (normalized.includes("fuel") || normalized.includes("holding") || normalized.includes("time")) {
        return [
          `${character.name}: You have enough fuel for a short hold and one alternate route decision.`,
          "A long delay would reduce safety margin.",
          "You should compare holding time with alternate airport distance before committing.",
        ].join("\n");
      }

      return `${character.name}: We can provide weather movement, runway visibility or fuel timing. Choose the data you need first.${branchContext}`;
    }

    if (character.role === "AI Safety Reviewer") {
      if (normalized.includes("training") || normalized.includes("data") || normalized.includes("bias")) {
        return [
          `${character.name}: The training data is strong for common examples but thin for edge cases.`,
          "Some user groups are underrepresented.",
          "That means the model may look confident even when it is wrong for less common situations.",
        ].join("\n");
      }

      if (normalized.includes("model") || normalized.includes("behavior") || normalized.includes("unexpected")) {
        return [
          `${character.name}: The model is giving confident answers even when the input is unclear.`,
          "That is a safety concern because users may trust it too quickly.",
          "We should add uncertainty checks before launch.",
        ].join("\n");
      }

      if (normalized.includes("user") || normalized.includes("safety") || normalized.includes("harm")) {
        return [
          `${character.name}: The highest risk is for users who rely on the answer without expert review.`,
          "A wrong answer could lead to unfair or unsafe decisions.",
          "Human review should be required for high-impact outputs.",
        ].join("\n");
      }

      return `${character.name}: We should inspect training data, model behavior or user safety impact before deciding whether the AI is ready.${branchContext}`;
    }

    if (character.role === "Security Analyst") {
      if (normalized.includes("login") || normalized.includes("source") || normalized.includes("location")) {
        return [
          `${character.name}: The suspicious login came from a new location that this user has never used before.`,
          "It happened three minutes after a suspicious message was opened.",
          "This makes account protection the first safe move.",
        ].join("\n");
      }

      if (normalized.includes("device") || normalized.includes("new device")) {
        return [
          `${character.name}: The device is unknown and not on the approved device list.`,
          "It used a browser version we have not seen for this user before.",
          "We should isolate the session before investigating deeper.",
        ].join("\n");
      }

      if (normalized.includes("account") || normalized.includes("activity") || normalized.includes("file")) {
        return [
          `${character.name}: The account attempted to access two private folders after the login.`,
          "No confirmed data export yet, but the behavior is risky.",
          "Password reset and session revocation should happen before opening links or files.",
        ].join("\n");
      }

      return `${character.name}: I can check login source, suspicious device or affected account activity. Choose what you want verified first.${branchContext}`;
    }

    return `${character.name}: I can provide field information. Ask what you need to verify before making the next decision.`;
  }

  function stopMentorVoice() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsMentorSpeaking(false);
  }

  function getMissionPath(professionKey: string, isTurkish: boolean): MissionPath {
    const normalizedKeyForLanguage = professionKey
      .replace(/[-_\s]/g, "")
      .toLowerCase();

    if (isTurkish) {
      const turkishPaths: Record<string, MissionPath> = {
        astronaut: {
          role: "Astronot",
          stages: [
            {
              title: "Acil durumu anla",
              context:
                "Oksijen uyarısı her zaman istasyonun oksijen kaybettiği anlamına gelmez. Sensör hatası, güç dalgalanması ya da iletişim gecikmesi de olabilir.",
              mentorHint:
                "İyi bir komutan teknik sorunu çözmeden önce insanları korur ve paniği yavaşlatır.",
              thinkingQuestion:
                "Ekibin sakin düşünebilmesi için önce neyi güvenli hale getirmelisin?",
              thinkingStarters: [
                "Önce ekibin sakin ve güvende olduğundan emin olurdum...",
                "Bir kişiden oksijen okumasını kontrol etmesini isterdim...",
                "Daha fazlasını öğrenene kadar riskli hareketleri durdururdum...",
              ],
            },
            {
              title: "Kanıt topla",
              context:
                "Görev ekipleri tehlikeli bir hamle yapmadan önce oksijen okumalarını, yedek sensörleri ve iletişim kayıtlarını karşılaştırır.",
              mentorHint:
                "Cevabı tahmin etmek zorunda değilsin. Uyarıyı doğrulayan ya da reddeden bilgiye bak.",
              thinkingQuestion:
                "Problemi güvenli şekilde doğrulamak için hangi sistemi ya da sinyali kontrol edersin?",
              thinkingStarters: [
                "Ana oksijen okumasını yedek sensörle karşılaştırırdım...",
                "Alarmın bir güç değişiminden sonra başlayıp başlamadığına bakardım...",
                "Komut Merkezi'nin aynı uyarıyı görüp görmediğini sorardım...",
              ],
            },
            {
              title: "Ekibi koru",
              context:
                "Küçük bir acil durum bile ekip koordinasyonu ya da güven kaybolursa tehlikeli hale gelebilir.",
              mentorHint:
                "Güçlü liderler sakin iletişim kurar ve net talimat verir.",
              thinkingQuestion:
                "Kontroller sürerken ekibi odakta tutmak için ne yaparsın?",
              thinkingStarters: [
                "Her ekip üyesine tek ve net bir görev verirdim...",
                "Alarmı adım adım kontrol ettiğimizi açıklardım...",
                "İletişimi kısa, sakin ve net tutardım...",
              ],
            },
            {
              title: "Görev kararını ver",
              context:
                "Durum incelendikten sonra komutan görevin devam mı edeceğine, duraklayacağına mı yoksa güvenli dönüş mü yapılacağına karar verir.",
              mentorHint:
                "En güvenli karar her zaman en hızlı karar değildir.",
              thinkingQuestion:
                "Devam etmekle geri dönmek arasında karar vermek için hangi bilgiye ihtiyacın var?",
              thinkingStarters: [
                "Oksijen stabilitesi, ekip sağlığı ve yedek sistemleri kontrol ettikten sonra karar verirdim...",
                "Uyarı güvenli şekilde açıklanırsa devam ederdim...",
                "Ekip güvenliği garanti edilemiyorsa geri dönerdim...",
              ],
            },
          ],
        },
        doctor: {
          role: "Doktor",
          stages: [
            { title: "Belirtileri anla", context: "Doktorlar sonuca atlamadan önce belirtileri ve hasta güvenliğini gözlemler.", mentorHint: "Her hastalığı bilmek zorunda değilsin. Hastanın ne hissettiğiyle başla.", thinkingQuestion: "Durumu daha iyi anlamak için önce ne sorarsın?" },
            { title: "Güvenliği önceliklendir", context: "Doktorlar daha derin analize geçmeden önce nefes, ağrı seviyesi ve acil riskleri kontrol eder.", mentorHint: "Bazı sorunlar hemen ele alınmalıdır, bazıları bekleyebilir.", thinkingQuestion: "Hastayı güvende tutmak için önce neyi stabilize edersin?" },
            { title: "Tıbbi ipuçları topla", context: "Doktorlar tanı koymadan önce belirtileri, testleri ve gözlemleri karşılaştırır.", mentorHint: "Kanıt, tahminden daha değerlidir.", thinkingQuestion: "Problemi daha iyi anlamak için hangi test ya da gözlem yardımcı olur?" },
            { title: "Bakım planını seç", context: "Tedavi kararı güvenlik, hız ve hasta iletişimi arasında denge kurar.", mentorHint: "Hastalar teknik karar kadar sakin açıklamaya da ihtiyaç duyar.", thinkingQuestion: "Sonraki adımı hastaya ya da ailesine nasıl açıklarsın?" },
          ],
        },
        pilot: {
          role: "Pilot",
          stages: [
            { title: "Durumu oku", context: "Pilotlar rota değiştirmeden önce hava durumu, yakıt ve gösterge verilerini karşılaştırır.", mentorHint: "Bilgi sakin organize edildiğinde kokpit daha güvenli olur.", thinkingQuestion: "Uçuş kararı vermeden önce hangi bilgiyi incelersin?" },
            { title: "Yolcuları koru", context: "Pilot hem uçak güvenliğini hem de yolcu güvenini düşünür.", mentorHint: "İletişim de güvenliğin parçasıdır.", thinkingQuestion: "Türbülans ya da gecikme sırasında yolcuları nasıl sakin tutarsın?" },
            { title: "Rotayı doğrula", context: "Pilotlar kule talimatlarını, fırtına hareketini ve yedek iniş yollarını kontrol eder.", mentorHint: "Yedek plan baskıyı azaltır.", thinkingQuestion: "Koşullar kötüleşirse hangi alternatifi hazırlarsın?" },
            { title: "İniş kararını ver", context: "Son karar hava, yakıt, zamanlama ve ekip hazırlığı arasında denge kurar.", mentorHint: "En iyi pilotlar gereksiz riskten kaçınır.", thinkingQuestion: "İniş, bekleme ya da rota değiştirme kararını neye göre verirsin?" },
          ],
        },
        aiengineer: {
          role: "AI Engineer",
          stages: [
            { title: "AI problemini anla", context: "Bir AI sistemi zayıf veri, belirsiz talimat ya da güvenli olmayan varsayım nedeniyle yanlış öneri verebilir.", mentorHint: "Dikkatli bir AI mühendisi modele hemen güvenmez; önce modelin ne gördüğünü ve neyi kaçırmış olabileceğini sorar.", thinkingQuestion: "AI'ın bu sonucu neden verdiğini anlamak için önce neyi kontrol edersin?" },
            { title: "Veriyi kontrol et", context: "AI sistemleri örneklerden öğrenir. Örnekler eksik ya da adil değilse çıktı riskli hale gelebilir.", mentorHint: "Kodu bilmek zorunda değilsin. Verinin yeterince iyi ve güvenli olup olmadığını sorarak başla.", thinkingQuestion: "Hangi veri problemi AI'ın yanlış ya da adil olmayan davranmasına yol açabilir?" },
            { title: "Kullanıcıyı koru", context: "AI mühendisleri yalnızca teknolojinin çalışıp çalışmadığını değil, sistemden etkilenen insanları da düşünür.", mentorHint: "Güvenli AI kararı, performansı optimize etmeden önce kullanıcıyı korur.", thinkingQuestion: "AI yanlışsa kim zarar görebilir ve bu riski nasıl azaltırsın?" },
            { title: "İyileştir ya da durdur", context: "Bazen en güvenli karar, ekip riski anlayana kadar sistemi duraklatmaktır.", mentorHint: "Sorumlu mühendisler ne zaman durup test etmeleri ve açıklamaları gerektiğini bilir.", thinkingQuestion: "AI'ı yayına almak yerine testte tutmaya seni ne ikna eder?" },
          ],
        },
        cyberdetective: {
          role: "Cyber Detective",
          stages: [
            { title: "İpucunu anla", context: "Şüpheli dijital ipucu gerçek, sahte, tesadüfi ya da daha büyük bir saldırının parçası olabilir.", mentorHint: "Bir cyber detective çok hızlı suçlama yapmaz. Önce insanları korur ve ipucunu doğrular.", thinkingQuestion: "İpucunun güvenilir olup olmadığını anlamak için önce neyi kontrol edersin?" },
            { title: "Erişimi koru", context: "Siber olaylar hesaplar, parolalar ya da özel veriler açığa çıktığında tehlikeli hale gelir.", mentorHint: "Güvenlik meraktan önce gelir. Derine inmeden önce erişimi koru.", thinkingQuestion: "Önce hangi hesabı, cihazı ya da dosyayı korursun?" },
            { title: "Kaynağı doğrula", context: "Saldırganlar çoğu zaman sahte mesajlar, kopyalanmış linkler ya da kafa karıştırıcı sinyallerin arkasına saklanır.", mentorHint: "İyi araştırmacılar karar vermeden önce kaynakları karşılaştırır.", thinkingQuestion: "Şüpheli hareketin nereden geldiğini nasıl kanıtlarsın?" },
            { title: "Sınırla ve bildir", context: "Amaç panik yaratmak değil; riski durdurmak ve doğru kişilere net şekilde anlatmaktır.", mentorHint: "Güçlü bir cyber detective riski basit sözlerle açıklar ve güvenli bir sonraki adım önerir.", thinkingQuestion: "Ekibin panik yapmadan güvenli hareket etmesi için ne söylersin?" },
          ],
        },
      };

      const aliases: Record<string, MissionPath> = {
        astronaut: turkishPaths.astronaut,
        doctor: turkishPaths.doctor,
        pilot: turkishPaths.pilot,
        aiengineer: turkishPaths.aiengineer,
        engineer: turkishPaths.aiengineer,
        cyberdetective: turkishPaths.cyberdetective,
        cyber: turkishPaths.cyberdetective,
        detective: turkishPaths.cyberdetective,
      };

      return aliases[normalizedKeyForLanguage] ?? {
        role: "Gelecek Rolü",
        stages: [
          {
            title: "Görevi anla",
            context: "Her görev durumu net anlamakla başlar.",
            mentorHint: "İyi kararlar sakin gözlemle başlar.",
            thinkingQuestion: "Önce neyi anlamaya çalışırdın?",
          },
        ],
      };
    }

    const paths: Record<string, MissionPath> = {
      astronaut: {
        role: "Astronaut",
        stages: [
          {
            title: "Understand the emergency",
            context:
              "An oxygen warning does not always mean the station is losing oxygen. It could also be a sensor issue, power fluctuation or communication delay.",
            mentorHint:
              "A good commander first protects people and slows panic before solving the technical issue.",
            thinkingQuestion:
              "What should be stabilized first so the team can think clearly?",
            thinkingStarters: [
              "I would first make sure the crew is calm and safe...",
              "I would ask one person to check the oxygen reading...",
              "I would tell the team to pause risky actions until we know more...",
            ],
          },
          {
            title: "Collect evidence",
            context:
              "Mission teams compare oxygen readings, backup sensors and communication logs before making a dangerous move.",
            mentorHint:
              "You do not need to guess the answer. Look for information that confirms or rejects the warning.",
            thinkingQuestion:
              "Which system or signal would help you verify the problem safely?",
            thinkingStarters: [
              "I would compare the main oxygen reading with a backup sensor...",
              "I would check whether the alarm started after a power change...",
              "I would ask Mission Control if they see the same warning...",
            ],
          },
          {
            title: "Protect the crew",
            context:
              "Even a small emergency can become dangerous if the crew loses coordination or trust.",
            mentorHint:
              "Strong leaders communicate calmly and give clear instructions.",
            thinkingQuestion:
              "How would you keep the crew focused while checks continue?",
            thinkingStarters: [
              "I would give the crew one clear job each...",
              "I would explain that we are checking the alarm step by step...",
              "I would keep communication short, calm and specific...",
            ],
          },
          {
            title: "Make the mission decision",
            context:
              "After reviewing the situation, the commander decides whether the mission should continue, pause or return safely.",
            mentorHint:
              "The safest decision is not always the fastest one.",
            thinkingQuestion:
              "What information would help you decide between continuing or returning?",
            thinkingStarters: [
              "I would decide after checking oxygen stability, crew health and backup systems...",
              "I would continue only if the warning is confirmed safe...",
              "I would return if crew safety cannot be guaranteed...",
            ],
          },
        ],
      },

      doctor: {
        role: "Doctor",
        stages: [
          {
            title: "Understand the symptoms",
            context:
              "Doctors first observe symptoms and patient safety before jumping to conclusions.",
            mentorHint:
              "You do not need to know every disease. Start with what the patient is feeling.",
            thinkingQuestion:
              "What would you ask first to better understand the situation?",
            thinkingStarters: [
              "I would first ask what the patient is feeling right now...",
              "I would check if the patient is breathing normally and in pain...",
              "I would ask when the symptoms started and what changed...",
            ],
          },
          {
            title: "Prioritize safety",
            context:
              "Doctors check breathing, pain level and urgent risks before deeper analysis.",
            mentorHint:
              "Some problems must be treated immediately while others can wait.",
            thinkingQuestion:
              "What would you stabilize first to keep the patient safe?",
            thinkingStarters: [
              "I would first make sure the patient is safe and comfortable...",
              "I would check the most urgent risk before anything else...",
              "I would ask the care team to watch breathing and pain level...",
            ],
          },
          {
            title: "Collect medical clues",
            context:
              "Doctors compare symptoms, tests and observations before making a diagnosis.",
            mentorHint:
              "Evidence is more important than guessing.",
            thinkingQuestion:
              "What test or observation would help you understand the problem better?",
            thinkingStarters: [
              "I would compare the symptoms with a simple first test...",
              "I would observe if the problem is getting better or worse...",
              "I would ask for one clear clue before deciding treatment...",
            ],
          },
          {
            title: "Choose the care plan",
            context:
              "A treatment decision balances safety, speed and patient communication.",
            mentorHint:
              "Patients also need calm explanations, not only technical decisions.",
            thinkingQuestion:
              "How would you explain the next step to the patient or family?",
            thinkingStarters: [
              "I would explain the next step calmly and simply...",
              "I would tell the family what we know and what we are checking...",
              "I would make sure the patient understands why we are doing this...",
            ],
          },
        ],
      },

      pilot: {
        role: "Pilot",
        stages: [
          {
            title: "Read the situation",
            context:
              "Pilots compare weather, fuel and instrument data before changing course.",
            mentorHint:
              "The cockpit becomes safer when information is organized calmly.",
            thinkingQuestion:
              "What information would you review first before making a flight decision?",
            thinkingStarters: [
              "I would first check the weather, fuel and runway information...",
              "I would ask the tower for the latest storm update...",
              "I would compare the route with a safer backup option...",
            ],
          },
          {
            title: "Protect passengers",
            context:
              "A pilot must think about both aircraft safety and passenger confidence.",
            mentorHint:
              "Communication is part of safety.",
            thinkingQuestion:
              "How would you keep passengers calm during turbulence or delay?",
            thinkingStarters: [
              "I would make a calm announcement so passengers understand the situation...",
              "I would tell the cabin crew what to prepare first...",
              "I would explain that safety comes before speed...",
            ],
          },
          {
            title: "Verify the route",
            context:
              "Pilots check tower instructions, storm movement and backup landing paths.",
            mentorHint:
              "A backup plan reduces pressure.",
            thinkingQuestion:
              "What alternative would you prepare if conditions become worse?",
            thinkingStarters: [
              "I would prepare a backup airport before entering the storm area...",
              "I would check fuel and holding time before deciding...",
              "I would ask the tower and crew to compare safe options...",
            ],
          },
          {
            title: "Make the landing decision",
            context:
              "The final decision balances weather, fuel, timing and crew readiness.",
            mentorHint:
              "The best pilots avoid unnecessary risk.",
            thinkingQuestion:
              "What would convince you to land, hold or reroute?",
            thinkingStarters: [
              "I would land only if the weather and runway are safe enough...",
              "I would hold if we still have time and conditions may improve...",
              "I would reroute if passenger safety is no longer clear...",
            ],
          },
        ],
      },

      aiEngineer: {
        role: "AI Engineer",
        stages: [
          {
            title: "Understand the AI problem",
            context:
              "An AI system can make a wrong suggestion because of weak data, unclear instructions or unsafe assumptions.",
            mentorHint:
              "A careful AI engineer does not trust the model immediately. They first ask what the model saw and what it might have missed.",
            thinkingQuestion:
              "What would you check first to understand why the AI gave this result?",
            thinkingStarters: [
              "I would first check what data the AI used...",
              "I would ask if the instruction given to the AI was clear...",
              "I would look for what the AI might have missed...",
            ],
          },
          {
            title: "Check the data",
            context:
              "AI systems learn from examples. If the examples are incomplete or unfair, the output can become risky.",
            mentorHint:
              "You do not need to know the code. Start by asking whether the data is good enough and safe enough.",
            thinkingQuestion:
              "What kind of data problem could make the AI act in a wrong or unfair way?",
            thinkingStarters: [
              "I would check if the data is missing important examples...",
              "I would look for unfair patterns in the training data...",
              "I would ask whether the data represents all users safely...",
            ],
          },
          {
            title: "Protect the user",
            context:
              "AI engineers must think about the people affected by the system, not only whether the technology works.",
            mentorHint:
              "A safe AI decision protects users before optimizing performance.",
            thinkingQuestion:
              "Who could be harmed if the AI is wrong, and how would you reduce that risk?",
            thinkingStarters: [
              "I would first think about the user who depends on this answer...",
              "I would add a safety check before trusting the AI result...",
              "I would make sure a human can review risky outputs...",
            ],
          },
          {
            title: "Decide to improve or stop",
            context:
              "Sometimes the safest decision is to pause the system until the team understands the risk.",
            mentorHint:
              "Responsible engineers know when to stop, test and explain.",
            thinkingQuestion:
              "What would convince you to keep testing instead of launching the AI?",
            thinkingStarters: [
              "I would keep testing if the AI gives unsafe or unfair answers...",
              "I would pause launch until the team understands the risk...",
              "I would explain why safety is more important than speed...",
            ],
          },
        ],
      },

      cyberDetective: {
        role: "Cyber Detective",
        stages: [
          {
            title: "Understand the clue",
            context:
              "A suspicious digital clue could be real, fake, accidental or part of a larger attack.",
            mentorHint:
              "A cyber detective does not accuse too fast. They first protect people and verify the clue.",
            thinkingQuestion:
              "What would you check first to understand whether the clue is trustworthy?",
            thinkingStarters: [
              "I would first check where the suspicious message came from...",
              "I would compare the clue with another trusted source...",
              "I would avoid clicking anything until I know it is safe...",
            ],
          },
          {
            title: "Protect access",
            context:
              "Cyber incidents become dangerous when accounts, passwords or private data are exposed.",
            mentorHint:
              "Safety comes before curiosity. Protect access before exploring deeper.",
            thinkingQuestion:
              "Which account, device or file would you protect first?",
            thinkingStarters: [
              "I would first protect the account with the most sensitive information...",
              "I would ask the team to change risky passwords safely...",
              "I would isolate the suspicious device before investigating deeper...",
            ],
          },
          {
            title: "Verify the source",
            context:
              "Attackers often hide behind fake messages, copied links or confusing signals.",
            mentorHint:
              "Good investigators compare sources before deciding what happened.",
            thinkingQuestion:
              "How would you prove where the suspicious activity came from?",
            thinkingStarters: [
              "I would compare the login time, device and location...",
              "I would check whether the link or sender is fake...",
              "I would collect evidence before blaming anyone...",
            ],
          },
          {
            title: "Contain and report",
            context:
              "The goal is not to panic. The goal is to stop the risk and tell the right people clearly.",
            mentorHint:
              "A strong cyber detective explains the risk in simple words and recommends a safe next step.",
            thinkingQuestion:
              "What would you tell the team so they can act safely without panic?",
            thinkingStarters: [
              "I would tell the team what happened in simple words...",
              "I would explain what not to click or open right now...",
              "I would give one safe next step instead of causing panic...",
            ],
          },
        ],
      },
    };

    const normalizedProfessionKey = professionKey
      .replace(/[-_\s]/g, "")
      .toLowerCase();

    const pathAliases: Record<string, MissionPath> = {
      astronaut: paths.astronaut,
      doctor: paths.doctor,
      pilot: paths.pilot,
      aiengineer: paths.aiEngineer,
      engineer: paths.aiEngineer,
      cyberdetective: paths.cyberDetective,
      cyber: paths.cyberDetective,
      detective: paths.cyberDetective,
    };

    return (
      paths[professionKey] ?? pathAliases[normalizedProfessionKey] ?? {
        role: "Future Professional",
        stages: [
          {
            title: "Understand the mission",
            context:
              "Every mission starts by understanding the situation clearly.",
            mentorHint:
              "Good decisions begin with calm observation.",
            thinkingQuestion:
              "What would you try to understand first?",
          },
        ],
      }
    );
  }

  function getActiveThinkingStarters(stage: MissionStage) {
    return (
      stage.thinkingStarters ?? [
        "I would first protect...",
        "I would check...",
        "I would ask the team to...",
      ]
    );
  }

  function speakMentorText(textToSpeak: string) {
    if (!autoVoice || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    stopMentorVoice();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = language === "tr" ? "tr-TR" : "en-US";
    utterance.rate = 0.88;
    utterance.pitch = 0.82;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((voice) => voice.lang === "en-US" && /male|daniel|alex|fred|google us english/i.test(voice.name)) ??
      voices.find((voice) => voice.lang.startsWith("en")) ??
      voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsMentorSpeaking(true);
    utterance.onend = () => setIsMentorSpeaking(false);
    utterance.onerror = () => setIsMentorSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function buildMissionOutcome(branchState: MissionBranchState) {
    const riskIsLow = missionMetrics.riskLevel < 35;
    const trustIsHigh = missionMetrics.crewTrust >= 65;
    const clarityIsHigh = missionMetrics.systemClarity >= 65;
    const pressureIsHigh = missionMetrics.missionPressure >= 55;


    if (branchState === "RISKY") {
      return {
        title: "Mission under pressure",
        result:
          "The mission path is still carrying risk. The child needs one more safety signal before a confident final decision.",
        mentorReflection:
          "You moved the mission forward, but the safest professionals slow down when pressure rises. Ask for evidence before taking a bold action.",
        nextStep:
          "This recap should show a tense turning point where the child learns to reduce risk before deciding.",
      };
    }

    if (branchState === "UNCERTAIN" && !clarityIsHigh) {
      return {
        title: "Mission still uncertain",
        result:
          "The mission has useful information, but the strongest signal is not clear enough yet.",
        mentorReflection:
          "You are asking questions, which is good. The next growth step is choosing the one piece of information that matters most.",
        nextStep:
          "This recap should show a learning arc: uncertainty, information gathering and a clearer next command.",
      };
    }

    if (trustIsHigh && clarityIsHigh && riskIsLow) {
      return {
        title: "Mission stabilized",
        result:
          "Your decisions protected people, improved clarity and reduced unnecessary risk.",
        mentorReflection:
          "You showed calm leadership: you did not rush, and you used evidence before the final decision.",
        nextStep:
          "This mission path is ready to become a cinematic recap with a strong leadership ending.",
      };
    }

    if (trustIsHigh && pressureIsHigh) {
      return {
        title: "Crew protected under pressure",
        result:
          "The mission stayed tense, but your commands helped the team stay focused and safer.",
        mentorReflection:
          "You showed care for people first. The next growth area is slowing the situation enough to verify the facts.",
        nextStep:
          "This mission path can become a cinematic recap about leadership during pressure.",
      };
    }

    if (clarityIsHigh) {
      return {
        title: "Evidence path completed",
        result:
          "Your strongest pattern was checking information before making a risky move.",
        mentorReflection:
          "You acted like a careful professional: you looked for signals, evidence and safer next steps.",
        nextStep:
          "This mission path can become a cinematic recap about smart investigation and careful judgment.",
      };
    }

    return {
      title: "Advanced mission path completed",
      result:
        "You completed the mission path and created enough decisions for a mentor reflection.",
      mentorReflection:
        "You started thinking like the role. The next step is making your reasoning clearer before each major decision.",
      nextStep:
        "This mission path can still become a short recap showing how your decision style developed.",
    };
  }

  function buildMissionRecapSummary() {
    const latestCards = consequenceCards.slice(-4);

    if (latestCards.length === 0) {
      return "No mission memory frames have been collected yet.";
    }

    return latestCards
      .map((card, index) => `${index + 1}. ${card.title}: ${card.caption}`)
      .join("\n");
  }

  function getMissionMemoryStatus(turnCount: number) {
    if (turnCount >= 4) {
      return {
        label: "Mission memory ready",
        description:
          "Enough decisions have been collected to prepare a short cinematic recap from the child’s mission path.",
        readiness: 100,
      };
    }

    if (turnCount >= 3) {
      return {
        label: "Final memory forming",
        description:
          "The mission now has a leadership moment, a world reaction and a developing outcome.",
        readiness: 76,
      };
    }

    if (turnCount >= 2) {
      return {
        label: "Mission memory forming",
        description:
          "VELTO has started collecting the strongest moments for a future cinematic mission recap.",
        readiness: 48,
      };
    }

    return {
      label: "Memory locked",
      description:
        "Answer at least two mission prompts to unlock cinematic memory preparation.",
      readiness: 16,
    };
  }

  function getMissionPhase(turnCount: number) {
    if (turnCount >= 4) {
      return {
        label: "Mission memory ready",
        description:
          "The experience has enough decisions to prepare a cinematic mission memory.",
        activeStep: 4,
      };
    }

    if (turnCount >= 3) {
      return {
        label: "Final decision window",
        description:
          "The next command should show what kind of future professional the child wants to become.",
        activeStep: 3,
      };
    }

    if (turnCount >= 2) {
      return {
        label: "Mission pressure rising",
        description:
          "The world is reacting. The child now needs to connect safety, evidence and communication.",
        activeStep: 2,
      };
    }

    if (turnCount >= 1) {
      return {
        label: "First command received",
        description:
          "The mentor and mission world are responding to the first decision.",
        activeStep: 1,
      };
    }

    return {
      label: "Awaiting first command",
      description:
        "The mission is open. The first command will start the live decision path.",
      activeStep: 0,
    };
  }

  function applyBranchStateMetrics(branchState: MissionBranchState) {
    setMissionMetrics((current) => {
      if (branchState === "SAFE") {
        return {
          crewTrust: Math.min(100, current.crewTrust + 5),
          systemClarity: Math.min(100, current.systemClarity + 7),
          missionPressure: Math.max(0, current.missionPressure - 4),
          riskLevel: Math.max(0, current.riskLevel - 6),
        };
      }

      if (branchState === "RISKY") {
        return {
          crewTrust: Math.max(0, current.crewTrust - 3),
          systemClarity: Math.max(0, current.systemClarity - 2),
          missionPressure: Math.min(100, current.missionPressure + 8),
          riskLevel: Math.min(100, current.riskLevel + 9),
        };
      }

      return {
        crewTrust: current.crewTrust,
        systemClarity: Math.min(100, current.systemClarity + 2),
        missionPressure: Math.min(100, current.missionPressure + 2),
        riskLevel: Math.min(100, current.riskLevel + 1),
      };
    });
  }

  function updateMissionMetrics(userInput: string) {
    const normalized = userInput.toLowerCase();

    const protectsCrew =
      normalized.includes("crew") ||
      normalized.includes("team") ||
      normalized.includes("ekip") ||
      normalized.includes("mürettebat");

    const checksSystem =
      normalized.includes("oxygen") ||
      normalized.includes("sensor") ||
      normalized.includes("check") ||
      normalized.includes("confirm") ||
      normalized.includes("oksijen") ||
      normalized.includes("sensör") ||
      normalized.includes("kontrol") ||
      normalized.includes("doğrula");

    const rushes =
      normalized.includes("immediately") ||
      normalized.includes("quick") ||
      normalized.includes("hemen") ||
      normalized.includes("hızlı");

    setMissionMetrics((current) => ({
      crewTrust: Math.min(100, current.crewTrust + (protectsCrew ? 14 : 4)),
      systemClarity: Math.min(100, current.systemClarity + (checksSystem ? 16 : 5)),
      missionPressure: Math.max(0, Math.min(100, current.missionPressure + (rushes ? 10 : -3))),
      riskLevel: Math.max(0, Math.min(100, current.riskLevel + (rushes ? 9 : checksSystem ? -5 : 2))),
    }));
  }

  function determineMissionBranchState(
    signal: BranchSignal,
  ): MissionBranchState {
    if (signal.tone === "safe") {
      return "SAFE";
    }

    if (signal.tone === "risky") {
      return "RISKY";
    }

    return "UNCERTAIN";
  }

  function getBranchCommandStarter(branchState: MissionBranchState) {
    if (branchState === "SAFE") {
      return "I will use the verified information to make a calm next command and keep the team safe.";
    }


    if (branchState === "RISKY") {
      return "I will slow down and ask for one missing safety signal before making a risky decision.";
    }

    return "I will ask one precise question to reduce uncertainty before choosing the next action.";
  }

  function buildVisualBeatForEvent(event: MissionStreamEvent) {
    if (event.visualBeat) {
      return event.visualBeat;
    }

    if (event.tone === "alert") {
      return {
        title: "Warning Frame",
        mood: "high tension",
        prompt:
          "Cinematic child-safe mission control scene, warning signal glow, tense but not scary, no text overlay.",
      };
    }

    if (event.tone === "character") {
      return {
        title: "Field Data Frame",
        mood: "focused support",
        prompt:
          "Cinematic child-safe field specialist communication scene, mission data arriving, calm professional support, no text overlay.",
      };
    }

    if (event.tone === "mentor") {
      return {
        title: "Mentor Guidance Frame",
        mood: "calm reflection",
        prompt:
          "Cinematic child-safe AI mentor communication scene, soft holographic guidance, thoughtful decision moment, no text overlay.",
      };
    }

    if (event.tone === "decision") {
      return {
        title: "Command Moment Frame",
        mood: "child leadership",
        prompt:
          "Cinematic child-safe young mission leader sending a thoughtful command, glowing control interface, confident but calm, no text overlay.",
      };
    }

    return {
      title: "Mission Establishing Frame",
      mood: "live simulation",
      prompt:
        "Cinematic child-safe mission environment establishing shot, futuristic command center, soft blue lighting, no text overlay.",
    };
  }

  function buildStoryverseScenePackages(): StoryverseScenePackage[] {
    const sourceEvents = missionStreamEvents
      .filter((event) => event.tone !== "system")
      .slice(-5);

    if (sourceEvents.length === 0) {
      return [
        {
          title: `${missionTitle} Opening`,
          narration: missionBriefing,
          visualPrompt: buildVisualBeatForEvent(activeStreamEvent).prompt,
          emotionalBeat: "Mission opening",
          pacing: "calm",
        },
      ];
    }

    return sourceEvents.map((event) => {
      const visualBeat = buildVisualBeatForEvent(event);

      return {
        title: event.title,
        narration: event.body,
        visualPrompt: visualBeat.prompt,
        emotionalBeat: visualBeat.mood,
        pacing: getEventPacing(event),
      };
    });
  }


  function buildMissionKnowledgeCards(): MissionKnowledgeCard[] {
    if (professionKey === "doctor") {
      return [
        {
          title: language === "tr" ? "Belirti Önceliği" : "Symptom Priority",
          explanation:
            language === "tr"
              ? "Doktorlar önce hangi belirtinin acil risk taşıdığını anlamaya çalışır."
              : "Doctors first try to understand which symptom may carry urgent risk.",
          whyItMatters:
            language === "tr"
              ? "Aynı anda birden fazla hasta geldiğinde en riskli durumu erken fark etmek hayat kurtarabilir."
              : "When several patients arrive at the same time, spotting the highest-risk condition early can save lives.",
          affectedSystems:
            language === "tr"
              ? ["Nefes alma", "Bilinç durumu", "Ağrı seviyesi"]
              : ["Breathing", "Consciousness", "Pain level"],
          suggestedQuestion:
            language === "tr"
              ? "Hastanın nefes alması, bilinci veya ağrısı hakkında ne biliyoruz?"
              : "What do we know about the patient's breathing, consciousness or pain?",
        },
        {
          title: language === "tr" ? "Hasta Hikayesi" : "Patient Story",
          explanation:
            language === "tr"
              ? "Hasta hikayesi, sorunun ne zaman başladığını ve nasıl değiştiğini anlamaya yardım eder."
              : "The patient story helps explain when the problem started and how it changed.",
          whyItMatters:
            language === "tr"
              ? "Doğru soru, doktorun acele etmeden daha güvenli bir ilk karar vermesini sağlar."
              : "A good question helps the doctor make a safer first decision without rushing.",
          affectedSystems:
            language === "tr"
              ? ["Başlangıç zamanı", "Değişen belirtiler", "Hasta güvenliği"]
              : ["Start time", "Changing symptoms", "Patient safety"],
          suggestedQuestion:
            language === "tr"
              ? "Belirtiler ne zaman başladı ve o zamandan beri ne değişti?"
              : "When did the symptoms start and what has changed since then?",
        },
        {
          title: language === "tr" ? "Güvenli Önceliklendirme" : "Safe Prioritization",
          explanation:
            language === "tr"
              ? "Önceliklendirme, kimin önce yardıma ihtiyaç duyduğunu sakin şekilde belirlemektir."
              : "Prioritization means calmly deciding who needs help first.",
          whyItMatters:
            language === "tr"
              ? "Bu, ekibin panikle değil güvenli bir sırayla hareket etmesine yardımcı olur."
              : "It helps the team act in a safe order instead of reacting with panic.",
          affectedSystems:
            language === "tr"
              ? ["Ekip koordinasyonu", "Hasta güvenliği", "İlk müdahale"]
              : ["Team coordination", "Patient safety", "First response"],
          suggestedQuestion:
            language === "tr"
              ? "Hangi hasta önce kontrol edilmeli ve bunun en güvenli nedeni nedir?"
              : "Which patient should be checked first, and what is the safest reason?",
        },
      ];
    }

    if (professionKey === "pilot") {
      return [
        {
          title: language === "tr" ? "Hava Durumu Bilgisi" : "Weather Information",
          explanation:
            language === "tr"
              ? "Pilotlar rota kararından önce rüzgar, görüş ve fırtına hareketini anlamaya çalışır."
              : "Pilots check wind, visibility and storm movement before route decisions.",
          whyItMatters:
            language === "tr"
              ? "Hava durumu yanlış okunursa güvenli iniş veya rota kararı zorlaşır."
              : "If weather is misunderstood, safe landing or route decisions become harder.",
          affectedSystems:
            language === "tr"
              ? ["Görüş", "Rüzgar", "Rota güvenliği"]
              : ["Visibility", "Wind", "Route safety"],
          suggestedQuestion:
            language === "tr"
              ? "Fırtına hareketi, görüş ve rüzgar hakkında güncel bilgi alabilir miyiz?"
              : "Can we get updated information about storm movement, visibility and wind?",
        },
        {
          title: language === "tr" ? "Kule Bilgisi" : "Tower Information",
          explanation:
            language === "tr"
              ? "Kule bilgisi, pilotun iniş ve rota kararını daha güvenli vermesine yardımcı olur."
              : "Tower information helps the pilot make safer landing and route decisions.",
          whyItMatters:
            language === "tr"
              ? "Pilot tek başına tahmin yürütmez; güvenilir kaynaklardan veri doğrular."
              : "A pilot does not guess alone; they verify data from trusted sources.",
          affectedSystems:
            language === "tr"
              ? ["İniş güvenliği", "Rota planı", "Ekip koordinasyonu"]
              : ["Landing safety", "Route plan", "Crew coordination"],
          suggestedQuestion:
            language === "tr"
              ? "Kule şu anda iniş ve görüş için hangi bilgiyi veriyor?"
              : "What information is the tower giving about landing and visibility right now?",
        },
      ];
    }

    if (professionKey === "ai-engineer") {
      return [
        {
          title: language === "tr" ? "Veri Kalitesi" : "Data Quality",
          explanation:
            language === "tr"
              ? "AI sistemleri, öğrendikleri verinin kalitesinden etkilenir."
              : "AI systems are affected by the quality of the data they learn from.",
          whyItMatters:
            language === "tr"
              ? "Eksik veya taraflı veri, modelin yanlış kararlar üretmesine neden olabilir."
              : "Incomplete or biased data can cause the model to produce poor decisions.",
          affectedSystems:
            language === "tr"
              ? ["Eğitim verisi", "Model davranışı", "Kullanıcı güvenliği"]
              : ["Training data", "Model behavior", "User safety"],
          suggestedQuestion:
            language === "tr"
              ? "Modelin öğrendiği veride eksik veya taraflı örnekler var mı?"
              : "Are there missing or biased examples in the model's training data?",
        },
        {
          title: language === "tr" ? "Güvenli Yanıt" : "Safe Response",
          explanation:
            language === "tr"
              ? "AI mühendisi, modelin çocuklar için güvenli ve anlaşılır yanıt verip vermediğini kontrol eder."
              : "An AI engineer checks whether the model gives safe and understandable answers for children.",
          whyItMatters:
            language === "tr"
              ? "İyi bir AI sistemi sadece doğru değil, aynı zamanda güvenli olmalıdır."
              : "A good AI system must be safe, not only correct.",
          affectedSystems:
            language === "tr"
              ? ["Güvenlik filtresi", "Yanıt kalitesi", "Etik kontrol"]
              : ["Safety filter", "Response quality", "Ethics check"],
          suggestedQuestion:
            language === "tr"
              ? "Modelin verdiği yanıt çocuklar için güvenli ve anlaşılır mı?"
              : "Is the model's answer safe and understandable for children?",
        },
      ];
    }

    if (professionKey === "cyber-detective") {
      return [
        {
          title: language === "tr" ? "Dijital İz" : "Digital Clue",
          explanation:
            language === "tr"
              ? "Siber dedektifler, şüpheli giriş, cihaz veya hesap hareketlerini izler."
              : "Cyber detectives inspect suspicious logins, devices or account activity.",
          whyItMatters:
            language === "tr"
              ? "Doğru ipucu, gerçek riski tahminden ayırmaya yardım eder."
              : "The right clue helps separate real risk from guessing.",
          affectedSystems:
            language === "tr"
              ? ["Giriş kaydı", "Cihaz bilgisi", "Hesap güvenliği"]
              : ["Login record", "Device info", "Account security"],
          suggestedQuestion:
            language === "tr"
              ? "Şüpheli giriş hangi cihazdan ve nereden yapılmış görünüyor?"
              : "Which device and location does the suspicious login seem to come from?",
        },
        {
          title: language === "tr" ? "Güvenli Müdahale" : "Safe Response",
          explanation:
            language === "tr"
              ? "Siber olaylarda amaç panik yapmak değil, doğru kanıtla güvenli aksiyon almaktır."
              : "In cyber incidents, the goal is not panic but safe action based on evidence.",
          whyItMatters:
            language === "tr"
              ? "Yanlış müdahale kanıtları yok edebilir veya riski artırabilir."
              : "A wrong response can erase evidence or increase risk.",
          affectedSystems:
            language === "tr"
              ? ["Kanıt güvenliği", "Hesap koruması", "Erişim kontrolü"]
              : ["Evidence safety", "Account protection", "Access control"],
          suggestedQuestion:
            language === "tr"
              ? "Kanıtları bozmadan hesabı güvenli hale getirmek için ilk adım ne olmalı?"
              : "What should be the first step to secure the account without damaging evidence?",
        },
      ];
    }

    return [
      {
        title: language === "tr" ? "Oksijen Sensörü" : "Oxygen Sensor",
        explanation:
          language === "tr"
            ? "Oksijen sensörleri, istasyonda mürettebatın güvenle nefes alabileceği hava olup olmadığını kontrol eder."
            : "Oxygen sensors check whether the station still has safe breathing air.",
        whyItMatters:
          language === "tr"
            ? "Yanlış bir sensör okuması, oksijen seviyesi güvenliyken bile paniğe yol açabilir."
            : "A wrong sensor reading may trigger panic even when oxygen is still safe.",
        affectedSystems:
          language === "tr"
            ? ["Mürettebat güvenliği", "Kabin basıncı", "Acil durum sistemleri"]
            : ["Crew safety", "Cabin pressure", "Emergency systems"],
        suggestedQuestion:
          language === "tr"
            ? "Yedek oksijen sensörünü ana sensörle karşılaştırabilir miyiz?"
            : "Can we compare the backup oxygen sensor with the main sensor?",
      },
      {
        title: language === "tr" ? "Kabin Basıncı" : "Cabin Pressure",
        explanation:
          language === "tr"
            ? "Kabin basıncı, istasyonun içindeki havanın insanlar için güvenli kalmasına yardımcı olur."
            : "Cabin pressure keeps the station safe for people to breathe normally.",
        whyItMatters:
          language === "tr"
            ? "Basınç değişimleri hem oksijen sistemlerini hem de mürettebat sağlığını etkileyebilir."
            : "Pressure changes may affect both oxygen systems and crew health.",
        affectedSystems:
          language === "tr"
            ? ["Hava dolaşımı", "Mürettebat sağlığı", "Nefes güvenliği"]
            : ["Air circulation", "Crew health", "Breathing safety"],
        suggestedQuestion:
          language === "tr"
            ? "Şu anda kabin basıncında bir değişiklik var mı?"
            : "Are there any cabin pressure changes right now?",
      },
    ];
  }


  function buildCreatorLabRecapPackage(): CreatorLabRecapPackage {
    const scenes = storyverseScenePackages.slice(0, 5);
    const identityLabel = decisionIdentityProfile.label;
    const branchLabel = branchPatternLabel;

    return {
      title: `${professionTitle} Mission Recap: ${missionTitle}`,
      hook: `A young ${professionTitle.toLowerCase()} faces a high-pressure mission and discovers their ${identityLabel} decision style.`,
      caption: `${missionTitle} · ${branchLabel} · ${identityLabel}`,
      format: "Short cinematic recap · vertical-ready · 30-60 sec",
      scenes,
    };
  }

  function buildNpcInterruptionEvent(): MissionStreamEvent | null {
    if (childTurnCount === 0) {
      return null;
    }

    if (missionBranchState === "RISKY") {
      return {
        time: `T+${String(42 + childTurnCount * 7).padStart(2, "0")}`,
        label: "INTERRUPTION",
        title: `${missionCharacter.name} interrupts with a safety warning`,
        body:
          `${missionCharacter.name}: Commander, before the next move, I need one more safety check. The mission still has pressure and we should not rush the final decision.`,
        tone: "alert",
      };
    }

    if (missionBranchState === "UNCERTAIN" && childTurnCount >= 2) {
      return {
        time: `T+${String(42 + childTurnCount * 7).padStart(2, "0")}`,
        label: "FIELD UPDATE",
        title: `${missionCharacter.name} requests one clearer signal`,
        body:
          `${missionCharacter.name}: We have useful information, but one signal is still missing. Ask me for the specific data you need before your next command.`,
        tone: "character",
      };
    }

    if (missionBranchState === "SAFE" && childTurnCount >= 2) {
      return {
        time: `T+${String(42 + childTurnCount * 7).padStart(2, "0")}`,
        label: "FIELD CONFIRMATION",
        title: `${missionCharacter.name} confirms the mission is stabilizing`,
        body:
          `${missionCharacter.name}: The situation is becoming clearer. If your next command stays calm and evidence-based, the mission can move toward a safer outcome.`,
        tone: "character",
      };
    }

    return null;
  }

  function buildMissionStreamEvents(): MissionStreamEvent[] {
    const baseEvents: MissionStreamEvent[] = [
      {
        time: "T+00:03",
        label: "SYSTEM",
        title: "Mission Control Connected",
        body: `${mentorName} and ${missionCharacter.name} are online. The mission is waiting for the first decision.`,
        tone: "system",
        pacing: "pause",
      },
      {
        time: "T+00:08",
        label: "MISSION",
        title: missionTitle,
        body: missionBriefing,
        tone: "alert",
        pacing: "urgent",
      },
      {
        time: "T+00:14",
        label: missionCharacter.role,
        title: `${missionCharacter.name} joined ${missionCharacter.channel}`,
        body: missionCharacter.openingLine,
        tone: "character",
        pacing: "tense",
      },
      {
        time: "T+00:20",
        label: "MENTOR",
        title: activeMissionStage.title,
        body: activeMissionStage.thinkingQuestion,
        tone: "mentor",
        pacing: "calm",
      },
    ];

    const interactionEvents = messages.slice(-6).map((message, index): MissionStreamEvent => {
      if (message.role === "child") {
        return {
          time: `T+${String(28 + index * 6).padStart(2, "0")}`,
          label: "COMMAND",
          title: "Child Command",
          body: message.text,
          tone: "decision",
          pacing: "pause",
        };
      }

      if (message.role === "character") {
        return {
          time: `T+${String(28 + index * 6).padStart(2, "0")}`,
          label: message.speaker ?? missionCharacter.role,
          title: "Field Response",
          body: message.text,
          tone: "character",
          pacing: "tense",
        };
      }

      return {
        time: `T+${String(28 + index * 6).padStart(2, "0")}`,
        label: "MENTOR",
        title: "Mentor Guidance",
        body: message.text,
        tone: "mentor",
        pacing: "calm",
      };
    });

    if (latestBranchSignal) {
      interactionEvents.push({
        time: `T+${String(34 + interactionEvents.length * 6).padStart(2, "0")}`,
        label: "BRANCH",
        title: latestBranchSignal.label,
        body: latestBranchSignal.nextStep,
        tone: latestBranchSignal.tone === "risky" ? "alert" : "system",
        pacing: latestBranchSignal.tone === "risky" ? "urgent" : "pause",
      });
    }

    const npcInterruptionEvent = buildNpcInterruptionEvent();

    if (npcInterruptionEvent) {
      interactionEvents.push(npcInterruptionEvent);
    }

    return [...baseEvents, ...interactionEvents];
  }

  function getEventPacing(event: MissionStreamEvent) {
    if (event.pacing) {
      return event.pacing;
    }

    if (event.label === "INTERRUPTION" || event.tone === "alert") {
      return "urgent";
    }

    if (event.tone === "mentor") {
      return "calm";
    }

    if (event.tone === "character") {
      return "tense";
    }

    return "pause";
  }

  function getPacingLabel(event: MissionStreamEvent) {
    const pacing = getEventPacing(event);

    if (pacing === "urgent") {
      return "Urgent beat";
    }

    if (pacing === "tense") {
      return "Tension beat";
    }

    if (pacing === "calm") {
      return "Calm beat";
    }

    return "Pause beat";
  }

  function getEventPriority(event: MissionStreamEvent) {
    if (event.label === "INTERRUPTION") {
      return "Live interruption";
    }

    if (event.tone === "alert") {
      return "High attention";
    }

    if (event.tone === "decision") {
      return "Child action";
    }

    if (event.tone === "mentor") {
      return "Guidance";
    }

    if (event.tone === "character") {
      return "Field data";
    }

    return "System";
  }

  function getEventPulseLabel(event: MissionStreamEvent) {
    if (event.label === "INTERRUPTION") {
      return "Incoming field alert";
    }

    if (event.tone === "alert") {
      return "Signal pulse";
    }

    if (event.tone === "decision") {
      return "Command sent";
    }

    if (event.tone === "mentor") {
      return "Mentor channel";
    }

    if (event.tone === "character") {
      return "Field channel";
    }

    return "Live feed";
  }

  function getDecisionIdentityProfile(): DecisionIdentityProfile {
    const childMessages = messages.filter((message) => message.role === "child");
    const joinedChildText = childMessages.map((message) => message.text.toLowerCase()).join(" ");

    const peopleSignals =
      joinedChildText.includes("crew") ||
      joinedChildText.includes("team") ||
      joinedChildText.includes("patient") ||
      joinedChildText.includes("passenger") ||
      joinedChildText.includes("user") ||
      joinedChildText.includes("ekip") ||
      joinedChildText.includes("hasta") ||
      joinedChildText.includes("yolcu");

    const evidenceSignals =
      joinedChildText.includes("check") ||
      joinedChildText.includes("verify") ||
      joinedChildText.includes("data") ||
      joinedChildText.includes("sensor") ||
      joinedChildText.includes("test") ||
      joinedChildText.includes("kontrol") ||
      joinedChildText.includes("doğrula") ||
      joinedChildText.includes("veri");

    const riskReducerSignals =
      branchSignals.some((signal) => signal.tone === "safe") &&
      missionMetrics.riskLevel < 35;

    const pressureSignals =
      branchSignals.some((signal) => signal.tone === "risky") ||
      missionMetrics.missionPressure >= 55;

    if (peopleSignals && evidenceSignals && riskReducerSignals) {
      return {
        label: "Calm Evidence Leader",
        description:
          "You protect people first, but you also look for proof before making big decisions.",
        mentorNote:
          "This is a strong future-professional pattern: care, evidence and calm action.",
        traits: ["People-first", "Evidence-aware", "Risk reducer"],
      };
    }

    if (peopleSignals) {
      return {
        label: "People-First Leader",
        description:
          "You naturally notice the people affected by the mission and try to keep them safe.",
        mentorNote:
          "Your next growth step is to connect that care with one clear piece of evidence.",
        traits: ["Empathy", "Communication", "Team safety"],
      };
    }

    if (evidenceSignals) {
      return {
        label: "Evidence Seeker",
        description:
          "You prefer to check signals, data or observations before deciding.",
        mentorNote:
          "This helps you avoid guessing. Your next growth step is to explain your decision calmly to people.",
        traits: ["Verification", "Data thinking", "Careful judgment"],
      };
    }

    if (pressureSignals) {
      return {
        label: "Fast Responder",
        description:
          "You move quickly when the mission feels tense.",
        mentorNote:
          "Speed can help, but your next growth step is to pause briefly and reduce uncertainty first.",
        traits: ["Action-oriented", "Pressure response", "Needs verification"],
      };
    }

    return {
      label: "Mission Explorer",
      description:
        "You are beginning to explore how this role thinks under pressure.",
      mentorNote:
        "Try asking one clear question, then turn the answer into your next command.",
      traits: ["Curious", "Developing reasoning", "Learning through action"],
    };
  }

  function getBranchConfidence() {
    if (branchSignals.length === 0) {
      return 0;
    }

    const latestSignals = branchSignals.slice(-4);
    const safeCount = latestSignals.filter((signal) => signal.tone === "safe").length;
    const riskyCount = latestSignals.filter((signal) => signal.tone === "risky").length;
    const uncertainCount = latestSignals.filter((signal) => signal.tone === "uncertain").length;

    const confidence = 45 + safeCount * 14 - riskyCount * 12 - uncertainCount * 4;

    return Math.max(12, Math.min(96, confidence));
  }

  function getBranchPatternLabel() {
    if (branchSignals.length === 0) {
      return "No branch pattern yet";
    }

    const latestSignals = branchSignals.slice(-4);
    const safeCount = latestSignals.filter((signal) => signal.tone === "safe").length;
    const riskyCount = latestSignals.filter((signal) => signal.tone === "risky").length;
    const uncertainCount = latestSignals.filter((signal) => signal.tone === "uncertain").length;

    if (safeCount >= 2 && riskyCount === 0) {
      return "Calm evidence path";
    }

    if (riskyCount >= 2) {
      return "Pressure path";
    }

    if (uncertainCount >= 2) {
      return "Information-seeking path";
    }

    return "Mixed decision path";
  }

  function buildBranchSignal(userInput: string, characterReply: string): BranchSignal {
    const normalizedInput = userInput.toLowerCase();
    const normalizedReply = characterReply.toLowerCase();

    const evidenceSignals =
      normalizedInput.includes("check") ||
      normalizedInput.includes("verify") ||
      normalizedInput.includes("data") ||
      normalizedInput.includes("sensor") ||
      normalizedInput.includes("test") ||
      normalizedInput.includes("kontrol") ||
      normalizedInput.includes("doğrula") ||
      normalizedInput.includes("veri");

    const peopleSignals =
      normalizedInput.includes("crew") ||
      normalizedInput.includes("team") ||
      normalizedInput.includes("patient") ||
      normalizedInput.includes("passenger") ||
      normalizedInput.includes("user") ||
      normalizedInput.includes("ekip") ||
      normalizedInput.includes("hasta") ||
      normalizedInput.includes("yolcu");

    const riskSignals =
      normalizedInput.includes("immediately") ||
      normalizedInput.includes("quick") ||
      normalizedInput.includes("launch") ||
      normalizedInput.includes("open") ||
      normalizedInput.includes("hemen") ||
      normalizedInput.includes("hızlı");

    if (
      normalizedReply.includes("stable") ||
      normalizedReply.includes("backup") ||
      normalizedReply.includes("verify") ||
      normalizedReply.includes("human review") ||
      evidenceSignals
    ) {
      return {
        label: "Safer path emerging",
        description:
          "The child is collecting information before acting. This supports a calmer and more evidence-based mission branch.",
        nextStep:
          "Use the verified information to make one calm command: protect people, confirm the key signal, then choose the next action.",
        tone: "safe",
      };
    }

    if (
      normalizedReply.includes("risky") ||
      normalizedReply.includes("unknown") ||
      normalizedReply.includes("suspicious") ||
      riskSignals
    ) {
      return {
        label: "Risk branch forming",
        description:
          "The mission still contains uncertainty or access risk. The next command should reduce danger before moving forward.",
        nextStep:
          "Do not rush forward. Ask the mission character for one missing safety signal before making a final decision.",
        tone: "risky",
      };
    }

    if (peopleSignals) {
      return {
        label: "Human-safety branch",
        description:
          "The child is prioritizing people. The mission should now connect care with the next verification step.",
        nextStep:
          "Keep people calm, then request one piece of evidence that proves the situation is safe enough to continue.",
        tone: "safe",
      };
    }

    return {
      label: "Uncertain branch",
      description:
        "The mission has not collected enough clear evidence yet. The next step should ask for one specific piece of information.",
      nextStep:
        "Choose one data channel and ask a precise question. Good mission leaders reduce uncertainty one signal at a time.",
      tone: "uncertain",
    };
  }

  function buildWorldReaction(userInput: string) {
    const normalized = userInput.toLowerCase();

    if (
      normalized.includes("crew") ||
      normalized.includes("team") ||
      normalized.includes("ekip") ||
      normalized.includes("mürettebat")
    ) {
      return "CREW STATUS: Team stress reduced. The crew is listening to your command.";
    }

    if (
      normalized.includes("oxygen") ||
      normalized.includes("sensor") ||
      normalized.includes("oksijen") ||
      normalized.includes("sensör")
    ) {
      return "LIFE SUPPORT: Oxygen signal checked. System stability is improving.";
    }

    if (
      normalized.includes("wait") ||
      normalized.includes("confirm") ||
      normalized.includes("check") ||
      normalized.includes("bekle") ||
      normalized.includes("doğrula") ||
      normalized.includes("kontrol")
    ) {
      return "MISSION CONTROL: Careful verification detected. Risk is being contained.";
    }

    return "MISSION WORLD: Your command changed the mission state. A new decision window is opening.";
  }

  function buildConsequenceCard(userInput: string, branchState: MissionBranchState): ConsequenceCard {
    const normalized = userInput.toLowerCase();

    const branchCaptionSuffix =
      branchState === "SAFE"
        ? " The moment feels controlled because the child is reducing uncertainty."
        : branchState === "RISKY"
          ? " The moment carries pressure because the next decision still needs a safety check."
          : " The moment remains open because the child still needs one clearer signal.";

    if (
      normalized.includes("crew") ||
      normalized.includes("team") ||
      normalized.includes("ekip") ||
      normalized.includes("mürettebat")
    ) {
      return {
        title: "Crew Confidence Increased",
        caption:
          `Inside the mission room, the crew becomes calmer as your first command protects people before the objective.${branchCaptionSuffix}`,
        tone: "warm leadership under pressure",
        promptSlot:
          "Cinematic child-safe mission scene, lunar station control room, crew calming down, young commander making a thoughtful decision, warm leadership under pressure, no text overlay.",
      };
    }

    if (
      normalized.includes("oxygen") ||
      normalized.includes("sensor") ||
      normalized.includes("oksijen") ||
      normalized.includes("sensör")
    ) {
      return {
        title: "Life Support Signal Stabilized",
        caption:
          `A glowing oxygen panel becomes clearer as your careful check prevents the mission from rushing into danger.${branchCaptionSuffix}`,
        tone: "precise analytical focus",
        promptSlot:
          "Cinematic child-safe sci-fi control panel, oxygen system stabilizing, blue interface glow, careful analysis, no text overlay.",
      };
    }

    if (
      normalized.includes("wait") ||
      normalized.includes("confirm") ||
      normalized.includes("check") ||
      normalized.includes("bekle") ||
      normalized.includes("doğrula") ||
      normalized.includes("kontrol")
    ) {
      return {
        title: "Risk Contained",
        caption:
          `Mission Control slows the tempo as your command asks for verification before a risky next move.${branchCaptionSuffix}`,
        tone: "calm strategic control",
        promptSlot:
          "Cinematic mission control scene, calm verification moment, soft blue lighting, strategic decision under pressure, no text overlay.",
      };
    }

    return {
      title: "New Decision Window Opened",
      caption:
        `The mission world shifts around your command, opening a new path for the next choice.${branchCaptionSuffix}`,
      tone: "mysterious mission transition",
      promptSlot:
        "Cinematic child-safe future mission scene, command channel glowing, new mission path opening, mysterious transition, no text overlay.",
    };
  }


  function buildCrewPresenceRelay(
    reply: string,
    branchState: MissionBranchState,
    isTurkish: boolean,
    runtime: MissionRuntimeState,
  ) {
    const runtimePrefix = getCrewRuntimePrefix(runtime, isTurkish);
    const branchPulse =
      branchState === "RISKY"
        ? isTurkish
          ? "Hızlı geçiyorum."
          : "Fast relay."
        : branchState === "SAFE"
          ? isTurkish
            ? "Oda biraz daha sakin."
            : "The room is steadier."
          : isTurkish
            ? "Bir sinyal eksik."
            : "One signal missing.";

    return `${runtimePrefix} ${branchPulse}

${reply}`;
  }

  function getCrewRelayDelay(branchState: MissionBranchState) {
    if (branchState === "RISKY") return 360;
    if (branchState === "SAFE") return 720;
    return 560;
  }

  function getMentorPresenceDelay(branchState: MissionBranchState, userInput: string) {
    const normalized = userInput.toLowerCase();
    const asksForHelp =
      normalized.includes("help") ||
      normalized.includes("not sure") ||
      normalized.includes("yardım") ||
      normalized.includes("emin değilim");

    if (branchState === "RISKY") return asksForHelp ? 980 : 760;
    if (branchState === "SAFE") return 1280;
    return asksForHelp ? 840 : 1080;
  }

  function buildMentorPresencePrelude(
    branchState: MissionBranchState,
    isTurkish: boolean,
    userInput: string,
    runtime: MissionRuntimeState,
  ) {
    const normalized = userInput.toLowerCase();
    const asksForHelp =
      normalized.includes("help") ||
      normalized.includes("not sure") ||
      normalized.includes("yardım") ||
      normalized.includes("emin değilim") ||
      normalized.includes("ne yap");

    const runtimeLabel = getMissionRuntimeLabel(runtime, isTurkish);
    const signalPrelude = getRuntimeSignalPrelude(runtime, isTurkish);
    const mentorDirective = getMentorRuntimeDirective(runtime, isTurkish);

    if (branchState === "RISKY") {
      return isTurkish
        ? `${runtimeLabel} ${signalPrelude} ${mentorDirective}`
        : `${runtimeLabel} ${signalPrelude} ${mentorDirective}`;
    }

    if (branchState === "SAFE") {
      return isTurkish
        ? `${runtimeLabel} ${signalPrelude} Ekip duydu. ${mentorDirective}`
        : `${runtimeLabel} ${signalPrelude} Crew heard it. ${mentorDirective}`;
    }

    if (asksForHelp) {
      return isTurkish
        ? `${runtimeLabel} Emin olmaman sorun değil. Tek sinyal iste.`
        : `${runtimeLabel} Uncertainty is fine. Ask for one signal.`;
    }

    return isTurkish
      ? `${runtimeLabel} ${signalPrelude} Bir sonraki komut ritmi belirleyecek.`
      : `${runtimeLabel} ${signalPrelude} The next command sets the rhythm.`;
  }

  function buildMentorResponse(
    userInput: string,
    stage: MissionStage,
    characterReply: string,
    branchState: MissionBranchState,
    nextStage: MissionStage | undefined,
    isTurkish: boolean,
    runtime: MissionRuntimeState,
  ) {
    const normalized = userInput.toLowerCase();
    const normalizedCharacterReply = characterReply.toLowerCase();

    const noticedCare =
      normalized.includes("crew") ||
      normalized.includes("team") ||
      normalized.includes("patient") ||
      normalized.includes("passenger") ||
      normalized.includes("user") ||
      normalized.includes("ekip") ||
      normalized.includes("hasta") ||
      normalized.includes("yolcu") ||
      normalized.includes("kullanıcı");

    const noticedEvidence =
      normalized.includes("check") ||
      normalized.includes("verify") ||
      normalized.includes("confirm") ||
      normalized.includes("data") ||
      normalized.includes("sensor") ||
      normalized.includes("test") ||
      normalized.includes("kontrol") ||
      normalized.includes("doğrula") ||
      normalized.includes("veri") ||
      normalized.includes("sensör") ||
      normalized.includes("test");

    let dataInterpretation = isTurkish
      ? "Yeni sinyal geldi. Bunu tek net komuta çevir."
      : "New signal in. Turn it into one clear command.";

    if (
      normalizedCharacterReply.includes("backup sensor") ||
      normalizedCharacterReply.includes("cabin pressure") ||
      normalizedCharacterReply.includes("sensor mismatch")
    ) {
      dataInterpretation =
        "Oxygen readings do not match. Backup readings look cleaner. Verify before any dramatic move.";
    } else if (
      normalizedCharacterReply.includes("crew health") ||
      normalizedCharacterReply.includes("heart rates") ||
      normalizedCharacterReply.includes("stress")
    ) {
      dataInterpretation =
        "People are stable. Stress is rising. Calm the room, then check one system.";
    } else if (
      normalizedCharacterReply.includes("power logs") ||
      normalizedCharacterReply.includes("fluctuation")
    ) {
      dataInterpretation =
        "Power logs show a possible cause. Test it. Do not guess.";
    } else if (
      normalizedCharacterReply.includes("dizzy") ||
      normalizedCharacterReply.includes("chest") ||
      normalizedCharacterReply.includes("pain")
    ) {
      dataInterpretation =
        "The symptoms need triage. Protect safety, then get one clear clue.";
    } else if (
      normalizedCharacterReply.includes("storm") ||
      normalizedCharacterReply.includes("runway") ||
      normalizedCharacterReply.includes("fuel")
    ) {
      dataInterpretation =
        "This is about timing and margin. Compare wait, land, or reroute.";
    } else if (
      normalizedCharacterReply.includes("training data") ||
      normalizedCharacterReply.includes("model") ||
      normalizedCharacterReply.includes("human review")
    ) {
      dataInterpretation =
        "The model may be confident, not safe. Protect users first.";
    } else if (
      normalizedCharacterReply.includes("suspicious login") ||
      normalizedCharacterReply.includes("unknown device") ||
      normalizedCharacterReply.includes("account")
    ) {
      dataInterpretation =
        "Access risk is real. Protect accounts and preserve evidence.";
    }

    if (isTurkish) {
      if (normalizedCharacterReply.includes("yedek sensör") || normalizedCharacterReply.includes("kabin basıncı") || normalizedCharacterReply.includes("sensör uyuşmazlığı")) {
        dataInterpretation =
          "Oksijen okumaları uyuşmuyor. Yedek sensör daha temiz. Büyük hamleden önce doğrula.";
      } else if (normalizedCharacterReply.includes("ekip sağlığı") || normalizedCharacterReply.includes("nabız") || normalizedCharacterReply.includes("stres")) {
        dataInterpretation =
          "İnsanlar stabil. Stres yükseliyor. Odayı sakinleştir, sonra tek sistemi kontrol et.";
      } else if (normalizedCharacterReply.includes("güç kayıt") || normalizedCharacterReply.includes("dalgalanma")) {
        dataInterpretation =
          "Güç kaydı olası neden verdi. Tahmin etme; test et.";
      }
    }

    const stageBridge = nextStage
      ? isTurkish
        ? `Sıradaki röle: ${nextStage.title}.`
        : `Next relay: ${nextStage.title}.`
      : isTurkish
        ? "Son karar penceresi açılıyor."
        : "Final decision window opening.";

    const mentorObservation = noticedCare
      ? isTurkish
        ? "Önce insanları tuttun. İyi sinyal."
        : "People first. Good signal."
      : noticedEvidence
        ? isTurkish
          ? "Kanıt istedin. Karar daha güvenli."
          : "You asked for evidence. Safer decision."
        : isTurkish
          ? "İlk hamle geldi. Şimdi netleştir."
          : "First move received. Now tighten it.";

    const branchTone =
      branchState === "SAFE"
        ? isTurkish
          ? "Hat dengeleniyor. Doğrulamaya devam."
          : "Line stabilizing. Keep verifying."
        : branchState === "RISKY"
          ? isTurkish
            ? "Baskı artıyor. Önce belirsizliği azalt."
            : "Pressure rising. Reduce uncertainty first."
          : isTurkish
            ? "Belirsizlik sürüyor. Bir sinyal daha al."
            : "Still uncertain. Get one more signal.";

    const branchStateLabel =
      branchState === "SAFE"
        ? isTurkish ? "dengeye yaklaşıyor" : "stabilizing"
        : branchState === "RISKY"
          ? isTurkish ? "baskı altında" : "under pressure"
          : isTurkish ? "belirsiz" : "uncertain";

    const mentorPresencePrelude = buildMentorPresencePrelude(
      branchState,
      isTurkish,
      userInput,
      runtime,
    );

    const stageGuidance = isTurkish
      ? [
          `${mentorName}: ${mentorPresencePrelude}`,
          mentorObservation,
          dataInterpretation,
          `Röle durumu: ${branchStateLabel}. ${branchTone}`,
          stage.mentorHint,
          stageBridge,
        ]
      : [
          `${mentorName}: ${mentorPresencePrelude}`,
          mentorObservation,
          dataInterpretation,
          `Relay state: ${branchStateLabel}. ${branchTone}`,
          stage.mentorHint,
          stageBridge,
        ];

    return stageGuidance.filter(Boolean).join("\n\n");
  }

  function handleSend() {
    if (!input.trim() || isMentorTyping) return;

    const userMessage = input.trim();

    updateMissionMetrics(userMessage);

    setMessages((current) => [
      ...current,
      {
        role: "child",
        text: userMessage,
      },
    ]);

    setInput("");
    setIsMentorTyping(true);

    const currentStageIndex = Math.min(childTurnCount, missionPath.stages.length - 1);
    const currentStage = missionPath.stages[currentStageIndex];
    const nextStage = missionPath.stages[Math.min(currentStageIndex + 1, missionPath.stages.length - 1)];
    const rawCharacterReply = buildCharacterReply(
      userMessage,
      missionCharacter,
      missionBranchState,
      isTurkish,
    );
    const worldReaction = buildWorldReaction(userMessage);
    const branchSignal = buildBranchSignal(userMessage, rawCharacterReply);
    const branchState = determineMissionBranchState(branchSignal);
    const missionRuntimeNext = evaluateMissionRuntime({
      userInput: userMessage,
      branchState,
      turnCount: childTurnCount + 1,
      currentRuntime: missionRuntime,
    });
    const characterReply = buildCrewPresenceRelay(
      rawCharacterReply,
      branchState,
      isTurkish,
      missionRuntimeNext,
    );
    const consequenceCard = buildConsequenceCard(userMessage, branchState);
    applyBranchStateMetrics(branchState);

    const mentorResponse = buildMentorResponse(
      userMessage,
      currentStage,
      characterReply,
      branchState,
      nextStage.title === currentStage.title ? undefined : nextStage,
      isTurkish,
      missionRuntimeNext,
    );

    const crewRelayDelay = getCrewRelayDelayFromRuntime(missionRuntimeNext);
    const mentorPresenceDelay = getMentorPresenceDelayFromRuntime(missionRuntimeNext);

    typingTimerRef.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          role: "character",
          speaker: `${missionCharacter.name} · ${missionCharacter.role}`,
          text: characterReply,
        },
      ]);

      setWorldReactions((current) => [...current, worldReaction]);
      setConsequenceCards((current) => [...current, consequenceCard]);
      setBranchSignals((current) => [...current, branchSignal]);
      setMissionBranchState(branchState);
      setMissionRuntime(missionRuntimeNext);

      typingTimerRef.current = window.setTimeout(() => {
        let index = 0;

        const interval = window.setInterval(() => {
          setStreamingMentorText(
            mentorResponse.slice(0, index)
          );

          index += 1;

          if (index > mentorResponse.length) {
            window.clearInterval(interval);

            setMessages((current) => [
              ...current,
              {
                role: "mentor",
                text: mentorResponse,
              },
            ]);

            setStreamingMentorText("");
            setIsMentorTyping(false);
          }
        }, 18);
      }, mentorPresenceDelay);
    }, crewRelayDelay);
  }

  return (
    <MissionExperienceScreen
      language={language}
      professionKey={professionKey}
      professionTitle={professionTitle}
      missionTitle={missionTitle}
      missionBriefing={missionBriefing}
      mentorName={mentorName}
      missionCharacter={missionCharacter}
      activeMissionStage={activeMissionStage}
      knowledgeCards={missionKnowledgeCards}
      messages={messages}
      input={input}
      setInput={setInput}
      onSend={handleSend}
      isSending={isMentorTyping}
      streamingMentorText={streamingMentorText}
    />
  );
}
