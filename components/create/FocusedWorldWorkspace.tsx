"use client";

import WorldShell from "@/components/create/WorldShell";
import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

const workspaceContent = {
  storyverse: {
    title: {
      en: "Build a safe cinematic story package.",
      tr: "Güvenli sinematik hikâye paketini oluştur.",
    },
    description: {
      en: "A focused Storyverse workspace for premise, characters, scenes, narration and safe export — designed for young users without looking like a toy.",
      tr: "Fikir, karakter, sahne, anlatım ve güvenli export için odaklı Storyverse çalışma alanı — genç kullanıcılar için tasarlandı, oyuncak gibi görünmez.",
    },
    primaryCta: { en: "Start safe story setup", tr: "Güvenli hikâye kurulumuna başla" },
    secondaryCta: { en: "Review story path", tr: "Hikâye yolunu gözden geçir" },
    heroBadge: { en: "Safe cinematic path", tr: "Güvenli sinematik yol" },
    heroMessage: {
      en: "One idea becomes a controlled story world.",
      tr: "Tek fikir kontrollü bir hikâye dünyasına dönüşür.",
    },
    heroSubline: {
      en: "Storyverse keeps the experience calm: define the premise, lock the visual tone, shape characters and move toward exportable scenes.",
      tr: "Storyverse deneyimi sakin tutar: fikri tanımla, görsel tonu sabitle, karakterleri oluştur ve export edilebilir sahnelere ilerle.",
    },
    promise: {
      en: ["Safe idea", "Visual world", "Characters", "Export"],
      tr: ["Güvenli fikir", "Görsel dünya", "Karakterler", "Export"],
    },
    sections: {
      en: [
        { title: "Premise", detail: "Start from a safe, age-aware story idea.", code: "01", action: "Define idea", outcome: "Story premise" },
        { title: "World tone", detail: "Set style, mood, palette and visual boundaries.", code: "02", action: "Lock style", outcome: "Visual bible" },
        { title: "Characters", detail: "Create consistent heroes with safe personalities.", code: "03", action: "Build cast", outcome: "Character cards" },
        { title: "Scenes", detail: "Move into scene visuals, narration and export flow.", code: "04", action: "Prepare scenes", outcome: "Story package" },
      ],
      tr: [
        { title: "Fikir", detail: "Güvenli ve yaşa duyarlı hikâye fikriyle başla.", code: "01", action: "Fikri tanımla", outcome: "Hikâye fikri" },
        { title: "Dünya tonu", detail: "Stil, atmosfer, palet ve görsel sınırları belirle.", code: "02", action: "Stili sabitle", outcome: "Görsel bible" },
        { title: "Karakterler", detail: "Tutarlı ve güvenli kişiliklere sahip karakterler oluştur.", code: "03", action: "Kadroyu kur", outcome: "Karakter kartları" },
        { title: "Sahneler", detail: "Sahne görselleri, anlatım ve export akışına ilerle.", code: "04", action: "Sahneleri hazırla", outcome: "Hikâye paketi" },
      ],
    },
  },
  creatorlab: {
    title: {
      en: "Build a publish-ready creator package.",
      tr: "Yayına hazır creator paketini oluştur.",
    },
    description: {
      en: "A professional production workspace for topics, hooks, scripts, thumbnails, metadata and multi-format content packages.",
      tr: "Konu, hook, script, thumbnail, metadata ve çok formatlı içerik paketleri için profesyonel üretim alanı.",
    },
    primaryCta: { en: "Start production package", tr: "Üretim paketine başla" },
    secondaryCta: { en: "Review pipeline", tr: "Üretim hattını incele" },
    heroBadge: { en: "Creator production engine", tr: "Creator üretim motoru" },
    heroMessage: {
      en: "One topic becomes a complete content system.",
      tr: "Tek konu eksiksiz bir içerik sistemine dönüşür.",
    },
    heroSubline: {
      en: "Define the angle, shape the hook, build the script, prepare thumbnail logic and package the output for platform-specific publishing.",
      tr: "Açıyı belirle, hook’u güçlendir, script’i oluştur, thumbnail mantığını hazırla ve çıktıyı platforma özel yayın paketine dönüştür.",
    },
    promise: {
      en: ["Angle", "Hook", "Script", "Publish pack"],
      tr: ["Açı", "Hook", "Script", "Yayın paketi"],
    },
    sections: {
      en: [
        { title: "Angle", detail: "Position the topic with a clear audience promise.", code: "01", action: "Define angle", outcome: "Creative angle" },
        { title: "Hook", detail: "Design the first seconds for attention and retention.", code: "02", action: "Shape hook", outcome: "Opening hook" },
        { title: "Script", detail: "Turn the idea into a structured production script.", code: "03", action: "Build script", outcome: "Scene script" },
        { title: "Package", detail: "Prepare thumbnail, metadata and platform-ready outputs.", code: "04", action: "Package output", outcome: "Publish pack" },
      ],
      tr: [
        { title: "Açı", detail: "Konuyu net bir izleyici vaadiyle konumlandır.", code: "01", action: "Açıyı belirle", outcome: "Kreatif açı" },
        { title: "Hook", detail: "İlk saniyeleri dikkat ve retention için tasarla.", code: "02", action: "Hook’u şekillendir", outcome: "Açılış hook’u" },
        { title: "Script", detail: "Fikri yapılandırılmış üretim script’ine dönüştür.", code: "03", action: "Script’i oluştur", outcome: "Sahne script’i" },
        { title: "Paket", detail: "Thumbnail, metadata ve platforma hazır çıktıları hazırla.", code: "04", action: "Çıktıyı paketle", outcome: "Yayın paketi" },
      ],
    },
  },
};

const workspaceThemes = {
  storyverse: {
    hero:
      "border-cyan-100/12 bg-[linear-gradient(135deg,rgba(14,116,144,0.18),rgba(30,41,59,0.70)_52%,rgba(99,102,241,0.12))] text-white shadow-[0_24px_90px_rgba(2,6,23,0.22)]",
    badge: "border-cyan-100/14 bg-cyan-300/10 text-cyan-50/78",
    title: "text-white",
    text: "text-slate-200/70",
    promise: "border-white/10 bg-white/[0.06] text-cyan-50/72",
    primaryButton: "bg-white text-slate-950 hover:bg-cyan-50",
    secondaryButton: "border-white/10 bg-white/[0.055] text-slate-100/74 hover:bg-white/[0.10] hover:text-white",
    card: "border-white/10 bg-white/[0.055] text-white shadow-[0_18px_50px_rgba(2,6,23,0.20)]",
    code: "bg-cyan-300/12 text-cyan-50 border border-cyan-100/12",
    cardTitle: "text-white",
    cardText: "text-slate-200/64",
    output: "bg-white/[0.055] text-cyan-50/62 border border-white/8",
    action: "text-cyan-100/72",
  },
  creatorlab: {
    hero:
      "border-orange-200/14 bg-[linear-gradient(135deg,rgba(127,29,29,0.22),rgba(15,23,42,0.76)_48%,rgba(76,29,149,0.20))] text-white shadow-[0_26px_96px_rgba(7,7,17,0.40)]",
    badge: "border-orange-200/16 bg-orange-400/10 text-orange-50/80",
    title: "text-white",
    text: "text-orange-50/66",
    promise: "border-white/10 bg-white/[0.055] text-orange-50/68",
    primaryButton: "bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 text-white hover:from-orange-400 hover:via-rose-500 hover:to-violet-500",
    secondaryButton: "border-white/10 bg-white/[0.055] text-orange-50/74 hover:bg-white/[0.10] hover:text-white",
    card: "border-white/10 bg-white/[0.055] text-white shadow-[0_18px_54px_rgba(7,7,17,0.28)]",
    code: "bg-orange-400/12 text-orange-50 border border-orange-200/12",
    cardTitle: "text-white",
    cardText: "text-orange-50/62",
    output: "bg-white/[0.055] text-orange-50/60 border border-white/8",
    action: "text-orange-100/72",
  },
} as const;

export default function FocusedWorldWorkspace() {
  const { activeWorld } = useWorldState();
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "tr";
  const content = workspaceContent[activeWorld];
  const theme = workspaceThemes[activeWorld];

  return (
    <div id={`${activeWorld}-workspace`} className="scroll-mt-6">
      <WorldShell
        world={activeWorld}
        title={content.title[locale]}
        description={content.description[locale]}
      >
        <div className="space-y-6 md:space-y-8">
          <section className={`relative overflow-hidden rounded-[30px] border p-5 md:rounded-[36px] md:p-8 ${theme.hero}`}>
            <div className={`pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full blur-3xl ${activeWorld === "creatorlab" ? "bg-orange-400/10" : "bg-cyan-300/10"}`} />
            <div className="relative z-10 max-w-3xl space-y-5">
              <div className={`inline-flex rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${theme.badge}`}>
                {content.heroBadge[locale]}
              </div>
              <h2 className={`text-3xl font-black tracking-[-0.035em] md:text-5xl ${theme.title}`}>
                {content.heroMessage[locale]}
              </h2>
              <p className={`text-base font-medium leading-8 md:text-lg ${theme.text}`}>
                {content.heroSubline[locale]}
              </p>
              <div className="flex flex-wrap gap-2">
                {content.promise[locale].map((item) => (
                  <span key={item} className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${theme.promise}`}>
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" className={`rounded-full px-6 py-3.5 text-sm font-black shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${theme.primaryButton}`}>
                  {content.primaryCta[locale]}
                </button>
                <button type="button" className={`rounded-full border px-6 py-3.5 text-sm font-bold shadow-sm transition hover:-translate-y-1 ${theme.secondaryButton}`}>
                  {content.secondaryCta[locale]}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {content.sections[locale].map((section) => (
              <div key={section.title} className={`flex min-h-[220px] flex-col rounded-[26px] border p-5 text-left ${theme.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.10em] ${theme.code}`}>
                    {section.code}
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.10em] ${theme.output}`}>
                    {locale === "en" ? "Output" : "Çıktı"}
                  </div>
                </div>
                <div className={`mt-6 text-xl font-black ${theme.cardTitle}`}>{section.title}</div>
                <div className={`mt-3 text-sm font-medium leading-7 ${theme.cardText}`}>{section.detail}</div>
                <div className="mt-auto pt-6">
                  <div className={`rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] ${theme.output}`}>
                    {section.outcome}
                  </div>
                  <div className={`mt-4 text-sm font-bold ${theme.action}`}>{section.action} →</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </WorldShell>
    </div>
  );
}
