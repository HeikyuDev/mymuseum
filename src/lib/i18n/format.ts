import type { Locale } from "./dictionaries";

// Locale-aware formatting shared by server and client code.

const INTL_TAGS: Record<Locale, string> = { es: "es-AR", en: "en-US" };

/** "15 oct 2026" / "Oct 15, 2026". Dates are shown in UTC so server and browser agree. */
export function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(INTL_TAGS[locale], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Whole numbers with the locale's grouping, e.g. 1.250 / 1,250. */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_TAGS[locale]).format(value);
}
