"use server";

import { revalidatePath } from "next/cache";
import {
  dbErrorMessage,
  fail,
  getMuseumActionContext,
  removeStoredFiles,
  revalidateMuseum,
  type ActionResult,
} from "@/lib/studio/action-utils";
import { getOwnMuseum, requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  appearanceSchema,
  fieldErrorsOf,
  museumCreateSchema,
  museumSettingsSchema,
  type AppearanceInput,
  type MuseumCreateInput,
} from "@/lib/validation/schemas";
import { validateSlug } from "@/lib/validation/slug";
import type { Json } from "@/types/database";

export type SlugCheck = { available: boolean; message: string };

/**
 * Live slug availability. RLS hides other owners' unpublished museums, so the
 * lookup uses the service-role client when configured (it only ever returns a
 * boolean). The unique constraint remains the final arbiter on save.
 */
export async function checkSlugAvailability(slug: string): Promise<SlugCheck> {
  const { userId } = await requireUser();
  const value = String(slug ?? "").trim();
  const problem = validateSlug(value);
  if (problem) return { available: false, message: problem };

  let owner: string | null | undefined;
  try {
    const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : await createClient();
    const { data } = await client.from("museums").select("owner_id").eq("slug", value).maybeSingle();
    owner = data?.owner_id;
  } catch {
    owner = undefined;
  }
  if (owner && owner !== userId) return { available: false, message: "This address is already taken." };
  return { available: true, message: "This address is available." };
}

export async function createMuseum(input: MuseumCreateInput): Promise<ActionResult<{ slug: string }>> {
  const { userId } = await requireUser();
  const parsed = museumCreateSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  if (await getOwnMuseum()) return fail("You already have a museum.");

  const supabase = await createClient();
  const { data: museum, error } = await supabase
    .from("museums")
    .insert({ owner_id: userId, ...parsed.data })
    .select("id, slug")
    .single();
  if (error || !museum) {
    if (error?.code === "23505") return fail("This address is already taken.", { slug: "This address is already taken." });
    return fail(dbErrorMessage(error));
  }

  // Start with one hall so the owner can upload artworks right away.
  const { data: hall } = await supabase
    .from("halls")
    .insert({ museum_id: museum.id, name: "Main hall", slug: "main-hall", sort_order: 0 })
    .select("id")
    .single();
  if (hall) await supabase.from("museums").update({ default_hall_id: hall.id }).eq("id", museum.id).eq("owner_id", userId);

  revalidatePath("/studio", "layout");
  return { ok: true, data: { slug: museum.slug } };
}

export async function updateMuseumSettings(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const parsed = museumSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  const { error } = await supabase
    .from("museums")
    .update(parsed.data)
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) {
    if (error.code === "23505") return fail("This address is already taken.", { slug: "This address is already taken." });
    return fail(dbErrorMessage(error));
  }
  revalidateMuseum(parsed.data.slug, museum.slug);
  return { ok: true, data: { slug: parsed.data.slug } };
}

export async function setMuseumPublished(published: boolean): Promise<ActionResult> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const { error } = await supabase
    .from("museums")
    .update({ is_published: published === true })
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) return fail(dbErrorMessage(error));
  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}

export async function updateAppearance(input: AppearanceInput): Promise<ActionResult> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  const { cover_image_path, default_hall_id, ...rest } = parsed.data;
  if (cover_image_path && (!cover_image_path.startsWith(`${museum.id}/`) || cover_image_path.includes(".."))) {
    return fail("Invalid cover image.");
  }

  if (default_hall_id) {
    const { data: hall } = await supabase
      .from("halls")
      .select("id")
      .eq("id", default_hall_id)
      .eq("museum_id", museum.id)
      .maybeSingle();
    if (!hall) return fail("That hall does not exist.", { default_hall_id: "That hall does not exist." });
  }

  const { error } = await supabase
    .from("museums")
    .update({ ...rest, theme_overrides: rest.theme_overrides as Json, cover_image_path, default_hall_id })
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) return fail(dbErrorMessage(error));

  // Remove a replaced cover file (cover files are never shared with artworks).
  const previous = museum.cover_image_path;
  if (previous && previous !== cover_image_path && previous.split("/")[1]?.startsWith("cover-")) {
    await removeStoredFiles(supabase, museum.id, [previous]);
  }
  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}
