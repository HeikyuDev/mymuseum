"use server";

import { z } from "zod";
import { fail, failDb, failValidation, type ActionResult } from "@/lib/action-result";
import { getMuseumActionContext, removeStoredFiles, revalidateMuseum } from "@/lib/studio/action-utils";
import { HALL_DEFAULTS } from "@/lib/hall-style";
import {
  artworkCreateSchema,
  artworkFieldsSchema,
  uuidSchema,
  type ArtworkFieldsInput,
} from "@/lib/validation/schemas";
import type { ArtworkRow, FrameStyle } from "@/types/database";

type Context = Awaited<ReturnType<typeof getMuseumActionContext>>;

const NOT_NULL_VIOLATION = "23502";

async function assertHallInMuseum(ctx: Context, hallId: string | null): Promise<boolean> {
  if (!hallId) return true;
  const { data } = await ctx.supabase
    .from("halls")
    .select("id")
    .eq("id", hallId)
    .eq("museum_id", ctx.museum.id)
    .maybeSingle();
  return !!data;
}

/** Next free sort_order at the end of a hall (or of the unassigned list). */
async function nextSortOrder(ctx: Context, hallId: string | null): Promise<number> {
  let query = ctx.supabase
    .from("artworks")
    .select("sort_order")
    .eq("museum_id", ctx.museum.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  query = hallId ? query.eq("hall_id", hallId) : query.is("hall_id", null);
  const { data } = await query;
  return (data?.[0]?.sort_order ?? -1) + 1;
}

async function hallFrameDefault(ctx: Context, hallId: string | null): Promise<FrameStyle> {
  if (!hallId) return HALL_DEFAULTS.frameStyle;
  const { data } = await ctx.supabase.from("halls").select("default_frame_style").eq("id", hallId).maybeSingle();
  return data?.default_frame_style ?? HALL_DEFAULTS.frameStyle;
}

/**
 * Registers artworks whose files the browser already uploaded to Storage.
 * Rows are created with frame_style = null so they inherit the hall's default
 * frame style. Databases that have not run migration 20261017000000 still have
 * frame_style NOT NULL; there the hall's current default is stored explicitly.
 */
export async function createArtworks(
  items: z.input<typeof artworkCreateSchema>[],
): Promise<ActionResult<{ ids: string[] }>> {
  const ctx = await getMuseumActionContext();
  const parsed = z.array(artworkCreateSchema).min(1).max(50).safeParse(items);
  if (!parsed.success) return fail("err.invalidArtworkData");

  const prefix = `${ctx.museum.id}/`;
  for (const item of parsed.data) {
    if (!item.image_path.startsWith(prefix) || item.image_path.includes("..")) {
      return fail("err.outsideFolder");
    }
    if (!(await assertHallInMuseum(ctx, item.hall_id))) return fail("err.categoryMissing");
  }

  const nextByHall = new Map<string, number>();
  const rows = [];
  for (const item of parsed.data) {
    const key = item.hall_id ?? "none";
    const sortOrder = nextByHall.get(key) ?? (await nextSortOrder(ctx, item.hall_id));
    nextByHall.set(key, sortOrder + 1);
    rows.push({
      id: item.id,
      museum_id: ctx.museum.id,
      hall_id: item.hall_id,
      title: item.title,
      image_path: item.image_path,
      width_px: item.width_px,
      height_px: item.height_px,
      aspect_ratio: item.aspect_ratio,
      frame_style: null as FrameStyle | null,
      sort_order: sortOrder,
    });
  }

  let result = await ctx.supabase.from("artworks").insert(rows).select("id");
  if (result.error?.code === NOT_NULL_VIOLATION) {
    const explicit = await Promise.all(
      rows.map(async (row) => ({ ...row, frame_style: await hallFrameDefault(ctx, row.hall_id) })),
    );
    result = await ctx.supabase.from("artworks").insert(explicit).select("id");
  }
  if (result.error) return failDb(result.error);

  revalidateMuseum(ctx.museum.slug);
  return { ok: true, data: { ids: (result.data ?? []).map((row) => row.id) } };
}

export async function updateArtwork(id: string, input: ArtworkFieldsInput): Promise<ActionResult> {
  const ctx = await getMuseumActionContext();
  if (!uuidSchema.safeParse(id).success) return fail("err.invalidArtwork");
  const parsed = artworkFieldsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  if (!(await assertHallInMuseum(ctx, parsed.data.hall_id))) return fail("err.categoryMissing", { hall_id: "err.categoryMissing" });

  const run = (frameStyle: FrameStyle | null) =>
    ctx.supabase
      .from("artworks")
      .update({ ...parsed.data, frame_style: frameStyle })
      .eq("id", id)
      .eq("museum_id", ctx.museum.id)
      .select("id");

  let result = await run(parsed.data.frame_style);
  if (result.error?.code === NOT_NULL_VIOLATION && parsed.data.frame_style === null) {
    result = await run(await hallFrameDefault(ctx, parsed.data.hall_id));
  }
  if (result.error) return failDb(result.error);
  if (!result.data?.length) return fail("err.artworkNotFound");

  revalidateMuseum(ctx.museum.slug);
  return { ok: true, data: undefined };
}

/** Deletes rows first, then the Storage objects they pointed to. */
export async function deleteArtworks(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const ctx = await getMuseumActionContext();
  const parsed = z.array(uuidSchema).min(1).max(200).safeParse(ids);
  if (!parsed.success) return fail("err.invalidSelection");

  const { data: rows, error } = await ctx.supabase
    .from("artworks")
    .delete()
    .in("id", parsed.data)
    .eq("museum_id", ctx.museum.id)
    .select("id, image_path");
  if (error) return failDb(error);

  await removeStoredFiles(ctx.supabase, ctx.museum.id, (rows ?? []).map((row) => row.image_path));
  revalidateMuseum(ctx.museum.slug);
  return { ok: true, data: { deleted: rows?.length ?? 0 } };
}

export async function moveArtworksToHall(ids: string[], hallId: string | null): Promise<ActionResult> {
  const ctx = await getMuseumActionContext();
  const parsed = z.array(uuidSchema).min(1).max(200).safeParse(ids);
  if (!parsed.success) return fail("err.invalidSelection");
  if (hallId !== null && !uuidSchema.safeParse(hallId).success) return fail("err.invalidCategory");
  if (!(await assertHallInMuseum(ctx, hallId))) return fail("err.categoryMissing");

  let sortOrder = await nextSortOrder(ctx, hallId);
  for (const id of parsed.data) {
    const { error } = await ctx.supabase
      .from("artworks")
      .update({ hall_id: hallId, sort_order: sortOrder })
      .eq("id", id)
      .eq("museum_id", ctx.museum.id);
    if (error) return failDb(error);
    sortOrder += 1;
  }
  revalidateMuseum(ctx.museum.slug);
  return { ok: true, data: undefined };
}

/** Persists a new order for the artworks of one hall (null = unassigned). */
export async function reorderArtworks(hallId: string | null, orderedIds: string[]): Promise<ActionResult> {
  const ctx = await getMuseumActionContext();
  const parsed = z.array(uuidSchema).min(1).max(500).safeParse(orderedIds);
  if (!parsed.success || (hallId !== null && !uuidSchema.safeParse(hallId).success)) return fail("err.invalidOrder");

  let query = ctx.supabase.from("artworks").select("id").eq("museum_id", ctx.museum.id);
  query = hallId ? query.eq("hall_id", hallId) : query.is("hall_id", null);
  const { data: current } = await query;
  const known = new Set((current ?? []).map((row: Pick<ArtworkRow, "id">) => row.id));
  const ids = parsed.data;
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
    return fail("err.artworksChanged");
  }

  const results = await Promise.all(
    ids.map((id, index) =>
      ctx.supabase.from("artworks").update({ sort_order: index }).eq("id", id).eq("museum_id", ctx.museum.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed) return failDb(failed.error);

  revalidateMuseum(ctx.museum.slug);
  return { ok: true, data: undefined };
}
