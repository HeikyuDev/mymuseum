import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildViewerMuseum, type ViewerMuseum } from "@/lib/viewer-model";

export type { ViewerArtwork, ViewerHall, ViewerMuseum } from "@/lib/viewer-model";

/** Loads a published museum with its visible halls and active artworks (RLS-scoped, anon). */
export const getPublishedMuseum = cache(async (slug: string): Promise<ViewerMuseum | null> => {
  const supabase = await createClient();

  // select("*") keeps working when optional columns are not migrated yet.
  const { data: museum } = await supabase
    .from("museums")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!museum) return null;

  const [hallsResult, artworksResult] = await Promise.all([
    supabase.from("halls").select("*").eq("museum_id", museum.id).eq("is_visible", true).order("sort_order"),
    supabase.from("artworks").select("*").eq("museum_id", museum.id).eq("is_active", true).order("sort_order"),
  ]);

  return buildViewerMuseum({
    museum,
    halls: hallsResult.data ?? [],
    artworks: artworksResult.data ?? [],
  });
});
