"use client";

import { useEffect, useRef, useState } from "react";

type CareerMissionChatRecoveryProps = {
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

export default function CareerMissionChatRecovery({
  language,
  professionKey,
  professionTitle,
  missionTitle,
  missionBriefing,
  mentorName,
}: CareerMissionChatRecoveryProps) {
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

  const [typedAssignment, setTypedAssignment] = useState("");

  const typingTimerRef = useRef<number | null>(null);

  const childTurnCount = messages.filter((message) => message.role === "child").length;
  const missionPhase = getMissionPhase(childTurnCount);
  const missionMemoryStatus = getMissionMemoryStatus(childTurnCount);
  const missionOutcome = buildMissionOutcome();
  const missionPath = getMissionPath(professionKey);
  const missionCharacter = getMissionCharacter(professionKey);
  const activeMissionStage =
    missionPath.stages[
      Math.min(childTurnCount, missionPath.stages.length - 1)
    ];
  const missionIdentityKey = `${language}:${professionKey}:${professionTitle}:${missionTitle}:${mentorName}`;



  const assignmentText = `
MISSION TRANSMISSION LIVE

${mentorName} connected to command channel.
${missionCharacter.name} connected to ${missionCharacter.channel}.

${missionTitle}

${missionBriefing}

Awaiting first field decision...
`;

  useEffect(() => {
    setTypedAssignment("");
    setMessages([]);
    setInput("");
    setIsMentorTyping(false);
    setStreamingMentorText("");
    setWorldReactions([]);
    setConsequenceCards([]);
    setMissionMetrics({
      crewTrust: 42,
      systemClarity: 36,
      missionPressure: 28,
      riskLevel: 22,
    });
    stopMentorVoice();

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
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
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }

      stopMentorVoice();
    };
  }, []);

  function getMissionCharacter(professionKey: string): MissionCharacter {
    const normalizedProfessionKey = professionKey
      .replace(/[-_\s]/g, "")
      .toLowerCase();

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

  function buildCharacterReply(userInput: string, character: MissionCharacter) {
    const normalized = userInput.toLowerCase();

    if (character.role === "Life Support Engineer") {
      if (normalized.includes("oxygen") || normalized.includes("oksijen") || normalized.includes("sensor")) {
        return `${character.name}: Main oxygen sensor shows a lower reading than expected, but backup sensor is closer to normal. This could be a sensor fault, not a full oxygen loss. Cabin pressure is stable for now.`;
      }

      if (normalized.includes("crew") || normalized.includes("team") || normalized.includes("ekip")) {
        return `${character.name}: Crew health signals are stable, but they are nervous. A calm instruction from command will help them stay focused while we verify the alarm.`;
      }

      return `${character.name}: I can confirm three useful checks: backup oxygen sensor, cabin pressure, and whether the alarm started after a power fluctuation.`;
    }

    if (character.role === "Patient") {
      if (normalized.includes("pain") || normalized.includes("ağrı") || normalized.includes("feel") || normalized.includes("symptom")) {
        return `${character.name}: I feel pressure and dizziness. It started suddenly a few minutes ago. I am scared, but I can answer simple questions.`;
      }

      return `${character.name}: I need you to ask one question at a time. I can tell you when it started, where it hurts, and whether it is getting worse.`;
    }

    if (character.role === "Air Traffic Control") {
      if (normalized.includes("weather") || normalized.includes("storm") || normalized.includes("runway")) {
        return `${character.name}: Storm cells are moving across the route. Runway visibility is changing, but holding for a short period may give us a safer window.`;
      }

      return `${character.name}: We can give you wind, visibility, runway status and alternate airport data. Ask for the one that matters most to your next decision.`;
    }

    if (character.role === "AI Safety Reviewer") {
      if (normalized.includes("data") || normalized.includes("bias") || normalized.includes("model")) {
        return `${character.name}: The model was trained on incomplete examples. It performs well on common cases but may fail for edge cases and underrepresented users.`;
      }

      return `${character.name}: We should check the data, the instruction, the risky users and whether a human review step is needed before launch.`;
    }

    if (character.role === "Security Analyst") {
      if (normalized.includes("login") || normalized.includes("device") || normalized.includes("account") || normalized.includes("link")) {
        return `${character.name}: The suspicious login came from a new device and an unusual location. We should protect the account before opening unknown links.`;
      }

      return `${character.name}: I can check source, device, login time, affected files and whether the message link is fake. Choose what you want verified first.`;
    }

    return `${character.name}: I can provide field information. Ask what you need to verify before making the next decision.`;
  }

  function stopMentorVoice() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsMentorSpeaking(false);
  }

  function getMissionPath(professionKey: string): MissionPath {
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
    utterance.lang = "en-US";
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

  function buildMissionOutcome() {
    const riskIsLow = missionMetrics.riskLevel < 35;
    const trustIsHigh = missionMetrics.crewTrust >= 65;
    const clarityIsHigh = missionMetrics.systemClarity >= 65;
    const pressureIsHigh = missionMetrics.missionPressure >= 55;

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
      title: "Mission path completed",
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

  function buildConsequenceCard(userInput: string): ConsequenceCard {
    const normalized = userInput.toLowerCase();

    if (
      normalized.includes("crew") ||
      normalized.includes("team") ||
      normalized.includes("ekip") ||
      normalized.includes("mürettebat")
    ) {
      return {
        title: "Crew Confidence Increased",
        caption:
          "Inside the mission room, the crew becomes calmer as your first command protects people before the objective.",
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
          "A glowing oxygen panel becomes clearer as your careful check prevents the mission from rushing into danger.",
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
          "Mission Control slows the tempo as your command asks for verification before a risky next move.",
        tone: "calm strategic control",
        promptSlot:
          "Cinematic mission control scene, calm verification moment, soft blue lighting, strategic decision under pressure, no text overlay.",
      };
    }

    return {
      title: "New Decision Window Opened",
      caption:
        "The mission world shifts around your command, opening a new path for the next choice.",
      tone: "mysterious mission transition",
      promptSlot:
        "Cinematic child-safe future mission scene, command channel glowing, new mission path opening, mysterious transition, no text overlay.",
    };
  }

  function buildMentorResponse(userInput: string, stage: MissionStage, nextStage?: MissionStage) {
    const normalized = userInput.toLowerCase();

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

    const stageBridge = nextStage
      ? `Next mission stage: ${nextStage.title}. ${nextStage.context}`
      : "You are close to completing the mission path. Now prepare your final judgment.";

    const mentorObservation = noticedCare
      ? "You are thinking about people first. That is a strong professional signal."
      : noticedEvidence
        ? "You are looking for evidence before acting. That makes your decision safer."
        : "You made a first move. Now we need to make your reasoning clearer.";

    const stageGuidance = [
      `${mentorName}: ${mentorObservation}`,
      `Current stage: ${stage.title}.`,
      stage.mentorHint,
      `Think about this before your next command: ${stage.thinkingQuestion}`,
      stageBridge,
    ];

    return stageGuidance.join("\n\n");
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
    const characterReply = buildCharacterReply(userMessage, missionCharacter);
    const mentorResponse = buildMentorResponse(
      userMessage,
      currentStage,
      nextStage.title === currentStage.title ? undefined : nextStage,
    );
    const worldReaction = buildWorldReaction(userMessage);
    const consequenceCard = buildConsequenceCard(userMessage);

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
          speakMentorText(mentorResponse);
        }
      }, 18);
    }, 900);
  }

  return (
    <div className="rounded-[32px] border border-cyan-300/20 bg-slate-950 p-6 text-white shadow-[0_20px_80px_rgba(34,211,238,0.12)]">
      <div className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-black/30">
        <div className="border-b border-cyan-300/10 bg-cyan-300/10 px-5 py-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">
              Live mission transmission
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">
              {professionTitle} · {mentorName}
            </p>
          </div>
        </div>

        <div className="min-h-[220px] p-5">
          <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-cyan-50">
            {typedAssignment}
          </pre>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200">
              Mission character channel
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">
              {missionCharacter.name} · {missionCharacter.role}
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/90">
              {missionCharacter.openingLine}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-100">
            {missionCharacter.channel}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200">
              Professional mentor voice
            </p>
            <h4 className="mt-2 text-lg font-semibold text-white">
              {isMentorSpeaking ? "Mentor speaking" : "Voice channel ready"}
            </h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50/85">
              Browser voice is tuned with slower pace and lower pitch for a calmer mission mentor feel. ElevenLabs can be connected in the next voice sprint.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAutoVoice((current) => !current)}
              className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                autoVoice
                  ? "border-amber-300/40 bg-amber-300 text-slate-950"
                  : "border-white/10 bg-black/20 text-amber-100 hover:bg-white/10"
              }`}
            >
              {autoVoice ? "Auto voice on" : "Auto voice off"}
            </button>

            {isMentorSpeaking && (
              <button
                type="button"
                onClick={stopMentorVoice}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Stop voice
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-indigo-300/20 bg-indigo-300/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200">
              Structured mission path
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">
              {activeMissionStage.title}
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-50/90">
              {activeMissionStage.context}
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-indigo-100">
            Stage {Math.min(childTurnCount + 1, missionPath.stages.length)}/{missionPath.stages.length}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-100/70">
              Mentor hint
            </p>
            <p className="mt-2 text-sm leading-6 text-white/90">
              {activeMissionStage.mentorHint}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-100/70">
              Thinking question
            </p>
            <p className="mt-2 text-sm leading-6 text-white/90">
              {activeMissionStage.thinkingQuestion}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-100/70">
            Thinking starters
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {getActiveThinkingStarters(activeMissionStage).map((starter, index) => (
              <button
                key={`${starter}-${index}`}
                type="button"
                onClick={() =>
                  setInput((current) =>
                    current.trim().length > 0 ? current : starter,
                  )
                }
                className="rounded-2xl border border-indigo-300/20 bg-indigo-300/10 px-3 py-3 text-left text-xs leading-5 text-indigo-50 transition hover:border-indigo-200/40 hover:bg-indigo-300/20"
              >
                {starter}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-indigo-100/70">
            These are not fixed answers. They only help you start your own command.
          </p>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {missionPath.stages.map((stage, index) => (
            <div
              key={`${stage.title}-${index}`}
              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                childTurnCount >= index
                  ? "border-indigo-300/30 bg-indigo-300/15 text-indigo-50"
                  : "border-white/10 bg-black/20 text-slate-500"
              }`}
            >
              {index + 1}. {stage.title}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/10 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-violet-200">
              Mission phase
            </p>
            <h4 className="mt-2 text-lg font-semibold text-white">
              {missionPhase.label}
            </h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-violet-50/85">
              {missionPhase.description}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-violet-100">
            Phase {missionPhase.activeStep}/4
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {["First command", "World reaction", "Final decision", "Mission memory"].map((step, index) => (
            <div
              key={step}
              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                missionPhase.activeStep >= index + 1
                  ? "border-violet-300/30 bg-violet-300/15 text-violet-50"
                  : "border-white/10 bg-black/20 text-slate-500"
              }`}
            >
              {index + 1}. {step}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">
              Live mission state
            </p>
            <h4 className="mt-2 text-lg font-semibold text-white">
              The mission reacts to every command
            </h4>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-cyan-100">
            {messages.filter((message) => message.role === "child").length}/4 mission turns
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { label: "Crew trust", value: missionMetrics.crewTrust },
            { label: "System clarity", value: missionMetrics.systemClarity },
            { label: "Mission pressure", value: missionMetrics.missionPressure },
            { label: "Risk level", value: missionMetrics.riskLevel },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-200">
                <span>{metric.label}</span>
                <span>{metric.value}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`rounded-3xl border p-4 text-sm leading-6 ${
              message.role === "child"
                ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-50"
                : message.role === "character"
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                  : "border-white/10 bg-white/[0.04] text-slate-100"
            }`}
          >
            {message.speaker && (
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/55">
                {message.speaker}
              </p>
            )}
            <p className="whitespace-pre-wrap">
              {message.text}
            </p>
          </div>
        ))}

        {isMentorTyping && (
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-amber-200">
              Live mentor guidance
            </p>

            <p className="whitespace-pre-wrap leading-7">
              {streamingMentorText}
            </p>
          </div>
        )}
      </div>

      {worldReactions.length > 0 && (
        <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
            Live world reaction
          </p>

          <div className="space-y-3">
            {worldReactions.map((reaction, index) => (
              <div
                key={`${reaction}-${index}`}
                className="rounded-2xl border border-emerald-300/15 bg-black/20 p-3 text-sm leading-6 text-emerald-50"
              >
                {reaction}
              </div>
            ))}
          </div>
        </div>
      )}

      {consequenceCards.length > 0 && (
        <div className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/10 p-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-violet-200">
            Cinematic consequence cards
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {consequenceCards.map((card, index) => (
              <div
                key={`${card.title}-${index}`}
                className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80"
              >
                <div className="min-h-36 bg-gradient-to-br from-violet-400/25 via-cyan-300/15 to-slate-950 p-4">
                  <div className="flex h-full min-h-28 flex-col justify-between">
                    <span className="w-fit rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/75">
                      Mission frame {index + 1}
                    </span>

                    <div>
                      <h4 className="text-lg font-semibold text-white">
                        {card.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-white/75">
                        {card.caption}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      Visual tone
                    </p>
                    <p className="mt-1 text-sm text-slate-100">
                      {card.tone}
                    </p>
                  </div>

                  <details className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-violet-100">
                      Future image prompt slot
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      {card.promptSlot}
                    </p>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {childTurnCount >= 2 && (
        <div className="mt-6 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-200">
                Mission memory builder
              </p>
              <h4 className="mt-2 text-lg font-semibold text-white">
                {missionMemoryStatus.label}
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-fuchsia-50/85">
                {missionMemoryStatus.description}
              </p>
            </div>

            <div className="rounded-2xl border border-fuchsia-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-fuchsia-100">
              {missionMemoryStatus.readiness}% recap readiness
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-fuchsia-300 transition-all duration-500"
              style={{ width: `${missionMemoryStatus.readiness}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {consequenceCards.slice(-3).map((card, index) => (
              <div
                key={`${card.title}-memory-${index}`}
                className="rounded-2xl border border-white/10 bg-black/20 p-3"
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-fuchsia-100/70">
                  Memory beat {index + 1}
                </p>
                <h5 className="mt-2 text-sm font-semibold text-white">
                  {card.title}
                </h5>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {card.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {childTurnCount >= 4 && (
        <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200">
                Mission outcome
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">
                {missionOutcome.title}
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50/90">
                {missionOutcome.result}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-amber-100">
              Final mentor reflection
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">
                Mentor reflection
              </p>
              <p className="mt-2 text-sm leading-6 text-white/90">
                {missionOutcome.mentorReflection}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">
                Recap direction
              </p>
              <p className="mt-2 text-sm leading-6 text-white/90">
                {missionOutcome.nextStep}
              </p>
            </div>
          </div>
        </div>
      )}

      {childTurnCount >= 4 && (
        <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                Mission recap ready
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">
                Your cinematic mission memory is ready to package
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">
                VELTO has enough mission beats to prepare a short recap. The next product layer will connect these frames to image generation and short movie export.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-100">
              {consequenceCards.length} frames collected
            </div>
          </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-emerald-100">
              Preview recap package
            </summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">
              {buildMissionRecapSummary()}
            </pre>
          </details>

          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-black/20 p-3 text-sm leading-6 text-emerald-50/85">
            Next: generate cinematic images for the strongest memory frames, then hand them to the Storyverse / Creator Lab export pipeline.
          </div>
        </div>
      )}

      {childTurnCount > 0 && (
        <div className="mt-6 rounded-3xl border border-teal-300/20 bg-teal-300/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-teal-200">
            Next stage guidance
          </p>
          <h4 className="mt-2 text-lg font-semibold text-white">
            {activeMissionStage.title}
          </h4>
          <p className="mt-2 text-sm leading-6 text-teal-50/90">
            {activeMissionStage.thinkingQuestion}
          </p>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-sky-300/20 bg-sky-300/10 p-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-sky-200">
          Mentor thinking guide
        </p>
        <p className="text-sm leading-6 text-sky-50/90">
          Your mentor will not choose for you. It will help you think through what to protect first, what to verify next, and how to give a calm command.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the mission character a question or send your command..."
          className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
        />

        <button
          onClick={handleSend}
          disabled={isMentorTyping}
          className="rounded-2xl bg-cyan-300 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Transmit
        </button>
      </div>
    </div>
  );
}