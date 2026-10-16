import { resolveHallStyle, type ResolvedHallStyle } from "@/lib/hall-style";
import type { ViewerArtwork, ViewerMuseum } from "@/lib/viewer-model";
import type { LayoutZoneInput } from "./layout";

export const OTHER_ZONE_ID = "__other__";

/** A render-ready zone: a visible hall (or the "Other" zone) with its style and artworks. */
export type GalleryZone = {
  id: string;
  name: string;
  kind: "hall" | "other";
  style: ResolvedHallStyle;
  artworks: ViewerArtwork[];
};

/** Non-empty zones in walking order; "Other" is last and only exists when needed. */
export function galleryZones(museum: Pick<ViewerMuseum, "halls" | "otherArtworks">): GalleryZone[] {
  const zones: GalleryZone[] = museum.halls
    .filter((hall) => hall.artworks.length > 0)
    .map((hall) => ({ id: hall.id, name: hall.name, kind: "hall", style: hall.style, artworks: hall.artworks }));
  if (museum.otherArtworks.length > 0) {
    zones.push({ id: OTHER_ZONE_ID, name: "", kind: "other", style: resolveHallStyle({}), artworks: museum.otherArtworks });
  }
  return zones;
}

export function toLayoutZones(zones: readonly GalleryZone[]): LayoutZoneInput[] {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    kind: zone.kind,
    artworks: zone.artworks.map((artwork) => ({
      id: artwork.id,
      title: artwork.title,
      aspect: artwork.aspect,
      frameStyle: artwork.frameStyle,
      mat: artwork.mat,
    })),
  }));
}
