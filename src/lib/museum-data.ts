import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getArtworkPublicUrl } from "@/lib/supabase/storage";
import { resolveHallStyle, type ResolvedHallStyle } from "@/lib/hall-style";
import { resolveMuseumTheme, type ResolvedMuseumTheme } from "@/lib/theme";
import { FRAME_STYLES } from "@/lib/hall-style";
import type { ArtworkRow, FrameStyle } from "@/types/database";

export type ViewerArtwork = {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  year: number | null;
  imageUrl: string;
  aspect: number | null;
  frameStyle: FrameStyle;
  frameColor: string | null;
  mat: boolean;
  matColor: string | null;
};

export type ViewerHall = {
  id: string;
  name: string;
  description: string | null;
  style: ResolvedHallStyle;
  coverUrl: string | null;
  artworks: ViewerArtwork[];
};

export type ViewerMuseum = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  coverUrl: string | null;
  theme: ResolvedMuseumTheme;
  halls: ViewerHall[];
};

function imageUrlOf(row: Pick<ArtworkRow, "image_path" | "external_image_url">): string | null {
  if (row.image_path) return getArtworkPublicUrl(row.image_path);
  return row.external_image_url || null;
}

function aspectOf(row: ArtworkRow): number | null {
  const ratio = Number(row.aspect_ratio);
  if (Number.isFinite(ratio) && ratio > 0) return ratio;
  if (row.width_px && row.height_px) return row.width_px / row.height_px;
  return null;
}

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

  const artworksByHall = new Map<string, ViewerArtwork[]>();
  const coverById = new Map<string, string>();
  for (const row of artworksResult.data ?? []) {
    const imageUrl = imageUrlOf(row);
    if (!row.hall_id || !imageUrl) continue;
    coverById.set(row.id, imageUrl);
    const list = artworksByHall.get(row.hall_id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      description: row.description,
      author: row.author_name,
      year: row.year,
      imageUrl,
      aspect: aspectOf(row),
      frameStyle: (FRAME_STYLES as readonly string[]).includes(row.frame_style) ? row.frame_style : "minimal",
      frameColor: row.frame_color,
      mat: row.mat,
      matColor: row.mat_color,
    });
    artworksByHall.set(row.hall_id, list);
  }

  const halls: ViewerHall[] = (hallsResult.data ?? []).map((hall) => {
    const artworks = artworksByHall.get(hall.id) ?? [];
    return {
      id: hall.id,
      name: hall.name,
      description: hall.description,
      style: resolveHallStyle(hall),
      coverUrl: (hall.cover_artwork_id && coverById.get(hall.cover_artwork_id)) || artworks[0]?.imageUrl || null,
      artworks,
    };
  });

  const coverPath = museum.cover_image_path;
  return {
    id: museum.id,
    slug: museum.slug,
    title: museum.title,
    tagline: museum.tagline,
    description: museum.description,
    coverUrl: coverPath ? getArtworkPublicUrl(coverPath) : (halls.find((h) => h.coverUrl)?.coverUrl ?? null),
    theme: resolveMuseumTheme(museum),
    halls,
  };
});
