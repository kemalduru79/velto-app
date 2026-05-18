"use client";

// X11.7 Storyverse Localization Consistency: workspace copy follows selected TR/EN UI language.

// X11.5A Focused Workspace Identity: stronger world-specific title, badge and CTA language.

// X.7.25 Moodal CTA Polish: CTA language and visual hierarchy aligned with premium kids product feel.
// X.7.26 Mobile & Tablet Cohesion Polish: responsive journey layout refinement.
// X.7.27 Cinematic Immersion Pass: magical hero depth and cinematic CTA energy.
// X.7.28 Section Cleanup & Simplification: simplified journey cards and reduced visual density.
// X.7.29 Final QA & X7 Closure: final journey surface and CTA consistency polish.
// X.8.1 Cognitive Load Reduction Pass: removed repeated terminology and simplified onboarding density.
// X.8.2 Single Action Focus Pass: simplified hero promises and softened secondary action.

import WorldShell from "@/components/create/WorldShell";
import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

const workspaceContent = {
  storyverse: {
    title: "Enter Your Story World",
    description:
      "Characters, scenes and cinematic adventures inside a playful AI storytelling experience.",
    world: "storyverse" as const,
    primaryCta: "Start Storyverse ✨",
    secondaryCta: "Explore",
    heroBadge: "✨ Cinematic world",
    heroMessage:
      "Start with one idea. Build a complete story world.",
    heroSubline:
      "Turn imagination into characters, scenes and a cartoon-style adventure.",
    promise: [
      "Idea",
      "Characters",
      "Scenes",
      "Movie",
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
        action: "Scenes",
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
    title: "Create Like a Young Creator",
    description:
      "Generate creator-style ideas, hooks and social-ready creative packages.",
    world: "creatorlab" as const,
    primaryCta: "Start Creator Lab ⚡",
    secondaryCta: "Explore",
    heroBadge: "⚡ Creator world",
    heroMessage:
      "Turn one idea into a creator-ready package.",
    heroSubline:
      "VELTO helps shape topics, hooks, scripts and simple publish-ready assets.",
    promise: [
      "Topic",
      "Hook",
      "Package",
      "Assets",
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
        action: "Hook",
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
        action: "Assets",
        outcome: "Asset pack",
      },
    ],
  },
  careerlab: {
    title: "Explore Future Missions",
    description:
      "Discover future professions through guided AI-powered missions and role journeys.",
    world: "careerlab" as const,
    primaryCta: "Start Career Mission 🚀",
    secondaryCta: "Explore",
    heroBadge: "🚀 Mission world",
    heroMessage:
      "Choose a role and explore it through a mission.",
    heroSubline:
      "VELTO helps children understand future jobs through choices and reflection.",
    promise: [
      "Role",
      "Mission",
      "Choices",
      "Review",
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
        action: "Mission",
        outcome: "Mission brief",
      },
      {
        title: "Choices",
        detail: "Decide what to do and see the path change.",
        emoji: "🧠",
        action: "Choices",
        outcome: "Decision map",
      },
      {
        title: "Reflect",
        detail: "Review what you learned with mentor guidance.",
        emoji: "🏁",
        action: "Review",
        outcome: "Mentor notes",
      },
    ],
  },
};


const localizedWorkspaceContent = (
  content: (typeof workspaceContent)[keyof typeof workspaceContent],
  activeWorld: keyof typeof workspaceContent,
  isEnglish: boolean,
) => {
  if (isEnglish) {
    return content;
  }

  const trCopy = {
    storyverse: {
      title: "Hikâye Dünyana Gir",
      description: "Oyuncu bir AI hikâye deneyiminde karakterler, sahneler ve sinematik maceralar oluştur.",
      primaryCta: "Storyverse’e Başla ✨",
      secondaryCta: "Keşfet",
      heroBadge: "✨ Sinematik dünya",
      heroMessage: "Bir fikirle başla. Kendi hikâye dünyanı kur.",
      heroSubline: "Hayal gücünü karakterlere, sahnelere ve çizgi film tarzı bir maceraya dönüştür.",
      promise: ["Fikir", "Karakterler", "Sahneler", "Film"],
      sections: [
        {
          title: "Hikâye",
          detail: "Basit bir fikri net bir maceraya dönüştür.",
          emoji: "📚",
          action: "Buradan başla",
          outcome: "Hikâye fikri",
        },
        {
          title: "Karakterler",
          detail: "Kahramanlar, arkadaşlar ve kişilikler oluştur.",
          emoji: "🧒",
          action: "Karakter tasarla",
          outcome: "Karakter kartı",
        },
        {
          title: "Sahneler",
          detail: "Önce, sonra ve en sonda ne olacağını kur.",
          emoji: "🎨",
          action: "Sahneler",
          outcome: "Sahne planı",
        },
        {
          title: "Film",
          detail: "Görsel, ses ve sinematik çıktıya doğru ilerle.",
          emoji: "🎬",
          action: "Çıktı oluştur",
          outcome: "Film paketi",
        },
      ],
    },
    creatorlab: {
      title: "Genç Bir Creator Gibi Üret",
      description: "Creator tarzı fikirler, açılışlar ve paylaşmaya hazır yaratıcı paketler oluştur.",
      primaryCta: "Creator Lab’e Başla ⚡",
      secondaryCta: "Keşfet",
      heroBadge: "⚡ Creator dünyası",
      heroMessage: "Bir fikri creator paketine dönüştür.",
      heroSubline: "VELTO; konu, açılış, senaryo ve paylaşmaya hazır içerik yönünü şekillendirir.",
      promise: ["Konu", "Açılış", "Paket", "Görseller"],
      sections: content.sections,
    },
    careerlab: {
      title: "Gelecek Görevlerini Keşfet",
      description: "AI destekli görevler ve rol yolculuklarıyla geleceğin mesleklerini keşfet.",
      primaryCta: "Career Görevine Başla 🚀",
      secondaryCta: "Keşfet",
      heroBadge: "🚀 Görev dünyası",
      heroMessage: "Bir meslek seç. Göreve gir. Kararlarını gör.",
      heroSubline: "VELTO çocukları güvenli, yönlendirilmiş ve mentor destekli kararlarla ilerletir.",
      promise: ["Rol", "Görev", "Kararlar", "Rapor"],
      sections: content.sections,
    },
  } as const;

  return {
    ...content,
    ...trCopy[activeWorld],
  };
};


export default function FocusedWorldWorkspace() {
  const { activeWorld } = useWorldState();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const content = localizedWorkspaceContent(workspaceContent[activeWorld], activeWorld, isEnglish);

  return (
    <div className="space-y-5">
      <WorldShell
        world={content.world}
        title={content.title}
        description={content.description}
      >
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-[34px] border border-orange-200/55 bg-gradient-to-br from-white via-sky-50/80 to-orange-50/70 p-5 sm:p-6 md:rounded-[36px] md:p-7 shadow-sm">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-100/50 blur-3xl" />

            <div className="relative z-10 grid gap-5 md:gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white">
                    {content.heroBadge}
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-5xl">
                    {content.heroMessage}
                  </h2>

                  <p className="max-w-3xl text-base leading-8 text-slate-600">
                    {content.heroSubline}
                  </p>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {content.promise.map((item, index) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-orange-200/45 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm"
                    >
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-r from-sky-700 to-indigo-700 px-5 py-3.5 sm:px-8 sm:py-4 text-sm font-bold text-white shadow-[0_18px_48px_rgba(14,165,233,0.18)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_26px_70px_rgba(14,165,233,0.22)]"
                >
                  {content.primaryCta}
                </button>

                <button
                  type="button"
                  className="rounded-full border border-orange-200 bg-white/90 px-5 py-3.5 sm:px-8 sm:py-4 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 hover:bg-orange-50 hover:text-slate-950 hover:shadow-md"
                >
                  {content.secondaryCta}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {content.sections.map((section, index) => (
              <button
                key={section.title}
                type="button"
                className="group flex min-h-[210px] sm:min-h-[235px] flex-col rounded-[28px] border border-orange-200/45 bg-white/82 p-5 sm:rounded-[32px] sm:p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Step {index + 1}
                  </div>

                  <div className="text-3xl transition-transform duration-300 group-hover:scale-125">
                    {section.emoji}
                  </div>
                </div>

                <div className="mt-6 text-lg sm:mt-7 sm:text-xl font-bold text-slate-800">
                  {section.title}
                </div>

                <div className="mt-3 text-sm leading-7 text-slate-500">
                  {section.detail}
                </div>

                <div className="mt-auto pt-6">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                    Output · {section.outcome}
                  </div>

                  <div className="mt-4 text-sm font-bold text-slate-500 transition-colors duration-300 group-hover:text-slate-900">
                    {section.action} →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </WorldShell>

      <section className="rounded-[34px] border border-orange-200/55 bg-white/80 p-5 text-center shadow-sm">
        <div className="text-sm font-medium text-slate-600">
          Other experiences remain softly available in the background
        </div>
      </section>
    </div>
  );
}
