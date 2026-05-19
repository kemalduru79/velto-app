"use client";

import { useState } from "react";

import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

type CareerMentorProfileCard = {
  role: string;
  icon: string;
  mentor: string;
  focus: string;
  identity: string;
};

const mentorProfiles = {
  en: [
    {
      role: "Astronaut",
      icon: "🚀",
      mentor: "Commander Orion",
      focus: "Calm pressure reading, crew safety, risk sequencing",
      identity: "You are responsible for the crew before the mission objective.",
    },
    {
      role: "Doctor",
      icon: "🩺",
      mentor: "Dr. Lyra",
      focus: "Empathy, prioritization, safe medical reasoning",
      identity: "You protect the patient by staying calm, precise, and humane.",
    },
    {
      role: "Pilot",
      icon: "✈️",
      mentor: "Captain Nova",
      focus: "Situational awareness, sequence discipline, calm command",
      identity: "You keep people safe by controlling speed, altitude, and communication.",
    },
    {
      role: "AI Engineer",
      icon: "🤖",
      mentor: "Mentor Ada",
      focus: "Ethical reasoning, data caution, creative problem solving",
      identity: "You build safe intelligence by asking what the system should never do.",
    },
    {
      role: "Cyber Detective",
      icon: "🕵️‍♂️",
      mentor: "Detective Nyx",
      focus: "Pattern recognition, cautious investigation, digital safety",
      identity: "You follow evidence without frightening the people you are protecting.",
    },
  ],
  tr: [
    {
      role: "Astronot",
      icon: "🚀",
      mentor: "Commander Orion",
      focus: "Sakin baskı yönetimi, ekip güvenliği, risk sıralaması",
      identity: "Görev hedefinden önce ekibin güvenliğinden sorumlusun.",
    },
    {
      role: "Doktor",
      icon: "🩺",
      mentor: "Dr. Lyra",
      focus: "Empati, önceliklendirme, güvenli tıbbi akıl yürütme",
      identity: "Hastayı sakin, dikkatli ve insani kalarak korursun.",
    },
    {
      role: "Pilot",
      icon: "✈️",
      mentor: "Captain Nova",
      focus: "Durumsal farkındalık, sıra disiplini, sakin komuta",
      identity: "Hızı, irtifayı ve iletişimi yöneterek insanları güvende tutarsın.",
    },
    {
      role: "AI Mühendisi",
      icon: "🤖",
      mentor: "Mentor Ada",
      focus: "Etik akıl yürütme, veri dikkati, yaratıcı problem çözme",
      identity: "Güvenli zekâyı, sistemin asla ne yapmaması gerektiğini sorarak kurarsın.",
    },
    {
      role: "Siber Dedektif",
      icon: "🕵️‍♂️",
      mentor: "Detective Nyx",
      focus: "Örüntü tanıma, dikkatli araştırma, dijital güvenlik",
      identity: "Koruduğun insanları korkutmadan kanıtın izini sürersin.",
    },
  ],
} satisfies Record<"en" | "tr", CareerMentorProfileCard[]>;

export default function CareerMentorIntro() {
  const { activeWorld, setActiveWorld } = useWorldState();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [showMentors, setShowMentors] = useState(false);

  const isActive = activeWorld === "careerlab";
  const mentors = mentorProfiles[isEnglish ? "en" : "tr"];

  function scrollToCareerLab() {
    setActiveWorld("careerlab");

    window.requestAnimationFrame(() => {
      const target = document.getElementById("careerlab-workspace");

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  function handleMeetMentor() {
    setShowMentors((current) => !current);
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[34px] border p-5 transition-all duration-500 md:p-6 ${
        isActive
          ? "border-teal-300 bg-gradient-to-br from-emerald-50 via-cyan-50 to-lime-50 shadow-[0_28px_86px_rgba(20,184,166,0.14)]"
          : "border-teal-100/70 bg-white/72 opacity-80 shadow-[0_12px_38px_rgba(20,184,166,0.06)] hover:opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/70 blur-3xl" />

      <div className="relative z-10 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-teal-800">
            {isEnglish ? "AI Future Missions" : "AI Gelecek Görevleri"}
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] text-slate-700">
            {isActive ? (isEnglish ? "Selected" : "Seçili") : isEnglish ? "Explore" : "Keşfet"}
          </div>
        </div>

        <div className="space-y-3">
          <h2
            className={`font-extrabold tracking-tight text-slate-950 transition-all duration-500 ${
              isActive ? "text-2xl sm:text-3xl md:text-5xl" : "text-xl sm:text-2xl md:text-3xl"
            }`}
          >
            {isEnglish ? "Step Into a Future Role" : "Gelecekteki Rolüne Gir"}
          </h2>

          <p
            className={`max-w-2xl leading-8 text-slate-700 ${
              isActive ? "text-base md:text-lg" : "line-clamp-3 text-sm md:line-clamp-2 md:text-base"
            }`}
          >
            {isEnglish
              ? "Enter a cinematic mission, transmit decisions through a live command channel, and discover how you think under pressure with your AI mentor."
              : "Sinematik bir göreve gir, kararlarını canlı komut kanalından ilet ve AI mentorunla baskı altında nasıl düşündüğünü keşfet."}
          </p>
        </div>

        {isActive ? (
          <div className="rounded-[22px] border border-orange-200/55 bg-white/78 p-4 shadow-[0_12px_35px_rgba(251,146,60,0.08)] sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              <span>{isEnglish ? "Mission Path" : "Görev Yolu"}</span>
            </div>

            <div className="mt-3 text-base leading-7 text-slate-700">
              {isEnglish
                ? "Choose your future role below. Start Mission now takes you directly to the live Career Lab workspace."
                : "Aşağıdan gelecekteki rolünü seç. Start Mission seni doğrudan canlı Career Lab çalışma alanına götürür."}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
          <div>~35 min</div>
          <div className="text-slate-500">•</div>
          <div>{isEnglish ? "Age 9–15" : "Yaş 9–15"}</div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={scrollToCareerLab}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-teal-500 bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3 text-sm font-black text-white shadow-[0_14px_36px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:from-teal-700 hover:to-emerald-700 hover:shadow-[0_20px_46px_rgba(15,23,42,0.18)] sm:px-7 sm:py-3.5"
          >
            {isEnglish ? "Start Mission" : "Görevi Başlat"}
          </button>

          <button
            type="button"
            onClick={handleMeetMentor}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-teal-200 bg-white px-5 py-3 text-sm font-medium text-teal-800 opacity-90 transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50"
          >
            {showMentors
              ? isEnglish
                ? "Hide Mentor Roster"
                : "Mentorları Gizle"
              : isEnglish
                ? "Meet Your Mentor"
                : "Mentorunu Tanı"}
          </button>
        </div>

        {showMentors ? (
          <div className="rounded-[28px] border border-teal-200/70 bg-white/82 p-4 shadow-[0_18px_55px_rgba(20,184,166,0.10)]">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">
                  {isEnglish ? "Career Mentor Roster" : "Career Mentor Ekibi"}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-950">
                  {isEnglish ? "Each role has its own mentor signal" : "Her rolün kendi mentor sinyali var"}
                </h3>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-600">
                {isEnglish
                  ? "When the child selects a profession, the live mission channel uses that role’s mentor identity, focus and pressure language."
                  : "Çocuk bir meslek seçtiğinde canlı görev kanalı o role ait mentor kimliği, odak alanı ve baskı diliyle açılır."}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {mentors.map((mentor) => (
                <div
                  key={mentor.role}
                  className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/60 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-xl">
                      {mentor.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">{mentor.role}</p>
                      <p className="mt-1 text-sm font-semibold text-teal-700">{mentor.mentor}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {isEnglish ? "Mentor focus" : "Mentor odağı"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{mentor.focus}</p>
                  <p className="mt-3 rounded-2xl border border-teal-100 bg-white/70 p-3 text-sm leading-6 text-slate-700">
                    {mentor.identity}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
