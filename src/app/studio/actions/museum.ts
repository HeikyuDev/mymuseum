"use server";

import { revalidatePath } from "next/cache";
import { fail, failDb, failValidation, type ActionResult } from "@/lib/action-result";
import { getOwnMuseum, requireUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getMuseumActionContext, removeStoredFiles, revalidateMuseum } from "@/lib/studio/action-utils";
import { uniqueViolationTarget } from "@/lib/studio/museum-errors";
import { mergeOverrides } from "@/lib/studio/overrides";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  appearanceSchema,
  defaultLocaleSchema,
  museumCreateSchema,
  museumSettingsSchema,
  type AppearanceInput,
  type MuseumCreateInput,
} from "@/lib/validation/schemas";
import { uniqueHallSlug, validateSlug } from "@/lib/validation/slug";
import { translateCode } from "@/lib/i18n";
import type { Json } from "@/types/database";

export type SlugCheck = { available: boolean; message: string };

/**
 * Live slug availability. RLS hides other owners' unpublished museums, so the
 * lookup uses the service-role client when configured (it only ever returns a
 * boolean). The unique constraint remains the final arbiter on save.
 */
export async function checkSlugAvailability(slug: string): Promise<SlugCheck> {
  const { userId } = await requireUser();
  const t = await getT();
  const value = String(slug ?? "").trim();
  const problem = validateSlug(value);
  if (problem) return { available: false, message: translateCode(t, problem) };

  let owner: string | null | undefined;
  try {
    const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : await createClient();
    const { data } = await client.from("museums").select("owner_id").eq("slug", value).maybeSingle();
    owner = data?.owner_id;
  } catch {
    owner = undefined;
  }
  if (owner && owner !== userId) return { available: false, message: t("slug.taken") };
  return { available: true, message: t("slug.available") };
}

/**
 * Creates the signed-in user's only museum (first-run onboarding) with one
 * starter category. The unique index on museums.owner_id makes "exactly one"
 * a database guarantee, so two tabs racing each other cannot create two.
 */
export async function createMuseum(input: MuseumCreateInput): Promise<ActionResult<{ slug: string }>> {
  const { userId } = await requireUser();
  const parsed = museumCreateSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  if (await getOwnMuseum()) return fail("err.hasMuseum");

  const supabase = await createClient();
  const { categoryName, ...fields } = parsed.data;
  const { data: museum, error } = await supabase
    .from("museums")
    .insert({ owner_id: userId, ...fields })
    .select("id, slug")
    .single();
  if (error || !museum) {
    const target = uniqueViolationTarget(error);
    if (target === "owner") return fail("err.hasMuseum");
    if (target === "slug") return fail("err.slugTaken", { slug: "err.slugTaken" });
    return failDb(error);
  }

  // Start with one category so the owner can upload artworks right away.
  const t = await getT();
  const name = categoryName ?? t("onb.categoryDefault");
  const { data: hall } = await supabase
    .from("halls")
    .insert({ museum_id: museum.id, name, slug: uniqueHallSlug(name, []), sort_order: 0 })
    .select("id")
    .single();
  if (hall) await supabase.from("museums").update({ default_hall_id: hall.id }).eq("id", museum.id).eq("owner_id", userId);

  revalidatePath("/studio", "layout");
  return { ok: true, data: { slug: museum.slug } };
}

export async function updateMuseumSettings(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const parsed = museumSettingsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const { error } = await supabase
    .from("museums")
    .update(parsed.data)
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) {
    if (uniqueViolationTarget(error) === "slug") return fail("err.slugTaken", { slug: "err.slugTaken" });
    return failDb(error);
  }
  revalidateMuseum(parsed.data.slug, museum.slug);
  return { ok: true, data: { slug: parsed.data.slug } };
}

/** Language visitors see first (`theme_overrides.defaultLocale`); other overrides are untouched. */
export async function updateDefaultLocale(input: unknown): Promise<ActionResult> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const parsed = defaultLocaleSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const overrides = mergeOverrides(museum.theme_overrides, { defaultLocale: parsed.data.defaultLocale });
  const { error } = await supabase
    .from("museums")
    .update({ theme_overrides: overrides as unknown as Json })
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) return failDb(error);

  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}

export async function setMuseumPublished(published: boolean): Promise<ActionResult> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const { error } = await supabase
    .from("museums")
    .update({ is_published: published === true })
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) return failDb(error);
  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}

export async function updateAppearance(input: AppearanceInput): Promise<ActionResult> {
  const { supabase, museum, userId } = await getMuseumActionContext();
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const { cover_image_path, default_hall_id, theme_overrides, ...rest } = parsed.data;
  if (cover_image_path && (!cover_image_path.startsWith(`${museum.id}/`) || cover_image_path.includes(".."))) {
    return fail("err.invalidCover");
  }

  if (default_hall_id) {
    const { data: hall } = await supabase
      .from("halls")
      .select("id")
      .eq("id", default_hall_id)
      .eq("museum_id", museum.id)
      .maybeSingle();
    if (!hall) return fail("err.categoryMissing", { default_hall_id: "err.categoryMissing" });
  }

  // The language is edited in Settings: keep whatever is stored when it is not sent.
  const overrides = mergeOverrides(museum.theme_overrides, theme_overrides);
  const { error } = await supabase
    .from("museums")
    .update({ ...rest, theme_overrides: overrides as unknown as Json, cover_image_path, default_hall_id })
    .eq("id", museum.id)
    .eq("owner_id", userId);
  if (error) return failDb(error);

  // Remove a replaced cover file (cover files are never shared with artworks).
  const previous = museum.cover_image_path;
  if (previous && previous !== cover_image_path && previous.split("/")[1]?.startsWith("cover-")) {
    await removeStoredFiles(supabase, museum.id, [previous]);
  }
  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}
