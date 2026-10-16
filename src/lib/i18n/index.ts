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

/**
 * Pure validation helpers return message codes instead of text so the same check
 * can be shown in any language: "key" or "key:value" (the value fills {n}).
 */
export function translateCode(t: Translator, code: string): string {
  // Anything that is not shaped like a code (for example an already localized sentence) passes through.
  if (!/^[a-z]+\.\w+(:|$)/.test(code)) return code;
  const separator = code.indexOf(":");
  if (separator === -1) return t(code as MessageKey);
  return t(code.slice(0, separator) as MessageKey, { n: code.slice(separator + 1) });
}
