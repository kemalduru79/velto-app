"use client";

import ExperienceIntroCard from "@/components/create/ExperienceIntroCard";

export default function CareerMentorIntro() {
  return (
    <ExperienceIntroCard
      eyebrow="AI Career Mentor Mode"
      title="Experience Future Careers Through AI"
      description="Explore professions through guided mentor-driven missions."
      tone="career"
      stage="Pilot Experience"
      duration="~35 min"
      ageRange="9–15"
      nextAction="Choose a profession and enter the mission."
      primaryCta="Enter Career Lab"
      secondaryCta="Meet Mentors"
      primaryWorld="careerlab"
    />
  );
}
