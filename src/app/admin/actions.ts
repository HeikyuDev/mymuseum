"use server";

import { revalidatePath } from "next/cache";
import { fail, failDb, failText, failValidation, type ActionResult } from "@/lib/action-result";
import { accountGuardError, isDeleteConfirmed } from "@/lib/admin/guards";
import { generateTempPassword } from "@/lib/admin/password";
import { getAdminClient, getAdminContext } from "@/lib/admin/server";
import { purgeMuseumFolders } from "@/lib/admin/storage";
import {
  changeEmailSchema,
  createClientSchema,
  updateProfileSchema,
  type CreateClientInput,
} from "@/lib/admin/validation";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { uuidSchema } from "@/lib/validation/schemas";

// All mutations of the platform admin area live here. Every action:
//   1. verifies the session and the super_admin role on the server (never the proxy alone),
//   2. validates its input with Zod,
//   3. applies guard rails against self-lockout,
//   4. uses the service role only for auth.admin.* and Storage cleanup.
// Passwords are never logged, stored or returned except where stated below.
// Clients create their own museum the first time they sign in, so no action
// here creates one.

const BAN_FOREVER = "876000h"; // about 100 years; "none" lifts the ban

type AuthFailure = { code?: string; status?: number } | null | undefined;

function authErrorKey(error: AuthFailure): { key: MessageKey; field?: "email" | "password" } {
  console.error("[admin] auth admin error", error?.code, error?.status);
  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    return { key: "err.emailTaken", field: "email" };
  }
  if (error?.code === "weak_password") return { key: "err.weakPassword", field: "password" };
  if (error?.code === "validation_failed" || error?.code === "email_address_invalid") {
    return { key: "err.emailRejected", field: "email" };
  }
  return { key: "err.authService" };
}

function failAuth(error: AuthFailure) {
  const mapped = authErrorKey(error);
  return fail(mapped.key, mapped.field ? { [mapped.field]: mapped.key } : undefined);
}

function parseId(id: unknown): string | null {
  const parsed = uuidSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Create client
// ---------------------------------------------------------------------------

export type CreatedClient = { userId: string; email: string };

export async function createClientAccount(input: CreateClientInput): Promise<ActionResult<CreatedClient>> {
  await getAdminContext();
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const admin = getAdminClient();
  if (!admin) return fail("err.missingServiceRole");

  const { email, displayName, password } = parsed.data;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Only the display name is read from metadata; the role is never taken from it.
    user_metadata: { display_name: displayName },
  });
  if (error || !created.user) return failAuth(error);
  const userId = created.user.id;

  // The profile row comes from a database trigger; undo the auth user if it is missing.
  const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) {
    const t = await getT();
    const reason = t("err.profileNotCreated");
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[admin] rollback failed", deleteError.code, deleteError.status);
      return failText(t("err.rollbackFailed", { reason, email }));
    }
    return failText(t("err.nothingCreated", { reason }));
  }

  revalidateAdmin();
  return { ok: true, data: { userId, email } };
}

// ---------------------------------------------------------------------------
// Client detail mutations
// ---------------------------------------------------------------------------

export async function updateClientProfile(id: string, input: unknown): Promise<ActionResult> {
  const { supabase } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("err.invalidClient");
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", userId)
    .select("id");
  if (error) return failDb(error);
  if (!data?.length) return fail("err.clientNotFound");
  revalidateAdmin();
  return { ok: true, data: undefined };
}

export async function setClientActive(id: string, active: boolean): Promise<ActionResult<{ warning?: string }>> {
  const { supabase, actorId } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("err.invalidClient");
  const makeActive = active === true;

  const { data: target } = await supabase.from("profiles").select("id, role, is_active").eq("id", userId).maybeSingle();
  if (!target) return fail("err.clientNotFound");

  if (!makeActive) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("is_active", true);
    const problem = accountGuardError({ action: "disable", actorId, target, activeSuperAdmins: count ?? 0 });
    if (problem) return fail(problem);
  }

  const { error } = await supabase.from("profiles").update({ is_active: makeActive }).eq("id", userId);
  if (error) return failDb(error);

  // The app checks is_active on every request. Banning the auth user also
  // blocks sign-in and refresh-token renewal, which ends their sessions.
  const t = await getT();
  let warning: string | undefined;
  const admin = getAdminClient();
  if (!admin) {
    warning = t("warn.sessionsNotRevokedNoKey");
  } else {
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: makeActive ? "none" : BAN_FOREVER,
    });
    if (banError) {
      console.error("[admin] ban update failed", banError.code, banError.status);
      warning = t("warn.sessionsNotRevoked");
    }
  }

  revalidateAdmin();
  return { ok: true, data: { warning } };
}

/** Generates a new temporary password and returns it ONCE for the administrator to hand over. */
export async function resetClientPassword(id: string): Promise<ActionResult<{ email: string; password: string }>> {
  const { supabase } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("err.invalidClient");
  const admin = getAdminClient();
  if (!admin) return fail("err.missingServiceRole");

  const { data: target } = await supabase.from("profiles").select("id, email").eq("id", userId).maybeSingle();
  if (!target) return fail("err.clientNotFound");

  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return failAuth(error);

  return { ok: true, data: { email: target.email, password } };
}

export async function changeClientEmail(id: string, input: unknown): Promise<ActionResult<{ email: string }>> {
  const { supabase } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("err.invalidClient");
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const admin = getAdminClient();
  if (!admin) return fail("err.missingServiceRole");

  const { data: target } = await supabase.from("profiles").select("id, email").eq("id", userId).maybeSingle();
  if (!target) return fail("err.clientNotFound");
  const email = parsed.data.email;
  if (email === target.email.toLowerCase()) return fail("err.sameEmail", { email: "err.sameEmail" });

  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) return failAuth(error);

  // profiles.email mirrors auth.users.email; keep them in sync or undo.
  const { error: profileError } = await supabase.from("profiles").update({ email }).eq("id", userId);
  if (profileError) {
    await admin.auth.admin.updateUserById(userId, { email: target.email, email_confirm: true });
    return failDb(profileError, "err.emailNotChanged");
  }

  revalidateAdmin();
  return { ok: true, data: { email } };
}

export async function deleteClient(id: string, confirmation: string): Promise<ActionResult<{ warning?: string }>> {
  const { supabase, actorId } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("err.invalidClient");
  const admin = getAdminClient();
  if (!admin) return fail("err.missingServiceRole");

  const { data: target } = await supabase.from("profiles").select("id, email, role, is_active").eq("id", userId).maybeSingle();
  if (!target) return fail("err.clientNotFound");
  if (!isDeleteConfirmed(String(confirmation ?? ""), target.email)) {
    return fail("err.confirmationMismatch", { confirmation: "err.typeEmailExactly" });
  }

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("is_active", true);
  const problem = accountGuardError({ action: "delete", actorId, target, activeSuperAdmins: count ?? 0 });
  if (problem) return fail(problem);

  const { data: museums } = await supabase.from("museums").select("id, slug").eq("owner_id", userId);
  const museumList = museums ?? [];

  // Deleting the auth user cascades to profiles -> museums -> halls/artworks.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return failAuth(error);

  // Database rows are gone; remove the files. A failure here only leaves orphans.
  let warning: string | undefined;
  const failed = await purgeMuseumFolders(admin, museumList.map((museum) => museum.id));
  if (failed > 0) warning = (await getT())("warn.filesNotRemoved", { count: failed });

  for (const museum of museumList) revalidatePath(`/m/${museum.slug}`);
  revalidateAdmin();
  return { ok: true, data: { warning } };
}

// ---------------------------------------------------------------------------
// Museums
// ---------------------------------------------------------------------------

export async function forceUnpublishMuseum(id: string): Promise<ActionResult> {
  const { supabase } = await getAdminContext();
  const museumId = parseId(id);
  if (!museumId) return fail("err.invalidMuseum");

  const { data, error } = await supabase
    .from("museums")
    .update({ is_published: false })
    .eq("id", museumId)
    .select("slug");
  if (error) return failDb(error);
  if (!data?.length) return fail("err.museumNotFound");

  revalidatePath(`/m/${data[0].slug}`);
  revalidateAdmin();
  return { ok: true, data: undefined };
}
