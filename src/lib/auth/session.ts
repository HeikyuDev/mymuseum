import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { homeForRole, STUDIO_AREA } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import type { MuseumRow, ProfileRow, UserRole } from "@/types/database";

// Server-side authentication and authorization.
//
// - Identity always comes from supabase.auth.getUser(), which validates the JWT
//   with the Auth server. getSession() is never used for decisions.
// - Role and active status come from public.profiles, never from user metadata.
// - Layouts do not re-render on client navigation, so every page and server
//   action calls these helpers itself instead of relying on the layout.

export type AuthState =
  | { status: "anonymous" }
  | { status: "disabled" }
  | { status: "ok"; userId: string; profile: ProfileRow };

export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return { status: "anonymous" };
  if (!profile.is_active) return { status: "disabled" };
  return { status: "ok", userId: data.user.id, profile };
});

/**
 * Requires a signed-in, active user. Disabled accounts are sent to a route
 * handler that clears their session (server components cannot write cookies).
 */
export async function requireUser(): Promise<{ userId: string; profile: ProfileRow }> {
  const auth = await getAuthState();
  if (auth.status === "anonymous") redirect("/login");
  if (auth.status === "disabled") redirect("/login/disabled");
  return auth;
}

/** Requires one specific role; any other signed-in user is sent to their own home. */
export async function requireRole(role: UserRole) {
  const auth = await requireUser();
  if (auth.profile.role !== role) redirect(homeForRole(auth.profile.role));
  return auth;
}

/**
 * The user's only museum (explicit ownership filter on top of RLS). Every user
 * has at most one; the unique index on museums.owner_id enforces it. The
 * ordering and limit only keep databases that have not applied that migration
 * yet from failing on a duplicate row.
 */
export const getOwnMuseum = cache(async (): Promise<MuseumRow | null> => {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("museums")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
});

/** Auth + the user's museum. Sends users without a museum to the onboarding at /studio. */
export async function requireMuseum() {
  const auth = await requireUser();
  const museum = await getOwnMuseum();
  if (!museum) redirect(STUDIO_AREA);
  return { ...auth, museum };
}
