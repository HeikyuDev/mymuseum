import { FRAME_STYLES, resolveHallStyle, type ResolvedHallStyle } from "@/lib/hall-style";
import { mayHaveThumb, thumbPathFor } from "@/lib/images";
import { getArtworkPublicUrl } from "@/lib/supabase/storage";
import { resolveMuseumTheme, type ResolvedMuseumTheme } from "@/lib/theme";
import type { ArtworkRow, FrameStyle, HallRow, MuseumRow } from "@/types/database";

// Pure (server and browser safe) mapping from database rows to the shapes the
// viewer renders. The public page and the admin live preview share it, so what
// the owner previews is exactly what visitors get.

export type ViewerArtwork = {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  year: number | null;
  imageUrl: string;
  /** Small (640px) copy stored next to the original; absent for older artworks. The viewer falls back to `imageUrl` when it 404s. */
  thumbUrl?: string | null;
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
  /** Hall marked "Start here" on the entrance (null = none). */
  defaultHallId: string | null;
  theme: ResolvedMuseumTheme;
  halls: ViewerHall[];
  /** Artworks without a (visible) hall; the viewer shows them in a final "Other" zone. */
  otherArtworks: ViewerArtwork[];
};

/**
 * Frame resolution rule: an artwork without a valid explicit frame style (null,
 * empty or unknown) inherits the hall's default frame style.
 */
export function resolveFrameStyle(value: unknown, hallDefault: FrameStyle): FrameStyle {
  return typeof value === "string" && (FRAME_STYLES as readonly string[]).includes(value)
    ? (value as FrameStyle)
    : hallDefault;
}

export function artworkImageUrl(row: Pick<ArtworkRow, "image_path" | "external_image_url">): string | null {
  if (row.image_path) return getArtworkPublicUrl(row.image_path);
  return row.external_image_url || null;
}

/** Public URL of the thumbnail an upload may have, or null when none is expected. */
export function artworkThumbUrl(row: Pick<ArtworkRow, "image_path" | "created_at">): string | null {
  if (!row.image_path || !mayHaveThumb(row.created_at)) return null;
  const path = thumbPathFor(row.image_path);
  return path ? getArtworkPublicUrl(path) : null;
}

function aspectOf(row: Pick<ArtworkRow, "aspect_ratio" | "width_px" | "height_px">): number | null {
  const ratio = Number(row.aspect_ratio);
  if (Number.isFinite(ratio) && ratio > 0) return ratio;
  if (row.width_px && row.height_px) return row.width_px / row.height_px;
  return null;
}

type MuseumInput = Pick<MuseumRow, "id" | "slug" | "title" | "tagline" | "description" | "cover_image_path"> &
  Partial<Pick<MuseumRow, "theme_preset" | "accent_color" | "font_pairing" | "theme_overrides" | "default_hall_id">>;

/** Columns of a hall the viewer reads (the public page selects only these). */
export const VIEWER_HALL_COLUMNS =
  "id, name, description, sort_order, cover_artwork_id, wall_style, wall_color, floor_style, floor_decoration, floor_decoration_color, lighting_preset, default_frame_style, accent_color, decor";
export type ViewerHallRow = Pick<HallRow, "id" | "name" | "description" | "sort_order" | "cover_artwork_id" | "wall_style" | "wall_color" | "floor_style" | "floor_decoration" | "floor_decoration_color" | "lighting_preset" | "default_frame_style" | "accent_color" | "decor">;

/** Columns of an artwork the viewer reads. */
export const VIEWER_ARTWORK_COLUMNS =
  "id, hall_id, title, description, author_name, year, image_path, external_image_url, aspect_ratio, width_px, height_px, frame_style, frame_color, mat, mat_color, sort_order, created_at";
export type ViewerArtworkRow = Pick<ArtworkRow, "id" | "hall_id" | "title" | "description" | "author_name" | "year" | "image_path" | "external_image_url" | "aspect_ratio" | "width_px" | "height_px" | "frame_style" | "frame_color" | "mat" | "mat_color" | "sort_order" | "created_at">;

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/**
 * Builds the viewer model. Halls must already be filtered (visibility) and
 * artworks too (active); artworks without an image are skipped and
 * artworks whose hall is missing end up in `otherArtworks`.
 */
export function buildViewerMuseum(input: {
  museum: MuseumInput;
  halls: readonly ViewerHallRow[];
  artworks: readonly ViewerArtworkRow[];
}): ViewerMuseum {
  const { museum } = input;
  const hallRows = [...input.halls].sort(bySortOrder);
  const hallById = new Map(hallRows.map((hall) => [hall.id, hall]));

  const artworksByHall = new Map<string, ViewerArtwork[]>();
  const otherArtworks: ViewerArtwork[] = [];
  const coverById = new Map<string, string>();
  for (const row of [...input.artworks].sort(bySortOrder)) {
    const hall = row.hall_id ? hallById.get(row.hall_id) : undefined;
    const imageUrl = artworkImageUrl(row);
    if (!imageUrl) continue;
    coverById.set(row.id, imageUrl);
    const defaultFrame = resolveHallStyle(hall ?? {}).defaultFrameStyle;
    const list = hall ? (artworksByHall.get(hall.id) ?? []) : otherArtworks;
    list.push({
      id: row.id,
      title: row.title,
      description: row.description,
      author: row.author_name,
      year: row.year,
      imageUrl,
      thumbUrl: artworkThumbUrl(row),
      aspect: aspectOf(row),
      frameStyle: resolveFrameStyle(row.frame_style, defaultFrame),
      frameColor: row.frame_color,
      mat: row.mat,
      matColor: row.mat_color,
    });
    if (hall) artworksByHall.set(hall.id, list);
  }

  const halls: ViewerHall[] = hallRows.map((hall) => {
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
    defaultHallId: halls.some((h) => h.id === museum.default_hall_id) ? (museum.default_hall_id ?? null) : null,
    theme: resolveMuseumTheme(museum),
    halls,
    otherArtworks,
  };
}
