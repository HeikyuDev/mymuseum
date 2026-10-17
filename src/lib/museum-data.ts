import "server-only";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { museumCacheTag } from "@/lib/museum-cache";
import {
  VIEWER_ARTWORK_COLUMNS,
  VIEWER_HALL_COLUMNS,
  buildViewerMuseum,
  type ViewerArtworkRow,
  type ViewerHallRow,
  type ViewerMuseum,
} from "@/lib/viewer-model";
import type { MuseumRow } from "@/types/database";

export type { ViewerArtwork, ViewerHall, ViewerMuseum } from "@/lib/viewer-model";

type MuseumWithChildren = Pick<
  MuseumRow,
  "id" | "slug" | "title" | "tagline" | "description" | "cover_image_path" | "theme_preset" | "accent_color" | "font_pairing" | "theme_overrides" | "default_hall_id"
> & { halls: ViewerHallRow[] | null; artworks: ViewerArtworkRow[] | null };

const MUSEUM_COLUMNS =
  "id, slug, title, tagline, description, cover_image_path, theme_preset, accent_color, font_pairing, theme_overrides, default_hall_id";

/**
 * One round trip (the relationship hints avoid the ambiguity with museums.default_hall_id): the museum with its visible halls and active artworks embedded, selecting
 * only the columns the viewer reads. The anonymous client carries no cookies, so the result
 * does not depend on the request and can be cached; RLS still limits it to published rows.
 */
async function fetchPublishedMuseum(slug: string): Promise<ViewerMuseum | null> {
  const supabase = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("museums")
    .select(`${MUSEUM_COLUMNS}, halls!halls_museum_id_fkey(${VIEWER_HALL_COLUMNS}), artworks!artworks_museum_id_fkey(${VIEWER_ARTWORK_COLUMNS})`)
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("halls.is_visible", true)
    .eq("artworks.is_active", true)
    .maybeSingle();
  // A failed query must not look like "no such museum": a thrown error is never cached by unstable_cache,
  // so one transient failure cannot turn a valid museum into a 404 for everyone for a minute.
  if (error) {
    console.error(`[museum-data] could not load museum "${slug}": ${error.message}`);
    throw new Error("Could not load the museum.");
  }
  if (!data) return null;
  const { halls, artworks, ...museum } = data as unknown as MuseumWithChildren;
  return buildViewerMuseum({ museum, halls: halls ?? [], artworks: artworks ?? [] });
}

/** Cached for a minute and dropped on demand by every studio and admin mutation (see museum-cache.ts). */
const cachedMuseum = (slug: string) =>
  unstable_cache(() => fetchPublishedMuseum(slug), ["published-museum", slug], { tags: [museumCacheTag(slug)], revalidate: 60 })();

/** Loads a published museum with its visible halls and active artworks (deduplicated per request). */
export const getPublishedMuseum = cache(async (slug: string): Promise<ViewerMuseum | null> => cachedMuseum(slug));
