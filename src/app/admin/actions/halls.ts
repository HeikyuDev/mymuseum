"use server";

import { z } from "zod";
import {
  dbErrorMessage,
  fail,
  getMuseumActionContext,
  revalidateMuseum,
  type ActionResult,
} from "@/lib/admin/action-utils";
import {
  fieldErrorsOf,
  hallCreateSchema,
  hallFieldsSchema,
  uuidSchema,
  type HallFieldsInput,
} from "@/lib/validation/schemas";
import { uniqueHallSlug } from "@/lib/validation/slug";
import type { Json } from "@/types/database";

export async function createHall(input: { name: string; description?: string | null }): Promise<ActionResult<{ id: string }>> {
  const { supabase, museum } = await getMuseumActionContext();
  const parsed = hallCreateSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  const { data: existing } = await supabase.from("halls").select("slug, sort_order").eq("museum_id", museum.id);
  const rows = existing ?? [];
  const slug = uniqueHallSlug(parsed.data.name, rows.map((row) => row.slug));
  const sortOrder = rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

  const { data, error } = await supabase
    .from("halls")
    .insert({ museum_id: museum.id, name: parsed.data.name, description: parsed.data.description, slug, sort_order: sortOrder })
    .select("id")
    .single();
  if (error || !data) return fail(dbErrorMessage(error));

  revalidateMuseum(museum.slug);
  return { ok: true, data: { id: data.id } };
}

export async function updateHall(id: string, input: HallFieldsInput): Promise<ActionResult> {
  const { supabase, museum } = await getMuseumActionContext();
  if (!uuidSchema.safeParse(id).success) return fail("Invalid hall.");
  const parsed = hallFieldsSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  const { data, error } = await supabase
    .from("halls")
    .update({ ...parsed.data, decor: parsed.data.decor as Json })
    .eq("id", id)
    .eq("museum_id", museum.id)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Hall not found.");

  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}

export async function setHallVisible(id: string, visible: boolean): Promise<ActionResult> {
  const { supabase, museum } = await getMuseumActionContext();
  if (!uuidSchema.safeParse(id).success) return fail("Invalid hall.");
  const { data, error } = await supabase
    .from("halls")
    .update({ is_visible: visible === true })
    .eq("id", id)
    .eq("museum_id", museum.id)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Hall not found.");
  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}

/** Artworks of a deleted hall stay in the museum as unassigned (ON DELETE SET NULL). */
export async function deleteHall(id: string): Promise<ActionResult> {
  const { supabase, museum } = await getMuseumActionContext();
  if (!uuidSchema.safeParse(id).success) return fail("Invalid hall.");
  const { data, error } = await supabase
    .from("halls")
    .delete()
    .eq("id", id)
    .eq("museum_id", museum.id)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Hall not found.");
  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}

export async function reorderHalls(orderedIds: string[]): Promise<ActionResult> {
  const { supabase, museum } = await getMuseumActionContext();
  const parsed = z.array(uuidSchema).max(500).safeParse(orderedIds);
  if (!parsed.success) return fail("Invalid order.");

  const { data: halls } = await supabase.from("halls").select("id").eq("museum_id", museum.id);
  const known = new Set((halls ?? []).map((hall) => hall.id));
  const ids = parsed.data;
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
    return fail("The hall list changed. Reload the page and try again.");
  }

  const results = await Promise.all(
    ids.map((id, index) => supabase.from("halls").update({ sort_order: index }).eq("id", id).eq("museum_id", museum.id)),
  );
  const failed = results.find((result) => result.error);
  if (failed) return fail(dbErrorMessage(failed.error));

  revalidateMuseum(museum.slug);
  return { ok: true, data: undefined };
}
