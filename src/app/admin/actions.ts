"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, type ActionResult } from "@/lib/studio/action-utils";
import { accountGuardError, isDeleteConfirmed } from "@/lib/admin/guards";
import { generateTempPassword } from "@/lib/admin/password";
import { getAdminClient, getAdminContext, MISSING_SERVICE_ROLE } from "@/lib/admin/server";
import { purgeMuseumFolders } from "@/lib/admin/storage";
import {
  changeEmailSchema,
  createClientSchema,
  resolveInitialMuseum,
  updateProfileSchema,
  type CreateClientInput,
} from "@/lib/admin/validation";
import { fieldErrorsOf, uuidSchema } from "@/lib/validation/schemas";

// All mutations in the super-admin area live here. Every action:
//   1. verifies the session and the super_admin role on the server (never the proxy alone),
//   2. validates its input with Zod,
//   3. applies guard rails against self-lockout,
//   4. uses the service role only for auth.admin.* and Storage cleanup.
// Passwords are never logged, stored or returned except where stated below.

const BAN_FOREVER = "876000h"; // about 100 years; "none" lifts the ban

type AuthFailure = { code?: string; status?: number } | null | undefined;

function authErrorMessage(error: AuthFailure): { message: string; field?: "email" | "password" } {
  console.error("[admin] auth admin error", error?.code, error?.status);
  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    return { message: "That email is already registered.", field: "email" };
  }
  if (error?.code === "weak_password") return { message: "The password was rejected as too weak.", field: "password" };
  if (error?.code === "validation_failed" || error?.code === "email_address_invalid") {
    return { message: "That email address is not accepted.", field: "email" };
  }
  return { message: "The account service rejected the request. Please try again." };
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

export type CreatedClient = { userId: string; email: string; museumSlug: string | null; warning?: string };

export async function createClientAccount(input: CreateClientInput): Promise<ActionResult<CreatedClient>> {
  const { supabase } = await getAdminContext();
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));
  const admin = getAdminClient();
  if (!admin) return fail(MISSING_SERVICE_ROLE);

  const { email, displayName, password } = parsed.data;
  const museumPlan = resolveInitialMuseum(parsed.data);

  // Fail early (before creating anything) when the address is taken.
  if (museumPlan) {
    const { data: taken } = await supabase.from("museums").select("id").eq("slug", museumPlan.slug).maybeSingle();
    if (taken) return fail("This address is already taken.", { museumSlug: "This address is already taken." });
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Only the display name is read from metadata; the role is never taken from it.
    user_metadata: { display_name: displayName },
  });
  if (error || !created.user) {
    const mapped = authErrorMessage(error);
    return fail(mapped.message, mapped.field ? { [mapped.field]: mapped.message } : undefined);
  }
  const userId = created.user.id;

  // Rolls back the auth user (profile, museums and halls cascade).
  const rollback = async (reason: string): Promise<ActionResult<CreatedClient>> => {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[admin] rollback failed", deleteError.code, deleteError.status);
      return fail(`${reason} The account ${email} was created and could not be removed automatically; delete it from the clients list.`);
    }
    return fail(`${reason} Nothing was created.`);
  };

  const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) return rollback("The profile row was not created by the database trigger.");

  let warning: string | undefined;
  if (museumPlan) {
    const { data: museum, error: museumError } = await admin
      .from("museums")
      .insert({ owner_id: userId, slug: museumPlan.slug, title: museumPlan.title })
      .select("id")
      .single();
    if (museumError || !museum) {
      if (museumError?.code === "23505") return rollback("This museum address is already taken.");
      console.error("[admin] museum insert failed", museumError?.code);
      return rollback("The museum could not be created.");
    }

    const { data: hall } = await admin
      .from("halls")
      .insert({ museum_id: museum.id, name: "Main hall", slug: "main-hall", sort_order: 0 })
      .select("id")
      .single();
    if (hall) {
      await admin.from("museums").update({ default_hall_id: hall.id }).eq("id", museum.id);
    } else {
      warning = "The museum was created without its starter hall; the client can add one.";
    }
  }

  revalidateAdmin();
  return { ok: true, data: { userId, email, museumSlug: museumPlan?.slug ?? null, warning } };
}

// ---------------------------------------------------------------------------
// Client detail mutations
// ---------------------------------------------------------------------------

export async function updateClientProfile(id: string, input: unknown): Promise<ActionResult> {
  const { supabase } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("Invalid client.");
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", userId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Client not found.");
  revalidateAdmin();
  return { ok: true, data: undefined };
}

export async function setClientActive(id: string, active: boolean): Promise<ActionResult<{ warning?: string }>> {
  const { supabase, actorId } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("Invalid client.");
  const makeActive = active === true;

  const { data: target } = await supabase.from("profiles").select("id, role, is_active").eq("id", userId).maybeSingle();
  if (!target) return fail("Client not found.");

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
  if (error) return fail(dbErrorMessage(error));

  // The app checks is_active on every request. Banning the auth user also
  // blocks sign-in and refresh-token renewal, which ends their sessions.
  let warning: string | undefined;
  const admin = getAdminClient();
  if (!admin) {
    warning = "The account was updated, but existing sessions could not be revoked (service role key missing).";
  } else {
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: makeActive ? "none" : BAN_FOREVER,
    });
    if (banError) {
      console.error("[admin] ban update failed", banError.code, banError.status);
      warning = "The account was updated, but existing sessions could not be revoked.";
    }
  }

  revalidateAdmin();
  return { ok: true, data: { warning } };
}

/** Generates a new temporary password and returns it ONCE for the super admin to hand over. */
export async function resetClientPassword(id: string): Promise<ActionResult<{ email: string; password: string }>> {
  const { supabase } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("Invalid client.");
  const admin = getAdminClient();
  if (!admin) return fail(MISSING_SERVICE_ROLE);

  const { data: target } = await supabase.from("profiles").select("id, email").eq("id", userId).maybeSingle();
  if (!target) return fail("Client not found.");

  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return fail(authErrorMessage(error).message);

  return { ok: true, data: { email: target.email, password } };
}

export async function changeClientEmail(id: string, input: unknown): Promise<ActionResult<{ email: string }>> {
  const { supabase } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("Invalid client.");
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));
  const admin = getAdminClient();
  if (!admin) return fail(MISSING_SERVICE_ROLE);

  const { data: target } = await supabase.from("profiles").select("id, email").eq("id", userId).maybeSingle();
  if (!target) return fail("Client not found.");
  const email = parsed.data.email;
  if (email === target.email.toLowerCase()) return fail("That is already the current email.", { email: "That is already the current email." });

  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) {
    const mapped = authErrorMessage(error);
    return fail(mapped.message, mapped.field ? { [mapped.field]: mapped.message } : undefined);
  }

  // profiles.email mirrors auth.users.email; keep them in sync or undo.
  const { error: profileError } = await supabase.from("profiles").update({ email }).eq("id", userId);
  if (profileError) {
    await admin.auth.admin.updateUserById(userId, { email: target.email, email_confirm: true });
    return fail(dbErrorMessage(profileError, "The email could not be changed. Nothing was modified."));
  }

  revalidateAdmin();
  return { ok: true, data: { email } };
}

export async function deleteClient(id: string, confirmation: string): Promise<ActionResult<{ warning?: string }>> {
  const { supabase, actorId } = await getAdminContext();
  const userId = parseId(id);
  if (!userId) return fail("Invalid client.");
  const admin = getAdminClient();
  if (!admin) return fail(MISSING_SERVICE_ROLE);

  const { data: target } = await supabase.from("profiles").select("id, email, role, is_active").eq("id", userId).maybeSingle();
  if (!target) return fail("Client not found.");
  if (!isDeleteConfirmed(String(confirmation ?? ""), target.email)) {
    return fail("The confirmation does not match the client's email.", { confirmation: "Type the client's email exactly." });
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
  if (error) return fail(authErrorMessage(error).message);

  // Database rows are gone; remove the files. A failure here only leaves orphans.
  let warning: string | undefined;
  const failed = await purgeMuseumFolders(admin, museumList.map((museum) => museum.id));
  if (failed > 0) warning = `The client was deleted, but ${failed} stored file(s) could not be removed.`;

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
  if (!museumId) return fail("Invalid museum.");

  const { data, error } = await supabase
    .from("museums")
    .update({ is_published: false })
    .eq("id", museumId)
    .select("slug");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Museum not found.");

  revalidatePath(`/m/${data[0].slug}`);
  revalidateAdmin();
  return { ok: true, data: undefined };
}
