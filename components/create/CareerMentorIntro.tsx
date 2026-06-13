"use client";

import { useMemo, useState } from "react";

import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

type ExperienceBeat = {
  key: string;
  label: {
    en: string;
    tr: string;
  };
  title: {
    en: string;
    tr: string;
  };
  description: {
    en: string;
    tr: string;
  };
};

const cinematicBeats: ExperienceBeat[] = [
  {
    key: "signal",
    label: {
      en: "01 · Signal",
      tr: "01 · Sinyal",
    },
    title: {
      en: "A distant signal wakes up the world.",
      tr: "Uzak bir sinyal dünyayı uyandırır.",
    },
    description: {
      en: "The child does not start from a role card. The experience begins with a living event, a transmission, and a reason to care.",
      tr: "Çocuk bir meslek kartından başlamaz. Deneyim yaşayan bir olay, bir iletim ve merak uyandıran bir sebep ile açılır.",
    },
  },
  {
    key: "guide",
    label: {
      en: "02 · Guide",
      tr: "02 · Rehber",
    },
    title: {
      en: "The AI guide arrives inside the story.",
      tr: "AI rehber hikâyenin içinden gelir.",
    },
    description: {
      en: "The guide is not a chatbot panel. It feels like a companion connected to the world, its atmosphere, and the child’s decisions.",
      tr: "Rehber bir chatbot paneli değildir. Dünyaya, atmosfere ve çocuğun kararlarına bağlı bir yol arkadaşı gibi hissedilir.",
    },
  },
  {
    key: "choice",
    label: {
      en: "03 · Decision",
      tr: "03 · Karar",
    },
    title: {
      en: "One focused choice changes the next beat.",
      tr: "Tek ve net bir karar bir sonraki anı değiştirir.",
    },
    description: {
      en: "The interaction stays simple and meaningful. No quiz feeling, no dashboard overload, no profession checklist.",
      tr: "Etkileşim sade ve anlamlı kalır. Quiz hissi, dashboard kalabalığı ve meslek checklist’i yoktur.",
    },
  },
  {
    key: "memory",
    label: {
      en: "04 · Memory",
      tr: "04 · Hafıza",
    },
    title: {
      en: "The ending becomes a memory artifact.",
      tr: "Bitiş bir deneyim hatırasına dönüşür.",
    },
    description: {
      en: "The child leaves with a signal archive, scene card, discovery log or cinematic memory that can continue later.",
      tr: "Çocuk daha sonra devam edebileceği bir sinyal arşivi, sahne kartı, keşif günlüğü veya sinematik hatıra ile ayrılır.",
    },
  },
];

export default function CareerMentorIntro() {
  const { activeWorld, setActiveWorld } = useWorldState();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const isActive = activeWorld === "careerlab";
  const [activeBeatKey, setActiveBeatKey] = useState("signal");

  const activeBeat = useMemo(
    () => cinematicBeats.find((beat) => beat.key === activeBeatKey) || cinematicBeats[0],
    [activeBeatKey]
  );

  function enterExperience() {
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

  return (
    <section className="relative overflow-hidden rounded-[40px] border border-cyan-300/18 bg-[#020617] text-white shadow-[0_40px_120px_rgba(8,47,73,0.32)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(168,85,247,0.18),transparent_34%),linear-gradient(135deg,rgba(2,6,23,1),rgba(15,23,42,0.96)_42%,rgba(8,47,73,0.88))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
        <div className="absolute left-0 top-[18%] h-px w-full bg-cyan-200" />
        <div className="absolute left-0 top-[48%] h-px w-full bg-cyan-200/70" />
        <div className="absolute left-0 top-[76%] h-px w-full bg-violet-200/70" />
        <div className="absolute left-[18%] top-0 h-full w-px bg-cyan-200/70" />
        <div className="absolute right-[22%] top-0 h-full w-px bg-violet-200/60" />
      </div>

      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-10 h-80 w-80 rounded-full bg-violet-400/18 blur-3xl" />

      <div className="relative z-10 grid gap-8 p-6 md:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
        <div className="flex min-h-[520px] flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
              {isEnglish ? "Immersive AI Experience World" : "Immersive AI Deneyim Dünyası"}
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
              {isEnglish ? "Lost Space Signal" : "Kayıp Uzay Sinyali"}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-cyan-50/78 md:text-lg">
              {isEnglish
                ? "This is no longer a career card flow. The child enters a cinematic AI-guided world where a broken signal, a living guide, and one meaningful decision shape the experience."
                : "Bu artık bir meslek kartı akışı değil. Çocuk; kırık bir sinyalin, yaşayan bir rehberin ve anlamlı tek bir kararın deneyimi şekillendirdiği sinematik bir AI dünyasına girer."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/60">
                  {isEnglish ? "Runtime" : "Runtime"}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {isEnglish ? "Cinematic guided flow" : "Sinematik rehberli akış"}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/60">
                  {isEnglish ? "UI Load" : "UI Yükü"}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {isEnglish ? "Minimal, atmospheric" : "Minimal, atmosferik"}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/60">
                  {isEnglish ? "Emotion" : "Duygu"}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {isEnglish ? "Wonder + safe tension" : "Merak + güvenli gerilim"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={enterExperience}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-200 px-7 py-3 text-sm font-black text-slate-950 shadow-[0_18px_46px_rgba(34,211,238,0.22)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              {isEnglish ? "Enter Experience" : "Deneyime Gir"}
            </button>

            <button
              type="button"
              onClick={() => setActiveBeatKey(activeBeatKey === "signal" ? "guide" : "signal")}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 bg-white/[0.055] px-7 py-3 text-sm font-semibold text-cyan-50 transition hover:-translate-y-0.5 hover:bg-white/[0.09]"
            >
              {isEnglish ? "Preview opening beat" : "Açılış anını göster"}
            </button>

            <div className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-200/14 bg-cyan-300/[0.07] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100/70">
              {isActive ? (isEnglish ? "World active" : "Dünya aktif") : isEnglish ? "Ready" : "Hazır"}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/54 p-5 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.12),transparent_36%)]" />

          <div className="relative z-10">
            <div className="rounded-[28px] border border-cyan-200/14 bg-black/28 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-100/60">
                {isEnglish ? "Experience sequence" : "Deneyim sekansı"}
              </p>

              <div className="mt-5 grid gap-3">
                {cinematicBeats.map((beat) => {
                  const selected = beat.key === activeBeatKey;

                  return (
                    <button
                      key={beat.key}
                      type="button"
                      onClick={() => setActiveBeatKey(beat.key)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        selected
                          ? "border-cyan-200/42 bg-cyan-300/12 shadow-[0_0_28px_rgba(34,211,238,0.12)]"
                          : "border-white/10 bg-white/[0.035] hover:border-cyan-200/24 hover:bg-white/[0.06]"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/54">
                        {beat.label[isEnglish ? "en" : "tr"]}
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {beat.title[isEnglish ? "en" : "tr"]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-100/62">
                {activeBeat.label[isEnglish ? "en" : "tr"]}
              </p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-white">
                {activeBeat.title[isEnglish ? "en" : "tr"]}
              </h3>
              <p className="mt-4 text-sm leading-7 text-cyan-50/76">
                {activeBeat.description[isEnglish ? "en" : "tr"]}
              </p>
            </div>

            <div className="mt-5 rounded-[28px] border border-cyan-200/12 bg-cyan-300/[0.055] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/62">
                {isEnglish ? "Design change" : "Tasarım değişimi"}
              </p>
              <p className="mt-3 text-sm leading-7 text-cyan-50/78">
                {isEnglish
                  ? "The old CareerLab logic remains below as a safety fallback, but the entry experience now speaks the new Immersive Worlds language."
                  : "Eski CareerLab mantığı güvenli geçiş için aşağıda korunur; ancak giriş deneyimi artık yeni Immersive Worlds dilini taşır."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}