"use client";

// X.5.4 Clean WorldGateway Rebuild: controlled simplification without mutating object keys.

// X.5.1 Gateway Simplification Pass: calmer visual density and reduced dashboard intensity.
// X.5.2 Minimal Gateway Entry: copy density reduced and entry hierarchy simplified.
// X.5.3 True Entry Layer Pass: gateway language and hierarchy moved closer to a simple choose-your-world entry.

import type { ExperienceFlow } from "@/lib/flows";

type Language = "tr" | "en" | string;

type Props = {
  flows: ExperienceFlow[];
  activeFlowKey: string;
  language: Language;
  onSelectFlow: (flowKey: string) => void;
};

const copy = {
  tr: {
    eyebrow: "VELTO",
    title: "Çocuklar için AI destekli deneyim dünyaları",
    description:
      "Storyverse, Creator Lab ve pilot deneyimler tek bir üretim motorunu paylaşır; fakat her biri ayrı bir dünya gibi hissettirilir.",
    activeProducts: "Aktif Ürünler",
    pilotExperiences: "Pilot Deneyimler",
    roadmap: "Roadmap Deneyimleri",
    activeBadge: "Active",
    pilotBadge: "Pilot",
    comingSoonBadge: "Yakında",
    selected: "Seçili",
    age: "Yaş",
    duration: "Süre",
    minutes: "dk",
    outputs: "Çıktılar",
    zones: "Alanlar",
    currentWorld: "Seçili Dünya",
    productFeel: "Ürün Hissi",
    experienceRole: "Deneyim Rolü",
    nextAction: "Sonraki Aksiyon",
    primaryNote:
      "Ana aksiyon Storyverse üzerinde konumlanır; diğer dünyalar ürünleşme seviyesine göre daha sakin gösterilir.",
    experienceSignal: "Deneyim Sinyali",
    stageMap: "Ürünleşme Haritası",
    activeSignal: "Canlı ürün",
    pilotSignal: "Pilot doğrulama",
    roadmapSignal: "Gelecek vizyonu",
    outputsPreview: "Beklenen çıktı",
    zonesPreview: "Deneyim alanı",
    startHere: "Başlangıç odağı",
    journeyPreview: "Deneyim Yolculuğu",
    identityCompass: "Deneyim Kimliği",
    emotionLayer: "Duygu Katmanı",
    interactionLayer: "Etkileşim Katmanı",
    rewardLayer: "Ödül Katmanı",
    entryMoment: "Giriş Anı",
    creationMoment: "Üretim Anı",
    rewardMoment: "Ödül Anı",
    storyverseEntry: "Karakter ve dünya seçimiyle sinematik hikâyeye giriş",
    storyverseCreation: "Sahne, görsel ve anlatı üretimi",
    storyverseReward: "Çizgi film çıktısı ve paylaşılabilir deneyim",
    creatorEntry: "Popüler fikir ve kısa video formatı seçimi",
    creatorCreation: "Script, thumbnail ve kısa video paketi üretimi",
    creatorReward: "Yayınlamaya hazır creator paketi",
    careerEntry: "Meslek rolü ve ilk görev senaryosu",
    careerCreation: "Karar verme, mentor soruları ve adaptif görevler",
    careerReward: "Gelişim raporu ve career card",
    defaultEntry: "Dünya kimliği ve deneyim vaadi",
    defaultCreation: "AI destekli kişisel üretim akışı",
    defaultReward: "Çocuğa özel çıktı ve paylaşılabilir sonuç",
  },
  en: {
    eyebrow: "VELTO",
    title: "Choose a world",
    description:
      "Start with one calm experience. You can switch worlds anytime.",
    activeProducts: "Start",
    pilotExperiences: "Explore",
    roadmap: "Later",
    activeBadge: "Active",
    pilotBadge: "Pilot",
    comingSoonBadge: "Coming Soon",
    selected: "Your choice",
    age: "Age",
    duration: "Duration",
    minutes: "min",
    outputs: "Outputs",
    zones: "Zones",
    currentWorld: "Your choice",
    productFeel: "Mood",
    experienceRole: "Role",
    nextAction: "Next",
    primaryNote:
      "Pick a world and begin.",
    experienceSignal: "Experience Signal",
    stageMap: "Worlds",
    activeSignal: "Live product",
    pilotSignal: "Pilot validation",
    roadmapSignal: "Future vision",
    outputsPreview: "Output",
    zonesPreview: "Area",
    startHere: "Starting focus",
    journeyPreview: "Experience Journey",
    identityCompass: "Identity",
    emotionLayer: "Emotion",
    interactionLayer: "Action",
    rewardLayer: "Reward",
    entryMoment: "Entry Moment",
    creationMoment: "Creation Moment",
    rewardMoment: "Reward Moment",
    storyverseEntry: "Enter cinematic storytelling through character and world selection",
    storyverseCreation: "Generate scenes, visuals and narrative structure",
    storyverseReward: "Cartoon output and shareable experience",
    creatorEntry: "Choose a popular idea and short video format",
    creatorCreation: "Generate script, thumbnail and short video package",
    creatorReward: "Publish-ready creator package",
    careerEntry: "Select a profession role and first mission scenario",
    careerCreation: "Make decisions, answer mentor questions and receive adaptive challenges",
    careerReward: "Development report and career card",
    defaultEntry: "World identity and experience promise",
    defaultCreation: "AI-supported personal creation flow",
    defaultReward: "Child-specific output and shareable result",
  },
} as const;

const statusStyles = {
  active: {
    section: "border-cyan-300/20 bg-cyan-400/[0.06]",
    badge: "border-cyan-300/30 bg-cyan-400/15 text-cyan-100",
  },
  pilot: {
    section: "border-violet-300/20 bg-violet-400/[0.05]",
    badge: "border-violet-300/30 bg-violet-400/15 text-violet-100",
  },
  coming_soon: {
    section: "border-white/10 bg-white/[0.03]",
    badge: "border-white/10 bg-white/[0.035] text-white/60",
  },
} as const;

const accentGlow: Record<string, string> = {
  cyan: "from-cyan-400/24 via-blue-500/10 to-transparent",
  sky: "from-sky-400/24 via-fuchsia-500/10 to-transparent",
  violet: "from-violet-400/22 via-cyan-500/10 to-transparent",
  emerald: "from-emerald-400/20 via-cyan-500/10 to-transparent",
  pink: "from-pink-400/20 via-violet-500/10 to-transparent",
  amber: "from-amber-300/20 via-orange-500/10 to-transparent",
  orange: "from-orange-400/20 via-rose-500/10 to-transparent",
};

const identityCopy = {
  tr: {
    storyverse: {
      feel: "Büyülü, sinematik, hikâye odaklı",
      role: "Çocuk kendi karakteri ve dünyasıyla çizgi film üretimine girer.",
      action: "Storyverse üretim akışını başlat ve sahne üretimine ilerle.",
    },
    creator_lab: {
      feel: "Enerjik, creator studio, YouTube-native",
      role: "Çocuk kısa video fikrini publish-ready içerik paketine dönüştürür.",
      action: "İçerik fikri seç, script ve thumbnail üretimine ilerle.",
    },
    career_lab: {
      feel: "Fütüristik, mentor destekli, simülasyon hissi",
      role: "Çocuk meslek rolü seçer, görev kararları verir ve gelişim raporu alır.",
      action: "Meslek simülasyonunu başlat ve mentor yönlendirmelerine ilerle.",
    },
    interactive_quest: {
      feel: "Macera, seçimli hikâye, görev haritası",
      role: "Çocuk seçimleriyle ilerleyen kişisel bir görev akışı deneyimler.",
      action: "Pilot akış olarak sakin görünür; ürünleşme sonrası açılır.",
    },
    ai_character: {
      feel: "Kişisel, karakter odaklı, companion hissi",
      role: "Çocuk kendi AI karakterini tasarlar ve güvenli ilk etkileşime hazırlanır.",
      action: "Roadmap alanında görünür kalır; henüz ana akışa alınmaz.",
    },
    thinking_lab: {
      feel: "Zihinsel keşif, problem çözme, rehberli düşünme",
      role: "Çocuk problem çözme sürecini görünür hale getiren çıktı alır.",
      action: "Roadmap alanında konumlanır; ileride cognitive growth ürünü olarak açılır.",
    },
    maker_hybrid: {
      feel: "Fiziksel + dijital hibrit, deneysel, maker odaklı",
      role: "AI fikri fiziksel üretime ve deneyim alanına bağlanır.",
      action: "Roadmap alanında tutulur; fiziksel deneyim altyapısı ile birlikte ele alınır.",
    },
  },
  en: {
    storyverse: {
      feel: "Magical, cinematic, story-first",
      role: "The child enters cartoon production through their own character and world.",
      action: "Start the Storyverse production flow and move into scene generation.",
    },
    creator_lab: {
      feel: "Energetic, creator studio, YouTube-native",
      role: "The child turns a short video idea into a publish-ready content package.",
      action: "Select a content idea and move into script and thumbnail generation.",
    },
    career_lab: {
      feel: "Futuristic, mentor-led, simulation-oriented",
      role: "The child chooses a profession, makes mission decisions and receives a development report.",
      action: "Start the profession simulation and follow the mentor-guided journey.",
    },
    interactive_quest: {
      feel: "Adventure, branching story, quest map",
      role: "The child experiences a personal mission shaped by their choices.",
      action: "Keep it calm as a pilot flow until productization is complete.",
    },
    ai_character: {
      feel: "Personal, character-led, companion-like",
      role: "The child designs an AI character and prepares for safe first interaction.",
      action: "Keep it visible in roadmap; do not promote it into the main flow yet.",
    },
    thinking_lab: {
      feel: "Cognitive exploration, problem solving, guided thinking",
      role: "The child receives an output that makes their problem-solving process visible.",
      action: "Keep it in roadmap as a future cognitive growth product.",
    },
    maker_hybrid: {
      feel: "Physical + digital hybrid, experimental, maker-led",
      role: "The AI-generated idea connects to physical making and experience zones.",
      action: "Keep it in roadmap until the physical experience layer is defined.",
    },
  },
} as const;

function getCopy(language: Language) {
  return String(language).toLowerCase() === "tr" ? copy.tr : copy.en;
}

function getIdentity(flowKey: string, language: Language) {
  const dictionary = String(language).toLowerCase() === "tr" ? identityCopy.tr : identityCopy.en;
  return dictionary[flowKey as keyof typeof dictionary] || dictionary.storyverse;
}

function getStatusLabel(status: ExperienceFlow["status"], language: Language) {
  const t = getCopy(language);

  if (status === "active") return t.activeBadge;
  if (status === "pilot") return t.pilotBadge;
  return t.comingSoonBadge;
}


function getJourneySteps(flowKey: string, language: Language) {
  const t = getCopy(language);

  if (flowKey === "storyverse") {
    return [
      { label: t.entryMoment, text: t.storyverseEntry },
      { label: t.creationMoment, text: t.storyverseCreation },
      { label: t.rewardMoment, text: t.storyverseReward },
    ];
  }

  if (flowKey === "creator_lab") {
    return [
      { label: t.entryMoment, text: t.creatorEntry },
      { label: t.creationMoment, text: t.creatorCreation },
      { label: t.rewardMoment, text: t.creatorReward },
    ];
  }

  if (flowKey === "career_lab") {
    return [
      { label: t.entryMoment, text: t.careerEntry },
      { label: t.creationMoment, text: t.careerCreation },
      { label: t.rewardMoment, text: t.careerReward },
    ];
  }

  return [
    { label: t.entryMoment, text: t.defaultEntry },
    { label: t.creationMoment, text: t.defaultCreation },
    { label: t.rewardMoment, text: t.defaultReward },
  ];
}

function GatewayCard({
  flow,
  active,
  language,
  onSelectFlow,
}: {
  flow: ExperienceFlow;
  active: boolean;
  language: Language;
  onSelectFlow: (flowKey: string) => void;
}) {
  const t = getCopy(language);
  const disabled = flow.status === "coming_soon";
  const isPrimaryStoryverse = flow.key === "storyverse";
  const styles = statusStyles[flow.status];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelectFlow(flow.key)}
      className={`group relative overflow-hidden rounded-[24px] border p-5 text-left transition duration-300 md:p-6 ${styles.section} ${
        active
          ? "scale-[1.01] border-white/30 shadow-[0_0_80px_rgba(56,189,248,0.16)]"
          : "hover:scale-[1.01] hover:border-white/20"
      } ${disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer"} ${
        isPrimaryStoryverse ? "md:col-span-2" : ""
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          accentGlow[flow.accent] || accentGlow.cyan
        } opacity-80 transition duration-300 group-hover:opacity-100`}
      />
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex min-h-full flex-col justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.badge}`}>
              {getStatusLabel(flow.status, language)}
            </span>
            {active ? (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {t.selected}
              </span>
            ) : null}
          </div>

          <h3 className={`${isPrimaryStoryverse ? "mt-6 text-3xl md:text-4xl" : "mt-5 text-2xl"} font-semibold tracking-tight text-white`}>
            {flow.title}
          </h3>
          <p className="mt-2 text-sm font-medium text-white/70">
            {flow.subtitle}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/64 md:text-base">
            {flow.description}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs text-white/70">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              {t.age}: {flow.ageBand}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              {t.duration}: {flow.durationMin} {t.minutes}
            </span>
            {flow.zones.map((zone) => (
              <span key={zone} className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                {zone}
              </span>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {t.outputs}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {flow.outputs.slice(0, 4).map((output) => (
                <span key={output} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/70">
                  {output}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function ExperienceSignalStrip({
  activeFlow,
  flows,
  language,
}: {
  activeFlow: ExperienceFlow;
  flows: ExperienceFlow[];
  language: Language;
}) {
  const t = getCopy(language);
  const activeCount = flows.filter((flow) => flow.status === "active").length;
  const pilotCount = flows.filter((flow) => flow.status === "pilot").length;
  const roadmapCount = flows.filter((flow) => flow.status === "coming_soon").length;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="rounded-[24px] border border-cyan-300/15 bg-cyan-400/[0.07] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
          {t.startHere}
        </p>
        <p className="mt-2 text-sm font-semibold text-white">
          {activeFlow.shortTitle}
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {t.stageMap}
        </p>
        <p className="mt-2 text-sm text-white/75">
          {activeCount} {t.activeSignal} · {pilotCount} {t.pilotSignal} · {roadmapCount} {t.roadmapSignal}
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {t.outputsPreview}
        </p>
        <p className="mt-2 text-sm text-white/75">
          {activeFlow.outputs.slice(0, 2).join(" · ")}
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {t.zonesPreview}
        </p>
        <p className="mt-2 text-sm text-white/75">
          {activeFlow.zones.join(" · ")}
        </p>
      </div>
    </div>
  );
}

function ActiveWorldPanel({
  activeFlow,
  language,
}: {
  activeFlow: ExperienceFlow;
  language: Language;
}) {
  const t = getCopy(language);
  const identity = getIdentity(activeFlow.key, language);
  const styles = statusStyles[activeFlow.status];

  return (
    <aside className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/25 p-5 backdrop-blur-sm md:p-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          accentGlow[activeFlow.accent] || accentGlow.cyan
        } opacity-50`}
      />
      <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {t.currentWorld}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.badge}`}>
              {getStatusLabel(activeFlow.status, language)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {activeFlow.shortTitle}
            </span>
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {activeFlow.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/68 md:text-base">
            {activeFlow.description}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.055] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {t.productFeel}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/78">
              {identity.feel}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.055] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {t.experienceRole}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/78">
              {identity.role}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.055] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {t.nextAction}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/78">
              {identity.action}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}


function IdentityCompass({
  activeFlow,
  language,
}: {
  activeFlow: ExperienceFlow;
  language: Language;
}) {
  const t = getCopy(language);
  const identity = getIdentity(activeFlow.key, language);

  const pillars = [
    {
      label: t.emotionLayer,
      value: identity.feel,
    },
    {
      label: t.interactionLayer,
      value: identity.role,
    },
    {
      label: t.rewardLayer,
      value: activeFlow.outputs.slice(0, 3).join(" · "),
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm md:p-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          accentGlow[activeFlow.accent] || accentGlow.cyan
        } opacity-28`}
      />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {t.identityCompass}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
              {activeFlow.shortTitle}
            </h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-white/65">
            {getStatusLabel(activeFlow.status, language)}
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.label}
              className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                {pillar.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/74">
                {pillar.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function JourneyPreview({
  activeFlow,
  language,
}: {
  activeFlow: ExperienceFlow;
  language: Language;
}) {
  const t = getCopy(language);
  const steps = getJourneySteps(activeFlow.key, language);

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm md:p-6">
      <div
        className={`absolute inset-0 bg-gradient-to-r ${
          accentGlow[activeFlow.accent] || accentGlow.cyan
        } opacity-35`}
      />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {t.journeyPreview}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
              {activeFlow.shortTitle}
            </h3>
          </div>
          <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-semibold text-white/65">
            {activeFlow.durationMin} {t.minutes}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="relative rounded-[24px] border border-white/10 bg-black/20 p-4"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-sm font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                {step.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GatewaySection({
  title,
  flows,
  activeFlowKey,
  language,
  onSelectFlow,
}: {
  title: string;
  flows: ExperienceFlow[];
  activeFlowKey: string;
  language: Language;
  onSelectFlow: (flowKey: string) => void;
}) {
  if (flows.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
          {title}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {flows.map((flow) => (
          <GatewayCard
            key={flow.key}
            flow={flow}
            active={flow.key === activeFlowKey}
            language={language}
            onSelectFlow={onSelectFlow}
          />
        ))}
      </div>
    </section>
  );
}

export default function WorldGateway({
  flows,
  activeFlowKey,
  language,
  onSelectFlow,
}: Props) {
  const t = getCopy(language);
  const activeProducts = flows.filter((flow) => flow.status === "active");
  const pilotExperiences = flows.filter((flow) => flow.status === "pilot");
  const roadmapExperiences = flows.filter((flow) => flow.status === "coming_soon");
  const activeFlow = flows.find((flow) => flow.key === activeFlowKey) || activeProducts[0] || flows[0];

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_34%)]" />
      <div className="relative z-10 space-y-5">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-100/75">
              {t.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-4xl">
              {t.title}
            </h1>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm leading-7 text-white/70 md:text-base">
              {t.description}
            </p>
            <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-100/85">
              {t.primaryNote}
            </p>
          </div>
        </div>

        {activeFlow ? (
          <>
            <ExperienceSignalStrip
              activeFlow={activeFlow}
              flows={flows}
              language={language}
            />
            <ActiveWorldPanel activeFlow={activeFlow} language={language} />
            <IdentityCompass activeFlow={activeFlow} language={language} />
            <JourneyPreview activeFlow={activeFlow} language={language} />
          </>
        ) : null}

        <GatewaySection
          title={t.activeProducts}
          flows={activeProducts}
          activeFlowKey={activeFlowKey}
          language={language}
          onSelectFlow={onSelectFlow}
        />

        <GatewaySection
          title={t.pilotExperiences}
          flows={pilotExperiences}
          activeFlowKey={activeFlowKey}
          language={language}
          onSelectFlow={onSelectFlow}
        />

        <GatewaySection
          title={t.roadmap}
          flows={roadmapExperiences}
          activeFlowKey={activeFlowKey}
          language={language}
          onSelectFlow={onSelectFlow}
        />
      </div>
    </section>
  );
}
