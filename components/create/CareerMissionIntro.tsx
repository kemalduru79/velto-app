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
            <span>{language === "en" ? "Cinematic Mission Intro" : "Sinematik Görev Girişi"}</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span>{atmosphere.briefingFrame}</span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold leading-tight text-white md:text-3xl">
            {missionTitle}
          </h3>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/76 md:text-base">
            {atmosphere.openingLine[language]}
          </p>

          <div className="mt-5 rounded-2xl border border-white/12 bg-black/18 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">
              {language === "en" ? "Mission World" : "Görev Dünyası"}
            </p>
            <div className="mt-3 grid gap-3 text-sm text-white/78 md:grid-cols-2">
              <div>
                <p className="text-white/45">{language === "en" ? "Role" : "Rol"}</p>
                <p className="mt-1 font-semibold text-white">{professionTitle}</p>
              </div>
              <div>
                <p className="text-white/45">{language === "en" ? "Cinematic style" : "Sinematik stil"}</p>
                <p className="mt-1 font-semibold text-white">{atmosphere.cinematicStyle}</p>
              </div>
              <div>
                <p className="text-white/45">{language === "en" ? "Tension profile" : "Gerilim profili"}</p>
                <p className="mt-1 font-semibold text-white">{atmosphere.tensionProfile}</p>
              </div>
              <div>
                <p className="text-white/45">{language === "en" ? "Mentor mode" : "Mentor modu"}</p>
                <p className="mt-1 font-semibold text-white">{atmosphere.mentorStyle}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/58">
              <span>{language === "en" ? "Mission intensity" : "Görev yoğunluğu"}</span>
              <span>{answeredCount}/{totalCount}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, backgroundColor: atmosphere.uiTheme.primary }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-white/54">
              {isComplete
                ? language === "en"
                  ? "Mission complete. The recap layer can now turn this journey into a cinematic memory."
                  : "Görev tamamlandı. Recap katmanı bu yolculuğu sinematik bir anıya dönüştürebilir."
                : language === "en"
                  ? "Every answer changes the emotional profile of the mission."
                  : "Her cevap görevin duygusal profilini değiştirir."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">
              {language === "en" ? "AI Mentor Channel" : "AI Mentor Kanalı"}
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">{mentor.displayName}</h4>
            <p className="mt-2 text-sm leading-6 text-white/70">{mentor.signatureLine[language]}</p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/18 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">
              {language === "en" ? "Briefing" : "Brifing"}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/76">{missionBriefing}</p>
            <p className="mt-3 text-xs leading-5 text-white/62">
              <span className="font-semibold text-white/80">{language === "en" ? "Objective" : "Hedef"}: </span>
              {missionObjective}
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/18 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">
              {language === "en" ? "Atmosphere" : "Atmosfer"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {atmosphere.ambience.map((item) => (
                <span key={item} className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs text-white/70">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
