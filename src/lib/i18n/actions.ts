"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./index";

/** Persists the visitor's language choice for a year. Invalid values are ignored. */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
