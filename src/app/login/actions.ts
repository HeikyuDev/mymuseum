"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

// One generic message for every credential failure (wrong password, unknown
// email, unconfirmed email) so the form never reveals which accounts exist.
const INVALID_CREDENTIALS = "Incorrect email or password.";

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email: rawEmail, password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and your password.", email: rawEmail };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    const transient = error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500);
    return {
      error: transient ? "We could not reach the sign-in service. Please try again." : INVALID_CREDENTIALS,
      email: rawEmail,
    };
  }

  // Role and active status live in profiles, never in user metadata.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "We could not load your account. Please try again.", email: rawEmail };
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account has been disabled. Please contact the administrator.", email: rawEmail };
  }

  const next = safeNextPath(formData.get("next"), profile.role);
  redirect(next ?? homeForRole(profile.role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
