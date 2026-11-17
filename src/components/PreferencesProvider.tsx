"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "zh" | "en";
export type Theme = "dark" | "light";

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  landscape: { zh: "风光", en: "Landscape" },
  street: { zh: "人文", en: "Street" },
  architecture: { zh: "建筑", en: "Architecture" },
  portrait: { zh: "人像", en: "Portrait" },
  still: { zh: "静物", en: "Still" },
};

interface PreferencesContextValue {
  locale: Locale;
  theme: Theme;
  toggleLocale: () => void;
  toggleTheme: () => void;
  pick: (zh: string, en?: string | null) => string;
  categoryLabel: (cat: string) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    const savedLocale = localStorage.getItem("gallery-locale") as Locale | null;
    if (savedLocale === "zh" || savedLocale === "en") setLocale(savedLocale);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const savedManual = localStorage.getItem("gallery-theme-manual") as Theme | null;
    const initial: Theme =
      savedManual === "dark" || savedManual === "light"
        ? savedManual
        : mq.matches
        ? "dark"
        : "light";

    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);

    const onSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("gallery-theme-manual")) {
        const sys: Theme = e.matches ? "dark" : "light";
        setTheme(sys);
        document.documentElement.setAttribute("data-theme", sys);
      }
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("gallery-theme-manual", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next = prev === "zh" ? "en" : "zh";
      localStorage.setItem("gallery-locale", next);
      return next;
    });
  }, []);

  const pick = useCallback(
    (zh: string, en?: string | null) => (locale === "en" && en && en.trim() ? en : zh),
    [locale]
  );

  const categoryLabel = useCallback(
    (cat: string) => {
      const found = CATEGORY_LABELS[cat];
      if (!found) return cat;
      return locale === "en" ? found.en : found.zh;
    },
    [locale]
  );

  return (
    <PreferencesContext.Provider value={{ locale, theme, toggleLocale, toggleTheme, pick, categoryLabel }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
