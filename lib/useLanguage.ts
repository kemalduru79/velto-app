"use client";

import { useCallback, useEffect, useState } from "react";

export type Language = "tr" | "en";

const STORAGE_KEY = "velto-lang";
const LANGUAGE_EVENT = "velto:language-changed";
const DEFAULT_LANGUAGE: Language = "tr";

function isLanguage(value: unknown): value is Language {
  return value === "tr" || value === "en";
}

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

function applyDocumentLanguage(language: Language) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const storedLanguage = readStoredLanguage();
    setLanguageState(storedLanguage);
    applyDocumentLanguage(storedLanguage);

    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<Language>).detail;
      if (!isLanguage(nextLanguage)) return;

      setLanguageState(nextLanguage);
      applyDocumentLanguage(nextLanguage);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isLanguage(event.newValue)) return;

      setLanguageState(event.newValue);
      applyDocumentLanguage(event.newValue);
    };

    window.addEventListener(LANGUAGE_EVENT, handleLanguageChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LANGUAGE_EVENT, handleLanguageChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    applyDocumentLanguage(nextLanguage);
    window.dispatchEvent(
      new CustomEvent<Language>(LANGUAGE_EVENT, { detail: nextLanguage }),
    );
  }, []);

  return { language, setLanguage };
}
