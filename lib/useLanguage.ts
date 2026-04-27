"use client";

import { useEffect, useState } from "react";

export type Language = "tr" | "en";

const STORAGE_KEY = "velto-lang";

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>("tr");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "tr" || saved === "en") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return { language, setLanguage };
}