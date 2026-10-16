import { DEFAULT_LOCALE, DICTIONARIES, LOCALES, type Locale, type MessageKey } from "./dictionaries";

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, type Locale, type MessageKey } from "./dictionaries";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Cookie value (or anything else) -> a supported locale, falling back to `fallback`. */
export function resolveLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}

export type TranslateParams = Record<string, string | number>;

/** Typed translator: unknown keys are compile errors, `{name}` placeholders are interpolated. */
export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = DICTIONARIES[locale][key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export type Translator = (key: MessageKey, params?: TranslateParams) => string;

export function createTranslator(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}
