"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";

export default function CareerMentorIntro() {
  return (
    <ExperienceIntroCard
      eyebrow="AI Career Missions"
      title="Explore Future Careers Through Missions"
      description="Choose a profession, make guided decisions and receive mentor-style feedback."
      tone="career"
      stage="Pilot Experience"
      duration="~35 min"
      ageRange="9–15"
      nextAction="Choose a profession and enter your first guided mission."
      primaryCta="Enter Career Lab"
      secondaryCta="Meet Mentors"
      primaryWorld="careerlab"
    />
  );
}
