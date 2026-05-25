import { getCareerWorldAtmosphere } from "@/lib/career/career-worlds";
import { getCareerMentorForWorld } from "@/lib/career/mentor-personalities";

type CareerMissionIntroProps = {
  professionKey: string;
  professionTitle: string;
  missionTitle: string;
  missionBriefing: string;
  missionObjective: string;
  language: "en" | "tr";
  answeredCount: number;
  totalCount: number;
  isComplete: boolean;
};

function getWorldSignals(professionKey: string, language: "en" | "tr") {
  const signals: Record<string, { tr: string[]; en: string[] }> = {
    astronaut: {
      tr: ["İstasyon rölesi açık", "Ekip sakin bir ilk komut bekliyor", "Uyarı sesi arka planda devam ediyor"],
      en: ["Station relay open", "The crew is waiting for a calm first command", "The warning tone continues in the background"],
    },
    doctor: {
      tr: ["Acil kanal açık", "Ekip öncelik sinyali bekliyor", "Hasta akışı hızlanıyor"],
      en: ["Emergency channel open", "The team is waiting for a priority signal", "Patient flow is accelerating"],
    },
    pilot: {
      tr: ["Kule hattı açık", "Kokpit ilk yönlendirmeyi bekliyor", "Hava koşulları değişiyor"],
      en: ["Tower line open", "The cockpit is waiting for first direction", "Weather conditions are shifting"],
    },
    "ai-engineer": {
      tr: ["Model izleme hattı açık", "Ekip güvenli karar penceresi bekliyor", "Beklenmeyen çıktılar izleniyor"],
      en: ["Model monitoring line open", "The team is waiting for a safe decision window", "Unexpected outputs are being tracked"],
    },
    cyber_detective: {
      tr: ["Olay müdahale hattı açık", "Kanıt akışı izleniyor", "İlk doğrulama sinyali bekleniyor"],
      en: ["Incident response line open", "Evidence flow is being monitored", "First verification signal is expected"],
    },
    "cyber-detective": {
      tr: ["Olay müdahale hattı açık", "Kanıt akışı izleniyor", "İlk doğrulama sinyali bekleniyor"],
      en: ["Incident response line open", "Evidence flow is being monitored", "First verification signal is expected"],
    },
  };

  return signals[professionKey]?.[language] ?? signals.astronaut[language];
}

export default function CareerMissionIntro({
  professionKey,
  professionTitle,
  missionTitle,
  missionBriefing,
  missionObjective,
  language,
  answeredCount,
  totalCount,
  isComplete,
}: CareerMissionIntroProps) {
  const atmosphere = getCareerWorldAtmosphere(professionKey);
  const mentor = getCareerMentorForWorld(professionKey);
  const progressPercent = totalCount > 0 ? Math.min((answeredCount / totalCount) * 100, 100) : 0;
  const worldSignals = getWorldSignals(professionKey, language);

  return (
    <div
      className="relative overflow-hidden rounded-[32px] border border-white/70 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] md:p-6"
      style={{ boxShadow: `0 24px 80px ${atmosphere.uiTheme.glow}` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(circle at top left, ${atmosphere.uiTheme.surface}, transparent 34%), radial-gradient(circle at bottom right, ${atmosphere.uiTheme.glow}, transparent 36%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.95))`,
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ backgroundColor: atmosphere.uiTheme.glow }} />
      <div className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full blur-3xl" style={{ backgroundColor: atmosphere.uiTheme.surface }} />

      <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            <span>{language === "en" ? "Incoming mission relay" : "Canlı görev aktarımı"}</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span>{language === "en" ? "Command channel open" : "Komut kanalı açık"}</span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold leading-tight text-white md:text-3xl">
            {missionTitle}
          </h3>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/76 md:text-base">
            {atmosphere.openingLine[language]}
          </p>

          <div className="mt-5 rounded-2xl border border-white/12 bg-black/18 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">
              {language === "en" ? "You are now connected as" : "Canlı kanaldaki rolün"}
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{professionTitle}</p>
            <p className="mt-3 text-sm leading-6 text-white/68">
              {language === "en"
                ? "The world is already moving. Your first signal should calm the room before it tries to solve everything."
                : "Dünya zaten hareket halinde. İlk sinyalin her şeyi çözmeye çalışmadan önce ortamı sakinleştirmeli."}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-4">
            <div className="flex items-center justify-between gap-3 text-xs text-cyan-50/70">
              <span>{language === "en" ? "Mission presence" : "Görev varlığı"}</span>
              <span>{answeredCount > 0 ? `${Math.min(progressPercent, 100).toFixed(0)}%` : language === "en" ? "standby" : "beklemede"}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, backgroundColor: atmosphere.uiTheme.primary }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-cyan-50/62">
              {isComplete
                ? language === "en"
                  ? "Mission relay complete. The archive can now preserve this experience as a cinematic memory."
                  : "Görev aktarımı tamamlandı. Arşiv bu deneyimi sinematik bir anı olarak koruyabilir."
                : language === "en"
                  ? "The archive stays in the background. Stay inside the mission."
                  : "Arşiv arka planda kalır. Görevin içinde kal."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">
              {language === "en" ? "Mentor channel" : "Mentor kanalı"}
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">{mentor.displayName}</h4>
            <p className="mt-2 text-sm leading-6 text-white/70">{mentor.signatureLine[language]}</p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/18 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">
              {language === "en" ? "Live briefing" : "Canlı brifing"}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/76">{missionBriefing}</p>
            <p className="mt-3 text-xs leading-5 text-white/62">
              <span className="font-semibold text-white/80">{language === "en" ? "Mission pull" : "Görev çekimi"}: </span>
              {missionObjective}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200/15 bg-emerald-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
              {language === "en" ? "Signals already active" : "Aktif sinyaller"}
            </p>
            <div className="mt-3 space-y-2">
              {worldSignals.map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs leading-5 text-emerald-50/78">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
