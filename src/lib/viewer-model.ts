import { FRAME_STYLES, resolveHallStyle, type ResolvedHallStyle } from "@/lib/hall-style";
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

function aspectOf(row: Pick<ArtworkRow, "aspect_ratio" | "width_px" | "height_px">): number | null {
  const ratio = Number(row.aspect_ratio);
  if (Number.isFinite(ratio) && ratio > 0) return ratio;
  if (row.width_px && row.height_px) return row.width_px / row.height_px;
  return null;
}

type MuseumInput = Pick<MuseumRow, "id" | "slug" | "title" | "tagline" | "description" | "cover_image_path"> &
  Partial<Pick<MuseumRow, "theme_preset" | "accent_color" | "font_pairing" | "theme_overrides" | "default_hall_id">>;

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/**
 * Builds the viewer model. Halls must already be filtered (visibility) and
 * artworks too (active); unassigned artworks and artworks without an image
 * are skipped, as on the public page.
 */
export function buildViewerMuseum(input: {
  museum: MuseumInput;
  halls: readonly HallRow[];
  artworks: readonly ArtworkRow[];
}): ViewerMuseum {
  const { museum } = input;
  const hallRows = [...input.halls].sort(bySortOrder);
  const hallById = new Map(hallRows.map((hall) => [hall.id, hall]));

  const artworksByHall = new Map<string, ViewerArtwork[]>();
  const coverById = new Map<string, string>();
  for (const row of [...input.artworks].sort(bySortOrder)) {
    const hall = row.hall_id ? hallById.get(row.hall_id) : undefined;
    const imageUrl = artworkImageUrl(row);
    if (!hall || !imageUrl) continue;
    coverById.set(row.id, imageUrl);
    const list = artworksByHall.get(hall.id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      description: row.description,
      author: row.author_name,
      year: row.year,
      imageUrl,
      aspect: aspectOf(row),
      frameStyle: resolveFrameStyle(row.frame_style, resolveHallStyle(hall).defaultFrameStyle),
      frameColor: row.frame_color,
      mat: row.mat,
      matColor: row.mat_color,
    });
    artworksByHall.set(hall.id, list);
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
  };
}
