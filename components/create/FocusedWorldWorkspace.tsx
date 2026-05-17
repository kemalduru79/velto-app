"use client";

import { useWorldState } from "@/components/create/WorldContext";

const workspaceContent = {
  storyverse: {
    id: "storyverse-workspace",
    eyebrow: "Storyverse",
    title: "Story Room",
    description:
      "Create a story one step at a time.",
    tone: "bg-sky-50/[0.028]",
    accent: "text-sky-100",
    ring: "border-sky-200/15",
    status: "Ready to create",
    primaryAction: "Start Story",
    secondaryAction: "See Outputs",
    guidance:
      "Start with one world, one main character and one clear goal.",
    phases: [
      {
        title: "World",
        detail:
          "Choose where the story happens.",
      },
      {
        title: "Character",
        detail:
          "Choose who the story is about.",
      },
      {
        title: "Scenes",
        detail:
          "Build the story step by step.",
      },
      {
        title: "Output",
        detail:
          "Move into video and story production.",
      },
    ],
    outputs: [
      "Story",
      "Characters",
      "Scenes",
      "Video package",
    ],
  },
  creatorlab: {
    id: "creatorlab-workspace",
    eyebrow: "Creator Lab",
    title: "Creator Room",
    description:
      "Build a short idea one step at a time.",
    tone: "bg-rose-50/[0.028]",
    accent: "text-rose-100",
    ring: "border-rose-200/15",
    status: "Ready to build",
    primaryAction: "Start Creator Flow",
    secondaryAction: "See Assets",
    guidance:
      "Start with one topic and keep the idea short and clear.",
    phases: [
      {
        title: "Topic",
        detail:
          "Choose one video idea.",
      },
      {
        title: "Hook",
        detail:
          "Make the first seconds clear.",
      },
      {
        title: "Package",
        detail:
          "Prepare script and thumbnail direction.",
      },
      {
        title: "Assets",
        detail:
          "Move into creator production.",
      },
    ],
    outputs: [
      "Idea",
      "Script",
      "Thumbnail",
      "Caption",
    ],
  },
  careerlab: {
    id: "careerlab-workspace",
    eyebrow: "Career Lab",
    title: "Mentor Room",
    description:
      "Explore a career mission one step at a time.",
    tone: "bg-teal-50/[0.028]",
    accent: "text-teal-100",
    ring: "border-teal-200/15",
    status: "Ready to explore",
    primaryAction: "Start Mission",
    secondaryAction: "See Notes",
    guidance:
      "Choose one profession and follow the mission step by step.",
    phases: [
      {
        title: "Role",
        detail:
          "Choose one profession.",
      },
      {
        title: "Mission",
        detail:
          "Understand the challenge.",
      },
      {
        title: "Choice",
        detail:
          "Decide what to do.",
      },
      {
        title: "Reflect",
        detail:
          "Review what you learned.",
      },
    ],
    outputs: [
      "Career card",
      "Decision map",
      "Mentor notes",
      "Summary",
    ],
  },
} as const;

export default function FocusedWorldWorkspace() {
  const { activeWorld } = useWorldState();
  const content = workspaceContent[activeWorld];

  return (
    <section
      id={content.id}
      className={`scroll-mt-8 rounded-[22px] border p-4 backdrop-blur-sm md:p-5 lg:p-6 ${content.tone} ${content.ring}`}
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr] xl:items-stretch">
        <div className="flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs uppercase tracking-[0.12em] text-white/38">
              {content.eyebrow}
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                {content.title}
              </h2>

              <p className="max-w-2xl text-base leading-8 text-white/56">
                {content.description}
              </p>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-white/35">
              Now
            </div>

            <div className={`mt-3 text-base font-semibold ${content.accent}`}>
              {content.status}
            </div>

            <p className="mt-4 text-sm leading-7 text-white/50">
              {content.guidance}
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"
              >
                {content.primaryAction}
              </button>

              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-white/60 transition-all duration-300 hover:border-white/20 hover:text-white"
              >
                {content.secondaryAction}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {content.phases.map((phase, index) => (
              <div
                key={phase.title}
                className="rounded-[20px] border border-white/10 bg-black/10 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.028]"
              >
                <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                  Step {index + 1}
                </div>

                <div className="mt-3 text-base font-semibold text-white/78">
                  {phase.title}
                </div>

                <p className="mt-3 text-sm leading-7 text-white/48">
                  {phase.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.018] p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-white/35">
              You will create
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {content.outputs.map((output) => (
                <div
                  key={output}
                  className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-white/58"
                >
                  {output}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
