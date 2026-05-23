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
  const [branchSignals, setBranchSignals] = useState<BranchSignal[]>([]);
  const [showMissionDetails, setShowMissionDetails] = useState(false);
  const [missionBranchState, setMissionBranchState] =
    useState<MissionBranchState>("UNCERTAIN");

  const [typedAssignment, setTypedAssignment] = useState("");
  const [typedStreamBody, setTypedStreamBody] = useState("");

  const typingTimerRef = useRef<number | null>(null);
  const streamTypingTimerRef = useRef<number | null>(null);
  const lastSpokenStreamEventRef = useRef<string | null>(null);

  const childTurnCount = messages.filter((message) => message.role === "child").length;
  const missionPhase = getMissionPhase(childTurnCount);
  const missionMemoryStatus = getMissionMemoryStatus(childTurnCount);
  const missionOutcome = buildMissionOutcome(missionBranchState);
  const missionPath = getMissionPath(professionKey);
  const missionCharacter = getMissionCharacter(professionKey);
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
  const streamHistoryEvents = missionStreamEvents.slice(0, -1).slice(-5);
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
          label: "Oxygen sensor data",
          prompt: "Maya, please compare the main oxygen sensor with the backup oxygen sensor.",
        },
        {
          label: "Crew health status",
          prompt: "Maya, what is the current crew health and stress status?",
        },
        {
          label: "Power system logs",
          prompt: "Maya, did the oxygen alarm start after a power fluctuation?",
        },
      ],
      doctor: [
        {
          label: "Symptoms",
          prompt: "Alex, what symptoms are you feeling right now?",
        },
        {
          label: "Breathing",
          prompt: "Alex, are you breathing normally or feeling short of breath?",
        },
        {
          label: "Pain level",
          prompt: "Alex, where is the pain and how strong is it?",
        },
      ],
      pilot: [
        {
          label: "Weather movement",
          prompt: "Tower, what is the latest storm movement and wind condition?",
        },
        {
          label: "Runway visibility",
          prompt: "Tower, what is the current runway visibility?",
        },
        {
          label: "Fuel timing",
          prompt: "Tower, how much safe holding time do we have with current fuel?",
        },
      ],
      aiengineer: [
        {
          label: "Training data",
          prompt: "Mina, what training data issue could explain this AI behavior?",
        },
        {
          label: "Model behavior",
          prompt: "Mina, where is the model behaving unexpectedly?",
        },
        {
          label: "User safety impact",
          prompt: "Mina, which users could be harmed if this AI is wrong?",
        },
      ],
      cyberdetective: [
        {
          label: "Login source",
          prompt: "Noah, where did the suspicious login come from?",
        },
        {
          label: "Suspicious device",
          prompt: "Noah, what do we know about the new device?",
        },
        {
          label: "Affected account activity",
          prompt: "Noah, which account activity looks risky right now?",
        },
      ],
    };

    return (
      channels[normalizedProfessionKey] ?? [
        {
          label: "Situation data",
          prompt: "Mission Specialist, what information should I verify first?",
        },
        {
          label: "People status",
          prompt: "Mission Specialist, who needs protection or support right now?",
        },
        {
          label: "Risk signal",
          prompt: "Mission Specialist, what is the biggest risk signal?",
        },
      ]
    );
  }

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

  function buildCharacterReply(userInput: string, character: MissionCharacter, branchState: MissionBranchState) {
    const normalized = userInput.toLowerCase();

    const branchContext =
      branchState === "SAFE"
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

  function buildMentorResponse(
    userInput: string,
    stage: MissionStage,
    characterReply: string,
    branchState: MissionBranchState,
    nextStage?: MissionStage,
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

    let dataInterpretation =
      "The mission character gave you new information. Your job is to turn that information into a safer next command.";

    if (
      normalizedCharacterReply.includes("backup sensor") ||
      normalizedCharacterReply.includes("cabin pressure") ||
      normalizedCharacterReply.includes("sensor mismatch")
    ) {
      dataInterpretation =
        "The oxygen data is mixed: one signal looks risky, but backup readings and cabin pressure reduce the chance of a full oxygen loss. This means you should verify before making a dramatic move.";
    } else if (
      normalizedCharacterReply.includes("crew health") ||
      normalizedCharacterReply.includes("heart rates") ||
      normalizedCharacterReply.includes("stress")
    ) {
      dataInterpretation =
        "The people are physically stable, but stress is rising. That means your next command should combine calm communication with one clear system check.";
    } else if (
      normalizedCharacterReply.includes("power logs") ||
      normalizedCharacterReply.includes("fluctuation")
    ) {
      dataInterpretation =
        "The power log gives you a possible cause. This is useful because a cause lets you test the problem instead of guessing.";
    } else if (
      normalizedCharacterReply.includes("dizzy") ||
      normalizedCharacterReply.includes("chest") ||
      normalizedCharacterReply.includes("pain")
    ) {
      dataInterpretation =
        "The patient has symptoms that need careful triage. You should protect safety first, then collect one more clear clue before deciding care.";
    } else if (
      normalizedCharacterReply.includes("storm") ||
      normalizedCharacterReply.includes("runway") ||
      normalizedCharacterReply.includes("fuel")
    ) {
      dataInterpretation =
        "The flight data is about timing and safety margin. Your next decision should compare waiting, landing and rerouting without rushing.";
    } else if (
      normalizedCharacterReply.includes("training data") ||
      normalizedCharacterReply.includes("model") ||
      normalizedCharacterReply.includes("human review")
    ) {
      dataInterpretation =
        "The AI system may be confident without being safe. Your next move should protect users before optimizing or launching the model.";
    } else if (
      normalizedCharacterReply.includes("suspicious login") ||
      normalizedCharacterReply.includes("unknown device") ||
      normalizedCharacterReply.includes("account")
    ) {
      dataInterpretation =
        "The cyber evidence points to access risk. Your next move should protect accounts and preserve evidence before investigating deeper.";
    }

    const stageBridge = nextStage
      ? `Next mission stage: ${nextStage.title}. ${nextStage.context}`
      : "You are close to completing the mission path. Now prepare your final judgment.";

    const mentorObservation = noticedCare
      ? "You are thinking about people first. That is a strong professional signal."
      : noticedEvidence
        ? "You are looking for evidence before acting. That makes your decision safer."
        : "You made a first move. Now we need to make your reasoning clearer.";

    const branchTone =
      branchState === "SAFE"
        ? "The mission is stabilizing. Continue verifying before making the next major move."
        : branchState === "RISKY"
          ? "Mission pressure is increasing. Slow down and reduce uncertainty before acting."
          : "The mission is still uncertain. Gather one more useful signal before deciding.";

    const stageGuidance = [
      `${mentorName}: ${mentorObservation}`,
      `What this information suggests: ${dataInterpretation}`,
      `Current stage: ${stage.title}.`,
      `Mission branch state: ${branchState}. ${branchTone}`,
      stage.mentorHint,
      `Before your next command: ${stage.thinkingQuestion}`,
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
    const characterReply = buildCharacterReply(
      userMessage,
      missionCharacter,
      missionBranchState,
    );
    const worldReaction = buildWorldReaction(userMessage);
    const branchSignal = buildBranchSignal(userMessage, characterReply);
    const branchState = determineMissionBranchState(branchSignal);
    const consequenceCard = buildConsequenceCard(userMessage, branchState);
    applyBranchStateMetrics(branchState);

    const mentorResponse = buildMentorResponse(
      userMessage,
      currentStage,
      characterReply,
      branchState,
      nextStage.title === currentStage.title ? undefined : nextStage,
    );

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

      <div className="mt-6 overflow-hidden rounded-[36px] border border-cyan-300/20 bg-black/40 shadow-[0_24px_90px_rgba(34,211,238,0.12)]">
        <div className="border-b border-cyan-300/10 bg-gradient-to-r from-cyan-300/15 via-white/[0.04] to-transparent px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                Live mission stream
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {activeStreamEvent.title}
              </h3>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-100/65">
                {getEventPulseLabel(activeStreamEvent)} · {getEventPriority(activeStreamEvent)} · {getPacingLabel(activeStreamEvent)} · Voice synced
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-300/20 bg-black/30 px-3 py-2 text-xs font-semibold text-cyan-100">
              {activeStreamEvent.time} · {activeStreamEvent.label}
            </div>
          </div>

          <div
            className={`mt-5 rounded-3xl border p-5 ${
              activeStreamEvent.tone === "mentor"
                ? "border-amber-300/25 bg-amber-300/10"
                : activeStreamEvent.tone === "character"
                  ? "border-emerald-300/25 bg-emerald-300/10"
                  : activeStreamEvent.tone === "alert"
                    ? "border-rose-300/25 bg-rose-300/10"
                    : activeStreamEvent.tone === "decision"
                      ? "border-cyan-300/25 bg-cyan-300/10"
                      : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Active focus
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Live typing
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-white/90">
              {typedStreamBody}
              {typedStreamBody.length < activeStreamEvent.body.length && (
                <span className="ml-1 inline-block animate-pulse text-cyan-200">
                  ▌
                </span>
              )}
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Cinematic pacing
                </p>
                <p className="text-xs font-semibold text-white/70">
                  {getPacingLabel(activeStreamEvent)}
                </p>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    getEventPacing(activeStreamEvent) === "urgent"
                      ? "w-full bg-rose-300"
                      : getEventPacing(activeStreamEvent) === "tense"
                        ? "w-3/4 bg-amber-300"
                        : getEventPacing(activeStreamEvent) === "calm"
                          ? "w-1/2 bg-cyan-300"
                          : "w-1/3 bg-slate-300"
                  }`}
                />
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/25">
              <div className="min-h-40 bg-gradient-to-br from-cyan-300/20 via-violet-300/10 to-slate-950 p-4">
                <div className="flex h-full min-h-32 flex-col justify-between">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                      Dynamic visual beat
                    </p>
                    <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                      {activeVisualBeat.mood}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      {activeVisualBeat.title}
                    </h4>
                    <p className="mt-2 text-xs leading-5 text-white/65">
                      Image-ready scene placeholder. Real image generation will connect in the next visual sprint.
                    </p>
                  </div>
                </div>
              </div>

              <details className="border-t border-white/10 p-4">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-cyan-100">
                  Visual prompt seed
                </summary>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  {activeVisualBeat.prompt}
                </p>
              </details>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Recent transmission history
            </p>
            <p className="text-xs text-slate-500">
              {missionStreamEvents.length} events
            </p>
          </div>

          <div className="space-y-3">
            {streamHistoryEvents.map((event, index) => (
              <div
                key={`${event.time}-${event.title}-${index}`}
                className={`rounded-3xl border p-4 opacity-85 transition hover:opacity-100 ${
                  event.tone === "mentor"
                    ? "border-amber-300/15 bg-amber-300/5 text-amber-50"
                    : event.tone === "character"
                      ? "border-emerald-300/15 bg-emerald-300/5 text-emerald-50"
                      : event.tone === "alert"
                        ? "border-rose-300/15 bg-rose-300/5 text-rose-50"
                        : event.tone === "decision"
                          ? "border-cyan-300/15 bg-cyan-300/5 text-cyan-50"
                          : "border-white/10 bg-white/[0.03] text-slate-100"
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    {event.time} · {event.label}
                  </p>
                  <span className="w-fit rounded-2xl border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    {getEventPriority(event)} · {getPacingLabel(event)}
                  </span>
                </div>

                <h4 className="mt-2 text-sm font-semibold text-white/90">
                  {event.title}
                </h4>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-white/65">
                  {event.body}
                </p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/35">
                  Visual beat · {buildVisualBeatForEvent(event).title}
                </p>
              </div>
            ))}
          </div>
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
          <div className="flex flex-col gap-2">
            <div className="rounded-2xl border border-emerald-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-100">
              {missionCharacter.channel}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-50/80">
              NPC awareness · {missionBranchState}
            </div>
            {childTurnCount > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-emerald-50/70">
                Interruptions enabled
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-black/25 p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200">
          Ask for mission data
        </p>
        <h4 className="mt-2 text-lg font-semibold text-white">
          Choose the information you need before deciding
        </h4>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/80">
          These are not answer choices. They help you request the right information from the mission character.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {informationChannels.map((channel) => (
            <button
              key={channel.label}
              type="button"
              onClick={() =>
                setInput((current) =>
                  current.trim().length > 0 ? current : channel.prompt,
                )
              }
              className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-left transition hover:border-emerald-200/40 hover:bg-emerald-300/20"
            >
              <p className="text-xs font-semibold text-emerald-100">
                {channel.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-emerald-50/70">
                {channel.prompt}
              </p>
            </button>
          ))}
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
              Browser voice is now synchronized with the active mission stream after each transmission finishes typing. ElevenLabs can be connected in the next voice sprint.
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

      <div className="mt-6 flex items-center justify-between rounded-3xl border border-white/10 bg-black/20 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            Mission details
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Open advanced mission insights and progress metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMissionDetails((current) => !current)}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
        >
          {showMissionDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {showMissionDetails && (
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
      )}

      {showMissionDetails && (
        <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">
              Live mission state
            </p>
            <h4 className="mt-2 text-lg font-semibold text-white">
              The mission reacts to every command and branch state
            </h4>
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-2xl border border-cyan-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-cyan-100">
              {messages.filter((message) => message.role === "child").length}/4 mission turns
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300">
              Active branch · {missionBranchState}
            </div>
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
      )}

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

      {showMissionDetails && branchSignals.length > 0 && (
        <div className="mt-6 rounded-3xl border border-blue-300/20 bg-blue-300/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-blue-200">
                Branch intelligence
              </p>
              <h4 className="mt-2 text-lg font-semibold text-white">
                {branchPatternLabel}
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50/85">
                VELTO is reading the decision path behind the scenes. This stays simple for the child, but helps prepare mentor evolution and cinematic recap quality.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-blue-100">
              {branchConfidence}% branch confidence
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-300 transition-all duration-500"
              style={{ width: `${branchConfidence}%` }}
            />
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {branchSignals.slice(-4).map((signal, index) => (
              <div
                key={`${signal.label}-history-${index}`}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-blue-50/80"
              >
                {index + 1}. {signal.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {showMissionDetails && branchSignals.length > 0 && (
        <div className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-300/10 p-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-orange-200">
            Mission branch signal
          </p>

          <div className="space-y-3">
            {branchSignals.slice(-3).map((signal, index) => (
              <div
                key={`${signal.label}-${index}`}
                className={`rounded-2xl border p-3 text-sm leading-6 ${
                  signal.tone === "safe"
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                    : signal.tone === "risky"
                      ? "border-rose-300/20 bg-rose-300/10 text-rose-50"
                      : "border-orange-300/20 bg-black/20 text-orange-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                  {signal.label}
                </p>
                <p className="mt-2">
                  {signal.description}
                </p>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                    Suggested next thinking step
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/80">
                    {signal.nextStep}
                  </p>
                </div>
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

      {childTurnCount >= 2 && (
        <div className="mt-6 rounded-3xl border border-purple-300/20 bg-purple-300/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-purple-200">
                AI identity signal
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">
                {decisionIdentityProfile.label}
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-purple-50/90">
                {decisionIdentityProfile.description}
              </p>
            </div>

            <div className="rounded-2xl border border-purple-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-purple-100">
              Early profile
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {decisionIdentityProfile.traits.map((trait) => (
              <div
                key={trait}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-purple-50/90"
              >
                {trait}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-purple-100/70">
              Mentor evolution note
            </p>
            <p className="mt-2 text-sm leading-6 text-white/90">
              {decisionIdentityProfile.mentorNote}
            </p>
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
              Final mentor reflection · {missionBranchState}
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
                VELTO has enough mission beats to prepare a short recap. Detected branch pattern: {branchPatternLabel}. Early identity signal: {decisionIdentityProfile.label}. The next product layer will connect these frames to image generation and short movie export.
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

      {latestBranchSignal && (
        <div className="mt-6 rounded-3xl border border-orange-300/20 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-orange-200">
            Branch-aware next move
          </p>
          <h4 className="mt-2 text-lg font-semibold text-white">
            {latestBranchSignal.label}
          </h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-orange-50/85">
            {latestBranchSignal.nextStep}
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-orange-100/70">
              Branch-specific command starter
            </p>
            <p className="mt-2 text-xs leading-5 text-orange-50/90">
              {branchCommandStarter}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setInput((current) =>
                current.trim().length > 0 ? current : branchCommandStarter,
              )
            }
            className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-left text-xs font-semibold text-orange-50 transition hover:border-orange-200/40 hover:bg-orange-300/20"
          >
            Use this as my next command starter
          </button>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">
              Current mission focus
            </p>
            <h4 className="mt-2 text-lg font-semibold text-white">
              Ask, understand, then decide
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/90">
              {currentFocusText}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="rounded-2xl border border-cyan-300/20 bg-black/20 px-3 py-2 text-xs font-semibold text-cyan-100">
              {missionCharacter.name}
            </div>

            <div
              className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${
                missionBranchState === "SAFE"
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                  : missionBranchState === "RISKY"
                    ? "border-rose-300/20 bg-rose-300/10 text-rose-50"
                    : "border-orange-300/20 bg-orange-300/10 text-orange-50"
              }`}
            >
              Branch State · {missionBranchState}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              setInput((current) =>
                current.trim().length > 0
                  ? current
                  : `I want to ask ${missionCharacter.name} for the most important information first.`,
              )
            }
            className="rounded-2xl border border-cyan-300/20 bg-black/20 px-4 py-3 text-left text-xs leading-5 text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-300/10"
          >
            Ask for information
          </button>

          <button
            type="button"
            onClick={() =>
              setInput((current) =>
                current.trim().length > 0
                  ? current
                  : currentFocusText,
              )
            }
            className="rounded-2xl border border-cyan-300/20 bg-black/20 px-4 py-3 text-left text-xs leading-5 text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-300/10"
          >
            Use mentor focus
          </button>

          <button
            type="button"
            onClick={() =>
              setInput((current) =>
                current.trim().length > 0
                  ? current
                  : branchCommandStarter,
              )
            }
            className="rounded-2xl border border-cyan-300/20 bg-black/20 px-4 py-3 text-left text-xs leading-5 text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-300/10"
          >
            Make next command
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
        <p className="text-sm leading-6 text-cyan-50/90">
          You do not need to know the perfect answer. Ask questions, collect information and decide step by step like a real mission leader.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question or send your next command..."
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