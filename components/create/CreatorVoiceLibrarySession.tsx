"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { CreatorVoiceLibraryTarget } from "./voiceLibraryOperation";
import {
  CREATOR_VOICE_FAVORITES_STORAGE_KEY, CREATOR_VOICE_RECENTS_STORAGE_KEY,
  getVoiceLibraryDisplayMeta, normalizeVoiceLibrarySelection, toVoiceLibrarySelection,
  uniqueVoiceLibraryItems,
  type CreatorVoiceLibrarySelection, type CreatorVoiceLibrarySource, type CreatorVoiceLibraryVoice,
} from "@/lib/creator/voiceLibrary";

export type CreatorVoiceCatalogQuery = Readonly<{
  source: CreatorVoiceLibrarySource; search: string; language: string;
  gender: string; age: string; accent: string; useCase: string; pageToken: string;
}>;
export type CreatorVoiceCatalogPage = {
  voices: CreatorVoiceLibraryVoice[]; hasMore: boolean; nextPageToken: string;
};
export type CreatorVoiceApplyOutcome =
  | { status: "applied"; selection: CreatorVoiceLibrarySelection }
  | { status: "stale" }
  | { status: "error"; message: string };
export type CreatorVoiceLibrarySessionHandle = {
  open: (target: CreatorVoiceLibraryTarget) => void;
  close: () => void;
};
type CreatorVoiceLibraryTab = "available" | "shared" | "favorites" | "recent";
type CreatorVoiceLibrarySessionProps = {
  ref?: Ref<CreatorVoiceLibrarySessionHandle>;
  language: string; uiLanguage: string;
  readCatalog: (query: CreatorVoiceCatalogQuery, signal: AbortSignal) => Promise<CreatorVoiceCatalogPage>;
  getSelection: (target: CreatorVoiceLibraryTarget) => CreatorVoiceLibrarySelection | undefined;
  onApply: (target: CreatorVoiceLibraryTarget, voice: CreatorVoiceLibraryVoice, isSessionActive: () => boolean) => Promise<CreatorVoiceApplyOutcome>;
  onClear: (target: CreatorVoiceLibraryTarget) => boolean;
  onDismiss: (target: CreatorVoiceLibraryTarget) => void;
};

// Transient picker state only. Canonical project/media commands stay in the owner.
export default function CreatorVoiceLibrarySession({ ref, language, uiLanguage, readCatalog, getSelection, onApply, onClear, onDismiss }: CreatorVoiceLibrarySessionProps) {
  // VELTO_VOICE_P1B — embedded provider voice discovery without manual IDs.
  const [voiceLibraryTarget, setVoiceLibraryTarget] = useState<CreatorVoiceLibraryTarget | null>(null);
  const [voiceLibraryTab, setVoiceLibraryTab] = useState<CreatorVoiceLibraryTab>("available");
  const [voiceLibraryVoices, setVoiceLibraryVoices] = useState<CreatorVoiceLibraryVoice[]>([]);
  const [voiceLibraryFavorites, setVoiceLibraryFavorites] = useState<CreatorVoiceLibrarySelection[]>([]);
  const [voiceLibraryRecents, setVoiceLibraryRecents] = useState<CreatorVoiceLibrarySelection[]>([]);
  const [voiceLibrarySearch, setVoiceLibrarySearch] = useState("");
  const [voiceLibraryLanguage, setVoiceLibraryLanguage] = useState("");
  const [voiceLibraryGender, setVoiceLibraryGender] = useState("");
  const [voiceLibraryAge, setVoiceLibraryAge] = useState("");
  const [voiceLibraryAccent, setVoiceLibraryAccent] = useState("");
  const [voiceLibraryUseCase, setVoiceLibraryUseCase] = useState("");
  const [voiceLibraryLoading, setVoiceLibraryLoading] = useState(false);
  const [voiceLibraryApplyingId, setVoiceLibraryApplyingId] = useState("");
  const [voiceLibraryPlayingId, setVoiceLibraryPlayingId] = useState("");
  const [voiceLibraryError, setVoiceLibraryError] = useState("");
  const [voiceLibraryHasMore, setVoiceLibraryHasMore] = useState(false);
  const [voiceLibraryNextPageToken, setVoiceLibraryNextPageToken] = useState("");
  const [voiceLibraryStorageReady, setVoiceLibraryStorageReady] = useState(false);

  const voiceLibraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef(0);
  const requestRef = useRef(0);
  const catalogAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
    try {
      const favoriteValues = JSON.parse(
        window.localStorage.getItem(CREATOR_VOICE_FAVORITES_STORAGE_KEY) || "[]",
      );
      const recentValues = JSON.parse(
        window.localStorage.getItem(CREATOR_VOICE_RECENTS_STORAGE_KEY) || "[]",
      );
      setVoiceLibraryFavorites(
        uniqueVoiceLibraryItems(
          Array.isArray(favoriteValues)
            ? favoriteValues
                .map(normalizeVoiceLibrarySelection)
                .filter((item): item is CreatorVoiceLibrarySelection => Boolean(item))
            : [],
          50,
        ),
      );
      setVoiceLibraryRecents(
        uniqueVoiceLibraryItems(
          Array.isArray(recentValues)
            ? recentValues
                .map(normalizeVoiceLibrarySelection)
                .filter((item): item is CreatorVoiceLibrarySelection => Boolean(item))
            : [],
          20,
        ),
      );
    } catch (storageError) {
      console.warn("Voice library preferences could not be restored.", storageError);
    } finally {
      setVoiceLibraryStorageReady(true);
    }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!voiceLibraryStorageReady || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CREATOR_VOICE_FAVORITES_STORAGE_KEY, JSON.stringify(voiceLibraryFavorites));
    } catch {
      console.warn("Voice library preferences could not be saved.");
    }
  }, [voiceLibraryFavorites, voiceLibraryStorageReady]);

  useEffect(() => {
    if (!voiceLibraryStorageReady || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CREATOR_VOICE_RECENTS_STORAGE_KEY, JSON.stringify(voiceLibraryRecents));
    } catch {
      console.warn("Voice library preferences could not be saved.");
    }
  }, [voiceLibraryRecents, voiceLibraryStorageReady]);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      requestRef.current += 1;
      catalogAbortRef.current?.abort();
      if (voiceLibraryAudioRef.current) {
        voiceLibraryAudioRef.current.pause();
        voiceLibraryAudioRef.current = null;
      }
    };
  }, []);

  const getVoiceLibraryTargetLabel = () => {
    if (!voiceLibraryTarget) return "";
    const labels = {
      project_narrator: uiLanguage === "en" ? "Project narrator" : "Proje anlatıcısı",
      project_dialogue: uiLanguage === "en" ? "Default Character Voice" : "Varsayılan Karakter Sesi",
      scene_narrator: uiLanguage === "en" ? "Scene narrator" : "Sahne anlatıcısı",
      scene_dialogue: uiLanguage === "en" ? "Scene dialogue" : "Sahne diyaloğu",
      character: uiLanguage === "en" ? "Character voice" : "Karakter sesi",
    } as const;
    return labels[voiceLibraryTarget.scope];
  };

  const getVoiceLibraryDisplayedVoices = () => {
    const source =
      voiceLibraryTab === "favorites"
        ? voiceLibraryFavorites
        : voiceLibraryTab === "recent"
          ? voiceLibraryRecents
          : voiceLibraryVoices;
    const search = voiceLibrarySearch.trim().toLocaleLowerCase("en-US");
    return source.filter((voice) => {
      const haystack = [
        voice.name,
        voice.description,
        voice.language,
        voice.locale,
        voice.accent,
        voice.gender,
        voice.age,
        voice.useCase,
        voice.descriptive,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("en-US");
      const matchesSearch = !search || haystack.includes(search);
      const matchesLanguage =
        !voiceLibraryLanguage ||
        !voice.language ||
        `${voice.language} ${voice.locale || ""}`
          .toLocaleLowerCase("en-US")
          .includes(voiceLibraryLanguage.toLocaleLowerCase("en-US"));
      const matchesGender =
        !voiceLibraryGender ||
        !voice.gender ||
        voice.gender.toLocaleLowerCase("en-US").includes(
          voiceLibraryGender.toLocaleLowerCase("en-US"),
        );
      const matchesAge =
        !voiceLibraryAge ||
        !voice.age ||
        voice.age.toLocaleLowerCase("en-US").includes(
          voiceLibraryAge.toLocaleLowerCase("en-US"),
        );
      const matchesAccent =
        !voiceLibraryAccent ||
        !voice.accent ||
        voice.accent.toLocaleLowerCase("en-US").includes(
          voiceLibraryAccent.toLocaleLowerCase("en-US"),
        );
      const matchesUseCase =
        !voiceLibraryUseCase ||
        !voice.useCase ||
        voice.useCase.toLocaleLowerCase("en-US").includes(
          voiceLibraryUseCase.toLocaleLowerCase("en-US"),
        );
      return (
        matchesSearch &&
        matchesLanguage &&
        matchesGender &&
        matchesAge &&
        matchesAccent &&
        matchesUseCase
      );
    });
  };

  const loadCreatorVoiceLibrary = async (
    source: CreatorVoiceLibrarySource,
    append = false,
    pageToken = "",
    overrides?: { language?: string; reset?: boolean },
  ) => {
    catalogAbortRef.current?.abort();
    const controller = new AbortController();
    catalogAbortRef.current = controller;
    const session = sessionRef.current;
    const request = ++requestRef.current;
    setVoiceLibraryLoading(true);
    setVoiceLibraryError("");
    try {
      const data = await readCatalog({
        source, search: overrides?.reset ? "" : voiceLibrarySearch, language: overrides?.language ?? voiceLibraryLanguage,
        gender: overrides?.reset ? "" : voiceLibraryGender, age: overrides?.reset ? "" : voiceLibraryAge, accent: overrides?.reset ? "" : voiceLibraryAccent,
        useCase: overrides?.reset ? "" : voiceLibraryUseCase, pageToken,
      }, controller.signal);
      if (session !== sessionRef.current || request !== requestRef.current || controller.signal.aborted) return;
      const incoming = Array.isArray(data.voices) ? data.voices : [];
      setVoiceLibraryVoices((current) =>
        uniqueVoiceLibraryItems(
          append ? [...current, ...incoming] : incoming,
          100,
        ),
      );
      setVoiceLibraryHasMore(data.hasMore === true);
      setVoiceLibraryNextPageToken(
        typeof data.nextPageToken === "string" ? data.nextPageToken : "",
      );
    } catch (libraryError) {
      if (session !== sessionRef.current || request !== requestRef.current || controller.signal.aborted) return;
      setVoiceLibraryError(
        libraryError instanceof Error
          ? libraryError.message
          : uiLanguage === "en"
            ? "Voice library could not be loaded."
            : "Ses kütüphanesi yüklenemedi.",
      );
    } finally {
      if (session === sessionRef.current && request === requestRef.current) setVoiceLibraryLoading(false);
    }
  };

  const openCreatorVoiceLibrary = (target: CreatorVoiceLibraryTarget) => {
    const session = ++sessionRef.current;
    catalogAbortRef.current?.abort();
    voiceLibraryAudioRef.current?.pause();
    voiceLibraryAudioRef.current = null;
    setVoiceLibraryPlayingId("");
    setVoiceLibraryApplyingId("");
    setVoiceLibraryTarget(target);
    setVoiceLibraryTab("available");
    setVoiceLibrarySearch("");
    setVoiceLibraryLanguage(language);
    setVoiceLibraryGender("");
    setVoiceLibraryAge("");
    setVoiceLibraryAccent("");
    setVoiceLibraryUseCase("");
    setVoiceLibraryVoices([]);
    setVoiceLibraryError("");
    setVoiceLibraryHasMore(false);
    setVoiceLibraryNextPageToken("");
    window.setTimeout(() => {
      if (session === sessionRef.current) void loadCreatorVoiceLibrary("available", false, "", { language, reset: true });
    }, 0);
  };

  const closeCreatorVoiceLibrary = () => {
    sessionRef.current += 1;
    requestRef.current += 1;
    catalogAbortRef.current?.abort();
    catalogAbortRef.current = null;
    if (voiceLibraryTarget) onDismiss(voiceLibraryTarget);
    setVoiceLibraryLoading(false);
    setVoiceLibraryApplyingId("");
    if (voiceLibraryAudioRef.current) {
      voiceLibraryAudioRef.current.pause();
      voiceLibraryAudioRef.current = null;
    }
    setVoiceLibraryPlayingId("");
    setVoiceLibraryTarget(null);
  };

  const previewCreatorVoice = (voice: CreatorVoiceLibraryVoice) => {
    if (!voice.previewUrl) return;
    if (voiceLibraryAudioRef.current) {
      voiceLibraryAudioRef.current.pause();
      voiceLibraryAudioRef.current = null;
    }
    if (voiceLibraryPlayingId === voice.voiceId) {
      setVoiceLibraryPlayingId("");
      return;
    }
    const audio = new Audio(voice.previewUrl);
    voiceLibraryAudioRef.current = audio;
    setVoiceLibraryPlayingId(voice.voiceId);
    audio.onended = () => {
      if (voiceLibraryAudioRef.current !== audio) return;
      setVoiceLibraryPlayingId("");
      voiceLibraryAudioRef.current = null;
    };
    audio.onerror = () => {
      if (voiceLibraryAudioRef.current !== audio) return;
      setVoiceLibraryPlayingId("");
      voiceLibraryAudioRef.current = null;
      setVoiceLibraryError(
        uiLanguage === "en"
          ? "This voice preview could not be played."
          : "Bu ses önizlemesi oynatılamadı.",
      );
    };
    void audio.play().catch(() => audio.onerror?.(new Event("error")));
  };

  const toggleCreatorVoiceFavorite = (voice: CreatorVoiceLibraryVoice) => {
    const exists = voiceLibraryFavorites.some((item) => item.voiceId === voice.voiceId);
    setVoiceLibraryFavorites((current) =>
      exists
        ? current.filter((item) => item.voiceId !== voice.voiceId)
        : uniqueVoiceLibraryItems([toVoiceLibrarySelection(voice), ...current], 50),
    );
  };

  useImperativeHandle(ref, () => ({ open: openCreatorVoiceLibrary, close: closeCreatorVoiceLibrary }));

  const applyCreatorVoiceLibrarySelection = async (voice: CreatorVoiceLibraryVoice) => {
    if (!voiceLibraryTarget || voiceLibraryApplyingId) return;
    const session = sessionRef.current;
    const target = voiceLibraryTarget;
    setVoiceLibraryApplyingId(voice.voiceId);
    setVoiceLibraryError("");
    try {
      const outcome = await onApply(target, voice, () => session === sessionRef.current);
      if (session !== sessionRef.current) return;
      if (outcome.status === "applied") {
        setVoiceLibraryRecents(current => uniqueVoiceLibraryItems([outcome.selection, ...current], 20));
        closeCreatorVoiceLibrary();
      } else if (outcome.status === "error") {
        setVoiceLibraryError(outcome.message);
      } else {
        setVoiceLibraryError(uiLanguage === "en" ? "This voice selection is no longer current. Reopen the voice library." : "Bu ses seçimi artık güncel değil. Ses kütüphanesini yeniden açın.");
      }
    } finally {
      if (session === sessionRef.current) setVoiceLibraryApplyingId("");
    }
  };

  const clearCreatorVoiceLibrarySelection = () => {
    if (voiceLibraryTarget && onClear(voiceLibraryTarget)) closeCreatorVoiceLibrary();
  };

  return (<>
        {voiceLibraryTarget && (
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label={uiLanguage === "en" ? "Voice library" : "Ses kütüphanesi"}
          >
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl sm:rounded-[28px]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700">
                    {getVoiceLibraryTargetLabel()}
                  </span>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {uiLanguage === "en" ? "Choose a voice in Velto Studio" : "Velto Studio içinde ses seç"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {uiLanguage === "en"
                      ? "Search, filter and preview ElevenLabs voices without copying a voice ID. Preview playback does not start generation."
                      : "Voice ID kopyalamadan ElevenLabs seslerini ara, filtrele ve önizle. Önizleme üretimi başlatmaz."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreatorVoiceLibrary}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50"
                  aria-label={uiLanguage === "en" ? "Close voice library" : "Ses kütüphanesini kapat"}
                >
                  ×
                </button>
              </div>

              <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["available", uiLanguage === "en" ? "My & default voices" : "Seslerim ve varsayılanlar"],
                    ["shared", uiLanguage === "en" ? "Explore library" : "Kütüphaneyi keşfet"],
                    ["favorites", uiLanguage === "en" ? "Favorites" : "Favoriler"],
                    ["recent", uiLanguage === "en" ? "Recent" : "Son kullanılanlar"],
                  ] as Array<[CreatorVoiceLibraryTab, string]>).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        requestRef.current += 1;
                        catalogAbortRef.current?.abort();
                        setVoiceLibraryLoading(false);
                        setVoiceLibraryTab(tab);
                        setVoiceLibraryError("");
                        if (tab === "available" || tab === "shared") {
                          setVoiceLibraryVoices([]);
                          setVoiceLibraryHasMore(false);
                          setVoiceLibraryNextPageToken("");
                          void loadCreatorVoiceLibrary(tab);
                        }
                      }}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        voiceLibraryTab === tab
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                  <input
                    value={voiceLibrarySearch}
                    onChange={(event) => setVoiceLibrarySearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (voiceLibraryTab === "available" || voiceLibraryTab === "shared")) {
                        void loadCreatorVoiceLibrary(voiceLibraryTab);
                      }
                    }}
                    placeholder={uiLanguage === "en" ? "Search name or style" : "Ad veya stil ara"}
                    className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-950 sm:col-span-2"
                  />
                  <select
                    value={voiceLibraryLanguage}
                    onChange={(event) => setVoiceLibraryLanguage(event.target.value)}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="">{uiLanguage === "en" ? "All languages" : "Tüm diller"}</option>
                    <option value="tr">Türkçe</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="it">Italiano</option>
                  </select>
                  <select
                    value={voiceLibraryGender}
                    onChange={(event) => setVoiceLibraryGender(event.target.value)}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="">{uiLanguage === "en" ? "All genders" : "Tüm cinsiyetler"}</option>
                    <option value="female">{uiLanguage === "en" ? "Female" : "Kadın"}</option>
                    <option value="male">{uiLanguage === "en" ? "Male" : "Erkek"}</option>
                    <option value="neutral">{uiLanguage === "en" ? "Neutral" : "Nötr"}</option>
                  </select>
                  <select
                    value={voiceLibraryAge}
                    onChange={(event) => setVoiceLibraryAge(event.target.value)}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="">{uiLanguage === "en" ? "All ages" : "Tüm yaşlar"}</option>
                    <option value="young">{uiLanguage === "en" ? "Young" : "Genç"}</option>
                    <option value="middle">{uiLanguage === "en" ? "Middle aged" : "Orta yaş"}</option>
                    <option value="old">{uiLanguage === "en" ? "Mature" : "Olgun"}</option>
                  </select>
                  <input
                    value={voiceLibraryAccent}
                    onChange={(event) => setVoiceLibraryAccent(event.target.value)}
                    placeholder={uiLanguage === "en" ? "Accent" : "Aksan"}
                    className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-950"
                  />
                  <select
                    value={voiceLibraryUseCase}
                    onChange={(event) => setVoiceLibraryUseCase(event.target.value)}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="">{uiLanguage === "en" ? "All styles" : "Tüm stiller"}</option>
                    <option value="narration">{uiLanguage === "en" ? "Narration" : "Anlatım"}</option>
                    <option value="conversational">{uiLanguage === "en" ? "Conversational" : "Sohbet"}</option>
                    <option value="characters">{uiLanguage === "en" ? "Characters" : "Karakter"}</option>
                    <option value="advertisement">{uiLanguage === "en" ? "Commercial" : "Reklam"}</option>
                    <option value="educational">{uiLanguage === "en" ? "Educational" : "Eğitim"}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (voiceLibraryTab === "available" || voiceLibraryTab === "shared") {
                        void loadCreatorVoiceLibrary(voiceLibraryTab);
                      }
                    }}
                    className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={voiceLibraryLoading || voiceLibraryTab === "favorites" || voiceLibraryTab === "recent"}
                  >
                    {voiceLibraryLoading
                      ? uiLanguage === "en" ? "Loading..." : "Yükleniyor..."
                      : uiLanguage === "en" ? "Apply filters" : "Filtreleri uygula"}
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                {getSelection(voiceLibraryTarget) && (
                  <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        {uiLanguage === "en" ? "Current selection" : "Mevcut seçim"}
                      </span>
                      <strong className="mt-1 block text-sm text-emerald-950">
                        {getSelection(voiceLibraryTarget)?.name}
                      </strong>
                      <p className="mt-1 text-xs text-emerald-800">
                        {getVoiceLibraryDisplayMeta(getSelection(voiceLibraryTarget))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearCreatorVoiceLibrarySelection}
                      className="min-h-10 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-semibold text-emerald-800"
                    >
                      {uiLanguage === "en" ? "Use inherited default" : "Devralınan varsayılanı kullan"}
                    </button>
                  </div>
                )}

                {voiceLibraryError && (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    {voiceLibraryError}
                  </div>
                )}

                {voiceLibraryLoading && getVoiceLibraryDisplayedVoices().length === 0 ? (
                  <div className="grid min-h-56 place-items-center text-sm text-slate-500">
                    {uiLanguage === "en" ? "Loading voices..." : "Sesler yükleniyor..."}
                  </div>
                ) : getVoiceLibraryDisplayedVoices().length === 0 ? (
                  <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <strong className="text-sm text-slate-800">
                        {uiLanguage === "en" ? "No matching voices" : "Eşleşen ses bulunamadı"}
                      </strong>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {uiLanguage === "en"
                          ? "Try fewer filters or explore the shared voice library."
                          : "Daha az filtre kullan veya paylaşılan ses kütüphanesini keşfet."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {getVoiceLibraryDisplayedVoices().map((voice) => {
                      const isFavorite = voiceLibraryFavorites.some((item) => item.voiceId === voice.voiceId);
                      return (
                        <article key={`${voice.source}-${voice.voiceId}`} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <strong className="block truncate text-sm text-slate-950">{voice.name}</strong>
                              <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
                                {voice.description || voice.descriptive ||
                                  (uiLanguage === "en" ? "ElevenLabs voice" : "ElevenLabs sesi")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleCreatorVoiceFavorite(voice)}
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-base ${
                                isFavorite
                                  ? "border-amber-300 bg-amber-50 text-amber-600"
                                  : "border-slate-200 bg-white text-slate-400"
                              }`}
                              aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
                            >
                              {isFavorite ? "★" : "☆"}
                            </button>
                          </div>

                          <div className="mt-3 flex min-h-12 flex-wrap content-start gap-1.5">
                            {[voice.language || voice.locale, voice.accent, voice.gender, voice.age, voice.useCase]
                              .filter(Boolean)
                              .slice(0, 5)
                              .map((item) => (
                                <span key={`${voice.voiceId}-${item}`} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                  {item}
                                </span>
                              ))}
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => previewCreatorVoice(voice)}
                              disabled={!voice.previewUrl}
                              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
                            >
                              {voiceLibraryPlayingId === voice.voiceId
                                ? uiLanguage === "en" ? "Stop preview" : "Önizlemeyi durdur"
                                : uiLanguage === "en" ? "Preview" : "Önizle"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void applyCreatorVoiceLibrarySelection(voice)}
                              disabled={Boolean(voiceLibraryApplyingId)}
                              className="min-h-10 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {voiceLibraryApplyingId === voice.voiceId
                                ? uiLanguage === "en" ? "Selecting..." : "Seçiliyor..."
                                : uiLanguage === "en" ? "Use voice" : "Sesi kullan"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {voiceLibraryHasMore && (voiceLibraryTab === "available" || voiceLibraryTab === "shared") && (
                  <button
                    type="button"
                    onClick={() => void loadCreatorVoiceLibrary(voiceLibraryTab, true, voiceLibraryNextPageToken)}
                    disabled={voiceLibraryLoading}
                    className="mx-auto mt-5 block min-h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {voiceLibraryLoading
                      ? uiLanguage === "en" ? "Loading..." : "Yükleniyor..."
                      : uiLanguage === "en" ? "Load more voices" : "Daha fazla ses yükle"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
  </>);
}
