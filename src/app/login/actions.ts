"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const t = await getT();
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email: rawEmail, password: formData.get("password") });
  if (!parsed.success) return { error: t("auth.invalidInput"), email: rawEmail };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    const transient = error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500);
    // One generic message for every credential failure (wrong password, unknown
    // email, unconfirmed email) so the form never reveals which accounts exist.
    return { error: transient ? t("auth.unreachable") : t("auth.invalid"), email: rawEmail };
  }

  // Role and active status live in profiles, never in user metadata.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: t("auth.profileMissing"), email: rawEmail };
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: t("auth.disabled"), email: rawEmail };
  }

  const next = safeNextPath(formData.get("next"), profile.role);
  redirect(next ?? homeForRole(profile.role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
