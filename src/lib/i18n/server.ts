import "server-only";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALE_COOKIE, createTranslator, isLocale, type Locale, type MessageKey, type Translator } from "./index";

/** Locale stored in the `lang` cookie, or `null` when the visitor has not chosen one. */
export async function getStoredLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

/** Visitor locale: cookie first, then the provided default (museum default or `es`). */
export async function getLocale(fallback: Locale = DEFAULT_LOCALE): Promise<Locale> {
  return (await getStoredLocale()) ?? fallback;
}

/** Translator for the current request's locale (server components and server actions). */
export async function getT(fallback: Locale = DEFAULT_LOCALE): Promise<Translator> {
  return createTranslator(await getLocale(fallback));
}

/** `generateMetadata` for a page whose title is a single translated key. */
export function titleMetadata(key: MessageKey): () => Promise<Metadata> {
  return async () => ({ title: (await getT())(key) });
}
