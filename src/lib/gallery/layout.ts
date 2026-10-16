import type { FrameStyle } from "@/types/database";
import { artworkSize, type ArtworkSize } from "./frame-specs";

// Deterministic, pure layout of the whole museum: ONE long gallery whose art wall
// runs along the X axis (the wall plane is z = 0, the visitor stands at z > 0).
// Halls are consecutive zones separated by portals. No randomness, no DOM.

export const EYE_CENTER = 1.55; // height of the artwork centers (m)
export const WALL_HEIGHT = 4.2;
export const ROOM_DEPTH = 8;
export const PORTAL_WIDTH = 3.6;
export const PORTAL_HEIGHT = 3.15;
export const LOBBY_LENGTH = 7; // walking room before the first portal
const START_PAD = 1.5; // portal edge -> first artwork edge
const END_PAD = 1.5; // last artwork edge -> next portal edge
const END_CAP = 2.2; // last artwork edge -> closing wall of the museum
const PLAQUE_GAP = 0.2;
const PLAQUE_HEIGHT = 0.17;

export type LayoutArtworkInput = {
  id: string;
  title: string;
  aspect: number | null;
  frameStyle: FrameStyle;
  mat: boolean;
};

export type LayoutZoneInput = {
  id: string;
  name: string;
  kind: "hall" | "other";
  artworks: readonly LayoutArtworkInput[];
};

export type ArtworkPlacement = ArtworkSize & {
  id: string;
  title: string;
  frameStyle: FrameStyle;
  mat: boolean;
  /** Global index in walking order. */
  index: number;
  zoneIndex: number;
  indexInZone: number;
  /** Center of the opening on the wall. */
  x: number;
  y: number;
  plaque: { x: number; y: number; w: number; h: number };
};

export type ZoneSpan = {
  id: string;
  name: string;
  kind: "hall" | "other";
  zoneIndex: number;
  /** Wall range owned by this zone (the first zone also owns the lobby). */
  start: number;
  end: number;
  /** Center of the portal that opens this zone. */
  portalX: number;
  artworkCount: number;
};

export type CameraStop =
  | { id: string; kind: "hall"; zoneIndex: number; x: number; targetW: number; targetH: number }
  | { id: string; kind: "artwork"; zoneIndex: number; x: number; artworkIndex: number; targetW: number; targetH: number };

export type MuseumLayout = {
  zones: ZoneSpan[];
  artworks: ArtworkPlacement[];
  stops: CameraStop[];
  /** Left and right ends of the walkable gallery. */
  minX: number;
  maxX: number;
  /** Index in `stops` where a visit starts (first artwork, falling back to the first stop). */
  firstArtworkStop: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Gap between two neighbouring frames, proportional to their widths. */
export function gapBetween(leftOuterW: number, rightOuterW: number): number {
  return clamp(0.75 + 0.32 * ((leftOuterW + rightOuterW) / 2), 1.1, 1.9);
}

export function plaqueWidth(title: string, outerW: number): number {
  return clamp(0.24 + title.trim().length * 0.034, 0.5, Math.max(0.5, Math.min(outerW, 1.15)));
}

export function buildLayout(input: readonly LayoutZoneInput[]): MuseumLayout {
  const zonesWithArt = input.filter((zone) => zone.artworks.length > 0);
  const zones: ZoneSpan[] = [];
  const artworks: ArtworkPlacement[] = [];
  const stops: CameraStop[] = [];

  let portalX = 0;
  zonesWithArt.forEach((zone, zoneIndex) => {
    if (zoneIndex > 0) {
      const last = artworks[artworks.length - 1];
      portalX = last.x + last.outerW / 2 + END_PAD + PORTAL_WIDTH / 2;
    }

    stops.push({
      id: `hall:${zone.id}`,
      kind: "hall",
      zoneIndex,
      x: portalX,
      targetW: PORTAL_WIDTH + 1.4,
      targetH: PORTAL_HEIGHT + 0.6,
    });

    let cursor = portalX + PORTAL_WIDTH / 2 + START_PAD;
    let previousOuterW = 0;
    zone.artworks.forEach((item, indexInZone) => {
      const size = artworkSize(item.aspect, item.frameStyle, item.mat);
      if (indexInZone > 0) cursor += gapBetween(previousOuterW, size.outerW);
      const x = cursor + size.outerW / 2;
      const plaqueW = plaqueWidth(item.title, size.outerW);
      const index = artworks.length;
      artworks.push({
        ...size,
        id: item.id,
        title: item.title,
        frameStyle: item.frameStyle,
        mat: item.mat,
        index,
        zoneIndex,
        indexInZone,
        x,
        y: EYE_CENTER,
        plaque: {
          x,
          y: EYE_CENTER - size.outerH / 2 - PLAQUE_GAP - PLAQUE_HEIGHT / 2,
          w: plaqueW,
          h: PLAQUE_HEIGHT,
        },
      });
      stops.push({
        id: `art:${item.id}`,
        kind: "artwork",
        zoneIndex,
        x,
        artworkIndex: index,
        targetW: size.outerW,
        targetH: size.outerH + PLAQUE_GAP + PLAQUE_HEIGHT,
      });
      cursor += size.outerW;
      previousOuterW = size.outerW;
    });

    zones.push({
      id: zone.id,
      name: zone.name,
      kind: zone.kind,
      zoneIndex,
      start: zoneIndex === 0 ? portalX - LOBBY_LENGTH : portalX,
      end: 0, // filled below once the next portal is known
      portalX,
      artworkCount: zone.artworks.length,
    });
  });

  const lastArtwork = artworks[artworks.length - 1];
  const maxX = lastArtwork ? lastArtwork.x + lastArtwork.outerW / 2 + END_CAP : 0;
  zones.forEach((zone, i) => {
    zone.end = i < zones.length - 1 ? zones[i + 1].portalX : maxX;
  });

  const firstArtworkStop = Math.max(
    0,
    stops.findIndex((stop) => stop.kind === "artwork"),
  );
  return { zones, artworks, stops, minX: zones[0]?.start ?? 0, maxX, firstArtworkStop };
}

/** Index of the stop closest to `x` (used to re-sync the UI after a click on the wall). */
export function nearestStop(layout: MuseumLayout, x: number): number {
  let best = 0;
  let bestDistance = Infinity;
  layout.stops.forEach((stop, index) => {
    const distance = Math.abs(stop.x - x);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** Index of the first stop (the hall entrance) of a zone. */
export function hallStopIndex(layout: MuseumLayout, zoneIndex: number): number {
  return layout.stops.findIndex((stop) => stop.kind === "hall" && stop.zoneIndex === zoneIndex);
}

export type ZoneBlend = { from: number; to: number; amount: number };

/**
 * Which two zones the camera at `x` is between and how far toward the second.
 * Blending is centered on each portal, so scene colors cross-fade right where the
 * visitor walks through the arch (never a pop).
 */
export function zoneBlendAt(layout: MuseumLayout, x: number, transition = 2.4): ZoneBlend {
  const { zones } = layout;
  if (zones.length === 0) return { from: 0, to: 0, amount: 0 };
  for (let i = 1; i < zones.length; i += 1) {
    const portal = zones[i].portalX;
    if (x < portal - transition) return { from: i - 1, to: i - 1, amount: 0 };
    if (x <= portal + transition) {
      const t = (x - (portal - transition)) / (2 * transition);
      const eased = t * t * (3 - 2 * t);
      return { from: i - 1, to: i, amount: eased };
    }
  }
  const last = zones.length - 1;
  return { from: last, to: last, amount: 0 };
}

/** Zone that owns wall position `x` (inclusive start, exclusive end). */
export function zoneIndexAt(layout: MuseumLayout, x: number): number {
  for (let i = layout.zones.length - 1; i >= 0; i -= 1) {
    if (x >= layout.zones[i].start) return i;
  }
  return 0;
}
