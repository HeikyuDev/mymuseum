import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodError } from "zod";
import { translateCode, type MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

// Result type and helpers shared by every server action (studio and platform
// admin). Messages are localized here, on the server, with the language of the
// request (`lang` cookie), so clients only render the strings they receive.

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type Failure = Extract<ActionResult, { ok: false }>;

/** Failure with a localized message and optional per-field messages (keys). */
export async function fail(key: MessageKey, fieldKeys?: Record<string, MessageKey>): Promise<Failure> {
  const t = await getT();
  const fieldErrors = fieldKeys
    ? Object.fromEntries(Object.entries(fieldKeys).map(([field, fieldKey]) => [field, t(fieldKey)]))
    : undefined;
  return { ok: false, error: t(key), fieldErrors };
}

/** Failure whose text is already final (for example a guard message built from several parts). */
export async function failText(message: string, fieldErrors?: Record<string, string>): Promise<Failure> {
  return { ok: false, error: message, fieldErrors };
}

/** Zod issues -> "fix the highlighted fields" plus one localized message per field. */
export async function failValidation(error: ZodError): Promise<Failure> {
  const t = await getT();
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_form";
    // Messages of our own schemas are `val.*` codes; anything else is a built-in Zod message.
    fieldErrors[field] ??= translateCode(t, issue.message.startsWith("val.") ? issue.message : "val.required");
  }
  return { ok: false, error: t("err.fixFields"), fieldErrors };
}

/** Maps Postgres/PostgREST errors to safe localized messages (details are logged, never returned). */
export async function failDb(error: PostgrestError | null | undefined, fallback: MessageKey = "err.generic"): Promise<Failure> {
  if (error) console.error("[action] database error", error.code, error.message);
  switch (error?.code) {
    case "23505":
      return fail("err.duplicate");
    case "42501":
      return fail("err.forbidden");
    case "23514":
      return fail("err.notAllowed");
    default:
      return fail(fallback);
  }
}
