"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type PublicProject = {
  id: string;
  title: string;
  language: "tr" | "en";
  story_premise?: string;
  characters?: any[];
  scenes?: any[];
  published_at?: string;
};

function formatPublishedDate(value?: string) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function PublicEpisodePage() {
  const params = useParams();
  const shareId = params?.shareId as string;

  const [project, setProject] = useState<PublicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const sceneRefs = useRef<Array<HTMLElement | null>>([]);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadPublicProject = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/public-project/${shareId}`);
        const data = await res.json();

        if (!res.ok || !data.success || !data.project) {
          throw new Error(data?.error || "Public episode yüklenemedi.");
        }

        setProject(data.project);
      } catch (e: any) {
        setError(e?.message || "Public episode yüklenirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      loadPublicProject();
    }
  }, [shareId]);

  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, []);

  const scenes = useMemo(
    () => (Array.isArray(project?.scenes) ? project?.scenes || [] : []),
    [project]
  );

  const characters = useMemo(
    () => (Array.isArray(project?.characters) ? project?.characters || [] : []),
    [project]
  );

  const readyVideoScenes = scenes.filter((scene) => scene?.videoUrl);
  const readyImageScenes = scenes.filter((scene) => scene?.image);
  const firstVideoScene = readyVideoScenes[0] || null;
  const firstImageScene = readyImageScenes[0] || null;
  const heroScene = firstVideoScene || firstImageScene || scenes[0] || null;
  const publishedDate = formatPublishedDate(project?.published_at);

  const scrollToScene = (index: number) => {
    const target = sceneRefs.current[index];

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    setActiveSceneIndex(index);
  };

  const handlePlayStory = () => {
    if (!scenes.length) {
      return;
    }

    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    setIsPlayingStory(true);
    setActiveSceneIndex(0);
    scrollToScene(0);

    let nextIndex = 1;

    playTimerRef.current = setInterval(() => {
      if (nextIndex >= scenes.length) {
        if (playTimerRef.current) {
          clearInterval(playTimerRef.current);
          playTimerRef.current = null;
        }

        setIsPlayingStory(false);
        return;
      }

      scrollToScene(nextIndex);
      nextIndex += 1;
    }, 3200);
  };

  const handleStopStory = () => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    setIsPlayingStory(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] p-8 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          Episode yükleniyor...
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-[#050816] p-8 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-100">
          {error || "Episode bulunamadı."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_32%),linear-gradient(180deg,_#050816_0%,_#020617_45%,_#000000_100%)] px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.05] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6 p-6 md:p-8 lg:p-10">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100">
                  Storyverse Experience
                </span>
                <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-purple-100">
                  Public Episode
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-cyan-100/90">
                  Çocuğunuzun AI destekli hikaye üretim deneyimi
                </p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
                  {project.title || "Untitled Episode"}
                </h1>
                {project.story_premise && (
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                    {project.story_premise}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePlayStory}
                  disabled={!scenes.length || isPlayingStory}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ▶ Hikayeyi Oynat
                </button>

                {isPlayingStory && (
                  <button
                    onClick={handleStopStory}
                    className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Durdur
                  </button>
                )}

                {firstVideoScene?.videoUrl && (
                  <a
                    href={firstVideoScene.videoUrl}
                    target="_blank"
                    className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    Videoyu Aç
                  </a>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Karakter</p>
                  <p className="mt-2 text-2xl font-semibold">{characters.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Sahne</p>
                  <p className="mt-2 text-2xl font-semibold">{scenes.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Görsel</p>
                  <p className="mt-2 text-2xl font-semibold">{readyImageScenes.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">Video</p>
                  <p className="mt-2 text-2xl font-semibold">{readyVideoScenes.length}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                <p className="font-semibold text-white">
                  Bu bölüm Storyverse ile oluşturuldu.
                </p>
                <p className="mt-1">
                  Hikaye, karakterler ve sahneler AI destekli üretim akışıyla hazırlanmıştır.
                  {publishedDate ? ` Yayın tarihi: ${publishedDate}.` : ""}
                </p>
              </div>
            </div>

            <div className="relative min-h-[360px] border-t border-white/10 bg-black/30 lg:border-l lg:border-t-0">
              {heroScene?.videoUrl ? (
                <video
                  src={heroScene.videoUrl}
                  controls
                  poster={heroScene.image || undefined}
                  className="h-full min-h-[360px] w-full object-cover"
                />
              ) : heroScene?.image ? (
                <img
                  src={heroScene.image}
                  alt={project.title || "Storyverse episode"}
                  className="h-full min-h-[360px] w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[360px] items-center justify-center p-8 text-center text-slate-400">
                  Henüz görsel veya video içeriği bulunmuyor.
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">
                  Powered by VELTO
                </p>
              </div>
            </div>
          </div>
        </section>

        {characters.length > 0 && (
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-purple-200">
                  Character Showcase
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Hikayenin Karakterleri</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                Storyverse, karakterleri tekrar kullanılabilir bir çizgi film evreni gibi ele alır.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character, index) => (
                <article
                  key={`${character?.name || "character"}-${index}`}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-black/20"
                >
                  {character?.referenceImage && (
                    <img
                      src={character.referenceImage}
                      alt={character?.name || "Character"}
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  <div className="p-5">
                    <h3 className="text-xl font-semibold">
                      {character?.name || "Karakter"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {character?.age || "Yaş bilgisi yok"}
                    </p>
                    {character?.personality && (
                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        {character.personality}
                      </p>
                    )}
                    {character?.outfit && (
                      <p className="mt-3 text-xs text-slate-500">
                        Kostüm: {character.outfit}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">
                Episode Flow
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Sahne Deneyimi</h2>
            </div>

            {isPlayingStory && (
              <p className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
                Oynatılıyor: Sahne {activeSceneIndex + 1}
              </p>
            )}
          </div>

          <div className="mt-6 space-y-6">
            {scenes.map((scene, index) => (
              <article
                key={scene?.id || index}
                ref={(element) => {
                  sceneRefs.current[index] = element;
                }}
                className={`overflow-hidden rounded-3xl border bg-black/20 transition ${
                  activeSceneIndex === index && isPlayingStory
                    ? "border-cyan-300/60 shadow-[0_0_50px_rgba(34,211,238,0.18)]"
                    : "border-white/10"
                }`}
              >
                <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="bg-black/30">
                    {scene?.videoUrl ? (
                      <video
                        src={scene.videoUrl}
                        controls
                        poster={scene.image || undefined}
                        className="h-full min-h-[260px] w-full object-cover"
                      />
                    ) : scene?.image ? (
                      <img
                        src={scene.image}
                        alt={`Scene ${index + 1}`}
                        className="h-full min-h-[260px] w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[260px] items-center justify-center p-6 text-center text-slate-500">
                        Görsel bekleniyor
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-5 md:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        Sahne {scene?.id || index + 1}
                      </span>
                      {scene?.emotion && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {scene.emotion}
                        </span>
                      )}
                    </div>

                    {scene?.text && (
                      <p className="text-base leading-7 text-slate-200">
                        {scene.text}
                      </p>
                    )}

                    {scene?.narration && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Anlatıcı
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {scene.narration}
                        </p>
                      </div>
                    )}

                    {scene?.dialogue && (
                      <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-purple-200">
                          Diyalog
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-purple-50">
                          {scene.dialogue}
                        </p>
                      </div>
                    )}

                    {(scene?.cameraDirection || scene?.motionHint) && (
                      <div className="grid gap-3 text-xs text-slate-400 md:grid-cols-2">
                        {scene?.cameraDirection && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            Kamera: {scene.cameraDirection}
                          </div>
                        )}
                        {scene?.motionHint && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            Hareket: {scene.motionHint}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">
            Powered by VELTO
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Storyverse Experience — AI destekli hikaye, karakter ve sahne üretimi.
          </p>
        </footer>
      </div>
    </main>
  );
}
