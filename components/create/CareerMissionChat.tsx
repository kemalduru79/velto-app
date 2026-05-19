"use client";

import CareerMissionChatRecovery from "./career-chat/CareerMissionChatRecovery";

type CareerMissionChatProps = {
  language: string;
  professionKey: string;
  professionTitle: string;
  missionTitle: string;
  missionBriefing: string;
  missionObjective: string;
  mentorName: string;
};

export default function CareerMissionChat(
  props: CareerMissionChatProps
) {
  return <CareerMissionChatRecovery {...props} />;
}