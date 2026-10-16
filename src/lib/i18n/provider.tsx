"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setLocaleAction } from "./actions";
import { createTranslator, type Locale, type Translator } from "./index";

type I18nValue = {
  locale: Locale;
  t: Translator;
  /** Applies the language immediately; the promise settles once the cookie is stored. */
  setLocale: (locale: Locale) => Promise<void>;
};

const I18nContext = createContext<I18nValue | null>(null);

/** Holds the visitor locale on the client so switching language never reloads the scene. */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    return setLocaleAction(next).catch(() => {
      // The choice still applies for this visit if the cookie could not be stored.
    });
  }, []);

  const value = useMemo<I18nValue>(() => ({ locale, t: createTranslator(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>.");
  return value;
}
