"use client";

import WorldShell from "@/components/create/WorldShell";
import { useWorldState } from "@/components/create/WorldContext";

const workspaceContent = {
  storyverse: {
    title: "Build Your Own Story World",
    description:
      "Create characters, scenes and cinematic adventures inside a playful AI storytelling experience.",
    world: "storyverse" as const,
    primaryCta: "Start Storyverse",
    secondaryCta: "View journey",
    heroBadge: "✨ Flagship experience",
    heroMessage:
      "Start with one idea. Build a complete story world.",
    heroSubline:
      "VELTO guides children from imagination to characters, scenes and a movie-style output.",
    promise: [
      "Write the idea",
      "Create characters",
      "Build scenes",
      "Generate package",
    ],
    sections: [
      {
        title: "Story",
        detail: "Turn a simple idea into a clear adventure.",
        emoji: "📚",
        action: "Start here",
        outcome: "Story idea",
      },
      {
        title: "Characters",
        detail: "Create heroes, friends and personalities.",
        emoji: "🧒",
        action: "Design next",
        outcome: "Character card",
      },
      {
        title: "Scenes",
        detail: "Build what happens first, next and last.",
        emoji: "🎨",
        action: "Build scenes",
        outcome: "Scene plan",
      },
      {
        title: "Movie",
        detail: "Move toward visuals, voice and cinematic output.",
        emoji: "🎬",
        action: "Create output",
        outcome: "Movie package",
      },
    ],
  },
  creatorlab: {
    title: "Create Like a Real Creator",
    description:
      "Generate creator-style ideas, hooks and social-ready creative packages.",
    world: "creatorlab" as const,
    primaryCta: "Start Creator Lab",
    secondaryCta: "View journey",
    heroBadge: "⚡ Creator mode",
    heroMessage:
      "Turn one idea into a creator-ready package.",
    heroSubline:
      "VELTO helps shape topics, hooks, scripts and simple publish-ready assets.",
    promise: [
      "Pick topic",
      "Build hook",
      "Package idea",
      "Prepare assets",
    ],
    sections: [
      {
        title: "Idea",
        detail: "Pick one topic for a short video.",
        emoji: "💡",
        action: "Start here",
        outcome: "Video idea",
      },
      {
        title: "Hook",
        detail: "Make the first seconds clear and exciting.",
        emoji: "⚡",
        action: "Build hook",
        outcome: "Opening hook",
      },
      {
        title: "Package",
        detail: "Shape script, thumbnail and caption direction.",
        emoji: "📦",
        action: "Build package",
        outcome: "Creator pack",
      },
      {
        title: "Export",
        detail: "Prepare creator-ready assets for the next step.",
        emoji: "🚀",
        action: "Prepare assets",
        outcome: "Asset pack",
      },
    ],
  },
  careerlab: {
    title: "Explore Future Careers",
    description:
      "Discover future professions through guided AI-powered missions and role journeys.",
    world: "careerlab" as const,
    primaryCta: "Start Career Lab",
    secondaryCta: "View journey",
    heroBadge: "🚀 Mission mode",
    heroMessage:
      "Choose a role and explore it through a mission.",
    heroSubline:
      "VELTO helps children understand future jobs through choices and reflection.",
    promise: [
      "Choose role",
      "Start mission",
      "Make choices",
      "Review notes",
    ],
    sections: [
      {
        title: "Role",
        detail: "Pick one profession to explore.",
        emoji: "🧭",
        action: "Start here",
        outcome: "Role choice",
      },
      {
        title: "Mission",
        detail: "Understand the challenge and goal.",
        emoji: "🛰️",
        action: "Start mission",
        outcome: "Mission brief",
      },
      {
        title: "Choices",
        detail: "Decide what to do and see the path change.",
        emoji: "🧠",
        action: "Make choices",
        outcome: "Decision map",
      },
      {
        title: "Reflect",
        detail: "Review what you learned with mentor guidance.",
        emoji: "🏁",
        action: "Review notes",
        outcome: "Mentor notes",
      },
    ],
  },
};

export default function FocusedWorldWorkspace() {
  const { activeWorld } = useWorldState();
  const content = workspaceContent[activeWorld];

  return (
    <div className="space-y-7">
      <WorldShell
        world={content.world}
        title={content.title}
        description={content.description}
      >
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-7 shadow-sm">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-100/50 blur-3xl" />

            <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white">
                    {content.heroBadge}
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="max-w-3xl text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                    {content.heroMessage}
                  </h2>

                  <p className="max-w-3xl text-base leading-8 text-slate-600">
                    {content.heroSubline}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {content.promise.map((item, index) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm"
                    >
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-7 py-4 text-sm font-black text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl"
                >
                  {content.primaryCta}
                </button>

                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-600 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:text-slate-900"
                >
                  {content.secondaryCta}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {content.sections.map((section, index) => (
              <button
                key={section.title}
                type="button"
                className="group flex min-h-[250px] flex-col rounded-[32px] border border-slate-200/70 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-3 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                    Step {index + 1}
                  </div>

                  <div className="text-3xl transition-transform duration-300 group-hover:scale-125">
                    {section.emoji}
                  </div>
                </div>

                <div className="mt-7 text-xl font-black text-slate-800">
                  {section.title}
                </div>

                <div className="mt-3 text-sm leading-7 text-slate-500">
                  {section.detail}
                </div>

                <div className="mt-auto pt-6">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                    Output · {section.outcome}
                  </div>

                  <div className="mt-4 text-sm font-black text-slate-500 transition-colors duration-300 group-hover:text-slate-900">
                    {section.action} →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </WorldShell>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/80 p-5 text-center shadow-sm">
        <div className="text-sm font-semibold text-slate-500">
          Other experiences remain softly available in the background
        </div>
      </section>
    </div>
  );
}
