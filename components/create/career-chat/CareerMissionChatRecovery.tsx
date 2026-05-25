"use client";

import CareerMissionExperience from "./CareerMissionExperience";

type CareerMissionChatRecoveryProps = {
  language: string;
  professionKey: string;
  professionTitle: string;
  missionTitle: string;
  missionBriefing: string;
  missionObjective: string;
  mentorName: string;
};

/**
 * Backward-compatible shim.
 * The production source of truth is now CareerMissionExperience.
 * Keep this file temporarily so any older imports continue to work during consolidation.
 */
export default function CareerMissionChatRecovery(
  props: CareerMissionChatRecoveryProps
) {
  return <CareerMissionExperience {...props} />;
}
