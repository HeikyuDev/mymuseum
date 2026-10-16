import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./index";

/** Locale stored in the `lang` cookie, or `null` when the visitor has not chosen one. */
export async function getStoredLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

/** Visitor locale: cookie first, then the provided default (museum default or `es`). */
export async function getLocale(fallback: Locale = DEFAULT_LOCALE): Promise<Locale> {
  return (await getStoredLocale()) ?? fallback;
}
