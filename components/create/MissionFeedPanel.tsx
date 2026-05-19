import { createCareerLiveWorldEvents, type CareerLiveWorldEvent } from "@/lib/career/live-world-events";

type MissionFeedPanelLanguage = "en" | "tr";

type MissionFeedPanelProps = {
  language: MissionFeedPanelLanguage;
  missionTitle: string;
  professionTitle: string;
  mentorName: string;
  childTurnCount: number;
  isMentorTyping: boolean;
  missionIntensity: number;
  latestChildMessage?: string;
};

function getToneClass(tone: CareerLiveWorldEvent["tone"]) {
  if (tone === "alert") {
    return "border-rose-300/35 bg-rose-400/10 text-rose-50";
  }

  if (tone === "crew") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-50";
  }

  if (tone === "mentor") {
    return "border-violet-300/30 bg-violet-300/10 text-violet-50";
  }

  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-50";
}

function getWorldPhase(language: MissionFeedPanelLanguage, childTurnCount: number) {
  if (childTurnCount >= 4) {
    return {
      label: language === "en" ? "Resolution window" : "Çözüm penceresi",
      description:
        language === "en"
          ? "The mission is ready for a decisive identity moment."
          : "Görev belirleyici bir kimlik anına hazır.",
    };
  }

  if (childTurnCount >= 2) {
    return {
      label: language === "en" ? "Pressure rising" : "Baskı yükseliyor",
      description:
        language === "en"
          ? "The world is now adapting to the child’s response pattern."
          : "Dünya artık çocuğun yanıt örüntüsüne göre adapte oluyor.",
    };
  }

  if (childTurnCount >= 1) {
    return {
      label: language === "en" ? "First command received" : "İlk komut alındı",
      description:
        language === "en"
          ? "Crew confidence and system pressure are beginning to shift."
          : "Ekip güveni ve sistem baskısı değişmeye başlıyor.",
    };
  }

  return {
    label: language === "en" ? "Mission opening" : "Görev açılışı",
    description:
      language === "en"
        ? "The world is waiting for the first command."
        : "Dünya ilk komutu bekliyor.",
  };
}

function getAtmospherePulse(language: MissionFeedPanelLanguage, professionTitle: string, childTurnCount: number) {
  const normalizedTitle = professionTitle.toLowerCase();
  const escalation = childTurnCount >= 2;

  if (normalizedTitle.includes("doctor") || normalizedTitle.includes("doktor")) {
    return language === "en"
      ? escalation
        ? "Heartbeat signal rising · triage lights active · care team waiting"
        : "Soft monitor tones · calm medical bay · first priority pending"
      : escalation
        ? "Kalp ritmi yükseliyor · triyaj ışıkları aktif · bakım ekibi bekliyor"
        : "Yumuşak monitör sesleri · sakin medikal alan · ilk öncelik bekleniyor";
  }

  if (normalizedTitle.includes("cyber") || normalizedTitle.includes("detective") || normalizedTitle.includes("dedektif")) {
    return language === "en"
      ? escalation
        ? "Neon trace spike · encrypted anomaly detected · threat grid unstable"
        : "Quiet terminal pulse · encrypted traffic moving · first clue pending"
      : escalation
        ? "Neon iz sıçraması · şifreli anomali algılandı · tehdit ağı kararsız"
        : "Sessiz terminal nabzı · şifreli trafik ilerliyor · ilk ipucu bekleniyor";
  }

  if (normalizedTitle.includes("pilot")) {
    return language === "en"
      ? escalation
        ? "Cockpit alert pulse · route drift detected · control surface active"
        : "Flight deck stable · route map online · first cockpit command pending"
      : escalation
        ? "Kokpit alarm nabzı · rota sapması algılandı · kontrol yüzeyi aktif"
        : "Uçuş kabini stabil · rota haritası açık · ilk kokpit komutu bekleniyor";
  }

  if (normalizedTitle.includes("engineer") || normalizedTitle.includes("mühendis")) {
    return language === "en"
      ? escalation
        ? "Model confidence flicker · ethics layer active · dataset warning visible"
        : "Training stream active · model console waiting · first diagnosis pending"
      : escalation
        ? "Model güveni dalgalanıyor · etik katman aktif · veri uyarısı görünür"
        : "Eğitim akışı aktif · model konsolu bekliyor · ilk teşhis bekleniyor";
  }

  return language === "en"
    ? escalation
      ? "Red oxygen pulse · station hum rising · crew channel tense"
      : "Deep station hum · oxygen channel stable · first command pending"
    : escalation
      ? "Kırmızı oksijen nabzı · istasyon uğultusu yükseliyor · ekip kanalı gergin"
      : "Derin istasyon uğultusu · oksijen kanalı stabil · ilk komut bekleniyor";
}

function getPressureMetrics(language: MissionFeedPanelLanguage, childTurnCount: number, missionIntensity: number) {
  const normalizedIntensity = Math.max(8, Math.min(100, missionIntensity));
  const crewTrust = Math.max(28, Math.min(96, 42 + childTurnCount * 14));
  const systemRisk = Math.max(12, Math.min(92, normalizedIntensity - 6 + childTurnCount * 4));
  const missionFocus = Math.max(36, Math.min(98, 50 + childTurnCount * 11));

  return [
    {
      label: language === "en" ? "Pressure" : "Baskı",
      value: normalizedIntensity,
    },
    {
      label: language === "en" ? "Crew trust" : "Ekip güveni",
      value: crewTrust,
    },
    {
      label: language === "en" ? "Risk" : "Risk",
      value: systemRisk,
    },
    {
      label: language === "en" ? "Focus" : "Odak",
      value: missionFocus,
    },
  ];
}

function getTimelineSteps(language: MissionFeedPanelLanguage, childTurnCount: number) {
  const steps =
    language === "en"
      ? ["Briefing", "First response", "World reaction", "Mentor trust", "Mission memory"]
      : ["Brifing", "İlk yanıt", "Dünya tepkisi", "Mentor güveni", "Görev anısı"];

  return steps.map((label, index) => ({
    label,
    active: childTurnCount >= index,
  }));
}

export default function MissionFeedPanel({
  language,
  missionTitle,
  professionTitle,
  mentorName,
  childTurnCount,
  isMentorTyping,
  missionIntensity,
  latestChildMessage,
}: MissionFeedPanelProps) {
  const events = createCareerLiveWorldEvents({
    language,
    missionTitle,
    professionTitle,
    mentorName,
    childTurnCount,
    isMentorTyping,
    latestChildMessage,
  });

  const priorityEvent = events.find((event) => event.tone === "alert") ?? events[0];
  const pressureMetrics = getPressureMetrics(language, childTurnCount, missionIntensity);
  const worldPhase = getWorldPhase(language, childTurnCount);
  const atmospherePulse = getAtmospherePulse(language, professionTitle, childTurnCount);
  const timelineSteps = getTimelineSteps(language, childTurnCount);

  return (
    <div className="mt-5 overflow-hidden rounded-[32px] border border-cyan-300/20 bg-slate-950 text-white shadow-[0_24px_80px_rgba(8,145,178,0.18)]">
      <div className="border-b border-cyan-300/10 bg-cyan-300/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              {language === "en" ? "Mission Presence Timeline" : "Görev Kontrol Zaman Çizgisi"}
            </p>
            <h4 className="mt-2 text-xl font-semibold">
              {language === "en" ? "The selected role is active" : "Görev dünyası tek sistem gibi hareket ediyor"}
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {language === "en"
                ? "Live state, role-specific world events, mentor trust and pressure signals stay connected inside one presence timeline."
                : "Canlı durum, dünya olayları, mentor güveni ve görev baskısı artık aynı komuta zaman çizgisi içinde yer alıyor."}
            </p>
          </div>

          <div className="min-w-[180px] rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-xs font-semibold text-cyan-100">
            <div className="flex items-center justify-between gap-3">
              <span>{language === "en" ? "Mission intensity" : "Görev yoğunluğu"}</span>
              <span>{missionIntensity}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                style={{ width: `${Math.max(8, Math.min(100, missionIntensity))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-5">
          {timelineSteps.map((step, index) => (
            <div
              key={step.label}
              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                step.active
                  ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-50"
                  : "border-white/10 bg-white/[0.03] text-slate-500"
              }`}
            >
              <span className="mr-2 opacity-60">{index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {language === "en" ? "Role presence state" : "Canlı görev durumu"}
          </p>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {language === "en" ? "World phase" : "Dünya fazı"}
            </p>
            <h5 className="mt-2 text-base font-semibold text-white">{worldPhase.label}</h5>
            <p className="mt-2 text-sm leading-6 text-slate-300">{worldPhase.description}</p>
          </div>

          <div className="mt-3 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-200" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                {language === "en" ? "Atmosphere pulse" : "Atmosfer nabzı"}
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-cyan-50">{atmospherePulse}</p>
          </div>

          {priorityEvent ? (
            <div className="mt-3 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-200" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                  {language === "en" ? "Priority signal" : "Öncelikli sinyal"}
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-amber-50">
                <span className="font-semibold">{priorityEvent.channel}:</span> {priorityEvent.text}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pressureMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-200">
                  <span>{metric.label}</span>
                  <span>{metric.value}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-white/70 transition-all duration-500"
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {language === "en" ? "Role presence events" : "Canlı görev olayları"}
          </p>

          <div className="mt-4 grid gap-3">
            {events.map((event) => (
              <div
                key={event.id}
                className={`rounded-2xl border p-3 transition ${getToneClass(event.tone)} ${
                  event.active ? "opacity-100" : "opacity-45"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      event.active ? "animate-pulse bg-cyan-200" : "bg-slate-500"
                    }`}
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
                    {event.channel}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6">{event.text}</p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] opacity-55">
                  {event.tone === "alert"
                    ? language === "en"
                      ? "Requires attention"
                      : "Dikkat gerektirir"
                    : language === "en"
                      ? "Live signal"
                      : "Canlı sinyal"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
