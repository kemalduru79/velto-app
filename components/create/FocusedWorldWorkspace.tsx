"use client";

import WorldShell from "@/components/create/WorldShell";
import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

const workspaceContent = {
  storyverse: {
    title: {
      en: "Enter Your Story World",
      tr: "Hikâye Dünyana Gir",
    },
    description: {
      en: "Characters, scenes and cinematic adventures inside a playful AI storytelling experience.",
      tr: "Oyuncu bir AI hikâye deneyiminde karakterler, sahneler ve sinematik maceralar oluştur.",
    },
    primaryCta: { en: "Start Storyverse ✨", tr: "Storyverse’e Başla ✨" },
    secondaryCta: { en: "Explore", tr: "Keşfet" },
    heroBadge: { en: "✨ Cinematic world", tr: "✨ Sinematik dünya" },
    heroMessage: {
      en: "Start with one idea. Build a complete story world.",
      tr: "Bir fikirle başla. Kendi hikâye dünyanı kur.",
    },
    heroSubline: {
      en: "Turn imagination into characters, scenes and a cartoon-style adventure.",
      tr: "Hayal gücünü karakterlere, sahnelere ve çizgi film tarzı bir maceraya dönüştür.",
    },
    promise: {
      en: ["Idea", "Characters", "Scenes", "Movie"],
      tr: ["Fikir", "Karakter", "Sahne", "Film"],
    },
    sections: {
      en: [
        { title: "Story", detail: "Turn a simple idea into a clear adventure.", emoji: "📚", action: "Start here", outcome: "Story idea" },
        { title: "Characters", detail: "Create heroes, friends and personalities.", emoji: "🧒", action: "Design next", outcome: "Character card" },
        { title: "Scenes", detail: "Build what happens first, next and last.", emoji: "🎨", action: "Scenes", outcome: "Scene plan" },
        { title: "Movie", detail: "Move toward visuals, voice and cinematic output.", emoji: "🎬", action: "Create output", outcome: "Movie package" },
      ],
      tr: [
        { title: "Hikâye", detail: "Basit bir fikri net bir maceraya dönüştür.", emoji: "📚", action: "Buradan başla", outcome: "Hikâye fikri" },
        { title: "Karakter", detail: "Kahramanlar, arkadaşlar ve kişilikler oluştur.", emoji: "🧒", action: "Karakter tasarla", outcome: "Karakter kartı" },
        { title: "Sahne", detail: "Önce, sonra ve en sonda ne olacağını kur.", emoji: "🎨", action: "Sahneler", outcome: "Sahne planı" },
        { title: "Film", detail: "Görsel, ses ve sinematik çıktıya doğru ilerle.", emoji: "🎬", action: "Çıktı oluştur", outcome: "Film paketi" },
      ],
    },
  },
  creatorlab: {
    title: {
      en: "Create Like a Professional Creator",
      tr: "Profesyonel Creator Gibi Üret",
    },
    description: {
      en: "Generate social-ready concepts, hooks and publish-ready creative packages.",
      tr: "Sosyal medya için konsept, hook ve publish-ready içerik paketleri oluştur.",
    },
    primaryCta: { en: "Start CreatorLab ⚡", tr: "CreatorLab’e Başla ⚡" },
    secondaryCta: { en: "Explore", tr: "Keşfet" },
    heroBadge: { en: "⚡ Creator studio", tr: "⚡ Creator studio" },
    heroMessage: {
      en: "Turn one idea into a creator-ready package.",
      tr: "Tek fikri creator-ready pakete dönüştür.",
    },
    heroSubline: {
      en: "Shape topics, hooks, scripts and publish-ready assets.",
      tr: "Konu, hook, script ve yayınlanabilir asset’leri şekillendir.",
    },
    promise: {
      en: ["Topic", "Hook", "Package", "Assets"],
      tr: ["Konu", "Hook", "Paket", "Asset"],
    },
    sections: {
      en: [
        { title: "Idea", detail: "Pick one topic for a short video.", emoji: "💡", action: "Start here", outcome: "Video idea" },
        { title: "Hook", detail: "Make the first seconds clear and exciting.", emoji: "⚡", action: "Hook", outcome: "Opening hook" },
        { title: "Package", detail: "Shape script, thumbnail and caption direction.", emoji: "📦", action: "Build package", outcome: "Creator pack" },
        { title: "Export", detail: "Prepare creator-ready assets for the next step.", emoji: "🚀", action: "Assets", outcome: "Asset pack" },
      ],
      tr: [
        { title: "Fikir", detail: "Kısa video için bir konu seç.", emoji: "💡", action: "Buradan başla", outcome: "Video fikri" },
        { title: "Hook", detail: "İlk saniyeleri net ve güçlü hale getir.", emoji: "⚡", action: "Hook", outcome: "Açılış hook’u" },
        { title: "Paket", detail: "Script, thumbnail ve caption yönünü oluştur.", emoji: "📦", action: "Paket oluştur", outcome: "Creator pack" },
        { title: "Export", detail: "Creator-ready asset’leri sonraki adıma hazırla.", emoji: "🚀", action: "Asset", outcome: "Asset paketi" },
      ],
    },
  },
};

export default function FocusedWorldWorkspace() {
  const { activeWorld } = useWorldState();
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "tr";
  const content = workspaceContent[activeWorld];

  return (
    <div id={`${activeWorld}-workspace`} className="scroll-mt-6">
      <WorldShell
        world={activeWorld}
        title={content.title[locale]}
        description={content.description[locale]}
      >
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-[36px] border border-orange-200/50 bg-white/82 p-6 shadow-sm md:p-8">
            <div className="relative z-10 max-w-3xl space-y-5">
              <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-orange-800">
                {content.heroBadge[locale]}
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                {content.heroMessage[locale]}
              </h2>
              <p className="text-base leading-8 text-slate-600 md:text-lg">
                {content.heroSubline[locale]}
              </p>
              <div className="flex flex-wrap gap-2">
                {content.promise[locale].map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" className="rounded-full bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
                  {content.primaryCta[locale]}
                </button>
                <button type="button" className="rounded-full border border-orange-200 bg-white/90 px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-1 hover:bg-orange-50">
                  {content.secondaryCta[locale]}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {content.sections[locale].map((section, index) => (
              <div key={section.title} className="flex min-h-[230px] flex-col rounded-[28px] border border-orange-200/45 bg-white/82 p-5 text-left shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Step {index + 1}
                  </div>
                  <div className="text-3xl">{section.emoji}</div>
                </div>
                <div className="mt-6 text-xl font-bold text-slate-800">{section.title}</div>
                <div className="mt-3 text-sm leading-7 text-slate-500">{section.detail}</div>
                <div className="mt-auto pt-6">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                    Output · {section.outcome}
                  </div>
                  <div className="mt-4 text-sm font-bold text-slate-500">{section.action} →</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </WorldShell>
    </div>
  );
}
