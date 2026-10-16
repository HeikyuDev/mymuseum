import "server-only";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireMuseum } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const fail = (error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } => ({
  ok: false,
  error,
  fieldErrors,
});

/** Every mutation starts here: verified user + role + ownership of the museum. */
export async function getMuseumActionContext() {
  const auth = await requireMuseum();
  const supabase = await createClient();
  return { ...auth, supabase };
}

/** Maps Postgres/PostgREST errors to safe messages (details are logged, never returned). */
export function dbErrorMessage(error: PostgrestError | null | undefined, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  console.error("[admin] database error", error.code, error.message);
  if (error.code === "23505") return "That value is already in use.";
  if (error.code === "42501") return "You do not have permission to do that.";
  if (error.code === "23514") return "One of the values is not allowed.";
  return fallback;
}

/** Deletes Storage objects, restricted to the museum's own folder (RLS also enforces this). */
export async function removeStoredFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  museumId: string,
  paths: (string | null | undefined)[],
) {
  const own = paths.filter((p): p is string => !!p && p.startsWith(`${museumId}/`) && !p.includes(".."));
  if (own.length === 0) return;
  const { error } = await supabase.storage.from("artworks").remove(own);
  if (error) console.error("[admin] storage cleanup failed", error.message);
}

export function revalidateMuseum(slug: string, ...extraSlugs: string[]) {
  revalidatePath("/admin", "layout");
  for (const value of [slug, ...extraSlugs]) revalidatePath(`/m/${value}`);
}
