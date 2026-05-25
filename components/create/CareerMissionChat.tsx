"use client";

import CareerMissionExperience from "./career-chat/CareerMissionExperience";

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
  return <CareerMissionExperience {...props} />;
}
