"use client";

// Sprint 0.1 Experience Worlds Reset: product terminology moved from profession-first Career Lab to immersive world packs.
// X11.9 WorldGateway Stabilization Polish: safe copy-value cleanup without object key mutation.

// X11.8A WorldGateway Key Repair Hotfix: restores object keys after copy-only replacement.

// X11.8 WorldGateway Child UX Polish: simplifies remaining world-selection labels for children.

// X.8.4.1 WorldGateway Syntax Recovery Hotfix: clean baseline, safe X8 simplification, no config-object corruption.
// X.8.4.2 Identifier-Safe WorldGateway Hotfix: repaired Preview emoji accidentally inserted into identifiers.
// X.8.5 Flow World Sync Pass: synchronize selected flow with WorldContext activeWorld.
// X.8.5.1 Handle Scope Hotfix: GatewaySection mapping uses local onSelectFlow prop; top-level calls use handleSelectFlow.

// X.7.12 Full Landing Visual Alignment: pastel landing alignment without object-key mutation.
// X.7.12.1 Landing Contrast Hotfix: readable text on light pastel surfaces.
// X.7.12.3 Primary Note Black Render Fix: target primary note render contrast fixed.
// X.7.12.4 Primary Note Contrast Final: removed conflicting cyan text class.
// X.7.13 Landing Readability Alignment: light surface readability polish.
// X.7.14 Dashboard Feeling Removal: immersive playful landing alignment.
// X.7.15 Layout-Level Gateway Transformation: stronger product-home hierarchy and dashboard-stack reduction.
// X.7.16 Gateway Supporting Layer Reduction: secondary landing layers softened and primary adventure selection emphasized.
// X.7.17 Global Color Harmony Pass: warmer playful page atmosphere and softer lower-section backgrounds.

// X.5.4 Clean WorldGateway Rebuild: controlled simplification without mutating object keys.

// X.5.1 Gateway Simplification Pass: calmer visual density and reduced dashboard intensity.
// X.5.2 Minimal Gateway Entry: copy density reduced and entry hierarchy simplified.
// X.5.3 True Entry Layer Pass: gateway language and hierarchy moved closer to a simple choose-your-world entry.

import type { ExperienceFlow } from "@/lib/flows";
import { useWorldState, type ActiveWorld } from "@/components/create/WorldContext";

type Language = "tr" | "en" | string;

type Props = {
  flows: ExperienceFlow[];
  activeFlowKey: string;
  language: Language;
  onSelectFlow: (flowKey: string) => void;
};

const flowKeyToWorld = (flowKey: string): ActiveWorld | null => {
  if (flowKey === "storyverse") {
    return "storyverse";
  }

  if (flowKey === "creator_lab" || flowKey === "creatorlab") {
    return "creatorlab";
  }

  if (
    flowKey === "career_lab" ||
    flowKey === "careerlab" ||
    flowKey === "career" ||
    flowKey === "interactive_quest"
  ) {
    return "careerlab";
  }

  return null;
};

const copy = {
  tr: {
    eyebrow: "VELTO",
    title: "Immersive AI Experience Worlds",
    description:
      "Storyverse ve Creator Lab korunur; yeni deneyimler aynı sinematik motor üzerinde world pack mantığıyla hızla üretilebilir hale gelir.",
    activeProducts: "Aktif Deneyim Motorları",
    pilotExperiences: "Reference World Packs",
    roadmap: "Sonraki World Packs",
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
    experienceRole: "Ne yaparsın",
    nextActivity: "Sonraki adım",
    primaryNote:
      "Yeni yön: çok sayıda ayrı flow değil, aynı engine üzerinde yüksek kaliteli immersive worlds.",
    experienceSignal: "Deneyim Sinyali",
    stageMap: "Deneyim Haritası",
    activeSignal: "Başlamaya hazır",
    pilotSignal: "Sonraki keşif",
    roadmapSignal: "Daha sonra",
    outputsPreview: "Beklenen çıktı",
    zonesPreview: "Deneyim alanı",
    startHere: "Buradan başla",
    journeyPreview: "Dünya Yolculuğu",
    identityCompass: "Dünya",
    emotionLayer: "Hissettirir",
    interactionLayer: "Etkinlik",
    rewardLayer: "Oluşturacağın şey",
    entryMoment: "Başlangıç",
    creationMoment: "Oluşturma",
    rewardMoment: "Sonuç",
    storyverseEntry: "Karakter ve dünya seçimiyle sinematik hikâyeye giriş",
    storyverseCreation: "Sahne, görsel ve anlatı üretimi",
    storyverseReward: "Çizgi film çıktısı ve paylaşılabilir deneyim",
    creatorEntry: "Popüler fikir ve kısa video formatı seçimi",
    creatorCreation: "Script, thumbnail ve kısa video paketi üretimi",
    creatorReward: "Yayınlamaya hazır creator paketi",
    careerEntry: "Dünya sinyali, guide arrival ve atmosfer aktivasyonu",
    careerCreation: "Sahne bazlı keşif, karar anları ve sinematik pacing",
    careerReward: "Experience memory, world log ve collectible artifact",
    defaultEntry: "Dünya kimliği ve deneyim vaadi",
    defaultCreation: "AI destekli kişisel üretim akışı",
    defaultReward: "Çocuğa özel çıktı ve paylaşılabilir sonuç",
  },
  en: {
    eyebrow: "VELTO",
    title: "Immersive AI Experience Worlds",
    description:
      "Storyverse and Creator Lab stay protected; new experiences are created as cinematic world packs on top of the same engine.",
    activeProducts: "Active Engines",
    pilotExperiences: "Reference World Packs",
    roadmap: "Next World Packs",
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
    nextActivity: "Next",
    primaryNote:
      "New direction: fewer separate flows, higher-quality immersive worlds powered by one reusable experience engine.",
    experienceSignal: "Adventure Signal",
    stageMap: "Worlds",
    activeSignal: "Ready to start",
    pilotSignal: "Explore next",
    roadmapSignal: "Coming later",
    outputsPreview: "Output",
    zonesPreview: "Area",
    startHere: "Start here",
    journeyPreview: "What happens next",
    identityCompass: "World",
    emotionLayer: "Feeling",
    interactionLayer: "Activity",
    rewardLayer: "You create",
    entryMoment: "Start",
    creationMoment: "Create",
    rewardMoment: "Make",
    storyverseEntry: "Choose your character and world.",
    storyverseCreation: "Build scenes and story moments.",
    storyverseReward: "Create a story video.",
    creatorEntry: "Choose a popular idea and short video format",
    creatorCreation: "Generate script, thumbnail and short video package",
    creatorReward: "Publish-ready creator package",
    careerEntry: "World signal, guide arrival and atmosphere activation",
    careerCreation: "Scene-based discovery, decision moments and cinematic pacing",
    careerReward: "Experience memory, world log and collectible artifact",
    defaultEntry: "World identity and experience promise",
    defaultCreation: "AI-supported personal creation flow",
    defaultReward: "Child-specific output and shareable result",
  },
} as const;

const statusStyles = {
  active: {
    section: "border-orange-100 bg-cyan-400/[0.06]",
    badge: "border-cyan-300/30 bg-cyan-400/15 text-slate-800",
  },
  pilot: {
    section: "border-violet-300/20 bg-violet-400/[0.05]",
    badge: "border-violet-300/30 bg-violet-400/15 text-violet-100",
  },
  coming_soon: {
    section: "border-orange-100/70 bg-[#fffaf4]/86",
    badge: "border-orange-100/70 bg-[#fffaf4]/86 text-slate-700",
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
      feel: "Sinematik, atmosferik, world-pack odaklı",
      role: "Çocuk bir meslek ekranına değil, yaşayan bir AI deneyim dünyasına girer.",
      action: "Experience Worlds engine açılır; ilk referans dünya Lost Space Signal yönünde konumlanır.",
    },
    interactive_quest: {
      feel: "Gizemli, sinyal tabanlı, keşif odaklı",
      role: "Çocuk terk edilmiş bir istasyondan gelen sinyali takip eder ve hikâyeyi kararlarıyla açığa çıkarır.",
      action: "Reference world pack olarak tutulur; engine doğrulaması için ilk örnek deneyimdir.",
    },
    ai_character: {
      feel: "Sakin, merak uyandıran, su altı keşfi",
      role: "Çocuk sonar ipuçlarını takip eder, bilinmeyen yaşamı gözlemler ve güvenli keşif kararları verir.",
      action: "İkinci world pack olarak aynı engine’in farklı duygu tonunu kanıtlamak için bekletilir.",
    },
    thinking_lab: {
      feel: "Hayal gücü, duygu keşfi, sembolik dünya",
      role: "Çocuk rüya benzeri alanlarda görsel hafızalar ve anlamlı seçimler oluşturur.",
      action: "Roadmap alanında konumlanır; emotional learning world olarak sonra değerlendirilir.",
    },
    maker_hybrid: {
      feel: "Fiziksel + dijital hibrit, maker odaklı",
      role: "AI deneyiminden çıkan artifact fiziksel üretim ve sergileme alanına bağlanır.",
      action: "Physical Experience Lab entegrasyonu için roadmap alanında tutulur.",
    },
  },
  en: {
    storyverse: {
      feel: "Magical, cinematic, story-first",
      role: "Create a character, a world and a story.",
      action: "Start the Storyverse production flow and move into scene generation.",
    },
    creator_lab: {
      feel: "Energetic, creator studio, YouTube-native",
      role: "The child turns a short video idea into a publish-ready content package.",
      action: "Select a content idea and move into script and thumbnail generation.",
    },
    career_lab: {
      feel: "Cinematic, atmospheric, world-pack driven",
      role: "The child enters a living AI experience world instead of a profession screen.",
      action: "Open the Experience Worlds engine; Lost Space Signal becomes the first reference direction.",
    },
    interactive_quest: {
      feel: "Mysterious, signal-led, discovery-first",
      role: "The child follows a signal from an abandoned station and reveals the story through focused decisions.",
      action: "Keep it as the first reference world pack for engine validation.",
    },
    ai_character: {
      feel: "Calm, mysterious, underwater discovery",
      role: "The child follows sonar clues, observes unknown life and makes safe discovery decisions.",
      action: "Keep it as the second world pack to prove a different emotional tone with the same engine.",
    },
    thinking_lab: {
      feel: "Imagination, emotional discovery, symbolic world",
      role: "The child explores dream-like spaces and creates visual memories through meaningful choices.",
      action: "Keep it in roadmap as a future emotional learning world.",
    },
    maker_hybrid: {
      feel: "Physical + digital hybrid, maker-led",
      role: "The AI experience artifact connects to physical making and exhibition.",
      action: "Keep it for the later Physical Experience Lab integration layer.",
    },
  },
} as const;

function getCopy(language: Language) {
  return String(language).toLowerCase() === "tr" ? copy.tr : copy.en;
}

function getWorld(flowKey: string, language: Language) {
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
      className={`group relative overflow-hidden rounded-[44px] border p-9 text-left transition duration-300 md:p-12 ${styles.section} ${
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
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#fffaf4]/86/10 blur-3xl" />

      <div className="relative z-10 flex min-h-full flex-col justify-between gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${styles.badge}`}>
              {getStatusLabel(flow.status, language)}
            </span>
            {active ? (
              <span className="rounded-full border border-white/15 bg-[#fffaf4]/86/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-800">
                {t.selected}
              </span>
            ) : null}
          </div>

          <h3 className={`${isPrimaryStoryverse ? "mt-6 text-4xl md:text-4xl" : "mt-5 text-2xl"} font-bold tracking-tight text-slate-900`}>
            {flow.title}
          </h3>
          <p className="mt-2 text-sm font-normal text-slate-700">
            {flow.subtitle}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-900/64 md:text-base">
            {flow.description}
          </p>
        </div>

        <div className="space-y-12">
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full border border-orange-100/70 bg-[#fffaf4]/86 px-3 py-1">
              {t.age}: {flow.ageBand}
            </span>
            <span className="rounded-full border border-orange-100/70 bg-[#fffaf4]/86 px-3 py-1">
              {t.duration}: {flow.durationMin} {t.minutes}
            </span>
            {flow.zones.map((zone) => (
              <span key={zone} className="rounded-full border border-orange-100/70 bg-[#fffaf4]/86 px-3 py-1">
                {zone}
              </span>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900/45">
              {t.outputs}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {flow.outputs.slice(0, 4).map((output) => (
                <span key={output} className="rounded-xl border border-orange-100/70 bg-[#fffaf4]/86 px-3 py-2 text-xs text-slate-700">
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
      <div className="rounded-[44px] border border-cyan-300/15 bg-cyan-400/[0.07] p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800/55">
          {t.startHere}
        </p>
        <p className="mt-2 text-sm font-normal text-slate-900">
          {activeFlow.shortTitle}
        </p>
      </div>

      <div className="rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900/45">
          {t.stageMap}
        </p>
        <p className="mt-2 text-sm text-slate-900/75">
          {activeCount} {t.activeSignal} · {pilotCount} {t.pilotSignal} · {roadmapCount} {t.roadmapSignal}
        </p>
      </div>

      <div className="rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900/45">
          {t.outputsPreview}
        </p>
        <p className="mt-2 text-sm text-slate-900/75">
          {activeFlow.outputs.slice(0, 2).join(" · ")}
        </p>
      </div>

      <div className="rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900/45">
          {t.zonesPreview}
        </p>
        <p className="mt-2 text-sm text-slate-900/75">
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
  const identity = getWorld(activeFlow.key, language);
  const styles = statusStyles[activeFlow.status];

  return (
    <aside className="relative overflow-hidden rounded-[44px] border border-orange-100/70 bg-black/25 p-9 backdrop-blur-md md:p-12">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          accentGlow[activeFlow.accent] || accentGlow.cyan
        } opacity-50`}
      />
      <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-[#fffaf4]/86/10 blur-3xl" />

      <div className="relative z-10 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900/45">
            {t.currentWorld}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${styles.badge}`}>
              {getStatusLabel(activeFlow.status, language)}
            </span>
            <span className="rounded-full border border-orange-100/70 bg-[#fffaf4]/86 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
              {activeFlow.shortTitle}
            </span>
          </div>
          <h2 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {activeFlow.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-900/68 md:text-base">
            {activeFlow.description}
          </p>
        </div>

        <div className="rounded-[40px] border border-orange-200/50 bg-white/86 p-7 shadow-[0_18px_54px_rgba(251,146,60,0.12)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(251,146,60,0.16)]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            {language === "tr" ? "Oluşturacağın şey" : "What you will make"}
          </p>
          <p className="mt-4 text-xl font-extrabold leading-8 text-slate-900">
            {activeFlow.outputs.slice(0, 3).join(" · ")}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            {identity.action}
          </p>

          <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-orange-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
            <span>{language === "tr" ? "Canlı deneyim" : "Live experience"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}


function WorldCompass({
  activeFlow,
  language,
}: {
  activeFlow: ExperienceFlow;
  language: Language;
}) {
  const t = getCopy(language);
  const identity = getWorld(activeFlow.key, language);

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
    <div className="relative overflow-hidden rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9 backdrop-blur-md md:p-12">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          accentGlow[activeFlow.accent] || accentGlow.cyan
        } opacity-28`}
      />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900/45">
              {t.identityCompass}
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {activeFlow.shortTitle}
            </h3>
          </div>
          <span className="rounded-full border border-orange-100/70 bg-[#fffaf4]/86 px-4 py-2 text-xs font-semibold text-slate-900/65">
            {getStatusLabel(activeFlow.status, language)}
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.label}
              className="rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-900/42">
                {pillar.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-900/74">
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
    <div className="relative overflow-hidden rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9 backdrop-blur-md md:p-12">
      <div
        className={`absolute inset-0 bg-gradient-to-r ${
          accentGlow[activeFlow.accent] || accentGlow.cyan
        } opacity-35`}
      />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900/45">
              {t.journeyPreview}
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {activeFlow.shortTitle}
            </h3>
          </div>
          <div className="rounded-full border border-orange-100/70 bg-black/25 px-4 py-2 text-xs font-semibold text-slate-900/65">
            {activeFlow.durationMin} {t.minutes}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="relative rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-orange-100/70 bg-[#fffaf4]/86/[0.07] text-sm font-normal text-slate-900">
                {index + 1}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-900/45">
                {step.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-900/72">
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
    <section className="space-y-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-normal uppercase tracking-[0.12em] text-slate-900/55">
          {title}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </div>

      <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
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
  const { setActiveWorld } = useWorldState();

  const handleSelectFlow = (flowKey: string) => {
    const targetWorld = flowKeyToWorld(flowKey);

    if (targetWorld) {
      setActiveWorld(targetWorld);
    }

    onSelectFlow(flowKey);
  };

  const activeProducts = flows.filter((flow) => flow.status === "active");
  const pilotExperiences = flows.filter((flow) => flow.status === "pilot");
  const roadmapExperiences = flows.filter((flow) => flow.status === "coming_soon");
  const activeFlow = flows.find((flow) => flow.key === activeFlowKey) || activeProducts[0] || flows[0];

  return (
    <section className="relative overflow-hidden rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_34%)]" />
      <div className="relative z-10 space-y-12">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-100/75">
              {t.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {t.title}
            </h1>
          </div>
          <div className="rounded-[44px] border border-orange-100/70 bg-[#fffaf4]/86 p-9">
            <p className="text-sm leading-7 text-slate-700 md:text-base">
              {t.description}
            </p>
            <p className="mt-5 rounded-[30px] border border-orange-200 bg-orange-50 px-6 py-5 text-base font-bold leading-7 text-slate-950 shadow-[0_18px_55px_rgba(251,146,60,0.13)]">
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
          </>
        ) : null}

        <GatewaySection
          title={t.activeProducts}
          flows={activeProducts}
          activeFlowKey={activeFlowKey}
          language={language}
          onSelectFlow={handleSelectFlow}
        />

        <GatewaySection
          title={t.pilotExperiences}
          flows={pilotExperiences}
          activeFlowKey={activeFlowKey}
          language={language}
          onSelectFlow={handleSelectFlow}
        />

        <GatewaySection
          title={t.roadmap}
          flows={roadmapExperiences}
          activeFlowKey={activeFlowKey}
          language={language}
          onSelectFlow={handleSelectFlow}
        />
      </div>
    </section>
  );
}
