import { resolveHallStyle } from "@/lib/hall-style";
import { resolveMuseumTheme } from "@/lib/theme";
import { resolveFrameStyle } from "@/lib/viewer-model";
import type { ArtworkRow, HallRow, MuseumRow } from "@/types/database";
import type { StoryArtworkInfo, StoryHallInfo, StoryMuseumInfo } from "./plan";

// Pure mappers from database rows to the export model, used by the admin pages
// (the public viewer builds the same shapes from its own viewer model).

export function storyHallsFromRows(halls: readonly HallRow[]): StoryHallInfo[] {
  return halls.map((hall) => ({ id: hall.id, name: hall.name, style: resolveHallStyle(hall) }));
}

export function storyMuseumFromRow(museum: Pick<MuseumRow, "title" | "slug" | "accent_color" | "font_pairing">): StoryMuseumInfo {
  const theme = resolveMuseumTheme(museum);
  return { title: museum.title, slug: museum.slug, accent: theme.accent, fontPairing: theme.fontPairing };
}

export function storyArtworkFromRow(
  row: Pick<ArtworkRow, "title" | "year" | "aspect_ratio" | "frame_style" | "frame_color" | "mat" | "mat_color" | "hall_id">,
  imageUrl: string,
  halls: readonly HallRow[],
): StoryArtworkInfo {
  const hall = halls.find((item) => item.id === row.hall_id);
  const ratio = Number(row.aspect_ratio);
  return {
    title: row.title,
    year: row.year,
    imageUrl,
    aspect: Number.isFinite(ratio) && ratio > 0 ? ratio : null,
    frameStyle: resolveFrameStyle(row.frame_style, resolveHallStyle(hall ?? {}).defaultFrameStyle),
    frameColor: row.frame_color,
    mat: row.mat,
    matColor: row.mat_color,
  };
}
